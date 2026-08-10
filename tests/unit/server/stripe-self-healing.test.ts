import { eq } from "drizzle-orm";
import type Stripe from "stripe";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from "vitest";

import {
  applyStripeEvent,
  createStripeWebhookHandler
} from "../../../app/api/billing/handlers";
import {
  ingestStripeEvent,
  MAX_INBOX_ATTEMPTS,
  processInboxRow
} from "../../../lib/server/billing/inbox";
import { runStripeReconcileCron } from "../../../lib/server/billing/reconcile";
import { getEntitlement } from "../../../lib/server/entitlement";
import { hashClaimToken } from "../../../lib/server/pantry/claims";
import { runPantrySweep } from "../../../lib/server/pantry/sweep";
import { schema } from "../../../lib/server/db";
import { createTestDb } from "../../helpers/test-db";

const NOW = new Date("2026-07-10T12:00:00.000Z");
const PAST = new Date("2026-07-01T12:00:00.000Z");
const FUTURE = new Date("2026-08-10T12:00:00.000Z");
const FUTURE2 = new Date("2026-09-10T12:00:00.000Z");

let testDb: Awaited<ReturnType<typeof createTestDb>>;
let userId: string;

beforeAll(async () => {
  testDb = await createTestDb();
  const [user] = await testDb.db
    .insert(schema.users)
    .values({ email: "heal@test.dev" })
    .returning();
  userId = user.id;
});

afterAll(async () => {
  await testDb.close();
});

beforeEach(async () => {
  await testDb.db.delete(schema.subscriptions);
  await testDb.db.delete(schema.billingEventInbox);
});

// ── helpers ──────────────────────────────────────────────────────────────────

let evtCounter = 0;
/** Build a Stripe event with a unique id and a `created` (unix seconds). */
function evt(
  type: string,
  object: Record<string, unknown>,
  createdSeconds: number,
  id?: string
): Stripe.Event {
  return {
    id: id ?? `evt_${++evtCounter}`,
    created: createdSeconds,
    type,
    data: { object }
  } as unknown as Stripe.Event;
}

function seedSub(overrides: Partial<typeof schema.subscriptions.$inferInsert>) {
  return testDb.db.insert(schema.subscriptions).values({
    userId,
    provider: "stripe",
    providerRef: "sub_x",
    productId: "premium_monthly",
    status: "active",
    currentPeriodEnd: FUTURE,
    ...overrides
  });
}

const deps = (extra: Record<string, unknown> = {}) => ({
  now: () => NOW,
  ...extra
});

// ── 1. Durable inbox: dedupe ─────────────────────────────────────────────────

describe("durable inbox — dedupe by provider event id", () => {
  it("stores the event, processes it once, and acks a redelivery as duplicate", async () => {
    await seedSub({ providerRef: "sub_dedupe", status: "trialing", currentPeriodEnd: FUTURE });

    const stripe = () =>
      ({
        subscriptions: {
          retrieve: vi.fn().mockResolvedValue({
            status: "active",
            items: {
              data: [{ current_period_end: Math.floor(FUTURE2.getTime() / 1000) }]
            }
          })
        }
      }) as unknown as Stripe;

    const event = evt(
      "invoice.paid",
      { parent: { subscription_details: { subscription: "sub_dedupe" } } },
      Math.floor(NOW.getTime() / 1000),
      "evt_dupe"
    );

    const first = await ingestStripeEvent(testDb.db, event, deps({ stripe }));
    const second = await ingestStripeEvent(testDb.db, event, deps({ stripe }));

    expect(first).toBe("processed");
    expect(second).toBe("duplicate");

    // Exactly one inbox row, marked processed.
    const inbox = await testDb.db.select().from(schema.billingEventInbox);
    expect(inbox).toHaveLength(1);
    expect(inbox[0].status).toBe("processed");
    expect(inbox[0].processedAt).not.toBeNull();

    // The reducer ran once: trial converted to active.
    const [row] = await testDb.db
      .select()
      .from(schema.subscriptions)
      .where(eq(schema.subscriptions.providerRef, "sub_dedupe"));
    expect(row.status).toBe("active");
  });

  it("a failed row is reprocessed on redelivery (not dropped as duplicate)", async () => {
    let attempts = 0;
    const apply = vi.fn(async () => {
      attempts += 1;
      if (attempts === 1) {
        throw new Error("transient");
      }
      // second attempt succeeds (no-op)
    });

    const event = evt("customer.subscription.updated", { id: "sub_retry" }, 100, "evt_retry");

    const first = await ingestStripeEvent(testDb.db, event, deps({ apply }));
    expect(first).toBe("failed");
    let [row] = await testDb.db.select().from(schema.billingEventInbox);
    expect(row.status).toBe("failed");
    expect(row.attempts).toBe(1);
    expect(row.lastError).toBe("Error");

    // Stripe redelivers the same event id → we reprocess the failed row.
    const second = await ingestStripeEvent(testDb.db, event, deps({ apply }));
    expect(second).toBe("processed");
    [row] = await testDb.db.select().from(schema.billingEventInbox);
    expect(row.status).toBe("processed");
    expect(apply).toHaveBeenCalledTimes(2);
  });

  it("dead-letters once attempts are exhausted", async () => {
    const apply = vi.fn(async () => {
      throw new Error("poison");
    });
    const info = vi.spyOn(console, "info").mockImplementation(() => {});

    const event = evt("charge.refunded", {}, 100, "evt_poison");

    let outcome: string = "";
    for (let i = 0; i < MAX_INBOX_ATTEMPTS; i++) {
      outcome = await ingestStripeEvent(testDb.db, event, deps({ apply }));
    }

    expect(outcome).toBe("dead_letter");
    const [row] = await testDb.db.select().from(schema.billingEventInbox);
    expect(row.status).toBe("dead_letter");
    expect(row.attempts).toBe(MAX_INBOX_ATTEMPTS);

    const dead = info.mock.calls
      .map((c) => JSON.parse(String(c[0])))
      .filter((e) => e.name === "stripe_inbox_dead_letter");
    expect(dead.length).toBeGreaterThanOrEqual(1);
    info.mockRestore();
  });
});

