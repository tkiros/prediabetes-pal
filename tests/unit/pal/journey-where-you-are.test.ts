import { afterEach, describe, expect, it, vi } from "vitest";

// Task 3.7 — /journey's "Where you are" line (rulings F-44, F-45; reviews
// A-30, A-80, A-86). The page is a client component and node has no DOM, so
// the line's text and its data source are tested here; the page glue is
// covered by tests/smoke/journey.spec.ts.

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

import { dayKeyInTimezone, dayKeyLocal } from "../../../lib/coach/days";
import { EMPTY_ORIENTATION, whereYouAreLine, type OrientationState } from "../../../lib/coach/orientation";
import { loadJourneyLine } from "../../../lib/client/remote-orientation";

const NOW = new Date(2026, 8, 15, 12, 0); // Sep 15, noon local
const daysAgo = (days: number) => new Date(2026, 8, 15 - days, 9, 0).toISOString();
const week = (over: Partial<OrientationState>): OrientationState => ({ ...EMPTY_ORIENTATION, ...over });
const line = (state: OrientationState) => whereYouAreLine(state, dayKeyLocal, NOW);

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.stubGlobal("window", { localStorage: storage });
  storage.clear();
});

describe("whereYouAreLine (F-45)", () => {
  it("no start is no line — /journey never stamps one", () => {
    expect(line(EMPTY_ORIENTATION)).toBeNull();
    expect(line(week({ done: ["1", "2"], dismissedAt: daysAgo(1) }))).toBeNull();
  });

  it("an active week names the day and an additive count", () => {
    expect(line(week({ startedAt: daysAgo(2), done: ["1", "2"] }))).toBe("Day 3 of your first week · 2 steps done");
    expect(line(week({ startedAt: daysAgo(6), done: ["1", "2", "3", "4", "5", "6", "7"] }))).toBe(
      "Day 7 of your first week · 7 steps done"
    );
  });

  it("one step is singular; no step done shows no count at all", () => {
    expect(line(week({ startedAt: daysAgo(1), done: ["3"] }))).toBe("Day 2 of your first week · 1 step done");
    expect(line(week({ startedAt: daysAgo(0) }))).toBe("Day 1 of your first week");
  });

  it("after day 7 the line stays as a review (A-30)", () => {
    expect(line(week({ startedAt: daysAgo(7), done: ["1", "2", "3", "4", "5"] }))).toBe(
      "Your first week · 5 steps done · Review"
    );
    expect(line(week({ startedAt: daysAgo(30), done: ["2"] }))).toBe("Your first week · 1 step done · Review");
    expect(line(week({ startedAt: daysAgo(9) }))).toBe("Your first week · Review");
  });

  it("a dismissed week is a review from the day it was hidden", () => {
    expect(line(week({ startedAt: daysAgo(1), done: ["1"], dismissedAt: daysAgo(0) }))).toBe(
      "Your first week · 1 step done · Review"
    );
    expect(line(week({ startedAt: daysAgo(0), dismissedAt: daysAgo(0) }))).toBe("Your first week · Review");
  });

  it("counts each step once", () => {
    expect(line(week({ startedAt: daysAgo(2), done: ["1", "1", "2"] }))).toBe("Day 3 of your first week · 2 steps done");
  });

  it("never 'of 7', never a percentage, never a band word (A-86, RV-3)", () => {
    const ids = ["1", "2", "3", "4", "5", "6", "7"] as const;
    for (let ago = 0; ago <= 9; ago++) {
      for (let done = 0; done <= 7; done++) {
        for (const dismissedAt of [null, daysAgo(0)]) {
          const text = line(week({ startedAt: daysAgo(ago), done: [...ids.slice(0, done)], dismissedAt })) ?? "";
          expect(text).not.toMatch(/of 7|%|excellent|on track|building|getting started/i);
          expect(text).not.toMatch(/revers|cure|treat|prevent|guarantee|FDA/i);
        }
      }
    }
  });

  it("the day comes from the caller's calendar (A-06)", () => {
    const startedAt = "2026-09-14T20:00:00.000Z";
    const now = new Date("2026-09-15T03:00:00.000Z");
    const state = week({ startedAt });
    expect(whereYouAreLine(state, dayKeyInTimezone("UTC"), now)).toBe("Day 2 of your first week");
    expect(whereYouAreLine(state, dayKeyInTimezone("America/Los_Angeles"), now)).toBe("Day 1 of your first week");
  });
});

type Reply = { status: number; body?: unknown } | "offline" | "bad-json";

