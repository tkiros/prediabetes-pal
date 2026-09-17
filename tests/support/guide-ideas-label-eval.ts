import type { A1CBand } from "../../lib/pal/a1c";
import type { PalRisk, PalUserResponse } from "../../lib/pal/schemas";

/**
 * The pure half of the idea-bank labelling eval (Task 4.1): the cell rule,
 * the band map and the labels-file shape. It lives here, not in
 * tests/evals/guide-ideas-label-eval.test.ts, so the unit gate
 * (tests/unit/pal/guide-ideas-labels.test.ts) can pin the rule without a key —
 * importing a *.test.ts file would register the live suite inside the unit
 * file. Nothing here touches the network or the filesystem.
 */

/** Review A-107: three runs pass a 20%-flip idea about half the time; §12's bar is N ≥ 20. */
export const LABEL_RUNS_PER_CELL = 20;

/** Review A-27: an inconclusive cell is re-run up to three more times before it is written as inconclusive. */
export const LABEL_MAX_RERUNS = 3;

/**
 * The live eval's gate: the shared `PAL_LIVE_EVAL=1` (what
 * createEvalModelClient keys the live client on) AND its own
 * `PAL_EVAL_IDEAS=1` — the EVAL_MEAL_PHOTO_LIVE precedent. `PAL_LIVE_EVAL`
 * alone also arms pal-safety-eval and pal-graded-eval, so a broad
 * `PAL_LIVE_EVAL=1 vitest run tests/evals` must not also buy ~1,440 calls and
 * overwrite a reviewed lib/pal/guide-ideas.labels.json. `npm run
 * eval:pal:ideas` sets both.
 */
export function isIdeasLabelEvalEnabled(env: Readonly<Record<string, string | undefined>>): boolean {
  return env.PAL_LIVE_EVAL === "1" && env.PAL_EVAL_IDEAS === "1";
}

/** The most conservative A1C in each prediabetes band. */
export const LABEL_BANDS = [
  { band: "prediabetes_57_59", a1c: 5.9 },
  { band: "prediabetes_60_62", a1c: 6.2 },
  { band: "prediabetes_63_64", a1c: 6.4 }
] as const satisfies readonly { band: A1CBand; a1c: number }[];

export type LabelBand = (typeof LABEL_BANDS)[number]["band"];

export type CellLabel = { risk: PalRisk | "inconclusive"; reason: string };

/** lib/pal/guide-ideas.labels.json */
export type GuideIdeaLabels = {
  promptVersion: string;
  /** activeModelId() with any provider prefix ("openai/") stripped — A-117. */
  model: string;
  labels: Record<string, { text: string } & Record<LabelBand, CellLabel>>;
};

/**
 * One checkFood call: the response it returned (with the provider error that
 * checkFood turned into `retry`, when there was one), or what it threw.
 */
export type RunOutcome = { response: PalUserResponse; modelError?: string } | { error: unknown };

export type CellVerdict = "pass" | "fail" | "inconclusive";

export type CellTally = Record<PalRisk | "inconclusive", number>;

export type CellResult = { verdict: CellVerdict; label: CellLabel; tally: CellTally };

const RISK_ORDER: Record<PalRisk, number> = { SAFE: 0, MODERATE: 1, HIGH: 2 };

/**
 * A cell passes only when all `expectedRuns` runs are `result` with risk SAFE
 * (reason: the first run's). A real MODERATE / HIGH result fails it — and
 * outranks any transient in the same cell, because it is evidence (reason: the
 * first run at the worst risk seen). Otherwise a retry, a throw, any non-result
 * kind or a short run makes it inconclusive: re-run it, never prune on it.
 */
export function classifyCell(
  runs: readonly RunOutcome[],
  expectedRuns: number = LABEL_RUNS_PER_CELL
): CellResult {
  const tally: CellTally = { SAFE: 0, MODERATE: 0, HIGH: 0, inconclusive: 0 };
  const oddKinds = new Set<string>();
  let worst: { risk: PalRisk; reason: string } | undefined;
  let firstReason: string | undefined;

  for (const run of runs) {
    if (!("response" in run)) {
      tally.inconclusive += 1;
      oddKinds.add(`thrown ${describeModelError(run.error)}`);
      continue;
    }
    const { response } = run;
    if (response.kind !== "result") {
      tally.inconclusive += 1;
      oddKinds.add(run.modelError ? `${response.kind} (${run.modelError})` : response.kind);
      continue;
    }
    tally[response.risk] += 1;
    firstReason ??= response.reason;
    if (!worst || RISK_ORDER[response.risk] > RISK_ORDER[worst.risk]) {
      worst = { risk: response.risk, reason: response.reason };
    }
  }

  if (worst && worst.risk !== "SAFE") {
    return { verdict: "fail", label: { risk: worst.risk, reason: worst.reason }, tally };
  }

  if (tally.inconclusive > 0 || tally.SAFE < expectedRuns || firstReason === undefined) {
    const why = [
      tally.inconclusive > 0 ? `${tally.inconclusive} returned ${[...oddKinds].sort().join(" / ")}` : "",
      runs.length < expectedRuns ? `only ${runs.length} of ${expectedRuns} ran` : ""
    ]
      .filter(Boolean)
      .join("; ");
    return {
      verdict: "inconclusive",
      label: { risk: "inconclusive", reason: `inconclusive: ${why}` },
      tally
    };
  }

  return { verdict: "pass", label: { risk: "SAFE", reason: firstReason }, tally };
}

/**
 * The error's class and HTTP status ("RateLimitError 429"), never its message:
 * enough to tell a rate limit from a timeout in the failure table, and a
 * handful of distinct values rather than one per request.
 */
export function describeModelError(error: unknown): string {
  const name = error instanceof Error ? error.constructor.name || error.name : typeof error;
  const status = (error as { status?: unknown } | null)?.status;
  return typeof status === "number" ? `${name} ${status}` : name;
}

/**
 * "openai/gpt-5.4-mini" → "gpt-5.4-mini". Lives in lib/pal/model-id.ts so the
 * production door guard (lib/guide-door-guard.ts) strips exactly as this eval
 * writes the labels file's `model` — next.config.ts cannot import tests/.
 */
export { stripProviderPrefix } from "../../lib/pal/model-id";

/**
 * The labels file, in bank order. A band that never finished (a timed-out or
 * interrupted idea) is written as inconclusive, so the unit gate reads red
 * rather than the entry going missing.
 */
export function buildLabelsFile(input: {
  promptVersion: string;
  model: string;
  ideas: readonly { id: string; text: string }[];
  cells: Readonly<Record<string, Partial<Record<LabelBand, CellLabel>>>>;
}): GuideIdeaLabels {
  const labels: GuideIdeaLabels["labels"] = {};
  for (const idea of input.ideas) {
    const done = input.cells[idea.id] ?? {};
    const entry = { text: idea.text } as GuideIdeaLabels["labels"][string];
    for (const { band } of LABEL_BANDS) {
      entry[band] = done[band] ?? { risk: "inconclusive", reason: "inconclusive: the cell did not complete" };
    }
    labels[idea.id] = entry;
  }
  return { promptVersion: input.promptVersion, model: input.model, labels };
}
