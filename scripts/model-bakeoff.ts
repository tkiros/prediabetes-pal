#!/usr/bin/env npx tsx
/**
 * Model bake-off: compare two model IDs on the FROZEN eval corpus
 * (tests/fixtures/pal-eval-cases.json) through the IDENTICAL production
 * pipeline — buildPalPrompt → Responses API w/ strict json_schema →
 * PalModelOutputSchema → postprocess floors → fail-closed retry. Parity is
 * structural: both models go through createOpenAIPalModelClient with the
 * same instructions, schema, and (absent) reasoning/temperature settings.
 *
 * Provider parity (N-19): live calls default to OpenAI-direct — production's
 * own path. Set OPENAI_BASE_URL (e.g. https://openrouter.ai/api/v1) plus
 * provider-prefixed model ids via PAL_MODEL_NANO/MINI to test elsewhere;
 * that is a deviation from production and the artifact records the base URL.
 *
 * Documented deviation from the production call (applied to BOTH models):
 * max_output_tokens=1024 parity cap (see MAX_OUTPUT_TOKENS).
 *
 * Modes:
 *   --dry-run  print the plan (cases, models, caps); no network. DEFAULT.
 *   --mock     run corpus through the pipeline with fixture mockModelOutput;
 *              validates the harness deterministically (CI-safe, no key).
 *   --live     real calls. Requires OPENAI_API_KEY (or OPENROUTER_API_KEY
 *              together with OPENAI_BASE_URL).
 *
 * Budget rails (live): BAKEOFF_MAX_CASES (default all), BAKEOFF_MAX_USD
 * (default 0.50, enforced on provider-reported cost when available),
 * BAKEOFF_MAX_TOKENS_TOTAL (default 200000, enforced always). New calls stop
 * when any rail trips; completed results are still written.
 *
 * Repeat runs to measure variability = re-invoke; each run writes to a fresh
 * artifacts/qa/<timestamp>/ directory (gitignored).
 *
 * Blind review: per-case records label the models "A"/"B" (assignment
 * randomized once per run); the A/B→model mapping is written to a separate
 * unblind.json.
 */

import fs from "node:fs";
import path from "node:path";
import OpenAI from "openai";

import { checkFood } from "../lib/pal/service";
import type { PalModelClient } from "../lib/pal/openai-client";
import { PAL_JSON_SCHEMA_NAME } from "../lib/pal/openai-client";
import {
  PalModelOutputSchema,
  palModelJsonSchema
} from "../lib/pal/schemas";
import type { PalUserResponse } from "../lib/pal/schemas";
import { scoreRun, type GradedRun } from "../lib/pal/eval-rubric";
import { loadEvalCases, type PalEvalCase } from "../tests/support/pal-test-model";

type Mode = "dry-run" | "mock" | "live";

type CallRecord = {
  latencyMs: number;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  reportedCostUsd: number | null;
  outcome:
    | "delivered"
    | "invalid_json"
    | "schema_invalid"
    | "provider_error";
  errorCategory: string | null;
  rawOutput: string | null;
};

type CaseResult = {
  caseId: string;
  category: string;
  blindModel: "A" | "B";
  modelCalled: boolean;
  call: CallRecord | null;
  finalKind: PalUserResponse["kind"];
  finalRisk: string | null;
  pipelineOutcome:
    | "delivered"
    | "deterministic_short_circuit"
    | "contract_failure_fail_closed"
    | "model_failure_fail_closed";
  expectedKindMet: boolean;
  disallowedRiskHit: boolean;
  harmfulIfSafe: boolean;
  acceptableRisks: string[] | null;
  knownGap: boolean;
  harmfulSafe: boolean;
  response: PalUserResponse;
};

const MAX_OUTPUT_TOKENS = 1024; // parity with production openai-client.ts cap

