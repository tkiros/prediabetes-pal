import { and, eq, notInArray, sql } from "drizzle-orm";
import type Stripe from "stripe";

import { schema, type Db } from "../db";
import { sendEmail } from "../email";
import {
  emitBillingEvent,
  latencyBucket
} from "./telemetry";
import {
  applyStripeEvent,
  type PantryEmailSender,
  type PendingEmail
} from "../../../app/api/billing/handlers";

/**
 * Durable Stripe event inbox (Task 8 / P2.2, §8 entity `billing_event_inbox`).
 *
 * The webhook verifies the signature, then hands the event here. We store it
 * FIRST (so the money path survives a crash between "signature valid" and
 * "entitlement written"), then apply the idempotent reducer inline. Duplicate
 * deliveries dedupe on the unique provider event id; a processing failure is
 * recorded with retry metadata and the reconciliation sweep (or Stripe's own
 * redelivery) reprocesses it. Once retries are exhausted the row is
 * dead-lettered and the owner is paged.
 */

// Retry ceiling before a row is dead-lettered (owner-paged). Chosen so a
// transient dependency blip (DB, Stripe API) gets several shots across the
// webhook redeliveries + hourly sweep, while a genuinely poisoned event stops
// consuming attempts within a day.
export const MAX_INBOX_ATTEMPTS = 5;

// A webhook delivered more than this after the event's `created` time is
// "delayed" — the SLO's 60-second budget was blown before we even saw it.
const DELAYED_EVENT_MS = 60_000;

export type InboxDeps = {
  now: () => Date;
  stripe?: () => Stripe;
  email?: PantryEmailSender;
  // Injectable purely so tests can assert reducer behavior without re-deriving
  // it; production always uses the real reducer.
  apply?: typeof applyStripeEvent;
};

export type InboxOutcome = "processed" | "duplicate" | "failed" | "dead_letter";

type InboxRow = typeof schema.billingEventInbox.$inferSelect;

/**
 * Store-then-process. Returns the outcome so the webhook can choose its HTTP
 * status:
 *  - "duplicate"   → the event was already processed; 200 ack, no re-apply.
 *  - "processed"   → applied now; 200 ack.
 *  - "failed"      → apply threw, attempts left; 500 so Stripe retries.
 *  - "dead_letter" → retries exhausted; 200 (retrying won't help — owner paged).
 */
export async function ingestStripeEvent(
  db: Db,
  event: Stripe.Event,
  deps: InboxDeps
): Promise<InboxOutcome> {
  const now = deps.now();

  // Delayed-event alert (SLO §13). Fire-and-forget: an alert must never change
  // how the event is processed.
  const created = typeof event.created === "number" ? event.created * 1000 : null;
  if (created !== null && now.getTime() - created > DELAYED_EVENT_MS) {
    emitBillingEvent({
      name: "stripe_event_delayed",
      provider: "stripe",
      latency: latencyBucket(now.getTime() - created)
    });
  }

  const inserted = await db
    .insert(schema.billingEventInbox)
    .values({
      provider: "stripe",
      providerEventId: event.id,
      eventType: event.type,
      // Store only the exact fields our reducer can consume. Stripe events can
      // contain buyer names, addresses, emails, phone numbers, descriptions,
      // and provider expansion objects that are unnecessary for recovery.
      payload: minimizeBillingPayload(event) as unknown as Record<
        string,
        unknown
      >,
      status: "pending",
      receivedAt: now
    })
    .onConflictDoNothing({
      target: schema.billingEventInbox.providerEventId
    })
    .returning();

  let row = inserted[0];
  if (!row) {
    // Conflict: a row already exists for this event id. A processed or
    // dead-lettered row is done — ack without re-applying. A pending/failed
    // row means an earlier delivery never finished; the redelivery is doing us
    // a favor, so reprocess it.
    [row] = await db
      .select()
      .from(schema.billingEventInbox)
      .where(eq(schema.billingEventInbox.providerEventId, event.id));
    if (!row) {
      // Vanishingly unlikely (deleted between conflict and read) — treat as
      // duplicate rather than crash the webhook.
      return "duplicate";
    }
    if (row.status === "processed") {
      return "duplicate";
    }
    if (row.status === "dead_letter") {
      return "dead_letter";
    }
  }

  return processInboxRow(db, row, deps);
}

