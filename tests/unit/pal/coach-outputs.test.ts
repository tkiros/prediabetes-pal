import { describe, expect, it } from "vitest";

import {
  CheckApiResponseSchema,
  COACH_PHRASE_BANK,
  deriveCoachOutputs
} from "../../../lib/pal/coach-outputs";
import type { PalUserResponse } from "../../../lib/pal/schemas";

const DISCLAIMER =
  "Prediabetes Pal is informational only and is not medical advice. Talk with a doctor or registered dietitian for guidance that is specific to you.";

function resultResponse(risk: "SAFE" | "MODERATE" | "HIGH"): PalUserResponse {
  return {
    kind: "result",
    risk,
    reason: "This may have a higher blood-sugar impact.",
    adjustment: risk === "SAFE" ? null : "If practical, add protein.",
    swap: risk === "SAFE" ? null : "If you have the option, swap to a less refined version.",
    disclaimer: DISCLAIMER
  };
}

const NON_RESULT_RESPONSES: PalUserResponse[] = [
  {
    kind: "clarify",
    question: "Is this plain or sweetened?",
    examples: [],
    disclaimer: DISCLAIMER
  },
  {
    kind: "not_food",
    message: "I can only classify foods or meals.",
    examples: ["oatmeal with nuts"],
    disclaimer: DISCLAIMER
  },
  {
    kind: "out_of_scope",
    route: "below_prediabetes_range",
    message: "Below the range.",
    disclaimer: DISCLAIMER
  },
  {
    kind: "retry",
    message: "Please try again.",
    disclaimer: DISCLAIMER
  }
];

