#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const ROOT = process.cwd();
const FIXTURE_PATH = path.join(ROOT, "tests/fixtures/safety-contract.json");

const REQUIRED_DOCS = [
  "docs/safety/claims-boundary.md",
  "docs/safety/evidence-pack.md",
  "docs/safety/a1c-band-rubric.md",
  "docs/safety/tone-uncertainty-policy.md",
  "docs/safety/copy-ledger.md",
  "tests/fixtures/safety-contract.json",
  "scripts/validate-safety-contract.mjs"
];

const FLAG_HANDLERS = {
  "--infrastructure": checkInfrastructure,
  "--require-copy-ledger": checkCopyLedger,
  "--forbidden-claims": checkForbiddenClaims,
  "--forbidden-predictions": checkForbiddenPredictions,
  "--claims-boundary": checkClaimsBoundary,
  "--evidence-pack": checkEvidencePack,
  "--a1c-routes": checkA1CRoutes,
  "--qualitative-only": checkQualitativeOnly,
  "--uncertainty-policy": checkUncertaintyPolicy
};

const FULL_SUITE = Object.keys(FLAG_HANDLERS);

function main() {
  const flags = process.argv.slice(2);
  const requestedFlags = flags.length === 0 ? FULL_SUITE : flags;
  const unknownFlags = requestedFlags.filter((flag) => !FLAG_HANDLERS[flag]);

  if (unknownFlags.length > 0) {
    printUsage(`Unknown flag(s): ${unknownFlags.join(", ")}`);
    process.exit(1);
  }

  const context = loadContext();
  const failures = [];

  for (const flag of requestedFlags) {
    FLAG_HANDLERS[flag](context, failures);
  }

  if (failures.length > 0) {
    for (const failure of failures) {
      console.error(`FAIL ${failure}`);
    }
    process.exit(1);
  }

  console.log(
    `Safety contract validation passed for: ${requestedFlags.join(", ")}`
  );
}

function printUsage(reason) {
  if (reason) {
    console.error(reason);
  }
  console.error("Usage: node scripts/validate-safety-contract.mjs [flags]");
  console.error(`Flags: ${FULL_SUITE.join(", ")}`);
}

function loadContext() {
  const fixture = safeReadJson(FIXTURE_PATH, {});
  const claimsBoundary = safeReadText("docs/safety/claims-boundary.md");
  const evidencePack = safeReadText("docs/safety/evidence-pack.md");
  const a1cBandRubric = safeReadText("docs/safety/a1c-band-rubric.md");
  const tonePolicy = safeReadText("docs/safety/tone-uncertainty-policy.md");
  const copyLedger = safeReadText("docs/safety/copy-ledger.md");

  return {
    fixture,
    claimsBoundary,
    evidencePack,
    a1cBandRubric,
    tonePolicy,
    copyLedger
  };
}

function checkInfrastructure(context, failures) {
  for (const relativePath of REQUIRED_DOCS) {
    const absolutePath = path.join(ROOT, relativePath);
    if (!fs.existsSync(absolutePath)) {
      failures.push(`missing required file: ${relativePath}`);
      continue;
    }

    const stat = fs.statSync(absolutePath);
    if (!stat.isFile()) {
      failures.push(`required path is not a file: ${relativePath}`);
      continue;
    }

    const contents = fs.readFileSync(absolutePath, "utf8").trim();
    if (contents.length < 40) {
      failures.push(`required file is too small to be substantive: ${relativePath}`);
    }
  }

  for (const key of [
    "forbiddenClaims",
    "forbiddenPredictions",
    "a1cRoutes",
    "qualitativeOnly",
    "uncertaintyFloors"
  ]) {
    if (!(key in context.fixture)) {
      failures.push(`fixture missing top-level key: ${key}`);
    }
  }
}

