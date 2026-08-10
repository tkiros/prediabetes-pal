/**
 * SIMULATED — NON-CREDENTIALED panel adjudication (DR-08).
 *
 * Adjudicates the three independent DR-02 reviews per case, IN CODE, after all
 * raw verdicts exist: unanimous → adjudicated; 2-1 → majority holds, minority
 * recorded verbatim; three-way split → UNRESOLVED, listed for the human panel.
 * The adjudication rule is itself under test — the output reports how often it
 * produced a clean outcome vs punted, and where the 2-1 cases cluster.
 *
 * Nothing here is clinical sign-off; DR-01 keeps W-05/F-06 open regardless.
 *
 * Usage: npx tsx scripts/dietitian-panel/adjudicate.mts \
 *          <corpus.json> <capture.json> <out.json> <panel1.json> [panel2.json ...]
 */
import fs from "node:fs";

import { classifyInputBeforeModel, isCarbForward } from "../../lib/pal/input-precheck";

const [corpusPath, capturePath, outPath, ...panelPaths] = process.argv.slice(2);
if (!corpusPath || !capturePath || !outPath || panelPaths.length === 0) {
  throw new Error("usage: adjudicate.mts <corpus> <capture> <out> <panel...>");
}

type Verdict = {
  acceptableRisks: string[] | null;
  dangerousOutputs: string[];
  requiredClinicalRoute: string | null;
  minimumClarification: string | null;
  rationale: string;
  sourceIds: string[];
  adjustmentSafe: boolean | null;
  adjustmentFeasible: boolean | null;
  generic: boolean;
  nonShaming: boolean;
  confidence: string;
  labelVerdict: string | null;
  suggestedAcceptableRisks: string[] | null;
  comments: string | null;
};
type PanelRow = {
  caseId: string; category: string; stratum: string | null;
  productKind?: string | null; productRisk?: string | null;
  persona: string; verdict?: Verdict; error?: string;
};

const corpus = JSON.parse(fs.readFileSync(corpusPath, "utf8"));
const capture = JSON.parse(fs.readFileSync(capturePath, "utf8"));
const results: PanelRow[] = panelPaths.flatMap(
  (p) => JSON.parse(fs.readFileSync(p, "utf8")).results
);

const corpusById = new Map<string, any>(corpus.map((c: any) => [c.id, c]));
const captureById = new Map<string, any>(capture.rows.map((r: any) => [r.id, r]));

const byCase = new Map<string, PanelRow[]>();
for (const r of results) {
  if (!byCase.has(r.caseId)) byCase.set(r.caseId, []);
  byCase.get(r.caseId)!.push(r);
}

const setKey = (s: string[] | null) => (s ? [...s].sort().join("+") : "NONE");

/** unanimous | majority (minority recorded) | UNRESOLVED */
function adjudicateSets(sets: (string[] | null)[]) {
  const keys = sets.map(setKey);
  const tally = new Map<string, number>();
  for (const k of keys) tally.set(k, (tally.get(k) ?? 0) + 1);
  const [topKey, topCount] = [...tally.entries()].sort((a, b) => b[1] - a[1])[0];
  if (topCount === sets.length) return { outcome: "unanimous", value: topKey };
  if (topCount >= 2) {
    return { outcome: "majority", value: topKey, minority: keys.filter((k) => k !== topKey) };
  }
  return { outcome: "UNRESOLVED", value: null, all: keys };
}

function majorityBool(vals: boolean[]) {
  const yes = vals.filter(Boolean).length;
  return {
    value: yes * 2 > vals.length,
    outcome: yes === 0 || yes === vals.length ? "unanimous" : "majority"
  };
}

const caseRecords: any[] = [];
for (const [caseId, rows] of byCase) {
  const verdicts = rows.filter((r) => r.verdict).map((r) => ({ persona: r.persona, v: r.verdict! }));
  const errors = rows.filter((r) => r.error);
  const cap = captureById.get(caseId);
  const cor = corpusById.get(caseId);
  if (verdicts.length === 0) {
    caseRecords.push({ caseId, stratum: cap?.stratum ?? null, adjudication: "NO_VERDICTS", errors: errors.map((e) => e.error) });
    continue;
  }
  const productRisk = cap?.response?.kind === "result" ? cap.response.risk : null;
  const bands = adjudicateSets(verdicts.map(({ v }) => v.acceptableRisks));
  const safe = majorityBool(verdicts.map(({ v }) => v.dangerousOutputs.length === 0));
  const generic = majorityBool(verdicts.map(({ v }) => v.generic));
  const nonShaming = majorityBool(verdicts.map(({ v }) => v.nonShaming));
  // product band accepted: reviewer's set contains the product risk
  const acceptance = productRisk
    ? majorityBool(verdicts.map(({ v }) => (v.acceptableRisks ?? []).includes(productRisk)))
    : null;
  const falseReassuranceVotes = productRisk === "SAFE"
    ? verdicts.filter(({ v }) => v.acceptableRisks && !v.acceptableRisks.includes("SAFE"))
    : [];
  const routeVotes = verdicts.map(({ v }) => v.requiredClinicalRoute).filter(Boolean);
  caseRecords.push({
    caseId,
    stratum: cap?.stratum ?? cor?.stratum ?? null,
    category: rows[0].category,
    probe: cap?.probe ?? cor?.probe ?? null,
    productKind: cap?.response?.kind ?? null,
    productRisk,
    expectedClinicalRoute: cor?.expectedClinicalRoute ?? null,
    reviewerRoutes: routeVotes,
    bandAdjudication: bands,
    productBandAccepted: acceptance,
    safeAdjudication: safe,
    genericAdjudication: generic,
    nonShamingAdjudication: nonShaming,
    falseReassuranceVotes: falseReassuranceVotes.map(({ persona, v }) => ({
      persona, acceptableRisks: v.acceptableRisks, rationale: v.rationale
    })),
    labelReadjudication: verdicts.some(({ v }) => v.labelVerdict)
      ? {
          verdicts: verdicts.map(({ persona, v }) => ({ persona, labelVerdict: v.labelVerdict, suggested: v.suggestedAcceptableRisks })),
          suggestedSetAdjudication: adjudicateSets(verdicts.map(({ v }) => v.suggestedAcceptableRisks))
        }
      : null,
    rawVerdicts: verdicts.map(({ persona, v }) => ({ persona, ...v })),
    errors: errors.map((e) => e.error)
  });
}

