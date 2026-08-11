import OpenAI from "openai";
import type { ResponseCreateParamsNonStreaming } from "openai/resources/responses/responses";
import type { ReasoningEffort } from "openai/resources/shared";

import {
  assertModelIdMatchesTransport,
  resolveTransportBaseUrl,
  PalModelConfigurationError
} from "../model-transport";
import { PalModelOutputSchema, palModelJsonSchema } from "./schemas";
import type { PalModelOutput } from "./schemas";
import type { PalPromptPayload } from "./prompt";

export const DEFAULT_PAL_MODEL = "gpt-5.4-mini";
export const PAL_JSON_SCHEMA_NAME = "pal_model_output";

export type PalModelProvider = "openai" | "openrouter" | "compatible";

export { PalModelConfigurationError };

export class PalProviderResponseError extends Error {
  readonly code: string;

  constructor(response: ResponsesCreateResult) {
    super("Model provider response did not contain usable output.");
    this.name = "PalProviderResponseError";
    const candidates = [
      response.error_type,
      response.error?.code,
      response.status
    ];
    this.code =
      candidates.find(
        (value): value is string =>
          typeof value === "string" && /^[A-Za-z0-9_.-]{2,40}$/.test(value)
      ) ?? "EMPTY_OUTPUT";
  }
}

/**
 * The model this process will actually call — for telemetry (W-13/N-18).
 *
 * Telemetry used to record no model at all, so a user reporting a bad answer
 * could not be attributed to the model that produced it. This is the same
 * resolution the client itself does, kept in one place so the stamp cannot
 * drift from the call.
 */
export function activeModelId(input: NodeJS.ProcessEnv = process.env): string {
  // `??` alone is wrong here: a declared-but-empty PAL_MODEL= (a real .env
  // and a real Vercel state) is a string, so it wins the coalesce and every
  // call asks the provider for model "" — a 400 on every request, product and
  // eval alike. Blank means unset.
  //
  // REVORA_MODEL is the pre-rename name, read only as a fallback so this
  // branch can merge before the Vercel env vars are renamed. Without it,
  // production resolves to the unprefixed default while OPENAI_BASE_URL still
  // points at OpenRouter — assertModelIdMatchesTransport then throws on every
  // call. REMOVE once PAL_MODEL exists in Vercel production (see
  // docs/ops/outstanding.md).
  return (
    input.PAL_MODEL?.trim() || input.REVORA_MODEL?.trim() || DEFAULT_PAL_MODEL
  );
}

function providerForBaseUrl(baseURL: string | undefined): PalModelProvider {
  if (!baseURL) {
    return "openai";
  }
  try {
    return new URL(baseURL).hostname.toLowerCase() === "openrouter.ai"
      ? "openrouter"
      : "compatible";
  } catch {
    return "compatible";
  }
}

export function activeModelProvider(
  input: NodeJS.ProcessEnv = process.env
): PalModelProvider {
  return providerForBaseUrl(input.OPENAI_BASE_URL?.trim() || undefined);
}

export function resolveModelTransportConfig(
  input: NodeJS.ProcessEnv = process.env,
  model = activeModelId(input)
): { model: string; provider: PalModelProvider; baseURL?: string } {
  // WS-2 (NEW-001): the shared transport policy allows production base URLs
  // only for the OpenRouter allowlist and enforces HTTPS/no-credentials
  // everywhere. Other compatible endpoints stay evaluation-only; unsetting
  // OPENAI_BASE_URL reverts the fleet to direct OpenAI without a redeploy.
  const baseURL = resolveTransportBaseUrl(input);
  const provider = providerForBaseUrl(baseURL);

  assertModelIdMatchesTransport(model, baseURL);

  return baseURL ? { model, provider, baseURL } : { model, provider };
}

// Reasoning-effort lever (cost/latency control for GPT-5.x reasoning models).
// This is a small, schema-constrained JSON classification, so a low effort is
// the likely sweet spot for cost/latency. But this is the LIVE SAFETY
// classifier (launch blocker: zero harmful-SAFE), and lowering reasoning can
// change classification quality — so the default is behavior-NEUTRAL: omit the
// parameter and let the model run at its own default. Activate a specific
// effort (recommended: "low") via PAL_REASONING_EFFORT only AFTER confirming
// it still holds zero-harmful-SAFE with `npm run eval:pal`. Reasoning tokens
// are billed as output, so a validated low effort is the main cost lever here.
// Recommended value once eval-confirmed: "low".

const REASONING_EFFORT_VALUES: ReadonlySet<ReasoningEffort> = new Set([
  "none",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh"
]);

/**
 * Resolve the reasoning effort from config. Returns `null` to mean "omit the
 * reasoning parameter" — the behavior-neutral default that preserves the
 * model's own reasoning behavior. Only an explicit, valid effort string
 * activates the parameter; anything else (unset, blank, "off", "default", or an
 * unknown value) omits it. This keeps the live safety classifier on its
 * validated behavior until a specific effort is chosen and eval-confirmed.
 */
export function resolveReasoningEffort(
  raw: string | undefined | null
): ReasoningEffort | null {
  if (raw === undefined || raw === null) {
    return null;
  }

  const value = raw.trim().toLowerCase();
  return REASONING_EFFORT_VALUES.has(value as ReasoningEffort)
    ? (value as ReasoningEffort)
    : null;
}

type ResponsesCreateResult = {
  output_text?: string;
  status?: string;
  error_type?: string;
  error?: { code?: string } | null;
};

