import fs from "node:fs";
import path from "node:path";

import { z } from "zod";

import {
  createOpenAIPalModelClient,
  type PalModelClient
} from "../../lib/pal/openai-client";
import type { PalPromptPayload } from "../../lib/pal/prompt";
import {
  CheckRequestSchema,
  PalClinicalRouteSchema,
  PalModelOutputSchema,
  PalResponseKindSchema,
  PalRiskSchema
} from "../../lib/pal/schemas";

export const REQUIRED_CATEGORIES = [
  "clearly_safe",
  "borderline",
  "high_risk",
  "non_food",
  "ambiguous",
  "carbs_only",
  "out_of_range_a1c",
  "prompt_injection",
  "adversarial",
  // W-01/F-10. The corpus was schema-LOCKED to nine food categories, which is
  // why the clinical gap (F-09) could not even be expressed as a failing test:
  // a clinical case was un-addable without a code change.
  "clinical_risk"
] as const;

// P1.4 — permanent stratified cultural/real-world strata (journey 2/3). These
// are ENGINEERING/SIMULATED evidence, NOT clinical validation. The `stratum`
// dimension is ORTHOGONAL to `category`: a case is bucketed into one of the
// launch-safety categories above (which drives the deterministic routing gates)
// AND tagged with the real-world stratum it exercises, so the report can break
// failure types down by regional staple / mixed plate / restaurant portion /
// sauce / beverage / vegetarian / budget / code-switching / adversarial
// under-description / multi-starch instead of one aggregate accuracy number.
export const PAL_STRATA = [
  "regional_staple",
  "mixed_plate",
  "restaurant_portion",
  "sauce_condiment",
  "beverage",
  "vegetarian",
  "budget_meal",
  "code_switching",
  "adversarial_underdescription",
  "multi_starch"
] as const;

const PalStratumSchema = z.enum(PAL_STRATA);

const PalEvalCategorySchema = z.enum(REQUIRED_CATEGORIES);
const DETERMINISTIC_SHORT_CIRCUIT_CATEGORIES = new Set<
  (typeof REQUIRED_CATEGORIES)[number]
>(["non_food", "clinical_risk"]);

export const PalEvalCaseSchema = z
  .object({
    id: z.string().trim().min(1),
    category: PalEvalCategorySchema,
    input: CheckRequestSchema,
    harmfulIfSafe: z.boolean(),
    expectedKinds: z.array(PalResponseKindSchema).min(1),
    disallowRisk: z.array(PalRiskSchema).optional(),
    // The authoritative risk band(s) a result may land in. scoreRun measures
    // riskAccuracy ONLY over cases carrying these — with zero labels the gate
    // returns null and auto-passes, which is exactly how a 0.85 accuracy gate
    // sat in the codebase for months having never once evaluated (F-06).
    //
    // The labels now present are DERIVED from each case's existing
    // `disallowRisk` (acceptable = all risks minus disallowed), i.e. they make
    // explicit what the corpus authors already asserted rather than inventing
    // new clinical judgment. They are engineering-derived and marked as such in
    // labelSource; the W-05 dietitian panel reviews and tightens them (a
    // high_risk case accepting MODERATE is looser than an RD would likely want).
    acceptableRisks: z.array(PalRiskSchema).min(1).optional(),
    labelSource: z.string().trim().min(1).optional(),
    /** For clinical_risk cases: the exact route that must fire (gate: 100%). */
    expectedClinicalRoute: PalClinicalRouteSchema.optional(),
    /**
     * P1.4 real-world stratum (orthogonal to `category`). Optional so the
     * pre-existing launch-safety corpus stays valid unchanged.
     */
    stratum: PalStratumSchema.optional(),
    /**
     * P1.4 known-gap marker. A case whose CORRECT expectation (per
     * harmfulIfSafe / acceptableRisks) the CURRENT deterministic engine does
     * NOT yet satisfy — the dish is genuinely carb-forward/sugary but no
     * ontology token or precheck rule sees it, so a model SAFE ships as SAFE.
     * Excluded from the hard zero-dangerous-false-reassurance gate and the
     * harmful-SAFE gate, but kept in the corpus and surfaced in the per-stratum
     * report as an explicit, tracked gap (never silently dropped). Fixing one
     * requires a safe-direction ontology addition or a precheck change and its
     * own RD review — not a label weakening.
     */
    knownGap: z.boolean().optional(),
    mockModelOutput: PalModelOutputSchema.optional(),
    notes: z.string().trim().min(1)
  })
  .strict();

export type PalEvalCase = z.infer<typeof PalEvalCaseSchema>;

const FIXTURE_PATH = path.join(
  process.cwd(),
  "tests/fixtures/pal-eval-cases.json"
);

export function loadEvalCases(): PalEvalCase[] {
  const raw = JSON.parse(fs.readFileSync(FIXTURE_PATH, "utf8")) as unknown;
  return z.array(PalEvalCaseSchema).parse(raw);
}

export function createEvalModelClient(
  cases: readonly PalEvalCase[]
): PalModelClient {
  if (isLivePalEvalEnabled()) {
    return createOpenAIPalModelClient();
  }

  const casesByInput = new Map<string, PalEvalCase>();

  for (const evalCase of cases) {
    if (
      DETERMINISTIC_SHORT_CIRCUIT_CATEGORIES.has(evalCase.category) &&
      evalCase.mockModelOutput
    ) {
      throw new Error(
        `Eval fixture ${evalCase.id} sets mockModelOutput for deterministic short-circuit category ${evalCase.category}.`
      );
    }

    const key = buildLookupKey(evalCase.input);
    if (casesByInput.has(key)) {
      throw new Error(`Duplicate eval fixture input key: ${key}`);
    }

    casesByInput.set(key, evalCase);
  }

  return {
    async generate(prompt) {
      const evalCase = casesByInput.get(buildLookupKey(parsePromptInput(prompt)));

      if (!evalCase) {
        throw new Error(
          `No eval fixture matched prompt input.\n${prompt.input}`
        );
      }

      if (!evalCase.mockModelOutput) {
        throw new Error(
          `Eval fixture ${evalCase.id} reached the model path without mockModelOutput.`
        );
      }

      return evalCase.mockModelOutput;
    }
  };
}

export function isLivePalEvalEnabled(): boolean {
  return process.env.PAL_LIVE_EVAL === "1";
}

function buildLookupKey(input: { food: string; a1c: number }): string {
  return `${input.food.trim().toLowerCase()}::${input.a1c}`;
}

function parsePromptInput(prompt: PalPromptPayload): { food: string; a1c: number } {
  const foodMatch = prompt.input.match(/^Food:\s+(.+)$/m);
  const a1cMatch = prompt.input.match(/^A1C:\s+([0-9]+(?:\.[0-9]+)?)$/m);

  if (!foodMatch || !a1cMatch) {
    throw new Error(`Could not parse eval prompt input.\n${prompt.input}`);
  }

  return {
    food: foodMatch[1].trim(),
    a1c: Number(a1cMatch[1])
  };
}
