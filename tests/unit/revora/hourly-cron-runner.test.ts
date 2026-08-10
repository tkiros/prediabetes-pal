import { describe, expect, it, vi } from "vitest";

type CronResult = {
  path: string;
  ok: boolean;
  code: string;
  httpStatus?: number;
};

type HourlyCronModule = {
  CANONICAL_APP_URL: string;
  CRON_PATHS: readonly string[];
  validateCronConfig: (env: Record<string, string>) => {
    appUrl: string;
    secret: string;
  };
  runHourlyCrons: (
    config: { appUrl: string; secret: string },
    options: {
      fetch: typeof fetch;
      info?: (message: string) => void;
      error?: (message: string) => void;
      now?: () => number;
      timeoutMs?: number;
    }
  ) => Promise<{ ok: boolean; results: CronResult[] }>;
  runHourlyCronCli: (
    env: Record<string, string>,
    options?: {
      fetch?: typeof fetch;
      info?: (message: string) => void;
      error?: (message: string) => void;
      now?: () => number;
      timeoutMs?: number;
    }
  ) => Promise<number>;
};

const RUNNER_MODULE = "../../../scripts/run-hourly-crons.mjs";

async function loadRunner(): Promise<HourlyCronModule> {
  return (await import(RUNNER_MODULE)) as HourlyCronModule;
}

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  if (!headers.has("content-type")) {
    headers.set("content-type", "application/json; charset=utf-8");
  }

  return new Response(JSON.stringify(body), {
    status: 200,
    ...init,
    headers
  });
}

describe("hourly cron runner", () => {
  it("rejects every noncanonical APP_URL and never exposes the secret", async () => {
    const { runHourlyCronCli } = await loadRunner();
    const error = vi.fn();
    const secret = "do-not-log-this-secret";

    await expect(
      runHourlyCronCli(
        { APP_URL: "https://www.prediabetespal.com", CRON_SECRET: secret },
        { error }
      )
    ).resolves.toBe(1);

    expect(error).toHaveBeenCalledWith(
      "[cron-runner] result=invalid_app_url"
    );
    expect(JSON.stringify(error.mock.calls)).not.toContain(secret);
  });

  it("requires a nonempty bearer secret", async () => {
    const { CANONICAL_APP_URL, validateCronConfig } = await loadRunner();

    expect(() => validateCronConfig({ APP_URL: CANONICAL_APP_URL })).toThrow(
      "missing_cron_secret"
    );
  });

  it("calls all four canonical routes without following redirects", async () => {
    const { CANONICAL_APP_URL, CRON_PATHS, runHourlyCrons } =
      await loadRunner();
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockImplementation(async () => jsonResponse({ ok: true }));

    const result = await runHourlyCrons(
      { appUrl: CANONICAL_APP_URL, secret: "test-secret" },
      { fetch: fetchMock, info: vi.fn(), error: vi.fn(), now: () => 10 }
    );

    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(CRON_PATHS.length);
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(
      CRON_PATHS.map((path) => `${CANONICAL_APP_URL}${path}`)
    );
    for (const [, init] of fetchMock.mock.calls) {
      expect(init).toMatchObject({
        method: "GET",
        redirect: "manual",
        cache: "no-store",
        headers: {
          accept: "application/json",
          authorization: "Bearer test-secret"
        }
      });
      expect(init?.signal).toBeInstanceOf(AbortSignal);
    }
  });

  it("attempts later routes and exits nonzero when any route redirects", async () => {
    const { CANONICAL_APP_URL, CRON_PATHS, runHourlyCronCli } =
      await loadRunner();
    const error = vi.fn();
    const info = vi.fn();
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(null, {
          status: 301,
          headers: { location: CANONICAL_APP_URL }
        })
      )
      .mockImplementation(async () => jsonResponse({ ok: true }));

    await expect(
      runHourlyCronCli(
        { APP_URL: CANONICAL_APP_URL, CRON_SECRET: "test-secret" },
        { fetch: fetchMock, info, error, now: () => 10 }
      )
    ).resolves.toBe(1);

    expect(fetchMock).toHaveBeenCalledTimes(CRON_PATHS.length);
    expect(error.mock.calls.flat().join(" ")).toContain("redirect_rejected");
    expect(error.mock.calls.flat().join(" ")).toContain("failed=1");
  });

  it.each([
    ["http_error", new Response("down", { status: 503 })],
    [
      "invalid_content_type",
      new Response('{"ok":true}', {
        status: 200,
        headers: { "content-type": "text/html" }
      })
    ],
    [
      "invalid_json",
      new Response("not-json", {
        status: 200,
        headers: { "content-type": "application/json" }
      })
    ],
    ["negative_ack", jsonResponse({ ok: false })]
  ])("fails closed for %s responses", async (expectedCode, firstResponse) => {
    const { CANONICAL_APP_URL, runHourlyCrons } = await loadRunner();
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(firstResponse)
      .mockImplementation(async () => jsonResponse({ ok: true }));

    const result = await runHourlyCrons(
      { appUrl: CANONICAL_APP_URL, secret: "test-secret" },
      { fetch: fetchMock, info: vi.fn(), error: vi.fn(), now: () => 10 }
    );

    expect(result.ok).toBe(false);
    expect(result.results[0]).toMatchObject({
      ok: false,
      code: expectedCode
    });
  });

  it("fails closed when a successful response exceeds the body limit", async () => {
    const { CANONICAL_APP_URL, runHourlyCrons } = await loadRunner();
    const oversized = new Response("x", {
      status: 200,
      headers: {
        "content-type": "application/json",
        "content-length": "65537"
      }
    });
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(oversized)
      .mockImplementation(async () => jsonResponse({ ok: true }));

    const result = await runHourlyCrons(
      { appUrl: CANONICAL_APP_URL, secret: "test-secret" },
      { fetch: fetchMock, info: vi.fn(), error: vi.fn(), now: () => 10 }
    );

    expect(result.results[0]).toMatchObject({
      ok: false,
      code: "response_too_large"
    });
  });

  it("keeps credentials and response bodies out of failure logs", async () => {
    const { CANONICAL_APP_URL, runHourlyCrons } = await loadRunner();
    const secret = "super-secret-value";
    const responseBody = "private-provider-detail";
    const error = vi.fn();
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(responseBody, { status: 500 }))
      .mockImplementation(async () => jsonResponse({ ok: true }));

    await runHourlyCrons(
      { appUrl: CANONICAL_APP_URL, secret },
      { fetch: fetchMock, info: vi.fn(), error, now: () => 10 }
    );

    const logs = JSON.stringify(error.mock.calls);
    expect(logs).not.toContain(secret);
    expect(logs).not.toContain(responseBody);
  });
});
