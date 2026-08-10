import { eq } from "drizzle-orm";
import type Stripe from "stripe";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// W-33 — deleteOrderBlobs dynamically imports the Blob SDK. Stub the network
// away; the assertion is that the refund path asks for the right objects.
const blobDel = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock("@vercel/blob", () => ({ del: blobDel }));

import {
  applyStripeEvent,
  createCheckoutSyncHandler,
  createEntitlementHandler,
  createPlayRtdnHandler,
  createPlayVerifyHandler,
  createStripeCheckoutHandler,
  createStripePortalHandler
} from "../../../app/api/billing/handlers";
import { encryptField } from "../../../lib/server/crypto";
import { getEntitlement } from "../../../lib/server/entitlement";
import { schema } from "../../../lib/server/db";
import { createTestDb } from "../../helpers/test-db";
import { TERMS_VERSION } from "../../../lib/legal/terms";

const TEST_KEY = Buffer.alloc(32, 6).toString("base64");
const NOW = new Date("2026-07-03T15:00:00.000Z");
const FUTURE = new Date("2026-08-03T15:00:00.000Z");

let testDb: Awaited<ReturnType<typeof createTestDb>>;
let userId: string;

beforeAll(async () => {
  process.env.HEALTH_DATA_KEY = TEST_KEY;
  process.env.RTDN_SHARED_TOKEN = "rtdn-secret";
  process.env.NEXT_PUBLIC_PLAY_BILLING = "1";
  process.env.PANTRY_BLOB_READ_WRITE_TOKEN = "private-blob-test-token";
  // W-04: every paid-checkout entry point 503s unless the deploy declares the
  // terms final. These suites exercise the real paths, so they declare it; the
  // gate itself is proven by its own describe block below.
  process.env.LEGAL_TERMS_FINAL = "1";
  testDb = await createTestDb();
  const [user] = await testDb.db
    .insert(schema.users)
    .values({ email: "billing@test.dev" })
    .returning();
  userId = user.id;
  await testDb.db.insert(schema.profiles).values({
    userId,
    a1cCiphertext: encryptField("6.1"),
    a1cBand: "prediabetes_60_62",
    timezone: "UTC",
    consentedAt: NOW
  });
});

afterAll(async () => {
  delete process.env.HEALTH_DATA_KEY;
  delete process.env.RTDN_SHARED_TOKEN;
  delete process.env.NEXT_PUBLIC_PLAY_BILLING;
  delete process.env.PANTRY_BLOB_READ_WRITE_TOKEN;
  delete process.env.LEGAL_TERMS_FINAL;
  await testDb.close();
});

beforeEach(async () => {
  await testDb.db.delete(schema.subscriptions);
});

const baseDeps = () => ({
  db: () => testDb.db,
  getSession: async () => ({ userId, email: "billing@test.dev" }),
  now: () => NOW
});

function post(url: string, body: unknown) {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      ...(body as Record<string, unknown>),
      termsAccepted: true,
      termsVersion: TERMS_VERSION
    })
  });
}

describe("POST /api/billing/play/verify", () => {
  it("fails closed while Play billing is not explicitly enabled", async () => {
    const playLookup = vi.fn();
    const POST = createPlayVerifyHandler({
      ...baseDeps(),
      playLookup,
      env: { NEXT_PUBLIC_PLAY_BILLING: undefined } as unknown as NodeJS.ProcessEnv
    });

    const response = await POST(
      post("http://t/api/billing/play/verify", { purchaseToken: "tok-disabled" })
    );

    expect(response.status).toBe(503);
    expect(playLookup).not.toHaveBeenCalled();
  });

  it("verifies server-side, upserts the subscription, returns premium", async () => {
    const playLookup = vi.fn().mockResolvedValue({
      status: "active",
      currentPeriodEnd: FUTURE,
      productId: "premium_annual"
    });
    const POST = createPlayVerifyHandler({ ...baseDeps(), playLookup });

    const response = await POST(
      post("http://t/api/billing/play/verify", { purchaseToken: "tok-1" })
    );
    const body = await response.json();

    expect(playLookup).toHaveBeenCalledWith("tok-1");
    expect(body).toEqual({
      tier: "premium",
      source: "play",
      status: "premium",
      currentPeriodEnd: "2026-08-03T15:00:00.000Z",
      cancelAtPeriodEnd: false
    });

    const [row] = await testDb.db.select().from(schema.subscriptions);
    expect(row.providerRef).toBe("tok-1");
    expect(row.productId).toBe("premium_annual");
  });

  it("never grants on an unverifiable token", async () => {
    const POST = createPlayVerifyHandler({
      ...baseDeps(),
      playLookup: vi.fn().mockRejectedValue(new Error("api down"))
    });

    const response = await POST(
      post("http://t/api/billing/play/verify", { purchaseToken: "tok-x" })
    );

    expect(response.status).toBe(502);
    expect(await testDb.db.select().from(schema.subscriptions)).toHaveLength(0);
  });

  it("re-verify is idempotent (upsert on providerRef)", async () => {
    const playLookup = vi.fn().mockResolvedValue({
      status: "active",
      currentPeriodEnd: FUTURE,
      productId: "premium_monthly"
    });
    const POST = createPlayVerifyHandler({ ...baseDeps(), playLookup });
    const request = () =>
      post("http://t/api/billing/play/verify", { purchaseToken: "tok-2" });

    await POST(request());
    await POST(request());

    expect(await testDb.db.select().from(schema.subscriptions)).toHaveLength(1);
  });
});

describe("POST /api/billing/stripe/checkout terms acceptance", () => {
  it("rejects checkout without affirmative current-version acceptance", async () => {
    const stripe = {
      checkout: { sessions: { create: vi.fn() } }
    };
    const POST = createStripeCheckoutHandler({
      ...baseDeps(),
      stripeClient: () => stripe as never
    });
    const response = await POST(
      new Request("http://t/api/billing/stripe/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan: "monthly" })
      })
    );
    expect(response.status).toBe(400);
    expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it("records the accepted Terms version in Stripe metadata", async () => {
    const previousPrice = process.env.STRIPE_PRICE_MONTHLY_1299;
    const previousUrl = process.env.NEXT_PUBLIC_APP_URL;
    process.env.STRIPE_PRICE_MONTHLY_1299 = "price_monthly";
    process.env.NEXT_PUBLIC_APP_URL = "https://prediabetespal.com";
    const stripe = {
      checkout: {
        sessions: { create: vi.fn().mockResolvedValue({ url: "https://stripe/x" }) }
      }
    };
    try {
      const POST = createStripeCheckoutHandler({
        ...baseDeps(),
        stripeClient: () => stripe as never
      });
      const response = await POST(
        post("http://t/api/billing/stripe/checkout", { plan: "monthly" })
      );
      expect(response.status).toBe(200);
      expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: { terms_version: TERMS_VERSION },
          subscription_data: {
            metadata: { terms_version: TERMS_VERSION }
          }
        })
      );
    } finally {
      if (previousPrice === undefined) delete process.env.STRIPE_PRICE_MONTHLY_1299;
      else process.env.STRIPE_PRICE_MONTHLY_1299 = previousPrice;
      if (previousUrl === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
      else process.env.NEXT_PUBLIC_APP_URL = previousUrl;
    }
  });
});

