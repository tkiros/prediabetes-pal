import { assertNoForbiddenClaims } from "../pal/postprocess";
import type { SafetyContract } from "../pal/safety-contract";
import type { JourneyState, Stage } from "./state";

/**
 * Personal journey nudges — the pure, db-free trigger + copy layer (plan §P4.3,
 * §10.1, §11; global constraint §9).
 *
 * Like the rest of lib/journey/, this module is DELIBERATELY IO-free: it owns
 * the two decisions that must be testable in isolation and can never drift —
 *
 *   1. WHICH trigger class fires for a user, given only explicit journey state,
 *      saved preferences, and incomplete user-chosen actions (never a health
 *      signal, never a streak). The cron (lib/server/nudge.ts) loads the rows,
 *      derives the signals, and hands the plain shape here.
 *
 *   2. WHICH calm, non-clinical line the user sees for that class + stage. Every
 *      fixed string below is exported and run through the SAME
 *      `assertNoForbiddenClaims` regexes the model output is held to
 *      (assertNudgeBankClaimFree), so a copy edit that smuggles in a clinical
 *      claim — or the banned streak/guilt language of constraint §9 — turns the
 *      suite red.
 *
 * Nothing here touches the meal-balance card or any check input (global
 * constraint §1): a nudge is a frame around the product, never an input to a
 * verdict, and the payload carries only a bounded class + stage, never health
 * text.
 */

/** The bounded trigger vocabulary (plan §10.1 "nudge class"). */
export type NudgeClass = "journey_step" | "weekly_learning_ready" | "generic";

/** Cadence the user chose (plan §P4.3 "Let users choose cadence"). */
export type NudgeCadence = "daily" | "few_per_week" | "weekly";

export const NUDGE_CADENCES = [
  "daily",
  "few_per_week",
  "weekly"
] as const satisfies readonly NudgeCadence[];

/**
 * Stop nudging after this many days with no checks (plan §11 "nudges stop after
 * inactivity"). This is an inactivity WIND-DOWN, not escalation: we simply go
 * quiet — never a "come back, you lost your streak" push (constraint §9). A user
 * who has NEVER checked is not "inactive" (they are new / pre-first-check), so
 * the rule keys off a real last-check date; `daysSinceLastCheck === null` never
 * stops.
 */
export const INACTIVITY_STOP_DAYS = 14;

// ── Copy banks ──────────────────────────────────────────────────────────────

/**
 * Generic rotation (the pre-journey behavior). Calm, one gentle ask, no streak
 * or guilt language — covered by the banned-phrase audit in nudge.test.ts and by
 * assertNudgeBankClaimFree.
 */
export const GENERIC_NUDGE_COPY = [
  "Ready for today? Check your first meal.",
  "One calm check before you eat — that's the whole habit.",
  "What's on your plate today? Prediabetes Pal is ready when you are.",
  "A quick check before your next meal keeps the day easy."
] as const;

/**
 * One line per stage for the journey_step trigger — behavioral, unhurried, and
 * tied to what THIS stage is about (mirrors lib/journey/stages STAGE_COPY). No
 * numbers-as-pressure, no "don't forget", no streak.
 */
export const JOURNEY_STEP_COPY: Record<Stage, string> = {
  1: "Getting oriented this week — check a meal whenever you're ready.",
  2: "Building your reliable defaults — check today's meal when it helps.",
  3: "Real life counts too — check a meal out or on the go when you like.",
  4: "Keep your choices varied — check something new today if you feel like it.",
  5: "You know your rhythm — check a meal whenever it's useful to you."
};

/** The single calm line pointing to a freshly available weekly summary. */
export const WEEKLY_LEARNING_READY_COPY =
  "Your week's summary is ready when you want a calm look back.";

/** Every fixed string a nudge can emit, for the banned-claims test. */
export const NUDGE_COPY: readonly string[] = [
  ...GENERIC_NUDGE_COPY,
  ...Object.values(JOURNEY_STEP_COPY),
  WEEKLY_LEARNING_READY_COPY
];

/**
 * Run every fixed nudge string through the model's own banned-claims regexes.
 * Reused by the unit test; kept here so any caller wiring can assert it too.
 */
export function assertNudgeBankClaimFree(contract: SafetyContract): void {
  assertNoForbiddenClaims(contract, [...NUDGE_COPY]);
}

// ── Trigger selection ────────────────────────────────────────────────────────

/**
 * The explicit, health-free signals the trigger decision is allowed to see. All
 * are derived by the cron from journey state, saved prefs, and incomplete
 * user-chosen actions — never from a band, BAI, or any clinical value.
 */
export type JourneyNudgeSignals = {
  /** Persisted journey state, or "not_started" when the user has no row. */
  journeyState: JourneyState;
  /** Derived current stage (lib/journey/state.currentStage), or null. */
  stage: Stage | null;
  /** Days since the user's most recent check; null if they've never checked. */
  daysSinceLastCheck: number | null;
  /** Whether the current stage's headline intent is already met this week. */
  stageIntentMet: boolean;
  /** A completed-week artifact newer than the user's last nudge exists. */
  weeklyArtifactFresh: boolean;
};

