import fs from "node:fs";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  GUIDE_SURFACES,
  guideDoorEnabled,
} from "../../../lib/guide-door-flag";
import { SOURCE_LEAD } from "../../../components/result-card";

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");

describe("guideDoorEnabled — the one door flag (PRD §9 Step 1, §9.2 revert lever)", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("`1` opens every surface; a list opens only its members; anything else opens none", () => {
    vi.stubEnv("NEXT_PUBLIC_GUIDE_DOOR", "1");
    for (const surface of GUIDE_SURFACES)
      expect(guideDoorEnabled(surface)).toBe(true);

    vi.stubEnv("NEXT_PUBLIC_GUIDE_DOOR", "ideas, source");
    expect(guideDoorEnabled("ideas")).toBe(true);
    expect(guideDoorEnabled("source")).toBe(true);
    expect(guideDoorEnabled("orient")).toBe(false);

    for (const value of ["true", "0", "", "yes", "idea"]) {
      vi.stubEnv("NEXT_PUBLIC_GUIDE_DOOR", value);
      for (const surface of GUIDE_SURFACES)
        expect(guideDoorEnabled(surface)).toBe(false);
    }
  });
});

describe("guide-door render sites (source pins, node env has no DOM)", () => {
  it("DashboardView renders the ideas block ABOVE the hero, gated by the flag", () => {
    const src = read("components/dashboard-view.tsx");
    expect(src).toMatch(/from\s+["'].*guide-door-flag["']/);
    expect(src.indexOf("<GuideIdeas")).toBeGreaterThan(-1);
    expect(src.indexOf("<GuideIdeas")).toBeLessThan(src.indexOf("<HomeCheckHero"));
    // Review fix round 1: the two assertions above pass even if <GuideIdeas />
    // renders unconditionally — pin the actual gate, not just source order.
    expect(src).toMatch(/ideasOn\s*=\s*guideDoorEnabled\(\s*["']ideas["']\s*\)/);
    expect(src).toContain("ideasOn ? <GuideIdeas");
  });

  it("the chips hand off through pal.recheck and mark the source — /check stays the one place a check runs", () => {
    const src = read("components/guide-ideas.tsx");
    expect(src).toContain('"pal.recheck"');
    expect(src).toContain('"pal.recheck.source"');
    expect(src).toContain('router.push("/check?stay=1")'); // A-102
    // The anchor phrase (PRD §7.3), never "your plan".
    expect(src).toMatch(/Prediabetes Pal(?:'|&apos;|’)s rules/);
    expect(src).not.toMatch(/your plan/i);
  });

  it("the check form reads pal.recheck.source alongside pal.recheck and emits idea_check_completed once", () => {
    const src = read("components/food-check-form.tsx");
    expect(src).toContain('"pal.recheck.source"');
    expect(src.match(/name: "idea_check_completed"/g)).toHaveLength(1);
  });

  it("the other pal.recheck writers also clear pal.recheck.source (review A-102) — a hand-off that never reached the form cannot make a later typed check count as an idea", () => {
    for (const rel of [
      "app/(app)/meals/page.tsx",
      "components/meal-memory-recall.tsx",
      "components/home-check-hero.tsx",
    ]) {
      expect(read(rel)).toContain('"pal.recheck.source"');
    }
  });
});

describe("F-SOURCE lead-in (PRD v1.1 §6 F-SOURCE)", () => {
  it("has one sentence per label, each citing the product's own rules and no authority", () => {
    for (const risk of ["SAFE", "MODERATE", "HIGH"] as const) {
      const line = SOURCE_LEAD[risk];
      expect(line).toMatch(/^Why this label: under Prediabetes Pal's rules this description reads as /);
      expect(line).not.toMatch(/doctor|science|clinic|study|research/i);
      expect(line).not.toMatch(/\d/); // no numeric claim
      expect(line).not.toMatch(/same read every time|never changes/i); // the held /how-it-works claim
    }
  });

  it("result-card renders the lead-in from the map, flag-gated, above the reason", () => {
    const src = read("components/result-card.tsx");
    expect(src).toMatch(/from\s+["'].*guide-door-flag["']/);
    expect(src).toContain("SOURCE_LEAD[response.risk]");
    expect(src.indexOf("SOURCE_LEAD[response.risk]")).toBeLessThan(src.indexOf("{response.reason}"));
  });
});

describe("check-empty-ideas: ideas on /check's first-run empty state (Task 1.14 / plan Task 4.2)", () => {
  it("gates on guideDoorEnabled(\"ideas\") and emits ideas_shown/idea_tapped with surface: \"check\"", () => {
    const src = read("components/food-check-form.tsx");
    expect(src).toMatch(/from\s+["'].*guide-door-flag["']/);
    expect(src).toMatch(/guideDoorEnabled\(\s*["']ideas["']\s*\)/);
    expect(src).toMatch(/name:\s*["']ideas_shown["']/);
    expect(src).toMatch(/name:\s*["']idea_tapped["']/);
    expect(src.match(/surface:\s*["']check["']/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
  });

  it("renders the reviewed row heading and the flag-gated classics hint (controller ruling 1)", () => {
    const src = read("components/food-check-form.tsx");
    expect(src).toContain("Or start from an idea for ");
    expect(src).toContain("Or try a classic — three everyday foods.");
    // Flag off ⇒ byte-for-byte unchanged classics hint (controller ruling 3).
    expect(src).toContain(
      "First time? Try one of the classics — three everyday breakfast staples."
    );
  });

  it('the tap sets recheckSource: "idea" — the same hand-off shape as a Home tap (review A-69)', () => {
    const src = read("components/food-check-form.tsx");
    expect(src).toMatch(/recheckSource:\s*["']idea["']/);
  });

  it("sits below the submit CTA and above the classics block in source order (controller ruling 3)", () => {
    const src = read("components/food-check-form.tsx");
    const submitIndex = src.indexOf('type="submit"');
    const ideasIndex = src.indexOf('data-testid="check-empty-ideas"');
    const classicsIndex = src.indexOf('data-testid="first-check-classics"');
    expect(submitIndex).toBeGreaterThan(-1);
    expect(ideasIndex).toBeGreaterThan(submitIndex);
    expect(classicsIndex).toBeGreaterThan(ideasIndex);
  });
});