describe("POST /api/billing/play/rtdn", () => {
  function rtdnRequest(token: string, purchaseToken: string) {
    return post(`http://t/api/billing/play/rtdn?token=${token}`, {
      message: {
        data: Buffer.from(
          JSON.stringify({
            subscriptionNotification: { purchaseToken, notificationType: 3 }
          })
        ).toString("base64")
      }
    });
  }

  it("rejects a bad shared token", async () => {
    const POST = createPlayRtdnHandler(baseDeps());
    const response = await POST(rtdnRequest("wrong", "tok-1"));

    expect(response.status).toBe(401);
  });

  it("updates a known subscription from the Play lookup (cancel flow)", async () => {
    await testDb.db.insert(schema.subscriptions).values({
      userId,
      provider: "play",
      providerRef: "tok-3",
      productId: "premium_monthly",
      status: "active",
      currentPeriodEnd: FUTURE
    });

    const POST = createPlayRtdnHandler({
      ...baseDeps(),
      playLookup: vi.fn().mockResolvedValue({
        status: "canceled",
        currentPeriodEnd: FUTURE,
        productId: "premium_monthly"
      })
    });

    const response = await POST(rtdnRequest("rtdn-secret", "tok-3"));

    expect(response.status).toBe(200);
    const [row] = await testDb.db.select().from(schema.subscriptions);
    expect(row.status).toBe("canceled");
  });

  it("acks unknown purchase tokens without creating rows", async () => {
    const playLookup = vi.fn();
    const POST = createPlayRtdnHandler({ ...baseDeps(), playLookup });

    const response = await POST(rtdnRequest("rtdn-secret", "tok-unknown"));

    expect(response.status).toBe(200);
    expect(playLookup).not.toHaveBeenCalled();
    expect(await testDb.db.select().from(schema.subscriptions)).toHaveLength(0);
  });

  it("nacks (500) when the Play lookup fails so Pub/Sub retries", async () => {
    await testDb.db.insert(schema.subscriptions).values({
      userId,
      provider: "play",
      providerRef: "tok-4",
      productId: "premium_monthly",
      status: "active",
      currentPeriodEnd: FUTURE
    });

    const POST = createPlayRtdnHandler({
      ...baseDeps(),
      playLookup: vi.fn().mockRejectedValue(new Error("down"))
    });

    const response = await POST(rtdnRequest("rtdn-secret", "tok-4"));
    expect(response.status).toBe(500);
  });
});

describe("POST /api/billing/play/rtdn — terminal + ordering guards (BC-4)", () => {
  function rtdnRequest(purchaseToken: string) {
    return post(`http://t/api/billing/play/rtdn?token=rtdn-secret`, {
      message: {
        data: Buffer.from(
          JSON.stringify({
            subscriptionNotification: { purchaseToken, notificationType: 3 }
          })
        ).toString("base64")
      }
    });
  }

  it("never resurrects a refunded row, whatever the lookup says", async () => {
    await testDb.db.insert(schema.subscriptions).values({
      userId,
      provider: "play",
      providerRef: "tok-refunded",
      productId: "premium_monthly",
      status: "refunded",
      currentPeriodEnd: FUTURE
    });

    const POST = createPlayRtdnHandler({
      ...baseDeps(),
      playLookup: vi.fn().mockResolvedValue({
        status: "active",
        currentPeriodEnd: new Date(FUTURE.getTime() + 86_400_000),
        productId: "premium_monthly"
      })
    });

    const response = await POST(rtdnRequest("tok-refunded"));

    expect(response.status).toBe(200);
    const [row] = await testDb.db.select().from(schema.subscriptions);
    expect(row.status).toBe("refunded");
  });

  it("a stale lookup cannot move paid-through backwards", async () => {
    await testDb.db.insert(schema.subscriptions).values({
      userId,
      provider: "play",
      providerRef: "tok-renewed",
      productId: "premium_monthly",
      status: "active",
      currentPeriodEnd: FUTURE
    });

    // A lookup fetched before a renewal committed reports the OLD period end.
    const POST = createPlayRtdnHandler({
      ...baseDeps(),
      playLookup: vi.fn().mockResolvedValue({
        status: "active",
        currentPeriodEnd: NOW, // earlier than the stored FUTURE
        productId: "premium_monthly"
      })
    });

    const response = await POST(rtdnRequest("tok-renewed"));

    expect(response.status).toBe(200);
    const [row] = await testDb.db.select().from(schema.subscriptions);
    expect(row.currentPeriodEnd.toISOString()).toBe(FUTURE.toISOString());
  });

  it("a revocation (refund) always lands, even with an earlier period end", async () => {
    await testDb.db.insert(schema.subscriptions).values({
      userId,
      provider: "play",
      providerRef: "tok-revoke",
      productId: "premium_monthly",
      status: "active",
      currentPeriodEnd: FUTURE
    });

    const POST = createPlayRtdnHandler({
      ...baseDeps(),
      playLookup: vi.fn().mockResolvedValue({
        status: "refunded",
        currentPeriodEnd: NOW,
        productId: "premium_monthly"
      })
    });

    const response = await POST(rtdnRequest("tok-revoke"));

    expect(response.status).toBe(200);
    const [row] = await testDb.db.select().from(schema.subscriptions);
    expect(row.status).toBe("refunded");
  });
});

