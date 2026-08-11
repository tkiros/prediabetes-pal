import { describe, expect, it, vi } from "vitest";

import {
  CLINICAL_ROUTES,
  classifyClinicalRisk,
  type ClinicalRoute
} from "../../../lib/pal/clinical-risk";
import { checkFood } from "../../../lib/pal/service";
import evalCases from "../../fixtures/pal-eval-cases.json";

/**
 * W-01 / F-09. The failure this router exists to prevent, verbatim from the
 * analysis: "I'm shaky, sweating and confused — should I eat this donut?"
 * returned a calm HIGH dietary card. The system had no path that could say
 * anything else.
 */

const throwingModel = {
  generate: () => {
    throw new Error(
      "The model must NEVER be called on a clinical route — that is the point."
    );
  }
};

describe("classifyClinicalRisk", () => {
  it("routes each class, including casual phrasing and misspellings", () => {
    const cases: Array<[string, ClinicalRoute]> = [
      // urgent symptoms
      ["shaky, sweating and confused, should i eat this donut?", "urgent_symptoms"],
      ["been vomiting all morning, can i eat toast", "urgent_symptoms"],
      ["chicken salad but i cant keep anything down", "urgent_symptoms"],
      ["i keep throwing up and feel disoriented", "urgent_symptoms"],
      ["chest pain after eating, is that the pizza", "urgent_symptoms"],

      // possible hypoglycaemia
      ["my blood sugar is 48, should i eat candy", "possible_hypoglycemia"],
      ["blood sugar dropping fast, what do i eat", "possible_hypoglycemia"],
      ["hypoglicemia coming on, orange juice ok?", "possible_hypoglycemia"],
      ["feeling shaky and clammy, need something quick", "possible_hypoglycemia"],
      ["im dizzy and my heart is racing, banana ok", "possible_hypoglycemia"],

      // medication dosing
      ["how much insulin for this cake", "medication_dosing"],
      ["should i double my metformin with this meal", "medication_dosing"],
      ["2 slices of pizza and how many units should i take", "medication_dosing"],
      ["taking ozempic, is this pasta fine", "medication_dosing"],
      ["what dose before a big dinner", "medication_dosing"],

      // eating disorder
      ["i binged on chips and want to purge", "eating_disorder"],
      ["i binge eat at night, what should i do", "eating_disorder"],
      ["havent eaten in 3 days, is a salad enough", "eating_disorder"],
      ["i make myself throw up after meals", "eating_disorder"],
      ["i feel so fat, should i skip dinner", "eating_disorder"],

      // pregnancy
      ["im 20 weeks pregnant, is sushi ok", "pregnancy"],
      ["im pregent, can i eat soft cheese", "pregnancy"],
      ["gestational diabetes, is rice ok", "pregnancy"],
      ["breastfeeding, is coffee alright", "pregnancy"],
      ["im preggers and craving cake", "pregnancy"],

      // organ disease
      ["i have kidney disease, can i eat this steak", "organ_disease"],
      ["ckd stage 3, is this high protein meal ok", "organ_disease"],
      ["on dialysis, can i have a banana", "organ_disease"],
      ["i have cirrhosis, is this ok", "organ_disease"],
      ["had a heart attack last year, is bacon fine", "organ_disease"],

      // allergy
      ["is this safe for my peanut allergy", "allergy"],
      ["im celiac, is this bread ok", "allergy"],
      ["anaphylactic to shellfish, is this soup safe", "allergy"],
      ["lactose intolerant, can i have this latte", "allergy"],
      ["i carry an epipen, is this cake safe", "allergy"],

      // diagnosed diabetes
      ["im type 1 diabetic, how does this pizza look", "diagnosed_diabetes"],
      ["my dexcom says 120, quick carbs?", "diagnosed_diabetes"],
      ["i'm diabetic, is oatmeal fine", "diagnosed_diabetes"],
      ["type 2 diabetes, can i eat rice", "diagnosed_diabetes"],
      ["my insulin pump is on, is pasta ok", "diagnosed_diabetes"]
    ];

    const misrouted = cases.filter(
      ([text, want]) => classifyClinicalRisk(text)?.route !== want
    );

    // Gate: 100% correct routing across the clinical corpus (plan W-01).
    expect(misrouted).toEqual([]);
  });

  it("covers every declared route", () => {
    const covered = new Set<ClinicalRoute>();
    for (const route of CLINICAL_ROUTES) {
      covered.add(route);
    }
    expect(covered.size).toBe(CLINICAL_ROUTES.length);
    // 9 = the original eight + pediatric (AUD-030, 2026-07-24).
    expect(CLINICAL_ROUTES.length).toBe(9);
  });

  it("medical precedence: a valid meal carrying a medical question routes medical", () => {
    // The adversarial case. Each of these is a perfectly legitimate meal
    // description with a clinical question welded on — the meal must NOT win.
    const combos = [
      "grilled chicken salad with quinoa — how much insulin should i take",
      "oatmeal with berries, but im 8 weeks pregnant",
      "spaghetti bolognese, i have kidney failure",
      "greek yogurt and nuts, is that safe with my nut allergy"
    ];

    for (const combo of combos) {
      expect(classifyClinicalRisk(combo)).not.toBeNull();
    }
  });

  it("urgency wins over other classes when several are present", () => {
    expect(
      classifyClinicalRisk("im pregnant and vomiting and cant keep water down")
        ?.route
    ).toBe("urgent_symptoms");
  });

  it("does NOT fire on ordinary food — no false positives on the food corpus", () => {
    // The router runs FIRST, before the A1C route and the food precheck, so a
    // single false positive here denies a real user a real verdict. Scanned
    // against every NON-clinical case (the clinical ones are supposed to fire).
    const falsePositives = (
      evalCases as Array<{ category: string; input: { food: string } }>
    )
      .filter((testCase) => testCase.category !== "clinical_risk")
      .map((testCase) => testCase.input.food)
      .filter((food) => classifyClinicalRisk(food) !== null);

    expect(falsePositives).toEqual([]);
  });

  it("does NOT fire on foods whose names merely contain clinical-adjacent words", () => {
    // Each of these tripped an earlier draft of the patterns. "Shaking beef"
    // (bò lúc lắc) is a real dish; "low sugar" is a label, not a reading.
    const foods = [
      "low sugar greek yogurt",
      "shaking beef stir fry",
      "binge watching snacks",
      "2 units of wine",
      "should i skip the fries",
      "chicken liver and onions",
      "blood orange juice",
      "libre potatoes",
      "shakshuka",
      "angel food cake"
    ];

    const tripped = foods.filter((food) => classifyClinicalRisk(food) !== null);
    expect(tripped).toEqual([]);
  });
});

