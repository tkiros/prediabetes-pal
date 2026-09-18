import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

// Task 3.7: the tour's last screen is rendered in node, which has no DOM and
// no clicks. The step is internal state, so the page's useState is wrapped to
// open on a chosen step; the link and the router are stand-ins.
const forced = vi.hoisted(() => ({ step: null as string | null }));
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  const useState = ((initial: unknown) => {
    const pair = actual.useState(initial);
    return initial === "welcome" && forced.step ? [forced.step, pair[1]] : pair;
  }) as typeof actual.useState;
  return { ...actual, useState };
});
vi.mock("next/link", async () => {
  const { createElement: h } = await import("react");
  return {
    default: ({ href, className, children }: { href?: unknown; className?: string; children?: ReactNode }) =>
      h("a", { href: typeof href === "string" ? href : undefined, className }, children)
  };
});
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));

// The onboarding page is a client component; importing it pulls the profile
// store (which touches window.localStorage) into scope, so — as in
// food-check-form.test.ts — expose a fake storage BEFORE the import.
function fakeStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
    clear: () => void map.clear()
  };
}

const storage = fakeStorage();
vi.stubGlobal("localStorage", storage);
vi.stubGlobal("window", { localStorage: storage });

import OnboardingPage, {
  leaveTour,
  nextStepAfterAttribution,
  nextStepAfterSegment,
  progressFor,
  STEP_PROGRESS,
  STEP_PROGRESS_ASK,
  stepCounter,
  trackedStep
} from "../../../app/(app)/onboarding/page";

const STEPS = ["welcome", "segment", "attribution", "a1c", "expectations", "boundary"] as const;

function renderStep(step: (typeof STEPS)[number]): string {
  forced.step = step;
  try {
    return renderToStaticMarkup(createElement(OnboardingPage));
  } finally {
    forced.step = null;
  }
}

const FIRST_WEEK_LINE = "Your first week starts on Home: seven small steps, one a day.";

afterEach(() => {
  vi.unstubAllEnvs();
  storage.clear();
});

describe("nextStepAfterAttribution (single-source A1C rule)", () => {
  it("routes a device with a saved A1C straight past the A1C step", () => {
    expect(nextStepAfterAttribution(true)).toBe("expectations");
  });

  it("asks for the A1C when the device has none", () => {
    expect(nextStepAfterAttribution(false)).toBe("a1c");
  });
});

describe("stepCounter (visible Step X of N)", () => {
  it("counts 5 steps for a new user, in order, with no holes", () => {
    const path = [
      "welcome",
      "segment",
      "attribution",
      "a1c",
      "expectations"
    ] as const;
    expect(path.map((s) => stepCounter(s, false))).toEqual([
      "Step 1 of 5",
      "Step 2 of 5",
      "Step 3 of 5",
      "Step 4 of 5",
      "Step 5 of 5"
    ]);
  });

  it("counts 4 contiguous steps for a returning guest who skips a1c", () => {
    const path = ["welcome", "segment", "attribution", "expectations"] as const;
    expect(path.map((s) => stepCounter(s, true))).toEqual([
      "Step 1 of 4",
      "Step 2 of 4",
      "Step 3 of 4",
      "Step 4 of 4"
    ]);
  });

  it("shows nothing on the boundary exit and on a skipped a1c", () => {
    expect(stepCounter("boundary", false)).toBe("");
    expect(stepCounter("a1c", true)).toBe("");
  });
});

describe("STEP_PROGRESS (goal-gradient bar)", () => {
  it("never shows a visible step at zero — arriving counts as progress", () => {
    const visible = [
      "welcome",
      "segment",
      "attribution",
      "a1c",
      "expectations"
    ] as const;
    for (const step of visible) {
      expect(STEP_PROGRESS[step]).toBeGreaterThan(0);
      expect(STEP_PROGRESS[step]).toBeLessThan(100);
    }
  });

  it("only ever moves forward, on both the full and the skip-A1C path", () => {
    const full = [
      "welcome",
      "segment",
      "attribution",
      "a1c",
      "expectations"
    ] as const;
    const skipA1c = ["welcome", "segment", "attribution", "expectations"] as const;
    for (const path of [full, skipA1c]) {
      for (let i = 1; i < path.length; i++) {
        expect(STEP_PROGRESS[path[i]]).toBeGreaterThan(STEP_PROGRESS[path[i - 1]]);
      }
    }
  });
});

describe("trackedStep — the tour funnel never names a result", () => {
  it("maps the screens the floor reads and nothing else", () => {
    expect(trackedStep("welcome")).toBeNull();
    expect(trackedStep("segment")).toBe("segment");
    expect(trackedStep("attribution")).toBe("attribution");
    expect(trackedStep("expectations")).toBe("expectations");
    expect(trackedStep("a1c")).toBeNull();
    expect(trackedStep("boundary")).toBeNull();
  });
});

