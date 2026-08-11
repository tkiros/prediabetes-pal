import OpenAI from "openai";
import { describe, expect, it, vi } from "vitest";

import {
  DEFAULT_PAL_MODEL,
  PAL_JSON_SCHEMA_NAME,
  PalConnectionError,
  PalModelConfigurationError,
  PalProviderResponseError,
  activeModelId,
  activeModelProvider,
  createOpenAIPalModelClient
} from "../../../lib/pal/openai-client";
import { palModelJsonSchema } from "../../../lib/pal/schemas";

describe("activeModelId", () => {
  // A declared-but-empty PAL_MODEL= was live in .env: `??` let the empty
  // string win, so every model call requested model "" and 400'd. Blank is unset.
  it.each([
    ["unset", undefined],
    ["empty", ""],
    ["whitespace", "   "]
  ])("falls back to the default when PAL_MODEL is %s", (_label, value) => {
    vi.stubEnv("PAL_MODEL", value as string);
    expect(activeModelId()).toBe(DEFAULT_PAL_MODEL);
    vi.unstubAllEnvs();
  });

  it("uses an explicitly set PAL_MODEL", () => {
    vi.stubEnv("PAL_MODEL", "gpt-5.4");
    expect(activeModelId()).toBe("gpt-5.4");
    vi.unstubAllEnvs();
  });

  // The pre-rename REVORA_MODEL fallback was deleted 2026-08-11 — PAL_MODEL
  // exists in Vercel production and preview, and the REVORA_* vars are gone.
  it("ignores the retired REVORA_MODEL name entirely", () => {
    vi.stubEnv("PAL_MODEL", "");
    vi.stubEnv("REVORA_MODEL", "openai/gpt-5.4-mini");
    expect(activeModelId()).toBe(DEFAULT_PAL_MODEL);
    vi.unstubAllEnvs();
  });
});

