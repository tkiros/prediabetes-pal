import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Truth-index C7: "wellness tool, not a medical device" is a device-status
// assertion counsel has not classified (docs/legal/counsel-panel-review-2026-07-12.md
// says do not state it). It was removed from every product surface; this pin
// keeps it out until counsel supplies wording. Historical docs are exempt on
// purpose (CLAUDE.md: audit/handoff records are not rewritten).
const SCAN_DIRS = ["app", "components", "lib"];
const SCAN_FILES = ["README.md", "docs/product-marketing.md"];
const FORBIDDEN = /medical device|wellness tool/i;

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(tsx?|mdx?|txt|json)$/.test(entry)) out.push(full);
  }
  return out;
}

describe("device-status wording stays out of product copy (truth-index C7)", () => {
  const files = [
    ...SCAN_DIRS.flatMap((d) => walk(resolve(process.cwd(), d))),
    // Optional surfaces: scanned when present (there is no README.md today).
    ...SCAN_FILES.map((f) => resolve(process.cwd(), f)).filter((f) => existsSync(f))
  ];

  it("scans a non-trivial surface", () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it("finds no 'medical device' / 'wellness tool' assertion", () => {
    const hits = files.filter((f) => FORBIDDEN.test(readFileSync(f, "utf8")));
    expect(hits).toEqual([]);
  });
});