/**
 * Apply one stored inbox row's event inside a transaction. Marks it processed
 * on success; on failure the transaction rolls back any partial reducer writes
 * and the error/attempts are recorded outside it. Dead-letters once the retry
 * ceiling is hit.
 *
 * Concurrency (reviewer finding #1): the whole apply runs in a transaction that
 * FIRST re-reads the inbox row `FOR UPDATE`, so two concurrent deliveries of the
 * SAME event serialize — the loser blocks, then sees `processed` and skips (no
 * double reducer run, no duplicate telemetry/email). DISTINCT events touching
 * the same subscription serialize on the subscription row: the reducer's
 * pre-write reads take `FOR UPDATE` too (handlers.ts), so a `subscription.updated`
 * that would overwrite a just-committed `refunded` blocks, re-reads `refunded`,
 * and its terminal guard returns — no lost-update resurrection.
 *
 * (PGlite is single-connection, so true parallel interleaving can't be
 * reproduced in tests; the transactional/rollback path is covered serially and
 * the FOR UPDATE semantics are what protect the real node-postgres pool.)
 *
 * Idempotent regardless: the reducer is safe to re-run, so reprocessing a
 * partially-applied event never corrupts state.
 */
export async function processInboxRow(
  db: Db,
  row: InboxRow,
  deps: InboxDeps
): Promise<InboxOutcome> {
  const now = deps.now();
  const apply = deps.apply ?? applyStripeEvent;

  // One-way backfill for rows written before payload minimization shipped.
  // This is intentionally outside the reducer transaction: even when apply
  // fails again, raw provider PII must not survive in a failed/dead-letter row.
  const storedPayload = row.payload as Record<string, unknown>;
  if (storedPayload._pal_minimized !== 1) {
    const minimized = minimizeBillingPayload(
      storedPayload as unknown as Stripe.Event
    ) as unknown as Record<string, unknown>;
    await db
      .update(schema.billingEventInbox)
      .set({ payload: minimized })
      .where(
        and(
          eq(schema.billingEventInbox.id, row.id),
          notInArray(schema.billingEventInbox.status, [
            "processed",
            "dead_letter"
          ])
        )
      );
  }

  // B4: emails the reducer wants sent. Collected INSIDE the transaction, but
  // dispatched only AFTER it commits — an email must never escape a rolled-back
  // transaction (duplicate dunning, an orphaned claim token).
  let pendingEmails: PendingEmail[] = [];

  try {
    let applied = false;
    await db.transaction(async (tx) => {
      // Lock + re-read the inbox row: serializes concurrent processing of this
      // exact event. A row another worker already finished is a no-op.
      const [locked] = await tx
        .select()
        .from(schema.billingEventInbox)
        .where(eq(schema.billingEventInbox.id, row.id))
        .for("update");
      if (
        !locked ||
        locked.status === "processed" ||
        locked.status === "dead_letter"
      ) {
        return;
      }

      const event = locked.payload as unknown as Stripe.Event;
      // No email sender passed: the reducer COLLECTS its emails and returns
      // them (it never sends inside this tx). `?? []` tolerates an injected
      // test `apply` that returns void.
      pendingEmails = (await apply(tx, event, now, deps.stripe)) ?? [];
      await tx
        .update(schema.billingEventInbox)
        .set({
          status: "processed",
          lastError: null,
          processedAt: now,
          // BC-8/PR-1: the reducer is done with this event — buyer PII
          // (email, name, address) has no reason to outlive processing, and
          // the inbox has no user FK so account deletion can never reach it.
          // The redacted payload keeps the structural fields the reconcile
          // charge scan still reads (billing_reason, subscription refs).
          payload: redactBillingPayload(
            locked.payload as Record<string, unknown>
          )
        })
        .where(eq(schema.billingEventInbox.id, row.id));
      applied = true;
    });
    if (!applied) {
      // Another worker had already processed it — a duplicate from this
      // caller's point of view, never a re-apply. Nothing to dispatch.
      return "duplicate";
    }
  } catch (error) {
    // The transaction rolled back every partial reducer write AND discarded the
    // collected emails (they were never dispatched). Record the failed attempt
    // outside it so the counter is durable.
    //
    // B1: increment `attempts` off the DB value (SQL `attempts + 1`), not the
    // possibly-stale passed row, so concurrent failures never lose an increment;
    // and guard the WHERE so a row a concurrent worker has already `processed`
    // (or dead-lettered) is NEVER overwritten back to failed/dead_letter. The
    // returned row drives the dead-letter page: we alert only if THIS write is
    // the one that dead-lettered it.
    const updated = await db
      .update(schema.billingEventInbox)
      .set({
        status: sql`CASE WHEN ${schema.billingEventInbox.attempts} + 1 >= ${MAX_INBOX_ATTEMPTS} THEN 'dead_letter' ELSE 'failed' END`,
        attempts: sql`${schema.billingEventInbox.attempts} + 1`,
        lastError: errorMessage(error)
      })
      .where(
        and(
          eq(schema.billingEventInbox.id, row.id),
          notInArray(schema.billingEventInbox.status, [
            "processed",
            "dead_letter"
          ])
        )
      )
      .returning({ status: schema.billingEventInbox.status });

    if (updated.length === 0) {
      // A concurrent worker finished (or dead-lettered) this row first; our
      // failed attempt neither counts nor pages.
      return "duplicate";
    }

    const finalStatus = updated[0].status;
    if (finalStatus === "dead_letter") {
      // Page the owner: an event we can never apply is a charged user with no
      // automatic path left.
      emitBillingEvent({
        name: "stripe_inbox_dead_letter",
        provider: "stripe",
        count: 1
      });
    }
    return finalStatus === "dead_letter" ? "dead_letter" : "failed";
  }

  // Committed. Dispatch the collected emails now (B4). A send failure never
  // re-runs the reducer. Pantry delivery remains durable on the committed
  // order row (`intake_email_sent_at IS NULL`) and the Pantry sweep retries it;
  // the stamp records a real successful send only.
  await dispatchPendingEmails(db, pendingEmails, deps.email, now);
  return "processed";
}