describe("deriveCoachOutputs", () => {
  it("returns both outputs for MODERATE results, drawn from the audited bank", () => {
    const outputs = deriveCoachOutputs(resultResponse("MODERATE"), {
      food: "pasta with tomato sauce",
      rotation: 0
    });

    // The exact sentence is no longer pinned — the BANK is. Pinning one string
    // is what let the product ship the same three sentences to every user
    // forever (F-12) while the test suite reported it as correct.
    expect(COACH_PHRASE_BANK.sequencingTip).toContain(outputs.sequencingTip);
    expect(COACH_PHRASE_BANK.postMealAction).toContain(outputs.postMealAction);
  });

  it("every slot offers at least 5 audited variants", () => {
    expect(COACH_PHRASE_BANK.sequencingTip.length).toBeGreaterThanOrEqual(5);
    expect(COACH_PHRASE_BANK.mealSequencingTip.length).toBeGreaterThanOrEqual(5);
    expect(COACH_PHRASE_BANK.postMealAction.length).toBeGreaterThanOrEqual(5);
    expect(COACH_PHRASE_BANK.keepMost.length).toBeGreaterThanOrEqual(5);
    // The daypart banks are slots too — a thin one would silently repeat.
    expect(
      COACH_PHRASE_BANK.postMealActionBreakfast.length
    ).toBeGreaterThanOrEqual(5);
    expect(COACH_PHRASE_BANK.postMealActionLunch.length).toBeGreaterThanOrEqual(
      5
    );
    expect(COACH_PHRASE_BANK.postMealActionDinner.length).toBeGreaterThanOrEqual(
      5
    );
  });

  it("draws the post-meal action from the daypart's own bank", () => {
    // The generic tip ("a walk after this meal") is fine at 7pm and slightly
    // absurd at 7am. Conditioning on a signal already in hand is the difference
    // between a coach and a form letter.
    for (const daypart of ["breakfast", "lunch", "dinner"] as const) {
      const outputs = deriveCoachOutputs(resultResponse("HIGH"), {
        food: "pasta bake",
        rotation: 2,
        daypart
      });

      const bank =
        daypart === "breakfast"
          ? COACH_PHRASE_BANK.postMealActionBreakfast
          : daypart === "lunch"
            ? COACH_PHRASE_BANK.postMealActionLunch
            : COACH_PHRASE_BANK.postMealActionDinner;

      expect(bank).toContain(outputs.postMealAction);
    }
  });

  it("falls back to the general bank when the daypart is unknown", () => {
    // Older clients, curl and the demo page send no daypart. They must still
    // get a tip — conditioning may only ADD specificity, never remove advice.
    const outputs = deriveCoachOutputs(resultResponse("HIGH"), {
      food: "pasta bake",
      rotation: 2
    });

    expect(COACH_PHRASE_BANK.postMealAction).toContain(outputs.postMealAction);
  });

  it("never repeats within a daypart on consecutive checks either", () => {
    let previous = deriveCoachOutputs(resultResponse("HIGH"), {
      food: "pasta bake",
      rotation: 0,
      daypart: "breakfast"
    });

    for (let rotation = 1; rotation <= 12; rotation += 1) {
      const current = deriveCoachOutputs(resultResponse("HIGH"), {
        food: "pasta bake",
        rotation,
        daypart: "breakfast"
      });

      expect(current.postMealAction).not.toBe(previous.postMealAction);
      previous = current;
    }
  });

  it("rotation is deterministic — the same counter always yields the same card", () => {
    const once = deriveCoachOutputs(resultResponse("HIGH"), {
      food: "cake",
      rotation: 3
    });
    const twice = deriveCoachOutputs(resultResponse("HIGH"), {
      food: "cake",
      rotation: 3
    });

    expect(once).toEqual(twice);
  });

  it("never repeats a coach sentence on consecutive checks", () => {
    // The whole point of W-17: a daily user must not be read the same lines
    // every day. Walk a full lap of the bank and then some.
    let previous = deriveCoachOutputs(resultResponse("HIGH"), {
      food: "pasta bake",
      rotation: 0
    });

    for (let rotation = 1; rotation <= 20; rotation += 1) {
      const current = deriveCoachOutputs(resultResponse("HIGH"), {
        food: "pasta bake",
        rotation
      });

      expect(current.sequencingTip).not.toBe(previous.sequencingTip);
      expect(current.postMealAction).not.toBe(previous.postMealAction);
      expect(current.keepMost).not.toBe(previous.keepMost);

      previous = current;
    }
  });

  it("a drink gets no plate-sequencing tip", () => {
    // "Start with the vegetables on your plate" attached to a milkshake was a
    // real shipped output — the tell that the tip was never about the meal.
    for (const drink of ["milkshake", "large orange juice", "iced latte"]) {
      const outputs = deriveCoachOutputs(resultResponse("HIGH"), {
        food: drink,
        rotation: 1
      });

      expect(outputs.sequencingTip).toBeNull();
      // The other two still apply — a drink can still be moderated and walked off.
      expect(outputs.postMealAction).not.toBeNull();
      expect(outputs.keepMost).not.toBeNull();
    }
  });

  it("a plate that merely includes a drink still gets the sequencing tip", () => {
    const outputs = deriveCoachOutputs(resultResponse("HIGH"), {
      food: "chicken salad and a juice",
      rotation: 1
    });

    expect(outputs.sequencingTip).not.toBeNull();
  });

  it("names the meal's own carb when the plate has something to eat first", () => {
    // The meal-conditional row (forensic §5.2): "chicken curry with rice" must
    // hear about ITS rice, not "the carb-heavy part" in the abstract — and the
    // sentence must be the audited template with only the {carb} slot filled.
    for (let rotation = 0; rotation < 5; rotation += 1) {
      const tip = deriveCoachOutputs(resultResponse("HIGH"), {
        food: "chicken curry with rice",
        rotation
      }).sequencingTip as string;

      expect(tip).toMatch(/\brice\b/);
      expect(
        COACH_PHRASE_BANK.mealSequencingTip.map((template) =>
          template.replaceAll("{carb}", "rice")
        )
      ).toContain(tip);
    }
  });

  it("a lone carb gets the hedged general bank, never an absurd anchor", () => {
    // "Save the oatmeal for last" on a bowl of oatmeal would be the milkshake
    // bug again. No protein/vegetable in the text → nothing to eat first →
    // general bank.
    for (const food of ["a bowl of rice", "toast", "pasta"]) {
      const tip = deriveCoachOutputs(resultResponse("HIGH"), {
        food,
        rotation: 1
      }).sequencingTip;

      expect(COACH_PHRASE_BANK.sequencingTip).toContain(tip);
    }
  });

  it("fused and compound dishes stay general — the starch is not separable", () => {
    // Adversarial-review reproductions: each of these once produced "save the
    // potato for last" on potato salad, or worse. The starch word appears in
    // the text but is not a side you could eat last.
    for (const food of [
      "potato salad with chicken",
      "egg fried rice",
      "pasta salad with tuna",
      "chicken noodle soup",
      "spaghetti bolognese with beef"
    ]) {
      const tip = deriveCoachOutputs(resultResponse("HIGH"), {
        food,
        rotation: 2
      }).sequencingTip;

      expect(COACH_PHRASE_BANK.sequencingTip).toContain(tip);
    }
  });

  it("low-carb substitutes are never echoed back as the carb", () => {
    // "Save the cauliflower rice for last" would tell a prediabetic user to
    // defer the deliberately low-carb part of their plate.
    for (const food of [
      "cauliflower rice with chicken",
      "chicken salad with rice vinegar"
    ]) {
      const tip = deriveCoachOutputs(resultResponse("HIGH"), {
        food,
        rotation: 0
      }).sequencingTip;

      expect(COACH_PHRASE_BANK.sequencingTip).toContain(tip);
    }
  });

  it("a negated carb is not echoed back — but a clean one later still anchors", () => {
    const negated = deriveCoachOutputs(resultResponse("HIGH"), {
      food: "grilled chicken sandwich, no bread",
      rotation: 1
    }).sequencingTip;
    expect(COACH_PHRASE_BANK.sequencingTip).toContain(negated);

    const mixed = deriveCoachOutputs(resultResponse("HIGH"), {
      food: "no rice, extra chicken and bread",
      rotation: 1
    }).sequencingTip as string;
    expect(mixed).toMatch(/\bbread\b/);
    expect(mixed).not.toMatch(/\brice\b/);
  });

  it("scooping breads are not on the anchor list — they are the utensil", () => {
    // "Save the injera for last" would misread how the meal is eaten (J3:
    // wrong cultural advice is worse than general advice).
    for (const food of [
      "injera with lentils",
      "chicken curry with naan",
      "beef tortilla wrap"
    ]) {
      const tip = deriveCoachOutputs(resultResponse("MODERATE"), {
        food,
        rotation: 0
      }).sequencingTip;

      expect(COACH_PHRASE_BANK.sequencingTip).toContain(tip);
    }
  });

  it("never repeats an anchored tip on consecutive checks either", () => {
    let previous = deriveCoachOutputs(resultResponse("HIGH"), {
      food: "salmon with rice",
      rotation: 0
    });

    for (let rotation = 1; rotation <= 12; rotation += 1) {
      const current = deriveCoachOutputs(resultResponse("HIGH"), {
        food: "salmon with rice",
        rotation
      });

      expect(current.sequencingTip).not.toBe(previous.sequencingTip);
      previous = current;
    }
  });

  it("anchored templates obey the tone policy for every carb on the closed list", () => {
    for (const carb of COACH_PHRASE_BANK.carbAnchors) {
      for (const template of COACH_PHRASE_BANK.mealSequencingTip) {
        const text = template.replaceAll("{carb}", carb);

        // fully interpolated — no slot left over
        expect(text).not.toContain("{");
        // one sentence
        expect(text.match(/[.!?](?=\s|$)/g) ?? []).toHaveLength(1);
        // permission-first hedges, never commands framed as musts
        expect(text).not.toMatch(/\bmust\b|\bnever\b|\bdon't\b|\bavoid\b/i);
        // no backward judgment
        expect(text).not.toMatch(/should have|you failed|too much/i);
        // no glycemic numbers
        expect(text).not.toMatch(/\bGI\b|\bGL\b|\bgrams?\b|mg\/?dl/i);
      }
    }
  });

  it("falls back to a stable hash when the client sends no rotation counter", () => {
    const a = deriveCoachOutputs(resultResponse("HIGH"), {
      food: "cake",
      seed: "client-abc"
    });
    const b = deriveCoachOutputs(resultResponse("HIGH"), {
      food: "cake",
      seed: "client-abc"
    });

    expect(a).toEqual(b);
    expect(COACH_PHRASE_BANK.keepMost).toContain(a.keepMost);
  });

  it("returns both outputs for HIGH results", () => {
    const outputs = deriveCoachOutputs(resultResponse("HIGH"));

    expect(outputs.sequencingTip).not.toBeNull();
    expect(outputs.postMealAction).not.toBeNull();
  });

  it("returns null outputs for SAFE results — no piling on", () => {
    expect(deriveCoachOutputs(resultResponse("SAFE"))).toEqual({
      sequencingTip: null,
      postMealAction: null,
      keepMost: null
    });
  });

  it.each(NON_RESULT_RESPONSES.map((r) => [r.kind, r] as const))(
    "returns null outputs for %s responses",
    (_kind, response) => {
      expect(deriveCoachOutputs(response)).toEqual({
        sequencingTip: null,
        postMealAction: null,
        keepMost: null
      });
    }
  );

  it("keepMost comes from the audited bank for MODERATE and HIGH", () => {
    for (const risk of ["MODERATE", "HIGH"] as const) {
      const keepMost = deriveCoachOutputs(resultResponse(risk), {
        food: "chocolate cake",
        rotation: 2
      }).keepMost;

      expect(keepMost).toBeTruthy();
      expect(COACH_PHRASE_BANK.keepMost).toContain(keepMost);
    }
  });

  it("no coach sentence names a meal component — whole-portion moderation must stay true for every meal", () => {
    // These sentences attach to meals the derivation never sees, so any one
    // that named a food would eventually be wrong about the plate it landed on.
    for (const phrase of COACH_PHRASE_BANK.keepMost) {
      expect(phrase).not.toMatch(
        /\b(rice|bread|pasta|cake|potato|chicken|pizza)\b/i
      );
    }
  });

  it("keepMost is null for SAFE and every non-result kind", () => {
    expect(deriveCoachOutputs(resultResponse("SAFE")).keepMost).toBeNull();
    for (const response of NON_RESULT_RESPONSES) {
      expect(deriveCoachOutputs(response).keepMost).toBeNull();
    }
  });

  it("keepMost obeys the tone rules — banned list adds skip, no digits", () => {
    const text = deriveCoachOutputs(resultResponse("HIGH")).keepMost as string;

    // one sentence
    expect(text.match(/[.!?](?=\s|$)/g) ?? []).toHaveLength(1);
    // permission-first hedges, never commands framed as musts; skip is banned too
    expect(text).not.toMatch(/\bmust\b|\bnever\b|\bdon't\b|\bavoid\b|\bskip\b/i);
    // no backward judgment
    expect(text).not.toMatch(/should have|you failed|too much/i);
    // no glycemic numbers and no digits at all for this field
    expect(text).not.toMatch(/\bGI\b|\bGL\b|\bgrams?\b|mg\/?dl|\bcarbs? grams?\b/i);
    expect(text).not.toMatch(/\d/);
  });

  it("is deterministic — same input, same output", () => {
    const a = deriveCoachOutputs(resultResponse("MODERATE"));
    const b = deriveCoachOutputs(resultResponse("MODERATE"));

    expect(a).toEqual(b);
  });

  it("keeps the phrase bank inside the tone policy: permission-first, no numbers beyond duration, one sentence each", () => {
    const outputs = deriveCoachOutputs(resultResponse("HIGH"));
    const strings = [outputs.sequencingTip, outputs.postMealAction] as string[];

    for (const text of strings) {
      // one sentence
      expect(text.match(/[.!?](?=\s|$)/g) ?? []).toHaveLength(1);
      // permission-first hedges, never commands framed as musts
      expect(text).not.toMatch(/\bmust\b|\bnever\b|\bdon't\b|\bavoid\b/i);
      // no backward judgment
      expect(text).not.toMatch(/should have|you failed|too much/i);
      // no glycemic numbers (GI/GL, grams, mg/dL); minutes of walking are allowed
      expect(text).not.toMatch(/\bGI\b|\bGL\b|\bgrams?\b|mg\/?dl|\bcarbs? grams?\b/i);
    }
  });
});

describe("CheckApiResponseSchema", () => {
  it("accepts every engine kind extended with the two nullable coach fields", () => {
    for (const response of [
      resultResponse("SAFE"),
      resultResponse("MODERATE"),
      ...NON_RESULT_RESPONSES
    ]) {
      const wrapped = { ...response, ...deriveCoachOutputs(response) };
      expect(CheckApiResponseSchema.safeParse(wrapped).success).toBe(true);
    }
  });

  it("rejects payloads missing the coach fields", () => {
    expect(CheckApiResponseSchema.safeParse(resultResponse("SAFE")).success).toBe(
      false
    );
  });

  it("requires keepMost on result kinds", () => {
    const missingKeepMost = {
      ...resultResponse("MODERATE"),
      sequencingTip: null,
      postMealAction: null
      // keepMost intentionally omitted
    };

    expect(CheckApiResponseSchema.safeParse(missingKeepMost).success).toBe(false);
  });

  it("rejects unknown extra fields (stays strict like the engine schemas)", () => {
    const wrapped = {
      ...resultResponse("SAFE"),
      sequencingTip: null,
      postMealAction: null,
      calories: 120
    };

    expect(CheckApiResponseSchema.safeParse(wrapped).success).toBe(false);
  });
});
