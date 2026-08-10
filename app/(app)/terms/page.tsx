import type { Metadata } from "next";
import Link from "next/link";

import { WEB_REFUND_WINDOW_DAYS } from "../../../lib/legal/terms";
import { loadSafetyContract } from "../../../lib/revora/safety-contract";
import { SUPPORT_EMAIL } from "../../../lib/revora/contact";

export const metadata: Metadata = {
  title: "Terms · Revora",
  description: "The agreement between you and Revora, in plain language.",
  alternates: { canonical: "/terms" }
};

export default function TermsPage() {
  const { copy } = loadSafetyContract();
  const operatorName = process.env.LEGAL_ENTITY_NAME?.trim() || "Revora";

  return (
    <div className="app-content--narrow">
      <section className="surface-card hero-card">
        <p className="hero-eyebrow">Terms</p>
        <h1 className="page-title">Terms of Service</h1>
        <p className="page-copy">
          These Terms are the agreement between you and {operatorName}, the
          operator of Revora. By creating an account or making a purchase, you
          agree to them.
        </p>
        <p className="page-copy">Effective and last updated: 2026-07-12</p>
      </section>

      <section className="surface-card legal-card">
        <h2>What Revora provides</h2>
        <p>
          Revora provides general educational information about meal
          composition for adults using an A1C in the prediabetes range. It uses
          a user-provided A1C range only to apply a more cautious educational
          presentation. Its labels describe general meal patterns; they do not
          determine whether a meal is medically appropriate for you and do not
          predict your individual glucose response or a future laboratory
          result.
        </p>

        <h2>Not medical care</h2>
        <p>
          Revora makes no medical determinations, provides no clinical care,
          and does not replace a doctor or registered dietitian. Do not use it
          for medication or emergency decisions. Your health decisions remain
          yours and your clinician&apos;s.
        </p>

        <h2>Eligibility and accounts</h2>
        <p>
          You must be at least 18. Keep your email account and sign-in links
          secure. Information you submit should be accurate, your own, and
          provided with any legally required permission.
        </p>

        <h2>Acceptable use</h2>
        <p>
          Use Revora for personal, informational meal education. Do not submit
          another person&apos;s health information without permission, probe or
          disrupt the service, bypass limits, misuse purchase flows, or resell
          the service or its outputs.
        </p>

        <h2>Subscriptions and automatic renewal</h2>
        <p>
          Revora offers a free tier and optional monthly or annual Premium
          subscriptions. Before purchase, Revora shows the price, billing
          interval, trial length if any, first-charge date, and renewal terms.
          A subscription renews automatically at the displayed interval until
          canceled.
        </p>
        <p>
          Cancel from your Revora account or, for Google Play purchases, the
          Google Play subscription center. Cancellation stops future renewal
          and normally takes effect at the end of the paid period. Access
          continues through that date unless a refund or applicable law
          requires otherwise.
        </p>

        <h2>Refund policy</h2>
        <p>
          For web subscriptions processed through Stripe, email {SUPPORT_EMAIL}
          within {WEB_REFUND_WINDOW_DAYS} calendar days of your first paid
          charge for a refund of that first charge. Revora also refunds verified
          duplicate or unauthorized charges. Later renewal charges are normally
          non-refundable after the paid period begins, except where required by
          law or where Revora confirms a material service failure.
        </p>
        <p>
          For Google Play purchases, start with Google Play&apos;s refund request
          flow. If Google cannot resolve the request, contact Revora. Google
          Play&apos;s rules and all mandatory rights under the law where you live
          still apply. Pantry Review is eligible for a refund until processing
          begins; after processing begins, refunds are available for duplicate
          or unauthorized charges, material non-delivery, or where law requires.
        </p>

        <h2>Health data and privacy</h2>
        <p>
          The <Link href="/privacy">Privacy Notice</Link> explains collection,
          processors, retention, and rights. Revora asks for separate explicit
          consent before saving A1C or meal history. You can withdraw storage
          consent and erase saved health data from Account while keeping your
          login and subscription, or delete the entire account at{" "}
          <Link href="/account/delete">/account/delete</Link>.
        </p>

        <h2>Ownership and license</h2>
        <p>
          Revora&apos;s app, design, and software belong to {operatorName} and
          its licensors. Revora grants you a limited, personal, revocable,
          non-transferable license to use the service under these Terms. You
          may not copy, decompile, resell, or redistribute the service except
          where applicable law expressly permits it.
        </p>

        <h2>Service changes and account ending</h2>
        <p>
          Revora may change features or suspend an account that materially
          violates these Terms. Material Terms changes will be posted with a
          new effective date and, when they materially affect an active paid
          subscription, communicated before taking effect. Ending access does
          not remove refund or consumer rights that already arose.
        </p>

        <h2>Availability, warranties, and liability</h2>
        <p>
          Revora is provided on an as-available basis. To the extent allowed by
          law, no implied warranty or uninterrupted availability is promised.
          Revora is not liable for indirect, incidental, special, or
          consequential damages. To the extent allowed by law, aggregate direct
          liability arising from the service is limited to the amount you paid
          Revora during the 12 months before the event giving rise to the claim.
        </p>
        <p>
          Nothing in these Terms excludes liability or a statutory consumer
          right that applicable law does not allow the parties to exclude. The
          mandatory consumer laws and courts available to you where you live
          remain available; these Terms do not impose a different exclusive
          venue.
        </p>

        <h2>General terms</h2>
        <p>
          If one provision cannot be enforced, the remainder stays effective.
          A delay in enforcing a provision is not a waiver. Revora may assign
          these Terms as part of a merger, financing, restructuring, or sale of
          the service; you may not assign them without written permission.
          Provisions that by their nature continue after termination—including
          ownership, payment obligations, warranty limits, and liability
          limits—survive.
        </p>

        <h2>Contact</h2>
        <p>
          Questions, refund requests, or legal notices: {" "}
          <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
        </p>

        <p className="result-disclaimer">{copy.disclaimer}</p>
      </section>

      <footer className="page-footer">
        <Link href="/">Back to Revora</Link>
        <Link href="/privacy">Privacy</Link>
      </footer>
    </div>
  );
}
