// tests/unit/pal/gdm-meals.test.ts
import fs from "node:fs";
import path from "node:path";

import { createElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GDM_COPY } from "../../../lib/pal/gdm/copy";
import { groupMeals, MealBodySchema, type MealBody } from "../../../lib/pal/gdm/items";
import { GDM_OCCASIONS } from "../../../lib/pal/gdm/plan-record";
import { GDM_ROUTES } from "../../../lib/pal/gdm/routes";

// The nav reads the path through usePathname(); in a node test it is a plain
// function, so the component can be called and its element tree walked.
const nav = vi.hoisted(() => ({ pathname: "/gdm/home" }));
vi.mock("next/navigation", () => ({ usePathname: () => nav.pathname }));

const ROOT = process.cwd();
const CONTROLS = GDM_COPY["gdm-meals-controls"];
const OCCASIONS = GDM_COPY["gdm-occasions"];

describe("F-MYMEALS (PRD §6.2)", () => {
  it("a meal is her words under an occasion — there is no field for a reading, a label or a score", () => {
    expect(Object.keys(MealBodySchema.shape).sort()).toEqual(["inSummary", "occasion", "text"]);
    expect(MealBodySchema.safeParse({ occasion: "lunch", text: "dal and rice", inSummary: false, reading: "128" }).success).toBe(false);
  });

  it("groups by occasion in the order of her day, bedtime snack included", () => {
    const grouped = groupMeals([
      { id: "2", body: { occasion: "snack_bedtime", text: "toast and peanut butter", inSummary: true } },
      { id: "1", body: { occasion: "breakfast", text: "eggs and toast", inSummary: false } }
    ]);
    expect(Object.keys(grouped)).toEqual([...GDM_OCCASIONS]);
    expect(grouped.snack_bedtime).toHaveLength(1);
    expect(grouped.lunch).toEqual([]);
  });

  it('the button says "Save" — never that a meal worked or fits', () => {
    expect(GDM_COPY["gdm-meals-controls"].save).toBe("Save");
    expect(Object.values(GDM_COPY["gdm-meals-controls"]).join(" ")).not.toMatch(/work|fit|suit|reading|number/i);
  });

  it("Tier 1 offers no read, no label and no suggestion on this surface", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "components/gdm/my-meals.tsx"), "utf8");
    expect(source).not.toMatch(/\/api\/check|gdm\/read|ideas|suggest/i);
  });
});

// ── The page's own rules (components/gdm/my-meals.tsx) ─────────────────────────

const meal = (id: string, body: Partial<MealBody> = {}) => ({
  id,
  createdAt: "2026-09-27T10:00:00.000Z",
  updatedAt: "2026-09-27T10:00:00.000Z",
  body: { occasion: "lunch" as const, text: `meal ${id}`, inSummary: false, ...body }
});
const noop = async () => true;
/** Text between an element's tags, with inner tags dropped. */
const texts = (html: string, tag: string) =>
  [...html.matchAll(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, "g"))].map((m) => m[1].replace(/<[^>]+>/g, ""));