/**
 * Send the emails a committed reducer collected. Post-commit delivery failure
 * never throws into the money path. Reducers that need delivery recovery must
 * persist their own pending state in the same transaction (Pantry does this on
 * `pantry_orders`); duplicate provider delivery re-dispatches nothing because
 * the inbox already dedupes it to "duplicate".
 */
async function dispatchPendingEmails(
  db: Db,
  emails: PendingEmail[],
  email: PantryEmailSender | undefined,
  now: Date
): Promise<void> {
  if (emails.length === 0) {
    return;
  }
  const send = email?.send ?? sendEmail;
  for (const msg of emails) {
    let result;
    try {
      result = await send({
        to: msg.to,
        subject: msg.subject,
        text: msg.text,
        category: msg.category,
        idempotencyKey: msg.idempotencyKey
      });
    } catch {
      continue; // Never let a post-commit send failure surface as a retry.
    }
    if (result?.ok && msg.onSent) {
      try {
        await msg.onSent(db, now);
      } catch {
        // Stamp is best-effort; the email did go out.
      }
    }
  }
}

function errorMessage(error: unknown): string {
  const details = error as {
    name?: unknown;
    code?: unknown;
    type?: unknown;
    statusCode?: unknown;
  };
  const name = safeDiagnosticToken(details?.name) ?? "Error";
  const code =
    safeDiagnosticToken(details?.code) ?? safeDiagnosticToken(details?.type);
  const status =
    typeof details?.statusCode === "number" &&
    Number.isInteger(details.statusCode) &&
    details.statusCode >= 100 &&
    details.statusCode <= 599
      ? String(details.statusCode)
      : null;
  return [name, code, status].filter(Boolean).join(":").slice(0, 100);
}

function safeDiagnosticToken(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const token = value.trim();
  return /^[A-Za-z0-9_.-]{1,40}$/.test(token) ? token : null;
}

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function providerId(value: unknown): string | null {
  if (typeof value === "string") {
    return value;
  }
  const id = asRecord(value).id;
  return typeof id === "string" ? id : null;
}

function compact(value: JsonRecord): JsonRecord {
  return Object.fromEntries(
    Object.entries(value).filter(([, inner]) => inner !== undefined)
  );
}

