import type { A1CRoute } from "./a1c";
import {
  buildBorderlineFloorResponse,
  buildCarbsOnlyResponse,
  buildHighFloorNoSugarResponse,
  groundedFallbackReason
} from "./fallback";
import { stripSugarNegations } from "./input-precheck";
import { PalUserResultSchema } from "./schemas";
import type {
  PalModelOutput,
  PalPolicyFlag,
  PalRisk,
  PalUserResponse
} from "./schemas";
import type { SafetyContract } from "./safety-contract";

type ResultDraft = {
  risk: PalRisk;
  reason: string;
  adjustment: string | null;
  swap: string | null;
};

/** The conservative floor that fired, if any (Task 13 snapshot metadata). */
export type FloorKind = "high_risk" | "carbs_only" | "borderline";

/**
 * Safety-floor / fallback metadata for the immutable snapshot (Task 13, §P3.1).
 *
 * A pure OUT-param: postprocess mutates a caller-supplied sink instead of
 * changing its return type, so every existing caller (evals, pantry, the many
 * pinned postprocess tests) is byte-for-byte unaffected. `floorApplied` names
 * the conservative floor that replaced the model draft; `usedFallback` is true
 * whenever such a template stood in for the model's own card. Reflects the card
 * the user actually saw — never a reason it could not know.
 */
export type SnapshotMetadata = {
  floorApplied: FloorKind | null;
  usedFallback: boolean;
};

export type PostprocessContext = {
  contract: SafetyContract;
  route: A1CRoute;
  precheckFlags: PalPolicyFlag[];
  /** The food the user described — for the component-mention rule (W-17). */
  food?: string;
  /**
   * Optional snapshot sink (Task 13). When present, postprocess records which
   * conservative floor fired (if any) so the check route can persist it. Absent
   * for every non-persisting caller, which keeps their behavior identical.
   */
  snapshot?: SnapshotMetadata;
};

/** Words too common to count as "naming a component of the meal". */
const COMPONENT_STOPWORDS = new Set([
  "with",
  "and",
  "the",
  "a",
  "an",
  "of",
  "or",
  "some",
  "my",
  "from",
  "for",
  "plain",
  "large",
  "small",
  "fresh",
  "hot",
  "cold",
  "meal",
  "food",
  "lunch",
  "dinner",
  "breakfast",
  "snack"
]);

/**
 * W-17 Tier 2.1 — does the advice name something the user actually typed?
 *
 * SHIPPED OFF BY DEFAULT (`PAL_ENFORCE_COMPONENT_MENTION=1` to enable), and
 * that is a deliberate call, not timidity.
 *
 * This rule is fail-closed: a violation becomes a retry card. Turning it on
 * without first measuring its false-positive rate would degrade real users to
 * retry cards at an unknown rate — which is precisely the shape of the mistake
 * F-21 made (ship a model-behaviour change whose own evidence said "not yet").
 * The prompt instruction ships enabled and does the work; this assertion is the
 * enforcement.
 *
 * UNBLOCK CONDITION (read this before flipping the flag). The original note here
 * said it turns on "when W-07's live run has measured the retry-rate delta" —
 * and W-07's live run was WAIVED by the owner on 2026-07-12. As written, that
 * made this flag unflippable forever: a gate whose key was thrown away. The
 * condition is therefore restated in terms of something that can actually
 * happen: enable it when ANY run against a real model measures the retry-rate
 * delta at ≤2pts on the eval corpus. A green MOCK run does not qualify and never
 * will — the fixtures author the very adjustments this rule grades, which is
 * exactly how N-30 stayed hidden. Until then it stays off, and the pure function
 * below is unit-tested regardless (tests/unit/pal/postprocess.test.ts).
 */
export function mentionsMealComponent(food: string, advice: string): boolean {
  const tokens = food
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((token) => token.length > 2 && !COMPONENT_STOPWORDS.has(token));

  if (tokens.length === 0) {
    return true; // Nothing nameable — do not punish the model for it.
  }

  const lowered = advice.toLowerCase();
  return tokens.some((token) => {
    // Match the stem so "rice" hits "rice", and "potatoes" hits "potato".
    const stem = token.replace(/(?:es|s)$/, "");
    return lowered.includes(stem.length > 2 ? stem : token);
  });
}

function componentMentionEnforced(): boolean {
  return process.env.PAL_ENFORCE_COMPONENT_MENTION === "1";
}

export class PalContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PalContractError";
  }
}

