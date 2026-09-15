"use client";

import { recordStepEvent } from "../lib/client/orientation-progress";
import { OrientationNote } from "./orientation-note";

/**
 * Step 5's field on /learn/first-week, with step 5 completing on its first
 * kept save (review A-84). The page is a server component and cannot hand a
 * function down, so this client wrapper does. The field's own file stays
 * network-free: only this wrapper reaches the sender, and the callback it
 * passes takes no text.
 */
export function OrientationNoteSlot() {
  return <OrientationNote onSaved={() => void recordStepEvent("clinician_list")} />;
}
