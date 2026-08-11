import { describe, expect, it } from "vitest";
import {
  checkEmailCooldown,
  createRateLimitDeps,
  evaluateAbuseLimit,
  evaluateRateLimit,
  getClientIp,
  isRateLimitConfigured,
  matchRouteLimit,
  rateLimitConfigState,
  type RateLimitDeps
} from "../../../lib/pal/rate-limit";

function deps(over: Partial<RateLimitDeps> = {}): RateLimitDeps {
  return {
    limitBucket: async () => ({ success: true, resetMs: Date.now() + 1_000 }),
    incrDailyCount: async () => 1,
    dailyCap: 2_000,
    ...over
  };
}

describe("evaluateRateLimit", () => {
  it("allows a normal request", async () => {
    expect(await evaluateRateLimit("1.1.1.1", deps())).toEqual({ ok: true });
  });

  it("blocks per-IP and does NOT touch the daily counter", async () => {
    let dailyCalls = 0;
    const decision = await evaluateRateLimit(
      "1.1.1.1",
      deps({
        limitBucket: async () => ({ success: false, resetMs: Date.now() + 30_000 }),
        incrDailyCount: async () => {
          dailyCalls += 1;
          return 1;
        }
      })
    );
    expect(decision.ok).toBe(false);
    if (!decision.ok) expect(decision.reason).toBe("per_ip");
    expect(dailyCalls).toBe(0); // IP-blocked requests must not bump the global cap
  });

  it("blocks when the daily cap is exceeded", async () => {
    const decision = await evaluateRateLimit(
      "1.1.1.1",
      deps({ incrDailyCount: async () => 2_001, dailyCap: 2_000 })
    );
    expect(decision.ok).toBe(false);
    if (!decision.ok) expect(decision.reason).toBe("daily_cap");
  });

  it("fails OPEN on a transient store error", async () => {
    const decision = await evaluateRateLimit(
      "1.1.1.1",
      deps({
        limitBucket: async () => {
          throw new Error("redis down");
        }
      })
    );
    expect(decision).toEqual({ ok: true });
  });

  it("fails OPEN without incrementing the daily counter when Upstash reports a timeout", async () => {
    let dailyCalls = 0;
    const decision = await evaluateRateLimit(
      "1.1.1.1",
      deps({
        limitBucket: async () => ({
          success: true,
          resetMs: Date.now() + 60_000,
          reason: "timeout" as const
        }),
        incrDailyCount: async () => {
          dailyCalls += 1;
          return 1;
        }
      })
    );

    expect(decision).toEqual({ ok: true });
    expect(dailyCalls).toBe(0);
  });

  it("spends the check_ip bucket, never another surface's", async () => {
    const seen: string[] = [];
    await evaluateRateLimit(
      "1.1.1.1",
      deps({
        limitBucket: async (bucket) => {
          seen.push(bucket);
          return { success: true, resetMs: 0 };
        }
      })
    );
    expect(seen).toEqual(["check_ip"]);
  });

  it("extracts the first x-forwarded-for IP", () => {
    const h = new Headers({ "x-forwarded-for": "9.9.9.9, 10.0.0.1" });
    expect(getClientIp(h)).toBe("9.9.9.9");
  });

  it("falls back to 'unknown' with no IP header", () => {
    expect(getClientIp(new Headers())).toBe("unknown");
  });
});

/**
 * W-11 — the route table. Before this, the proxy guard was a hardcoded
 * `startsWith("/api/check") && POST`, so the two most abusable doors in the app
 * (unauthenticated trial start; magic-link send) were completely unlimited.
 */
