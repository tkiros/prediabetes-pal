import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  DEFAULT_REVORA_MODEL,
  REVORA_JSON_SCHEMA_NAME,
  createOpenAIRevoraModelClient
} from "../../../lib/revora/openai-client";
import { buildRevoraPrompt } from "../../../lib/revora/prompt";
import { checkFood } from "../../../lib/revora/service";
import * as serviceModule from "../../../lib/revora/service";
import { revoraModelJsonSchema } from "../../../lib/revora/schemas";
import { loadSafetyContract } from "../../../lib/revora/safety-contract";

describe("safety contract loader", () => {
  it("loads the Phase 1 fixture and approved disclaimer copy", () => {
    const contract = loadSafetyContract();

    expect(contract.paths.fixture).toBe(
      path.join(process.cwd(), "tests/fixtures/safety-contract.json")
    );
    expect(contract.fixture.uncertaintyFloors.length).toBeGreaterThan(0);
    expect(contract.copy.disclaimer).toBe(
      "Prediabetes Pal is informational only and is not medical advice. Talk with a doctor or registered dietitian for guidance that is specific to you."
    );
    expect(contract.copy.promptA1CScope).toContain("5.7%");
  });
});

describe("prompt composer", () => {
  it("includes the allowed response kinds, edge-case policy, and strict output contract", () => {
    const contract = loadSafetyContract();
    const prompt = buildRevoraPrompt({
      request: {
        food: "sweetened oatmeal",
        a1c: 6.2
      },
      contract,
      a1cBand: "prediabetes_60_62",
      conservativeLevel: "elevated",
      precheckFlags: ["borderline"]
    });

    expect(prompt.instructions).toContain(contract.copy.productHomeHero);
    expect(prompt.instructions).toContain(contract.copy.promptA1CScope);
    expect(prompt.instructions).toContain(contract.copy.promptSafeToneSnippet);
    expect(prompt.instructions).toContain(
      contract.copy.promptConservativeFloorSnippet
    );
    expect(prompt.instructions).toContain("qualitative");
    expect(prompt.instructions).toContain("Return only one flat JSON object");
    expect(prompt.instructions).toContain("Do not diagnose");
    expect(prompt.instructions).toContain(
      "Allowed response kinds: result, clarify, not_food, carbs_only."
    );
    expect(prompt.instructions).toContain(
      "Do not classify out-of-scope A1C, non-food, or ambiguous input with invented details."
    );
    expect(prompt.instructions).toContain(
      "SAFE results keep adjustment and swap null."
    );
    expect(prompt.instructions).toContain(
      "MODERATE requires exactly one adjustment and one swap."
    );
    // Doc 18 fixes: composition-first, grounded reasons, scope, and math.
    expect(prompt.instructions).toContain("Work composition-first");
    expect(prompt.instructions).toContain(
      "Beverages are valid check subjects, never not_food."
    );
    expect(prompt.instructions).toContain("multiply per-serving carbs");
    expect(prompt.instructions).toContain("A1C calibration: 5.7-5.9");
    expect(prompt.instructions).toContain(
      "Carbs-only meals must add protein or nonstarchy vegetables."
    );
    expect(prompt.input).toContain("Food: sweetened oatmeal");
    expect(prompt.input).toContain("A1C: 6.2");
    expect(prompt.input).toContain("A1C band: prediabetes_60_62");
    expect(prompt.input).toContain("Conservative level: elevated");
    expect(prompt.input).toContain("Precheck flags: borderline");
  });
});

