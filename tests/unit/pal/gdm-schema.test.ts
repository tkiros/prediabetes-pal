import { getTableColumns } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { schema } from "../../../lib/server/db";
import { createTestDb } from "../../helpers/test-db";

let testDb: Awaited<ReturnType<typeof createTestDb>>;
beforeAll(async () => {
  testDb = await createTestDb();
});
afterAll(async () => testDb.close());

describe("GDM tables (PRD §7.4: the profile flag and everything under it is health data)", () => {
  it("both tables are user-scoped, so the export denominator and the cascade see them", () => {
    expect(Object.keys(getTableColumns(schema.gdmProfiles))).toContain("userId");
    expect(Object.keys(getTableColumns(schema.gdmItems))).toContain("userId");
  });

  it("no column could hold plaintext health text, a lab value or a medication", () => {
    const columns = [
      ...Object.keys(getTableColumns(schema.gdmProfiles)),
      ...Object.keys(getTableColumns(schema.gdmItems))
    ];
    expect(columns.sort()).toEqual(
      ["appointmentCiphertext", "bodyCiphertext", "consentedAt", "createdAt", "createdAt", "id", "kind", "updatedAt", "userId", "userId"].sort()
    );
  });

  it("deleting the user cascades to both tables", async () => {
    const [user] = await testDb.db.insert(schema.users).values({ email: "gdm-schema@test.dev" }).returning({ id: schema.users.id });
    await testDb.db.insert(schema.gdmProfiles).values({ userId: user.id, consentedAt: new Date() });
    await testDb.db.insert(schema.gdmItems).values({ userId: user.id, kind: "ask", bodyCiphertext: "v1:x" });
    await testDb.raw.query("DELETE FROM users WHERE id = $1", [user.id]);
    for (const table of ["gdm_profiles", "gdm_items"]) {
      const result = await testDb.raw.query<{ n: number }>(`SELECT count(*)::int AS n FROM ${table} WHERE user_id = $1`, [user.id]);
      expect(result.rows[0].n, table).toBe(0);
    }
  });

  it("kind is a closed set", async () => {
    const [user] = await testDb.db.insert(schema.users).values({ email: "gdm-kind@test.dev" }).returning({ id: schema.users.id });
    await expect(
      testDb.raw.query("INSERT INTO gdm_items (user_id, kind, body_ciphertext) VALUES ($1, 'reading', 'v1:x')", [user.id])
    ).rejects.toThrow();
  });
});