describe("My meals — the list's own rules", () => {
  it("every field's maxLength is its zod bound, so a 400 is unreachable in normal use (G-14)", async () => {
    const { MEAL_MAX_LENGTH } = await import("../../../components/gdm/my-meals");
    expect(MEAL_MAX_LENGTH).toBe(MealBodySchema.shape.text.maxLength);
  });

  it("renders in the order of her day, each occasion keeping the server's newest-first order", async () => {
    const { mealsInOrder } = await import("../../../components/gdm/my-meals");
    const ordered = mealsInOrder([
      meal("a", { occasion: "snack_bedtime" }),
      meal("b", { occasion: "breakfast" }),
      meal("c", { occasion: "snack_bedtime" }),
      meal("d", { occasion: "lunch" })
    ]);
    expect(ordered.map((entry) => entry.id)).toEqual(["b", "d", "a", "c"]);
  });

  it("after a Delete, focus goes to the next meal's first control, or the add field once none is left (G-39)", async () => {
    const { focusAfterMealRemove, MEAL_FIELD_ID, mealControlId } = await import("../../../components/gdm/my-meals");
    expect(focusAfterMealRemove(["a", "b", "c"], "a")).toBe(mealControlId("b", "inSummary"));
    expect(focusAfterMealRemove(["a", "b", "c"], "b")).toBe(mealControlId("c", "inSummary"));
    // The last one: there is no next, so the one before it (never <body>).
    expect(focusAfterMealRemove(["a", "b", "c"], "c")).toBe(mealControlId("b", "inSummary"));
    expect(focusAfterMealRemove(["a"], "a")).toBe(MEAL_FIELD_ID);
  });

  it("G-70: one add form — her words, which occasion (six, in the order of her day), Save — and no other field", async () => {
    const { MyMeals } = await import("../../../components/gdm/my-meals");
    const html = renderToStaticMarkup(createElement(MyMeals));
    expect(texts(html, "h1")).toEqual([CONTROLS.title]);
    expect(html).toContain(CONTROLS.sub);
    expect(html.match(/<form\b/g)).toHaveLength(1);
    expect(html.match(/<textarea\b/g)).toHaveLength(1);
    expect(html).toMatch(/<textarea[^>]*maxLength="200"/i);
    expect(html.match(/<select\b/g)).toHaveLength(1);
    expect(texts(html, "label")).toEqual([CONTROLS.field, CONTROLS.occasion]);
    // Each label names its own control.
    for (const id of ["gdm-meal-field", "gdm-meal-occasion"]) {
      expect(html).toContain(`for="${id}"`);
      expect(html).toContain(`id="${id}"`);
    }
    expect([...html.matchAll(/<option value="([a-z_]+)"/g)].map((m) => m[1])).toEqual([...GDM_OCCASIONS]);
    expect(texts(html, "option")).toEqual(GDM_OCCASIONS.map((occasion) => OCCASIONS[occasion]));
    expect(texts(html, "button")).toEqual([CONTROLS.save]);
    expect(html).toMatch(/<button type="submit" class="secondary-button[^"]*"/);
    // No readings field anywhere near it (PRD §6.2 acceptance): not one <input>.
    expect(html).not.toMatch(/<input\b/);
    // While the list loads: the polite status says so, and no empty line or heading shows yet.
    expect(html).toMatch(/aria-live="polite"[^>]*>Loading</);
    expect(html).not.toContain(CONTROLS.empty);
    expect(html).not.toMatch(/<h2\b/);
  });

  it("G-70: an occasion's heading renders only once it holds a meal, in the order of her day, the bedtime snack like any other", async () => {
    const { MealSections } = await import("../../../components/gdm/my-meals");
    const meals = [
      meal("a", { occasion: "snack_bedtime", text: "toast and peanut butter", inSummary: true }),
      meal("b", { occasion: "breakfast", text: "eggs and toast" }),
      meal("c", { occasion: "lunch", text: "dal and rice" })
    ];
    const html = renderToStaticMarkup(createElement(MealSections, { meals, onSave: noop, onRemove: noop }));
    expect(texts(html, "h2")).toEqual([OCCASIONS.breakfast, OCCASIONS.lunch, OCCASIONS.snack_bedtime]);
    // Under each heading, her words and only hers.
    expect(texts(html, "p")).toEqual(["eggs and toast", "dal and rice", "toast and peanut butter"]);
    expect(html).not.toContain(CONTROLS.empty);
    // G-25: an unmarked list says it is a list.
    expect(html.match(/<ul class="gdm-meals" role="list">/g)).toHaveLength(3);
    // Each meal: one Include in my summary box, as she left it, and Delete.
    const boxes = [...html.matchAll(/<input[^>]*>/g)].map((m) => m[0]);
    expect(boxes).toHaveLength(3);
    for (const box of boxes) expect(box).toContain('type="checkbox"');
    expect(boxes.filter((box) => /\bchecked=""/.test(box))).toHaveLength(1);
    expect(texts(html, "label")).toEqual(Array(3).fill(CONTROLS.inSummary));
    expect(texts(html, "button")).toEqual(Array(3).fill(CONTROLS.remove));
  });

  it("G-25: with no meal at all, one page-level empty line and no heading", async () => {
    const { MealSections } = await import("../../../components/gdm/my-meals");
    const html = renderToStaticMarkup(createElement(MealSections, { meals: [], onSave: noop, onRemove: noop }));
    expect(texts(html, "p")).toEqual([CONTROLS.empty]);
    expect(html).not.toMatch(/<h2\b|<ul\b/);
  });

  it("a meal saved counts only its occasion, and nothing is drafted on the device", () => {
    const source = fs.readFileSync(path.join(ROOT, "components/gdm/my-meals.tsx"), "utf8");
    expect(source.match(/track\(\{[\s\S]*?\}\s*\)/g)).toEqual(['track({ name: "gdm_meal_saved", props: { occasion } })']);
    expect(source).not.toMatch(/localStorage|sessionStorage|pal\.gdm\./);
    expect(source).not.toMatch(/type=["']number["']|inputMode=["'](?:numeric|decimal)["']/);
  });
});

describe("the meals page and its place in the nav", () => {
  afterEach(() => {
    nav.pathname = "/gdm/home";
  });

  const elements = (node: ReactNode, out: ReactElement[] = []): ReactElement[] => {
    if (node == null || typeof node !== "object") return out;
    if (Array.isArray(node)) {
      for (const child of node) elements(child, out);
      return out;
    }
    if (!("props" in node)) return out;
    const element = node as ReactElement;
    out.push(element);
    elements((element.props as { children?: ReactNode }).children, out);
    return out;
  };

  it("is guarded like every door page: requireGdmDoor() before the list renders", () => {
    const page = fs.readFileSync(path.join(ROOT, "app/gdm/(door)/meals/page.tsx"), "utf8");
    const guard = page.indexOf("await requireGdmDoor()");
    expect(guard).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(page.indexOf("<MyMeals"));
  });

  it("row two carries My meals after My questions and My plan, marked current on its own page", async () => {
    const { GdmNav } = await import("../../../components/gdm/nav");
    const rowTwo = () =>
      elements(GdmNav())
        .map((el) => el.props as { href?: unknown; className?: string; "aria-current"?: string; children?: ReactNode })
        .filter((props) => typeof props.href === "string" && /\bselectable-chip\b/.test(props.className ?? ""));
    expect(rowTwo().map((link) => link.href)).toEqual([
      GDM_ROUTES.questions,
      GDM_ROUTES.plan,
      GDM_ROUTES.meals,
      GDM_ROUTES.summary
    ]);
    const meals = () => rowTwo().find((link) => link.href === GDM_ROUTES.meals)!;
    expect(meals().children).toBe(GDM_COPY["gdm-nav"].meals);
    expect(meals()["aria-current"]).toBeUndefined();
    nav.pathname = GDM_ROUTES.meals;
    expect(meals()["aria-current"]).toBe("page");
  });
});
