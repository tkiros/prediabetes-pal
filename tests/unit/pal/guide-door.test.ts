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
  });

  it("the chips hand off through pal.recheck and mark the source — /check stays the one place a check runs", () => {
    const src = read("components/guide-ideas.tsx");
    expect(src).toContain('"pal.recheck"');
    expect(src).toContain('"pal.recheck.source"');
    expect(src).toContain('router.push("/check?stay=1")'); // A-102
    // The anchor phrase (PRD §7.3), never "your plan".
    expect(src).toMatch(/Prediabetes Pal(?:'|&apos;|')s rules/);
    expect(src).not.toMatch(/your plan/i);
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
