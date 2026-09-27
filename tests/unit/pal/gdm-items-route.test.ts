// tests/unit/pal/gdm-items-route.test.ts
import fs from "node:fs";
import path from "node:path";

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// G-12: the default reporter's only payload is the tag set captureServerError
// builds (the scrubber redacts every message), so the SDK is observed here.
const captureException = vi.fn();
vi.mock("@sentry/node", () => ({
  captureException: (...args: unknown[]) => captureException(...args),
  flush: vi.fn(() => Promise.resolve(true))
}));

import { createGdmItemsHandlers } from "../../../app/api/gdm/items/route";
import { GDM_COPY } from "../../../lib/pal/gdm/copy";
import { GDM_ITEM_CAP } from "../../../lib/pal/gdm/items";
import { loadSafetyContract } from "../../../lib/pal/safety-contract";
import { schema } from "../../../lib/server/db";
import { listGdmItems } from "../../../lib/server/gdm-items";
import { createTestDb } from "../../helpers/test-db";

let testDb: Awaited<ReturnType<typeof createTestDb>>;
let her: string;
let other: string;

beforeAll(async () => {
  process.env.HEALTH_DATA_KEY = Buffer.alloc(32, 3).toString("base64");
  testDb = await createTestDb();
  const users = await testDb.db
    .insert(schema.users)
    .values([{ email: "gdm-her@test.dev" }, { email: "gdm-other@test.dev" }])
    .returning({ id: schema.users.id });
  [her, other] = users.map((u) => u.id);
  await testDb.db.insert(schema.gdmProfiles).values({ userId: her, consentedAt: new Date() });
});
afterAll(async () => {
  delete process.env.HEALTH_DATA_KEY;
  await testDb.close();
});
beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_GDM_DOOR", "organiser");
  vi.stubEnv("GDM_DOOR_ENABLED", "1");
  captureException.mockClear();
});
afterEach(async () => {
  vi.unstubAllEnvs();
  await testDb.raw.query("DELETE FROM gdm_items");
});

const as = (id: string | null) =>
  createGdmItemsHandlers({ db: () => testDb.db, getSession: async () => (id ? { userId: id, email: "x@test.dev" } : null) });
