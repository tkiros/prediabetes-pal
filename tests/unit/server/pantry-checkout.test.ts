import type Stripe from "stripe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  applyStripeEvent,
  createPantryCheckoutSessionHandler
} from "../../../app/api/billing/handlers";
import { hashClaimToken } from "../../../lib/server/pantry/claims";
import { schema } from "../../../lib/server/db";
import { clearPantryPriceCache } from "../../../lib/server/pantry-price";
import { createTestDb } from "../../helpers/test-db";
import { TERMS_VERSION } from "../../../lib/legal/terms";

/**
 * Task 6.1 — in-app one-time Pantry Review checkout. The factory mirrors the
 * subscription checkout minus the session gate (buyers may be anonymous;
 * Checkout collects the email). The completed session flows through the SAME
 * `applyPantryCheckout` webhook branch as the Payment Link path, so the
 * regression below reuses the pantry-webhook fixture shape to prove it.
 */

const NOW = new Date("2026-07-05T10:00:00.000Z");
const PRICE = "price_pantry_25";

let savedPrice: string | undefined;
let savedAppUrl: string | undefined;

let savedLegal: string | undefined;

beforeEach(() => {
  savedPrice = process.env.STRIPE_PRICE_PANTRY;
  savedAppUrl = process.env.NEXT_PUBLIC_APP_URL;
  savedLegal = process.env.LEGAL_TERMS_FINAL;
  process.env.STRIPE_PRICE_PANTRY = PRICE;
  process.env.NEXT_PUBLIC_APP_URL = "https://pal.test";
  // W-04: this is a paid-checkout entry point, so it 503s unless the deploy
  // declares the terms final. Declared here so the suite exercises the real
  // path — and so the "no price configured" 503 below can't pass for the wrong
  // reason. The gate itself is proven in its own test.
  process.env.LEGAL_TERMS_FINAL = "1";
  // AUD-010: the resolver memoizes per price id — clear between tests so a
  // cached verification can't leak across cases.
  clearPantryPriceCache();
});

afterEach(() => {
  if (savedPrice === undefined) delete process.env.STRIPE_PRICE_PANTRY;
  else process.env.STRIPE_PRICE_PANTRY = savedPrice;
  if (savedAppUrl === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
  else process.env.NEXT_PUBLIC_APP_URL = savedAppUrl;
  if (savedLegal === undefined) delete process.env.LEGAL_TERMS_FINAL;
  else process.env.LEGAL_TERMS_FINAL = savedLegal;
});

// AUD-010: the handler now verifies the configured Price object (active,
// one-time, USD) before opening a session, so the stub answers prices.retrieve
// with the shape the live catalog holds.
function stripeStub(
  price: Record<string, unknown> = {
    id: PRICE,
    active: true,
    recurring: null,
    currency: "usd",
    unit_amount: 4900
  }
) {
  return {
    checkout: {
      sessions: {
        create: vi.fn().mockResolvedValue({ url: "https://stripe/pantry" })
      }
    },
    prices: {
      retrieve: vi.fn().mockResolvedValue(price)
    }
  };
}

function acceptedRequest() {
  return new Request("https://pal.test/api/billing/stripe/pantry-checkout", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      termsAccepted: true,
      termsVersion: TERMS_VERSION
    })
  });
}

