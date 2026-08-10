import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), "utf8");

/**
 * Landing design guards — the five invariants the 2026-08-05 design & copy
 * tournament found holding on prose alone (DESIGN.md rails 9, 12, and §11,
 * §14). Every one of these passes on the tree that introduced it: they exist
 * to go red during the landing rebuild, not to describe a fix.
 *
 * Each guard reads SOURCE, deliberately. The failure mode they all share is
 * that a change can be visually plausible, ship green through every existing
 * gate, and still falsify something the page claims about itself.
 */

/**
 * GUARD 1 — the card recipe.
 *
 * The landing's central claim is "marketing shows the product's card,
 * unmodified". `promise-registry.test.ts` pins the demo card's STRINGS;
 * nothing pinned its RECIPE. A single `.landing-*` selector re-radiusing
 * `.result-card` makes the claim false while looking like an improvement.
 *
 * Scoped to the shape properties that carry the claim (DESIGN.md §5: the card
 * shadow is the only shadow in the system; §11: the radius is inherited).
 * Typography under `.landing .result-*` is a legitimate scale change and is
 * NOT caught here — `.landing .result-title` is a sanctioned example.
 */
describe("landing never overrides the product card's recipe", () => {
  it("no .landing selector declares border, radius or shadow on the card recipes", () => {
    const css = read("app/globals.css");
    const offenders: string[] = [];

    for (const [, , selector, body] of css.matchAll(
      /(^|\n)([^@{}\n][^{}]*)\{([^}]*)\}/g
    )) {
      const sel = selector.trim();
      if (!sel.includes(".landing")) continue;

      for (const one of sel.split(",").map((s) => s.trim())) {
        if (!one.includes(".landing")) continue;
        // The card recipes themselves, not their children. `.result-title`
        // and friends are separate elements on their own scale.
        if (!/\.(result-card|surface-card)\b(?![-\w])/.test(one)) continue;
        const shape = [...body.matchAll(/(^|;|\s)(border|border-radius|box-shadow)\s*:/g)];
        if (shape.length > 0) {
          offenders.push(`${one} { ${shape.map((m) => m[2]).join(", ")} }`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});

/**
 * GUARD 2 — the FAQ's shared array.
 *
 * The visible <details> list and the FAQPage JSON-LD `mainEntity` map the SAME
 * array, so a structured-data/visible mismatch — the thing Google penalises —
 * is impossible by construction rather than by review. Three tournament
 * contenders proposed "fixing" a mismatch they would each have INTRODUCED by
 * hand-authoring one of the two consumers.
 *
 * This invariant was guaranteed by a code comment until now.
 */
describe("the FAQ's visible list and its JSON-LD cannot diverge", () => {
  const src = read("app/page.tsx");

  it("declares faqs exactly once", () => {
    expect(src.match(/\bconst faqs\b/g) ?? []).toHaveLength(1);
  });

  it("both consumers map that same array, and neither hand-authors its own", () => {
    // One map for mainEntity, one for the rendered <details>. A third would be
    // fine; ZERO on either side is the failure — it means someone inlined a
    // literal list next to the array.
    expect((src.match(/faqs\.map\(/g) ?? []).length).toBeGreaterThanOrEqual(2);

    const mainEntity = src.match(/mainEntity:\s*([^\n]*)/);
    expect(mainEntity?.[1]).toContain("faqs.map(");

    // The visible list renders from the array inside JSX, not from a literal.
    expect(src).toMatch(/\{faqs\.map\(/);
  });
});

/**
 * GUARD 3 — touch targets (DESIGN.md rail 9).
 *
 * Prose-only until now: axe does not test target size at AA, so nothing in
 * either suite noticed if the global floor were deleted.
 */
describe("touch targets keep their floors", () => {
  const css = read("app/globals.css");

  it("every button, input and textarea carries the global 44px floor", () => {
    const rule = css.match(
      /button,\s*\n\s*input,\s*\n\s*textarea \{([^}]*min-height[^}]*)\}/
    );
    expect(rule?.[1]).toContain("min-height: 44px;");
  });

  // Raised 52 -> 56px on 2026-08-06 with the design file's button size. The
  // guard's job is that the marketing CTA stays comfortably above the 44px
  // global floor, not that it is any one number — but it must name the number
  // someone actually chose, so it moves with the CSS rather than being widened
  // to a range that would let the value drift back down unnoticed.
  it("the marketing CTA is 56px", () => {
    const rule = css.match(/\n\.landing-cta \{([^}]*)\}/);
    expect(rule?.[1]).toContain("min-height: 56px;");
  });
});

/**
 * GUARD 4 — reduced motion (DESIGN.md rail 12).
 *
 * Four @media blocks, zero coverage. This pins the global safety net only:
 * universal selector, both duration properties, !important so it outranks
 * component rules. A JS-driven reveal must ALSO gate in JS — the net can only
 * shorten what already started.
 */
describe("prefers-reduced-motion zeroes motion globally", () => {
  it("the universal reduce block exists and outranks component rules", () => {
    const css = read("app/globals.css");
    const block = css.match(
      /@media \(prefers-reduced-motion: reduce\) \{\s*\*,\s*\n\s*\*::before,\s*\n\s*\*::after \{([^}]*)\}/
    );

    expect(block, "the global reduce block is gone").toBeTruthy();
    expect(block?.[1]).toContain("animation-duration: 0.001ms !important;");
    expect(block?.[1]).toContain("transition-duration: 0.001ms !important;");
    expect(block?.[1]).toContain("animation-iteration-count: 1 !important;");
  });
});

/**
 * GUARD 5 — one CTA assembly (DESIGN.md §14).
 *
 * Five hand-built copies of the primary CTA had drifted into four shapes
 * before `LandingPrimaryCta` collapsed them. Nothing stopped a sixth.
 *
 * The invariant is not "one CTA on the page" — the ghost nav pill and the
 * Pantry link are legitimately separate. It is that the FILLED primary pill is
 * assembled in exactly one place.
 */
describe("the landing's primary CTA is assembled once", () => {
  const src = read("app/page.tsx");

  it("LandingPrimaryCta is the only place the filled pill is built", () => {
    expect(src.match(/function LandingPrimaryCta\b/g) ?? []).toHaveLength(1);

    // Every other `.landing-cta` in the file must carry a modifier. A bare
    // `className="landing-cta"` outside the component is a hand-built copy.
    const bare = [...src.matchAll(/className="landing-cta"/g)];
    expect(bare).toHaveLength(1);

    const componentStart = src.indexOf("function LandingPrimaryCta");
    const componentEnd = src.indexOf("export default function LandingPage");
    expect(bare[0].index).toBeGreaterThan(componentStart);
    expect(bare[0].index).toBeLessThan(componentEnd);
  });

  it("the CTA's copy is the approved ledger string, typed once", () => {
    // `copy-pins.test.ts` pins that this string renders. This pins that it is
    // written in ONE place, so a second copy cannot drift a word.
    expect(
      src.match(/Check your first meal — free/g) ?? []
    ).toHaveLength(1);
  });
});
