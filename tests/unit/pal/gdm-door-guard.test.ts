import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { checkProductionGdmDoor, gateStatuses } from "../../../lib/gdm-door-guard";

const HEADER =
  "| Copy ID | Surface | Status | Active | Allowed Claim Class | Copy | Evidence Rows | Notes |\n" +
  "| --- | --- | --- | --- | --- | --- | --- | --- |\n";
const row = (id: string, status: string, active = "Yes") =>
  `| \`${id}\` | GDM | ${status} | ${active} | \`gdm-organiser\` | x | — | — |\n`;
const gates = (s: Record<string, string>) =>
  "| Gate | What it is | Decider | Status |\n|---|---|---|---|\n" +
  Object.entries(s).map(([gate, status]) => `| \`${gate}\` | x | Safety owner | ${status} |\n`).join("");

const ROWS = { landing: ["gdm-a"], organiser: ["gdm-b"], ideas: ["gdm-c"], read: ["gdm-d"] } as const;
const ALL_APPROVED = HEADER + ["gdm-a", "gdm-b", "gdm-c", "gdm-d"].map((id) => row(id, "Approved")).join("");
const NONE_SIGNED = gates({ S1: "Not started", S2: "Not started", S3: "Not started", S4: "Not started" });
const ALL_SIGNED = gates({ S1: "Signed", S2: "Signed", S3: "Signed", S4: "Signed" });

