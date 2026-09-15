"use client";

import Link from "next/link";
import { useState } from "react";

import { track } from "../lib/client/analytics";
import { orientationStore } from "../lib/client/orientation-store";
import { patchOrientation } from "../lib/client/remote-orientation";
import { useHydrated } from "../lib/client/use-hydrated";
import { dayKeyInTimezone, dayKeyLocal, type DayKeyFn } from "../lib/coach/days";
import {
  currentOrientationStep,
  EMPTY_ORIENTATION,
  ORIENTATION_STEPS,
  orientationDay,
  type OrientationState,
  type OrientationStep,
  type OrientationStepId
} from "../lib/coach/orientation";
import { IconCheck } from "./icons";

/**
 * The week on /learn/first-week (PRD v1.1 §6 F-ORIENT, Task 3.6). The server
 * page decides the mode (review A-33, ruling F-31): a guest — or a signed-in
 * user with no profiles row — keeps the week on the device; a signed-in user
 * with a row writes it through PATCH /api/profile.
 */
export type OrientationListProps =
  | { mode: "guest" }
  | { mode: "signed-in"; initialState: OrientationState; timezone: string };

type Mode = OrientationListProps["mode"];

/** What a tap needs from the component. Exported shape for the node-only test. */
export type TapContext = {
  mode: Mode;
  state: OrientationState;
  update: (next: (state: OrientationState) => OrientationState) => void;
  setFailed: (failed: boolean) => void;
};

export const SAVE_FAILED = "That didn't save just now. Tap Done again in a moment.";

/**
 * The eyebrow, today's step, and the order the steps render in. Ruling F-40:
 * additive framing, never "of 7". No start, a dismissal or a finished week ⇒
 * no day number and no today's step.
 */
function weekView(state: OrientationState, dayKey: DayKeyFn) {
  const day = state.startedAt && !state.dismissedAt ? orientationDay(state.startedAt, dayKey) : 8;
  const today = day <= 7 ? currentOrientationStep(state, day) : null;
  return {
    eyebrow: day <= 7 ? `Day ${day} of your first week` : "Your first week",
    today,
    steps: today ? [today, ...ORIENTATION_STEPS.filter((step) => step !== today)] : ORIENTATION_STEPS
  };
}

type SavedOp = { op: "markDone"; step: OrientationStepId } | { op: "dismiss" } | { op: "restore" };

/** One write; true once it landed. The device never refuses a guest's write. */
async function save(mode: Mode, op: SavedOp): Promise<boolean> {
  if (mode === "signed-in") {
    const status = await patchOrientation(op);
    return status >= 200 && status < 300;
  }
  if (op.op === "markDone") orientationStore.markDone(op.step);
  else if (op.op === "dismiss") orientationStore.dismiss();
  else orientationStore.restore();
  return true;
}

/**
 * A Done tap. Ruling F-36: one way — a pressed Done does nothing. The mark
 * shows at once; only a failed save takes it back, and the page says so.
 */
export async function tapDone(ctx: TapContext, step: OrientationStepId): Promise<void> {
  if (ctx.state.done.includes(step)) return;
  ctx.setFailed(false);
  ctx.update((state) => (state.done.includes(step) ? state : { ...state, done: [...state.done, step] }));
  if (await save(ctx.mode, { op: "markDone", step })) {
    track({ name: "orientation_step_done", props: { step } });
    return;
  }
  ctx.update((state) => ({ ...state, done: state.done.filter((id) => id !== step) }));
  ctx.setFailed(true);
}

/** "Hide this for now" / "Show it again" (ruling F-37). A failed save puts it back. */
export async function tapHide(ctx: TapContext, hide: boolean): Promise<void> {
  const before = ctx.state.dismissedAt;
  ctx.update((state) => ({ ...state, dismissedAt: hide ? new Date().toISOString() : null }));
  if (await save(ctx.mode, { op: hide ? "dismiss" : "restore" })) {
    if (hide) track({ name: "orientation_dismissed" });
    return;
  }
  // ponytail: no line for a failed Hide/Show — the reviewed failure copy names
  // Done. The control flipping back is the signal; add a row if that is not enough.
  ctx.update((state) => ({ ...state, dismissedAt: before }));
}

/** Steps 5 and 6 point at this page: 5 becomes a jump to the note, 6 plain text. */
function StepText({ step }: { step: OrientationStep }) {
  const href = step.href.replace(/^\/learn\/first-week/, "");
  return <p className="page-copy">{href ? <Link href={href}>{step.text}</Link> : step.text}</p>;
}

export function OrientationList(props: OrientationListProps) {
  const hydrated = useHydrated();
  const [local, setLocal] = useState<OrientationState | null>(
    props.mode === "signed-in" ? props.initialState : null
  );
  const [failed, setFailed] = useState(false);
  // Steps marked on this visit. Today's step is picked as if they were not
  // done yet, so the list holds still under the user's finger.
  const [tapped, setTapped] = useState<OrientationStepId[]>([]);
  // Review A-20: a guest's week is read from the device only after hydration.
  const state = local ?? (hydrated ? orientationStore.get() : EMPTY_ORIENTATION);
  const ctx: TapContext = {
    mode: props.mode,
    state,
    update: (next) => setLocal((previous) => next(previous ?? orientationStore.get())),
    setFailed
  };
  const view = weekView(
    { ...state, done: state.done.filter((id) => !tapped.includes(id)) },
    props.mode === "signed-in" ? dayKeyInTimezone(props.timezone) : dayKeyLocal
  );
  const hidden = state.dismissedAt !== null;

  return (
    <section className="surface-card hero-card">
      <h1 className="hero-eyebrow" data-testid="orientation-day">
        {view.eyebrow}
      </h1>
      {hidden ? null : (
        <ul className="orientation-steps" role="list">
          {view.steps.map((step) => {
            const done = state.done.includes(step.id);
            return (
              <li className="orientation-step" data-testid={`orientation-step-${step.id}`} key={step.id}>
                <div>
                  {step === view.today ? <p className="status-eyebrow">Today&apos;s step</p> : null}
                  <StepText step={step} />
                </div>
                <button
                  aria-label={`Done — ${step.text}`}
                  aria-pressed={done}
                  className="secondary-button orientation-done"
                  onClick={() => {
                    if (done) return;
                    setTapped((ids) => [...ids, step.id]);
                    void tapDone(ctx, step.id);
                  }}
                  type="button"
                >
                  {done ? <IconCheck size={16} /> : null}
                  Done
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <p className="field-hint" role="status">
        {failed ? SAVE_FAILED : ""}
      </p>
      <button className="link-button-plain orientation-hide" onClick={() => void tapHide(ctx, !hidden)} type="button">
        {hidden ? "Show it again" : "Hide this for now"}
      </button>
    </section>
  );
}