/**
 * Allowlist a verified Stripe event down to the reducer's replay contract.
 * No customer profile, email, address, phone, free text, or expanded object is
 * retained. Provider ids remain because they are the idempotency/recovery keys.
 */
export function minimizeBillingPayload(event: Stripe.Event): Stripe.Event {
  const source = asRecord(event);
  const data = asRecord(source.data);
  const object = asRecord(data.object);
  const type = typeof source.type === "string" ? source.type : "unknown";
  let minimizedObject: JsonRecord = compact({ id: providerId(object) ?? undefined });
  let previousAttributes: JsonRecord | undefined;

  if (type === "checkout.session.completed") {
    const metadata = asRecord(object.metadata);
    minimizedObject = compact({
      id: providerId(object) ?? undefined,
      mode: typeof object.mode === "string" ? object.mode : undefined,
      client_reference_id:
        typeof object.client_reference_id === "string"
          ? object.client_reference_id
          : undefined,
      subscription: providerId(object.subscription) ?? undefined,
      payment_intent: providerId(object.payment_intent) ?? undefined,
      metadata:
        typeof metadata.terms_version === "string"
          ? { terms_version: metadata.terms_version }
          : undefined
    });
  } else if (type === "invoice.paid" || type === "invoice.payment_failed") {
    const parent = asRecord(object.parent);
    const subscriptionDetails = asRecord(parent.subscription_details);
    const subscription =
      providerId(subscriptionDetails.subscription) ??
      providerId(object.subscription);
    minimizedObject = compact({
      id: providerId(object) ?? undefined,
      billing_reason:
        typeof object.billing_reason === "string"
          ? object.billing_reason
          : undefined,
      parent: subscription
        ? { subscription_details: { subscription } }
        : undefined,
      subscription: subscription ?? undefined
    });
  } else if (
    type === "customer.subscription.updated" ||
    type === "customer.subscription.deleted"
  ) {
    const items = asRecord(object.items);
    const firstItem = Array.isArray(items.data)
      ? asRecord(items.data[0])
      : {};
    const previous = asRecord(data.previous_attributes);
    minimizedObject = compact({
      id: providerId(object) ?? undefined,
      status: typeof object.status === "string" ? object.status : undefined,
      cancel_at_period_end:
        typeof object.cancel_at_period_end === "boolean"
          ? object.cancel_at_period_end
          : undefined,
      items:
        typeof firstItem.current_period_end === "number"
          ? { data: [{ current_period_end: firstItem.current_period_end }] }
          : undefined
    });
    previousAttributes =
      typeof previous.status === "string"
        ? { status: previous.status }
        : undefined;
  } else if (type === "charge.refunded") {
    minimizedObject = compact({
      id: providerId(object) ?? undefined,
      refunded:
        typeof object.refunded === "boolean" ? object.refunded : undefined,
      payment_intent: providerId(object.payment_intent) ?? undefined,
      invoice: providerId(object.invoice) ?? undefined
    });
  }

  return compact({
    _pal_minimized: 1,
    id: typeof source.id === "string" ? source.id : undefined,
    type,
    created:
      typeof source.created === "number" && Number.isFinite(source.created)
        ? source.created
        : undefined,
    data: compact({
      object: minimizedObject,
      previous_attributes: previousAttributes
    })
  }) as unknown as Stripe.Event;
}

// BC-8/PR-1: buyer-identifying keys removed (recursively) from a processed
// event's stored payload. Denylist, not allowlist, so the structural fields
// the reconcile charge scan needs (billing_reason, parent.subscription_details,
// ids, amounts) survive untouched.
const PII_PAYLOAD_KEYS = new Set([
  "customer_details",
  "customer_email",
  "customer_name",
  "customer_address",
  "customer_shipping",
  "billing_details",
  "receipt_email",
  "shipping",
  "email",
  "name",
  "address",
  "phone"
]);

/** Deep-copy `value` with every PII key dropped. Exported for tests. */
export function redactBillingPayload<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => redactBillingPayload(item)) as unknown as T;
  }
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, inner] of Object.entries(value)) {
      if (PII_PAYLOAD_KEYS.has(key)) {
        continue;
      }
      out[key] = redactBillingPayload(inner);
    }
    return out as T;
  }
  return value;
}
