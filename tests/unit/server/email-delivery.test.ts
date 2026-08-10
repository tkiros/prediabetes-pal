import type { WebhookEventPayload } from "resend";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from "vitest";

import { createResendWebhookHandler } from "../../../app/api/webhooks/resend/route";
import { schema } from "../../../lib/server/db";
import {
  EMAIL_DELIVERY_RETENTION_MS,
  pruneExpiredEmailAttempts,
  recordResendWebhookEvent
} from "../../../lib/server/email-delivery";
import { sendEmail } from "../../../lib/server/email";
import { createTestDb } from "../../helpers/test-db";

const NOW = new Date("2026-07-22T16:00:00.000Z");
const AUTH_SECRET = "email-delivery-hmac-test-secret";

let testDb: Awaited<ReturnType<typeof createTestDb>>;

beforeAll(async () => {
  testDb = await createTestDb();
});

afterAll(async () => {
  await testDb.close();
});

beforeEach(async () => {
  process.env.AUTH_SECRET = AUTH_SECRET;
  process.env.RESEND_API_KEY = "re_test_key";
  process.env.RESEND_WEBHOOK_SECRET = "whsec_test";
  await testDb.db.delete(schema.emailDeliveryAttempts);
  await testDb.db.delete(schema.emailSuppressions);
});

afterEach(() => {
  delete process.env.AUTH_SECRET;
  delete process.env.RESEND_API_KEY;
  delete process.env.RESEND_WEBHOOK_SECRET;
});

function response(
  status: number,
  body: Record<string, unknown>
): Pick<Response, "ok" | "status" | "json"> {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body
  };
}

function event(
  type: WebhookEventPayload["type"],
  createdAt: Date,
  extra: Record<string, unknown> = {},
  emailId = "email_1"
): WebhookEventPayload {
  return {
    type,
    created_at: createdAt.toISOString(),
    data: {
      email_id: emailId,
      created_at: createdAt.toISOString(),
      from: "Prediabetes Pal <signin@contact.prediabetespal.com>",
      to: ["buyer@example.com"],
      subject: "private subject",
      ...extra
    }
  } as WebhookEventPayload;
}

describe("tracked Resend send", () => {
  it("stores only hashed metadata, correlates the provider id, and dedupes a retry", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(response(200, { id: "email_1" }));
    const input = {
      to: "buyer@example.com",
      subject: "Your private report",
      text: "private body and token",
      category: "pantry_report" as const,
      idempotencyKey: "pantry-report/order-1"
    };

    expect(
      await sendEmail(input, {
        db: testDb.db,
        now: () => NOW,
        fetchImpl: fetchImpl as unknown as typeof fetch
      })
    ).toEqual({ ok: true });

    const [row] = await testDb.db.select().from(schema.emailDeliveryAttempts);
    expect(row).toMatchObject({
      providerMessageId: "email_1",
      category: "pantry_report",
      status: "accepted"
    });
    expect(row.recipientHash).toMatch(/^[a-f0-9]{64}$/);
    const stored = JSON.stringify(row);
    expect(stored).not.toContain("buyer@example.com");
    expect(stored).not.toContain("Your private report");
    expect(stored).not.toContain("private body and token");

    const request = fetchImpl.mock.calls[0][1] as RequestInit;
    expect((request.headers as Record<string, string>)["Idempotency-Key"]).toMatch(
      /^revora\/[a-f0-9]{64}$/
    );

    const secondFetch = vi.fn();
    expect(
      await sendEmail(input, {
        db: testDb.db,
        now: () => new Date(NOW.getTime() + 1_000),
        fetchImpl: secondFetch as unknown as typeof fetch
      })
    ).toEqual({ ok: true });
    expect(secondFetch).not.toHaveBeenCalled();
  });

  it("records rate limiting without persisting the provider error message", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      response(429, {
        type: "rate_limit_exceeded",
        message: "buyer@example.com exceeded a private account quota"
      })
    );

    expect(
      await sendEmail(
        { to: "buyer@example.com", subject: "s", text: "t" },
        {
          db: testDb.db,
          now: () => NOW,
          fetchImpl: fetchImpl as unknown as typeof fetch
        }
      )
    ).toEqual({ ok: false, status: 429 });

    const [row] = await testDb.db.select().from(schema.emailDeliveryAttempts);
    expect(row.status).toBe("rate_limited");
    expect(row.lastErrorCode).toBe("rate_limit_exceeded");
    expect(JSON.stringify(row)).not.toContain("buyer@example.com");
  });
});

