import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createTrialCheckoutHandler } from "../../../app/api/billing/handlers";
import { schema } from "../../../lib/server/db";
import { createTestDb } from "../../helpers/test-db";
import { TERMS_VERSION } from "../../../lib/legal/terms";

/**
 * Task 2.6 — email-first trial checkout. Account is created at trial start
 * (find-or-create on the same `users` row the magic-link sign-in resolves),
 * the magic link is fired non-fatally, and a card-gated 7-day trial Checkout
 * session is returned. DI seams (db / stripeClient / sendMagicLink / env) keep
 * the test off the network.
 */

let ctx: Awaited<ReturnType<typeof createTestDb>>;

beforeEach(async () => {
  ctx = await createTestDb();
});

afterEach(async () => {
  await ctx.close();
});

function jsonRequest(body: unknown) {
  return new Request("http://t/api/trial/start", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      ...(body as Record<string, unknown>),
      termsAccepted: true,
      termsVersion: TERMS_VERSION
    })
  });
}

const trialEnv = {
  STRIPE_PRICE_MONTHLY_1299: "price_1299",
  TRIAL_PRICE_VARIANT: "1299",
  NEXT_PUBLIC_APP_URL: "https://app",
  // W-04: checkout is 503'd unless the deploy declares the terms final. These
  // suites exercise the real path, so they declare it; the gate has its own
  // describe block below.
  LEGAL_TERMS_FINAL: "1"
} as unknown as NodeJS.ProcessEnv;

function stripeStub() {
  return {
    checkout: {
      sessions: { create: vi.fn().mockResolvedValue({ url: "https://stripe/x" }) }
    }
  };
}

it("creates the user, sends the magic link, and returns a trial checkout url", async () => {
  const stripe = stripeStub();
  const sendMagicLink = vi.fn().mockResolvedValue(undefined);
  const handler = createTrialCheckoutHandler({
    db: () => ctx.db,
    stripeClient: () => stripe as never,
    sendMagicLink,
    env: trialEnv
  });

  const res = await handler(jsonRequest({ email: "new@example.com" }));
  expect((await res.json()).url).toBe("https://stripe/x");

  const [user] = await ctx.db.select().from(schema.users);
  expect(user.email).toBe("new@example.com");
  expect(sendMagicLink).toHaveBeenCalledWith("new@example.com");

  const call = stripe.checkout.sessions.create.mock.calls[0][0];
  expect(call).toMatchObject({
    mode: "subscription",
    payment_method_collection: "always",
    client_reference_id: user.id,
    customer_email: "new@example.com",
    line_items: [{ price: "price_1299", quantity: 1 }],
    subscription_data: {
      trial_period_days: 7,
      metadata: {
        price_variant: "1299",
        terms_version: TERMS_VERSION
      }
    },
    metadata: { terms_version: TERMS_VERSION },
    // BC-3: the template param lets the return page sync entitlement
    // server-side even when the webhook is unregistered.
    success_url: "https://app/trial/started?session_id={CHECKOUT_SESSION_ID}",
    cancel_url: "https://app/subscribe?declined=1"
  });
});

it("503s rather than creating a trial checkout with an invalid return URL", async () => {
  const stripe = stripeStub();
  const handler = createTrialCheckoutHandler({
    db: () => ctx.db,
    stripeClient: () => stripe as never,
    sendMagicLink: vi.fn(),
    env: { ...trialEnv, NEXT_PUBLIC_APP_URL: "http://localhost:3000" } as NodeJS.ProcessEnv
  });

  const res = await handler(jsonRequest({ email: "invalid-return@example.com" }));
  expect(res.status).toBe(503);
  expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
});

it("is idempotent for an existing user (no duplicate users row)", async () => {
  const [existing] = await ctx.db
    .insert(schema.users)
    .values({ email: "again@example.com" })
    .returning();

  const stripe = stripeStub();
  const handler = createTrialCheckoutHandler({
    db: () => ctx.db,
    stripeClient: () => stripe as never,
    sendMagicLink: vi.fn().mockResolvedValue(undefined),
    env: trialEnv
  });

  // Uppercase + whitespace must normalise to the same row (schema lowercases).
  const res = await handler(jsonRequest({ email: "  AGAIN@example.com  " }));
  expect(res.status).toBe(200);

  const rows = await ctx.db.select().from(schema.users);
  expect(rows).toHaveLength(1);
  expect(rows[0].id).toBe(existing.id);

  const call = stripe.checkout.sessions.create.mock.calls[0][0];
  expect(call.client_reference_id).toBe(existing.id);
  expect(call.customer_email).toBe("again@example.com");
});

it("400s on an invalid email", async () => {
  const stripe = stripeStub();
  const handler = createTrialCheckoutHandler({
    db: () => ctx.db,
    stripeClient: () => stripe as never,
    sendMagicLink: vi.fn(),
    env: trialEnv
  });

  const res = await handler(jsonRequest({ email: "not-an-email" }));
  expect(res.status).toBe(400);
  expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
  expect(await ctx.db.select().from(schema.users)).toHaveLength(0);
});

