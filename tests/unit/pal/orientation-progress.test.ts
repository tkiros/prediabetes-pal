// tests/unit/pal/orientation-progress.test.ts
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
import { recordStepEvent, type StepEvent } from "../../../lib/client/orientation-progress";
import { orientationStore } from "../../../lib/client/orientation-store";

/**
 * Review A-84: a step completes where it happens. Ruling F-53: every event
 * marks the device week (under the store's own started-and-not-hidden guard)
 * AND sends PATCH markNext, whatever the server answers — so a signed-in user
 * whose server copy is still null keeps the mark for Home's migration. The
 * call is fire-and-forget and never rejects.
 */
const STARTED: OrientationState = {
  done: [],
  dismissedAt: null,
  startedAt: "2026-09-14T09:00:00.000Z"
};

let status: number;
const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => new Response(null, { status }));

const seed = (state: OrientationState) => storage.setItem("pal.orient.v1", JSON.stringify(state));

beforeEach(() => {
  storage.clear();
  seed(STARTED);
  status = 200;
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("NEXT_PUBLIC_GUIDE_DOOR", "orient");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.stubGlobal("window", { localStorage: storage });
});

describe("recordStepEvent (review A-84)", () => {
  it.each(["", "ideas,calm"])("door shut (%j): no request and no device write", async (flag) => {
    vi.stubEnv("NEXT_PUBLIC_GUIDE_DOOR", flag);
    const before = storage.getItem("pal.orient.v1");

    await expect(recordStepEvent("check")).resolves.toBeUndefined();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(storage.getItem("pal.orient.v1")).toBe(before);
  });

  it.each([
    ["check", ["2", "3"]],
    ["idea_check", ["4"]],
    ["numbers_link", ["1"]],
    ["clinician_list", ["5"]],
    ["journey_visit", ["7"]]
  ] as const)("%s sends exactly one PATCH whose body is { orientation: { op: markNext, steps: %j } }", async (kind, steps) => {
    await recordStepEvent(kind satisfies StepEvent);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/profile");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(String(init.body))).toEqual({ orientation: { op: "markNext", steps } });
  });

  it.each([
    [200, "signed in, e.g. a server copy still null before Home's migration (F-53)"],
    [401, "a guest"],
    [404, "signed in with no profiles row"],
    [500, "a server failure"]
  ])("%i (%s): the device week is marked too", async (code) => {
    status = code;
    await recordStepEvent("idea_check");
    expect(orientationStore.get()).toEqual({ ...STARTED, done: ["4"] });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("a started, shown device week gets step 2 on one check and step 3 on the next", async () => {
    await recordStepEvent("check");
    expect(orientationStore.get().done).toEqual(["2"]);
    await recordStepEvent("check");
    expect(orientationStore.get().done).toEqual(["2", "3"]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("a device with no week stays empty (the store never starts one); the PATCH still goes", async () => {
    storage.clear();
    await recordStepEvent("clinician_list");
    expect(storage.getItem("pal.orient.v1")).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("a request that never completes: the device is still marked, and the call never rejects", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await expect(recordStepEvent("numbers_link")).resolves.toBeUndefined();
    expect(orientationStore.get()).toEqual({ ...STARTED, done: ["1"] });
  });
});
