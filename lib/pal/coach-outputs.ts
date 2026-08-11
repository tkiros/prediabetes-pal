import { z } from "zod";

import type { Daypart } from "../coach/insights";
import {
  PalUserClarifySchema,
  PalUserClinicalSchema,
  PalUserNotFoodSchema,
  PalUserOutOfScopeSchema,
  PalUserResultSchema,
  PalUserRetrySchema
} from "./schemas";
import type { PalUserResponse } from "./schemas";

/**
 * Decision-card coach outputs (F-12 / W-17 Tier 1).
 *
 * Derived deterministically from the engine response — never by new model
 * behavior. That design is CORRECT and is kept: every sentence a user reads
 * from this file is pre-cleared against the claims boundary, which is a
 * guarantee free generation cannot make. The bug was never the determinism.
 *
 * The bug was that the bank held exactly ONE sentence per slot, attached to
 * EVERY non-SAFE result, forever. A daily user met the same three sentences
 * about thirty times a month, which quietly falsified the "daily relationship"
 * the product is sold on — and, because the tips were labelled as though chosen
 * for that meal, the sequencing tip cheerfully told people to start with the
 * vegetables on their milkshake.
 *
 * Three changes, none of which loosen the claims guarantee:
 *
 *  1. **Variants.** 6 audited sentences per slot instead of 1. The bank is a
 *     bounded artifact a dietitian can review in one sitting — unlike free
 *     generation, which must be policed forever.
 *  2. **Deterministic rotation.** Selection is `rotation % variants.length`,
 *     never Math.random() — so it is reproducible, testable, and a client
 *     cycling its counter cannot see the same sentence twice in a row.
 *  3. **Suppression + honest framing.** A drink gets no plate-sequencing tip,
 *     and the card now frames these as general strategies rather than implying
 *     they were selected for this specific meal (they are not, and saying so
 *     was the actual dishonesty).
 */

export type CoachOutputs = {
  sequencingTip: string | null;
  postMealAction: string | null;
  keepMost: string | null;
};

// Eat-order strategies. Grounded in Imai 2023 / Shukla 2019, cited with full
// framing on /how-it-works — never as numbers here.
const SEQUENCING_TIPS = [
  "If practical, start with the vegetables or protein on your plate and save the carb-heavy part for last.",
  "Where you can, eat the protein and vegetables first and leave the starchy part until the end.",
  "Saving the bread or rice until after the rest of the plate is one small change that costs nothing.",
  "If the plate allows it, front-load the vegetables and protein and finish with the carbs.",
  "Vegetables first, protein second, the carb-heavy part last — same meal, different order.",
  "Eating the salad or protein before the starch is a habit many people find easy to keep."
] as const;

const POST_MEAL_ACTIONS = [
  "A short 10–15 minute walk after this meal is a calm next step.",
  "A gentle 10–15 minute walk afterwards is an easy one, if you have the time.",
  "Ten minutes on your feet after eating — a walk, the washing-up, a lap of the block — is enough to count.",
  "If you can, move a little after this meal: a short walk, some tidying, anything that is not sitting down.",
  "A brief walk after eating is one of the simplest habits to keep, whenever it fits your day.",
  "Standing up and moving for ten minutes after a meal is a small, repeatable step."
] as const;

/**
 * Daypart-conditioned post-meal actions (W-17 Tier 1, item 3).
 *
 * "A short walk after this meal" is fine at 7pm and slightly absurd at 7am on
 * the way out of the door. The daypart is a signal already in hand — the same
 * three-way split the insights engine uses (`daypartOfHour`, imported rather
 * than re-derived) — and it costs no new data collection, no DB round-trip and
 * no model call: the client sends the bucket it already computes locally.
 *
 * Unknown daypart (older clients, curl, the demo page) falls back to the
 * general bank above, so this can only ever ADD specificity, never remove a
 * tip. Every variant is audited copy scanned by claims-boundary-copy.test.ts,
 * exactly like the general bank.
 */
