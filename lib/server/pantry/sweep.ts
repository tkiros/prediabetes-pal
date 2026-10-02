import { and, eq, gte, inArray, isNull, lt, or } from "drizzle-orm";

import { reapOrphanBlobs, reapPantryBlobs, type BlobLister } from "../blob";
import { schema } from "../db";
import { generateClaimToken } from "./claims";
import { intakeEmailText } from "./emails";
import { supportInbox } from "../email";
import { recordHeartbeat } from "../heartbeat";
import {
  deliverReport,
  processPantryOrder,
  type ProcessDeps
} from "./process";

/**
 * Self-healing pass (locked decision 9). Runs hourly; every action is
 * idempotent, so overlapping runs are merely wasteful, never wrong.
 * Founder alerting is one email per stuck order, keyed by the order id: the
 * durable email idempotency (email_delivery_attempts) makes each order alert
 * exactly once at any cron cadence (FIX7 — the old 2h..3h window missed most
 * orders when runs landed 3-7 h apart).
 * ponytail: the 7-day lookback must stay inside EMAIL_DELIVERY_RETENTION_MS
 * (30 days), or an order stuck past retention would alert again; an
 * alerted_at column is the upgrade if alerts ever need their own record.
 */

const EXTRACT_DEAD_MS = 15 * 60 * 1000;
const STUCK_MS = 2 * 60 * 60 * 1000;
const ALERT_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;
const RESUME_BUDGET_MS = 240_000;
// PR-4: unclaimed paid orders (buyer email + Stripe IDs, no user FK) are
// erased after this window; the claim link stops binding at the same age.
const UNCLAIMED_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;

export type SweepDeps = ProcessDeps & {
  processOrder?: typeof processPantryOrder;
  /** Injectable so tests never hit the Blob store. Absent → the real lister. */
  listBlobs?: BlobLister;
};

