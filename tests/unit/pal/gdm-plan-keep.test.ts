// tests/unit/pal/gdm-plan-keep.test.ts
import fs from "node:fs";
import path from "node:path";

import type { ReactElement, ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LocalDate } from "../../../components/gdm/local-date";
import { formatIsoDate } from "../../../lib/client/gdm-date";
import { askListCardRoute } from "../../../lib/pal/gdm/asklist";
import { GDM_COPY } from "../../../lib/pal/gdm/copy";
import { AskBodySchema } from "../../../lib/pal/gdm/items";
import {
  currentPlans,
  detectConflicts,
  GDM_OCCASIONS,
  GDM_UNITS,
  GdmPlanSchema,
  type StoredPlan
} from "../../../lib/pal/gdm/plan-record";
import { GDM_ROUTES } from "../../../lib/pal/gdm/routes";

// The nav reads the path through usePathname(); in a node test it is a plain function.
const nav = vi.hoisted(() => ({ pathname: "/gdm/home" }));
vi.mock("next/navigation", () => ({ usePathname: () => nav.pathname }));

const ROOT = process.cwd();
const CONTROLS = GDM_COPY["gdm-plan-controls"];
const OCCASIONS = GDM_COPY["gdm-occasions"];
const DIFFER = GDM_COPY["gdm-plan-differ"];