describe("Resend delivery state machine", () => {
  it("advances accepted → delivered and rejects an older delayed event", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(response(200, { id: "email_1" }));
    await sendEmail(
      { to: "buyer@example.com", subject: "s", text: "t" },
      {
        db: testDb.db,
        now: () => NOW,
        fetchImpl: fetchImpl as unknown as typeof fetch
      }
    );

    const deliveredAt = new Date(NOW.getTime() + 60_000);
    expect(
      await recordResendWebhookEvent(
        testDb.db,
        event("email.delivered", deliveredAt),
        deliveredAt
      )
    ).toBe("updated");
    expect(
      await recordResendWebhookEvent(
        testDb.db,
        event("email.delivery_delayed", NOW),
        deliveredAt
      )
    ).toBe("stale");

    const [row] = await testDb.db.select().from(schema.emailDeliveryAttempts);
    expect(row.status).toBe("delivered");
    expect(row.deliveredAt?.toISOString()).toBe(deliveredAt.toISOString());
  });

  it("durably suppresses a permanent bounce and blocks later sends", async () => {
    const bouncedAt = new Date(NOW.getTime() + 60_000);
    await recordResendWebhookEvent(
      testDb.db,
      event("email.bounced", bouncedAt, {
        bounce: {
          message: "buyer@example.com is invalid",
          type: "Permanent",
          subType: "General"
        }
      }),
      bouncedAt
    );

    const [delivery] = await testDb.db.select().from(schema.emailDeliveryAttempts);
    const [suppression] = await testDb.db.select().from(schema.emailSuppressions);
    expect(delivery.status).toBe("bounced");
    expect(delivery.lastErrorCode).toBe("bounce_permanent_general");
    expect(suppression.reason).toBe("bounced");
    expect(JSON.stringify([delivery, suppression])).not.toContain(
      "buyer@example.com"
    );

    const fetchImpl = vi.fn();
    expect(
      await sendEmail(
        { to: "buyer@example.com", subject: "new", text: "new" },
        {
          db: testDb.db,
          now: () => new Date(bouncedAt.getTime() + 1_000),
          fetchImpl: fetchImpl as unknown as typeof fetch
        }
      )
    ).toEqual({ ok: false, status: 422 });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("does not persist free-form failure reasons from the webhook", async () => {
    await recordResendWebhookEvent(
      testDb.db,
      event(
        "email.failed",
        NOW,
        { failed: { reason: "buyer@example.com hit a private quota" } },
        "email_failed_private"
      ),
      NOW
    );

    const [row] = await testDb.db.select().from(schema.emailDeliveryAttempts);
    expect(row.status).toBe("failed");
    expect(row.lastErrorCode).toBe("failed");
    expect(JSON.stringify(row)).not.toContain("buyer@example.com");
  });

  it("merges an early delivery webhook into the later local send attempt", async () => {
    const deliveredAt = new Date(NOW.getTime() + 500);
    await recordResendWebhookEvent(
      testDb.db,
      event("email.delivered", deliveredAt, {}, "email_early"),
      deliveredAt
    );

    const fetchImpl = vi
      .fn()
      .mockResolvedValue(response(200, { id: "email_early" }));
    expect(
      await sendEmail(
        {
          to: "buyer@example.com",
          subject: "s",
          text: "t",
          category: "auth_magic_link"
        },
        {
          db: testDb.db,
          now: () => new Date(NOW.getTime() + 1_000),
          fetchImpl: fetchImpl as unknown as typeof fetch
        }
      )
    ).toEqual({ ok: true });

    const rows = await testDb.db.select().from(schema.emailDeliveryAttempts);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      providerMessageId: "email_early",
      category: "auth_magic_link",
      status: "delivered"
    });
  });

  it("deletes delivery attempts after 30 days but retains hashed suppressions", async () => {
    const old = new Date(NOW.getTime() - EMAIL_DELIVERY_RETENTION_MS - 1);
    await testDb.db.insert(schema.emailDeliveryAttempts).values({
      providerMessageId: "email_old",
      idempotencyKey: "revora/old",
      recipientHash: "a".repeat(64),
      category: "unknown",
      status: "delivered",
      createdAt: old,
      updatedAt: old,
      expiresAt: old
    });
    await testDb.db.insert(schema.emailSuppressions).values({
      recipientHash: "a".repeat(64),
      reason: "bounced",
      createdAt: old,
      updatedAt: old
    });

    expect(await pruneExpiredEmailAttempts(testDb.db, NOW)).toBe(1);
    expect(await testDb.db.select().from(schema.emailDeliveryAttempts)).toEqual(
      []
    );
    expect(await testDb.db.select().from(schema.emailSuppressions)).toHaveLength(
      1
    );
  });
});

describe("POST /api/webhooks/resend", () => {
  function request(headers: Record<string, string> = {}) {
    return new Request("https://prediabetespal.com/api/webhooks/resend", {
      method: "POST",
      headers,
      body: JSON.stringify({ private: "raw body" })
    });
  }

  it("passes the untouched body and Svix headers to verification", async () => {
    const verify = vi.fn().mockReturnValue(event("email.sent", NOW));
    const POST = createResendWebhookHandler({
      db: () => testDb.db,
      now: () => NOW,
      verify
    });
    const response = await POST(
      request({
        "svix-id": "msg_1",
        "svix-timestamp": "1721664000",
        "svix-signature": "v1,test"
      })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, outcome: "updated" });
    expect(verify).toHaveBeenCalledWith({
      payload: '{"private":"raw body"}',
      headers: {
        id: "msg_1",
        timestamp: "1721664000",
        signature: "v1,test"
      },
      webhookSecret: "whsec_test"
    });
  });

  it("rejects missing headers, bad signatures, and missing configuration", async () => {
    const verify = vi.fn().mockImplementation(() => {
      throw new Error("bad signature");
    });
    const POST = createResendWebhookHandler({
      db: () => testDb.db,
      now: () => NOW,
      verify
    });

    expect((await POST(request())).status).toBe(400);
    expect(
      (
        await POST(
          request({
            "svix-id": "msg_1",
            "svix-timestamp": "1721664000",
            "svix-signature": "v1,bad"
          })
        )
      ).status
    ).toBe(400);

    delete process.env.RESEND_WEBHOOK_SECRET;
    expect((await POST(request())).status).toBe(503);
  });
});
