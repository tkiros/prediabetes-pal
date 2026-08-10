#!/usr/bin/env node

import process from "node:process";
import { fileURLToPath } from "node:url";

export const CANONICAL_APP_URL = "https://prediabetespal.com";
export const CRON_PATHS = Object.freeze([
  "/api/cron/nudge",
  "/api/cron/pantry-sweep",
  "/api/cron/trial-precharge",
  "/api/cron/stripe-reconcile"
]);

const DEFAULT_TIMEOUT_MS = 330_000;
const MAX_RESPONSE_BYTES = 64 * 1024;

export class CronRunnerError extends Error {
  constructor(code) {
    super(code);
    this.name = "CronRunnerError";
    this.code = code;
  }
}

export function validateCronConfig(env = process.env) {
  if (env.APP_URL !== CANONICAL_APP_URL) {
    throw new CronRunnerError("invalid_app_url");
  }

  if (typeof env.CRON_SECRET !== "string" || env.CRON_SECRET.length === 0) {
    throw new CronRunnerError("missing_cron_secret");
  }

  return {
    appUrl: CANONICAL_APP_URL,
    secret: env.CRON_SECRET
  };
}

function isJsonContentType(value) {
  const mediaType = value?.split(";", 1)[0]?.trim().toLowerCase();
  return mediaType === "application/json" || mediaType?.endsWith("+json");
}

async function readBoundedBody(response, maxBytes = MAX_RESPONSE_BYTES) {
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new CronRunnerError("response_too_large");
  }

  if (!response.body) {
    return "";
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let totalBytes = 0;
  let text = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel();
        throw new CronRunnerError("response_too_large");
      }

      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    return text;
  } finally {
    reader.releaseLock();
  }
}

function failure(path, code, httpStatus, durationMs) {
  return {
    path,
    ok: false,
    code,
    ...(httpStatus === undefined ? {} : { httpStatus }),
    durationMs
  };
}

async function invokeCron(path, config, deps) {
  const startedAt = deps.now();
  const requestUrl = `${config.appUrl}${path}`;

  try {
    const response = await deps.fetch(requestUrl, {
      method: "GET",
      redirect: "manual",
      cache: "no-store",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${config.secret}`,
        "user-agent": "pal-hourly-cron/1"
      },
      signal: AbortSignal.timeout(deps.timeoutMs)
    });
    const durationMs = Math.max(0, deps.now() - startedAt);

    if (response.status >= 300 && response.status < 400) {
      return failure(path, "redirect_rejected", response.status, durationMs);
    }
    if (!response.ok) {
      return failure(path, "http_error", response.status, durationMs);
    }
    if (!isJsonContentType(response.headers.get("content-type"))) {
      return failure(path, "invalid_content_type", response.status, durationMs);
    }

    let body;
    try {
      body = JSON.parse(await readBoundedBody(response));
    } catch (error) {
      const code =
        error instanceof CronRunnerError ? error.code : "invalid_json";
      return failure(path, code, response.status, durationMs);
    }

    if (
      typeof body !== "object" ||
      body === null ||
      Array.isArray(body) ||
      body.ok !== true
    ) {
      return failure(path, "negative_ack", response.status, durationMs);
    }

    return {
      path,
      ok: true,
      code: "ok",
      httpStatus: response.status,
      durationMs
    };
  } catch (error) {
    const code =
      error instanceof DOMException &&
      (error.name === "AbortError" || error.name === "TimeoutError")
        ? "request_timeout"
        : "request_failed";
    return failure(path, code, undefined, Math.max(0, deps.now() - startedAt));
  }
}

export async function runHourlyCrons(config, options = {}) {
  const deps = {
    fetch: options.fetch ?? globalThis.fetch,
    info: options.info ?? console.log,
    error: options.error ?? console.error,
    now: options.now ?? Date.now,
    timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  };

  const results = [];
  for (const path of CRON_PATHS) {
    const result = await invokeCron(path, config, deps);
    results.push(result);

    const fields = [
      `[cron-runner] path=${result.path}`,
      `result=${result.code}`,
      ...(result.httpStatus === undefined
        ? []
        : [`http_status=${result.httpStatus}`]),
      `duration_ms=${result.durationMs}`
    ];
    (result.ok ? deps.info : deps.error)(fields.join(" "));
  }

  const failures = results.filter((result) => !result.ok);
  const summary = `[cron-runner] completed=${results.length} failed=${failures.length}`;
  (failures.length === 0 ? deps.info : deps.error)(summary);

  return { ok: failures.length === 0, results };
}

export async function runHourlyCronCli(env = process.env, options = {}) {
  const error = options.error ?? console.error;

  let config;
  try {
    config = validateCronConfig(env);
  } catch (configError) {
    const code =
      configError instanceof CronRunnerError
        ? configError.code
        : "configuration_error";
    error(`[cron-runner] result=${code}`);
    return 1;
  }

  const result = await runHourlyCrons(config, options);
  return result.ok ? 0 : 1;
}

const isMainModule =
  process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isMainModule) {
  runHourlyCronCli().then(
    (code) => {
      process.exitCode = code;
    },
    () => {
      console.error("[cron-runner] result=internal_failure");
      process.exitCode = 1;
    }
  );
}
