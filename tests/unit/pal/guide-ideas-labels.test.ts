import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { routeA1C } from "../../../lib/pal/a1c";
import { GUIDE_IDEAS } from "../../../lib/pal/guide-ideas";
import type { PalUserResponse } from "../../../lib/pal/schemas";
import {
  LABEL_BANDS,
  LABEL_RUNS_PER_CELL,
  buildLabelsFile,
  classifyCell,
  describeModelError,
  isIdeasLabelEvalEnabled,
  stripProviderPrefix,
  type GuideIdeaLabels,
  type RunOutcome
} from "../../support/guide-ideas-label-eval";

const LABELS_PATH = path.join(process.cwd(), "lib/pal/guide-ideas.labels.json");
// Review A-114/A-117: the labels file is the OWNER's hand-off (it needs a paid
// live run). Until it exists the labels suite SKIPS with the instruction in its
// title — test:pal stays green for an implementer without a key, and the
// production door guard keeps `ideas` closed until the file is committed. The
// harness rules below run regardless: they need no key and no file.
const hasLabels = fs.existsSync(LABELS_PATH);
const labels: GuideIdeaLabels = hasLabels
  ? JSON.parse(fs.readFileSync(LABELS_PATH, "utf8"))
  : { promptVersion: "", model: "", labels: {} };

const DISCLAIMER = "Educational only.";

function result(risk: "SAFE" | "MODERATE" | "HIGH", reason = `${risk} reason`): RunOutcome {
  return {
    response: { kind: "result", risk, reason, adjustment: null, swap: null, disclaimer: DISCLAIMER }
  };
}

function other(response: PalUserResponse): RunOutcome {
  return { response };
}

function safeRuns(count = LABEL_RUNS_PER_CELL): RunOutcome[] {
  return Array.from({ length: count }, (_, index) => result("SAFE", `reason ${index + 1}`));
}

const RETRY = other({ kind: "retry", message: "Try again.", disclaimer: DISCLAIMER });
const CLARIFY = other({
  kind: "clarify",
  question: "Which kind?",
  examples: ["plain"],
  disclaimer: DISCLAIMER
});

/**
 * The live eval's cell rule (review A-27, A-107), pinned without a key: a
 * cell of twenty runs passes only when every run is a SAFE result; one real
 * MODERATE / HIGH fails it; a retry, a throw or any non-result kind makes it
 * inconclusive (re-run, never pruned on a transient).
 */
