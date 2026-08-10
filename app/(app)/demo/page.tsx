import Link from "next/link";

import { DemoCheckCard } from "../../../components/demo-check-card";
import { ResultCard } from "../../../components/result-card";
import type { PalRisk, PalUserResponse } from "../../../lib/client/ui-state";
import { BOUNDARY_DISCLAIMER } from "../../../lib/pal/boundary-copy";
import { deriveCoachOutputs } from "../../../lib/pal/coach-outputs";

/**
 * `/demo` — the marketing-asset fixtures route (Task 8.4). A noindex, inert page
 * that renders the REAL product components (`<DemoCheckCard/>`, `<ResultCard/>`)
 * with fixture props so the capture script can screenshot each surface at both
 * viewports. Every string here is copied verbatim from an approved copy-ledger
 * row (`docs/safety/copy-ledger.md`) or produced by the real coach derivation
 * (`lib/pal/coach-outputs.ts`) — this page invents NO copy, and the claims
 * scan (`tests/unit/pal/claims-boundary-copy.test.ts`, `app/demo/page.tsx` in
 * `COPY_FILES`) enforces it. No live check runs here.
 */

export const metadata = {
  title: "Demo fixtures — Prediabetes Pal",
  robots: { index: false, follow: false }
};

// Builds a result fixture from a verbatim ledger `reason`, then fills the coach
// fields (keepMost / sequencingTip / postMealAction) via the real derivation so
// their copy is sourced from `coach-outputs.ts`, never re-typed here. SAFE gets
// no coach output (the derivation returns nulls), matching the shipped product.
function resultFixture(risk: PalRisk, reason: string): PalUserResponse {
  const base: PalUserResponse = {
    kind: "result",
    risk,
    reason,
    adjustment: null,
    swap: null,
    sequencingTip: null,
    postMealAction: null,
    keepMost: null,
    disclaimer: BOUNDARY_DISCLAIMER
  };
  return { ...base, ...deriveCoachOutputs(base) };
}

// `result-safe-example` ledger row.
const SAFE_FIXTURE = resultFixture(
  "SAFE",
  "This looks like a reasonable fit. The meal already has protein and vegetables, so it looks more balanced than a fast-carb-heavy option."
);

// `result-moderate-example` ledger row (+ the coach keepMost / sequencing /
// post-meal phrasebank, derived from `coach-outputs.ts`).
const MODERATE_FIXTURE = resultFixture(
  "MODERATE",
  "This may have a higher blood-sugar impact than a more balanced meal because it leans heavily on refined carbs. If practical, add protein or nonstarchy vegetables to make it easier to handle."
);

// `result-high-example` ledger row.
const HIGH_FIXTURE = resultFixture(
  "HIGH",
  "This is likely a higher-impact choice in its current form because it is mostly sugary or refined carbs. A smaller portion with protein or nonstarchy vegetables would be a steadier fit here."
);

// `result-clarification-example` ledger row — the honesty screenshot.
const CLARIFY_FIXTURE: PalUserResponse = {
  kind: "clarify",
  question:
    "Is this plain or sweetened? That one detail changes whether Prediabetes Pal should read it as lower impact or more concentrated.",
  disclaimer: BOUNDARY_DISCLAIMER
};

export default function DemoPage() {
  return (
    <div className="app-content--narrow">
        <header className="surface-card hero-card">
          <p className="hero-eyebrow">Live examples</p>
          <h1 className="page-title">See a Prediabetes Pal check in action</h1>
          <p className="page-copy">
            A few real examples of the answer Prediabetes Pal gives you — one for each
            kind of result you might see.
          </p>
          <Link className="inline-link" href="/check">
            Back to check a meal
          </Link>
        </header>

        <h2>The check</h2>
        <section data-shot="demo-check-card">
          <DemoCheckCard />
        </section>

        <h2>What each answer looks like</h2>
        <section data-shot="result-safe">
          <ResultCard response={SAFE_FIXTURE} />
        </section>

        <section data-shot="result-moderate">
          <ResultCard response={MODERATE_FIXTURE} />
        </section>

        <section data-shot="result-high">
          <ResultCard response={HIGH_FIXTURE} />
        </section>

        <h2>When Prediabetes Pal needs one more detail</h2>
        <section data-shot="clarify">
          <ResultCard response={CLARIFY_FIXTURE} />
        </section>

        <h2>Your first day</h2>
        {/* Day-1 `.first-win` block — the `day1-first-win` ledger row, the same
            static markup the daily loop renders at streak === 1. */}
        <section data-shot="first-win">
          <div className="surface-card daily-loop-card">
            <div className="first-win" data-testid="first-win">
              <p className="status-eyebrow">Day 1</p>
              <p className="page-copy">
                That&apos;s Day 1. One honest check a day is the whole habit.
              </p>
            </div>
          </div>
        </section>
    </div>
  );
}
