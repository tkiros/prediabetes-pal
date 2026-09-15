// tests/unit/pal/orientation.test.ts
import { describe, expect, it } from "vitest";

import { dayKeyInTimezone, dayKeyLocal } from "../../../lib/coach/days";
import {
  currentOrientationStep,
  EMPTY_ORIENTATION,
  homeOrientation,
  ORIENTATION_STEPS,
  orientationDay,
  OrientationStateSchema,
  type OrientationState
} from "../../../lib/coach/orientation";

describe("orientation week (PRD v1.1 §6 F-ORIENT)", () => {
  it("has exactly seven steps, ids 1..7, each with an in-app route or an external action", () => {
    expect(ORIENTATION_STEPS.map((s) => s.id)).toEqual(["1", "2", "3", "4", "5", "6", "7"]);
    for (const step of ORIENTATION_STEPS) {
      expect(step.href).toMatch(/^\/(?:learn|check|home|journey|guides)/);
      expect(step.text.length).toBeGreaterThan(10);
    }
  });

  it("no step is a diet, a target, a food ban, or a plan (acceptance)", () => {
    for (const step of ORIENTATION_STEPS) {
      expect(step.text).not.toMatch(/your plan|follow this|avoid|cut out|no more|target|goal|lower|prevent|reverse|manage|control/i);
      expect(step.text).not.toMatch(/\d+\s*(?:g|grams|carbs|calories|%)/i);
    }
  });

  it("day math: 1-based from startedAt, calendar days from the caller's DayKeyFn, 8+ once the week is over", () => {
    const started = new Date(2026, 8, 10, 22, 0); // Sep 10, 22:00 local
    expect(orientationDay(started, dayKeyLocal, new Date(2026, 8, 10, 23, 0))).toBe(1);
    expect(orientationDay(started, dayKeyLocal, new Date(2026, 8, 11, 1, 0))).toBe(2);
    expect(orientationDay(started, dayKeyLocal, new Date(2026, 8, 16, 12, 0))).toBe(7);
    expect(orientationDay(started, dayKeyLocal, new Date(2026, 8, 17, 12, 0))).toBe(8);
    expect(orientationDay(started.toISOString(), dayKeyLocal, new Date(2026, 8, 12))).toBe(3);
  });

  it("the day rolls over at the user's midnight, not the server's (review A-06)", () => {
    // 20:00Z on Sep 10 is already Sep 11 in Kiritimati (UTC+14); 09:00Z on Sep 11 is still Sep 11 there.
    const started = "2026-09-10T20:00:00Z";
    const now = new Date("2026-09-11T09:00:00Z");
    expect(orientationDay(started, dayKeyInTimezone("Pacific/Kiritimati"), now)).toBe(1);
    expect(orientationDay(started, dayKeyInTimezone("UTC"), now)).toBe(2);
  });

  it("an unparseable start reads as the week being over, never Day NaN (review A-24)", () => {
    expect(orientationDay("not a date", dayKeyLocal)).toBe(8);
    expect(orientationDay("not a date", dayKeyInTimezone("UTC"))).toBe(8);
  });

  it("current step: the day's step unless done, then the earliest undone; null when dismissed or over", () => {
    expect(currentOrientationStep(EMPTY_ORIENTATION, 3)?.id).toBe("3");
    const at = (state: Omit<OrientationState, "startedAt">): OrientationState => ({ ...state, startedAt: null });
    expect(currentOrientationStep(at({ done: ["3"], dismissedAt: null }), 3)?.id).toBe("1");
    expect(currentOrientationStep(at({ done: ["1", "2", "3"], dismissedAt: null }), 3)?.id).toBe("4");
    expect(currentOrientationStep(at({ done: [], dismissedAt: "2026-09-12T00:00:00Z" }), 3)).toBeNull();
    expect(currentOrientationStep(EMPTY_ORIENTATION, 8)).toBeNull();
    expect(currentOrientationStep(at({ done: ["1", "2", "3", "4", "5", "6", "7"], dismissedAt: null }), 5)).toBeNull();
  });

  it("state schema is strict and bounded (it is stored server-side for signed-in users)", () => {
    expect(OrientationStateSchema.safeParse({ done: ["1", "7"], dismissedAt: null, startedAt: null }).success).toBe(true);
    expect(OrientationStateSchema.safeParse({ done: ["8"], dismissedAt: null, startedAt: null }).success).toBe(false);
    expect(OrientationStateSchema.safeParse({ done: [], dismissedAt: null, startedAt: null, note: "x" }).success).toBe(false);
    expect(OrientationStateSchema.safeParse({ done: [], dismissedAt: null, startedAt: "not a date" }).success).toBe(false);
  });
});

describe("homeOrientation — which week Home shows (review A-66, ruling F-24)", () => {
  const now = new Date(2026, 8, 15, 12, 0); // Sep 15, noon local
  const at = (d: number) => new Date(2026, 8, d, 9, 0).toISOString();
  const week = (startedAt: string | null, extra: Partial<OrientationState> = {}): OrientationState => ({
    ...EMPTY_ORIENTATION,
    startedAt,
    ...extra
  });

  it("a set start is the week's start, whatever onboardedAt says", () => {
    expect(homeOrientation(week(at(12)), at(1), dayKeyLocal, now)).toEqual({
      day: 4,
      step: ORIENTATION_STEPS[3],
      needsStart: false
    });
    expect(homeOrientation(week(at(12)), null, dayKeyLocal, now)?.day).toBe(4);
  });

  it("no start and a profile younger than seven days ⇒ day 1, and the caller stamps the start", () => {
    for (const onboarded of [at(15), at(9), new Date(2026, 8, 9, 9, 0)]) {
      expect(homeOrientation(EMPTY_ORIENTATION, onboarded, dayKeyLocal, now)).toEqual({
        day: 1,
        step: ORIENTATION_STEPS[0],
        needsStart: true
      });
    }
  });

  it("no start and no young profile ⇒ no week (the start is never read from onboardedAt)", () => {
    for (const onboarded of [at(8), "2026-01-01T00:00:00.000Z", "not a date", null, undefined]) {
      expect(homeOrientation(EMPTY_ORIENTATION, onboarded, dayKeyLocal, now)).toBeNull();
    }
  });

  it("no step ⇒ no week to show and nothing to stamp (dismissed, all done, or over)", () => {
    expect(homeOrientation(week(null, { dismissedAt: at(14) }), at(14), dayKeyLocal, now)).toBeNull();
    expect(homeOrientation(week(at(15), { dismissedAt: at(15) }), null, dayKeyLocal, now)).toBeNull();
    expect(homeOrientation(week(at(5)), null, dayKeyLocal, now)).toBeNull();
    const all = ORIENTATION_STEPS.map((step) => step.id);
    expect(homeOrientation(week(at(14), { done: all }), null, dayKeyLocal, now)).toBeNull();
  });
});