describe("guide idea label eval — cell classification", () => {
  it("passes a cell only when all twenty runs are SAFE results, keeping the first run's reason", () => {
    expect(classifyCell(safeRuns())).toMatchObject({
      verdict: "pass",
      label: { risk: "SAFE", reason: "reason 1" }
    });
  });

  it("fails a cell on one real MODERATE or HIGH result, and a real result outranks a transient", () => {
    const moderate = [...safeRuns(19), result("MODERATE", "moved")];
    expect(classifyCell(moderate)).toMatchObject({
      verdict: "fail",
      label: { risk: "MODERATE", reason: "moved" }
    });

    const mixed = [RETRY, result("MODERATE"), result("HIGH", "worst"), ...safeRuns(17)];
    expect(classifyCell(mixed)).toMatchObject({
      verdict: "fail",
      label: { risk: "HIGH", reason: "worst" }
    });
  });

  it("marks a cell inconclusive on a retry, a throw, a non-result kind, or a short run", () => {
    for (const odd of [RETRY, CLARIFY, { error: new Error("socket hang up") }]) {
      const cell = classifyCell([...safeRuns(19), odd]);
      expect(cell.verdict).toBe("inconclusive");
      expect(cell.label.risk).toBe("inconclusive");
      expect(cell.label.reason).toMatch(/\S/);
    }
    expect(classifyCell(safeRuns(19)).verdict).toBe("inconclusive");
  });

  it("names the provider error behind a retry, so an inconclusive cell says why", () => {
    class RateLimitError extends Error {
      status = 429;
    }
    expect(describeModelError(new RateLimitError("slow down"))).toBe("RateLimitError 429");
    expect(describeModelError(new TypeError("boom"))).toBe("TypeError");

    const cell = classifyCell([...safeRuns(19), { ...RETRY, modelError: "RateLimitError 429" }]);
    expect(cell.label.reason).toContain("retry (RateLimitError 429)");
  });

  it("goes live only with both PAL_LIVE_EVAL=1 and its own PAL_EVAL_IDEAS=1 opt-in", () => {
    // A broad `PAL_LIVE_EVAL=1 vitest run tests/evals` arms the other live
    // evals; it must not also buy ~1,800 calls and overwrite a reviewed file.
    expect(isIdeasLabelEvalEnabled({})).toBe(false);
    expect(isIdeasLabelEvalEnabled({ PAL_LIVE_EVAL: "1" })).toBe(false);
    expect(isIdeasLabelEvalEnabled({ PAL_EVAL_IDEAS: "1" })).toBe(false);
    expect(isIdeasLabelEvalEnabled({ PAL_LIVE_EVAL: "1", PAL_EVAL_IDEAS: "true" })).toBe(false);
    expect(isIdeasLabelEvalEnabled({ PAL_LIVE_EVAL: "1", PAL_EVAL_IDEAS: "1" })).toBe(true);
  });

  it("maps 5.9 / 6.2 / 6.4 onto the engine's three prediabetes bands", () => {
    expect(LABEL_BANDS.map(({ a1c }) => a1c)).toEqual([5.9, 6.2, 6.4]);
    for (const { band, a1c } of LABEL_BANDS) expect(routeA1C(a1c).band).toBe(band);
  });

  it("records the model id without a provider prefix (A-117)", () => {
    expect(stripProviderPrefix("openai/gpt-5.4-mini")).toBe("gpt-5.4-mini");
    expect(stripProviderPrefix("gpt-5.4-mini")).toBe("gpt-5.4-mini");
  });

  it("assembles the labels file in bank order, writing an unfinished cell as inconclusive", () => {
    const file = buildLabelsFile({
      promptVersion: "p1",
      model: "m1",
      ideas: [
        { id: "breakfast-1", text: "eggs" },
        { id: "breakfast-2", text: "tofu" }
      ],
      cells: { "breakfast-1": { prediabetes_57_59: { risk: "SAFE", reason: "fine" } } }
    });

    expect(file.promptVersion).toBe("p1");
    expect(file.model).toBe("m1");
    expect(Object.keys(file.labels)).toEqual(["breakfast-1", "breakfast-2"]);
    expect(file.labels["breakfast-1"]).toMatchObject({
      text: "eggs",
      prediabetes_57_59: { risk: "SAFE", reason: "fine" },
      prediabetes_60_62: { risk: "inconclusive" },
      prediabetes_63_64: { risk: "inconclusive" }
    });
    expect(file.labels["breakfast-2"].prediabetes_63_64.risk).toBe("inconclusive");
  });
});

/**
 * PRD v1.1 §6 F-IDEAS: every idea returns Clear at every band 5.7–6.4, and
 * the cache is keyed on PROMPT_VERSION — a prompt bump re-runs every idea
 * (npm run eval:pal:ideas) and pulls any idea whose label moved. Commit
 * 822f44e moved a canonical label class on 2026-08-16; a cache that ignored
 * the prompt version would have kept serving the old one.
 *
 * A-100/A-117: prompt and model freshness are checked by the production door
 * guard (stale labels close the ideas surfaces), not here — a prompt hotfix
 * must never turn test:pal red. This suite checks structure, text and labels;
 * an `inconclusive` cell fails its SAFE assertion.
 */
describe.skipIf(!hasLabels)(
  "guide idea labels — Clear at every band (skips without the labels file: run `npm run eval:pal:ideas` — OPENAI_API_KEY, ~1,800 calls at twenty per cell, about $19 — and commit lib/pal/guide-ideas.labels.json)",
  () => {
    it.each(GUIDE_IDEAS.map((idea) => [idea.id, idea.text] as const))(
      "%s (%s) reads Clear at every band",
      (id, text) => {
        for (const { band } of LABEL_BANDS) {
          expect(labels.labels[id]?.text, `${id} text drifted since the eval (A-91)`).toBe(text);
          expect(labels.labels[id]?.[band]?.risk, `${id} @ ${band}`).toBe("SAFE");
          expect(labels.labels[id]?.[band]?.reason).toMatch(/\S/);
        }
      }
    );

    it("carries no idea that is no longer in the bank (stale entries are pruned)", () => {
      const ids = new Set(GUIDE_IDEAS.map((idea) => idea.id));
      for (const id of Object.keys(labels.labels)) expect(ids.has(id), id).toBe(true);
    });
  }
);