function checkCopyLedger(context, failures) {
  const rows = getCopyLedgerRows(context.copyLedger, failures);
  const requiredIds = [
    "product-home-hero",
    "prompt-a1c-scope",
    "prompt-safe-tone-snippet",
    "prompt-conservative-floor-snippet",
    "result-safe-example",
    "result-moderate-example",
    "result-high-example",
    "result-clarification-example",
    "result-non-food-refusal",
    "result-footer",
    "below-range-route",
    "high-range-route",
    "launch-community-post"
  ];

  for (const requiredId of requiredIds) {
    const row = rows.find((entry) => entry["Copy ID"] === requiredId);
    if (!row) {
      failures.push(`copy ledger missing required row: ${requiredId}`);
      continue;
    }

    if (normalize(row.Status) !== "approved") {
      failures.push(`copy ledger row is not approved: ${requiredId}`);
    }

    if (normalize(row.Active) !== "yes") {
      failures.push(`copy ledger row is not active: ${requiredId}`);
    }

    if (!row["Allowed Claim Class"]) {
      failures.push(`copy ledger row missing allowed claim class: ${requiredId}`);
    }

    if (!row.Copy || row.Copy.trim().length < 20) {
      failures.push(`copy ledger row copy is too small: ${requiredId}`);
    }
  }
}

function checkForbiddenClaims(context, failures) {
  const rows = getApprovedActiveCopyRows(context.copyLedger, failures);
  const activeCopy = rows.map((row) => row.Copy).join("\n");

  for (const entry of context.fixture.forbiddenClaims) {
    const regex = buildRegex(entry);
    if (regex.test(activeCopy)) {
      failures.push(
        `approved active copy contains forbidden claim pattern: ${entry.label}`
      );
    }
  }
}

function checkForbiddenPredictions(context, failures) {
  const rows = getApprovedActiveCopyRows(context.copyLedger, failures);
  const activeCopy = rows.map((row) => row.Copy).join("\n");

  for (const entry of context.fixture.forbiddenPredictions) {
    const regex = buildRegex(entry);
    if (regex.test(activeCopy)) {
      failures.push(
        `approved active copy contains forbidden prediction pattern: ${entry.label}`
      );
    }
  }
}

function checkClaimsBoundary(context, failures) {
  const normalizedClaimsBoundary = context.claimsBoundary.toLowerCase();
  const requiredPhrases = [
    "Informational-only",
    "diagnosis",
    "treatment",
    "prevention",
    "cure",
    "reversal",
    "future A1C",
    "glucose-curve",
    "GI",
    "GL",
    "mg/dL",
    "FDA",
    "registered dietitian"
  ];

  for (const phrase of requiredPhrases) {
    if (!normalizedClaimsBoundary.includes(phrase.toLowerCase())) {
      failures.push(`claims boundary missing phrase: ${phrase}`);
    }
  }

  const claimClassRows = getMarkdownTable(context.claimsBoundary, [
    "Claim Class",
    "Applies To",
    "Allowed Language",
    "Not Allowed Yet",
    "Notes"
  ], failures, "claims-boundary");

  const claimClasses = new Set(
    claimClassRows.map((row) => row["Claim Class"]).filter(Boolean)
  );
  const approvedRows = getApprovedActiveCopyRows(context.copyLedger, failures);

  for (const row of approvedRows) {
    if (!claimClasses.has(row["Allowed Claim Class"])) {
      failures.push(
        `copy ledger references unknown claim class: ${row["Allowed Claim Class"]}`
      );
    }
  }
}