type OpenAIResponsesTransport = {
  responses: {
    create(
      params: ResponseCreateParamsNonStreaming
    ): Promise<ResponsesCreateResult>;
  };
};

export interface PalModelClient {
  generate(prompt: PalPromptPayload): Promise<PalModelOutput>;
}

export function createOpenAIPalModelClient(options?: {
  apiKey?: string;
  model?: string;
  reasoningEffort?: ReasoningEffort | "off";
  client?: OpenAIResponsesTransport;
  openAiCtor?: typeof OpenAI;
  env?: NodeJS.ProcessEnv;
}): PalModelClient {
  const env = options?.env ?? process.env;
  const model = options?.model?.trim() || activeModelId(env);
  const reasoningEffort = resolveReasoningEffort(
    options?.reasoningEffort ??
      env.PAL_REASONING_EFFORT ??
      // Pre-rename fallback — see activeModelId() above.
      env.REVORA_REASONING_EFFORT
  );
  const client =
    options?.client ??
    createTransport(
      options?.apiKey ?? env.OPENAI_API_KEY,
      model,
      options?.openAiCtor,
      env
    );

  return {
    async generate(prompt) {
      const response = await createWithConnectionRetry(client, {
        model,
        instructions: prompt.instructions,
        input: prompt.input,
        store: false,
        // Prediabetes Pal answers are short JSON. Without a cap, OpenRouter prices the
        // request against the model's worst-case output window (65k) and can
        // reject larger models outright (2026-07-09 benchmark finding). 1024
        // (not 512) because GPT-5.x reasoning tokens bill against this cap and
        // could truncate the JSON on complex meals. A truncated response fails
        // JSON.parse below and falls to the calm retry — fail-closed, never a
        // partial answer.
        max_output_tokens: 1024,
        ...(reasoningEffort ? { reasoning: { effort: reasoningEffort } } : {}),
        text: {
          format: {
            type: "json_schema",
            name: PAL_JSON_SCHEMA_NAME,
            schema: palModelJsonSchema,
            strict: true
          }
        }
      });

      const outputText = response.output_text?.trim();
      if (!outputText) {
        throw new PalProviderResponseError(response);
      }

      let parsedOutput: unknown;

      try {
        parsedOutput = JSON.parse(outputText);
      } catch (error) {
        throw new Error("OpenAI response output_text was not valid JSON.", {
          cause: error
        });
      }

      // Normalize before validation: drop empty/whitespace example strings.
      // A benchmarked gpt-5.4-mini run failed the strict parser only because
      // it returned examples:[""] — content-free, so dropping is safe.
      if (
        parsedOutput !== null &&
        typeof parsedOutput === "object" &&
        Array.isArray((parsedOutput as { examples?: unknown }).examples)
      ) {
        (parsedOutput as { examples: unknown[] }).examples = (
          parsedOutput as { examples: unknown[] }
        ).examples.filter(
          (item) => typeof item !== "string" || item.trim().length > 0
        );
      }

      return PalModelOutputSchema.parse(parsedOutput);
    }
  };
}

/** Connection never reached (or lost) the provider and one retry also failed.
 * Surfaced as its own type so the route can log "connection_blip" instead of
 * "provider_error" (REL-01). */
export class PalConnectionError extends Error {
  constructor(cause: unknown) {
    super("Model provider unreachable after one connection retry.", { cause });
    this.name = "PalConnectionError";
  }
}

/**
 * REL-01: one retry on CONNECTION-level failures only. HTTP errors (4xx/5xx)
 * mean the provider processed the request — never retried, preserving the
 * single-paid-attempt invariant. Timeouts are also never retried: a timed-out
 * request may still be running (and billing) provider-side. The SDK's own
 * maxRetries stays 0 so retry policy lives in exactly one place.
 */
async function createWithConnectionRetry(
  client: OpenAIResponsesTransport,
  params: ResponseCreateParamsNonStreaming
): Promise<ResponsesCreateResult> {
  const isRetriableConnectionError = (error: unknown) =>
    error instanceof OpenAI.APIConnectionError &&
    !(error instanceof OpenAI.APIConnectionTimeoutError);

  try {
    return await client.responses.create(params);
  } catch (firstError) {
    if (!isRetriableConnectionError(firstError)) {
      throw firstError;
    }

    try {
      return await client.responses.create(params);
    } catch (secondError) {
      throw isRetriableConnectionError(secondError)
        ? new PalConnectionError(secondError)
        : secondError;
    }
  }
}

function createTransport(
  apiKey: string | undefined,
  model: string,
  ctor: typeof OpenAI = OpenAI,
  env: NodeJS.ProcessEnv = process.env
): OpenAIResponsesTransport {
  if (typeof window !== "undefined") {
    throw new Error(
      "Prediabetes Pal OpenAI client must run server-side only."
    );
  }

  const key = apiKey?.trim();
  if (!key) {
    throw new Error(
      "OPENAI_API_KEY is required for live Prediabetes Pal model calls."
    );
  }

  // timeout (10s) stays under the client's 12s abort so a slow call can never
  // spend after the browser has given up; maxRetries 0 means the SDK never
  // silently stacks a second paid attempt (the service does one live attempt).
  //
  const config = resolveModelTransportConfig(env, model);

  return new ctor({
    apiKey: key,
    timeout: 10_000,
    maxRetries: 0,
    ...(config.baseURL ? { baseURL: config.baseURL } : {})
  });
}
