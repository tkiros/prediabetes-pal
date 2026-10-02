import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { planBoxAttention, TRIAL_FREE_BOX } from "../../../lib/server/plan-box";

/**
 * C7 eng-review D2: Home renders the plan box ONLY when it carries actionable
 * billing truth — a running trial or a scheduled non-renewal. Steady premium
 * and the free tier stay sidebar/account-only.
 */
describe("planBoxAttention", () => {
  it("shows for a running trial", () => {
    expect(
      planBoxAttention({ tier: "premium", status: "trialing", cancelAtPeriodEnd: false })
    ).toBe(true);
  });

  it("shows for a scheduled non-renewal", () => {
    expect(
      planBoxAttention({ tier: "premium", status: "active", cancelAtPeriodEnd: true })
    ).toBe(true);
  });

  it("hides for steady premium", () => {
    expect(
      planBoxAttention({ tier: "premium", status: "active", cancelAtPeriodEnd: false })
    ).toBe(false);
  });

  it("hides for the free tier, whatever the flags say", () => {
    expect(planBoxAttention({ tier: "free" })).toBe(false);
    expect(
      planBoxAttention({ tier: "free", status: "trialing", cancelAtPeriodEnd: true })
    ).toBe(false);
  });
});

describe("TRIAL_FREE_BOX", () => {
  // C-1 (2026-07-27): trial-mode free accounts get zero checks, so the box
  // shown in the app shell must never quote the legacy daily allowance.
  it("never claims a daily free-check allowance", () => {
    expect(TRIAL_FREE_BOX.meta).not.toMatch(
      /(?:five|5)\s*(?:free\s+)?checks?\s+(?:a|per|each)\s+day\b/i
    );
    expect(TRIAL_FREE_BOX.meta.length).toBeGreaterThan(0);
    expect(TRIAL_FREE_BOX.isFree).toBe(true);
    expect(TRIAL_FREE_BOX.attention).toBe(false);
  });
});

describe("no shipped string promises free checks beyond day 1", () => {
  // FIX4 (feature map 2026-09-24 §3.0): in trial mode checks stop after the
  // day-1 taster, so "the daily check is free" told every guest something false.
  const FREE_BEYOND_DAY_ONE = /\b(?:daily )?checks? (?:is|are|stays?) free\b/i;
  // Rendered only when PAYWALL_MODE=legacy, where five free checks a day are real.
  const LEGACY_ONLY = new Set(["app/(app)/subscribe/page.tsx"]);

  it("finds no free-check promise in app/, components/ or lib/", () => {
    const hits = ["app", "components", "lib"]
      .flatMap((dir) => readdirSync(dir, { recursive: true, encoding: "utf8" }).map((f) => join(dir, f)))
      .filter((f) => /\.tsx?$/.test(f) && !LEGACY_ONLY.has(f))
      .filter((f) => FREE_BEYOND_DAY_ONE.test(readFileSync(f, "utf8")));
    expect(hits).toEqual([]);
  });

  it("can see the phrase (guards the guard)", () => {
    expect(FREE_BEYOND_DAY_ONE.test("The daily check is free.")).toBe(true);
    expect(FREE_BEYOND_DAY_ONE.test(readFileSync("app/(app)/subscribe/page.tsx", "utf8"))).toBe(true);
  });
});
