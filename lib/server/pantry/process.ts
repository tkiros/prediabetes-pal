import { and, asc, eq, isNull, lt, or } from "drizzle-orm";

import { createOpenAIPalModelClient, type PalModelClient } from "../../pal/openai-client";
import { checkFood } from "../../pal/service";
import { captureServerError } from "../../pal/sentry-capture";
import { deleteBlobUrls, deleteOrderBlobs } from "../blob";
import { decryptField, encryptField } from "../crypto";
import { schema, type Db } from "../db";
import {
  sendEmail,
  type SendEmailInput,
  type SendEmailResult
} from "../email";
import { bandRepresentativeA1c } from "./band";
import { reportEmailText } from "./emails";
import { supportInbox } from "../email";

/**
 * The ONLY place pantry items are judged — and they are judged exclusively by
 * checkFood() (locked decision 1; the engine is never modified or bypassed).
 * No queue: an atomic lease claim on pantry_orders.processing_lease_until
 * prevents double-runs (browser re-invoke vs cron sweep), and a clean exit
 * inside the budget releases the lease so the next caller resumes.
 */

const LEASE_MS = 5 * 60 * 1000;
const DEFAULT_BUDGET_MS = 280_000; // clean exit before the route's 300s cap
const MAX_ATTEMPTS = 2; // one retry per item
const FOOD_MAX_LENGTH = 160; // checkFood()'s input cap

export type ReportItem = {
  name: string;
  portion: string | null;
  reason: string;
  adjustment: string | null;
  swap: string | null;
};

export type PantryReport = {
  generatedAt: string;
  a1cBand: string;
  counts: { safe: number; moderate: number; high: number; failed: number };
  sections: {
    safe: ReportItem[];
    moderate: ReportItem[];
    high: ReportItem[];
    failed: { name: string }[];
  };
  disclaimer: string;
};

export type ProcessDeps = {
  db: Db;
  model: PalModelClient;
  email: {
    send: (input: SendEmailInput) => Promise<SendEmailResult>;
  };
  deleteBlobs: (urls: string[]) => Promise<void>;
  now: () => Date;
};

export function defaultProcessDeps(db: Db): ProcessDeps {
  return {
    db,
    model: createOpenAIPalModelClient(),
    email: { send: sendEmail },
    deleteBlobs: deleteBlobUrls,
    now: () => new Date()
  };
}

export async function processPantryOrder(
  deps: ProcessDeps,
  orderId: string,
  budgetMs: number = DEFAULT_BUDGET_MS
): Promise<{ done: boolean; reason?: string }> {
  const startedAt = Date.now();
  const now = deps.now();

  // Atomic lease claim — exactly one runner wins.
  const claimed = await deps.db
    .update(schema.pantryOrders)
    .set({
      processingLeaseUntil: new Date(now.getTime() + LEASE_MS),
      updatedAt: now
    })
    .where(
      and(
        eq(schema.pantryOrders.id, orderId),
        eq(schema.pantryOrders.status, "processing"),
        or(
          isNull(schema.pantryOrders.processingLeaseUntil),
          lt(schema.pantryOrders.processingLeaseUntil, now)
        )
      )
    )
    .returning();
  if (claimed.length === 0) {
    return { done: false, reason: "not_claimable" };
  }
  const order = claimed[0];

  if (!order.a1cBand) {
    await finishNeedsManual(deps, order.id, "missing a1c band");
    return { done: true, reason: "needs_manual" };
  }
  const a1c = bandRepresentativeA1c(order.a1cBand);

  const releaseLease = () =>
    deps.db
      .update(schema.pantryOrders)
      .set({ processingLeaseUntil: null, updatedAt: deps.now() })
      .where(eq(schema.pantryOrders.id, order.id));

  // Sequential judging: confirmed items, position order, 1 retry each,
  // continue on failure, honor the budget.
  const items = await deps.db
    .select()
    .from(schema.pantryItems)
    .where(
      and(
        eq(schema.pantryItems.orderId, order.id),
        eq(schema.pantryItems.status, "confirmed")
      )
    )
    .orderBy(asc(schema.pantryItems.position));

  for (const item of items) {
    // >= so a zero budget exits before judging anything (testable boundary).
    if (Date.now() - startedAt >= budgetMs) {
      await releaseLease();
      return { done: false, reason: "budget" };
    }

    const name = decryptField(item.nameCiphertext);
    const portion = item.portionCiphertext
      ? decryptField(item.portionCiphertext)
      : null;
    const food = (portion ? `${name} (${portion})` : name).slice(
      0,
      FOOD_MAX_LENGTH
    );

    let attempts = item.attempts;
    let judged = false;
    while (attempts < MAX_ATTEMPTS && !judged) {
      attempts += 1;
      try {
        const response = await checkFood({ food, a1c }, { model: deps.model });
        if (response.kind === "result") {
          await deps.db
            .update(schema.pantryItems)
            .set({
              status: "judged",
              risk: response.risk,
              resultCiphertext: encryptField(JSON.stringify(response)),
              attempts,
              updatedAt: deps.now()
            })
            .where(eq(schema.pantryItems.id, item.id));
          judged = true;
        }
        // Non-result kinds (retry/clarify/not_food) count as an attempt —
        // checkFood already failed closed; loop once more, then mark failed.
      } catch (error) {
        await captureServerError(error, "model");
      }
    }
    if (!judged) {
      await deps.db
        .update(schema.pantryItems)
        .set({ status: "failed", attempts, updatedAt: deps.now() })
        .where(eq(schema.pantryItems.id, item.id));
    }
    // Keep the lease alive while we work.
    await deps.db
      .update(schema.pantryOrders)
      .set({ processingLeaseUntil: new Date(Date.now() + LEASE_MS) })
      .where(eq(schema.pantryOrders.id, order.id));
  }

  // Every item terminal — assemble.
  const finalItems = await deps.db
    .select()
    .from(schema.pantryItems)
    .where(eq(schema.pantryItems.orderId, order.id))
    .orderBy(asc(schema.pantryItems.position));

  const judgedItems = finalItems.filter((item) => item.status === "judged");
  if (judgedItems.length === 0) {
    await finishNeedsManual(deps, order.id, "all items failed judging");
    return { done: true, reason: "needs_manual" };
  }

  const report = buildPantryReport(order.a1cBand, finalItems, deps.now());
  await deps.db
    .update(schema.pantryOrders)
    .set({
      status: "ready",
      reportCiphertext: encryptField(JSON.stringify(report)),
      processingLeaseUntil: null,
      updatedAt: deps.now()
    })
    .where(eq(schema.pantryOrders.id, order.id));

  await deliverReport(deps, { id: order.id, email: order.email });
  return { done: true, reason: "ready" };
}

