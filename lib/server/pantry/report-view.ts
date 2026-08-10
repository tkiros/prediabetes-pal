import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { captureServerError } from "../../pal/sentry-capture";
import { decryptField } from "../crypto";
import { schema, type Db } from "../db";
import type { PantryReport } from "./process";

export type ReportView =
  | { kind: "not_found" }
  | { kind: "processing" }
  /** The report exists and was paid for, but its ciphertext will not open —
   *  a key rotation that dropped the writing key, or corruption. Never a 404
   *  and never a crash: the buyer paid, so they get an honest state and a
   *  human to talk to. */
  | { kind: "unavailable" }
  | { kind: "ready"; report: PantryReport };

export async function loadReportForUser(
  db: Db,
  userId: string,
  orderId: string
): Promise<ReportView> {
  if (!z.string().uuid().safeParse(orderId).success) {
    return { kind: "not_found" };
  }
  const [order] = await db
    .select()
    .from(schema.pantryOrders)
    .where(
      and(
        eq(schema.pantryOrders.id, orderId),
        eq(schema.pantryOrders.userId, userId)
      )
    );
  if (!order || order.status === "canceled") {
    return { kind: "not_found" };
  }
  if (order.status !== "ready" || !order.reportCiphertext) {
    // The owner NEVER sees a 404 for an in-flight order (design spec).
    return { kind: "processing" };
  }

  // A rotated-away key used to throw straight out of a paid buyer's report
  // page — a 500 on the one artifact they bought (N-26).
  try {
    return {
      kind: "ready",
      report: JSON.parse(decryptField(order.reportCiphertext)) as PantryReport
    };
  } catch (error) {
    await captureServerError(error, "route");
    return { kind: "unavailable" };
  }
}
