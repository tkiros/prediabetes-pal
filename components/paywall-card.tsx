"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { track } from "../lib/client/analytics";
import {
  isPlayBillingAvailable,
  listPlayPurchases,
  listPlaySkus,
  purchasePlaySku,
  PLAY_SKUS
} from "../lib/client/digital-goods";
import { FREE_DAILY_CHECKS } from "../lib/free-tier";
import { TERMS_VERSION } from "../lib/legal/terms";
import { type PaywallConfig, usePaywallConfig } from "../lib/client/paywall-config";
import { useHydrated } from "../lib/client/use-hydrated";
import { playBillingEnabled } from "../lib/play-billing-flag";

/**
 * Soft paywall (plan 4D): after value, never at the first-session aha. In the
 * TWA it runs Play Billing; in the browser it redirects to Stripe Checkout.
 * All copy claims-audited: capability framing only, no outcome promises.
 *
 * Task 7 (P2.1): prices are server-authoritative. Until GET /api/paywall
 * answers with a config that passes the client zod schema, the card renders a
 * neutral loading/retry state and NO price — it never falls back to a hard-coded
 * ladder that could differ from what checkout will actually charge.
 */

/**
 * Whether "Restore a previous purchase" is disabled (B5). Restore is a Play-only
 * reinstall path that re-verifies each token server-side — it has NOTHING to do
 * with the checkout `config` load. Gating it on `config === null` meant a config
 * error/pending state stranded a returning subscriber who could not re-verify a
 * purchase they already own. Only a live action (busy) or unaccepted terms may
 * block restore; the price-bearing subscribe buttons stay config-gated elsewhere.
 * Pure so the gate is unit-testable without a component render.
 */
export function isRestoreDisabled(
  busy: string | null,
  termsAccepted: boolean
): boolean {
  return busy !== null || !termsAccepted;
}

