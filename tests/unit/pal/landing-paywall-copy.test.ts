import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const src = fs.readFileSync(
  path.join(process.cwd(), "app/page.tsx"),
  "utf8"
);

/**
 * §0.2 #4 — landing copy vs live config.
 *
 * The rule is that the landing can never promise a price or a payment step
 * the deploy doesn't actually run. Until 2026-08-05 this page discharged it
 * by RENDERING the pricing section from the same server flags checkout
 * enforces, and these pins asserted that mechanism was wired up.
 *
 * The owner then deleted the pricing section outright ("the price should not
 * be mentioned, only focus on free check"), which discharges the same rule
 * far more strongly: a page that names no amount cannot name a wrong one.
 * So these pins were INVERTED, not deleted — they now assert the absence.
 * Deleting them instead would have retired the guarantee along with the
 * section, and the guarantee is the part that has to survive.
 *
 * Runtime proof still lives in the two mode-pinned e2e servers
 * (billing-pages.spec.ts on legacy :3100, trial-wall.spec.ts on trial :3101),
 * which now assert no pricing section renders under either mode.
 */
describe("the landing names no price at all", () => {
  it("renders no amount, in any currency shape", () => {
    // The variant ladder is $9.99/$12.99/$19.99 and the annual pair is
    // $99.99/$8.33 (lib/server/pricing.ts). None of them, nor any other
    // amount, may appear here — as a literal or as an interpolation.
    expect(src).not.toMatch(/\$\d/);
    expect(src).not.toMatch(/\bmonthlyPrice\b/);
    expect(src).not.toMatch(/\bannualPrice\b/);
  });

  it("does not import the price resolvers it no longer needs", () => {
    // A live import is how the section grows back by accident: resolve a
    // price and something will eventually render it.
    expect(src).not.toMatch(/resolvePriceVariant/);
    expect(src).not.toMatch(/resolveAnnualPrice/);
  });

  it("renders no pricing section and no nav link to one", () => {
    // W9 shipped a dead #how-it-works fragment and nothing caught it. This
    // is the pin that would have. Both halves must go together: an anchor
    // with no target is the failure mode, either order.
    expect(src).not.toMatch(/id="pricing"/);
    expect(src).not.toMatch(/href="#pricing"/);
  });

  it("names no step of the paid ladder outside the FAQ", () => {
    // The tile copy, verbatim. If any of it reappears the section is back.
    expect(src).not.toContain("Days 2–8");
    expect(src).not.toContain("landing-price-what");
    expect(src).not.toContain("landing-price-tile");
  });
});

/**
 * The one surviving §0.2 #4 mechanism. "Do I need an account or a card to
 * try it?" has a genuinely different true answer per mode — under trial you
 * need a card on day 2, under legacy you never do — so this answer must stay
 * wired to the live flag even though it quotes no amount.
 */
describe("the FAQ's card answer still derives from the live paywall mode", () => {
  it("imports the mode from lib/server/pricing and branches on it", () => {
    expect(src).toMatch(
      /import\s*\{[^}]*paywallMode[^}]*\}\s*from\s*["'].*server\/pricing["']/
    );
    expect(src).toContain('paywallMode() === "trial"');
  });

  it("carries both branches so either mode answers truthfully", () => {
    // Trial branch: a card IS required after day 1, and the pre-charge email
    // is the promise that makes that acceptable.
    expect(src).toContain("The 7-day free trial needs a card");
    expect(src).toContain("we email you before any charge");
    // Legacy branch: no card, ever.
    expect(src).toContain("a free account includes");
    expect(src).toContain("still no card");
  });
});
