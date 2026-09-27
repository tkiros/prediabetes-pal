import { describe, expect, it } from "vitest";

import { buildSummary, type SummaryLabels } from "../../../lib/pal/gdm/summary";

const labels: SummaryLabels = {
  title: "T", plan: "P", meals: "M", asks: "A", empty: "E", differ: "D",
  occasions: { breakfast: "Ob", snack_morning: "Om", lunch: "Ol", snack_afternoon: "Oa", dinner: "Od", snack_bedtime: "Os" },
  units: { grams: "Ug", choices: "Uc", servings: "Us", none: "Un" },
  fields: { givenBy: "Fg", perDay: "Fp", counts: "Fc", choiceMeans: "Fm", enteredOn: "Fe" }
};
const USER = ["the dietitian", "three meals two snacks", "45 g", "30 g", "dal and rice", "why was it higher", "after the same dinner", "2026-10-01"];
const input = {
  plans: [
    { id: "a", givenBy: "the dietitian", note: null, perDay: "three meals two snacks", unit: "grams" as const, choiceMeans: null, figures: { lunch: "45 g" }, enteredOn: "2026-10-01", replacedOn: null },
    { id: "b", givenBy: null, note: null, perDay: null, unit: "grams" as const, choiceMeans: null, figures: { lunch: "30 g" }, enteredOn: "2026-10-01", replacedOn: null }
  ],
  meals: [
    { body: { occasion: "lunch" as const, text: "dal and rice", inSummary: true } },
    { body: { occasion: "dinner" as const, text: "not for the page", inSummary: false } }
  ],
  asks: [
    { body: { text: "why was it higher", note: "after the same dinner", asked: false, answer: null } },
    { body: { text: "already asked", note: null, asked: true, answer: "fine" } }
  ]
};

describe("summary builder (PRD §6.2 F-SUMMARY; §7.4 deep module 2)", () => {
  it("three sections, fixed order, fixed headings — and no readings section exists", () => {
    const doc = buildSummary(input, labels);
    expect(doc.sections.map((s) => s.key)).toEqual(["plan", "meals", "asks"]);
    expect(doc.sections.map((s) => s.heading)).toEqual(["P", "M", "A"]);
  });

  it("contains only her text and fixed labels: strip both and nothing but punctuation is left", () => {
    const doc = buildSummary(input, labels);
    const fixed = [labels.differ, ...Object.values(labels.occasions), ...Object.values(labels.units), ...Object.values(labels.fields)];
    for (const line of doc.sections.flatMap((s) => s.lines)) {
      let rest = line;
      for (const piece of [...USER, ...fixed].sort((a, b) => b.length - a.length)) rest = rest.split(piece).join("");
      expect(rest, line).toMatch(/^[\s:·—-]*$/);
    }
  });

  it("carries only the meals she marked, only her open questions, and shows where two entries differ without choosing", () => {
    const text = JSON.stringify(buildSummary(input, labels));
    expect(text).toContain("dal and rice");
    expect(text).not.toContain("not for the page");
    expect(text).toContain("why was it higher");
    expect(text).not.toContain("already asked");
    expect(text).toContain("45 g");
    expect(text).toContain("30 g");
    expect(text).toContain("D: Ol");
  });

  it("an empty organiser builds three empty sections", () => {
    const doc = buildSummary({ plans: [], meals: [], asks: [] }, labels);
    expect(doc.sections.every((s) => s.lines.length === 0)).toBe(true);
    expect(doc.emptyLine).toBe("E");
  });

  it("prints with the browser: no PDF dependency, and the disclaimer prints with the page", async () => {
    const fs = await import("node:fs");
    const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
    expect(Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).filter((d) => /pdf/i.test(d))).toEqual([]);
    expect(fs.readFileSync("components/gdm/summary-print.tsx", "utf8")).toMatch(/window\.print\(\)/);
    const page = fs.readFileSync("app/gdm/(door)/summary/page.tsx", "utf8");
    expect(page).toMatch(/gdm-disclaimer/); // rendered INSIDE the page body: the print sheet hides <footer>
    expect(page).not.toMatch(/reading|glucose/i);
  });
});
