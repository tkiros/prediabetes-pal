import { getTableColumns, getTableName } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { createAccountExportHandler } from "../../../app/api/account/export/route";
import { encryptField } from "../../../lib/server/crypto";
import { schema } from "../../../lib/server/db";
import { createTestDb } from "../../helpers/test-db";

/**
 * PR-5 → AUD-012: the data-rights export is ONE complete file. Every
 * user-owned dataset is either inline or named in the `exclusions` schedule
 * with a reason — and the denominator test below fails the moment a new
 * user-scoped table ships without being accounted for either way.
 */

const NOW = new Date("2026-07-21T12:00:00.000Z");

let testDb: Awaited<ReturnType<typeof createTestDb>>;
let userId: string;
let otherUserId: string;

beforeAll(async () => {
  process.env.HEALTH_DATA_KEY = Buffer.alloc(32, 7).toString("base64");
  testDb = await createTestDb();
  const [user] = await testDb.db
    .insert(schema.users)
    .values({ email: "export@test.dev" })
    .returning();
  userId = user.id;
  await testDb.db.insert(schema.profiles).values({
    userId,
    a1cCiphertext: encryptField("6.1"),
    a1cBand: "prediabetes_60_62",
    timezone: "UTC",
    consentedAt: NOW,
    orientation: { done: ["1"], dismissedAt: null, startedAt: "2026-07-20T08:00:00.000Z" }
  });
  await testDb.db.insert(schema.weeklyReflections).values({
    userId,
    weekStart: "2026-07-13",
    version: "v1",
    artifactCiphertext: encryptField('{"headline":"steady week"}')
  });
  await testDb.db.insert(schema.pantryOrders).values({
    userId,
    email: "export@test.dev",
    stripeSessionId: "cs_export_1",
    claimToken: "hash_export_1",
    status: "ready",
    a1cBand: "prediabetes_60_62",
    a1cCiphertext: encryptField("6.2"),
    notesCiphertext: encryptField("mostly cooking at home"),
    reportCiphertext: encryptField("Report body")
  });
  await testDb.db.insert(schema.supportCases).values({
    userId,
    kind: "refund",
    messageCiphertext: encryptField("Charged twice for July.")
  });

  // AUD-012 datasets: checks, meal memory, feedback, subscription, journey.
  const [check] = await testDb.db
    .insert(schema.checks)
    .values({
      userId,
      foodCiphertext: encryptField("plain oatmeal"),
      risk: "MODERATE",
      a1cBand: "prediabetes_60_62",
      clientId: "client-export-1"
    })
    .returning();
  await testDb.db.insert(schema.mealMemories).values({
    userId,
    checkId: check.id,
    choiceCiphertext: encryptField("ate half, added yogurt"),
    noteCiphertext: encryptField("felt fine after"),
    favorite: true,
    easeReflection: "easy"
  });
  await testDb.db.insert(schema.checkFeedback).values({
    userId,
    checkId: check.id,
    helpful: false,
    reason: "too_vague",
    commentCiphertext: encryptField("wanted more detail")
  });
  await testDb.db.insert(schema.subscriptions).values({
    userId,
    provider: "stripe",
    providerRef: "sub_export_1",
    productId: "premium_monthly",
    status: "active",
    currentPeriodEnd: new Date("2026-08-21T12:00:00.000Z")
  });
  await testDb.db.insert(schema.learningJourneys).values({
    userId,
    state: "active",
    startedAt: NOW
  });

  // Cross-user control: a second user's rows must never leak into the export.
  const [other] = await testDb.db
    .insert(schema.users)
    .values({ email: "other@test.dev" })
    .returning();
  otherUserId = other.id;
  const [otherCheck] = await testDb.db
    .insert(schema.checks)
    .values({
      userId: otherUserId,
      foodCiphertext: encryptField("someone else's meal"),
      risk: "HIGH",
      a1cBand: "prediabetes_60_62"
    })
    .returning();
  await testDb.db.insert(schema.mealMemories).values({
    userId: otherUserId,
    checkId: otherCheck.id,
    noteCiphertext: encryptField("someone else's note"),
    favorite: false
  });
});

