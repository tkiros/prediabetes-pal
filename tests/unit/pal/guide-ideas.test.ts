import { describe, expect, it } from "vitest";

import { classifyClinicalRisk } from "../../../lib/pal/clinical-risk";
import {
  GUIDE_IDEA_BANK,
  GUIDE_IDEA_BANK_MORE,
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
      // Review A-54, Task 1.8 fix round 1: every line fits two lines in the
      // ~252px text column of a row at 360px, in every browser project (the
      // smoke fold tests measure it); 59 is the longest line that does
      // (FOOD_MAX_LENGTH is 160).
      expect(idea.text.length).toBeLessThanOrEqual(59);
    }
  });

  it("ids are unique and each idea carries its daypart", () => {
    const ids = GUIDE_IDEAS.map((idea) => idea.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const idea of GUIDE_IDEAS) {
      // PR-4: a seed idea (more === false) lives in GUIDE_IDEA_BANK, a growth
      // idea (more === true) in GUIDE_IDEA_BANK_MORE — never both, never neither.
      const pool = idea.more ? GUIDE_IDEA_BANK_MORE[idea.daypart] : GUIDE_IDEA_BANK[idea.daypart];
      expect(pool).toContain(idea.text);
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

/**
 * PR-4 Task 4.3: bank growth to ten per daypart, the `IdeasOptions` object
 * (`count`/`full`/`segment`), and segment steering — all dormant behind
 * `ideas-full` (SURFACE_REQUIRES["ideas-full"] = ["ideas"]). The default call
 * (no options) must stay byte-for-byte what it returned before this bank grew.
 */
describe("guide idea bank growth — full bank, options, segment steering (PR-4 Task 4.3)", () => {
  // Final review controller ruling: no exact counts pinned here (A-100
  // precedent — the seed tests use ≥ 6) so pruning a line after the owner's
  // label eval never turns test:pal red on its own; only the behaviour is
  // pinned.
  it("GUIDE_IDEA_BANK_MORE adds at least one line per daypart, growing the full bank past the seed", () => {
    for (const daypart of ["breakfast", "lunch", "dinner"] as const) {
      expect(GUIDE_IDEA_BANK_MORE[daypart].length).toBeGreaterThanOrEqual(1);
      expect(GUIDE_IDEA_BANK[daypart].length + GUIDE_IDEA_BANK_MORE[daypart].length).toBeGreaterThan(
        GUIDE_IDEA_BANK[daypart].length
      );
    }
  });

  it("seed ids are unchanged; the more lines pick up right after them", () => {
    expect(GUIDE_IDEAS.find((idea) => idea.id === "breakfast-1")).toMatchObject({
      text: GUIDE_IDEA_BANK.breakfast[0],
      more: false
    });
    expect(GUIDE_IDEAS.find((idea) => idea.id === "breakfast-9")).toMatchObject({
      text: GUIDE_IDEA_BANK_MORE.breakfast[0],
      more: true
    });
  });

  it("the default call is byte-for-byte the seed-only result, and never returns a `more` idea", () => {
    for (const daypart of ["breakfast", "lunch", "dinner"] as const) {
      for (const rotation of [0, 1, 4]) {
        const plain = ideasFor(daypart, rotation);
        expect(plain).toEqual(ideasFor(daypart, rotation, { full: false }));
        expect(plain.some((idea) => idea.more)).toBe(false);
      }
    }
  });

  it("`full: true` draws from the whole grown bank, and two consecutive loads of three stay disjoint", () => {
    for (const daypart of ["breakfast", "lunch", "dinner"] as const) {
      const fullLength = GUIDE_IDEA_BANK[daypart].length + GUIDE_IDEA_BANK_MORE[daypart].length;
      const fullBank = ideasFor(daypart, 0, { full: true, count: fullLength });
      expect(fullBank).toHaveLength(fullLength);
      expect(fullBank.filter((idea) => idea.more)).toHaveLength(GUIDE_IDEA_BANK_MORE[daypart].length);

      const a = ideasFor(daypart, 0, { full: true });
      const b = ideasFor(daypart, 1, { full: true });
      expect(a).toHaveLength(3);
      expect(a.filter((idea) => b.some((other) => other.id === idea.id))).toHaveLength(0);
    }
  });

  it("steering: 'Doctor's advice' and 'Family history' start at the floor(bank.length/2) offset", () => {
    for (const daypart of ["breakfast", "lunch", "dinner"] as const) {
      const fullLength = GUIDE_IDEA_BANK[daypart].length + GUIDE_IDEA_BANK_MORE[daypart].length;
      const fullBank = ideasFor(daypart, 0, { full: true, count: fullLength });
      const unsteered = ideasFor(daypart, 0, { full: true });
      for (const segment of ["Doctor's advice", "Family history"]) {
        const steered = ideasFor(daypart, 0, { full: true, segment });
        expect(steered[0].id).toBe(fullBank[Math.floor(fullLength / 2)].id);
        expect(steered).not.toEqual(unsteered);
      }
    }
  });

  it("every other segment value — and null/unset — draws unsteered", () => {
    for (const daypart of ["breakfast", "lunch", "dinner"] as const) {
      const unsteered = ideasFor(daypart, 0, { full: true });
      for (const segment of ["New A1C result", "Just checking", null, "unknown"] as const) {
        expect(ideasFor(daypart, 0, { full: true, segment })).toEqual(unsteered);
      }
      expect(ideasFor(daypart, 0, { full: true })).toEqual(unsteered);
    }
  });
});
