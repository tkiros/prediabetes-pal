import fs from "node:fs";
import path from "node:path";

import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { doorFor } from "../../../lib/client/home-door";

// Node has no app router: the hero and GuideIdeas call useRouter, the step
// line renders next/link. Same stand-ins as guide-door.test.ts.
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

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), "utf8");

describe("doorFor (PRD v1.1 §7.5)", () => {
  it.each([
    [null, "ideas"],
    [{ pains: [], win: null }, "ideas"],
    [{ pains: ["food", "number"], win: null }, "ideas"],
    [{ pains: ["number"], win: "explanation" }, "numbers"],
    [{ pains: ["effort", "food"], win: null }, "numbers"],
    [{ pains: ["plan"], win: "steps" }, "plan"],
    [{ pains: ["clinician"], win: null }, "plan"],
    [{ pains: ["worried"], win: "peace" }, "worried"],
    [{ pains: ["other"], win: "unsure" }, "ideas"]
  ] as const)("%j → %s (first pick decides)", (ask, door) => {
    expect(doorFor(ask as never)).toBe(door);
  });
});

describe("doorLayout — the four orders as amended by R-19 and R-20", () => {
  it.each([
    // door, orientationDay, hasStep → order, rows, heading
    ["ideas", 2, true, "ideas hero quickRow step", 3, undefined],
    ["ideas", null, false, "ideas hero quickRow step", 3, undefined],
    ["numbers", 1, true, "step ideas hero quickRow", 2, "Ideas for later"],
    ["numbers", 2, false, "ideas hero quickRow step", 3, undefined],
    ["numbers", null, false, "ideas hero quickRow step", 3, undefined],
    ["plan", 1, true, "step ideas hero quickRow", 2, undefined],
    ["plan", null, false, "ideas hero quickRow step", 3, undefined],
    ["worried", 1, true, "line ideas hero quickRow step", 2, undefined],
    ["worried", 3, false, "line ideas hero quickRow step", 2, undefined],
    // A-88: after day 3 the line drops below the step line, and R-20 gives
    // the third row back. R-19: no week running counts as past day 3.
    ["worried", 4, true, "ideas hero quickRow step line", 3, undefined],
    ["worried", null, false, "ideas hero quickRow step line", 3, undefined]
  ] as const)("%s, day %s, step %s → %s (%d rows)", async (door, day, hasStep, order, count, heading) => {
    const { doorLayout } = await import("../../../components/home-door");
    const layout = doorLayout(door, day, hasStep);
    expect(layout.order.join(" ")).toBe(order);
    expect(layout.count).toBe(count);
    expect(layout.heading).toBe(heading);
  });
});

describe("the worried door's clinician line", () => {
  it("is the disclaimer's second sentence, derived from BOUNDARY_DISCLAIMER, not retyped", async () => {
    const { CLINICIAN_LINE } = await import("../../../components/home-door");
    const { BOUNDARY_DISCLAIMER } = await import("../../../lib/pal/boundary-copy");
    expect(CLINICIAN_LINE.startsWith("Talk with a doctor")).toBe(true);
    expect(BOUNDARY_DISCLAIMER.endsWith(` ${CLINICIAN_LINE}`)).toBe(true);
    expect(read("components/home-door.tsx")).not.toContain("registered dietitian");
  });
});

