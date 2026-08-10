import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import { schema, type Db } from "../../../lib/server/db";
import { createTestDb } from "../../helpers/test-db";

const ORIGINAL_ENV = { ...process.env };
const NOW = new Date("2026-07-06T04:30:00.000Z");

let testDb: Awaited<ReturnType<typeof createTestDb>>;

beforeAll(async () => {
  testDb = await createTestDb();
});

afterAll(async () => {
  await testDb.close();
});

beforeEach(async () => {
  await testDb.db.delete(schema.cronHeartbeat);
  process.env = {
    ...ORIGINAL_ENV,
    NODE_ENV: "production",
    VERCEL_ENV: "preview",
    OPENAI_API_KEY: "sk-preview-test",
    RESEND_API_KEY: "re_test",
    RESEND_WEBHOOK_SECRET: "whsec_test",
    STRIPE_WEBHOOK_SECRET: "whsec_billing_test",
    AUTH_SECRET: "auth-test",
    UPSTASH_REDIS_REST_URL: "https://fake.upstash.io",
    UPSTASH_REDIS_REST_TOKEN: "upstash-test",
  };
  delete process.env.EDGE_CONFIG;
  delete process.env.PAL_LAUNCH_MODE_OVERRIDE;
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

async function importHandler() {
  // Fresh module registry isn't needed here (no top-level env reads in this
  // route file), but importing per-test keeps this file independent of
  // import order from the other health-focused test files.
  const mod = await import("../../../app/api/health/route");
  return mod.createHealthHandler;
}

describe("createHealthHandler — db + cron probes (P7)", () => {
  it("reports db:ok and crons:never when the db is reachable but no cron has ever run", async () => {
    const createHealthHandler = await importHandler();
    const GET = createHealthHandler({ db: () => testDb.db, now: () => NOW });

    const payload = await (await GET()).json();

    expect(payload.ok).toBe(false);
    expect(payload.db).toBe("ok");
    expect(payload.crons).toEqual({
      nudge: "never",
      baiWeekly: "never",
      trialPrecharge: "never",
      pantrySweep: "never",
      stripeReconcile: "never",
    });
  });

  // G8: checkout 401s unauthenticated before the legal gate runs, so this
  // boolean is the only external way to see W-04's state. Same predicate as
  // checkoutGate(): only an exact "0" reads closed.
  it("reports the W-04 checkout gate state, open unless LEGAL_TERMS_FINAL is exactly '0'", async () => {
    const createHealthHandler = await importHandler();
    const GET = createHealthHandler({ db: () => testDb.db, now: () => NOW });

    vi.stubEnv("LEGAL_TERMS_FINAL", "0");
    expect((await (await GET()).json()).checkoutGate).toBe("closed");

    vi.stubEnv("LEGAL_TERMS_FINAL", "");
    expect((await (await GET()).json()).checkoutGate).toBe("open");

    vi.stubEnv("LEGAL_TERMS_FINAL", "1");
    expect((await (await GET()).json()).checkoutGate).toBe("open");

    vi.unstubAllEnvs();
  });

  it("reports crons:ok when all five heartbeats are fresh", async () => {
    await testDb.db.insert(schema.cronHeartbeat).values([
      { name: "nudge", lastRunAt: new Date(NOW.getTime() - 30 * 60 * 1000) }, // 30m ago
      {
        name: "bai-weekly",
        lastRunAt: new Date(NOW.getTime() - 24 * 60 * 60 * 1000),
      }, // 1 day ago
      {
        name: "trial-precharge",
        lastRunAt: new Date(NOW.getTime() - 30 * 60 * 1000),
      }, // 30m ago
      {
        name: "pantry-sweep",
        lastRunAt: new Date(NOW.getTime() - 30 * 60 * 1000),
      }, // 30m ago
      {
        name: "stripe-reconcile",
        lastRunAt: new Date(NOW.getTime() - 30 * 60 * 1000),
      }, // 30m ago
    ]);

    const createHealthHandler = await importHandler();
    const GET = createHealthHandler({ db: () => testDb.db, now: () => NOW });

    const payload = await (await GET()).json();

    expect(payload.ok).toBe(true);
    expect(payload.status).toBe("healthy");
    expect(payload.issues).toEqual([]);
    expect(payload.db).toBe("ok");
    expect(payload.crons).toEqual({
      nudge: "ok",
      baiWeekly: "ok",
      trialPrecharge: "ok",
      pantrySweep: "ok",
      stripeReconcile: "ok",
    });
  });

  it("degrades when the Stripe webhook signing secret is missing (money path down)", async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    await testDb.db.insert(schema.cronHeartbeat).values([
      { name: "nudge", lastRunAt: new Date(NOW.getTime() - 30 * 60 * 1000) },
      { name: "bai-weekly", lastRunAt: new Date(NOW.getTime() - 60 * 60 * 1000) },
      { name: "trial-precharge", lastRunAt: new Date(NOW.getTime() - 30 * 60 * 1000) },
      { name: "pantry-sweep", lastRunAt: new Date(NOW.getTime() - 30 * 60 * 1000) },
      { name: "stripe-reconcile", lastRunAt: new Date(NOW.getTime() - 30 * 60 * 1000) },
    ]);

    const createHealthHandler = await importHandler();
    const GET = createHealthHandler({ db: () => testDb.db, now: () => NOW });

    const response = await GET();
    const payload = await response.json();

    // The webhook handler fails closed (503) without its secret, which
    // silently stops entitlement minting — readiness must say so.
    expect(response.status).toBe(503);
    expect(payload.ok).toBe(false);
    expect(payload.issues).toEqual(["billing_webhook_unconfigured"]);
    expect(payload.billingWebhook).toBe("unconfigured");
  });

  it("reports crons:stale past each job's own staleness window", async () => {
    await testDb.db.insert(schema.cronHeartbeat).values([
      // nudge stale past 2h
      {
        name: "nudge",
        lastRunAt: new Date(NOW.getTime() - 3 * 60 * 60 * 1000),
      },
      // bai-weekly stale past 8 days
      {
        name: "bai-weekly",
        lastRunAt: new Date(NOW.getTime() - 9 * 24 * 60 * 60 * 1000),
      },
      // trial-precharge stale past 2h
      {
        name: "trial-precharge",
        lastRunAt: new Date(NOW.getTime() - 3 * 60 * 60 * 1000),
      },
      // pantry-sweep stale past 2h
      {
        name: "pantry-sweep",
        lastRunAt: new Date(NOW.getTime() - 3 * 60 * 60 * 1000),
      },
      // stripe-reconcile stale past 2h
      {
        name: "stripe-reconcile",
        lastRunAt: new Date(NOW.getTime() - 3 * 60 * 60 * 1000),
      },
    ]);

    const createHealthHandler = await importHandler();
    const GET = createHealthHandler({ db: () => testDb.db, now: () => NOW });

    const payload = await (await GET()).json();

    expect(payload.ok).toBe(false);
    expect(payload.status).toBe("degraded");
    expect(payload.issues).toEqual([
      "cron_nudge_stale",
      "cron_baiWeekly_stale",
      "cron_trialPrecharge_stale",
      "cron_pantrySweep_stale",
      "cron_stripeReconcile_stale",
    ]);
    expect(payload.crons).toEqual({
      nudge: "stale",
      baiWeekly: "stale",
      trialPrecharge: "stale",
      pantrySweep: "stale",
      stripeReconcile: "stale",
    });
  });

  it("stays db:ok/crons:ok exactly at the staleness boundary (not yet stale)", async () => {
    await testDb.db
      .insert(schema.cronHeartbeat)
      .values([
        {
          name: "nudge",
          lastRunAt: new Date(NOW.getTime() - 2 * 60 * 60 * 1000),
        },
      ]);

    const createHealthHandler = await importHandler();
    const GET = createHealthHandler({ db: () => testDb.db, now: () => NOW });

    const payload = await (await GET()).json();

    expect(payload.crons.nudge).toBe("ok");
  });

  it("reports db:unconfigured and crons:unknown/unknown when no DATABASE_URL is set (default deps)", async () => {
    delete process.env.DATABASE_URL;
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    const createHealthHandler = await importHandler();
    const GET = createHealthHandler(); // real getDb(), no override

    const payload = await (await GET()).json();

    expect(payload.ok).toBe(false);
    expect(payload.issues).toContain("database_unconfigured");
    expect(payload.issues).toContain("rate_limit_unavailable");
    expect(payload.db).toBe("unconfigured");
    expect(payload.crons).toEqual({
      nudge: "unknown",
      baiWeekly: "unknown",
      trialPrecharge: "unknown",
      pantrySweep: "unknown",
      stripeReconcile: "unknown",
    });
  });

  it("reports db:error and fails readiness when the db accessor throws mid-query", async () => {
    const createHealthHandler = await importHandler();
    const brokenDb = {
      select: () => {
        throw new Error("connection reset");
      },
    } as unknown as Db;

    const GET = createHealthHandler({ db: () => brokenDb, now: () => NOW });
    const payload = await (await GET()).json();

    expect(payload.ok).toBe(false);
    expect(payload.issues).toContain("database_unavailable");
    expect(payload.db).toBe("error");
    expect(payload.crons).toEqual({
      nudge: "unknown",
      baiWeekly: "unknown",
      trialPrecharge: "unknown",
      pantrySweep: "unknown",
      stripeReconcile: "unknown",
    });
  });

  it("never includes secrets, URLs, or user counts in the response", async () => {
    process.env.DATABASE_URL = "postgres://user:secret-pw@railway.example/db";
    const createHealthHandler = await importHandler();
    const GET = createHealthHandler({ db: () => testDb.db, now: () => NOW });

    const body = JSON.stringify(await (await GET()).json());

    expect(body).not.toContain("secret-pw");
    expect(body).not.toContain("railway.example");
    expect(body).not.toContain("postgres://");
  });

  it("returns 503 so uptime monitors alert when a production cron is stale", async () => {
    process.env.VERCEL_ENV = "production";
    process.env.UPSTASH_REDIS_REST_URL = "https://fake.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "fake-token";
    await testDb.db.insert(schema.cronHeartbeat).values([
      {
        name: "nudge",
        lastRunAt: new Date(NOW.getTime() - 3 * 60 * 60 * 1000),
      },
      { name: "bai-weekly", lastRunAt: NOW },
      { name: "trial-precharge", lastRunAt: NOW },
      { name: "pantry-sweep", lastRunAt: NOW },
      { name: "stripe-reconcile", lastRunAt: NOW },
    ]);

    const createHealthHandler = await importHandler();
    const GET = createHealthHandler({ db: () => testDb.db, now: () => NOW });
    const response = await GET();

    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toMatchObject({
      ok: false,
      status: "degraded",
      issues: ["cron_nudge_stale"],
    });
  });
});
