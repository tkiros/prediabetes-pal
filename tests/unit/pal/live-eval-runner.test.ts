import { describe, expect, it } from "vitest";

type LiveEvalModule = {
  planLiveEval: (env?: Record<string, string>) =>
    | {
        status: "setup_blocked";
        message: string;
      }
    | {
        status: "ready";
        args: string[];
        env: Record<string, string>;
      };
};

const LIVE_EVAL_RUNNER_MODULE: string =
  "../../../scripts/run-live-pal-evals.mjs";

async function loadLiveEvalRunner(): Promise<LiveEvalModule> {
  return (await import(LIVE_EVAL_RUNNER_MODULE)) as LiveEvalModule;
}

describe("run-live-pal-evals", () => {
  it("reports SETUP_BLOCKED when OPENAI_API_KEY is missing", async () => {
    const { planLiveEval } = await loadLiveEvalRunner();

    const plan = planLiveEval({});

    expect(plan.status).toBe("setup_blocked");
    if (plan.status !== "setup_blocked") {
      throw new Error("Expected setup_blocked plan.");
    }

    expect(plan.message).toContain("SETUP_BLOCKED");
    expect(plan.message).toContain("OPENAI_API_KEY");
  });

  it("enables PAL_LIVE_EVAL when credentials are present", async () => {
    const { planLiveEval } = await loadLiveEvalRunner();

    const plan = planLiveEval({ OPENAI_API_KEY: "test-key" });

    expect(plan.status).toBe("ready");
    if (plan.status !== "ready") {
      throw new Error("Expected ready plan.");
    }

    expect(plan.env.PAL_LIVE_EVAL).toBe("1");
    expect(plan.args).toEqual([
      "vitest",
      "run",
      "tests/evals/pal-safety-eval.test.ts"
    ]);
  });
});
