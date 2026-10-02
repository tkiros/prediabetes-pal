import { describe, expect, it, vi } from "vitest";

import { createPaywallHandler, GET } from "../../../app/api/paywall/route";
import { PaywallConfigSchema } from "../../../lib/client/paywall-config";
import type { Db } from "../../../lib/server/db";

// Contract test (Task 7): the /api/paywall body must satisfy the exact zod
// schema the client validates against. If the route ever drops a field or
// changes a shape, the client would fall back to its pending/retry state — so
// this test is the tripwire that keeps the server contract and the client
// parser in lockstep.
describe("GET /api/paywall — server commercial contract", () => {
  it("returns a body that passes the client's zod schema", async () => {
    const response = await GET();
    const body = await response.json();
    const parsed = PaywallConfigSchema.safeParse(body);
    expect(parsed.success).toBe(true);
  });

  it("emits a valid mode and a price display, never a bare/partial body", async () => {
    const body = await (await GET()).json();
    expect(["legacy", "trial"]).toContain(body.mode);
    expect(["999", "1299", "1999"]).toContain(body.variant);
    expect(typeof body.priceDisplay).toBe("string");
    expect(body.priceDisplay.startsWith("$")).toBe(true);
    // Annual is present-or-null; both are valid, but the key must exist so the
    // client can distinguish "no annual" from "malformed".
    expect(body).toHaveProperty("annualDisplay");
    expect(body).toHaveProperty("annualMonthlyEquivalent");
  });

  it("defaults to trial mode when PAYWALL_MODE is unset (behavior unchanged)", async () => {
    const priorMode = process.env.PAYWALL_MODE;
    delete process.env.PAYWALL_MODE;
    try {
      const body = await (await GET()).json();
      expect(body.mode).toBe("trial");
    } finally {
      if (priorMode !== undefined) {
        process.env.PAYWALL_MODE = priorMode;
      }
    }
  });

  // Honest inverse of the :3100 e2e dummy (billing-pages.spec asserts the annual
  // card RENDERS when STRIPE_PRICE_ANNUAL_8999 is set). Production may leave the var
  // unset; here we prove the server then reports annual as NOT offered, so the
  // client's `{config.annualDisplay ? <annual/> : null}` gate correctly hides
  // the annual card rather than showing a guessed price.
  it("reports annual as not offered when STRIPE_PRICE_ANNUAL_8999 is unset", async () => {
    const prior = process.env.STRIPE_PRICE_ANNUAL_8999;
    delete process.env.STRIPE_PRICE_ANNUAL_8999;
    try {
      const body = await (await GET()).json();
      expect(body.annualDisplay).toBeNull();
      expect(body.annualMonthlyEquivalent).toBeNull();
      // Still a valid, full contract — the client shows monthly + pending-free.
      expect(PaywallConfigSchema.safeParse(body).success).toBe(true);
    } finally {
      if (prior !== undefined) {
        process.env.STRIPE_PRICE_ANNUAL_8999 = prior;
      }
    }
  });

  // strictObject tripwire: if the route ever adds/renames a field, the client's
  // zod parse would reject the body and drop to the pending/retry state — this
  // asserts the guard is live so that drift fails loudly in CI, not in prod.
  it("rejects an unexpected extra field (strict contract)", () => {
    const body = {
      mode: "trial",
      variant: "1299",
      priceDisplay: "$12.99",
      annualDisplay: null,
      annualMonthlyEquivalent: null,
      entitled: false,
      surpriseField: "drift"
    };
    expect(PaywallConfigSchema.safeParse(body).success).toBe(false);
  });

  // AUD-009: the route resolves entitlement server-side so the check form's
  // device taster gate can stand down for Premium/trialing sessions.
  describe("entitled resolution", () => {
    const fakeDb = () => ({}) as unknown as Db;

    it("reports entitled=true for a premium session", async () => {
      const handler = createPaywallHandler({
        db: fakeDb,
        getSession: async () => ({ userId: "u1", email: "u@example.com" }),
        getEntitlementImpl: vi.fn().mockResolvedValue({ tier: "premium" })
      });
      const body = await (await handler()).json();
      expect(body.entitled).toBe(true);
      expect(PaywallConfigSchema.safeParse(body).success).toBe(true);
    });

    it("reports entitled=false for a guest (no session, no DB read)", async () => {
      const readEntitlement = vi.fn();
      const handler = createPaywallHandler({
        db: fakeDb,
        getSession: async () => null,
        getEntitlementImpl: readEntitlement
      });
      const body = await (await handler()).json();
      expect(body.entitled).toBe(false);
      expect(readEntitlement).not.toHaveBeenCalled();
    });

    it("reports entitled=false for a signed-in free session", async () => {
      const handler = createPaywallHandler({
        db: fakeDb,
        getSession: async () => ({ userId: "u1", email: "u@example.com" }),
        getEntitlementImpl: vi.fn().mockResolvedValue({ tier: "free" })
      });
      const body = await (await handler()).json();
      expect(body.entitled).toBe(false);
    });

    it("degrades to entitled=false (still a full contract) when resolution throws", async () => {
      const handler = createPaywallHandler({
        db: fakeDb,
        getSession: async () => ({ userId: "u1", email: "u@example.com" }),
        getEntitlementImpl: vi.fn().mockRejectedValue(new Error("db down"))
      });
      const body = await (await handler()).json();
      expect(body.entitled).toBe(false);
      expect(PaywallConfigSchema.safeParse(body).success).toBe(true);
    });
  });
});
