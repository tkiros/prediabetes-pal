// lib/coach/orientation.ts
import { z } from "zod";

import type { DayKeyFn } from "./days";

/**
 * "Your first week" — orientation, not a plan (PRD v1.1 §6 F-ORIENT).
 *
 * Seven small non-clinical steps, one per day, shown after onboarding and on
 * Home until done. Every step is something the app already supports or a
 * phone call. No step is a diet, a target, or a food ban; the sequence never
 * says "your plan", "follow this to…", or any outcome (claim classes
 * product-role, launch-informational; ledger rows orientation-step-01..07).
 *
 * Content base: app/guides/prediabetes-now-what ("Calm First Steps").
 * Mechanism: lib/coach/next-action.ts, which grows from one action to this
 * seven-day sequence. Day math counts from the state's own `startedAt`;
 * `onboardedAt` only decides whether an unstarted week should start
 * (homeOrientation below, review A-66).
 *
 * Step 1 links Learn: numbers (F-NUMBERS) once it ships; until D7 resolves it
 * links the public guide, which "stays public and untouched either way".
 * Step 5's note stays on the device (lib/client/orientation-store.ts) and is
 * never sent to the server or the model.
 */
export type OrientationStepId = "1" | "2" | "3" | "4" | "5" | "6" | "7";
export type OrientationStep = { id: OrientationStepId; text: string; href: string };

// Flip to "/learn/numbers" in the F-NUMBERS PR (§2.4.1) — one edit, one place.
// Review A-45: while this points at the public guide, that page must carry no
// second-person sentence about the reader's own number (see Task 3.1 note).
export const LEARN_NUMBERS_HREF = "/guides/a1c-5-7-to-6-4";

export const ORIENTATION_STEPS: readonly OrientationStep[] = [
  { id: "1", text: "Read what the words on a result mean, in general terms.", href: LEARN_NUMBERS_HREF },
  { id: "2", text: "Describe a meal you already ate and read its label.", href: "/check" },
  { id: "3", text: "Check the meal you are least sure about.", href: "/check" },
  { id: "4", text: "Try one of today's ideas and see how it reads.", href: "/home#ideas-title" }, // A-85: no jargon
  { id: "5", text: "Write down the questions you have for your clinician.", href: "/learn/first-week#note" },
  { id: "6", text: "Book, or ask about, a dietitian appointment.", href: "/learn/first-week" }, // A-78: "#dietitian" only once F-REFER ships (an external action; the page is the destination)
  { id: "7", text: "Look back at the week on My journey.", href: "/journey" }
];

export const OrientationStateSchema = z
  .object({
    done: z.array(z.enum(["1", "2", "3", "4", "5", "6", "7"])).max(7),
    // zod 4: z.iso.datetime() (z.string().datetime() is the deprecated v3 spelling).
    dismissedAt: z.iso.datetime().nullable(),
    // Review A-05: when the week began. Null until the first flagged Home visit
    // or the tour's final button stamps it. Review A-66: nothing falls back to
    // onboardedAt for the start — see homeOrientation.
    startedAt: z.iso.datetime().nullable()
  })
  .strict();

export type OrientationState = z.infer<typeof OrientationStateSchema>;

export const EMPTY_ORIENTATION: OrientationState = { done: [], dismissedAt: null, startedAt: null };

const DAY_MS = 24 * 60 * 60 * 1000;

/** A "YYYY-MM-DD" day key as a UTC timestamp, so two keys subtract to whole days. */
function keyToUtc(key: string): number {
  const [year, month, day] = key.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

/**
 * 1 on the day the week started, 7 on its last day, 8+ afterwards. Review
 * A-06: calendar days come from the caller's DayKeyFn (lib/coach/days.ts) —
 * `dayKeyInTimezone(profile.timezone)` on the server, `dayKeyLocal` on the
 * device — so a signed-in user's day never rolls over at the server's UTC
 * midnight. Same helpers Home already uses for "today".
 */
export function orientationDay(
  startedAt: string | Date,
  dayKey: DayKeyFn,
  now: Date = new Date()
): number {
  const startDate = new Date(startedAt);
  // Review A-24: an unparseable start must read as "the week is over", never
  // as "Day NaN" (dayKeyLocal) or a RangeError from Intl (dayKeyInTimezone).
  if (Number.isNaN(startDate.getTime())) return 8;
  const start = keyToUtc(dayKey(startDate));
  const today = keyToUtc(dayKey(now));
  if (!Number.isFinite(start) || !Number.isFinite(today)) return 8;
  return Math.max(1, Math.floor((today - start) / DAY_MS) + 1);
}

/**
 * The step Home shows: today's step if it is not done, else the earliest
 * undone step (a user who skipped day 1 still gets it). Null once dismissed,
 * once every step is done, or once the week is over — the classic
 * next-action branches take over then.
 */
export function currentOrientationStep(
  state: OrientationState,
  day: number
): OrientationStep | null {
  if (state.dismissedAt || day > 7) return null;
  const done = new Set(state.done);
  const today = ORIENTATION_STEPS[day - 1];
  if (today && !done.has(today.id)) return today;
  return ORIENTATION_STEPS.find((step) => !done.has(step.id)) ?? null;
}

export type HomeOrientation = { day: number; step: OrientationStep; needsStart: boolean };

/**
 * The week Home shows, or null for none (review A-66, ruling F-24). The start
 * is `state.startedAt` and nothing else. `onboardedAt` only answers "should an
 * unstarted week start now?" — yes for a profile younger than seven days (the
 * diagnosis week, not someone who has been here for months). That render shows
 * day 1 and `needsStart` asks the caller to stamp the start. No start and no
 * young profile (or none at all) ⇒ null. A week with no step left to show
 * (dismissed, done, over) is null too, so nothing gets stamped for it.
 */
export function homeOrientation(
  state: OrientationState,
  onboardedAt: string | Date | null | undefined,
  dayKey: DayKeyFn,
  now: Date = new Date()
): HomeOrientation | null {
  let day = 1;
  if (state.startedAt) day = orientationDay(state.startedAt, dayKey, now);
  // Young = the onboarding day counts as day 1 and today is at most day 7;
  // an unparseable stamp reads as day 8, so it is never young.
  else if (!onboardedAt || orientationDay(onboardedAt, dayKey, now) > 7) return null;
  const step = currentOrientationStep(state, day);
  return step ? { day, step, needsStart: !state.startedAt } : null;
}
