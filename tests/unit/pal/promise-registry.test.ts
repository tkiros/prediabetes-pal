import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { routeA1C } from "../../../lib/pal/a1c";
import { classifyClinicalRisk } from "../../../lib/pal/clinical-risk";
import { classifyInputBeforeModel } from "../../../lib/pal/input-precheck";
import {
  OATMEAL_EXAMPLE,
  PROMISE_REGISTRY,
  promotedInputsFor,
  type PromiseExample
} from "../../../lib/pal/promise-registry";

const ROOT = process.cwd();
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), "utf8");

// Strip comment-leading lines before a source-guard scan, so prose ABOUT a food
// is fine and only a RENDERED literal trips the guard (copy-pins.test.ts pattern).
function stripComments(text: string): string {
  return text
    .split("\n")
    .filter((line) => !/^\s*(?:\/\/|\/\*|\*)/.test(line))
    .join("\n");
}

/**
 * Promise registry — the deploy-blocking fixture test (Plan §P1.1).
 *
 * Every meal example Prediabetes Pal PROMOTES (landing demo, onboarding first-check
 * chips) is registered here with the route KIND the deterministic precheck must
 * return. The precheck (`classifyClinicalRisk` → `classifyInputBeforeModel`) is
 * model-free, so the promise-to-proof link is testable WITHOUT a model call:
 * assert the observed route kind equals the registered `expectedRoute`, and for
 * a clarify step assert the exact question equals the registered one.
 *
 * This does NOT assert generative wording. A `"result"` step only has to reach
 * the model-eligible path (precheck kind `ok`/`carbs_only`) — the model still
 * writes the card. What it pins is the SHAPE of the promise: if "oatmeal" ever
 * stops asking "plain or sweetened?" and starts answering immediately, or a
 * promoted example changes route, this test goes red and CI blocks the deploy.
 */

// The precheck's route KIND, mapped onto the promise vocabulary. A clarify
// outcome is a "clarify" promise; anything the model is still allowed to grade
// (ok / carbs_only) is a "result" promise.
function observedRoute(input: string): {
  route: "clarify" | "result" | "other";
  question?: string;
} {
  const precheck = classifyInputBeforeModel(input);
  if (precheck.kind === "clarify") {
    return { route: "clarify", question: precheck.question };
  }
  if (precheck.kind === "ok" || precheck.kind === "carbs_only") {
    return { route: "result" };
  }
  return { route: "other" };
}

describe("promise registry drives promoted examples from the real precheck", () => {
  it("is non-empty", () => {
    expect(PROMISE_REGISTRY.length).toBeGreaterThan(0);
  });

  it.each(PROMISE_REGISTRY.map((e) => [e.input, e] as const))(
    "%s: every promoted example carries honest metadata",
    (_input, entry: PromiseExample) => {
      expect(entry.approvedMeaning.trim().length).toBeGreaterThan(0);
      expect(entry.evidenceOwner.trim().length).toBeGreaterThan(0);
      expect(entry.surfaces.length).toBeGreaterThan(0);
      // Never fabricate a live-capture timestamp — null until one exists.
      if (entry.lastLiveCaptureAt !== null) {
        expect(entry.lastLiveCaptureAt).toMatch(/^\d{4}-\d{2}-\d{2}/);
        expect(Number.isNaN(Date.parse(entry.lastLiveCaptureAt))).toBe(false);
      }
      // A clarify promise must register the exact question; a result promise
      // must not pretend to be a clarify.
      if (entry.expectedRoute === "clarify") {
        expect(entry.expectedClarifyQuestion?.trim().length).toBeGreaterThan(0);
      } else {
        expect(entry.expectedClarifyQuestion).toBeUndefined();
      }
    }
  );

  it.each(PROMISE_REGISTRY.map((e) => [e.input, e] as const))(
    "%s: the deterministic precheck matches the registered route",
    (_input, entry: PromiseExample) => {
      // A promoted example is shown to in-range users; the mid-range band must
      // reach the precheck at all (not get routed out of scope first).
      expect(routeA1C(6.0).kind).toBe("in_scope");

      // Clinical routing runs first and must not steal a promoted food example.
      expect(classifyClinicalRisk(entry.input)).toBeNull();

      const step1 = observedRoute(entry.input);
      expect(step1.route).toBe(entry.expectedRoute);
      if (entry.expectedRoute === "clarify") {
        expect(step1.question).toBe(entry.expectedClarifyQuestion);
      }

      // Two-step flow: the clarification answer must reach the model path.
      if (entry.followUp) {
        expect(classifyClinicalRisk(entry.followUp)).toBeNull();
        expect(observedRoute(entry.followUp).route).toBe("result");
      }
    }
  );

  it("registers oatmeal as the honest two-step clarify → result flow", () => {
    expect(OATMEAL_EXAMPLE.input).toBe("oatmeal");
    expect(OATMEAL_EXAMPLE.expectedRoute).toBe("clarify");
    // Pinned to the REAL precheck output — if the precheck question changes,
    // both this and the rendered demo must change together.
    expect(OATMEAL_EXAMPLE.expectedClarifyQuestion).toBe(
      "Is this plain or sweetened?"
    );
    expect(OATMEAL_EXAMPLE.followUp).toBeTruthy();
    expect(OATMEAL_EXAMPLE.surfaces).toContain("landing");
    expect(OATMEAL_EXAMPLE.surfaces).toContain("demo-card");
    expect(OATMEAL_EXAMPLE.surfaces).toContain("onboarding");
  });
});

