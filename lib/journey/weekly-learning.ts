import { normalize as normalizeFood } from "../pal/input-precheck";
import { assertNoForbiddenClaims } from "../pal/postprocess";
import type { SafetyContract } from "../pal/safety-contract";
import type { Stage } from "./state";

/**
 * Weekly learning artifact — the deterministic, versioned projection (plan
 * §P4.2, §8 entity `weekly_reflections`: "Versioned weekly learning artifact.
 * Derived only from allowed fields; reproducible.").
 *
 * This module is DELIBERATELY the same shape as the rest of lib/journey/: pure,
 * db-free, IO-free. The API route (app/api/journey/weekly) loads and DECRYPTS
 * the week's checks + memories, derives the journey stage, and hands the plain
 * inputs here; every rule about what the summary says lives in this file and
 * nowhere else. Building version 1 as a projection rather than a model call is a
 * plan requirement — a later generative summary would need its own privacy,
 * safety, claims, eval, and fallback review (plan §P4.2).
 *
 * Hard boundaries (plan §P4.2, global constraint §3):
 *  - NOT a health score. `mealsExplored`/`savedChoices` are activity counts, and
 *    the copy never presents them as a lab-outcome, band aggregation, or
 *    prediction. This module imports NO band/BAI math.
 *  - NO glucose / A1C / prevention / diagnosis language anywhere. Every fixed
 *    copy string in the banks below is exported and run through the SAME
 *    `assertNoForbiddenClaims` regexes the model output is held to
 *    (tests/unit/journey/weekly-learning.test.ts + assertWeeklyBankClaimFree),
 *    so a future copy edit that smuggles in a clinical claim turns the suite red.
 *
 * `repeatedUncertainty` echoes the user's OWN meal text back to them (foods they
 * checked twice with a clarification or a be-careful/hold-off card). That is
 * their data shown to themselves, which is fine — but it is why the persisted
 * artifact is ENCRYPTED at rest (the route stores ciphertext), never plaintext.
 */

// v2 (RV-6): the artifact leads with something usable — one concrete
// experiment and one uncertainty to close, both derived from the user's own
// week — instead of only re-counting their inputs. Bumping the version makes
// the route lazily recompute stored v1 rows on next read.
export const WEEKLY_LEARNING_VERSION = "2";

/** The bounded meal-context vocabulary — mirror of the `meal_memories.label`
 * schema enum. Retyped here (not imported from app/api) to keep this lib pure;
 * `contextsCovered` is emitted in THIS canonical order so the output is
 * independent of row order. A label added to the schema must be added here. */
export const CONTEXT_LABELS = [
  "breakfast",
  "lunch",
  "dinner",
  "snack",
  "restaurant",
  "travel",
  "family_meal",
  "other"
] as const;

export type ContextLabel = (typeof CONTEXT_LABELS)[number];

const LABEL_ORDER: Record<ContextLabel, number> = Object.fromEntries(
  CONTEXT_LABELS.map((label, index) => [label, index])
) as Record<ContextLabel, number>;

/** One check the user ran this week (already owner-decrypted by the route). */
export type WeeklyCheckInput = {
  /** The user's own meal text (decrypted). Used for distinct-meal + repeat math. */
  food: string;
  risk: "SAFE" | "MODERATE" | "HIGH";
  /** True when this result resolved a one-question clarification (checks.wasClarified). */
  wasClarified: boolean;
};

/** One meal memory the user saved this week (bounded fields only). */
export type WeeklyMemoryInput = {
  label: ContextLabel | null;
  favorite: boolean;
};

export type WeeklyLearningInputs = {
  checks: WeeklyCheckInput[];
  memories: WeeklyMemoryInput[];
  /** The DERIVED journey stage for this week (lib/journey/state.currentStage),
   * or null for a user with no active journey. Never a stored stage. */
  stage: Stage | null;
};

