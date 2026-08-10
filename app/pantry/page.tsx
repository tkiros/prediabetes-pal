import { PantryBuyButton } from "../../components/pantry-buy-button";
import { BOUNDARY_DISCLAIMER } from "../../lib/revora/boundary-copy";
import { resolvePantryPrice } from "../../lib/server/pantry-price";

// Indexable on purpose: this is the cold-traffic front door for the one-time
// Pantry Review, so no `robots: { index: false }` here (unlike the in-app
// /report and /pantry/thanks surfaces).
export const metadata = {
  title: "Pantry Review — Revora",
  alternates: { canonical: "/pantry" }
};

// AUD-010: the displayed price is resolved per-request from the same Stripe
// Price object checkout charges — never a build-time constant that billing
// config can silently diverge from.
export const dynamic = "force-dynamic";

// Sample rows reuse the LIVE report row markup from app/report/[id]/page.tsx
// (~:24-36) verbatim — same `result-card report-item report-item--{tone}`
// classes and the same report-item-name / report-item-reason / report-item-tip
// structure — so the fictional excerpt is pixel-true to a real report.
function SampleRow({
  name,
  tone,
  reason,
  swap
}: {
  name: string;
  tone: "safe" | "moderate" | "high";
  reason: string;
  swap?: string;
}) {
  return (
    <div className={`result-card report-item report-item--${tone}`}>
      <p className="report-item-name">{name}</p>
      <p className="report-item-reason">{reason}</p>
      {swap ? <p className="report-item-tip">Swap idea: {swap}</p> : null}
    </div>
  );
}

export default async function PantryLandingPage() {
  // Fail closed (AUD-010): without a verified one-time USD amount from the
  // configured Price, no number is shown and checkout is not offered — the
  // page never advertises an amount the session might not charge.
  const pantryPrice = await resolvePantryPrice();
  const priceLine = pantryPrice
    ? `${pantryPrice.display}, one payment. Nothing renews.`
    : null;

  return (
    <main className="page-shell">
      <div className="page-frame report-frame">
        <section className="surface-card hero-card">
          <p className="hero-eyebrow">Pantry Review</p>
          <h1 className="page-title">
            Stop second-guessing every shelf in your kitchen
          </h1>
          <p className="page-copy">
            One evening of photos, one calm report. Send us pictures of your
            pantry and fridge, confirm the item list, and the same careful
            engine behind Revora&apos;s meal check sorts everything you own
            into enjoy freely, worth a tweak, and handle with care —
            printable, and yours to keep.
          </p>
          {priceLine ? (
            <>
              <PantryBuyButton source="landing" />
              <p className="field-hint" data-testid="pantry-price-line">
                {priceLine}
              </p>
            </>
          ) : (
            <p className="field-hint" data-testid="pantry-unavailable">
              The Pantry Review is not available right now. Please check back
              soon.
            </p>
          )}
        </section>

        <section className="surface-card">
          <p className="hero-eyebrow">A sample, from a fictional kitchen</p>

          <h2>Enjoy freely</h2>
          <SampleRow
            name="Plain Greek yogurt"
            tone="safe"
            reason="Plain Greek yogurt fits as it is — it leans on protein rather than fast carbs, so it looks like a steady pick with no change needed."
          />

          <h2>Worth a tweak</h2>
          <SampleRow
            name="Instant oatmeal packets"
            tone="moderate"
            reason="Instant oatmeal packets lean heavily on refined, quick-cooking carbs, so they can have a higher blood-sugar impact than their healthy reputation suggests."
            swap="steel-cut oats hold up steadier than instant packets."
          />

          <h2>Handle with care</h2>
          <SampleRow
            name="Sweetened juice"
            tone="high"
            reason="Sweetened juice is likely a higher-impact choice in its current form because it is mostly sugar with little to slow it down."
            swap="whole fruit, with the fiber left in, is a steadier fit than the juice."
          />
        </section>

        <section className="surface-card">
          <h2>How it works</h2>
          <p className="page-copy">
            Send photos of your pantry and fridge. You confirm the item list.
            Your report arrives by email.
          </p>
          <p className="page-copy">
            Photos are deleted after your report is delivered.
          </p>
          <p className="result-disclaimer">{BOUNDARY_DISCLAIMER}</p>
        </section>

        {priceLine ? (
          <section className="surface-card">
            {/* trackView off: the hero's button already emits pantry_viewed for
                this page — two mounts must not double the funnel's view count. */}
            <PantryBuyButton source="landing" trackView={false} />
            <p className="field-hint">{priceLine}</p>
          </section>
        ) : null}
      </div>
    </main>
  );
}
