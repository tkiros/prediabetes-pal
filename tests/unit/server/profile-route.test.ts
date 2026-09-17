import { eq } from "drizzle-orm";
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

import {
  createProfilePatchHandler,
  createProfileRouteHandlers
} from "../../../app/api/profile/route";
import { OrientationStateSchema } from "../../../lib/coach/orientation";
import { decryptField, encryptField } from "../../../lib/server/crypto";
import { schema } from "../../../lib/server/db";
import { createTestDb } from "../../helpers/test-db";

const TEST_KEY = Buffer.alloc(32, 9).toString("base64");

let testDb: Awaited<ReturnType<typeof createTestDb>>;
let userId: string;

beforeAll(async () => {
  process.env.HEALTH_DATA_KEY = TEST_KEY;
  testDb = await createTestDb();
  const [user] = await testDb.db
    .insert(schema.users)
    .values({ email: "profile@test.dev" })
    .returning();
  userId = user.id;
});

afterAll(async () => {
  delete process.env.HEALTH_DATA_KEY;
  await testDb.close();
});

beforeEach(async () => {
  await testDb.db
    .delete(schema.pushSubscriptions)
    .where(eq(schema.pushSubscriptions.userId, userId));
  await testDb.db
    .delete(schema.profiles)
    .where(eq(schema.profiles.userId, userId));
});

function handlersAs(sessionUserId: string | null) {
  return createProfileRouteHandlers({
    db: () => testDb.db,
    getSession: async () =>
      sessionUserId ? { userId: sessionUserId, email: "profile@test.dev" } : null
  });
}