function envNum(name: string, fallback: number): number {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

// Prod-style ids for OpenAI-direct. OpenRouter needs the "openai/" prefix —
// set these envs alongside OPENAI_BASE_URL when deliberately going off-path.
const MODELS = {
  nano: process.env.PAL_MODEL_NANO?.trim() || "gpt-5.4-nano",
  mini: process.env.PAL_MODEL_MINI?.trim() || "gpt-5.4-mini"
};

const CAPS = {
  maxCases: envNum("BAKEOFF_MAX_CASES", Number.MAX_SAFE_INTEGER),
  maxUsd: envNum("BAKEOFF_MAX_USD", 0.5),
  maxTokensTotal: envNum("BAKEOFF_MAX_TOKENS_TOTAL", 200_000)
};

const mode: Mode = process.argv.includes("--live")
  ? "live"
  : process.argv.includes("--mock")
    ? "mock"
    : "dry-run";

// Running spend across the whole run (both models). Checked before each call.
const spend = { totalTokens: 0, reportedUsd: 0, callsBlocked: 0 };

function budgetExhausted(): boolean {
  return (
    spend.totalTokens >= CAPS.maxTokensTotal || spend.reportedUsd >= CAPS.maxUsd
  );
}

/** Wraps the raw SDK so we can measure each call while the production client
 * (createOpenAIPalModelClient) still owns request construction. We inject
 * at one level lower instead: this transport IS handed the exact params the
 * production client builds, adds only max_output_tokens, and records. */
function createInstrumentedClient(
  model: string,
  apiKey: string,
  calls: CallRecord[]
): PalModelClient {
  const sdk = new OpenAI({
    apiKey,
    // Default is OpenAI-direct — the exact provider path production uses
    // (lib/pal/openai-client.ts). A different provider has different
    // failure modes; only test one on purpose, via OPENAI_BASE_URL.
    baseURL: process.env.OPENAI_BASE_URL?.trim() || undefined,
    timeout: 30_000,
    maxRetries: 0
  });

  return {
    async generate(prompt) {
      if (budgetExhausted()) {
        spend.callsBlocked += 1;
        throw new Error("bakeoff_budget_exhausted");
      }

      const record: CallRecord = {
        latencyMs: 0,
        inputTokens: null,
        outputTokens: null,
        totalTokens: null,
        reportedCostUsd: null,
        outcome: "provider_error",
        errorCategory: null,
        rawOutput: null
      };
      calls.push(record);
      const start = Date.now();

      let response: {
        output_text?: string;
        usage?: {
          input_tokens?: number;
          output_tokens?: number;
          total_tokens?: number;
          cost?: number;
        };
      };
      try {
        // Identical to lib/pal/openai-client.ts request shape, plus the
        // documented max_output_tokens deviation (same for both models).
        response = (await sdk.responses.create({
          model,
          instructions: prompt.instructions,
          input: prompt.input,
          store: false,
          max_output_tokens: MAX_OUTPUT_TOKENS,
          text: {
            format: {
              type: "json_schema",
              name: PAL_JSON_SCHEMA_NAME,
              schema: palModelJsonSchema,
              strict: true
            }
          }
        })) as typeof response;
      } catch (error) {
        record.latencyMs = Date.now() - start;
        record.errorCategory =
          error instanceof Error ? error.constructor.name : "unknown";
        throw error;
      }

      record.latencyMs = Date.now() - start;
      const usage = response.usage;
      record.inputTokens = usage?.input_tokens ?? null;
      record.outputTokens = usage?.output_tokens ?? null;
      record.totalTokens = usage?.total_tokens ?? null;
      record.reportedCostUsd = typeof usage?.cost === "number" ? usage.cost : null;
      spend.totalTokens += record.totalTokens ?? 0;
      spend.reportedUsd += record.reportedCostUsd ?? 0;

      const rawText = response.output_text?.trim() ?? "";
      record.rawOutput = rawText.slice(0, 2_000);

      let parsed: unknown;
      try {
        parsed = JSON.parse(rawText);
      } catch (error) {
        record.outcome = "invalid_json";
        throw new Error("model output was not valid JSON", { cause: error });
      }

      const validated = PalModelOutputSchema.safeParse(parsed);
      if (!validated.success) {
        record.outcome = "schema_invalid";
        throw new Error(
          `model output failed PalModelOutputSchema: ${validated.error.message}`
        );
      }

      record.outcome = "delivered";
      return validated.data;
    }
  };
}

function createMockClient(cases: readonly PalEvalCase[]): PalModelClient {
  const byKey = new Map(
    cases.map((c) => [`${c.input.food.trim().toLowerCase()}::${c.input.a1c}`, c])
  );
  return {
    async generate(prompt) {
      const food = prompt.input.match(/^Food:\s+(.+)$/m)?.[1]?.trim() ?? "";
      const a1c = prompt.input.match(/^A1C:\s+([0-9.]+)$/m)?.[1] ?? "";
      const evalCase = byKey.get(`${food.toLowerCase()}::${Number(a1c)}`);
      if (!evalCase?.mockModelOutput) {
        throw new Error(`no mock output for: ${food}`);
      }
      return evalCase.mockModelOutput;
    }
  };
}

async function runModelOverCorpus(
  label: "A" | "B",
  modelId: string,
  cases: readonly PalEvalCase[],
  client: PalModelClient,
  calls: CallRecord[]
): Promise<CaseResult[]> {
  const results: CaseResult[] = [];

  for (const evalCase of cases) {
    const callsBefore = calls.length;
    const response = await checkFood(evalCase.input, { model: client });
    const call = calls.length > callsBefore ? calls[calls.length - 1] : null;

    const finalRisk = response.kind === "result" ? response.risk : null;
    const harmfulSafe =
      evalCase.harmfulIfSafe && response.kind === "result" && response.risk === "SAFE";

    results.push({
      caseId: evalCase.id,
      category: evalCase.category,
      blindModel: label,
      modelCalled: call !== null,
      call,
      finalKind: response.kind,
      finalRisk,
      pipelineOutcome:
        call === null
          ? "deterministic_short_circuit"
          : response.kind === "retry"
            ? call.outcome === "delivered"
              ? "contract_failure_fail_closed"
              : "model_failure_fail_closed"
            : "delivered",
      expectedKindMet: evalCase.expectedKinds.includes(response.kind),
      disallowedRiskHit:
        response.kind === "result" &&
        (evalCase.disallowRisk ?? []).includes(response.risk),
      harmfulIfSafe: evalCase.harmfulIfSafe,
      acceptableRisks: evalCase.acceptableRisks ?? null,
      knownGap: evalCase.knownGap ?? false,
      harmfulSafe,
      response
    });

    process.stderr.write(
      `  [${label}] ${evalCase.id}: ${response.kind}${finalRisk ? `/${finalRisk}` : ""}${
        call ? ` ${call.latencyMs}ms` : " (no model call)"
      }\n`
    );
  }

  return results;
}

function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
}

