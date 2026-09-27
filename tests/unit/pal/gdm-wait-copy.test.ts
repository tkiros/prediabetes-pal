// tests/unit/pal/gdm-wait-copy.test.ts
import fs from "node:fs";
import path from "node:path";

import { createElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { formatIsoDate } from "../../../lib/client/gdm-date";
import { GDM_COPY } from "../../../lib/pal/gdm/copy";
import type { StoredPlan } from "../../../lib/pal/gdm/plan-record";
import { GDM_ROUTES } from "../../../lib/pal/gdm/routes";

// Node has no app router: next/link is a plain anchor here, as in home-door.test.ts.
vi.mock("next/link", async () => {
  const { createElement: h } = await import("react");
  return {
    default: ({ href, className, children }: { href?: unknown; className?: string; children?: ReactNode }) =>
      h("a", { href: typeof href === "string" ? href : undefined, className }, children)
  };
});

// The Home page's server-only reads, stood in for so the page can be called here.
type ServerItem = { id: string; createdAt: string; updatedAt: string; body: unknown };
const server = vi.hoisted(() => ({
  appointmentDate: "2026-10-08" as string | null,
  items: { plan: [], meal: [], ask: [] } as Record<string, ServerItem[]>,
  calls: [] as string[]
}));
vi.mock("../../../lib/server/gdm-door", () => ({
  requireGdmDoor: async () => {
    server.calls.push("requireGdmDoor");
    return { userId: "user-1", appointmentDate: server.appointmentDate };
  }
}));
vi.mock("../../../lib/server/gdm-items", () => ({
  listGdmItems: async (_db: unknown, userId: string, kind: string) => {
    server.calls.push(`listGdmItems:${userId}:${kind}`);
    return server.items[kind] ?? [];
  }
}));
vi.mock("../../../lib/server/db", () => ({ getDb: () => ({}) }));

const ROOT = process.cwd();
const WAIT = GDM_COPY["gdm-wait-controls"];
const STRUCTURE = GDM_COPY["gdm-wait-structure"];
const CHECKLIST = GDM_COPY["gdm-wait-checklist"];
const NAV = GDM_COPY["gdm-nav"];
const PLAN = GDM_COPY["gdm-plan-controls"];
const STATUS = GDM_COPY["gdm-status"];
const SAVE_FAILED = GDM_COPY["gdm-save-failed"].line;

describe("F-WAIT bank (PRD §6.2 acceptance)", () => {
  it("the structure line is ACOG's sentence verbatim, and attributed", () => {
    expect(GDM_COPY["gdm-wait-structure"].quote).toBe("Often, three meals and two to three snacks per day are recommended");
    expect(GDM_COPY["gdm-wait-structure"].source).toMatch(/ACOG/);
  });

  it("no quantity of any kind, and nothing to limit — in the structure or the checklist", () => {
    const all = [...Object.values(GDM_COPY["gdm-wait-structure"]), ...Object.values(GDM_COPY["gdm-wait-checklist"])].join(" ");
    expect(all).not.toMatch(/\d|gram|carb|calorie|portion|serving/i);
    expect(all).not.toMatch(/avoid|limit|cut|less|instead of/i);
  });

  it("never calls the structure her plan, and promises no outcome", () => {
    // `Object.values<string>`: the bank is `as const`, so without it `.concat` rejects the other row's literal types.
    const all = Object.values<string>(GDM_COPY["gdm-wait-structure"]).concat(Object.values(GDM_COPY["gdm-wait-controls"])).join(" ");
    expect(all).not.toMatch(/your plan is|this is your plan|in range|on track|healthy|numbers/i);
  });

  it("has a phrase for every way the date can be spoken", () => {
    for (const key of ["today", "tomorrow", "thisWeek", "nextWeek", "later"]) {
      expect(GDM_COPY["gdm-wait-controls"]).toHaveProperty(key);
    }
  });
});

// ---------------------------------------------------------------------------
// Home (Task 4.2): the waiting screen, or her plan once it is entered.
// ---------------------------------------------------------------------------

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
/** Every string rendered anywhere in the tree, in order. */
const texts = (node: ReactNode): string[] =>
  elements(node).flatMap((el) => {
    const children = (el.props as { children?: ReactNode }).children;
    const list = Array.isArray(children) ? children : [children];
    return list.filter((child): child is string => typeof child === "string" && child.trim() !== "");
  });
const props = (el: ReactElement) => el.props as Record<string, unknown>;
const byClass = (node: ReactNode, name: string) =>
  elements(node).filter((el) => String(props(el).className ?? "").split(" ").includes(name));
/** The top-level parts of Home, in the order they render, named by their class. */
const partsInOrder = (view: ReactElement) => {
  const children = (props(view).children as ReactNode[]).flat().filter(Boolean) as ReactElement[];
  return children.map((el) => String(props(el).className).split(" ").find((name) => name.startsWith("gdm-")));
};

const stored = (id: string, over: Partial<StoredPlan> = {}): StoredPlan => ({
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

type ViewInput = Partial<import("../../../components/gdm/waiting-mode").HomeViewProps>;
const noop = () => undefined;
async function view(over: ViewInput = {}): Promise<ReactElement> {
  const { HomeView } = await import("../../../components/gdm/waiting-mode");
  return HomeView({
    today: "2026-10-01",
    appointmentDate: "2026-10-12",
    hasCurrentPlan: false,
    summaryReady: true,
    plans: [],
    draft: "2026-10-12",
    saving: false,
    status: null,
    failure: null,
    onDraft: noop,
    onSave: noop,
    ...over
  }) as ReactElement;
}

describe("Home's state, from her own date and her device's day (G-44)", () => {
  it("before hydration nothing depends on the day: no phrase, no offer, no prompt — only whether a plan exists", async () => {
    const { homeView } = await import("../../../components/gdm/waiting-mode");
    expect(homeView({ hasCurrentPlan: false, appointmentDate: "2026-09-20", today: null, summaryReady: true })).toEqual({
      state: "waiting",
      parts: { structure: true, checklist: true, prompt: false, plan: false },
      phrase: "none",
      offer: false
    });
    expect(homeView({ hasCurrentPlan: true, appointmentDate: "2026-10-08", today: null, summaryReady: true })).toMatchObject({
      state: "ended",
      phrase: "none",
      offer: false
    });
  });

  it("once the day is known: the phrase, the offer the day before, and the one prompt once the date has passed", async () => {
    const { homeView } = await import("../../../components/gdm/waiting-mode");
    expect(homeView({ hasCurrentPlan: false, appointmentDate: "2026-10-08", today: "2026-10-07", summaryReady: true })).toMatchObject({
      state: "waiting",
      phrase: "tomorrow",
      offer: true
    });
    expect(homeView({ hasCurrentPlan: false, appointmentDate: "2026-10-08", today: "2026-10-09", summaryReady: true })).toMatchObject({
      state: "after_appointment",
      parts: { prompt: true },
      phrase: "none",
      offer: false
    });
    expect(homeView({ hasCurrentPlan: true, appointmentDate: "2026-10-08", today: "2026-10-08", summaryReady: true })).toMatchObject({
      state: "ended",
      phrase: "today",
      offer: true
    });
  });

  // Final review F8: "Your summary is ready to print" on a summary with nothing
  // to print led to a page with no Print button (G-41).
  it("the summary offer needs something to print as well as the day: due but empty is no offer", async () => {
    const { homeView } = await import("../../../components/gdm/waiting-mode");
    for (const today of ["2026-10-07", "2026-10-08"]) {
      expect(homeView({ hasCurrentPlan: false, appointmentDate: "2026-10-08", today, summaryReady: false }).offer).toBe(false);
      expect(homeView({ hasCurrentPlan: false, appointmentDate: "2026-10-08", today, summaryReady: true }).offer).toBe(true);
    }
    // Something to print but not the day before or the day: still no offer.
    expect(homeView({ hasCurrentPlan: true, appointmentDate: "2026-10-08", today: "2026-10-01", summaryReady: true }).offer).toBe(false);
  });

  it("clearing the date sends null; a date sends itself, as typed", async () => {
    const { profilePatchBody } = await import("../../../components/gdm/waiting-mode");
    expect(profilePatchBody("")).toEqual({ appointmentDate: null });
    expect(profilePatchBody("2026-10-08")).toEqual({ appointmentDate: "2026-10-08" });
  });

  it("never builds a date in UTC: no new Date(her date), no toISOString (G-44)", () => {
    const source = fs.readFileSync(path.join(ROOT, "components/gdm/waiting-mode.tsx"), "utf8");
    expect(source).toMatch(/localIsoDate\(\)/);
    expect(source).toMatch(/formatIsoDate\(/);
    expect(source).not.toMatch(/new Date\(|toISOString|Date\.parse|getTime\(/);
  });
});

describe("Home leads with her appointment, in every state (G-32, G-69)", () => {
  it("waiting: the appointment, then the checklist and ACOG's line, then the links", async () => {
    const shown = await view();
    expect(partsInOrder(shown)).toEqual(["gdm-appointment", "gdm-wait", "gdm-home-links"]);
    const wait = byClass(shown, "gdm-wait")[0];
    const inWait = elements(wait).map((el) => el.type);
    expect(inWait.indexOf("ul")).toBeLessThan(inWait.indexOf("blockquote"));
    expect(texts(wait)[0]).toBe(WAIT.title);
  });

  it("after the appointment: the appointment, then the one prompt and Open My plan, then the rest", async () => {
    const shown = await view({ appointmentDate: "2026-09-28", draft: "2026-09-28" });
    expect(partsInOrder(shown)).toEqual(["gdm-appointment", "gdm-after", "gdm-wait", "gdm-home-links"]);
    const prompt = byClass(shown, "gdm-after")[0];
    expect(texts(prompt)).toEqual([WAIT.after, WAIT.openPlan]);
    expect(elements(prompt).find((el) => props(el).href !== undefined)).toMatchObject({
      props: { href: GDM_ROUTES.plan, className: "secondary-button link-button" }
    });
  });

  it("with a plan: the appointment, then My plan and her current plans read-only, then the links — the waiting content is gone", async () => {
    const { PlanCard } = await import("../../../components/gdm/plan-card");
    const plans = [stored("a", { figures: { lunch: "45 g", dinner: "3" } }), stored("b", { figures: { lunch: "30 g", dinner: "3" } })];
    const shown = await view({ hasCurrentPlan: true, plans });
    expect(partsInOrder(shown)).toEqual(["gdm-appointment", "gdm-home-plan", "gdm-home-links"]);
    const section = byClass(shown, "gdm-home-plan")[0];
    expect(texts(section)[0]).toBe(WAIT.planTitle);
    // The same card the plan page renders, conflicts flagged on both, and no control beside it (G-37).
    const cards = elements(section).filter((el) => el.type === PlanCard).map(props);
    expect(cards).toEqual([
      { plan: plans[0], differs: ["lunch"] },
      { plan: plans[1], differs: ["lunch"] }
    ]);
    expect(elements(shown).filter((el) => el.type === "blockquote" || el.type === "ul").map((el) => props(el).className)).not.toContain(
      "gdm-checklist"
    );
    expect(texts(shown)).not.toContain(STRUCTURE.quote);
    expect(texts(shown)).not.toContain(WAIT.title);
  });

  it("the appointment block is there with no date at all, holding only its heading and the control to add one", async () => {
    for (const hasCurrentPlan of [false, true]) {
      const shown = await view({ appointmentDate: null, draft: "", hasCurrentPlan, plans: hasCurrentPlan ? [stored("a")] : [] });
      const block = byClass(shown, "gdm-appointment")[0];
      expect(texts(block)).toEqual([WAIT.appointment, WAIT.changeDate, PLAN.save]);
      expect(elements(block).filter((el) => el.type === "time")).toEqual([]);
    }
  });

  it("a date that will not read shows no date, no phrase, and is not put in the field", async () => {
    const { WaitingMode } = await import("../../../components/gdm/waiting-mode");
    const html = renderToStaticMarkup(
      createElement(WaitingMode, { appointmentDate: "(unreadable entry)", hasCurrentPlan: false, summaryReady: false, plans: [] })
    );
    expect(html).not.toContain("unreadable");
    expect(html).toMatch(/<input[^>]*type="date"[^>]*value=""/);
  });
});

describe("the appointment block: a phrase and her own date, never a count (F-CALM-GDM)", () => {
  it("speaks the date as a phrase, then shows her date as she gave it", async () => {
    const block = byClass(await view(), "gdm-appointment")[0];
    expect(texts(block).slice(0, 3)).toEqual([WAIT.appointment, WAIT.nextWeek, formatIsoDate("2026-10-12")]);
    expect(elements(block).find((el) => el.type === "time")).toMatchObject({ props: { dateTime: "2026-10-12" } });
  });

  it.each([
    ["2026-10-01", "today"],
    ["2026-10-02", "tomorrow"],
    ["2026-10-05", "thisWeek"],
    ["2026-11-20", "later"]
  ] as const)("%s reads as %s, and no digit is product-authored", async (date, phrase) => {
    const block = byClass(await view({ appointmentDate: date, draft: date }), "gdm-appointment")[0];
    const words = texts(block).filter((text) => text !== formatIsoDate(date));
    expect(words).toContain(WAIT[phrase]);
    expect(words.join(" ")).not.toMatch(/\d|\bdays?\b|left|until/i);
  });

  it("a date that has passed is still hers to see and change, with no phrase", async () => {
    const block = byClass(await view({ appointmentDate: "2026-09-28", draft: "2026-09-28" }), "gdm-appointment")[0];
    expect(texts(block)).toEqual([WAIT.appointment, formatIsoDate("2026-09-28"), WAIT.changeDate, PLAN.save]);
  });

  it("offers the summary the day before and on the day, in every state, linking the summary page", async () => {
    for (const hasCurrentPlan of [false, true]) {
      const shown = await view({ today: "2026-10-11", hasCurrentPlan, plans: hasCurrentPlan ? [stored("a")] : [] });
      const offer = byClass(byClass(shown, "gdm-appointment")[0], "gdm-summary-offer")[0];
      expect(texts(offer)).toEqual([WAIT.summaryOffer]);
      expect(elements(offer).find((el) => props(el).href !== undefined)).toMatchObject({ props: { href: GDM_ROUTES.summary } });
    }
    expect(byClass(await view({ today: "2026-10-09" }), "gdm-summary-offer")).toEqual([]);
    // F8: due, but nothing to print — no offer that leads to an empty page.
    expect(byClass(await view({ today: "2026-10-11", summaryReady: false }), "gdm-summary-offer")).toEqual([]);
  });

  it("changing the date: one native date field and Save, which waits while it saves", async () => {
    const shown = await view({ draft: "2026-10-12" });
    const inputs = elements(shown).filter((el) => ["input", "select", "textarea"].includes(String(el.type)));
    expect(inputs.map(props)).toEqual([expect.objectContaining({ type: "date", value: "2026-10-12" })]);
    const label = elements(shown).find((el) => el.type === "label");
    expect(props(label!).htmlFor).toBe(props(inputs[0]).id);
    const save = elements(shown).find((el) => el.type === "button")!;
    expect(props(save)).toMatchObject({ type: "submit", disabled: false, children: PLAN.save });
    const saving = elements(await view({ saving: true, status: STATUS.saving })).find((el) => el.type === "button")!;
    expect(props(saving).disabled).toBe(true);
  });

  it("Saved. is announced in the page's one polite live region; a failure keeps her value and says so", async () => {
    const saved = await view({ status: STATUS.saved });
    const live = elements(saved).filter((el) => props(el)["aria-live"] === "polite");
    expect(live.map((el) => props(el).children)).toEqual([STATUS.saved]);
    const failed = await view({ draft: "2026-10-20", failure: SAVE_FAILED });
    expect(elements(failed).find((el) => props(el).role === "alert")).toMatchObject({ props: { children: SAVE_FAILED } });
    expect(elements(failed).find((el) => el.type === "input")).toMatchObject({ props: { value: "2026-10-20" } });
  });
});

describe("the checklist and ACOG's line (PRD §6.2 F-WAIT)", () => {
  it("the checklist is a plain list of the four steps: no checkbox, no done-state, no progress", async () => {
    const shown = await view();
    const list = byClass(shown, "gdm-checklist")[0];
    expect(list.type).toBe("ul");
    expect(texts(list)).toEqual(Object.values(CHECKLIST));
    const inList = elements(list);
    expect(inList.filter((el) => el.type !== "li" && el.type !== "ul")).toEqual([]);
    expect(inList.some((el) => "aria-checked" in props(el) || props(el).role === "checkbox")).toBe(false);
    expect(elements(shown).filter((el) => el.type === "input").map((el) => props(el).type)).toEqual(["date"]);
    expect(elements(shown).filter((el) => el.type === "progress" || el.type === "meter")).toEqual([]);
  });

  it("ACOG's sentence is quoted in a blockquote and attributed in a cite", async () => {
    const shown = await view();
    const quote = elements(shown).find((el) => el.type === "blockquote")!;
    expect(texts(quote)).toEqual([STRUCTURE.quote]);
    const cite = elements(shown).find((el) => el.type === "cite")!;
    expect(texts(cite)).toEqual([STRUCTURE.source]);
  });

  it("links into My questions, My plan and My meals, in every state, in the nav's words", async () => {
    for (const over of [{}, { hasCurrentPlan: true, plans: [stored("a")] }]) {
      const links = byClass(await view(over), "gdm-home-links")[0];
      expect(elements(links).filter((el) => props(el).href !== undefined).map((el) => [props(el).href, props(el).children])).toEqual([
        [GDM_ROUTES.questions, NAV.asks],
        [GDM_ROUTES.plan, NAV.plan],
        [GDM_ROUTES.meals, NAV.meals]
      ]);
    }
  });

  it("no filled accent on Home: the nav's Add a question stays the one filled action", () => {
    const source = fs.readFileSync(path.join(ROOT, "components/gdm/waiting-mode.tsx"), "utf8");
    expect(source).not.toMatch(/primary-button/);
  });

  it("counts a visit to waiting mode, a closed event with no props", () => {
    const source = fs.readFileSync(path.join(ROOT, "components/gdm/waiting-mode.tsx"), "utf8");
    expect(source).toMatch(/track\(\{ name: "gdm_waiting_opened" \}\)/);
  });
});

describe("Home renders the same server HTML whatever her timezone or locale (hydration)", () => {
  it("the server HTML carries no phrase and no formatted date — not hers, not a plan's", async () => {
    const { WaitingMode } = await import("../../../components/gdm/waiting-mode");
    const plan = stored("a", { figures: { lunch: "45 g" } });
    for (const hasCurrentPlan of [false, true]) {
      const html = renderToStaticMarkup(
        createElement(WaitingMode, { appointmentDate: "2026-10-08", hasCurrentPlan, summaryReady: true, plans: hasCurrentPlan ? [plan] : [] })
      );
      expect(html).toContain(WAIT.appointment);
      for (const phrase of [WAIT.today, WAIT.tomorrow, WAIT.thisWeek, WAIT.nextWeek, WAIT.later, WAIT.summaryOffer, WAIT.after]) {
        expect(html).not.toContain(phrase);
      }
      expect(html).not.toContain(formatIsoDate("2026-10-08")!);
      expect(html).not.toContain(formatIsoDate("2026-10-01")!);
      // Her date still sits in the field, as she gave it: an ISO value, not a locale string.
      expect(html).toMatch(/type="date"[^>]*value="2026-10-08"/);
    }
  });

  it("the plan card's dates wait for hydration too, so the plan page's look is unchanged and Home's HTML agrees", async () => {
    const { PlanCard } = await import("../../../components/gdm/plan-card");
    const html = renderToStaticMarkup(createElement(PlanCard, { plan: stored("a", { replacedOn: "2026-10-20" }), differs: [] }));
    expect(html).toMatch(/<time datetime="2026-10-01"><\/time>/i);
    expect(html).toMatch(/<time datetime="2026-10-20"><\/time>/i);
    expect(html).toContain(PLAN.enteredOn);
  });
});

describe("the Home page (app/gdm/(door)/home/page.tsx)", () => {
  it("guards first, then reads her plans, meals and questions together, and hands Home only the current plans, her date, and whether the summary has anything to print", async () => {
    const { default: GdmHomePage } = await import("../../../app/gdm/(door)/home/page");
    const { WaitingMode } = await import("../../../components/gdm/waiting-mode");
    const body = (over: Partial<StoredPlan>) => {
      const { id: _id, ...rest } = stored("x", over);
      return rest;
    };
    server.calls.length = 0;
    server.appointmentDate = "2026-10-08";
    server.items = {
      plan: [
        { id: "new", createdAt: "", updatedAt: "", body: body({ figures: { lunch: "45 g" } }) },
        { id: "old", createdAt: "", updatedAt: "", body: body({ replacedOn: "2026-10-02" }) }
      ],
      meal: [],
      ask: []
    };
    const page = (await GdmHomePage()) as ReactElement;
    expect(server.calls).toEqual(["requireGdmDoor", "listGdmItems:user-1:plan", "listGdmItems:user-1:meal", "listGdmItems:user-1:ask"]);
    const home = elements(page).find((el) => el.type === WaitingMode)!;
    expect(props(home)).toEqual({
      appointmentDate: "2026-10-08",
      hasCurrentPlan: true,
      summaryReady: true,
      plans: [{ ...body({ figures: { lunch: "45 g" } }), id: "new" }]
    });
    expect(texts(page)).toEqual([NAV.home]);

    // F8: only a replaced plan, a meal she did not mark and a question she asked: nothing to print.
    server.items = {
      plan: [{ id: "old", createdAt: "", updatedAt: "", body: body({ replacedOn: "2026-10-02" }) }],
      meal: [{ id: "m", createdAt: "", updatedAt: "", body: { occasion: "lunch", text: "dal", inSummary: false } }],
      ask: [{ id: "q", createdAt: "", updatedAt: "", body: { text: "q", note: null, asked: true, answer: "a" } }]
    };
    server.appointmentDate = null;
    const empty = elements((await GdmHomePage()) as ReactElement).find((el) => el.type === WaitingMode)!;
    expect(props(empty)).toEqual({ appointmentDate: null, hasCurrentPlan: false, summaryReady: false, plans: [] });

    // An open question alone is something to print, with no plan at all.
    server.items = {
      plan: [],
      meal: [],
      ask: [{ id: "q", createdAt: "", updatedAt: "", body: { text: "q", note: null, asked: false, answer: null } }]
    };
    const asking = elements((await GdmHomePage()) as ReactElement).find((el) => el.type === WaitingMode)!;
    expect(props(asking)).toMatchObject({ hasCurrentPlan: false, summaryReady: true });
    server.items = { plan: [], meal: [], ask: [] };
  });

  it("reads the three lists together, not one after another (the summary page's Promise.all)", () => {
    const source = fs.readFileSync(path.join(ROOT, "app/gdm/(door)/home/page.tsx"), "utf8");
    expect(source).toMatch(/await Promise\.all\(\[/);
    expect(source).toMatch(/summaryHasContent\(/);
  });
});
