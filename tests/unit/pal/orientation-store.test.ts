// tests/unit/pal/orientation-store.test.ts
import fs from "node:fs";
import path from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

// Same fake-storage bootstrap as tests/unit/client/first-run-gate.test.ts:
// the store touches window.localStorage, vitest runs under node.
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
vi.stubGlobal("localStorage", storage);
vi.stubGlobal("window", { localStorage: storage });

import { EMPTY_ORIENTATION } from "../../../lib/coach/orientation";
import { orientationNote, orientationStore } from "../../../lib/client/orientation-store";

describe("orientationStore (pal.orient.v1)", () => {
  beforeEach(() => storage.clear());

  it("returns the empty state on empty or corrupt storage", () => {
    expect(orientationStore.get()).toEqual(EMPTY_ORIENTATION);
    storage.setItem("pal.orient.v1", "{not json");
    expect(orientationStore.get()).toEqual(EMPTY_ORIENTATION);
    storage.setItem("pal.orient.v1", JSON.stringify({ done: ["9"], dismissedAt: null }));
    expect(orientationStore.get()).toEqual(EMPTY_ORIENTATION);
  });

  it("markDone is idempotent and keeps order; dismiss stamps an ISO time", () => {
    orientationStore.markDone("2");
    orientationStore.markDone("2");
    orientationStore.markDone("1");
    expect(orientationStore.get().done).toEqual(["2", "1"]);
    orientationStore.dismiss(new Date("2026-09-14T09:00:00.000Z"));
    expect(orientationStore.get().dismissedAt).toBe("2026-09-14T09:00:00.000Z");
  });

  it("start stamps the week once and never moves it (review A-05)", () => {
    orientationStore.start(new Date("2026-09-14T09:00:00.000Z"));
    orientationStore.start(new Date("2026-09-20T09:00:00.000Z"));
    expect(orientationStore.get().startedAt).toBe("2026-09-14T09:00:00.000Z");
  });
});

describe("orientationNote (pal.orient.note.v1) — device only", () => {
  beforeEach(() => storage.clear());

  it("round-trips, and an empty save removes the key", () => {
    expect(orientationNote.get()).toBe("");
    orientationNote.set("ask which test was used");
    expect(orientationNote.get()).toBe("ask which test was used");
    orientationNote.set("");
    expect(storage.getItem("pal.orient.note.v1")).toBeNull();
  });

  it("is never referenced by any server or API module (the note never leaves the device)", () => {
    const walk = (dir: string, out: string[] = []): string[] => {
      for (const entry of fs.readdirSync(path.join(process.cwd(), dir), { withFileTypes: true })) {
        const rel = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(rel, out);
        else if (/\.tsx?$/.test(entry.name)) out.push(rel);
      }
      return out;
    };
    const offenders = [...walk("app/api"), ...walk("lib/server"), ...walk("lib/pal")].filter((rel) =>
      fs.readFileSync(path.join(process.cwd(), rel), "utf8").includes("pal.orient.note")
    );
    expect(offenders).toEqual([]);
  });
});
