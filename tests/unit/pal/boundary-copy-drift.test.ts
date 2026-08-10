import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  BELOW_RANGE_MESSAGE,
  BOUNDARY_COPY_VERSION,
  BOUNDARY_DISCLAIMER,
  HIGH_RANGE_MESSAGE
} from "../../../lib/pal/boundary-copy";
import { buildOutOfScopeResponse } from "../../../lib/pal/fallback";
import { loadSafetyContract } from "../../../lib/pal/safety-contract";

const ROOT = process.cwd();
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), "utf8");

/**
 * Drift guard (Task P1.2 — one clinical and boundary copy source).
 *
 * `lib/pal/boundary-copy.ts` holds the client-safe literals every surface
 * renders — onboarding is a client component and cannot read the ledger from
 * disk (fs), which is why the strings were hardcoded and then drifted. Those
 * literals MUST stay byte-for-byte equal to the approved + active rows that
 * `loadSafetyContract()` extracts from `docs/safety/copy-ledger.md`. This suite
 * fails if either the module OR the ledger moves alone — the entire point of
 * single-sourcing. A meaning change requires editing BOTH the ledger and the
 * module together, with the safety owner's sign-off and a migration note.
 */
describe("boundary copy is single-sourced from the copy ledger", () => {
  const contract = loadSafetyContract();

  it("the module below-range string equals the approved below-range-route row", () => {
    expect(BELOW_RANGE_MESSAGE).toBe(contract.copy.belowRangeRoute);
  });

  it("the module high-range string equals the approved high-range-route row", () => {
    expect(HIGH_RANGE_MESSAGE).toBe(contract.copy.highRangeRoute);
  });

  it("the module disclaimer equals the approved result-footer row", () => {
    expect(BOUNDARY_DISCLAIMER).toBe(contract.copy.disclaimer);
  });

  it("carries a non-empty copy version identifier", () => {
    expect(BOUNDARY_COPY_VERSION).toMatch(/\S/);
  });
});

describe("every consuming surface renders the module strings", () => {
  const contract = loadSafetyContract();

  it("buildOutOfScopeResponse(below) message is the module below-range string", () => {
    const res = buildOutOfScopeResponse(contract, "below_prediabetes_range");
    expect(res).toMatchObject({
      kind: "out_of_scope",
      message: BELOW_RANGE_MESSAGE
    });
  });

  it("buildOutOfScopeResponse(high) message is the module high-range string", () => {
    const res = buildOutOfScopeResponse(
      contract,
      "diabetes_range_out_of_scope"
    );
    expect(res).toMatchObject({
      kind: "out_of_scope",
      message: HIGH_RANGE_MESSAGE
    });
  });

  // Source-level guard (copy-pins.test.ts pattern): the surfaces that render
  // boundary copy must IMPORT it from the module, never retype the literals.
  // A future re-hardcode — the exact regression that produced this drift — is
  // caught here rather than shipping a second, silently-diverging copy.
  it("onboarding and profile route import boundary copy and carry no inline literal", () => {
    for (const rel of [
      "app/(app)/onboarding/page.tsx",
      "app/api/profile/route.ts"
    ]) {
      const src = read(rel);
      expect(
        src,
        `${rel} must import from lib/pal/boundary-copy`
      ).toMatch(/from\s+["'].*pal\/boundary-copy["']/);
      expect(
        src,
        `${rel} must not retype the below-range literal`
      ).not.toContain("This value sits below that range");
      expect(
        src,
        `${rel} must not retype a high-range literal`
      ).not.toContain("Type 2 diabetes");
      expect(
        src,
        `${rel} must not retype the drifted high-range literal`
      ).not.toContain("prediabetes-only MVP");
    }
  });
});