export type WeeklyLearningArtifact = {
  version: string;
  weekStart: string;
  /** Distinct meals explored this week (distinct normalized food strings). */
  mealsExplored: number;
  /** How many meal memories the user saved this week. */
  savedChoices: number;
  /** Distinct meal-context labels covered this week, in canonical order. */
  contextsCovered: ContextLabel[];
  /** The user's OWN meal text for foods they checked ≥2× this week with a
   * clarification or a be-careful/hold-off card. Their data, shown to them. */
  repeatedUncertainty: string[];
  /** Unmet intents for the current stage — the "unused / incomplete steps". */
  incompleteSteps: string[];
  /** One optional next exploration, chosen deterministically from the fixed
   * bank by stage + gaps. Null only when there is no stage AND no default. */
  nextExploration: string;
  /** RV-6: ONE concrete, claims-safe experiment for the week, derived from the
   * user's own data. Priority: repeated-uncertain food → uncovered context →
   * the stage-intent exploration (nextExploration). Rendered exactly once as
   * the journey page's primary action (design review D3/#6). */
  experiment: string;
  /** RV-6: the single highest-signal open question — a repeated-uncertain food
   * or a missing context — stated as the user's own data. Null when the week
   * left nothing open. */
  uncertaintyToClose: string | null;
};

/**
 * The fixed suggestion bank (plan §P4.2 "one optional next exploration" +
 * "unused or incomplete journey steps"). One intent per stage: a met() predicate
 * over the week's signals, the line shown in `incompleteSteps` when unmet, and
 * the gentler line shown as `nextExploration` when it is the first unmet intent.
 *
 * All copy is behavioral and non-clinical by construction and is asserted so
 * (assertWeeklyBankClaimFree). Numbers ("three meals") are fine — the banned
 * patterns are about clinical CLAIMS, not digits.
 */
export type WeeklySignals = {
  mealsExplored: number;
  savedChoices: number;
  labels: Set<ContextLabel>;
  favorites: number;
};

type StageIntent = {
  id: string;
  stage: Stage;
  incomplete: string;
  exploration: string;
  met: (signals: WeeklySignals) => boolean;
};

const STAGE_INTENTS: readonly StageIntent[] = [
  {
    id: "save_three",
    stage: 1,
    incomplete: "Save three meals this week to get comfortable reading the card.",
    exploration:
      "Try saving one meal you eat often, so it is ready the next time you want it.",
    met: (s) => s.savedChoices >= 3
  },
  {
    id: "cover_mealtimes",
    stage: 2,
    incomplete: "Save an easy default for breakfast, lunch, and dinner.",
    exploration:
      "Pick one reliable breakfast to save, so mornings are one less decision.",
    met: (s) =>
      s.labels.has("breakfast") && s.labels.has("lunch") && s.labels.has("dinner")
  },
  {
    id: "real_life",
    stage: 3,
    incomplete: "Save a restaurant or travel meal you can fall back on.",
    exploration:
      "Next time you eat out, save what you chose so it is there later.",
    met: (s) => s.labels.has("restaurant") || s.labels.has("travel")
  },
  {
    id: "variety",
    stage: 4,
    incomplete: "Add a few new meals so your choices stay varied.",
    exploration: "Explore one new meal this week to widen your range.",
    met: (s) => s.mealsExplored >= 5
  },
  {
    id: "playbook",
    stage: 5,
    incomplete: "Mark the meals you want to keep as favorites.",
    exploration: "Look back at what you saved and star the ones worth keeping.",
    met: (s) => s.favorites >= 1
  }
];

/** Shown as `nextExploration` when there is no active journey stage. */
export const DEFAULT_EXPLORATION =
  "Save a meal you ate this week, so your summary has more to build on.";

/** Shown as `nextExploration` when every intent for the current stage is met. */
export const STAGE_KEPT_UP_EXPLORATION =
  "You are keeping up with this stage — keep checking meals when it is useful to you.";

