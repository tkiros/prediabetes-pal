import { describe, expect, it } from "vitest";

import {
  CheckRequestSchema,
  PalModelOutputSchema,
  palModelJsonSchema
} from "../../../lib/pal/schemas";

describe("CheckRequestSchema", () => {
  it("accepts an in-scope food request and rejects malformed values", () => {
    expect(
      CheckRequestSchema.parse({
        food: "lentil soup",
        a1c: 6.1
      })
    ).toEqual({
      food: "lentil soup",
      a1c: 6.1
    });

    const invalidRequests = [
      {},
      { food: "", a1c: 6.1 },
      { food: " ".repeat(4), a1c: 6.1 },
      { food: "x".repeat(161), a1c: 6.1 },
      { food: "lentil soup", a1c: "6.1" },
      { food: "lentil soup", a1c: -0.1 },
      { food: ["lentil soup"], a1c: 6.1 },
      { food: "lentil soup", a1c: Number.NaN }
    ];

    for (const invalidRequest of invalidRequests) {
      expect(CheckRequestSchema.safeParse(invalidRequest).success).toBe(false);
    }
  });
});

describe("palModelJsonSchema", () => {
  it("stays flat, strict, and structured-output compatible", () => {
    expect(palModelJsonSchema.type).toBe("object");
    expect(palModelJsonSchema.additionalProperties).toBe(false);
    expect(palModelJsonSchema.required).toEqual([
      "kind",
      // Composition-first fields sit BEFORE risk on purpose (doc 18 17f):
      // constrained decoding generates properties in schema order, so the
      // model commits to the dish's driver before it picks a band.
      "components",
      "glycemic_driver",
      "risk",
      "reason",
      "adjustment",
      "swap",
      "question",
      "examples",
      "policy_flags"
    ]);
    expect(palModelJsonSchema).not.toHaveProperty("anyOf");
    expect(palModelJsonSchema.properties.glycemic_driver.type).toEqual([
      "string",
      "null"
    ]);
    expect(palModelJsonSchema.properties.risk.type).toEqual([
      "string",
      "null"
    ]);
    expect(palModelJsonSchema.properties.reason.type).toEqual([
      "string",
      "null"
    ]);
    expect(palModelJsonSchema.properties.adjustment.type).toEqual([
      "string",
      "null"
    ]);
    expect(palModelJsonSchema.properties.swap.type).toEqual([
      "string",
      "null"
    ]);
    expect(palModelJsonSchema.properties.question.type).toEqual([
      "string",
      "null"
    ]);
  });
});

describe("PalModelOutputSchema", () => {
  it("rejects unknown risks, missing nullable fields, and extra properties", () => {
    const validOutput = {
      kind: "result",
      risk: "SAFE",
      reason: "This looks balanced.",
      adjustment: null,
      swap: null,
      question: null,
      examples: [],
      policy_flags: ["safe_food"]
    };

    expect(PalModelOutputSchema.parse(validOutput)).toEqual(validOutput);
    expect(
      PalModelOutputSchema.safeParse({
        ...validOutput,
        risk: "LOW"
      }).success
    ).toBe(false);
    expect(
      PalModelOutputSchema.safeParse({
        kind: "result",
        risk: "SAFE",
        reason: "This looks balanced.",
        adjustment: null,
        swap: null,
        examples: [],
        policy_flags: ["safe_food"]
      }).success
    ).toBe(false);
    expect(
      PalModelOutputSchema.safeParse({
        ...validOutput,
        extra: "nope"
      }).success
    ).toBe(false);
  });
});
