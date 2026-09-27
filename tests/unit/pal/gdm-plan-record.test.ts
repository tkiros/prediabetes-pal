import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { currentPlans, detectConflicts, GdmPlanSchema, type StoredPlan } from "../../../lib/pal/gdm/plan-record";

const plan = (id: string, over: Partial<StoredPlan> = {}): StoredPlan => ({
  id,
  givenBy: null,
  note: null,
  perDay: null,
  unit: "grams",
  choiceMeans: null,
  figures: {},
  enteredOn: "2026-10-01",
  replacedOn: null,
  ...over
});

const bare = ({ id: _id, ...rest }: StoredPlan) => rest;

describe("plan record (PRD §6.2 F-PLANKEEP; §7.4 deep module 1)", () => {
  it("an empty plan is valid and stays empty — no default is ever supplied", () => {
    const parsed = GdmPlanSchema.parse({
      givenBy: null, note: null, perDay: null, unit: "none", choiceMeans: null, figures: {}, enteredOn: "2026-10-01", replacedOn: null
    });
    expect(parsed.figures).toEqual({});
    expect(detectConflicts([])).toEqual([]);
  });

  it("keeps her figure exactly as written — a string, in her clinic's unit", () => {
    const parsed = GdmPlanSchema.parse(bare(plan("x", { unit: "choices", choiceMeans: "15 g", figures: { lunch: "3 to 4 choices" } })));
    expect(parsed.figures.lunch).toBe("3 to 4 choices");
  });

  it("refuses an unknown unit, an unknown occasion and any extra key", () => {
    expect(GdmPlanSchema.safeParse({ ...bare(plan("x")), unit: "exchanges" }).success).toBe(false);
    expect(GdmPlanSchema.safeParse({ ...bare(plan("x")), figures: { brunch: "30" } }).success).toBe(false);
    expect(GdmPlanSchema.safeParse({ ...bare(plan("x")), target: "under 140" }).success).toBe(false);
  });

  it("two current entries that differ for an occasion are flagged — and neither is picked", () => {
    const a = plan("a", { givenBy: "the dietitian", figures: { lunch: "45 g", dinner: "45 g" } });
    const b = plan("b", { givenBy: "the clinic nurse", figures: { lunch: "30 g", dinner: "45  G" } });
    expect(detectConflicts([a, b])).toEqual([{ occasion: "lunch", planIds: ["a", "b"] }]);
  });

  it("the same digits in two units differ: nothing is ever converted", () => {
    const a = plan("a", { unit: "choices", choiceMeans: "15 g", figures: { breakfast: "3" } });
    const b = plan("b", { unit: "servings", figures: { breakfast: "3" } });
    expect(detectConflicts([a, b])).toHaveLength(1);
  });

  it("a replaced plan is kept, dated, and takes no part in conflicts", () => {
    const old = plan("old", { figures: { lunch: "30 g" }, replacedOn: "2026-10-20" });
    const now = plan("now", { figures: { lunch: "45 g" }, enteredOn: "2026-10-20" });
    expect(currentPlans([old, now]).map((p) => p.id)).toEqual(["now"]);
    expect(detectConflicts([old, now])).toEqual([]);
  });

  it("two plans that define a choice differently are flagged: same unit, same figure, different choiceMeans", () => {
    const a = plan("a", { unit: "choices", choiceMeans: "15 g", figures: { breakfast: "3" } });
    const b = plan("b", { unit: "choices", choiceMeans: "10 g", figures: { breakfast: "3" } });
    expect(detectConflicts([a, b])).toEqual([{ occasion: "breakfast", planIds: ["a", "b"] }]);
  });

  it("choiceMeans differing only in whitespace/case is not a conflict", () => {
    const a = plan("a", { unit: "choices", choiceMeans: "15 g", figures: { lunch: "2" } });
    const b = plan("b", { unit: "choices", choiceMeans: "15  G", figures: { lunch: "2" } });
    expect(detectConflicts([a, b])).toEqual([]);
  });

  it("the module does no arithmetic on a figure", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "lib/pal/gdm/plan-record.ts"), "utf8");
    expect(source).not.toMatch(/parseFloat|parseInt|Number\(|Math\./);
  });
});
