import { dayKeyInTimezone } from "./days";

/**
 * Behavioral Adherence Index (plan P6). Adapted from Prediabetes Pal_PRD_Amendments.md
 * Amendment 1 — but that amendment's GL-budget/scan/A1C-prediction version is
 * SUPERSEDED and its literal band copy fails the claims-boundary audit
 * (it names a future A1C outcome and a banned verb — see
 * tests/unit/pal/claims-boundary-copy.test.ts). This is a from-scratch,
 * behavior-only composite: what someone DID this week, never what their next
 * lab result will be. No GI/GL/carb/glucose numbers anywhere in this module.
 * This file is itself scanned by the claims-boundary audit (see COPY_FILES),
 * so even code comments here must stay inside the boundary.
 *
 * Reuses lib/coach/days.ts (dayKeyInTimezone) for all day bucketing — never
 * re-derives day math. lib/pal/ stays untouched; this module only reads
 * the plaintext `risk` field the engine already returns.
 */

export type BaiCheckRow = {
  createdAt: Date;
  risk: "SAFE" | "MODERATE" | "HIGH";
  actionDoneAt?: Date | null;
};

export type BaiBand = "excellent" | "on_track" | "building" | "getting_started";

export type BaiResult = {
  score: number;
  adherence: number;
  consistency: number;
  action: number;
  band: BaiBand;
  // Persisted by the BAI cron (bai_weekly.prompted, lib/server/bai-cron.ts)
  // so the UI can say "no post-meal actions this week" instead of rendering
  // a misleading 0% bar when the action dimension had no data.
  promptedCount: number;
};

const WEEK_DAYS = 7;
const CONSISTENCY_TARGET_PER_DAY = 3;

const ADHERENCE_WEIGHT = 0.5;
const CONSISTENCY_WEIGHT = 0.3;
const ACTION_WEIGHT = 0.2;

// "Prompted" = a check whose engine response carried a post-meal action.
// lib/pal/coach-outputs.ts derives postMealAction for every non-SAFE
// result, and only result-kind checks are persisted to `checks` — so risk
// !== SAFE is exactly the prompted set, without a separate stored flag.
function wasPrompted(row: BaiCheckRow): boolean {
  return row.risk !== "SAFE";
}

function wasAcknowledged(row: BaiCheckRow): boolean {
  return row.actionDoneAt != null;
}

export function computeBai(weekChecks: BaiCheckRow[], tz: string): BaiResult {
  const dayKey = dayKeyInTimezone(tz);

  const daysChecked = new Set(weekChecks.map((row) => dayKey(row.createdAt)));
  const adherenceFrac = Math.min(1, daysChecked.size / WEEK_DAYS);

  const avgChecksPerDay = weekChecks.length / WEEK_DAYS;
  const consistencyFrac = Math.min(1, avgChecksPerDay / CONSISTENCY_TARGET_PER_DAY);

  const prompted = weekChecks.filter(wasPrompted);
  const acknowledged = prompted.filter(wasAcknowledged);
  const promptedCount = prompted.length;
  const actionFrac = promptedCount > 0 ? acknowledged.length / promptedCount : 0;

  let weightedSum: number;
  if (promptedCount > 0) {
    weightedSum =
      ADHERENCE_WEIGHT * adherenceFrac +
      CONSISTENCY_WEIGHT * consistencyFrac +
      ACTION_WEIGHT * actionFrac;
  } else {
    // Nobody was prompted this week — action carries no signal. Redistribute
    // its 20% proportionally so adherence/consistency renormalize to 100%.
    const remaining = ADHERENCE_WEIGHT + CONSISTENCY_WEIGHT;
    weightedSum =
      (ADHERENCE_WEIGHT / remaining) * adherenceFrac +
      (CONSISTENCY_WEIGHT / remaining) * consistencyFrac;
  }

  const score = Math.round(weightedSum * 100);

  return {
    score,
    adherence: Math.round(adherenceFrac * 100),
    consistency: Math.round(consistencyFrac * 100),
    action: promptedCount > 0 ? Math.round(actionFrac * 100) : 0,
    band: bandOf(score),
    promptedCount
  };
}

export function bandOf(score: number): BaiBand {
  if (score >= 80) {
    return "excellent";
  }
  if (score >= 60) {
    return "on_track";
  }
  if (score >= 40) {
    return "building";
  }
  return "getting_started";
}

export type BaiBandCopy = { label: string; message: string };

/**
 * Single source of truth for band copy — audited verbatim by
 * tests/unit/coach/bai.test.ts and tests/unit/pal/claims-boundary-copy.test.ts.
 *
 * Adapted from Amendment 1's bands, but rewritten to stay inside the locked
 * claims boundary: no predicted/future A1C, no banned-verb claim, no "on
 * track to reach X by day Y".
 *
 * F-14 (2026-07-11): the "excellent" band used to tell the user their
 * check-ins "match the consistency profile studied in the CDC DPP trial".
 * That trial studied an intensive, year-long, in-person lifestyle programme —
 * not app check-in consistency — and its headline result is a 58% reduction in
 * progression to type 2 diabetes. Naming it here, in the one place the user
 * reads about their OWN behavior and with none of the framing that surrounds
 * it on /how-it-works, built exactly the implied-efficacy bridge the landing
 * page explicitly refuses to build ("not a result from Prediabetes Pal's users, and not
 * a promise about your numbers"). The trial citation now lives ONLY on
 * /how-it-works and the landing proof band, where it is fully hedged and
 * attributed; this copy is now about the user's behavior and nothing else.
 * The rule is enforced by the "study-association" family in
 * claims-boundary-copy.test.ts.
 *
 * "Building"/"Getting started" keep the calm, permission-first tone of the
 * amendment's originals (their scanning-specific language became "check" —
 * this product has no scanning).
 */
export const BAI_BAND_COPY: Record<BaiBand, BaiBandCopy> = {
  excellent: {
    label: "Excellent",
    message:
      "You checked in consistently and followed through on the next steps you marked this week. Keep checking meals when the information is useful to you."
  },
  on_track: {
    label: "On track",
    message:
      "You're checking in most days and following through on next steps more than not. Check in before your next meal to keep the rhythm going."
  },
  building: {
    label: "Building",
    message:
      "You're establishing the habit. Consistency compounds — week three is typically harder than week six. Check your next meal when you're ready."
  },
  getting_started: {
    label: "Getting started",
    message:
      "Every check-in is a data point. You don't need a perfect week — you need a next meal. Check it when you're ready."
  }
};
