import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createPantryClaimHandler } from "../../../app/pantry/claim/route";
import {
  generateClaimToken,
  hashClaimToken
} from "../../../lib/server/pantry/claims";
import { schema } from "../../../lib/server/db";
import { createTestDb } from "../../helpers/test-db";

const NOW = new Date("2026-07-05T12:00:00.000Z");

let testDb: Awaited<ReturnType<typeof createTestDb>>;
let userId: string;
let strangerId: string;

beforeAll(async () => {
  testDb = await createTestDb();
  const [user] = await testDb.db
    .insert(schema.users)
    .values({ email: "claimer@test.dev" })
    .returning();
  const [stranger] = await testDb.db
    .insert(schema.users)
    .values({ email: "stranger@test.dev" })
    .returning();
  userId = user.id;
  strangerId = stranger.id;
});

afterAll(async () => {
  await testDb.close();
});

beforeEach(async () => {
  await testDb.db.delete(schema.pantryOrders);
});

async function makePaidOrder(token: string) {
  const [order] = await testDb.db
    .insert(schema.pantryOrders)
    .values({
      email: "buyer@example.com",
      stripeSessionId: `cs_${Math.random().toString(36).slice(2)}`,
      claimToken: hashClaimToken(token)
    })
    .returning();
  return order;
}

const deps = (uid: string | null) => ({
  db: () => testDb.db,
  getSession: async () =>
    uid ? { userId: uid, email: "claimer@test.dev" } : null,
  now: () => NOW
});

describe("GET /pantry/claim", () => {
  it("redirects an anonymous visitor to signin with a callback back to the claim", async () => {
    const GET = createPantryClaimHandler(deps(null));
    const response = await GET(
      new Request("https://pal.test/pantry/claim?token=abc")
    );
    expect(response.status).toBeGreaterThanOrEqual(302);
    const location = response.headers.get("location") ?? "";
    expect(location).toContain("/signin");
    expect(decodeURIComponent(location)).toContain("/pantry/claim?token=abc");
  });

  it("binds an unclaimed order to the signed-in visitor by token possession", async () => {
    const { token } = generateClaimToken();
    const order = await makePaidOrder(token);
    const GET = createPantryClaimHandler(deps(userId));

    const response = await GET(
      new Request(`https://pal.test/pantry/claim?token=${token}`)
    );

    expect(response.headers.get("location")).toContain("/pantry/intake");
    const [updated] = await testDb.db
      .select()
      .from(schema.pantryOrders)
      .where(eq(schema.pantryOrders.id, order.id));
    expect(updated.userId).toBe(userId);
    expect(updated.status).toBe("claimed");
    expect(updated.claimedAt?.toISOString()).toBe(NOW.toISOString());
  });

  it("never rebinds an order already claimed by someone else", async () => {
    const { token } = generateClaimToken();
    const order = await makePaidOrder(token);
    await testDb.db
      .update(schema.pantryOrders)
      .set({ userId: strangerId, status: "claimed" })
      .where(eq(schema.pantryOrders.id, order.id));

    const GET = createPantryClaimHandler(deps(userId));
    await GET(new Request(`https://pal.test/pantry/claim?token=${token}`));

    const [after] = await testDb.db
      .select()
      .from(schema.pantryOrders)
      .where(eq(schema.pantryOrders.id, order.id));
    expect(after.userId).toBe(strangerId);
  });

  it("a wrong token is a harmless redirect to intake (empty state handles it)", async () => {
    const GET = createPantryClaimHandler(deps(userId));
    const response = await GET(
      new Request("https://pal.test/pantry/claim?token=wrong")
    );
    expect(response.headers.get("location")).toContain("/pantry/intake");
  });
});
