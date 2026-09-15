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

import type { OrientationState } from "../../../lib/coach/orientation";
import { syncOrientation } from "../../../lib/client/remote-orientation";

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
