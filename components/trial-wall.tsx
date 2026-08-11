"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { track } from "../lib/client/analytics";
import { historyStore } from "../lib/client/history-store";
import { useHydrated } from "../lib/client/use-hydrated";
import { TERMS_VERSION } from "../lib/legal/terms";
import { usePaywallConfig } from "../lib/client/paywall-config";

// Two steps (was three): the offer, the trial mechanics, and the price all
// live on the first screen — "7 days free" is never hidden behind a click.
type Step = "value" | "start";
type Plan = "monthly" | "annual";

/**
 * Task 7 (P2.1): every price on this wall is server-authoritative. Until GET
 * /api/paywall answers with a config that passes the client zod schema, the
 * wall shows a neutral loading/retry state and NO price — it never falls back
 * to a hard-coded ladder that could differ from what checkout will charge.
 */
export function TrialWall({
  declined = false,
  initialEmail = ""
}: {
  declined?: boolean;
  /** Session email when signed in — prefills the field, stays editable
   *  (a different email may be trial-eligible). */
  initialEmail?: string;
}) {
  const { state, retry } = usePaywallConfig();
  const config = state.status === "ready" ? state.config : null;
  const [step, setStep] = useState<Step>("value");
  // Annual preselected when offered — it's the plan we flag as best value.
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [email, setEmail] = useState(initialEmail);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // AUD-011: server-authoritative ineligible-trial disclosure. When set, the
  // free-week promise is replaced with the real charge (amount due today,
  // cadence) and checkout only proceeds on an explicit acknowledged resubmit.
  const [immediateBilling, setImmediateBilling] = useState<{
    priceDisplay: string;
    cadence: "month" | "year";
  } | null>(null);
  // Endowment nudge for the declined state: name what's already theirs. Local
  // history only — the declined visitor is a guest; read in an effect so the
  // server render (0) never mismatches hydration.
  const savedChecks = useHydrated() ? historyStore.all().length : 0;
  const [termsAccepted, setTermsAccepted] = useState(false);
  const plan =
    selectedPlan ?? (config?.annualDisplay ? "annual" : "monthly");

  // Fire the view event and preselect the annual plan only once the server
  // config is known — never off a guessed variant.
  useEffect(() => {
    if (!config) {
      return;
    }
    track({ name: "wall_viewed", props: { variant: config.variant } });
  }, [config]);

  async function startTrial(event: React.FormEvent) {
    event.preventDefault();
    if (!config) return;
    setBusy(true);
    setError(null);
    track({ name: "trial_checkout_started", props: { variant: config.variant } });
    try {
      const response = await fetch("/api/trial/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email,
          plan,
          termsAccepted,
          termsVersion: TERMS_VERSION,
          // Only ever true after the disclosure below has rendered.
          ...(immediateBilling ? { acknowledgeImmediate: true } : {})
        })
      });
      const body = (await response.json()) as {
        url?: string;
        error?: string;
        ineligibleTrial?: boolean;
        priceDisplay?: string;
        cadence?: "month" | "year";
      };
      if (body.url) {
        window.location.assign(body.url);
      } else if (
        body.ineligibleTrial === true &&
        typeof body.priceDisplay === "string" &&
        (body.cadence === "month" || body.cadence === "year")
      ) {
        setImmediateBilling({
          priceDisplay: body.priceDisplay,
          cadence: body.cadence
        });
      } else {
        setError(body.error ?? "Something went wrong — you have not been charged.");
      }
    } catch {
      setError("Something went wrong — you have not been charged.");
    } finally {
      setBusy(false);
    }
  }

  const declinedNotes = (
    <>
      {declined && savedChecks > 0 ? (
        <p className="field-hint" data-testid="saved-checks-note">
          The {savedChecks} {savedChecks === 1 ? "check" : "checks"} you&apos;ve
          already made stay saved on this device — your history is here
          whenever you come back.
        </p>
      ) : null}
      {declined ? (
        <p className="field-hint" data-testid="pantry-catch">
          Not ready for a subscription? There&apos;s a one-time option:{" "}
          <Link className="inline-link" href="/pantry">
            the Pantry Review
          </Link>
          . One payment, nothing renews.
        </p>
      ) : null}
    </>
  );

  // Neutral pending/retry (global constraint §7): no price until authority
  // responds; a failed lookup is an explicit retry, never a guessed contract.
  if (!config) {
    return (
      <div className="surface-card hero-card" data-testid="trial-wall">
        <p className="hero-eyebrow">Your free week with Prediabetes Pal</p>
        <div
          className="paywall-config-pending"
          data-testid="paywall-config-pending"
          aria-live="polite"
        >
          <p className="plan-card-price skeleton-line" aria-hidden="true">
            &nbsp;
          </p>
          {state.status === "error" ? (
            <>
              <p className="field-hint">
                We couldn&apos;t load the plan details just now.
              </p>
              <button
                type="button"
                className="primary-button"
                data-testid="paywall-config-retry"
                onClick={retry}
              >
                Retry
              </button>
            </>
          ) : (
            <p className="field-hint">Loading plan details…</p>
          )}
        </div>
        {declinedNotes}
      </div>
    );
  }

  // Savings vs 12 months of the live monthly variant — computed from the
  // server config, never a second hard-coded ladder.
  const monthlyNumber = Number.parseFloat(
    config.priceDisplay.replace(/[^0-9.]/g, "")
  );
  const annualNumber = Number.parseFloat(
    (config.annualDisplay ?? "").replace(/[^0-9.]/g, "")
  );
  const annualSavingsPct =
    Number.isFinite(monthlyNumber) &&
    monthlyNumber > 0 &&
    Number.isFinite(annualNumber) &&
    annualNumber > 0
      ? Math.round((1 - annualNumber / (monthlyNumber * 12)) * 100)
      : 0;
  const chosenPriceLine =
    plan === "annual" && config.annualDisplay
      ? `${config.annualDisplay}/year`
      : `${config.priceDisplay}/month`;

  return (
    <div className="surface-card hero-card" data-testid="trial-wall">
      {step === "value" ? (
        <>
          <p className="hero-eyebrow">Your free week with Prediabetes Pal</p>
          <h1 className="page-title">Keep your calm answers — 7 days free</h1>
          <p className="page-copy">
            Yesterday you checked a meal and got a cautious educational read
            instead of a pile of numbers. Your free week keeps that
            going at every meal: unlimited checks, your history on every
            device, progress you can see, meal memory for the meals you
            repeat, the learning journey with its weekly recap, and one
            gentle daily reminder.
          </p>
          {/* The same three facts as the old trust bullets, told as the
              timeline the week actually follows (Today → Day 5 → Day 7). */}
          <ol className="trial-timeline" data-testid="trial-timeline">
            <li>
              <span className="trial-timeline-day">Today</span>
              <span>
                Start with a card — everything unlocks, nothing is charged.
              </span>
            </li>
            <li>
              <span className="trial-timeline-day">Day 5</span>
              <span>
                We email you the exact date and amount before any charge.
              </span>
            </li>
            <li>
              <span className="trial-timeline-day">Day 7</span>
              <span>
                Your first charge — cancel any time before, in one tap, from
                that email or your account page. No retention screens.
              </span>
            </li>
          </ol>
          {config.annualDisplay ? (
            <>
              <div
                className="plan-grid"
                role="radiogroup"
                aria-label="Choose a plan"
                data-testid="plan-grid"
              >
                <button
                  type="button"
                  role="radio"
                  aria-checked={plan === "annual"}
                  className="plan-option"
                  data-selected={plan === "annual" || undefined}
                  data-testid="plan-annual"
                  onClick={() => setSelectedPlan("annual")}
                >
                  <span className="plan-option-flag">
                    Best value{annualSavingsPct >= 10 ? ` — save ${annualSavingsPct}%` : ""}
                  </span>
                  <span className="plan-option-name">Yearly</span>
                  <span className="plan-option-price">
                    {config.annualDisplay}
                    <span> /year</span>
                  </span>
                  {config.annualMonthlyEquivalent ? (
                    <span className="plan-option-note">
                      that&apos;s {config.annualMonthlyEquivalent} a month
                    </span>
                  ) : null}
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={plan === "monthly"}
                  className="plan-option"
                  data-selected={plan === "monthly" || undefined}
                  data-testid="plan-monthly"
                  onClick={() => setSelectedPlan("monthly")}
                >
                  <span className="plan-option-name">Monthly</span>
                  <span className="plan-option-price">
                    {config.priceDisplay}
                    <span> /month</span>
                  </span>
                  <span className="plan-option-note">cancel any month</span>
                </button>
              </div>
              <button
                type="button"
                className="primary-button"
                data-testid="start-trial"
                onClick={() => setStep("start")}
              >
                Start my free week
              </button>
              <p className="field-hint">
                7 days free with either plan. Nothing is charged today, and we
                email you before anything is.
              </p>
            </>
          ) : (
            <div className="plan-card" data-recommended="">
              <p className="plan-card-flag">7 days free</p>
              <p className="plan-card-price">
                {config.priceDisplay}
                <span> /month after your free week — cancel anytime</span>
              </p>
              <button
                type="button"
                className="primary-button"
                onClick={() => setStep("start")}
              >
                Start my free week
              </button>
            </div>
          )}
          <p className="field-hint">
            Grounded in published research —{" "}
            <Link className="inline-link" href="/how-it-works">
              see how Prediabetes Pal works
            </Link>
            .
          </p>
        </>
      ) : (
        <form onSubmit={startTrial} className="field-stack">
          {immediateBilling ? (
            <>
              <p className="hero-eyebrow">Restart your subscription</p>
              <h1 className="page-title">
                {immediateBilling.priceDisplay}/{immediateBilling.cadence},
                charged today
              </h1>
              <p className="page-copy" data-testid="immediate-billing-disclosure">
                This account already used its free week, so there&apos;s no
                second trial. If you continue, your card is charged{" "}
                {immediateBilling.priceDisplay} today and renews every{" "}
                {immediateBilling.cadence} until you cancel.
              </p>
            </>
          ) : (
            <>
              <p className="hero-eyebrow">Start your free week</p>
              <h1 className="page-title">{chosenPriceLine} after 7 free days</h1>
              <p className="page-copy">
                Card required to start. We email you before it is ever charged,
                and cancel is one tap.
              </p>
            </>
          )}
          <label className="field-label" htmlFor="trial-email">Your email</label>
          <input
            id="trial-email"
            className="text-input"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              // A different email may be trial-eligible — drop the disclosure
              // (and the acknowledgment it authorizes) the moment it changes.
              setImmediateBilling(null);
            }}
          />
          <label className="consent-row">
            <input
              type="checkbox"
              checked={termsAccepted}
              onChange={(event) => setTermsAccepted(event.target.checked)}
              data-testid="trial-terms-consent"
            />
            <span className="consent-label">
              I agree to the <Link href="/terms">Terms</Link> and acknowledge
              the <Link href="/privacy">Privacy Notice</Link>, the selected
              price, automatic renewal after 7 free days, cancellation, and
              refund terms.
            </span>
          </label>
          <button
            type="submit"
            className="primary-button"
            disabled={busy || !termsAccepted}
          >
            {busy
              ? "Opening…"
              : immediateBilling
                ? `Continue to checkout — ${immediateBilling.priceDisplay} due today`
                : "Continue to checkout — $0 due today"}
          </button>
          {error ? <p className="field-error">{error}</p> : null}
        </form>
      )}
      {declinedNotes}
    </div>
  );
}
