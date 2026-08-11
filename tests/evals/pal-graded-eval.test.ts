/**
 * Live graded quality gate (Plan launch-hardening Phase 3, blocker B3).
 *
 * Runs every fixture case through checkFood and scores the output with the pure
 * rubric (lib/pal/eval-rubric.ts). With PAL_LIVE_EVAL=1 the calls hit the
 * REAL model (run via `npm run eval:pal:live` — it costs money); otherwise it
 * runs against the synthetic mock outputs so the scoring pipeline stays covered
 * under `npm test`.
 *
 * Hard gates (fail the build): zero failed model calls, zero harmful-SAFE, zero
 * usefulness failures, zero adversarial failures. Risk accuracy is enforced only
 * once domain authors the acceptableRisks labels (Task 3.1) — until then it is
 * reported, not gated.
 *
 * The failed-call gate comes first and is load-bearing. Every other gate here
 * reads a *response*, and service.ts turns a provider error into a retry card,
 * which is never SAFE — so without it a run whose model calls all failed scores
 * a perfect safety board over an empty set. A dead key produced exactly that.
 */

import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  DEFAULT_THRESHOLDS,
  scoreRun,
  type GradedRun
} from "../../lib/pal/eval-rubric";
import { activeModelId } from "../../lib/pal/openai-client";
import type { PalModelClient } from "../../lib/pal/openai-client";
import { checkFood } from "../../lib/pal/service";
import { createEvalModelClient, loadEvalCases } from "../support/pal-test-model";

describe("Prediabetes Pal graded quality gate", () => {
  it("holds harmful-SAFE=0, usefulness, adversarial, and (when labeled) accuracy", async () => {
    const cases = loadEvalCases();
    const baseModel = createEvalModelClient(cases);
    const runs: GradedRun[] = [];
    const rows: unknown[] = [];

    // A failed model call is caught in service.ts and returned as a retry card,
    // which is never SAFE — so a provider outage scores zero harmful-SAFE, zero
    // usefulness failures and zero adversarial failures. That is a full green
    // board over an empty set, and it is how the 2026-07-11 bakeoff reported
    // "passed: true" on 46 failed calls. Count the calls: a case that was never
    // evaluated must never be read as a case that came back safe.
    let modelCalls = 0;
    let modelFailures = 0;
    const modelErrors: string[] = [];
    const model: PalModelClient = {
      async generate(prompt) {
        modelCalls += 1;
        // The corpus fires its model calls back-to-back, which trips the
        // provider's per-minute ceiling and 429s the tail of the run — the later
        // categories (carbs_only, adversarial) purely because they are last, not
        // because of anything about them. Wait the throttle out rather than
        // record a safety result we never measured. A per-day quota cannot be
        // waited out, so it still fails the run, which is correct.
        for (let attempt = 0; ; attempt += 1) {
          try {
            return await baseModel.generate(prompt);
          } catch (error) {
            const message =
              error instanceof Error ? error.message : String(error);
            const throttled = message.includes("429");
            const perDay = message.includes("requests per day");

            if (throttled && !perDay && attempt < 5) {
              await new Promise((resolve) =>
                setTimeout(resolve, 8_000 * (attempt + 1))
              );
              continue;
            }

            modelFailures += 1;
            modelErrors.push(message);
            throw error;
          }
        }
      }
    };

    for (const evalCase of cases) {
      const response = await checkFood(evalCase.input, { model });
      runs.push({
        evalCase: {
          id: evalCase.id,
          category: evalCase.category,
          harmfulIfSafe: evalCase.harmfulIfSafe,
          acceptableRisks: evalCase.acceptableRisks,
          knownGap: evalCase.knownGap
        },
        response
      });
      rows.push({
        id: evalCase.id,
        category: evalCase.category,
        harmfulIfSafe: evalCase.harmfulIfSafe,
        acceptableRisks: evalCase.acceptableRisks ?? null,
        kind: response.kind,
        risk: response.kind === "result" ? response.risk : null
      });
    }

    const report = scoreRun(runs, DEFAULT_THRESHOLDS);

    const summary = {
      total: report.total,
      // Cases that reached the model at all. The other 45 (non_food,
      // clinical_risk) short-circuit before prompt construction by design.
      modelCalls,
      modelFailures,
      harmfulSafe: report.harmfulSafe.length,
      labeledCount: report.labeledCount,
      riskCorrect: report.riskCorrect,
      riskAccuracy: report.riskAccuracy,
      usefulnessFailures: report.usefulnessFailures.length,
      adversarialFailures: report.adversarialFailures.length,
      accuracyGate:
        report.labeledCount === 0
          ? "inactive — no domain labels yet (Task 3.1)"
          : `target ${DEFAULT_THRESHOLDS.riskAccuracyTarget}`,
      passed: report.passed
    };

    // PII-free summary — surfaces in the live runner output and CI logs.
    console.info(JSON.stringify({ graded_eval_summary: summary }));

    // W-07: the run must leave evidence on disk. Prior to this the only record
    // of a live run was prose in a QA doc, so no one could re-read the result.
    const dir = path.join(process.cwd(), "artifacts/qa");
    fs.mkdirSync(dir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const live = process.env.PAL_LIVE_EVAL === "1";
    const artifact = path.join(
      dir,
      `graded-eval-${live ? "live" : "mock"}-${stamp}.json`
    );
    fs.writeFileSync(
      artifact,
      JSON.stringify(
        {
          live,
          // The resolved id, not the raw env var: an artifact that cannot name
          // the model that produced it is not evidence of that model.
          model: live ? activeModelId() : "mock",
          summary,
          modelErrors,
          cases: rows
        },
        null,
        2
      )
    );
    console.info(`graded_eval_artifact: ${artifact}`);

    // Gate 0, and it must come first: a failed call is scored as a retry card,
    // never as SAFE, so every gate below it passes vacuously on an empty set.
    // Zero harmful-SAFE across zero evaluated cases is not a safety result.
    expect(
      modelFailures,
      `${modelFailures}/${modelCalls} model calls FAILED at the provider — the gates below cannot see these cases, so a green board here would be over an empty set, not a safe one`
    ).toBe(0);

    expect(
      report.harmfulSafe,
      `harmful-SAFE results: ${report.harmfulSafe.join(", ")}`
    ).toEqual([]);
    expect(
      report.usefulnessFailures,
      `usefulness failures: ${report.usefulnessFailures.join(", ")}`
    ).toEqual([]);
    expect(
      report.adversarialFailures,
      `adversarial failures: ${report.adversarialFailures.join(", ")}`
    ).toEqual([]);

    if (report.riskAccuracy !== null) {
      expect(report.riskAccuracy).toBeGreaterThanOrEqual(
        DEFAULT_THRESHOLDS.riskAccuracyTarget
      );
    }

    expect(report.passed).toBe(true);
    // Live: 24 model calls that may each back off through a per-minute
    // throttle. The mock path still finishes in milliseconds.
  }, 1_800_000);
});
