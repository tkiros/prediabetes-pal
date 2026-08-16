#!/usr/bin/env node
/**
 * Engine consistency harness (Phase 0; measured against preview in Phase 7).
 *
 * Submits one identical meal description N times to POST <target>/api/check
 * and reports the risk-class distribution and flip rate. The validation spike
 * observed ~15% retest instability; the shipped engine target is ≥95% modal
 * class. Record the measured number in docs/ops/launch-controls.md.
 *
 * Usage:
 *   node scripts/consistency-check.mjs --url https://preview.example.com \
 *     [--food "grilled chicken with rice and vegetables"] [--a1c 6.1] [--n 50]
 */

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .map((arg, i, all) =>
      arg.startsWith("--") ? [arg.slice(2), all[i + 1]] : null
    )
    .filter(Boolean)
);

const url = args.url;
const food = args.food ?? "grilled chicken with white rice and a dinner roll";
const a1c = Number(args.a1c ?? 6.1);
const n = Number(args.n ?? 50);

if (!url) {
  console.error("Missing --url <base url of the deployment to measure>");
  process.exit(1);
}

const endpoint = new URL("/api/check", url).toString();
const results = [];
const errors = [];

console.log(`Consistency check: ${n}x "${food}" (a1c ${a1c}) → ${endpoint}`);

for (let i = 0; i < n; i += 1) {
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ food, a1c })
    });

    if (!res.ok) {
      errors.push(`HTTP ${res.status}`);
      continue;
    }

    const body = await res.json();
    if (body.kind === "retry") {
      // Fail-closed availability event (provider error → calm-retry body,
      // HTTP 200), not a classification. Same bucket as the HTTP errors
      // above, which this loop already excludes from the distribution —
      // 2026-08-16: provider-error bursts were scoring as a pseudo-class
      // and failing runs whose actual risk-class flip rate was 0.
      errors.push("kind:retry (provider fail-closed)");
      continue;
    }
    results.push(body.kind === "result" ? body.risk : `kind:${body.kind}`);
  } catch (error) {
    errors.push(String(error?.message ?? error));
  }

  // ponytail: serial with a small delay to stay under the 20 req/hr rate
  // limit only if the operator has raised it for the run; default pacing is
  // just polite spacing — the operator must run this against a deployment
  // with the rate limit lifted or an allowlisted key.
  await new Promise((resolve) => setTimeout(resolve, 250));
  process.stdout.write(".");
}

console.log("\n");

const counts = {};
for (const r of results) {
  counts[r] = (counts[r] ?? 0) + 1;
}

const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
const total = results.length;
const modal = sorted[0];

console.log("Distribution:");
for (const [cls, count] of sorted) {
  console.log(
    `  ${cls.padEnd(14)} ${count}/${total} (${((100 * count) / total).toFixed(1)}%)`
  );
}

if (errors.length > 0) {
  console.log(`Errors (${errors.length}): ${[...new Set(errors)].join(", ")}`);
}

if (!modal || total === 0) {
  console.error("No successful responses — nothing to measure.");
  process.exit(1);
}

const modalShare = modal[1] / total;
const flipRate = 1 - modalShare;
console.log(
  `\nModal class: ${modal[0]} at ${(100 * modalShare).toFixed(1)}% · flip rate ${(100 * flipRate).toFixed(1)}%`
);
console.log(
  modalShare >= 0.95
    ? "PASS — meets the ≥95% modal-class target."
    : "FAIL — below the ≥95% modal-class target; see the determinism remediation path (openai-client.ts) in the plan (P7)."
);

process.exit(modalShare >= 0.95 ? 0 : 2);