function checkEvidencePack(context, failures) {
  const rows = getMarkdownTable(context.evidencePack, [
    "Evidence ID",
    "Source",
    "Supports",
    "Allowed Use",
    "Do Not Claim",
    "Confidence",
    "Notes"
  ], failures, "evidence-pack");

  const requiredEvidenceIds = [
    "CDC-A1C-RANGES",
    "NIDDK-A1C-INTERPRETATION",
    "CDC-MEAL-PLANNING",
    "CDC-HEALTHY-CARBS",
    "CDC-FIBER-GUIDANCE",
    "SHUKLA-FOOD-ORDER",
    "IMAI-VEGETABLES-FIRST",
    "FDA-GENERAL-WELLNESS",
    "FTC-HEALTH-COMPLIANCE"
  ];

  const availableIds = new Set(rows.map((row) => row["Evidence ID"]));

  for (const evidenceId of requiredEvidenceIds) {
    if (!availableIds.has(evidenceId)) {
      failures.push(`evidence pack missing required row: ${evidenceId}`);
    }
  }

  for (const row of rows) {
    for (const field of [
      "Source",
      "Supports",
      "Allowed Use",
      "Do Not Claim",
      "Confidence",
      "Notes"
    ]) {
      if (!row[field] || row[field].trim().length < 4) {
        failures.push(
          `evidence pack row ${row["Evidence ID"] || "<missing-id>"} missing ${field}`
        );
      }
    }
  }

  const approvedRows = getApprovedActiveCopyRows(context.copyLedger, failures);
  for (const row of approvedRows) {
    const references = splitCsv(row["Evidence Rows"]);
    for (const reference of references) {
      if (!availableIds.has(reference)) {
        failures.push(
          `copy ledger row ${row["Copy ID"]} references missing evidence row: ${reference}`
        );
      }
    }
  }
}

function checkA1CRoutes(context, failures) {
  const tableRows = getMarkdownTable(context.a1cBandRubric, [
    "Route ID",
    "A1C Band",
    "Scope",
    "Minimum Behavior",
    "Must Not Say"
  ], failures, "a1c-band-rubric");

  const routeIds = new Set(tableRows.map((row) => row["Route ID"]));
  for (const routeId of context.fixture.a1cRoutes.requiredRouteIds) {
    if (!routeIds.has(routeId)) {
      failures.push(`a1c rubric missing route id: ${routeId}`);
    }
  }
}

function checkQualitativeOnly(context, failures) {
  const rows = getApprovedActiveCopyRows(context.copyLedger, failures);
  const activeCopy = rows.map((row) => row.Copy).join("\n");

  for (const entry of context.fixture.qualitativeOnly.forbiddenPatterns) {
    const regex = buildRegex(entry);
    if (regex.test(activeCopy)) {
      failures.push(
        `approved active copy contains non-qualitative exact language: ${entry.label}`
      );
    }
  }
}

function checkUncertaintyPolicy(context, failures) {
  const rows = getMarkdownTable(context.tonePolicy, [
    "Scenario ID",
    "Scenario",
    "Minimum Classification",
    "Required Behavior"
  ], failures, "tone-uncertainty-policy");

  const floorMap = new Map(rows.map((row) => [row["Scenario ID"], row]));

  for (const floor of context.fixture.uncertaintyFloors) {
    const row = floorMap.get(floor.scenarioId);
    if (!row) {
      failures.push(`tone policy missing uncertainty scenario: ${floor.scenarioId}`);
      continue;
    }

    if (normalize(row["Minimum Classification"]) !== normalize(floor.minimumClassification)) {
      failures.push(
        `tone policy scenario ${floor.scenarioId} expected ${floor.minimumClassification} but found ${row["Minimum Classification"]}`
      );
    }
  }
}

function getApprovedActiveCopyRows(copyLedger, failures) {
  const rows = getCopyLedgerRows(copyLedger, failures);
  return rows.filter(
    (row) => normalize(row.Status) === "approved" && normalize(row.Active) === "yes"
  );
}

function getCopyLedgerRows(copyLedger, failures) {
  return getMarkdownTable(copyLedger, [
    "Copy ID",
    "Surface",
    "Status",
    "Active",
    "Allowed Claim Class",
    "Copy",
    "Evidence Rows",
    "Notes"
  ], failures, "copy-ledger");
}

function getMarkdownTable(text, requiredHeaders, failures, label) {
  const tables = parseMarkdownTables(text, failures, label);
  const table = tables.find((candidate) =>
    requiredHeaders.every((header) => candidate.headers.includes(header))
  );

  if (!table) {
    failures.push(`${label} missing required table with headers: ${requiredHeaders.join(", ")}`);
    return [];
  }

  return table.rows;
}

