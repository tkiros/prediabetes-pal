import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "How Revora Works — the Weekly Prediabetes Recap",
  description:
    "What Revora's weekly recap measures for people in the prediabetes A1C range, the evidence behind the approach, and its honest limits.",
  alternates: { canonical: "/how-it-works" }
};

/**
 * BAI methodology disclosure (plan P6, PRD Amendment 1 Acceptance Criteria:
 * "BAI methodology is disclosed in the app's 'How this works' section").
 * Citations are evidence for the approach, never a promise of this user's
 * own outcome — Amendment 1's fabricated "on track to reach X by day Y"
 * formula stays removed. This page is scanned by the claims-boundary audit
 * (tests/unit/revora/claims-boundary-copy.test.ts), so its copy — including
 * the citations below — must itself stay inside the boundary.
 */
export default function HowItWorksPage() {
  return (
    <div className="app-content--narrow">
        <section className="surface-card hero-card">
          <p className="hero-eyebrow">How this works</p>
          <h1 className="page-title">What the progress view measures</h1>
          <p className="page-copy">
            {/* AUD-007: the journey renders a non-scored recap (RV-3) — this
                page must describe that artifact, not a score it never shows. */}
            The weekly recap is entirely behavioral — it states what you did,
            never what a future lab result will be. Here is exactly what goes
            into it, the research it is grounded in, and its honest limits.
          </p>
        </section>

        <section className="surface-card legal-card">
          <h2>What&apos;s measured</h2>
          <ul>
            <li>
              <strong>Check-in days</strong> — how many of the last seven
              days had at least one check.
            </li>
            <li>
              <strong>Follow-through</strong> — when a check suggested a
              short after-meal action, how often you marked it done.
            </li>
          </ul>
          <p>
            These appear in your weekly recap as plain sentences — no
            composite score, no bands, no percentages. Checking less as you
            get more confident is how Revora is meant to work, so the recap
            states facts that cannot &quot;decline.&quot; The recap is
            refreshed once a week, early Monday, from the seven days before.
            (Revora also computes an internal behavioral index to measure the
            product itself; it is never shown to you and never predicts
            anything about your health.)
          </p>
        </section>

        <section className="surface-card legal-card">
          <h2>The research this is grounded in</h2>
          <p>
            Revora doesn&apos;t invent behavior science — it points at
            published research and asks you to build the habit yourself.
            None of the following describes Revora&apos;s own users or
            promises what will happen to your own numbers; each is a
            citation for why checking in and following through are the
            behaviors worth building.
          </p>
          <ul>
            <li>
              <strong>CDC DPP</strong> — a large randomized trial (NEJM,
              2002) found a 58% reduction in progression to type 2 diabetes
              among participants who made sustained diet and activity
              changes, compared with placebo.
            </li>
            <li>
              <strong>Jenkins et al., 2008</strong> (American Journal of
              Clinical Nutrition) — a dietary intervention study associated
              with meaningful average A1C change over 24 weeks among its
              participants.
            </li>
            <li>
              <strong>Imai et al., 2023</strong> (Nutrients) — vegetable- or
              protein-first meal sequencing was associated with a 29%
              reduction in post-meal glucose spikes among study
              participants, the basis for Revora&apos;s sequencing tip.
            </li>
          </ul>
        </section>

        <section className="surface-card legal-card">
          <h2>An honest limit</h2>
          <p>
            Individual results vary, and Revora has no way to know yours.
            The weekly recap tracks behavior you can see and control —
            checking in, and following through. Only a blood test ordered
            by a clinician measures your actual A1C. Please talk with your
            clinician about your own numbers and any changes to your care.
          </p>
          <p className="result-disclaimer">Not medical advice.</p>
        </section>

        <section className="surface-card hero-card">
          <p className="page-copy">
            The habit itself takes about ten seconds a day.
          </p>
          <Link className="primary-button link-button" href="/check">
            Try it with your next meal
          </Link>
        </section>

        <footer className="page-footer">
          <Link href="/journey">My journey</Link>
          <Link href="/">Home</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
        </footer>
    </div>
  );
}