describe("matchRouteLimit (W-11)", () => {
  it("limits POST /api/check and /api/check/photo-draft on the check path", () => {
    expect(matchRouteLimit("/api/check", "POST")).toEqual({ kind: "check" });
    expect(matchRouteLimit("/api/check/photo-draft", "POST")).toEqual({
      kind: "check"
    });
  });

  it("limits POST /api/trial/start — unauthenticated, creates a user + sends email + opens Stripe", () => {
    expect(matchRouteLimit("/api/trial/start", "POST")).toEqual({
      kind: "abuse",
      bucket: "trial_ip",
      failClosed: true
    });
  });

  it("limits POST /api/auth/signin/* (magic-link flood + enumeration)", () => {
    expect(matchRouteLimit("/api/auth/signin/resend", "POST")).toEqual({
      kind: "abuse",
      bucket: "auth_signin_ip",
      failClosed: true
    });
  });

  it("limits other auth POSTs on the loose bucket (no email, no cost)", () => {
    expect(matchRouteLimit("/api/auth/signout", "POST")).toEqual({
      kind: "abuse",
      bucket: "auth_other_ip",
      failClosed: false
    });
  });

  it("NEVER limits GET — /api/auth/session and /api/auth/csrf are polled on every page load", () => {
    expect(matchRouteLimit("/api/auth/session", "GET")).toBeNull();
    expect(matchRouteLimit("/api/auth/csrf", "GET")).toBeNull();
    expect(matchRouteLimit("/api/check", "GET")).toBeNull();
  });

  it("ignores unrelated routes", () => {
    expect(matchRouteLimit("/api/history", "POST")).toBeNull();
    expect(matchRouteLimit("/", "POST")).toBeNull();
  });

  it("limits POST /api/support/case fail-CLOSED — every accepted case emails the inbox (P0.4)", () => {
    expect(matchRouteLimit("/api/support/case", "POST")).toEqual({
      kind: "abuse",
      bucket: "support_ip",
      failClosed: true
    });
    expect(matchRouteLimit("/api/support/case", "GET")).toBeNull();
  });

  // BC-7: billing doors get an abuse budget — pantry-checkout in particular
  // is unauthenticated and opens Stripe sessions.
  it("limits POST billing routes with the billing_ip bucket", () => {
    for (const path of [
      "/api/billing/stripe/pantry-checkout",
      "/api/billing/stripe/checkout",
      "/api/billing/stripe/sync",
      "/api/billing/cancel",
      "/api/billing/play/verify"
    ]) {
      expect(matchRouteLimit(path, "POST")).toEqual({
        kind: "abuse",
        bucket: "billing_ip",
        failClosed: false
      });
    }
  });

  it("NEVER limits the provider-authenticated webhook doors", () => {
    expect(matchRouteLimit("/api/billing/stripe/webhook", "POST")).toBeNull();
    expect(matchRouteLimit("/api/billing/play/rtdn", "POST")).toBeNull();
  });
});

describe("evaluateAbuseLimit (W-11)", () => {
  const blocked = deps({
    limitBucket: async () => ({ success: false, resetMs: Date.now() + 60_000 })
  });
  const broken = deps({
    limitBucket: async () => {
      throw new Error("redis down");
    }
  });

  it("429s (per_ip) once the bucket is spent", async () => {
    const decision = await evaluateAbuseLimit("trial_ip", "1.1.1.1", blocked, true);
    expect(decision.ok).toBe(false);
    if (!decision.ok) {
      expect(decision.reason).toBe("per_ip");
      expect(decision.retryAfterSeconds).toBeGreaterThan(0);
    }
  });

  it("fails CLOSED on a store error for the email-sending doors — a torched sender domain is not reversible", async () => {
    const decision = await evaluateAbuseLimit("trial_ip", "1.1.1.1", broken, true);
    expect(decision.ok).toBe(false);
    if (!decision.ok) expect(decision.reason).toBe("store_error");
  });

  it("fails CLOSED when Upstash reports its built-in timeout on an email-sending door", async () => {
    const timedOut = deps({
      limitBucket: async () => ({
        success: true,
        resetMs: Date.now() + 60_000,
        reason: "timeout" as const
      })
    });

    expect(
      await evaluateAbuseLimit("auth_signin_ip", "1.1.1.1", timedOut, true)
    ).toEqual({ ok: false, reason: "store_error", retryAfterSeconds: 60 });
  });

  it("fails OPEN on a store error where nothing irreversible is at stake", async () => {
    expect(
      await evaluateAbuseLimit("auth_other_ip", "1.1.1.1", broken, false)
    ).toEqual({ ok: true });
  });

  it("fails OPEN when Upstash reports its built-in timeout on a non-email abuse path", async () => {
    const timedOut = deps({
      limitBucket: async () => ({
        success: true,
        resetMs: Date.now() + 60_000,
        reason: "timeout" as const
      })
    });

    expect(
      await evaluateAbuseLimit("billing_ip", "1.1.1.1", timedOut, false)
    ).toEqual({ ok: true });
  });
});