/** Human display names for context labels used inside sentences. */
const LABEL_DISPLAY: Record<ContextLabel, string> = {
  breakfast: "breakfast",
  lunch: "lunch",
  dinner: "dinner",
  snack: "snack",
  restaurant: "restaurant",
  travel: "travel",
  family_meal: "family meal",
  other: "everyday"
};

/**
 * RV-6 sentence builders. The FIXED parts are what the claims test can vet;
 * `food` is the user's own meal text echoed back (same precedent as
 * `repeatedUncertainty` — their data, shown to them, encrypted at rest).
 */
export function experimentFromRepeat(food: string): string {
  return `Check ${food} once more this week with the portion written out — one clear answer beats two uncertain ones.`;
}
export function experimentFromContext(label: ContextLabel): string {
  return `You have not saved a ${LABEL_DISPLAY[label]} choice yet — save one this week so it is ready when you need it.`;
}
export function uncertaintyFromRepeat(food: string): string {
  return `${food} has come back uncertain more than once — it is the meal most worth pinning down.`;
}
export function uncertaintyFromContext(label: ContextLabel): string {
  return `A go-to ${LABEL_DISPLAY[label]} choice is still open — nothing saved for it yet.`;
}

/** Every fixed string this projection can emit, for the banned-claims test.
 * The RV-6 builders are exercised with a neutral placeholder so their fixed
 * sentence frames are scanned too. */
export const WEEKLY_LEARNING_COPY: readonly string[] = [
  ...STAGE_INTENTS.flatMap((intent) => [intent.incomplete, intent.exploration]),
  DEFAULT_EXPLORATION,
  STAGE_KEPT_UP_EXPLORATION,
  experimentFromRepeat("your meal"),
  uncertaintyFromRepeat("your meal"),
  ...CONTEXT_LABELS.flatMap((label) => [
    experimentFromContext(label),
    uncertaintyFromContext(label)
  ])
];

/**
 * Run every fixed bank string through the model's own banned-claims regexes.
 * Reused by the unit test; kept here so any caller wiring can assert it too.
 */
export function assertWeeklyBankClaimFree(contract: SafetyContract): void {
  assertNoForbiddenClaims(contract, [...WEEKLY_LEARNING_COPY]);
}

function distinctFoods(checks: WeeklyCheckInput[]): number {
  return new Set(checks.map((c) => normalizeFood(c.food))).size;
}

function contextsCovered(memories: WeeklyMemoryInput[]): ContextLabel[] {
  const present = new Set<ContextLabel>();
  for (const memory of memories) {
    if (memory.label) {
      present.add(memory.label);
    }
  }
  return [...present].sort((a, b) => LABEL_ORDER[a] - LABEL_ORDER[b]);
}

/**
 * Foods checked ≥2× this week where at least one of those checks carried
 * uncertainty (a clarification, or a MODERATE/HIGH card). Output is the user's
 * own display text, deduped by normalized form and ordered deterministically so
 * regeneration is byte-identical regardless of input row order.
 */
function repeatedUncertainty(checks: WeeklyCheckInput[]): string[] {
  const byNormalized = new Map<
    string,
    { count: number; uncertain: boolean; displays: string[] }
  >();
  for (const check of checks) {
    const key = normalizeFood(check.food);
    if (!key) {
      continue;
    }
    const entry = byNormalized.get(key) ?? {
      count: 0,
      uncertain: false,
      displays: []
    };
    entry.count += 1;
    entry.uncertain =
      entry.uncertain || check.wasClarified || check.risk !== "SAFE";
    entry.displays.push(check.food.trim());
    byNormalized.set(key, entry);
  }

  const result: Array<{ key: string; display: string }> = [];
  for (const [key, entry] of byNormalized) {
    if (entry.count >= 2 && entry.uncertain) {
      // Deterministic representative: the lexicographically smallest of the
      // user's own spellings for this meal.
      const display = [...entry.displays].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))[0];
      result.push({ key, display });
    }
  }
  return result
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
    .map((r) => r.display);
}