describe("POST /api/billing/stripe/sync (BC-3)", () => {
  function syncPost(sessionId: string) {
    return new Request("http://t/api/billing/stripe/sync", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId })
    });
  }

  it("upserts the subscription row from a completed checkout session", async () => {
    const stripeClient = {
      checkout: {
        sessions: {
          retrieve: vi.fn().mockResolvedValue({
            id: "cs_1",
            mode: "subscription",
            status: "complete",
            client_reference_id: userId,
            subscription: "sub_sync_1"
          })
        }
      },
      subscriptions: {
        retrieve: vi.fn().mockResolvedValue({
          status: "active",
          cancel_at_period_end: false,
          metadata: { price_variant: "1299", terms_version: TERMS_VERSION },
          items: {
            data: [
              {
                price: { id: "price_monthly" },
                current_period_end: Math.floor(FUTURE.getTime() / 1000)
              }
            ]
          }
        })
      }
    } as unknown as Stripe;

    const POST = createCheckoutSyncHandler({
      db: () => testDb.db,
      now: () => NOW,
      stripeClient: () => stripeClient
    });

    const response = await POST(syncPost("cs_1"));
    expect(response.status).toBe(200);
    expect((await response.json()).ok).toBe(true);

    // The core BC-3 claim: with NO webhook delivery at all, the row exists
    // and entitlement flips premium.
    const [row] = await testDb.db.select().from(schema.subscriptions);
    expect(row.providerRef).toBe("sub_sync_1");
    expect(row.status).toBe("active");
    const entitlement = await getEntitlement(testDb.db, userId, {
      now: () => NOW
    });
    expect(entitlement.tier).toBe("premium");
  });

  it("404s on an unknown session id and writes nothing", async () => {
    const stripeClient = {
      checkout: {
        sessions: {
          retrieve: vi.fn().mockRejectedValue(new Error("No such session"))
        }
      }
    } as unknown as Stripe;

    const POST = createCheckoutSyncHandler({
      db: () => testDb.db,
      now: () => NOW,
      stripeClient: () => stripeClient
    });

    const response = await POST(syncPost("cs_missing"));
    expect(response.status).toBe(404);
    expect(await testDb.db.select().from(schema.subscriptions)).toHaveLength(0);
  });

  it("ignores payment-mode (pantry) sessions — no order row, no email", async () => {
    const stripeClient = {
      checkout: {
        sessions: {
          retrieve: vi.fn().mockResolvedValue({
            id: "cs_pantry",
            mode: "payment",
            status: "complete"
          })
        }
      }
    } as unknown as Stripe;

    const POST = createCheckoutSyncHandler({
      db: () => testDb.db,
      now: () => NOW,
      stripeClient: () => stripeClient
    });

    const response = await POST(syncPost("cs_pantry"));
    expect(response.status).toBe(200);
    expect((await response.json()).ok).toBe(false);
    expect(await testDb.db.select().from(schema.pantryOrders)).toHaveLength(0);
  });
});

describe("applyStripeEvent — expired is terminal for checkout replays (BC-9)", () => {
  it("a replayed checkout.session.completed cannot resurrect an expired row", async () => {
    await testDb.db.insert(schema.subscriptions).values({
      userId,
      provider: "stripe",
      providerRef: "sub_expired",
      productId: "premium_monthly",
      status: "expired",
      currentPeriodEnd: NOW
    });

    const stripeClient = {
      subscriptions: {
        retrieve: vi.fn().mockResolvedValue({
          status: "active",
          items: {
            data: [
              {
                price: { id: "price_monthly" },
                current_period_end: Math.floor(FUTURE.getTime() / 1000)
              }
            ]
          }
        })
      }
    } as unknown as Stripe;

    await applyStripeEvent(
      testDb.db,
      {
        type: "checkout.session.completed",
        data: {
          object: { client_reference_id: userId, subscription: "sub_expired" }
        }
      } as unknown as Stripe.Event,
      NOW,
      () => stripeClient
    );

    const [row] = await testDb.db.select().from(schema.subscriptions);
    expect(row.status).toBe("expired");
  });
});