export function PaywallCard() {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [playPrices, setPlayPrices] = useState<Record<string, string>>({});
  const hydrated = useHydrated();
  const usesPlay =
    hydrated && playBillingEnabled() && isPlayBillingAvailable();
  const [termsAccepted, setTermsAccepted] = useState(false);
  const { state, retry } = usePaywallConfig();

  useEffect(() => {
    track({ name: "paywall_viewed" });
  }, []);

  useEffect(() => {
    if (!usesPlay) {
      return;
    }

    let active = true;
    listPlaySkus()
      .then((skus) => {
        if (active) {
          setPlayPrices(
            Object.fromEntries(skus.map((sku) => [sku.itemId, sku.priceLabel]))
          );
        }
      })
      .catch(() => {
        // fall back to the config labels
      });

    return () => {
      active = false;
    };
  }, [usesPlay]);

  async function subscribe(plan: "monthly" | "annual") {
    track({ name: "subscribe_started" });
    setBusy(plan);
    setError(null);

    try {
      if (usesPlay) {
        const purchaseToken = await purchasePlaySku(PLAY_SKUS[plan]);
        if (!purchaseToken) {
          setError("The purchase didn't complete. Nothing was charged.");
          return;
        }

        const verify = await fetch("/api/billing/play/verify", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            purchaseToken,
            termsAccepted,
            termsVersion: TERMS_VERSION
          })
        });

        if (verify.ok) {
          window.location.assign("/account?subscribed=1");
        } else {
          setError(
            "We couldn't confirm the purchase yet. It will be re-checked automatically — nothing is lost."
          );
        }
        return;
      }

      const response = await fetch("/api/billing/stripe/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          plan,
          termsAccepted,
          termsVersion: TERMS_VERSION
        })
      });

      if (response.status === 401) {
        window.location.assign("/signin");
        return;
      }

      const body = (await response.json()) as { url?: string; error?: string };
      if (body.url) {
        window.location.assign(body.url);
      } else {
        setError(body.error ?? "Billing isn't available right now.");
      }
    } catch {
      setError("Something went wrong — you have not been charged.");
    } finally {
      setBusy(null);
    }
  }

  // N-08: explicit restore for a reinstall / new device. Each token is
  // re-verified server-side — the client list alone never grants anything.
  async function restorePurchases() {
    setBusy("restore");
    setError(null);

    try {
      const purchases = await listPlayPurchases();
      if (purchases.length === 0) {
        setError("No previous purchase was found on this Google account.");
        return;
      }

      for (const purchase of purchases) {
        const verify = await fetch("/api/billing/play/verify", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            purchaseToken: purchase.purchaseToken,
            termsAccepted,
            termsVersion: TERMS_VERSION
          })
        });
        if (verify.ok) {
          window.location.assign("/account?restored=1");
          return;
        }
      }

      setError(
        "We couldn't confirm the purchase yet. It will be re-checked automatically — nothing is lost."
      );
    } catch {
      setError("Something went wrong. Your purchase is not affected.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="paywall-card" data-testid="paywall-card">
      {/* T10 paywall truth: every bullet is a capability the matrix marks
          premium-true under the shipped flags (PREMIUM_CAPABILITY_KEYS):
          dailyChecks, historyDays, progress, nudges, mealMemory,
          weeklyLearning — the last two joined 2026-07-27 when both flag pairs
          went live in production. The bullet that used to sell a
          longitudinal-insight summary stays removed — the thin insight is FREE
          onboarding value. Pinned by
          tests/unit/revora/paywall-capability-truth.test.ts. */}
      <ul className="page-copy expectation-list">
        <li>Unlimited daily checks</li>
        <li>Your full history, on every device</li>
        <li>The progress view</li>
        <li>Meal memory for the meals you repeat</li>
        <li>The 90-day learning journey, with its weekly recap</li>
        <li>One gentle daily reminder (optional)</li>
      </ul>
      {/* F-24: this card used to carry a popularity flag claiming it was the
          most-chosen plan. Prediabetes Pal has not launched and has zero subscribers, so
          that was fabricated social proof — a claim about other users we cannot
          make (PRODUCT.md §Design Principles 4, "No fabricated data").
          `data-recommended` still drives the visual emphasis; it just no longer
          lies about why. The annual card's "Best value" flag stays: it is
          computed from the live prices (annualSavingsPct below), not asserted
          about a user base. Enforced by the "social-proof" family in
          claims-boundary-copy.test.ts — which is why this comment describes the
          old flag rather than quoting it. */}
      <label className="consent-row">
        <input
          type="checkbox"
          checked={termsAccepted}
          onChange={(event) => setTermsAccepted(event.target.checked)}
          data-testid="paid-terms-consent"
        />
        <span className="consent-label">
          I agree to the <Link href="/terms">Terms</Link> and acknowledge the{" "}
          <Link href="/privacy">Privacy Notice</Link>, including automatic
          renewal and the refund policy.
        </span>
      </label>
      {state.status === "ready" ? (
        <PaywallPlans
          config={state.config}
          playPrices={playPrices}
          busy={busy}
          termsAccepted={termsAccepted}
          onSubscribe={subscribe}
        />
      ) : (
        <PaywallConfigNotice status={state.status} onRetry={retry} />
      )}
      {usesPlay ? (
        <button
          type="button"
          className="link-button"
          disabled={isRestoreDisabled(busy, termsAccepted)}
          data-testid="restore-purchases"
          onClick={() => restorePurchases()}
        >
          {busy === "restore" ? "Checking…" : "Restore a previous purchase"}
        </button>
      ) : null}
      <p className="field-hint">
        Free keeps working: {FREE_DAILY_CHECKS} checks a day and your today
        view. Cancel anytime — the cancel button lives on your account page,
        not behind an email.
      </p>
      {error ? <p className="field-error">{error}</p> : null}
    </div>
  );
}

/**
 * The price-bearing plan cards. Rendered only once the server config is known —
 * every price here derives from `config` (the variant checkout will actually
 * charge) or the Play SKU price, never a literal.
 */
