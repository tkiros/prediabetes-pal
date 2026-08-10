import { createHash, createHmac } from "node:crypto";

import { eq, lt } from "drizzle-orm";
import type { WebhookEventPayload } from "resend";

import { schema, type Db } from "./db";

export const EMAIL_DELIVERY_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

export type EmailCategory =
  | "unknown"
  | "transactional"
  | "auth_magic_link"
  | "pantry_intake"
  | "pantry_report"
  | "pantry_alert"
  | "trial_precharge"
  | "payment_failed"
  | "support_case";

export type EmailDeliveryStatus =
  | "pending"
  | "accepted"
  | "sent"
  | "delivered"
  | "delayed"
  | "bounced"
  | "complained"
  | "suppressed"
  | "failed"
  | "rejected"
  | "rate_limited"
  | "transport_failed";

type BeginResult =
  | { kind: "send"; attemptId: string; idempotencyKey: string }
  | { kind: "already_accepted" }
  | { kind: "blocked"; status: number };

const ACCEPTED_STATUSES = new Set<EmailDeliveryStatus>([
  "accepted",
  "sent",
  "delivered",
  "delayed"
]);
const TERMINAL_PROVIDER_STATUSES = new Set<EmailDeliveryStatus>([
  "bounced",
  "complained",
  "suppressed",
  "failed"
]);

export function hashEmailRecipient(email: string, secret = process.env.AUTH_SECRET): string {
  if (!secret) {
    throw new Error("AUTH_SECRET is required for email delivery tracking.");
  }
  return createHmac("sha256", secret)
    .update(email.trim().toLowerCase(), "utf8")
    .digest("hex");
}

function providerIdempotencyKey(seed: string): string {
  return `pal/${createHash("sha256").update(seed, "utf8").digest("hex")}`;
}

export async function beginEmailAttempt(
  db: Db,
  input: {
    to: string;
    category: EmailCategory;
    idempotencySeed?: string;
    contentFingerprint: string;
  },
  now: Date
): Promise<BeginResult> {
  await pruneExpiredEmailAttempts(db, now);
  const recipientHash = hashEmailRecipient(input.to);
  const idempotencyKey = providerIdempotencyKey(
    input.idempotencySeed ?? input.contentFingerprint
  );

  const [suppression] = await db
    .select({ recipientHash: schema.emailSuppressions.recipientHash })
    .from(schema.emailSuppressions)
    .where(eq(schema.emailSuppressions.recipientHash, recipientHash));
  if (suppression) {
    await db
      .insert(schema.emailDeliveryAttempts)
      .values({
        recipientHash,
        idempotencyKey,
        category: input.category,
        status: "suppressed",
        lastErrorCode: "local_suppression",
        createdAt: now,
        updatedAt: now,
        expiresAt: new Date(now.getTime() + EMAIL_DELIVERY_RETENTION_MS)
      })
      .onConflictDoNothing({
        target: schema.emailDeliveryAttempts.idempotencyKey
      });
    return { kind: "blocked", status: 422 };
  }

  await db
    .insert(schema.emailDeliveryAttempts)
    .values({
      recipientHash,
      idempotencyKey,
      category: input.category,
      status: "pending",
      createdAt: now,
      updatedAt: now,
      expiresAt: new Date(now.getTime() + EMAIL_DELIVERY_RETENTION_MS)
    })
    .onConflictDoNothing({ target: schema.emailDeliveryAttempts.idempotencyKey });

  const [attempt] = await db
    .select()
    .from(schema.emailDeliveryAttempts)
    .where(eq(schema.emailDeliveryAttempts.idempotencyKey, idempotencyKey));
  if (!attempt) {
    throw new Error("Email delivery attempt could not be created.");
  }
  if (ACCEPTED_STATUSES.has(attempt.status)) {
    return { kind: "already_accepted" };
  }
  if (
    TERMINAL_PROVIDER_STATUSES.has(attempt.status) ||
    attempt.status === "rejected"
  ) {
    return { kind: "blocked", status: 422 };
  }
  return { kind: "send", attemptId: attempt.id, idempotencyKey };
}