/**
 * Instruction/prompt leakage. Kept here (not in eval-rubric) because it must
 * run in PRODUCTION, not only in the eval harness — the eval-only copy was
 * half of finding N-01.
 */
const LEAK_PATTERN =
  /\b(system prompt|you are prediabetes pal|allowed response kinds|policy[_ ]flags|json[_ ]schema|instructions:)\b/i;

/**
 * Compiled banned-output patterns, cached per contract (the regex strings live
 * as JSON in tests/fixtures/safety-contract.json and never change at runtime).
 */
const BANNED_PATTERN_CACHE = new WeakMap<SafetyContract, RegExp[]>();

function bannedOutputPatterns(contract: SafetyContract): RegExp[] {
  const cached = BANNED_PATTERN_CACHE.get(contract);
  if (cached) {
    return cached;
  }

  const { fixture } = contract;
  const patterns = [
    ...fixture.forbiddenClaims.map((entry) => new RegExp(entry.pattern, "i")),
    ...fixture.forbiddenPredictions.map(
      (entry) => new RegExp(entry.pattern, "i")
    ),
    ...fixture.qualitativeOnly.forbiddenPatterns.map(
      (entry) => new RegExp(entry.pattern, "i")
    ),
    LEAK_PATTERN
  ];

  BANNED_PATTERN_CACHE.set(contract, patterns);
  return patterns;
}

/**
 * The safety contract, actually enforced (N-01 / W-06).
 *
 * The contract has always defined regexes for banned claims ("cure",
 * "reverses"), banned predictions ("your A1C will drop to…"), and
 * quantitative claims ("spikes your glucose by 32 mg/dL"). They ran in the eval
 * harness. They never ran on a real model response — production injected only
 * the *labels* of these patterns into the prompt and then trusted the model to
 * obey. So the single control that was supposed to make a banned claim
 * structurally unable to reach a user was, in production, an instruction and a
 * hope.
 *
 * Fail-closed: a violation throws, which the service catches and turns into the
 * calm retry card. A retry card cannot carry a verdict, so the worst case of a
 * false positive is a user asked to rephrase — never a wrong answer shown.
 */
export function assertNoForbiddenClaims(
  contract: SafetyContract,
  fields: Array<string | null | undefined>
): void {
  const patterns = bannedOutputPatterns(contract);

  for (const text of fields) {
    if (!text) {
      continue;
    }

    for (const pattern of patterns) {
      if (pattern.test(text)) {
        throw new PalContractError(
          `Model output matched a banned pattern (${pattern.source}).`
        );
      }
    }
  }
}

export function postprocessModelOutput(
  modelOutput: PalModelOutput,
  context: PostprocessContext
): Extract<PalUserResponse, { kind: "result" }> {
  if (context.route.kind !== "in_scope") {
    throw new PalContractError(
      "Result post-processing only accepts in-scope A1C routes."
    );
  }

  if (modelOutput.risk === null || modelOutput.reason === null) {
    throw new PalContractError(
      "Result outputs must include a risk and reason."
    );
  }

  const mergedFlags = new Set<PalPolicyFlag>([
    ...context.precheckFlags,
    ...modelOutput.policy_flags
  ]);

  // Local floor sink: the caller's snapshot sink is OPTIONAL, but the
  // component-mention exemption below must know deterministically whether a
  // floor replaced the draft — for every caller, sink or not (HS-3). Always
  // pass our own sink and mirror it into the caller's afterwards.
  const floorSink: SnapshotMetadata = { floorApplied: null, usedFallback: false };

  const result = applyConservativeFloors(
    {
      risk: modelOutput.risk,
      reason: modelOutput.reason,
      adjustment: modelOutput.adjustment,
      swap: modelOutput.swap
    },
    {
      ...context,
      precheckFlags: [...mergedFlags],
      snapshot: floorSink
    }
  );

  if (context.snapshot && floorSink.usedFallback) {
    context.snapshot.floorApplied = floorSink.floorApplied;
    context.snapshot.usedFallback = true;
  }

  // Grounded-reason check — model-authored reasons only. A floored draft
  // already replaced the reason with template copy (a floor always rewrites
  // the reason), and SAFE reasons are permission-first by contract.
  if (
    result.reason === modelOutput.reason &&
    result.risk !== "SAFE" &&
    context.food
  ) {
    result.reason = groundReason(context.food, result.risk, result.reason);
  }

  assertOneSentence("reason", result.reason);

  // HIGH results are swap-led: the adjustment slot is suppressed AFTER the
  // floors resolve the final risk. The 2026-07-16 dietitian panel was
  // unanimous on the failure mode (docs/qa/17-simulated-dietitian-panel):
  // "pair the soda with nuts" reads as permission to keep the exact item the
  // "Hold off" label exists to discourage. Deterministic here, not prompted —
  // a model cannot reintroduce it.
  if (result.risk === "HIGH") {
    result.adjustment = null;
  }

  // Runs on the FLOORED draft, i.e. the exact strings the user would read —
  // not on the raw model output, so a floor cannot reintroduce banned text.
  assertNoForbiddenClaims(context.contract, [
    result.reason,
    result.adjustment,
    result.swap
  ]);

  if (result.risk === "SAFE") {
    assertNoUnsafeSafeFields(result);
  } else {
    assertModerateHighFields(result, mergedFlags);

    // HS-3 exemption: floored drafts are pre-audited template copy and may
    // legitimately not name a user token — enforcement targets MODEL-authored
    // adjustments only. Keyed off the local floor sink (deterministic for
    // every caller), never the optional context.snapshot.
    if (
      componentMentionEnforced() &&
      !floorSink.usedFallback &&
      context.food &&
      result.adjustment &&
      !mentionsMealComponent(context.food, result.adjustment)
    ) {
      throw new PalContractError(
        "Adjustment must name a component of the described meal."
      );
    }
  }

  return PalUserResultSchema.parse({
    kind: "result",
    risk: result.risk,
    reason: result.reason,
    adjustment: result.adjustment,
    swap: result.swap,
    disclaimer: context.contract.copy.disclaimer
  });
}

