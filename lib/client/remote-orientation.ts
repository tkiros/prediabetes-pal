import type {
  OrientationState,
  OrientationStepId
} from "../coach/orientation";
import { orientationStore } from "./orientation-store";

/**
 * Server-backed orientation writes for signed-in users (PATCH /api/profile,
 * op-based — Task 3.3). Kept apart from orientation-store.ts, which is
 * device-only and never calls out (A-104). Only the week's state travels —
 * never the clinician-questions note.
 */

export type OrientationOp =
  | { op: "markDone"; step: OrientationStepId }
  | { op: "start" }
  | { op: "dismiss" }
  | { op: "restore" }
  | { op: "set"; state: OrientationState };

/** One op; the HTTP status, or 0 when the request never completed. */
export async function patchOrientation(orientation: OrientationOp): Promise<number> {
  try {
    const response = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ orientation })
    });
    return response.status;
  } catch {
    return 0;
  }
}

/**
 * Signed-in Home's writes, in order (review A-66, rulings F-27, F-32). `migrate`
 * is the page's "the server copy is still null": the device state (a guest
 * week begun before sign-in) is sent once as `set`.
 * - 200 ⇒ done.
 * - 409 ⇒ another writer got there first, so the device's done ids and
 *   dismissal are replayed as additive ops rather than dropped.
 * - 400 ⇒ the same replay. The server refuses a device start later than its
 *   own clock allows (a fast device clock), so its `start` stands in for the
 *   device's: it is sent whenever the device week had started.
 * - 404 ⇒ no profiles row (A-92): the week stays on the device, like a guest's.
 * - Anything else (offline, 5xx) leaves the server copy null for the next
 *   visit to retry — so the start stamp is held back too, because a stamped
 *   row would stop that retry for good.
 * The start (`COALESCE` server-side) runs after the migration so the two never
 * race each other. The device key is never cleared.
 *
 * Resolves true only when a migration write landed (ruling F-34): the caller
 * refreshes then, so the server renders the migrated day. It can never be
 * true with `migrate` false, and a landed write makes the server copy
 * non-null, so the refreshed page passes `migrate: false` — no refresh loop.
 */
export async function syncOrientation({
  migrate,
  start
}: {
  migrate: boolean;
  start: boolean;
}): Promise<boolean> {
  const device = orientationStore.get();
  const hasDeviceWeek =
    device.startedAt !== null || device.dismissedAt !== null || device.done.length > 0;
  let migrated = false;
  let sendStart = start;
  let startIsMigration = false;

  if (migrate && hasDeviceWeek) {
    const status = await patchOrientation({ op: "set", state: device });
    if (status === 200) {
      migrated = true;
    } else if (status === 409 || status === 400) {
      const replayed = await Promise.all([
        ...device.done.map((step) => patchOrientation({ op: "markDone", step })),
        ...(device.dismissedAt ? [patchOrientation({ op: "dismiss" })] : [])
      ]);
      migrated = replayed.includes(200);
      if (status === 400 && device.startedAt !== null) {
        sendStart = true;
        startIsMigration = true;
      }
    } else {
      return false;
    }
  }

  if (sendStart) {
    const status = await patchOrientation({ op: "start" });
    if (startIsMigration && status === 200) migrated = true;
  }
  return migrated;
}