// ── 2. Webhook handler retry semantics ───────────────────────────────────────

describe("webhook handler — retry-honest HTTP status", () => {
  function webhookRequest() {
    return new Request("https://x.test/api/billing/stripe/webhook", {
      method: "POST",
      headers: { "stripe-signature": "sig" },
      body: "{}"
    });
  }

  beforeEach(() => {
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_unit_test_secret";
  });

  it("503s (fail closed) when the signing secret is missing — never verifies under an empty key", async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    const constructEventAsync = vi.fn();
    const GET = createStripeWebhookHandler({
      db: () => testDb.db,
      stripeClient: () =>
        ({ webhooks: { constructEventAsync } }) as unknown as Stripe,
      now: () => NOW
    });

    const response = await GET(webhookRequest());

    // Old behavior passed secret="" to stripe-node, which happily HMACs under
    // the empty (public) key — a forgeable signature that could mint premium.
    expect(response.status).toBe(503);
    expect(constructEventAsync).not.toHaveBeenCalled();
    expect(await testDb.db.select().from(schema.billingEventInbox)).toHaveLength(0);
  });

  it("200 on first process, 200 duplicate on redelivery, 500 on reducer failure", async () => {
    const event = evt("customer.subscription.updated", { id: "sub_wh" }, 100, "evt_wh_ok");
    const okStripe = () =>
      ({
        webhooks: { constructEventAsync: vi.fn().mockResolvedValue(event) }
      }) as unknown as Stripe;

    const GET = createStripeWebhookHandler({
      db: () => testDb.db,
      stripeClient: okStripe,
      now: () => NOW
    });

    const first = await GET(webhookRequest());
    expect(first.status).toBe(200);
    const second = await GET(webhookRequest());
    expect(second.status).toBe(200);
    expect((await second.json()).outcome).toBe("duplicate");

    // A reducer that throws → 500 so Stripe retries. charge.refunded whose
    // invoice lookup rejects is the simplest event that makes the reducer throw.
    const throwing = createStripeWebhookHandler({
      db: () => testDb.db,
      stripeClient: () =>
        ({
          webhooks: {
            constructEventAsync: vi
              .fn()
              .mockResolvedValue(evt("charge.refunded", { refunded: true, invoice: "in_x" }, 100, "evt_wh_500"))
          },
          invoices: { retrieve: vi.fn().mockRejectedValue(new Error("stripe down")) }
        }) as unknown as Stripe,
      now: () => NOW
    });
    const failed = await throwing(webhookRequest());
    expect(failed.status).toBe(500);
  });

  it("400 on a bad signature — nothing is stored", async () => {
    const GET = createStripeWebhookHandler({
      db: () => testDb.db,
      stripeClient: () =>
        ({
          webhooks: {
            constructEventAsync: vi.fn().mockRejectedValue(new Error("bad sig"))
          }
        }) as unknown as Stripe,
      now: () => NOW
    });
    const res = await GET(webhookRequest());
    expect(res.status).toBe(400);
    const inbox = await testDb.db.select().from(schema.billingEventInbox);
    expect(inbox).toHaveLength(0);
  });
});

// ── 3. Idempotent, order-tolerant reducer (permutations) ─────────────────────

/** Apply an event list against a freshly-seeded row and return final status. */
async function runSequence(
  events: Stripe.Event[],
  stripe?: () => Stripe
): Promise<string> {
  await testDb.db.delete(schema.subscriptions);
  await seedSub({ providerRef: "sub_perm", status: "active", currentPeriodEnd: FUTURE });
  for (const event of events) {
    await applyStripeEvent(testDb.db, event, NOW, stripe);
  }
  const [row] = await testDb.db
    .select()
    .from(schema.subscriptions)
    .where(eq(schema.subscriptions.providerRef, "sub_perm"));
  return row.status;
}

function permutations<T>(items: T[]): T[][] {
  if (items.length <= 1) return [items];
  const out: T[][] = [];
  items.forEach((item, i) => {
    const rest = [...items.slice(0, i), ...items.slice(i + 1)];
    for (const p of permutations(rest)) out.push([item, ...p]);
  });
  return out;
}

