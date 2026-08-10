import { afterEach, describe, expect, it } from "vitest";

import { GET } from "../../../app/api/health/route";
import { getPalEnv } from "../../../lib/pal/env";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("getPalEnv", () => {
  it("distinguishes Preview, Production, Development, and Test", () => {
    expect(
      getPalEnv({
        NODE_ENV: "production",
        VERCEL_ENV: "preview",
        OPENAI_API_KEY: "sk-preview",
      }),
    ).toMatchObject({ environment: "preview", openAiApiKey: "sk-preview" });

    expect(
      getPalEnv({
        NODE_ENV: "production",
        VERCEL_ENV: "production",
        OPENAI_API_KEY: "sk-production",
      }),
    ).toMatchObject({
      environment: "production",
      openAiApiKey: "sk-production",
    });

    expect(
      getPalEnv({
        NODE_ENV: "development",
        OPENAI_API_KEY: "sk-development",
      }),
    ).toMatchObject({
      environment: "development",
      openAiApiKey: "sk-development",
    });

    expect(
      getPalEnv({
        NODE_ENV: "test",
        OPENAI_API_KEY: "sk-test",
      }),
    ).toMatchObject({ environment: "test", openAiApiKey: "sk-test" });
  });

  it("requires OPENAI_API_KEY and keeps EDGE_CONFIG optional", () => {
    expect(() =>
      getPalEnv({
        NODE_ENV: "production",
        VERCEL_ENV: "production",
      }),
    ).toThrow("OPENAI_API_KEY");

    expect(
      getPalEnv({
        NODE_ENV: "production",
        VERCEL_ENV: "preview",
        OPENAI_API_KEY: "sk-preview",
        EDGE_CONFIG: "ecfg_connection_string",
      }),
    ).toEqual({
      environment: "preview",
      openAiApiKey: "sk-preview",
      edgeConfigConnectionString: "ecfg_connection_string",
    });
  });

  it("allows the OpenRouter route but rejects other compatible hosts in production health config", () => {
    // WS-2 (NEW-001): OpenRouter is the decided production architecture.
    expect(() =>
      getPalEnv({
        NODE_ENV: "production",
        VERCEL_ENV: "production",
        OPENAI_API_KEY: "sk-production",
        OPENAI_BASE_URL: "https://openrouter.ai/api/v1",
        PAL_MODEL: "openai/gpt-5.4-mini",
      }),
    ).not.toThrow();

    expect(() =>
      getPalEnv({
        NODE_ENV: "production",
        VERCEL_ENV: "production",
        OPENAI_API_KEY: "sk-production",
        OPENAI_BASE_URL: "https://compatible.example/api/v1",
        PAL_MODEL: "provider/model",
      }),
    ).toThrow("evaluation-only");
  });
});

describe("GET /api/health", () => {
  it("returns minimal launch metadata without exposing secrets", async () => {
    // No EDGE_CONFIG here: RE-02 makes a configured-but-unreadable store fail
    // CLOSED (paused), and a fake connection string is exactly that. This
    // test is about metadata shape, so leave the kill switch unconfigured.
    process.env = {
      ...ORIGINAL_ENV,
      NODE_ENV: "production",
      VERCEL_ENV: "preview",
      OPENAI_API_KEY: "sk-preview",
    };
    delete process.env.EDGE_CONFIG;
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    // Hermetic against a local shell exporting the kill switch.
    delete process.env.LEGAL_TERMS_FINAL;

    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload).toEqual({
      ok: false,
      status: "degraded",
      issues: [
        "database_unconfigured",
        "rate_limit_unavailable",
        "email_delivery_unavailable",
        "billing_webhook_unconfigured",
      ],
      environment: "preview",
      launch: "ready",
      launchMode: "normal",
      upstash: "unconfigured",
      emailDelivery: "unconfigured",
      billingWebhook: "unconfigured",
      // G8: boolean-only W-04 gate state; open unless LEGAL_TERMS_FINAL="0"
      // (owner WTP decision 2026-07-17, commit 8c30265 — kill switch inverted)
      checkoutGate: "open",
      db: "unconfigured",
      crons: {
        nudge: "unknown",
        baiWeekly: "unknown",
        trialPrecharge: "unknown",
        pantrySweep: "unknown",
        stripeReconcile: "unknown",
      },
    });
    expect(JSON.stringify(payload)).not.toContain("sk-preview");
    expect(JSON.stringify(payload)).not.toContain("ecfg_connection_string");
  });

  it("returns missing_config when required env is absent", async () => {
    process.env = {
      ...ORIGINAL_ENV,
      NODE_ENV: "development",
      VERCEL_ENV: "development",
    };
    delete process.env.OPENAI_API_KEY;
    delete process.env.EDGE_CONFIG;
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;

    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload).toEqual({
      ok: false,
      status: "degraded",
      issues: ["model_configuration"],
      environment: "development",
      launch: "missing_config",
      launchMode: "normal",
      upstash: "unconfigured",
      emailDelivery: "unconfigured",
      billingWebhook: "unconfigured",
      db: "unconfigured",
      crons: {
        nudge: "unknown",
        baiWeekly: "unknown",
        trialPrecharge: "unknown",
        pantrySweep: "unknown",
        stripeReconcile: "unknown",
      },
    });
  });
});
