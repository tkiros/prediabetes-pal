import Link from "next/link";
import { redirect } from "next/navigation";

import { AUTH_EMAIL_AVAILABLE, signIn } from "../../../auth";
import { magicLinkSendFailed } from "../../../lib/revora/magic-link-outcome";
import { ReviewerSigninForm } from "../../../components/reviewer-signin-form";

export const metadata = {
  title: "Sign in — Revora",
  alternates: { canonical: "/signin" }
};

// Preview-only: unset in production (docs/ops/env-reference.md), so the
// reviewer-access form never renders on prod. NEXT_PUBLIC_ vars are inlined
// at build time, so this is a static `false` in the production bundle.
const REVIEWER_MODE = process.env.NEXT_PUBLIC_REVIEWER_MODE === "1";

export default async function SignInPage({
  searchParams
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const { callbackUrl, error } = await searchParams;
  // Relative, single-slash paths only — never an open redirect.
  const redirectTo =
    callbackUrl?.startsWith("/") && !callbackUrl.startsWith("//")
      ? callbackUrl
      : "/welcome";

  return (
    <div className="app-content--narrow">
        <section className="surface-card hero-card">
          <p className="hero-eyebrow">Revora account</p>
          <h1 className="page-title">Sign in with your email</h1>
          <p className="page-copy">
            No password. We send a one-time sign-in link to your inbox — tap
            it and you&apos;re in. An account keeps your history and coach in
            sync across your devices.
          </p>
          {error ? (
            <p className="request-status" role="alert">
              We couldn&apos;t send your sign-in link just now. Please try
              again in a minute.
            </p>
          ) : null}
          {AUTH_EMAIL_AVAILABLE ? (
            <form
              className="form-grid"
              action={async (formData: FormData) => {
                "use server";
                // Re-validate: the hidden input is client-tamperable, so an
                // absolute or protocol-relative value must never reach signIn.
                const raw = String(formData.get("callbackUrl") ?? "");
                const target =
                  raw.startsWith("/") && !raw.startsWith("//")
                    ? raw
                    : "/welcome";
                const result = await signIn("resend", {
                  email: String(formData.get("email") ?? ""),
                  redirect: false,
                  redirectTo: target
                });
                // A failed send resolves (it does not throw) as an error URL.
                // Claiming "check your email" on that path strands the user
                // and hides provider misconfiguration — surface it instead.
                if (magicLinkSendFailed(result)) {
                  redirect(
                    `/signin?error=send_failed&callbackUrl=${encodeURIComponent(target)}`
                  );
                }
                redirect("/signin/check-email");
              }}
            >
              <input type="hidden" name="callbackUrl" value={redirectTo} />
              <div className="field-stack">
                <label htmlFor="email" className="field-label">
                  Email address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="you@example.com"
                  className="text-input"
                />
                <p className="field-hint">
                  Next you&apos;ll be asked to consent to storing your health
                  data before anything is saved.
                </p>
              </div>
              <button type="submit" className="primary-button">
                Email me a sign-in link
              </button>
            </form>
          ) : (
            <p className="request-status" role="status">
              Sign-in is temporarily unavailable. Your on-device meal checks
              still work, and nothing you entered has been lost.
            </p>
          )}
        </section>

        {REVIEWER_MODE ? <ReviewerSigninForm /> : null}

        <footer className="page-footer">
          <Link href="/">Home</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
        </footer>
    </div>
  );
}
