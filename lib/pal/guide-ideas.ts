import type { Daypart } from "../coach/insights";

/**
 * The reviewed idea bank (PRD v1.1 §6 F-IDEAS; §9 Step 1 prototype).
 *
 * A bounded artifact a dietitian can review in one sitting — the
 * coach-outputs.ts pattern: fixed audited lines, deterministic rotation, no
 * free generation. Every line is promoted from the public guides
 * (app/guides/what-to-eat-with-prediabetes, prediabetes-meal-plan,
 * prediabetes-snacks) with one edit: any refined-starch side the engine
 * floors in the top band (bread, toast, rice, pasta, potato, wrap, tortilla…
 * — CARB_FORWARD_TOKENS) is dropped, because the PRD requires every idea to
 * read Clear at EVERY band 5.7–6.4 including the most conservative level.
 *
 * Rules the bank keeps (PRD §6 F-IDEAS "must never say"):
 *  - positive only: meal ideas, never foods to limit;
 *  - never that an idea is safe FOR the user, never a reading, never
 *    "your plan" — the anchor phrase on the surface is "Prediabetes Pal's
 *    rules" (§7.3);
 *  - outside the promise registry: these are NOT promoted examples with a
 *    pinned route shape; tests/unit/pal/promise-registry.test.ts is untouched.
 *
 * Deterministic gates: tests/unit/pal/guide-ideas.test.ts proves each line
 * reaches the model path with no clarify and no floor. Model gate: the live
 * labelling eval (Task 4.1) runs every line at 5.9 / 6.2 / 6.4 and writes
 * guide-ideas.labels.json keyed on PROMPT_VERSION; a line that is not Clear
 * at any band is removed here.
 *
 * Copy ledger: guide-ideas-breakfast / -lunch / -dinner (the seed) and
 * guide-ideas-more-breakfast / -lunch / -dinner (GUIDE_IDEA_BANK_MORE, PR-4
 * bank growth, plan §2.1 — two more lines per daypart, ten total). The MORE
 * lines render only when the `ideas-full` guide surface is on (SURFACE_ROWS["ideas-full"],
 * lib/guide-door-flag.ts); `ideas` alone still shows only the eight seed
 * lines, byte-for-byte what it showed before this bank grew. Scanned by the
 * claims audit via EXTRA_SOURCES.
 */
export type GuideIdea = { id: string; text: string; daypart: Daypart; more: boolean };

// Seed list: eight per daypart (review A-43; A-100 grows the seed from six to
// eight so pruning one line after the live eval never breaks the "≥ 6 per
// daypart" floor or the "consecutive loads are disjoint" rotation test) so two
// consecutive loads of three never share an idea even after a prune.
// Fruit-carrying lines (peach) are the ones most likely to fall at band
// 63_64 in the live eval; keep them until the eval says otherwise.
export const GUIDE_IDEA_BANK: Record<Daypart, readonly string[]> = {
  breakfast: [
    "greek yogurt with berries and walnuts",
    "veggie omelet with peppers and spinach",
    "cottage cheese with sliced peach and almonds",
    "scrambled eggs with mushrooms and cheese",
    "hard-boiled eggs with cucumber and tomato",
    "tofu scramble with peppers and onions",
    // what-to-eat-with-prediabetes ("oatmeal with peanut butter") /
    // prediabetes-meal-plan Day 3 breakfast ("oatmeal with peanut butter and
    // cinnamon") — unmodified; neither oatmeal nor peanut butter nor cinnamon
    // is a CARB_FORWARD_TOKENS entry, and "peanut" + "cinnamon" resolve the
    // plain-or-sweetened ambiguity oatmeal otherwise triggers.
    "oatmeal with peanut butter and cinnamon",
    // what-to-eat-with-prediabetes breakfast paragraph: "whole-grain toast
    // with avocado and an egg" — toast dropped.
    "mashed avocado with a fried egg"
  ],
  lunch: [
    "lentil soup with a side salad",
    "tuna and white-bean salad",
    "big salad with hard-boiled eggs, chickpeas, and vinaigrette",
    "chicken salad with olive oil dressing",
    // prediabetes-snacks ("Hummus with carrots, cucumber, peppers, or
    // celery") plus an egg. Task 1.8 fix round 1: was "hummus with carrot and
    // cucumber sticks and a hard-boiled egg" (60 chars), which wrapped to a
    // third row at 360px in WebKit and Firefox; same foods, 52 chars.
    "hummus with carrots, cucumber, and a hard-boiled egg",
    "grilled chicken and avocado salad",
    // prediabetes-meal-plan Day 5 lunch: "whole-grain wrap with hummus,
    // chicken, and lots of vegetables" — wrap dropped.
    "hummus with chicken and mixed vegetables",
    // prediabetes-meal-plan Day 7 lunch: "leftover pork with a side salad" —
    // "leftover" dropped (it is an AMBIGUOUS_UNDERSPECIFIED trigger term and
    // is not a meal description).
    "pork with a side salad"
  ],
  dinner: [
    "baked salmon with roasted broccoli",
    "chicken stir-fry heavy on vegetables",
    "turkey chili with plenty of beans, topped with cheese",
    "sheet-pan chicken thighs with peppers and onions",
    "pork tenderloin with green beans and roasted cauliflower",
    "shrimp with zucchini noodles",
    // what-to-eat-with-prediabetes "what can I eat freely" list: chicken /
    // turkey / fish / eggs / tofu / tempeh as protein, peppers / cabbage /
    // broccoli / mushrooms as nonstarchy vegetables. The 7-day plan's other
    // dinners are either already seeded above or lean on a starch (tacos on
    // corn tortillas) that cannot be dropped without losing the dish, so
    // these two combine only guide-named foods.
    "grilled chicken with roasted peppers and cabbage",
    "baked tofu with broccoli and mushrooms"
  ]
} as const;

