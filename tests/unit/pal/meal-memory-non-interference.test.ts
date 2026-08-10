import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Global constraint §1 / plan §P3.2, §8: meal memory is "Never an input to
 * card-band logic." That is a STRUCTURAL guarantee here, not a convention: the
 * check engine (lib/pal/*) must not import any meal-memory module, so a
 * memory physically cannot reach the card-band decision, no matter what a future
 * edit does inside the engine.
 *
 * This is the copy-pins source-scan pattern (tests/unit/pal/copy-pins,
 * privacy-minimal): read every engine source file and assert none of them
 * reference a memory module by path or by symbol.
 */

const PROJECT_ROOT = process.cwd();

// The modules that carry meal-memory logic. If the engine imported ANY of these
// — by relative path or by the barrel symbol — a memory could feed the card.
const FORBIDDEN_IMPORT_PATTERNS = [
  /meal-memory-flag/,
  /client\/memory/,
  /api\/memory/,
  /meal-memory-save/,
  /\bmealMemories\b/,
  /\bmealMemory(?:UiEnabled|ServerEnabled)\b/
];

function collectTsFiles(relativeDir: string): string[] {
  const absoluteDir = path.join(PROJECT_ROOT, relativeDir);
  return fs
    .readdirSync(absoluteDir, { recursive: true })
    .filter((entry) => typeof entry === "string")
    .map((entry) => path.join(relativeDir, entry as string))
    .filter((entry) => entry.endsWith(".ts") || entry.endsWith(".tsx"));
}

describe("meal memory never feeds the check engine", () => {
  const engineFiles = collectTsFiles("lib/pal");

  it("scans the whole engine (guards against an empty glob)", () => {
    expect(engineFiles.length).toBeGreaterThan(5);
  });

  it.each(FORBIDDEN_IMPORT_PATTERNS.map((p) => [p.source, p] as const))(
    "no lib/pal source references %s",
    (_label, pattern) => {
      const offenders = engineFiles.filter((file) =>
        pattern.test(fs.readFileSync(path.join(PROJECT_ROOT, file), "utf8"))
      );
      expect(offenders).toEqual([]);
    }
  );
});
