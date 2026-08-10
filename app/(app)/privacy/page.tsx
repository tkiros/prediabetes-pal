import type { Metadata } from "next";
import Link from "next/link";

import { longitudinalInsightsEnabled } from "../../../lib/longitudinal-insights-flag";
import { photoInputEnabled } from "../../../lib/photo-input-flag";
import { loadSafetyContract } from "../../../lib/revora/safety-contract";
import { SUPPORT_EMAIL } from "../../../lib/revora/contact";

export const metadata: Metadata = {
  title: "Privacy · Revora",
  description: "What Revora collects, why it uses it, and how to control it.",
  alternates: { canonical: "/privacy" }
};

export default function PrivacyPage() {
  const { copy } = loadSafetyContract();
  const operatorName = process.env.LEGAL_ENTITY_NAME?.trim() || "Revora";
  const photoEnabled = photoInputEnabled();
  const insightsEnabled = longitudinalInsightsEnabled();

  return (
    <div className="app-content--narrow">
      <section className="surface-card hero-card">
        <p className="hero-eyebrow">Privacy</p>
        <h1 className="page-title">How Revora handles your data</h1>
        <p className="page-copy">
          Effective 2026-07-12. {operatorName} operates Revora and is
          responsible for the personal information described here. Use Revora
          as a guest with no server-side history, or explicitly consent to an
          account with encrypted, deletable history.
        </p>
      </section>

      <section className="surface-card legal-card">
        <h2>Information you provide</h2>
        <ul>
          <li>a meal description and your latest A1C;</li>
          <li>an email address when you create an account or buy a report;</li>
          {photoEnabled ? <li>optional meal-check photos;</li> : null}
          <li>Pantry Review photos, notes, and corrections;</li>
          <li>reminder preferences and actions you mark complete;</li>
          <li>messages you send to support.</li>
        </ul>

        <h2>How a meal check works</h2>
        <p>
          Revora sends the submitted meal description and A1C to OpenAI&apos;s
          Responses API, routed through the OpenRouter gateway, to generate a
          response. Calls set <code>store: false</code>, which disables default
          API response storage, and Revora does not enable prompt logging at
          OpenRouter. OpenAI and OpenRouter may still retain limited
          abuse-monitoring records under their service terms.
          {photoEnabled
            ? " Meal-check photos are used in memory to draft text for your review and are not saved as meal-check history."
            : " Meal photo-assist is disabled in this release."}
        </p>

        <h2>Guest use</h2>
        <p>
          Revora does not create server-side meal history for a guest. Recent
          checks and onboarding settings may remain in that browser&apos;s local
          storage until you clear the site data. Request data still passes
          through Revora&apos;s hosting provider, OpenRouter, and OpenAI to
          answer the check.
        </p>

        <h2>Account use and explicit consent</h2>
        <p>
          With explicit health-data consent, Revora saves your email, encrypted
          A1C, encrypted meal text, general result category, dates, history,
          progress, and optional reminder registration
          {insightsEnabled ? ", plus derived pattern summaries" : ""}. The purposes
          are to provide saved checks, cross-device history, progress,
          {insightsEnabled ? " personalized pattern summaries," : ""} reminders,
          support, security, and subscription access. Revora does not use this
          information for ads or sell it.
        </p>

        <h2>Pantry Review</h2>
        <p>
          Pantry Review stores photos in private object storage while the report
          is prepared. Revora reads each photo through an authenticated server
          request and sends it to OpenAI to create an item list that you review
          and correct. Photos are deleted after extraction or delivery according
          to the report workflow. Item names, notes, A1C range, and the finished
          report are encrypted at rest until deletion.
        </p>

        <h2>Pantry Review photos</h2>
        <p>
          If you buy a Pantry Review, the photos you upload are held by
          Revora&apos;s storage provider in a private store that requires an
          authenticated server request to read. They are never made public,
          linked to, or indexed. The photo is deleted when the report is delivered;
          within the hour if the order is canceled, refunded, or sent for
          manual review; when you delete your account; and otherwise no later
          than seven days after upload.
        </p>
        <p>
          A vision model through OpenAI&apos;s API (routed via OpenRouter), with{" "}
          <code>store: false</code>,
          reads food items into a list that you review and correct. Item names,
          notes, A1C range, and the finished report are encrypted at rest.
        </p>
        <p>
          {photoEnabled
            ? "Meal-check photos are processed in memory to draft text for your review and are never stored as history. Only confirmed text is checked and, for a consenting signed-in account, saved."
            : "Meal photo-assist is disabled in this release."}
        </p>

        <h2>Service providers and recipients</h2>
        <p>Revora uses these provider categories for the stated purposes:</p>
        <ul>
          <li>
            OpenAI for meal-check responses and Pantry Review extraction
            {photoEnabled ? ", plus meal photo-draft generation" : ""};
          </li>
          <li>OpenRouter as the API gateway routing those model calls;</li>
          <li>Vercel for application hosting and delivery;</li>
          <li>Railway-hosted Postgres for encrypted account data;</li>
          <li>Resend for sign-in, reminder, and service email;</li>
          <li>Google Play and Stripe for purchases and subscription status;</li>
          <li>Sentry for scrubbed error reporting;</li>
          <li>Umami for coarse, non-identifying product analytics;</li>
          <li>browser and push-delivery services when you enable reminders.</li>
        </ul>
        <p>
          These providers may process information in the United States or
          other countries where they operate. Revora limits each provider to
          the information needed for its role and does not send raw meal text,
          exact A1C, or email to analytics or Sentry.
        </p>

        <h2>Security</h2>
        <p>
          Exact A1C, saved meal text, Pantry Review item details, notes, and
          reports use AES-256-GCM encryption at rest. Account routes require an
          authenticated session and scope reads to the account owner. Payment
          card numbers stay with Google Play or Stripe. No security measure can
          eliminate every risk.
        </p>

        <h2>What Revora never does</h2>
        <ul>
          <li>sell or share your personal data,</li>
          <li>show ads,</li>
          <li>store your health data without your explicit consent,</li>
          <li>
            keep health data after the applicable erasure or account-deletion
            flow completes, except for the identity-free completion record and
            transaction records that must remain with payment providers.
          </li>
        </ul>

        <h2>Retention and deletion</h2>
        <ul>
          <li>Guest server input is dropped after the request completes.</li>
          <li>Account health data remains until you erase it or delete the account.</li>
          {photoEnabled ? <li>Meal-check photos are not retained as history.</li> : null}
          <li>Pantry photos are removed by the report workflow after use.</li>
          <li>
            A non-identifying hash and timestamps may remain after deletion to
            prove that a deletion completed.
          </li>
          <li>
            Payment providers may retain transaction records under their own
            legal and accounting obligations.
          </li>
          <li>
            Billing event records (from our payment providers) are kept for up
            to 30 days for payment reliability and dispute handling. Buyer
            contact details are removed from these records as soon as the
            event is processed.
          </li>
        </ul>

        <h2>Your choices and rights</h2>
        <p>
          From Account, you can turn reminders off, withdraw saved-health-data
          consent and erase the saved A1C/history while keeping your login and
          subscription, or delete the whole account. Account deletion is also
          available at <Link href="/account/delete">/account/delete</Link>.
        </p>
        <p>
          You may ask to access, correct, export, or delete personal information
          and may appeal a denied request by replying with “Privacy appeal” to{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>. Revora will
          verify the request using the existing account or another reasonable
          method. Rights vary by location; Revora will honor mandatory rights
          that apply to you.
        </p>

        <h2>Health-data incidents</h2>
        <p>
          Revora investigates unauthorized access or disclosure and will notify
          affected people and authorities when applicable law requires it. A
          notice may arrive by email together with an in-app or website notice.
        </p>

        <h2>Children</h2>
        <p>
          Revora is for adults 18 and older and is not directed to children. If
          you believe a child submitted information, contact {SUPPORT_EMAIL}.
        </p>

        <h2>Changes and contact</h2>
        <p>
          Material changes will appear here with a new effective date and, when
          appropriate, an account notice. Privacy questions and requests:
          {" "}<a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
        </p>

        <p className="result-disclaimer">{copy.disclaimer}</p>
      </section>

      <footer className="page-footer">
        <Link href="/">Back to Revora</Link>
        <Link href="/terms">Terms</Link>
      </footer>
    </div>
  );
}