describe("HomeDoor renders the default order on the server (no hydration mismatch)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("server markup is the default door even with a non-default pick on the device", async () => {
    // A worried pick in storage must not reach the server render: the
    // server snapshot is the default door, and getSnapshot (which reads
    // `document` and storage) never runs there — node has no `document`.
    vi.stubGlobal("window", {
      localStorage: { getItem: () => JSON.stringify({ pains: ["worried"], win: null }) }
    });
    vi.stubEnv("NEXT_PUBLIC_GUIDE_DOOR", "1");
    const { DashboardView } = await import("../../../components/dashboard-view");
    const html = renderToStaticMarkup(
      createElement(DashboardView, {
        data: {
          todayLabel: "Monday, September 14",
          weekSummary: "",
          showFirstWin: false,
          todayChecks: [],
          nextAction: { text: "Today's step: Read the words.", href: "/guides/x", step: "1" },
          planBox: { planName: "", meta: "", isFree: true, signedIn: false, attention: false },
          planBoxAttention: false,
          isDay0: true,
          orientationDay: 1
        }
      })
    );
    expect(html).toContain('class="home-door" data-door="ideas"');
    expect(html).not.toContain("home-door-line");
    const at = (needle: string) => {
      const index = html.indexOf(needle);
      expect(index, needle).toBeGreaterThan(-1);
      return index;
    };
    const order = [
      at('data-testid="ideas-block"'),
      at('data-testid="dash-check-cta"'),
      at('aria-label="Quick actions"'),
      at('data-testid="next-action"')
    ];
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    // Three skeleton rows before hydration — the default door's count.
    expect(html.match(/idea-row--skeleton/g)).toHaveLength(3);
  });

  it("the server snapshot is the default door, by source", () => {
    expect(read("components/home-door.tsx")).toMatch(/\(\) => "ideas" as Door\s*\);/);
  });

  it("focus inside the region at decision time keeps the default door, frozen once (A-55)", () => {
    expect(read("components/home-door.tsx")).toMatch(
      /frozen\.current \?\?= regionRef\.current\?\.contains\(document\.activeElement\)\s*\?\s*"ideas"\s*:\s*doorFor\(askStore\.get\(\)\)/
    );
  });
});

describe("no remount: GuideIdeas takes count/heading at render, HomeDoor keeps its key (R-18)", () => {
  const ideasSrc = read("components/guide-ideas.tsx");
  const doorSrc = read("components/home-door.tsx");

  it("the mount effect (rotation + ideas_shown) depends on [hydrated, full] only", () => {
    const rotation = ideasSrc.indexOf("nextIdeasRotation()");
    const effectStart = ideasSrc.lastIndexOf("useEffect(() => {", rotation);
    const deps = /\n {2}\}, \[([^\]]*)\]\);/.exec(ideasSrc.slice(effectStart));
    expect(deps?.[1]).toBe("hydrated, full");
    const body = ideasSrc.slice(effectStart, effectStart + (deps?.index ?? 0));
    expect(body).toContain("shownRef.current");
    expect(body).toContain('track({ name: "ideas_shown"');
    expect(body).not.toMatch(/\bcount\b(?!: 3)|\bheadingText\b/);
  });

  it("count slices the collapsed view only; the expanded view is the whole bank", () => {
    expect(ideasSrc).toContain("ideas={expanded ? view.allIdeas : view.ideas.slice(0, count)}");
  });

  it("the ideas element is always cloned with the same key, whatever the door", () => {
    expect(doorSrc).toContain('cloneElement(ideas, { key: "ideas", count, heading })');
    // One region, one keyed array — never a wrapper per door.
    expect(doorSrc).toContain("{order.map((key) => slots[key])}");
  });

  it("no CSS transition on the reorder", () => {
    const css = read("app/globals.css");
    const rule = css.slice(css.indexOf(".home-door {"), css.indexOf("}", css.indexOf(".home-door {")));
    expect(rule).toContain("display: contents");
    expect(rule).not.toMatch(/transition|animation/);
    // No inline style and no motion declared by the component itself.
    expect(doorSrc).not.toMatch(/style=|transition:|animation:/);
  });

  it("GuideIdeas honours count and heading in its server render (skeleton rows, title)", async () => {
    vi.stubEnv("NEXT_PUBLIC_GUIDE_DOOR", "ideas,ideas-full");
    try {
      const { GuideIdeas } = await import("../../../components/guide-ideas");
      const html = renderToStaticMarkup(
        createElement(GuideIdeas, { count: 2, heading: "Ideas for later" })
      );
      expect(html.match(/idea-row--skeleton/g)).toHaveLength(2);
      expect(html).toContain('id="ideas-title">Ideas for later</h2>');
      const plain = renderToStaticMarkup(createElement(GuideIdeas));
      expect(plain.match(/idea-row--skeleton/g)).toHaveLength(3);
      expect(plain).toContain('id="ideas-title">Ideas for today</h2>');
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