export function assertOneSentence(field: string, value: string): void {
  const normalized = value.trim();
  const sentenceEndings = normalized.match(/[.!?](?=\s|$)/g) ?? [];

  if (normalized.length === 0 || sentenceEndings.length > 1) {
    throw new PalContractError(
      `${field} must be exactly one plain-English sentence.`
    );
  }
}

export function assertNoUnsafeSafeFields(result: ResultDraft): void {
  if (result.risk !== "SAFE") {
    return;
  }

  if (!isPermissionFirstReason(result.reason)) {
    throw new PalContractError(
      "SAFE results must lead with permission-first reassurance."
    );
  }

  if (result.adjustment !== null || result.swap !== null) {
    throw new PalContractError(
      "SAFE results cannot include an adjustment or swap."
    );
  }
}

export function assertModerateHighFields(
  result: ResultDraft,
  flags: ReadonlySet<PalPolicyFlag>
): void {
  if (result.risk === "SAFE") {
    return;
  }

  if (result.swap === null) {
    throw new PalContractError(
      "MODERATE and HIGH results require a lower-glycemic swap."
    );
  }

  // HIGH is swap-led by contract: an adjustment on a "Hold off" item tells the
  // user how to keep it (2026-07-16 panel, unanimous). MODERATE keeps both.
  if (result.risk === "HIGH") {
    if (result.adjustment !== null) {
      throw new PalContractError(
        "HIGH results must not carry an adjustment — swap only."
      );
    }
  } else {
    if (result.adjustment === null) {
      throw new PalContractError(
        "MODERATE results require one adjustment and one swap."
      );
    }
    assertOneSentence("adjustment", result.adjustment);

    if (
      flags.has("carbs_only") &&
      !hasCarbsOnlyCompanionGuidance(result.adjustment)
    ) {
      throw new PalContractError(
        "Carbs-only adjustments must add protein or nonstarchy vegetables."
      );
    }
  }

  assertOneSentence("swap", result.swap);

  if (!looksLikeSwap(result.swap)) {
    throw new PalContractError(
      "MODERATE and HIGH results require a lower-glycemic swap."
    );
  }
}

