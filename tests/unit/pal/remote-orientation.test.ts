// tests/unit/pal/remote-orientation.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Same fake-storage bootstrap as orientation-store.test.ts.
function fakeStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
    clear: () => void map.clear()
  };
}
const storage = fakeStorage();
vi.stubGlobal("window", { localStorage: storage });

// OrientationSync is exercised without a DOM (none is installed): React's
// effect and ref hooks are captured so a test can run a mount's effects and
// re-render the SAME instance (same ref) with new props, as router.refresh()
// does when the RSC payload merges in.
const react = vi.hoisted(() => ({
  effects: [] as Array<() => void>,
  ref: null as { current: unknown } | null,
  refresh: vi.fn()
}));
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useEffect: (effect: () => void) => void react.effects.push(effect),
  useRef: (initial: unknown) => (react.ref ??= { current: initial })
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: react.refresh }) }));

import type { OrientationState } from "../../../lib/coach/orientation";
import { syncOrientation } from "../../../lib/client/remote-orientation";
import { OrientationSync } from "../../../components/orientation-sync";

/**
 * Signed-in Home's orientation writes (review A-66, ruling F-27): the one-time
 * guest → signed-in `set`, its 409 replay, the A-92 404, and the start stamp
 * that must never run ahead of an unsettled migration.
 */
const DEVICE: OrientationState = {
  done: ["2", "1"],
  dismissedAt: "2026-09-14T09:00:00.000Z",
  startedAt: "2026-09-12T09:00:00.000Z"
};

let statuses: Record<string, number>;
let sent: Array<Record<string, unknown>>;

beforeEach(() => {
  storage.clear();
  sent = [];
  statuses = {};
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      expect(url).toBe("/api/profile");
      expect(init.method).toBe("PATCH");
      const { orientation } = JSON.parse(String(init.body)) as { orientation: Record<string, unknown> };
      sent.push(orientation);
      const status = statuses[String(orientation.op)] ?? 200;
      if (status === 0) throw new TypeError("offline");
      return new Response("{}", { status });
    })
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.stubGlobal("window", { localStorage: storage });
});

const device = (state: OrientationState) => storage.setItem("pal.orient.v1", JSON.stringify(state));

describe("syncOrientation", () => {
  it("200: the device state is sent once as `set`, then the start stamp; the device key is left alone", async () => {
    device(DEVICE);
    await syncOrientation({ migrate: true, start: true });
    expect(sent).toEqual([{ op: "set", state: DEVICE }, { op: "start" }]);
    expect(JSON.parse(storage.getItem("pal.orient.v1")!)).toEqual(DEVICE);
  });

  it("409: another writer got there first — every done id and the dismissal are replayed, never dropped", async () => {
    device(DEVICE);
    statuses.set = 409;
    await syncOrientation({ migrate: true, start: false });
    expect(sent[0]).toEqual({ op: "set", state: DEVICE });
    expect(sent.slice(1)).toHaveLength(3);
    expect(sent.slice(1)).toEqual(
      expect.arrayContaining([
        { op: "markDone", step: "2" },
        { op: "markDone", step: "1" },
        { op: "dismiss" }
      ])
    );
  });

  it("409 without a dismissal replays only the done ids, and the start stamp still follows", async () => {
    device({ ...DEVICE, dismissedAt: null });
    statuses.set = 409;
    await syncOrientation({ migrate: true, start: true });
    expect(sent.map((body) => body.op)).toEqual(["set", "markDone", "markDone", "start"]);
  });

  it("404: no profiles row (A-92) — nothing else is sent and the device keeps its state", async () => {
    device(DEVICE);
    statuses.set = 404;
    await syncOrientation({ migrate: true, start: true });
    expect(sent).toEqual([{ op: "set", state: DEVICE }]);
    expect(JSON.parse(storage.getItem("pal.orient.v1")!)).toEqual(DEVICE);
  });

  it("400 (ruling F-32): the device's own start was refused (a fast clock) — replay like a 409, then the server's start stands in", async () => {
    device(DEVICE);
    statuses.set = 400;
    expect(await syncOrientation({ migrate: true, start: true })).toBe(true);
    expect(sent[0]).toEqual({ op: "set", state: DEVICE });
    expect(sent.slice(1, 4)).toEqual(
      expect.arrayContaining([
        { op: "markDone", step: "2" },
        { op: "markDone", step: "1" },
        { op: "dismiss" }
      ])
    );
    expect(sent.slice(4)).toEqual([{ op: "start" }]);
  });

  it("400 with only a refused start: the server's start substitutes it even when the page did not ask for one", async () => {
    device({ done: [], dismissedAt: null, startedAt: "2099-01-01T00:00:00.000Z" });
    statuses.set = 400;
    expect(await syncOrientation({ migrate: true, start: false })).toBe(true);
    expect(sent.map((body) => body.op)).toEqual(["set", "start"]);
  });

  it("an unsettled migration (offline, 5xx) holds the start back, so the next visit can still migrate", async () => {
    for (const status of [0, 500]) {
      sent = [];
      device(DEVICE);
      statuses.set = status;
      await syncOrientation({ migrate: true, start: true });
      expect(sent.map((body) => body.op)).toEqual(["set"]);
    }
  });

  it("an empty device has nothing to migrate: no `set`, only the start stamp when asked", async () => {
    await syncOrientation({ migrate: true, start: true });
    expect(sent).toEqual([{ op: "start" }]);
    sent = [];
    await syncOrientation({ migrate: true, start: false });
    expect(sent).toEqual([]);
  });

  it("migrate: false never sends the device state (the server already has its own)", async () => {
    device(DEVICE);
    await syncOrientation({ migrate: false, start: true });
    expect(sent).toEqual([{ op: "start" }]);
  });
});

