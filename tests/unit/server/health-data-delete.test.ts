import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { createHealthDataDeleteHandler } from "../../../app/api/account/health-data/route";
import { encryptField } from "../../../lib/server/crypto";
import { schema } from "../../../lib/server/db";
import { createTestDb } from "../../helpers/test-db";

const TEST_KEY = Buffer.alloc(32, 11).toString("base64");
let testDb: Awaited<ReturnType<typeof createTestDb>>;

beforeAll(async () => {
  process.env.HEALTH_DATA_KEY = TEST_KEY;
  testDb = await createTestDb();
});

afterAll(async () => {
  delete process.env.HEALTH_DATA_KEY;
  await testDb.close();
});

describe("DELETE /api/account/health-data", () => {
  it("requires a signed-in account", async () => {
    const DELETE = createHealthDataDeleteHandler({
      db: () => testDb.db,
      getSession: async () => null
    });
    expect((await DELETE()).status).toBe(401);
  });

  it("erases health rows while preserving login and subscription", async () => {
    const [user] = await testDb.db
      .insert(schema.users)
      .values({ email: "withdraw@test.dev" })
      .returning();
    await testDb.db.insert(schema.profiles).values({
      userId: user.id,
      a1cCiphertext: encryptField("6.1"),
      a1cBand: "prediabetes_60_62",
      consentedAt: new Date(),
      // F-ORIENT: orientation lives on the profiles row, so the row delete
      // below is its whole erase path — no separate erase code.
      orientation: {
        done: ["1", "2"],
        dismissedAt: null,
        startedAt: "2026-07-01T08:00:00.000Z"
      }
    });
    const [check] = await testDb.db
      .insert(schema.checks)
      .values({
        userId: user.id,
        foodCiphertext: encryptField("meal"),
        risk: "MODERATE",
        a1cBand: "prediabetes_60_62"
      })
      .returning({ id: schema.checks.id });
    await testDb.db.insert(schema.mealMemories).values({
      userId: user.id,
      checkId: check.id,
      noteCiphertext: encryptField("private note"),
      favorite: true
    });
    await testDb.db.insert(schema.baiWeekly).values({
      userId: user.id,
      weekStart: "2026-07-06",
      score: 50,
      adherence: 50,
      consistency: 50,
      action: 50
    });
    await testDb.db.insert(schema.pushSubscriptions).values({
      userId: user.id,
      endpoint: "https://push.example/withdraw",
      p256dh: "key",
      auth: "auth"
    });
    await testDb.db.insert(schema.subscriptions).values({
      userId: user.id,
      provider: "stripe",
      providerRef: "sub_withdraw",
      productId: "premium_monthly",
      status: "active",
      currentPeriodEnd: new Date("2026-08-12T00:00:00Z")
    });

    const DELETE = createHealthDataDeleteHandler({
      db: () => testDb.db,
      getSession: async () => ({ userId: user.id, email: user.email })
    });
    expect((await DELETE()).status).toBe(200);

    expect(
      await testDb.db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, user.id))
    ).toHaveLength(1);
    expect(
      await testDb.db
        .select()
        .from(schema.subscriptions)
        .where(eq(schema.subscriptions.userId, user.id))
    ).toHaveLength(1);

    for (const table of [
      "profiles",
      "checks",
      "meal_memories",
      "bai_weekly",
      "push_subscriptions"
    ]) {
      const result = await testDb.raw.query(
        `SELECT count(*)::int AS n FROM ${table} WHERE user_id = '${user.id}'`
      );
      expect((result.rows[0] as { n: number }).n).toBe(0);
    }
    const orientationLeft = await testDb.raw.query(
      `SELECT count(*)::int AS n FROM profiles WHERE user_id = '${user.id}' AND orientation IS NOT NULL`
    );
    expect((orientationLeft.rows[0] as { n: number }).n).toBe(0);
  });

  it("erases learning journeys and weekly reflections on withdrawal (E2/E5)", async () => {
    const [user] = await testDb.db
      .insert(schema.users)
      .values({ email: "withdraw-journey@test.dev" })
      .returning();
    await testDb.db.insert(schema.profiles).values({
      userId: user.id,
      a1cCiphertext: encryptField("6.1"),
      a1cBand: "prediabetes_60_62",
      consentedAt: new Date()
    });
    // learning_journeys references `users`, not `profiles`/`checks` — no cascade
    // reaches it (E2), so withdrawal must delete it explicitly.
    await testDb.db.insert(schema.learningJourneys).values({
      userId: user.id,
      state: "active",
      startedAt: new Date("2026-07-01T00:00:00Z")
    });
    // weekly_reflections embeds the user's own meal text; it references only
    // `users` and is deleted LAST in the withdrawal transaction (E5).
    await testDb.db.insert(schema.weeklyReflections).values({
      userId: user.id,
      weekStart: "2026-07-06",
      version: "1",
      artifactCiphertext: encryptField(JSON.stringify({ weekStart: "2026-07-06" }))
    });

    const DELETE = createHealthDataDeleteHandler({
      db: () => testDb.db,
      getSession: async () => ({ userId: user.id, email: user.email })
    });
    expect((await DELETE()).status).toBe(200);

    for (const table of ["learning_journeys", "weekly_reflections"]) {
      const result = await testDb.raw.query(
        `SELECT count(*)::int AS n FROM ${table} WHERE user_id = '${user.id}'`
      );
      expect((result.rows[0] as { n: number }).n).toBe(0);
    }
    // Login survives.
    expect(
      await testDb.db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, user.id))
    ).toHaveLength(1);
  });

  it("deletes Pantry Blob objects before its order cascade destroys their URLs", async () => {
    const [user] = await testDb.db
      .insert(schema.users)
      .values({ email: "withdraw-pantry@test.dev" })
      .returning();
    const [order] = await testDb.db
      .insert(schema.pantryOrders)
      .values({
        userId: user.id,
        email: user.email,
        stripeSessionId: "cs_withdraw_pantry",
        claimToken: "withdraw-pantry-token"
      })
      .returning();
    const blobUrl = "https://blob.test/withdraw-pantry.jpg";
    await testDb.db
      .insert(schema.pantryPhotos)
      .values({ orderId: order.id, blobUrl });
    const deleteBlobs = vi.fn().mockResolvedValue(undefined);

    const DELETE = createHealthDataDeleteHandler({
      db: () => testDb.db,
      getSession: async () => ({ userId: user.id, email: user.email }),
      deleteBlobs
    });

    expect((await DELETE()).status).toBe(200);
    expect(deleteBlobs).toHaveBeenCalledWith([blobUrl]);
    expect(
      await testDb.db
        .select()
        .from(schema.pantryOrders)
        .where(eq(schema.pantryOrders.id, order.id))
    ).toHaveLength(0);
  });

  it("returns 503 and preserves health rows and the photo pointer on Blob failure", async () => {
    const [user] = await testDb.db
      .insert(schema.users)
      .values({ email: "withdraw-blob-down@test.dev" })
      .returning();
    await testDb.db.insert(schema.profiles).values({
      userId: user.id,
      a1cCiphertext: encryptField("6.1"),
      a1cBand: "prediabetes_60_62",
      consentedAt: new Date()
    });
    const [order] = await testDb.db
      .insert(schema.pantryOrders)
      .values({
        userId: user.id,
        email: user.email,
        stripeSessionId: "cs_withdraw_blob_down",
        claimToken: "withdraw-blob-down-token"
      })
      .returning();
    await testDb.db.insert(schema.pantryPhotos).values({
      orderId: order.id,
      blobUrl: "https://blob.test/withdraw-blob-down.jpg"
    });

    const DELETE = createHealthDataDeleteHandler({
      db: () => testDb.db,
      getSession: async () => ({ userId: user.id, email: user.email }),
      deleteBlobs: vi.fn().mockRejectedValue(new Error("blob unavailable"))
    });

    expect((await DELETE()).status).toBe(503);
    expect(
      await testDb.db
        .select()
        .from(schema.profiles)
        .where(eq(schema.profiles.userId, user.id))
    ).toHaveLength(1);
    expect(
      await testDb.db
        .select()
        .from(schema.pantryPhotos)
        .where(eq(schema.pantryPhotos.orderId, order.id))
    ).toHaveLength(1);
  });
});
