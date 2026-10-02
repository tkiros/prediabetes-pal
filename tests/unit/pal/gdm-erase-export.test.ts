import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createAccountExportHandler } from "../../../app/api/account/export/route";
import { createHealthDataDeleteHandler } from "../../../app/api/account/health-data/route";
import { encryptField } from "../../../lib/server/crypto";
import { schema } from "../../../lib/server/db";
import { createTestDb } from "../../helpers/test-db";

let testDb: Awaited<ReturnType<typeof createTestDb>>;
let userId: string;

beforeAll(async () => {
  process.env.HEALTH_DATA_KEY = Buffer.alloc(32, 6).toString("base64");
  delete process.env.NEXT_PUBLIC_GDM_DOOR; // the door is CLOSED for this whole file
  delete process.env.GDM_DOOR_ENABLED;
  testDb = await createTestDb();
  const [user] = await testDb.db.insert(schema.users).values({ email: "gdm-erase@test.dev" }).returning({ id: schema.users.id });
  userId = user.id;
  await testDb.db.insert(schema.gdmProfiles).values({ userId, consentedAt: new Date(), appointmentCiphertext: encryptField("2026-10-08") });
  await testDb.db.insert(schema.gdmItems).values({
    userId,
    kind: "ask",
    bodyCiphertext: encryptField(JSON.stringify({ text: "Which of my two sheets stands?", note: null, asked: false, answer: null }))
  });
});
afterAll(async () => {
  delete process.env.HEALTH_DATA_KEY;
  await testDb.close();
});

const session = async () => ({ userId, email: "gdm-erase@test.dev" });

describe("a closed door still hands her data back and still erases it", () => {
  it("export carries the GDM profile and items, decrypted", async () => {
    const GET = createAccountExportHandler({ db: () => testDb.db, getSession: session, now: () => new Date("2026-11-01T00:00:00Z") });
    const body = await (await GET()).json();
    expect(body.gdmProfile.appointmentDate).toBe("2026-10-08");
    expect(body.gdmItems).toHaveLength(1);
    expect(body.gdmItems[0]).toMatchObject({ kind: "ask", body: { text: "Which of my two sheets stands?" } });
  });

  it("health-data erase removes both tables, explicitly", async () => {
    const DELETE = createHealthDataDeleteHandler({ db: () => testDb.db, getSession: session, deleteBlobs: async () => {} });
    expect((await DELETE()).status).toBe(200);
    for (const table of ["gdm_profiles", "gdm_items"]) {
      const result = await testDb.raw.query<{ n: number }>(`SELECT count(*)::int AS n FROM ${table} WHERE user_id = $1`, [userId]);
      expect(result.rows[0].n, table).toBe(0);
    }
  });
});