function parseMarkdownTables(text, failures, label) {
  const lines = text.split(/\r?\n/);
  const tables = [];
  let index = 0;

  while (index < lines.length) {
    if (!lines[index].trim().startsWith("|")) {
      index += 1;
      continue;
    }

    const block = [];
    while (index < lines.length && lines[index].trim().startsWith("|")) {
      block.push(lines[index].trim());
      index += 1;
    }

    if (block.length < 2 || !isSeparatorRow(block[1])) {
      continue;
    }

    const headers = splitTableRow(block[0]);
    const rows = [];

    for (const rowText of block.slice(2)) {
      const values = splitTableRow(rowText);
      if (values.length === 0) {
        continue;
      }

      // A-115: a stray `|` inside the ledger's Copy cell (used instead of
      // ` · `) silently shifted every later column instead of failing loudly
      // -- an implementer only ever saw that surface as an unrelated "unknown
      // claim class" / "missing evidence row" failure pointing at the wrong
      // column, or (for a Pending row not yet in checkCopyLedger's
      // required-ID list) no failure at all -- verified empirically: a
      // 9-cell Pending row parsed silently and `npm run contract` passed.
      // Name the row and the fix directly. Scoped to the copy-ledger table
      // only, and only after `splitTableRow` below is backtick-aware:
      // `landing-hero-moment`'s Notes documents a regex alternation
      // (`` `/\bdiagnos(?:e|es|ed|ing|is|tic|tics)\b/i` ``) whose pipes are
      // inside a code span and are not column separators, the same as GFM
      // itself would render this table.
      if (label === "copy-ledger" && values.length !== headers.length) {
        const idIndex = headers.indexOf("Copy ID");
        const rowId = idIndex >= 0 ? values[idIndex] : undefined;
        failures.push(
          `copy ledger row ${rowId ? `\`${rowId}\`` : rowText.slice(0, 80)} has ${values.length} cells; a \`|\` inside the Copy cell? use \` · \``
        );
      }

      const row = {};
      for (let columnIndex = 0; columnIndex < headers.length; columnIndex += 1) {
        row[headers[columnIndex]] = values[columnIndex] ?? "";
      }
      rows.push(row);
    }

    tables.push({ headers, rows });
  }

  return tables;
}

function splitTableRow(row) {
  const trimmed = row.replace(/^\|/, "").replace(/\|$/, "");
  // Backtick-aware: a `|` inside an inline code span (single backticks --
  // verified no double-backtick spans exist in any file this parses) is not
  // a column separator, matching how GFM itself renders these tables.
  const cells = [];
  let current = "";
  let inCode = false;
  for (const ch of trimmed) {
    if (ch === "`") {
      inCode = !inCode;
      current += ch;
    } else if (ch === "|" && !inCode) {
      cells.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  cells.push(current);
  return cells.map((value) => value.trim().replace(/^`(.+)`$/, "$1"));
}

function isSeparatorRow(row) {
  return /^(\|\s*:?-{3,}:?\s*)+\|$/.test(row);
}

function buildRegex(entry) {
  return new RegExp(entry.pattern, entry.flags || "i");
}

function splitCsv(value) {
  if (!value || !value.trim()) {
    return [];
  }

  return value
    .split(",")
    .map((item) => item.trim().replace(/^`(.+)`$/, "$1"))
    .filter(Boolean);
}

function readText(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

function safeReadText(relativePath) {
  const absolutePath = path.join(ROOT, relativePath);
  if (!fs.existsSync(absolutePath)) {
    return "";
  }

  return fs.readFileSync(absolutePath, "utf8");
}

function safeReadJson(absolutePath, fallbackValue) {
  if (!fs.existsSync(absolutePath)) {
    return fallbackValue;
  }

  try {
    return JSON.parse(fs.readFileSync(absolutePath, "utf8"));
  } catch {
    return fallbackValue;
  }
}

function normalize(value) {
  return (value || "").trim().toLowerCase();
}

main();
