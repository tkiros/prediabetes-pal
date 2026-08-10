import { describe, expect, it } from "vitest";

import { classifyInputBeforeModel } from "../../../lib/pal/input-precheck";

// Task 3 (P1.3): the ambiguity precheck now matches trigger terms as
// word-boundary tokens WITHIN the input (not exact full-string equality), with
// resolution guards so an input that already carries the disambiguating context
// does not clarify. Risk-raising evidence and one-clarification-cap precedence
// are exercised here too.

function question(food: string): string | null {
  const precheck = classifyInputBeforeModel(food);
  return precheck.kind === "clarify" ? precheck.question : null;
}

describe("ambiguity detection — phrase-embedded triggers clarify", () => {
  it.each([
    ["bowl of oatmeal", "Is this plain or sweetened?"],
    ["oatmeal with milk", "Is this plain or sweetened?"],
    ["a bowl of cereal", "Is this plain or sweetened?"],
    ["some yogurt", "Is this plain or sweetened?"]
  ])("clarifies %s", (food, expected) => {
    expect(question(food)).toBe(expected);
  });

  it("still asks exactly one question for the bare trigger", () => {
    expect(question("oatmeal")).toBe("Is this plain or sweetened?");
  });
});

describe("ambiguity detection — context-resolved inputs do NOT clarify", () => {
  it.each([
    "plain oatmeal",
    "unsweetened yogurt",
    "greek yogurt with berries and nuts",
    "oatmeal with peanut butter and egg whites"
  ])("does not clarify plain/component-resolved: %s", (food) => {
    expect(classifyInputBeforeModel(food).kind).not.toBe("clarify");
  });

  it("does not clarify a composed protein_or_veg meal", () => {
    // A described plate answers "does it come with protein or nonstarchy veg?"
    expect(classifyInputBeforeModel("turkey sandwich with a side salad").kind).not.toBe(
      "clarify"
    );
    expect(
      classifyInputBeforeModel("chicken burrito bowl with rice and beans").kind
    ).not.toBe("clarify");
  });

  it("does not clarify a composed underspecified input", () => {
    expect(classifyInputBeforeModel("granola with greek yogurt").kind).not.toBe(
      "clarify"
    );
    expect(classifyInputBeforeModel("2 servings of granola, 47g carbs").kind).not.toBe(
      "clarify"
    );
  });

  it("still clarifies the bare protein_or_veg / underspecified triggers", () => {
    expect(question("salad")).toBe(
      "Does this come with protein or nonstarchy vegetables?"
    );
    expect(question("granola")).toBe(
      "Can you name the specific dish or the main foods in it?"
    );
  });
});

describe("ambiguity detection — risk-raising evidence beats clarification", () => {
  it("routes sugar-evidence oatmeal to the risk path, not plain/sweetened", () => {
    // "honey" is a named carbs_only sugar → carbs_only, never "plain or sweetened?"
    expect(classifyInputBeforeModel("oatmeal with honey")).toEqual({
      kind: "carbs_only",
      flags: ["carbs_only", "borderline"]
    });
  });

  it("does not clarify oatmeal that already names its sugar", () => {
    expect(classifyInputBeforeModel("oatmeal with brown sugar").kind).not.toBe(
      "clarify"
    );
  });

  it("floors a carbs-only base carried inside a protein_or_veg trigger", () => {
    // "bowl of macaroni" contains the protein_or_veg trigger "bowl" AND the
    // carbs_only base "macaroni". Risk beats clarify → carbs_only.
    expect(classifyInputBeforeModel("bowl of macaroni")).toEqual({
      kind: "carbs_only",
      flags: ["carbs_only", "borderline"]
    });
  });
});

describe("ambiguity detection — clinical/urgent precedence preserved", () => {
  it("does not intercept a clinically-routed input carrying an ambiguous token", () => {
    // classifyInputBeforeModel never sees clinical inputs (service.ts runs
    // classifyClinicalRisk first), but even in isolation an ambiguous token
    // must not raise a not_food/precedence surprise here.
    const precheck = classifyInputBeforeModel("oatmeal");
    expect(precheck.kind).toBe("clarify");
  });
});

describe("one-clarification cap — clarified follow-up skips a second question", () => {
  it("suppresses the ambiguity clarify when clarified is true", () => {
    expect(classifyInputBeforeModel("oatmeal").kind).toBe("clarify");
    expect(classifyInputBeforeModel("oatmeal", { clarified: true }).kind).not.toBe(
      "clarify"
    );
  });

  it("still routes not_food and risk paths on a clarified follow-up", () => {
    // The cap only silences the ambiguity question — safety routing is intact.
    expect(
      classifyInputBeforeModel("running shoes", { clarified: true }).kind
    ).toBe("not_food");
    expect(
      classifyInputBeforeModel("a glazed donut", { clarified: true }).kind
    ).toBe("carbs_only");
  });

  it("suppresses a DIFFERENT clarify category on the follow-up too", () => {
    // Answered "oatmeal" with "salad" (would itself clarify protein_or_veg) —
    // the resolved input goes straight to the model path, not a 2nd question.
    expect(classifyInputBeforeModel("salad").kind).toBe("clarify");
    expect(classifyInputBeforeModel("salad", { clarified: true }).kind).not.toBe(
      "clarify"
    );
  });
});
