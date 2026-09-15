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
 * `orient` door shut it returns before any request or device write.
 * Otherwise it does both, whatever the server answers (ruling F-53):
 * - the device week is marked (the store's own guard: started, not hidden,
 *   and it never starts a week). A signed-in user whose server copy is still
 *   null — /welcome sends a new account straight to /check, before Home has
 *   migrated the device week — would otherwise lose the step at migration.
 * - the server week is marked (PATCH markNext, merged in SQL). A guest's 401
 *   or a missing profiles row's 404 simply leaves the device mark as the one.
 */
export async function recordStepEvent(kind: StepEvent): Promise<void> {
  if (!guideDoorEnabled("orient")) return;
  try {
    const steps = STEPS[kind];
    orientationStore.markNext(steps);
    await patchOrientation({ op: "markNext", steps });
  } catch {
    // Nothing to undo: a missed mark leaves the Done toggle to do it.
  }
}
