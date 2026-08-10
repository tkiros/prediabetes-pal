import { beforeEach, describe, expect, it } from "vitest";

import {
  createHistoryStore,
  normalizeInputMethod,
  type StoredCheck
} from "../../../lib/client/history-store";

function fakeStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key)
  };
}

function check(overrides: Partial<StoredCheck> = {}): StoredCheck {
  return {
    clientId: overrides.clientId ?? crypto.randomUUID(),
    food: "lentil soup",
    risk: "SAFE",
    a1cBand: "prediabetes_60_62",
    inputMethod: "text",
    createdAt: "2026-07-01T12:00:00.000Z",
    ...overrides
  };
}

// Fixed "now" for deterministic day math: July 3 2026, 09:00 local.
const NOW = new Date(2026, 6, 3, 9, 0, 0);

function daysAgoLocal(days: number, hour = 12): string {
  const d = new Date(NOW);
  d.setDate(d.getDate() - days);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

describe("normalizeInputMethod — shared read-path mapping (plan §4.6 fidelity)", () => {
  it("preserves every real method, including photo (no collapse to text)", () => {
    expect(normalizeInputMethod("text")).toBe("text");
    expect(normalizeInputMethod("voice")).toBe("voice");
    expect(normalizeInputMethod("photo")).toBe("photo");
  });

  it("degrades unknown or missing methods to text", () => {
    expect(normalizeInputMethod("something-else")).toBe("text");
    expect(normalizeInputMethod(null)).toBe("text");
    expect(normalizeInputMethod(undefined)).toBe("text");
  });
});

describe("historyStore", () => {
  let store: ReturnType<typeof createHistoryStore>;

  beforeEach(() => {
    store = createHistoryStore(fakeStorage());
  });

  it("adds and lists checks, newest first", () => {
    store.add(check({ clientId: "a", createdAt: daysAgoLocal(1) }));
    store.add(check({ clientId: "b", createdAt: daysAgoLocal(0) }));

    expect(store.all().map((c) => c.clientId)).toEqual(["b", "a"]);
  });

  it("today() returns only local-today checks", () => {
    store.add(check({ clientId: "today", createdAt: daysAgoLocal(0, 8) }));
    store.add(check({ clientId: "yesterday", createdAt: daysAgoLocal(1) }));

    expect(store.today(NOW).map((c) => c.clientId)).toEqual(["today"]);
  });

  it("recent(days) buckets by local calendar day", () => {
    store.add(check({ clientId: "d0", createdAt: daysAgoLocal(0) }));
    store.add(check({ clientId: "d6", createdAt: daysAgoLocal(6) }));
    store.add(check({ clientId: "d7", createdAt: daysAgoLocal(7) }));

    expect(store.recent(7, NOW).map((c) => c.clientId)).toEqual(["d0", "d6"]);
  });

  it("streak counts consecutive days with a check ending today", () => {
    store.add(check({ createdAt: daysAgoLocal(0) }));
    store.add(check({ createdAt: daysAgoLocal(1) }));
    store.add(check({ createdAt: daysAgoLocal(2) }));

    expect(store.streak(NOW)).toBe(3);
  });

  it("streak still counts when today has no check yet (ends yesterday)", () => {
    store.add(check({ createdAt: daysAgoLocal(1) }));
    store.add(check({ createdAt: daysAgoLocal(2) }));

    expect(store.streak(NOW)).toBe(2);
  });

  it("streak breaks on a gap day", () => {
    store.add(check({ createdAt: daysAgoLocal(0) }));
    store.add(check({ createdAt: daysAgoLocal(2) }));

    expect(store.streak(NOW)).toBe(1);
  });

  it("streak is zero with no checks in the last two days", () => {
    store.add(check({ createdAt: daysAgoLocal(3) }));

    expect(store.streak(NOW)).toBe(0);
  });

  it("streak uses local midnight boundaries, not UTC (late-night check)", () => {
    // 23:30 local yesterday: same UTC day may differ, but local day must win.
    store.add(check({ createdAt: daysAgoLocal(1, 23) }));
    store.add(check({ createdAt: daysAgoLocal(0, 0) }));

    expect(store.streak(NOW)).toBe(2);
  });

  it("multiple checks in one day count once for the streak", () => {
    store.add(check({ createdAt: daysAgoLocal(0, 8) }));
    store.add(check({ createdAt: daysAgoLocal(0, 13) }));
    store.add(check({ createdAt: daysAgoLocal(1) }));

    expect(store.streak(NOW)).toBe(2);
  });

  it("markActionDone stamps the check", () => {
    store.add(check({ clientId: "walk", createdAt: daysAgoLocal(0) }));

    store.markActionDone("walk");

    const stored = store.all().find((c) => c.clientId === "walk");
    expect(stored?.actionDoneAt).toBeTruthy();
  });

  it("remove() drops a check by clientId (deletion is real — E1)", () => {
    store.add(check({ clientId: "keep", createdAt: daysAgoLocal(0) }));
    store.add(check({ clientId: "gone", createdAt: daysAgoLocal(1) }));

    store.remove("gone");

    expect(store.all().map((c) => c.clientId)).toEqual(["keep"]);
  });

  it("remove() is a no-op for an unknown clientId", () => {
    store.add(check({ clientId: "a" }));
    store.remove("does-not-exist");
    expect(store.all().map((c) => c.clientId)).toEqual(["a"]);
  });

  it("a removed check is absent from the migrate payload — no resurrection (E1)", () => {
    // syncLocalHistory posts historyStore.all() to /api/history/migrate; after a
    // real delete the row must not be in that payload or the daily loop would
    // re-create it on the next visit.
    store.add(check({ clientId: "deleted", createdAt: daysAgoLocal(0) }));
    store.remove("deleted");

    const migratePayload = store.all();
    expect(migratePayload.some((c) => c.clientId === "deleted")).toBe(false);
  });

  it("clear() empties the store", () => {
    store.add(check());
    store.clear();

    expect(store.all()).toEqual([]);
  });

  it("survives corrupted storage payloads", () => {
    const storage = fakeStorage();
    storage.setItem("pal.history.v1", "{not json");
    const corrupted = createHistoryStore(storage);

    expect(corrupted.all()).toEqual([]);
    corrupted.add(check({ clientId: "fresh" }));
    expect(corrupted.all().map((c) => c.clientId)).toEqual(["fresh"]);
  });

  it("caps stored history so localStorage never grows unbounded", () => {
    for (let i = 0; i < 600; i += 1) {
      store.add(
        check({
          clientId: `c${i}`,
          createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, i)).toISOString()
        })
      );
    }

    expect(store.all().length).toBeLessThanOrEqual(500);
    // newest are kept
    expect(store.all()[0].clientId).toBe("c599");
  });
});
