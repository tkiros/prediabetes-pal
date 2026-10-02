/**
 * Retention cohort report — counts only, read-only.
 *
 *   DATABASE_URL=... npx tsx scripts/cohort-report.ts --from 2026-10-01 --to 2026-11-01 \
 *       [--as-of 2027-01-15] [--trial-days 7]
 *
 * Prints JSON built by lib/server/cohort-report.ts: the definitions it used,
 * the window, per-state account counts, Track A (D7/30/60/90) and Track B
 * (D180/365) checkpoints with both denominators. No user id, email, or meal
 * text is ever read into the output. Fill docs/research/retention-cohort-
 * preregistration.md §4 from the printed definitions BEFORE the first
 * participant enrolls; this script does not decide anything.
 */
import process from "node:process";

import { computeCohortReport, queryCohortRows } from "../lib/server/cohort-report";
import { getDb } from "../lib/server/db";

function flag(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function dateFlag(name: string, fallback?: Date): Date {
  const raw = flag(name);
  if (raw === undefined) {
    if (fallback) return fallback;
    throw new Error(`--${name} YYYY-MM-DD is required`);
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) throw new Error(`--${name}: not a date: ${raw}`);
  return parsed;
}

async function main(): Promise<void> {
  const cohortStart = dateFlag("from");
  const cohortEnd = dateFlag("to");
  const asOf = dateFlag("as-of", new Date());
  const trialDays = Number(flag("trial-days") ?? 7);
  if (!(cohortEnd > cohortStart)) throw new Error("--to must be after --from");
  if (!Number.isInteger(trialDays) || trialDays < 0) throw new Error("--trial-days must be a non-negative integer");

  const rows = await queryCohortRows(getDb());
  const report = computeCohortReport({ ...rows, cohortStart, cohortEnd, asOf, trialDays });
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

main().then(
  () => process.exit(0),
  (error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  }
);