function summarize(modelId: string, results: CaseResult[]) {
  const called = results.filter((r) => r.modelCalled);
  const latencies = called
    .map((r) => r.call?.latencyMs)
    .filter((v): v is number => typeof v === "number");
  const costs = called
    .map((r) => r.call?.reportedCostUsd)
    .filter((v): v is number => typeof v === "number");

  const gradedRuns: GradedRun[] = results.map((r) => ({
    evalCase: {
      id: r.caseId,
      category: r.category,
      harmfulIfSafe: r.harmfulIfSafe,
      acceptableRisks: (r.acceptableRisks ?? undefined) as
        | ("SAFE" | "MODERATE" | "HIGH")[]
        | undefined,
      // P1.4 known-gap marker: the rubric tracks these in the corpus report and
      // excludes them from the hard gate — dropping the field here made the
      // bakeoff gate on gaps the corpus explicitly declared.
      knownGap: r.knownGap
    },
    response: r.response
  }));

  return {
    modelId,
    cases: results.length,
    modelCalls: called.length,
    schemaValidRate:
      called.length > 0
        ? called.filter((r) => r.call?.outcome === "delivered").length / called.length
        : null,
    deliveredRate:
      called.length > 0
        ? called.filter((r) => r.pipelineOutcome === "delivered").length / called.length
        : null,
    contractFailures: called.filter(
      (r) => r.pipelineOutcome === "contract_failure_fail_closed"
    ).length,
    providerFailures: called.filter(
      (r) => r.pipelineOutcome === "model_failure_fail_closed"
    ).length,
    expectedKindRate:
      results.length > 0
        ? results.filter((r) => r.expectedKindMet).length / results.length
        : null,
    // Cases that ended in an actual delivered verdict (any mode). The gate
    // keys on this, not modelCalls — mock mode never touches the call log.
    deliveredResults: results.filter((r) => r.finalKind === "result").length,
    harmfulSafeCount: results.filter((r) => r.harmfulSafe).length,
    disallowedRiskCount: results.filter((r) => r.disallowedRiskHit).length,
    rubric: scoreRun(gradedRuns),
    latencyMs: {
      p50: percentile(latencies, 50),
      p95: percentile(latencies, 95),
      p99: percentile(latencies, 99)
    },
    reportedCostUsd: {
      total: costs.reduce((a, b) => a + b, 0),
      median: percentile(costs, 50)
    },
    tokensTotal: called.reduce((a, r) => a + (r.call?.totalTokens ?? 0), 0)
  };
}