describe("checkProductionGdmDoor — no gate opens by accident", () => {
  it("unset is fine and opens nothing", () => {
    expect(checkProductionGdmDoor(undefined, undefined, "", "", ROWS)).toEqual({ effective: "", errors: [] });
  });

  it("refuses `1`, an unknown token, and a food surface without the organiser", () => {
    expect(checkProductionGdmDoor("1", "1", ALL_APPROVED, ALL_SIGNED, ROWS).errors[0]).toMatch(/"1" in production/);
    expect(checkProductionGdmDoor("organizer", "1", ALL_APPROVED, ALL_SIGNED, ROWS).errors[0]).toMatch(/unknown surface/);
    expect(checkProductionGdmDoor("ideas", "1", ALL_APPROVED, ALL_SIGNED, ROWS).errors.join()).toMatch(/requires "organiser"/);
  });

  // Final review F1: the frame renders gdm-landing-hero on every /gdm/* page
  // (<meta description>, og:description), a row only `landing` lists, and
  // sign-out, erase and delete land on /gdm. So an organiser without the
  // landing would publish a row the guard never checked, and 404 her exits.
  it("refuses the organiser without the landing, as it refuses a food surface without the organiser", () => {
    const check = checkProductionGdmDoor("organiser", "1", ALL_APPROVED, NONE_SIGNED, ROWS);
    expect(check.effective).toBe("");
    expect(check.errors.join()).toMatch(/surface "organiser" requires "landing"/);
    // Refused even when the landing's own rows are the unapproved ones: listing
    // `landing` is what makes the guard read them.
    const landingPending = HEADER + row("gdm-a", "Pending") + row("gdm-b", "Approved");
    expect(checkProductionGdmDoor("organiser", "1", landingPending, NONE_SIGNED, ROWS).errors.join()).toMatch(
      /requires "landing"/
    );
    expect(checkProductionGdmDoor("landing,organiser", "1", landingPending, NONE_SIGNED, ROWS).errors.join()).toMatch(
      /"gdm-a" whose Status is Pending/
    );
  });

  it("the landing opens alone, and the organiser opens with it once both surfaces' rows allow", () => {
    expect(checkProductionGdmDoor("landing", "1", ALL_APPROVED, NONE_SIGNED, ROWS)).toEqual({ effective: "landing", errors: [] });
    expect(checkProductionGdmDoor("organiser,landing", "1", ALL_APPROVED, NONE_SIGNED, ROWS)).toEqual({
      effective: "organiser,landing",
      errors: []
    });
  });

  // G-09: the revert. Unsetting the twin alone must yield a build that LOADS
  // with the door dark. If this threw, the redeploy would fail and the previous
  // deployment, door open, would keep serving through the incident.
  it("the server twin fails closed: not `1` closes every surface and is never an error", () => {
    for (const value of ["landing", "landing,organiser", "organiser,ideas,read", "1", "nonsense"]) {
      for (const twin of [undefined, "", "0", "true"]) {
        const check = checkProductionGdmDoor(value, twin, ALL_APPROVED, NONE_SIGNED, ROWS);
        expect(check.effective, `${value} / ${twin}`).toBe("");
        expect(check.errors, `${value} / ${twin}`).toEqual([]);
        expect(check.warnings?.join()).toMatch(/GDM_DOOR_ENABLED.*CLOSED/);
      }
    }
  });

  // G-31: signing a gate is the decider's act. Pinning the real file makes it a
  // two-file change, so no reviewer can miss a flipped Status cell.
  it("the real gates record reads exactly as its deciders left it", () => {
    const text = fs.readFileSync(path.join(process.cwd(), "docs/safety/gdm-gates.md"), "utf8");
    expect(Object.fromEntries(gateStatuses(text))).toEqual({
      S1: "Not started",
      S2: "Not started",
      S3: "Not started",
      S4: "Not started"
    });
  });

  // G-60: the person who edits that file is not a developer.
  it.each(["signed", "Signed ✅", "Signed 2026-10-01"])("a near-miss %j is refused, and the error says what the cell must read", (cell) => {
    const almost = gates({ S1: cell, S2: "Signed", S3: "Signed", S4: "Signed" });
    expect(checkProductionGdmDoor("organiser,ideas", "1", ALL_APPROVED, almost, ROWS).errors.join()).toMatch(
      /must read exactly "Signed"/
    );
  });

  it("no `gdm-organiser` class ⇒ nothing ships: a Pending, missing or retired row refuses its surface", () => {
    const pending = HEADER + row("gdm-a", "Pending");
    expect(checkProductionGdmDoor("landing", "1", pending, NONE_SIGNED, ROWS).errors.join()).toMatch(/gdm-a.*Pending/);
    expect(checkProductionGdmDoor("landing", "1", HEADER, NONE_SIGNED, ROWS).errors.join()).toMatch(/not in the copy ledger/);
    const retired = HEADER + row("gdm-a", "Approved", "No");
    expect(checkProductionGdmDoor("landing", "1", retired, NONE_SIGNED, ROWS).errors.join()).toMatch(/Active is No/);
  });

  it("a surface with no rows filed yet is refused", () => {
    const check = checkProductionGdmDoor("landing", "1", ALL_APPROVED, NONE_SIGNED, { ...ROWS, landing: [] });
    expect(check.errors.join()).toMatch(/no ledger rows yet/);
  });

  it("Tier 1 needs no S-gate; it opens on Approved rows alone", () => {
    expect(checkProductionGdmDoor("landing,organiser", "1", ALL_APPROVED, NONE_SIGNED, ROWS)).toEqual({
      effective: "landing,organiser",
      errors: []
    });
  });

  it("no S1–S3 ⇒ no food content; no S4 ⇒ no read — even with every row Approved", () => {
    expect(checkProductionGdmDoor("organiser,ideas", "1", ALL_APPROVED, NONE_SIGNED, ROWS).errors.join()).toMatch(
      /"ideas" needs gate S1.*Not started/
    );
    const s4Open = gates({ S1: "Signed", S2: "Signed", S3: "Signed", S4: "Not started" });
    expect(checkProductionGdmDoor("landing,organiser,ideas", "1", ALL_APPROVED, s4Open, ROWS).errors).toEqual([]);
    expect(checkProductionGdmDoor("organiser,read", "1", ALL_APPROVED, s4Open, ROWS).errors.join()).toMatch(
      /"read" needs gate S4/
    );
    expect(checkProductionGdmDoor("landing,organiser,ideas,read", "1", ALL_APPROVED, ALL_SIGNED, ROWS).errors).toEqual([]);
  });

  it("a missing or unreadable gates file fails closed", () => {
    expect(checkProductionGdmDoor("organiser,ideas", "1", ALL_APPROVED, "", ROWS).errors.join()).toMatch(/gate S1/);
    expect(gateStatuses("no table here").size).toBe(0);
  });
});
