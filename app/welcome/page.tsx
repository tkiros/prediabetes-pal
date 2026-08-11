"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { track } from "../../lib/client/analytics";
import { historyStore } from "../../lib/client/history-store";
import { profileStore } from "../../lib/client/profile-store";
import { tasterStore } from "../../lib/client/taster-store";
import { longitudinalInsightsEnabled } from "../../lib/longitudinal-insights-flag";

/**
 * First-sign-in profile completion (plan 4A): the GDPR Art. 9 consent
 * checkbox blocks profile creation; A1C prefills from onboarding. Nothing is
 * stored server-side until consent is given here.
 */
export default function WelcomePage() {
  const router = useRouter();
  const [state, setState] = useState<
    "loading" | "signed_out" | "ready" | "submitting" | "done"
  >("loading");
  const [hasProfile, setHasProfile] = useState(false);
  const [a1cText, setA1cText] = useState("");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const response = await fetch("/api/profile");
        if (cancelled) {
          return;
        }

        if (response.status === 401) {
          setState("signed_out");
          return;
        }

        const body = (await response.json()) as { hasProfile?: boolean };
        setHasProfile(Boolean(body.hasProfile));
        setState("ready");

        const profile = profileStore.get();
        if (profile) {
          setA1cText(profile.a1c.toFixed(1));
        }
      } catch {
        if (!cancelled) {
          setState("signed_out");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit() {
    const a1c = Number.parseFloat(a1cText);
    if (!Number.isFinite(a1c)) {
      setError("Enter your latest A1C with one decimal, like 6.1.");
      return;
    }
    if (!consent) {
      setError("Storing your A1C needs your explicit consent.");
      return;
    }

    setState("submitting");
    setError(null);

    try {
      const response = await fetch("/api/profile", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          a1c,
          consent,
          timezone:
            Intl.DateTimeFormat().resolvedOptions().timeZone ??
            "America/New_York"
        })
      });

      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        setError(body.error ?? "Something went wrong — please try again.");
        setState("ready");
        return;
      }

      // Bring the device history along (idempotent; 4B route).
      const local = historyStore.all();
      if (local.length > 0) {
        await fetch("/api/history/migrate", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ checks: local })
        }).catch(() => {
          // best-effort: history sync also runs on later visits
        });
      }

      // Signed in: entitlement is server-truth, so drop the device taster.
      tasterStore.clear();

      // Mirror the saved profile on-device BEFORE navigating: /check's
      // FirstRunGate keys on a non-null device profile, and a user who signed
      // in without ever touching the guest tour has none — without this they
      // bounce from /check into /onboarding (caught by auth.spec on main,
      // Mobile Safari, right after the /check landing change). Also what
      // makes the saved-A1C row prefill instantly.
      profileStore.set({ a1c, onboardedAt: new Date().toISOString() });

      setState("done");
      track({ name: "signin_completed" });
      // Land where the product is: the check page (type / say it / photo) —
      // not the dashboard (owner testing 2026-08-11).
      router.push("/check");
    } catch {
      setError("Something went wrong — please try again.");
      setState("ready");
    }
  }

  return (
    <main className="page-shell">
      <div className="page-frame">
        <section className="surface-card hero-card">
          {state === "loading" ? (
            <p className="page-copy">Loading…</p>
          ) : state === "signed_out" ? (
            <>
              <p className="hero-eyebrow">Almost there</p>
              <h1 className="page-title">Sign in to continue</h1>
              <p className="page-copy">
                This step links your history to your account. Use the
                sign-in link from your email first.
              </p>
              <Link className="primary-button link-button" href="/signin">
                Go to sign-in
              </Link>
            </>
          ) : hasProfile ? (
            <>
              <p className="hero-eyebrow">All set</p>
              <h1 className="page-title">Your account is ready</h1>
              <p className="page-copy">
                Your history and coach follow you across devices now.
              </p>
              {/* ?stay=1: this user has a SERVER profile but this device may
                  be fresh (no local profile), and FirstRunGate would bounce
                  an empty device into the guest tour. */}
              <Link className="primary-button link-button" href="/check?stay=1">
                Check a meal
              </Link>
            </>
          ) : (
            <>
              <p className="hero-eyebrow">One-time setup</p>
              <h1 className="page-title">Save your profile</h1>
              <p className="page-copy">
                Prediabetes Pal stores your A1C and your meal checks so your history
                and coach work across devices. Your A1C and meal text are
                encrypted at rest.
              </p>
              <div className="field-stack">
                <label htmlFor="welcome-a1c" className="field-label">
                  Latest A1C
                </label>
                <input
                  id="welcome-a1c"
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  value={a1cText}
                  onChange={(event) => {
                    setA1cText(event.target.value);
                    setError(null);
                  }}
                  placeholder="6.1"
                  className="text-input"
                />
              </div>
              <div className="consent-row">
                <input
                  id="welcome-consent"
                  type="checkbox"
                  checked={consent}
                  onChange={(event) => {
                    setConsent(event.target.checked);
                    setError(null);
                  }}
                />
                {/* Explicit, purpose-bound health-data consent. Unchecked by
                    default, blocking for storage, and separately revocable
                    from Account without deleting login or subscription.
                    Layered per owner decision 2026-08-11: one plain sentence
                    up front, the full counsel-drafted paragraph (panel review
                    2026-07-12 §intake copy) in the expander DIRECTLY at the
                    point of consent — never moved into the Terms, which would
                    bundle Art.-9-style consent into a contract click. */}
                <label htmlFor="welcome-consent" className="consent-label">
                  I consent to Prediabetes Pal storing and using my A1C and the
                  meals I submit (health data) to provide my meal checks, saved
                  history, and progress
                  {longitudinalInsightsEnabled() ? ", and personalized insights" : ""}.
                </label>
              </div>
              <details className="consent-details">
                <summary>How my health data is handled</summary>
                <p className="consent-details-copy">
                  Each submitted meal and A1C is sent to OpenAI, via the
                  OpenRouter gateway, to generate a response; Prediabetes Pal
                  stores my A1C and saved meal text in encrypted form. I can
                  withdraw this consent and erase the saved health data from
                  Account without deleting my login or subscription, and I can
                  continue in guest mode. Read the{" "}
                  <Link href="/privacy">Privacy Notice</Link> for recipients,
                  retention, transfers, and rights.
                </p>
              </details>
              {error ? <p className="field-error">{error}</p> : null}
              <button
                type="button"
                className="primary-button"
                disabled={state === "submitting" || !consent}
                data-testid="welcome-save"
                onClick={handleSubmit}
              >
                {state === "submitting" ? "Saving…" : "Save my profile"}
              </button>
            </>
          )}
        </section>

        <footer className="page-footer">
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
        </footer>
      </div>
    </main>
  );
}
