import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createCheckRouteHandler
} from "../../../app/api/check/route";
import { decryptField } from "../../../lib/server/crypto";
import { schema } from "../../../lib/server/db";
import { createTestDb } from "../../helpers/test-db";

const TEST_KEY = Buffer.alloc(32, 3).toString("base64");

let testDb: Awaited<ReturnType<typeof createTestDb>>;
let userId: string;

beforeAll(async () => {
  process.env.HEALTH_DATA_KEY = TEST_KEY;
  testDb = await createTestDb();
  const [user] = await testDb.db
    .insert(schema.users)
    .values({ email: "persist@test.dev" })
    .returning();
  userId = user.id;
});

afterAll(async () => {
  delete process.env.HEALTH_DATA_KEY;
  await testDb.close();
});

beforeEach(async () => {
  await testDb.db.delete(schema.checks);
  await testDb.db.delete(schema.subscriptions);
  await testDb.db.delete(schema.profiles);
  await testDb.db.insert(schema.profiles).values({
    userId,
    a1cCiphertext: "cipher",
    a1cBand: "prediabetes_60_62",
    timezone: "UTC",
    consentedAt: new Date()
  });
});

const RESULT_RESPONSE = {
  kind: "result",
  risk: "MODERATE",
  reason: "This leans on refined carbs.",
  adjustment: "If practical, add protein.",
  swap: "If you have the option, swap to a less refined version.",
  disclaimer: "Not medical advice."
} as const;

function createHandler(options: {
  sessionUserId: string | null;
  responseKind?: "result" | "clarify";
  dbFails?: boolean;
  paywallMode?: () => "legacy" | "trial";
  dbOverride?: () => typeof testDb.db;
}) {
  const checkFoodImpl = vi.fn().mockResolvedValue(
    options.responseKind === "clarify"
      ? {
          kind: "clarify",
          question: "Plain or sweetened?",
          examples: [],
          disclaimer: "Not medical advice."
        }
      : RESULT_RESPONSE
  );

  return createCheckRouteHandler({
    checkFoodImpl,
    emitEvent: vi.fn(),
    modelFactory: () => ({ generate: vi.fn() }),
    db: options.dbFails
      ? () => {
          throw new Error("db down");
        }
      : options.dbOverride ?? (() => testDb.db),
    getSession: async () =>
      options.sessionUserId
        ? { userId: options.sessionUserId, email: "persist@test.dev" }
        : null,
    // Trial is the live default (lib/server/pricing.ts, 2026-07-07); these
    // suites describe the legacy persistence/free-tier paths, so the harness
    // pins legacy unless a test opts into trial explicitly.
    paywallMode: options.paywallMode ?? (() => "legacy" as const)
  });
}

function checkRequest(headers: Record<string, string> = {}) {
  return new Request("http://test/api/check", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify({ food: "white rice and beans", a1c: 6.1 })
  });
}

