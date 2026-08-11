/**
 * The marketing surface's card: the product's own result card, rendered in the
 * live classes (DESIGN.md §11 — "the page's unit of composition is the
 * product's own artifact"). It is the same Meal / Signal / Why / Try anatomy
 * `components/result-card.tsx` renders on `/check`, minus the slots that only
 * make sense for a check that actually ran: no `aria-live` (nothing arrives),
 * no permission-first lead (nothing was computed), no feedback or save-to-
 * memory widgets (there is no `checkId`).
 *
 * Before this component the landing hand-built `.landing-verdict` articles —
 * tinted 24px boxes that borrowed the verdict colours without being the card.
 * That made the page's central claim ("marketing shows the product's card,
 * unmodified") false in the one place it is most load-bearing.
 *
 * ⚖️ 2026-08-06 — that claim NO LONGER HOLDS PAGE-WIDE, by owner ruling. The
 * design file draws §6's three answers as flat illustrations rather than as
 * the product's card, and the owner chose the design file over the claim. The
 * flat family is `LandingVerdictCard`, at the bottom of this file. It lives
 * HERE, beside `ExampleResultCard`, for one reason: both read `EXAMPLE_RESULTS`
 * above, so the illustration cannot drift from the real card's WORDS even
 * though it no longer shares its recipe. See DESIGN.md §11.
 *
 * ⛔ The three fixtures live HERE, not at the call sites. The hero card and
 * block 4's first card are byte-identical by construction — block 4's lede
 * says so in as many words ("The first card is the one from the top of this
 * page"), and two hand-typed copies would drift.
 *
 * ⛔ The SAFE fixture carries no adjustment and no swap. `postprocess.ts
 * assertNoUnsafeSafeFields` throws on a SAFE result that has either, so the
 * engine cannot produce one — the layout has to survive the empty slot, and
 * that survival is the argument the block exists to make.
 */
import type { PalRisk } from "../lib/client/ui-state";
import { RISK_LABELS } from "../lib/pal/labels";
import { demoExampleEyebrow } from "./demo-check-card";
import { DisclaimerLine } from "./disclaimer-line";
import {
  IconAlert,
  IconArrowRight,
  IconCheck,
  IconHeart,
  IconPause
} from "./icons";

// DESIGN.md §Icons: calm check / heads-up / pause. Same map result-card.tsx
// reads — three surfaces, one vocabulary.
const RISK_ICONS = {
  SAFE: IconCheck,
  MODERATE: IconAlert,
  HIGH: IconPause
} as const;

/**
 * Meal names are ledger copy (`landing-three-answers`); the reasons are the
 * approved `result-safe-example` / `result-moderate-example` /
 * `result-high-example` rows. Nothing here is invented card copy.
 */
export const EXAMPLE_RESULTS: Record<
  PalRisk,
  { meal: string; why: string; adjustment?: string; swap?: string }
> = {
  SAFE: {
    meal: "Grilled chicken, brown rice, and a side salad",
    why: "This looks like a reasonable fit. The meal already has protein and vegetables, so it looks more balanced than a fast-carb-heavy option."
  },
  MODERATE: {
    meal: "A bagel with jam and a glass of orange juice",
    why: "This may have a higher blood-sugar impact than a more balanced meal because it leans heavily on refined carbs.",
    adjustment:
      "If practical, add protein or nonstarchy vegetables to make it easier to handle."
  },
  HIGH: {
    meal: "A large soda with fries on the side",
    why: "This is likely a higher-impact choice in its current form because it is mostly sugary or refined carbs.",
    swap: "A smaller portion with protein or nonstarchy vegetables would be a steadier fit here."
  }
};

