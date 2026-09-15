import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

// `scripts/validate-safety-contract.mjs` guards its module-level `main()`
// call behind an entry-point check (this file's resolved real path vs the
// resolved real `process.argv[1]`), so importing these two exports here never
// runs the CLI's validation pass or `process.exit` -- see the guard right
// above `main()`'s only call site in that file.
import {
  getCopyLedgerRows,
  splitTableRow
} from "../../../scripts/validate-safety-contract.mjs";

const ROOT = process.cwd();
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), "utf8");

/**
 * Review A-115 (contract half) regression coverage.
 *
 * Task 1.7 added a cell-count check to the copy-ledger table parser (a stray
 * `|` inside a Copy cell, used instead of ` · `, used to silently shift
 * every later column with no failure at all -- verified empirically at the
 * time, but only in an uncommitted scratch harness recorded in
 * `.superpowers/sdd/2026-09-13-guide-redesign/task-1.7+1.13-report.md`).
 * That check depends on `splitTableRow` being backtick-aware, because the
 * real ledger's `landing-hero-moment` row documents a regex alternation
 * whose `|` characters are inside a code span and must NOT be treated as
 * column separators. Neither piece of logic had a durable test before this
 * file -- a regression to either would only ever be caught by chance,
 * whenever someone next broke a ledger row by hand.
 */
describe("validate-safety-contract.mjs: splitTableRow", () => {
  it("keeps a `|` inside backticks in one cell (the landing-hero-moment regex case)", () => {
    const row =
      "| `test-id` | Product | Approved | Yes | `product-role` | Some copy. | EV-1 | The `diagnose` family regex (`/\\bdiagnos(?:e|es|ed|ing|is|tic|tics)\\b/i`) is word-bounded. |";

    const cells = splitTableRow(row);

    expect(cells).toHaveLength(8);
    expect(cells[7]).toContain("e|es|ed|ing|is|tic|tics");
  });

  it("still splits on a plain, unprotected `|`", () => {
    expect(splitTableRow("| a | b | c |")).toEqual(["a", "b", "c"]);
  });

  it("strips one pair of wrapping backticks from a simple cell", () => {
    expect(splitTableRow("| `guide-ideas-lunch` | Home |")).toEqual([
      "guide-ideas-lunch",
      "Home"
    ]);
  });
});

describe("validate-safety-contract.mjs: copy-ledger cell-count check (review A-115)", () => {
  const HEADER =
    "| Copy ID | Surface | Status | Active | Allowed Claim Class | Copy | Evidence Rows | Notes |";
  const SEPARATOR = "| --- | --- | --- | --- | --- | --- | --- | --- |";

  it("a row with a stray `|` (9 cells instead of 8) fails, naming its Copy ID", () => {
    const badRow =
      "| `test-row` | Product | Pending | Yes | `product-role` | a | b | c | d |";
    const table = [HEADER, SEPARATOR, badRow].join("\n");

    const failures: string[] = [];
    getCopyLedgerRows(table, failures);

    expect(failures).toEqual([
      "copy ledger row `test-row` has 9 cells; a `|` inside the Copy cell? use ` · `"
    ]);
  });

  it("a well-formed 8-cell row produces no cell-count failure", () => {
    const goodRow =
      "| `test-row` | Product | Pending | Yes | `product-role` | a | b | c |";
    const table = [HEADER, SEPARATOR, goodRow].join("\n");

    const failures: string[] = [];
    getCopyLedgerRows(table, failures);

    expect(failures).toEqual([]);
  });

  it("the real docs/safety/copy-ledger.md produces no cell-count failure", () => {
    const failures: string[] = [];
    const rows = getCopyLedgerRows(read("docs/safety/copy-ledger.md"), failures);

    expect(failures).toEqual([]);
    // Sanity: the parser actually found the real table, not an empty one.
    expect(rows.length).toBeGreaterThan(50);
  });
});

/**
 * Fix wave 1, F4. That same entry guard decides whether `npm run contract`
 * validates anything at all. `process.argv[1]` is the path as invoked, so
 * before the realpath fix a symlinked checkout, a symlinked
 * `node_modules/.bin` shim, or a symlinked parent directory made the
 * comparison false: `main()` never ran, the process exited 0, and the gate
 * was green having validated nothing. These two spawns are the cheapest
 * honest check -- they assert the validator's own output line, not just the
 * exit code, so a guard that stops running fails loudly here.
 */
describe("validate-safety-contract.mjs: the CLI actually runs (fix wave 1)", () => {
  const SCRIPT = "scripts/validate-safety-contract.mjs";
  const PASSED = /Safety contract validation passed for:/;
  const run = (entry: string) =>
    spawnSync(process.execPath, [entry], { cwd: ROOT, encoding: "utf8" });

  it("prints validator output when run the way `npm run contract` does", () => {
    const result = run(SCRIPT);

    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout, "exit 0 with no validator output = validated nothing").toMatch(PASSED);
  });

  it("still runs through a symlinked entry path (the guard's failure mode)", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "contract-entry-"));
    const link = path.join(dir, "contract-link.mjs");
    try {
      fs.symlinkSync(path.join(ROOT, SCRIPT), link);
      const result = run(link);

      expect(result.status, result.stderr).toBe(0);
      expect(result.stdout, "the entry guard skipped main() under a symlink").toMatch(PASSED);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