describe("F-PLANKEEP surface (PRD §6.2)", () => {
  it("has a label for every occasion and every way a clinic counts — no more, no fewer", () => {
    expect(Object.keys(GDM_COPY["gdm-occasions"]).sort()).toEqual([...GDM_OCCASIONS].sort());
    for (const unit of GDM_UNITS) expect(GDM_COPY["gdm-plan-controls"]).toHaveProperty(unit);
  });

  it("must never say whether the plan is typical, strict, generous or right", () => {
    // `string[]`: the two rows' literal unions do not concat under tsc (the brief's line, widened only).
    const all = (Object.values(GDM_COPY["gdm-plan-controls"]) as string[]).concat(Object.values(GDM_COPY["gdm-plan-differ"])).join(" ");
    expect(all).not.toMatch(/typical|strict|generous|right|correct|usual|normal|recommended|should/i);
  });

  it("the parked question names the occasion and nothing else", () => {
    expect(GDM_COPY["gdm-plan-differ"].askText).toContain("{occasion}");
    expect(GDM_COPY["gdm-plan-differ"].askText).not.toMatch(/doctor|nurse|dietitian|clinician|wrong/i);
  });

  it("the component converts nothing, compares no meal, and fills no default", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "components/gdm/plan-keep.tsx"), "utf8");
    expect(source).not.toMatch(/parseFloat|parseInt|Number\(|Math\.|defaultValue=\{?["'`]?\d/);
  });
});

// ── Fixtures ──────────────────────────────────────────────────────────────────

const stored = (id: string, over: Partial<StoredPlan> = {}): StoredPlan => ({
  id,
  givenBy: null,
  note: null,
  perDay: null,
  unit: "none",
  choiceMeans: null,
  figures: {},
  enteredOn: "2026-10-01",
  replacedOn: null,
  ...over
});

describe("My plan — the form's own rules (components/gdm/plan-keep.tsx)", () => {
  it("every field's maxLength is its zod bound, so a 400 is unreachable in normal use (G-14)", async () => {
    const { PLAN_MAX_LENGTH } = await import("../../../components/gdm/plan-keep");
    const shape = GdmPlanSchema.shape;
    expect(PLAN_MAX_LENGTH).toEqual({
      givenBy: shape.givenBy.unwrap().maxLength,
      note: shape.note.unwrap().maxLength,
      perDay: shape.perDay.unwrap().maxLength,
      choiceMeans: shape.choiceMeans.unwrap().maxLength,
      figure: shape.figures.valueType.maxLength
    });
  });

  it("a blank form starts on `none` and holds nothing else — no default figure, no pre-selected unit", async () => {
    const { EMPTY_PLAN_FORM } = await import("../../../components/gdm/plan-keep");
    expect(EMPTY_PLAN_FORM.unit).toBe("none");
    expect([EMPTY_PLAN_FORM.givenBy, EMPTY_PLAN_FORM.note, EMPTY_PLAN_FORM.perDay, EMPTY_PLAN_FORM.choiceMeans]).toEqual(["", "", "", ""]);
    expect(Object.keys(EMPTY_PLAN_FORM.figures).sort()).toEqual([...GDM_OCCASIONS].sort());
    expect(Object.values(EMPTY_PLAN_FORM.figures).every((figure) => figure === "")).toBe(true);
  });

  it("the body keeps every figure exactly as written, leaves out what is blank, and carries no id (strict schema)", async () => {
    const { EMPTY_PLAN_FORM, planBodyFrom } = await import("../../../components/gdm/plan-keep");
    const body = planBodyFrom(
      {
        ...EMPTY_PLAN_FORM,
        givenBy: "  the dietitian ",
        perDay: "three meals, three snacks",
        unit: "choices",
        choiceMeans: "15 g",
        figures: { ...EMPTY_PLAN_FORM.figures, breakfast: "2", lunch: "3 to 4 choices", dinner: "30–45 g", snack_bedtime: "   " }
      },
      "2026-10-08"
    );
    expect(body).toEqual({
      givenBy: "the dietitian",
      note: null,
      perDay: "three meals, three snacks",
      unit: "choices",
      choiceMeans: "15 g",
      figures: { breakfast: "2", lunch: "3 to 4 choices", dinner: "30–45 g" },
      enteredOn: "2026-10-08",
      replacedOn: null
    });
    expect(body).not.toHaveProperty("id");
    expect(GdmPlanSchema.safeParse(body).success).toBe(true);
  });

  it("what one choice is travels only with Choices, so a value in a hidden field is never stored", async () => {
    const { EMPTY_PLAN_FORM, planBodyFrom } = await import("../../../components/gdm/plan-keep");
    const form = { ...EMPTY_PLAN_FORM, unit: "grams" as const, choiceMeans: "15 g", figures: { ...EMPTY_PLAN_FORM.figures, lunch: "45 g" } };
    const grams = planBodyFrom(form, "2026-10-08");
    expect(grams.choiceMeans).toBeNull();
    const twin = { id: "b", ...planBodyFrom({ ...form, choiceMeans: "" }, "2026-10-08") };
    expect(detectConflicts([{ id: "a", ...grams }, twin])).toEqual([]);
  });

  it("the save request: one POST, `replaces` only when replacing (G-13), and the body is never a stored plan", async () => {
    const { EMPTY_PLAN_FORM, planRequest } = await import("../../../components/gdm/plan-keep");
    const form = { ...EMPTY_PLAN_FORM, figures: { ...EMPTY_PLAN_FORM.figures, lunch: "45 g" } };
    const added = planRequest(form, "2026-10-08", null);
    expect(added).toEqual({ kind: "plan", body: expect.objectContaining({ enteredOn: "2026-10-08", replacedOn: null }) });
    expect(added).not.toHaveProperty("replaces");
    const replacing = planRequest(form, "2026-10-08", "8c3f6a52-4f0e-4a8e-9d57-2d2f1b8e6c11");
    expect(replacing.replaces).toBe("8c3f6a52-4f0e-4a8e-9d57-2d2f1b8e6c11");
    expect(replacing.body).not.toHaveProperty("id");
    expect(GdmPlanSchema.safeParse(replacing.body).success).toBe(true);
  });

  it("Replace opens prefilled with her own stored words, and saving them unchanged sends the same plan (G-75)", async () => {
    const { planBodyFrom, planFormFrom } = await import("../../../components/gdm/plan-keep");
    const hers = stored("old", {
      givenBy: "the clinic nurse",
      note: "Protein with every snack.",
      perDay: "six",
      unit: "choices",
      choiceMeans: "15 g",
      figures: { breakfast: "2", snack_bedtime: "1 to 2" }
    });
    const form = planFormFrom(hers);
    expect(form).not.toHaveProperty("id");
    expect(form.figures.breakfast).toBe("2");
    expect(form.figures.lunch).toBe("");
    const { id: _id, ...body } = hers;
    expect(planBodyFrom(form, hers.enteredOn)).toEqual(body);
  });

  it("R50: Add another plan starts from the empty form and sends no `replaces` — the new plan stands beside hers", async () => {
    const { EMPTY_PLAN_FORM, formFor, planRequest, replacesFor, withSavedPlan } = await import("../../../components/gdm/plan-keep");
    const hers = stored("hers", { unit: "grams", figures: { lunch: "45 g" } });
    const add = { kind: "add" } as const;
    expect(formFor(add)).toEqual(EMPTY_PLAN_FORM);
    expect(replacesFor(add)).toBeNull();
    const request = planRequest({ ...formFor(add), unit: "grams", figures: { ...EMPTY_PLAN_FORM.figures, lunch: "30 g" } }, "2026-10-20", replacesFor(add));
    expect(request).not.toHaveProperty("replaces");
    const after = withSavedPlan([hers], { id: "second", ...request.body }, replacesFor(add));
    expect(currentPlans(after).map((p) => p.id)).toEqual(["second", "hers"]);
    expect(detectConflicts(after)).toEqual([{ occasion: "lunch", planIds: ["second", "hers"] }]);
  });

  it("Replace starts from her stored plan and names it in `replaces` (G-13, G-75)", async () => {
    const { formFor, planFormFrom, replacesFor } = await import("../../../components/gdm/plan-keep");
    const hers = stored("hers", { unit: "grams", figures: { lunch: "45 g" } });
    const replace = { kind: "replace", plan: hers } as const;
    expect(formFor(replace)).toEqual(planFormFrom(hers));
    expect(replacesFor(replace)).toBe("hers");
    expect(replacesFor(null)).toBeNull();
  });

  it("an empty plan is recognised as empty — the form sends nothing for it, and a card shows the empty line", async () => {
    const { EMPTY_PLAN_FORM, planBodyFrom } = await import("../../../components/gdm/plan-keep");
    const { isEmptyPlan } = await import("../../../lib/pal/gdm/plan-record");
    expect(isEmptyPlan(planBodyFrom(EMPTY_PLAN_FORM, "2026-10-08"))).toBe(true);
    expect(isEmptyPlan(planBodyFrom({ ...EMPTY_PLAN_FORM, note: "  " }, "2026-10-08"))).toBe(true);
    expect(isEmptyPlan(planBodyFrom({ ...EMPTY_PLAN_FORM, unit: "servings" }, "2026-10-08"))).toBe(false);
    expect(isEmptyPlan(planBodyFrom({ ...EMPTY_PLAN_FORM, perDay: "five" }, "2026-10-08"))).toBe(false);
    expect(isEmptyPlan(planBodyFrom({ ...EMPTY_PLAN_FORM, figures: { ...EMPTY_PLAN_FORM.figures, dinner: "x" } }, "2026-10-08"))).toBe(false);
  });

  it("R47: a full list says so; every other failure — the 'Already replaced' 409 included — is the save-failed line, never the server's words", async () => {
    const { saveFailure } = await import("../../../components/gdm/plan-keep");
    const full = GDM_COPY["gdm-list-full"].line;
    const failed = GDM_COPY["gdm-save-failed"].line;
    expect(saveFailure(409, full)).toBe(full);
    expect(saveFailure(409, "Already replaced.")).toBe(failed);
    expect(saveFailure(409, "")).toBe(failed);
    for (const status of [0, 400, 403, 404, 500]) expect(saveFailure(status, full)).toBe(failed);
  });

  it("after a save the list mirrors the server: the new plan first, the replaced one dated, one current plan", async () => {
    const { withSavedPlan } = await import("../../../components/gdm/plan-keep");
    const old = stored("old", { figures: { lunch: "30 g" } });
    const next = stored("new", { figures: { lunch: "45 g" }, enteredOn: "2026-10-20" });
    const after = withSavedPlan([old], next, "old");
    expect(after.map((p) => p.id)).toEqual(["new", "old"]);
    expect(after[1]).toEqual({ ...old, replacedOn: "2026-10-20" });
    expect(currentPlans(after).map((p) => p.id)).toEqual(["new"]);
    expect(withSavedPlan([], next, null)).toEqual([next]);
  });
});

describe("These differ — both entries kept, neither picked (PRD §6.2 story 3; §6.1 row 12)", () => {
  it("the parked question is askText with the occasion's label, fits her list, and raises no clinical card", async () => {
    const { parkedAskText } = await import("../../../components/gdm/plan-keep");
    for (const occasion of GDM_OCCASIONS) {
      const text = parkedAskText(occasion);
      expect(text).toBe(DIFFER.askText.replace("{occasion}", OCCASIONS[occasion]));
      expect(text).not.toContain("{");
      expect(AskBodySchema.safeParse({ text, note: null, asked: false, answer: null }).success).toBe(true);
      expect(askListCardRoute(text)).toBeNull();
    }
  });

  it("each card is told which of its occasions differ — the same occasions on both cards", async () => {
    const { differingOccasions } = await import("../../../components/gdm/plan-keep");
    const a = stored("a", { unit: "grams", figures: { lunch: "45 g", dinner: "45 g" } });
    const b = stored("b", { unit: "grams", figures: { lunch: "30 g", dinner: "45 g" } });
    const conflicts = detectConflicts([a, b]);
    expect(differingOccasions(conflicts, "a")).toEqual(["lunch"]);
    expect(differingOccasions(conflicts, "b")).toEqual(["lunch"]);
    expect(differingOccasions(conflicts, "c")).toEqual([]);
  });

  it("the chip is neutral: --border-strong on --surface-muted, and no verdict colour (G-40)", () => {
    const css = fs.readFileSync(path.join(ROOT, "app/globals.css"), "utf8");
    const rule = /\.gdm-differ-chip\s*\{([^}]*)\}/.exec(css)?.[1] ?? "";
    expect(rule).toMatch(/var\(--border-strong\)/);
    expect(rule).toMatch(/var\(--surface-muted\)/);
    expect(rule).not.toMatch(/--(?:safe|moderate|high|danger|accent)/);
  });
});

