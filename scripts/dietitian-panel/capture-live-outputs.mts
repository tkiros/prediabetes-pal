/**
 * Capture full live product outputs for the dietitian panel.
 * Runs the REAL product path (checkFood: clinical gate, precheck, prompt,
 * model, postprocess floors) for every labeled case + clinical_risk cases.
 * Usage: PAL_LIVE_EVAL=1 OPENAI_BASE_URL=... OPENAI_API_KEY=... \
 *        PAL_MODEL=openai/gpt-5.4-mini \
 *        npx tsx scripts/dietitian-panel/capture-live-outputs.mts <out.json> [cases.json]
 * Optional second arg: a review-corpus fixture (same case schema) to capture
 * instead of the default gate corpus in tests/fixtures/pal-eval-cases.json.
 */
import fs from "node:fs";

import { checkFood } from "../../lib/pal/service";
import {
  createEvalModelClient,
  loadEvalCases
} from "../../tests/support/pal-test-model";

const out = process.argv[2];
const corpusPath = process.argv[3];
if (!out) throw new Error("usage: capture-live-outputs.mts <out.json> [cases.json]");

const cases = corpusPath
  ? JSON.parse(fs.readFileSync(corpusPath, "utf8"))
  : loadEvalCases();
const model = createEvalModelClient(cases);

// Default gate corpus: only labeled + clinical cases are panel-relevant.
// A custom review corpus is captured whole — its labels are what the panel writes.
const graded = corpusPath
  ? cases
  : cases.filter((c) => c.acceptableRisks || c.category === "clinical_risk");

const rows: unknown[] = [];
for (const c of graded) {
  let response: unknown;
  let error: string | null = null;
  // one retry through the product path; a retry card is itself a valid product
  // output for the panel to see, but a provider blip should not be one.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      response = await checkFood(c.input, { model });
      const kind = (response as { kind?: string }).kind;
      if (kind !== "retry") break;
    } catch (e) {
      error = String(e);
    }
    await new Promise((r) => setTimeout(r, 4000));
  }
  rows.push({
    id: c.id,
    category: c.category,
    stratum: (c as { stratum?: string }).stratum ?? null,
    probe: (c as { probe?: string }).probe ?? null,
    input: c.input,
    harmfulIfSafe: c.harmfulIfSafe,
    acceptableRisks: c.acceptableRisks ?? null,
    labelSource: c.labelSource ?? null,
    notes: c.notes,
    response,
    error
  });
  console.log(`${c.id}: ${(response as { kind?: string })?.kind ?? "ERROR"}`);
}

fs.writeFileSync(out, JSON.stringify({ model: process.env.PAL_MODEL, capturedAt: new Date().toISOString(), rows }, null, 2));
console.log(`wrote ${out} (${rows.length} cases)`);