describe("reducer — order tolerance (latest-event-wins per providerRef)", () => {
  it("converges to `expired` for every ordering of update/cancel/delete", async () => {
    const updated = evt(
      "customer.subscription.updated",
      { id: "sub_perm", status: "active", items: { data: [{ current_period_end: Math.floor(FUTURE.getTime() / 1000) }] } },
      100
    );
    const canceledFlag = evt(
      "customer.subscription.updated",
      { id: "sub_perm", status: "active", cancel_at_period_end: true, items: { data: [{ current_period_end: Math.floor(FUTURE.getTime() / 1000) }] } },
      200
    );
    const deleted = evt(
      "customer.subscription.deleted",
      { id: "sub_perm", status: "canceled", items: { data: [{ current_period_end: Math.floor(NOW.getTime() / 1000) }] } },
      300
    );

    const results = new Set<string>();
    for (const order of permutations([updated, canceledFlag, deleted])) {
      results.add(await runSequence(order));
    }
    // Deleted (created=300) is newest → expired wins in all 6 orderings.
    expect([...results]).toEqual(["expired"]);
  });

  it("`refunded` is terminal and wins over every ordering, even a later delete", async () => {
    const stripe = () =>
      ({
        invoices: {
          retrieve: vi.fn().mockResolvedValue({
            parent: { subscription_details: { subscription: "sub_perm" } }
          })
        }
      }) as unknown as Stripe;

    const updated = evt(
      "customer.subscription.updated",
      { id: "sub_perm", status: "active", items: { data: [{ current_period_end: Math.floor(FUTURE.getTime() / 1000) }] } },
      100
    );
    const refunded = evt(
      "charge.refunded",
      { payment_intent: "pi_x", refunded: true, invoice: "in_x" },
      200
    );
    const deleted = evt(
      "customer.subscription.deleted",
      { id: "sub_perm", status: "canceled", items: { data: [{ current_period_end: Math.floor(NOW.getTime() / 1000) }] } },
      300
    );

    const results = new Set<string>();
    for (const order of permutations([updated, refunded, deleted])) {
      results.add(await runSequence(order, stripe));
    }
    expect([...results]).toEqual(["refunded"]);
  });

  it("a stale invoice.paid (older `created`) never re-refreshes an active row backwards", async () => {
    await testDb.db.delete(schema.subscriptions);
    await seedSub({ providerRef: "sub_stale", status: "active", currentPeriodEnd: FUTURE });

    const retrieve = vi.fn().mockResolvedValue({
      status: "active",
      items: { data: [{ current_period_end: Math.floor(FUTURE2.getTime() / 1000) }] }
    });
    const stripe = () => ({ subscriptions: { retrieve } }) as unknown as Stripe;

    const newer = evt(
      "invoice.paid",
      { parent: { subscription_details: { subscription: "sub_stale" } } },
      200
    );
    const older = evt(
      "invoice.paid",
      { parent: { subscription_details: { subscription: "sub_stale" } } },
      100
    );

    await applyStripeEvent(testDb.db, newer, NOW, stripe);
    await applyStripeEvent(testDb.db, older, NOW, stripe);

    const [row] = await testDb.db
      .select()
      .from(schema.subscriptions)
      .where(eq(schema.subscriptions.providerRef, "sub_stale"));
    expect(row.currentPeriodEnd.toISOString()).toBe(FUTURE2.toISOString());
    // The stale event returned before the Stripe fetch — retrieve ran once.
    expect(retrieve).toHaveBeenCalledTimes(1);
  });

  it("a checkout.session.completed replayed after a refund does not resurrect premium", async () => {
    await testDb.db.delete(schema.subscriptions);
    await seedSub({ providerRef: "sub_ref", status: "refunded", currentPeriodEnd: FUTURE });

    const stripe = () =>
      ({
        subscriptions: {
          retrieve: vi.fn().mockResolvedValue({
            items: { data: [{ price: { id: "p" }, current_period_end: Math.floor(FUTURE.getTime() / 1000) }] }
          })
        }
      }) as unknown as Stripe;

    await applyStripeEvent(
      testDb.db,
      evt(
        "checkout.session.completed",
        { client_reference_id: userId, subscription: "sub_ref" },
        400
      ),
      NOW,
      stripe
    );

    const [row] = await testDb.db
      .select()
      .from(schema.subscriptions)
      .where(eq(schema.subscriptions.providerRef, "sub_ref"));
    expect(row.status).toBe("refunded");
  });
});

// ── 4. Stripe verify-on-read heal ────────────────────────────────────────────

