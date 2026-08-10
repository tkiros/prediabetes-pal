import Link from "next/link";

export const metadata = {
  title: "Delete your account & data — Prediabetes Pal",
  description:
    "How to permanently delete your Prediabetes Pal account and all stored data."
};

/**
 * Public data-deletion page (plan 4E) — reachable signed-out; this URL is
 * declared in Google Play's Data-deletion field.
 */
export default function DeleteAccountPage() {
  return (
    <div className="app-content--narrow">
        <section className="surface-card hero-card">
          <p className="hero-eyebrow">Your data, your call</p>
          <h1 className="page-title">Delete your account &amp; data</h1>
          <p className="page-copy">
            Deleting your Prediabetes Pal account permanently removes everything we
            store about you:
          </p>
          <ul className="page-copy expectation-list">
            <li>your profile and A1C value,</li>
            <li>your entire meal-check history,</li>
            <li>reminder (push) registrations,</li>
            <li>subscription records,</li>
            <li>your sign-in sessions and email.</li>
          </ul>
          {/* AUD-013: the promise matches the handler. A Play subscription
              blocks deletion (409) until cancelled in Play; a hashed deletion
              record and provider-side billing records remain. No absolute
              "immediate and complete, no retention" claim. */}
          <p className="page-copy">
            Deletion runs immediately and cannot be undone. Two honest
            boundaries:
          </p>
          <ul className="page-copy expectation-list">
            <li>
              If you subscribed through <strong>Google Play</strong>, cancel
              that subscription in Google Play first (Menu → Payments &amp;
              subscriptions) — deletion is refused until then, so you are
              never left paying for an account you can&apos;t see. Stripe
              subscriptions are cancelled for you as part of deletion.
            </li>
            <li>
              What remains afterwards: a one-line deletion record holding only
              an anonymous code and two timestamps — no name, email, or health
              data — and the payment provider&apos;s own billing records
              (Stripe or Google Play), which are retained by the provider
              under their terms, outside Prediabetes Pal.
            </li>
          </ul>
          <h2 className="section-title">How to delete</h2>
          <ol className="page-copy expectation-list">
            <li>
              Sign in, open{" "}
              <Link className="inline-link" href="/account">
                your account page
              </Link>
              ,
            </li>
            <li>tap “Delete account &amp; data”, and confirm.</li>
          </ol>
          <p className="field-hint">
            Lost access to your email? Contact support from the address you
            signed up with and we&apos;ll complete the deletion manually.
          </p>
          <Link className="primary-button link-button" href="/account">
            Go to my account
          </Link>
        </section>

        <footer className="page-footer">
          <Link href="/">Home</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
        </footer>
    </div>
  );
}