describe("syncOrientation's answer: did a migration write land? (ruling F-34 — the refresh trigger)", () => {
  it("true after a 200 `set`, or a replay with at least one write", async () => {
    device(DEVICE);
    expect(await syncOrientation({ migrate: true, start: false })).toBe(true);
    statuses.set = 409;
    expect(await syncOrientation({ migrate: true, start: false })).toBe(true);
  });

  it("false when nothing was written: 0, 404, 5xx, a replay that failed, an empty device, or no migration at all", async () => {
    device(DEVICE);
    for (const status of [0, 404, 500]) {
      statuses.set = status;
      expect(await syncOrientation({ migrate: true, start: true })).toBe(false);
    }
    statuses.set = 409;
    statuses.markDone = 500;
    statuses.dismiss = 0;
    expect(await syncOrientation({ migrate: true, start: true })).toBe(false);
    statuses = {};
    storage.clear();
    expect(await syncOrientation({ migrate: true, start: true })).toBe(false);
    device(DEVICE);
    // A plain start is not a migration: the page already shows day 1.
    expect(await syncOrientation({ migrate: false, start: true })).toBe(false);
  });
});

describe("OrientationSync — one sync per mount, one refresh per migration, no loop (ruling F-34)", () => {
  beforeEach(() => {
    react.effects = [];
    react.ref = null;
    react.refresh.mockClear();
  });

  /** Render (a call, with hooks captured) and run the effects it scheduled. */
  async function render(props: { migrate: boolean; start: boolean }) {
    react.effects = [];
    expect(OrientationSync(props)).toBeNull();
    for (const effect of react.effects) effect();
    // Let the fetch chain and the .then settle.
    for (let i = 0; i < 10; i += 1) await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  it("a migration write refreshes once; the refreshed render of the same instance sends nothing and refreshes nothing", async () => {
    device(DEVICE);
    await render({ migrate: true, start: true });
    expect(sent.map((body) => body.op)).toEqual(["set", "start"]);
    expect(react.refresh).toHaveBeenCalledTimes(1);

    // router.refresh() merges the new payload into the mounted tree: same
    // instance, same ref. Even if the props had not changed, the ref holds.
    sent = [];
    await render({ migrate: true, start: true });
    await render({ migrate: false, start: false });
    expect(sent).toEqual([]);
    expect(react.refresh).toHaveBeenCalledTimes(1);
  });

  it("StrictMode's second effect run on the same instance is a no-op", async () => {
    device(DEVICE);
    react.effects = [];
    OrientationSync({ migrate: true, start: false });
    for (const effect of [...react.effects, ...react.effects]) effect();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(sent.filter((body) => body.op === "set")).toHaveLength(1);
  });

  it("a fresh instance after the refresh (migrate is now false) can only stamp the start, and never refreshes", async () => {
    device(DEVICE);
    await render({ migrate: false, start: true });
    expect(sent.map((body) => body.op)).toEqual(["start"]);
    expect(react.refresh).not.toHaveBeenCalled();
  });

  it("no refresh after a 0 / 404 early return or when nothing was written", async () => {
    for (const status of [0, 404]) {
      react.ref = null;
      device(DEVICE);
      statuses.set = status;
      await render({ migrate: true, start: true });
    }
    react.ref = null;
    storage.clear();
    statuses = {};
    await render({ migrate: true, start: true }); // empty device: only the start
    expect(react.refresh).not.toHaveBeenCalled();
  });

  it("nothing to do ⇒ no request at all", async () => {
    device(DEVICE);
    await render({ migrate: false, start: false });
    expect(sent).toEqual([]);
  });
});