describe("applyStripeEvent", () => {
  it("checkout.session.completed creates an active subscription", async () => {
    const stripeClient = {
      subscriptions: {
        retrieve: vi.fn().mockResolvedValue({
          items: {
            data: [
              {
                price: { id: "price_monthly" },
                current_period_end: Math.floor(FUTURE.getTime() / 1000)
              }
            ]
          }
        })
      }
    } as unknown as Stripe;

    await applyStripeEvent(
      testDb.db,
      {
        type: "checkout.session.completed",
        data: {
          object: { client_reference_id: userId, subscription: "sub_123" }
        }
      } as unknown as Stripe.Event,
      NOW,
      () => stripeClient
    );

    const [row] = await testDb.db.select().from(schema.subscriptions);
    expect(row.provider).toBe("stripe");
    expect(row.providerRef).toBe("sub_123");
    expect(row.status).toBe("active");
    expect(row.currentPeriodEnd.toISOString()).toBe(FUTURE.toISOString());
  });

  it("customer.subscription.deleted expires the subscription", async () => {
    await testDb.db.insert(schema.subscriptions).values({
      userId,
      provider: "stripe",
      providerRef: "sub_del",
      productId: "premium_monthly",
      status: "active",
      currentPeriodEnd: FUTURE
    });

    await applyStripeEvent(
      testDb.db,
      {
        type: "customer.subscription.deleted",
        data: {
          object: {
            id: "sub_del",
            status: "canceled",
            items: {
              data: [
                { current_period_end: Math.floor(NOW.getTime() / 1000) }
              ]
            }
          }
        }
      } as unknown as Stripe.Event,
      NOW
    );

    const [row] = await testDb.db
      .select()
      .from(schema.subscriptions)
      .where(eq(schema.subscriptions.providerRef, "sub_del"));
    expect(row.status).toBe("expired");
  });

  it("charge.refunded (full) on a subscription invoice drops the row to refunded (BUG-17)", async () => {
    await testDb.db.insert(schema.subscriptions).values({
      userId,
      provider: "stripe",
      providerRef: "sub_refund",
      productId: "premium_monthly",
      status: "active",
      currentPeriodEnd: FUTURE
    });

    const stripeClient = {
      invoices: {
        retrieve: vi.fn().mockResolvedValue({
          parent: { subscription_details: { subscription: "sub_refund" } }
        })
      }
    } as unknown as Stripe;

    await applyStripeEvent(
      testDb.db,
      {
        type: "charge.refunded",
        data: {
          object: {
            payment_intent: "pi_refund",
            refunded: true,
            invoice: "in_refund"
          }
        }
      } as unknown as Stripe.Event,
      NOW,
      () => stripeClient
    );

    const [row] = await testDb.db
      .select()
      .from(schema.subscriptions)
      .where(eq(schema.subscriptions.providerRef, "sub_refund"));
    // "refunded" is outside PREMIUM_STATUSES — premium drops immediately.
    expect(row.status).toBe("refunded");
  });

  it("charge.refunded (partial) leaves the subscription untouched", async () => {
    await testDb.db.insert(schema.subscriptions).values({
      userId,
      provider: "stripe",
      providerRef: "sub_partial",
      productId: "premium_monthly",
      status: "active",
      currentPeriodEnd: FUTURE
    });

    const retrieve = vi.fn();
    await applyStripeEvent(
      testDb.db,
      {
        type: "charge.refunded",
        data: {
          object: {
            payment_intent: "pi_partial",
            refunded: false, // amount_refunded < amount
            invoice: "in_partial"
          }
        }
      } as unknown as Stripe.Event,
      NOW,
      () => ({ invoices: { retrieve } }) as unknown as Stripe
    );

    const [row] = await testDb.db
      .select()
      .from(schema.subscriptions)
      .where(eq(schema.subscriptions.providerRef, "sub_partial"));
    expect(row.status).toBe("active");
    expect(retrieve).not.toHaveBeenCalled();
  });

  it("checkout.session.completed with a trialing subscription stores status trialing + variant", async () => {
    const trialEnd = Math.floor(FUTURE.getTime() / 1000);
    const stripeClient = {
      subscriptions: {
        retrieve: vi.fn().mockResolvedValue({
          status: "trialing",
          trial_end: trialEnd,
          items: {
            data: [
              {
                price: { id: "price_1299" },
                current_period_end: Math.floor(NOW.getTime() / 1000)
              }
            ]
          },
          metadata: { price_variant: "1299" }
        })
      }
    } as unknown as Stripe;

    const info = vi.spyOn(console, "info").mockImplementation(() => {});

    await applyStripeEvent(
      testDb.db,
      {
        type: "checkout.session.completed",
        data: {
          object: { client_reference_id: userId, subscription: "sub_trial" }
        }
      } as unknown as Stripe.Event,
      NOW,
      () => stripeClient
    );

    const [row] = await testDb.db.select().from(schema.subscriptions);
    expect(row.status).toBe("trialing");
    expect(row.priceVariant).toBe("1299");
    // currentPeriodEnd prefers trial_end while trialing.
    expect(row.currentPeriodEnd.toISOString()).toBe(FUTURE.toISOString());

    const emitted = info.mock.calls
      .map((c) => {
        try {
          return JSON.parse(String(c[0]));
        } catch {
          return null;
        }
      })
      .filter((e) => e && e.name === "trial_started");
    expect(emitted).toHaveLength(1);
    expect(emitted[0].priceVariant).toBe("1299");
    info.mockRestore();
  });

  it("invoice.paid flips trialing → active and emits trial_converted once", async () => {
    await testDb.db.insert(schema.subscriptions).values({
      userId,
      provider: "stripe",
      providerRef: "sub_conv",
      productId: "premium_monthly",
      status: "trialing",
      priceVariant: "1299",
      currentPeriodEnd: NOW
    });

    const stripeClient = {
      subscriptions: {
        retrieve: vi.fn().mockResolvedValue({
          status: "active",
          items: {
            data: [
              { current_period_end: Math.floor(FUTURE.getTime() / 1000) }
            ]
          }
        })
      }
    } as unknown as Stripe;

    const info = vi.spyOn(console, "info").mockImplementation(() => {});

    await applyStripeEvent(
      testDb.db,
      {
        type: "invoice.paid",
        data: {
          object: {
            parent: {
              subscription_details: { subscription: "sub_conv" }
            }
          }
        }
      } as unknown as Stripe.Event,
      NOW,
      () => stripeClient
    );

    const [row] = await testDb.db
      .select()
      .from(schema.subscriptions)
      .where(eq(schema.subscriptions.providerRef, "sub_conv"));
    expect(row.status).toBe("active");
    expect(row.currentPeriodEnd.toISOString()).toBe(FUTURE.toISOString());

    const converted = info.mock.calls
      .map((c) => {
        try {
          return JSON.parse(String(c[0]));
        } catch {
          return null;
        }
      })
      .filter((e) => e && e.name === "trial_converted");
    expect(converted).toHaveLength(1);
    expect(converted[0].priceVariant).toBe("1299");
    info.mockRestore();
  });

  it("invoice.paid on an already-active subscription refreshes period end WITHOUT a conversion event (renewals are not conversions)", async () => {
    await testDb.db.insert(schema.subscriptions).values({
      userId,
      provider: "stripe",
      providerRef: "sub_renew",
      productId: "premium_monthly",
      status: "active",
      priceVariant: "1299",
      currentPeriodEnd: NOW
    });

    const stripeClient = {
      subscriptions: {
        retrieve: vi.fn().mockResolvedValue({
          status: "active",
          items: {
            data: [
              { current_period_end: Math.floor(FUTURE.getTime() / 1000) }
            ]
          }
        })
      }
    } as unknown as Stripe;

    const info = vi.spyOn(console, "info").mockImplementation(() => {});

    await applyStripeEvent(
      testDb.db,
      {
        type: "invoice.paid",
        data: {
          object: {
            parent: {
              subscription_details: { subscription: "sub_renew" }
            }
          }
        }
      } as unknown as Stripe.Event,
      NOW,
      () => stripeClient
    );

    const [row] = await testDb.db
      .select()
      .from(schema.subscriptions)
      .where(eq(schema.subscriptions.providerRef, "sub_renew"));
    expect(row.status).toBe("active");
    expect(row.currentPeriodEnd.toISOString()).toBe(FUTURE.toISOString());

    const converted = info.mock.calls
      .map((c) => {
        try {
          return JSON.parse(String(c[0]));
        } catch {
          return null;
        }
      })
      .filter((e) => e && e.name === "trial_converted");
    expect(converted).toHaveLength(0);
    info.mockRestore();
  });

  it("subscription.updated with cancel_at_period_end during trial keeps status trialing and emits trial_canceled", async () => {
    await testDb.db.insert(schema.subscriptions).values({
      userId,
      provider: "stripe",
      providerRef: "sub_cancel",
      productId: "premium_monthly",
      status: "trialing",
      priceVariant: "1299",
      currentPeriodEnd: FUTURE
    });

    const info = vi.spyOn(console, "info").mockImplementation(() => {});

    await applyStripeEvent(
      testDb.db,
      {
        type: "customer.subscription.updated",
        data: {
          object: {
            id: "sub_cancel",
            status: "trialing",
            cancel_at_period_end: true,
            items: {
              data: [
                { current_period_end: Math.floor(FUTURE.getTime() / 1000) }
              ]
            }
          }
        }
      } as unknown as Stripe.Event,
      NOW
    );

    const [row] = await testDb.db
      .select()
      .from(schema.subscriptions)
      .where(eq(schema.subscriptions.providerRef, "sub_cancel"));
    expect(row.status).toBe("trialing");

    const canceled = info.mock.calls
      .map((c) => {
        try {
          return JSON.parse(String(c[0]));
        } catch {
          return null;
        }
      })
      .filter((e) => e && e.name === "trial_canceled");
    expect(canceled).toHaveLength(1);
    expect(canceled[0].priceVariant).toBe("1299");
    info.mockRestore();
  });

  it("past_due maps to grace (premium retained through dunning)", async () => {
    await testDb.db.insert(schema.subscriptions).values({
      userId,
      provider: "stripe",
      providerRef: "sub_grace",
      productId: "premium_monthly",
      status: "active",
      currentPeriodEnd: FUTURE
    });

    await applyStripeEvent(
      testDb.db,
      {
        type: "customer.subscription.updated",
        data: {
          object: {
            id: "sub_grace",
            status: "past_due",
            items: {
              data: [
                { current_period_end: Math.floor(FUTURE.getTime() / 1000) }
              ]
            }
          }
        }
      } as unknown as Stripe.Event,
      NOW
    );

    const [row] = await testDb.db
      .select()
      .from(schema.subscriptions)
      .where(eq(schema.subscriptions.providerRef, "sub_grace"));
    expect(row.status).toBe("grace");
  });

  function emittedNamed(
    info: ReturnType<typeof vi.spyOn>,
    name: string
  ): Array<{ name: string; priceVariant?: string }> {
    return info.mock.calls
      .map((c: unknown[]) => {
        try {
          return JSON.parse(String(c[0]));
        } catch {
          return null;
        }
      })
      .filter(
        (e: { name?: string } | null): e is { name: string; priceVariant?: string } =>
          Boolean(e) && e!.name === name
      );
  }

  const activeSubStripe = () =>
    ({
      subscriptions: {
        retrieve: vi.fn().mockResolvedValue({
          status: "active",
          items: {
            data: [{ current_period_end: Math.floor(FUTURE.getTime() / 1000) }]
          }
        })
      }
    }) as unknown as Stripe;

  const invoicePaidEvent = (subscriptionId: string, billingReason?: string) =>
    ({
      type: "invoice.paid",
      data: {
        object: {
          billing_reason: billingReason,
          parent: { subscription_details: { subscription: subscriptionId } }
        }
      }
    }) as unknown as Stripe.Event;

  const trialToActiveUpdatedEvent = (subscriptionId: string) =>
    ({
      type: "customer.subscription.updated",
      data: {
        object: {
          id: subscriptionId,
          status: "active",
          items: {
            data: [{ current_period_end: Math.floor(FUTURE.getTime() / 1000) }]
          }
        },
        previous_attributes: { status: "trialing" }
      }
    }) as unknown as Stripe.Event;

  const seedTrialingRow = (providerRef: string) =>
    testDb.db.insert(schema.subscriptions).values({
      userId,
      provider: "stripe",
      providerRef,
      productId: "premium_monthly",
      status: "trialing",
      priceVariant: "1299",
      currentPeriodEnd: NOW
    });

  it("Order A: invoice.paid (subscription_cycle) then subscription.updated (trialing→active) → active, ONE trial_converted", async () => {
    await seedTrialingRow("sub_orderA");
    const info = vi.spyOn(console, "info").mockImplementation(() => {});

    await applyStripeEvent(
      testDb.db,
      invoicePaidEvent("sub_orderA", "subscription_cycle"),
      NOW,
      () => activeSubStripe()
    );
    await applyStripeEvent(
      testDb.db,
      trialToActiveUpdatedEvent("sub_orderA"),
      NOW
    );

    const [row] = await testDb.db
      .select()
      .from(schema.subscriptions)
      .where(eq(schema.subscriptions.providerRef, "sub_orderA"));
    expect(row.status).toBe("active");

    const converted = emittedNamed(info, "trial_converted");
    expect(converted).toHaveLength(1);
    expect(converted[0].priceVariant).toBe("1299");
    info.mockRestore();
  });

  it("Order B: subscription.updated (trialing→active) then invoice.paid → active, ONE trial_converted", async () => {
    await seedTrialingRow("sub_orderB");
    const info = vi.spyOn(console, "info").mockImplementation(() => {});

    await applyStripeEvent(
      testDb.db,
      trialToActiveUpdatedEvent("sub_orderB"),
      NOW
    );
    await applyStripeEvent(
      testDb.db,
      invoicePaidEvent("sub_orderB", "subscription_cycle"),
      NOW,
      () => activeSubStripe()
    );

    const [row] = await testDb.db
      .select()
      .from(schema.subscriptions)
      .where(eq(schema.subscriptions.providerRef, "sub_orderB"));
    expect(row.status).toBe("active");

    const converted = emittedNamed(info, "trial_converted");
    expect(converted).toHaveLength(1);
    expect(converted[0].priceVariant).toBe("1299");
    info.mockRestore();
  });

  it("invoice.paid with billing_reason subscription_create keeps the trial trialing and emits nothing", async () => {
    await seedTrialingRow("sub_create");
    const info = vi.spyOn(console, "info").mockImplementation(() => {});

    await applyStripeEvent(
      testDb.db,
      invoicePaidEvent("sub_create", "subscription_create"),
      NOW,
      () => activeSubStripe()
    );

    const [row] = await testDb.db
      .select()
      .from(schema.subscriptions)
      .where(eq(schema.subscriptions.providerRef, "sub_create"));
    expect(row.status).toBe("trialing");
    expect(emittedNamed(info, "trial_converted")).toHaveLength(0);
    info.mockRestore();
  });

  it("invoice.paid resolves subscriptionId from the legacy top-level field and still converts", async () => {
    await seedTrialingRow("sub_legacy");
    const info = vi.spyOn(console, "info").mockImplementation(() => {});

    await applyStripeEvent(
      testDb.db,
      {
        type: "invoice.paid",
        data: {
          object: {
            billing_reason: "subscription_cycle",
            subscription: "sub_legacy"
          }
        }
      } as unknown as Stripe.Event,
      NOW,
      () => activeSubStripe()
    );

    const [row] = await testDb.db
      .select()
      .from(schema.subscriptions)
      .where(eq(schema.subscriptions.providerRef, "sub_legacy"));
    expect(row.status).toBe("active");

    const converted = emittedNamed(info, "trial_converted");
    expect(converted).toHaveLength(1);
    expect(converted[0].priceVariant).toBe("1299");
    info.mockRestore();
  });
});

