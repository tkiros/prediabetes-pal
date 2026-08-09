import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { createPantrySubmitHandler } from "../../../app/api/pantry/submit/route";
import { decryptField, encryptField } from "../../../lib/server/crypto";
import { schema } from "../../../lib/server/db";
import { createTestDb } from "../../helpers/test-db";

const NOW = new Date("2026-07-06T09:00:00.000Z");

let testDb: Awaited<ReturnType<typeof createTestDb>>;
let userId: string;

beforeAll(async () => {
  process.env.HEALTH_DATA_KEY = Buffer.alloc(32, 8).toString("base64");
  testDb = await createTestDb();
  const [user] = await testDb.db
    .insert(schema.users)
    .values({ email: "submit@test.dev" })
    .returning();
  userId = user.id;
});

afterAll(async () => {
  await testDb.close();
});

beforeEach(async () => {
  await testDb.db.delete(schema.pantryOrders);
});

async function makeClaimedOrder() {
  const [order] = await testDb.db
    .insert(schema.pantryOrders)
    .values({
      email: "submit@test.dev",
      stripeSessionId: `cs_${Math.random().toString(36).slice(2)}`,
      claimToken: `hash_${Math.random().toString(36).slice(2)}`,
      userId,
      status: "claimed"
    })
    .returning();
  return order;
}

const visionOk = {
  extractFromPhoto: vi.fn().mockResolvedValue([
    { name: "rolled oats", portion: "1 canister" },
    { name: "orange juice", portion: null }
  ])
};

function makeDeps(overrides: Record<string, unknown> = {}) {
  return {
    db: () => testDb.db,
    getSession: async () => ({ userId, email: "submit@test.dev" }),
    vision: () => visionOk,
    email: { send: vi.fn().mockResolvedValue({ ok: true }) },
    rateLimit: async () => ({ ok: true }) as const,
    now: () => NOW,
    ...overrides
  };
}

