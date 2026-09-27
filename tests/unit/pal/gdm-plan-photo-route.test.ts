// tests/unit/pal/gdm-plan-photo-route.test.ts
import fs from "node:fs";
import path from "node:path";

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { createGdmPlanPhotoHandlers } from "../../../app/api/gdm/plan-photo/route";
import { createGdmItemsHandlers } from "../../../app/api/gdm/items/route";
import {
  PLAN_PHOTO_CAP,
  PLAN_PHOTO_MAX_BASE64,
  PLAN_PHOTO_MAX_REQUEST_BYTES,
  planPhotoForExport
} from "../../../lib/pal/gdm/plan-photo";
import { UNREADABLE_PLACEHOLDER } from "../../../lib/server/crypto";
import { schema } from "../../../lib/server/db";
import { createTestDb } from "../../helpers/test-db";

const ROOT = process.cwd();

let testDb: Awaited<ReturnType<typeof createTestDb>>;
let her: string;
let other: string;
let stranger: string;

beforeAll(async () => {
  process.env.HEALTH_DATA_KEY = Buffer.alloc(32, 4).toString("base64");
  testDb = await createTestDb();
  const users = await testDb.db
    .insert(schema.users)
    .values([{ email: "gdm-photo-her@test.dev" }, { email: "gdm-photo-other@test.dev" }, { email: "gdm-photo-stranger@test.dev" }])
    .returning({ id: schema.users.id });
  [her, other, stranger] = users.map((u) => u.id);
  // `other` has consented too, so her id reaches the lookup and is simply not found there.
  await testDb.db.insert(schema.gdmProfiles).values([
    { userId: her, consentedAt: new Date() },
    { userId: other, consentedAt: new Date() }
  ]);
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
  await testDb.raw.query("DELETE FROM gdm_items");
});

/** A real 1×1 PNG. */
const PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

const session = (id: string | null) => async () => (id ? { userId: id, email: "x@test.dev" } : null);
const as = (id: string | null) => createGdmPlanPhotoHandlers({ db: () => testDb.db, getSession: session(id) });
const URL_BASE = "http://test/api/gdm/plan-photo";

/** A POST as a browser sends it: a JSON string body with its Content-Length. */
const post = (body: unknown) => {
  const text = JSON.stringify(body);
  return new Request(URL_BASE, {
    method: "POST",
    headers: { "content-type": "application/json", "content-length": String(Buffer.byteLength(text)) },
    body: text
  });
};
const photo = (over: Record<string, unknown> = {}) => ({ mime: "image/png", dataBase64: PNG, ...over });
const get = (query = "") => new Request(`${URL_BASE}${query}`);
const del = (id: string) => new Request(`${URL_BASE}?id=${id}`, { method: "DELETE" });
const rows = async () =>
  (await testDb.raw.query<{ user_id: string; kind: string; body_ciphertext: string }>("SELECT user_id, kind, body_ciphertext FROM gdm_items"))
    .rows;
const added = async (userId = her) => ((await (await as(userId).POST(post(photo()))).json()) as { id: string }).id;