describe("GET /api/entitlement", () => {
  it("returns tier + today's usage against the free limit", async () => {
    const GET = createEntitlementHandler({
      ...baseDeps(),
      playLookup: vi.fn()
    });

    const response = await GET();
    const body = await response.json();

    expect(body).toMatchObject({
      tier: "free",
      source: null,
      freeDailyLimit: 5
    });
    expect(typeof body.checksToday).toBe("number");
  });

  it("ships the capability matrix so the UI renders paid state from server truth", async () => {
    const GET = createEntitlementHandler({
      ...baseDeps(),
      playLookup: vi.fn()
    });

    const body = await (await GET()).json();

    // Additive (T10): the free caller gets the metered/no-premium matrix.
    expect(body.capabilities).toMatchObject({
      dailyChecks: 5,
      historyDays: 7,
      export: true,
      progress: false,
      nudges: false,
      weeklyLearning: false,
      thinInsight: true,
      support: "standard"
    });
  });
});

/**
 * W-33 — a refunded Pantry order is over, so its photos must go. Nothing else
 * ever revisits a canceled order (the sweep only walks live states), so without
 * this the buyer's food photos live in blob storage forever.
 */
describe("applyStripeEvent — charge.refunded deletes the order's photos (W-33)", () => {
  it("cancels the order AND deletes its still-live photo blobs", async () => {
    blobDel.mockClear();

    const [order] = await testDb.db
      .insert(schema.pantryOrders)
      .values({
        email: "buyer@test.dev",
        stripeSessionId: "cs_blob_1",
        stripePaymentIntent: "pi_blob_1",
        claimToken: "hash_blob_1",
        updatedAt: NOW
      })
      .returning();

    await testDb.db.insert(schema.pantryPhotos).values([
      { orderId: order.id, blobUrl: "https://blob/live-1.jpg", status: "uploaded" },
      { orderId: order.id, blobUrl: "https://blob/live-2.jpg", status: "extracted" },
      // Already reclaimed — must not be deleted twice.
      { orderId: order.id, blobUrl: "https://blob/gone.jpg", status: "deleted" }
    ]);

    await applyStripeEvent(
      testDb.db,
      {
        type: "charge.refunded",
        data: { object: { payment_intent: "pi_blob_1", refunded: true } }
      } as unknown as Stripe.Event,
      NOW,
      () => ({}) as unknown as Stripe
    );

    const [row] = await testDb.db
      .select()
      .from(schema.pantryOrders)
      .where(eq(schema.pantryOrders.id, order.id));
    expect(row.status).toBe("canceled");

    expect(blobDel).toHaveBeenCalledTimes(1);
    expect(blobDel).toHaveBeenCalledWith(
      ["https://blob/live-1.jpg", "https://blob/live-2.jpg"],
      { token: "private-blob-test-token" }
    );

    const photos = await testDb.db
      .select()
      .from(schema.pantryPhotos)
      .where(eq(schema.pantryPhotos.orderId, order.id));
    expect(photos.every((photo) => photo.status === "deleted")).toBe(true);
  });
});

