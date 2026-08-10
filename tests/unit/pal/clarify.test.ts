import { describe, expect, it } from "vitest";

import { classifyInputBeforeModel } from "../../../lib/pal/input-precheck";
import {
  CLARIFY_QUESTIONS,
  clarifyElapsedBucket,
  clarifyReasonForQuestion,
  type ClarifyReason
} from "../../../lib/pal/clarify";

describe("clarify reason mapping", () => {
  it("maps each precheck question back to its bounded reason enum", () => {
    expect(clarifyReasonForQuestion(CLARIFY_QUESTIONS.plain_or_sweetened)).toBe(
      "plain_or_sweetened"
    );
    expect(clarifyReasonForQuestion(CLARIFY_QUESTIONS.protein_or_veg)).toBe(
      "protein_or_veg"
    );
    expect(clarifyReasonForQuestion(CLARIFY_QUESTIONS.underspecified)).toBe(
      "underspecified"
    );
  });

  it("returns null for questions that are not one of the three ambiguity reasons", () => {
    expect(clarifyReasonForQuestion("What food or meal are you checking?")).toBeNull();
    expect(clarifyReasonForQuestion("Is that the version that spikes you?")).toBeNull();
  });

  it("stays in agreement with the live precheck questions (no wording drift)", () => {
    // If the precheck's clarify wording ever changes, this pins the map to it.
    const reasons: Record<ClarifyReason, string> = {
      plain_or_sweetened: firstClarify("oatmeal"),
      protein_or_veg: firstClarify("salad"),
      underspecified: firstClarify("granola")
    };
    expect(reasons.plain_or_sweetened).toBe(CLARIFY_QUESTIONS.plain_or_sweetened);
    expect(reasons.protein_or_veg).toBe(CLARIFY_QUESTIONS.protein_or_veg);
    expect(reasons.underspecified).toBe(CLARIFY_QUESTIONS.underspecified);
  });
});

describe("clarify elapsed bucket", () => {
  it("buckets elapsed time into the three closed values", () => {
    expect(clarifyElapsedBucket(0)).toBe("lt10s");
    expect(clarifyElapsedBucket(9_999)).toBe("lt10s");
    expect(clarifyElapsedBucket(10_000)).toBe("lt60s");
    expect(clarifyElapsedBucket(59_999)).toBe("lt60s");
    expect(clarifyElapsedBucket(60_000)).toBe("gte60s");
    expect(clarifyElapsedBucket(600_000)).toBe("gte60s");
  });
});

function firstClarify(food: string): string {
  const precheck = classifyInputBeforeModel(food);
  if (precheck.kind !== "clarify") {
    throw new Error(`Expected ${food} to clarify.`);
  }
  return precheck.question;
}