/** Send the report email; on success stamp deliveredAt and delete photos
 *  from Blob (privacy: photos live only until delivery). Reused by the sweep
 *  and admin resend. */
export async function deliverReport(
  deps: ProcessDeps,
  order: { id: string; email: string },
  idempotencySeed = `pantry-report/${order.id}`
): Promise<boolean> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const message = reportEmailText(appUrl, order.id);
  const result = await deps.email.send({
    to: order.email,
    ...message,
    category: "pantry_report",
    idempotencyKey: idempotencySeed
  });
  if (!result.ok) {
    return false; // deliveredAt stays null — the sweep retries.
  }

  await deps.db
    .update(schema.pantryOrders)
    .set({ deliveredAt: deps.now(), updatedAt: deps.now() })
    .where(eq(schema.pantryOrders.id, order.id));

  // Delivery is the happy-path deletion trigger, but no longer the only one
  // (N-23) — and deleteOrderBlobs is what stops a Blob-API outage from marking
  // the rows deleted anyway, which used to orphan the objects forever.
  await deleteOrderBlobs(deps.db, order.id, deps.deleteBlobs);
  return true;
}

async function finishNeedsManual(
  deps: ProcessDeps,
  orderId: string,
  why: string
): Promise<void> {
  await deps.db
    .update(schema.pantryOrders)
    .set({
      status: "needs_manual",
      processingLeaseUntil: null,
      updatedAt: deps.now()
    })
    .where(eq(schema.pantryOrders.id, orderId));
  // Terminal for the photos too: manual handling re-judges the extracted item
  // *text* (/admin/pantry has no photo view) — nothing downstream reads them,
  // so retaining them would only break the privacy promise (N-23).
  await deleteOrderBlobs(deps.db, orderId, deps.deleteBlobs);
  await deps.email.send({
    to: supportInbox(),
    subject: `Pantry order needs manual review: ${orderId}`,
    text: `Order ${orderId}: ${why}. Handle via /admin/pantry.`,
    category: "pantry_alert",
    idempotencyKey: `pantry-alert/${orderId}/${why}`
  });
}

function buildPantryReport(
  a1cBand: string,
  items: (typeof schema.pantryItems.$inferSelect)[],
  generatedAt: Date
): PantryReport {
  const sections: PantryReport["sections"] = {
    safe: [],
    moderate: [],
    high: [],
    failed: []
  };
  let disclaimer = "";

  for (const item of items) {
    const name = decryptField(item.nameCiphertext);
    const portion = item.portionCiphertext
      ? decryptField(item.portionCiphertext)
      : null;

    if (item.status !== "judged" || !item.resultCiphertext || !item.risk) {
      sections.failed.push({ name });
      continue;
    }
    const result = JSON.parse(decryptField(item.resultCiphertext)) as {
      reason?: string;
      adjustment?: string | null;
      swap?: string | null;
      disclaimer?: string;
    };
    disclaimer = result.disclaimer ?? disclaimer;
    const entry: ReportItem = {
      name,
      portion,
      reason: result.reason ?? "",
      adjustment: result.adjustment ?? null,
      swap: result.swap ?? null
    };
    if (item.risk === "SAFE") sections.safe.push(entry);
    else if (item.risk === "MODERATE") sections.moderate.push(entry);
    else sections.high.push(entry);
  }

  return {
    generatedAt: generatedAt.toISOString(),
    a1cBand,
    counts: {
      safe: sections.safe.length,
      moderate: sections.moderate.length,
      high: sections.high.length,
      failed: sections.failed.length
    },
    sections,
    disclaimer
  };
}