const req = (method: string, body?: unknown, query = "") =>
  new Request(`http://test/api/gdm/items${query}`, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
const ask = (text: string, note: string | null = null) => ({ kind: "ask", body: { text, note, asked: false, answer: null } });
const rawRows = async () => (await testDb.raw.query<{ body_ciphertext: string }>("SELECT body_ciphertext FROM gdm_items")).rows;
/** Tags of the G-12 events that reached the Sentry SDK (safeDecrypt's own DecryptError events are left out). */
const unreadableEvents = () =>
  captureException.mock.calls
    .map(([, hint]) => (hint as { tags: Record<string, string> }).tags)
    .filter((tags) => tags.errorClass === "GdmItemsUnreadable");

describe("/api/gdm/items", () => {
  it("is inert while the door is closed, needs a session, and needs consent — a session is not consent", async () => {
    vi.stubEnv("GDM_DOOR_ENABLED", "0");
    expect((await as(her).POST(req("POST", ask("Which sheet stands?")))).status).toBe(404);
    vi.stubEnv("GDM_DOOR_ENABLED", "1");
    expect((await as(null).POST(req("POST", ask("Which sheet stands?")))).status).toBe(401);
    expect((await as(other).POST(req("POST", ask("Which sheet stands?")))).status).toBe(403);
    expect(await rawRows()).toHaveLength(0);
  });

  it("stores her words encrypted, returns them only to her, newest first", async () => {
    await as(her).POST(req("POST", ask("Which sheet stands?")));
    await as(her).POST(req("POST", ask("Can I move my snack later?", "I work nights")));
    const rows = await rawRows();
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.body_ciphertext).toMatch(/^v\d+:/);
      expect(row.body_ciphertext).not.toContain("sheet");
    }
    const mine = await (await as(her).GET(req("GET", undefined, "?kind=ask"))).json();
    expect(mine.items.map((item: { body: { text: string } }) => item.body.text)).toEqual([
      "Can I move my snack later?",
      "Which sheet stands?"
    ]);
  });

  it.each([
    ["i have been vomiting since last night, should i still eat", "urgent_symptoms"],
    ["my blood sugar is 48 and im shaky, what now", "possible_hypoglycemia"],
    ["would you start the insulin at this point, or wait", "medication_dosing"],
    ["i make myself throw up after meals", "eating_disorder"]
  ] as const)("the existing clinical routes answer first — and the question is still parked: %s", async (text, route) => {
    const response = await (await as(her).POST(req("POST", ask(text)))).json();
    expect(response.route).toBe(route);
    expect(response.routeCopy).toBe(loadSafetyContract().copy.clinicalRoutes[route]);
    expect(await rawRows()).toHaveLength(1);
  });

  it("anything else gets no card: the fixed line above the list already names the care team", async () => {
    const response = await (await as(her).POST(req("POST", ask("why was my fasting number higher after the same dinner")))).json();
    expect(response).toMatchObject({ route: null, routeCopy: null });
  });

  it("G-11: the contract is read on every ask, before anything is stored — a loader that throws is a 500 and nothing is kept", async () => {
    const handlers = createGdmItemsHandlers({
      db: () => testDb.db,
      getSession: async () => ({ userId: her, email: "x@test.dev" }),
      loadContract: () => {
        throw new Error("Phase 1 dependency missing: expected docs/safety/copy-ledger.md to exist.");
      }
    });
    // An ordinary question, no route: the loader still runs, so a broken ledger
    // fails here, loudly, and not first on the rare question that needs a card.
    const response = await handlers.POST(req("POST", ask("Which sheet stands?")));
    expect(response.status).toBe(500);
    expect(await rawRows()).toHaveLength(0);
    expect(captureException).toHaveBeenCalled();
  });

  it.each([
    [{ kind: "reading", body: { value: "106" } }],
    [{ kind: "ask", body: { text: "x", note: null, asked: false, answer: null, medication: "insulin" } }],
    [{ kind: "ask", body: { text: "y".repeat(501), note: null, asked: false, answer: null } }],
    [{ kind: "ask", body: { text: "", note: null, asked: false, answer: null } }],
    // G-13: `replaces` is valid only with kind "plan".
    [{ ...ask("Which sheet stands?"), replaces: "8c3f6a52-4f0e-4a8e-9d57-2d2f1b8e6c11" }]
  ])("refuses %j and stores nothing", async (body) => {
    expect((await as(her).POST(req("POST", body))).status).toBe(400);
    expect(await rawRows()).toHaveLength(0);
  });

  it("GET refuses a kind that is not a list (a photo has its own route)", async () => {
    expect((await as(her).GET(req("GET", undefined, "?kind=plan_photo"))).status).toBe(400);
    expect((await as(her).GET(req("GET", undefined, ""))).status).toBe(400);
  });

  it("PATCH keeps the answer she was given; DELETE removes only her own row", async () => {
    const { id } = await (await as(her).POST(req("POST", ask("Which sheet stands?")))).json();
    const answered = { text: "Which sheet stands?", note: null, asked: true, answer: "The dietitian's." };
    expect((await as(her).PATCH(req("PATCH", { id, body: answered }))).status).toBe(200);
    expect((await as(other).DELETE(req("DELETE", undefined, `?id=${id}`))).status).not.toBe(200);
    const mine = await (await as(her).GET(req("GET", undefined, "?kind=ask"))).json();
    expect(mine.items[0].body).toEqual(answered);
    expect((await as(her).DELETE(req("DELETE", undefined, `?id=${id}`))).status).toBe(200);
    expect(await rawRows()).toHaveLength(0);
  });

  it("G-21: another consented user cannot PATCH, DELETE or read her row", async () => {
    const { id } = await (await as(her).POST(req("POST", ask("Which sheet stands?")))).json();
    // `other` consents here, so every refusal below is the userId scope, not the consent gate.
    await testDb.db.insert(schema.gdmProfiles).values({ userId: other, consentedAt: new Date() });
    try {
      const before = await rawRows();
      const overwrite = { text: "Not hers", note: null, asked: true, answer: "Not hers either" };
      expect((await as(other).PATCH(req("PATCH", { id, body: overwrite }))).status).not.toBe(200);
      expect(await rawRows()).toEqual(before);
      expect((await as(other).DELETE(req("DELETE", undefined, `?id=${id}`))).status).toBe(404);
      expect(await rawRows()).toEqual(before);
      expect(await (await as(other).GET(req("GET", undefined, "?kind=ask"))).json()).toEqual({ items: [] });
      const mine = await (await as(her).GET(req("GET", undefined, "?kind=ask"))).json();
      expect(mine.items.map((item: { body: { text: string } }) => item.body.text)).toEqual(["Which sheet stands?"]);
    } finally {
      await testDb.raw.query("DELETE FROM gdm_profiles WHERE user_id = $1", [other]);
    }
  });

  it("caps a kind, so the list cannot be used as free storage — and says so truthfully (G-14)", async () => {
    await testDb.raw.query(
      `INSERT INTO gdm_items (user_id, kind, body_ciphertext) SELECT $1, 'ask', 'v1:x' FROM generate_series(1, ${GDM_ITEM_CAP})`,
      [her]
    );
    const response = await as(her).POST(req("POST", ask("One more")));
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: GDM_COPY["gdm-list-full"].line, route: null, routeCopy: null });
  });

  it("R46: a full list still answers a clinical question with its card — nothing is stored", async () => {
    await testDb.raw.query(
      `INSERT INTO gdm_items (user_id, kind, body_ciphertext) SELECT $1, 'ask', 'v1:x' FROM generate_series(1, ${GDM_ITEM_CAP})`,
      [her]
    );
    const response = await as(her).POST(req("POST", ask("my blood sugar is 48 and im shaky, what now")));
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: GDM_COPY["gdm-list-full"].line,
      route: "possible_hypoglycemia",
      routeCopy: loadSafetyContract().copy.clinicalRoutes.possible_hypoglycemia
    });
    expect(await rawRows()).toHaveLength(GDM_ITEM_CAP);
  });

  it("no model call on this path (PRD §6.2 acceptance)", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "app/api/gdm/items/route.ts"), "utf8");
    expect(source).not.toMatch(/openai|model-id|\/pal\/service|generate\(/);
  });
});

