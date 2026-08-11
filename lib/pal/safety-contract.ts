import fs from "node:fs";
import path from "node:path";

import { CLINICAL_ROUTES, type ClinicalRoute } from "./clinical-risk";

type SafetyContractFixture = {
  forbiddenClaims: Array<{
    label: string;
    pattern: string;
    example: string;
  }>;
  forbiddenPredictions: Array<{
    label: string;
    pattern: string;
    example: string;
  }>;
  a1cRoutes: {
    requiredRouteIds: string[];
  };
  qualitativeOnly: {
    forbiddenPatterns: Array<{
      label: string;
      pattern: string;
    }>;
  };
  uncertaintyFloors: Array<{
    scenarioId: string;
    minimumClassification: string;
  }>;
};

type CopyRowId =
  | "product-home-hero"
  | "prompt-a1c-scope"
  | "prompt-safe-tone-snippet"
  | "prompt-conservative-floor-snippet"
  | "result-clarification-example"
  | "result-non-food-refusal"
  | "result-footer"
  | "below-range-route"
  | "high-range-route"
  | ClinicalCopyRowId;

/**
 * Clinical-route copy (W-01). One ledger row per route in
 * `lib/pal/clinical-risk.ts` — the mapping is asserted below, so adding a
 * route without approved copy fails the contract load rather than shipping a
 * clinical response with no words in it.
 */
type ClinicalCopyRowId = `clinical-${string}`;

const CLINICAL_COPY_IDS: Record<ClinicalRoute, CopyRowId> = {
  urgent_symptoms: "clinical-urgent-symptoms",
  possible_hypoglycemia: "clinical-possible-hypoglycemia",
  medication_dosing: "clinical-medication-dosing",
  eating_disorder: "clinical-eating-disorder",
  pregnancy: "clinical-pregnancy",
  organ_disease: "clinical-organ-disease",
  allergy: "clinical-allergy",
  diagnosed_diabetes: "clinical-diagnosed-diabetes",
  pediatric: "clinical-pediatric"
};

type CopyRow = {
  copyId: CopyRowId;
  copy: string;
};

export type SafetyContract = {
  fixture: SafetyContractFixture;
  copy: {
    productHomeHero: string;
    promptA1CScope: string;
    promptSafeToneSnippet: string;
    promptConservativeFloorSnippet: string;
    clarificationExample: string;
    nonFoodRefusal: string;
    disclaimer: string;
    belowRangeRoute: string;
    highRangeRoute: string;
    /** Approved, non-generative response text per clinical route (W-01). */
    clinicalRoutes: Record<ClinicalRoute, string>;
  };
  docs: {
    claimsBoundary: string;
    tonePolicy: string;
    a1cBandRubric: string;
    copyLedger: string;
  };
  paths: {
    rootDir: string;
    fixture: string;
    copyLedger: string;
  };
};

const CONTRACT_CACHE = new Map<string, SafetyContract>();

const COPY_IDS: CopyRowId[] = [
  "product-home-hero",
  "prompt-a1c-scope",
  "prompt-safe-tone-snippet",
  "prompt-conservative-floor-snippet",
  "result-clarification-example",
  "result-non-food-refusal",
  "result-footer",
  "below-range-route",
  "high-range-route",
  ...CLINICAL_ROUTES.map((route) => CLINICAL_COPY_IDS[route])
];

/**
 * Version stamp for the safety contract (W-13 / Phase 0.1).
 *
 * Telemetry carries this so a reported bad answer is attributable to the exact
 * contract that produced it. `tests/unit/pal/contract-version.test.ts` pins
 * it to a hash of the fixture + ledger, so changing the contract without
 * bumping the version turns the suite red.
 */
export const CONTRACT_VERSION = "2026-07-24.1";

