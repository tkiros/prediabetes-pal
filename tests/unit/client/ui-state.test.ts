import { describe, expect, it } from "vitest";

import {
  type CheckUiState,
  isSlowThresholdReached,
  mapCheckFailure
} from "../../../lib/client/ui-state";

describe("CheckUiState", () => {
  it("supports idle to submitting to slow to done and error states", () => {
    const states: CheckUiState[] = [
      { kind: "idle" },
      { kind: "submitting" },
      { kind: "slow" },
      {
        kind: "done",
        response: {
          kind: "result",
          risk: "SAFE",
          reason: "Looks balanced.",
          adjustment: null,
          swap: null,
          sequencingTip: null,
          postMealAction: null,
          keepMost: null,
          disclaimer: "Not medical advice."
        }
      },
      { kind: "error", message: "Try again" }
    ];

    expect(states.map((state) => state.kind)).toEqual([
      "idle",
      "submitting",
      "slow",
      "done",
      "error"
    ]);
  });
});

describe("isSlowThresholdReached", () => {
  it("stays pending before five seconds and flips at five seconds", () => {
    expect(isSlowThresholdReached(1_000, 5_999)).toBe(false);
    expect(isSlowThresholdReached(1_000, 6_000)).toBe(true);
  });
});

describe("mapCheckFailure", () => {
  it("maps timeout, 429, network failure, and fallback errors to friendly retry copy", () => {
    expect(mapCheckFailure({ code: "timeout" })).toContain("longer than expected");
    expect(mapCheckFailure({ code: "rate_limited" })).toContain("a lot of people");
    expect(mapCheckFailure({ code: "network" })).toContain("reach Prediabetes Pal");
    expect(mapCheckFailure({ code: "retry" })).toContain("try again");
    expect(mapCheckFailure(new Error("server exploded"))).toContain("try again");
  });
});
