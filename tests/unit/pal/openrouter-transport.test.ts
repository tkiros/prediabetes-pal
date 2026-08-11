/**
 * WS-2 (NEW-001) — the OpenRouter production transport policy, end to end.
 *
 * Production used to blanket-reject any OPENAI_BASE_URL, and the two vision
 * call sites built `new OpenAI({apiKey})` with no baseURL at all — so the
 * decided OpenRouter architecture could not deploy, and setting the env var
 * would have silently split traffic (text rejected, vision still direct).
 * The policy now lives in one module (lib/model-transport.ts) consumed by all
 * three transports.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  assertModelIdMatchesTransport,
  resolveTransportBaseUrl,
  PalModelConfigurationError
} from "../../../lib/model-transport";

const OPENROUTER = "https://openrouter.ai/api/v1";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("resolveTransportBaseUrl — production policy", () => {
  const prod = { VERCEL_ENV: "production", NODE_ENV: "test" } as NodeJS.ProcessEnv;

  it("allows the OpenRouter host in production", () => {
    expect(
      resolveTransportBaseUrl({ ...prod, OPENAI_BASE_URL: OPENROUTER })
    ).toBe(OPENROUTER);
  });

  it("rejects a non-allowlisted host in production", () => {
    expect(() =>
      resolveTransportBaseUrl({
        ...prod,
        OPENAI_BASE_URL: "https://compatible.example/api/v1"
      })
    ).toThrow(PalModelConfigurationError);
  });

  it("rejects a look-alike host in production (suffix spoof)", () => {
    expect(() =>
      resolveTransportBaseUrl({
        ...prod,
        OPENAI_BASE_URL: "https://openrouter.ai.evil.example/api/v1"
      })
    ).toThrow(PalModelConfigurationError);
  });

  it("rejects credentials in the URL, every environment", () => {
    for (const env of [prod, { NODE_ENV: "test" } as NodeJS.ProcessEnv]) {
      expect(() =>
        resolveTransportBaseUrl({
          ...env,
          OPENAI_BASE_URL: "https://user:pass@openrouter.ai/api/v1"
        })
      ).toThrow("must not contain credentials");
    }
  });

  it("rejects insecure remote URLs, every environment", () => {
    expect(() =>
      resolveTransportBaseUrl({
        NODE_ENV: "test",
        OPENAI_BASE_URL: "http://openrouter.ai/api/v1"
      } as NodeJS.ProcessEnv)
    ).toThrow("must use HTTPS");
  });

  it("returns undefined (direct OpenAI) when unset or blank — the escape hatch", () => {
    expect(resolveTransportBaseUrl(prod)).toBeUndefined();
    expect(
      resolveTransportBaseUrl({ ...prod, OPENAI_BASE_URL: "  " })
    ).toBeUndefined();
  });

  it("still allows any compatible HTTPS host outside production", () => {
    expect(
      resolveTransportBaseUrl({
        VERCEL_ENV: "preview",
        NODE_ENV: "test",
        OPENAI_BASE_URL: "https://compatible.example/api/v1"
      } as NodeJS.ProcessEnv)
    ).toBe("https://compatible.example/api/v1");
  });
});

describe("assertModelIdMatchesTransport", () => {
  it("requires a provider prefix on OpenRouter", () => {
    expect(() =>
      assertModelIdMatchesTransport("gpt-5.4-mini", OPENROUTER)
    ).toThrow("must include their provider prefix");
    expect(() =>
      assertModelIdMatchesTransport("openai/gpt-5.4-mini", OPENROUTER)
    ).not.toThrow();
  });

  it("rejects a provider prefix on direct OpenAI", () => {
    expect(() =>
      assertModelIdMatchesTransport("openai/gpt-5.4-mini", undefined)
    ).toThrow("must not include a provider prefix");
    expect(() =>
      assertModelIdMatchesTransport("gpt-5.4-mini", undefined)
    ).not.toThrow();
  });
});

// Constructor spy for the vision transports: they build the OpenAI SDK
// directly, so the mock captures the exact options each transport passes.
const { captured } = vi.hoisted(() => ({
  captured: [] as Array<Record<string, unknown>>
}));
vi.mock("openai", () => {
  class FakeOpenAI {
    responses = {
      create: async () => ({
        output_text: JSON.stringify({ dish: "rice bowl", items: [] })
      })
    };
    constructor(opts: Record<string, unknown>) {
      captured.push(opts);
    }
  }
  return { default: FakeOpenAI };
});

describe("vision transports follow the configured base URL", () => {
  it("meal photo drafts route through OpenRouter when configured", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("OPENAI_BASE_URL", OPENROUTER);
    vi.stubEnv("OPENAI_API_KEY", "k");
    vi.stubEnv("PAL_VISION_MODEL", "openai/gpt-5.4-mini");
    vi.stubEnv("MEAL_EXTRACT_STUB", "");

    const { createMealVisionClient } = await import(
      "../../../lib/meal/photo-extract"
    );
    const draft = await createMealVisionClient().draftFromPhoto(
      "data:image/jpeg;base64,AAAA"
    );
    expect(draft.dish).toBe("rice bowl");
    expect(captured.at(-1)).toMatchObject({ baseURL: OPENROUTER });
  });

  it("meal photo drafts stay on direct OpenAI (no baseURL) when unset", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("OPENAI_BASE_URL", "");
    vi.stubEnv("OPENAI_API_KEY", "k");
    vi.stubEnv("PAL_VISION_MODEL", "gpt-5.4-mini");
    vi.stubEnv("MEAL_EXTRACT_STUB", "");

    const { createMealVisionClient } = await import(
      "../../../lib/meal/photo-extract"
    );
    await createMealVisionClient().draftFromPhoto("data:image/jpeg;base64,AAAA");
    expect(captured.at(-1)).not.toHaveProperty("baseURL");
  });

  it("pantry extraction routes through OpenRouter when configured", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("OPENAI_BASE_URL", OPENROUTER);
    vi.stubEnv("OPENAI_API_KEY", "k");
    vi.stubEnv("PAL_VISION_MODEL", "openai/gpt-5.4-mini");
    vi.stubEnv("PANTRY_EXTRACT_STUB", "");

    const { createPantryVisionClient } = await import(
      "../../../lib/pantry/extract"
    );
    const items = await createPantryVisionClient({
      loadPhoto: async () => "data:image/jpeg;base64,AAAA"
    }).extractFromPhoto("photo-url");
    expect(items).toEqual([]);
    expect(captured.at(-1)).toMatchObject({ baseURL: OPENROUTER });
  });

  it("meal photo drafts fail loudly on a prefix/transport mismatch — no paid call", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("OPENAI_BASE_URL", OPENROUTER);
    vi.stubEnv("OPENAI_API_KEY", "k");
    vi.stubEnv("PAL_VISION_MODEL", "gpt-5.4-mini"); // missing prefix
    vi.stubEnv("MEAL_EXTRACT_STUB", "");

    const { createMealVisionClient } = await import(
      "../../../lib/meal/photo-extract"
    );
    await expect(
      createMealVisionClient().draftFromPhoto("data:image/jpeg;base64,AAAA")
    ).rejects.toThrow("provider prefix");
  });

  it("pantry extraction fails loudly on a prefix/transport mismatch — no paid call", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("OPENAI_BASE_URL", OPENROUTER);
    vi.stubEnv("OPENAI_API_KEY", "k");
    vi.stubEnv("PAL_VISION_MODEL", "gpt-5.4-mini"); // missing prefix
    vi.stubEnv("PANTRY_EXTRACT_STUB", "");

    const { createPantryVisionClient } = await import(
      "../../../lib/pantry/extract"
    );
    await expect(
      createPantryVisionClient().extractFromPhoto("photo-url")
    ).rejects.toThrow("provider prefix");
  });
});
