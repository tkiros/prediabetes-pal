import { createElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Task 3.6 — /learn/first-week. Node has no DOM, so the link, the hydration
// signal, the session, the database, the PATCH helper and the analytics
// forwarder are stand-ins; `notFound` is Next's own. The link stand-in keeps
// each rendered link's href and click handler, so a test can tap one.
const links = vi.hoisted(() => [] as Array<{ href: unknown; onClick: unknown }>);
vi.mock("next/link", async () => {
  const { createElement: h } = await import("react");
  return {
    default: ({ href, onClick, children }: { href?: unknown; onClick?: unknown; children?: ReactNode }) => {
      links.push({ href, onClick });
      return h("a", { href: typeof href === "string" ? href : undefined }, children);
    }
  };
});

const router = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => router
}));

const t = vi.hoisted(() => ({
  hydrated: true,
  session: null as { userId: string; email: string } | null,
  profile: undefined as Record<string, unknown> | undefined,
  selects: [] as Array<Record<string, unknown>>
}));

vi.mock("../../../lib/client/use-hydrated", () => ({ useHydrated: () => t.hydrated }));
const getSessionInfo = vi.hoisted(() => vi.fn(async () => t.session));
vi.mock("../../../lib/server/session", () => ({ getSessionInfo }));
const getDb = vi.hoisted(() =>
  vi.fn(() => ({
    select(shape: Record<string, unknown>) {
      t.selects.push(shape);
      const row = t.profile;
      const rows = row ? [Object.fromEntries(Object.keys(shape).map((key) => [key, row[key] ?? null]))] : [];
      const chain = {
        from: () => chain,
        where: () => chain,
        then: (resolve: (value: unknown[]) => unknown, reject: (reason: unknown) => unknown) =>
          Promise.resolve(rows).then(resolve, reject)
      };
      return chain;
    }
  }))
);
vi.mock("../../../lib/server/db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../lib/server/db")>()),
  getDb
}));
const patchOrientation = vi.hoisted(() => vi.fn(async (_op: unknown) => 200));
const syncOrientation = vi.hoisted(() => vi.fn(async (_opts: unknown) => false));
vi.mock("../../../lib/client/remote-orientation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../lib/client/remote-orientation")>()),
  patchOrientation,
  syncOrientation
}));
const track = vi.hoisted(() => vi.fn());
vi.mock("../../../lib/client/analytics", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../lib/client/analytics")>()),
  track
}));
const recordStepEvent = vi.hoisted(() => vi.fn(async (_kind: unknown) => {}));
vi.mock("../../../lib/client/orientation-progress", () => ({ recordStepEvent }));

function fakeStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
    clear: () => void map.clear()
  };
}
const storage = fakeStorage();
vi.stubGlobal("window", { localStorage: storage });

import FirstWeekPage, { metadata } from "../../../app/(app)/learn/first-week/page";
import { DashboardView, type DashboardData } from "../../../components/dashboard-view";
import { DisclaimerLine } from "../../../components/disclaimer-line";
import { LearnLink, learnPage } from "../../../components/learn-link";
import {
  migrateOnMount,
  OrientationList,
  SAVE_FAILED,
  tapDone,
  tapHide,
  type OrientationListProps
} from "../../../components/orientation-list";
import { firstKeptSave, keepNote, OrientationNote } from "../../../components/orientation-note";
import { OrientationNoteSlot } from "../../../components/orientation-note-slot";
import { StepLink } from "../../../components/step-link";
import { EMPTY_ORIENTATION, LEARN_NUMBERS_HREF, type OrientationState } from "../../../lib/coach/orientation";
import { orientationStore } from "../../../lib/client/orientation-store";

const NOW = new Date("2026-09-15T16:00:00.000Z"); // noon in New York
const DAY_MS = 24 * 60 * 60 * 1000;
const daysAgo = (days: number) => new Date(NOW.getTime() - days * DAY_MS).toISOString();
const week = (over: Partial<OrientationState> = {}): OrientationState => ({ ...EMPTY_ORIENTATION, ...over });

/** React's attribute-safe apostrophe, decoded. */
const decode = (html: string) => html.replace(/&#x27;/g, "'");

/** Every element in a tree whose type is `type` (props.children walk, no render). */
function findAll(node: ReactNode, type: unknown): ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(node)) return node.flatMap((child) => findAll(child, type));
  if (!isValidElement<Record<string, unknown>>(node)) return [];
  return [...(node.type === type ? [node] : []), ...findAll(node.props.children as ReactNode, type)];
}

