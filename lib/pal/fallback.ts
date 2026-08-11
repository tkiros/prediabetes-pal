import { BELOW_RANGE_MESSAGE, HIGH_RANGE_MESSAGE } from "./boundary-copy";
import type { ClinicalRoute } from "./clinical-risk";
import {
  PalUserClarifySchema,
  PalUserClinicalSchema,
  PalUserNotFoodSchema,
  PalUserOutOfScopeSchema,
  PalUserResultSchema,
  PalUserRetrySchema
} from "./schemas";
import type { PalUserResponse } from "./schemas";
import type { SafetyContract } from "./safety-contract";

const INVALID_REQUEST_MESSAGE =
  "Enter a food or meal description and a numeric A1C value to get a Prediabetes Pal check.";
const RETRY_MESSAGE =
  "I couldn't produce a safe answer this time. Please try again with a simpler food description.";
const CARBS_ONLY_MODERATE_REASON =
  "This may have a higher blood-sugar impact because it leans heavily on refined carbs.";
const CARBS_ONLY_MODERATE_ADJUSTMENT =
  "If practical, add protein or nonstarchy vegetables to make it easier to handle.";
const CARBS_ONLY_MODERATE_SWAP =
  "If you have the option, swap to a less refined version.";
const CARBS_ONLY_HIGH_REASON =
  "This is likely a higher-impact choice because it is mostly sugary or refined carbs.";
const CARBS_ONLY_HIGH_ADJUSTMENT =
  "A smaller portion with protein or nonstarchy vegetables would be a steadier fit here.";
const CARBS_ONLY_HIGH_SWAP =
  "If you have the option, swap to a less sweet or less refined version.";

/**
 * The carb-forward (borderline) SAFE→MODERATE floor's own copy (2026-07-16
 * panel F-2). The floor used to reuse the carbs-only copy above, which claims
 * the meal "leans heavily on refined carbs" — reviewers flagged that as the
 * dangerous part when the dish was buffered (ugali with tilapia) or the flag
 * was conservative. This copy names only what the floor actually knows: a
 * carb-heavy base is present (true by construction of CARB_FORWARD_TOKENS —
 * every token is a starch dish, never a drink), and the caution is
 * range-driven. Ledger rows: result-borderline-floor-*.
 */
const BORDERLINE_FLOOR_REASON =
  "This leans on a carb-heavy base, which can have a higher blood-sugar impact in your range even with protein or vegetables alongside.";
const BORDERLINE_FLOOR_ADJUSTMENT =
  "If practical, keep the protein and vegetables and go lighter on the starchy part.";
const BORDERLINE_FLOOR_SWAP =
  "If you have the option, choose a smaller portion or a whole-grain version of the starchy base.";

/**
 * Grounded-reason fallbacks (2026-07-16 panel F-5). When a model-authored
 * reason claims a glycemic driver the named food cannot support ("mac and
 * cheese" → "sugary carbs"), postprocess swaps in a reason that asserts no
 * composition at all. Band-consistent, claim-free, one sentence. Ledger rows:
 * result-ungrounded-reason-*.
 */
const UNGROUNDED_MODERATE_REASON =
  "This looks like it can have a higher blood-sugar impact than a balanced meal, so some extra care fits here.";
const UNGROUNDED_HIGH_REASON =
  "This is likely a higher-impact choice for this range in its current form.";

export function groundedFallbackReason(risk: "MODERATE" | "HIGH"): string {
  return risk === "HIGH" ? UNGROUNDED_HIGH_REASON : UNGROUNDED_MODERATE_REASON;
}

/**
 * HIGH floor draft for foods with NO named sugar (2026-07-16 re-run finding).
 * The standard HIGH draft says "mostly sugary or refined carbs" and swaps to
 * "a less sweet or less refined version" — stamped onto injera with doro wat
 * and a food-pantry box, the flash-lite panel read it as fabricated and
 * tone-deaf (its only two shaming-majority flags). This variant reuses two
 * already-governed strings: the grounded HIGH reason and the less-refined-only
 * swap the MODERATE draft ships.
 */
