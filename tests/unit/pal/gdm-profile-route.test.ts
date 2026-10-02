import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { createGdmProfileHandlers } from "../../../app/api/gdm/profile/route";
import { GDM_COPY } from "../../../lib/pal/gdm/copy";
import { schema } from "../../../lib/server/db";
import { createTestDb } from "../../helpers/test-db";

let testDb: Awaited<ReturnType<typeof createTestDb>>;
let userId: string;

beforeAll(async () => {
  process.env.HEALTH_DATA_KEY = Buffer.alloc(32, 5).toString("base64");
  testDb = await createTestDb();
  const [user] = await testDb.db.insert(schema.users).values({ email: "gdm-profile@test.dev" }).returning({ id: schema.users.id });
  userId = user.id;
});
afterAll(async () => {
  delete process.env.HEALTH_DATA_KEY;
  await testDb.close();
});
beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_GDM_DOOR", "organiser");
  vi.stubEnv("GDM_DOOR_ENABLED", "1");
});
afterEach(async () => {
  vi.unstubAllEnvs();
  await testDb.raw.query("DELETE FROM gdm_profiles");
});

const as = (id: string | null) =>
  createGdmProfileHandlers({
    db: () => testDb.db,
    getSession: async () => (id ? { userId: id, email: "gdm-profile@test.dev" } : null)
  });
const post = (body: unknown) =>
  new Request("http://test/api/gdm/profile", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const stored = async () => (await testDb.raw.query<{ appointment_ciphertext: string | null }>("SELECT appointment_ciphertext FROM gdm_profiles")).rows;

describe("POST /api/gdm/profile", () => {
  it("404s while the door is closed — server twin off, or surface off — before anything else", async () => {
    vi.stubEnv("GDM_DOOR_ENABLED", "0");
    expect((await as(userId).POST(post({ told: true, consent: true }))).status).toBe(404);
    vi.stubEnv("GDM_DOOR_ENABLED", "1");
    vi.stubEnv("NEXT_PUBLIC_GDM_DOOR", "landing");
    expect((await as(userId).POST(post({ told: true, consent: true }))).status).toBe(404);
  });

  it("rejects unauthenticated requests", async () => {
    expect((await as(null).POST(post({ told: true, consent: true }))).status).toBe(401);
  });

  it("no consent, no profile, no storage — and says so in approved words", async () => {
    const response = await as(userId).POST(post({ told: true, consent: false }));
    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe(GDM_COPY["gdm-consent-required"].line);
    expect(await stored()).toHaveLength(0);
  });

  it.each([
    [{ told: false, consent: true }],
    [{ consent: true }],
    [{ told: true, consent: true, a1c: 6.1 }],
    [{ told: true, consent: true, medication: "insulin" }],
    [{ told: true, consent: true, appointmentDate: "next tuesday" }]
  ])("refuses %j and stores nothing (strict: no lab value, no medication field exists)", async (body) => {
    expect((await as(userId).POST(post(body))).status).toBe(400);
    expect(await stored()).toHaveLength(0);
  });

  it("stores consent and encrypts the appointment date at rest", async () => {
    expect((await as(userId).POST(post({ told: true, consent: true, appointmentDate: "2026-10-08" }))).status).toBe(200);
    const rows = await stored();
    expect(rows).toHaveLength(1);
    expect(rows[0].appointment_ciphertext).toMatch(/^v\d+:/);
    expect(rows[0].appointment_ciphertext).not.toContain("2026-10-08");
  });

  it("writes consentedAt once — a second POST a moment later leaves it unchanged and updates the date (G-22)", async () => {
    const handlers = as(userId);
    expect((await handlers.POST(post({ told: true, consent: true, appointmentDate: "2026-10-08" }))).status).toBe(200);
    const first = (
      await testDb.raw.query<{ consented_at: string; appointment_ciphertext: string }>(
        "SELECT consented_at, appointment_ciphertext FROM gdm_profiles WHERE user_id = $1",
        [userId]
      )
    ).rows[0];

    await new Promise((resolve) => setTimeout(resolve, 1000));
    expect((await handlers.POST(post({ told: true, consent: true, appointmentDate: "2026-11-01" }))).status).toBe(200);
    const second = (
      await testDb.raw.query<{ consented_at: string; appointment_ciphertext: string }>(
        "SELECT consented_at, appointment_ciphertext FROM gdm_profiles WHERE user_id = $1",
        [userId]
      )
    ).rows[0];

    expect(second.consented_at).toEqual(first.consented_at);
    expect(second.appointment_ciphertext).not.toBe(first.appointment_ciphertext);
  });
});

describe("GET and PATCH /api/gdm/profile", () => {
  it("reads back her own date, and PATCH changes or clears it", async () => {
    expect(await (await as(userId).GET()).json()).toEqual({ hasProfile: false });
    await as(userId).POST(post({ told: true, consent: true, appointmentDate: "2026-10-08" }));
    expect(await (await as(userId).GET()).json()).toEqual({ hasProfile: true, appointmentDate: "2026-10-08" });
    const patch = (body: unknown) =>
      new Request("http://test/api/gdm/profile", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    expect((await as(userId).PATCH(patch({ appointmentDate: null }))).status).toBe(200);
    expect(await (await as(userId).GET()).json()).toEqual({ hasProfile: true, appointmentDate: null });
  });
});