const POST_MEAL_ACTIONS_BY_DAYPART = {
  breakfast: [
    "If the morning allows it, walk part of the way somewhere after this — ten minutes counts.",
    "A short walk before the day takes over is the easiest one to actually do.",
    "If you are heading out anyway, a slightly longer way there does the job.",
    "Ten minutes on your feet this morning — the school run, the commute, the stairs — is enough.",
    "Starting the day with a little movement after eating is a habit that tends to stick."
  ],
  lunch: [
    "A short walk before you sit back down is a calm way to break up the afternoon.",
    "If you get a break after this, ten minutes outside is enough to count.",
    "A lap of the block, or the long way back to your desk, does the job.",
    "Ten minutes of walking after lunch is one of the simplest habits to keep.",
    "If the afternoon allows it, stay on your feet for a little while after eating."
  ],
  dinner: [
    "A gentle 10–15 minute walk after dinner is a calm end to the day.",
    "An evening walk after this meal is an easy one, if you have the time.",
    "Ten minutes on your feet after dinner — a walk, the washing-up, a lap of the block — is enough.",
    "If you can, move a little before you settle in for the evening.",
    "A short stroll after the evening meal is a small, repeatable step."
  ]
} as const;

// "Enjoy it anyway" (Approach B): address the pain WITHOUT taking the food
// away. Qualitative, DO-framed, MODERATE/HIGH only — SAFE gets nothing (no
// piling on). Every variant names no meal component, so whole-portion
// moderation stays true for every flagged meal this attaches to.
const KEEP_MOST_LINES = [
  "Enjoy a smaller portion now and set the rest aside for later — same food, gentler pace.",
  "Have some of it now and save the rest — you keep the food, just spread out.",
  "A smaller helping now and the rest later still keeps the thing you actually wanted.",
  "You do not have to skip it. A little now and the rest another time is a real option.",
  "Keep the food, shrink the serving — the rest will still be there later.",
  "Half now and half later is a fair trade: you still get it, just at a gentler pace."
] as const;

/**
 * Drink-dominant meals get no plate-sequencing tip.
 *
 * "Start with the vegetables on your plate" attached to a milkshake was a real
 * shipped output — the honest tell that the tip was never about the meal.
 * A drink only suppresses the tip when there is nothing on a plate alongside
 * it: "orange juice" gets no sequencing tip, "chicken salad and a juice" still
 * does, because there the advice is actionable.
 */
const DRINK_TOKENS = [
  "milkshake",
  "shake",
  "smoothie",
  "juice",
  "soda",
  "cola",
  "lemonade",
  "frappuccino",
  "latte",
  "cappuccino",
  "coffee",
  "tea",
  "eggnog",
  "cocktail",
  "beer",
  "wine",
  "cider",
  "drink"
] as const;

const PROTEIN_VEG_TOKENS = [
  "chicken",
  "salmon",
  "fish",
  "egg",
  "eggs",
  "tofu",
  "beans",
  "lentils",
  "turkey",
  "beef",
  "steak",
  "shrimp",
  "salad",
  "broccoli",
  "spinach",
  "greens",
  "vegetables"
] as const;

const PLATE_TOKENS = [
  ...PROTEIN_VEG_TOKENS,
  "rice",
  "pasta",
  "bread",
  "toast",
  "sandwich",
  "burger",
  "pizza",
  "plate",
  "bowl"
] as const;

/**
 * Meal-conditional sequencing tips (forensic 2026-07-27, §5.2: "2 of 4 'Try'
 * rows are explicitly generic"). Same design as the daypart banks: condition
 * on a signal already in hand — the food text the route already passes for
 * drink suppression — and fall back to the general bank, so this only ever
 * ADDS specificity. The carb noun echoed back is always a token from this
 * closed audited list, never a slice of the user's own text.
 *
 * The list is deliberately narrow: only starches that are near-always a
 * SEPARABLE side when a protein or vegetable is also on the plate. Pasta,
 * noodle and spaghetti dishes are usually mixed ("chicken noodle soup"),
 * and scooping breads (naan, roti, injera, tortillas) are the utensil —
 * "save the injera for last" would misread how the meal is eaten. Those all
 * keep the hedged general bank.
 *
 * Two guards, both required before a token anchors:
 *  1. A protein/vegetable is also named — "save the oatmeal for last" on a
 *     bowl of plain oatmeal would be the milkshake bug again.
 *  2. The specific occurrence is clean: not negated ("no bread"), not a
 *     substitute ("cauliflower rice"), not fused into a dish whose name
 *     merely contains the starch ("potato salad", "egg fried rice").
 */
