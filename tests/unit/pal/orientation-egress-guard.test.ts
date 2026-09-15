// tests/unit/pal/orientation-egress-guard.test.ts
import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * A-104: the real egress risk for the clinician-questions note is client
 * code, not the server-side walk in orientation-store.test.ts. This pins
 * every client-side file that touches the note to never call `fetch(` or
 * `navigator.sendBeacon` — the two ways client code phones home.
 *
 * Task 3.6 adds "components/orientation-note.tsx" to this list in the same
 * commit that creates the file. A listed path that does not exist is a test
 * failure, not a silent skip — a pin that can drop a path unnoticed protects
 * nothing.
 */
const DEVICE_ONLY_SOURCES = ["lib/client/orientation-store.ts"] as const;

const BANNED = ["fetch(", "navigator.sendBeacon"] as const;

describe("orientation device-only sources never call out (A-104)", () => {
  it.each(DEVICE_ONLY_SOURCES)("%s is present to scan", (rel) => {
    const full = path.join(process.cwd(), rel);
    expect(
      fs.existsSync(full),
      `${rel} is missing. Either the file moved (update DEVICE_ONLY_SOURCES ` +
        `in this test) or it was deleted (the egress guard it provided is gone).`
    ).toBe(true);
  });

  it.each(DEVICE_ONLY_SOURCES)("%s has no fetch( and no navigator.sendBeacon", (rel) => {
    const source = fs.readFileSync(path.join(process.cwd(), rel), "utf8");
    for (const banned of BANNED) {
      expect(source.includes(banned), `${rel} contains "${banned}"`).toBe(false);
    }
  });
});