describe("getEntitlement — Stripe verify-on-read", () => {
  it("heals a stale premium-status row (past period end) against Stripe", async () => {
    await seedSub({
      providerRef: "sub_heal",
      status: "active",
      currentPeriodEnd: PAST,
      lastVerifiedAt: null
    });
    const refreshStripeSubscription = vi
      .fn()
      .mockResolvedValue({ status: "active", currentPeriodEnd: FUTURE });
    const info = vi.spyOn(console, "info").mockImplementation(() => {});

    const result = await getEntitlement(testDb.db, userId, {
      now: () => NOW,
      refreshStripeSubscription
    });

    expect(result.tier).toBe("premium");
    expect(result.source).toBe("stripe");
    expect(result.currentPeriodEnd?.toISOString()).toBe(FUTURE.toISOString());
    expect(refreshStripeSubscription).toHaveBeenCalledTimes(1);

    const [row] = await testDb.db
      .select()
      .from(schema.subscriptions)
      .where(eq(schema.subscriptions.providerRef, "sub_heal"));
    expect(row.lastVerifiedAt).not.toBeNull();

    const recovered = info.mock.calls
      .map((c) => JSON.parse(String(c[0])))
      .filter((e) => e.name === "entitlement_recovered");
    expect(recovered.length).toBe(1);
    expect(recovered[0].provider).toBe("stripe");
    info.mockRestore();
  });

  it("does NOT re-check a row verified within the last hour (time-gated)", async () => {
    await seedSub({
      providerRef: "sub_gated",
      status: "active",
      currentPeriodEnd: PAST,
      lastVerifiedAt: new Date(NOW.getTime() - 30 * 60 * 1000)
    });
    const refreshStripeSubscription = vi.fn();

    const result = await getEntitlement(testDb.db, userId, {
      now: () => NOW,
      refreshStripeSubscription
    });

    expect(refreshStripeSubscription).not.toHaveBeenCalled();
    expect(result.tier).toBe("free");
  });

  it("never grants when the Stripe lookup throws (fails toward free)", async () => {
    await seedSub({
      providerRef: "sub_down",
      status: "active",
      currentPeriodEnd: PAST
    });
    const refreshStripeSubscription = vi
      .fn()
      .mockRejectedValue(new Error("stripe down"));

    const result = await getEntitlement(testDb.db, userId, {
      now: () => NOW,
      refreshStripeSubscription
    });
    expect(result.tier).toBe("free");
  });
});

// ── 5. Reconciliation sweep ──────────────────────────────────────────────────

describe("runStripeReconcileCron", () => {
  it("reprocesses pending/failed inbox rows and dead-letters the exhausted ones", async () => {
    // A benign event that the real reducer no-ops (no matching row) — succeeds.
    await testDb.db.insert(schema.billingEventInbox).values({
      provider: "stripe",
      providerEventId: "evt_ok",
      eventType: "customer.subscription.updated",
      payload: evt("customer.subscription.updated", { id: "nobody" }, 100, "evt_ok") as never,
      status: "failed",
      attempts: 1,
      receivedAt: PAST
    });
    // A poison row one failure short of the ceiling.
    await testDb.db.insert(schema.billingEventInbox).values({
      provider: "stripe",
      providerEventId: "evt_dead",
      eventType: "customer.subscription.updated",
      payload: evt("__throw__", {}, 100, "evt_dead") as never,
      status: "failed",
      attempts: MAX_INBOX_ATTEMPTS - 1,
      receivedAt: PAST
    });

    const apply = async (
      db: never,
      event: Stripe.Event,
      now: Date,
      stripe?: () => Stripe,
      email?: never
    ) => {
      if ((event.type as string) === "__throw__") throw new Error("still poison");
      await applyStripeEvent(db, event, now, stripe, email);
    };
    const info = vi.spyOn(console, "info").mockImplementation(() => {});

    const result = await runStripeReconcileCron(testDb.db, {
      now: () => NOW,
      apply: apply as never
    });

    expect(result.reprocessed).toBe(1);
    expect(result.deadLettered).toBe(1);

    const rows = await testDb.db.select().from(schema.billingEventInbox);
    const byId = Object.fromEntries(rows.map((r) => [r.providerEventId, r]));
    expect(byId.evt_ok.status).toBe("processed");
    expect(byId.evt_dead.status).toBe("dead_letter");
    expect(byId.evt_dead.attempts).toBe(MAX_INBOX_ATTEMPTS);

    // Heartbeat recorded + dead-letter alert emitted.
    const [hb] = await testDb.db
      .select()
      .from(schema.cronHeartbeat)
      .where(eq(schema.cronHeartbeat.name, "stripe-reconcile"));
    expect(hb).toBeTruthy();

    const alerts = info.mock.calls
      .map((c) => JSON.parse(String(c[0])))
      .filter((e) => e.name === "stripe_inbox_dead_letter");
    expect(alerts.length).toBeGreaterThanOrEqual(1);
    info.mockRestore();
  });

  it("verifies a near-horizon subscription and alerts on entitlement-without-subscription", async () => {
    await seedSub({
      providerRef: "sub_mismatch",
      status: "active",
      currentPeriodEnd: PAST
    });
    const stripe = () =>
      ({
        subscriptions: {
          retrieve: vi.fn().mockResolvedValue({
            status: "incomplete_expired",
            items: { data: [{ current_period_end: Math.floor(PAST.getTime() / 1000) }] }
          })
        }
      }) as unknown as Stripe;
    const info = vi.spyOn(console, "info").mockImplementation(() => {});

    const result = await runStripeReconcileCron(testDb.db, {
      now: () => NOW,
      stripe
    });

    expect(result.healed).toBe(1);
    const [row] = await testDb.db
      .select()
      .from(schema.subscriptions)
      .where(eq(schema.subscriptions.providerRef, "sub_mismatch"));
    expect(row.status).toBe("expired");
    expect(row.lastVerifiedAt).not.toBeNull();

    const alerts = info.mock.calls
      .map((c) => JSON.parse(String(c[0])))
      .filter((e) => e.name === "entitlement_without_subscription");
    expect(alerts.length).toBe(1);
    info.mockRestore();
  });

  it("flags charge-without-entitlement: a processed paid invoice, past SLO, with no row", async () => {
    await testDb.db.insert(schema.billingEventInbox).values({
      provider: "stripe",
      providerEventId: "evt_ghost",
      eventType: "invoice.paid",
      payload: evt(
        "invoice.paid",
        {
          billing_reason: "subscription_cycle",
          parent: { subscription_details: { subscription: "sub_ghost" } }
        },
        100,
        "evt_ghost"
      ) as never,
      status: "processed",
      receivedAt: new Date(NOW.getTime() - 5 * 60 * 1000) // 5 min ago, past SLO
    });
    const info = vi.spyOn(console, "info").mockImplementation(() => {});

    const result = await runStripeReconcileCron(testDb.db, { now: () => NOW });

    expect(result.chargesWithoutEntitlement).toBe(1);
    const alerts = info.mock.calls
      .map((c) => JSON.parse(String(c[0])))
      .filter((e) => e.name === "charge_without_entitlement");
    expect(alerts.length).toBe(1);
    info.mockRestore();
  });
});