const CARB_ANCHOR_TOKENS = [
  "rice",
  "bread",
  "potatoes",
  "potato",
  "fries",
  "couscous",
  "quinoa"
] as const;

// Within two words before the token: the user is excluding it.
const NEGATION_WORDS = ["no", "without", "minus", "skip", "skipping", "hold"];
// Immediately before: a low-carb substitute or a fused preparation.
const SUBSTITUTE_BEFORE = ["cauliflower", "broccoli", "konjac", "fried"];
// Immediately after: the token is a modifier, not the dish's starch side.
const FUSED_AFTER = [
  "vinegar",
  "flour",
  "milk",
  "paper",
  "cake",
  "cakes",
  "salad",
  "soup",
  "bake",
  "casserole",
  "pudding",
  "crumbs",
  "water",
  "noodle",
  "noodles"
];

// {carb} is replaced with the matched CARB_ANCHOR_TOKENS word. Every template
// works with each noun on the closed list (no is/are agreement), and the whole
// interpolated surface stays a bounded artifact a dietitian can review.
const MEAL_SEQUENCING_TIPS = [
  "If practical, start with the vegetables or protein and save the {carb} for last.",
  "Where you can, eat the protein and vegetables first and leave the {carb} until the end.",
  "Saving the {carb} until after the rest of the plate is one small change that costs nothing.",
  "If the plate allows it, front-load the vegetables and protein and finish with the {carb}.",
  "Eating the salad or protein before the {carb} is a habit many people find easy to keep."
] as const;

function hasWord(text: string, term: string): boolean {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(
    `(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`,
    "iu"
  ).test(text);
}

export function isDrinkOnly(food: string): boolean {
  const hasDrink = DRINK_TOKENS.some((token) => hasWord(food, token));
  if (!hasDrink) {
    return false;
  }

  return !PLATE_TOKENS.some((token) => hasWord(food, token));
}

/**
 * True when at least one occurrence of the token reads as a standalone
 * starch side: not negated, not a substitute's modifier target, not fused
 * into a compound dish name. "no rice, extra chicken and bread" anchors
 * bread, not rice.
 */
