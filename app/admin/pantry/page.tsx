import { desc } from "drizzle-orm";
import { notFound } from "next/navigation";

import { AdminPantryTable } from "../../../components/admin-pantry-table";
import { isAdmin } from "../../../lib/server/admin";
import { getDb, schema } from "../../../lib/server/db";
import { getSessionInfo } from "../../../lib/server/session";

export const metadata = {
  title: "Pantry ops — Prediabetes Pal",
  robots: { index: false, follow: false }
};

const TERMINAL = new Set(["ready", "canceled"]);

export default async function AdminPantryPage() {
  const session = await getSessionInfo();
  if (!isAdmin(session)) {
    notFound();
  }

  const orders = await getDb()
    .select({
      id: schema.pantryOrders.id,
      email: schema.pantryOrders.email,
      status: schema.pantryOrders.status,
      updatedAt: schema.pantryOrders.updatedAt,
      createdAt: schema.pantryOrders.createdAt
    })
    .from(schema.pantryOrders)
    .orderBy(desc(schema.pantryOrders.updatedAt));

  // Newest-stuck-first: non-terminal orders above terminal ones.
  const sorted = [
    ...orders.filter((order) => !TERMINAL.has(order.status)),
    ...orders.filter((order) => TERMINAL.has(order.status))
  ];

  return (
    <main className="page-shell">
      <div className="page-frame admin-frame">
        <h1 className="page-title">Pantry orders</h1>
        {sorted.length === 0 ? (
          <p className="page-copy">No orders yet.</p>
        ) : (
          <AdminPantryTable
            orders={sorted.map((order) => ({
              ...order,
              updatedAt: order.updatedAt.toISOString(),
              createdAt: order.createdAt.toISOString()
            }))}
          />
        )}
      </div>
    </main>
  );
}