export function loadSafetyContract(options?: {
  rootDir?: string;
}): SafetyContract {
  const rootDir = options?.rootDir ?? process.cwd();
  const cached = CONTRACT_CACHE.get(rootDir);

  if (cached) {
    return cached;
  }

  const fixturePath = path.join(rootDir, "tests/fixtures/safety-contract.json");
  const copyLedgerPath = path.join(rootDir, "docs/safety/copy-ledger.md");
  const claimsBoundaryPath = path.join(rootDir, "docs/safety/claims-boundary.md");
  const tonePolicyPath = path.join(
    rootDir,
    "docs/safety/tone-uncertainty-policy.md"
  );
  const a1cBandRubricPath = path.join(
    rootDir,
    "docs/safety/a1c-band-rubric.md"
  );

  const fixture = readRequiredJson<SafetyContractFixture>(
    fixturePath,
    "tests/fixtures/safety-contract.json"
  );
  assertFixtureShape(fixture);

  const copyLedger = readRequiredText(copyLedgerPath, "docs/safety/copy-ledger.md");
  const claimsBoundary = readRequiredText(
    claimsBoundaryPath,
    "docs/safety/claims-boundary.md"
  );
  const tonePolicy = readRequiredText(
    tonePolicyPath,
    "docs/safety/tone-uncertainty-policy.md"
  );
  const a1cBandRubric = readRequiredText(
    a1cBandRubricPath,
    "docs/safety/a1c-band-rubric.md"
  );

  const rows = parseCopyLedger(copyLedger);
  const copyRows = Object.fromEntries(
    COPY_IDS.map((copyId) => [copyId, getApprovedCopyRow(rows, copyId)])
  ) as Record<CopyRowId, CopyRow>;

  const contract: SafetyContract = {
    fixture,
    copy: {
      productHomeHero: copyRows["product-home-hero"].copy,
      promptA1CScope: copyRows["prompt-a1c-scope"].copy,
      promptSafeToneSnippet: copyRows["prompt-safe-tone-snippet"].copy,
      promptConservativeFloorSnippet:
        copyRows["prompt-conservative-floor-snippet"].copy,
      clarificationExample: copyRows["result-clarification-example"].copy,
      nonFoodRefusal: copyRows["result-non-food-refusal"].copy,
      disclaimer: copyRows["result-footer"].copy,
      belowRangeRoute: copyRows["below-range-route"].copy,
      highRangeRoute: copyRows["high-range-route"].copy,
      clinicalRoutes: Object.fromEntries(
        CLINICAL_ROUTES.map((route) => [
          route,
          copyRows[CLINICAL_COPY_IDS[route]].copy
        ])
      ) as Record<ClinicalRoute, string>
    },
    docs: {
      claimsBoundary,
      tonePolicy,
      a1cBandRubric,
      copyLedger
    },
    paths: {
      rootDir,
      fixture: fixturePath,
      copyLedger: copyLedgerPath
    }
  };

  CONTRACT_CACHE.set(rootDir, contract);
  return contract;
}

function readRequiredText(absolutePath: string, relativePath: string): string {
  if (!fs.existsSync(absolutePath)) {
    throw new Error(
      `Phase 1 dependency missing: expected ${relativePath} to exist.`
    );
  }

  const contents = fs.readFileSync(absolutePath, "utf8").trim();
  if (contents.length === 0) {
    throw new Error(
      `Phase 1 dependency missing: expected ${relativePath} to contain data.`
    );
  }

  return contents;
}

function readRequiredJson<T>(absolutePath: string, relativePath: string): T {
  const contents = readRequiredText(absolutePath, relativePath);

  try {
    return JSON.parse(contents) as T;
  } catch (error) {
    throw new Error(
      `Phase 1 dependency invalid: could not parse ${relativePath} as JSON.`,
      { cause: error }
    );
  }
}

function assertFixtureShape(
  fixture: Partial<SafetyContractFixture>
): asserts fixture is SafetyContractFixture {
  const requiredKeys = [
    "forbiddenClaims",
    "forbiddenPredictions",
    "a1cRoutes",
    "qualitativeOnly",
    "uncertaintyFloors"
  ] as const;

  for (const key of requiredKeys) {
    if (!(key in fixture)) {
      throw new Error(
        `Phase 1 dependency invalid: tests/fixtures/safety-contract.json is missing "${key}".`
      );
    }
  }
}

function parseCopyLedger(copyLedger: string): Array<Record<string, string>> {
  const lines = copyLedger.split(/\r?\n/);
  const headerIndex = lines.findIndex((line) =>
    line.trim().startsWith("| Copy ID |")
  );

  if (headerIndex === -1) {
    throw new Error(
      "Phase 1 dependency invalid: docs/safety/copy-ledger.md is missing the Copy ID table."
    );
  }

  const tableLines = lines
    .slice(headerIndex)
    .filter((line) => line.trim().startsWith("|"));

  const headers = splitMarkdownRow(tableLines[0]);
  const dataLines = tableLines.slice(2);

  return dataLines.map((line) => {
    const values = splitMarkdownRow(line);
    return Object.fromEntries(
      headers.map((header, index) => [header, values[index] ?? ""])
    );
  });
}

function splitMarkdownRow(row: string): string[] {
  return row
    .split("|")
    .slice(1, -1)
    .map((value) => value.trim());
}

function getApprovedCopyRow(
  rows: Array<Record<string, string>>,
  copyId: CopyRowId
): CopyRow {
  const row = rows.find((entry) => stripBackticks(entry["Copy ID"]) === copyId);

  if (!row) {
    throw new Error(
      `Phase 1 dependency invalid: docs/safety/copy-ledger.md is missing row "${copyId}".`
    );
  }

  if (stripBackticks(row.Status).toLowerCase() !== "approved") {
    throw new Error(
      `Phase 1 dependency invalid: copy ledger row "${copyId}" is not approved.`
    );
  }

  if (stripBackticks(row.Active).toLowerCase() !== "yes") {
    throw new Error(
      `Phase 1 dependency invalid: copy ledger row "${copyId}" is not active.`
    );
  }

  const copy = stripBackticks(row.Copy);
  if (copy.length === 0) {
    throw new Error(
      `Phase 1 dependency invalid: copy ledger row "${copyId}" has empty copy text.`
    );
  }

  return {
    copyId,
    copy
  };
}

function stripBackticks(value: string | undefined): string {
  return (value ?? "").replace(/`/g, "").trim();
}