// ── 5b. Transactional atomicity (reviewer #1) ────────────────────────────────

describe("inbox — transactional atomicity", () => {
  it("rolls back a partial subscription write when the reducer throws mid-apply", async () => {
    // apply writes a subscription row and THEN throws — the transaction must
    // undo the write, leaving no ghost row, and mark the inbox row failed.
    const apply = (async (db: typeof testDb.db) => {
      await db.insert(schema.subscriptions).values({
        userId,
        provider: "stripe",
        providerRef: "sub_partial_rollback",
        productId: "premium_monthly",
        status: "active",
        currentPeriodEnd: FUTURE
      });
      throw new Error("boom after write");
    }) as unknown as typeof applyStripeEvent;

    const event = evt("customer.subscription.updated", { id: "x" }, 100, "evt_rollback");
    const outcome = await ingestStripeEvent(testDb.db, event, deps({ apply }));
    expect(outcome).toBe("failed");

    // The write was rolled back with the transaction.
    const subs = await testDb.db
      .select()
      .from(schema.subscriptions)
      .where(eq(schema.subscriptions.providerRef, "sub_partial_rollback"));
    expect(subs).toHaveLength(0);

    // The failure record itself persists (written outside the rolled-back tx).
    const [inbox] = await testDb.db.select().from(schema.billingEventInbox);
    expect(inbox.status).toBe("failed");
    expect(inbox.attempts).toBe(1);
  });
});

// ── 5c. charge-without-entitlement window + pruning (reviewer #2) ─────────────

describe("reconcile — charge scan window + pruning", () => {
  it("catches a RECENT ghost even when >100 older processed rows exist", async () => {
    // 100 processed invoice.paid rows OUTSIDE the 7-day scan window — under the
    // old oldest-first, unbounded scan these would crowd out the recent ghost.
    const old = new Date(NOW.getTime() - 10 * 24 * 60 * 60 * 1000);
    await testDb.db.insert(schema.billingEventInbox).values(
      Array.from({ length: 100 }, (_, i) => ({
        provider: "stripe" as const,
        providerEventId: `evt_old_${i}`,
        eventType: "invoice.paid",
        payload: evt(
          "invoice.paid",
          { billing_reason: "subscription_cycle", parent: { subscription_details: { subscription: `sub_old_${i}` } } },
          100,
          `evt_old_${i}`
        ) as never,
        status: "processed" as const,
        receivedAt: old,
        processedAt: old
      }))
    );
    // One recent ghost (2 min ago, inside window, past the 60s SLO), no row.
    await testDb.db.insert(schema.billingEventInbox).values({
      provider: "stripe",
      providerEventId: "evt_recent_ghost",
      eventType: "invoice.paid",
      payload: evt(
        "invoice.paid",
        { billing_reason: "subscription_cycle", parent: { subscription_details: { subscription: "sub_recent_ghost" } } },
        100,
        "evt_recent_ghost"
      ) as never,
      status: "processed",
      receivedAt: new Date(NOW.getTime() - 2 * 60 * 1000),
      processedAt: new Date(NOW.getTime() - 2 * 60 * 1000)
    });
    const info = vi.spyOn(console, "info").mockImplementation(() => {});

    const result = await runStripeReconcileCron(testDb.db, { now: () => NOW });

    expect(result.chargesWithoutEntitlement).toBe(1);
    const alerts = info.mock.calls
      .map((c) => JSON.parse(String(c[0])))
      .filter((e) => e.name === "charge_without_entitlement");
    expect(alerts.length).toBe(1);
    info.mockRestore();
  });

  it("prunes processed rows older than the retention window, keeps recent ones", async () => {
    await testDb.db.insert(schema.billingEventInbox).values([
      {
        provider: "stripe",
        providerEventId: "evt_stale_processed",
        eventType: "customer.subscription.updated",
        payload: {} as never,
        status: "processed",
        receivedAt: new Date(NOW.getTime() - 40 * 24 * 60 * 60 * 1000),
        processedAt: new Date(NOW.getTime() - 40 * 24 * 60 * 60 * 1000)
      },
      {
        provider: "stripe",
        providerEventId: "evt_fresh_processed",
        eventType: "customer.subscription.updated",
        payload: {} as never,
        status: "processed",
        receivedAt: new Date(NOW.getTime() - 5 * 24 * 60 * 60 * 1000),
        processedAt: new Date(NOW.getTime() - 5 * 24 * 60 * 60 * 1000)
      },
      {
        provider: "stripe",
        providerEventId: "evt_stale_failed",
        eventType: "customer.subscription.updated",
        payload: { customer_email: "old-failed@example.com" } as never,
        status: "failed",
        attempts: MAX_INBOX_ATTEMPTS,
        receivedAt: new Date(NOW.getTime() - 40 * 24 * 60 * 60 * 1000)
      },
      {
        provider: "stripe",
        providerEventId: "evt_stale_dead",
        eventType: "customer.subscription.updated",
        payload: { customer_email: "old-dead@example.com" } as never,
        status: "dead_letter",
        receivedAt: new Date(NOW.getTime() - 40 * 24 * 60 * 60 * 1000)
      }
    ]);

    const result = await runStripeReconcileCron(testDb.db, { now: () => NOW });

    expect(result.pruned).toBe(3);
    const remaining = await testDb.db.select().from(schema.billingEventInbox);
    const ids = remaining.map((r) => r.providerEventId);
    expect(ids).toContain("evt_fresh_processed");
    expect(ids).not.toContain("evt_stale_processed");
    expect(ids).not.toContain("evt_stale_failed");
    expect(ids).not.toContain("evt_stale_dead");
  });
});

