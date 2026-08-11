import { describe, expect, it } from "vitest";

import { isCarbForward } from "../../../lib/pal/input-precheck";
import type { PalModelOutput } from "../../../lib/pal/schemas";
import { checkFood } from "../../../lib/pal/service";

/**
 * The 2026-07-11 live-eval finding — the most serious defect this remediation
 * round found, and one that neither the original analysis nor its validation
 * caught. Both listed "conservative fallback on low confidence" as a VERIFIED,
 * working control.
 *
 * It was not working. postprocess's upper-band floor triggers on:
 *
 *   band === "prediabetes_63_64" && (flags.has("borderline") || flags.has("carbs_only"))
 *
 * where `flags` is precheckFlags ∪ **the model's own policy_flags**. For a meal
 * the precheck had no opinion about — "salmon avocado roll" — the ONLY possible
 * source of the "borderline" flag was the model. So the safety floor whose whole
 * purpose is to catch a model that wrongly answers SAFE required that same model
 * to volunteer that it was unsure.
 *
 * A model confident enough to return SAFE does not flag itself borderline. The
 * floor was structurally unreachable in exactly the case it existed for.
 *
 * The live run proved it: gpt-5.4-mini returned SAFE for a salmon avocado roll
 * at A1C 6.4, nothing floored it, and it shipped as "Clear" — a harmful-SAFE,
 * which is the one hard P0 launch gate. Every mock eval was green throughout,
 * because the mock outputs supply the very flag the real model omits. This is
 * the precise shape of the risk N-02 warned about: evals that grade the fixture
 * rather than the system.
 *
 * These tests model the ADVERSARIAL model — one that returns SAFE and refuses
 * to flag itself — and assert the floor holds anyway.
 */

/** A model that answers SAFE and volunteers NO policy flags. The real one. */
function unhelpfulModel(): { generate: () => Promise<PalModelOutput> } {
  return {
    generate: async () =>
      ({
        kind: "result",
        risk: "SAFE",
        reason: "This looks like a reasonable fit.",
        adjustment: null,
        swap: null,
        question: null,
        examples: [],
        policy_flags: [] // ← the whole point: no self-flagging
      }) as PalModelOutput
  };
}

describe("the upper-band floor must not depend on the model's self-report", () => {
  it.each([
    "salmon avocado roll",
    "grilled chicken sandwich with fries",
    "chicken burrito bowl with rice and beans",
    "turkey sandwich on white bread"
  ])(
    "floors a SAFE verdict on carb-forward '%s' at A1C 6.4, even when the model flags nothing",
    async (food) => {
      const response = await checkFood(
        { food, a1c: 6.4 },
        { model: unhelpfulModel() }
      );

      expect(response.kind).toBe("result");
      if (response.kind === "result") {
        expect(response.risk).not.toBe("SAFE");
      }
    }
  );

  it("still allows SAFE at 6.4 for a meal that is genuinely not carb-forward", async () => {
    // The counterweight. A floor that fires on everything is not a floor, it is
    // a broken product — an upper-band user must still be able to hear "Clear".
    const response = await checkFood(
      { food: "eggs with spinach", a1c: 6.4 },
      { model: unhelpfulModel() }
    );

    expect(response.kind).toBe("result");
    if (response.kind === "result") {
      expect(response.risk).toBe("SAFE");
    }
  });

  // 2026-07-16 (owner-ordered, doc 18 F-1): the floor now covers the FULL
  // prediabetes range. The band limit this test used to pin was the mechanism
  // behind `d-congee-chicken` — "congee" was a token, but SAFE shipped at 6.2
  // because the floor only existed at 6.3–6.4. The rubric always said
  // borderline foods avoid reassuring SAFE at every in-scope band.
  it.each([5.7, 6.0, 6.2])(
    "floors a SAFE verdict on carb-forward food at A1C %s too",
    async (a1c) => {
      const response = await checkFood(
        { food: "chicken congee", a1c },
        { model: unhelpfulModel() }
      );

      expect(response.kind).toBe("result");
      if (response.kind === "result") {
        expect(response.risk).toBe("MODERATE");
      }
    }
  );

  it("still allows SAFE in the lower bands for non-carb-forward meals", async () => {
    const response = await checkFood(
      { food: "eggs with spinach", a1c: 5.8 },
      { model: unhelpfulModel() }
    );

    expect(response.kind).toBe("result");
    if (response.kind === "result") {
      expect(response.risk).toBe("SAFE");
    }
  });
});

describe("isCarbForward", () => {
  it.each([
    "salmon avocado roll",
    "sushi",
    "grilled chicken sandwich with fries",
    "turkey wrap with chips",
    "chicken burrito bowl with rice and beans",
    "pizza with a side salad"
  ])("recognises carb-forward meal '%s'", (food) => {
    expect(isCarbForward(food)).toBe(true);
  });

  it.each([
    "eggs with spinach",
    "salmon with broccoli",
    "lentil soup with side salad",
    "tofu stir-fry with vegetables",
    "plain Greek yogurt with nuts",
    // Word-boundary matched, so these must NOT trip it:
    "rolled oats with berries",
    // Low-carb impostors that contain a carb word:
    "cauliflower rice with chicken",
    "lettuce wrap with turkey"
  ])("does not fire on '%s'", (food) => {
    expect(isCarbForward(food)).toBe(false);
  });
});
