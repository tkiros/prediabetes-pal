import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { PalModelClient } from "../../../lib/pal/openai-client";
import { decryptField, encryptField } from "../../../lib/server/crypto";
import { schema } from "../../../lib/server/db";
import {
  processPantryOrder,
  type PantryReport
} from "../../../lib/server/pantry/process";
import { createTestDb } from "../../helpers/test-db";

const NOW = new Date("2026-07-07T08:00:00.000Z");

let testDb: Awaited<ReturnType<typeof createTestDb>>;
let userId: string;

beforeAll(async () => {
  process.env.HEALTH_DATA_KEY = Buffer.alloc(32, 11).toString("base64");
  process.env.NEXT_PUBLIC_APP_URL = "https://pal.test";
  testDb = await createTestDb();
  const [user] = await testDb.db
    .insert(schema.users)
    .values({ email: "proc@test.dev" })
    .returning();
  userId = user.id;
});

afterAll(async () => {
  await testDb.close();
});

beforeEach(async () => {
  await testDb.db.delete(schema.pantryOrders);
  await testDb.db.delete(schema.checks);
});

/** Model stub speaking the engine's own output contract — the processor only
 *  ever sees checkFood()'s response, so this exercises the REAL postprocess
 *  floors on the way through. */
function modelReturning(risk: "SAFE" | "MODERATE" | "HIGH"): PalModelClient {
  return {
    generate: vi.fn().mockResolvedValue({
      kind: "result",
      risk,
      reason: "This is a steady choice for most meals.",
      adjustment: risk === "SAFE" ? null : "Have it after protein.",
      swap: risk === "SAFE" ? null : "Choose whole-grain bread instead.",
      question: null,
      examples: [],
      policy_flags: risk === "SAFE" ? ["safe_food"] : ["borderline"]
    })
  };
}

const failingModel: PalModelClient = {
  generate: vi.fn().mockRejectedValue(new Error("model down"))
};

async function makeProcessingOrder(itemNames: string[]) {
  const [order] = await testDb.db
    .insert(schema.pantryOrders)
    .values({
      email: "buyer@example.com",
      stripeSessionId: `cs_${Math.random().toString(36).slice(2)}`,
      claimToken: `hash_${Math.random().toString(36).slice(2)}`,
      userId,
      status: "processing",
      a1cBand: "prediabetes_60_62",
      consentedAt: NOW
    })
    .returning();
  await testDb.db.insert(schema.pantryItems).values(
    itemNames.map((name, position) => ({
      orderId: order.id,
      position,
      nameCiphertext: encryptField(name),
      source: "buyer" as const,
      status: "confirmed" as const
    }))
  );
  await testDb.db.insert(schema.pantryPhotos).values({
    orderId: order.id,
    blobUrl: "https://blob.test/photo1.jpg",
    status: "extracted"
  });
  return order;
}

function makeDeps(model: PalModelClient) {
  return {
    db: testDb.db,
    model,
    email: { send: vi.fn().mockResolvedValue({ ok: true }) },
    deleteBlobs: vi.fn().mockResolvedValue(undefined),
    now: () => NOW
  };
}

