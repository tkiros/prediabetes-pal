import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * A-104: the real egress risk for the clinician-questions note is client
 * code, not the server-side walk in orientation-store.test.ts. This pins
 * every client-side file that touches the note to never call `fetch(` or
 * `navigator.sendBeacon` — the two ways client code phones home — and never
 * to import the two modules that do (the PATCH helper and the analytics
 * forwarder, whose props reach a third party with no runtime check).
 *
 * The reverse pin: the files that DO send requests never name the note.
 *
 * A listed path that does not exist is a test failure, not a silent skip — a
 * pin that can drop a path unnoticed protects nothing.
 */
const DEVICE_ONLY_SOURCES = [
  "lib/client/orientation-store.ts",
  "components/orientation-note.tsx"
] as const;

const BANNED: ReadonlyArray<[string, RegExp]> = [
  ["fetch(", /fetch\(/],
  ["navigator.sendBeacon", /navigator\.sendBeacon/],
  ["an import of remote-orientation", /from\s+["'][^"']*remote-orientation["']/],
  ["an import of lib/client/analytics", /from\s+["'][^"']*analytics["']/]
];

// Task 3.5 review, folded into Task 3.6: every orientation file that sends a
// request. None of them may reach the note.
const SENDING_SOURCES = [
  "lib/client/remote-orientation.ts",
  "components/orientation-sync.tsx",
  "components/orientation-list.tsx",
  // Task 3.7: /journey reads the week through GET /api/profile.
  "app/(app)/journey/page.tsx"
] as const;

const NOTE_MARKERS = ["orientationNote", "pal.orient.note"] as const;

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");

const presence = (list: string) => (rel: string) => {
  expect(
    fs.existsSync(path.join(process.cwd(), rel)),
    `${rel} is missing. Either the file moved (update ${list} ` +
      `in this test) or it was deleted (the egress guard it provided is gone).`
  ).toBe(true);
};

describe("orientation device-only sources never call out (A-104)", () => {
  it.each(DEVICE_ONLY_SOURCES)("%s is present to scan", presence("DEVICE_ONLY_SOURCES"));

  it.each(DEVICE_ONLY_SOURCES)("%s has no fetch(, no sendBeacon, and imports neither sender", (rel) => {
    const source = read(rel);
    for (const [label, pattern] of BANNED) {
      expect(pattern.test(source), `${rel} contains ${label}`).toBe(false);
    }
  });

  it("the note component never builds a string around the note (F-ORIENT: never echoed inside app copy)", () => {
    // No template interpolation at all: the only place the note's text goes is
    // the textarea's value.
    expect(read("components/orientation-note.tsx")).not.toContain("${");
  });
});

describe("orientation sources that send requests never touch the note (reverse pin)", () => {
  it.each(SENDING_SOURCES)("%s is present to scan", presence("SENDING_SOURCES"));

  it.each(SENDING_SOURCES)("%s never names the note", (rel) => {
    const source = read(rel);
    for (const marker of NOTE_MARKERS) {
      expect(source.includes(marker), `${rel} contains "${marker}"`).toBe(false);
    }
  });
});
