import { describe, expect, it } from "vitest";

import { buildSummary, summaryHasContent, type SummaryLabels } from "../../../lib/pal/gdm/summary";

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

  // Final review F5: unticking Asked keeps her answer (Task 2.2's ruling), so
  // "open" is `asked === false` alone — as My questions shows it.
  it("a reopened question (Asked unticked, her answer kept) is open, so it prints — without the kept answer", () => {
    const doc = buildSummary(
      { plans: [], meals: [], asks: [{ body: { text: "reopened one", note: "its note", asked: false, answer: "kept answer" } }] },
      labels
    );
    const asks = doc.sections[2].lines;
    expect(asks).toEqual(["reopened one", "its note"]);
    expect(JSON.stringify(doc)).not.toContain("kept answer");
  });

  // F6: `none` is the form's starting value, not something she wrote; the plan card hides it, and so does the page.
  it("prints no counts line for a plan whose clinic count was never chosen (`none`), as the plan card shows none", () => {
    const plan = (id: string, unit: "none" | "servings") =>
      ({ id, givenBy: "the dietitian", note: null, perDay: null, unit, choiceMeans: null, figures: {}, enteredOn: "2026-10-01", replacedOn: null });
    const none = buildSummary({ plans: [plan("a", "none")], meals: [], asks: [] }, labels).sections[0].lines;
    expect(none).toEqual(["Fg: the dietitian", "Fe: 2026-10-01"]);
    expect(none.join()).not.toContain("Fc");
    expect(none.join()).not.toContain("Un");
    const servings = buildSummary({ plans: [plan("a", "servings")], meals: [], asks: [] }, labels).sections[0].lines;
    expect(servings).toContain("Fc: Us");
  });

  // F7: one line per occasion, in the order of her day, however many plans differ there.
  it("says where entries differ once per occasion, in the order of her day, with three or more current plans", () => {
    const plan = (id: string, lunch: string, dinner: string) =>
      ({ id, givenBy: null, note: null, perDay: null, unit: "grams" as const, choiceMeans: null, figures: { lunch, dinner }, enteredOn: "2026-10-01", replacedOn: null });
    const lines = buildSummary(
      { plans: [plan("a", "45 g", "60 g"), plan("b", "30 g", "45 g"), plan("c", "15 g", "45 g")], meals: [], asks: [] },
      labels
    ).sections[0].lines;
    expect(lines.filter((line) => line.startsWith("D: "))).toEqual(["D: Ol", "D: Od"]);
  });

  // F8: one rule for "there is something to print", shared by the summary page (G-41's all-empty
  // screen) and Home's summary offer — pinned to the builder so the two cannot drift.
  it("summaryHasContent is exactly: a current plan, a meal she marked, or an open question — the builder's own verdict", () => {
    const plan = (over: Partial<import("../../../lib/pal/gdm/plan-record").StoredPlan> = {}) => ({
      id: "a", givenBy: null, note: null, perDay: null, unit: "none" as const, choiceMeans: null, figures: {}, enteredOn: "2026-10-01", replacedOn: null, ...over
    });
    const cases: Array<[string, Parameters<typeof buildSummary>[0], boolean]> = [
      ["nothing at all", { plans: [], meals: [], asks: [] }, false],
      ["a current plan that holds only `none`", { plans: [plan()], meals: [], asks: [] }, true],
      ["only a replaced plan", { plans: [plan({ replacedOn: "2026-10-02" })], meals: [], asks: [] }, false],
      ["only a meal she did not mark", { plans: [], meals: [{ body: { occasion: "lunch", text: "dal", inSummary: false } }], asks: [] }, false],
      ["a meal she marked", { plans: [], meals: [{ body: { occasion: "lunch", text: "dal", inSummary: true } }], asks: [] }, true],
      ["only a question she has asked", { plans: [], meals: [], asks: [{ body: { text: "q", note: null, asked: true, answer: "a" } }] }, false],
      ["a reopened question", { plans: [], meals: [], asks: [{ body: { text: "q", note: null, asked: false, answer: "a" } }] }, true]
    ];
    for (const [label, input, expected] of cases) {
      expect(summaryHasContent(input), label).toBe(expected);
      expect(buildSummary(input, labels).sections.some((s) => s.lines.length > 0), label).toBe(expected);
    }
  });

  it("the summary page decides its all-empty screen with that one helper", async () => {
    const fs = await import("node:fs");
    const page = fs.readFileSync("app/gdm/(door)/summary/page.tsx", "utf8");
    expect(page).toMatch(/const allEmpty = !summaryHasContent\(/);
  });

  // F9 (owner copy mitigation, no new string): in the mixed state a section's
  // empty line is a screen instruction — it stays on screen and off the paper;
  // the section's heading still prints.
  it("an empty section's line is screen-only (gdm-no-print); its heading still prints", async () => {
    const fs = await import("node:fs");
    const page = fs.readFileSync("app/gdm/(door)/summary/page.tsx", "utf8");
    expect(page).toMatch(/<p className="gdm-no-print">\{doc\.emptyLine\}<\/p>/);
    expect(page).toMatch(/<h2>\{section\.heading\}<\/h2>/);
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

  it("the frame's skip link stays off the printed page (Task 6.4's walk: its shadow reached the paper)", async () => {
    const fs = await import("node:fs");
    // .app-skip sits at top: -64px with an 18px-offset, 40px-blur shadow, so the
    // shadow printed as a grey smudge in the page's top-left corner, background
    // graphics on or off. The print sheet's .gdm-no-print hides it.
    expect(fs.readFileSync("app/gdm/layout.tsx", "utf8")).toMatch(/href="#gdm-content" className="app-skip gdm-no-print"/);
    const printBlock = fs.readFileSync("app/globals.css", "utf8").split("@media print {")[1] ?? "";
    expect(printBlock.slice(0, printBlock.indexOf("}"))).toMatch(/\.gdm-no-print,/);
  });
});
