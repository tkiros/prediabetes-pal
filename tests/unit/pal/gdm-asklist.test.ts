// tests/unit/pal/gdm-asklist.test.ts
import fs from "node:fs";
import path from "node:path";

import type { ReactElement, ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { clearGdmDeviceKeys } from "../../../lib/client/gdm-api";
import { askListCardRoute } from "../../../lib/pal/gdm/asklist";
import { GDM_COPY } from "../../../lib/pal/gdm/copy";
import { AskBodySchema } from "../../../lib/pal/gdm/items";
import { GDM_ROUTES } from "../../../lib/pal/gdm/routes";

// The nav reads the path through usePathname(); in a node test it is a plain
// function, so the component can be called and its element tree walked.
const nav = vi.hoisted(() => ({ pathname: "/gdm/home" }));
vi.mock("next/navigation", () => ({ usePathname: () => nav.pathname }));

const ROOT = process.cwd();

describe("F-ASKLIST (PRD §6.2)", () => {
  it("only the four routes above the fifth raise a card; ordinary, number- and date-shaped questions raise none", () => {
    expect(askListCardRoute("how much insulin should i take with this")).toBe("medication_dosing");
    expect(askListCardRoute("why was my fasting 106 this morning")).toBeNull();
    expect(askListCardRoute("they want to induce at 39 weeks, can i say no")).toBeNull();
    expect(askListCardRoute("which of my two sheets should i follow")).toBeNull();
  });

  it("the fixed line names the care team and says nothing about the content of a question", () => {
    const line = GDM_COPY["gdm-asklist-lead"].line;
    expect(line).toMatch(/care team/);
    expect(line.split(/[.!?]/).filter((s) => s.trim()).length).toBe(1);
    expect(line).not.toMatch(/common|normal|worth|usual|can happen|worry/i);
  });

  it("her text never reaches analytics: no track() call in a GDM component names a free-text field", () => {
    const dir = path.join(ROOT, "components/gdm");
    const offenders: string[] = [];
    for (const name of fs.readdirSync(dir)) {
      const source = fs.readFileSync(path.join(dir, name), "utf8");
      for (const call of source.match(/track\(\{[\s\S]*?\}\s*\)/g) ?? []) {
        if (/\b(?:text|note|answer|body|figure|value|draft)\b/.test(call)) offenders.push(`${name}: ${call.slice(0, 60)}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("the list works with nothing else on the door built: the page imports no plan, meal or summary module", () => {
    const page = fs.readFileSync(path.join(ROOT, "app/gdm/(door)/questions/page.tsx"), "utf8");
    expect(page).not.toMatch(/plan-keep|my-meals|summary|waiting/);
  });

  it("the questions page is guarded like every door page: requireGdmDoor() before the list renders", () => {
    const page = fs.readFileSync(path.join(ROOT, "app/gdm/(door)/questions/page.tsx"), "utf8");
    const guard = page.indexOf("await requireGdmDoor()");
    expect(guard).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(page.indexOf("<AskList"));
  });
});

describe("My questions — the list's own rules (components/gdm/ask-list.tsx)", () => {
  const item = (id: string, asked: boolean) => ({
    id,
    createdAt: "2026-09-27T10:00:00.000Z",
    updatedAt: "2026-09-27T10:00:00.000Z",
    body: { text: `question ${id}`, note: null, asked, answer: null }
  });

  it("open questions first, then asked ones; each group keeps the server's newest-first order", async () => {
    const { orderAsks } = await import("../../../components/gdm/ask-list");
    const ordered = orderAsks([item("a", true), item("b", false), item("c", true), item("d", false)]);
    expect(ordered.map((entry) => entry.id)).toEqual(["b", "d", "a", "c"]);
  });

  it("the card comes from a 200 or from a 409's refusal (R46), and only when the server named a route and its copy", async () => {
    const { cardFrom } = await import("../../../components/gdm/ask-list");
    const routeCopy = "fixed clinical copy";
    expect(cardFrom({ id: "x", route: "possible_hypoglycemia", routeCopy })).toEqual({
      route: "possible_hypoglycemia",
      routeCopy
    });
    expect(cardFrom({ error: GDM_COPY["gdm-list-full"].line, route: "urgent_symptoms", routeCopy })).toEqual({
      route: "urgent_symptoms",
      routeCopy
    });
    expect(cardFrom({ id: "x", route: null, routeCopy: null })).toBeNull();
    expect(cardFrom({ error: GDM_COPY["gdm-save-failed"].line })).toBeNull();
    expect(cardFrom(null)).toBeNull();
  });

  it("a full list says so; every other failed add keeps the save-failed line (G-14)", async () => {
    const { parkFailure } = await import("../../../components/gdm/ask-list");
    expect(parkFailure(409)).toBe(GDM_COPY["gdm-list-full"].line);
    for (const status of [0, 400, 403, 404, 500, 502]) expect(parkFailure(status)).toBe(GDM_COPY["gdm-save-failed"].line);
  });

  it("a question parked after the nav's Add a question counts as quick_add; one parked on the list itself, as list", async () => {
    const { parkedFrom } = await import("../../../components/gdm/ask-list");
    expect(GDM_ROUTES.quickAdd).toBe(`${GDM_ROUTES.questions}#add`);
    expect(parkedFrom("#add")).toBe("quick_add");
    expect(parkedFrom("")).toBe("list");
    expect(parkedFrom("#something-else")).toBe("list");
  });

  it("after a Delete, focus goes to the next question's first control, or the add field once the list is empty (G-39)", async () => {
    const { focusAfterRemove, ASK_FIELD_ID, askControlId } = await import("../../../components/gdm/ask-list");
    expect(focusAfterRemove(["a", "b", "c"], "a")).toBe(askControlId("b", "asked"));
    expect(focusAfterRemove(["a", "b", "c"], "b")).toBe(askControlId("c", "asked"));
    // The last one: there is no next, so the one before it (never <body>).
    expect(focusAfterRemove(["a", "b", "c"], "c")).toBe(askControlId("b", "asked"));
    expect(focusAfterRemove(["a"], "a")).toBe(ASK_FIELD_ID);
  });

  it("a row's Save never throws away what they said: unticking Asked only hides the answer (fix round 1)", async () => {
    const { savedAskBody } = await import("../../../components/gdm/ask-list");
    const parked = { text: "Which sheet stands?", note: "night shift", asked: true, answer: "The newer one." };
    // Unticked with an answer on record: the answer is kept, and the body still parses.
    const unticked = savedAskBody(parked, false, "The newer one.");
    expect(unticked).toEqual({ text: "Which sheet stands?", note: "night shift", asked: false, answer: "The newer one." });
    expect(AskBodySchema.safeParse(unticked).success).toBe(true);
    // Her text and note are never edited here (R48); the answer is trimmed, and empty is null.
    expect(savedAskBody(parked, true, "  They said wait.  ")).toEqual({ ...parked, answer: "They said wait." });
    expect(savedAskBody(parked, true, "   ")).toEqual({ ...parked, answer: null });
    expect(savedAskBody({ ...parked, answer: null }, false, "")).toEqual({ ...parked, asked: false, answer: null });
  });

  it("every field's maxLength is its zod bound, so a 400 is unreachable in normal use (G-14)", async () => {
    const { ASK_MAX_LENGTH } = await import("../../../components/gdm/ask-list");
    expect(ASK_MAX_LENGTH).toEqual({
      text: AskBodySchema.shape.text.maxLength,
      note: AskBodySchema.shape.note.unwrap().maxLength,
      answer: AskBodySchema.shape.answer.unwrap().maxLength
    });
  });
});

describe("My questions — the unsent draft (pal.gdm.ask.draft)", () => {
  const memoryStorage = () => {
    const map = new Map<string, string>();
    return {
      map,
      get length() {
        return map.size;
      },
      key: (index: number) => [...map.keys()][index] ?? null,
      getItem: (key: string) => map.get(key) ?? null,
      setItem: (key: string, value: string) => void map.set(key, value),
      removeItem: (key: string) => void map.delete(key)
    };
  };
  const throwing = {
    getItem: () => {
      throw new Error("blocked");
    },
    setItem: () => {
      throw new Error("blocked");
    },
    removeItem: () => {
      throw new Error("blocked");
    }
  };

  it("is kept under pal.gdm.ask.draft, read back as typed, and cleared", async () => {
    const { askDraft } = await import("../../../components/gdm/ask-list");
    const storage = memoryStorage();
    expect(askDraft.read(storage)).toEqual({ text: "", note: "" });
    askDraft.write({ text: "Can I move my snack", note: "night shift" }, storage);
    expect([...storage.map.keys()]).toEqual(["pal.gdm.ask.draft"]);
    expect(askDraft.read(storage)).toEqual({ text: "Can I move my snack", note: "night shift" });
    askDraft.clear(storage);
    expect(storage.map.size).toBe(0);
  });

  it("an emptied draft leaves no key behind, and a corrupt one reads as empty", async () => {
    const { askDraft } = await import("../../../components/gdm/ask-list");
    const storage = memoryStorage();
    askDraft.write({ text: "a", note: "" }, storage);
    askDraft.write({ text: "", note: "" }, storage);
    expect(storage.map.size).toBe(0);
    storage.setItem("pal.gdm.ask.draft", "{not json");
    expect(askDraft.read(storage)).toEqual({ text: "", note: "" });
    storage.setItem("pal.gdm.ask.draft", JSON.stringify({ text: 7, note: ["x"] }));
    expect(askDraft.read(storage)).toEqual({ text: "", note: "" });
  });

  it("a storage that throws (private mode, blocked) never throws into the page, and no storage at all is fine", async () => {
    const { askDraft } = await import("../../../components/gdm/ask-list");
    expect(() => askDraft.write({ text: "a", note: "" }, throwing)).not.toThrow();
    expect(() => askDraft.clear(throwing)).not.toThrow();
    expect(askDraft.read(throwing)).toEqual({ text: "", note: "" });
    // No window in this test: the default storage accessor is caught too.
    expect(askDraft.read()).toEqual({ text: "", note: "" });
    expect(() => askDraft.write({ text: "a", note: "" })).not.toThrow();
  });

  it("sign-out, erase and deletion clear it with the door's other device keys", async () => {
    const { askDraft } = await import("../../../components/gdm/ask-list");
    const storage = memoryStorage();
    askDraft.write({ text: "Can I move my snack", note: "" }, storage);
    clearGdmDeviceKeys([storage]);
    expect(askDraft.read(storage)).toEqual({ text: "", note: "" });
  });
});

describe("the nav: My questions in row two, Add a question one tap from every other screen (G-34)", () => {
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
  const text = (node: ReactNode): string =>
    typeof node === "string" ? node : elements(node).map((el) => {
      const children = (el.props as { children?: ReactNode }).children;
      return typeof children === "string" ? children : "";
    }).join(" ");
  const links = (tree: ReactNode) =>
    elements(tree)
      .filter((el) => typeof (el.props as { href?: unknown }).href === "string")
      .map((el) => el.props as { href: string; className?: string; children?: ReactNode; "aria-current"?: string });

  it.each(["/gdm/home", "/gdm/data"])("on %s the filled Add a question links to the questions form", async (pathname) => {
    nav.pathname = pathname;
    const { GdmNav } = await import("../../../components/gdm/nav");
    const add = links(GdmNav()).filter((link) => link.href === GDM_ROUTES.quickAdd);
    expect(add).toHaveLength(1);
    expect(text(add[0].children)).toBe(GDM_COPY["gdm-nav"].add);
    expect(add[0].className).toMatch(/\bprimary-button\b/);
  });

  it("is not rendered on the questions page, where the form is already first", async () => {
    nav.pathname = GDM_ROUTES.questions;
    const { GdmNav } = await import("../../../components/gdm/nav");
    expect(links(GdmNav()).filter((link) => link.href === GDM_ROUTES.quickAdd)).toEqual([]);
  });

  it("row two carries My questions, marked current on its own page", async () => {
    const { GdmNav } = await import("../../../components/gdm/nav");
    const [asks] = links(GdmNav()).filter((link) => link.href === GDM_ROUTES.questions);
    expect(text(asks.children)).toBe(GDM_COPY["gdm-nav"].asks);
    expect(asks["aria-current"]).toBeUndefined();
    nav.pathname = GDM_ROUTES.questions;
    const [current] = links(GdmNav()).filter((link) => link.href === GDM_ROUTES.questions);
    expect(current["aria-current"]).toBe("page");
  });
});
