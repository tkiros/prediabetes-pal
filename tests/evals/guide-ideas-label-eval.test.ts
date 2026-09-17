// ENGINEERING EVIDENCE — live model labels for the reviewed idea bank; NOT
// clinical validation. Owner hand-off: `npm run eval:pal:ideas` (a paid run).
import fs from "node:fs";
import path from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { GUIDE_IDEAS } from "../../lib/pal/guide-ideas";
import { activeModelId, type PalModelClient } from "../../lib/pal/openai-client";
import { PROMPT_VERSION } from "../../lib/pal/prompt";
import { checkFood } from "../../lib/pal/service";
import {
  LABEL_BANDS,
  LABEL_MAX_RERUNS,
  LABEL_RUNS_PER_CELL,
  buildLabelsFile,
  classifyCell,
  describeModelError,
  isIdeasLabelEvalEnabled,
  stripProviderPrefix,
  type CellLabel,
  type CellResult,
  type LabelBand,
  type RunOutcome
} from "../support/guide-ideas-label-eval";
import { createEvalModelClient } from "../support/pal-test-model";

/**
 * Task 4.1 — review-time labelling of the idea bank, keyed on PROMPT_VERSION
 * (PRD v1.1 §6 F-IDEAS: every idea reads Clear at every band 5.7–6.4).
 *
 * Each idea × A1C 5.9 / 6.2 / 6.4 (the most conservative value per band) runs
 * twenty times through the real checkFood (review A-107). A cell passes only
 * when all twenty are SAFE results; a real MODERATE / HIGH fails it; a retry, a
 * throw or a non-result kind makes it inconclusive and it is re-run up to three
 * more times (A-27) — still inconclusive, it is written as `inconclusive` and
 * the eval fails loudly, because a transient must never prune an idea. The rule
 * itself is pinned without a key in tests/unit/pal/guide-ideas-labels.test.ts.
 *
 * Writes lib/pal/guide-ideas.labels.json ({ promptVersion, model, labels })
 * and prints every failing / inconclusive cell. It never edits the bank: an
 * idea that fails is removed from GUIDE_IDEA_BANK by hand in the same PR, the
 * ledger row's Notes say which and why, and the eval is re-run.
 *
 * Gate: PAL_LIVE_EVAL=1 AND this eval's own PAL_EVAL_IDEAS=1 (review fix:
 * PAL_LIVE_EVAL alone also arms the other live evals, so a broad live run
 * would otherwise buy these calls and overwrite a reviewed labels file).
 * `npm run eval:pal:ideas` sets both. Without both the suite skips and nothing
 * is constructed; with both but no OPENAI_API_KEY, the client construction in
 * beforeAll throws — a run the owner asked for fails loudly instead of
 * skipping or writing a file of fake inconclusives.
 */

const LABELS_PATH = path.join(process.cwd(), "lib/pal/guide-ideas.labels.json");

// Runs inside one cell go out a few at a time: sequential is ~1,440 × ~5s.
const CELL_CONCURRENCY = 4;
// Per idea: 3 bands × up to 4 attempts × 20 runs, each call bounded by the
// transport's 10s timeout (plus its connection retry).
const IDEA_TIMEOUT_MS = 1_800_000;

type CellRow = { id: string; band: LabelBand; attempts: number } & CellResult;

async function runOnce(model: PalModelClient, food: string, a1c: number): Promise<RunOutcome> {
  let modelError: string | undefined;
  try {
    const response = await checkFood(
      { food, a1c },
      { model, onModelError: (error) => (modelError = describeModelError(error)) }
    );
    return modelError ? { response, modelError } : { response };
  } catch (error) {
    return { error };
  }
}

async function runAttempt(model: PalModelClient, food: string, a1c: number): Promise<RunOutcome[]> {
  const runs: RunOutcome[] = [];
  for (let start = 0; start < LABEL_RUNS_PER_CELL; start += CELL_CONCURRENCY) {
    const batch = Math.min(CELL_CONCURRENCY, LABEL_RUNS_PER_CELL - start);
    runs.push(...(await Promise.all(Array.from({ length: batch }, () => runOnce(model, food, a1c)))));
  }
  return runs;
}