function hasCleanCarbOccurrence(food: string, token: string): boolean {
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const occurrences = food.matchAll(
    new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, "giu")
  );

  for (const occurrence of occurrences) {
    const before =
      food
        .slice(0, occurrence.index)
        .toLowerCase()
        .match(/[\p{L}\p{N}']+/gu) ?? [];
    const after =
      food
        .slice((occurrence.index ?? 0) + token.length)
        .toLowerCase()
        .match(/[\p{L}\p{N}']+/gu) ?? [];

    const negated =
      NEGATION_WORDS.includes(before.at(-1) ?? "") ||
      NEGATION_WORDS.includes(before.at(-2) ?? "");
    const substituted = SUBSTITUTE_BEFORE.includes(before.at(-1) ?? "");
    const fused = FUSED_AFTER.includes(after[0] ?? "");

    if (!negated && !substituted && !fused) {
      return true;
    }
  }

  return false;
}

/**
 * The carb noun the sequencing tip may name back — or null when naming one
 * would be unearned (no clean carb on the closed list, or nothing non-carb
 * to eat first). First list match wins so the choice is deterministic.
 */
export function mealCarbAnchor(food: string): string | null {
  if (!PROTEIN_VEG_TOKENS.some((token) => hasWord(food, token))) {
    return null;
  }

  return (
    CARB_ANCHOR_TOKENS.find((token) => hasCleanCarbOccurrence(food, token)) ??
    null
  );
}

/**
 * FNV-1a. Not cryptographic and does not need to be — it exists only to turn a
 * per-check client id into a stable index when the client sends no rotation
 * counter. The point is determinism (a given check always renders the same
 * card, in tests and in production), which `Math.random()` cannot offer and
 * which matters more here than distribution quality.
 */
function hashToIndex(seed: string, modulo: number): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash % modulo;
}

function pick<T>(
  variants: readonly T[],
  rotation: number | undefined,
  seed: string
): T {
  const index =
    rotation === undefined
      ? hashToIndex(seed, variants.length)
      : // A monotonic counter cycles the bank, so consecutive checks can never
        // land on the same sentence. Negative/NaN counters fall back to 0.
        Math.abs(Math.trunc(rotation) || 0) % variants.length;

  return variants[index];
}

export type CoachOptions = {
  /**
   * The food text — decides suppression and the carb anchor. Never stored or
   * logged by the coach layer itself; the anchored noun that reaches the
   * rendered tip is always a closed-list token, not the user's own words.
   */
  food?: string;
  /** Monotonic per-client counter; absent for older clients → hash fallback. */
  rotation?: number;
  /** Per-check id, the hash fallback's seed. */
  seed?: string;
  /** Which part of the day the user is eating in; absent → the general bank. */
  daypart?: Daypart;
};

export function deriveCoachOutputs(
  response: PalUserResponse,
  options: CoachOptions = {}
): CoachOutputs {
  if (response.kind !== "result" || response.risk === "SAFE") {
    // SAFE gets no extra homework (tone policy: no piling on), and
    // clarify/not_food/out_of_scope/clinical/retry carry no verdict to coach
    // on. A clinical route in particular must never pick up a walking tip.
    return { sequencingTip: null, postMealAction: null, keepMost: null };
  }

  const { food = "", rotation, seed = food, daypart } = options;

  const postMealBank = daypart
    ? POST_MEAL_ACTIONS_BY_DAYPART[daypart]
    : POST_MEAL_ACTIONS;

  const carb = mealCarbAnchor(food);

  return {
    sequencingTip: isDrinkOnly(food)
      ? null
      : carb
        ? pick(MEAL_SEQUENCING_TIPS, rotation, `seq:${seed}`).replaceAll(
            "{carb}",
            carb
          )
        : pick(SEQUENCING_TIPS, rotation, `seq:${seed}`),
    postMealAction: pick(postMealBank, rotation, `act:${seed}`),
    keepMost: pick(KEEP_MOST_LINES, rotation, `keep:${seed}`)
  };
}

/** Exposed so the copy-audit and ledger tests can enumerate the whole bank. */
export const COACH_PHRASE_BANK = {
  sequencingTip: SEQUENCING_TIPS,
  mealSequencingTip: MEAL_SEQUENCING_TIPS,
  carbAnchors: CARB_ANCHOR_TOKENS,
  postMealAction: POST_MEAL_ACTIONS,
  postMealActionBreakfast: POST_MEAL_ACTIONS_BY_DAYPART.breakfast,
  postMealActionLunch: POST_MEAL_ACTIONS_BY_DAYPART.lunch,
  postMealActionDinner: POST_MEAL_ACTIONS_BY_DAYPART.dinner,
  keepMost: KEEP_MOST_LINES
} as const;

// The API response = engine union + the three nullable coach fields. The
// engine's own schemas stay untouched; this schema belongs to the route layer.
const COACH_FIELDS = {
  sequencingTip: z.string().nullable(),
  postMealAction: z.string().nullable(),
  keepMost: z.string().nullable()
};

export const CheckApiResponseSchema = z.discriminatedUnion("kind", [
  // Result carries an optional persisted-check id (§P1.6): present only for a
  // signed-in, consented, stored check so the client can link feedback to it.
  PalUserResultSchema.extend({
    ...COACH_FIELDS,
    checkId: z.string().uuid().optional()
  }),
  PalUserClarifySchema.extend(COACH_FIELDS),
  PalUserNotFoodSchema.extend(COACH_FIELDS),
  PalUserOutOfScopeSchema.extend(COACH_FIELDS),
  PalUserClinicalSchema.extend(COACH_FIELDS),
  PalUserRetrySchema.extend(COACH_FIELDS)
]);

export type CheckApiResponse = z.infer<typeof CheckApiResponseSchema>;