// ── 6. Delayed-event alert ───────────────────────────────────────────────────

describe("inbox — delayed-event alert", () => {
  it("alerts when a webhook arrives more than 60s after the event was created", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const event = evt(
      "customer.subscription.updated",
      { id: "sub_delayed" },
      Math.floor((NOW.getTime() - 5 * 60 * 1000) / 1000), // created 5 min ago
      "evt_delayed"
    );
    await ingestStripeEvent(testDb.db, event, deps());

    const delayed = info.mock.calls
      .map((c) => JSON.parse(String(c[0])))
      .filter((e) => e.name === "stripe_event_delayed");
    expect(delayed.length).toBe(1);
    expect(delayed[0].latency).toBe("under_5m");
    info.mockRestore();
  });
});

// ── 7. B1: durable, non-clobbering failure accounting ────────────────────────

describe("inbox failure path (B1) — attempts off the DB, never clobbers a winner", () => {
  it("increments attempts off the DB value, not the (possibly stale) passed row", async () => {
    // The DB row is already at attempts=2; a caller processes it holding a STALE
    // snapshot (attempts=0). The SQL `attempts + 1` must count from the DB's 2.
    const [ins] = await testDb.db
      .insert(schema.billingEventInbox)
      .values({
        provider: "stripe",
        providerEventId: "evt_b1_stale",
        eventType: "customer.subscription.updated",
        payload: evt(
          "customer.subscription.updated",
          { id: "x" },
          100,
          "evt_b1_stale"
        ) as never,
        status: "failed",
        attempts: 2,
        receivedAt: PAST
      })
      .returning();

    const throwingApply = (async () => {
      throw new Error("still transient");
    }) as unknown as typeof applyStripeEvent;

    const outcome = await processInboxRow(
      testDb.db,
      { ...ins, attempts: 0 },
      deps({ apply: throwingApply })
    );

    expect(outcome).toBe("failed");
    const [row] = await testDb.db.select().from(schema.billingEventInbox);
    expect(row.attempts).toBe(3); // 2 (DB) + 1 — NOT 0 (passed row) + 1
  });

  it("never knocks a row a concurrent worker already processed back to failed", async () => {
    // Simulate the race: the DB row is `processed`, but this worker is running
    // with an older `pending` snapshot and its apply is about to throw. The
    // guarded write (and the FOR UPDATE re-read) must leave `processed` intact
    // and page nobody.
    const [ins] = await testDb.db
      .insert(schema.billingEventInbox)
      .values({
        provider: "stripe",
        providerEventId: "evt_b1_won",
        eventType: "customer.subscription.updated",
        payload: evt(
          "customer.subscription.updated",
          { id: "x" },
          100,
          "evt_b1_won"
        ) as never,
        status: "processed",
        attempts: 1,
        processedAt: PAST,
        receivedAt: PAST
      })
      .returning();
    const info = vi.spyOn(console, "info").mockImplementation(() => {});

    const throwingApply = (async () => {
      throw new Error("boom");
    }) as unknown as typeof applyStripeEvent;

    const outcome = await processInboxRow(
      testDb.db,
      { ...ins, status: "pending" },
      deps({ apply: throwingApply })
    );

    expect(outcome).toBe("duplicate");
    const [row] = await testDb.db.select().from(schema.billingEventInbox);
    expect(row.status).toBe("processed");
    expect(row.attempts).toBe(1); // untouched

    const dead = info.mock.calls
      .map((c) => JSON.parse(String(c[0])))
      .filter((e) => e.name === "stripe_inbox_dead_letter");
    expect(dead.length).toBe(0); // no false dead-letter page
    info.mockRestore();
  });
});

// ── 8. B2: `expired` (deleted) is terminal even against an equal-`created` update