describe("createPantryCheckoutSessionHandler", () => {
  it("returns a payment-mode checkout url for the pantry price, no session gate", async () => {
    const stripe = stripeStub();
    const handler = createPantryCheckoutSessionHandler({
      stripeClient: () => stripe as never
    });

    const res = await handler(acceptedRequest());
    expect(res.status).toBe(200);
    expect((await res.json()).url).toBe("https://stripe/pantry");

    const call = stripe.checkout.sessions.create.mock.calls[0][0];
    expect(call).toMatchObject({
      mode: "payment",
      line_items: [{ price: PRICE, quantity: 1 }],
      metadata: { terms_version: TERMS_VERSION },
      success_url: "https://pal.test/pantry/thanks",
      cancel_url: "https://pal.test/pantry"
    });
    // No session gate: the handler never touches client_reference_id.
    expect(call.client_reference_id).toBeUndefined();
  });

  it("503s when STRIPE_PRICE_PANTRY is unset", async () => {
    delete process.env.STRIPE_PRICE_PANTRY;
    const stripe = stripeStub();
    const handler = createPantryCheckoutSessionHandler({
      stripeClient: () => stripe as never
    });

    const res = await handler(acceptedRequest());
    expect(res.status).toBe(503);
    expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
  });

  // AUD-010: display and charge share one authority. A misconfigured Price —
  // recurring, non-USD, or inactive — fails closed with NO checkout, because
  // the landing could not have truthfully displayed it either.
  for (const [label, price] of [
    [
      "recurring",
      { id: PRICE, active: true, recurring: { interval: "month" }, currency: "usd", unit_amount: 4900 }
    ],
    [
      "non-USD",
      { id: PRICE, active: true, recurring: null, currency: "eur", unit_amount: 4900 }
    ],
    [
      "inactive",
      { id: PRICE, active: false, recurring: null, currency: "usd", unit_amount: 4900 }
    ]
  ] as const) {
    it(`503s without a session when the configured Price is ${label}`, async () => {
      const stripe = stripeStub(price as Record<string, unknown>);
      const handler = createPantryCheckoutSessionHandler({
        stripeClient: () => stripe as never
      });
      const res = await handler(acceptedRequest());
      expect(res.status).toBe(503);
      expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
    });
  }

  it("503s without a session when the Price lookup itself fails", async () => {
    const stripe = stripeStub();
    stripe.prices.retrieve = vi.fn().mockRejectedValue(new Error("stripe down"));
    const handler = createPantryCheckoutSessionHandler({
      stripeClient: () => stripe as never
    });
    const res = await handler(acceptedRequest());
    expect(res.status).toBe(503);
    expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it("W-04 kill switch: 503s and never opens a Stripe session when LEGAL_TERMS_FINAL=0", async () => {
    process.env.LEGAL_TERMS_FINAL = "0";
    const stripe = stripeStub();
    const handler = createPantryCheckoutSessionHandler({
      stripeClient: () => stripe as never
    });
    const res = await handler(acceptedRequest());
    expect(res.status).toBe(503);
    expect((await res.json()).error).toMatch(/unavailable/i);
    expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it("503s rather than creating a live checkout with an invalid return URL", async () => {
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
    const stripe = stripeStub();
    const handler = createPantryCheckoutSessionHandler({
      stripeClient: () => stripe as never
    });

    const res = await handler(acceptedRequest());
    expect(res.status).toBe(503);
    expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it("400s before checkout when paid terms were not accepted", async () => {
    const stripe = stripeStub();
    const handler = createPantryCheckoutSessionHandler({
      stripeClient: () => stripe as never
    });
    const res = await handler(
      new Request("https://pal.test/api/billing/stripe/pantry-checkout", {
        method: "POST",
        body: "{}"
      })
    );
    expect(res.status).toBe(400);
    expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it("REGRESSION: a completed session from this handler's shape drives applyPantryCheckout to create an order + intake email", async () => {
    const ctx = await createTestDb();
    try {
      const send = vi.fn().mockResolvedValue({ ok: true });

      // The completed webhook payload for a session created by this handler:
      // mode "payment", the pantry price on the line items — identical to the
      // Payment Link path the pantry-webhook fixtures exercise.
      const event = {
        type: "checkout.session.completed",
        data: {
          object: {
            id: "cs_pantry_inapp_1",
            mode: "payment",
            payment_intent: "pi_inapp_1",
            customer_details: { email: "buyer@example.com" },
            metadata: { terms_version: TERMS_VERSION },
            subscription: null,
            client_reference_id: null
          }
        }
      } as unknown as Stripe.Event;

      const stripe = () =>
        ({
          checkout: {
            sessions: {
              listLineItems: vi.fn().mockResolvedValue({
                data: [{ price: { id: PRICE } }]
              })
            }
          }
        }) as unknown as Stripe;

      await applyStripeEvent(ctx.db, event, NOW, stripe, { send });

      const [order] = await ctx.db.select().from(schema.pantryOrders);
      expect(order.status).toBe("paid");
      expect(order.termsVersion).toBe(TERMS_VERSION);
      expect(order.termsAcceptedAt?.toISOString()).toBe(NOW.toISOString());
      expect(order.email).toBe("buyer@example.com");
      expect(order.stripeSessionId).toBe("cs_pantry_inapp_1");
      expect(order.intakeEmailSentAt?.toISOString()).toBe(NOW.toISOString());

      expect(send).toHaveBeenCalledTimes(1);
      const message = send.mock.calls[0][0];
      expect(message.to).toBe("buyer@example.com");
      const token = /token=([A-Za-z0-9_-]+)/.exec(message.text)?.[1] ?? "";
      expect(hashClaimToken(token)).toBe(order.claimToken);
    } finally {
      await ctx.close();
    }
    // PGlite boots inside the test body (not beforeAll), so the global 120s
    // hookTimeout doesn't cover it; under full-suite load the boot alone blew
    // the 60s testTimeout (2026-07-09 E2E-04). Same sizing as hookTimeout.
  }, 120_000);
});