describe("check persistence (4B)", () => {
  it("persists a signed-in result with encrypted food, band, method, client id", async () => {
    const POST = createHandler({ sessionUserId: userId });
    const response = await POST(
      checkRequest({
        "x-pal-client-id": "web-123",
        "x-pal-input-method": "voice"
      })
    );

    expect(response.status).toBe(200);

    const rows = await testDb.db
      .select()
      .from(schema.checks)
      .where(eq(schema.checks.userId, userId));

    expect(rows).toHaveLength(1);
    expect(rows[0].risk).toBe("MODERATE");
    expect(rows[0].a1cBand).toBe("prediabetes_60_62");
    expect(rows[0].inputMethod).toBe("voice");
    expect(rows[0].clientId).toBe("web-123");
    expect(rows[0].foodCiphertext).not.toContain("rice");
    expect(decryptField(rows[0].foodCiphertext)).toBe("white rice and beans");

    // §P1.6: the persisted id is threaded back so feedback can link to it.
    const body = await response.json();
    expect(body.checkId).toBe(rows[0].id);
  });

  it("returns the same checkId on a client-id dedupe re-submit", async () => {
    const POST = createHandler({ sessionUserId: userId });
    const first = await POST(checkRequest({ "x-pal-client-id": "web-dup" }));
    const second = await POST(checkRequest({ "x-pal-client-id": "web-dup" }));

    const firstBody = await first.json();
    const secondBody = await second.json();

    const rows = await testDb.db.select().from(schema.checks);
    expect(rows).toHaveLength(1);
    expect(firstBody.checkId).toBe(rows[0].id);
    expect(secondBody.checkId).toBe(rows[0].id);
  });

  it("persists nothing for guests and returns no checkId", async () => {
    const POST = createHandler({ sessionUserId: null });
    const response = await POST(checkRequest());

    const rows = await testDb.db.select().from(schema.checks);
    expect(rows).toHaveLength(0);

    const body = await response.json();
    expect(body.checkId).toBeUndefined();
  });

  it("persists nothing after stored-health-data consent is withdrawn", async () => {
    await testDb.db
      .delete(schema.profiles)
      .where(eq(schema.profiles.userId, userId));
    const POST = createHandler({ sessionUserId: userId });
    await POST(checkRequest());

    const rows = await testDb.db.select().from(schema.checks);
    expect(rows).toHaveLength(0);
  });

  it("persists nothing for non-result kinds", async () => {
    const POST = createHandler({
      sessionUserId: userId,
      responseKind: "clarify"
    });
    await POST(checkRequest());

    const rows = await testDb.db.select().from(schema.checks);
    expect(rows).toHaveLength(0);
  });

  it("persists the photo input method (D5)", async () => {
    const POST = createHandler({ sessionUserId: userId });
    await POST(checkRequest({ "x-pal-input-method": "photo" }));

    const rows = await testDb.db.select().from(schema.checks);
    expect(rows[0].inputMethod).toBe("photo");
  });

  it("defaults a bad input-method header to text", async () => {
    const POST = createHandler({ sessionUserId: userId });
    await POST(checkRequest({ "x-pal-input-method": "gibberish" }));

    const rows = await testDb.db.select().from(schema.checks);
    expect(rows[0].inputMethod).toBe("text");
  });

  it("fails soft: a broken DB never breaks the check response", async () => {
    const POST = createHandler({ sessionUserId: userId, dbFails: true });
    const response = await POST(checkRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.kind).toBe("result");
    // RE-10: fail-soft must not be silent — the client is told the row did
    // not store so it can render "shown, not saved" instead of a false save.
    expect(body.persisted).toBe(false);
  });

  it("RE-10: a successful save carries no persisted flag; a guest gets none either", async () => {
    const saved = await (
      await createHandler({ sessionUserId: userId })(checkRequest())
    ).json();
    expect(saved.persisted).toBeUndefined();
    expect(typeof saved.checkId).toBe("string");

    const guest = await (
      await createHandler({ sessionUserId: null })(checkRequest())
    ).json();
    expect(guest.persisted).toBeUndefined();
    expect(guest.checkId).toBeUndefined();
  });
});

describe("free-tier enforcement (4D)", () => {
  it("402s the sixth check of the day for a free signed-in user, before any model spend", async () => {
    const POST = createHandler({ sessionUserId: userId });

    for (let i = 0; i < 5; i += 1) {
      const okResponse = await POST(checkRequest());
      expect(okResponse.status).toBe(200);
    }

    const limited = await POST(checkRequest());
    const body = await limited.json();

    expect(limited.status).toBe(402);
    expect(body.kind).toBe("upsell");
    expect(body.message).toMatch(/premium/i);
    expect(body.message).not.toMatch(/upgrade now|last chance|warning/i);
    expect(body.disclaimer).toContain("registered dietitian");

    // nothing persisted for the blocked check
    const rows = await testDb.db.select().from(schema.checks);
    expect(rows).toHaveLength(5);
  });

  it("premium users are unlimited", async () => {
    await testDb.db.insert(schema.subscriptions).values({
      userId,
      provider: "stripe",
      providerRef: "sub_unlimited",
      productId: "premium_monthly",
      status: "active",
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    });

    const POST = createHandler({ sessionUserId: userId });

    for (let i = 0; i < 7; i += 1) {
      const response = await POST(checkRequest());
      expect(response.status).toBe(200);
    }
  });

  it("guests are never blocked by the free-tier meter", async () => {
    const POST = createHandler({ sessionUserId: null });

    for (let i = 0; i < 7; i += 1) {
      const response = await POST(checkRequest());
      expect(response.status).toBe(200);
    }
  });
});