describe("reducer terminality (B2) — a deleted sub never reactivates", () => {
  function deletedEvt(created: number) {
    return evt(
      "customer.subscription.deleted",
      {
        id: "sub_perm",
        status: "canceled",
        items: { data: [{ current_period_end: Math.floor(NOW.getTime() / 1000) }] }
      },
      created
    );
  }
  function activeUpdatedEvt(created: number) {
    return evt(
      "customer.subscription.updated",
      {
        id: "sub_perm",
        status: "active",
        items: { data: [{ current_period_end: Math.floor(FUTURE.getTime() / 1000) }] }
      },
      created
    );
  }

  it("converges to expired for a delete + an EQUAL-`created` active update, both orders", async () => {
    // Equal `created` (200) is NOT strictly stale, so without the expired-guard
    // an update landing after a delete would resurrect premium.
    const deleteThenUpdate = await runSequence([
      deletedEvt(200),
      activeUpdatedEvt(200)
    ]);
    const updateThenDelete = await runSequence([
      activeUpdatedEvt(200),
      deletedEvt(200)
    ]);

    expect(deleteThenUpdate).toBe("expired");
    expect(updateThenDelete).toBe("expired");
  });
});

// ── 9. B3: a mid-fetch refund is terminal on both heal paths ──────────────────

describe("verify-on-read + reconcile (B3) — a mid-fetch refund is never overwritten", () => {
  it("getEntitlement does not resurrect a row that goes refunded during the Stripe fetch", async () => {
    await seedSub({
      providerRef: "sub_b3_ent",
      status: "active",
      currentPeriodEnd: PAST,
      lastVerifiedAt: null
    });

    // charge.refunded commits WHILE we are out fetching the (still-active) sub.
    const refreshStripeSubscription = vi.fn(async () => {
      await testDb.db
        .update(schema.subscriptions)
        .set({ status: "refunded" })
        .where(eq(schema.subscriptions.providerRef, "sub_b3_ent"));
      return { status: "active" as const, currentPeriodEnd: FUTURE };
    });

    const result = await getEntitlement(testDb.db, userId, {
      now: () => NOW,
      refreshStripeSubscription
    });

    expect(result.tier).toBe("free"); // never grant a refunded user
    const [row] = await testDb.db
      .select()
      .from(schema.subscriptions)
      .where(eq(schema.subscriptions.providerRef, "sub_b3_ent"));
    expect(row.status).toBe("refunded"); // not overwritten to active
  });

  it("runStripeReconcileCron does not resurrect a row that goes refunded during the fetch", async () => {
    await seedSub({
      providerRef: "sub_b3_rec",
      status: "active",
      currentPeriodEnd: PAST
    });

    const stripe = () =>
      ({
        subscriptions: {
          retrieve: vi.fn(async () => {
            await testDb.db
              .update(schema.subscriptions)
              .set({ status: "refunded" })
              .where(eq(schema.subscriptions.providerRef, "sub_b3_rec"));
            return {
              status: "active",
              items: {
                data: [{ current_period_end: Math.floor(FUTURE.getTime() / 1000) }]
              }
            };
          })
        }
      }) as unknown as Stripe;
    const info = vi.spyOn(console, "info").mockImplementation(() => {});

    await runStripeReconcileCron(testDb.db, { now: () => NOW, stripe });

    const [row] = await testDb.db
      .select()
      .from(schema.subscriptions)
      .where(eq(schema.subscriptions.providerRef, "sub_b3_rec"));
    expect(row.status).toBe("refunded");
    info.mockRestore();
  });

  it("getEntitlement does not resurrect a row that goes expired during the Stripe fetch", async () => {
    await seedSub({
      providerRef: "sub_exp_ent",
      status: "active",
      currentPeriodEnd: PAST,
      lastVerifiedAt: null
    });

    // subscription.deleted → expired commits WHILE we are out fetching.
    const refreshStripeSubscription = vi.fn(async () => {
      await testDb.db
        .update(schema.subscriptions)
        .set({ status: "expired" })
        .where(eq(schema.subscriptions.providerRef, "sub_exp_ent"));
      return { status: "active" as const, currentPeriodEnd: FUTURE };
    });

    const result = await getEntitlement(testDb.db, userId, {
      now: () => NOW,
      refreshStripeSubscription
    });

    expect(result.tier).toBe("free");
    const [row] = await testDb.db
      .select()
      .from(schema.subscriptions)
      .where(eq(schema.subscriptions.providerRef, "sub_exp_ent"));
    expect(row.status).toBe("expired");
  });

  it("runStripeReconcileCron does not resurrect a row that goes expired during the fetch", async () => {
    await seedSub({
      providerRef: "sub_exp_rec",
      status: "active",
      currentPeriodEnd: PAST
    });

    const stripe = () =>
      ({
        subscriptions: {
          retrieve: vi.fn(async () => {
            await testDb.db
              .update(schema.subscriptions)
              .set({ status: "expired" })
              .where(eq(schema.subscriptions.providerRef, "sub_exp_rec"));
            return {
              status: "active",
              items: {
                data: [{ current_period_end: Math.floor(FUTURE.getTime() / 1000) }]
              }
            };
          })
        }
      }) as unknown as Stripe;
    const info = vi.spyOn(console, "info").mockImplementation(() => {});

    await runStripeReconcileCron(testDb.db, { now: () => NOW, stripe });

    const [row] = await testDb.db
      .select()
      .from(schema.subscriptions)
      .where(eq(schema.subscriptions.providerRef, "sub_exp_rec"));
    expect(row.status).toBe("expired");
    info.mockRestore();
  });
});