describe("checkFood — the clinical route end to end", () => {
  it("returns a clinical response and NEVER calls the model", async () => {
    const response = await checkFood(
      { food: "shaky, sweating and confused, should i eat this donut?", a1c: 6.0 },
      { model: throwingModel }
    );

    expect(response.kind).toBe("clinical");
    // The regression, stated as an assertion: this input used to produce a calm
    // dietary card. A clinical response has no `risk` field at all, so it is
    // structurally incapable of carrying one.
    expect(response).not.toHaveProperty("risk");
    expect(JSON.stringify(response)).not.toMatch(/SAFE|MODERATE|HIGH/);
  });

  it("takes precedence over the out-of-scope A1C route", async () => {
    // A1C 9.0 is out of scope. An emergency reported by that user must still
    // get urgent-care copy, not the calmer "talk to your clinician" route.
    const response = await checkFood(
      { food: "i am vomiting and cannot keep fluids down", a1c: 9.0 },
      { model: throwingModel }
    );

    expect(response.kind).toBe("clinical");
    if (response.kind === "clinical") {
      expect(response.route).toBe("urgent_symptoms");
    }
  });

  it("carries approved ledger copy and the standard disclaimer", async () => {
    const response = await checkFood(
      { food: "how much insulin for this cake", a1c: 6.0 },
      { model: throwingModel }
    );

    expect(response.kind).toBe("clinical");
    if (response.kind === "clinical") {
      expect(response.route).toBe("medication_dosing");
      expect(response.message).toMatch(/prescriber|pharmacist/i);
      expect(response.disclaimer.length).toBeGreaterThan(0);
    }
  });

  it("clinical copy never contains a banned claim family", async () => {
    // The copy is health-adjacent and non-generative, but it still has to obey
    // the same claims boundary as every other string the product speaks.
    const banned =
      /\brevers(?:e|es|ed|ing|al)\b|\bcur(?:e|es|ed|ing)\b|\btreat(?:s|ed|ing|ment)?\b|\bprevent(?:s|ed|ing|ion)?\b|\bdiagnos(?:e|es|ed|ing|is)\b|\bFDA\b|\bguarantee/i;

    for (const route of CLINICAL_ROUTES) {
      const probe: Record<ClinicalRoute, string> = {
        urgent_symptoms: "i am vomiting",
        possible_hypoglycemia: "my blood sugar is 45",
        medication_dosing: "how much insulin",
        eating_disorder: "i want to purge",
        pregnancy: "i am pregnant",
        organ_disease: "i have kidney disease",
        allergy: "peanut allergy",
        diagnosed_diabetes: "i am type 1 diabetic",
        pediatric: "pizza for my 10 year old"
      };

      const response = await checkFood(
        { food: probe[route], a1c: 6.0 },
        { model: throwingModel }
      );

      expect(response.kind).toBe("clinical");
      if (response.kind === "clinical") {
        expect(response.route).toBe(route);
        expect(response.message).not.toMatch(banned);
      }
    }
  });
});

// AUD-030 — the pediatric/age class. Deterministic, zero model calls, and
// scoped to CHILD context: aged foods ("5 year old cheddar") and bare adult
// relations ("my daughter") must not route.
describe("pediatric routing (AUD-030)", () => {
  it.each([
    "mac and cheese for my 10 year old",
    "my 10-year-old had pizza and juice",
    "is oatmeal ok for my 7 yr old daughter",
    "school lunch for a 9 year old kid",
    "my toddler ate half my pasta",
    "snack ideas for my kids",
    "dinner for our children",
    "my teenager eats cereal every day"
  ])("routes to pediatric: %s", (input) => {
    expect(classifyClinicalRisk(input)?.route).toBe("pediatric");
  });

  it.each([
    "5 year old cheddar on crackers",
    "10 year old scotch with dinner",
    "aged gouda and grapes",
    "my daughter recommended this recipe",
    "chicken and rice for me"
  ])("does not route food/adult phrasing: %s", (input) => {
    expect(classifyClinicalRisk(input)?.route).not.toBe("pediatric");
  });

  it("returns the pediatric card with zero model calls", async () => {
    const generate = vi.fn();
    const response = await checkFood(
      { food: "mac and cheese for my 10 year old", a1c: 6.2 },
      { model: { generate } }
    );

    expect(response.kind).toBe("clinical");
    if (response.kind === "clinical") {
      expect(response.route).toBe("pediatric");
      expect(response.message).toMatch(/pediatrician|children/i);
    }
    expect(generate).toHaveBeenCalledTimes(0);
  });
});