function postRequest(body: unknown) {
  return new Request("http://test/api/profile", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}

function patchRequest(body: unknown) {
  return new Request("http://test/api/profile", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}

describe("POST /api/profile", () => {
  it("rejects unauthenticated requests", async () => {
    const { POST } = handlersAs(null);
    const response = await POST(
      postRequest({ a1c: 6.1, consent: true, timezone: "America/New_York" })
    );

    expect(response.status).toBe(401);
  });

  it("refuses to create a profile without explicit consent", async () => {
    const { POST } = handlersAs(userId);
    const response = await POST(
      postRequest({ a1c: 6.1, consent: false, timezone: "America/New_York" })
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toMatch(/consent/i);
  });

  it("returns boundary guidance (never a verdict) for out-of-range A1C", async () => {
    const { POST } = handlersAs(userId);
    const response = await POST(
      postRequest({ a1c: 7.2, consent: true, timezone: "America/New_York" })
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toMatch(
      /range clinicians use when evaluating Type 2 diabetes/i
    );
  });

  it("creates the profile with encrypted A1C, band, timezone, consent stamp", async () => {
    const { POST } = handlersAs(userId);
    const response = await POST(
      postRequest({ a1c: 6.1, consent: true, timezone: "America/Denver" })
    );

    expect(response.status).toBe(200);

    const [row] = await testDb.db
      .select()
      .from(schema.profiles)
      .where(eq(schema.profiles.userId, userId));

    expect(row.a1cBand).toBe("prediabetes_60_62");
    expect(row.timezone).toBe("America/Denver");
    expect(row.consentedAt).toBeTruthy();
    expect(row.onboardedAt).toBeTruthy();
    // encrypted at rest; decrypts to the exact value for the owner
    expect(row.a1cCiphertext).not.toContain("6.1");
    expect(decryptField(row.a1cCiphertext)).toBe("6.1");
  });

  it("updates the existing profile on re-submit (idempotent upsert)", async () => {
    const { POST } = handlersAs(userId);
    await POST(postRequest({ a1c: 6.1, consent: true, timezone: "UTC" }));
    const response = await POST(
      postRequest({ a1c: 6.3, consent: true, timezone: "UTC" })
    );

    expect(response.status).toBe(200);

    const rows = await testDb.db
      .select()
      .from(schema.profiles)
      .where(eq(schema.profiles.userId, userId));

    expect(rows).toHaveLength(1);
    expect(rows[0].a1cBand).toBe("prediabetes_63_64");
  });
});

describe("GET /api/profile", () => {
  it("returns hasProfile=false before creation", async () => {
    const { GET } = handlersAs(userId);
    const response = await GET();

    expect(await response.json()).toMatchObject({ hasProfile: false });
  });

  it("returns coarse profile data — never the exact A1C", async () => {
    const { POST, GET } = handlersAs(userId);
    await POST(postRequest({ a1c: 6.1, consent: true, timezone: "UTC" }));

    const response = await GET();
    const body = await response.json();

    expect(body).toMatchObject({
      hasProfile: true,
      a1cBand: "prediabetes_60_62",
      nudgeOptIn: false
    });
    expect(JSON.stringify(body)).not.toContain("6.1");
  });

  it("401s when signed out", async () => {
    const { GET } = handlersAs(null);
    const response = await GET();

    expect(response.status).toBe(401);
  });
});

describe("PATCH /api/profile", () => {
  it("cancels pending nudge state when preferences change", async () => {
    const { POST } = handlersAs(userId);
    await POST(postRequest({ a1c: 6.1, consent: true, timezone: "UTC" }));
    await testDb.db.insert(schema.pushSubscriptions).values({
      userId,
      endpoint: "https://push.example/profile-prefs",
      p256dh: "key",
      auth: "auth",
      lastNudgeDate: "2026-07-02",
      nudgeAttemptDate: "2026-07-03",
      nudgeAttemptCount: 1,
      nudgeRetryAfter: new Date("2026-07-03T16:00:00.000Z")
    });
    const PATCH = createProfilePatchHandler({
      db: () => testDb.db,
      getSession: async () => ({
        userId,
        email: "profile@test.dev"
      })
    });

    const response = await PATCH(
      patchRequest({ nudgeOptIn: false, nudgeCadence: "weekly" })
    );

    expect(response.status).toBe(200);
    const [profile] = await testDb.db
      .select()
      .from(schema.profiles)
      .where(eq(schema.profiles.userId, userId));
    expect(profile.nudgeOptIn).toBe(false);
    expect(profile.nudgeCadence).toBe("weekly");
    const [subscription] = await testDb.db
      .select()
      .from(schema.pushSubscriptions)
      .where(eq(schema.pushSubscriptions.userId, userId));
    expect(subscription.lastNudgeDate).toBe("2026-07-02");
    expect(subscription.nudgeAttemptDate).toBeNull();
    expect(subscription.nudgeAttemptCount).toBe(0);
    expect(subscription.nudgeRetryAfter).toBeNull();
  });

  it("leaves an in-flight (live-lease) attempt untouched so its `ok` can finalize", async () => {
    const { POST } = handlersAs(userId);
    await POST(postRequest({ a1c: 6.1, consent: true, timezone: "UTC" }));
    const liveLeaseUntil = new Date(Date.now() + 5 * 60 * 1000);
    await testDb.db.insert(schema.pushSubscriptions).values({
      userId,
      endpoint: "https://push.example/profile-live-lease",
      p256dh: "key",
      auth: "auth",
      nudgeAttemptDate: "2026-07-03",
      nudgeAttemptCount: 1,
      nudgeLeaseToken: "00000000-0000-4000-8000-000000000004",
      nudgeLeaseUntil: liveLeaseUntil
    });
    const PATCH = createProfilePatchHandler({
      db: () => testDb.db,
      getSession: async () => ({
        userId,
        email: "profile@test.dev"
      })
    });

    const response = await PATCH(patchRequest({ nudgeCadence: "weekly" }));

    expect(response.status).toBe(200);
    const [subscription] = await testDb.db
      .select()
      .from(schema.pushSubscriptions)
      .where(eq(schema.pushSubscriptions.userId, userId));
    // The old clear was lease-blind: it wiped the token mid-send, so a
    // delivered `ok` finalized against zero rows and was recorded failed.
    expect(subscription.nudgeLeaseToken).toBe("00000000-0000-4000-8000-000000000004");
    expect(subscription.nudgeLeaseUntil).toEqual(liveLeaseUntil);
    expect(subscription.nudgeAttemptDate).toBe("2026-07-03");
    expect(subscription.nudgeAttemptCount).toBe(1);
  });
});

describe("orientation (F-ORIENT, signed-in state in profiles.orientation)", () => {
  const PAST_START = "2026-09-01T08:00:00.000Z";

  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_GUIDE_DOOR", "orient");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  const PATCH = createProfilePatchHandler({
    db: () => testDb.db,
    getSession: async () => ({ userId, email: "profile@test.dev" })
  });

  async function seedProfile() {
    await testDb.db.insert(schema.profiles).values({
      userId,
      a1cCiphertext: encryptField("6.1"),
      a1cBand: "prediabetes_60_62",
      timezone: "UTC",
      consentedAt: new Date()
    });
  }

  async function storedOrientation() {
    const [row] = await testDb.db
      .select({ orientation: schema.profiles.orientation })
      .from(schema.profiles)
      .where(eq(schema.profiles.userId, userId));
    return row.orientation;
  }

  const patchOrientation = (orientation: unknown) =>
    PATCH(patchRequest({ orientation }));

  it("persists a one-time `set` and GET echoes it", async () => {
    await seedProfile();
    const state = { done: ["1"], dismissedAt: null, startedAt: null };

    const response = await patchOrientation({ op: "set", state });

    expect(response.status).toBe(200);
    expect(await storedOrientation()).toEqual(state);
    const body = await (await handlersAs(userId).GET()).json();
    expect(body.orientation).toEqual(state);
  });

  it("GET returns orientation null before any write", async () => {
    await seedProfile();
    const body = await (await handlersAs(userId).GET()).json();
    expect(body).toMatchObject({ hasProfile: true, orientation: null });
  });

  it.each([
    ["unset", ""],
    ["a list without orient", "ideas,calm"]
  ])("GET omits the orientation key entirely while the orient surface is off (%s)", async (_label, flag) => {
    vi.stubEnv("NEXT_PUBLIC_GUIDE_DOOR", flag);
    await seedProfile();
    await testDb.db
      .update(schema.profiles)
      .set({ orientation: { done: ["1"], dismissedAt: null, startedAt: null } })
      .where(eq(schema.profiles.userId, userId));

    const body = await (await handlersAs(userId).GET()).json();

    expect(body).not.toHaveProperty("orientation");
    expect(Object.keys(body)).toEqual([
      "hasProfile",
      "a1cBand",
      "timezone",
      "nudgeOptIn",
      "nudgeHour",
      "nudgeCadence",
      "nudgeQuietStart",
      "nudgeQuietEnd"
    ]);
  });

  it.each([
    ["an unknown step in a set", { op: "set", state: { done: ["9"], dismissedAt: null, startedAt: null } }],
    ["an unknown step in markDone", { op: "markDone", step: "9" }],
    ["a bare partial state (no op)", { done: ["9"] }],
    ["a bare full state (no op)", { done: ["1"], dismissedAt: null, startedAt: null }],
    ["an unknown op", { op: "undo", step: "1" }],
    ["duplicate ids", { op: "set", state: { done: ["1", "1"], dismissedAt: null, startedAt: null } }],
    ["a startedAt beyond the 5-minute skew", { op: "set", state: { done: [], dismissedAt: null, startedAt: new Date(Date.now() + 10 * 60 * 1000).toISOString() } }],
    ["an offset timestamp", { op: "set", state: { done: [], dismissedAt: null, startedAt: "2026-09-01T08:00:00+02:00" } }]
  ])("400s %s and writes nothing", async (_label, orientation) => {
    await seedProfile();

    const response = await patchOrientation(orientation);

    expect(response.status).toBe(400);
    expect(await storedOrientation()).toBeNull();
  });

  // Review fix round 1: z.iso.datetime() does not bound fractional digits, so
  // a megabyte of zeros validated and landed in the column.
  const PAST = "2026-09-01T08:00:00";
  it.each([
    ["startedAt", "31 characters", `${PAST}.1234567890Z`],
    ["dismissedAt", "31 characters", `${PAST}.1234567890Z`],
    ["startedAt", "a 1 MB fraction", `${PAST}.${"0".repeat(1_000_000)}Z`],
    ["dismissedAt", "a 1 MB fraction", `${PAST}.${"0".repeat(1_000_000)}Z`]
  ])("400s a set whose %s is %s and writes nothing", async (field, _label, stamp) => {
    await seedProfile();

    const response = await patchOrientation({
      op: "set",
      state: { done: [], dismissedAt: null, startedAt: null, [field]: stamp }
    });

    expect(response.status).toBe(400);
    expect(await storedOrientation()).toBeNull();
  });

  it("accepts 30-character stamps (the length bound's edge)", async () => {
    await seedProfile();
    const stamp = `${PAST}.123456789Z`;
    expect(stamp).toHaveLength(30);

    const response = await patchOrientation({
      op: "set",
      state: { done: [], dismissedAt: stamp, startedAt: stamp }
    });

    expect(response.status).toBe(200);
    expect(await storedOrientation()).toEqual({
      done: [],
      dismissedAt: stamp,
      startedAt: stamp
    });
  });

  it("accepts a startedAt inside the 5-minute clock skew", async () => {
    await seedProfile();
    const startedAt = new Date(Date.now() + 60 * 1000).toISOString();

    const response = await patchOrientation({
      op: "set",
      state: { done: [], dismissedAt: null, startedAt }
    });

    expect(response.status).toBe(200);
    expect(await storedOrientation()).toMatchObject({ startedAt });
  });

  it("refuses `set` once the row already has state (409) and keeps it", async () => {
    await seedProfile();
    await patchOrientation({ op: "markDone", step: "2" });

    const response = await patchOrientation({
      op: "set",
      state: { done: ["1"], dismissedAt: null, startedAt: null }
    });

    expect(response.status).toBe(409);
    expect(await storedOrientation()).toEqual({
      done: ["2"],
      dismissedAt: null,
      startedAt: null
    });
  });

  it("two concurrent markDone ops both survive", async () => {
    await seedProfile();

    // Fired without awaiting the first: each handler reaches its first DB
    // call before either write lands. A read-then-write handler reads the
    // same empty state twice and the second write drops the first step.
    const responses = await Promise.all([
      patchOrientation({ op: "markDone", step: "1" }),
      patchOrientation({ op: "markDone", step: "2" })
    ]);

    expect(responses.map((response) => response.status)).toEqual([200, 200]);
    const stored = await storedOrientation();
    expect([...(stored?.done ?? [])].sort()).toEqual(["1", "2"]);
  });

  it("a concurrent start and markDone both survive", async () => {
    await seedProfile();

    const responses = await Promise.all([
      patchOrientation({ op: "start" }),
      patchOrientation({ op: "markDone", step: "3" })
    ]);

    expect(responses.map((response) => response.status)).toEqual([200, 200]);
    const stored = await storedOrientation();
    expect(stored?.done).toEqual(["3"]);
    expect(stored?.startedAt).not.toBeNull();
  });

  it("markDone is idempotent (no duplicate ids)", async () => {
    await seedProfile();

    await patchOrientation({ op: "markDone", step: "4" });
    await patchOrientation({ op: "markDone", step: "4" });

    expect(await storedOrientation()).toEqual({
      done: ["4"],
      dismissedAt: null,
      startedAt: null
    });
  });

  it("start stamps a schema-valid server time on an empty row", async () => {
    await seedProfile();
    const before = Date.now();

    const response = await patchOrientation({ op: "start" });

    expect(response.status).toBe(200);
    const stored = OrientationStateSchema.parse(await storedOrientation());
    // The toISOString() shape — well inside the 30-character `set` bound.
    expect(stored.startedAt).toHaveLength(24);
    const stamp = Date.parse(stored.startedAt ?? "");
    expect(stamp).toBeGreaterThanOrEqual(before - 60 * 1000);
    expect(stamp).toBeLessThanOrEqual(Date.now() + 60 * 1000);
  });

  it("a second start does not move the stamp", async () => {
    await seedProfile();
    await patchOrientation({
      op: "set",
      state: { done: ["1"], dismissedAt: null, startedAt: PAST_START }
    });

    const response = await patchOrientation({ op: "start" });

    expect(response.status).toBe(200);
    expect(await storedOrientation()).toEqual({
      done: ["1"],
      dismissedAt: null,
      startedAt: PAST_START
    });
  });

  it("dismiss stamps dismissedAt and restore clears it, keeping done", async () => {
    await seedProfile();
    await patchOrientation({ op: "markDone", step: "5" });

    expect((await patchOrientation({ op: "dismiss" })).status).toBe(200);
    const dismissed = OrientationStateSchema.parse(await storedOrientation());
    expect(dismissed.dismissedAt).not.toBeNull();
    expect(dismissed.done).toEqual(["5"]);

    expect((await patchOrientation({ op: "restore" })).status).toBe(200);
    expect(await storedOrientation()).toEqual({
      done: ["5"],
      dismissedAt: null,
      startedAt: null
    });
  });

  it("an orientation-only PATCH leaves a pending nudge attempt untouched (A-07)", async () => {
    await seedProfile();
    await testDb.db.insert(schema.pushSubscriptions).values({
      userId,
      endpoint: "https://push.example/profile-orientation",
      p256dh: "key",
      auth: "auth",
      lastNudgeDate: "2026-07-02",
      nudgeAttemptDate: "2026-07-03",
      nudgeAttemptCount: 1,
      nudgeRetryAfter: new Date("2026-07-03T16:00:00.000Z")
    });

    const response = await patchOrientation({ op: "markDone", step: "1" });

    expect(response.status).toBe(200);
    const [subscription] = await testDb.db
      .select()
      .from(schema.pushSubscriptions)
      .where(eq(schema.pushSubscriptions.userId, userId));
    expect(subscription.nudgeAttemptDate).toBe("2026-07-03");
    expect(subscription.nudgeAttemptCount).toBe(1);
    expect(subscription.nudgeRetryAfter).toEqual(
      new Date("2026-07-03T16:00:00.000Z")
    );
  });

  it("a mixed nudge + orientation PATCH writes both and still cancels the attempt", async () => {
    await seedProfile();
    await testDb.db.insert(schema.pushSubscriptions).values({
      userId,
      endpoint: "https://push.example/profile-mixed",
      p256dh: "key",
      auth: "auth",
      nudgeAttemptDate: "2026-07-03",
      nudgeAttemptCount: 1
    });

    const response = await PATCH(
      patchRequest({ nudgeHour: 9, orientation: { op: "markDone", step: "6" } })
    );

    expect(response.status).toBe(200);
    const [profile] = await testDb.db
      .select()
      .from(schema.profiles)
      .where(eq(schema.profiles.userId, userId));
    expect(profile.nudgeHour).toBe(9);
    expect(profile.orientation?.done).toEqual(["6"]);
    const [subscription] = await testDb.db
      .select()
      .from(schema.pushSubscriptions)
      .where(eq(schema.pushSubscriptions.userId, userId));
    expect(subscription.nudgeAttemptCount).toBe(0);
  });

  it.each([
    ["markDone", { op: "markDone", step: "1" }],
    ["start", { op: "start" }],
    ["set", { op: "set", state: { done: [], dismissedAt: null, startedAt: null } }]
  ])("404s a %s when the signed-in user has no profile row (A-92)", async (_label, orientation) => {
    const response = await patchOrientation(orientation);

    expect(response.status).toBe(404);
  });

  it("404s a nudge-only PATCH with no profile row and cancels nothing (A-92)", async () => {
    await testDb.db.insert(schema.pushSubscriptions).values({
      userId,
      endpoint: "https://push.example/profile-missing",
      p256dh: "key",
      auth: "auth",
      nudgeAttemptDate: "2026-07-03",
      nudgeAttemptCount: 1
    });

    const response = await PATCH(patchRequest({ nudgeCadence: "weekly" }));

    expect(response.status).toBe(404);
    const [subscription] = await testDb.db
      .select()
      .from(schema.pushSubscriptions)
      .where(eq(schema.pushSubscriptions.userId, userId));
    expect(subscription.nudgeAttemptCount).toBe(1);
  });

  it.each([
    ["unset", ""],
    ["a list without orient", "ideas,calm"]
  ])("404s any orientation PATCH when the orient surface is off (%s)", async (_label, flag) => {
    vi.stubEnv("NEXT_PUBLIC_GUIDE_DOOR", flag);
    await seedProfile();

    const valid = await patchOrientation({ op: "markDone", step: "1" });
    const invalid = await patchOrientation({ op: "markDone", step: "9" });
    const mixed = await PATCH(
      patchRequest({ nudgeHour: 9, orientation: { op: "start" } })
    );

    expect([valid.status, invalid.status, mixed.status]).toEqual([404, 404, 404]);
    const [profile] = await testDb.db
      .select()
      .from(schema.profiles)
      .where(eq(schema.profiles.userId, userId));
    expect(profile.orientation).toBeNull();
    expect(profile.nudgeHour).toBe(11);
  });

  it("nudge-only PATCHes still work with the orient surface off, and still cancel a pending nudge attempt", async () => {
    vi.stubEnv("NEXT_PUBLIC_GUIDE_DOOR", "");
    await seedProfile();
    await testDb.db.insert(schema.pushSubscriptions).values({
      userId,
      endpoint: "https://push.example/profile-flag-off",
      p256dh: "key",
      auth: "auth",
      nudgeAttemptDate: "2026-07-03",
      nudgeAttemptCount: 1
    });

    const response = await PATCH(patchRequest({ nudgeHour: 8 }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    const [profile] = await testDb.db
      .select()
      .from(schema.profiles)
      .where(eq(schema.profiles.userId, userId));
    expect(profile.nudgeHour).toBe(8);
    const [subscription] = await testDb.db
      .select()
      .from(schema.pushSubscriptions)
      .where(eq(schema.pushSubscriptions.userId, userId));
    expect(subscription.nudgeAttemptCount).toBe(0);
  });
});
