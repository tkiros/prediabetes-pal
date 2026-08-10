/**
 * Promise registry — the single typed source for every meal example Prediabetes Pal
 * PROMOTES (Plan §P1.1, K1, journey 1).
 *
 * A promoted example is one a prospect meets before they ever run a check: the
 * landing-page phone mockup, the on-page live-example card, and the onboarding
 * first-check chips. Historically each of those hardcoded its own fixture, and
 * the landing demo hardcoded a FALSE one — it showed "oatmeal" getting an
 * immediate cautious card, when the real product asks "plain or sweetened?"
 * first (`AMBIGUOUS_PLAIN_OR_SWEETENED` in `input-precheck.ts`). That is the
 * "manufactured screenshot" K1 forbids.
 *
 * This registry stores, per example: the input, the route KIND the
 * deterministic precheck must take, the exact clarify question (for a two-step
 * flow), the approved copy INTENT (what the card may convey — never exact
 * generative wording), the evidence owner, and the last live-capture time. Every
 * promoted surface reads from here, and `promise-registry.test.ts` re-runs the
 * real precheck over these inputs so a promoted example that quietly changes
 * route turns the suite red and blocks the deploy.
 *
 * WHAT THIS IS NOT: it does not assert the model's wording, and it is not a
 * marketing claim. The card copy on each surface stays a static illustration;
 * the registry guards the route SHAPE (clarify vs result) and the clarify
 * question — the honest promise, not the prose.
 */

/** Surfaces a promoted example can appear on. */
export type PromiseSurface = "landing" | "demo-card" | "onboarding";

/**
 * The route KIND, in promise vocabulary. `clarify` = Prediabetes Pal asks one question
 * before answering; `result` = the input reaches the model-eligible path (the
 * precheck returns `ok` or `carbs_only`) and the model writes the card.
 */
export type PromiseRoute = "clarify" | "result";

export interface PromiseExample {
  /** Exact promoted text the user enters first. */
  input: string;
  /** Route KIND the deterministic precheck must return for `input`. */
  expectedRoute: PromiseRoute;
  /**
   * For a `clarify` step: the exact question the precheck asks. MUST equal the
   * live `classifyInputBeforeModel(input).question` — the fixture test pins the
   * two together, so this doubles as the string the demo renders.
   */
  expectedClarifyQuestion?: string;
  /**
   * The user's clarification answer for a two-step flow (e.g. "plain oatmeal").
   * Classified as a `result` step. Absent for single-step examples.
   */
  followUp?: string;
  /**
   * Short statement of the APPROVED copy intent — what the resulting card is
   * allowed to convey. Not the exact wording; the direction the illustration
   * and the model must stay within.
   */
  approvedMeaning: string;
  /** Team accountable for the evidence behind the promise. */
  evidenceOwner: string;
  /**
   * ISO date of the last live capture proving the promise still holds, or
   * `null` until a live capture exists. Never fabricate a timestamp.
   */
  lastLiveCaptureAt: string | null;
  /** Where this example is promoted. */
  surfaces: PromiseSurface[];
}

// Oatmeal — the honest two-step interaction (K1 / oatmeal decision). Typing
// "oatmeal" is genuinely ambiguous, so the precheck asks one question before
// answering. The demo shows that sequence instead of manufacturing an immediate
// card. "plain oatmeal" then reaches the model path as an ordinary result.
const OATMEAL: PromiseExample = {
  input: "oatmeal",
  expectedRoute: "clarify",
  expectedClarifyQuestion: "Is this plain or sweetened?",
  followUp: "plain oatmeal",
  approvedMeaning:
    "Plain oatmeal on its own leans carb-heavy with little protein or nonstarchy-vegetable balance — a MODERATE (\"Be careful\") read with an add-protein adjustment and a steadier-oats swap. Not a prediction of the reader's own glucose response.",
  evidenceOwner: "product",
  lastLiveCaptureAt: null,
  surfaces: ["landing", "demo-card", "onboarding"]
};

// Banana — a single, whole food the precheck sends straight to the model. No
// named sugar and no carb-forward token, so it routes as an ordinary result.
const BANANA: PromiseExample = {
  input: "banana",
  expectedRoute: "result",
  approvedMeaning:
    "A whole fruit the model grades on its own merits — a common \"surprising\" first check. No deterministic floor; the model writes the band and reason.",
  evidenceOwner: "product",
  lastLiveCaptureAt: null,
  surfaces: ["onboarding"]
};

// Orange juice — a named sugary drink. The precheck floors it deterministically
// (carbs_only + high_risk), so it reaches the model path already flagged. Still
// a `result` promise: the model writes the card, the floor bounds it.
const ORANGE_JUICE: PromiseExample = {
  input: "orange juice",
  expectedRoute: "result",
  approvedMeaning:
    "A named sugary drink that carries a deterministic carbs-only / high-risk floor into the result — the model may not grade it Clear. Cautious band with a lower-sugar direction.",
  evidenceOwner: "product",
  lastLiveCaptureAt: null,
  surfaces: ["onboarding"]
};

/**
 * The promoted set, in the order surfaces should render it. Onboarding's
 * first-check classics are exactly these three; the landing demo uses oatmeal.
 * Keep this equal to what is ACTUALLY promoted today — adding an entry here
 * promises it, and the fixture test will demand the route hold.
 */
export const PROMISE_REGISTRY: readonly PromiseExample[] = [
  OATMEAL,
  BANANA,
  ORANGE_JUICE
];

/** The oatmeal two-step flow — imported by the landing + demo-card surfaces. */
export const OATMEAL_EXAMPLE = OATMEAL;

/** The promoted inputs for a surface, in registry order. */
export function promotedInputsFor(surface: PromiseSurface): string[] {
  return PROMISE_REGISTRY.filter((entry) =>
    entry.surfaces.includes(surface)
  ).map((entry) => entry.input);
}
