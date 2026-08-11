import { describe, expect, it } from "vitest";

import { routeA1C } from "../../../lib/pal/a1c";
import {
  buildCarbsOnlyResponse,
  buildClarifyResponse,
  buildInvalidRequestResponse,
  buildNotFoodResponse,
  buildOutOfScopeResponse,
  buildRetryResponse
} from "../../../lib/pal/fallback";
import { postprocessModelOutput } from "../../../lib/pal/postprocess";
import { loadSafetyContract } from "../../../lib/pal/safety-contract";
import type { PalModelOutput } from "../../../lib/pal/schemas";

const contract = loadSafetyContract();
const expected = contract.copy.disclaimer;

function modelResult(): PalModelOutput {
  return {
    kind: "result",
    risk: "MODERATE",
    reason:
      "This may have a higher blood-sugar impact because it leans heavily on refined carbs.",
    adjustment:
      "If practical, add protein or nonstarchy vegetables to make it easier to handle.",
    swap: "If you have the option, swap to a less refined version.",
    question: null,
    examples: [],
    policy_flags: ["borderline"]
  };
}

// One entry per place a user-facing PalUserResponse is constructed.
const responses = {
  result_model: postprocessModelOutput(modelResult(), {
    contract,
    route: routeA1C(6.1),
    precheckFlags: []
  }),
  result_floor: buildCarbsOnlyResponse(contract, "HIGH"),
  clarify: buildClarifyResponse(contract, "Which portion size?"),
  not_food: buildNotFoodResponse(contract, []),
  out_of_scope_below: buildOutOfScopeResponse(
    contract,
    "below_prediabetes_range"
  ),
  out_of_scope_high: buildOutOfScopeResponse(
    contract,
    "diabetes_range_out_of_scope"
  ),
  retry: buildRetryResponse(contract),
  invalid: buildInvalidRequestResponse(contract)
};

describe("disclaimer presence", () => {
  it.each(Object.entries(responses))(
    "%s carries the single contract disclaimer",
    (_label, response) => {
      expect(response.disclaimer).toBe(expected);
    }
  );

  it("covers every user-facing response kind", () => {
    const kinds = new Set(Object.values(responses).map((r) => r.kind));
    expect(kinds).toEqual(
      new Set(["result", "clarify", "not_food", "out_of_scope", "retry"])
    );
  });
});
