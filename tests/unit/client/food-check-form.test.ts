import { beforeEach, describe, expect, it, vi } from "vitest";

// The check form's taster gate reads the device-local taster store, which
// touches window.localStorage directly. Vitest runs under the "node"
// environment, so — exactly like taster-store.test.ts — we expose a Map-backed
// fake storage as the globals the store touches BEFORE importing the module
// under test (importing the form pulls the taster store into scope).
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

import {
  shouldCountIdeaCheck,
  shouldGateSubmit,
  shouldRecordTaster
} from "../../../components/food-check-form";
import { tasterStore, TASTER_LIMIT } from "../../../lib/client/taster-store";

describe("food-check-form taster gate helpers", () => {
  beforeEach(() => localStorage.clear());

  describe("shouldGateSubmit — behavior (a): trial + non-available → gated", () => {
    it("gates a spent/aged-out taster in trial mode (no /api/check would run)", () => {
      expect(shouldGateSubmit("trial", "exhausted")).toBe(true);
      expect(shouldGateSubmit("trial", "expired")).toBe(true);
    });

    it("does not gate a trial taster who still has checks available", () => {
      expect(shouldGateSubmit("trial", "available")).toBe(false);
    });

    it("never gates in legacy mode, whatever the store status (fail-open)", () => {
      expect(shouldGateSubmit("legacy", "available")).toBe(false);
      expect(shouldGateSubmit("legacy", "exhausted")).toBe(false);
      expect(shouldGateSubmit("legacy", "expired")).toBe(false);
    });

    it("reflects live store status — exhausted store gates only in trial", () => {
      for (let i = 0; i < TASTER_LIMIT; i++) tasterStore.recordCheck();
      expect(tasterStore.status()).toBe("exhausted");
      expect(shouldGateSubmit("trial", tasterStore.status())).toBe(true);
      expect(shouldGateSubmit("legacy", tasterStore.status())).toBe(false);
    });
  });

  describe("AUD-009: an entitled session is never gated or metered", () => {
    it("does not gate an entitled session even with an exhausted/expired store", () => {
      expect(shouldGateSubmit("trial", "exhausted", true)).toBe(false);
      expect(shouldGateSubmit("trial", "expired", true)).toBe(false);
      expect(shouldGateSubmit("trial", "available", true)).toBe(false);
    });

    it("still gates the anonymous posture when entitled is false or omitted", () => {
      expect(shouldGateSubmit("trial", "exhausted", false)).toBe(true);
      expect(shouldGateSubmit("trial", "exhausted")).toBe(true);
    });

    it("never meters an entitled result as an anonymous taster (check #11 stays free)", () => {
      // Mirror the component: anonymousTaster = !entitled. Ten entitled
      // results record nothing, so the device store never exhausts and the
      // gate above can never redirect check #11 to /subscribe.
      const entitled = true;
      for (let i = 0; i < TASTER_LIMIT; i++) {
        if (shouldRecordTaster("trial", !entitled)) {
          tasterStore.recordCheck();
        }
      }
      expect(tasterStore.get()).toBeNull();
      expect(shouldGateSubmit("trial", tasterStore.status(), entitled)).toBe(false);
    });
  });

  describe("shouldRecordTaster — behavior (b): trial + result success → record", () => {
    it("records anonymous tasters in trial mode and returns the used count", () => {
      // Mirror the component's post-result branch: record BEFORE render so a
      // reload can't double-spend, and pass `used` to the analytics event.
      expect(shouldRecordTaster("trial", true)).toBe(true);

      const used1 = tasterStore.recordCheck();
      expect(used1).toBe(1);
      expect(tasterStore.get()?.used).toBe(1);

      const used2 = tasterStore.recordCheck();
      expect(used2).toBe(2);
      expect(tasterStore.get()?.used).toBe(2);
    });

    it("does not record when the anonymous signal is absent", () => {
      expect(shouldRecordTaster("trial", false)).toBe(false);
    });
  });

  describe("behavior (c): legacy mode is byte-identical — no gate, no writes", () => {
    it("never gates and never records in legacy mode", () => {
      expect(shouldGateSubmit("legacy", "available")).toBe(false);
      expect(shouldRecordTaster("legacy", true)).toBe(false);

      // The legacy result branch must not touch the store. Guard the record
      // exactly as the component does — false ⇒ recordCheck is never called.
      if (shouldRecordTaster("legacy", true)) {
        tasterStore.recordCheck();
      }
      expect(tasterStore.get()).toBeNull();
    });
  });

  describe("shouldCountIdeaCheck — PRD §9.1: only the untouched idea prefill counts (review A-32)", () => {
    it("counts an untouched idea prefill submitted as-is", () => {
      expect(
        shouldCountIdeaCheck(
          { recheck: "greek yogurt with berries", recheckSource: "idea" },
          "greek yogurt with berries"
        )
      ).toBe(true);
    });

    it("does not count once the user has edited the text", () => {
      expect(
        shouldCountIdeaCheck(
          { recheck: "greek yogurt with berries", recheckSource: "idea" },
          "greek yogurt with berries and honey"
        )
      ).toBe(false);
    });

    it("does not count when the source is not an idea (e.g. history re-check)", () => {
      expect(
        shouldCountIdeaCheck(
          { recheck: "greek yogurt with berries", recheckSource: null },
          "greek yogurt with berries"
        )
      ).toBe(false);
    });

    it("does not count when the source says idea but there is no recheck text", () => {
      expect(
        shouldCountIdeaCheck({ recheck: null, recheckSource: "idea" }, "anything")
      ).toBe(false);
    });
  });
});