afterAll(async () => {
  delete process.env.HEALTH_DATA_KEY;
  await testDb.close();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("GET /api/account/export (PR-5)", () => {
  it("401s signed out", async () => {
    const GET = createAccountExportHandler({
      db: () => testDb.db,
      getSession: async () => null
    });
    expect((await GET()).status).toBe(401);
  });

  it("bundles exact A1C, weekly reflections, and pantry data", async () => {
    vi.stubEnv("NEXT_PUBLIC_GUIDE_DOOR", "orient");
    const GET = createAccountExportHandler({
      db: () => testDb.db,
      getSession: async () => ({ userId, email: "export@test.dev" }),
      now: () => NOW
    });

    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-disposition")).toContain("attachment");

    const body = (await res.json()) as {
      profile: { a1c: string; a1cBand: string; orientation: unknown };
      weeklyReflections: Array<{ artifact: string }>;
      pantryOrders: Array<{ a1c: string | null; notes: string | null; report: string | null }>;
    };
    expect(body.profile.a1c).toBe("6.1");
    expect(body.profile.a1cBand).toBe("prediabetes_60_62");
    // F-ORIENT: the signed-in orientation state is the user's own data.
    expect(body.profile.orientation).toEqual({
      done: ["1"],
      dismissedAt: null,
      startedAt: "2026-07-20T08:00:00.000Z"
    });
    expect(body.weeklyReflections[0].artifact).toContain("steady week");
    expect(body.pantryOrders[0].a1c).toBe("6.2");
    expect(body.pantryOrders[0].notes).toBe("mostly cooking at home");
    expect(body.pantryOrders[0].report).toBe("Report body");
  });

  it.each([
    ["unset", ""],
    ["a list without orient", "ideas,calm"]
  ])("omits the orientation key entirely while the orient surface is off (%s)", async (_label, flag) => {
    vi.stubEnv("NEXT_PUBLIC_GUIDE_DOOR", flag);
    const GET = createAccountExportHandler({
      db: () => testDb.db,
      getSession: async () => ({ userId, email: "export@test.dev" }),
      now: () => NOW
    });

    const body = (await (await GET()).json()) as { profile: Record<string, unknown> };

    expect(body.profile).not.toHaveProperty("orientation");
    expect(Object.keys(body.profile)).toEqual([
      "a1c",
      "a1cBand",
      "timezone",
      "nudgeOptIn",
      "consentedAt"
    ]);
  });

  it("includes support cases — user-authored personal data (P0.4)", async () => {
    const GET = createAccountExportHandler({
      db: () => testDb.db,
      getSession: async () => ({ userId, email: "export@test.dev" }),
      now: () => NOW
    });

    const body = (await (await GET()).json()) as {
      supportCases: Array<{ kind: string; message: string; status: string }>;
    };
    expect(body.supportCases).toHaveLength(1);
    expect(body.supportCases[0].kind).toBe("refund");
    expect(body.supportCases[0].message).toBe("Charged twice for July.");
    expect(body.supportCases[0].status).toBe("open");
  });

  it("inlines identity, checks, meal memories, feedback, subscriptions, and journey (AUD-012)", async () => {
    const GET = createAccountExportHandler({
      db: () => testDb.db,
      getSession: async () => ({ userId, email: "export@test.dev" }),
      now: () => NOW
    });

    const body = (await (await GET()).json()) as {
      identity: { email: string };
      checks: Array<{ food: string; risk: string }>;
      mealMemories: Array<{ note: string | null; choice: string | null }>;
      checkFeedback: Array<{ helpful: boolean; comment: string | null }>;
      subscriptions: Array<{ provider: string; status: string }>;
      learningJourney: { state: string } | null;
    };

    expect(body.identity.email).toBe("export@test.dev");
    expect(body.checks).toHaveLength(1);
    expect(body.checks[0].food).toBe("plain oatmeal");
    expect(body.mealMemories).toHaveLength(1);
    expect(body.mealMemories[0].choice).toBe("ate half, added yogurt");
    expect(body.mealMemories[0].note).toBe("felt fine after");
    expect(body.checkFeedback).toHaveLength(1);
    expect(body.checkFeedback[0].comment).toBe("wanted more detail");
    expect(body.subscriptions[0]).toMatchObject({
      provider: "stripe",
      status: "active"
    });
    expect(body.learningJourney?.state).toBe("active");
  });

  it("never leaks another user's rows", async () => {
    const GET = createAccountExportHandler({
      db: () => testDb.db,
      getSession: async () => ({ userId, email: "export@test.dev" }),
      now: () => NOW
    });
    const text = JSON.stringify(await (await GET()).json());
    expect(text).not.toContain("someone else's meal");
    expect(text).not.toContain("someone else's note");
    expect(text).not.toContain("other@test.dev");
  });

  it("accounts for EVERY user-scoped table: inline or documented exclusion (AUD-012 denominator)", async () => {
    // Schema-derived denominator: any table with a user_id column is personal
    // data. Each must map to an inline export key or an exclusion entry — a
    // new user-scoped table fails here until it is accounted for.
    const COVERAGE: Record<string, { key: string } | { excludedAs: string }> = {
      users: { key: "identity" },
      profiles: { key: "profile" },
      checks: { key: "checks" },
      check_feedback: { key: "checkFeedback" },
      meal_memories: { key: "mealMemories" },
      learning_journeys: { key: "learningJourney" },
      weekly_reflections: { key: "weeklyReflections" },
      pantry_orders: { key: "pantryOrders" },
      support_cases: { key: "supportCases" },
      subscriptions: { key: "subscriptions" },
      accounts: { excludedAs: "sign-in artifacts" },
      sessions: { excludedAs: "sign-in artifacts" },
      push_subscriptions: { excludedAs: "push notification subscription" },
      email_delivery_attempts: { excludedAs: "email delivery" },
      email_suppressions: { excludedAs: "email delivery" },
      bai_weekly: { excludedAs: "internal behavioral index" },
      pantry_photos: { excludedAs: "pantry photos" },
      pantry_items: { excludedAs: "pantry photos" },
      billing_event_inbox: { excludedAs: "provider-side billing" }
    };

    const GET = createAccountExportHandler({
      db: () => testDb.db,
      getSession: async () => ({ userId, email: "export@test.dev" }),
      now: () => NOW
    });
    const body = (await (await GET()).json()) as Record<string, unknown> & {
      exclusions: Array<{ dataset: string; reason: string }>;
    };

    for (const table of Object.values(schema)) {
      const columns =
        typeof table === "object" && table !== null
          ? (() => {
              try {
                return getTableColumns(table as never);
              } catch {
                return null;
              }
            })()
          : null;
      if (!columns) continue;
      const name = getTableName(table as never);
      const userScoped =
        "userId" in columns || name === "users";
      if (!userScoped) continue;

      const coverage = COVERAGE[name];
      expect(coverage, `user-scoped table "${name}" is not accounted for in the export`).toBeDefined();
      if ("key" in coverage) {
        expect(
          body[coverage.key],
          `export key "${coverage.key}" missing for table "${name}"`
        ).toBeDefined();
      } else {
        expect(
          body.exclusions.some((e) =>
            e.dataset.toLowerCase().includes(coverage.excludedAs.toLowerCase())
          ),
          `no documented exclusion covering table "${name}"`
        ).toBe(true);
      }
    }
  });
});
