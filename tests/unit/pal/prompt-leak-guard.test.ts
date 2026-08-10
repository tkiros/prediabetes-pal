import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * The prompt-leak guard is keyed to the product name, and nothing asserted it.
 *
 * `postprocess.ts` and `eval-rubric.ts` both detect a leaked system prompt by
 * matching `you are <product>`. The 2026-08-09 rename changed prompt.ts's
 * opening line to "You are Prediabetes Pal's ..." and left both regexes
 * matching "you are revora" — so for one day the guard could not fire on the
 * exact string it exists to catch. 2,214 tests passed throughout, because the
 * pairing between the prompt and its detector was never expressed as a test.
 *
 * This asserts the coupling directly: whatever identity the system prompt
 * claims, both detectors must catch a model echoing it back.
 */

const ROOT = process.cwd();

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

/** The `You are <identity>` line the system prompt actually ships. */
function promptIdentityLine(): string {
  const source = read("lib/pal/prompt.ts");
  const match = /"(You are [^"]+)"/.exec(source);
  if (!match) {
    throw new Error(
      'lib/pal/prompt.ts no longer contains a "You are ..." identity line — ' +
        "update this test and both leak regexes together."
    );
  }
  return match[1];
}

const DETECTORS = [
  "lib/pal/postprocess.ts",
  "lib/pal/eval-rubric.ts"
] as const;

/** Pull the leak-detection regex literal out of a detector module. */
function leakRegex(rel: string): RegExp {
  const source = read(rel);
  const match = /\/\\b\(system prompt\|[^/]+\)\\b\/i/.exec(source);
  if (!match) {
    throw new Error(`no prompt-leak regex found in ${rel}`);
  }
  // Rebuild from the literal so the test reads the shipped pattern, not a copy.
  const body = match[0].replace(/^\//, "").replace(/\/i$/, "");
  return new RegExp(body, "i");
}

describe("prompt-leak guard", () => {
  const identity = promptIdentityLine();

  it.each(DETECTORS)("%s catches the shipped prompt identity", (rel) => {
    // A model echoing its instructions back verbatim is the exact failure.
    expect(leakRegex(rel).test(identity)).toBe(true);
  });

  it.each(DETECTORS)("%s still catches generic leak markers", (rel) => {
    const regex = leakRegex(rel);
    expect(regex.test("Here is my system prompt:")).toBe(true);
    expect(regex.test("allowed response kinds")).toBe(true);
  });

  it.each(DETECTORS)("%s does not fire on ordinary guidance", (rel) => {
    const regex = leakRegex(rel);
    expect(regex.test("This leans carb-heavy for your range.")).toBe(false);
    expect(regex.test("Add protein or nonstarchy vegetables.")).toBe(false);
  });

  it("both detectors use the same pattern", () => {
    const [a, b] = DETECTORS.map((rel) => leakRegex(rel).source);
    // They are duplicated literals; drift between them is silent half-coverage.
    expect(a).toBe(b);
  });
});