describe("checkEmailCooldown (W-11)", () => {
  it("spends the per-email bucket, keyed by the normalised address", async () => {
    const seen: Array<[string, string]> = [];
    const decision = await checkEmailCooldown(
      "trial_email",
      "  Victim@Example.COM ",
      deps({
        limitBucket: async (bucket, key) => {
          seen.push([bucket, key]);
          return { success: true, resetMs: 0 };
        }
      })
    );
    expect(decision).toEqual({ ok: true });
    // Case/whitespace must not mint a fresh budget for the same mailbox.
    expect(seen).toEqual([["trial_email", "victim@example.com"]]);
  });

  it("blocks the address once its bucket is spent (the flood per-IP cannot see)", async () => {
    const decision = await checkEmailCooldown(
      "auth_email",
      "victim@example.com",
      deps({
        limitBucket: async () => ({ success: false, resetMs: Date.now() + 60_000 })
      })
    );
    expect(decision.ok).toBe(false);
  });

  it("skips entirely when Upstash is unconfigured (dev/test)", async () => {
    expect(await checkEmailCooldown("trial_email", "a@b.com", null)).toEqual({
      ok: true
    });
  });
});

describe("rateLimitConfigState (BUG-01/07 hardening)", () => {
  const REST_URL = "https://fake.upstash.io";
  const TCP_URL = "rediss://default:pass@fake.upstash.io:6379";
  const env = (vars: Record<string, string>) =>
    vars as unknown as NodeJS.ProcessEnv;

  it("is unconfigured when either var is absent", () => {
    expect(rateLimitConfigState(env({}))).toBe("unconfigured");
    expect(
      rateLimitConfigState(env({ UPSTASH_REDIS_REST_URL: REST_URL }))
    ).toBe("unconfigured");
  });

  it("is configured for the https:// REST URL", () => {
    const configured = env({
      UPSTASH_REDIS_REST_URL: REST_URL,
      UPSTASH_REDIS_REST_TOKEN: "tok"
    });
    expect(rateLimitConfigState(configured)).toBe("configured");
    expect(isRateLimitConfigured(configured)).toBe(true);
  });

  it("is invalid for the rediss:// TCP URL — the misconfig that 500'd prod", () => {
    const invalid = env({
      UPSTASH_REDIS_REST_URL: TCP_URL,
      UPSTASH_REDIS_REST_TOKEN: "tok"
    });
    expect(rateLimitConfigState(invalid)).toBe("invalid");
    expect(isRateLimitConfigured(invalid)).toBe(false);
  });

  it("createRateLimitDeps returns null (never throws) on an invalid URL", () => {
    expect(
      createRateLimitDeps(
        env({
          UPSTASH_REDIS_REST_URL: TCP_URL,
          UPSTASH_REDIS_REST_TOKEN: "tok"
        })
      )
    ).toBeNull();
  });
});

describe("proxy matcher covers every limited route (integration edge)", () => {
  // The middleware only runs for paths in proxy.ts's static config.matcher.
  // matchRouteLimit() can claim a path all it wants — if the matcher doesn't
  // list it, the limit is dead code. That is exactly how /api/support/case
  // shipped unlimited for one commit (C7 adversarial review, 2026-07-21):
  // the pure-function test passed while production never called it.
  const PROXY_SOURCE = require("node:fs").readFileSync(
    require("node:path").join(process.cwd(), "proxy.ts"),
    "utf8"
  ) as string;
  const matcherBlock = PROXY_SOURCE.match(/matcher:\s*\[([\s\S]*?)\]/)?.[1] ?? "";
  const matcherEntries = [...matcherBlock.matchAll(/"([^"]+)"/g)].map((m) => m[1]);

  function matcherCovers(path: string): boolean {
    return matcherEntries.some((entry) =>
      entry.endsWith("/:path*")
        ? path.startsWith(entry.slice(0, -"/:path*".length) + "/")
        : entry === path
    );
  }

  it.each([
    "/api/check",
    "/api/check/photo-draft",
    "/api/trial/start",
    "/api/auth/signin/resend",
    "/api/billing/checkout",
    "/api/support/case"
  ])("%s is reachable by the middleware", (path) => {
    expect(matchRouteLimit(path, "POST")).not.toBeNull();
    expect(matcherCovers(path), `${path} missing from proxy.ts config.matcher`).toBe(
      true
    );
  });
});
