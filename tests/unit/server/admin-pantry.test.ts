import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { createAdminPantryHandler } from "../../../app/api/admin/pantry/route";
import { schema } from "../../../lib/server/db";
import { createTestDb } from "../../helpers/test-db";

const NOW = new Date("2026-07-09T09:00:00.000Z");

let testDb: Awaited<ReturnType<typeof createTestDb>>;

beforeAll(async () => {
  process.env.HEALTH_DATA_KEY = Buffer.alloc(32, 14).toString("base64");
  process.env.ADMIN_EMAIL = "founder@prediabetespal.com";
  process.env.NEXT_PUBLIC_APP_URL = "https://revora.test";
  testDb = await createTestDb();
});

afterAll(async () => {
  delete process.env.ADMIN_EMAIL;
  await testDb.close();
});

beforeEach(async () => {
  await testDb.db.delete(schema.pantryOrders);
});

async function makeOrder(overrides: Partial<typeof schema.pantryOrders.$inferInsert> = {}) {
  const [order] = await testDb.db
    .insert(schema.pantryOrders)
    .values({
      email: "buyer@example.com",
      stripeSessionId: `cs_${Math.random().toString(36).slice(2)}`,
      claimToken: `hash_${Math.random().toString(36).slice(2)}`,
      status: "paid",
      ...overrides
    })
    .returning();
  return order;
}

function makeDeps(sessionEmail = "founder@prediabetespal.com") {
  return {
    db: () => testDb.db,
    getSession: async () =>
      sessionEmail ? { userId: crypto.randomUUID(), email: sessionEmail } : null,
    email: { send: vi.fn().mockResolvedValue({ ok: true }) },
    processOrder: vi.fn().mockResolvedValue({ done: true }),
    // Never build the live OpenAI client in tests.
    makeProcessDeps: () => ({
      db: testDb.db,
      model: { generate: vi.fn() },
      email: { send: vi.fn().mockResolvedValue({ ok: true }) },
      deleteBlobs: vi.fn().mockResolvedValue(undefined),
      now: () => NOW
    }),
    now: () => NOW
  };
}

function adminRequest(body: unknown) {
  return new Request("http://t/api/admin/pantry", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}

describe("POST /api/admin/pantry", () => {
  it("404s a non-admin session (page and API invisible to normal users)", async () => {
    const POST = createAdminPantryHandler(makeDeps("user@else.com"));
    const order = await makeOrder();
    const response = await POST(
      adminRequest({ orderId: order.id, action: "mark_manual" })
    );
    expect(response.status).toBe(404);
  });

  it("404s everyone when ADMIN_EMAIL is unset", async () => {
    delete process.env.ADMIN_EMAIL;
    const POST = createAdminPantryHandler(makeDeps());
    const order = await makeOrder();
    const response = await POST(
      adminRequest({ orderId: order.id, action: "mark_manual" })
    );
    expect(response.status).toBe(404);
    process.env.ADMIN_EMAIL = "founder@prediabetespal.com";
  });

  it("resend_intake mints a fresh token and stamps intakeEmailSentAt", async () => {
    const order = await makeOrder({ intakeEmailSentAt: null });
    const deps = makeDeps();
    const POST = createAdminPantryHandler(deps);

    const response = await POST(
      adminRequest({ orderId: order.id, action: "resend_intake" })
    );

    expect(response.status).toBe(200);
    expect(deps.email.send).toHaveBeenCalledTimes(1);
    const [updated] = await testDb.db
      .select()
      .from(schema.pantryOrders)
      .where(eq(schema.pantryOrders.id, order.id));
    expect(updated.claimToken).not.toBe(order.claimToken);
    expect(updated.intakeEmailSentAt?.toISOString()).toBe(NOW.toISOString());
  });

  it("mark_manual sets needs_manual", async () => {
    const order = await makeOrder({ status: "processing" });
    const POST = createAdminPantryHandler(makeDeps());
    await POST(adminRequest({ orderId: order.id, action: "mark_manual" }));
    const [updated] = await testDb.db
      .select()
      .from(schema.pantryOrders)
      .where(eq(schema.pantryOrders.id, order.id));
    expect(updated.status).toBe("needs_manual");
  });

  it("rerun resets to processing and invokes the processor", async () => {
    const order = await makeOrder({ status: "needs_manual" });
    const deps = makeDeps();
    const POST = createAdminPantryHandler(deps);

    await POST(adminRequest({ orderId: order.id, action: "rerun" }));

    expect(deps.processOrder).toHaveBeenCalled();
    const [updated] = await testDb.db
      .select()
      .from(schema.pantryOrders)
      .where(eq(schema.pantryOrders.id, order.id));
    expect(["processing", "ready"]).toContain(updated.status);
  });
});
