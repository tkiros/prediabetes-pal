import { describe, expect, it, vi } from "vitest";

// The onboarding page is a client component; importing it pulls the profile
// store (which touches window.localStorage) into scope, so — as in
// food-check-form.test.ts — expose a fake storage BEFORE the import.
function fakeStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
    clear: () => void map.clear()
  };
}

const storage = fakeStorage();
vi.stubGlobal("localStorage", storage);
vi.stubGlobal("window", { localStorage: storage });

import {
  nextStepAfterAttribution,
  STEP_PROGRESS,
  stepCounter
} from "../../../app/(app)/onboarding/page";

describe("nextStepAfterAttribution (single-source A1C rule)", () => {
  it("routes a device with a saved A1C straight past the A1C step", () => {
    expect(nextStepAfterAttribution(true)).toBe("expectations");
  });

  it("asks for the A1C when the device has none", () => {
    expect(nextStepAfterAttribution(false)).toBe("a1c");
  });
});

describe("stepCounter (visible Step X of N)", () => {
  it("counts 5 steps for a new user, in order, with no holes", () => {
    const path = [
      "welcome",
      "segment",
      "attribution",
      "a1c",
      "expectations"
    ] as const;
    expect(path.map((s) => stepCounter(s, false))).toEqual([
      "Step 1 of 5",
      "Step 2 of 5",
      "Step 3 of 5",
      "Step 4 of 5",
      "Step 5 of 5"
    ]);
  });

  it("counts 4 contiguous steps for a returning guest who skips a1c", () => {
    const path = ["welcome", "segment", "attribution", "expectations"] as const;
    expect(path.map((s) => stepCounter(s, true))).toEqual([
      "Step 1 of 4",
      "Step 2 of 4",
      "Step 3 of 4",
      "Step 4 of 4"
    ]);
  });

  it("shows nothing on the boundary exit and on a skipped a1c", () => {
    expect(stepCounter("boundary", false)).toBe("");
    expect(stepCounter("a1c", true)).toBe("");
  });
});

describe("STEP_PROGRESS (goal-gradient bar)", () => {
  it("never shows a visible step at zero — arriving counts as progress", () => {
    const visible = [
      "welcome",
      "segment",
      "attribution",
      "a1c",
      "expectations"
    ] as const;
    for (const step of visible) {
      expect(STEP_PROGRESS[step]).toBeGreaterThan(0);
      expect(STEP_PROGRESS[step]).toBeLessThan(100);
    }
  });

  it("only ever moves forward, on both the full and the skip-A1C path", () => {
    const full = [
      "welcome",
      "segment",
      "attribution",
      "a1c",
      "expectations"
    ] as const;
    const skipA1c = ["welcome", "segment", "attribution", "expectations"] as const;
    for (const path of [full, skipA1c]) {
      for (let i = 1; i < path.length; i++) {
        expect(STEP_PROGRESS[path[i]]).toBeGreaterThan(STEP_PROGRESS[path[i - 1]]);
      }
    }
  });
});