describe("promoted surfaces render the registry, not hardcoded fixtures", () => {
  it("the first-check classics derive from the registry at their render site", () => {
    // The chips moved from the onboarding first_check step to the check
    // page's first-run empty state (2026-08-11); the guard moves with them.
    const src = read("lib/client/first-check-chips.ts");
    expect(src).toMatch(/from\s+["'].*pal\/promise-registry["']/);
    // The literal food list is gone — it is derived from promotedInputsFor.
    expect(src).toMatch(/promotedInputsFor\(\s*["']onboarding["']\s*\)/);
    // And the check form renders that module, not a retyped list.
    expect(read("components/food-check-form.tsx")).toMatch(
      /from\s+["'].*client\/first-check-chips["']/
    );
    // promotedInputsFor("onboarding") is exactly the promoted classics.
    expect(promotedInputsFor("onboarding")).toEqual([
      "oatmeal",
      "banana",
      "orange juice"
    ]);
  });

  it("the demo card drives the interaction flow strings from the registry", () => {
    const rel = "components/demo-check-card.tsx";
    const src = read(rel);
    expect(
      src,
      `${rel} must import the promise registry`
    ).toMatch(/from\s+["'].*pal\/promise-registry["']/);
    // The three interaction-flow strings are interpolated from the entry,
    // never retyped, so this test guards them.
    expect(src, `${rel} must render the entered food from the entry`).toContain(
      ".input"
    );
    expect(
      src,
      `${rel} must render the clarify question from the entry`
    ).toContain(".expectedClarifyQuestion");
    expect(
      src,
      `${rel} must render the clarification answer from the entry`
    ).toContain(".followUp");
    // The old FALSE flow — typing "oatmeal" and getting an immediate card,
    // no clarify — hardcoded the food into the flow line. It must be gone.
    expect(
      stripComments(src),
      `${rel} must not hardcode the food in the "you enter/type" flow line`
    ).not.toMatch(/You (?:enter|type):\s*(?:<strong>)?\s*oatmeal/i);
  });

  /**
   * The landing used to hand-copy DemoCheckCard's markup into a phone bezel, so
   * it needed the same interpolation guard as the component — and the page then
   * rendered the oatmeal verdict TWICE, once in the bezel and once in the
   * "kind of answer you get" section (2026-07-27 landing audit).
   *
   * The duplicate is gone; the landing renders the component. So the guarantee
   * is no longer "the page interpolates the registry" but the stronger "the page
   * does not render this flow itself at all" — asserted against the live
   * registry values, so a future hand-typed copy of any of the three strings
   * fails here even if someone matches the wording exactly.
   */
  it("the landing delegates the interaction flow instead of retyping it", () => {
    const src = stripComments(read("app/page.tsx"));
    expect(src, "app/page.tsx must render DemoCheckCard").toMatch(
      /<DemoCheckCard\b/
    );
    for (const literal of [
      OATMEAL_EXAMPLE.expectedClarifyQuestion,
      OATMEAL_EXAMPLE.followUp
    ]) {
      expect(
        src,
        `app/page.tsx must not hand-type the flow string ${JSON.stringify(literal)}`
      ).not.toContain(literal);
    }
    expect(
      src,
      'app/page.tsx must not hardcode the food in the "you enter/type" flow line'
    ).not.toMatch(/You (?:enter|type):\s*(?:<strong>)?\s*oatmeal/i);
  });
});