/**
 * Derive the weekly learning artifact. Pure and deterministic: the same inputs +
 * weekStart + version always produce a byte-identical object (asserted by the
 * reproducibility test), which is what lets the route persist it lazily and
 * regenerate it on demand without drift.
 */
export function deriveWeeklyLearning(
  inputs: WeeklyLearningInputs,
  weekStart: string,
  version: string = WEEKLY_LEARNING_VERSION
): WeeklyLearningArtifact {
  const mealsExplored = distinctFoods(inputs.checks);
  const savedChoices = inputs.memories.length;
  const labels = contextsCovered(inputs.memories);

  const signals: WeeklySignals = {
    mealsExplored,
    savedChoices,
    labels: new Set(labels),
    favorites: inputs.memories.filter((m) => m.favorite).length
  };

  const stageIntents = inputs.stage
    ? STAGE_INTENTS.filter((intent) => intent.stage === inputs.stage)
    : [];
  const unmet = stageIntents.filter((intent) => !intent.met(signals));

  const incompleteSteps = unmet.map((intent) => intent.incomplete);

  let nextExploration: string;
  if (unmet.length > 0) {
    nextExploration = unmet[0].exploration;
  } else if (inputs.stage) {
    nextExploration = STAGE_KEPT_UP_EXPLORATION;
  } else {
    nextExploration = DEFAULT_EXPLORATION;
  }

  const repeats = repeatedUncertainty(inputs.checks);

  // RV-6: one experiment, one open question — from the user's own week, in a
  // fixed priority so regeneration stays deterministic. The "uncovered
  // context" candidate is the first canonical mealtime label (breakfast/
  // lunch/dinner) the user has not saved yet — the labels where a default
  // pays off daily.
  const missingMealtime = (["breakfast", "lunch", "dinner"] as const).find(
    (label) => !signals.labels.has(label)
  );
  const experiment = repeats[0]
    ? experimentFromRepeat(repeats[0])
    : missingMealtime && savedChoices > 0
      ? experimentFromContext(missingMealtime)
      : nextExploration;
  const uncertaintyToClose = repeats[0]
    ? uncertaintyFromRepeat(repeats[0])
    : missingMealtime && savedChoices > 0
      ? uncertaintyFromContext(missingMealtime)
      : null;

  return {
    version,
    weekStart,
    mealsExplored,
    savedChoices,
    contextsCovered: labels,
    repeatedUncertainty: repeats,
    incompleteSteps,
    nextExploration,
    experiment,
    uncertaintyToClose
  };
}

/**
 * The week's signals distilled from the same allowed inputs the artifact uses.
 * Exposed so the nudge cron (lib/server/nudge.ts) can decide whether the current
 * stage's headline intent is already met WITHOUT re-deriving the predicate
 * logic — the STAGE_INTENTS below stay the single source of "what counts as
 * done" for both the weekly summary and the journey_step nudge trigger.
 */
export function weeklySignalsFrom(
  checks: WeeklyCheckInput[],
  memories: WeeklyMemoryInput[]
): WeeklySignals {
  const labels = contextsCovered(memories);
  return {
    mealsExplored: distinctFoods(checks),
    savedChoices: memories.length,
    labels: new Set(labels),
    favorites: memories.filter((m) => m.favorite).length
  };
}

/**
 * Whether the current stage's single headline intent is already satisfied this
 * week. A stage with no intent (out of range) is treated as met — the nudge
 * falls back to a plain reminder rather than inventing an incomplete step.
 */
export function currentStageIntentMet(
  stage: Stage,
  signals: WeeklySignals
): boolean {
  const intent = STAGE_INTENTS.find((i) => i.stage === stage);
  return intent ? intent.met(signals) : true;
}