describe("trial-mode hard wall (4.4)", () => {
  it("trial mode: signed-in user with status lapsed/none gets a hard 402 regardless of checks used", async () => {
    // No subscription rows → entitlement tier free (status none). The wall must
    // fire on the very first check — there are no residual free checks in trial.
    const POST = createHandler({
      sessionUserId: userId,
      paywallMode: () => "trial"
    });

    const limited = await POST(checkRequest());
    const body = await limited.json();

    expect(limited.status).toBe(402);
    expect(body.kind).toBe("upsell");
    expect(body.message).toContain("free week");
    expect(body.disclaimer).toContain("registered dietitian");

    // Nothing persisted — the blocked check never reaches the model or storage.
    const rows = await testDb.db.select().from(schema.checks);
    expect(rows).toHaveLength(0);
  });

  it("trial mode: a stale Stripe row (lost renewal webhook) heals on read so a paying user is NOT walled", async () => {
    // Reviewer #3: without the hot-path heal, this paying user is denied checks
    // for up to an hour. The row reads premium-status but past its paid-through.
    const past = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await testDb.db.insert(schema.subscriptions).values({
      userId,
      provider: "stripe",
      providerRef: "sub_lostwebhook",
      productId: "premium_monthly",
      status: "active",
      currentPeriodEnd: past,
      lastVerifiedAt: null
    });

    const retrieve = vi.fn().mockResolvedValue({
      status: "active",
      items: {
        data: [{ current_period_end: Math.floor(future.getTime() / 1000) }]
      }
    });

    const POST = createCheckRouteHandler({
      checkFoodImpl: vi.fn().mockResolvedValue(RESULT_RESPONSE),
      emitEvent: vi.fn(),
      modelFactory: () => ({ generate: vi.fn() }),
      db: () => testDb.db,
      getSession: async () => ({ userId, email: "persist@test.dev" }),
      stripeClient: () => ({ subscriptions: { retrieve } }) as never,
      paywallMode: () => "trial"
    });

    const response = await POST(checkRequest());
    expect(response.status).toBe(200); // healed → not walled
    expect(retrieve).toHaveBeenCalledWith("sub_lostwebhook");

    const [row] = await testDb.db
      .select()
      .from(schema.subscriptions)
      .where(eq(schema.subscriptions.providerRef, "sub_lostwebhook"));
    // Stripe reports period end in whole unix seconds, so the healed value is
    // the second-truncated `future`; assert it moved into the future, not lapsed.
    expect(row.currentPeriodEnd.getTime()).toBe(
      Math.floor(future.getTime() / 1000) * 1000
    );
    expect(row.currentPeriodEnd.getTime()).toBeGreaterThan(Date.now());
    expect(row.lastVerifiedAt).not.toBeNull();
  });

  it("trial mode: trialing and premium users pass with no metering query", async () => {
    await testDb.db.insert(schema.subscriptions).values({
      userId,
      provider: "stripe",
      providerRef: "sub_trialing",
      productId: "premium_monthly",
      status: "trialing",
      currentPeriodEnd: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    });

    // Record every table touched by a SELECT. Trial mode must skip the
    // free-tier count query (checks), while the consent guard deliberately
    // reads profiles before persisting the completed result.
    const queriedTables: unknown[] = [];
    const tracked = new Proxy(testDb.db, {
      get(target, prop) {
        if (prop === "select") {
          return (...args: unknown[]) => {
            const query = (target.select as (...a: unknown[]) => unknown)(
              ...args
            ) as { from: (table: unknown) => unknown };
            const originalFrom = query.from.bind(query);
            query.from = (table: unknown) => {
              queriedTables.push(table);
              return originalFrom(table);
            };
            return query;
          };
        }
        const value = Reflect.get(target, prop);
        return typeof value === "function" ? value.bind(target) : value;
      }
    }) as typeof testDb.db;

    const POST = createHandler({
      sessionUserId: userId,
      paywallMode: () => "trial",
      dbOverride: () => tracked
    });

    const response = await POST(checkRequest());
    expect(response.status).toBe(200);

    expect(queriedTables).not.toContain(schema.checks);
    // Persistence now verifies an active consent-bearing profile before saving.
    expect(queriedTables).toContain(schema.profiles);
  });

  it("legacy mode: the 5/day soft limit still behaves byte-identically", async () => {
    const POST = createHandler({
      sessionUserId: userId,
      paywallMode: () => "legacy"
    });

    for (let i = 0; i < 5; i += 1) {
      expect((await POST(checkRequest())).status).toBe(200);
    }

    const limited = await POST(checkRequest());
    const body = await limited.json();

    expect(limited.status).toBe(402);
    expect(body.message).toMatch(/premium/i);
    expect(body.message).not.toContain("free week");
  });

  // F-21 / W-02. This test previously asserted the OPPOSITE: that the 11th
  // lifetime check flipped the session to "gpt-5.4-nano". Because the trial
  // wall 402s every non-premium session before this line, the only users who
  // could ever reach the downgrade were paying and trialing ones — the product
  // served its customers a model its own bakeoff had rejected, while the wall
  // promised them "unlimited everything". The expectation is now inverted, so
  // reintroducing usage-keyed routing turns this red.
  it("model: a heavy user is NEVER downgraded — every check uses the primary model", async () => {
    // Seeds are dated in the past so the 5/day free cap never fires — only
    // the lifetime count would have mattered to the old tiering rule.
    const seedCheck = () => ({
      userId,
      foodCiphertext: "cipher",
      risk: "SAFE" as const,
      a1cBand: "prediabetes_60_62" as const,
      inputMethod: "text" as const,
      createdAt: new Date(Date.now() - 72 * 60 * 60 * 1000)
    });

    const modelFactory = vi.fn((_model?: string) => ({ generate: vi.fn() }));
    const checkFoodImpl = vi.fn().mockResolvedValue(RESULT_RESPONSE);
    const POST = createCheckRouteHandler({
      checkFoodImpl,
      emitEvent: vi.fn(),
      modelFactory,
      db: () => testDb.db,
      getSession: async () => ({ userId, email: "persist@test.dev" }),
      paywallMode: () => "legacy" as const
    });

    // Well past the old 10-check threshold.
    await testDb.db
      .insert(schema.checks)
      .values(Array.from({ length: 25 }, seedCheck));

    // AUD-025: the route now hands checkFood a LAZY factory thunk; resolving
    // it here is what a model-reaching request would do. The assertion is
    // unchanged in meaning — no call may ever name a cheaper model.
    const resolveModel = () => {
      const deps = checkFoodImpl.mock.lastCall?.[1] as {
        model: () => unknown;
      };
      deps.model();
    };

    await POST(checkRequest());
    resolveModel();
    expect(modelFactory).toHaveBeenLastCalledWith(undefined);

    await POST(checkRequest());
    resolveModel();
    expect(modelFactory).toHaveBeenLastCalledWith(undefined);

    // No call anywhere in this session may name a cheaper model.
    for (const call of modelFactory.mock.calls) {
      expect(call[0]).toBeUndefined();
    }
  });

  it("model: guests get the primary model", async () => {
    const modelFactory = vi.fn(() => ({ generate: vi.fn() }));
    const checkFoodImpl = vi.fn().mockResolvedValue(RESULT_RESPONSE);
    const POST = createCheckRouteHandler({
      checkFoodImpl,
      emitEvent: vi.fn(),
      modelFactory,
      db: () => testDb.db,
      getSession: async () => null,
      paywallMode: () => "legacy" as const
    });

    await POST(checkRequest());
    (checkFoodImpl.mock.lastCall?.[1] as { model: () => unknown }).model();
    expect(modelFactory).toHaveBeenLastCalledWith(undefined);
  });

  it("anonymous requests are untouched in both modes", async () => {
    for (const mode of ["legacy", "trial"] as const) {
      const POST = createHandler({
        sessionUserId: null,
        paywallMode: () => mode
      });

      for (let i = 0; i < 7; i += 1) {
        expect((await POST(checkRequest())).status).toBe(200);
      }
    }
  });
});
