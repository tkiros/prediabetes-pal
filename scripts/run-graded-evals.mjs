#!/usr/bin/env node

import { spawn } from "node:child_process";
import process from "node:process";
import { fileURLToPath } from "node:url";

export const GRADED_EVAL_ARGS = [
  "vitest",
  "run",
  "tests/evals/pal-graded-eval.test.ts"
];

export function planGradedEval(env = process.env) {
  if (!env.OPENAI_API_KEY) {
    return {
      status: "setup_blocked",
      message:
        "SETUP_BLOCKED: OPENAI_API_KEY is required to run the live graded quality gate. Create a key in the OpenAI dashboard, export OPENAI_API_KEY, and rerun node scripts/run-graded-evals.mjs."
    };
  }

  return {
    status: "ready",
    command: "npx",
    args: GRADED_EVAL_ARGS,
    env: {
      ...env,
      PAL_LIVE_EVAL: "1"
    }
  };
}

export async function runGradedEval(env = process.env) {
  const plan = planGradedEval(env);

  if (plan.status === "setup_blocked") {
    console.log(plan.message);
    return 0;
  }

  console.log(
    "Running the live graded quality gate (real model) over labeled + adversarial cases."
  );

  const exitCode = await spawnCommand(plan.command, plan.args, {
    cwd: process.cwd(),
    env: plan.env
  });

  if (exitCode !== 0) {
    console.error(
      "Graded quality gate FAILED. Review harmful-SAFE / usefulness / adversarial / accuracy above."
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
  process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isMainModule) {
  runGradedEval().then(
    (code) => {
      process.exitCode = code;
    },
    (error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    }
  );
}
