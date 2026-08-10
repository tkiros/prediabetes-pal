import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { schema } from "../../../lib/server/db";
import { runPrechargeSweep } from "../../../lib/server/billing/precharge";
import { createTestDb } from "../../helpers/test-db";

const NOW = new Date("2026-07-08T12:00:00.000Z");
const hoursFromNow = (h: number) => new Date(NOW.getTime() + h * 3_600_000);

let testDb: Awaited<ReturnType<typeof createTestDb>>;
const db = () => testDb.db;

beforeAll(async () => {
  process.env.NEXT_PUBLIC_APP_URL = "https://pal.test";
  process.env.AUTH_SECRET = "test-auth-secret";
  testDb = await createTestDb();
});

afterAll(async () => {
  await testDb.close();
});

beforeEach(async () => {
  await testDb.db.delete(schema.subscriptions);
  await testDb.db.delete(schema.users);
  await testDb.db.delete(schema.cronHeartbeat);
});

async function seedTrial(
  ref: string,
  overrides: Partial<typeof schema.subscriptions.$inferInsert> = {}
) {
  const [user] = await testDb.db
    .insert(schema.users)
    .values({ email: `${ref}@example.com` })
    .returning();
  const [row] = await testDb.db
    .insert(schema.subscriptions)
    .values({
      userId: user.id,
      provider: "stripe",
      providerRef: ref,
      productId: "prod_x",
      status: "trialing",
      priceVariant: "1299",
      currentPeriodEnd: hoursFromNow(36),
      ...overrides
    })
    .returning();
  return row;
}

function makeDeps(email = { send: vi.fn().mockResolvedValue({ ok: true }) }) {
  return { db, email, now: () => NOW, secret: "test-secret" };
}

describe("runPrechargeSweep", () => {
  it("emails exactly the trialing rows ending within 48h that were not yet emailed, then stamps them", async () => {
    await seedTrial("sub_A", { currentPeriodEnd: hoursFromNow(36) }); // target
    await seedTrial("sub_B", { currentPeriodEnd: hoursFromNow(120) }); // 5d — skip
    await seedTrial("sub_C", {
      currentPeriodEnd: hoursFromNow(36),
      preChargeEmailSentAt: new Date(NOW.getTime() - 3_600_000)
    }); // already emailed — skip
    await seedTrial("sub_D", {
      status: "active",
      currentPeriodEnd: hoursFromNow(36)
    }); // not trialing — skip

    const deps = makeDeps();
    const result = await runPrechargeSweep(deps);

    expect(result.sent).toBe(1);
    expect(deps.email.send).toHaveBeenCalledTimes(1);
    const sentTo = deps.email.send.mock.calls[0][0];
    expect(sentTo.text).toContain("/api/billing/cancel?token=");

    const [rowA] = await testDb.db
      .select()
      .from(schema.subscriptions)
      .where(eq(schema.subscriptions.providerRef, "sub_A"));
    expect(rowA.preChargeEmailSentAt).not.toBeNull();
  });

  it("is idempotent: a second run sends nothing", async () => {
    await seedTrial("sub_A", { currentPeriodEnd: hoursFromNow(36) });

    const first = makeDeps();
    expect((await runPrechargeSweep(first)).sent).toBe(1);

    const second = makeDeps();
    expect((await runPrechargeSweep(second)).sent).toBe(0);
    expect(second.email.send).not.toHaveBeenCalled();
  });

  it("does not stamp when the send fails (retried next hour)", async () => {
    await seedTrial("sub_A", { currentPeriodEnd: hoursFromNow(36) });

    const deps = makeDeps({
      send: vi.fn().mockResolvedValue({ ok: false, status: 500 })
    });
    const result = await runPrechargeSweep(deps);

    expect(result.sent).toBe(0);
    const [rowA] = await testDb.db
      .select()
      .from(schema.subscriptions)
      .where(eq(schema.subscriptions.providerRef, "sub_A"));
    expect(rowA.preChargeEmailSentAt).toBeNull();
  });
});