beforeEach(() => {
  storage.clear();
  t.hydrated = true;
  t.session = null;
  t.profile = undefined;
  t.selects = [];
  getSessionInfo.mockClear();
  getDb.mockClear();
  patchOrientation.mockReset();
  patchOrientation.mockResolvedValue(200);
  syncOrientation.mockReset();
  syncOrientation.mockResolvedValue(false);
  router.refresh.mockClear();
  track.mockClear();
  recordStepEvent.mockClear();
  links.length = 0;
  vi.stubEnv("TZ", "America/New_York");
  vi.stubEnv("NEXT_PUBLIC_GUIDE_DOOR", "1");
  vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("the page: door first, then the mode (rulings F-39, F-31)", () => {
  for (const flag of ["", "ideas,source"]) {
    it(`door shut ("${flag}") ⇒ 404 before any session read or query`, async () => {
      vi.stubEnv("NEXT_PUBLIC_GUIDE_DOOR", flag);
      t.session = { userId: "user-1", email: "user@example.test" };
      await expect(FirstWeekPage()).rejects.toMatchObject({ digest: "NEXT_HTTP_ERROR_FALLBACK;404" });
      expect(getSessionInfo).not.toHaveBeenCalled();
      expect(getDb).not.toHaveBeenCalled();
    });
  }

  const listElement = async () => {
    const lists = findAll(await FirstWeekPage(), OrientationList);
    expect(lists).toHaveLength(1);
    return lists[0]!;
  };
  const listProps = async () => (await listElement()).props as OrientationListProps;

  it("not signed in ⇒ guest, and no query runs", async () => {
    expect(await listProps()).toEqual({ mode: "guest" });
    expect(getDb).not.toHaveBeenCalled();
  });

  it("signed in with a profiles row ⇒ signed-in, with the stored week and the profile's zone", async () => {
    const stored = week({ done: ["1"], startedAt: daysAgo(2) });
    t.session = { userId: "user-1", email: "user@example.test" };
    t.profile = { timezone: "America/Chicago", orientation: stored };
    expect(await listProps()).toEqual({
      mode: "signed-in",
      initialState: stored,
      timezone: "America/Chicago",
      migrate: false
    });
    expect(t.selects.map((shape) => Object.keys(shape))).toEqual([["timezone", "orientation"]]);
  });

  it("signed in with an unreadable stored week ⇒ signed-in from the empty week (A-24), no migration", async () => {
    t.session = { userId: "user-1", email: "user@example.test" };
    for (const orientation of [{ done: ["9"], note: "x" }, "garbage"]) {
      t.profile = { timezone: "America/New_York", orientation };
      expect(await listProps()).toEqual({
        mode: "signed-in",
        initialState: EMPTY_ORIENTATION,
        timezone: "America/New_York",
        migrate: false
      });
    }
  });

  it("signed in with a null server copy ⇒ the list migrates the device week first (F-42)", async () => {
    t.session = { userId: "user-1", email: "user@example.test" };
    t.profile = { timezone: "America/New_York", orientation: null };
    expect(await listProps()).toEqual({
      mode: "signed-in",
      initialState: EMPTY_ORIENTATION,
      timezone: "America/New_York",
      migrate: true
    });
  });

  it("the list's key changes once the copy is no longer null, so the refreshed page remounts it from the server", async () => {
    t.session = { userId: "user-1", email: "user@example.test" };
    t.profile = { timezone: "America/New_York", orientation: null };
    const before = (await listElement()).key;
    t.profile = { timezone: "America/New_York", orientation: week({ done: ["1"] }) };
    const after = (await listElement()).key;
    expect(before).not.toBeNull();
    expect(after).not.toBeNull();
    expect(before).not.toBe(after);
    t.session = null;
    expect((await listElement()).key).toBe(after);
  });

  it("signed in with NO profiles row ⇒ guest (every PATCH would 404)", async () => {
    t.session = { userId: "user-1", email: "user@example.test" };
    t.profile = undefined;
    expect(await listProps()).toEqual({ mode: "guest" });
    expect(getDb).toHaveBeenCalledTimes(1);
  });

  it("is kept out of search, and names itself", () => {
    expect(metadata).toEqual({ title: "Your first week — Prediabetes Pal", robots: { index: false } });
  });

  it("renders in the A-76 order: day → today's step → the other six → the note → the intro → the disclaimer", async () => {
    t.session = { userId: "user-1", email: "user@example.test" };
    t.profile = { timezone: "America/New_York", orientation: week({ startedAt: daysAgo(1) }) };
    const tree = await FirstWeekPage();
    expect(findAll(tree, DisclaimerLine)).toHaveLength(1);
    // A-84: the server page renders the field through its client wrapper.
    expect(findAll(tree, OrientationNoteSlot)).toHaveLength(1);
    const html = decode(renderToStaticMarkup(tree));
    const at = (needle: string) => {
      const index = html.indexOf(needle);
      expect(index, needle).toBeGreaterThan(-1);
      return index;
    };
    const order = [
      at("Day 2 of your first week"),
      at('data-testid="orientation-step-2"'),
      at('data-testid="orientation-step-1"'),
      at('<textarea id="note"'),
      at("Seven small steps, one a day."),
      at("An A1C between 5.7% and 6.4% is a signal, not a sentence."),
      at('class="result-disclaimer"')
    ];
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    // F-REFER is not cleared: no dietitian section, no anchor for it.
    expect(html).not.toContain('id="dietitian"');
  });
});

describe("the list: rendering", () => {
  const render = (props: OrientationListProps) =>
    decode(renderToStaticMarkup(createElement(OrientationList, props)));
  const signedIn = (state: OrientationState, migrate = false) =>
    render({ mode: "signed-in", initialState: state, timezone: "America/New_York", migrate });
  const buttons = (html: string) => [...html.matchAll(/<button([^>]*)>(.*?)<\/button>/g)];
  const stepOrder = (html: string) => [...html.matchAll(/data-testid="orientation-step-(\d)"/g)].map((m) => m[1]);

  it("a running week: the day eyebrow, today's step first, seven constant Done toggles", () => {
    const html = signedIn(week({ startedAt: daysAgo(2), done: ["1"] }));
    expect(html).toContain('<h1 class="hero-eyebrow" data-testid="orientation-day">Day 3 of your first week</h1>');
    expect(html).toContain('role="list"');
    expect(stepOrder(html)).toEqual(["3", "1", "2", "4", "5", "6", "7"]);
    expect(html.match(/Today's step/g)).toHaveLength(1);
    expect(html.indexOf("Today's step")).toBeLessThan(html.indexOf('data-testid="orientation-step-1"'));

    const toggles = buttons(html).filter(([, attrs]) => attrs.includes("aria-pressed"));
    expect(toggles).toHaveLength(7);
    for (const [, attrs, text] of toggles) {
      // A-56: the visible text never changes; the pressed state is the attribute.
      expect(text.replace(/<svg.*<\/svg>/, "")).toBe("Done");
      expect(attrs).toMatch(/aria-label="Done — [^"]+"/);
    }
    const pressed = toggles.filter(([, attrs]) => attrs.includes('aria-pressed="true"'));
    expect(pressed).toHaveLength(1);
    expect(pressed[0]![1]).toContain('aria-label="Done — Read what the words on a result mean, in general terms."');
    // F-36 / F-40: no un-mark, no "of 7".
    expect(html).not.toContain("Not yet");
    expect(html).not.toMatch(/of 7/);
    // The status line is there for a failed save, and quiet on first paint.
    expect(html).toContain('<p class="field-hint" role="status"></p>');
    expect(html).toContain(">Hide this for now</button>");
    expect(html).not.toContain("Show it again");
  });

  it("step 5 links to the note on this page; step 6 is the page itself, so it is plain text", () => {
    const html = signedIn(week({ startedAt: daysAgo(0) }));
    expect(html).toContain('<a href="#note">Write down the questions you have for your clinician.</a>');
    expect(html).toContain("<p class=\"page-copy\">Book, or ask about, a dietitian appointment.</p>");
    expect(html).toContain('<a href="/check">Check the meal you are least sure about.</a>');
  });

  it("a tap on step 1's link, and on no other, completes step 1 (A-84)", () => {
    signedIn(week({ startedAt: daysAgo(0) }));
    // Steps 1–5 and 7 link; step 6 is plain text.
    expect(links).toHaveLength(6);
    expect(recordStepEvent).not.toHaveBeenCalled();
    const tappable = links.filter((link) => link.onClick !== undefined);
    expect(tappable.map((link) => link.href)).toEqual([LEARN_NUMBERS_HREF]);
    (tappable[0]!.onClick as () => void)();
    expect(recordStepEvent).toHaveBeenCalledTimes(1);
    expect(recordStepEvent).toHaveBeenCalledWith("numbers_link");
  });

  it("after day 7, with no start, or with every step done: no today's step and the steps keep source order (day 7 and no-start also drop the day number, per F-40)", () => {
    for (const state of [
      week({ startedAt: daysAgo(7) }),
      week(),
      week({ startedAt: daysAgo(1), done: ["1", "2", "3", "4", "5", "6", "7"] })
    ]) {
      const html = signedIn(state);
      expect(html).not.toContain("Today's step");
      expect(stepOrder(html)).toEqual(["1", "2", "3", "4", "5", "6", "7"]);
      if (state.done.length === 0) expect(html).toContain(">Your first week</h1>");
    }
  });

  it("dismissed (F-41): the steps still render, the eyebrow drops the day, and Show it again replaces Hide", () => {
    const html = signedIn(week({ startedAt: daysAgo(1), dismissedAt: daysAgo(0), done: ["1"] }));
    expect(html).toContain(">Your first week</h1>");
    expect(html).toContain('role="list"');
    expect(stepOrder(html)).toEqual(["1", "2", "3", "4", "5", "6", "7"]);
    expect(html).not.toContain("Today's step");
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(1);
    expect(html).toContain(">Show it again</button>");
    expect(html).not.toContain("Hide this for now");
  });

  it("F-42: while a signed-in page migrates, every write control is disabled; otherwise none is", () => {
    const syncing = buttons(signedIn(week(), true));
    expect(syncing).toHaveLength(8);
    for (const [, attrs] of syncing) expect(attrs).toContain('disabled=""');

    for (const html of [signedIn(week()), render({ mode: "guest" })]) {
      const controls = buttons(html);
      expect(controls).toHaveLength(8);
      for (const [, attrs] of controls) expect(attrs).not.toContain("disabled");
    }
  });

  it("guest: the device week after hydration, the empty week before it (A-20)", () => {
    storage.setItem("pal.orient.v1", JSON.stringify(week({ startedAt: daysAgo(4), done: ["5"] })));
    const after = render({ mode: "guest" });
    expect(after).toContain("Day 5 of your first week");
    expect(stepOrder(after)[0]).toBe("1"); // day 5's step is done ⇒ the earliest undone leads, as on Home
    expect(after.match(/aria-pressed="true"/g)).toHaveLength(1);

    t.hydrated = false;
    const before = render({ mode: "guest" });
    expect(before).toContain(">Your first week</h1>");
    expect(before).not.toContain('aria-pressed="true"');
  });
});

describe("the list: Done is one way, and a failed save takes it back (rulings F-36, F-37)", () => {
  function harness(mode: OrientationListProps["mode"], initial: OrientationState) {
    const ui = {
      mode,
      state: initial,
      failed: false,
      updates: 0,
      update(fn: (state: OrientationState) => OrientationState) {
        ui.updates += 1;
        ui.state = fn(ui.state);
      },
      setFailed(failed: boolean) {
        ui.failed = failed;
      }
    };
    return ui;
  }

  it("signed-in: an unpressed Done marks the step at once, PATCHes markDone, and reports it once saved", async () => {
    const ui = harness("signed-in", week({ done: ["1"] }));
    let finish: (status: number) => void = () => {};
    patchOrientation.mockReturnValueOnce(new Promise((resolve) => (finish = resolve)));
    const tap = tapDone(ui, "2");
    expect(ui.state.done).toEqual(["1", "2"]); // optimistic
    expect(track).not.toHaveBeenCalled();
    finish(200);
    await tap;
    expect(patchOrientation).toHaveBeenCalledWith({ op: "markDone", step: "2" });
    expect(ui.state.done).toEqual(["1", "2"]);
    expect(ui.failed).toBe(false);
    expect(track).toHaveBeenCalledWith({ name: "orientation_step_done", props: { step: "2" } });
  });

  for (const status of [500, 404, 409, 0]) {
    it(`signed-in: a ${status} takes the mark back and says so, and reports nothing`, async () => {
      patchOrientation.mockResolvedValueOnce(status);
      const ui = harness("signed-in", week());
      await tapDone(ui, "2");
      expect(ui.state.done).toEqual([]);
      expect(ui.failed).toBe(true);
      expect(track).not.toHaveBeenCalled();
    });
  }

  it("a rollback removes only its own step, never one marked while it was pending", async () => {
    let fail: (status: number) => void = () => {};
    patchOrientation.mockReturnValueOnce(new Promise((resolve) => (fail = resolve)));
    const ui = harness("signed-in", week());
    const first = tapDone(ui, "2");
    await tapDone({ ...ui, state: ui.state, update: ui.update, setFailed: ui.setFailed }, "4");
    fail(503);
    await first;
    expect(ui.state.done).toEqual(["4"]);
  });

  it("the failure line is the reviewed copy, and a later tap clears it", async () => {
    expect(SAVE_FAILED).toBe("That didn't save just now. Tap Done again in a moment.");
    patchOrientation.mockResolvedValueOnce(500);
    const ui = harness("signed-in", week());
    await tapDone(ui, "3");
    expect(ui.failed).toBe(true);
    await tapDone(ui, "3");
    expect(ui.failed).toBe(false);
    expect(ui.state.done).toEqual(["3"]);
  });

  it("an already pressed Done does nothing — no write, no state change, no event (guest and signed-in)", async () => {
    storage.setItem("pal.orient.v1", JSON.stringify(week({ done: ["2"] })));
    for (const mode of ["guest", "signed-in"] as const) {
      const ui = harness(mode, week({ done: ["2"] }));
      await tapDone(ui, "2");
      expect(ui.updates).toBe(0);
      expect(ui.state.done).toEqual(["2"]);
    }
    expect(patchOrientation).not.toHaveBeenCalled();
    expect(track).not.toHaveBeenCalled();
    expect(orientationStore.get().done).toEqual(["2"]);
  });

  it("guest: Done writes the device, never the network", async () => {
    const ui = harness("guest", week());
    await tapDone(ui, "2");
    expect(orientationStore.get().done).toEqual(["2"]);
    expect(ui.state.done).toEqual(["2"]);
    expect(patchOrientation).not.toHaveBeenCalled();
    expect(track).toHaveBeenCalledWith({ name: "orientation_step_done", props: { step: "2" } });
  });

  it("signed-in: Hide sends dismiss and reports it; Show it again sends restore", async () => {
    const ui = harness("signed-in", week({ startedAt: daysAgo(1) }));
    await tapHide(ui, true);
    expect(patchOrientation).toHaveBeenLastCalledWith({ op: "dismiss" });
    expect(ui.state.dismissedAt).toBe(NOW.toISOString());
    expect(track).toHaveBeenCalledWith({ name: "orientation_dismissed" });

    track.mockClear();
    await tapHide(ui, false);
    expect(patchOrientation).toHaveBeenLastCalledWith({ op: "restore" });
    expect(ui.state.dismissedAt).toBeNull();
    expect(track).not.toHaveBeenCalled();
  });

  it("signed-in: a failed Hide or Show puts the control back", async () => {
    patchOrientation.mockResolvedValue(0);
    const shown = harness("signed-in", week());
    await tapHide(shown, true);
    expect(shown.state.dismissedAt).toBeNull();
    const hidden = harness("signed-in", week({ dismissedAt: daysAgo(1) }));
    await tapHide(hidden, false);
    expect(hidden.state.dismissedAt).toBe(daysAgo(1));
    expect(track).not.toHaveBeenCalled();
  });

  it("guest: Hide and Show it again write the device", async () => {
    const ui = harness("guest", week());
    await tapHide(ui, true);
    expect(orientationStore.get().dismissedAt).toBe(NOW.toISOString());
    await tapHide(ui, false);
    expect(orientationStore.get().dismissedAt).toBeNull();
    expect(patchOrientation).not.toHaveBeenCalled();
  });
});

describe("the list: a signed-in page migrates before it writes (ruling F-42)", () => {
  const harness = () => {
    const ui = {
      syncing: true,
      refreshes: 0,
      setSyncing: (value: boolean) => void (ui.syncing = value),
      refresh: () => void (ui.refreshes += 1)
    };
    return ui;
  };

  it("nothing runs without a null server copy (guest, or a signed-in copy that exists)", async () => {
    const ui = harness();
    await migrateOnMount(false, { current: false }, ui);
    expect(syncOrientation).not.toHaveBeenCalled();
    expect(ui.refreshes).toBe(0);
  });

  it("sends the migration once per mount, never a start, and unlocks when it settles", async () => {
    let settle: (migrated: boolean) => void = () => {};
    syncOrientation.mockReturnValueOnce(new Promise((resolve) => (settle = resolve)));
    const ui = harness();
    const sent = { current: false };
    const first = migrateOnMount(true, sent, ui);
    await migrateOnMount(true, sent, ui); // StrictMode's second mount effect
    expect(syncOrientation).toHaveBeenCalledTimes(1);
    expect(syncOrientation).toHaveBeenCalledWith({ migrate: true, start: false });
    expect(ui.syncing).toBe(true); // still locked while the write is out
    settle(false);
    await first;
    expect(ui.syncing).toBe(false);
    expect(ui.refreshes).toBe(0); // nothing landed ⇒ no refresh
  });

  it("refreshes only when a migration write landed", async () => {
    syncOrientation.mockResolvedValueOnce(true);
    const ui = harness();
    await migrateOnMount(true, { current: false }, ui);
    expect(ui.syncing).toBe(false);
    expect(ui.refreshes).toBe(1);
  });

  it("a sync that throws still unlocks the controls", async () => {
    syncOrientation.mockRejectedValueOnce(new Error("boom"));
    const ui = harness();
    await migrateOnMount(true, { current: false }, ui);
    expect(ui.syncing).toBe(false);
    expect(ui.refreshes).toBe(0);
  });
});

describe("the note: on this device, never inside app copy (A-57)", () => {
  const NOTE = "Ask which test was used & what the range means";
  const render = () => renderToStaticMarkup(createElement(OrientationNote));
  const escaped = NOTE.replace(/&/g, "&amp;");

  it("storage works: the note fills the textarea and appears nowhere else; the honest hint shows", () => {
    storage.setItem("pal.orient.note.v1", NOTE);
    const html = decode(render());
    expect(html).toContain('<label class="field-label" for="note">Write down the questions you have for your clinician.</label>');
    expect(html.split(escaped)).toHaveLength(2);
    expect(html).toMatch(new RegExp(`<textarea id="note"[^>]*>${escaped}</textarea>`));
    expect(html).toContain(
      '<p class="field-hint" id="note-hint" role="status">Your notes stay on this device. Nothing here is sent anywhere.</p>'
    );
    expect(html).toContain('<p class="field-hint" aria-live="polite"></p>');
  });

  it("storage refuses writes: the status line says so", () => {
    const setItem = storage.setItem;
    storage.setItem = () => {
      throw new Error("QuotaExceededError");
    };
    try {
      const html = decode(render());
      expect(html).toContain(
        '<p class="field-hint" id="note-hint" role="status">This browser isn\'t letting the page keep notes — copy your questions somewhere safe.</p>'
      );
      expect(html).not.toContain("stay on this device");
    } finally {
      storage.setItem = setItem;
    }
  });

  it("before hydration: no note, no hint", () => {
    storage.setItem("pal.orient.note.v1", NOTE);
    t.hydrated = false;
    const html = render();
    expect(html).not.toContain(escaped);
    expect(html).not.toContain("stay on this device");
  });

  it("a kept note says 'Saved on this device' for two seconds; a refused one flips to the status line", () => {
    const ui = { draft: "", failed: false, saved: false };
    const setters = {
      setDraft: (text: string) => void (ui.draft = text),
      setFailed: (failed: boolean) => void (ui.failed = failed),
      setSaved: (saved: boolean) => void (ui.saved = saved)
    };
    // One instance's timer handle, same object across both calls below — a
    // fresh object per call would not exercise the second call clearing the
    // first's still-pending timeout (#24).
    const timer: { current: ReturnType<typeof setTimeout> | undefined } = { current: undefined };
    expect(keepNote("bring the lab sheet", setters, timer)).toBe(true);
    expect(storage.getItem("pal.orient.note.v1")).toBe("bring the lab sheet");
    expect(ui).toEqual({ draft: "bring the lab sheet", failed: false, saved: true });
    vi.advanceTimersByTime(1999);
    expect(ui.saved).toBe(true);
    vi.advanceTimersByTime(1);
    expect(ui.saved).toBe(false);

    const setItem = storage.setItem;
    storage.setItem = () => {
      throw new Error("QuotaExceededError");
    };
    try {
      expect(keepNote("bring the lab sheet, and the list", setters, timer)).toBe(false);
      expect(ui).toEqual({ draft: "bring the lab sheet, and the list", failed: true, saved: false });
    } finally {
      storage.setItem = setItem;
    }
  });

  it("step 5 completes on the first kept save with text in it, once per mount (A-84)", () => {
    const fired = { current: false };
    expect(firstKeptSave("   ", true, fired)).toBe(false); // an all-space save clears the key
    expect(firstKeptSave("ask which test", false, fired)).toBe(false); // storage refused it
    expect(fired.current).toBe(false);
    expect(firstKeptSave("ask which test", true, fired)).toBe(true);
    expect(firstKeptSave("ask which test was used", true, fired)).toBe(false);
    expect(fired.current).toBe(true);
    // A new mount has a new ref, so it counts again (the write is idempotent).
    expect(firstKeptSave("ask which test", true, { current: false })).toBe(true);
  });

  it("the page's wrapper hands the field a no-text callback that records clinician_list; rendering records nothing (A-84)", () => {
    const element = OrientationNoteSlot();
    expect(element.type).toBe(OrientationNote);
    const { onSaved } = element.props as { onSaved: () => void };
    expect(onSaved).toHaveLength(0);

    expect(renderToStaticMarkup(createElement(OrientationNoteSlot))).toContain('<textarea id="note"');
    expect(recordStepEvent).not.toHaveBeenCalled();

    onSaved();
    expect(recordStepEvent).toHaveBeenCalledTimes(1);
    expect(recordStepEvent).toHaveBeenCalledWith("clinician_list");
  });
});

describe("Home's step line into /learn/ reports learn_opened (ruling F-38)", () => {
  const data = (href: string): DashboardData => ({
    todayLabel: "Tuesday, September 15",
    weekSummary: "No meals checked yet.",
    showFirstWin: false,
    todayChecks: [],
    nextAction: { text: "Today's step: x", href },
    planBox: { planName: "Free plan", meta: "", isFree: true, signedIn: true, attention: false },
    planBoxAttention: false,
    isDay0: true,
    orientationDay: 5
  });

  it("maps a /learn/ href onto the closed page enum", () => {
    expect(learnPage("/learn/first-week#note")).toBe("first-week");
    expect(learnPage("/learn/first-week")).toBe("first-week");
    expect(learnPage("/learn/numbers?x=1")).toBe("numbers");
    expect(learnPage("/learn/doctor")).toBe("doctor");
    expect(learnPage("/learn")).toBe("index");
    expect(learnPage("/learn/")).toBe("index");
  });

  it("a /learn/ step renders LearnLink, and its click reports the page and the step origin", () => {
    const links = findAll(DashboardView({ data: data("/learn/first-week#note") }), LearnLink);
    expect(links).toHaveLength(1);
    expect(links[0]!.props).toMatchObject({ href: "/learn/first-week#note", from: "step" });

    const rendered = LearnLink(links[0]!.props as Parameters<typeof LearnLink>[0]);
    expect(rendered.props.href).toBe("/learn/first-week#note");
    (rendered.props.onClick as () => void)();
    expect(track).toHaveBeenCalledWith({ name: "learn_opened", props: { page: "first-week", from: "step" } });
  });

  it("step 1's line renders StepLink, not LearnLink, and its tap completes step 1 (A-84)", () => {
    const tree = DashboardView({ data: data(LEARN_NUMBERS_HREF) });
    expect(findAll(tree, LearnLink)).toHaveLength(0);
    const steps = findAll(tree, StepLink);
    expect(steps).toHaveLength(1);
    expect(steps[0]!.props).toMatchObject({ href: LEARN_NUMBERS_HREF, event: "numbers_link" });

    const rendered = StepLink(steps[0]!.props as Parameters<typeof StepLink>[0]);
    expect(rendered.props.href).toBe(LEARN_NUMBERS_HREF);
    expect(recordStepEvent).not.toHaveBeenCalled();
    (rendered.props.onClick as () => void)();
    expect(recordStepEvent).toHaveBeenCalledWith("numbers_link");
    expect(track).not.toHaveBeenCalled();
  });

  it("any other href keeps the plain link", () => {
    for (const href of ["/check", "/journey", "/home#ideas-title", "/meals"]) {
      const tree = DashboardView({ data: data(href) });
      expect(findAll(tree, LearnLink)).toHaveLength(0);
      expect(findAll(tree, StepLink)).toHaveLength(0);
    }
    expect(findAll(DashboardView({ data: data("/learn/first-week#note") }), StepLink)).toHaveLength(0);
  });
});