export async function runPantrySweep(deps: SweepDeps): Promise<{
  intakeResent: number;
  resumed: number;
  redelivered: number;
  blobsReaped: number;
  orphansReaped: number;
  alerted: number;
  erasedUnclaimed: number;
}> {
  const now = deps.now();
  const processOrder = deps.processOrder ?? processPantryOrder;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  let intakeResent = 0;
  let resumed = 0;
  let redelivered = 0;
  let alerted = 0;

  // 1. Intake emails that never went out. The raw token only ever existed in
  // the original email attempt — mint a new one (the old hash dies with it).
  const unsent = await deps.db
    .select()
    .from(schema.pantryOrders)
    .where(
      and(
        eq(schema.pantryOrders.status, "paid"),
        isNull(schema.pantryOrders.intakeEmailSentAt)
      )
    );
  for (const order of unsent) {
    const { token, tokenHash } = generateClaimToken();
    await deps.db
      .update(schema.pantryOrders)
      .set({ claimToken: tokenHash, updatedAt: now })
      .where(eq(schema.pantryOrders.id, order.id));
    const message = intakeEmailText(appUrl, token);
    const result = await deps.email.send({
      to: order.email,
      ...message,
      category: "pantry_intake",
      idempotencyKey: `pantry-intake/${order.id}/${tokenHash}`
    });
    if (result.ok) {
      await deps.db
        .update(schema.pantryOrders)
        .set({ intakeEmailSentAt: now, updatedAt: now })
        .where(eq(schema.pantryOrders.id, order.id));
      intakeResent += 1;
    }
  }

  // 2. Resume processing orders with an expired (or absent) lease.
  const resumable = await deps.db
    .select({ id: schema.pantryOrders.id })
    .from(schema.pantryOrders)
    .where(
      and(
        eq(schema.pantryOrders.status, "processing"),
        or(
          isNull(schema.pantryOrders.processingLeaseUntil),
          lt(schema.pantryOrders.processingLeaseUntil, now)
        )
      )
    );
  for (const order of resumable) {
    await processOrder(deps, order.id, RESUME_BUDGET_MS);
    resumed += 1;
  }

  // 3. A submit request that died mid-extraction leaves "extracting" behind.
  await deps.db
    .update(schema.pantryOrders)
    .set({ status: "needs_manual", updatedAt: now })
    .where(
      and(
        eq(schema.pantryOrders.status, "extracting"),
        lt(schema.pantryOrders.updatedAt, new Date(now.getTime() - EXTRACT_DEAD_MS))
      )
    );

  // 4. Ready but never delivered (email failed at process time).
  const undelivered = await deps.db
    .select()
    .from(schema.pantryOrders)
    .where(
      and(
        eq(schema.pantryOrders.status, "ready"),
        isNull(schema.pantryOrders.deliveredAt)
      )
    );
  for (const order of undelivered) {
    const ok = await deliverReport(deps, { id: order.id, email: order.email });
    if (ok) redelivered += 1;
  }

  // 4b. PR-4: unclaimed-order erasure. A paid order nobody ever claimed holds
  // the buyer's email + Stripe IDs with no user FK, so account deletion can
  // never reach it — after 90 days there is no product reason to keep it
  // (the claim link stops binding at the same age; see app/pantry/claim).
  // Refunds past 90 days go through Stripe's own records, not this row.
  const erasedUnclaimed = await deps.db
    .delete(schema.pantryOrders)
    .where(
      and(
        isNull(schema.pantryOrders.userId),
        eq(schema.pantryOrders.status, "paid"),
        lt(
          schema.pantryOrders.createdAt,
          new Date(now.getTime() - UNCLAIMED_RETENTION_MS)
        )
      )
    )
    .returning({ id: schema.pantryOrders.id });

  // 5. GC: photos whose order is done with them (delivered/canceled/manual) or
  // that are simply older than the retention ceiling — the abandoned orders no
  // terminal state ever covers. Runs AFTER phases 3 and 4 so orders that just
  // became terminal (or just got delivered) are reaped in the same pass, and it
  // doubles as the retry for anything a Blob-API outage left behind: on failure
  // deleteOrderBlobs leaves the rows unmarked, so they match again next hour.
  const blobsReaped = await reapPantryBlobs(deps.db, now, deps.deleteBlobs);

  // 5b. ORPHAN GC: objects the database cannot account for at all. Every phase
  // above starts from `pantry_photos`; an orphan is the object whose row is
  // already gone — the exact thing `DELETE users` used to leave behind, and the
  // exact thing no query over that table can ever find. This walks the store
  // instead, which is why it reclaims the pre-fix orphans nothing else can see.
  // Runs last so the rows the phases above just deleted are already accounted
  // for and never race this pass.
  const orphansReaped = await reapOrphanBlobs(
    deps.db,
    now,
    deps.listBlobs,
    deps.deleteBlobs
  );

  // 6. Founder alert for anything stuck >2h (once per order, via its key).
  const stuck = await deps.db
    .select()
    .from(schema.pantryOrders)
    .where(
      and(
        inArray(schema.pantryOrders.status, [
          "submitted",
          "extracting",
          "processing",
          "awaiting_confirm"
        ]),
        lt(schema.pantryOrders.updatedAt, new Date(now.getTime() - STUCK_MS)),
        gte(
          schema.pantryOrders.updatedAt,
          new Date(now.getTime() - ALERT_LOOKBACK_MS)
        )
      )
    );
  for (const order of stuck) {
    await deps.email.send({
      to: supportInbox(),
      subject: `Pantry order stuck >2h: ${order.id}`,
      text: `${order.id} — ${order.status} since ${order.updatedAt.toISOString()}\n\nHandle via /admin/pantry.`,
      category: "pantry_alert",
      idempotencyKey: `pantry-stuck/${order.id}`
    });
    alerted += 1;
  }

  // 7. Liveness heartbeat for /api/health.
  await recordHeartbeat(deps.db, "pantry-sweep", now);

  return {
    intakeResent,
    resumed,
    redelivered,
    blobsReaped,
    orphansReaped,
    alerted,
    erasedUnclaimed: erasedUnclaimed.length
  };
}