/** Twenty runs; an inconclusive attempt is re-run whole, up to LABEL_MAX_RERUNS more times. */
async function runCell(
  model: PalModelClient,
  food: string,
  a1c: number
): Promise<CellResult & { attempts: number }> {
  let attempts = 1;
  let cell = classifyCell(await runAttempt(model, food, a1c));
  while (cell.verdict === "inconclusive" && attempts <= LABEL_MAX_RERUNS) {
    attempts += 1;
    cell = classifyCell(await runAttempt(model, food, a1c));
  }
  return { ...cell, attempts };
}

describe.skipIf(!isIdeasLabelEvalEnabled(process.env))(
  "eval:pal:ideas (live; skips unless PAL_LIVE_EVAL=1 and PAL_EVAL_IDEAS=1 — run `npm run eval:pal:ideas`) — every idea reads Clear at A1C 5.9 / 6.2 / 6.4, twenty of twenty runs",
  () => {
    let model: PalModelClient | undefined;
    const cells: Record<string, Partial<Record<LabelBand, CellLabel>>> = {};
    const rows: CellRow[] = [];

    beforeAll(() => {
      // The instance, not a lazy factory: a factory that throws inside
      // checkFood is swallowed into `retry`, which would turn a missing key
      // into 1,440 inconclusive cells instead of one clear error.
      model = createEvalModelClient([]);
    });

    afterAll(() => {
      // Nothing ran (the client never constructed): leave any committed file alone.
      if (rows.length === 0) return;

      const file = buildLabelsFile({
        promptVersion: PROMPT_VERSION,
        model: stripProviderPrefix(activeModelId()),
        ideas: GUIDE_IDEAS,
        cells
      });
      fs.writeFileSync(LABELS_PATH, `${JSON.stringify(file, null, 2)}\n`);

      const notPassing = rows.filter((row) => row.verdict !== "pass");
      console.info(
        `guide idea labels: ${rows.length} of ${GUIDE_IDEAS.length * LABEL_BANDS.length} cells ran — ` +
          `${rows.length - notPassing.length} pass, ` +
          `${notPassing.filter((row) => row.verdict === "fail").length} fail, ` +
          `${notPassing.filter((row) => row.verdict === "inconclusive").length} inconclusive ` +
          `(prompt ${file.promptVersion}, model ${file.model}) → ${path.relative(process.cwd(), LABELS_PATH)}`
      );
      if (notPassing.length > 0) {
        console.table(
          notPassing.map((row) => ({
            id: row.id,
            band: row.band,
            verdict: row.verdict,
            attempts: row.attempts,
            SAFE: row.tally.SAFE,
            MODERATE: row.tally.MODERATE,
            HIGH: row.tally.HIGH,
            inconclusive: row.tally.inconclusive,
            reason: row.label.reason
          }))
        );
        console.error(
          "guide idea labels: prune every `fail` idea from GUIDE_IDEA_BANK by hand (ledger Notes: which and why) " +
            "and re-run; an `inconclusive` cell is a transient — re-run, never prune on it."
        );
      }
    });

    it.each(GUIDE_IDEAS.map((idea) => [idea.id, idea.text] as const))(
      "%s (%s)",
      async (id, text) => {
        if (!model) throw new Error("eval model client was not constructed");
        const missed: string[] = [];

        // All three bands run before asserting, so one red band never hides the others.
        for (const { band, a1c } of LABEL_BANDS) {
          const cell = await runCell(model, text, a1c);
          (cells[id] ??= {})[band] = cell.label;
          rows.push({ id, band, ...cell });
          if (cell.verdict !== "pass") missed.push(`${band}: ${cell.verdict} (${cell.label.risk})`);
        }

        expect(missed, `${id} "${text}" is not Clear at every band`).toEqual([]);
      },
      IDEA_TIMEOUT_MS
    );
  }
);