// ── 10. B4: emails dispatched only AFTER the inbox transaction commits ────────

describe("inbox email dispatch (B4) — post-commit, once, stable token", () => {
  beforeAll(() => {
    process.env.HEALTH_DATA_KEY = Buffer.alloc(32, 7).toString("base64");
    process.env.STRIPE_PRICE_PANTRY = "price_pantry_25";
    process.env.NEXT_PUBLIC_APP_URL = "https://pal.test";
  });
  afterAll(() => {
    delete process.env.STRIPE_PRICE_PANTRY;
  });
  beforeEach(async () => {
    await testDb.db.delete(schema.pantryOrders);
  });

  function pantryEvent(id: string) {
    return evt(
      "checkout.session.completed",
      {
        id: `cs_${id}`,
        mode: "payment",
        payment_intent: `pi_${id}`,
        customer_details: { email: "buyer@example.com" },
        subscription: null,
        client_reference_id: null
      },
      Math.floor(NOW.getTime() / 1000),
      `evt_${id}`
    );
  }
  const pantryStripe = () =>
    ({
      checkout: {
        sessions: {
          retrieve: vi.fn().mockResolvedValue({
            customer_details: { email: "buyer@example.com" },
            customer_email: null
          }),
          listLineItems: vi.fn().mockResolvedValue({
            data: [{ price: { id: "price_pantry_25" } }]
          })
        }
      }
    }) as unknown as Stripe;

  it("dispatches the pantry claim email through the inbox and stamps the order once", async () => {
    const send = vi.fn().mockResolvedValue({ ok: true });

    const first = await ingestStripeEvent(
      testDb.db,
      pantryEvent("b4_ok"),
      deps({ stripe: pantryStripe, email: { send } })
    );
    expect(first).toBe("processed");
    // Sent AFTER the transaction committed — the order is queryable and stamped.
    expect(send).toHaveBeenCalledTimes(1);

    const [order] = await testDb.db.select().from(schema.pantryOrders);
    expect(order.status).toBe("paid");
    expect(order.intakeEmailSentAt).not.toBeNull();
    const token =
      /token=([A-Za-z0-9_-]+)/.exec(send.mock.calls[0][0].text)?.[1] ?? "";
    expect(hashClaimToken(token)).toBe(order.claimToken);

    // Redelivery of the same event id → duplicate, no second email, stable token.
    const second = await ingestStripeEvent(
      testDb.db,
      pantryEvent("b4_ok"),
      deps({ stripe: pantryStripe, email: { send } })
    );
    expect(second).toBe("duplicate");
    expect(send).toHaveBeenCalledTimes(1);
    const [orderAfter] = await testDb.db.select().from(schema.pantryOrders);
    expect(orderAfter.claimToken).toBe(order.claimToken);
  });

  it("a reducer that throws (rolled-back tx) dispatches NO email", async () => {
    const send = vi.fn();
    const throwingApply = (async () => {
      throw new Error("boom before commit");
    }) as unknown as typeof applyStripeEvent;

    const outcome = await ingestStripeEvent(
      testDb.db,
      evt("customer.subscription.updated", { id: "x" }, 100, "evt_b4_throw"),
      deps({ apply: throwingApply, email: { send } })
    );

    expect(outcome).toBe("failed");
    expect(send).not.toHaveBeenCalled();
  });

  it("recovers a failed paid-order email exactly once through the durable Pantry sweep", async () => {
    const send = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValue({ ok: true });
    const event = pantryEvent("b4_recover");

    expect(
      await ingestStripeEvent(
        testDb.db,
        event,
        deps({ stripe: pantryStripe, email: { send } })
      )
    ).toBe("processed");

    let [order] = await testDb.db.select().from(schema.pantryOrders);
    expect(order.intakeEmailSentAt).toBeNull();
    const firstToken =
      /token=([A-Za-z0-9_-]+)/.exec(send.mock.calls[0][0].text)?.[1] ?? "";
    expect(hashClaimToken(firstToken)).toBe(order.claimToken);

    const recoveryAt = new Date(NOW.getTime() + 60 * 60 * 1000);
    const sweepDeps = {
      db: testDb.db,
      model: { generate: vi.fn() } as never,
      email: { send },
      deleteBlobs: vi.fn().mockResolvedValue(undefined),
      listBlobs: vi.fn().mockResolvedValue([]),
      now: () => recoveryAt,
      processOrder: vi.fn().mockResolvedValue({ done: true })
    };

    expect((await runPantrySweep(sweepDeps)).intakeResent).toBe(1);
    [order] = await testDb.db.select().from(schema.pantryOrders);
    expect(order.intakeEmailSentAt?.toISOString()).toBe(
      recoveryAt.toISOString()
    );
    const recoveryToken =
      /token=([A-Za-z0-9_-]+)/.exec(send.mock.calls[1][0].text)?.[1] ?? "";
    expect(recoveryToken).not.toBe(firstToken);
    expect(hashClaimToken(recoveryToken)).toBe(order.claimToken);

    expect((await runPantrySweep(sweepDeps)).intakeResent).toBe(0);
    expect(send).toHaveBeenCalledTimes(2);
  });
});
