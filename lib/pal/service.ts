import { routeA1C } from "./a1c";
import { classifyClinicalRisk } from "./clinical-risk";
import {
  buildClarifyResponse,
  buildClinicalResponse,
  buildInvalidRequestResponse,
  buildNotFoodResponse,
  buildOutOfScopeResponse,
  buildRetryResponse
} from "./fallback";
import { classifyInputBeforeModel } from "./input-precheck";
import type { PalModelClient } from "./openai-client";
import {
  assertNoForbiddenClaims,
  postprocessModelOutput,
  type SnapshotMetadata
} from "./postprocess";
import { buildPalPrompt } from "./prompt";
import { captureServerError } from "./sentry-capture";
import {
  CheckRequestSchema,
  PalUserClarifySchema,
  PalUserResponseSchema
} from "./schemas";
import type {
  PalModelOutput,
  PalPolicyFlag,
  PalUserResponse
} from "./schemas";
import { loadSafetyContract } from "./safety-contract";

// One live attempt only. At ~10s per attempt a second would land after the
// client's 12s abort — spending money on a response the browser has already
// discarded. The bounded SDK timeout (openai-client) + this cap keep the
// server budget under the client abort.
const MAX_MODEL_ATTEMPTS = 1;

export async function checkFood(
  rawRequest: unknown,
  deps: {
    /**
     * The model client, or a lazy factory for one (AUD-025). Deterministic
     * routes (invalid, clinical, out-of-scope, not_food, clarify) return before
     * the factory is ever called, so a missing/broken provider credential can
     * never preempt safety routing. A factory that throws on first use falls to
     * the same calm retry as a failed generate().
     */
    model: PalModelClient | (() => PalModelClient);
    clarified?: boolean;
    /** PII-free route bookkeeping only; errors still go through Sentry here. */
    onModelError?: (error: unknown) => void;
    /**
     * Optional Task 13 snapshot sink. When supplied, the conservative-floor
     * metadata that postprocess computes is written here for the caller to
     * persist. Absent for every other caller (pantry, evals), so their
     * behavior is unchanged.
     */
    snapshot?: SnapshotMetadata;
  }
): Promise<PalUserResponse> {
  const contract = loadSafetyContract();
  const parsedRequest = CheckRequestSchema.safeParse(rawRequest);

  if (!parsedRequest.success) {
    return buildInvalidRequestResponse(contract);
  }

  const request = parsedRequest.data;

  // Clinical risk is checked FIRST — before the A1C route, before the food
  // precheck, before any prompt is built (W-01).
  //
  // The ordering is the policy. "Medical precedence over meal classification"
  // is not a rule enforced somewhere downstream; it is a consequence of asking
  // the clinical question before the food question. A message carrying both a
  // valid meal and a medical one ("2 slices of pizza — how much insulin?")
  // therefore cannot reach the meal model, and an emergency reported by someone
  // whose A1C is out of range gets urgent-care copy rather than the calmer
  // out-of-scope route.
  //
  // No model call, no spend, no timeout, and no verdict: the clinical schema
  // has no `risk` field to put one in.
  const clinical = classifyClinicalRisk(request.food);

  if (clinical) {
    return buildClinicalResponse(contract, clinical.route);
  }

  const route = routeA1C(request.a1c);

  if (route.kind === "out_of_scope") {
    return buildOutOfScopeResponse(contract, route.band);
  }

  // One-clarification cap (§8): a follow-up answer to a prior clarify (signalled
  // by the route from the client) suppresses a second ambiguity question. The
  // clinical route above and the not_food/carbs_only floors inside the precheck
  // are unaffected — the cap silences the question, never the safety routing.
  const precheck = classifyInputBeforeModel(request.food, {
    clarified: deps.clarified
  });

  if (precheck.kind === "not_food") {
    return buildNotFoodResponse(contract, precheck.examples);
  }

  if (precheck.kind === "clarify") {
    return buildClarifyResponse(contract, precheck.question);
  }

  const precheckFlags = precheck.flags;
  const prompt = buildPalPrompt({
    request,
    contract,
    a1cBand: route.band,
    conservativeLevel: route.conservativeLevel,
    precheckFlags
  });

  for (let attempt = 0; attempt < MAX_MODEL_ATTEMPTS; attempt += 1) {
    try {
      const model =
        typeof deps.model === "function" ? deps.model() : deps.model;
      const modelOutput = await model.generate(prompt);
      return mapModelOutput(
        modelOutput,
        contract,
        route,
        precheckFlags,
        request.food,
        deps.snapshot,
        deps.clarified
      );
    } catch (error) {
      try {
        deps.onModelError?.(error);
      } catch {
        // A diagnostic callback must never replace the calm retry response.
      }
      // Single attempt: fail closed to controlled retry copy. The provider error
      // is otherwise invisible (we return retry, not check_failed) — surface it to
      // Sentry. captureServerError never throws and awaits flush; PII is stripped
      // at init + beforeSend; fully inert without SENTRY_DSN.
      await captureServerError(error, "model");
    }
  }

  return buildRetryResponse(contract);
}

function mapModelOutput(
  modelOutput: PalModelOutput,
  contract: ReturnType<typeof loadSafetyContract>,
  route: ReturnType<typeof routeA1C>,
  precheckFlags: PalPolicyFlag[],
  food: string,
  snapshot?: SnapshotMetadata,
  clarified?: boolean
): PalUserResponse {
  switch (modelOutput.kind) {
    case "result":
    case "carbs_only":
      return postprocessModelOutput(modelOutput, {
        contract,
        route,
        precheckFlags,
        food,
        snapshot
      });
    case "clarify":
      // One-clarification cap, model side (AUD-014 / §8). `clarified` was
      // only checked before the model ran, so a model-authored clarify on the
      // user's follow-up answer chained a SECOND question. Resolve
      // conservatively to the calm retry instead — the user is asked to
      // rephrase once, never interrogated.
      if (clarified) {
        return buildRetryResponse(contract);
      }
      // The clarify and not_food arms bypass postprocess entirely, so before
      // W-06 they were the one model-authored path with NO output-side claims
      // check at all — a banned claim smuggled into a clarifying question
      // ("Is that the version that spikes your glucose by 40 mg/dL?") would
      // have shipped. Same fail-closed contract as every other field.
      assertNoForbiddenClaims(contract, [
        modelOutput.question,
        ...modelOutput.examples
      ]);

      return PalUserResponseSchema.parse(
        PalUserClarifySchema.parse({
          kind: "clarify",
          question: modelOutput.question,
          examples: modelOutput.examples,
          disclaimer: contract.copy.disclaimer
        })
      );
    case "not_food":
      assertNoForbiddenClaims(contract, modelOutput.examples);
      return buildNotFoodResponse(contract, modelOutput.examples);
  }
}
