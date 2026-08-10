import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { redirect } from "next/navigation";

import { PantryIntakeFlow } from "../../../components/pantry-intake-flow";
import { decryptField } from "../../../lib/server/crypto";
import { getDb, schema } from "../../../lib/server/db";
import { getSessionInfo } from "../../../lib/server/session";
import { SUPPORT_EMAIL } from "../../../lib/pal/contact";

export const metadata = {
  title: "Your Pantry Review — Prediabetes Pal",
  robots: { index: false, follow: false }
};

const OPEN_STATUSES = [
  "claimed",
  "submitted",
  "extracting",
  "awaiting_confirm",
  "processing",
  "needs_manual",
  "ready"
] as const;


export default async function PantryIntakePage() {
  const session = await getSessionInfo();
  if (!session) {
    redirect(`/signin?callbackUrl=${encodeURIComponent("/pantry/intake")}`);
  }

  const db = getDb();
  const [order] = await db
    .select()
    .from(schema.pantryOrders)
    .where(
      and(
        eq(schema.pantryOrders.userId, session.userId),
        inArray(schema.pantryOrders.status, [...OPEN_STATUSES])
      )
    )
    .orderBy(desc(schema.pantryOrders.createdAt))
    .limit(1);

  if (!order) {
    return (
      <main className="page-shell">
        <div className="page-frame">
          <section className="surface-card hero-card">
            <p className="hero-eyebrow">Pantry Review</p>
            <h1 className="page-title">No review waiting here yet</h1>
            <p className="page-copy">
              If you just paid, use the setup link from your email — it
              connects the purchase to this account. Paid with a different
              email? Write to {SUPPORT_EMAIL} and we&apos;ll connect it for
              you.
            </p>
          </section>
        </div>
      </main>
    );
  }

  if (order.status === "ready") {
    redirect(`/report/${order.id}`);
  }

  const items =
    order.status === "awaiting_confirm"
      ? (
          await db
            .select()
            .from(schema.pantryItems)
            .where(eq(schema.pantryItems.orderId, order.id))
            .orderBy(asc(schema.pantryItems.position))
        ).map((item) => ({
          id: item.id,
          name: decryptField(item.nameCiphertext),
          portion: item.portionCiphertext
            ? decryptField(item.portionCiphertext)
            : ""
        }))
      : [];

  return (
    <PantryIntakeFlow
      orderId={order.id}
      initialStatus={order.status}
      initialItems={items}
      supportEmail={SUPPORT_EMAIL}
    />
  );
}
