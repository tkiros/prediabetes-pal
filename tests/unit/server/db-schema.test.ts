import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { schema } from "../../../lib/server/db";
import { createTestDb } from "../../helpers/test-db";

let testDb: Awaited<ReturnType<typeof createTestDb>>;

beforeAll(async () => {
  testDb = await createTestDb();
});

afterAll(async () => {
  await testDb.close();
});

async function insertUser(email: string) {
  const [user] = await testDb.db
    .insert(schema.users)
    .values({ email })
    .returning();
  return user;
}

describe("database schema constraints", () => {
  it("applies the generated migrations cleanly (all tables exist)", async () => {
    const result = await testDb.raw.query<{ table_name: string }>(
      "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name"
    );
    const names = result.rows.map((row) => row.table_name);

    for (const expected of [
      "users",
      "accounts",
      "sessions",
      "verification_tokens",
      "profiles",
      "checks",
      "push_subscriptions",
      "subscriptions",
      "bai_weekly",
      "deletion_log"
    ]) {
      expect(names).toContain(expected);
    }
  });

  it("adds profiles.orientation as a nullable jsonb column (F-ORIENT)", async () => {
    const result = await testDb.raw.query<{ data_type: string; is_nullable: string; column_default: string | null }>(
      `SELECT data_type, is_nullable, column_default FROM information_schema.columns
       WHERE table_schema='public' AND table_name='profiles' AND column_name='orientation'`
    );

    expect(result.rows).toEqual([
      { data_type: "jsonb", is_nullable: "YES", column_default: null }
    ]);
  });

  it("rejects an invalid risk class (CHECK constraint)", async () => {
    const user = await insertUser("risk@test.dev");

    await expect(
      testDb.raw.query(
        `INSERT INTO checks (user_id, food_ciphertext, risk, a1c_band)
         VALUES ('${user.id}', 'x', 'MEDIUM', 'prediabetes_60_62')`
      )
    ).rejects.toThrow(/check/i);
  });

  it("rejects an invalid subscription provider (CHECK constraint)", async () => {
    const user = await insertUser("provider@test.dev");

    await expect(
      testDb.raw.query(
        `INSERT INTO subscriptions (user_id, provider, provider_ref, product_id, status, current_period_end)
         VALUES ('${user.id}', 'paypal', 'ref-1', 'premium_monthly', 'active', now())`
      )
    ).rejects.toThrow(/check/i);
  });

  it("dedupes migrated checks on (user_id, client_id)", async () => {
    const user = await insertUser("dedupe@test.dev");
    const insert = () =>
      testDb.db.insert(schema.checks).values({
        userId: user.id,
        foodCiphertext: "cipher",
        risk: "SAFE",
        a1cBand: "prediabetes_60_62",
        clientId: "local-1"
      });

    await insert();
    // drizzle wraps the driver error; assert on the cause chain
    await expect(insert()).rejects.toSatisfy((error: unknown) =>
      /unique|duplicate/i.test(
        String((error as Error).message) + String((error as Error).cause ?? "")
      )
    );
  });

  it("allows many null client_ids per user (partial index)", async () => {
    const user = await insertUser("nulls@test.dev");
    const insert = () =>
      testDb.db.insert(schema.checks).values({
        userId: user.id,
        foodCiphertext: "cipher",
        risk: "SAFE",
        a1cBand: "prediabetes_60_62"
      });

    await insert();
    await expect(insert()).resolves.toBeTruthy();
  });

  it("cascades user deletion through profile, checks, subscriptions, push", async () => {
    const user = await insertUser("cascade@test.dev");
    await testDb.db.insert(schema.profiles).values({
      userId: user.id,
      a1cCiphertext: "cipher",
      a1cBand: "prediabetes_60_62",
      consentedAt: new Date()
    });
    await testDb.db.insert(schema.checks).values({
      userId: user.id,
      foodCiphertext: "cipher",
      risk: "HIGH",
      a1cBand: "prediabetes_60_62"
    });
    await testDb.db.insert(schema.subscriptions).values({
      userId: user.id,
      provider: "stripe",
      providerRef: "sub_cascade",
      productId: "premium_monthly",
      status: "active",
      currentPeriodEnd: new Date()
    });
    await testDb.db.insert(schema.pushSubscriptions).values({
      userId: user.id,
      endpoint: "https://push.example/cascade",
      p256dh: "k",
      auth: "a"
    });

    await testDb.raw.query(`DELETE FROM users WHERE id = '${user.id}'`);

    for (const table of [
      "profiles",
      "checks",
      "subscriptions",
      "push_subscriptions"
    ]) {
      const rows = await testDb.raw.query(
        `SELECT count(*)::int AS n FROM ${table} WHERE user_id = '${user.id}'`
      );
      expect((rows.rows[0] as { n: number }).n).toBe(0);
    }
  });
});