export function ExampleResultCard({
  risk,
  labelled = false,
  withFineprint = false
}: {
  risk: PalRisk;
  /**
   * AUD-008. ⛔ The label is COMPUTED, never typed: the day an authorised live
   * capture lands, `demoExampleEyebrow` returns "A real check, captured
   * <date>" and any hand-written "An illustrated example" silently becomes a
   * false claim. Block 4 leaves this off — its closing note labels all three
   * at once, and three copies of the same eyebrow is the fine-print pattern.
   */
  labelled?: boolean;
  /** The hero card carries the boundary line; block 4's note carries it once
   * for all three, so they render without it. */
  withFineprint?: boolean;
}) {
  const example = EXAMPLE_RESULTS[risk];
  const VerdictIcon = RISK_ICONS[risk];
  return (
    <section
      className="result-card result-anatomy"
      data-kind="result"
      data-risk={risk}
      data-testid="example-result-card"
    >
      {labelled ? (
        <header className="result-permission">
          <p className="result-eyebrow">{demoExampleEyebrow(null)}</p>
        </header>
      ) : null}
      <div className="anatomy-row">
        <span className="anatomy-label">Meal</span>
        <span className="anatomy-meal">{example.meal}</span>
      </div>
      {/* The ONLY tinted row (DESIGN.md §10): verdict colour is information,
          so it appears on the border and here, nowhere else. */}
      <div className="anatomy-row" data-risk={risk}>
        <span className="anatomy-label">Signal</span>
        <span className="anatomy-signal" data-risk={risk}>
          <VerdictIcon size={20} />
          {RISK_LABELS[risk]}
        </span>
      </div>
      <div className="anatomy-row">
        <span className="anatomy-label">Why</span>
        <p className="anatomy-copy">{example.why}</p>
      </div>
      {example.adjustment || example.swap ? (
        <div className="anatomy-row">
          <span className="anatomy-label">Try</span>
          <div className="result-list">
            {example.adjustment ? (
              <p className="result-row">
                <IconHeart size={16} />
                <span>
                  <strong>Adjustment:</strong> {example.adjustment}
                </span>
              </p>
            ) : null}
            {example.swap ? (
              <p className="result-row">
                <IconArrowRight size={16} />
                <span>
                  <strong>Swap:</strong> {example.swap}
                </span>
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
      {withFineprint ? (
        <div className="result-fineprint">
          <DisclaimerLine />
        </div>
      ) : null}
    </section>
  );
}

/**
 * §6's card, the design file's — a flat illustration, not the product's card.
 *
 * ⚖️ THE TRADE-OFF, RECORDED. This is a SECOND card family on a page whose
 * stated thesis was that it has none, and the cost is real: nothing here
 * re-renders when `result-card.tsx`'s recipe changes, so the illustration can
 * drift from the product's LOOK silently. The owner ruled for the design file
 * on 2026-08-06 with that cost stated. Two things contain it:
 *
 *   1. Every string comes from `EXAMPLE_RESULTS` and `RISK_LABELS` above —
 *      the same constants `ExampleResultCard` reads — so the copy cannot
 *      drift even though the recipe can. Nothing here is retyped.
 *   2. Every colour is a risk TOKEN, not a hex. The design file's
 *      #0f766e / #b45309 / #b91c1c and its three tint backgrounds ARE
 *      --safe-border / --moderate-border / --high-border and their -bg pairs,
 *      so a palette change still reaches this card.
 *
 * The anatomy LABELS ("Meal", "Signal", "Why", "Try") are deliberately absent:
 * the design draws this card without them, and the labelled gutter is what
 * distinguishes the hero's real card from these illustrations of it.
 *
 * ⛔ No disclaimer row, also the design's. `.landing-verdict-note` under the
 * grid carries the boundary line once for all three — three copies of it is
 * the fine-print pattern AUD-008 argues against. Do not add one here without
 * deleting the note, or the page states the same compliance line four times.
 */
export function LandingVerdictCard({ risk }: { risk: PalRisk }) {
  const example = EXAMPLE_RESULTS[risk];
  const VerdictIcon = RISK_ICONS[risk];
  return (
    <article className="landing-verdict-card" data-risk={risk}>
      <p className="landing-verdict-meal">{example.meal}</p>
      {/* The one tinted row, exactly as on the product card (DESIGN.md §10):
          verdict colour is information, so it appears on the top rule and
          here, nowhere else. */}
      <p className="landing-verdict-signal" data-risk={risk}>
        <VerdictIcon size={20} />
        {RISK_LABELS[risk]}
      </p>
      <p className="landing-verdict-why">{example.why}</p>
      {example.adjustment ? (
        <p className="landing-verdict-try">
          <strong>Adjustment:</strong> {example.adjustment}
        </p>
      ) : null}
      {example.swap ? (
        <p className="landing-verdict-try">
          <strong>Swap:</strong> {example.swap}
        </p>
      ) : null}
    </article>
  );
}