describe("listGdmItems — a row left out must reach somebody (G-12)", () => {
  it("leaves out a row that will not decrypt, and reports the kind and a count once — never an id, never content", async () => {
    await as(her).POST(req("POST", ask("Which sheet stands?")));
    await testDb.raw.query("INSERT INTO gdm_items (user_id, kind, body_ciphertext) VALUES ($1, 'ask', 'v1:x')", [her]);
    const report = vi.fn();
    const items = await listGdmItems<{ text: string }>(testDb.db, her, "ask", report);
    expect(items.map((item) => item.body.text)).toEqual(["Which sheet stands?"]);
    expect(report).toHaveBeenCalledTimes(1);
    expect(report).toHaveBeenCalledWith({ kind: "ask", unreadable: 1 });
  });

  it("a clean list reports nothing", async () => {
    await as(her).POST(req("POST", ask("Which sheet stands?")));
    const report = vi.fn();
    expect(await listGdmItems(testDb.db, her, "ask", report)).toHaveLength(1);
    expect(report).not.toHaveBeenCalled();
  });

  it("by default the count goes to Sentry through the allowlisted tags only", async () => {
    await testDb.raw.query(
      "INSERT INTO gdm_items (user_id, kind, body_ciphertext) VALUES ($1, 'ask', 'v1:x'), ($1, 'ask', 'v1:y')",
      [her]
    );
    expect(await listGdmItems(testDb.db, her, "ask")).toEqual([]);
    expect(unreadableEvents()).toEqual([{ stage: "route", errorClass: "GdmItemsUnreadable", errorCode: "ask.2" }]);
  });
});
