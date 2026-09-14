import { describe, expect, it } from "vitest";

import { classifyClinicalRisk } from "../../../lib/pal/clinical-risk";
import {
  GUIDE_IDEA_BANK,
  GUIDE_IDEAS,
  ideasFor,
  ideasFrom
} from "../../../lib/pal/guide-ideas";
import { classifyInputBeforeModel } from "../../../lib/pal/input-precheck";

/**
 * The idea bank (PRD v1.1 §6 F-IDEAS). Tiering rule from the PRD: every idea
 * must return Clear at every band 5.7–6.4, so the DETERMINISTIC half of that
 * (no clinical route, no clarify, no carbs-only / carb-forward / high-risk
 * floor) is pinned here without a model call. The model half is the live
 * labelling eval (tests/evals/guide-ideas-label-eval.test.ts, Task 4.1).
 */
describe("guide idea bank — precheck-clean, positive only", () => {
  it("has at least six ideas per daypart — two disjoint loads of three (review A-43)", () => {
    for (const daypart of ["breakfast", "lunch", "dinner"] as const) {
      expect(GUIDE_IDEA_BANK[daypart].length).toBeGreaterThanOrEqual(6);
    }
  });

  it.each(GUIDE_IDEAS.map((idea) => [idea.text, idea] as const))(
    "%s reaches the model path with no floor and no clarify",
    (_text, idea) => {
      expect(classifyClinicalRisk(idea.text)).toBeNull();
      expect(classifyInputBeforeModel(idea.text)).toEqual({
        kind: "ok",
        flags: []
      });
    }
  );

  it("names nothing to limit — the bank is positive only (§6 F-IDEAS acceptance)", () => {
    for (const idea of GUIDE_IDEAS) {
      expect(idea.text).not.toMatch(/\b(?:avoid|limit|skip|cut|without|instead of|no )\b/i);
      expect(idea.text.length).toBeLessThanOrEqual(64); // review A-54: two lines in a 315px row at 375 (FOOD_MAX_LENGTH is 160)
    }
  });

  it("ids are unique and each idea carries its daypart", () => {
    const ids = GUIDE_IDEAS.map((idea) => idea.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const idea of GUIDE_IDEAS) {
      expect(GUIDE_IDEA_BANK[idea.daypart]).toContain(idea.text);
    }
  });

  it("an empty daypart bank yields no ideas rather than NaN — a property, not a guard (reviews A-31, A-70)", () => {
    expect(ideasFrom([], "breakfast", 0)).toEqual([]);
    expect(ideasFrom(GUIDE_IDEAS.filter((idea) => idea.daypart !== "lunch"), "lunch", 5)).toEqual([]);
  });

  it("rotates deterministically: consecutive loads never share a first idea", () => {
    for (const daypart of ["breakfast", "lunch", "dinner"] as const) {
      const a = ideasFor(daypart, 0);
      const b = ideasFor(daypart, 1);
      expect(a).toHaveLength(3);
      expect(a[0].id).not.toBe(b[0].id);
      expect(ideasFor(daypart, 0)).toEqual(a); // same counter, same list
      expect(new Set(a.map((i) => i.id)).size).toBe(3); // no repeats in one load
      expect(a.filter((i) => b.some((j) => j.id === i.id))).toHaveLength(0); // review A-43: consecutive loads are disjoint
    }
  });
});