/**
 * W-12 — "refunded" is terminal. Stripe does not guarantee webhook ordering, so
 * an update emitted before a refund can be delivered after it.
 */
describe("applyStripeEvent — refund ordering (W-12)", () => {
  const updatedEvent = (id: string, status: string, periodEnd?: Date) =>
    ({
      type: "customer.subscription.updated",
      data: {
        object: {
          id,
          status,
          items: {
            data: [
              periodEnd
                ? { current_period_end: Math.floor(periodEnd.getTime() / 1000) }
                : {}
            ]
          }
        }
      }
    }) as unknown as Stripe.Event;

  it("an out-of-order subscription.updated(active) AFTER a refund does NOT resurrect premium", async () => {
    await testDb.db.insert(schema.subscriptions).values({
      userId,
      provider: "stripe",
      providerRef: "sub_ooo",
      productId: "premium_monthly",
      status: "refunded",
      currentPeriodEnd: FUTURE
    });

    await applyStripeEvent(
      testDb.db,
      updatedEvent("sub_ooo", "active", FUTURE),
      NOW
    );

    const [row] = await testDb.db
      .select()
      .from(schema.subscriptions)
      .where(eq(schema.subscriptions.providerRef, "sub_ooo"));
    // Before the fix this wrote "active" and handed back the premium we refunded.
    expect(row.status).toBe("refunded");
  });

  it("a late subscription.deleted also cannot overwrite refunded", async () => {
    await testDb.db.insert(schema.subscriptions).values({
      userId,
      provider: "stripe",
      providerRef: "sub_ooo_del",
      productId: "premium_monthly",
      status: "refunded",
      currentPeriodEnd: FUTURE
    });

    await applyStripeEvent(
      testDb.db,
      {
        type: "customer.subscription.deleted",
        data: { object: { id: "sub_ooo_del", status: "canceled", items: { data: [] } } }
      } as unknown as Stripe.Event,
      NOW
    );

    const [row] = await testDb.db
      .select()
      .from(schema.subscriptions)
      .where(eq(schema.subscriptions.providerRef, "sub_ooo_del"));
    expect(row.status).toBe("refunded");
  });

  it("a payload with NO current_period_end leaves the stored period end alone (never revokes a paying subscriber)", async () => {
    await testDb.db.insert(schema.subscriptions).values({
      userId,
      provider: "stripe",
      providerRef: "sub_no_pe",
      productId: "premium_monthly",
      status: "active",
      currentPeriodEnd: FUTURE
    });

    await applyStripeEvent(testDb.db, updatedEvent("sub_no_pe", "active"), NOW);

    const [row] = await testDb.db
      .select()
      .from(schema.subscriptions)
      .where(eq(schema.subscriptions.providerRef, "sub_no_pe"));
    // The old fallback wrote `now`, and getEntitlement needs currentPeriodEnd >
    // now — so this update alone used to silently revoke a live subscription.
    expect(row.currentPeriodEnd.toISOString()).toBe(FUTURE.toISOString());
    expect(row.status).toBe("active");
  });
});