describe("/api/gdm/plan-photo — a photo of her sheet, stored as a photo", () => {
  it("is inert while the door is closed, needs a session, and needs consent — every method", async () => {
    const id = await added();
    vi.stubEnv("GDM_DOOR_ENABLED", "0");
    expect((await as(her).POST(post(photo()))).status).toBe(404);
    expect((await as(her).GET(get(`?id=${id}`))).status).toBe(404);
    expect((await as(her).DELETE(del(id))).status).toBe(404);
    vi.stubEnv("GDM_DOOR_ENABLED", "1");
    expect((await as(null).POST(post(photo()))).status).toBe(401);
    expect((await as(null).GET(get(`?id=${id}`))).status).toBe(401);
    expect((await as(null).DELETE(del(id))).status).toBe(401);
    expect((await as(stranger).POST(post(photo()))).status).toBe(403);
    expect((await as(stranger).GET(get())).status).toBe(403);
    expect((await as(stranger).DELETE(del(id))).status).toBe(403);
    expect(await rows()).toHaveLength(1);
  });

  it("a 1×1 PNG round-trips byte-for-byte, private and never sniffed (G-20)", async () => {
    const response = await as(her).POST(post(photo()));
    expect(response.status).toBe(200);
    const { id } = (await response.json()) as { id: string };
    const shown = await as(her).GET(get(`?id=${id}`));
    expect(shown.status).toBe(200);
    expect(shown.headers.get("content-type")).toBe("image/png");
    expect(shown.headers.get("cache-control")).toBe("private, no-store");
    expect(shown.headers.get("x-content-type-options")).toBe("nosniff");
    expect(Buffer.from(await shown.arrayBuffer()).equals(Buffer.from(PNG, "base64"))).toBe(true);
  });

  it("is stored encrypted, as a plan_photo row: the ciphertext does not carry the base64", async () => {
    await added();
    const [row] = await rows();
    expect(row.kind).toBe("plan_photo");
    expect(row.user_id).toBe(her);
    expect(row.body_ciphertext).toMatch(/^v\d+:/);
    expect(row.body_ciphertext).not.toContain(PNG.slice(0, 24));
  });

  it.each([
    ["an SVG, which can carry script", photo({ mime: "image/svg+xml" })],
    ["any other type", photo({ mime: "image/gif" })],
    ["a body that is not base64", photo({ dataBase64: "<svg onload=alert(1)>" })],
    ["base64 of the wrong length", photo({ dataBase64: "abc" })],
    ["an empty photo", photo({ dataBase64: "" })],
    ["a field the schema does not name", photo({ text: "what the sheet says" })],
    ["no body at all", undefined]
  ])("refuses %s → 400, and stores nothing", async (_label, body) => {
    const request =
      body === undefined ? new Request(URL_BASE, { method: "POST" }) : post(body);
    expect((await as(her).POST(request)).status).toBe(400);
    expect(await rows()).toHaveLength(0);
  });

  it("takes a photo at the length bound, and refuses one character past it → 400", async () => {
    const atBound = "A".repeat(PLAN_PHOTO_MAX_BASE64);
    expect((await as(her).POST(post(photo({ mime: "image/jpeg", dataBase64: atBound })))).status).toBe(200);
    const over = "A".repeat(PLAN_PHOTO_MAX_BASE64 + 4);
    expect((await as(her).POST(post(photo({ mime: "image/jpeg", dataBase64: over })))).status).toBe(400);
    expect(await rows()).toHaveLength(1);
  });

  it("G-20: a declared Content-Length over the bound is refused on the header alone, before the body is read", async () => {
    const text = JSON.stringify(photo());
    const request = new Request(URL_BASE, {
      method: "POST",
      headers: { "content-type": "application/json", "content-length": String(PLAN_PHOTO_MAX_REQUEST_BYTES + 1) },
      body: text
    });
    expect((await as(her).POST(request)).status).toBe(400);
    expect(request.bodyUsed).toBe(false);
    expect(await rows()).toHaveLength(0);
  });

  it("G-20: a body sent without a Content-Length is read only up to the bound", async () => {
    let pulled = 0;
    const chunk = new TextEncoder().encode("A".repeat(64 * 1024));
    const endless = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulled += chunk.byteLength;
        controller.enqueue(chunk);
      }
    });
    const request = new Request(URL_BASE, { method: "POST", body: endless, duplex: "half" } as RequestInit);
    expect(request.headers.get("content-length")).toBeNull();
    expect((await as(her).POST(request)).status).toBe(400);
    expect(pulled).toBeLessThan(PLAN_PHOTO_MAX_REQUEST_BYTES + 4 * chunk.byteLength);
    expect(await rows()).toHaveLength(0);
  });

  it(`keeps at most ${PLAN_PHOTO_CAP} photos: a fourth → 409, and nothing is added`, async () => {
    for (let i = 0; i < PLAN_PHOTO_CAP; i += 1) expect((await as(her).POST(post(photo()))).status).toBe(200);
    expect((await as(her).POST(post(photo()))).status).toBe(409);
    expect(await rows()).toHaveLength(PLAN_PHOTO_CAP);
    // Another account's photos do not count toward hers.
    expect((await as(other).POST(post(photo()))).status).toBe(200);
  });

  it("another user's GET and DELETE of her id → 404, and her photo is untouched", async () => {
    const id = await added();
    expect((await as(other).GET(get(`?id=${id}`))).status).toBe(404);
    expect((await as(other).DELETE(del(id))).status).toBe(404);
    expect((await as(her).GET(get(`?id=${id}`))).status).toBe(200);
    expect(await rows()).toHaveLength(1);
  });

  it("without an id, GET lists only her photo ids, oldest first — never their bytes", async () => {
    const first = await added();
    const second = await added();
    await added(other);
    const response = await as(her).GET(get());
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(JSON.parse(text)).toEqual({ items: [{ id: first }, { id: second }] });
    expect(text).not.toContain(PNG.slice(0, 24));
  });

  it("DELETE removes her photo; a second DELETE, or a GET after it, is a 404", async () => {
    const id = await added();
    expect((await as(her).DELETE(del(id))).status).toBe(200);
    expect(await rows()).toHaveLength(0);
    expect((await as(her).DELETE(del(id))).status).toBe(404);
    expect((await as(her).GET(get(`?id=${id}`))).status).toBe(404);
  });

  it("an id that is not a uuid → 400", async () => {
    expect((await as(her).GET(get("?id=not-a-uuid"))).status).toBe(400);
    expect((await as(her).DELETE(del("not-a-uuid"))).status).toBe(400);
  });

  it("a photo that will not decrypt is a 500, never bytes", async () => {
    const [{ id }] = (
      await testDb.raw.query<{ id: string }>(
        "INSERT INTO gdm_items (user_id, kind, body_ciphertext) VALUES ($1, 'plan_photo', 'v1:x') RETURNING id",
        [her]
      )
    ).rows;
    const response = await as(her).GET(get(`?id=${id}`));
    expect(response.status).toBe(500);
    expect(response.headers.get("content-type")).not.toMatch(/^image\//);
    // A server string the page never shows (the <img> cannot render a body), like the 409's: no bank copy.
    expect(await response.json()).toEqual({ error: "Unreadable." });
  });

  it("R52: only this route deletes a photo — the items route's DELETE of her photo id is a 404, and the photo stays", async () => {
    const id = await added();
    const items = createGdmItemsHandlers({ db: () => testDb.db, getSession: session(her) });
    expect((await items.DELETE(new Request(`http://test/api/gdm/items?id=${id}`, { method: "DELETE" }))).status).toBe(404);
    expect(await rows()).toHaveLength(1);
    expect((await as(her).GET(get(`?id=${id}`))).status).toBe(200);
  });

  it("G-62: the export form of a photo never carries its bytes — not even for a body that has drifted from the schema", () => {
    const size = Buffer.from(PNG, "base64").length;
    expect(planPhotoForExport({ mime: "image/png", dataBase64: PNG })).toEqual({ mime: "image/png", sizeBytes: size });
    expect(planPhotoForExport({ mime: "image/heic", dataBase64: PNG, caption: "x" })).toEqual({
      mime: "image/heic",
      caption: "x",
      sizeBytes: size
    });
    expect(planPhotoForExport({ mime: "image/png", dataBase64: 7 })).toEqual({ mime: "image/png" });
    expect(planPhotoForExport(UNREADABLE_PLACEHOLDER)).toBe(UNREADABLE_PLACEHOLDER);
  });

  it("photo bodies never ride the list endpoint: GET /api/gdm/items?kind=plan_photo → 400", async () => {
    await added();
    const items = createGdmItemsHandlers({ db: () => testDb.db, getSession: session(her) });
    expect((await items.GET(new Request("http://test/api/gdm/items?kind=plan_photo"))).status).toBe(400);
  });

  it("a photo is stored as a photo: no OCR, no model", () => {
    for (const file of ["app/api/gdm/plan-photo/route.ts", "lib/pal/gdm/plan-photo.ts", "lib/client/gdm-photo.ts"]) {
      const source = fs.readFileSync(path.join(ROOT, file), "utf8");
      expect(source, file).not.toMatch(/openai|model-id|\/pal\/service|vision/);
    }
  });
});