function stubProfile(reply: Reply) {
  const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => {
    if (reply === "offline") throw new TypeError("Failed to fetch");
    if (reply === "bad-json") {
      return { ok: true, status: 200, json: async () => JSON.parse("{") } as unknown as Response;
    }
    return {
      ok: reply.status >= 200 && reply.status < 300,
      status: reply.status,
      json: async () => reply.body
    } as unknown as Response;
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const DEVICE_WEEK = { done: ["1"], dismissedAt: null, startedAt: daysAgo(3) };
const seedDevice = () => storage.setItem("pal.orient.v1", JSON.stringify(DEVICE_WEEK));

describe("loadJourneyLine (F-44)", () => {
  it("flag off: no request at all, no line", async () => {
    vi.stubEnv("NEXT_PUBLIC_GUIDE_DOOR", "ideas");
    seedDevice();
    const fetchMock = stubProfile({ status: 401 });
    expect(await loadJourneyLine(NOW)).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reads GET /api/profile once, uncached", async () => {
    vi.stubEnv("NEXT_PUBLIC_GUIDE_DOOR", "orient");
    const fetchMock = stubProfile({ status: 401 });
    await loadJourneyLine(NOW);
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith("/api/profile", { cache: "no-store" });
  });

  it("a guest (401) reads the device week", async () => {
    vi.stubEnv("NEXT_PUBLIC_GUIDE_DOOR", "orient");
    seedDevice();
    stubProfile({ status: 401 });
    expect(await loadJourneyLine(NOW)).toBe("Day 4 of your first week · 1 step done");
  });

  it("a guest with no device week gets no line", async () => {
    vi.stubEnv("NEXT_PUBLIC_GUIDE_DOOR", "orient");
    stubProfile({ status: 401 });
    expect(await loadJourneyLine(NOW)).toBeNull();
  });

  it("signed in with no profiles row reads the device week, as a guest would", async () => {
    vi.stubEnv("NEXT_PUBLIC_GUIDE_DOOR", "1");
    seedDevice();
    stubProfile({ status: 200, body: { hasProfile: false } });
    expect(await loadJourneyLine(NOW)).toBe("Day 4 of your first week · 1 step done");
  });

  it("signed in with a row reads the account's week in the account's timezone, not the device's", async () => {
    vi.stubEnv("NEXT_PUBLIC_GUIDE_DOOR", "orient");
    seedDevice();
    stubProfile({
      status: 200,
      body: {
        hasProfile: true,
        timezone: "America/Los_Angeles",
        orientation: { done: ["1", "2"], dismissedAt: null, startedAt: "2026-09-14T20:00:00.000Z" }
      }
    });
    expect(await loadJourneyLine(new Date("2026-09-15T03:00:00.000Z"))).toBe("Day 1 of your first week · 2 steps done");
  });

  it("an account week that is over or dismissed reads as a review", async () => {
    vi.stubEnv("NEXT_PUBLIC_GUIDE_DOOR", "orient");
    stubProfile({
      status: 200,
      body: {
        hasProfile: true,
        timezone: "UTC",
        orientation: { done: ["1", "2", "3"], dismissedAt: "2026-09-14T00:00:00.000Z", startedAt: "2026-09-13T00:00:00.000Z" }
      }
    });
    expect(await loadJourneyLine(new Date("2026-09-15T12:00:00.000Z"))).toBe("Your first week · 3 steps done · Review");
  });

  it("an account with no week, or an unreadable one, gets no line — the device is not consulted", async () => {
    vi.stubEnv("NEXT_PUBLIC_GUIDE_DOOR", "orient");
    seedDevice();
    stubProfile({ status: 200, body: { hasProfile: true, timezone: "UTC", orientation: null } });
    expect(await loadJourneyLine(NOW)).toBeNull();
    stubProfile({ status: 200, body: { hasProfile: true, timezone: "UTC", orientation: { done: "all" } } });
    expect(await loadJourneyLine(NOW)).toBeNull();
  });

  it.each<[string, Reply]>([
    ["a server error", { status: 500, body: { error: "boom" } }],
    ["a rate limit", { status: 429 }],
    ["no network", "offline"],
    ["an unreadable body", "bad-json"],
    ["a body with no hasProfile", { status: 200, body: {} }],
    ["an unknown timezone", { status: 200, body: { hasProfile: true, timezone: "Mars/Olympus", orientation: DEVICE_WEEK } }]
  ])("a failed read (%s) leaves the line out", async (_label, reply) => {
    vi.stubEnv("NEXT_PUBLIC_GUIDE_DOOR", "orient");
    seedDevice();
    stubProfile(reply);
    expect(await loadJourneyLine(NOW)).toBeNull();
  });
});