export async function markEmailAccepted(
  db: Db,
  attemptId: string,
  providerMessageId: string,
  now: Date
): Promise<void> {
  await db.transaction(async (tx) => {
    const [attempt] = await tx
      .select()
      .from(schema.emailDeliveryAttempts)
      .where(eq(schema.emailDeliveryAttempts.id, attemptId))
      .for("update");
    if (!attempt) {
      throw new Error("Email delivery attempt disappeared before acceptance.");
    }

    const [earlyWebhook] = await tx
      .select()
      .from(schema.emailDeliveryAttempts)
      .where(
        eq(schema.emailDeliveryAttempts.providerMessageId, providerMessageId)
      )
      .for("update");
    if (earlyWebhook && earlyWebhook.id !== attempt.id) {
      await tx
        .delete(schema.emailDeliveryAttempts)
        .where(eq(schema.emailDeliveryAttempts.id, attempt.id));
      await tx
        .update(schema.emailDeliveryAttempts)
        .set({
          idempotencyKey: attempt.idempotencyKey,
          recipientHash: attempt.recipientHash,
          category: attempt.category,
          acceptedAt: now,
          updatedAt: now,
          expiresAt: new Date(now.getTime() + EMAIL_DELIVERY_RETENTION_MS)
        })
        .where(eq(schema.emailDeliveryAttempts.id, earlyWebhook.id));
      return;
    }

    await tx
      .update(schema.emailDeliveryAttempts)
      .set({
        providerMessageId,
        status: "accepted",
        lastErrorCode: null,
        acceptedAt: now,
        updatedAt: now,
        expiresAt: new Date(now.getTime() + EMAIL_DELIVERY_RETENTION_MS)
      })
      .where(eq(schema.emailDeliveryAttempts.id, attempt.id));
  });
}

export async function markEmailAttemptFailed(
  db: Db,
  attemptId: string,
  status: Extract<
    EmailDeliveryStatus,
    "rejected" | "rate_limited" | "transport_failed"
  >,
  errorCode: string,
  now: Date
): Promise<void> {
  await db
    .update(schema.emailDeliveryAttempts)
    .set({
      status,
      lastErrorCode: safeCode(errorCode),
      updatedAt: now,
      expiresAt: new Date(now.getTime() + EMAIL_DELIVERY_RETENTION_MS)
    })
    .where(eq(schema.emailDeliveryAttempts.id, attemptId));
}

export async function pruneExpiredEmailAttempts(
  db: Db,
  now: Date
): Promise<number> {
  const removed = await db
    .delete(schema.emailDeliveryAttempts)
    .where(lt(schema.emailDeliveryAttempts.expiresAt, now))
    .returning({ id: schema.emailDeliveryAttempts.id });
  return removed.length;
}

type TrackedWebhookStatus = Extract<
  EmailDeliveryStatus,
  | "sent"
  | "delivered"
  | "delayed"
  | "bounced"
  | "complained"
  | "suppressed"
  | "failed"
>;

const EVENT_STATUS: Partial<Record<WebhookEventPayload["type"], TrackedWebhookStatus>> = {
  "email.sent": "sent",
  "email.delivered": "delivered",
  "email.delivery_delayed": "delayed",
  "email.bounced": "bounced",
  "email.complained": "complained",
  "email.suppressed": "suppressed",
  "email.failed": "failed"
};

