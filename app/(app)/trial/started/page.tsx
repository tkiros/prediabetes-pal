"use client";

import Link from "next/link";
import { useEffect } from "react";

import { track } from "../../../../lib/client/analytics";
import type { PriceVariant } from "../../../../lib/client/analytics";

export default function TrialStartedPage() {
  useEffect(() => {
    fetch("/api/paywall")
      .then((r) => r.json())
      .then((cfg: { variant: PriceVariant }) =>
        track({ name: "trial_started", props: { variant: cfg.variant } })
      )
      .catch(() => {});

    // BC-3: server-side retrieve+upsert from the Checkout session id, so the
    // subscription row exists even when the webhook is unregistered or slow.
    // The user isn't signed in yet (the magic link is in their inbox); all
    // state comes from Stripe's API, keyed by the unguessable session id.
    const sessionId = new URLSearchParams(window.location.search).get(
      "session_id"
    );
    if (sessionId) {
      void fetch("/api/billing/stripe/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId })
      }).catch(() => {});
      // Strip the param so a refresh/share doesn't re-send it.
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  return (
    <div className="app-content--narrow">
        <section className="surface-card hero-card">
          <p className="hero-eyebrow">Your free week</p>
          <h1 className="page-title">Your free week is ready — one more step.</h1>
          <p className="page-copy">
            We emailed you a sign-in link. Tap it to unlock unlimited checks
            on this and every device — that&apos;s the one step before your
            next check.
          </p>
          <Link className="primary-button link-button" href="/signin">
            Go to sign-in
          </Link>
          <p className="page-copy">
            Two days before your trial ends, we&apos;ll email you a reminder
            with the exact date and amount — and a one-tap cancel link. Cancel
            any time from your account page, too. On your phone, Prediabetes Pal installs
            straight to your home screen —{" "}
            <Link className="inline-link" href="/get-the-app">
              see how
            </Link>
            .
          </p>
          <p className="field-hint">
            No email after a minute? Check spam, or{" "}
            <Link className="inline-link" href="/signin">
              request a fresh link
            </Link>
            .
          </p>
        </section>

        <footer className="page-footer">
          <Link href="/check">Check a meal</Link>
          <Link href="/account">Account</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
        </footer>
    </div>
  );
}