function PaywallPlans({
  config,
  playPrices,
  busy,
  termsAccepted,
  onSubscribe
}: {
  config: PaywallConfig;
  playPrices: Record<string, string>;
  busy: string | null;
  termsAccepted: boolean;
  onSubscribe: (plan: "monthly" | "annual") => void;
}) {
  // Play prices win in the TWA; otherwise the config's monthly variant.
  const monthlyLabel =
    playPrices[PLAY_SKUS.monthly] ?? `${config.priceDisplay}/mo`;

  // Savings vs 12 months of the live monthly variant; hidden when the math
  // doesn't hold (cheap variants, Play-priced currencies) or annual is off.
  const monthlyNumber = Number.parseFloat(
    config.priceDisplay.replace(/[^0-9.]/g, "")
  );
  const annualNumber = config.annualDisplay
    ? Number.parseFloat(config.annualDisplay.replace(/[^0-9.]/g, ""))
    : NaN;
  const annualSavingsPct =
    Number.isFinite(monthlyNumber) &&
    monthlyNumber > 0 &&
    Number.isFinite(annualNumber) &&
    annualNumber > 0
      ? Math.round((1 - annualNumber / (monthlyNumber * 12)) * 100)
      : 0;
  const annualLabel = config.annualDisplay
    ? playPrices[PLAY_SKUS.annual] ?? `${config.annualDisplay}/yr`
    : null;
  const annualNote =
    !playPrices[PLAY_SKUS.annual] && annualSavingsPct >= 10
      ? ` /year — save about ${annualSavingsPct}% vs monthly`
      : " /year";

  return (
    <>
      <div className="plan-card" data-recommended="">
        <p className="plan-card-price">
          {config.priceDisplay}
          <span> /month</span>
        </p>
        <button
          type="button"
          className="primary-button"
          disabled={busy !== null || !termsAccepted}
          data-testid="subscribe-monthly"
          onClick={() => onSubscribe("monthly")}
        >
          {busy === "monthly" ? "Opening…" : `Monthly — ${monthlyLabel}`}
        </button>
      </div>
      {/* Annual is shown only when the server authorized a price for it — an
          unconfigured annual (annualDisplay === null) must never render a
          guessed number checkout won't honor. */}
      {config.annualDisplay ? (
        <div className="plan-card">
          <p className="plan-card-flag">Best value</p>
          <p className="plan-card-price">
            {config.annualDisplay}
            <span>{annualNote}</span>
          </p>
          <button
            type="button"
            className="secondary-button"
            disabled={busy !== null || !termsAccepted}
            data-testid="subscribe-annual"
            onClick={() => onSubscribe("annual")}
          >
            {busy === "annual" ? "Opening…" : `Annual — ${annualLabel}`}
          </button>
        </div>
      ) : null}
    </>
  );
}

/**
 * Neutral pending/retry state (global constraint §7): while authority is
 * unknown, show a skeleton and — on failure — an explicit retry, never a price.
 */
function PaywallConfigNotice({
  status,
  onRetry
}: {
  status: "pending" | "error";
  onRetry: () => void;
}) {
  return (
    <div
      className="paywall-config-pending"
      data-testid="paywall-config-pending"
      aria-live="polite"
    >
      <div className="plan-card">
        {/* Only the visual shimmer is hidden from assistive tech; the status
            text below stays in the aria-live region so a loading/failed state
            is announced (matches trial-wall's pending block). */}
        <p className="plan-card-price skeleton-line" aria-hidden="true">
          &nbsp;
        </p>
        {status === "error" ? (
          <>
            <p className="field-hint">
              We couldn&apos;t load the plan details just now.
            </p>
            <button
              type="button"
              className="secondary-button"
              data-testid="paywall-config-retry"
              onClick={onRetry}
            >
              Retry
            </button>
          </>
        ) : (
          <p className="field-hint">Loading plan details…</p>
        )}
      </div>
    </div>
  );
}
