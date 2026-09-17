import { describe, expect, it } from "vitest";

import { nextAction } from "../../../lib/coach/next-action";
import { ORIENTATION_STEPS } from "../../../lib/coach/orientation";

/**
 * Home's ONE next-action line (C7 plan §3): three deterministic branches,
 * every one an invitation — no scoring, no scolding.
 */
describe("nextAction", () => {
  it("invites a check when nothing was checked today", () => {
    expect(nextAction({ checkedToday: false, undoneActionToday: false })).toEqual({
      text: "Check your next uncertain meal.",
      href: "/check"
    });
    // No-check wins even if a stale undone flag rides along.
    expect(
      nextAction({ checkedToday: false, undoneActionToday: true }).href
    ).toBe("/check");
  });

  it("nudges follow-through when today's check has an unmarked step", () => {
    const action = nextAction({ checkedToday: true, undoneActionToday: true });
    expect(action.href).toBe("/meals");
    // Red-team regression (2026-07-21): the line must not promise a marking
    // UI — no post-check surface renders action-done-button yet (TODOS.md).
    expect(action.text).toBe("Today's check suggested a step — did it happen?");
    expect(action.text).not.toMatch(/mark/i);
  });

  it("points at /journey when today is done", () => {
    expect(nextAction({ checkedToday: true, undoneActionToday: false })).toEqual({
      text: "See what this week taught you.",
      href: "/journey"
    });
  });

  it("never scolds: no branch mentions missing, failing, or streaks", () => {
    const all = [
      nextAction({ checkedToday: false, undoneActionToday: false }),
      nextAction({ checkedToday: true, undoneActionToday: true }),
      nextAction({ checkedToday: true, undoneActionToday: false })
    ];
    for (const action of all) {
      expect(action.text).not.toMatch(/miss|fail|streak|behind|should have/i);
      expect(action.text).not.toMatch(/%/);
    }
  });
});

describe("nextAction — the orientation week (PRD v1.1 §6 F-ORIENT, §7.4)", () => {
  const note = ORIENTATION_STEPS[4]; // step 5, href /learn/first-week#note
  const check = ORIENTATION_STEPS[1]; // step 2, href /check

  it("the day's step becomes the one next-action line, carrying the step's id (ruling F-54)", () => {
    expect(nextAction({ checkedToday: true, undoneActionToday: false, orientation: note })).toEqual({
      text: `Today's step: ${note.text}`,
      href: note.href,
      step: "5"
    });
    expect(nextAction({ checkedToday: false, undoneActionToday: false, orientation: note }).href).toBe(note.href);
    for (const step of ORIENTATION_STEPS) {
      expect(nextAction({ checkedToday: true, undoneActionToday: false, orientation: step }).step).toBe(step.id);
    }
  });

  it("the step id rides on the step branch only: every classic branch returns exactly text and href", () => {
    const classic = [
      nextAction({ checkedToday: false, undoneActionToday: false }),
      nextAction({ checkedToday: true, undoneActionToday: true }),
      nextAction({ checkedToday: true, undoneActionToday: false }),
      nextAction({ checkedToday: true, undoneActionToday: false, orientation: null }),
      // A check step before today's first check falls through to a classic branch.
      nextAction({ checkedToday: false, undoneActionToday: false, orientation: check })
    ];
    for (const action of classic) {
      expect(Object.keys(action)).toEqual(["text", "href"]);
    }
  });

  it("a check-a-meal step before today's first check yields the classic branch — the PAGE then passes null so Home renders no line (Task 3.5), the hero IS the action (owner rule 2026-08-11)", () => {
    expect(nextAction({ checkedToday: false, undoneActionToday: false, orientation: check })).toEqual({
      text: "Check your next uncertain meal.",
      href: "/check"
    });
    expect(nextAction({ checkedToday: true, undoneActionToday: false, orientation: check }).text).toBe(
      `Today's step: ${check.text}`
    );
  });

  it("null / absent orientation keeps the three classic branches", () => {
    expect(nextAction({ checkedToday: true, undoneActionToday: false, orientation: null }).href).toBe("/journey");
  });

  it("never scolds: no step line mentions missing, failing, streaks, or a percentage", () => {
    for (const step of ORIENTATION_STEPS) {
      const line = nextAction({ checkedToday: true, undoneActionToday: false, orientation: step });
      expect(line.text).not.toMatch(/miss|fail|streak|behind|should have/i);
      expect(line.text).not.toMatch(/%/);
    }
  });
});
