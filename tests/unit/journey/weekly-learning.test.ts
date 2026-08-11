import { describe, expect, it } from "vitest";

import {
  DEFAULT_EXPLORATION,
  STAGE_KEPT_UP_EXPLORATION,
  WEEKLY_LEARNING_COPY,
  WEEKLY_LEARNING_VERSION,
  assertWeeklyBankClaimFree,
  deriveWeeklyLearning,
  experimentFromContext,
  experimentFromRepeat,
  uncertaintyFromContext,
  uncertaintyFromRepeat,
  type WeeklyLearningInputs
} from "../../../lib/journey/weekly-learning";
import { assertNoForbiddenClaims } from "../../../lib/pal/postprocess";
import { loadSafetyContract } from "../../../lib/pal/safety-contract";

const WEEK_START = "2026-07-13";

function inputs(
  overrides: Partial<WeeklyLearningInputs> = {}
): WeeklyLearningInputs {
  return {
    checks: [],
    memories: [],
    stage: null,
    ...overrides
  };
}

describe("deriveWeeklyLearning — deterministic projection", () => {
  it("empty week: zeroes, no contexts, no repeats, default next exploration", () => {
    const artifact = deriveWeeklyLearning(inputs(), WEEK_START);
    expect(artifact).toEqual({
      version: WEEKLY_LEARNING_VERSION,
      weekStart: WEEK_START,
      mealsExplored: 0,
      savedChoices: 0,
      contextsCovered: [],
      repeatedUncertainty: [],
      incompleteSteps: [],
      nextExploration: DEFAULT_EXPLORATION,
      // v2: with nothing checked and nothing saved, the experiment falls back
      // to the stage/default exploration and nothing is "open" yet.
      experiment: DEFAULT_EXPLORATION,
      uncertaintyToClose: null
    });
  });

  it("fixed fixture inputs produce the exact expected artifact", () => {
    const artifact = deriveWeeklyLearning(
      inputs({
        checks: [
          { food: "white rice", risk: "MODERATE", wasClarified: false },
          { food: "White Rice ", risk: "SAFE", wasClarified: false },
          { food: "oatmeal", risk: "SAFE", wasClarified: true },
          { food: "oatmeal", risk: "SAFE", wasClarified: false },
          { food: "grilled salmon", risk: "SAFE", wasClarified: false }
        ],
        memories: [
          { label: "breakfast", favorite: true },
          { label: "lunch", favorite: false },
          { label: "breakfast", favorite: false }
        ],
        stage: 1
      }),
      WEEK_START
    );

    expect(artifact).toEqual({
      version: "2",
      weekStart: WEEK_START,
      // distinct normalized foods: white rice, oatmeal, grilled salmon
      mealsExplored: 3,
      savedChoices: 3,
      // deduped + canonical order (breakfast before lunch)
      contextsCovered: ["breakfast", "lunch"],
      // oatmeal: 2× with a clarification → uncertain; white rice: 2× with a
      // MODERATE card → uncertain. Ordered by normalized key ("oatmeal" < "white rice").
      repeatedUncertainty: ["oatmeal", "White Rice"],
      // stage 1, only saved 3 this week → save_three MET → no incomplete steps
      incompleteSteps: [],
      nextExploration: STAGE_KEPT_UP_EXPLORATION,
      // v2 priority: a repeated-uncertain food beats everything else.
      experiment: experimentFromRepeat("oatmeal"),
      uncertaintyToClose: uncertaintyFromRepeat("oatmeal")
    });
  });

  it("repeatedUncertainty excludes foods checked twice but always clear", () => {
    const artifact = deriveWeeklyLearning(
      inputs({
        checks: [
          { food: "apple", risk: "SAFE", wasClarified: false },
          { food: "apple", risk: "SAFE", wasClarified: false },
          { food: "cake", risk: "HIGH", wasClarified: false }
        ]
      }),
      WEEK_START
    );
    // apple: 2× but always clear, no clarify → not uncertain.
    // cake: HIGH but only once → not repeated.
    expect(artifact.repeatedUncertainty).toEqual([]);
  });

  it("stage 1 with fewer than three saved surfaces the incomplete step", () => {
    const artifact = deriveWeeklyLearning(
      inputs({
        memories: [{ label: "dinner", favorite: false }],
        stage: 1
      }),
      WEEK_START
    );
    expect(artifact.incompleteSteps).toEqual([
      "Save three meals this week to get comfortable reading the card."
    ]);
    expect(artifact.nextExploration).toBe(
      "Try saving one meal you eat often, so it is ready the next time you want it."
    );
  });

  it("stage drives which intent is evaluated (stage 4 = variety)", () => {
    const fourChecks = ["a", "b", "c", "d"].map((food) => ({
      food,
      risk: "SAFE" as const,
      wasClarified: false
    }));
    const artifact = deriveWeeklyLearning(
      inputs({ checks: fourChecks, stage: 4 }),
      WEEK_START
    );
    // 4 distinct foods < 5 → variety unmet.
    expect(artifact.incompleteSteps).toEqual([
      "Add a few new meals so your choices stay varied."
    ]);
  });
});

