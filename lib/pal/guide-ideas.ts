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
 * Copy ledger: guide-ideas-breakfast / -lunch / -dinner. Scanned by the claims
 * audit via EXTRA_SOURCES.
 */
export type GuideIdea = { id: string; text: string; daypart: Daypart };

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

export const GUIDE_IDEAS: readonly GuideIdea[] = (
  Object.keys(GUIDE_IDEA_BANK) as Daypart[]
).flatMap((daypart) =>
  GUIDE_IDEA_BANK[daypart].map((text, index) => ({
    id: `${daypart}-${index + 1}`,
    text,
    daypart
  }))
);

/**
 * `count` ideas for a daypart, starting at `(rotation × count) % bank.length`
 * and wrapping (review A-43: a full page per tick) — a monotonic on-device counter (lib/client/ideas-rotation.ts)
 * therefore never shows the same first idea on two consecutive loads
 * (PRD §6 F-IDEAS acceptance). Negative / NaN counters fall back to 0, as in
 * coach-outputs.ts pick().
 */
export function ideasFrom(
  ideas: readonly GuideIdea[],
  daypart: Daypart,
  rotation: number,
  count = 3
): GuideIdea[] {
  const bank = ideas.filter((idea) => idea.daypart === daypart);
  // An empty bank needs no guard (review A-70, spec review): `Math.min(count, 0)`
  // makes `Array.from` return [] and the NaN start is never used as an index.
  // Review A-43: step by `count`, not by one — two consecutive loads are then
  // disjoint while the bank holds at least 2×count lines (the seed bank has
  // eight per daypart), instead of overlapping on two of three ideas.
  const start = ((Math.abs(Math.trunc(rotation) || 0) * count) % bank.length);
  return Array.from(
    { length: Math.min(count, bank.length) },
    (_, offset) => bank[(start + offset) % bank.length]
  );
}

/** The bound form every surface calls (review A-31: `ideasFrom` exists so the empty case is testable). */
export function ideasFor(daypart: Daypart, rotation: number, count = 3): GuideIdea[] {
  return ideasFrom(GUIDE_IDEAS, daypart, rotation, count);
}
