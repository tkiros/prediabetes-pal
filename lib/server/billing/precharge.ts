import { and, eq, gt, isNull, lte } from "drizzle-orm";

import { schema, type Db } from "../db";
import { recordHeartbeat } from "../heartbeat";
import type { SendEmailInput, SendEmailResult } from "../email";
import { priceVariantDisplay } from "../pricing";
import { createCancelToken } from "./cancel-token";
import { prechargeEmailText } from "./emails";
import { emitBillingEvent, type BillingTelemetryEvent } from "./telemetry";

/**
 * Task 3.3 — 2-day pre-charge sweep. Runs hourly (45 * * * *), so the
 * "about 2 days before" window is honored to ±1h. Every action is idempotent:
 * a row is emailed once, then stamped, so overlapping runs never double-send.
 * The heartbeat mirrors the pantry-sweep shape (name "trial-precharge") for
 * /api/health liveness.
 */

const WINDOW_MS = 48 * 60 * 60 * 1000;
const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export type PrechargeDeps = {
  db: () => Db;
  email: {
    send: (input: SendEmailInput) => Promise<SendEmailResult>;
  };
  now: () => Date;
  secret?: string;
};

export async function runPrechargeSweep(
  deps: PrechargeDeps
): Promise<{ sent: number }> {
  const db = deps.db();
  const now = deps.now();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  let sent = 0;

  // Trialing rows whose free week ends within the next 48h and that have not
  // yet had the pre-charge email stamped. current_period_end > now excludes
  // already-lapsed rows; <= now+48h excludes far-future ones.
  const due = await db
    .select({
      sub: schema.subscriptions,
      email: schema.users.email,
      timezone: schema.profiles.timezone
    })
    .from(schema.subscriptions)
    .innerJoin(schema.users, eq(schema.subscriptions.userId, schema.users.id))
    .leftJoin(schema.profiles, eq(schema.profiles.userId, schema.subscriptions.userId))
    .where(
      and(
        eq(schema.subscriptions.status, "trialing"),
        isNull(schema.subscriptions.preChargeEmailSentAt),
        gt(schema.subscriptions.currentPeriodEnd, now),
        lte(
          schema.subscriptions.currentPeriodEnd,
          new Date(now.getTime() + WINDOW_MS)
        )
      )
    );

  for (const { sub, email, timezone } of due) {
    // RE-03/BC-10: claim-before-send. The old shape was stamp-after-send, so
    // two overlapping runs both read the unstamped row and both emailed
    // "you'll be charged". The atomic claim (same pattern as pantry/process)
    // makes exactly one run own the send; a lost claim just moves on.
    const claimed = await db
      .update(schema.subscriptions)
      .set({ preChargeEmailSentAt: now, updatedAt: now })
      .where(
        and(
          eq(schema.subscriptions.id, sub.id),
          isNull(schema.subscriptions.preChargeEmailSentAt)
        )
      )
      .returning({ id: schema.subscriptions.id });
    if (claimed.length === 0) {
      continue; // another run claimed this row between select and update
    }

    const amountDisplay = priceVariantDisplay(sub.priceVariant);
    // FIX6: the date in the user's own timezone. Without one the server's
    // (UTC) day showed, a day late for an evening start in the Americas. No
    // profile yet → the profiles column default.
    const chargeDateText = sub.currentPeriodEnd.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      timeZone: timezone ?? "America/New_York"
    });
    const cancelToken = createCancelToken(
      sub.id,
      sub.currentPeriodEnd.getTime() + TOKEN_TTL_MS,
      deps.secret
    );
    const message = prechargeEmailText(
      appUrl,
      amountDisplay,
      chargeDateText,
      cancelToken
    );

    const result = await deps.email.send({
      to: email,
      ...message,
      category: "trial_precharge",
      idempotencyKey: `trial-precharge/${sub.id}/${sub.currentPeriodEnd.toISOString()}`
    });
    if (result.ok) {
      emitBillingEvent({
        name: "precharge_email_sent",
        priceVariant:
          (sub.priceVariant as BillingTelemetryEvent["priceVariant"]) ??
          undefined
      });
      sent += 1;
    } else {
      // Send failed: release the claim so the next hourly pass retries.
      await db
        .update(schema.subscriptions)
        .set({ preChargeEmailSentAt: null, updatedAt: now })
        .where(eq(schema.subscriptions.id, sub.id));
    }
  }

  // Liveness heartbeat for /api/health.
  await recordHeartbeat(db, "trial-precharge", now);

  return { sent };
}