it("plan=annual checks out against the annual price with annual metadata", async () => {
  const stripe = stripeStub();
  const handler = createTrialCheckoutHandler({
    db: () => ctx.db,
    stripeClient: () => stripe as never,
    sendMagicLink: vi.fn().mockResolvedValue(undefined),
    env: {
      ...trialEnv,
      STRIPE_PRICE_ANNUAL_8999: "price_annual"
    } as unknown as NodeJS.ProcessEnv
  });

  const res = await handler(
    jsonRequest({ email: "year@example.com", plan: "annual" })
  );
  expect(res.status).toBe(200);

  const call = stripe.checkout.sessions.create.mock.calls[0][0];
  expect(call.line_items).toEqual([{ price: "price_annual", quantity: 1 }]);
  expect(call.subscription_data).toMatchObject({
    trial_period_days: 7,
    metadata: {
      price_variant: "annual_8999",
      terms_version: TERMS_VERSION
    }
  });
});

it("503s on plan=annual when STRIPE_PRICE_ANNUAL_8999 is unset", async () => {
  const stripe = stripeStub();
  const handler = createTrialCheckoutHandler({
    db: () => ctx.db,
    stripeClient: () => stripe as never,
    sendMagicLink: vi.fn(),
    env: trialEnv
  });

  const res = await handler(
    jsonRequest({ email: "year@example.com", plan: "annual" })
  );
  expect(res.status).toBe(503);
  expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
});

it("503s when the variant price env is unset", async () => {
  const stripe = stripeStub();
  const handler = createTrialCheckoutHandler({
    db: () => ctx.db,
    stripeClient: () => stripe as never,
    sendMagicLink: vi.fn(),
    env: { TRIAL_PRICE_VARIANT: "1299" } as unknown as NodeJS.ProcessEnv
  });

  const res = await handler(jsonRequest({ email: "new@example.com" }));
  expect(res.status).toBe(503);
  expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
});

describe("magic-link delivery is non-fatal", () => {
  it("still returns a checkout url when sendMagicLink throws", async () => {
    const stripe = stripeStub();
    const handler = createTrialCheckoutHandler({
      db: () => ctx.db,
      stripeClient: () => stripe as never,
      sendMagicLink: vi.fn().mockRejectedValue(new Error("resend down")),
      env: trialEnv
    });

    const res = await handler(jsonRequest({ email: "new@example.com" }));
    expect(res.status).toBe(200);
    expect((await res.json()).url).toBe("https://stripe/x");
  });
});

/**
 * W-16 — one free week per account, ever. Every checkout used to carry a fresh
 * trial_period_days, so cancel → re-subscribe → cancel bought unbounded free
 * premium. The `subscriptions` row IS the flag (no migration, nothing to keep
 * in sync): any prior row, in any status, means the week was already taken.
 */
