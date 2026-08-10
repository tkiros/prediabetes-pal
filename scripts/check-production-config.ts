import { spawnSync } from "node:child_process";

/**
 * AUD-005 / AUD-002 — production-mode config gate, run in CI with synthetic
 * non-secret values. Loads the REAL next.config.ts in a child process per
 * case and asserts the twin guard fires for every client/server flag pair
 * (client baked on + runtime kill switch unset must FAIL the build) and stays
 * quiet when the pair agrees. PAL_ALLOW_NO_MEASUREMENT=1 isolates the twin
 * guard — flag safety is deliberately outside the analytics waiver.
 */

const PAIRS: Array<[client: string, server: string]> = [
  ["NEXT_PUBLIC_PHOTO_INPUT", "PHOTO_INPUT_ENABLED"],
  ["NEXT_PUBLIC_LONGITUDINAL_INSIGHTS", "LONGITUDINAL_INSIGHTS_ENABLED"],
  ["NEXT_PUBLIC_MEAL_MEMORY", "MEAL_MEMORY_ENABLED"],
  ["NEXT_PUBLIC_LEARNING_JOURNEY", "LEARNING_JOURNEY_ENABLED"]
];

function loadConfig(extraEnv: Record<string, string>): number {
  const env = {
    ...process.env,
    VERCEL_ENV: "production",
    PAL_ALLOW_NO_MEASUREMENT: "1"
  } as NodeJS.ProcessEnv;
  // Start every pair from a clean slate so ambient dev env can't skew a case.
  for (const [client, server] of PAIRS) {
    delete env[client];
    delete env[server];
  }
  Object.assign(env, extraEnv);
  // tsx (already a devDependency) resolves the config's extensionless TS
  // imports; node's bare type stripping cannot.
  const result = spawnSync(
    process.execPath,
    ["--import", "tsx", "-e", "await import('./next.config.ts')"],
    { env, encoding: "utf8" }
  );
  if (result.status !== 0 && !/NEXT_PUBLIC|twin|measurement/i.test(result.stderr)) {
    // A load failure that is NOT the guard (resolver error, syntax error)
    // must never masquerade as a correct rejection.
    console.error(result.stderr.slice(0, 2000));
    throw new Error("next.config.ts failed to load for a non-guard reason");
  }
  return result.status ?? 1;
}

let failures = 0;

for (const [client, server] of PAIRS) {
  if (loadConfig({ [client]: "1" }) === 0) {
    console.error(`FAIL: ${client}=1 with ${server} unset loaded cleanly — twin guard missing`);
    failures += 1;
  } else {
    console.log(`ok: ${client}=1 without ${server} is rejected`);
  }

  if (loadConfig({ [client]: "1", [server]: "1" }) !== 0) {
    console.error(`FAIL: ${client}=1 + ${server}=1 was rejected — guard fires on a valid pair`);
    failures += 1;
  } else {
    console.log(`ok: ${client}=1 with ${server}=1 loads`);
  }
}

// All-off production config must load (the launch default).
if (loadConfig({}) !== 0) {
  console.error("FAIL: all-flags-off production config did not load");
  failures += 1;
} else {
  console.log("ok: all-flags-off production config loads");
}

if (failures > 0) {
  process.exit(1);
}
console.log("production-mode config guards: all green");
