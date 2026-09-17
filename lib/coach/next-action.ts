/**
 * Home's ONE next-action line (C7 plan §3; design-review DV6 precedence:
 * Home = one action for TODAY; /journey owns the weekly experiment).
 * Deterministic three-branch helper — no scoring, no scolding: every branch
 * is an invitation, none reads as a missed obligation.
 */

import type { OrientationStep, OrientationStepId } from "./orientation";

export type NextActionInput = {
  /** True when the user has at least one check today. */
  checkedToday: boolean;
  /** True when a non-SAFE check today still has no "I did it" mark. */
  undoneActionToday: boolean;
  /**
   * PRD v1.1 §7.4: the orientation day's step, when a week is active (null or
   * absent otherwise). The line becomes the step; the three classic branches
   * are the fallback. Exception, keeping the 2026-08-11 owner rule: before
   * today's first check the hero IS the action, so a step that points at
   * /check would be a second way to do the same thing — it falls through.
   */
  orientation?: OrientationStep | null;
};

/**
 * `step` is set on the orientation-step branch only (ruling F-54): Home picks
 * the link that completes a step by its id. The classic branches never carry it.
 */
export type NextAction = { text: string; href: string; step?: OrientationStepId };

export function nextAction(input: NextActionInput): NextAction {
  const step = input.orientation;
  if (step && !(step.href === "/check" && !input.checkedToday)) {
    return { text: `Today's step: ${step.text}`, href: step.href, step: step.id };
  }
  if (!input.checkedToday) {
    return { text: "Check your next uncertain meal.", href: "/check" };
  }
  if (input.undoneActionToday) {
    // ponytail: the only "I did it" control lives on the result card at check
    // time — no post-hoc surface can record the mark yet (TODOS.md: Today-card
    // affordance). Until it exists, nudge the follow-through without promising
    // a button the destination doesn't have.
    return { text: "Today's check suggested a step — did it happen?", href: "/meals" };
  }
  return { text: "See what this week taught you.", href: "/journey" };
}
