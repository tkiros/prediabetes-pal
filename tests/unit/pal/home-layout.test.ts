import fs from "node:fs";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Task 5.1: the Home quick-action row. Task 5.2 extends this file with its
 * own `describe` blocks rather than a new one — see the task-5.1 brief and
 * report (`.superpowers/sdd/2026-09-13-guide-redesign/`).
 *
 * The suite runs under `environment: "node"` (vitest.config.ts) — no DOM.
 * Component behavior is pinned at source level (the pattern
 * tests/unit/pal/guide-door.test.ts already uses), plus one real,
 * DOM-free behavioral test of the CustomEvent contract in
 * lib/client/ideas-expand.ts, which needs no DOM: Node ships a native
 * EventTarget/CustomEvent.
 */
// Same shim guide-door.test.ts uses for GuideIdeas — top-level so vitest's
// mock hoist applies before the component import runs.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push() {} })
}));
vi.mock("../../../lib/client/use-hydrated", () => ({ useHydrated: () => false }));

const ROOT = process.cwd();
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), "utf8");

describe("home-quick-row.tsx — four pinned actions, quiet, client (Task 5.1)", () => {
  const src = read("components/home-quick-row.tsx");
  // Fix round 2 (I1): every pin below reads `body`, not `src` — the reviewer
  // proved that a pin matching anywhere in the file (an import line, a doc
  // comment) is satisfied whether or not the JSX itself is right. Cutting at
  // the component's own `export function` is the same trick the hrefs pin
  // already used; the icon and dispatch pins below now use it too.
  const body = src.slice(src.indexOf("export function HomeQuickRow"));

  it('is a client component ("use client" — the Task card overrules the brief\'s "server-safe")', () => {
    expect(src.trimStart().startsWith('"use client";')).toBe(true);
  });

  it("carries exactly four hrefs, in order: #ideas-title, /check, /learn, /journey", () => {
    // Learn renders through <LearnLink>, not a bare <Link> (fix round 1), so
    // both tags count.
    const hrefs = [...body.matchAll(/<(?:Link|LearnLink)\s[^>]*\bhref="([^"]+)"/g)].map((m) => m[1]);
    expect(hrefs).toEqual(["#ideas-title", "/check", "/learn", "/journey"]);
  });

  it('never renders a `quick-action--accent` — no third fill (review A-74, DESIGN.md §8)', () => {
    expect(src).not.toContain("quick-action--accent");
    expect(read("app/globals.css")).not.toContain("quick-action--accent");
  });

  it('carries `aria-label="Quick actions"`', () => {
    expect(body).toMatch(/<nav[^>]*\baria-label="Quick actions"/);
  });

  it("each item's icon sits directly inside its own link, not just named somewhere in the file (fix round 2, I1)", () => {
    // These are the exact regexes the reviewer verified DO go red on an
    // icon swap — see the fix-round-2 report entry for the red-then-green
    // evidence (temporarily swapped IconLeaf/IconCheckCircle in the JSX,
    // confirmed this test failed, reverted).
    expect(body).toMatch(/<Link href="#ideas-title"[^>]*>\s*<IconLeaf\b/);
    expect(body).toMatch(/<Link href="\/check"[^>]*>\s*<IconCheckCircle\b/);
    expect(body).toMatch(/<LearnLink href="\/learn"[^>]*>\s*<IconBook\b/);
    expect(body).toMatch(/<Link href="\/journey"[^>]*>\s*<IconCompass\b/);
  });

  it("the row's Journey icon matches the shell tab bar's own icon for /journey, and never reuses its /meals icon — one glyph, one meaning, checked against the cut JSX (fix round 1/2)", () => {
    const navSrc = read("components/app-nav.tsx");
    const navJourneyIcon = navSrc.match(/href:\s*"\/journey"[^}]*icon:\s*(Icon\w+)/)?.[1];
    const navMealsIcon = navSrc.match(/href:\s*"\/meals"[^}]*icon:\s*(Icon\w+)/)?.[1];
    expect(navJourneyIcon).toBe("IconCompass");
    expect(navMealsIcon).toBe("IconBookmark");
    expect(body).toMatch(new RegExp(`<Link href="/journey"[^>]*>\\s*<${navJourneyIcon}\\b`));
    expect(body).not.toContain(navMealsIcon!);
  });

  it("the Ideas item's own onClick — not just an import — dispatches the See-all CustomEvent; no scroll code anywhere (fix round 2, M1)", () => {
    expect(body).toMatch(/<Link href="#ideas-title"[^>]*\bonClick=\{dispatchIdeasExpand\}/);
    expect(src).not.toMatch(/scrollIntoView|scrollTo/);
  });

  it("Learn renders through <LearnLink from=\"home\"> — the one place that reports learn_opened (ruling F-38, fix round 1)", () => {
    // No second inline tracker here — LearnLink (components/learn-link.tsx)
    // already emits { page: learnPage(href), from } on its own onClick.
    expect(src).not.toContain("learn_opened");
    expect(src).not.toMatch(/from\s+["'].*\/analytics["']/);
    expect(src).toMatch(/from\s+["'].*learn-link["']/);
    expect(body).toMatch(/<LearnLink\s+href="\/learn"\s+from="home"\s+className="quick-action">/);
  });

  it("LearnLink accepts the optional className this row needs", () => {
    const learnLinkSrc = read("components/learn-link.tsx");
    expect(learnLinkSrc).toMatch(/className\?:\s*string/);
  });
});

describe(".quick-row / .quick-action (app/globals.css) — real 44px+ targets, no fill", () => {
  const css = read("app/globals.css");

  function rule(selector: string): string {
    const start = css.indexOf(`${selector} {`);
    expect(start, selector).toBeGreaterThan(-1);
    const end = css.indexOf("}", start);
    return css.slice(start, end);
  }

  it(".quick-row lays out four equal columns", () => {
    expect(rule(".quick-row")).toMatch(/grid-template-columns:\s*repeat\(4,\s*1fr\)/);
  });

  it(".quick-action is a real ≥44px target — no negative-margin or ::before hit-area trick (DESIGN.md §5)", () => {
    const block = rule(".quick-action");
    const minHeight = block.match(/min-height:\s*([\d.]+)px/);
    expect(minHeight).not.toBeNull();
    expect(Number(minHeight![1])).toBeGreaterThanOrEqual(44);
    expect(css).not.toMatch(/\.quick-action[^{]*::before/);
    expect(block).not.toMatch(/margin:\s*-/);
  });

  it(".quick-action declares no accent background — quiet by construction", () => {
    expect(rule(".quick-action")).not.toMatch(/background:\s*var\(--accent/);
  });
});

describe("dashboard-view.tsx — HomeQuickRow gated by guideDoorEnabled(\"home\"), source order pinned (A-54)", () => {
  const src = read("components/dashboard-view.tsx");

  it('imports HomeQuickRow and gates it on guideDoorEnabled("home")', () => {
    expect(src).toMatch(/from\s+["'].*home-quick-row["']/);
    expect(src).toMatch(/homeOn\s*=\s*guideDoorEnabled\(\s*["']home["']\s*\)/);
    expect(src).toContain("homeOn ? <HomeQuickRow");
  });

  it("renders between the hero and the next-action line, and after GuideIdeas — full order pin", () => {
    const at = (needle: string) => {
      const index = src.indexOf(needle);
      expect(index, needle).toBeGreaterThan(-1);
      return index;
    };
    const ideasIndex = at("<GuideIdeas");
    const heroIndex = at("<HomeCheckHero");
    const rowIndex = at("<HomeQuickRow");
    const nextActionIndex = at('"dash-next-action"');
    const todayIndex = at('aria-label="Today"');
    expect(ideasIndex).toBeLessThan(heroIndex);
    expect(heroIndex).toBeLessThan(rowIndex);
    expect(rowIndex).toBeLessThan(nextActionIndex);
    expect(nextActionIndex).toBeLessThan(todayIndex);
  });
});

describe("lib/client/ideas-expand.ts — the See-all CustomEvent contract (R-2)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("dispatching the event always calls the listener's onExpand — one event name, defined once", async () => {
    vi.stubGlobal("window", new EventTarget());
    const mod = await import("../../../lib/client/ideas-expand");
    let calls = 0;
    const stop = mod.listenForIdeasExpand(() => {
      calls += 1;
    });

    mod.dispatchIdeasExpand();
    expect(calls).toBe(1);

    // Tapping Ideas twice: the handler fires again — this only proves the
    // event bus re-delivers on every dispatch. Expand-only (never a toggle)
    // is pinned separately, on the guide-ideas.tsx source below.
    mod.dispatchIdeasExpand();
    expect(calls).toBe(2);

    stop();
    mod.dispatchIdeasExpand();
    expect(calls).toBe(2); // cleanup removed the listener
  });

  it("uses one exported event name, not a magic string duplicated elsewhere", async () => {
    const mod = await import("../../../lib/client/ideas-expand");
    expect(typeof mod.IDEAS_EXPAND_EVENT).toBe("string");
    const guideIdeasSrc = read("components/guide-ideas.tsx");
    const quickRowSrc = read("components/home-quick-row.tsx");
    // guide-ideas.tsx listens via the helper; home-quick-row.tsx dispatches
    // via the helper — neither hardcodes the event-name string itself.
    expect(guideIdeasSrc).not.toContain(`"${mod.IDEAS_EXPAND_EVENT}"`);
    expect(quickRowSrc).not.toContain(`"${mod.IDEAS_EXPAND_EVENT}"`);
  });
});

describe("guide-ideas.tsx — the See-all listener expands only, never toggles, and adds no markup", () => {
  const src = read("components/guide-ideas.tsx");
  const componentSrc = src.slice(src.indexOf("export function GuideIdeas"));

  it("imports the shared listener from lib/client/ideas-expand", () => {
    expect(src).toMatch(/from\s+["'].*ideas-expand["']/);
  });

  it("registers the listener only under ideas-full, and expands (never toggles) on it", () => {
    expect(componentSrc).toMatch(/if \(!full\) return;\s*\n\s*return listenForIdeasExpand\(\(\) => setExpanded\(true\)\);/);
    // The ONLY toggle in the file is the "See all" button's own click handler.
    expect(src.match(/setExpanded\(\(current\) => !current\)/g)).toHaveLength(1);
    expect(src.match(/setExpanded\(true\)/g)).toHaveLength(1);
  });
});

// Fix round 2 (M2): a "hook sits before return(" source check and a
// renderToStaticMarkup render of <GuideIdeas> (SSR never runs effects, so
// the listener can't appear in that markup either way) both used to sit
// here. Neither could fail if the listener were deleted outright, so they
// proved nothing and are gone. The real evidence that the ideas-only and
// flag-off renders are untouched is that tests/unit/pal/guide-door.test.ts's
// own byte-for-byte DashboardView/GuideIdeas pins still pass unchanged.
