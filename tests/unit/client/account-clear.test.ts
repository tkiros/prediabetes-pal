// tests/unit/client/account-clear.test.ts
import fs from "node:fs";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

// account/page.tsx is a client component; importing it pulls historyStore and
// profileStore into scope, both of which touch window.localStorage — same
// fake-storage bootstrap as first-run-gate.test.ts / onboarding-flow.test.ts.
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
  clearDeviceOnlyKeys,
  DEVICE_ONLY_KEYS
} from "../../../app/(app)/account/page";

describe("clearDeviceOnlyKeys (review A-104)", () => {
  it("removes exactly pal.orient.v1, pal.orient.note.v1 and pal.ask.v1", () => {
    expect(DEVICE_ONLY_KEYS).toEqual([
      "pal.orient.v1",
      "pal.orient.note.v1",
      "pal.ask.v1"
    ]);
    for (const key of DEVICE_ONLY_KEYS) storage.setItem(key, "x");
    clearDeviceOnlyKeys();
    for (const key of DEVICE_ONLY_KEYS) expect(storage.getItem(key)).toBeNull();
  });

  it("leaves unrelated keys alone", () => {
    storage.setItem("pal.history.v1", "keep-me");
    clearDeviceOnlyKeys();
    expect(storage.getItem("pal.history.v1")).toBe("keep-me");
  });
});

// clearDeviceOnlyKeys only protects the account if BOTH handlers call it.
// Review A-104: a fix landing in only one of the two would pass a careless
// test while leaving the clinician-questions note alive after an account
// deletion — so each handler's own source body is checked independently,
// rather than asserting once that the shared helper works.
const PAGE_SOURCE = fs.readFileSync(
  path.join(process.cwd(), "app/(app)/account/page.tsx"),
  "utf8"
);

/** Slice one `async function <name>() { ... }` body out by this file's 2-space indent. */
function handlerBody(name: string): string {
  const start = PAGE_SOURCE.indexOf(`async function ${name}(`);
  if (start === -1) {
    throw new Error(
      `async function ${name} not found in app/(app)/account/page.tsx — update this test`
    );
  }
  const end = PAGE_SOURCE.indexOf("\n  }\n", start);
  if (end === -1) {
    throw new Error(`could not find the closing brace of ${name}`);
  }
  return PAGE_SOURCE.slice(start, end);
}

describe("account/page.tsx handlers wire clearDeviceOnlyKeys (review A-104)", () => {
  it.each(["deleteAccount", "withdrawHealthDataConsent"])(
    "%s clears historyStore, profileStore, and device-only keys",
    (name) => {
      const body = handlerBody(name);
      expect(body).toContain("historyStore.clear()");
      expect(body).toContain("profileStore.clear()");
      expect(body).toContain("clearDeviceOnlyKeys()");
    }
  );
});