describe("determinism + versioning", () => {
  const fixture = inputs({
    checks: [
      { food: "Bagel", risk: "MODERATE", wasClarified: true },
      { food: "bagel", risk: "HIGH", wasClarified: false }
    ],
    memories: [{ label: "restaurant", favorite: true }],
    stage: 3
  });

  it("regeneration with the same inputs + version is byte-identical", () => {
    const a = JSON.stringify(deriveWeeklyLearning(fixture, WEEK_START));
    const b = JSON.stringify(deriveWeeklyLearning(fixture, WEEK_START));
    expect(a).toBe(b);
  });

  it("output order is independent of input row order", () => {
    const reversed = inputs({
      checks: [...fixture.checks].reverse(),
      memories: [...fixture.memories].reverse(),
      stage: 3
    });
    expect(deriveWeeklyLearning(reversed, WEEK_START)).toEqual(
      deriveWeeklyLearning(fixture, WEEK_START)
    );
  });

  it("the version is stamped onto the artifact and overridable", () => {
    expect(deriveWeeklyLearning(fixture, WEEK_START).version).toBe("2");
    expect(deriveWeeklyLearning(fixture, WEEK_START, "9").version).toBe("9");
  });
});

describe("v2 experiment + uncertaintyToClose (RV-6)", () => {
  it("priority 2: with no repeats, an uncovered mealtime drives both fields", () => {
    const artifact = deriveWeeklyLearning(
      inputs({
        checks: [{ food: "salad", risk: "SAFE", wasClarified: false }],
        memories: [
          { label: "lunch", favorite: false },
          { label: "dinner", favorite: false }
        ],
        stage: 2
      }),
      WEEK_START
    );
    expect(artifact.experiment).toBe(experimentFromContext("breakfast"));
    expect(artifact.uncertaintyToClose).toBe(uncertaintyFromContext("breakfast"));
  });

  it("priority 3: no repeats and nothing saved yet — falls back to the stage exploration, nothing open", () => {
    const artifact = deriveWeeklyLearning(
      inputs({
        checks: [{ food: "salad", risk: "SAFE", wasClarified: false }],
        stage: 1
      }),
      WEEK_START
    );
    expect(artifact.experiment).toBe(artifact.nextExploration);
    expect(artifact.uncertaintyToClose).toBeNull();
  });

  it("is deterministic: same inputs, byte-identical v2 fields", () => {
    const shared = inputs({
      checks: [
        { food: "congee", risk: "MODERATE", wasClarified: false },
        { food: "congee", risk: "MODERATE", wasClarified: false }
      ],
      memories: [{ label: "dinner", favorite: false }],
      stage: 2
    });
    const a = deriveWeeklyLearning(shared, WEEK_START);
    const b = deriveWeeklyLearning(shared, WEEK_START);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.experiment).toBe(experimentFromRepeat("congee"));
  });
});

describe("no forbidden clinical claims in the fixed bank", () => {
  const contract = loadSafetyContract();

  it("every bank string passes the model banned-claims regexes", () => {
    for (const copy of WEEKLY_LEARNING_COPY) {
      expect(() => assertNoForbiddenClaims(contract, [copy])).not.toThrow();
    }
  });

  it("assertWeeklyBankClaimFree passes over the whole bank", () => {
    expect(() => assertWeeklyBankClaimFree(contract)).not.toThrow();
  });

  it("the bank has copy for all five stages, the defaults, and the v2 frames", () => {
    // 5 intents × (incomplete + exploration) + 2 defaults = 12 fixed strings,
    // + v2 (RV-6): 2 repeat frames + 8 labels × 2 context frames = 18 more.
    expect(WEEKLY_LEARNING_COPY).toHaveLength(30);
    expect(WEEKLY_LEARNING_COPY).toContain(DEFAULT_EXPLORATION);
    expect(WEEKLY_LEARNING_COPY).toContain(STAGE_KEPT_UP_EXPLORATION);
    expect(WEEKLY_LEARNING_COPY).toContain(experimentFromRepeat("your meal"));
  });
});