describe("OpenAI client", () => {
  it("calls the Responses API with store false and strict json_schema output", async () => {
    const create = vi.fn().mockResolvedValue({
      output_text: JSON.stringify({
        kind: "result",
        risk: "SAFE",
        reason: "This looks balanced.",
        adjustment: null,
        swap: null,
        question: null,
        examples: [],
        policy_flags: ["safe_food"]
      })
    });
    const client = createOpenAIRevoraModelClient({
      client: {
        responses: { create }
      }
    });

    const result = await client.generate({
      instructions: "instruction text",
      input: "Food: lentil soup\nA1C: 6.1"
    });

    expect(result).toEqual({
      kind: "result",
      risk: "SAFE",
      reason: "This looks balanced.",
      adjustment: null,
      swap: null,
      question: null,
      examples: [],
      policy_flags: ["safe_food"]
    });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: DEFAULT_REVORA_MODEL,
        instructions: "instruction text",
        input: "Food: lentil soup\nA1C: 6.1",
        store: false,
        text: {
          format: {
            type: "json_schema",
            name: REVORA_JSON_SCHEMA_NAME,
            schema: revoraModelJsonSchema,
            strict: true
          }
        }
      })
    );
  });
});

describe("checkFood", () => {
  it("is the only core service export", () => {
    expect(Object.keys(serviceModule).sort()).toEqual(["checkFood"]);
  });

  it("returns a safe retry response for malformed requests without calling the model", async () => {
    const model = {
      generate: vi.fn()
    };

    const response = await checkFood(
      {
        food: "",
        a1c: "nope"
      },
      { model }
    );

    expect(response.kind).toBe("retry");
    expect(response.disclaimer).toContain("registered dietitian");
    expect(model.generate).not.toHaveBeenCalled();
  });

  it("short-circuits out-of-scope A1C inputs before the model call", async () => {
    const model = {
      generate: vi.fn()
    };

    const belowRange = await checkFood(
      {
        food: "lentil soup",
        a1c: 5.6
      },
      { model }
    );
    const highRange = await checkFood(
      {
        food: "lentil soup",
        a1c: 6.5
      },
      { model }
    );

    expect(model.generate).not.toHaveBeenCalled();
    expect(belowRange).toMatchObject({
      kind: "out_of_scope",
      route: "below_prediabetes_range"
    });
    expect(highRange).toMatchObject({
      kind: "out_of_scope",
      route: "diabetes_range_out_of_scope"
    });
    expect(belowRange.disclaimer).toContain("registered dietitian");
    expect(highRange.disclaimer).toContain("registered dietitian");
  });

  it("returns non-food guidance without calling the model", async () => {
    const model = {
      generate: vi.fn()
    };

    const response = await checkFood(
      {
        food: "write a poem about blood sugar",
        a1c: 6.1
      },
      { model }
    );

    expect(response.kind).toBe("not_food");
    expect(response.disclaimer).toContain("registered dietitian");
    expect(model.generate).not.toHaveBeenCalled();
  });

  it("returns one ambiguous question without calling the model", async () => {
    const model = {
      generate: vi.fn()
    };

    const response = await checkFood(
      {
        food: "oatmeal",
        a1c: 6.1
      },
      { model }
    );

    expect(response.kind).toBe("clarify");
    expect(response.disclaimer).toContain("registered dietitian");
    expect(model.generate).not.toHaveBeenCalled();
  });

  it("applies conservative carbs-only floors to upper-band SAFE results", async () => {
    const model = {
      generate: vi.fn().mockResolvedValue({
        kind: "result",
        risk: "SAFE",
        reason: "This looks like a reasonable fit.",
        adjustment: null,
        swap: null,
        question: null,
        examples: [],
        policy_flags: []
      })
    };

    const response = await checkFood(
      {
        food: "plain bagel",
        a1c: 6.4
      },
      { model }
    );

    expect(model.generate).toHaveBeenCalledTimes(1);
    expect(response).toMatchObject({
      kind: "result",
      risk: "MODERATE"
    });
    if (response.kind !== "result") {
      throw new Error("Expected a result response.");
    }

    expect(response.adjustment).toContain("protein or nonstarchy vegetables");
    expect(response.swap).toContain("less refined");
    expect(response.disclaimer).toContain("registered dietitian");
  });

  it("passes A1C band and precheck flags into the prompt after deterministic checks pass", async () => {
    const model = {
      generate: vi.fn().mockResolvedValue({
        kind: "result",
        risk: "MODERATE",
        reason:
          "This may have a higher blood-sugar impact because it leans heavily on refined carbs.",
        adjustment:
          "If practical, add protein or nonstarchy vegetables to make it easier to handle.",
        swap: "If you have the option, swap to a less refined version.",
        question: null,
        examples: [],
        policy_flags: []
      })
    };

    await checkFood(
      {
        food: "plain bagel",
        a1c: 6.4
      },
      { model }
    );

    expect(model.generate).toHaveBeenCalledTimes(1);
    expect(model.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.stringContaining("A1C band: prediabetes_63_64")
      })
    );
    expect(model.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.stringContaining("Conservative level: high")
      })
    );
    expect(model.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.stringContaining("Precheck flags: carbs_only, borderline")
      })
    );
  });

  it("fails closed to retry copy on malformed SAFE contract output after one attempt", async () => {
    const model = {
      generate: vi.fn().mockResolvedValue({
        kind: "result",
        risk: "SAFE",
        reason: "This looks like a reasonable fit.",
        adjustment: "Take a walk after eating it.",
        swap: null,
        question: null,
        examples: [],
        policy_flags: ["safe_food"]
      })
    };

    const response = await checkFood(
      {
        food: "lentil soup",
        a1c: 6.1
      },
      { model }
    );

    // Single live attempt (≤ client 12s abort budget), then controlled retry copy.
    expect(model.generate).toHaveBeenCalledTimes(1);
    expect(response.kind).toBe("retry");
    expect(response.disclaimer).toContain("registered dietitian");
  });

  it("makes a single live attempt then falls back to retry copy when the model errors", async () => {
    const error = new Error("malformed output");
    const model = {
      generate: vi.fn().mockRejectedValue(error)
    };
    const onModelError = vi.fn();

    const response = await checkFood(
      {
        food: "sweetened cereal",
        a1c: 6.1
      },
      { model, onModelError }
    );

    expect(model.generate).toHaveBeenCalledTimes(1);
    expect(onModelError).toHaveBeenCalledOnce();
    expect(onModelError).toHaveBeenCalledWith(error);
    expect(response.kind).toBe("retry");
    expect(response.disclaimer).toContain("registered dietitian");
  });

  it("returns validated in-scope results with the disclaimer merged server-side", async () => {
    const model = {
      generate: vi.fn().mockResolvedValue({
        kind: "result",
        risk: "SAFE",
        reason: "This looks balanced.",
        adjustment: null,
        swap: null,
        question: null,
        examples: [],
        policy_flags: ["safe_food"]
      })
    };

    const response = await checkFood(
      {
        food: "lentil soup",
        a1c: 6.1
      },
      { model }
    );

    expect(model.generate).toHaveBeenCalledTimes(1);
    expect(response).toEqual({
      kind: "result",
      risk: "SAFE",
      reason: "This looks balanced.",
      adjustment: null,
      swap: null,
      disclaimer:
        "Prediabetes Pal is informational only and is not medical advice. Talk with a doctor or registered dietitian for guidance that is specific to you."
    });
  });

  it("returns HIGH results with the disclaimer merged server-side", async () => {
    const model = {
      generate: vi.fn().mockResolvedValue({
        kind: "result",
        risk: "HIGH",
        reason:
          "This is likely a higher-impact choice because it is mostly sugary or refined carbs.",
        adjustment:
          "A smaller portion with protein or nonstarchy vegetables would be a steadier fit here.",
        swap: "If you have the option, swap to a less sweet or less refined version.",
        question: null,
        examples: [],
        policy_flags: ["high_risk"]
      })
    };

    const response = await checkFood(
      {
        food: "pastry",
        a1c: 6.1
      },
      { model }
    );

    expect(response).toEqual({
      kind: "result",
      risk: "HIGH",
      reason:
        "This is likely a higher-impact choice because it is mostly sugary or refined carbs.",
      // HIGH is swap-led (2026-07-16 panel): the model's "keep it, but pair it"
      // adjustment is suppressed server-side before the user ever sees it.
      adjustment: null,
      swap: "If you have the option, swap to a less sweet or less refined version.",
      disclaimer:
        "Prediabetes Pal is informational only and is not medical advice. Talk with a doctor or registered dietitian for guidance that is specific to you."
    });
  });
});