/**
 * W-10 — churn was uninstrumented. The two event names existed on the REVORA
 * telemetry enum, which the webhook does not import and whose .strict() schema
 * could never have accepted them: a signal that was documented but structurally
 * incapable of firing. These tests exist so it cannot go quiet again.
 */
describe("applyStripeEvent — churn telemetry (W-10)", () => {
  type Emitted = { name: string; priceVariant?: string };

  const emitted = (
    info: { mock: { calls: unknown[][] } },
    name: string
  ): Emitted[] =>
    info.mock.calls
      .map((call): Emitted | null => {
        try {
          return JSON.parse(String(call[0])) as Emitted;
        } catch {
          return null;
        }
      })
      .filter((event): event is Emitted => event?.name === name);

  it("a PAYING subscriber who cancels emits subscription_canceled, not trial_canceled", async () => {
    await testDb.db.insert(schema.subscriptions).values({
      userId,
      provider: "stripe",
      providerRef: "sub_churn",
      productId: "premium_monthly",
      status: "active",
      priceVariant: "1299",
      currentPeriodEnd: FUTURE
    });

    const info = vi.spyOn(console, "info").mockImplementation(() => {});

    await applyStripeEvent(
      testDb.db,
      {
        type: "customer.subscription.updated",
        data: {
          object: {
            id: "sub_churn",
            status: "active",
            cancel_at_period_end: true,
            items: {
              data: [
                { current_period_end: Math.floor(FUTURE.getTime() / 1000) }
              ]
            }
          }
        }
      } as unknown as Stripe.Event,
      NOW
    );

    const churned = emitted(info, "subscription_canceled");
    expect(churned).toHaveLength(1);
    expect(churned[0].priceVariant).toBe("1299");
    // A paying customer leaving is not a trial expiring. Conflating the two is
    // how a churn number quietly becomes a trial number.
    expect(emitted(info, "trial_canceled")).toHaveLength(0);

    // Cancel-at-period-end keeps the entitlement until it lapses.
    const [row] = await testDb.db
      .select()
      .from(schema.subscriptions)
      .where(eq(schema.subscriptions.providerRef, "sub_churn"));
    expect(row.status).toBe("active");
    info.mockRestore();
  });

  it("a full refund emits subscription_refunded with the price variant", async () => {
    await testDb.db.insert(schema.subscriptions).values({
      userId,
      provider: "stripe",
      providerRef: "sub_refund_evt",
      productId: "premium_monthly",
      status: "active",
      priceVariant: "999",
      currentPeriodEnd: FUTURE
    });

    const stripeClient = {
      invoices: {
        retrieve: vi.fn().mockResolvedValue({
          parent: { subscription_details: { subscription: "sub_refund_evt" } }
        })
      }
    } as unknown as Stripe;

    const info = vi.spyOn(console, "info").mockImplementation(() => {});

    await applyStripeEvent(
      testDb.db,
      {
        type: "charge.refunded",
        data: {
          object: {
            payment_intent: "pi_refund_evt",
            refunded: true,
            invoice: "in_refund_evt"
          }
        }
      } as unknown as Stripe.Event,
      NOW,
      () => stripeClient
    );

    const refunded = emitted(info, "subscription_refunded");
    expect(refunded).toHaveLength(1);
    expect(refunded[0].priceVariant).toBe("999");
    info.mockRestore();
  });

  it("a refund for a subscription we do not hold emits NOTHING", async () => {
    const stripeClient = {
      invoices: {
        retrieve: vi.fn().mockResolvedValue({
          parent: { subscription_details: { subscription: "sub_unknown" } }
        })
      }
    } as unknown as Stripe;

    const info = vi.spyOn(console, "info").mockImplementation(() => {});

    await applyStripeEvent(
      testDb.db,
      {
        type: "charge.refunded",
        data: {
          object: {
            payment_intent: "pi_unknown",
            refunded: true,
            invoice: "in_unknown"
          }
        }
      } as unknown as Stripe.Event,
      NOW,
      () => stripeClient
    );

    // The event fires off the RETURNING rows, so no revoked entitlement means
    // no churn event — the metric counts revocations, not webhooks.
    expect(emitted(info, "subscription_refunded")).toHaveLength(0);
    info.mockRestore();
  });
});

/**
 * W-18 — a declined card used to ride Stripe's ~3-week dunning schedule with
 * premium fully on, zero revenue, and no word to the user.
 */
describe("applyStripeEvent — invoice.payment_failed (W-18)", () => {
  const failedEvent = (subscriptionId: string) =>
    ({
      type: "invoice.payment_failed",
      data: {
        object: {
          parent: { subscription_details: { subscription: subscriptionId } }
        }
      }
    }) as unknown as Stripe.Event;

  it("caps grace to 3 days, flips to grace, and emails the user", async () => {
    await testDb.db.insert(schema.subscriptions).values({
      userId,
      provider: "stripe",
      providerRef: "sub_dunning",
      productId: "premium_monthly",
      status: "active",
      currentPeriodEnd: FUTURE // weeks out — the free ride we are closing
    });
    const send = vi.fn().mockResolvedValue({ ok: true });

    await applyStripeEvent(
      testDb.db,
      failedEvent("sub_dunning"),
      NOW,
      undefined,
      { send }
    );

    const [row] = await testDb.db
      .select()
      .from(schema.subscriptions)
      .where(eq(schema.subscriptions.providerRef, "sub_dunning"));
    expect(row.status).toBe("grace");
    expect(row.currentPeriodEnd.toISOString()).toBe(
      new Date(NOW.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString()
    );

    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0].to).toBe("billing@test.dev");
    expect(send.mock.calls[0][0].text).toMatch(/update your card/i);
  });

  it("never EXTENDS access — a period end sooner than the grace cap wins", async () => {
    const soon = new Date(NOW.getTime() + 24 * 60 * 60 * 1000);
    await testDb.db.insert(schema.subscriptions).values({
      userId,
      provider: "stripe",
      providerRef: "sub_soon",
      productId: "premium_monthly",
      status: "active",
      currentPeriodEnd: soon
    });

    await applyStripeEvent(testDb.db, failedEvent("sub_soon"), NOW, undefined, {
      send: vi.fn().mockResolvedValue({ ok: true })
    });

    const [row] = await testDb.db
      .select()
      .from(schema.subscriptions)
      .where(eq(schema.subscriptions.providerRef, "sub_soon"));
    expect(row.currentPeriodEnd.toISOString()).toBe(soon.toISOString());
  });

  it("is idempotent across dunning retries — one cap, ONE email", async () => {
    await testDb.db.insert(schema.subscriptions).values({
      userId,
      provider: "stripe",
      providerRef: "sub_retry",
      productId: "premium_monthly",
      status: "active",
      currentPeriodEnd: FUTURE
    });
    const send = vi.fn().mockResolvedValue({ ok: true });

    await applyStripeEvent(testDb.db, failedEvent("sub_retry"), NOW, undefined, { send });
    // Stripe retries the charge (and re-fires the event) days later.
    const later = new Date(NOW.getTime() + 2 * 24 * 60 * 60 * 1000);
    await applyStripeEvent(testDb.db, failedEvent("sub_retry"), later, undefined, { send });

    expect(send).toHaveBeenCalledTimes(1);
    const [row] = await testDb.db
      .select()
      .from(schema.subscriptions)
      .where(eq(schema.subscriptions.providerRef, "sub_retry"));
    // The cap from the FIRST failure stands — a retry cannot push access out.
    expect(row.currentPeriodEnd.toISOString()).toBe(
      new Date(NOW.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString()
    );
  });

  it("ignores an unknown subscription", async () => {
    const send = vi.fn();
    await applyStripeEvent(testDb.db, failedEvent("sub_nobody"), NOW, undefined, {
      send
    });
    expect(send).not.toHaveBeenCalled();
  });
});