function submitRequest(body: unknown) {
  return new Request("http://t/api/pantry/submit", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}

function validBody(orderId: string, overrides: Record<string, unknown> = {}) {
  return {
    orderId,
    photoUrls: [
      `https://revora.private.blob.vercel-storage.com/pantry/${orderId}/photo-AbCdEf123456.jpg`,
      `https://revora.private.blob.vercel-storage.com/pantry/${orderId}/photo-ZyXwVu987654.jpg`
    ],
    a1cBand: "prediabetes_60_62",
    notes: "mostly breakfast stuff",
    consent: true,
    ...overrides
  };
}

describe("POST /api/pantry/submit", () => {
  it("stores photos + encrypted intake fields, extracts drafts, moves to awaiting_confirm", async () => {
    const order = await makeClaimedOrder();
    const POST = createPantrySubmitHandler(makeDeps());

    const response = await POST(submitRequest(validBody(order.id)));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("awaiting_confirm");
    // Two photos, two calls, deduped item names across photos.
    expect(body.items.map((item: { name: string }) => item.name)).toEqual([
      "rolled oats",
      "orange juice"
    ]);

    const [updated] = await testDb.db
      .select()
      .from(schema.pantryOrders)
      .where(eq(schema.pantryOrders.id, order.id));
    expect(updated.status).toBe("awaiting_confirm");
    expect(updated.a1cBand).toBe("prediabetes_60_62");
    expect(updated.consentedAt?.toISOString()).toBe(NOW.toISOString());
    expect(updated.a1cCiphertext).not.toBeNull();
    expect(decryptField(updated.a1cCiphertext!)).toBe("6.1");
    expect(updated.notesCiphertext).not.toContain("breakfast");
    expect(decryptField(updated.notesCiphertext!)).toBe("mostly breakfast stuff");

    const photos = await testDb.db
      .select()
      .from(schema.pantryPhotos)
      .where(eq(schema.pantryPhotos.orderId, order.id));
    expect(photos).toHaveLength(2);
    expect(photos.every((photo) => photo.status === "extracted")).toBe(true);

    const items = await testDb.db
      .select()
      .from(schema.pantryItems)
      .where(eq(schema.pantryItems.orderId, order.id));
    expect(items).toHaveLength(2);
    expect(items.every((item) => item.status === "draft")).toBe(true);
    expect(items.every((item) => item.source === "vision")).toBe(true);
    expect(decryptField(items[0].nameCiphertext)).toBe("rolled oats");
  });

  it("rejects an 11th photo server-side", async () => {
    const order = await makeClaimedOrder();
    const POST = createPantrySubmitHandler(makeDeps());
    const response = await POST(
      submitRequest(
        validBody(order.id, {
          photoUrls: Array.from(
            { length: 11 },
            (_, i) =>
              `https://revora.private.blob.vercel-storage.com/pantry/${order.id}/photo-AbCdEf12${String(i).padStart(2, "0")}.jpg`
          )
        })
      )
    );
    expect(response.status).toBe(400);
  });

  it("rejects photo URLs outside the Prediabetes Pal blob store (no arbitrary-fetch relay)", async () => {
    const order = await makeClaimedOrder();
    const POST = createPantrySubmitHandler(makeDeps());
    for (const hostile of [
      "https://evil.example/a.jpg",
      "https://blob.vercel-storage.com.evil.example/a.jpg",
      `https://revora.public.blob.vercel-storage.com/pantry/${order.id}/photo-AbCdEf123456.jpg`,
      `https://revora.private.blob.vercel-storage.com/pantry/${crypto.randomUUID()}/photo-AbCdEf123456.jpg`,
      `http://revora.private.blob.vercel-storage.com/pantry/${order.id}/photo-AbCdEf123456.jpg`
    ]) {
      const response = await POST(
        submitRequest(validBody(order.id, { photoUrls: [hostile] }))
      );
      expect(response.status, hostile).toBe(400);
    }
  });

  it("rejects duplicate photo URLs", async () => {
    const order = await makeClaimedOrder();
    const duplicate = `https://revora.private.blob.vercel-storage.com/pantry/${order.id}/photo-AbCdEf123456.jpg`;
    const POST = createPantrySubmitHandler(makeDeps());

    const response = await POST(
      submitRequest(validBody(order.id, { photoUrls: [duplicate, duplicate] }))
    );

    expect(response.status).toBe(400);
  });

  it("rejects a submit without consent", async () => {
    const order = await makeClaimedOrder();
    const POST = createPantrySubmitHandler(makeDeps());
    const response = await POST(
      submitRequest(validBody(order.id, { consent: false }))
    );
    expect(response.status).toBe(400);
  });

  it("404s another user's order (wrong-user access)", async () => {
    const order = await makeClaimedOrder();
    const POST = createPantrySubmitHandler(
      makeDeps({
        getSession: async () => ({ userId: crypto.randomUUID(), email: "x@y.z" })
      })
    );
    const response = await POST(submitRequest(validBody(order.id)));
    expect(response.status).toBe(404);
  });

  it("429s when the pantry rate limit trips", async () => {
    const order = await makeClaimedOrder();
    const POST = createPantrySubmitHandler(
      makeDeps({
        rateLimit: async () => ({ ok: false, retryAfterSeconds: 60 }) as const
      })
    );
    const response = await POST(submitRequest(validBody(order.id)));
    expect(response.status).toBe(429);
  });

  it("partial extraction: a failed photo is marked, the rest still draft items", async () => {
    const order = await makeClaimedOrder();
    const flaky = {
      extractFromPhoto: vi
        .fn()
        .mockResolvedValueOnce([{ name: "rolled oats", portion: null }])
        .mockRejectedValueOnce(new Error("vision down"))
    };
    const POST = createPantrySubmitHandler(makeDeps({ vision: () => flaky }));

    const response = await POST(submitRequest(validBody(order.id)));
    const body = await response.json();

    expect(body.status).toBe("awaiting_confirm");
    expect(body.failedPhotos).toBe(1);
    const photos = await testDb.db
      .select()
      .from(schema.pantryPhotos)
      .where(eq(schema.pantryPhotos.orderId, order.id));
    expect(photos.map((photo) => photo.status).sort()).toEqual([
      "extracted",
      "failed"
    ]);
  });

  it("total extraction failure: needs_manual + founder alerted, buyer sees the service state", async () => {
    const order = await makeClaimedOrder();
    const dead = {
      extractFromPhoto: vi.fn().mockRejectedValue(new Error("vision down"))
    };
    const email = { send: vi.fn().mockResolvedValue({ ok: true }) };
    const POST = createPantrySubmitHandler(makeDeps({ vision: () => dead, email }));

    const response = await POST(submitRequest(validBody(order.id)));
    const body = await response.json();

    expect(body.status).toBe("needs_manual");
    const [updated] = await testDb.db
      .select()
      .from(schema.pantryOrders)
      .where(eq(schema.pantryOrders.id, order.id));
    expect(updated.status).toBe("needs_manual");
    expect(email.send).toHaveBeenCalledTimes(1);
  });

  it("WS-7: a TRUE concurrent double-submit runs extraction ONCE — loser 409s with zero vision spend", async () => {
    const order = await makeClaimedOrder();
    const vision = {
      extractFromPhoto: vi
        .fn()
        .mockResolvedValue([{ name: "rolled oats", portion: null }])
    };
    const POST = createPantrySubmitHandler(makeDeps({ vision: () => vision }));

    const responses = await Promise.all([
      POST(submitRequest(validBody(order.id))),
      POST(submitRequest(validBody(order.id)))
    ]);
    expect(responses.map((r) => r.status).sort()).toEqual([200, 409]);
    // One winner × two photos — never four.
    expect(vision.extractFromPhoto).toHaveBeenCalledTimes(2);

    const items = await testDb.db
      .select()
      .from(schema.pantryItems)
      .where(eq(schema.pantryItems.orderId, order.id));
    expect(items).toHaveLength(1);
    const photos = await testDb.db
      .select()
      .from(schema.pantryPhotos)
      .where(eq(schema.pantryPhotos.orderId, order.id));
    expect(photos).toHaveLength(2);
  });

  it("WS-7: a fresh extracting lease 409s; a stale one is reclaimed with a clean slate", async () => {
    const order = await makeClaimedOrder();

    // Fresh lease (updatedAt = now): another request is mid-extraction.
    await testDb.db
      .update(schema.pantryOrders)
      .set({ status: "extracting", updatedAt: NOW })
      .where(eq(schema.pantryOrders.id, order.id));
    const fresh = await createPantrySubmitHandler(makeDeps())(
      submitRequest(validBody(order.id))
    );
    expect(fresh.status).toBe(409);

    // Stale lease (crashed run 11 minutes ago) with leftover partial state.
    await testDb.db
      .update(schema.pantryOrders)
      .set({ updatedAt: new Date(NOW.getTime() - 11 * 60_000) })
      .where(eq(schema.pantryOrders.id, order.id));
    await testDb.db.insert(schema.pantryPhotos).values({
      orderId: order.id,
      blobUrl: `https://revora.private.blob.vercel-storage.com/pantry/${order.id}/photo-OldCrash0001.jpg`
    });
    await testDb.db.insert(schema.pantryItems).values({
      orderId: order.id,
      position: 0,
      nameCiphertext: encryptField("stale draft"),
      source: "vision",
      status: "draft"
    });

    const retry = await createPantrySubmitHandler(makeDeps())(
      submitRequest(validBody(order.id))
    );
    expect(retry.status).toBe(200);

    // Clean slate: exactly the retry's photos and items, no crash leftovers.
    const photos = await testDb.db
      .select()
      .from(schema.pantryPhotos)
      .where(eq(schema.pantryPhotos.orderId, order.id));
    expect(photos).toHaveLength(2);
    const items = await testDb.db
      .select()
      .from(schema.pantryItems)
      .where(eq(schema.pantryItems.orderId, order.id));
    expect(items).toHaveLength(2);
    expect(items.map((i) => decryptField(i.nameCiphertext)).sort()).toEqual([
      "orange juice",
      "rolled oats"
    ]);
  });

  it("WS-7 fault injection: a crash between item insert and transition leaves a RECOVERABLE order", async () => {
    const order = await makeClaimedOrder();

    // Fail the first write of the final transaction: once extraction has
    // finished, the next now() call (item timestamps / transition) throws.
    let failAfterExtraction = false;
    const vision = {
      extractFromPhoto: vi.fn().mockImplementation(async () => {
        failAfterExtraction = true;
        return [{ name: "rolled oats", portion: null }];
      })
    };
    let clockCalls = 0;
    const faultyNow = () => {
      if (failAfterExtraction) {
        clockCalls += 1;
        throw new Error("injected fault after extraction");
      }
      return NOW;
    };

    await expect(
      createPantrySubmitHandler(makeDeps({ vision: () => vision, now: faultyNow }))(
        submitRequest(validBody(order.id))
      )
    ).rejects.toThrow("injected fault");
    expect(clockCalls).toBeGreaterThan(0);

    // The transaction rolled back: no half-written items, order still holds
    // the extracting lease (not awaiting_confirm with missing items).
    const [after] = await testDb.db
      .select()
      .from(schema.pantryOrders)
      .where(eq(schema.pantryOrders.id, order.id));
    expect(after.status).toBe("extracting");
    const itemsAfterFault = await testDb.db
      .select()
      .from(schema.pantryItems)
      .where(eq(schema.pantryItems.orderId, order.id));
    expect(itemsAfterFault).toHaveLength(0);

    // Recovery: once the lease is stale, a healthy retry completes end-to-end.
    await testDb.db
      .update(schema.pantryOrders)
      .set({ updatedAt: new Date(NOW.getTime() - 11 * 60_000) })
      .where(eq(schema.pantryOrders.id, order.id));
    const retry = await createPantrySubmitHandler(makeDeps())(
      submitRequest(validBody(order.id))
    );
    expect(retry.status).toBe(200);
    expect((await retry.json()).status).toBe("awaiting_confirm");
  });
});
