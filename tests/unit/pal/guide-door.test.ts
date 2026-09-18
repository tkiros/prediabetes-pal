import fs from "node:fs";
import path from "node:path";

import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Home renders (Task 3.5, review A-110): node has no app router and no DOM, so
// the router hooks, the link, the hydration signal, the session, the plan box
// and the database are stand-ins. The database fake records every select shape
// and answers with only the columns that shape names, as Postgres would.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push() {}, replace() {}, refresh() {}, back() {}, prefetch() {} }),
  usePathname: () => "/home",
  useSearchParams: () => new URLSearchParams()
}));
vi.mock("next/link", async () => {
  const { createElement: h } = await import("react");
  return {
    default: ({ href, children }: { href?: unknown; children?: ReactNode }) =>
      h("a", { href: typeof href === "string" ? href : undefined }, children)
  };
});

const home = vi.hoisted(() => ({
  hydrated: false,
  selects: [] as Array<Record<string, unknown>>,
  profile: undefined as Record<string, unknown> | undefined,
  checks: [] as Array<Record<string, unknown>>
}));

vi.mock("../../../lib/client/use-hydrated", () => ({ useHydrated: () => home.hydrated }));
vi.mock("../../../lib/server/session", () => ({
  getSessionInfo: async () => ({ userId: "user-1", email: "user@example.test" })
}));
vi.mock("../../../lib/server/plan-box", () => ({
  getPlanBox: async () => ({
    planName: "Free plan",
    meta: "The daily check is free.",
    isFree: true,
    signedIn: true,
    attention: false
  })
}));
vi.mock("../../../lib/server/crypto", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../lib/server/crypto")>()),
  safeDecrypt: (value: string) => value
}));
vi.mock("../../../lib/server/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../lib/server/db")>();
  const answer = (rows: unknown[]) => {
    const chain = {
      from: () => chain,
      where: () => chain,
      orderBy: () => chain,
      limit: async () => rows,
      then: (resolve: (value: unknown[]) => unknown, reject: (reason: unknown) => unknown) =>
        Promise.resolve(rows).then(resolve, reject)
    };
    return chain;
  };
  return {
    ...actual,
    getDb: () => ({
      select(shape: Record<string, unknown>) {
        home.selects.push(shape);
        if (!("timezone" in shape)) return answer(home.checks);
        const row = home.profile;
        return answer(
          row ? [Object.fromEntries(Object.keys(shape).map((key) => [key, row[key] ?? null]))] : []
        );
      }
    })
  };
});

// The guest stores read window.localStorage; history-store binds it at import.
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

import {
  GUIDE_SURFACES,
  guideDoorEnabled,
} from "../../../lib/guide-door-flag";
import { SOURCE_LEAD } from "../../../components/result-card";
import type { DashboardData } from "../../../components/dashboard-view";

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");

describe("guideDoorEnabled — the one door flag (PRD §9 Step 1, §9.2 revert lever)", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("`1` opens every surface; a list opens only its members; anything else opens none", () => {
    vi.stubEnv("NEXT_PUBLIC_GUIDE_DOOR", "1");
    for (const surface of GUIDE_SURFACES)
      expect(guideDoorEnabled(surface)).toBe(true);

    vi.stubEnv("NEXT_PUBLIC_GUIDE_DOOR", "ideas, source");
    expect(guideDoorEnabled("ideas")).toBe(true);
    expect(guideDoorEnabled("source")).toBe(true);
    expect(guideDoorEnabled("orient")).toBe(false);

    for (const value of ["true", "0", "", "yes", "idea"]) {
      vi.stubEnv("NEXT_PUBLIC_GUIDE_DOOR", value);
      for (const surface of GUIDE_SURFACES)
        expect(guideDoorEnabled(surface)).toBe(false);
    }
  });
});

