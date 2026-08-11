#!/usr/bin/env node

import { spawn } from "node:child_process";
import process from "node:process";
import { fileURLToPath } from "node:url";

export const LIVE_EVAL_ARGS = [
  "vitest",
  "run",
  "tests/evals/pal-safety-eval.test.ts"
];

export function planLiveEval(env = process.env) {
  if (!env.OPENAI_API_KEY) {
    return {
      status: "setup_blocked",
      message:
        "SETUP_BLOCKED: OPENAI_API_KEY is required to run live Prediabetes Pal evals. Create a key in the OpenAI dashboard, export OPENAI_API_KEY, and rerun node scripts/run-live-pal-evals.mjs."
    };
  }

  return {
    status: "ready",
    command: "npx",
    args: LIVE_EVAL_ARGS,
    env: {
      ...env,
      PAL_LIVE_EVAL: "1"
    }
  };
}

export async function runLiveEval(env = process.env) {
  const plan = planLiveEval(env);

  if (plan.status === "setup_blocked") {
    console.log(plan.message);
    return 0;
  }

  console.log(
    "Running live Prediabetes Pal evals against synthetic fixtures only via checkFood()."
  );

  const exitCode = await spawnCommand(plan.command, plan.args, {
    cwd: process.cwd(),
    env: plan.env
  });

  if (exitCode !== 0) {
    console.error(
      "Live Prediabetes Pal evals failed. Review the category/id summaries above."
    );
  }

  return exitCode;
}

function spawnCommand(command, args, options) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      ...options,
      stdio: "inherit"
    });

    child.on("error", reject);
    child.on("close", (code) => resolve(code ?? 1));
  });
}

const isMainModule =
  process.argv[1] &&
  fileURLToPath(import.meta.url) === process.argv[1];

if (isMainModule) {
  runLiveEval().then(
    (code) => {
      process.exitCode = code;
    },
    (error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    }
  );
}
