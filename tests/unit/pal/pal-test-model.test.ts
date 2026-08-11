import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createEvalModelClient,
  type PalEvalCase
} from "../../support/pal-test-model";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("createEvalModelClient", () => {
  it("rejects mocked outputs for deterministic non-food fixtures in local mode", () => {
    vi.stubEnv("PAL_LIVE_EVAL", "0");

    const cases: PalEvalCase[] = [
      {
        id: "non-food-running-shoes",
        category: "non_food",
        input: { food: "running shoes", a1c: 6.1 },
        harmfulIfSafe: false,
        expectedKinds: ["not_food"],
        disallowRisk: ["SAFE", "MODERATE", "HIGH"],
        mockModelOutput: {
          kind: "not_food",
          risk: null,
          reason: null,
          adjustment: null,
          swap: null,
          question: null,
          examples: ["oatmeal with nuts"],
          policy_flags: ["non_food"]
        },
        notes: "Should never reach the local model seam."
      }
    ];

    expect(() => createEvalModelClient(cases)).toThrowError(
      /non_food/i
    );
  });

  it("still allows mocked outputs for categories that intentionally reach the model seam", () => {
    vi.stubEnv("PAL_LIVE_EVAL", "0");

    const cases: PalEvalCase[] = [
      {
        id: "borderline-oatmeal-banana",
        category: "borderline",
        input: { food: "oatmeal with banana", a1c: 5.9 },
        harmfulIfSafe: true,
        expectedKinds: ["result"],
        disallowRisk: ["SAFE"],
        mockModelOutput: {
          kind: "result",
          risk: "MODERATE",
          reason: "This may raise blood sugar faster because it is still carb forward.",
          adjustment: "Adding protein can make it easier to handle.",
          swap: "If you can, swap part of the banana for berries instead.",
          question: null,
          examples: [],
          policy_flags: ["borderline"]
        },
        notes: "Expected to use the local model seam."
      }
    ];

    expect(() => createEvalModelClient(cases)).not.toThrow();
  });
});