export function buildHighFloorNoSugarResponse(
  contract: SafetyContract
): PalUserResponse {
  return PalUserResultSchema.parse({
    kind: "result",
    risk: "HIGH",
    reason: UNGROUNDED_HIGH_REASON,
    adjustment: CARBS_ONLY_HIGH_ADJUSTMENT,
    swap: CARBS_ONLY_MODERATE_SWAP,
    disclaimer: contract.copy.disclaimer
  });
}

export function buildBorderlineFloorResponse(
  contract: SafetyContract
): PalUserResponse {
  return PalUserResultSchema.parse({
    kind: "result",
    risk: "MODERATE",
    reason: BORDERLINE_FLOOR_REASON,
    adjustment: BORDERLINE_FLOOR_ADJUSTMENT,
    swap: BORDERLINE_FLOOR_SWAP,
    disclaimer: contract.copy.disclaimer
  });
}

export function buildInvalidRequestResponse(
  contract: SafetyContract
): PalUserResponse {
  return PalUserRetrySchema.parse({
    kind: "retry",
    message: INVALID_REQUEST_MESSAGE,
    disclaimer: contract.copy.disclaimer
  });
}

export function buildRetryResponse(
  contract: SafetyContract
): PalUserResponse {
  return PalUserRetrySchema.parse({
    kind: "retry",
    message: RETRY_MESSAGE,
    disclaimer: contract.copy.disclaimer
  });
}

/**
 * The clinical route (W-01). Every word comes from the approved copy ledger —
 * no model is consulted, so there is nothing here to hallucinate, and the
 * response is identical every time for a given route.
 */
export function buildClinicalResponse(
  contract: SafetyContract,
  route: ClinicalRoute
): PalUserResponse {
  return PalUserClinicalSchema.parse({
    kind: "clinical",
    route,
    message: contract.copy.clinicalRoutes[route],
    disclaimer: contract.copy.disclaimer
  });
}

export function buildClarifyResponse(
  contract: SafetyContract,
  question: string
): PalUserResponse {
  return PalUserClarifySchema.parse({
    kind: "clarify",
    question,
    examples: [],
    disclaimer: contract.copy.disclaimer
  });
}

export function buildOutOfScopeResponse(
  contract: SafetyContract,
  route: "below_prediabetes_range" | "diabetes_range_out_of_scope"
): PalUserResponse {
  return PalUserOutOfScopeSchema.parse({
    kind: "out_of_scope",
    route,
    // Single-sourced from lib/pal/boundary-copy.ts (SAFETY-OWNED); the drift
    // test pins these equal to the approved below/high-range-route ledger rows.
    message:
      route === "below_prediabetes_range"
        ? BELOW_RANGE_MESSAGE
        : HIGH_RANGE_MESSAGE,
    disclaimer: contract.copy.disclaimer
  });
}

export function buildCarbsOnlyResponse(
  contract: SafetyContract,
  risk: "MODERATE" | "HIGH" = "MODERATE"
): PalUserResponse {
  return PalUserResultSchema.parse({
    kind: "result",
    risk,
    reason:
      risk === "HIGH" ? CARBS_ONLY_HIGH_REASON : CARBS_ONLY_MODERATE_REASON,
    adjustment:
      risk === "HIGH"
        ? CARBS_ONLY_HIGH_ADJUSTMENT
        : CARBS_ONLY_MODERATE_ADJUSTMENT,
    swap: risk === "HIGH" ? CARBS_ONLY_HIGH_SWAP : CARBS_ONLY_MODERATE_SWAP,
    disclaimer: contract.copy.disclaimer
  });
}

export function buildNotFoodResponse(
  contract: SafetyContract,
  examples: string[]
): PalUserResponse {
  return PalUserNotFoodSchema.parse({
    kind: "not_food",
    message: contract.copy.nonFoodRefusal,
    examples: examples.length > 0 ? examples : fallbackExamples(contract),
    disclaimer: contract.copy.disclaimer
  });
}

function fallbackExamples(contract: SafetyContract): string[] {
  const match = contract.copy.nonFoodRefusal.match(
    /something like (.+?) or (.+?)[.]?$/
  );

  if (!match) {
    return [
      "oatmeal with nuts",
      "grilled chicken with rice and vegetables",
      "egg scramble with spinach"
    ];
  }

  return [
    match[1].trim(),
    match[2].trim(),
    "egg scramble with spinach"
  ];
}
