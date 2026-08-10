/**
 * AUD-015 / AUD-023 — the clinical routes carry no treatment instruction.
 *
 * The `clinical-possible-hypoglycemia` ledger row used to ship a 15g/15min
 * first-aid instruction as a documented "owner exception" — an explicit
 * food/dose/timing directive contradicting the declared informational-only,
 * qualitative boundary (docs/safety/claims-boundary.md), reachable in live
 * production from a bare "shaky" or "clammy". The machine gate passed green
 * because its qualitativeOnly patterns covered only mg/dL, GI, GL, and spike
 * phrasing (AUD-023).
 *
 * This is the contract-consistency rule the plan requires: EVERY active
 * clinical ledger row is checked against the banned families — grams, timed
 * rechecks, first-aid instructions, and the widened qualitativeOnly fixture
 * set. A future ledger exception fails here rather than shipping.
 */

import { describe, expect, it } from "vitest";

import { CLINICAL_ROUTES } from "../../../lib/pal/clinical-risk";
import {
  assertNoForbiddenClaims,
  PalContractError
} from "../../../lib/pal/postprocess";
import { loadSafetyContract } from "../../../lib/pal/safety-contract";

const contract = loadSafetyContract();

// The treatment/dose/timing families, asserted directly (not only via the
// fixture) so a fixture regression cannot silently reopen the hole.
const TREATMENT_FAMILIES: Array<[string, RegExp]> = [
  ["dose grams", /\b\d+(?:\.\d+)?\s*(?:grams?|g)\b/i],
  ["timed recheck", /\b(?:recheck|check again|retest)\b[^.?!]{0,40}\b\d+\s*min/i],
  ["timing window", /\b(?:in|within|after|every)\s+\d+\s*minutes?\b/i],
  ["fast-acting carbs", /\bfast[-\s]acting\s+carb/i],
  ["glucose tablets", /\bglucose\s+tablets?\b/i],
  ["named treatment foods", /\bglucose tablets|regular soda\b/i],
  // "sugar" is deliberately absent: "low-blood-sugar plan" is descriptive,
  // not a treatment food, and hyphens are word boundaries.
  ["treatment verb + food", /\b(?:take|eat|drink|have)\b[^.?!]{0,30}\b(?:carbs?|juice|soda|tablets?)\b/i]
];

describe("clinical route copy carries no treatment/dose/timing instruction", () => {
  for (const route of CLINICAL_ROUTES) {
    const copy = contract.copy.clinicalRoutes[route];

    it(`${route} copy is treatment-free`, () => {
      for (const [label, pattern] of TREATMENT_FAMILIES) {
        expect(copy, `${route} matched banned family "${label}"`).not.toMatch(
          pattern
        );
      }
    });

    it(`${route} copy passes the widened production claims gate`, () => {
      expect(() => assertNoForbiddenClaims(contract, [copy])).not.toThrow();
    });

    it(`${route} copy still routes to human care`, () => {
      expect(copy).toMatch(
        /doctor|dietitian|prescriber|pharmacist|care team|emergency|988|midwife|professional|allergy plan|whoever prepared/i
      );
    });
  }

  it("the exact retired 15g/15min instruction is rejected by the claims gate", () => {
    expect(() =>
      assertNoForbiddenClaims(contract, [
        "The widely taught first step: about 15 grams of fast-acting carbs (glucose tablets, juice, or regular soda), then recheck in 15 minutes."
      ])
    ).toThrow(PalContractError);
  });

  it("the hypoglycemia route names no food and no numbers at all", () => {
    const copy = contract.copy.clinicalRoutes.possible_hypoglycemia;
    expect(copy).not.toMatch(/\d/);
    expect(copy).not.toMatch(/juice|soda|tablet|candy|snack|carb/i);
  });
});