export type NudgeSelection = { class: NudgeClass; stage: Stage | null };

/**
 * Pick the trigger class for a user, or null to STOP (send nothing this run).
 *
 * Stop rules (plan §11, constraint §9), applied first:
 *   - journeyState `paused`     → stop (the user paused on purpose)
 *   - journeyState `graduated`  → stop (finished; maintenance is a separate,
 *     opted-in state that still receives nudges)
 *   - inactivity ≥ 14 days with a real last-check date → stop (wind-down)
 *
 * Class selection (when not stopped):
 *   - active journey + fresh weekly artifact       → weekly_learning_ready
 *   - active journey + current stage intent unmet  → journey_step
 *   - maintenance journey + fresh weekly artifact  → weekly_learning_ready
 *   - everything else (incl. no journey / met intent) → generic
 */
export function selectJourneyNudge(
  signals: JourneyNudgeSignals
): NudgeSelection | null {
  if (
    signals.journeyState === "paused" ||
    signals.journeyState === "graduated"
  ) {
    return null;
  }

  if (
    signals.daysSinceLastCheck !== null &&
    signals.daysSinceLastCheck > INACTIVITY_STOP_DAYS
  ) {
    return null;
  }

  const { journeyState, stage } = signals;

  if (journeyState === "active" && stage !== null) {
    if (signals.weeklyArtifactFresh) {
      return { class: "weekly_learning_ready", stage };
    }
    if (!signals.stageIntentMet) {
      return { class: "journey_step", stage };
    }
    return { class: "generic", stage: null };
  }

  if (journeyState === "maintenance" && stage !== null) {
    if (signals.weeklyArtifactFresh) {
      return { class: "weekly_learning_ready", stage };
    }
    return { class: "generic", stage: null };
  }

  return { class: "generic", stage: null };
}

/** The calm line for a selection; generic rotates deterministically by day. */
export function nudgeBody(
  selection: NudgeSelection,
  genericRotation: number
): string {
  if (selection.class === "journey_step" && selection.stage !== null) {
    return JOURNEY_STEP_COPY[selection.stage];
  }
  if (selection.class === "weekly_learning_ready") {
    return WEEKLY_LEARNING_READY_COPY;
  }
  const bank = GENERIC_NUDGE_COPY;
  const index = ((genericRotation % bank.length) + bank.length) % bank.length;
  return bank[index];
}

// ── Cadence + quiet hours ─────────────────────────────────────────────────────

/** Minimum whole days between sends for each cadence. */
export function minGapDaysForCadence(cadence: NudgeCadence): number {
  switch (cadence) {
    case "weekly":
      return 7;
    case "few_per_week":
      return 2;
    case "daily":
    default:
      return 1;
  }
}

/** Whole-day gap between two YYYY-MM-DD keys (toKey − fromKey). */
export function dayGap(fromKey: string, toKey: string): number {
  const from = Date.parse(`${fromKey}T00:00:00Z`);
  const to = Date.parse(`${toKey}T00:00:00Z`);
  return Math.round((to - from) / 86_400_000);
}

/**
 * Whether the chosen cadence permits a send today given the last send date.
 * `daily` keeps the existing one-per-local-day rule (gap ≥ 1); `few_per_week`
 * spaces sends ≥ 2 days apart; `weekly` ≥ 7. A never-nudged subscription always
 * qualifies.
 *
 * NOTE: the enforced invariant is the minimum SPACING per cadence. The plan's
 * "few_per_week = max 3/week" is the design target this spacing approximates
 * (≥2-day spacing bounds a week to at most 3–4 sends, and real usage — days the
 * user checks in suppress the nudge — keeps it lower). A hard weekly count cap
 * would need a per-send history column; that is a documented follow-up, not
 * built here.
 */
export function cadenceAllowsSend(
  cadence: NudgeCadence,
  todayKey: string,
  lastNudgeDate: string | null
): boolean {
  if (!lastNudgeDate) {
    return true;
  }
  return dayGap(lastNudgeDate, todayKey) >= minGapDaysForCadence(cadence);
}

/**
 * Whether `localHour` falls inside the user's quiet-hours window [start, end).
 * Nulls (no window set) never suppress. A wrap-around window (e.g. 22 → 7) is
 * supported. An empty window (start === end) never suppresses.
 */
export function isQuietHour(
  localHour: number,
  quietStart: number | null,
  quietEnd: number | null
): boolean {
  if (quietStart === null || quietEnd === null || quietStart === quietEnd) {
    return false;
  }
  if (quietStart < quietEnd) {
    return localHour >= quietStart && localHour < quietEnd;
  }
  // Wrap-around midnight window.
  return localHour >= quietStart || localHour < quietEnd;
}
