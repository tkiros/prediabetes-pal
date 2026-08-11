import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { showPantryEntry, upsellVariant } from "../../../components/result-card";

// Source-scan of the result-list JSX. The keep-most / swap / adjustment lines
// each render conditionally on their nullable field, so SAFE (where 7.2's
// derivation nulls keepMost/swap/adjustment) and a null keepMost skip the block
// exactly like the sibling lines — no jsdom harness needed to lock the shape.
const RESULT_CARD_SOURCE = fs.readFileSync(
  path.join(process.cwd(), "components/result-card.tsx"),
  "utf8"
);

// The upsell branch renders the server's `message` verbatim; it only branches
// its own eyebrow/CTA/data-wall on the server's structured `upsellKind`. The
// old "free week" message sniff survives only as the fallback for older or
// cached responses that omit the field. These tests lock the pure variant
// picker; the JSX renders `message` unchanged in both cases, so it needs no
// jsdom harness here.

// The real server strings (app/api/check/route.ts): the trial hard-wall body
// names "free week"; the legacy soft limit names "free checks".
const TRIAL_WALL_MESSAGE =
  "Your free taste of Prediabetes Pal was yesterday's checks. Start your free week — card required, unlimited everything, and we email you before any charge — to keep going.";
const FREE_LIMIT_MESSAGE =
  "You've used today's five free checks. Premium removes the daily limit and keeps your full history — or check back in with your first meal tomorrow.";

describe("upsellVariant", () => {
  it("renders the trial wall CTA for the structured trial kind", () => {
    expect(upsellVariant(TRIAL_WALL_MESSAGE, "trial")).toEqual({
      wall: "trial",
      eyebrow: "Where the free taste ends",
      title: null,
      cta: "Start your free week"
    });
  });

  it("keeps the legacy daily-limit copy for the structured legacy kind", () => {
    expect(upsellVariant(FREE_LIMIT_MESSAGE, "legacy")).toEqual({
      wall: null,
      eyebrow: "Daily limit reached",
      title: "That's five for today",
      cta: "See what Premium includes"
    });
  });

  it("the structured kind wins over whatever the message says", () => {
    expect(upsellVariant(TRIAL_WALL_MESSAGE, "legacy").wall).toBeNull();
    expect(upsellVariant(FREE_LIMIT_MESSAGE, "trial").wall).toBe("trial");
  });

  it("falls back to the 'free week' message sniff when the kind is absent", () => {
    expect(upsellVariant(TRIAL_WALL_MESSAGE).wall).toBe("trial");
    expect(upsellVariant(FREE_LIMIT_MESSAGE).wall).toBeNull();
    // "free checks" (legacy) must NOT read as the trial wall.
    expect(upsellVariant("free checks left today").wall).toBeNull();
    expect(upsellVariant("start your free week today").wall).toBe("trial");
  });

  it("pins the legacy title's number word to FREE_DAILY_CHECKS", async () => {
    const { FREE_DAILY_CHECKS } = await import(
      "../../../lib/server/entitlement"
    );
    const words = [
      "zero",
      "one",
      "two",
      "three",
      "four",
      "five",
      "six",
      "seven",
      "eight",
      "nine",
      "ten"
    ];
    expect(upsellVariant("", "legacy").title).toBe(
      `That's ${words[FREE_DAILY_CHECKS]} for today`
    );
  });
});

// §6.x "Enjoy it anyway" keep-most line. MODERATE/HIGH cards carry it (keepMost
// non-null); SAFE and null keepMost skip it, since the JSX guards on the field.
// Anatomy since 2026-07-19 (approved A+D+C composite): the most practical
// action (adjustment → swap → keepMost) LEADS the card as the permission-first
// headline; the Try list carries the remainder, keep-most before swap, then
// sequencing → post-meal.
describe("result-list keep-most line", () => {
  it("renders the keep-most enjoyment line, guarded by keepMost", () => {
    expect(RESULT_CARD_SOURCE).toContain('data-testid="keep-most"');
    expect(RESULT_CARD_SOURCE).toContain("Enjoy it anyway:");
    expect(RESULT_CARD_SOURCE).toContain("{response.keepMost}");
    // The block is conditional on the nullable field, so SAFE / null keepMost
    // (7.2 nulls it for SAFE + every non-result kind) render nothing.
    expect(RESULT_CARD_SOURCE).toMatch(/response\.keepMost\s*\?/);
  });

  it("leads with the practical action, permission-first", () => {
    // The lead chain: adjustment first (it is the meal-specific ask), then
    // swap, then the keep-most permission. SAFE (all three nulled by 7.2)
    // falls through to its own verdict label.
    expect(RESULT_CARD_SOURCE).toContain(
      "response.adjustment ?? response.swap ?? response.keepMost"
    );
    expect(RESULT_CARD_SOURCE).toContain("{lead ?? RISK_LABELS[response.risk]}");
    // Adjustment never renders as a list row — it is the headline. A
    // reintroduced "Adjustment:" row would duplicate the lead.
    expect(RESULT_CARD_SOURCE).not.toContain("<strong>Adjustment:</strong>");
  });

  it("orders keep-most before swap in the Try list", () => {
    const keepMostIdx = RESULT_CARD_SOURCE.indexOf('data-testid="keep-most"');
    const swapIdx = RESULT_CARD_SOURCE.indexOf("<strong>Swap:</strong>");
    expect(keepMostIdx).toBeGreaterThan(-1);
    expect(swapIdx).toBeGreaterThan(-1);
    expect(keepMostIdx).toBeLessThan(swapIdx);
  });
});

// §6.3 post-verdict pantry entry. The line attaches ONLY to non-SAFE results
// ("Be careful" / "Hold off") — SAFE never piles on, and non-result kinds
// (upsell/clarify/not_food/out_of_scope/retry) never render it. The pure
// predicate is the single gate the result branch reads; the JSX renders one
// fixed line + `/pantry` link when it returns true, so no jsdom harness is
// needed here.
describe("showPantryEntry", () => {
  it("shows the pantry entry on a MODERATE (Be careful) result", () => {
    expect(showPantryEntry("result", "MODERATE")).toBe(true);
  });

  it("shows the pantry entry on a HIGH (Hold off) result", () => {
    expect(showPantryEntry("result", "HIGH")).toBe(true);
  });

  it("never piles on a SAFE (Clear) result", () => {
    expect(showPantryEntry("result", "SAFE")).toBe(false);
  });

  it("never shows on the upsell/wall kind", () => {
    expect(showPantryEntry("upsell")).toBe(false);
  });

  it("never shows on non-result guidance kinds", () => {
    for (const kind of ["clarify", "not_food", "out_of_scope", "retry"] as const) {
      expect(showPantryEntry(kind)).toBe(false);
    }
  });
});