export function applyConservativeFloors(
  result: ResultDraft,
  context: PostprocessContext
): ResultDraft {
  const flags = new Set(context.precheckFlags);
  const highRisk = flags.has("high_risk");
  // 2026-07-16 (owner-ordered, doc 18 F-1): the carb-forward SAFE→MODERATE
  // floor now covers the FULL prediabetes range, not only 6.3–6.4.
  // `d-congee-chicken` proved token coverage alone does not protect the bands
  // below the old limit: "congee" was a token, the dish shipped SAFE at 6.2,
  // and the panel banded it HIGH. The A1C band rubric already said borderline
  // foods "should move to MODERATE rather than use reassuring SAFE copy" at
  // every in-scope band — the code was narrower than the policy. The
  // carbs_only case is handled unconditionally in its own block above this
  // check, so only the `borderline` flag matters here. PENDING RD (W-05).
  const borderlineCarbForward =
    context.route.kind === "in_scope" && flags.has("borderline");

  if (
    highRisk &&
    (result.risk !== "HIGH" ||
      result.adjustment === null ||
      result.swap === null)
  ) {
    return recordFloor(context.snapshot, "high_risk", () =>
      buildFloorDraft(context.contract, "HIGH", context.food)
    );
  }

  if (flags.has("carbs_only")) {
    if (
      result.risk === "SAFE" ||
      !hasCarbsOnlyCompanionGuidance(result.adjustment) ||
      result.swap === null ||
      !looksLikeSwap(result.swap)
    ) {
      // Preserve model severity when swapping in the template: a floor must
      // never LOWER a verdict, and before 2026-07-16 a model-HIGH with a
      // non-compliant adjustment was replaced by the MODERATE draft — the
      // under-banding direction doc 18's portion findings warned about.
      return recordFloor(context.snapshot, "carbs_only", () =>
        buildFloorDraft(
          context.contract,
          highRisk || result.risk === "HIGH" ? "HIGH" : "MODERATE",
          context.food
        )
      );
    }
  }

  if (borderlineCarbForward && result.risk === "SAFE") {
    return recordFloor(context.snapshot, "borderline", () =>
      buildBorderlineFloorDraft(context.contract)
    );
  }

  return result;
}

/**
 * Stamp the snapshot sink (if the caller supplied one) with the floor that
 * fired, then build the floored draft. A pure passthrough when no sink is
 * present, so non-persisting callers are unaffected.
 */
function recordFloor(
  sink: SnapshotMetadata | undefined,
  floor: FloorKind,
  build: () => ResultDraft
): ResultDraft {
  if (sink) {
    sink.floorApplied = floor;
    sink.usedFallback = true;
  }
  return build();
}

function buildFloorDraft(
  contract: SafetyContract,
  risk: "MODERATE" | "HIGH",
  food?: string
): ResultDraft {
  // The HIGH template claims "mostly sugary" and swaps toward "less sweet".
  // When the floor was triggered by a model risk flag on a food that names no
  // sugar (injera with doro wat; a pantry box of corn, bread, and peanut
  // butter), that copy is a fabricated driver — the flash-lite panel's only
  // two shaming flags. Same severity, composition-free copy instead.
  const floored =
    risk === "HIGH" && food && !hasSugarEvidence(food)
      ? buildHighFloorNoSugarResponse(contract)
      : buildCarbsOnlyResponse(contract, risk);

  if (floored.kind !== "result") {
    throw new PalContractError("Expected a result fallback for floors.");
  }

  return {
    risk: floored.risk,
    reason: floored.reason,
    adjustment: floored.adjustment,
    swap: floored.swap
  };
}

function buildBorderlineFloorDraft(contract: SafetyContract): ResultDraft {
  const floored = buildBorderlineFloorResponse(contract);

  if (floored.kind !== "result") {
    throw new PalContractError("Expected a result fallback for floors.");
  }

  return {
    risk: floored.risk,
    reason: floored.reason,
    adjustment: floored.adjustment,
    swap: floored.swap
  };
}

/**
 * Grounded-reason check (2026-07-16 panel F-5 / work item 17h).
 *
 * The rehearsal found the model back-fills verdicts with invented composition
 * — "mac and cheese" was called "sugary carbs", "sugar-free cookies" "mostly
 * sugary". Floored drafts already carry template copy, so this guards only
 * MODEL-AUTHORED reasons, and only for the observed fabrication family:
 * a sugar claim about a food that names no sugar. The refined-carb family is
 * handled prompt-side only — enforcing it in code would false-flag correct
 * reasons on carby foods the ontology cannot see (granola, pad thai), which
 * is the same blind spot the floors have. The named-variant strip means
 * "sugar-free cookies" cannot vouch for a "sugary" claim.
 *
 * Replacement, not rejection: a wrong DRIVER with a right BAND is a copy
 * defect, not a safety defect, so the user gets a composition-free reason
 * consistent with the verdict instead of a retry card.
 */
const SUGARY_CLAIM_PATTERN =
  /\bsugary\b|\bmostly sugar\b|\bhigh in sugar\b|\bloaded with sugar\b|\bfull of sugar\b|\bsugar[- ](?:heavy|laden|rich)\b/i;
