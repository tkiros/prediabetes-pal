import fs from "node:fs";
import path from "node:path";

import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

// Same app-router shim copy-pins.test.ts uses — the rendered-output pins below
// only need anchor text, not real routing.
vi.mock("next/link", async () => {
  const { createElement } = await import("react");
  return {
    default: ({ href, children }: { href?: unknown; children?: ReactNode }) =>
      createElement(
        "a",
        { href: typeof href === "string" ? href : undefined },
        children
      )
  };
});

const ROOT = process.cwd();
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), "utf8");

afterEach(() => {
  vi.unstubAllEnvs();
});

async function renderLanding(env: Record<string, string> = {}): Promise<string> {
  vi.stubEnv("PAYWALL_MODE", "trial");
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
  const page = await import("../../../app/page");
  return renderToStaticMarkup(page.default());
}

const text = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");

/**
 * Landing wiring pins — the invariants the 2026-07-28 ship coverage audit
 * found unguarded. Two families:
 *
 *  1. FONT WIRING (FINDING-030). reading.className on the landing root is the
 *     SOLE source of the landing body face — the var-based CSS fallback was
 *     deliberately removed (a failed var cascade must not be able to pick a
 *     font). The font-google stub renders distinguishable markers so a deleted
 *     className goes red here instead of only in a production browser.
 *
 *  2. FOOTER PROMISES. The nav collapses below 640px and the footer is the
 *     fallback, so it must never carry an inert store line.
 *
 * Two families were retired here on 2026-08-05 with the blocks they pinned.
 * FLAG BRANCHES pinned the how-it-works step list, and FEATURE-CARD SET pinned
 * the feature grid; both blocks are deleted. The journey flag's branch coverage
 * moved to tests/unit/client/journey-card-flag.test.ts — the surface that
 * actually ships it — BEFORE the deletion, not after.
 */

describe("landing font wiring (FINDING-030)", () => {
  it("the landing root carries the reading-face className", async () => {
    const html = await renderLanding();
    expect(html).toMatch(/<main[^>]*class="[^"]*__stub_source_sans_3[^"]*"/);
  });

  it("layout puts the brand className on <body> and its variable on <html>", () => {
    // RootLayout drags in next/script + client components, so it is pinned at
    // source level. sans.className on <body> is LOAD-BEARING: globals.css's
    // `body { font: inherit }` reset kills the elemental body font rule, so
    // deleting this class drops the app to the UA default face (FINDING-030).
    // reading is deliberately ABSENT here — it ships with the landing route
    // only (app/page.tsx), not with every app route.
    const src = read("app/layout.tsx");
    expect(src).toMatch(/<html[^>]*className=\{sans\.variable\}/);
    expect(src).toMatch(/<body className=\{sans\.className\}/);
    expect(src).not.toMatch(/reading\.(className|variable)/);
  });

  it("the reading face loads 700 — globals.css caps .landing .result-title at it", () => {
    // .landing .result-title { font-weight: 700 } exists BECAUSE Source Sans 3
    // ships 400/600/700 and nothing heavier. If either side moves, move both.
    const fonts = read("app/fonts.ts");
    const readingBlock = fonts.slice(fonts.indexOf("Source_Sans_3"));
    expect(readingBlock).toContain('"700"');

    // Match the rule's whole body rather than its first declaration: the
    // property order inside the block is not the contract, the weight is.
    const rule = read("app/globals.css").match(
      /\.landing \.result-title \{([^}]*)\}/
    );
    expect(rule?.[1]).toContain("font-weight: 700;");

    // Hierarchy cap: the app's 28px .result-title outranked the .landing-h2
    // above it at narrow widths (25.6px at 375px). Keep the landing card title
    // subordinate to the section heading that introduces it.
    expect(rule?.[1]).toContain("font-size: 22px;");
  });

  it("no landing selector declares font-size twice", () => {
    // The 2026-07-27 legibility pass originally shipped as a block APPENDED
    // after the landing rules, so ~26 selectors carried two competing
    // font-size declarations and only source order decided which won. That is
    // invisible until someone reorders the file, and it had already silently
    // defeated .landing-cta--sm (the nav pill rendered 17px, not 15px). The
    // values now live in the base rules; this fails if a second declaration
    // for the same landing selector creeps back in.
    const css = read("app/globals.css");
    const seen = new Map<string, number>();

    for (const [, selector, body] of css.matchAll(
      /(^|\n)([^@{}\n][^{}]*)\{([^}]*)\}/g
    )) {
      const sel = selector.trim();
      // Landing element rules only. Media-query and pseudo-state blocks are
      // legitimate overrides of a base value, not accidental duplicates.
      if (!sel.startsWith(".landing")) continue;
      if (sel.includes(":") || sel.includes("@")) continue;
      if (!/font-size:/.test(body)) continue;
      for (const one of sel.split(",").map((s) => s.trim())) {
        seen.set(one, (seen.get(one) ?? 0) + 1);
      }
    }

    const duplicated = [...seen.entries()]
      .filter(([, n]) => n > 1)
      .map(([sel, n]) => `${sel} (${n}x)`);

    expect(duplicated).toEqual([]);
  });
});

describe("footer apps column never renders an inert promise", () => {
  // Pin the exact inert store strings, not the bare phrase "coming soon":
  // that phrase used to false-positive on the what-you-get lede, and pinning
  // the real strings is what a reader of the footer would actually see.
  it("no waitlist configured: the true today-story, no inert store lines", async () => {
    const t = text(await renderLanding());
    expect(t).toContain("Add to home screen — works today");
    expect(t).not.toContain("Google Play — coming soon");
    expect(t).not.toContain("App Store — coming soon");
    expect(t).not.toContain("join the waitlist");
  });

  it("waitlist configured: store links render as real links", async () => {
    const html = await renderLanding({
      NEXT_PUBLIC_WAITLIST_URL: "https://example.com/waitlist"
    });
    expect(html).toContain('href="https://example.com/waitlist?platform=android"');
    expect(html).toContain('href="https://example.com/waitlist?platform=ios"');
    expect(text(html)).not.toContain("Google Play — coming soon");
    expect(text(html)).not.toContain("App Store — coming soon");
  });
});
