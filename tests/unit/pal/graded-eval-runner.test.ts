import { describe, expect, it } from "vitest";

type GradedEvalModule = {
  planGradedEval: (env?: Record<string, string>) =>
    | { status: "setup_blocked"; message: string }
    | { status: "ready"; args: string[]; env: Record<string, string> };
};

const GRADED_EVAL_RUNNER_MODULE = "../../../scripts/run-graded-evals.mjs";

async function loadGradedEvalRunner(): Promise<GradedEvalModule> {
  return (await import(GRADED_EVAL_RUNNER_MODULE)) as GradedEvalModule;
}

describe("run-graded-evals", () => {
  it("reports SETUP_BLOCKED when OPENAI_API_KEY is missing", async () => {
    const { planGradedEval } = await loadGradedEvalRunner();

    const plan = planGradedEval({});

    expect(plan.status).toBe("setup_blocked");
    if (plan.status !== "setup_blocked") {
      throw new Error("Expected setup_blocked plan.");
    }

    expect(plan.message).toContain("SETUP_BLOCKED");
    expect(plan.message).toContain("OPENAI_API_KEY");
  });

  it("enables PAL_LIVE_EVAL and targets the graded eval when credentials are present", async () => {
    const { planGradedEval } = await loadGradedEvalRunner();

    const plan = planGradedEval({ OPENAI_API_KEY: "test-key" });

    expect(plan.status).toBe("ready");
    if (plan.status !== "ready") {
      throw new Error("Expected ready plan.");
    }

    expect(plan.env.PAL_LIVE_EVAL).toBe("1");
    expect(plan.args).toEqual([
      "vitest",
      "run",
      "tests/evals/pal-graded-eval.test.ts"
    ]);
  });
});