/**
 * PR-4 bank growth (plan §2.1): two more lines per daypart (ten total), gated
 * entirely on `full` below — they never render, rotate, or reach the model
 * path unless a caller opts in with `{ full: true }` (the `ideas-full` guide
 * surface). Same rules as the seed (positive only, no CARB_FORWARD_TOKENS
 * side, no AMBIGUOUS_UNDERSPECIFIED trigger term, ≤ 59 chars, no duplicate of
 * a seed line); source comment per line, in the seed's style. The
 * what-to-eat-with-prediabetes / prediabetes-meal-plan lunch and dinner days
 * are already fully mined by the seed (every remaining day either duplicates
 * a seed line once its carb side is dropped, or — Day 7's dinner — cannot be
 * trimmed without losing the dish), so the lunch and dinner additions here
 * are composed the same way seed lines 7–8 of `dinner` were: guide-named
 * foods from what-to-eat-with-prediabetes's "What can I eat freely?" list,
 * combined into new meal-shaped lines rather than lifted from one sentence.
 */
export const GUIDE_IDEA_BANK_MORE: Record<Daypart, readonly string[]> = {
  breakfast: [
    // prediabetes-meal-plan Day 2 breakfast: "two eggs with spinach and
    // whole-grain toast" — toast dropped.
    "two eggs with spinach",
    // prediabetes-meal-plan Day 6 breakfast: "Greek yogurt smoothie with
    // frozen berries and chia seeds" — unmodified, no carb-forward token.
    "greek yogurt smoothie with frozen berries and chia seeds"
  ],
  lunch: [
    // Composed (see header comment above): turkey and beans/lentils as
    // protein, tomatoes and cucumber as nonstarchy vegetables — all named in
    // what-to-eat-with-prediabetes's "What can I eat freely?" list.
    "turkey and lentil salad with tomatoes and cucumber",
    // Composed: fish as protein, green beans and salad greens as nonstarchy
    // vegetables — same freely list.
    "fish with green beans and salad greens"
  ],
  dinner: [
    // Composed, same as seed lines 7–8: tempeh as protein, peppers and
    // mushrooms as nonstarchy vegetables — same freely list.
    "tempeh stir-fry with peppers and mushrooms",
    // prediabetes-snacks: "Cottage cheese with tomato and pepper, or with a
    // little fruit." — pluralized, otherwise unmodified.
    "cottage cheese with tomatoes and peppers"
  ]
} as const;

export const GUIDE_IDEAS: readonly GuideIdea[] = (
  Object.keys(GUIDE_IDEA_BANK) as Daypart[]
).flatMap((daypart) => {
  const seed = GUIDE_IDEA_BANK[daypart].map((text, index) => ({
    id: `${daypart}-${index + 1}`,
    text,
    daypart,
    more: false
  }));
  const more = GUIDE_IDEA_BANK_MORE[daypart].map((text, index) => ({
    id: `${daypart}-${seed.length + index + 1}`,
    text,
    daypart,
    more: true
  }));
  return [...seed, ...more];
});

export type IdeasOptions = { count?: number; full?: boolean; segment?: string | null };

// PRD §7.4's steering: the on-device "What brought you here?" answer nudges
// the first idea toward the second half of the bank so a returning segment
// sees variety, the same two values that steer the first-check chips
// (lib/client/first-check-chips.ts). Any other answer, null, or unset draws
// from the top, unsteered.
const STEERED_SEGMENTS = new Set(["Doctor's advice", "Family history"]);

/**
 * `count` ideas for a daypart, starting at `(rotation × count) % bank.length`
 * and wrapping (review A-43: a full page per tick) — a monotonic on-device counter (lib/client/ideas-rotation.ts)
 * therefore never shows the same first idea on two consecutive loads
 * (PRD §6 F-IDEAS acceptance). Negative / NaN counters fall back to 0, as in
 * coach-outputs.ts pick(). `full` (default false) draws from the seed lines
 * only (`more === false`) — the default call is therefore byte-for-byte what
 * it returned before PR-4 (plan §2.1) grew the bank; `true` draws from all ten.
 * `segment` (Task 4.3, segment steering), when it is one of STEERED_SEGMENTS, adds
 * `Math.floor(bank.length / 2)` to the start before wrapping.
 */
export function ideasFrom(
  ideas: readonly GuideIdea[],
  daypart: Daypart,
  rotation: number,
  options: IdeasOptions = {}
): GuideIdea[] {
  const { count = 3, full = false, segment = null } = options;
  const bank = ideas.filter((idea) => idea.daypart === daypart && (full || !idea.more));
  // An empty bank needs no guard (review A-70, spec review): `Math.min(count, 0)`
  // makes `Array.from` return [] and the NaN start is never used as an index.
  // Review A-43: step by `count`, not by one — two consecutive loads are then
  // disjoint while the bank holds at least 2×count lines (eight per daypart
  // seed, ten with `full`), instead of overlapping on two of three ideas.
  let start = (Math.abs(Math.trunc(rotation) || 0) * count) % bank.length;
  if (segment && STEERED_SEGMENTS.has(segment)) {
    start = (start + Math.floor(bank.length / 2)) % bank.length;
  }
  return Array.from(
    { length: Math.min(count, bank.length) },
    (_, offset) => bank[(start + offset) % bank.length]
  );
}

/** The bound form every surface calls (review A-31: `ideasFrom` exists so the empty case is testable). */
export function ideasFor(daypart: Daypart, rotation: number, options?: IdeasOptions): GuideIdea[] {
  return ideasFrom(GUIDE_IDEAS, daypart, rotation, options);
}
