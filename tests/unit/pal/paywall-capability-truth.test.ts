import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  capabilitiesFor,
  PREMIUM_CAPABILITY_KEYS,
  type Capabilities
} from "../../../lib/server/capabilities";
import type { Entitlement } from "../../../lib/server/entitlement";

const ROOT = process.cwd();
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), "utf8");

/**
 * Paywall truth (plan §P2.4 "Remove paywall promises that do not exist").
 *
 * The claims audit catches copy that says a forbidden thing; it cannot catch a
 * paywall bullet that promises a real-sounding capability the product does not
 * actually gate behind Premium. "Weekly insights from your own meals" was
 * exactly that — the thin insight is FREE onboarding value, and the genuinely
 * Premium weekly artifact ships flagged-off in T18. So this pins the wall's
 * bullets to the ONE capability matrix: every bullet must name a capability the
 * matrix marks premium-true today, and nothing may promise a flag-gated feature
 * that has not shipped.
 */

const FREE: Entitlement = {
  tier: "free",
  source: null,
  status: "none",
  currentPeriodEnd: null
};
const PREMIUM: Entitlement = {
  tier: "premium",
  source: "stripe",
  status: "premium",
  currentPeriodEnd: new Date("2026-08-01T00:00:00.000Z")
};

// 2026-07-27: both flag pairs went live in production (server flags proven by
// the 401-vs-404 probe; NEXT_PUBLIC_* UI flags set the same day), so
// mealMemory and weeklyLearning became legitimately sellable. This is the
// binding matrix for the bullet audit; the flags-off dark path must still
// fail closed (first test below).
const SHIPPED_FLAGS = {
  MEAL_MEMORY_ENABLED: "1",
  LEARNING_JOURNEY_ENABLED: "1"
} as const;

// Each paywall bullet, mapped to the capability it sells. A bullet with no
// mapping here is an unaudited promise — the test fails until it is mapped and
// the capability is proven premium-true.
const BULLET_CAPABILITY: { match: RegExp; key: keyof Capabilities }[] = [
  { match: /unlimited daily checks/i, key: "dailyChecks" },
  { match: /full history/i, key: "historyDays" },
  { match: /progress view/i, key: "progress" },
  { match: /daily reminder/i, key: "nudges" },
  { match: /meal memory/i, key: "mealMemory" },
  // The 90-day journey and its weekly summary are one capability: both sit
  // behind LEARNING_JOURNEY_ENABLED + premium (app/api/journey/handlers.ts).
  { match: /90-day learning journey.*weekly recap/i, key: "weeklyLearning" }
];

function paywallBullets(): string[] {
  const src = read("components/paywall-card.tsx");
  const ul = src.match(
    /<ul className="page-copy expectation-list">([\s\S]*?)<\/ul>/
  );
  expect(ul, "paywall-card must render the expectation-list bullets").not.toBeNull();
  return [...ul![1].matchAll(/<li>([\s\S]*?)<\/li>/g)].map((m) =>
    m[1].replace(/\s+/g, " ").trim()
  );
}

describe("paywall bullets only promise premium-true capabilities", () => {
  it("flag-gated features are premium-true only under the shipped flags", () => {
    // Fail-closed guard: wherever the flags are absent the capabilities go
    // dark — and under the flags production actually runs, premium genuinely
    // gets both, which is what makes their bullets legitimate.
    const dark = capabilitiesFor(PREMIUM, {});
    expect(dark.weeklyLearning).toBe(false);
    expect(dark.mealMemory).toBe(false);
    const shipped = capabilitiesFor(PREMIUM, SHIPPED_FLAGS);
    expect(shipped.weeklyLearning).toBe(true);
    expect(shipped.mealMemory).toBe(true);
  });

  it("every rendered bullet maps to a capability free lacks and premium has", () => {
    const free = capabilitiesFor(FREE, SHIPPED_FLAGS);
    const premium = capabilitiesFor(PREMIUM, SHIPPED_FLAGS);
    const bullets = paywallBullets();
    expect(bullets.length).toBeGreaterThan(0);

    for (const bullet of bullets) {
      const mapping = BULLET_CAPABILITY.find((m) => m.match.test(bullet));
      expect(mapping, `unaudited paywall bullet: "${bullet}"`).toBeDefined();
      const key = mapping!.key;
      // A genuine upgrade: free does not have it, premium does, and it is in
      // the canonical premium set.
      expect(free[key], `${key} must differ for free`).not.toBe(premium[key]);
      expect(
        (PREMIUM_CAPABILITY_KEYS as readonly string[]).includes(key)
      ).toBe(true);
    }
  });

  it("no unshipped promise appears in the wall copy or its imports", () => {
    const src = read("components/paywall-card.tsx");
    // The removed bullet, and the flag that used to gate it.
    expect(src).not.toMatch(/weekly insights from your own meals/i);
    expect(src).not.toMatch(/longitudinal-insights-flag/);
    expect(src).not.toMatch(/longitudinalInsightsEnabled/);
  });

  it("premium-pitch surfaces no longer promise a premium weekly insight", () => {
    // The four surfaces T10 audited (welcome/page keeps its data-processing
    // consent line — personalized insight is a real free feature there, not a
    // paid promise, so it is deliberately excluded from this list).
    for (const rel of [
      "components/paywall-card.tsx",
      "components/trial-wall.tsx",
      "app/(app)/account/page.tsx",
      "app/(app)/subscribe/page.tsx"
    ]) {
      const src = read(rel);
      expect(src, `${rel} still promises weekly patterns`).not.toMatch(
        /weekly patterns|weekly insights/i
      );
    }
  });
});
