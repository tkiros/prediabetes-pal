import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { includesTrialWall } from "./e2e-spec-selection";
import { isolatedE2ERuntimeEnv } from "./e2e-runtime-env";

export const E2E_DIST_DIRS = {
  legacy: ".next-e2e-legacy",
  trial: ".next-e2e-trial"
} as const;

export function buildModesForArgs(
  args: readonly string[]
): Array<keyof typeof E2E_DIST_DIRS> {
  return includesTrialWall(args) ? ["legacy", "trial"] : ["legacy"];
}

export function stripE2ETypeIncludes(source: string): string | null {
  if (!Object.values(E2E_DIST_DIRS).some((marker) => source.includes(marker))) {
    return null;
  }

  const parsed = JSON.parse(source) as { include?: unknown };
  if (!Array.isArray(parsed.include)) return null;

  parsed.include = parsed.include.filter(
    (entry) =>
      !(
        typeof entry === "string" &&
        Object.values(E2E_DIST_DIRS).some((marker) => entry.includes(marker))
      )
  );
  return `${JSON.stringify(parsed, null, 2)}\n`;
}

function cleanGeneratedTsconfigEntries(): void {
  const path = resolve("tsconfig.json");
  if (!existsSync(path)) return;

  const source = readFileSync(path, "utf8");
  const cleaned = stripE2ETypeIncludes(source);
  if (cleaned !== null && cleaned !== source) {
    writeFileSync(path, cleaned);
  }
}

function runNodeScript(script: string, args: readonly string[], env = process.env): void {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: process.cwd(),
    env,
    stdio: "inherit"
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      `${script} ${args.join(" ")} exited with ${result.status ?? result.signal ?? "unknown status"}`
    );
  }
}

function buildMode(mode: keyof typeof E2E_DIST_DIRS): void {
  runNodeScript(resolve("node_modules/next/dist/bin/next"), ["build"], {
    ...isolatedE2ERuntimeEnv(process.env),
    NEXT_DIST_DIR: E2E_DIST_DIRS[mode],
    PAYWALL_MODE: mode,
    STRIPE_PRICE_ANNUAL: "price_e2e_annual_smoke_only"
  });
}

export function main(args = process.argv.slice(2)): void {
  try {
    for (const mode of buildModesForArgs(args)) {
      buildMode(mode);
    }
  } finally {
    cleanGeneratedTsconfigEntries();
  }

  const automaticMailbox =
    process.env.DATABASE_URL && !process.env.AUTH_EMAIL_STUB_DIR
      ? mkdtempSync(join(tmpdir(), "pal-e2e-mailbox-"))
      : null;
  const playwrightEnv = isolatedE2ERuntimeEnv({
    ...process.env,
    ...(automaticMailbox ? { AUTH_EMAIL_STUB_DIR: automaticMailbox } : {})
  });

  try {
    runNodeScript(
      resolve("node_modules/@playwright/test/cli.js"),
      ["test", ...args],
      playwrightEnv
    );
  } finally {
    if (automaticMailbox) {
      rmSync(automaticMailbox, { recursive: true, force: true });
    }
  }
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  main();
}