async function main() {
  const allCases = loadEvalCases();
  const cases = allCases.slice(0, CAPS.maxCases);
  const droppedCases = allCases.length - cases.length;

  console.log(`Mode: ${mode}`);
  console.log(`Corpus: ${cases.length}/${allCases.length} cases` +
    (droppedCases > 0 ? ` (BAKEOFF_MAX_CASES dropped ${droppedCases})` : ""));
  console.log(`Models: nano=${MODELS.nano} mini=${MODELS.mini}`);
  console.log(`Caps: maxUsd=$${CAPS.maxUsd} maxTokens=${CAPS.maxTokensTotal}`);

  if (mode === "dry-run") {
    console.log("Dry run only — no calls made. Use --mock or --live.");
    return;
  }

  const apiKey =
    process.env.OPENAI_API_KEY ?? process.env.OPENROUTER_API_KEY ?? "";
  if (mode === "live" && !apiKey) {
    console.error(
      "SETUP_BLOCKED: export OPENAI_API_KEY to run --live (OPENAI_BASE_URL + OPENROUTER_API_KEY for a deliberate off-provider run)."
    );
    process.exitCode = 1;
    return;
  }

  // Randomize which real model is blind-labeled A vs B for this run.
  const aIsNano = Math.random() < 0.5;
  const assignment: Record<"A" | "B", string> = {
    A: aIsNano ? MODELS.nano : MODELS.mini,
    B: aIsNano ? MODELS.mini : MODELS.nano
  };

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outDir = path.join(process.cwd(), "artifacts", "qa", stamp);
  fs.mkdirSync(outDir, { recursive: true });

  const byLabel: Record<"A" | "B", CaseResult[]> = { A: [], B: [] };
  const callsByLabel: Record<"A" | "B", CallRecord[]> = { A: [], B: [] };

  for (const label of ["A", "B"] as const) {
    const modelId = assignment[label];
    console.log(`\n=== Model ${label}${mode === "mock" ? " (mock)" : ""} ===`);
    const client =
      mode === "mock"
        ? createMockClient(cases)
        : createInstrumentedClient(modelId, apiKey, callsByLabel[label]);
    byLabel[label] = await runModelOverCorpus(
      label,
      modelId,
      cases,
      client,
      callsByLabel[label]
    );
  }

  // Blind per-case records (Model A/B only), mapping kept separate.
  const jsonl = (["A", "B"] as const)
    .flatMap((label) => byLabel[label])
    .map((r) => JSON.stringify(r))
    .join("\n");
  fs.writeFileSync(path.join(outDir, "model-results-sanitised.jsonl"), jsonl);
  fs.writeFileSync(
    path.join(outDir, "unblind.json"),
    JSON.stringify({ assignment, mode, caps: CAPS, corpusSize: cases.length }, null, 2)
  );

  const modelSummaries = (["A", "B"] as const).map((label) =>
    summarize(mode === "mock" ? `mock(${assignment[label]})` : assignment[label],
      byLabel[label])
  );

  // Gate 0 — same defect class the graded eval fixed (deebd07): a rubric can
  // only pass over cases that were actually evaluated. A model whose calls
  // failed at the provider, was budget-blocked, or never got a call must read
  // as FAILED, never as "passed: true" over an empty set (the 2026-07-11
  // bakeoff artifact published exactly that over 46 failed calls).
  const gates = modelSummaries.map((m) => ({
    modelId: m.modelId,
    deliveredResults: m.deliveredResults,
    providerFailures: m.providerFailures,
    passed: m.deliveredResults > 0 && m.providerFailures === 0 && m.rubric.passed
  }));

  const summary = {
    mode,
    timestamp: stamp,
    provider: process.env.OPENAI_BASE_URL?.trim() || "openai-direct",
    corpus: { file: "tests/fixtures/pal-eval-cases.json", cases: cases.length },
    budget: { ...CAPS, spent: spend },
    gates,
    models: modelSummaries
  };
  fs.writeFileSync(
    path.join(outDir, "bakeoff-summary.json"),
    JSON.stringify(summary, null, 2)
  );

  console.log(`\nArtifacts: ${outDir}`);
  console.log(JSON.stringify(summary, null, 2));

  if (spend.callsBlocked > 0) {
    console.warn(
      `BUDGET RAIL TRIPPED: ${spend.callsBlocked} calls were blocked; coverage is PARTIAL, not complete.`
    );
  }

  // dry-run returned before any calls; reaching here means mock or live.
  const gateFailures = gates.filter((g) => !g.passed);
  if (gateFailures.length > 0) {
    console.error(
      `BAKEOFF GATE FAILED: ${gateFailures
        .map((g) => `${g.modelId} (delivered=${g.deliveredResults}, providerFailures=${g.providerFailures})`)
        .join("; ")} — an unevaluated case is not a safe case.`
    );
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
