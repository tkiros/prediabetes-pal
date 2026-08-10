/**
 * Unit tests for launch-control contracts, thresholds, and middleware gate (Plan 04-02)
 *
 * Coverage:
 *  - 04-01 artifact dependency gate
 *  - getLaunchControls() defaults (normal mode, checks enabled, empty incident message)
 *  - evaluateLaunchMode() pause path (public_checks_enabled false)
 *  - shouldPauseForOps() threshold helper (harmful-guidance, provider-failure, 2,000 checks/24h)
 *  - Missing / absent Edge Config values fail closed to safe defaults
 *  - /api/health reports launchMode from launch-control seam
 *  - Middleware pause gate: normal mode passthrough, paused mode 503 with friendly copy
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ----- Dependency gate (Test 1) -----
describe("04-01 artifact dependency gate", () => {
  it("stops if docs/privacy/data-flow.md is missing", async () => {
    const { existsSync } = await import("node:fs");
    expect(existsSync("docs/privacy/data-flow.md")).toBe(true);
  });

  it("stops if lib/pal/openai-client.ts is missing", async () => {
    const { existsSync } = await import("node:fs");
    expect(existsSync("lib/pal/openai-client.ts")).toBe(true);
  });

  it("stops if lib/pal/telemetry.ts is missing", async () => {
    const { existsSync } = await import("node:fs");
    expect(existsSync("lib/pal/telemetry.ts")).toBe(true);
  });

  it("stops if lib/pal/env.ts is missing", async () => {
    const { existsSync } = await import("node:fs");
    expect(existsSync("lib/pal/env.ts")).toBe(true);
  });

  it("stops if app/api/check/route.ts is missing", async () => {
    const { existsSync } = await import("node:fs");
    expect(existsSync("app/api/check/route.ts")).toBe(true);
  });

  it("stops if app/api/health/route.ts is missing", async () => {
    const { existsSync } = await import("node:fs");
    expect(existsSync("app/api/health/route.ts")).toBe(true);
  });

  it("stops if tests/unit/pal/privacy-minimal.test.ts is missing", async () => {
    const { existsSync } = await import("node:fs");
    expect(existsSync("tests/unit/pal/privacy-minimal.test.ts")).toBe(true);
  });

  it("stops if tests/unit/pal/openai-client.test.ts is missing", async () => {
    const { existsSync } = await import("node:fs");
    expect(existsSync("tests/unit/pal/openai-client.test.ts")).toBe(true);
  });

  it("stops if tests/unit/pal/telemetry.test.ts is missing", async () => {
    const { existsSync } = await import("node:fs");
    expect(existsSync("tests/unit/pal/telemetry.test.ts")).toBe(true);
  });

  it("stops if tests/unit/pal/env.test.ts is missing", async () => {
    const { existsSync } = await import("node:fs");
    expect(existsSync("tests/unit/pal/env.test.ts")).toBe(true);
  });
});

// ----- getLaunchControls() default mode (Test 2) -----
describe("getLaunchControls() default mode", () => {
  beforeEach(() => {
    // No EDGE_CONFIG, no override — defaults
    delete process.env.EDGE_CONFIG;
    delete process.env.PAL_LAUNCH_MODE_OVERRIDE;
    vi.resetModules();
  });

  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it("defaults to normal mode with public checks enabled when no configuration is present", async () => {
    const { getLaunchControls } =
      await import("../../../lib/pal/launch-controls");
    const controls = await getLaunchControls();

    expect(controls.launchMode).toBe("normal");
    expect(controls.publicChecksEnabled).toBe(true);
    expect(typeof controls.incidentMessage).toBe("string");
  });

  it("respects PAL_LAUNCH_MODE_OVERRIDE=paused in non-production environments", async () => {
    process.env.PAL_LAUNCH_MODE_OVERRIDE = "paused";

    const { getLaunchControls } =
      await import("../../../lib/pal/launch-controls");
    const controls = await getLaunchControls();

    expect(controls.launchMode).toBe("paused");
    expect(controls.publicChecksEnabled).toBe(false);
  });
});

// ----- evaluateLaunchMode() pause path (Test 3) -----
describe("evaluateLaunchMode() pause path", () => {
  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    delete process.env.PAL_LAUNCH_MODE_OVERRIDE;
  });

  it("returns a friendly 503 paused response when public_checks_enabled is false", async () => {
    process.env.PAL_LAUNCH_MODE_OVERRIDE = "paused";

    const { evaluateLaunchMode } =
      await import("../../../lib/pal/launch-controls");
    const result = await evaluateLaunchMode();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(503);
      expect(typeof result.message).toBe("string");
      expect(result.message.length).toBeGreaterThan(0);
      expect(result.controls.launchMode).toBe("paused");
      expect(result.controls.publicChecksEnabled).toBe(false);
    }
  });

  it("returns ok:true in normal mode", async () => {
    delete process.env.PAL_LAUNCH_MODE_OVERRIDE;

    const { evaluateLaunchMode } =
      await import("../../../lib/pal/launch-controls");
    const result = await evaluateLaunchMode();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.controls.launchMode).toBe("normal");
    }
  });

  it("never leaks raw errors or provider stack traces in the pause message", async () => {
    process.env.PAL_LAUNCH_MODE_OVERRIDE = "paused";

    const { evaluateLaunchMode } =
      await import("../../../lib/pal/launch-controls");
    const result = await evaluateLaunchMode();

    if (!result.ok) {
      expect(result.message).not.toMatch(
        /Error:|stack|at Object|node_modules/i,
      );
    }
  });
});

// ----- shouldPauseForOps() threshold helper (Test 4) -----
describe("Edge Config unreachable → fail closed (RE-02)", () => {
  afterEach(() => {
    vi.resetModules();
    vi.doUnmock("@vercel/edge-config");
    vi.restoreAllMocks();
    delete process.env.EDGE_CONFIG;
  });

  it("pauses checks when EDGE_CONFIG is set but the read throws and no last-good exists", async () => {
    process.env.EDGE_CONFIG = "https://edge-config.vercel.com/ecfg_x?token=t";
    vi.doMock("@vercel/edge-config", () => ({
      get: vi.fn().mockRejectedValue(new Error("network down")),
    }));

    const { evaluateLaunchMode } =
      await import("../../../lib/pal/launch-controls");
    const result = await evaluateLaunchMode();

    // The operator HAS a kill switch but it is unreadable: no emergency brake
    // may silently resolve to "checks enabled".
    expect(result.ok).toBe(false);
  });

  it("serves the last-good controls when a later read fails", async () => {
    process.env.EDGE_CONFIG = "https://edge-config.vercel.com/ecfg_x?token=t";
    const get = vi
      .fn()
      // First read succeeds with everything normal (3 keys)...
      .mockResolvedValueOnce("normal")
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce("")
      // ...then the store goes down.
      .mockRejectedValue(new Error("network down"));
    vi.doMock("@vercel/edge-config", () => ({ get }));

    const { evaluateLaunchMode } =
      await import("../../../lib/pal/launch-controls");

    const first = await evaluateLaunchMode();
    expect(first.ok).toBe(true);

    const second = await evaluateLaunchMode();
    // Last-good was "normal", so checks stay up through the blip.
    expect(second.ok).toBe(true);
  });
});

describe("shouldPauseForOps() threshold helper", () => {
  it("returns true for harmful-guidance incidents", async () => {
    const { shouldPauseForOps } =
      await import("../../../lib/pal/launch-controls");
    expect(
      shouldPauseForOps({
        checksLast24h: 100,
        harmfulGuidanceIncident: true,
        providerFailureSpike: false,
      }),
    ).toBe(true);
  });

  it("returns true for provider-failure spikes", async () => {
    const { shouldPauseForOps } =
      await import("../../../lib/pal/launch-controls");
    expect(
      shouldPauseForOps({
        checksLast24h: 100,
        harmfulGuidanceIncident: false,
        providerFailureSpike: true,
      }),
    ).toBe(true);
  });

  it("returns true when checksLast24h reaches 2,000", async () => {
    const { shouldPauseForOps } =
      await import("../../../lib/pal/launch-controls");
    expect(
      shouldPauseForOps({
        checksLast24h: 2000,
        harmfulGuidanceIncident: false,
        providerFailureSpike: false,
      }),
    ).toBe(true);
  });

  it("returns true when checksLast24h exceeds 2,000", async () => {
    const { shouldPauseForOps } =
      await import("../../../lib/pal/launch-controls");
    expect(
      shouldPauseForOps({
        checksLast24h: 2001,
        harmfulGuidanceIncident: false,
        providerFailureSpike: false,
      }),
    ).toBe(true);
  });

  it("returns false when under threshold and no incidents", async () => {
    const { shouldPauseForOps } =
      await import("../../../lib/pal/launch-controls");
    expect(
      shouldPauseForOps({
        checksLast24h: 1999,
        harmfulGuidanceIncident: false,
        providerFailureSpike: false,
      }),
    ).toBe(false);
  });
});

// ----- Missing Edge Config values fail closed (Test 5) -----
describe("missing Edge Config values fail closed to safe defaults", () => {
  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    delete process.env.EDGE_CONFIG;
    delete process.env.PAL_LAUNCH_MODE_OVERRIDE;
  });

  it("falls back to normal mode when EDGE_CONFIG is absent (no SDK invocation)", async () => {
    delete process.env.EDGE_CONFIG;
    delete process.env.PAL_LAUNCH_MODE_OVERRIDE;

    const { getLaunchControls } =
      await import("../../../lib/pal/launch-controls");
    const controls = await getLaunchControls();

    // Must not throw; defaults to safe (normal / enabled)
    expect(controls.launchMode).toBe("normal");
    expect(controls.publicChecksEnabled).toBe(true);
  });

  // RE-02: these two cases used to expect "normal" (checks enabled) when
  // EDGE_CONFIG was configured but unreadable — the factually inverted
  // "fail-closed". An operator WITH a kill switch whose store is down must
  // get a paused surface, never a silently-released brake.
  it("gracefully handles an unreadable Edge Config without throwing — and fails CLOSED", async () => {
    process.env.EDGE_CONFIG = "ecfg_fake_for_test";

    const { getLaunchControls } =
      await import("../../../lib/pal/launch-controls");
    // SDK fails on a fake connection string; module must not throw.
    const controls = await getLaunchControls();

    expect(controls.launchMode).toBe("paused");
    expect(controls.publicChecksEnabled).toBe(false);
    expect(typeof controls.incidentMessage).toBe("string");
  });

  it("handles a provider error from Edge Config without propagating raw stack traces", async () => {
    process.env.EDGE_CONFIG = "ecfg_another_fake";

    const { getLaunchControls } =
      await import("../../../lib/pal/launch-controls");

    // Must not throw — and must fail CLOSED (the brake holds).
    await expect(getLaunchControls()).resolves.toMatchObject({
      launchMode: "paused",
      publicChecksEnabled: false,
    });
  });
});

// ----- /api/health reports launch state (Task 1, Test 4) -----
describe("/api/health reports launchMode from launch-control seam", () => {
  const ORIGINAL_ENV = { ...process.env };

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.resetModules();
  });

  it("includes launchMode:normal in the success response", async () => {
    process.env = {
      ...ORIGINAL_ENV,
      NODE_ENV: "production",
      VERCEL_ENV: "preview",
      OPENAI_API_KEY: "sk-preview-test",
    };
    delete process.env.EDGE_CONFIG;
    delete process.env.PAL_LAUNCH_MODE_OVERRIDE;

    const { GET } = await import("../../../app/api/health/route");
    const response = await GET();
    const payload = await response.json();

    // The launch-control seam is normal, while readiness still correctly
    // fails because this hermetic test has no database or rate-limit store.
    expect(response.status).toBe(503);
    expect(payload.ok).toBe(false);
    expect(payload.launchMode).toBe("normal");
  });

  it("reports upstash:unconfigured when Upstash env is absent (merge-gate signal)", async () => {
    process.env = {
      ...ORIGINAL_ENV,
      NODE_ENV: "production",
      VERCEL_ENV: "preview",
      OPENAI_API_KEY: "sk-preview-test",
    };
    delete process.env.EDGE_CONFIG;
    delete process.env.PAL_LAUNCH_MODE_OVERRIDE;
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;

    const { GET } = await import("../../../app/api/health/route");
    const payload = await (await GET()).json();

    expect(payload.upstash).toBe("unconfigured");
  });

  it("reports upstash:configured when Upstash env is present", async () => {
    process.env = {
      ...ORIGINAL_ENV,
      NODE_ENV: "production",
      VERCEL_ENV: "preview",
      OPENAI_API_KEY: "sk-preview-test",
      UPSTASH_REDIS_REST_URL: "https://fake.upstash.io",
      UPSTASH_REDIS_REST_TOKEN: "fake-token",
    };
    delete process.env.EDGE_CONFIG;
    delete process.env.PAL_LAUNCH_MODE_OVERRIDE;

    const { GET } = await import("../../../app/api/health/route");
    const payload = await (await GET()).json();

    expect(payload.upstash).toBe("configured");
  });

  it("reports upstash:invalid when the URL is the rediss:// TCP form (BUG-01/07)", async () => {
    process.env = {
      ...ORIGINAL_ENV,
      NODE_ENV: "production",
      VERCEL_ENV: "preview",
      OPENAI_API_KEY: "sk-preview-test",
      UPSTASH_REDIS_REST_URL: "rediss://default:pass@fake.upstash.io:6379",
      UPSTASH_REDIS_REST_TOKEN: "fake-token",
    };
    delete process.env.EDGE_CONFIG;
    delete process.env.PAL_LAUNCH_MODE_OVERRIDE;

    const { GET } = await import("../../../app/api/health/route");
    const payload = await (await GET()).json();

    expect(payload.upstash).toBe("invalid");
  });

  it("includes launchMode:paused when the override is active", async () => {
    process.env = {
      ...ORIGINAL_ENV,
      NODE_ENV: "development",
      OPENAI_API_KEY: "sk-dev-test",
      PAL_LAUNCH_MODE_OVERRIDE: "paused",
    };
    delete process.env.EDGE_CONFIG;

    const { GET } = await import("../../../app/api/health/route");
    const response = await GET();
    const payload = await response.json();

    // Health still returns 200 (the probe is always accessible);
    // only the launch field reflects the paused state
    expect(payload.launchMode).toBe("paused");
    expect(payload.launch).toBe("paused");
  });

  it("never exposes secrets in the health response", async () => {
    process.env = {
      ...ORIGINAL_ENV,
      NODE_ENV: "production",
      VERCEL_ENV: "preview",
      OPENAI_API_KEY: "sk-secret-key-value",
      EDGE_CONFIG: "ecfg_secret_connection",
    };
    delete process.env.PAL_LAUNCH_MODE_OVERRIDE;

    const { GET } = await import("../../../app/api/health/route");
    const response = await GET();
    const body = JSON.stringify(await response.json());

    expect(body).not.toContain("sk-secret-key-value");
    expect(body).not.toContain("ecfg_secret_connection");
  });
});

// ----- Middleware pause gate (Task 1, Tests 1-3) -----
describe("middleware pause gate (evaluateLaunchMode integration)", () => {
  afterEach(() => {
    vi.resetModules();
    delete process.env.PAL_LAUNCH_MODE_OVERRIDE;
  });

  it("returns ok:true in normal mode so the public path can continue", async () => {
    delete process.env.PAL_LAUNCH_MODE_OVERRIDE;

    const { evaluateLaunchMode } =
      await import("../../../lib/pal/launch-controls");
    const result = await evaluateLaunchMode();

    expect(result.ok).toBe(true);
  });

  it("returns ok:false with 503 and friendly copy in paused mode (pre-model gate)", async () => {
    process.env.PAL_LAUNCH_MODE_OVERRIDE = "paused";

    const { evaluateLaunchMode } =
      await import("../../../lib/pal/launch-controls");
    const result = await evaluateLaunchMode();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(503);
      // Must never contain raw errors, stack traces, food text, or prompt text
      expect(result.message).not.toMatch(
        /Error:|TypeError|stack|node_modules|OpenAI|prompt/i,
      );
      expect(result.message.length).toBeGreaterThan(10);
    }
  });

  it("pause response never leaks raw food text or prompt text", async () => {
    process.env.PAL_LAUNCH_MODE_OVERRIDE = "paused";

    const { evaluateLaunchMode } =
      await import("../../../lib/pal/launch-controls");
    const result = await evaluateLaunchMode();

    if (!result.ok) {
      const safeFields = JSON.stringify(result);
      expect(safeFields).not.toMatch(/food:|a1c:|prompt|model output/i);
    }
  });
});
