import { captureServerError } from "../pal/sentry-capture";
import { schema, type Db } from "./db";

/**
 * P7 observability: the two cron jobs upsert a liveness row here at the end
 * of a successful run; /api/health reads staleness off it (lib/server's own
 * health probe, not lib/pal — the engine stays untouched).
 */
export type CronName = "nudge" | "bai-weekly" | "stripe-reconcile";

/**
 * Fail-soft by design: a heartbeat write failure must never fail the cron
 * response (the whole point of the cron already ran — losing the liveness
 * stamp is a monitoring gap, not a run failure). Errors go through the same
 * capture seam the route handlers use ("route" is the closest existing
 * stage; sentry-capture.ts is a read-only import here, not modified).
 */
export async function recordHeartbeat(
  db: Db,
  name: CronName,
  now: Date
): Promise<void> {
  try {
    await db
      .insert(schema.cronHeartbeat)
      .values({ name, lastRunAt: now })
      .onConflictDoUpdate({
        target: schema.cronHeartbeat.name,
        set: { lastRunAt: now }
      });
  } catch (error) {
    await captureServerError(error, "route");
  }
}