// ---- aggregate stats ----
const strata = [...new Set(caseRecords.map((c) => c.stratum))];
function pct(n: number, d: number) { return d === 0 ? null : Math.round((n / d) * 1000) / 10; }

function pairwiseAgreement(records: any[], dim: (v: Verdict) => string) {
  let agree = 0, pairs = 0;
  for (const rec of records) {
    const vals = (rec.rawVerdicts ?? []).map((v: Verdict) => dim(v));
    for (let i = 0; i < vals.length; i += 1) for (let j = i + 1; j < vals.length; j += 1) {
      pairs += 1;
      if (vals[i] === vals[j]) agree += 1;
    }
  }
  return pct(agree, pairs);
}

const DIMS: Record<string, (v: Verdict) => string> = {
  bands: (v) => setKey(v.acceptableRisks),
  safe: (v) => String(v.dangerousOutputs.length === 0),
  generic: (v) => String(v.generic),
  nonShaming: (v) => String(v.nonShaming)
};

function statsFor(records: any[]) {
  const graded = records.filter((r) => r.rawVerdicts?.length);
  const bandOutcomes = { unanimous: 0, majority: 0, UNRESOLVED: 0 } as Record<string, number>;
  for (const r of graded) bandOutcomes[r.bandAdjudication.outcome] += 1;
  return {
    cases: graded.length,
    bandAdjudicationOutcomes: bandOutcomes,
    productBandRejected: graded.filter((r) => r.productBandAccepted && !r.productBandAccepted.value).length,
    unsafeMajority: graded.filter((r) => !r.safeAdjudication.value).length,
    genericMajority: graded.filter((r) => r.genericAdjudication.value).length,
    shamingMajority: graded.filter((r) => !r.nonShamingAdjudication.value).length,
    nonShamingRatePct: pct(graded.filter((r) => r.nonShamingAdjudication.value).length, graded.length),
    agreementPct: Object.fromEntries(Object.entries(DIMS).map(([k, f]) => [k, pairwiseAgreement(graded, f)]))
  };
}

// ontology: deterministic precheck for every case, model-vs-floor for probes
const ontology = caseRecords.filter((r) => r.probe).map((r) => {
  const food = corpusById.get(r.caseId)?.input.food ?? captureById.get(r.caseId)?.input.food;
  const pre = classifyInputBeforeModel(food);
  return {
    caseId: r.caseId, probe: r.probe, food,
    precheckKind: pre.kind,
    precheckFlags: (pre as any).flags ?? null,
    carbForward: isCarbForward(food.toLowerCase()),
    productRisk: r.productRisk,
    productKind: r.productKind,
    panelBands: r.bandAdjudication,
    falseReassuranceVotes: r.falseReassuranceVotes?.length ?? 0
  };
});

const dangerousFalseReassurance = caseRecords
  .filter((r) => (r.falseReassuranceVotes?.length ?? 0) > 0)
  .map((r) => ({ caseId: r.caseId, stratum: r.stratum, productRisk: r.productRisk, votes: r.falseReassuranceVotes }));

const summary = {
  simulated: true,
  disclaimer: "SIMULATED — NON-CREDENTIALED. LLM persona panel adjudication. Does NOT satisfy W-05/F-06.",
  overall: statsFor(caseRecords),
  byStratum: Object.fromEntries(strata.map((s) => [s, statsFor(caseRecords.filter((r) => r.stratum === s))])),
  dangerousFalseReassurance,
  ontology,
  labelReadjudications: caseRecords.filter((r) => r.labelReadjudication).map((r) => ({
    caseId: r.caseId, ...r.labelReadjudication
  })),
  unresolvedForHumanPanel: caseRecords
    .filter((r) => r.bandAdjudication?.outcome === "UNRESOLVED")
    .map((r) => ({ caseId: r.caseId, stratum: r.stratum, sets: r.bandAdjudication.all }))
};

fs.writeFileSync(outPath, JSON.stringify({ summary, caseRecords }, null, 2));
console.log(JSON.stringify(summary.overall, null, 2));
console.log("byStratum:", Object.fromEntries(Object.entries(summary.byStratum).map(([k, v]: any) => [k, v.cases])));
console.log(`dangerous false reassurance cases: ${dangerousFalseReassurance.length}`);
console.log(`UNRESOLVED for human panel: ${summary.unresolvedForHumanPanel.length}`);
console.log(`wrote ${outPath} (${caseRecords.length} case records)`);
