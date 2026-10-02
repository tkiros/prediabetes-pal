import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { GDM_COPY } from "../../../lib/pal/gdm/copy";
import { schema, type Db } from "../../../lib/server/db";
import { gdmRouteGuard } from "../../../lib/server/gdm-route";
import { createTestDb } from "../../helpers/test-db";

let testDb: Awaited<ReturnType<typeof createTestDb>>;
let consented: string;
let notConsented: string;

beforeAll(async () => {
  testDb = await createTestDb();
  const users = await testDb.db
    .insert(schema.users)
    .values([{ email: "gdm-guard-yes@test.dev" }, { email: "gdm-guard-no@test.dev" }])
    .returning({ id: schema.users.id });
  [consented, notConsented] = users.map((u) => u.id);
  await testDb.db.insert(schema.gdmProfiles).values({ userId: consented, consentedAt: new Date() });
});
afterAll(async () => {
  await testDb.close();
});
beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_GDM_DOOR", "organiser");
  vi.stubEnv("GDM_DOOR_ENABLED", "1");
  untouchable.mockClear();
});
afterEach(() => {
  vi.unstubAllEnvs();
});

const session = (userId: string | null) => vi.fn(async () => (userId ? { userId, email: "x@test.dev" } : null));
/** A database that must not be reached. */
const untouchable = vi.fn((): Db => {
  throw new Error("the guard read the database when it should not have");
});

describe("gdmRouteGuard — closed → session → consent, in one place (G-16)", () => {
  it("404s while the door is closed — twin off, or the organiser surface off — and looks at neither the session nor the database", async () => {
    const getSession = session(consented);
    vi.stubEnv("GDM_DOOR_ENABLED", "0");
    expect(((await gdmRouteGuard({ db: untouchable, getSession })) as Response).status).toBe(404);
    vi.stubEnv("GDM_DOOR_ENABLED", "1");
    vi.stubEnv("NEXT_PUBLIC_GDM_DOOR", "landing");
    expect(((await gdmRouteGuard({ db: untouchable, getSession })) as Response).status).toBe(404);
    expect(getSession).not.toHaveBeenCalled();
    expect(untouchable).not.toHaveBeenCalled();
  });

  it("401s with no session, before the database", async () => {
    expect(((await gdmRouteGuard({ db: untouchable, getSession: session(null) })) as Response).status).toBe(401);
    expect(untouchable).not.toHaveBeenCalled();
  });

  it("403s a signed-in user with no consented GDM profile, in approved words — a session is not consent", async () => {
    const gate = await gdmRouteGuard({ db: () => testDb.db, getSession: session(notConsented) });
    expect(gate).toBeInstanceOf(Response);
    expect((gate as Response).status).toBe(403);
    expect(await (gate as Response).json()).toEqual({ error: GDM_COPY["gdm-consent-required"].line });
  });

  it("lets a consented user through with her id", async () => {
    expect(await gdmRouteGuard({ db: () => testDb.db, getSession: session(consented) })).toEqual({ userId: consented });
  });

  it("`consent: false` (the consent route itself) skips only the consent read", async () => {
    expect(await gdmRouteGuard({ db: untouchable, getSession: session(notConsented) }, { consent: false })).toEqual({
      userId: notConsented
    });
    expect(untouchable).not.toHaveBeenCalled();
    vi.stubEnv("GDM_DOOR_ENABLED", "0");
    expect(((await gdmRouteGuard({ db: untouchable, getSession: session(notConsented) }, { consent: false })) as Response).status).toBe(404);
    vi.stubEnv("GDM_DOOR_ENABLED", "1");
    expect(((await gdmRouteGuard({ db: untouchable, getSession: session(null) }, { consent: false })) as Response).status).toBe(401);
  });

  it("R55 `sessionOnly` (reading back her own stored photo) needs a session and nothing else: door open or closed, consent or none, no database read", async () => {
    expect(await gdmRouteGuard({ db: untouchable, getSession: session(notConsented) }, { sessionOnly: true })).toEqual({
      userId: notConsented
    });
    vi.stubEnv("GDM_DOOR_ENABLED", "0");
    vi.stubEnv("NEXT_PUBLIC_GDM_DOOR", "");
    expect(await gdmRouteGuard({ db: untouchable, getSession: session(consented) }, { sessionOnly: true })).toEqual({
      userId: consented
    });
    expect(((await gdmRouteGuard({ db: untouchable, getSession: session(null) }, { sessionOnly: true })) as Response).status).toBe(401);
    expect(untouchable).not.toHaveBeenCalled();
  });
});