describe("guide-door render sites (source pins, node env has no DOM)", () => {
  it("DashboardView renders the ideas block ABOVE the hero, gated by the flag", () => {
    const src = read("components/dashboard-view.tsx");
    expect(src).toMatch(/from\s+["'].*guide-door-flag["']/);
    expect(src.indexOf("<GuideIdeas")).toBeGreaterThan(-1);
    expect(src.indexOf("<GuideIdeas")).toBeLessThan(src.indexOf("<HomeCheckHero"));
    // Review fix round 1: the two assertions above pass even if <GuideIdeas />
    // renders unconditionally — pin the actual gate, not just source order.
    expect(src).toMatch(/ideasOn\s*=\s*guideDoorEnabled\(\s*["']ideas["']\s*\)/);
    expect(src).toContain("ideasOn ? <GuideIdeas");
  });

  it("the chips hand off through pal.recheck and mark the source — /check stays the one place a check runs", () => {
    const src = read("components/guide-ideas.tsx");
    expect(src).toContain('"pal.recheck"');
    expect(src).toContain('"pal.recheck.source"');
    expect(src).toContain('router.push("/check?stay=1")'); // A-102
    // The anchor phrase (PRD §7.3), never "your plan".
    expect(src).toMatch(/Prediabetes Pal(?:'|&apos;|’)s rules/);
    expect(src).not.toMatch(/your plan/i);
  });

  it("the check form reads pal.recheck.source alongside pal.recheck and emits idea_check_completed once", () => {
    const src = read("components/food-check-form.tsx");
    expect(src).toContain('"pal.recheck.source"');
    expect(src.match(/name: "idea_check_completed"/g)).toHaveLength(1);
  });

  it("the check form records the week's step events where a check completes (review A-84)", () => {
    const src = read("components/food-check-form.tsx");
    const at = (needle: string) => {
      const index = src.indexOf(needle);
      expect(index, needle).toBeGreaterThan(-1);
      return index;
    };
    // Every result check: once, after check_completed, outside the idea block.
    expect(src.match(/recordStepEvent\("check"\)/g)).toHaveLength(1);
    expect(at('recordStepEvent("check")')).toBeGreaterThan(at('name: "check_completed"'));
    expect(at('recordStepEvent("check")')).toBeLessThan(at("if (shouldCountIdeaCheck("));
    // An idea check as well: once, inside the idea block, before the taster meter.
    expect(src.match(/recordStepEvent\("idea_check"\)/g)).toHaveLength(1);
    expect(at('recordStepEvent("idea_check")')).toBeGreaterThan(at("if (shouldCountIdeaCheck("));
    expect(at('recordStepEvent("idea_check")')).toBeLessThan(at("if (shouldRecordTaster("));
  });

  it("a visit to /journey records no step event — step 7 completes from its own links (ruling F-54)", () => {
    expect(read("app/(app)/journey/page.tsx")).not.toContain("recordStepEvent");
  });

  it("the other pal.recheck writers also clear pal.recheck.source (review A-102) — a hand-off that never reached the form cannot make a later typed check count as an idea", () => {
    for (const rel of [
      "app/(app)/meals/page.tsx",
      "components/meal-memory-recall.tsx",
      "components/home-check-hero.tsx",
    ]) {
      expect(read(rel)).toContain('"pal.recheck.source"');
    }
  });

  it("the hero H2 switches on the flag and keeps today's string when it is off", () => {
    const src = read("components/home-check-hero.tsx");
    expect(src).toMatch(
      /guideDoorEnabled\("home"\)\s*\?\s*"Unsure about a meal\?"\s*:\s*"What are you eating\?"/
    );
  });
});

describe("F-SOURCE lead-in (PRD v1.1 §6 F-SOURCE)", () => {
  it("has one sentence per label, each citing the product's own rules and no authority", () => {
    for (const risk of ["SAFE", "MODERATE", "HIGH"] as const) {
      const line = SOURCE_LEAD[risk];
      expect(line).toMatch(/^Why this label: under Prediabetes Pal's rules this description reads as /);
      expect(line).not.toMatch(/doctor|science|clinic|study|research/i);
      expect(line).not.toMatch(/\d/); // no numeric claim
      expect(line).not.toMatch(/same read every time|never changes/i); // the held /how-it-works claim
    }
  });

  it("result-card renders the lead-in from the map, flag-gated, above the reason", () => {
    const src = read("components/result-card.tsx");
    expect(src).toMatch(/from\s+["'].*guide-door-flag["']/);
    expect(src).toContain("SOURCE_LEAD[response.risk]");
    expect(src.indexOf("SOURCE_LEAD[response.risk]")).toBeLessThan(src.indexOf("{response.reason}"));
  });
});

describe("check-empty-ideas: ideas on /check's first-run empty state (Task 1.14 / plan Task 4.2)", () => {
  it("gates on guideDoorEnabled(\"ideas\") and emits ideas_shown/idea_tapped with surface: \"check\"", () => {
    const src = read("components/food-check-form.tsx");
    expect(src).toMatch(/from\s+["'].*guide-door-flag["']/);
    expect(src).toMatch(/guideDoorEnabled\(\s*["']ideas["']\s*\)/);
    expect(src).toMatch(/name:\s*["']ideas_shown["']/);
    expect(src).toMatch(/name:\s*["']idea_tapped["']/);
    expect(src.match(/surface:\s*["']check["']/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
  });

  it("renders the reviewed row heading and the flag-gated classics hint (controller ruling 1)", () => {
    const src = read("components/food-check-form.tsx");
    expect(src).toContain("Or start from an idea for ");
    expect(src).toContain("Or try a classic — three everyday foods.");
    // Flag off ⇒ byte-for-byte unchanged classics hint (controller ruling 3).
    expect(src).toContain(
      "First time? Try one of the classics — three everyday breakfast staples."
    );
  });

  it('the tap sets recheckSource: "idea" — the same hand-off shape as a Home tap (review A-69)', () => {
    const src = read("components/food-check-form.tsx");
    expect(src).toMatch(/recheckSource:\s*["']idea["']/);
  });

  it("sits below the submit CTA and above the classics block in source order (controller ruling 3)", () => {
    const src = read("components/food-check-form.tsx");
    const submitIndex = src.indexOf('type="submit"');
    const ideasIndex = src.indexOf('data-testid="check-empty-ideas"');
    const classicsIndex = src.indexOf('data-testid="first-check-classics"');
    expect(submitIndex).toBeGreaterThan(-1);
    expect(ideasIndex).toBeGreaterThan(submitIndex);
    expect(classicsIndex).toBeGreaterThan(ideasIndex);
  });
});

describe("F-CALM: `Hold off` never renders as danger red (Task 2.3)", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("globals.css declares --high-border exactly twice — the default and the [data-calm] override", () => {
    const src = read("app/globals.css");
    expect(src.match(/--high-border:/g)).toHaveLength(2);
    // The override is the neutral-ink family, not another red.
    expect(src).toMatch(/:root\[data-calm\]\s*\{[^}]*--high-border:\s*#334155/s);
    expect(src).toMatch(/:root\[data-calm\]\s*\{[^}]*--high-bg:\s*#f1f5f9/s);
    expect(src).toMatch(/:root\[data-calm\]\s*\{[^}]*--high-text:\s*#1e293b/s);
    expect(src).toMatch(/:root\[data-calm\]\s*\{[^}]*--high-badge:\s*#e2e8f0/s);
    // --danger stays reserved for destructive actions — untouched.
    expect(src.match(/--danger:\s*#b91c1c/g)).toHaveLength(1);
  });

  async function renderHtmlTag(flag?: string): Promise<string> {
    vi.stubEnv("NEXT_PUBLIC_GUIDE_DOOR", flag ?? "");
    const { default: RootLayout } = await import("../../../app/layout");
    const props: Parameters<typeof RootLayout>[0] = {
      children: createElement("div", null, "x"),
    };
    const html = renderToStaticMarkup(createElement(RootLayout, props));
    return html.slice(0, html.indexOf(">") + 1);
  }

  it("flag off: <html> carries no data-calm attribute at all (not a literal \"false\")", async () => {
    const openTag = await renderHtmlTag();
    expect(openTag).not.toContain("data-calm");
  });

  it("flag on (calm surface named): <html data-calm=\"\"> opens the [data-calm] override", async () => {
    const openTag = await renderHtmlTag("calm");
    expect(openTag).toContain('data-calm=""');
  });

  it("`1` (every surface) also sets data-calm", async () => {
    const openTag = await renderHtmlTag("1");
    expect(openTag).toContain('data-calm=""');
  });

  it("a surface list that omits calm leaves data-calm absent", async () => {
    const openTag = await renderHtmlTag("ideas,orient");
    expect(openTag).not.toContain("data-calm");
  });
});

// ---------------------------------------------------------------------------
// Task 3.5 — Home feeds the orientation step and the "Day N" eyebrow.
// Render, don't pin (review A-110).
// ---------------------------------------------------------------------------

const NOW = new Date("2026-09-15T16:00:00.000Z"); // noon in New York, same date almost everywhere
const DAY_MS = 24 * 60 * 60 * 1000;
const daysAgo = (days: number) => new Date(NOW.getTime() - days * DAY_MS);

type Seed = {
  /** Guest profile / profiles.onboarded_at. */
  onboardedDaysAgo?: number;
  /** Orientation state; `startedDaysAgo` becomes startedAt. */
  week?: { startedDaysAgo?: number; done?: string[]; dismissed?: boolean };
  /** A raw jsonb value for profiles.orientation (overrides `week`). */
  rawOrientation?: unknown;
  checkToday?: boolean;
};

function orientationOf(week: NonNullable<Seed["week"]>) {
  return {
    done: week.done ?? [],
    dismissedAt: week.dismissed ? daysAgo(0).toISOString() : null,
    startedAt: week.startedDaysAgo === undefined ? null : daysAgo(week.startedDaysAgo).toISOString()
  };
}

function seedGuest(seed: Seed) {
  if (seed.onboardedDaysAgo !== undefined)
    storage.setItem(
      "pal.profile.v1",
      JSON.stringify({ a1c: 6.1, onboardedAt: daysAgo(seed.onboardedDaysAgo).toISOString() })
    );
  if (seed.week) storage.setItem("pal.orient.v1", JSON.stringify(orientationOf(seed.week)));
  if (seed.checkToday)
    storage.setItem(
      "pal.history.v1",
      JSON.stringify([
        {
          clientId: "c1",
          food: "white rice with beans",
          risk: "MODERATE",
          a1cBand: "prediabetes_60_62",
          inputMethod: "text",
          createdAt: new Date(NOW.getTime() - 60 * 60 * 1000).toISOString()
        }
      ])
    );
}

function seedServer(seed: Seed) {
  home.profile = {
    timezone: "America/New_York",
    onboardedAt: seed.onboardedDaysAgo === undefined ? null : daysAgo(seed.onboardedDaysAgo),
    orientation:
      "rawOrientation" in seed ? seed.rawOrientation : seed.week ? orientationOf(seed.week) : null
  };
  home.checks = seed.checkToday
    ? [
        {
          id: "row-1",
          clientId: "c1",
          createdAt: new Date(NOW.getTime() - 60 * 60 * 1000),
          risk: "MODERATE",
          actionDoneAt: null,
          foodCiphertext: "white rice with beans",
          a1cBand: "prediabetes_60_62",
          inputMethod: "text"
        }
      ]
    : [];
}

async function renderGuest(flag: string, seed: Seed = {}, hydrated = true): Promise<string> {
  vi.stubEnv("NEXT_PUBLIC_GUIDE_DOOR", flag);
  home.hydrated = hydrated;
  seedGuest(seed);
  const { GuestDashboard } = await import("../../../components/guest-dashboard");
  return renderToStaticMarkup(createElement(GuestDashboard));
}

async function renderSignedIn(flag: string, seed: Seed = {}): Promise<string> {
  vi.stubEnv("NEXT_PUBLIC_GUIDE_DOOR", flag);
  seedServer(seed);
  const { default: HomePage } = await import("../../../app/(app)/home/page");
  return renderToStaticMarkup(await HomePage());
}

/** Rendered text with React's attribute-safe apostrophe decoded. */
const decode = (html: string) => html.replace(/&#x27;/g, "'");

/** Home's next-action line: [href, text], or null when the line is absent. */
const stepLine = (html: string) =>
  /data-testid="next-action"><a href="([^"]*)">([^<]*)</.exec(decode(html))?.slice(1) ?? null;
/** The meal-check hero's eyebrow text, e.g. "Meal check" or "Today's step · Meal check". */
const heroEyebrow = (html: string) => /<p class="meal-hero-eyebrow">([^<]*)</.exec(decode(html))?.[1];

// A week in progress and a check today — everything the orient door reads.
const BUSY: Seed = { onboardedDaysAgo: 1, week: { startedDaysAgo: 1, done: ["1"] }, checkToday: true };

describe("Home with the orient door shut stays byte-for-byte (Task 3.5)", () => {
  beforeEach(() => {
    storage.clear();
    home.selects = [];
    // The guest dates by the device clock's zone; pin it, or a far-east box
    // renders another date and someone "fixes" the snapshot with -u.
    vi.stubEnv("TZ", "America/New_York");
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  // "" is today's production-off value; "ideas,source" is today's production list.
  for (const flag of ["", "ideas,source"]) {
    it(`guest Home before hydration, flag "${flag}"`, async () => {
      expect(await renderGuest(flag, BUSY, false)).toMatchSnapshot();
    });

    it(`guest Home ignores device orientation state, flag "${flag}"`, async () => {
      expect(await renderGuest(flag, BUSY)).toMatchSnapshot();
    });

    it(`signed-in Home: the profile query names only timezone, and the markup is today's, flag "${flag}"`, async () => {
      const html = await renderSignedIn(flag, BUSY);
      // Ruling F-25: a query that names profiles.orientation fails on a database
      // where migration 0019 has not run. Door shut ⇒ the column is never named.
      expect(home.selects.map((shape) => Object.keys(shape))[0]).toEqual(["timezone"]);
      expect(html).toMatchSnapshot();
    });
  }
});

describe("Home with the orient door open: the day eyebrow and the day's step (Task 3.5)", () => {
  beforeEach(() => {
    storage.clear();
    home.selects = [];
    // The guest dates by the device clock's zone; pin it, or a far-east box
    // renders another date and someone "fixes" the snapshot with -u.
    vi.stubEnv("TZ", "America/New_York");
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  // F-30/F-35 (option C): the day line now renders INSIDE the one <h1> in
  // place of the date, not as a separate eyebrow <p> above it.
  const EYEBROW =
    /<div class="dash-greet"><h1 class="dash-greet-date dash-greet-date--eyebrow" data-testid="orientation-day">Day (\d) of your first week<\/h1>/;
  const dayOf = (html: string) => EYEBROW.exec(html)?.[1] ?? null;

  const renders = [
    ["guest", renderGuest],
    ["signed-in", renderSignedIn]
  ] as const;

  for (const [who, render] of renders) {
    it(`${who}: a started week reads "Day N of your first week" inside the greeting's one <h1>, in the date's place (F-30/F-35)`, async () => {
      const html = await render("1", { onboardedDaysAgo: 40, week: { startedDaysAgo: 3 } });
      expect(dayOf(html)).toBe("4");
      // The date text is gone while the week runs — the day line replaced it,
      // it did not stack above it.
      expect(html).not.toContain("Tuesday, September 15");
      // Step 4 does not point at /check, so the line renders before any check.
      expect(stepLine(html)).toEqual(["/home#ideas-title", "Today's step: Try one of today's ideas and see how it reads."]);
      expect(heroEyebrow(html)).toBe("Meal check");
    });

    it(`${who}: the ideas list precedes the hero, and the eyebrow precedes both`, async () => {
      const html = await render("1", { week: { startedDaysAgo: 0 } });
      expect(html.indexOf('data-testid="orientation-day"')).toBeGreaterThan(-1);
      expect(html.indexOf('data-testid="orientation-day"')).toBeLessThan(html.indexOf('data-testid="ideas-block"'));
      expect(html.indexOf('data-testid="ideas-block"')).toBeLessThan(html.indexOf('class="meal-hero"'));
    });

    it(`${who}: a check-step day before the first check — no step line, the eyebrow still reads the day, the hero names the step (A-79)`, async () => {
      const html = await render("1", { week: { startedDaysAgo: 1 } });
      expect(dayOf(html)).toBe("2");
      expect(html).not.toContain('data-testid="next-action"');
      expect(heroEyebrow(html)).toBe("Today's step · Meal check");
    });

    it(`${who}: after the first check the check step becomes the line, and the first-win block steps aside (A-89)`, async () => {
      const html = await render("1", { week: { startedDaysAgo: 1 }, checkToday: true });
      expect(dayOf(html)).toBe("2");
      expect(stepLine(html)).toEqual(["/check", "Today's step: Describe a meal you already ate and read its label."]);
      expect(heroEyebrow(html)).toBe("Meal check");
      expect(html).not.toContain("first-win");
    });

    it(`${who}: no start yet and a profile younger than seven days ⇒ day 1 (A-66)`, async () => {
      const html = await render("1", { onboardedDaysAgo: 6 });
      expect(dayOf(html)).toBe("1");
      expect(stepLine(html)?.[1]).toBe("Today's step: Read what the words on a result mean, in general terms.");
    });

    it(`${who}: no start and an older profile, or no profile at all ⇒ no week, and the classic owner rule`, async () => {
      for (const seed of [{ onboardedDaysAgo: 7 }, {}] satisfies Seed[]) {
        storage.clear();
        const html = await render("1", seed);
        expect(dayOf(html)).toBeNull();
        expect(html).not.toContain("orientation-day");
        // No week ⇒ the <h1> falls back to the date, untagged (F-30/F-35).
        expect(html).toContain(
          '<h1 class="dash-greet-date dash-greet-date--eyebrow">Tuesday, September 15</h1>'
        );
        // Door open, no week, no check yet: the hero is the action (owner rule 2026-08-11).
        expect(html).not.toContain('data-testid="next-action"');
        expect(heroEyebrow(html)).toBe("Meal check");
      }
    });

    it(`${who}: a dismissed week or a finished one shows no eyebrow; the classic line and the first-win block return`, async () => {
      for (const week of [
        { startedDaysAgo: 1, dismissed: true },
        { startedDaysAgo: 8 },
        { startedDaysAgo: 1, done: ["1", "2", "3", "4", "5", "6", "7"] }
      ]) {
        storage.clear();
        const html = await render("1", { week, checkToday: true });
        expect(dayOf(html)).toBeNull();
        expect(stepLine(html)).toEqual(["/meals", "Today's check suggested a step — did it happen?"]);
        expect(html).toContain('class="first-win"');
      }
    });

    it(`${who}: a step-5 day points the line into /learn/first-week (the route Task 3.6 adds)`, async () => {
      const html = await render("1", { week: { startedDaysAgo: 4, done: ["1", "2", "3", "4"] } });
      expect(dayOf(html)).toBe("5");
      expect(stepLine(html)).toEqual([
        "/learn/first-week#note",
        "Today's step: Write down the questions you have for your clinician."
      ]);
    });

    it(`${who}: a surface list without orient opens no week`, async () => {
      const html = await render("ideas,source", { week: { startedDaysAgo: 1 } });
      expect(html).not.toContain("orientation-day");
      expect(heroEyebrow(html)).toBe("Meal check");
    });
  }

  it("guest: nothing is read from the device before hydration", async () => {
    const html = await renderGuest("1", { week: { startedDaysAgo: 1 } }, false);
    expect(html).not.toContain("orientation-day");
  });

  it("signed-in: the ONE profile query adds onboardedAt and orientation (A-21)", async () => {
    await renderSignedIn("1", { onboardedDaysAgo: 2 });
    const profileSelects = home.selects.filter((shape) => "timezone" in shape);
    expect(profileSelects).toHaveLength(1);
    expect(Object.keys(profileSelects[0]!)).toEqual(["timezone", "onboardedAt", "orientation"]);
  });

  it("signed-in: an unreadable orientation value falls back to the empty state (A-24)", async () => {
    const young = await renderSignedIn("1", { onboardedDaysAgo: 2, rawOrientation: { done: ["9"], note: "x" } });
    expect(dayOf(young)).toBe("1");
    const old = await renderSignedIn("1", { onboardedDaysAgo: 30, rawOrientation: "garbage" });
    expect(dayOf(old)).toBeNull();
  });

  it("signed-in: the sync is mounted only while there is something to send; a migrated row turns `migrate` off, so a refresh cannot loop (F-34)", async () => {
    const { OrientationSync } = await import("../../../components/orientation-sync");
    const syncProps = async (seed: Seed) => {
      vi.stubEnv("NEXT_PUBLIC_GUIDE_DOOR", "1");
      seedServer(seed);
      const { default: HomePage } = await import("../../../app/(app)/home/page");
      const [sync] = (await HomePage()).props.children as [
        { type: unknown; props: Record<string, unknown> } | null,
        unknown
      ];
      if (sync) expect(sync.type).toBe(OrientationSync);
      return sync?.props ?? null;
    };
    // Before: the server copy is null.
    expect(await syncProps({ onboardedDaysAgo: 2 })).toEqual({ migrate: true, start: true });
    expect(await syncProps({ onboardedDaysAgo: 30 })).toEqual({ migrate: true, start: false });
    // After a migration write the copy is non-null: the refreshed page drops `migrate`.
    expect(await syncProps({ onboardedDaysAgo: 2, week: { startedDaysAgo: 3, done: ["1"] } })).toBeNull();
    expect(await syncProps({ onboardedDaysAgo: 30, week: { done: ["1"] } })).toBeNull();
    // A replayed row with no start yet only asks for the start — which can never refresh.
    expect(await syncProps({ onboardedDaysAgo: 2, week: { done: ["1"] } })).toEqual({ migrate: false, start: true });
    // Door shut: never mounted.
    vi.stubEnv("NEXT_PUBLIC_GUIDE_DOOR", "");
    seedServer({ onboardedDaysAgo: 2 });
    const { default: HomePage } = await import("../../../app/(app)/home/page");
    expect((await HomePage()).props.children[0]).toBeNull();
  });

  it("signed-in: a day-7 week hands DashboardView a step-7 line carrying its id, which picks the step link (F-54); door shut, no id", async () => {
    const lineOf = async (flag: string, seed: Seed) => {
      vi.stubEnv("NEXT_PUBLIC_GUIDE_DOOR", flag);
      seedServer(seed);
      const { default: HomePage } = await import("../../../app/(app)/home/page");
      const [, view] = (await HomePage()).props.children as [unknown, { props: { data: DashboardData } }];
      return view.props.data.nextAction;
    };
    expect(await lineOf("1", { onboardedDaysAgo: 40, week: { startedDaysAgo: 6 } })).toEqual({
      text: "Today's step: Look back at the week on My journey.",
      href: "/journey",
      step: "7"
    });
    // Door shut, a check today: the classic line, with no step id at all.
    const classic = await lineOf("", { onboardedDaysAgo: 40, week: { startedDaysAgo: 6 }, checkToday: true });
    expect(classic).toEqual({ text: "Today's check suggested a step — did it happen?", href: "/meals" });
    expect(Object.keys(classic ?? {})).toEqual(["text", "href"]);
  });

  it("signed-in: no profiles row ⇒ no week, however the device looks (A-92)", async () => {
    storage.setItem("pal.orient.v1", JSON.stringify(orientationOf({ startedDaysAgo: 1 })));
    vi.stubEnv("NEXT_PUBLIC_GUIDE_DOOR", "1");
    home.profile = undefined;
    home.checks = [];
    const { default: HomePage } = await import("../../../app/(app)/home/page");
    const html = renderToStaticMarkup(await HomePage());
    expect(html).not.toContain("orientation-day");
  });
});

// ---------------------------------------------------------------------------
// A-83 (plan Task 3.4): an expired-taster guest's line is the sign-in line,
// guest Home only — components/guest-dashboard.tsx, buildData.
// ---------------------------------------------------------------------------

describe("A-83: an expired-taster guest's step line asks them to sign in (Task 3.4)", () => {
  beforeEach(() => {
    storage.clear();
    home.selects = [];
    vi.stubEnv("TZ", "America/New_York");
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  // NOW is noon 2026-09-15 in America/New_York; tasterStore keys off the
  // device's LOCAL day, so a firstDay of the day before reads "expired".
  const expireTaster = () =>
    storage.setItem("pal.taster.v1", JSON.stringify({ firstDay: "2026-09-14", used: 3 }));
  const availableTaster = () =>
    storage.setItem("pal.taster.v1", JSON.stringify({ firstDay: "2026-09-15", used: 3 }));

  it('a non-check step day: the sign-in line replaces "Today\'s step: …", no prefix', async () => {
    expireTaster();
    // day 4, step 4 -> /home#ideas-title; without the expired taster this is
    // the ordinary "Today's step: Try one of today's ideas…" line (see the
    // Task 3.5 block above).
    const html = await renderGuest("1", { week: { startedDaysAgo: 3 } });
    expect(stepLine(html)).toEqual(["/signin", "Sign in to keep your week going"]);
  });

  it("a check-step day before the first check: the sign-in line shows even though the owner-rule /check carve-out would otherwise suppress the line entirely (A-79)", async () => {
    expireTaster();
    // day 2, step 2 -> /check, no check yet: normally no next-action line at
    // all (owner rule 2026-08-11) and the hero reads "Today's step · Meal
    // check". The sign-in line is not one of the seven steps, so the
    // carve-out does not apply to it and the hero falls back to plain
    // "Meal check".
    const html = await renderGuest("1", { week: { startedDaysAgo: 1 } });
    expect(stepLine(html)).toEqual(["/signin", "Sign in to keep your week going"]);
    expect(heroEyebrow(html)).toBe("Meal check");
  });

  it("taster available: the normal Today's step line is unchanged", async () => {
    availableTaster();
    const html = await renderGuest("1", { week: { startedDaysAgo: 3 } });
    expect(stepLine(html)).toEqual([
      "/home#ideas-title",
      "Today's step: Try one of today's ideas and see how it reads."
    ]);
  });

  it("no week (door open, old profile): the classic owner-rule branch runs even with an expired taster — no sign-in line", async () => {
    expireTaster();
    const html = await renderGuest("1", { onboardedDaysAgo: 30 });
    expect(html).not.toContain("orientation-day");
    expect(html).not.toContain('data-testid="next-action"');
    expect(html).not.toContain("Sign in to keep your week going");
    expect(heroEyebrow(html)).toBe("Meal check");
  });

  it("door shut: an expired taster with a device week gets neither the sign-in line nor the day line (the flag-off snapshots pin the rest)", async () => {
    expireTaster();
    const html = await renderGuest("", { week: { startedDaysAgo: 3 } });
    expect(html).not.toContain("Sign in to keep your week going");
    expect(html).not.toContain("orientation-day");
  });
});
