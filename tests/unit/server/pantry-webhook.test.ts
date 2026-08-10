import type Stripe from "stripe";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { applyStripeEvent } from "../../../app/api/billing/handlers";
import { hashClaimToken } from "../../../lib/server/pantry/claims";
import { schema } from "../../../lib/server/db";
import { createTestDb } from "../../helpers/test-db";

const NOW = new Date("2026-07-05T10:00:00.000Z");

let testDb: Awaited<ReturnType<typeof createTestDb>>;

beforeAll(async () => {
  process.env.HEALTH_DATA_KEY = Buffer.alloc(32, 7).toString("base64");
  process.env.STRIPE_PRICE_PANTRY = "price_pantry_25";
  process.env.NEXT_PUBLIC_APP_URL = "https://pal.test";
  testDb = await createTestDb();
});

afterAll(async () => {
  delete process.env.STRIPE_PRICE_PANTRY;
  await testDb.close();
});

beforeEach(async () => {
  await testDb.db.delete(schema.pantryOrders);
  await testDb.db.delete(schema.subscriptions);
});

function paymentSessionEvent(overrides: Record<string, unknown> = {}) {
  return {
    type: "checkout.session.completed",
    data: {
      object: {
        id: "cs_pantry_1",
        mode: "payment",
        payment_intent: "pi_123",
        customer_details: { email: "buyer@example.com" },
        subscription: null,
        client_reference_id: null,
        ...overrides
      }
    }
  } as unknown as Stripe.Event;
}

function stripeWithLineItems(priceId: string) {
  return () =>
    ({
      checkout: {
        sessions: {
          listLineItems: vi.fn().mockResolvedValue({
            data: [{ price: { id: priceId } }]
          })
        }
      }
    }) as unknown as Stripe;
}