export async function recordResendWebhookEvent(
  db: Db,
  event: WebhookEventPayload,
  now: Date
): Promise<"updated" | "stale" | "ignored"> {
  const nextStatus = EVENT_STATUS[event.type];
  if (!nextStatus || !event.type.startsWith("email.")) {
    return "ignored";
  }
  const data = event.data as { email_id?: unknown; to?: unknown };
  const providerMessageId =
    typeof data.email_id === "string" ? data.email_id.trim() : "";
  const recipients = Array.isArray(data.to)
    ? data.to.filter((value): value is string => typeof value === "string")
    : [];
  const eventAt = new Date(event.created_at);
  if (
    !providerMessageId ||
    providerMessageId.length > 255 ||
    recipients.length === 0 ||
    Number.isNaN(eventAt.getTime())
  ) {
    throw new Error("Invalid Resend email webhook payload.");
  }

  await pruneExpiredEmailAttempts(db, now);
  const recipientHashes = recipients.map((email) => hashEmailRecipient(email));
  let outcome: "updated" | "stale" = "updated";

  await db.transaction(async (tx) => {
    await tx
      .insert(schema.emailDeliveryAttempts)
      .values({
        providerMessageId,
        idempotencyKey: providerIdempotencyKey(`webhook/${providerMessageId}`),
        recipientHash: recipientHashes[0],
        category: "unknown",
        status: nextStatus,
        lastErrorCode: webhookErrorCode(event, nextStatus),
        deliveredAt: nextStatus === "delivered" ? eventAt : null,
        lastEventAt: eventAt,
        createdAt: now,
        updatedAt: now,
        expiresAt: new Date(now.getTime() + EMAIL_DELIVERY_RETENTION_MS)
      })
      .onConflictDoNothing({
        target: schema.emailDeliveryAttempts.providerMessageId
      });

    const [row] = await tx
      .select()
      .from(schema.emailDeliveryAttempts)
      .where(
        eq(schema.emailDeliveryAttempts.providerMessageId, providerMessageId)
      )
      .for("update");
    if (!row) {
      throw new Error("Email delivery row could not be loaded.");
    }

    if (!shouldApplyEvent(row.status, row.lastEventAt, nextStatus, eventAt)) {
      outcome = "stale";
    } else {
      await tx
        .update(schema.emailDeliveryAttempts)
        .set({
          status: nextStatus,
          lastErrorCode: webhookErrorCode(event, nextStatus),
          ...(nextStatus === "delivered" ? { deliveredAt: eventAt } : {}),
          lastEventAt: eventAt,
          updatedAt: now,
          expiresAt: new Date(now.getTime() + EMAIL_DELIVERY_RETENTION_MS)
        })
        .where(eq(schema.emailDeliveryAttempts.id, row.id));
    }

    if (
      nextStatus === "bounced" ||
      nextStatus === "complained" ||
      nextStatus === "suppressed"
    ) {
      for (const recipientHash of recipientHashes) {
        await tx
          .insert(schema.emailSuppressions)
          .values({
            recipientHash,
            reason: nextStatus,
            providerMessageId,
            createdAt: now,
            updatedAt: now
          })
          .onConflictDoUpdate({
            target: schema.emailSuppressions.recipientHash,
            set: { reason: nextStatus, providerMessageId, updatedAt: now }
          });
      }
    }
  });

  return outcome;
}

function shouldApplyEvent(
  current: EmailDeliveryStatus,
  lastEventAt: Date | null,
  next: TrackedWebhookStatus,
  eventAt: Date
): boolean {
  if (lastEventAt && eventAt < lastEventAt) {
    return false;
  }
  if (TERMINAL_PROVIDER_STATUSES.has(current) && !TERMINAL_PROVIDER_STATUSES.has(next)) {
    return false;
  }
  if (
    current === "delivered" &&
    (next === "sent" || next === "delayed")
  ) {
    return false;
  }
  return true;
}

function webhookErrorCode(
  event: WebhookEventPayload,
  status: TrackedWebhookStatus
): string | null {
  const data = event.data as {
    bounce?: { type?: unknown; subType?: unknown };
    failed?: { reason?: unknown };
    suppressed?: { type?: unknown };
  };
  if (status === "bounced") {
    return safeCode(
      `bounce_${providerToken(data.bounce?.type)}_${providerToken(data.bounce?.subType)}`
    );
  }
  if (status === "failed") {
    return providerToken(data.failed?.reason, "failed");
  }
  if (status === "suppressed") {
    return providerToken(data.suppressed?.type, "suppressed");
  }
  return null;
}

function providerToken(value: unknown, fallback = "unknown"): string {
  if (typeof value !== "string") {
    return fallback;
  }
  const token = value.trim();
  return /^[A-Za-z0-9_.-]{1,40}$/.test(token)
    ? token.toLowerCase()
    : fallback;
}

export function safeCode(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_.-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
  return normalized || "unknown";
}

export function emailContentFingerprint(input: {
  to: string;
  subject: string;
  text: string;
  category: EmailCategory;
}): string {
  return createHash("sha256")
    .update(
      `${input.category}\0${input.to.trim().toLowerCase()}\0${input.subject}\0${input.text}`,
      "utf8"
    )
    .digest("hex");
}
