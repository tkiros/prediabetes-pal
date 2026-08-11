import { describe, expect, it, vi } from "vitest";

import { buildCarbsOnlyResponse } from "../../../lib/pal/fallback";
import { checkFood } from "../../../lib/pal/service";
import { loadSafetyContract } from "../../../lib/pal/safety-contract";

describe("checkFood carbs-only flooring", () => {
  it("floors sequencing-only carbs-only model output to deterministic fallback copy", async () => {
    const contract = loadSafetyContract();
    const model = {
      generate: vi.fn().mockResolvedValue({
        kind: "carbs_only",
        risk: "MODERATE",
        reason:
          "This may have a higher blood-sugar impact because it leans heavily on refined carbs.",
        adjustment: "Eat vegetables first if you can.",
        swap: "If you have the option, swap to brown rice instead.",
        question: null,
        examples: [],
        policy_flags: ["carbs_only"]
      })
    };

    const response = await checkFood(
      {
        food: "white rice",
        a1c: 6.0
      },
      { model }
    );

    expect(model.generate).toHaveBeenCalledTimes(1);
    expect(response).toEqual(buildCarbsOnlyResponse(contract, "MODERATE"));
  });
});
