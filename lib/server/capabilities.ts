import { FREE_DAILY_CHECKS, FREE_HISTORY_DAYS } from "../free-tier";
import { learningJourneyServerEnabled } from "../learning-journey-flag";
import { mealMemoryServerEnabled } from "../meal-memory-flag";
import type { Entitlement } from "./entitlement";

/**
 * The single capability matrix (plan §P2.4 "Define each capability once").
 *
 * One typed function turns an Entitlement into the exact set of things a caller
 * may do. Every enforcing surface derives from THIS — the check route's daily
 * cap, the history window, the nudge gate — and the /api/entitlement response
 * ships the same object so the UI renders paid state from server truth, never
 * from UI-only gating (global constraint §6).
 *
 * Numbers are the shared constants (FREE_DAILY_CHECKS, FREE_HISTORY_DAYS from
 * lib/free-tier). Nothing here retypes a literal — a matrix that disagreed with
 * the routes it is supposed to describe would be worse than no matrix.
 *
 * Disposition of the thin longitudinal insight (controller decision, ledger
 * 2026-07-18): `thinInsight` is FREE onboarding value for every signed-in user
 * (and guests locally). It is NOT a paid capability. The genuinely Premium
 * artifact is the weekly learning summary (`weeklyLearning`), which ships flagged
 * off in Task 18 — so the paywall may not promise it yet.
 */

export type Capabilities = {
  /** Result checks allowed per day; premium removes the cap. */
  dailyChecks: number | "unlimited";
  /** History VIEW window in days; premium sees the whole archive. */
  historyDays: number | "all";
  /** Data-rights export — every tier can get their data back. */
  export: true;
  /** Per-meal memory (T14). Premium-gated AND flag-gated until it ships. */
  mealMemory: boolean;
  /** Weekly learning artifact (T17-18). Premium-gated AND flag-gated. */
  weeklyLearning: boolean;
  /** The progress / BAI view. Premium (coach route enforces the same gate). */
  progress: boolean;
  /** One optional gentle daily reminder. Premium (nudge cron enforces it). */
  nudges: boolean;
  /** Thin daypart/repeat-meal insight — FREE for all signed-in users. */
  thinInsight: true;
  support: "standard";
};

/**
 * Flags for premium features that gate on a server-side rollout env. The flag
 * MODULES own the env-name truth (T14: lib/meal-memory-flag.ts reads
 * `MEAL_MEMORY_ENABLED`; T17: lib/learning-journey-flag.ts reads
 * `LEARNING_JOURNEY_ENABLED`). The matrix imports BOTH readers so each env name
 * is defined once and can never fork from the routes that 404 on the same flag.
 * The capability is therefore BOTH premium-gated AND unavailable until the
 * feature ships — a premium user with the flag off still sees `false`.
 */
export type CapabilityFlagEnv = {
  MEAL_MEMORY_ENABLED?: string;
  LEARNING_JOURNEY_ENABLED?: string;
};

/**
 * The capabilities that actually differ between free and premium under the
 * SHIPPED flags — i.e. the only things the paywall may truthfully sell.
 * mealMemory and weeklyLearning joined 2026-07-27: both server flags are on in
 * production (401-vs-404 probe) and both NEXT_PUBLIC_* UI flags are set, so
 * premium genuinely receives them. The paywall bullet pin test
 * (tests/unit/pal/paywall-capability-truth.test.ts) keys off this list.
 */
export const PREMIUM_CAPABILITY_KEYS = [
  "dailyChecks",
  "historyDays",
  "progress",
  "nudges",
  "mealMemory",
  "weeklyLearning"
] as const satisfies readonly (keyof Capabilities)[];

export function capabilitiesFor(
  entitlement: Entitlement,
  env: CapabilityFlagEnv = process.env as unknown as CapabilityFlagEnv
): Capabilities {
  const premium = entitlement.tier === "premium";
  return {
    dailyChecks: premium ? "unlimited" : FREE_DAILY_CHECKS,
    historyDays: premium ? "all" : FREE_HISTORY_DAYS,
    export: true,
    mealMemory: premium && mealMemoryServerEnabled(env),
    weeklyLearning: premium && learningJourneyServerEnabled(env),
    progress: premium,
    nudges: premium,
    thinInsight: true,
    support: "standard"
  };
}