describe("one-clarification cap (§8 / P1.3)", () => {
  // Proven-passing MODERATE shape (mirrors the plain-bagel floor test above):
  // grounded reason, one adjustment, one lower-glycemic swap.
  const moderateOutput = {
    kind: "result",
    risk: "MODERATE",
    reason:
      "This may have a higher blood-sugar impact because it leans heavily on refined carbs.",
    adjustment:
      "If practical, add protein or nonstarchy vegetables to make it easier to handle.",
    swap: "If you have the option, swap to a less refined version.",
    question: null,
    examples: [],
    policy_flags: []
  } as const;

  it("clarifies a bare ambiguous input without calling the model", async () => {
    const model = { generate: vi.fn().mockResolvedValue(moderateOutput) };

    const first = await checkFood({ food: "oatmeal", a1c: 6.1 }, { model });

    expect(first.kind).toBe("clarify");
    expect(model.generate).not.toHaveBeenCalled();
  });

  it("suppresses the second clarify on a clarified follow-up and reaches the model", async () => {
    const model = { generate: vi.fn().mockResolvedValue(moderateOutput) };

    const resolved = await checkFood(
      { food: "oatmeal", a1c: 6.1 },
      { model, clarified: true }
    );

    expect(resolved.kind).toBe("result");
    expect(model.generate).toHaveBeenCalledTimes(1);
  });

  it("suppresses a MODEL-authored second clarify on a clarified follow-up (AUD-014)", async () => {
    // `clarified` was only checked pre-model, so a model that answered the
    // follow-up with kind=clarify chained a second question past the §8 cap.
    const model = {
      generate: vi.fn().mockResolvedValue({
        kind: "clarify",
        risk: null,
        reason: null,
        adjustment: null,
        swap: null,
        question: "Is that the sweetened version?",
        examples: ["sweetened", "unsweetened"],
        policy_flags: []
      })
    };

    const response = await checkFood(
      { food: "grilled chicken with rice", a1c: 6.1 },
      { model, clarified: true }
    );

    // Conservative resolution: the calm retry, never a second question.
    expect(response.kind).toBe("retry");
    expect(model.generate).toHaveBeenCalledTimes(1);
  });

  it("still allows one model-authored clarify when the request was not a clarification answer", async () => {
    const model = {
      generate: vi.fn().mockResolvedValue({
        kind: "clarify",
        risk: null,
        reason: null,
        adjustment: null,
        swap: null,
        question: "Is that the sweetened version?",
        examples: ["sweetened", "unsweetened"],
        policy_flags: []
      })
    };

    const response = await checkFood(
      { food: "grilled chicken with rice", a1c: 6.1 },
      { model }
    );

    expect(response.kind).toBe("clarify");
  });

  it("never lets the cap bypass the carbs-only floor (silences the question, not the routing)", async () => {
    const model = { generate: vi.fn().mockResolvedValue(moderateOutput) };

    // "orange juice" is a named sugary drink → deterministic carbs_only floor.
    // Even marked clarified, the precheck must still floor it, not send a bare
    // "plain or sweetened?" — the model runs under the carbs_only flags.
    const response = await checkFood(
      { food: "orange juice", a1c: 6.1 },
      { model, clarified: true }
    );

    expect(response.kind).toBe("result");
    if (response.kind === "result") {
      expect(response.risk).not.toBe("SAFE");
    }
  });
});
