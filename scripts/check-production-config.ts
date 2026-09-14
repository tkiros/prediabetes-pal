import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import {
  COPY_LEDGER_PATH,
  IDEA_LABELS_PATH,
  checkProductionDoor,
  type IdeaLabelsFile
} from "../lib/guide-door-guard";
import { activeModelId } from "../lib/pal/model-id";
import { PROMPT_VERSION } from "../lib/pal/prompt";

/**
 * AUD-005 / AUD-002 — production-mode config gate, run in CI with synthetic
 * non-secret values. Loads the REAL next.config.ts in a child process per
 * case and asserts the twin guard fires for every client/server flag pair
 * (client baked on + runtime kill switch unset must FAIL the build) and stays
 * quiet when the pair agrees. PAL_ALLOW_NO_MEASUREMENT=1 isolates the twin
 * guard — flag safety is deliberately outside the analytics waiver.
 *
 * Task 1.11 adds the production door guard (lib/guide-door-guard.ts): the
 * NEXT_PUBLIC_GUIDE_DOOR cases below, and stale idea labels reported as an
 * `issue:` line. Staleness is deliberately NOT a failure — A-100: a prompt
 * hotfix must never be blocked by the idea bank; the production build closes
 * the ideas surfaces instead.
 */

const PAIRS: Array<[client: string, server: string]> = [
  ["NEXT_PUBLIC_PHOTO_INPUT", "PHOTO_INPUT_ENABLED"],
  ["NEXT_PUBLIC_LONGITUDINAL_INSIGHTS", "LONGITUDINAL_INSIGHTS_ENABLED"],
  ["NEXT_PUBLIC_MEAL_MEMORY", "MEAL_MEMORY_ENABLED"],
  ["NEXT_PUBLIC_LEARNING_JOURNEY", "LEARNING_JOURNEY_ENABLED"]
];

type Loaded = { status: number; env: Record<string, string> };

function loadConfig(extraEnv: Record<string, string>): Loaded {
  const env = {
    ...process.env,
    VERCEL_ENV: "production",
    PAL_ALLOW_NO_MEASUREMENT: "1"
  } as NodeJS.ProcessEnv;
  // Start every pair from a clean slate so ambient dev env can't skew a case —
  // the door flag too: an ambient `1` would fail every case on the door guard.
  for (const [client, server] of PAIRS) {
    delete env[client];
    delete env[server];
  }
  delete env.NEXT_PUBLIC_GUIDE_DOOR;
  Object.assign(env, extraEnv);
  // tsx (already a devDependency) resolves the config's extensionless TS
  // imports; node's bare type stripping cannot. The child prints the config's
  // `env` block so a case can assert what the build would inline.
  const result = spawnSync(
    process.execPath,
    [
      "--import",
      "tsx",
      "-e",
      "const m = await import('./next.config.ts'); const c = m.default?.default ?? m.default; console.log(JSON.stringify(c.env ?? {}))"
    ],
    { env, encoding: "utf8" }
  );
  if (result.status !== 0 && !/NEXT_PUBLIC|twin|measurement|door guard/i.test(result.stderr)) {
    // A load failure that is NOT the guard (resolver error, syntax error)
    // must never masquerade as a correct rejection.
    console.error(result.stderr.slice(0, 2000));
    throw new Error("next.config.ts failed to load for a non-guard reason");
  }
  const status = result.status ?? 1;
  const lastLine = result.stdout.trim().split("\n").pop() ?? "{}";
  return { status, env: status === 0 ? (JSON.parse(lastLine) as Record<string, string>) : {} };
}

let failures = 0;

for (const [client, server] of PAIRS) {
  if (loadConfig({ [client]: "1" }).status === 0) {
    console.error(`FAIL: ${client}=1 with ${server} unset loaded cleanly — twin guard missing`);
    failures += 1;
  } else {
    console.log(`ok: ${client}=1 without ${server} is rejected`);
  }

  if (loadConfig({ [client]: "1", [server]: "1" }).status !== 0) {
    console.error(`FAIL: ${client}=1 + ${server}=1 was rejected — guard fires on a valid pair`);
    failures += 1;
  } else {
    console.log(`ok: ${client}=1 with ${server}=1 loads`);
  }
}

// All-off production config must load (the launch default).
if (loadConfig({}).status !== 0) {
  console.error("FAIL: all-flags-off production config did not load");
  failures += 1;
} else {
  console.log("ok: all-flags-off production config loads");
}

// ── Production door guard (Task 1.11) ───────────────────────────────────────
const readIfPresent = (relative: string): string | null => {
  const file = path.join(process.cwd(), relative);
  return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;
};
const ledger = readIfPresent(COPY_LEDGER_PATH) ?? "";
let labels: IdeaLabelsFile | null = null;
try {
  const text = readIfPresent(IDEA_LABELS_PATH);
  labels = text === null ? null : (JSON.parse(text) as IdeaLabelsFile);
} catch {
  labels = null;
}
const door = (value: string) => checkProductionDoor(value, ledger, labels, PROMPT_VERSION, activeModelId());

// Refusals that hold whatever the ledger says.
for (const value of ["1", "not-a-surface", "home"]) {
  if (loadConfig({ NEXT_PUBLIC_GUIDE_DOOR: value }).status === 0) {
    console.error(`FAIL: NEXT_PUBLIC_GUIDE_DOOR=${value} loaded in production — door guard missing`);
    failures += 1;
  } else {
    console.log(`ok: NEXT_PUBLIC_GUIDE_DOOR=${value} is rejected in production`);
  }
}

// `calm` renders no ledger rows, so it always opens — and is inlined as-is.
const calm = loadConfig({ NEXT_PUBLIC_GUIDE_DOOR: "calm" });
if (calm.status !== 0 || calm.env.NEXT_PUBLIC_GUIDE_DOOR !== "calm") {
  console.error("FAIL: NEXT_PUBLIC_GUIDE_DOOR=calm did not load with calm inlined");
  failures += 1;
} else {
  console.log("ok: NEXT_PUBLIC_GUIDE_DOOR=calm loads and is inlined");
}

// The config must agree with the guard on today's real ledger: `source` loads
// exactly when every row it renders is Approved.
const sourceCheck = door("source");
const source = loadConfig({ NEXT_PUBLIC_GUIDE_DOOR: "source" });
if ((source.status === 0) !== (sourceCheck.errors.length === 0)) {
  console.error("FAIL: next.config.ts and checkProductionDoor disagree on NEXT_PUBLIC_GUIDE_DOOR=source");
  failures += 1;
} else {
  console.log(
    `ok: NEXT_PUBLIC_GUIDE_DOOR=source ${source.status === 0 ? "loads (rows Approved)" : "is rejected (rows not all Approved)"}`
  );
}

// Staleness: what a production build that opens the ideas surfaces would drop.
for (const warning of door("ideas,ideas-full").warnings) {
  console.log(`issue: ${warning}`);
}

if (failures > 0) {
  process.exit(1);
}
console.log("production-mode config guards: all green");