// ── The card (components/gdm/plan-card.tsx), also rendered read-only on Home (Task 4.2, G-37) ──

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
/**
 * Every string rendered anywhere in the tree, in order, as the page shows it
 * once hydrated: a card's date is a LocalDate leaf (Task 4.2), read here as the
 * words it renders on the client.
 */
const texts = (node: ReactNode): string[] =>
  elements(node).flatMap((el) => {
    if (el.type === LocalDate) return [formatIsoDate((el.props as { iso: string }).iso)!];
    const children = (el.props as { children?: ReactNode }).children;
    const list = Array.isArray(children) ? children : [children];
    return list.filter((child): child is string => typeof child === "string" && child.trim() !== "");
  });

describe("the plan card shows only what she typed", () => {
  it("renders her words, her figures and their labels — and nothing she did not type (no `None given`, no blank rows)", async () => {
    const { PlanCard } = await import("../../../components/gdm/plan-card");
    const plan = stored("a", { givenBy: "the dietitian", unit: "none", figures: { lunch: "30–45 g" } });
    const shown = texts(PlanCard({ plan, differs: [] }));
    expect(shown).toEqual([CONTROLS.enteredOn, formatIsoDate("2026-10-01"), CONTROLS.givenBy, "the dietitian", OCCASIONS.lunch, "30–45 g"]);
  });

  it("names how her clinic counts, and what one choice is only for Choices", async () => {
    const { PlanCard } = await import("../../../components/gdm/plan-card");
    const choices = texts(PlanCard({ plan: stored("a", { unit: "choices", choiceMeans: "15 g" }), differs: [] }));
    expect(choices).toEqual(expect.arrayContaining([CONTROLS.counts, CONTROLS.choices, CONTROLS.choiceMeans, "15 g"]));
    const grams = texts(PlanCard({ plan: stored("a", { unit: "grams", choiceMeans: "15 g" }), differs: [] }));
    expect(grams).toEqual(expect.arrayContaining([CONTROLS.counts, CONTROLS.grams]));
    expect(grams).not.toContain(CONTROLS.choiceMeans);
  });

  it("an empty plan renders the empty line and nothing else of a plan", async () => {
    const { PlanCard } = await import("../../../components/gdm/plan-card");
    expect(texts(PlanCard({ plan: stored("a"), differs: [] }))).toEqual([CONTROLS.enteredOn, formatIsoDate("2026-10-01"), CONTROLS.empty]);
  });

  it("a replaced plan is kept and dated: both of its dates, then what it said", async () => {
    const { PlanCard } = await import("../../../components/gdm/plan-card");
    const shown = texts(PlanCard({ plan: stored("a", { figures: { dinner: "3" }, replacedOn: "2026-10-20" }), differs: [] }));
    expect(shown).toEqual([
      CONTROLS.replacedOn,
      formatIsoDate("2026-10-20"),
      CONTROLS.enteredOn,
      formatIsoDate("2026-10-01"),
      OCCASIONS.dinner,
      "3"
    ]);
  });

  it("flags a differing occasion with the neutral chip and, only where the page asks for it, an action beside it", async () => {
    const { PlanCard } = await import("../../../components/gdm/plan-card");
    const plan = stored("a", { figures: { lunch: "45 g", dinner: "45 g" } });
    const readOnly = PlanCard({ plan, differs: ["lunch"] });
    expect(texts(readOnly).filter((text) => text === DIFFER.flag)).toHaveLength(1);
    expect(elements(readOnly).filter((el) => el.type === "button")).toEqual([]);
    const withAction = PlanCard({ plan, differs: ["lunch"], renderDiffer: (occasion) => `action:${occasion}` });
    expect(texts(withAction)).toContain("action:lunch");
    expect(texts(withAction)).not.toContain("action:dinner");
  });

  it("holds no control of its own and reaches no route, so Home can render it read-only (G-37)", () => {
    const source = fs.readFileSync(path.join(ROOT, "components/gdm/plan-card.tsx"), "utf8");
    expect(source).not.toMatch(/<(?:button|input|select|textarea|form)\b|gdmFetch|fetch\(|track\(/);
  });
});

describe("the plan page and its place in the nav", () => {
  afterEach(() => {
    nav.pathname = "/gdm/home";
  });

  it("is guarded like every door page: requireGdmDoor() before the plan renders", () => {
    const page = fs.readFileSync(path.join(ROOT, "app/gdm/(door)/plan/page.tsx"), "utf8");
    const guard = page.indexOf("await requireGdmDoor()");
    expect(guard).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(page.indexOf("<PlanKeep"));
  });

  it("R50/R51: Add another plan is on the page, and no two-column rule stacks the cards side by side in the 480px frame", () => {
    const source = fs.readFileSync(path.join(ROOT, "components/gdm/plan-keep.tsx"), "utf8");
    expect(source).toMatch(/onClick=\{\(\) => open\(\{ kind: "add" \}\)\}/);
    expect(source).toContain("{CONTROLS.addAnother}");
    const css = fs.readFileSync(path.join(ROOT, "app/globals.css"), "utf8");
    expect(css).not.toMatch(/\.gdm-plan-current\s*\{[^}]*grid-template-columns/);
  });

  it("figures are text inputs, never number fields: '30–45 g' and '3 to 4 choices' are figures", () => {
    const source = fs.readFileSync(path.join(ROOT, "components/gdm/plan-keep.tsx"), "utf8");
    expect(source).not.toMatch(/type=["']number["']/);
    expect(source).toMatch(/inputMode="text"/);
  });

  it("the plan is never drafted on the device: no storage key, no localStorage (G-26)", () => {
    const source = fs.readFileSync(path.join(ROOT, "components/gdm/plan-keep.tsx"), "utf8");
    expect(source).not.toMatch(/localStorage|sessionStorage|pal\.gdm\./);
  });

  it("row two carries My plan, marked current on its own page", async () => {
    const { GdmNav } = await import("../../../components/gdm/nav");
    const hrefs = () =>
      elements(GdmNav())
        .map((el) => el.props as { href?: unknown; "aria-current"?: string; children?: ReactNode })
        .filter((props) => props.href === GDM_ROUTES.plan);
    const [link] = hrefs();
    expect(link.children).toBe(GDM_COPY["gdm-nav"].plan);
    expect(link["aria-current"]).toBeUndefined();
    nav.pathname = GDM_ROUTES.plan;
    expect(hrefs()[0]["aria-current"]).toBe("page");
  });
});

// ── A photo of her sheet (Task 3.3): components/gdm/plan-photos.tsx, lib/client/gdm-photo.ts ──

describe("a photo of her sheet, kept as a photo (Task 3.3)", () => {
  const noop = () => undefined;
  const list = async (over: Partial<import("../../../components/gdm/plan-photos").PlanPhotoListProps> = {}) => {
    const { PlanPhotoList } = await import("../../../components/gdm/plan-photos");
    return PlanPhotoList({
      ids: [],
      adding: false,
      confirming: null,
      busy: false,
      onAdd: noop,
      onAskRemove: noop,
      onRemove: noop,
      onCancel: noop,
      ...over
    });
  };
  const props = (el: ReactElement) => el.props as Record<string, unknown>;
  const buttons = (node: ReactNode) => elements(node).filter((el) => el.type === "button");
  const buttonText = (node: ReactNode) => buttons(node).map((el) => props(el).children);

  it("R54: the photo is named by its own words, not by the action that adds it", () => {
    expect(CONTROLS.photoAlt).toBe("Photo of your sheet");
    expect(CONTROLS.photoAlt).not.toBe(CONTROLS.photoAdd);
  });

  it("is made smaller on the device: the longest edge at most 1600px, never enlarged", async () => {
    const { PHOTO_MAX_EDGE, scaledSize } = await import("../../../lib/client/gdm-photo");
    expect(PHOTO_MAX_EDGE).toBe(1600);
    expect(scaledSize(4000, 3000)).toEqual({ width: 1600, height: 1200 });
    expect(scaledSize(1200, 3000)).toEqual({ width: 640, height: 1600 });
    expect(scaledSize(800, 600)).toEqual({ width: 800, height: 600 });
    expect(scaledSize(1, 10000)).toEqual({ width: 1, height: 1600 });
  });

  it("with no photo, the add control is all there is", async () => {
    const shown = await list();
    expect(elements(shown).filter((el) => el.type === "img")).toEqual([]);
    expect(buttonText(shown)).toEqual([CONTROLS.photoAdd]);
  });

  it("each photo is a lazy image of hers, named photoAlt, served by the photo route (G-20, R54)", async () => {
    const { planPhotoSrc } = await import("../../../components/gdm/plan-photos");
    const shown = await list({ ids: ["a", "b"] });
    const images = elements(shown).filter((el) => el.type === "img").map(props);
    expect(images).toEqual([
      expect.objectContaining({ src: planPhotoSrc("a"), alt: CONTROLS.photoAlt, loading: "lazy" }),
      expect.objectContaining({ src: planPhotoSrc("b"), alt: CONTROLS.photoAlt, loading: "lazy" })
    ]);
    expect(planPhotoSrc("a")).toBe("/api/gdm/plan-photo?id=a");
    expect(buttonText(shown)).toEqual([CONTROLS.photoRemove, CONTROLS.photoRemove, CONTROLS.photoAdd]);
  });

  it("at three photos the add control is not rendered, so the route's refusal is unreachable (G-20)", async () => {
    const { PLAN_PHOTO_CAP } = await import("../../../lib/pal/gdm/plan-photo");
    const ids = Array.from({ length: PLAN_PHOTO_CAP }, (_, i) => `p${i}`);
    expect(buttonText(await list({ ids }))).not.toContain(CONTROLS.photoAdd);
    expect(buttonText(await list({ ids: ids.slice(1) }))).toContain(CONTROLS.photoAdd);
  });

  it("removing takes two presses: the first shows Remove photo beside Cancel, on that photo only (G-76)", async () => {
    const { photoCancelId, photoRemoveId } = await import("../../../components/gdm/plan-photos");
    const shown = await list({ ids: ["a", "b"], confirming: "a" });
    expect(buttonText(shown)).toEqual([
      CONTROLS.photoRemove,
      GDM_COPY["gdm-data-controls"].cancel,
      CONTROLS.photoRemove,
      CONTROLS.photoAdd
    ]);
    const [confirm, cancel, other] = buttons(shown).map(props);
    expect(confirm).toMatchObject({ id: photoRemoveId("a"), className: "danger-button" });
    expect(cancel).toMatchObject({ id: photoCancelId("a") });
    expect(other).toMatchObject({ id: photoRemoveId("b"), className: "secondary-button" });
  });

  it("a photo on its way shows Saving on its own row, and every control waits while one is in flight", async () => {
    const shown = await list({ ids: ["a"], adding: true, busy: true });
    expect(texts(shown)).toContain(GDM_COPY["gdm-status"].saving);
    expect(buttons(shown).every((el) => props(el).disabled === true)).toBe(true);
  });

  it("the page: a hidden file input for an image, cleared after every attempt, and nothing kept on the device", () => {
    const source = fs.readFileSync(path.join(ROOT, "components/gdm/plan-photos.tsx"), "utf8");
    expect(source).toMatch(/<input[^>]*type="file"[^>]*accept="image\/\*"[^>]*hidden/);
    // R56: no `capture`, which skips the chooser and opens the camera on iOS Safari and Android Chrome, so she
    // could not pick a photo of her sheet she already has; the chooser still offers the camera.
    expect(source).not.toMatch(/\bcapture=/);
    expect(source).toMatch(/\.value = ""/);
    expect(source).toContain("preparePhoto(");
    expect(source).not.toMatch(/localStorage|sessionStorage|pal\.gdm\./);
    expect(source).not.toMatch(/parseFloat|parseInt|Number\(|Math\./);
  });

  it("the device re-encodes a JPEG at 0.8 from createImageBitmap; a file it cannot open rejects, and the page shows save-failed (G-20)", () => {
    const helper = fs.readFileSync(path.join(ROOT, "lib/client/gdm-photo.ts"), "utf8");
    expect(helper).toContain("createImageBitmap(file)");
    expect(helper).toMatch(/toBlob\(resolve, "image\/jpeg", 0\.8\)/);
    const source = fs.readFileSync(path.join(ROOT, "components/gdm/plan-photos.tsx"), "utf8");
    expect(source).toMatch(/setFailure\(SAVE_FAILED\)/);
  });

  it("My plan renders the photos, and the read-only card (also on Home) holds none of them (G-37)", () => {
    const keep = fs.readFileSync(path.join(ROOT, "components/gdm/plan-keep.tsx"), "utf8");
    expect(keep).toContain("<PlanPhotos onStatus={setStatus} />");
    const card = fs.readFileSync(path.join(ROOT, "components/gdm/plan-card.tsx"), "utf8");
    expect(card).not.toMatch(/plan-photo|<img/);
  });

  it("G-62: Your data links each photo for download, since the export lists photos without their bytes", async () => {
    const { PhotoDownloadLinks, planPhotoSrc } = await import("../../../components/gdm/plan-photos");
    const links = elements(PhotoDownloadLinks({ ids: ["a", "b"] })).filter((el) => el.type === "a").map(props);
    expect(links).toEqual([
      expect.objectContaining({ href: planPhotoSrc("a"), download: true, children: CONTROLS.photoAlt }),
      expect.objectContaining({ href: planPhotoSrc("b"), download: true, children: CONTROLS.photoAlt })
    ]);
    expect(elements(PhotoDownloadLinks({ ids: [] })).filter((el) => el.type === "a")).toEqual([]);
    const data = fs.readFileSync(path.join(ROOT, "components/gdm/data-controls.tsx"), "utf8");
    expect(data).toContain("<PlanPhotoDownloads />");
  });
});