const SUGAR_EVIDENCE_PATTERN =
  /sugar|sweet|honey|syrup|agave|nectar|dessert|candy|chocolate|cocoa|cake|cookie|donut|doughnut|pastr|croissant|cinnamon roll|cinnamon bun|ice cream|milkshake|frappuccino|mocha|soda|pop\b|cola|coke|sprite|pepsi|fanta|juice|boba|horchata|gatorade|powerade|lemonade|punch|jelly|jam|caramel|toffee|frosting|glaze|icing|mochi|raisin|dried fruit|date|fig|fruit|banana|mango|berr|grape|apple|orange|pineapple|melon|smoothie|pie\b|pudding|muffin|brownie|oreo|energy drink|sports drink|slush|sorbet|gelato|custard|marshmallow|nutella|churro|baklava|halva|eggnog|granola|cereal|yogurt/i;

export function hasSugarEvidence(food: string): boolean {
  return SUGAR_EVIDENCE_PATTERN.test(stripSugarNegations(food.toLowerCase()));
}

export function groundReason(
  food: string,
  risk: "MODERATE" | "HIGH",
  reason: string
): string {
  if (
    SUGARY_CLAIM_PATTERN.test(reason) &&
    !SUGAR_EVIDENCE_PATTERN.test(stripSugarNegations(food.toLowerCase()))
  ) {
    return groundedFallbackReason(risk);
  }

  return reason;
}

function isPermissionFirstReason(reason: string): boolean {
  return /^(this looks|this seems|this is|you can|you likely)/i.test(
    reason.trim()
  );
}

const CARBS_ONLY_COMPANION_TARGET =
  "(?:protein|non[- ]starchy vegetables?|eggs?|egg whites?|greek yogurt|yogurt|cottage cheese|chicken|turkey|tuna|salmon|fish|tofu|tempeh|beans?|lentils?|nuts?|seeds?|side salad|salad|spinach|broccoli|greens)";
const CARBS_ONLY_EXPLICIT_ADD_OR_PAIR_PATTERN = new RegExp(
  String.raw`\b(?:add|pair|include|combine|top)\b[^.?!\n]{0,80}\b${CARBS_ONLY_COMPANION_TARGET}\b`,
  "i"
);
const CARBS_ONLY_WITH_COMPANION_PATTERN = new RegExp(
  String.raw`\b(?:with|alongside)\b[^.?!\n]{0,40}\b${CARBS_ONLY_COMPANION_TARGET}\b`,
  "i"
);
const CARBS_ONLY_SEQUENCING_ONLY_PATTERN =
  /\bvegetables?\s+first\b|\beat\s+(?:the\s+)?vegetables?\s+first\b|\bstart\s+with\s+(?:vegetables?|fiber)\b|\bbegin\s+with\s+(?:vegetables?|fiber)\b|\bbefore\s+the\s+carbs\b/i;

function looksLikeSwap(value: string): boolean {
  // Doc 19 step E.2: the rotating retry cards in every live gate run were this
  // check rejecting legitimate swaps phrased outside the original keyword list.
  // Two shapes caught live: substitutions without the exact keywords ("pick a
  // sugar-free or zero-sugar version instead" — bare "instead", verb "pick"),
  // and portion-reduction swaps the prompt itself mandates for label-math
  // quantities ("keep to one serving and add Greek yogurt"). Every phrase here
  // still names a substitution, a lower-glycemic variant, or a reduced
  // portion; a non-swap ("you can keep enjoying this") matches nothing.
  return /\bswap\b|\binstead\b|\brather than\b|\bin place of\b|\breplac(?:e|ing)\b|\bchoose\b|\bpick\b|\bopt for\b|\bswitch(?:ing)? to\b|\bless refined\b|\bless sweet\b|\bwhole[- ]grain\b|\bbrown rice\b|\bbeans?\b|\blentil|\bsugar[- ]free\b|\bzero[- ]sugar\b|\blow(?:er)?[- ]carb\b|\bkeep (?:it |this )?to\b|\blimit (?:it |this )?to\b|\b(?:one|a single|half a?|a smaller) (?:serving|portion|slice|piece|scoop|bowl|cup)\b|\bsmaller (?:serving|portion|amount)\b/i.test(
    value
  );
}

function hasCarbsOnlyCompanionGuidance(value: string | null): boolean {
  if (value === null) {
    return false;
  }

  if (CARBS_ONLY_EXPLICIT_ADD_OR_PAIR_PATTERN.test(value)) {
    return true;
  }

  return (
    CARBS_ONLY_WITH_COMPANION_PATTERN.test(value) &&
    !CARBS_ONLY_SEQUENCING_ONLY_PATTERN.test(value)
  );
}