/**
 * W-20 — the portal 404'd for users who own both a Play row and a Stripe row,
 * and the legacy checkout priced itself off a different env var than the wall.
 */
describe("POST /api/billing/stripe/portal (W-20)", () => {
  it("finds the Stripe row even when a Play row exists for the same user", async () => {
    // Insert the Play row FIRST — with no provider filter and no ORDER BY this
    // is exactly the row the unfixed query hands back, 404ing a real subscriber.
    await testDb.db.insert(schema.subscriptions).values({
      userId,
      provider: "play",
      providerRef: "play_tok",
      productId: "premium_monthly",
      status: "active",
      currentPeriodEnd: FUTURE
    });
    await testDb.db.insert(schema.subscriptions).values({
      userId,
      provider: "stripe",
      providerRef: "sub_portal",
      productId: "premium_monthly",
      status: "active",
      currentPeriodEnd: FUTURE
    });

    const stripe = {
      subscriptions: {
        retrieve: vi.fn().mockResolvedValue({ customer: "cus_1" })
      },
      billingPortal: {
        sessions: {
          create: vi.fn().mockResolvedValue({ url: "https://stripe/portal" })
        }
      }
    } as unknown as Stripe;

    const POST = createStripePortalHandler({
      ...baseDeps(),
      stripeClient: () => stripe
    });

    const response = await POST();
    expect(response.status).toBe(200);
    expect((await response.json()).url).toBe("https://stripe/portal");
    expect(stripe.subscriptions.retrieve).toHaveBeenCalledWith("sub_portal");
  });

  it("404s when the user has no Stripe row at all", async () => {
    await testDb.db.insert(schema.subscriptions).values({
      userId,
      provider: "play",
      providerRef: "play_only",
      productId: "premium_monthly",
      status: "active",
      currentPeriodEnd: FUTURE
    });

    const POST = createStripePortalHandler({
      ...baseDeps(),
      stripeClient: () => ({}) as unknown as Stripe
    });

    expect((await POST()).status).toBe(404);
  });
});

describe("POST /api/billing/stripe/checkout (W-20b price unification, W-04 gate)", () => {
  const checkoutEnv = {
    LEGAL_TERMS_FINAL: "1",
    TRIAL_PRICE_VARIANT: "1999",
    STRIPE_PRICE_MONTHLY_1999: "price_ladder_1999",
    STRIPE_PRICE_ANNUAL: "price_annual",
    // The env var the legacy path used to read. It must no longer be consulted:
    // a checkout priced off this while the wall advertises the ladder is exactly
    // the "shows a price checkout won't charge" failure pricing.ts exists to stop.
    STRIPE_PRICE_MONTHLY: "price_STALE_legacy",
    NEXT_PUBLIC_APP_URL: "https://app"
  } as unknown as NodeJS.ProcessEnv;

  const stripeStub = () => ({
    checkout: {
      sessions: { create: vi.fn().mockResolvedValue({ url: "https://stripe/legacy" }) }
    }
  });

  it("prices monthly off the SAME variant ladder the wall renders — never STRIPE_PRICE_MONTHLY", async () => {
    const stripe = stripeStub();
    const POST = createStripeCheckoutHandler({
      ...baseDeps(),
      stripeClient: () => stripe as never,
      env: checkoutEnv
    });

    const response = await POST(post("http://t/api/billing/stripe/checkout", { plan: "monthly" }));
    expect(response.status).toBe(200);
    expect(stripe.checkout.sessions.create.mock.calls[0][0].line_items).toEqual([
      { price: "price_ladder_1999", quantity: 1 }
    ]);
  });

  it("prices annual off resolveAnnualPrice", async () => {
    const stripe = stripeStub();
    const POST = createStripeCheckoutHandler({
      ...baseDeps(),
      stripeClient: () => stripe as never,
      env: checkoutEnv
    });

    await POST(post("http://t/api/billing/stripe/checkout", { plan: "annual" }));
    expect(stripe.checkout.sessions.create.mock.calls[0][0].line_items).toEqual([
      { price: "price_annual", quantity: 1 }
    ]);
  });

  it("W-04 kill switch: 503s and never opens a Stripe session when LEGAL_TERMS_FINAL=0", async () => {
    const stripe = stripeStub();
    const POST = createStripeCheckoutHandler({
      ...baseDeps(),
      stripeClient: () => stripe as never,
      env: { ...checkoutEnv, LEGAL_TERMS_FINAL: "0" } as NodeJS.ProcessEnv
    });

    const response = await POST(post("http://t/api/billing/stripe/checkout", { plan: "monthly" }));
    expect(response.status).toBe(503);
    expect((await response.json()).error).toMatch(/unavailable/i);
    expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it("503s rather than creating a live checkout with an invalid return URL", async () => {
    const stripe = stripeStub();
    const POST = createStripeCheckoutHandler({
      ...baseDeps(),
      stripeClient: () => stripe as never,
      env: { ...checkoutEnv, NEXT_PUBLIC_APP_URL: "http://localhost:3000" } as NodeJS.ProcessEnv
    });

    const response = await POST(post("http://t/api/billing/stripe/checkout", { plan: "monthly" }));
    expect(response.status).toBe(503);
    expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
  });
});
