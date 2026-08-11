import { CLARIFY_QUESTIONS } from "./clarify";
import type { PalPolicyFlag } from "./schemas";

export type InputPrecheck =
  | { kind: "ok"; flags: PalPolicyFlag[] }
  | { kind: "not_food"; examples: string[] }
  | { kind: "clarify"; question: string }
  | { kind: "carbs_only"; flags: PalPolicyFlag[] };

const MAX_FOOD_LENGTH = 160;

const NON_FOOD_EXAMPLES = [
  "oatmeal with nuts",
  "grilled chicken with rice and vegetables",
  "egg scramble with spinach"
] as const;

// W-21: structural patterns, not exact phrases. Each targets a manipulation
// SHAPE (override verb + instruction noun, prompt exfiltration, persona
// hijack, forced verdict) so paraphrases land too. Every pattern requires an
// instruction-domain word a meal description has no reason to contain — the
// false-positive surface on real food inputs is deliberately near-zero, and
// the model-side schema + postprocess contract remain the backstop for
// anything that slips past.
const PROMPT_INJECTION_PATTERNS = [
  // "ignore/disregard/forget/override … instructions/rules/prompt/safety"
  /\b(?:ignore|disregard|forget|override|bypass|skip)\b[^.,;!?]{0,40}\b(?:instructions?|rules?|guidelines?|prompts?|polic(?:y|ies)|safety)\b/i,
  // naming the hidden prompt/config at all
  /\b(?:system|developer|hidden|initial)\s+(?:prompt|message|instructions?)\b/i,
  // exfiltration: "reveal/show/print/repeat/leak … prompt/instructions"
  /\b(?:reveal|show|print|repeat|output|leak|display)\b[^.,;!?]{0,40}\b(?:prompts?|instructions?|system message)\b/i,
  // persona hijack
  /\byou are now\b/i,
  /\bpretend\s+(?:to be|you(?:'re| are))\b/i,
  /\b(?:act|behave|respond)\s+as\s+(?:a|an|the)\b/i,
  /\bjailbreak/i,
  /\bdeveloper mode\b/i,
  // Deliberately NOT here: forced-verdict coaxing ("just say SAFE"). The
  // frozen corpus pins that a real food with a coax bolted on still gets a
  // cautious VERDICT (adversarial-coax-energy-drink expects `result`) — the
  // deterministic floors and postprocess contract absorb the coercion, and a
  // refusal there would punish users who merely quote something they read.
  // off-task generation
  /\bwrite (?:a|the)?\s*(?:poem|story|essay|joke|haiku)\b/i,
  /\btell me a joke\b/i
];

const ORDINARY_OBJECT_PATTERNS = [
  /\brunning shoes?\b/i,
  /\bsneakers?\b/i,
  /\blaptop charger\b/i,
  /\bphone charger\b/i,
  /\bdish soap\b/i,
  /\bhand soap\b/i,
  /\bwater bottle\b/i,
  /\bphone case\b/i,
  /\btoothbrush\b/i,
  /\bshampoo\b/i
] as const;

const AMBIGUOUS_PLAIN_OR_SWEETENED = [
  "oatmeal",
  "cereal",
  "yogurt",
  "smoothie"
];

const AMBIGUOUS_PROTEIN_OR_VEG = [
  "sandwich",
  "wrap",
  "salad",
  "bowl",
  "pasta"
];

// 2026-07-16 panel F-5: the product graded 10/40 deliberately underspecified
// inputs instead of asking ("protein and vegetables" → SAFE was called "false
// precision" by all three reviewers). Exact-match only, like the two lists
// above — a composed description ("leftover fried rice, two cups") must still
// reach the model. PENDING RD/CDCES confirmation under W-05.
const AMBIGUOUS_UNDERSPECIFIED = [
  "leftovers",
  // AUD-029: the singular slipped past the plural trigger — a bare "leftover"
  // now clarifies too, while "leftover fried rice" still reaches the model
  // via the substantive-remainder rule.
  "leftover",
  "takeout",
  "take out",
  "breakfast",
  "lunch",
  "dinner",
  "a snack",
  "snack",
  "fruit",
  "toast",
  "soup",
  "granola",
  "crackers",
  "a shake",
  "shake",
  "a bar",
  "protein and vegetables",
  "protein and veg",
  "mcdonald's",
  "mcdonalds",
  "chinese food",
  "my usual",
  "the usual"
];

// Matched with substring semantics (containsAnyLoose), which is why singulars
// cover most plurals for free ("cookie" ⊂ "cookies") — but NOT irregular ones:
// "pastry" is not a substring of "pastries", so both forms must be listed.
// N-17 named three foods that slipped through; two of them ("jelly beans",
// "eggnog") were never on these lists at all, so no amount of matching-semantics
// work would have caught them. Sugar has to be *named* to be floored.
const CARBS_ONLY_PATTERNS = [
  "plain bagel",
  "bagel",
  "white rice",
  "plain rice",
  "pasta",
  "tortilla",
  "cereal",
  "candy",
  "candies",
  "pastry",
  "pastries",
  "donut",
  "doughnut",
  "cookie",
  "cake",
  "brownie",
  "milkshake",
  "soda",
  "juice",
  "jelly bean",
  "jellybean",
  "eggnog",
  "ice cream",
  // 2026-07-16 panel F-2 additions (doc 18): brands, synonyms, and shapes the
  // ontology could not see. Sugary entries also appear in HIGH_RISK below;
  // starchy-not-sugary entries (pasta shapes, mac and cheese) stay
  // MODERATE-floored like "pasta". "honey"/"agave"/"syrup" are deliberately
  // CARBS_ONLY-only: the panel banded a tablespoon of honey in tea MODERATE
  // (c-honey-tea), so the named-sugar floor holds without forcing HIGH on
  // condiment quantities. PENDING RD/CDCES confirmation under W-05.
  "oreo",
  "sprite",
  "cola",
  "pepsi",
  "fanta",
  "boba",
  "bubble tea",
  "horchata",
  "sweet tea",
  "gatorade",
  "powerade",
  "honey",
  "agave",
  "syrup",
  "cinnamon roll",
  "penne",
  "macaroni",
  "mac and cheese",
  "fettuccine",
  "linguine",
  "rigatoni",
  "raisins",
  "dried fruit",
  // AUD-029 (stratum-sauce-bbq-ribs): sugar-heavy condiments under the same
  // honey/agave/syrup precedent above — named sugar floors MODERATE without
  // forcing HIGH on condiment quantities. PENDING RD/CDCES under W-05.
  "bbq sauce",
  "barbecue sauce",
  "bbq ribs"
] as const;

const HIGH_RISK_PATTERNS = [
  "candy",
  "candies",
  "pastry",
  "pastries",
  "donut",
  "doughnut",
  "cookie",
  "cake",
  "brownie",
  "milkshake",
  "soda",
  "juice",
  "frappuccino",
  "jelly bean",
  "jellybean",
  "eggnog",
  "ice cream",
  // 2026-07-16 panel F-2: sugary drinks and confections by brand or synonym.
  // Deterministic-HIGH class per the safety contract's sugary_drink_or_dessert
  // floor. PENDING RD/CDCES confirmation under W-05.
  "oreo",
  "sprite",
  "cola",
  "pepsi",
  "fanta",
  "boba",
  "bubble tea",
  "horchata",
  "sweet tea",
  "gatorade",
  "powerade",
  "cinnamon roll",
  "raisins",
  "dried fruit"
] as const;

/**
 * Compound foods that CONTAIN a risk-raising substring but are not that food
 * (2026-07-16 panel F-2). The risk lists are substring-matched ON PURPOSE (see
 * the matching-asymmetry comment at the bottom of this file) — so the fix for
 * "pancakes" flooring to HIGH via the `cake` substring is to strip the
 * compound phrase BEFORE the risk match, exactly the way BUFFER_EXCLUSIONS
 * already strips "jelly beans" before the buffer test. Pancakes remain
 * carb-forward via their own CARB_FORWARD token; they just stop being HIGH
 * as *cake*. "chocolate" exists here so the new "cola" pattern cannot fire
 * inside it ("cho-cola-te"), and "fantastic"/"honeydew" so "fanta"/"honey"
 * cannot fire inside them.
 */
const RISK_PATTERN_EXCLUSIONS = [
  "pancakes",
  "pancake",
  "rice cakes",
  "rice cake",
  "fishcakes",
  "fishcake",
  "fish cakes",
  "fish cake",
  "crab cakes",
  "crab cake",
  "chocolate",
  "fantastic",
  "honeydew"
] as const;

/**
 * Sugar-negation strip (2026-07-16 panel F-5: "diet coke" and the sugar-free
 * family). A named diet/zero-sugar variant must not trip the sugary floors on
 * the base word ("diet pepsi", "sugar free syrup", "coke zero"). Removing the
 * modifier AND its noun is deliberate: what remains is graded by the model,
 * which the prompt now tells to judge the named variant. Shared with the
 * grounded-reason check in postprocess so "sugar-free cookies" cannot count
 * as sugar evidence for a "mostly sugary" reason. PENDING RD under W-05.
 */
const SUGAR_NEGATION_PATTERNS = [
  /\b(?:diet|unsweetened|sugar[- ]free|zero[- ]sugar|no[- ]sugar[- ]added)\s+[\p{L}]+/giu,
  /\b[\p{L}]+\s+zero\b/giu
];

export function stripSugarNegations(food: string): string {
  let text = food;
  for (const pattern of SUGAR_NEGATION_PATTERNS) {
    text = text.replace(pattern, " ");
  }
  return text;
}

/** The text the risk-raising (substring) lists are allowed to see. */
function riskMatchText(food: string): string {
  let text = stripSugarNegations(food);
  for (const phrase of RISK_PATTERN_EXCLUSIONS) {
    text = text.split(phrase).join(" ");
  }
  return text;
}

const PROTEIN_TOKENS = [
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
  "protein"
] as const;

const NONSTARCHY_VEGETABLE_TOKENS = [
  "broccoli",
  "spinach",
  "salad",
  "greens",
  "vegetables",
  "vegetable",
  "cauliflower",
  "zucchini",
  "cucumber",
  "pepper",
  "peppers"
] as const;

/**
 * @param options.clarified - The one-clarification cap (plan §8, P1.3). Set by
 *   the check flow when this input is the user's ANSWER to a prior clarify
 *   question (route reads the `x-pal-clarified` header). When true the
 *   ambiguity clarify is suppressed so a resolved follow-up reaches the model
 *   path instead of chaining into a second question — even if the resolved text
 *   would itself trigger a DIFFERENT clarify category. not_food/injection and
 *   the risk-raising (carbs_only / high-risk) floors are NOT suppressed: the cap
 *   silences the question, never the safety routing.
 */
export function classifyInputBeforeModel(
  food: string,
  options?: { clarified?: boolean }
): InputPrecheck {
  const normalized = normalize(food);

  if (normalized.length === 0) {
    return {
      kind: "clarify",
      question: "What food or meal are you checking?"
    };
  }

  if (normalized.length > MAX_FOOD_LENGTH) {
    return {
      kind: "clarify",
      question: "Can you shorten this to one food or meal?"
    };
  }

  if (looksLikeNonFood(normalized)) {
    return {
      kind: "not_food",
      examples: [...NON_FOOD_EXAMPLES]
    };
  }

  const ambiguousQuestion = options?.clarified
    ? null
    : getAmbiguousQuestion(normalized);
  if (ambiguousQuestion) {
    return {
      kind: "clarify",
      question: ambiguousQuestion
    };
  }

  if (isCarbsOnlyMeal(normalized)) {
    const flags: PalPolicyFlag[] = ["carbs_only", "borderline"];
    if (containsAnyLoose(riskMatchText(normalized), HIGH_RISK_PATTERNS)) {
      flags[1] = "high_risk";
    }

    return {
      kind: "carbs_only",
      flags
    };
  }

  // Carb-forward but buffered (protein/veg present): NOT carbs-only, so it goes
  // to the model as normal — but it now carries a deterministic `borderline`
  // flag the model cannot veto. In the top band that flag is what fires the
  // SAFE→MODERATE floor; in the lower bands it is inert. See isCarbForward.
  if (isCarbForward(normalized)) {
    return {
      kind: "ok",
      flags: ["borderline"]
    };
  }

  return {
    kind: "ok",
    flags: []
  };
}

// Exported for reuse by the memory recall handler (Task 15 / §P3.3): exact
// recall must normalize the just-checked food the SAME way the precheck does, so
// "White Rice " recalls a saved "white rice". One normalizer, no second copy.
export function normalize(food: string): string {
  return food.trim().toLowerCase().replace(/\s+/g, " ");
}

function looksLikeNonFood(food: string): boolean {
  return (
    PROMPT_INJECTION_PATTERNS.some((pattern) => pattern.test(food)) ||
    ORDINARY_OBJECT_PATTERNS.some((pattern) => pattern.test(food))
  );
}

/**
 * Ambiguity detection (Task 3 / P1.3, journey 5).
 *
 * The three trigger lists are matched as WORD-BOUNDARY tokens within the input
 * (not exact full-string equality), so "bowl of oatmeal" and "oatmeal with
 * milk" clarify the same as bare "oatmeal". Each category then applies a
 * resolution guard so an input that already carries the disambiguating context
 * does NOT clarify (false-clarification prevention):
 *
 *  - plain_or_sweetened: resolved once the sweetness is settled — a plain marker,
 *    a named sugar/fruit sweetener, or a real protein/veg/nut component. "milk"
 *    is deliberately not a resolver: it says nothing about added sugar, so
 *    "oatmeal with milk" stays ambiguous.
 *  - protein_or_veg / underspecified: resolved once the input is a described
 *    plate rather than a bare category word — i.e. a substantive food word
 *    survives after the trigger is stripped.
 *
 * Risk-raising evidence beats clarification: if the text AROUND the trigger
 * carries a named carbs_only/high-risk food, the resolver passes and the input
 * falls through to the carbs_only floor instead of a "plain or sweetened?"
 * question (e.g. "oatmeal with honey", "bowl of macaroni"). not_food/injection
 * still runs first (looksLikeNonFood, above), and clinical precedence is upstream
 * in service.ts — this function never sees a clinically-routed input.
 */
function getAmbiguousQuestion(food: string): string | null {
  if (
    containsAny(food, AMBIGUOUS_PLAIN_OR_SWEETENED) &&
    !plainOrSweetenedResolved(food)
  ) {
    return CLARIFY_QUESTIONS.plain_or_sweetened;
  }

  if (
    containsAny(food, AMBIGUOUS_PROTEIN_OR_VEG) &&
    !hasSubstantiveRemainder(stripTerms(food, AMBIGUOUS_PROTEIN_OR_VEG))
  ) {
    return CLARIFY_QUESTIONS.protein_or_veg;
  }

  if (
    containsAny(food, AMBIGUOUS_UNDERSPECIFIED) &&
    !hasSubstantiveRemainder(stripTerms(food, AMBIGUOUS_UNDERSPECIFIED))
  ) {
    return CLARIFY_QUESTIONS.underspecified;
  }

  return null;
}

/** Plain-side markers that settle the sweetness question by themselves. */
const PLAIN_MARKERS = ["plain", "unsweetened", "savory", "savoury"] as const;

/**
 * Named sweeteners / fruit that resolve "plain or sweetened?" — the sugar is
 * stated, so the question is moot (and any of these that is ALSO a named
 * carbs_only food will floor downstream). "milk" is intentionally absent.
 */
const SWEETENING_RESOLVER_TOKENS = [
  "sweetened",
  "sugar",
  "sugars",
  "honey",
  "syrup",
  "agave",
  "maple",
  "molasses",
  "jam",
  "jelly",
  "marmalade",
  "nutella",
  "chocolate",
  "fruit",
  "fruits",
  "berry",
  "berries",
  "blueberry",
  "blueberries",
  "strawberry",
  "strawberries",
  "raspberry",
  "raspberries",
  "banana",
  "bananas",
  "raisin",
  "raisins",
  "granola",
  "cinnamon",
  "date",
  "dates"
] as const;

/** Nuts / seeds — real components that make a bare ambiguous carb a described meal. */
const NUT_AND_SEED_TOKENS = [
  "nut",
  "nuts",
  "peanut",
  "peanuts",
  "almond",
  "almonds",
  "walnut",
  "walnuts",
  "pecan",
  "pecans",
  "cashew",
  "cashews",
  "seed",
  "seeds"
] as const;

/**
 * Small stoplist of articles, quantities, and vessels. A remainder made up
 * solely of these (after the ambiguous trigger is stripped) is a BARE input
 * that still needs clarifying; anything past it is a described meal.
 */
const AMBIGUITY_FILLER = new Set([
  "a",
  "an",
  "the",
  "some",
  "my",
  "of",
  "with",
  "and",
  "or",
  "for",
  "to",
  "in",
  "on",
  "just",
  "plus",
  "side",
  "order",
  "about",
  "roughly",
  "approximately",
  "serving",
  "servings",
  "cup",
  "cups",
  "glass",
  "glasses",
  "plate",
  "plates",
  "bowl",
  "bowls",
  "piece",
  "pieces",
  "bit",
  "half",
  "quarter"
]);

/** Strip every term of a category from a COPY of the text (word-boundary). */
function stripTerms(food: string, terms: readonly string[]): string {
  let text = food;
  for (const term of terms) {
    text = text.replace(termPattern(term, "giu"), " ");
  }
  return text;
}

/** Does a stripped remainder still carry a non-filler content word? */
function hasSubstantiveRemainder(remainder: string): boolean {
  return remainder
    .split(/[^\p{L}\p{N}]+/u)
    .some((token) => token.length > 0 && !AMBIGUITY_FILLER.has(token));
}

/**
 * Is the plain-vs-sweetened ambiguity already resolved by the input itself?
 * Evaluated on the remainder AFTER the ambiguous trigger is stripped, so a bare
 * "yogurt" (whose only content is the trigger) is NOT self-resolving.
 */
function plainOrSweetenedResolved(food: string): boolean {
  // A named diet/zero/unsweetened variant ("unsweetened yogurt", "sugar free")
  // — reuses the shared sugar-negation strip.
  if (stripSugarNegations(food) !== food) {
    return true;
  }

  const remainder = stripTerms(food, AMBIGUOUS_PLAIN_OR_SWEETENED);

  return (
    containsAny(remainder, PLAIN_MARKERS) ||
    containsAny(remainder, SWEETENING_RESOLVER_TOKENS) ||
    containsAny(remainder, PROTEIN_TOKENS) ||
    containsAny(remainder, NONSTARCHY_VEGETABLE_TOKENS) ||
    containsAny(remainder, NUT_AND_SEED_TOKENS) ||
    // Risk-raising evidence beats clarification: a named sugar around the
    // trigger routes to the carbs_only floor rather than "plain or sweetened?".
    isCarbsOnlyMeal(remainder)
  );
}

function isCarbsOnlyMeal(food: string): boolean {
  return (
    containsAnyLoose(riskMatchText(food), CARBS_ONLY_PATTERNS) &&
    !hasBufferContext(food)
  );
}

/**
 * Carb-FORWARD, as distinct from carbs-ONLY (2026-07-11 live-eval finding).
 *
 * A meal can be built on refined carbs and still carry protein — a salmon
 * avocado roll, a chicken sandwich with fries. `isCarbsOnlyMeal` deliberately
 * says no to those, because the buffer is real. But "not carbs-only" is not the
 * same as "unremarkable", and in the top A1C band (6.3–6.4) the difference
 * decides whether a conservatism floor fires at all.
 *
 * WHY THIS EXISTS — the defect it closes is worth stating plainly:
 *
 *   postprocess's upper-band floor triggers on
 *     band === "prediabetes_63_64" && (flags.has("borderline") || flags.has("carbs_only"))
 *   where `flags` is precheckFlags ∪ **the model's own policy_flags**.
 *
 *   For "salmon avocado roll" the precheck contributed NO flags, so the only
 *   possible source of "borderline" was the model itself. Which means: the
 *   safety floor whose entire job is to catch a model that wrongly answers SAFE
 *   required that same model to volunteer that it was unsure. A model confident
 *   enough to return SAFE does not flag itself borderline — so the floor was
 *   unreachable in precisely the case it was built for.
 *
 *   The live eval proved it: gpt-5.4-mini returned SAFE for a salmon avocado
 *   roll at A1C 6.4, nothing floored it, and it shipped as "Clear" — a
 *   harmful-SAFE, the one hard P0 gate. Every mock eval was green, because the
 *   mocks supply the borderline flag the real model does not.
 *
 * This detector gives the floor a trigger the model cannot veto. It is
 * word-boundary matched (so "roll" does not fire on "rolled oats") and its only
 * consequence is the SAFE→MODERATE floor in the top band — it can never raise a
 * verdict to HIGH, and it is inert in the lower bands.
 *
 * The VOCABULARY below is a dietary judgment and belongs to the RD panel
 * (W-05), not to engineering. It is deliberately conservative: at the top of the
 * prediabetes range, "Be careful" instead of "Clear" on a carb-forward plate is
 * the documented meaning of conservativeLevel "high".
 */
/**
 * Engineering candidate vocabulary for the N-30 upper-band safety floor.
 *
 * Version changes are review-significant. W-05 is not closed until an external
 * RDN/CDCES signs this exact version in the dietitian panel artifact.
 */
export const CARB_FORWARD_POLICY_VERSION = "2026-07-24.1";

export const CARB_FORWARD_TOKENS = [
  "sushi",
  "maki",
  "roll",
  "rolls",
  "sandwich",
  "sandwiches",
  "burger",
  "bun",
  "buns",
  "wrap",
  "wraps",
  "burrito",
  "taco",
  "tacos",
  "pizza",
  "fries",
  "chips",
  "crisps",
  "noodles",
  "ramen",
  "udon",
  "spaghetti",
  "lasagna",
  "bread",
  "toast",
  "baguette",
  "naan",
  "roti",
  "pita",
  "tortilla",
  "potato",
  "potatoes",
  "rice",
  "pasta",
  "bagel",
  "cereal",
  "croissant",
  "muffin",
  "waffle",
  "waffles",
  "pancake",
  "pancakes",
  "congee",
  "couscous",
  // 2026-07-16.1 — cultural/staple stage (doc 18 F-1/F-2: five of the seven
  // dangerous false reassurances were cultural dishes no token could see).
  // Every entry is the starch-forward base of a named dish from the 50-probe
  // ontology set or the handoff's staged list. Singulars only where the
  // mechanical plural in termPattern covers the plural. PENDING RD/CDCES
  // confirmation under W-05.
  "poke",
  "injera",
  "ugali",
  "fufu",
  "biryani",
  "pho",
  "bibimbap",
  "arroz",
  "nasi",
  "khao",
  "pancit",
  "bihon",
  "dosa",
  "idli",
  "pierogi",
  "tamale",
  "pupusa",
  "mochi",
  "tostada",
  "plov",
  "mansaf",
  "gnocchi",
  "chow mein",
  "tabbouleh",
  "bulgur",
  "plantain",
  "quinoa",
  "samosa",
  "pad thai",
  "banh mi",
  "gallo pinto",
  "raisin bran",
  // AUD-029 (stratum-underdesc-leftover-curry): same failure shape congee
  // closed — a dish customarily served over a starch base that no token saw,
  // so a model-SAFE shipped SAFE. Safe-direction: the borderline floor only
  // ever raises. PENDING RD/CDCES under W-05.
  "curry"
] as const;

/**
 * Low-carb impostors that contain a carb word but are not carb-forward.
 *
 * Applied longest-phrase-first semantics by ORDER: a phrase that should also
 * swallow a trailing token must appear before its shorter prefix.
 * "cauliflower crust pizza" is deliberately NOT a whole-phrase exclusion: the
 * two simulated panels disagreed (doc 18 grouped it with the SAFE-banded
 * impostors; the 2026-07-16 flash-lite panel unanimously banded it MODERATE —
 * commercial crusts carry starch binders), so the CAUTIOUS side wins until
 * the human panel rules: the crust words are stripped, the "pizza" token
 * survives, and a model-SAFE floors to MODERATE.
 * The bunless-burger idioms exist because negation
 * stripping alone cannot spare them: "no bun" removes the bun, but "burger"
 * is its own token, and a bunless burger is a patty (2026-07-16 panel F-2,
 * unanimous SAFE). Plurals are covered mechanically by termPattern.
 * PENDING RD/CDCES confirmation under W-05.
 */
export const CARB_FORWARD_EXCLUSIONS = [
  "cauliflower rice",
  "konjac rice",
  "shirataki noodles",
  "shirataki rice",
  "shirataki",
  "cauliflower crust",
  "lettuce wrap",
  "lettuce wraps",
  "sweet potato",
  "sweet potatoes",
  // 2026-07-16.1 — the F-2 false floor-positive family.
  "zucchini noodle",
  "zoodle",
  "almond flour pancake",
  "keto bread",
  "low carb tortilla",
  "low-carb tortilla",
  "egg wrap",
  "burger, no bun",
  "burger no bun",
  "burger without a bun",
  "burger without the bun",
  "burger without bun",
  "bunless burger",
  "protein style burger",
  "protein-style burger",
  "lettuce wrapped burger",
  "lettuce-wrapped burger"
] as const;

/**
 * Negation pre-pass (2026-07-16 panel F-2: "burger, no bun" was
 * negation-blind). A token the user explicitly negated must not fire the
 * carb-forward flag: "no bun" / "without rice" / "bun-free" are removed
 * before token matching. Only the negated word is dropped — "taco, no
 * lettuce" keeps its taco.
 */
const NEGATION_PATTERNS = [
  /\b(?:no|without|minus|hold the)\s+(?:the\s+|a\s+|any\s+)?[\p{L}]+/giu,
  /\b[\p{L}]+[- ]free\b/giu
];

export function isCarbForward(food: string): boolean {
  let text = food;
  for (const phrase of CARB_FORWARD_EXCLUSIONS) {
    text = text.replace(termPattern(phrase, "gu"), " ");
  }
  for (const pattern of NEGATION_PATTERNS) {
    text = text.replace(pattern, " ");
  }

  return containsAny(text, CARB_FORWARD_TOKENS);
}

/**
 * Compound foods that CONTAIN a buffer token but are not buffered foods
 * (N-17). This is the other half of the word-boundary fix, and the half that
 * boundaries alone cannot solve: "jelly beans" contains the whole word "beans",
 * and "protein bar" the whole word "protein", so both satisfy the protein
 * buffer under any boundary rule — and satisfying the buffer SUPPRESSES the
 * carbs-only floor. Sugar was disabling a safety floor by claiming to be a
 * legume.
 *
 * These phrases are removed from the text before the buffer test runs, so the
 * confection can no longer vouch for itself.
 */
const BUFFER_EXCLUSIONS = [
  "jelly bean",
  "jelly beans",
  "jellybean",
  "jellybeans",
  "protein bar",
  "protein bars",
  "protein shake",
  "protein shakes",
  "protein cookie",
  "protein cookies",
  "protein ball",
  "protein balls",
  "egg roll",
  "egg rolls",
  "egg tart",
  "egg tarts",
  "candy bean",
  "vanilla bean",
  "vanilla beans",
  "coffee bean",
  "coffee beans",
  "cocoa bean",
  "cocoa beans",
  "pepper jelly",
  "candied pepper"
] as const;

function hasBufferContext(food: string): boolean {
  let text = food;
  for (const phrase of BUFFER_EXCLUSIONS) {
    text = text.replace(termPattern(phrase, "gu"), " ");
  }

  return (
    containsAny(text, PROTEIN_TOKENS) ||
    containsAny(text, NONSTARCHY_VEGETABLE_TOKENS)
  );
}

/**
 * Word-boundary term matching (N-17 / W-21).
 *
 * Used for the BUFFER lists only, and the asymmetry is the whole point.
 *
 * The two kinds of list in this file err in opposite directions:
 *
 *  - CARBS_ONLY / HIGH_RISK are risk-RAISING. An over-match only ever floors a
 *    verdict upward, so loose substring matching there is safe-erring — and it
 *    is what makes "cookies", "cupcake" and "brownies" match at all. Tightening
 *    those to word boundaries would silently DROP every plural from the safety
 *    floors, which is a regression dressed up as a fix.
 *
 *  - PROTEIN / NONSTARCHY_VEGETABLE are risk-SUPPRESSING: matching one disables
 *    the carbs-only floor. Here an over-match is the hazard, so these are
 *    anchored — "eggnog" no longer reads as "egg".
 *
 * Boundaries alone do not finish the job (a whole-word "beans" still hides
 * inside "jelly beans"), which is what BUFFER_EXCLUSIONS above handles.
 */
const BOUNDARY_CACHE = new Map<string, RegExp>();

function termPattern(term: string, flags = "iu"): RegExp {
  const key = `${flags}:${term}`;
  let pattern = BOUNDARY_CACHE.get(key);

  if (!pattern) {
    const escaped = term
      .trim()
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      .replace(/\s+/g, "\\s+");
    // Mechanical plural: every boundary-matched term also matches its trailing
    // s/es form ("roti" → "rotis", "tamale" → "tamales"). G7 and the
    // 2026-07-16 panel's `rotis` escape both came from hand-listing plurals
    // and missing a sibling — so plurals are now generated, not listed. This
    // widens carb tokens AND buffer/exclusion lists symmetrically; a plural of
    // a real protein is still a real protein.
    pattern = new RegExp(
      `(?<![\\p{L}\\p{N}])${escaped}(?:e?s)?(?![\\p{L}\\p{N}])`,
      flags
    );
    BOUNDARY_CACHE.set(key, pattern);
  }

  return pattern;
}

/** Word-boundary matching — for the risk-suppressing buffer lists. */
function containsAny(food: string, terms: readonly string[]): boolean {
  return terms.some((term) => termPattern(term).test(food));
}

/** Substring matching — for the risk-raising lists, where over-matching is safe. */
function containsAnyLoose(food: string, terms: readonly string[]): boolean {
  return terms.some((term) => food.includes(term));
}
