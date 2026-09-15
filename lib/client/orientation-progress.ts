import type { OrientationStepId } from "../coach/orientation";
import { guideDoorEnabled } from "../guide-door-flag";
import { orientationStore } from "./orientation-store";
import { patchOrientation } from "./remote-orientation";

/**
 * Steps of "Your first week" complete where they happen (plan Task 3.4,
 * review A-84), not only through the Done toggle on /learn/first-week. These
 * are not analytics events and never reach lib/client/analytics.ts.
 */
export type StepEvent = "check" | "idea_check" | "numbers_link" | "clinician_list" | "journey_visit";

// The steps each event can complete, earliest first: a check completes step 2,
// and the next check step 3.
// Step 6 (the dietitian row) has no event: that row ships with F-REFER (A-78), so it stays toggle-only.
const STEPS: Record<StepEvent, OrientationStepId[]> = {
  check: ["2", "3"],
  idea_check: ["4"],
  numbers_link: ["1"],
  clinician_list: ["5"],
  journey_visit: ["7"]
};

/**
 * Fire-and-forget (`void recordStepEvent(...)`); never throws. With the
 * `orient` door shut it returns before any request. Otherwise the server
 * marks the step (PATCH markNext, merged in SQL). A 401 is a guest and a 404
 * is a signed-in user with no profiles row — a guest too (ruling F-31,
 * A-92) — so the device store marks it instead. Any other answer is dropped.
 */
export async function recordStepEvent(kind: StepEvent): Promise<void> {
  if (!guideDoorEnabled("orient")) return;
  try {
    const steps = STEPS[kind];
    const status = await patchOrientation({ op: "markNext", steps });
    if (status === 401 || status === 404) orientationStore.markNext(steps);
  } catch {
    // Nothing to undo: a missed mark leaves the Done toggle to do it.
  }
}