describe("repeat-trial guard (W-16)", () => {
  async function seedUserWithSubscription(email: string, status: string) {
    const [user] = await ctx.db.insert(schema.users).values({ email }).returning();
    await ctx.db.insert(schema.subscriptions).values({
      userId: user.id,
      provider: "stripe",
      providerRef: `sub_${status}_${user.id}`,
      productId: "premium_monthly",
      status: status as "active",
      currentPeriodEnd: new Date("2026-08-01T00:00:00.000Z")
    });
    return user;
  }

  function handlerFor(stripe: ReturnType<typeof stripeStub>) {
    return createTrialCheckoutHandler({
      db: () => ctx.db,
      stripeClient: () => stripe as never,
      sendMagicLink: vi.fn().mockResolvedValue(undefined),
      env: trialEnv
    });
  }

  // Every terminal state a churned subscriber can be in. Each one already
  // consumed the free week, so none of them may be handed another. AUD-011:
  // the first request now answers with the authoritative disclosure (amount
  // due today + cadence) and NO checkout; only the acknowledged resubmit opens
  // the immediate-billing session — still without a trial period.
  for (const status of ["canceled", "expired", "refunded", "active"]) {
    it(`discloses first, then grants NO trial period, to a user with a prior '${status}' subscription`, async () => {
      await seedUserWithSubscription(`${status}@example.com`, status);
      const stripe = stripeStub();
      const handler = handlerFor(stripe);

      const first = await handler(
        jsonRequest({ email: `${status}@example.com` })
      );
      expect(first.status).toBe(200);
      expect(await first.json()).toEqual({
        ineligibleTrial: true,
        priceDisplay: "$12.99",
        cadence: "month"
      });
      // Disclosure bounce: no checkout session was opened.
      expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();

      const res = await handler(
        jsonRequest({
          email: `${status}@example.com`,
          acknowledgeImmediate: true
        })
      );
      expect(res.status).toBe(200); // they can still subscribe — just not free
      expect((await res.json()).url).toBe("https://stripe/x");

      const call = stripe.checkout.sessions.create.mock.calls[0][0];
      expect(call.subscription_data.trial_period_days).toBeUndefined();
      expect(call.subscription_data.metadata).toEqual({
        price_variant: "1299",
        terms_version: TERMS_VERSION
      });
    });
  }

  it("sends no magic link on the disclosure bounce (AUD-011)", async () => {
    await seedUserWithSubscription("bounce@example.com", "canceled");
    const stripe = stripeStub();
    const sendMagicLink = vi.fn().mockResolvedValue(undefined);
    const handler = createTrialCheckoutHandler({
      db: () => ctx.db,
      stripeClient: () => stripe as never,
      sendMagicLink,
      env: trialEnv
    });

    await handler(jsonRequest({ email: "bounce@example.com" }));
    expect(sendMagicLink).not.toHaveBeenCalled();

    await handler(
      jsonRequest({ email: "bounce@example.com", acknowledgeImmediate: true })
    );
    expect(sendMagicLink).toHaveBeenCalledWith("bounce@example.com");
  });

  it("still grants the full free week to an ELIGIBLE user who sent the acknowledgment", async () => {
    // The flag is permission for immediate billing, never a forfeit: an
    // eligible account keeps its trial even if the client over-sends it.
    const stripe = stripeStub();
    const res = await handlerFor(stripe)(
      jsonRequest({ email: "eager@example.com", acknowledgeImmediate: true })
    );
    expect(res.status).toBe(200);
    expect((await res.json()).url).toBe("https://stripe/x");
    const call = stripe.checkout.sessions.create.mock.calls[0][0];
    expect(call.subscription_data.trial_period_days).toBe(7);
  });

  it("still grants the trial to a user who merely ABANDONED checkout (row exists, no subscription)", async () => {
    // The trial handler creates the users row before Stripe, so an abandoned
    // checkout leaves a user with no subscriptions row. They never used their
    // week — they must still get it.
    await ctx.db.insert(schema.users).values({ email: "abandoned@example.com" });
    const stripe = stripeStub();

    const res = await handlerFor(stripe)(
      jsonRequest({ email: "abandoned@example.com" })
    );
    expect(res.status).toBe(200);

    const call = stripe.checkout.sessions.create.mock.calls[0][0];
    expect(call.subscription_data.trial_period_days).toBe(7);
  });
});

/**
 * W-11 — the per-email cooldown. The proxy limits this route per IP; this is
 * the half per-IP cannot see, a flood spread over many IPs at one inbox.
 */
describe("per-email cooldown (W-11)", () => {
  it("429s a cooled-down address BEFORE creating a user, sending mail, or opening Stripe", async () => {
    const stripe = stripeStub();
    const sendMagicLink = vi.fn();
    const handler = createTrialCheckoutHandler({
      db: () => ctx.db,
      stripeClient: () => stripe as never,
      sendMagicLink,
      emailCooldown: async () => ({ ok: false }),
      env: trialEnv
    });

    const res = await handler(jsonRequest({ email: "victim@example.com" }));

    expect(res.status).toBe(429);
    // A blocked request must cost us nothing at all.
    expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
    expect(sendMagicLink).not.toHaveBeenCalled();
    expect(await ctx.db.select().from(schema.users)).toHaveLength(0);
  });

  it("checks the cooldown against the normalised address", async () => {
    const emailCooldown = vi.fn().mockResolvedValue({ ok: true });
    const handler = createTrialCheckoutHandler({
      db: () => ctx.db,
      stripeClient: () => stripeStub() as never,
      sendMagicLink: vi.fn().mockResolvedValue(undefined),
      emailCooldown,
      env: trialEnv
    });

    await handler(jsonRequest({ email: "  MixedCase@Example.com " }));
    expect(emailCooldown).toHaveBeenCalledWith("mixedcase@example.com");
  });
});

describe("legal gate (W-04)", () => {
  it("kill switch: 503s and takes no money when LEGAL_TERMS_FINAL=0", async () => {
    const stripe = stripeStub();
    const sendMagicLink = vi.fn();
    const handler = createTrialCheckoutHandler({
      db: () => ctx.db,
      stripeClient: () => stripe as never,
      sendMagicLink,
      env: { ...trialEnv, LEGAL_TERMS_FINAL: "0" } as NodeJS.ProcessEnv
    });

    const res = await handler(jsonRequest({ email: "new@example.com" }));

    expect(res.status).toBe(503);
    expect((await res.json()).error).toMatch(/unavailable/i);
    expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
    expect(sendMagicLink).not.toHaveBeenCalled();
    expect(await ctx.db.select().from(schema.users)).toHaveLength(0);
  });
});