describe("createOpenAIPalModelClient", () => {
  it("sets store false on every Responses API call", async () => {
    const create = vi.fn().mockResolvedValue({
      output_text: JSON.stringify({
        kind: "result",
        risk: "SAFE",
        reason: "This looks balanced.",
        adjustment: null,
        swap: null,
        question: null,
        examples: [],
        policy_flags: ["safe_food"]
      })
    });

    const client = createOpenAIPalModelClient({
      client: {
        responses: { create }
      }
    });

    await client.generate({
      instructions: "instruction text",
      input: "Food: lentil soup\nA1C: 6.1"
    });

    expect(create).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: DEFAULT_PAL_MODEL,
        instructions: "instruction text",
        input: "Food: lentil soup\nA1C: 6.1",
        store: false,
        text: {
          format: {
            type: "json_schema",
            name: PAL_JSON_SCHEMA_NAME,
            schema: palModelJsonSchema,
            strict: true
          }
        }
      })
    );
  });

  const VALID_OUTPUT = {
    output_text: JSON.stringify({
      kind: "result",
      risk: "SAFE",
      reason: "This looks balanced.",
      adjustment: null,
      swap: null,
      question: null,
      examples: [],
      policy_flags: ["safe_food"]
    })
  };

  it("retries exactly once on a connection-level error (REL-01)", async () => {
    const create = vi
      .fn()
      .mockRejectedValueOnce(new OpenAI.APIConnectionError({ message: "boom" }))
      .mockResolvedValueOnce(VALID_OUTPUT);

    const client = createOpenAIPalModelClient({
      client: { responses: { create } }
    });

    const result = await client.generate({ instructions: "i", input: "f" });
    expect(result.kind).toBe("result");
    expect(create).toHaveBeenCalledTimes(2);
  });

  it("surfaces PalConnectionError when the retry also fails", async () => {
    const create = vi
      .fn()
      .mockRejectedValue(new OpenAI.APIConnectionError({ message: "down" }));

    const client = createOpenAIPalModelClient({
      client: { responses: { create } }
    });

    await expect(
      client.generate({ instructions: "i", input: "f" })
    ).rejects.toBeInstanceOf(PalConnectionError);
    expect(create).toHaveBeenCalledTimes(2);
  });

  it("never retries timeouts or provider HTTP errors (single paid attempt)", async () => {
    for (const error of [
      new OpenAI.APIConnectionTimeoutError({ message: "slow" }),
      Object.assign(new Error("http 500"), { status: 500 })
    ]) {
      const create = vi.fn().mockRejectedValue(error);
      const client = createOpenAIPalModelClient({
        client: { responses: { create } }
      });

      await expect(
        client.generate({ instructions: "i", input: "f" })
      ).rejects.toBe(error);
      expect(create).toHaveBeenCalledTimes(1);
    }
  });

  it("omits the reasoning parameter by default (behavior-neutral)", async () => {
    const create = vi.fn().mockResolvedValue({
      output_text: JSON.stringify({
        kind: "result",
        risk: "SAFE",
        reason: "This looks balanced.",
        adjustment: null,
        swap: null,
        question: null,
        examples: [],
        policy_flags: ["safe_food"]
      })
    });

    const client = createOpenAIPalModelClient({
      client: { responses: { create } }
    });

    await client.generate({ instructions: "x", input: "y" });

    // Default must NOT lower reasoning on the live safety classifier — the model
    // runs at its own default until an effort is explicitly set + eval-confirmed.
    expect(create.mock.calls[0][0]).not.toHaveProperty("reasoning");
  });

  it("passes through an explicit reasoning effort", async () => {
    const create = vi.fn().mockResolvedValue({
      output_text: JSON.stringify({
        kind: "result",
        risk: "SAFE",
        reason: "This looks balanced.",
        adjustment: null,
        swap: null,
        question: null,
        examples: [],
        policy_flags: ["safe_food"]
      })
    });

    const client = createOpenAIPalModelClient({
      reasoningEffort: "minimal",
      client: { responses: { create } }
    });

    await client.generate({ instructions: "x", input: "y" });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ reasoning: { effort: "minimal" } })
    );
  });

  it("omits the reasoning parameter when effort is 'off'", async () => {
    const create = vi.fn().mockResolvedValue({
      output_text: JSON.stringify({
        kind: "result",
        risk: "SAFE",
        reason: "This looks balanced.",
        adjustment: null,
        swap: null,
        question: null,
        examples: [],
        policy_flags: ["safe_food"]
      })
    });

    const client = createOpenAIPalModelClient({
      reasoningEffort: "off",
      client: { responses: { create } }
    });

    await client.generate({ instructions: "x", input: "y" });

    expect(create.mock.calls[0][0]).not.toHaveProperty("reasoning");
  });

  it("constructs the OpenAI client with a bounded timeout and no SDK retries", () => {
    const captured: Array<Record<string, unknown>> = [];
    const FakeOpenAI = function (this: unknown, opts: Record<string, unknown>) {
      captured.push(opts);
      return { responses: { create: async () => ({ output_text: "{}" }) } };
    } as unknown as typeof import("openai").default;

    createOpenAIPalModelClient({
      apiKey: "k",
      openAiCtor: FakeOpenAI,
      env: { NODE_ENV: "test" }
    });
    expect(captured[0]).toMatchObject({
      apiKey: "k",
      timeout: 10_000,
      maxRetries: 0
    });
    expect(captured[0]).not.toHaveProperty("baseURL");
  });

  // WS-2 (NEW-001): production base-URL policy is an OpenRouter-host
  // allowlist, replacing the blanket rejection. OpenRouter is the decided
  // production architecture; every OTHER compatible host stays
  // evaluation-only, and the HTTPS/no-credential guards are unchanged.
  it("allows OpenRouter routing in production", () => {
    const captured: Array<Record<string, unknown>> = [];
    const FakeOpenAI = function (this: unknown, opts: Record<string, unknown>) {
      captured.push(opts);
      return { responses: { create: async () => ({ output_text: "{}" }) } };
    } as unknown as typeof import("openai").default;

    createOpenAIPalModelClient({
      apiKey: "k",
      openAiCtor: FakeOpenAI,
      env: {
        NODE_ENV: "production",
        OPENAI_BASE_URL: "https://openrouter.ai/api/v1",
        PAL_MODEL: "openai/gpt-5.4-mini"
      }
    });

    expect(captured[0]).toMatchObject({
      baseURL: "https://openrouter.ai/api/v1"
    });
  });

  it("rejects non-OpenRouter compatible hosts in production", () => {
    expect(() =>
      createOpenAIPalModelClient({
        apiKey: "k",
        env: {
          NODE_ENV: "production",
          OPENAI_BASE_URL: "https://compatible.example/api/v1",
          PAL_MODEL: "provider/model"
        }
      })
    ).toThrow(PalModelConfigurationError);
  });

  it("applies the allowlist when VERCEL_ENV is production, whatever NODE_ENV says", () => {
    // Vercel production is classified by VERCEL_ENV, not NODE_ENV — this is
    // the exact combination the deployed platform presents.
    expect(() =>
      createOpenAIPalModelClient({
        apiKey: "k",
        env: {
          VERCEL_ENV: "production",
          NODE_ENV: "test",
          OPENAI_BASE_URL: "https://compatible.example/api/v1",
          PAL_MODEL: "provider/model"
        }
      })
    ).toThrow(PalModelConfigurationError);

    const FakeOpenAI = function (this: unknown) {
      return { responses: { create: async () => ({ output_text: "{}" }) } };
    } as unknown as typeof import("openai").default;
    expect(() =>
      createOpenAIPalModelClient({
        apiKey: "k",
        openAiCtor: FakeOpenAI,
        env: {
          VERCEL_ENV: "production",
          NODE_ENV: "test",
          OPENAI_BASE_URL: "https://openrouter.ai/api/v1",
          PAL_MODEL: "openai/gpt-5.4-mini"
        }
      })
    ).not.toThrow();
  });

  it("rejects provider-prefixed model ids on direct OpenAI", () => {
    expect(() =>
      createOpenAIPalModelClient({
        apiKey: "k",
        env: {
          NODE_ENV: "production",
          PAL_MODEL: "openai/gpt-5.4-mini"
        }
      })
    ).toThrow("must not include a provider prefix");
  });

  it("allows an explicit HTTPS compatible provider in test/preview only", () => {
    const captured: Array<Record<string, unknown>> = [];
    const FakeOpenAI = function (this: unknown, opts: Record<string, unknown>) {
      captured.push(opts);
      return { responses: { create: async () => ({ output_text: "{}" }) } };
    } as unknown as typeof import("openai").default;
    const env: NodeJS.ProcessEnv = {
      VERCEL_ENV: "preview",
      NODE_ENV: "production",
      OPENAI_BASE_URL: "https://openrouter.ai/api/v1",
      PAL_MODEL: "openai/gpt-5.4-mini"
    };

    createOpenAIPalModelClient({
      apiKey: "k",
      openAiCtor: FakeOpenAI,
      env
    });

    expect(captured[0]).toMatchObject({
      baseURL: "https://openrouter.ai/api/v1"
    });
    expect(activeModelProvider(env)).toBe("openrouter");
  });

  it("rejects insecure remote compatible-provider URLs", () => {
    expect(() =>
      createOpenAIPalModelClient({
        apiKey: "k",
        env: {
          NODE_ENV: "test",
          OPENAI_BASE_URL: "http://provider.example/api/v1",
          PAL_MODEL: "provider/model"
        }
      })
    ).toThrow("must use HTTPS");
  });

  it("rejects missing output_text instead of returning raw provider output", async () => {
    const client = createOpenAIPalModelClient({
      client: {
        responses: {
          create: vi.fn().mockResolvedValue({
            status: "failed",
            error_type: "authentication"
          })
        }
      }
    });

    await expect(
      client.generate({
        instructions: "instruction text",
        input: "Food: lentil soup\nA1C: 6.1"
      })
    ).rejects.toMatchObject({
      name: "PalProviderResponseError",
      code: "authentication"
    } satisfies Partial<PalProviderResponseError>);
  });
});
