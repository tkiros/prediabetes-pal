// tests/unit/pal/ask-store.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

// Same fake-storage bootstrap as orientation-store.test.ts: the store touches
// window.localStorage, vitest runs under node.
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

import { askStore } from "../../../lib/client/ask-store";

const seed = (value: unknown) =>
  storage.setItem("pal.ask.v1", typeof value === "string" ? value : JSON.stringify(value));

describe("askStore.get() (pal.ask.v1, ruling R-17)", () => {
  beforeEach(() => storage.clear());

  it("reads a valid value", () => {
    seed({ pains: ["worried", "food"], win: "peace" });
    expect(askStore.get()).toEqual({ pains: ["worried", "food"], win: "peace" });
    seed({ pains: [], win: null });
    expect(askStore.get()).toEqual({ pains: [], win: null });
  });

  it("returns null when nothing is stored", () => {
    expect(askStore.get()).toBeNull();
  });

  it("returns null on corrupt JSON", () => {
    seed("{not json");
    expect(askStore.get()).toBeNull();
  });

  it("returns null on an unknown pain, an unknown win, or an unknown field", () => {
    seed({ pains: ["hungry"], win: null });
    expect(askStore.get()).toBeNull();
    seed({ pains: ["food"], win: "rich" });
    expect(askStore.get()).toBeNull();
    seed({ pains: ["food"], win: null, a1c: 6.1 });
    expect(askStore.get()).toBeNull();
  });

  it("returns null on more than three pains", () => {
    seed({ pains: ["number", "effort", "plan", "food"], win: null });
    expect(askStore.get()).toBeNull();
  });

  it("returns null when storage throws", () => {
    vi.stubGlobal("window", {
      localStorage: {
        getItem: () => {
          throw new Error("denied");
        }
      }
    });
    try {
      expect(askStore.get()).toBeNull();
    } finally {
      vi.stubGlobal("window", { localStorage: storage });
    }
  });
});

describe("askStore.set() (Task 6.2)", () => {
  beforeEach(() => storage.clear());

  it("round-trips through get()", () => {
    askStore.set({ pains: ["food", "number"], win: "peace" });
    expect(askStore.get()).toEqual({ pains: ["food", "number"], win: "peace" });
    askStore.set({ pains: [], win: null });
    expect(askStore.get()).toEqual({ pains: [], win: null });
  });

  it("writes exactly {pains, win} to pal.ask.v1, in tap order", () => {
    askStore.set({ pains: ["worried", "number", "plan"], win: null });
    expect(storage.getItem("pal.ask.v1")).toBe('{"pains":["worried","number","plan"],"win":null}');
  });

  it("never throws when storage does", () => {
    vi.stubGlobal("window", {
      localStorage: {
        setItem: () => {
          throw new Error("quota");
        }
      }
    });
    try {
      expect(() => askStore.set({ pains: ["food"], win: null })).not.toThrow();
    } finally {
      vi.stubGlobal("window", { localStorage: storage });
    }
  });
});
