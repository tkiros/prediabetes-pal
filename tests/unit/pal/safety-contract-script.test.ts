import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

// `scripts/validate-safety-contract.mjs` guards its module-level `main()`
// call behind an entry-point check (`process.argv[1] === fileURLToPath(
// import.meta.url)`), so importing these two exports here never runs the
// CLI's validation pass or `process.exit` -- see the guard right above
// `main()`'s only call site in that file.
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
