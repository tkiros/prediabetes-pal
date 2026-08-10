import type Stripe from "stripe";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ingestStripeEvent,
  minimizeBillingPayload,
  redactBillingPayload
} from "../../../lib/server/billing/inbox";
import { schema } from "../../../lib/server/db";
import { createTestDb } from "../../helpers/test-db";

/**
 * BC-8/PR-1: billing_event_inbox retained full Stripe events (buyer email,
 * name, address) forever, with no user FK — account deletion never reached
 * them. Processed rows must hold a redacted payload.
 */

const NOW = new Date("2026-07-21T12:00:00.000Z");

let testDb: Awaited<ReturnType<typeof createTestDb>>;

beforeAll(async () => {
  testDb = await createTestDb();
});

afterAll(async () => {
  await testDb.close();
});

beforeEach(async () => {
  await testDb.db.delete(schema.billingEventInbox);
});

describe("redactBillingPayload", () => {
  it("drops buyer PII keys at any depth, keeps structural billing fields", () => {
    const redacted = redactBillingPayload({
      id: "evt_1",
      type: "invoice.paid",
      data: {
        object: {
          id: "in_1",
          billing_reason: "subscription_cycle",
          customer_email: "buyer@example.com",
          customer_name: "Ada Buyer",
          customer_address: { line1: "1 Main St" },
          parent: {
            subscription_details: { subscription: "sub_9" }
          },
          lines: {
            data: [{ amount: 1299, billing_details: { email: "x@y.z" } }]
          }
        }
      }
    });

    const s = JSON.stringify(redacted);
    expect(s).not.toContain("buyer@example.com");
    expect(s).not.toContain("Ada Buyer");
    expect(s).not.toContain("1 Main St");
    expect(s).not.toContain("x@y.z");
    // What the reconcile charge scan still needs survives:
    expect(s).toContain("subscription_cycle");
    expect(s).toContain("sub_9");
    expect(s).toContain("1299");
  });
});

describe("minimizeBillingPayload", () => {
  it("allowlists only replay fields and drops unknown/free-text PII", () => {
    const minimized = minimizeBillingPayload({
      id: "evt_min_1",
      type: "invoice.paid",
      created: 1_721_562_000,
      data: {
        object: {
          id: "in_1",
          billing_reason: "subscription_cycle",
          customer_email: "buyer@example.com",
          customer_name: "Ada Buyer",
          description: "private support note",
          metadata: { phone: "+1-555-0100" },
          parent: {
            subscription_details: { subscription: { id: "sub_9" } }
          }
        }
      }
    } as unknown as Stripe.Event);

    expect(minimized).toEqual({
      _pal_minimized: 1,
      id: "evt_min_1",
      type: "invoice.paid",
      created: 1_721_562_000,
      data: {
        object: {
          id: "in_1",
          billing_reason: "subscription_cycle",
          parent: {
            subscription_details: { subscription: "sub_9" }
          },
          subscription: "sub_9"
        }
      }
    });
    const serialized = JSON.stringify(minimized);
    expect(serialized).not.toContain("buyer@example.com");
    expect(serialized).not.toContain("private support note");
    expect(serialized).not.toContain("+1-555-0100");
  });
});

describe("ingestStripeEvent → processed rows hold a redacted payload", () => {
  it("removes customer details once the event is processed", async () => {
    const event = {
      id: "evt_redact_1",
      type: "customer.subscription.updated",
      created: Math.floor(NOW.getTime() / 1000),
      data: {
        object: {
          id: "sub_none",
          status: "active",
          items: { data: [] },
          customer_email: "buyer@example.com"
        }
      }
    } as unknown as Stripe.Event;

    const outcome = await ingestStripeEvent(testDb.db, event, {
      now: () => NOW,
      apply: vi.fn().mockResolvedValue([])
    });

    expect(outcome).toBe("processed");
    const [row] = await testDb.db.select().from(schema.billingEventInbox);
    expect(row.status).toBe("processed");
    expect(JSON.stringify(row.payload)).not.toContain("buyer@example.com");
    expect(JSON.stringify(row.payload)).toContain("sub_none");
  });

  it("never retains payload PII or free-form error text on a failed row", async () => {
    const event = {
      id: "evt_failed_minimized",
      type: "customer.subscription.updated",
      created: Math.floor(NOW.getTime() / 1000),
      data: {
        object: {
          id: "sub_failed",
          status: "active",
          customer_email: "failed-buyer@example.com",
          description: "private account note",
          items: { data: [{ current_period_end: 1_725_000_000 }] }
        }
      }
    } as unknown as Stripe.Event;

    const outcome = await ingestStripeEvent(testDb.db, event, {
      now: () => NOW,
      apply: vi.fn().mockRejectedValue(
        new Error("failed-buyer@example.com could not be processed")
      )
    });

    expect(outcome).toBe("failed");
    const [row] = await testDb.db.select().from(schema.billingEventInbox);
    expect(row.status).toBe("failed");
    expect(row.lastError).toBe("Error");
    const serialized = JSON.stringify(row.payload);
    expect(serialized).toContain('"_pal_minimized":1');
    expect(serialized).toContain("sub_failed");
    expect(serialized).not.toContain("failed-buyer@example.com");
    expect(serialized).not.toContain("private account note");
  });
});