describe("F-ASK tour plumbing (PRD v1.1 §7.5)", () => {
  it("counts 7 / 6 contiguous steps with the two ask screens, and 5 / 4 without", () => {
    expect(stepCounter("ask_pains", false, true)).toBe("Step 3 of 7");
    expect(stepCounter("ask_win", false, true)).toBe("Step 4 of 7");
    expect(stepCounter("expectations", false, true)).toBe("Step 7 of 7");
    expect(stepCounter("expectations", true, true)).toBe("Step 6 of 6");
    expect(stepCounter("ask_pains", false, false)).toBe("");
    expect(stepCounter("expectations", false, false)).toBe("Step 5 of 5");
  });

  it("routes segment → ask_pains only when the door is on", () => {
    expect(nextStepAfterSegment(true)).toBe("ask_pains");
    expect(nextStepAfterSegment(false)).toBe("attribution");
  });

  it("the ask bar never shows a visible step at zero and only moves forward", () => {
    const full = ["welcome", "segment", "ask_pains", "ask_win", "attribution", "a1c", "expectations"] as const;
    const skip = ["welcome", "segment", "ask_pains", "ask_win", "attribution", "expectations"] as const;
    for (const path of [full, skip]) {
      for (let i = 0; i < path.length; i++) {
        expect(progressFor(path[i], true)).toBeGreaterThan(0);
        expect(progressFor(path[i], true)).toBeLessThan(100);
        if (i > 0) expect(STEP_PROGRESS_ASK[path[i]]).toBeGreaterThan(STEP_PROGRESS_ASK[path[i - 1]]);
      }
    }
    expect(progressFor("segment", false)).toBe(STEP_PROGRESS.segment);
  });
});

describe("the tour's last screen (Task 3.7, A-05, A-28)", () => {
  it("flag off: every step renders exactly the pre-guide markup", async () => {
    vi.stubEnv("NEXT_PUBLIC_GUIDE_DOOR", "");
    const markup = STEPS.map((step) => `<!-- ${step} -->\n${renderStep(step)}`).join("\n\n");
    // Captured from the page before Task 3.7 touched it.
    await expect(`${markup}\n`).toMatchFileSnapshot("./__snapshots__/onboarding-flag-off.html");
    const last = renderStep("expectations");
    expect(last).toContain(">Check my first meal</button>");
    expect(last).not.toContain(FIRST_WEEK_LINE);
    expect(last).not.toContain("Start your first week");
  });

  it("orient on: the last screen gains the first-week line and the new button; no other step changes", () => {
    vi.stubEnv("NEXT_PUBLIC_GUIDE_DOOR", "");
    const off = STEPS.map(renderStep);
    vi.stubEnv("NEXT_PUBLIC_GUIDE_DOOR", "ideas,orient");
    const on = STEPS.map(renderStep);
    STEPS.forEach((step, index) => {
      if (step !== "expectations") expect(on[index], step).toBe(off[index]);
    });
    const last = on[STEPS.indexOf("expectations")];
    expect(last).toContain(`<p class="page-copy">${FIRST_WEEK_LINE}</p><p class="result-disclaimer">`);
    expect(last).toContain(">Start your first week</button>");
    expect(last).not.toContain("Check my first meal");
    expect(last.replace(`<p class="page-copy">${FIRST_WEEK_LINE}</p>`, "").replace("Start your first week", "Check my first meal")).toBe(
      off[STEPS.indexOf("expectations")]
    );
  });

  it("flag off: leaving goes to /check and never starts the week", () => {
    vi.stubEnv("NEXT_PUBLIC_GUIDE_DOOR", "ideas");
    const push = vi.fn();
    leaveTour(push);
    expect(push).toHaveBeenCalledExactlyOnceWith("/check");
    expect(storage.getItem("pal.orient.v1")).toBeNull();
  });

  it("orient on: the week is started before Home is pushed, with the stay escape hatch", () => {
    vi.stubEnv("NEXT_PUBLIC_GUIDE_DOOR", "orient");
    let weekAtPush: string | null = null;
    const push = vi.fn(() => {
      weekAtPush = storage.getItem("pal.orient.v1");
    });
    leaveTour(push);
    expect(push).toHaveBeenCalledExactlyOnceWith("/home?stay=1");
    expect(JSON.parse(weekAtPush ?? "{}")).toMatchObject({ startedAt: expect.any(String), done: [], dismissedAt: null });
  });

  it("orient on: a week already started keeps its start (A-05: start is a no-op the second time)", () => {
    vi.stubEnv("NEXT_PUBLIC_GUIDE_DOOR", "1");
    const week = { done: ["1"], dismissedAt: null, startedAt: "2026-09-01T12:00:00.000Z" };
    storage.setItem("pal.orient.v1", JSON.stringify(week));
    leaveTour(vi.fn());
    expect(JSON.parse(storage.getItem("pal.orient.v1") ?? "{}")).toEqual(week);
  });
});
