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
 * Review A-84: a step completes where it happens. A signed-in user's week is
 * marked by the server (PATCH markNext); a guest's (401), or a signed-in user
 * with no profiles row (404, ruling F-31), by the device store. Anything else
 * is dropped — the call is fire-and-forget.
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
  it.each(["", "ideas,calm"])("door shut (%j): no request, and the device week is untouched", async (flag) => {
    vi.stubEnv("NEXT_PUBLIC_GUIDE_DOOR", flag);
    status = 401;

    await expect(recordStepEvent("check")).resolves.toBeUndefined();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(orientationStore.get()).toEqual(STARTED);
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

  it("200: the server marked it, so the device week is untouched", async () => {
    status = 200;
    await recordStepEvent("check");
    expect(orientationStore.get()).toEqual(STARTED);
  });

  it("401 (a guest): the device marks step 2, and the next check marks step 3", async () => {
    status = 401;
    await recordStepEvent("check");
    expect(orientationStore.get().done).toEqual(["2"]);
    await recordStepEvent("check");
    expect(orientationStore.get().done).toEqual(["2", "3"]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("404 (signed in, no profiles row): the device marks the step", async () => {
    status = 404;
    await recordStepEvent("journey_visit");
    expect(orientationStore.get().done).toEqual(["7"]);
  });

  it("401 on a week that has not started: the device writes nothing (the store's guard)", async () => {
    storage.clear();
    status = 401;
    await recordStepEvent("clinician_list");
    expect(storage.getItem("pal.orient.v1")).toBeNull();
  });

  it.each([500, 400, 409])("%i: dropped, the device week is untouched", async (code) => {
    status = code;
    await recordStepEvent("idea_check");
    expect(orientationStore.get()).toEqual(STARTED);
  });

  it("a request that never completes: dropped, and the call never throws", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await expect(recordStepEvent("numbers_link")).resolves.toBeUndefined();
    expect(orientationStore.get()).toEqual(STARTED);
  });
});
