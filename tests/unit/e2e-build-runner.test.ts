import { describe, expect, it } from "vitest";

import { includesTrialWall } from "../../scripts/e2e-spec-selection";
import { isolatedE2ERuntimeEnv } from "../../scripts/e2e-runtime-env";
import {
  buildModesForArgs,
  stripE2ETypeIncludes
} from "../../scripts/run-playwright";

describe("E2E production-build selection", () => {
  it("builds both modes for full, ambiguous, and trial-wall runs", () => {
    expect(includesTrialWall([])).toBe(true);
    expect(includesTrialWall(["tests/smoke/"])).toBe(true);
    expect(includesTrialWall(["tests/smoke/trial-wall.spec.ts"])).toBe(true);
    expect(buildModesForArgs([])).toEqual(["legacy", "trial"]);
  });

  it("builds only legacy for concrete unrelated specs", () => {
    const args = [
      "tests/smoke/a11y.spec.ts",
      "--project=Mobile Chrome",
      "--workers=1"
    ];
    expect(includesTrialWall(args)).toBe(false);
    expect(buildModesForArgs(args)).toEqual(["legacy"]);
  });

  it("surgically removes generated E2E type globs", () => {
    const source = `${JSON.stringify(
      {
        compilerOptions: { strict: true },
        include: [
          "**/*.ts",
          ".next-e2e-legacy/types/**/*.ts",
          "custom/**/*.ts",
          ".next-e2e-trial/types/**/*.ts"
        ]
      },
      null,
      2
    )}\n`;

    expect(stripE2ETypeIncludes(source)).toBe(
      `${JSON.stringify(
        {
          compilerOptions: { strict: true },
          include: ["**/*.ts", "custom/**/*.ts"]
        },
        null,
        2
      )}\n`
    );
  });

  it("does not rewrite a tsconfig with no generated E2E globs", () => {
    expect(
      stripE2ETypeIncludes(
        `${JSON.stringify({ include: ["**/*.ts", ".next/types/**/*.ts"] })}\n`
      )
    ).toBeNull();
  });

  it("replaces ambient provider credentials with isolated test values", () => {
    const env = isolatedE2ERuntimeEnv({
      DATABASE_URL: "postgres://e2e@127.0.0.1:55432/pal",
      OPENAI_API_KEY: "live-model-key",
      RESEND_API_KEY: "live-email-key",
      STRIPE_SECRET_KEY: "live-billing-key",
      UPSTASH_REDIS_REST_URL: "https://live-rate-limit.example",
      UPSTASH_REDIS_REST_TOKEN: "live-rate-limit-token",
      EDGE_CONFIG: "live-edge-config",
      PANTRY_BLOB_READ_WRITE_TOKEN: "live-blob-token",
      SENTRY_DSN: "https://live-sentry.example/1"
    });

    expect(env.DATABASE_URL).toBe(
      "postgres://e2e@127.0.0.1:55432/pal"
    );
    expect(env.VERCEL_ENV).toBe("development");
    for (const name of [
      "OPENAI_API_KEY",
      "RESEND_API_KEY",
      "STRIPE_SECRET_KEY",
      "UPSTASH_REDIS_REST_URL",
      "UPSTASH_REDIS_REST_TOKEN",
      "EDGE_CONFIG",
      "PANTRY_BLOB_READ_WRITE_TOKEN",
      "SENTRY_DSN"
    ]) {
      expect(env[name]).toBe("");
    }
  });

  it("passes through only the Pantry-live credentials on explicit opt-in", () => {
    const env = isolatedE2ERuntimeEnv({
      E2E_PANTRY_LIVE: "1",
      DATABASE_URL: "postgres://e2e@127.0.0.1:55432/pal",
      OPENAI_API_KEY: "live-model-key",
      PANTRY_BLOB_READ_WRITE_TOKEN: "live-blob-token",
      RESEND_API_KEY: "live-email-key",
      STRIPE_SECRET_KEY: "live-billing-key",
      UPSTASH_REDIS_REST_URL: "https://live-rate-limit.example",
      UPSTASH_REDIS_REST_TOKEN: "live-rate-limit-token"
    });

    expect(env.OPENAI_API_KEY).toBe("live-model-key");
    expect(env.PANTRY_BLOB_READ_WRITE_TOKEN).toBe("live-blob-token");
    for (const name of [
      "RESEND_API_KEY",
      "STRIPE_SECRET_KEY",
      "UPSTASH_REDIS_REST_URL",
      "UPSTASH_REDIS_REST_TOKEN"
    ]) {
      expect(env[name]).toBe("");
    }
  });

  it("keeps the Pantry-live credentials blank without the exact opt-in value", () => {
    const env = isolatedE2ERuntimeEnv({
      E2E_PANTRY_LIVE: "true",
      OPENAI_API_KEY: "live-model-key",
      PANTRY_BLOB_READ_WRITE_TOKEN: "live-blob-token"
    });
    expect(env.OPENAI_API_KEY).toBe("");
    expect(env.PANTRY_BLOB_READ_WRITE_TOKEN).toBe("");
  });

  it("blanks an ambient guide door flag unless the e2e opt-in names one (A-99)", () => {
    expect(
      isolatedE2ERuntimeEnv({ NEXT_PUBLIC_GUIDE_DOOR: "1" }).NEXT_PUBLIC_GUIDE_DOOR
    ).toBe("");
    expect(isolatedE2ERuntimeEnv({}).NEXT_PUBLIC_GUIDE_DOOR).toBe("");
    // CI's flag-off matrix leg sets the opt-in to an empty string.
    expect(
      isolatedE2ERuntimeEnv({
        NEXT_PUBLIC_GUIDE_DOOR: "calm",
        PAL_E2E_GUIDE_DOOR: ""
      }).NEXT_PUBLIC_GUIDE_DOOR
    ).toBe("");
  });

  it("passes PAL_E2E_GUIDE_DOOR through verbatim, over any ambient value", () => {
    expect(
      isolatedE2ERuntimeEnv({ PAL_E2E_GUIDE_DOOR: "1" }).NEXT_PUBLIC_GUIDE_DOOR
    ).toBe("1");
    const listed = isolatedE2ERuntimeEnv({
      NEXT_PUBLIC_GUIDE_DOOR: "1",
      PAL_E2E_GUIDE_DOOR: "ideas,source"
    });
    expect(listed.NEXT_PUBLIC_GUIDE_DOOR).toBe("ideas,source");
    // Smoke global setup reads the opt-in back from the Playwright process.
    expect(listed.PAL_E2E_GUIDE_DOOR).toBe("ideas,source");
  });

  it("refuses a remote database even when the caller provides it", () => {
    expect(() =>
      isolatedE2ERuntimeEnv({
        DATABASE_URL: "postgres://runtime@production.example/pal"
      })
    ).toThrow("disposable loopback database");
  });
});
