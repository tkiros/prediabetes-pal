import { describe, expect, it } from "vitest";

import { STAGE_DESCRIPTORS, stageDescriptor } from "../../../lib/journey/stages";
import { assertNoForbiddenClaims } from "../../../lib/pal/postprocess";
import { loadSafetyContract } from "../../../lib/pal/safety-contract";

/**
 * Plan §P4.1: "The journey never claims to lower A1C, prevent diabetes, predict
 * spikes, or replace care." (global constraint §3).
 *
 * The journey copy is held to the SAME banned-claims regexes the model output is
 * held to — `assertNoForbiddenClaims` over the real safety contract fixture, not
 * a hand-copied list that could drift. Every user-facing string in every stage
 * descriptor passes through it, so a future copy edit that smuggles in "prevent",
 * "reverse", "cure", an A1C prediction, or a numeric glucose claim turns the
 * suite red.
 */

const contract = loadSafetyContract();

describe("stage descriptors carry no forbidden clinical claims", () => {
  it("there are exactly five descriptors, stages 1–5 in order", () => {
    expect(STAGE_DESCRIPTORS.map((d) => d.stage)).toEqual([1, 2, 3, 4, 5]);
  });

  it("every descriptor's copy passes the model banned-claims regexes", () => {
    for (const descriptor of STAGE_DESCRIPTORS) {
      expect(() =>
        assertNoForbiddenClaims(contract, [descriptor.name, descriptor.focus])
      ).not.toThrow();
    }
  });

  it("all descriptor copy together passes as one blob", () => {
    const allCopy = STAGE_DESCRIPTORS.flatMap((d) => [d.name, d.focus]);
    expect(() => assertNoForbiddenClaims(contract, allCopy)).not.toThrow();
  });

  it("day ranges are the plan's stages and are gap-free / non-overlapping", () => {
    expect(
      STAGE_DESCRIPTORS.map((d) => [d.startDay, d.endDay])
    ).toEqual([
      [1, 7],
      [8, 21],
      [22, 45],
      [46, 75],
      [76, 90]
    ]);
  });

  it("stageDescriptor resolves a stage number and null out of range", () => {
    expect(stageDescriptor(3)?.name).toBe("Handle real life");
    expect(stageDescriptor(null)).toBeNull();
    expect(stageDescriptor(6)).toBeNull();
    expect(stageDescriptor(0)).toBeNull();
  });
});