describe("applyStripeEvent — pantry branch", () => {
  it("creates a paid order and emails a claim link whose token hashes to the stored value", async () => {
    const send = vi.fn().mockResolvedValue({ ok: true });

    await applyStripeEvent(
      testDb.db,
      paymentSessionEvent(),
      NOW,
      stripeWithLineItems("price_pantry_25"),
      { send }
    );

    const [order] = await testDb.db.select().from(schema.pantryOrders);
    expect(order.status).toBe("paid");
    expect(order.email).toBe("buyer@example.com");
    expect(order.stripeSessionId).toBe("cs_pantry_1");
    expect(order.stripePaymentIntent).toBe("pi_123");
    expect(order.userId).toBeNull();
    expect(order.intakeEmailSentAt?.toISOString()).toBe(NOW.toISOString());

    expect(send).toHaveBeenCalledTimes(1);
    const message = send.mock.calls[0][0];
    expect(message.to).toBe("buyer@example.com");
    const token = /token=([A-Za-z0-9_-]+)/.exec(message.text)?.[1] ?? "";
    expect(hashClaimToken(token)).toBe(order.claimToken);
  });

  it("is idempotent on the session id — duplicate delivery makes one order, one email", async () => {
    const send = vi.fn().mockResolvedValue({ ok: true });
    const stripe = stripeWithLineItems("price_pantry_25");

    await applyStripeEvent(testDb.db, paymentSessionEvent(), NOW, stripe, { send });
    await applyStripeEvent(testDb.db, paymentSessionEvent(), NOW, stripe, { send });

    expect(await testDb.db.select().from(schema.pantryOrders)).toHaveLength(1);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("emits pantry_purchased exactly once across a duplicate webhook delivery", async () => {
    const send = vi.fn().mockResolvedValue({ ok: true });
    const stripe = stripeWithLineItems("price_pantry_25");
    const info = vi.spyOn(console, "info").mockImplementation(() => {});

    let lines: unknown[][];
    try {
      await applyStripeEvent(testDb.db, paymentSessionEvent(), NOW, stripe, { send });
      await applyStripeEvent(testDb.db, paymentSessionEvent(), NOW, stripe, { send });
      lines = [...info.mock.calls];
    } finally {
      info.mockRestore();
    }

    const purchased = lines.filter(
      ([line]) =>
        typeof line === "string" && line.includes('"name":"pantry_purchased"')
    );
    expect(purchased).toHaveLength(1);
  });

  it("ignores payment-mode sessions for other products", async () => {
    const send = vi.fn();

    await applyStripeEvent(
      testDb.db,
      paymentSessionEvent({ id: "cs_other" }),
      NOW,
      stripeWithLineItems("price_something_else"),
      { send }
    );

    expect(await testDb.db.select().from(schema.pantryOrders)).toHaveLength(0);
    expect(send).not.toHaveBeenCalled();
  });

  it("does nothing when STRIPE_PRICE_PANTRY is unset", async () => {
    delete process.env.STRIPE_PRICE_PANTRY;
    const send = vi.fn();

    await applyStripeEvent(
      testDb.db,
      paymentSessionEvent(),
      NOW,
      stripeWithLineItems("price_pantry_25"),
      { send }
    );

    expect(await testDb.db.select().from(schema.pantryOrders)).toHaveLength(0);
    process.env.STRIPE_PRICE_PANTRY = "price_pantry_25";
  });

  it("keeps the order but leaves intakeEmailSentAt null when the email send fails", async () => {
    const send = vi.fn().mockResolvedValue({ ok: false, status: 500 });

    await applyStripeEvent(
      testDb.db,
      paymentSessionEvent(),
      NOW,
      stripeWithLineItems("price_pantry_25"),
      { send }
    );

    const [order] = await testDb.db.select().from(schema.pantryOrders);
    expect(order.status).toBe("paid");
    expect(order.intakeEmailSentAt).toBeNull();
  });

  it("charge.refunded cancels the matching order and ignores unknown intents", async () => {
    const send = vi.fn().mockResolvedValue({ ok: true });
    await applyStripeEvent(
      testDb.db,
      paymentSessionEvent(),
      NOW,
      stripeWithLineItems("price_pantry_25"),
      { send }
    );

    await applyStripeEvent(
      testDb.db,
      {
        type: "charge.refunded",
        data: { object: { payment_intent: "pi_unknown" } }
      } as unknown as Stripe.Event,
      NOW
    );
    let [order] = await testDb.db.select().from(schema.pantryOrders);
    expect(order.status).toBe("paid");

    await applyStripeEvent(
      testDb.db,
      {
        type: "charge.refunded",
        data: { object: { payment_intent: "pi_123" } }
      } as unknown as Stripe.Event,
      NOW
    );
    [order] = await testDb.db.select().from(schema.pantryOrders);
    expect(order.status).toBe("canceled");
  });

  it("REGRESSION: a subscription checkout still creates a subscription and NO pantry order", async () => {
    const send = vi.fn();
    const stripeClient = {
      subscriptions: {
        retrieve: vi.fn().mockResolvedValue({
          items: {
            data: [
              {
                price: { id: "price_monthly" },
                current_period_end: Math.floor(NOW.getTime() / 1000) + 86400
              }
            ]
          }
        })
      }
    } as unknown as Stripe;
    const [user] = await testDb.db
      .insert(schema.users)
      .values({ email: `sub-${Date.now()}@test.dev` })
      .returning();

    await applyStripeEvent(
      testDb.db,
      {
        type: "checkout.session.completed",
        data: {
          object: {
            mode: "subscription",
            client_reference_id: user.id,
            subscription: "sub_reg_1"
          }
        }
      } as unknown as Stripe.Event,
      NOW,
      () => stripeClient,
      { send }
    );

    expect(await testDb.db.select().from(schema.subscriptions)).toHaveLength(1);
    expect(await testDb.db.select().from(schema.pantryOrders)).toHaveLength(0);
    expect(send).not.toHaveBeenCalled();
  });
});