describe("processPantryOrder", () => {
  it("judges every confirmed item through checkFood, assembles the report, delivers, deletes photos", async () => {
    const order = await makeProcessingOrder(["steel cut oats", "white bread"]);
    const deps = makeDeps(modelReturning("MODERATE"));

    const result = await processPantryOrder(deps, order.id);

    expect(result.done).toBe(true);
    const [updated] = await testDb.db
      .select()
      .from(schema.pantryOrders)
      .where(eq(schema.pantryOrders.id, order.id));
    expect(updated.status).toBe("ready");
    expect(updated.deliveredAt?.toISOString()).toBe(NOW.toISOString());

    const report = JSON.parse(
      decryptField(updated.reportCiphertext!)
    ) as PantryReport;
    expect(report.counts.moderate).toBe(2);
    expect(report.sections.moderate[0].name).toBe("steel cut oats");
    expect(report.disclaimer.length).toBeGreaterThan(0);

    const items = await testDb.db
      .select()
      .from(schema.pantryItems)
      .where(eq(schema.pantryItems.orderId, order.id));
    expect(items.every((item) => item.status === "judged")).toBe(true);
    expect(items.every((item) => item.risk === "MODERATE")).toBe(true);

    expect(deps.email.send).toHaveBeenCalledTimes(1);
    expect(deps.email.send.mock.calls[0][0].to).toBe("buyer@example.com");
    expect(deps.email.send.mock.calls[0][0].text).toContain(`/report/${order.id}`);
    expect(deps.deleteBlobs).toHaveBeenCalledWith(["https://blob.test/photo1.jpg"]);

    const photos = await testDb.db
      .select()
      .from(schema.pantryPhotos)
      .where(eq(schema.pantryPhotos.orderId, order.id));
    expect(photos.every((photo) => photo.status === "deleted")).toBe(true);
  });

  it("NEVER writes pantry judgments into the checks table", async () => {
    const order = await makeProcessingOrder(["steel cut oats"]);
    await processPantryOrder(makeDeps(modelReturning("SAFE")), order.id);
    expect(await testDb.db.select().from(schema.checks)).toHaveLength(0);
  });

  it("continue-on-failure: a twice-failing item is marked failed, the report still ships", async () => {
    const order = await makeProcessingOrder(["good item", "bad item"]);
    const model: PalModelClient = {
      generate: vi.fn().mockImplementation(async (prompt: { input: string }) => {
        if (JSON.stringify(prompt).includes("bad item")) {
          throw new Error("model down");
        }
        return {
          kind: "result",
          risk: "SAFE",
          reason: "This is a steady choice.",
          adjustment: null,
          swap: null,
          question: null,
          examples: [],
          policy_flags: ["safe_food"]
        };
      })
    };
    const deps = makeDeps(model);

    const result = await processPantryOrder(deps, order.id);

    expect(result.done).toBe(true);
    const items = await testDb.db
      .select()
      .from(schema.pantryItems)
      .where(eq(schema.pantryItems.orderId, order.id));
    const statuses = items.map((item) => item.status).sort();
    expect(statuses).toEqual(["failed", "judged"]);
    const failed = items.find((item) => item.status === "failed");
    expect(failed?.attempts).toBe(2); // exactly one retry
    const [updated] = await testDb.db
      .select()
      .from(schema.pantryOrders)
      .where(eq(schema.pantryOrders.id, order.id));
    const report = JSON.parse(decryptField(updated.reportCiphertext!)) as PantryReport;
    expect(report.counts.failed).toBe(1);
    expect(report.sections.failed[0].name).toBe("bad item");
  });

  it("ALL items failing → needs_manual, founder alerted, NO buyer email", async () => {
    const order = await makeProcessingOrder(["only item"]);
    const deps = makeDeps(failingModel);

    const result = await processPantryOrder(deps, order.id);

    expect(result.done).toBe(true);
    const [updated] = await testDb.db
      .select()
      .from(schema.pantryOrders)
      .where(eq(schema.pantryOrders.id, order.id));
    expect(updated.status).toBe("needs_manual");
    expect(updated.deliveredAt).toBeNull();
    expect(deps.email.send).toHaveBeenCalledTimes(1);
    expect(deps.email.send.mock.calls[0][0].to).not.toBe("buyer@example.com");
    // needs_manual is terminal for the photos (N-23): manual handling re-judges
    // item TEXT, never photos, so retaining them would only break the promise.
    // (This assertion previously required the opposite — that was the bug.)
    expect(deps.deleteBlobs).toHaveBeenCalledWith([
      "https://blob.test/photo1.jpg"
    ]);
    const [photo] = await testDb.db
      .select()
      .from(schema.pantryPhotos)
      .where(eq(schema.pantryPhotos.orderId, order.id));
    expect(photo.status).toBe("deleted");
  });

  it("a Blob-API outage at delivery does NOT mark the photos deleted (they are still live)", async () => {
    const order = await makeProcessingOrder(["steel cut oats"]);
    const deps = {
      ...makeDeps(modelReturning("SAFE")),
      deleteBlobs: vi.fn().mockRejectedValue(new Error("blob api down"))
    };

    await processPantryOrder(deps, order.id);

    const [updated] = await testDb.db
      .select()
      .from(schema.pantryOrders)
      .where(eq(schema.pantryOrders.id, order.id));
    expect(updated.status).toBe("ready");
    expect(updated.deliveredAt).not.toBeNull(); // the buyer still got the report
    const [photo] = await testDb.db
      .select()
      .from(schema.pantryPhotos)
      .where(eq(schema.pantryPhotos.orderId, order.id));
    // Marking this "deleted" would orphan a live public object forever — every
    // retry path skips deleted rows. It stays claimable by the sweep's GC.
    expect(photo.status).not.toBe("deleted");
  });

  it("lease contention: a live lease blocks a second run (no double-processing)", async () => {
    const order = await makeProcessingOrder(["item"]);
    await testDb.db
      .update(schema.pantryOrders)
      .set({ processingLeaseUntil: new Date(NOW.getTime() + 300_000) })
      .where(eq(schema.pantryOrders.id, order.id));
    const deps = makeDeps(modelReturning("SAFE"));

    const result = await processPantryOrder(deps, order.id);

    expect(result.done).toBe(false);
    expect(deps.email.send).not.toHaveBeenCalled();
  });

  it("an EXPIRED lease is claimable (sweep resume path)", async () => {
    const order = await makeProcessingOrder(["item"]);
    await testDb.db
      .update(schema.pantryOrders)
      .set({ processingLeaseUntil: new Date(NOW.getTime() - 1000) })
      .where(eq(schema.pantryOrders.id, order.id));

    const result = await processPantryOrder(makeDeps(modelReturning("SAFE")), order.id);
    expect(result.done).toBe(true);
  });

  it("budget exhaustion: exits cleanly, releases the lease, items stay confirmed", async () => {
    const order = await makeProcessingOrder(["item a", "item b"]);
    const deps = makeDeps(modelReturning("SAFE"));

    const result = await processPantryOrder(deps, order.id, 0);

    expect(result.done).toBe(false);
    const [updated] = await testDb.db
      .select()
      .from(schema.pantryOrders)
      .where(eq(schema.pantryOrders.id, order.id));
    expect(updated.status).toBe("processing");
    expect(updated.processingLeaseUntil).toBeNull();
    const items = await testDb.db
      .select()
      .from(schema.pantryItems)
      .where(eq(schema.pantryItems.orderId, order.id));
    expect(items.every((item) => item.status === "confirmed")).toBe(true);
  });

  it("report-email failure: order is ready but NOT delivered; photos kept for the sweep retry", async () => {
    const order = await makeProcessingOrder(["item"]);
    const deps = {
      ...makeDeps(modelReturning("SAFE")),
      email: { send: vi.fn().mockResolvedValue({ ok: false, status: 500 }) }
    };

    await processPantryOrder(deps, order.id);

    const [updated] = await testDb.db
      .select()
      .from(schema.pantryOrders)
      .where(eq(schema.pantryOrders.id, order.id));
    expect(updated.status).toBe("ready");
    expect(updated.deliveredAt).toBeNull();
    expect(deps.deleteBlobs).not.toHaveBeenCalled();
  });
});
