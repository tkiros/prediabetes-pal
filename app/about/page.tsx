import type { Metadata } from "next";
import Link from "next/link";

import { SUPPORT_EMAIL } from "../../lib/revora/contact";
import { loadSafetyContract } from "../../lib/revora/safety-contract";

export const metadata: Metadata = {
  title: "About Revora — Who Built It and What It's Built On",
  description:
    "Who makes Revora, the public health sources its guidance is built on, how its copy is governed, and the clinical review that is commissioned but not yet complete.",
  alternates: { canonical: "/about" }
};

// The E-E-A-T page (2026-08-06 SEO plan, Phase 1). Every competitor on both
// the informational and commercial prediabetes SERPs carries a credentialed
// byline; this site had none, and /about 404'd.
//
// ⚠️ THE ONE RULE THIS FILE MUST KEEP. An earlier draft of the SEO plan told
// us to advertise the dietitian review, on the belief that
// `npm run review:dietitian:validate` implied a completed one. It does not.
// docs/qa/dietitian-review/README.md says so in its own words — "does not
// represent a completed clinical review" — clinicalApprovalStatus is
// `pending_external_panel`, all nine clinicalApproverIds are empty, and
// panel-review.json does not exist (only the .example.json placeholder).
//
// So this page may NOT say reviewed, approved, vetted, or endorsed by any
// clinician, and the guides may not carry `reviewedBy` schema. What it says
// instead is that the review is commissioned and pending — which is true,
// checkable, and a better trust signal than a badge. When panel-review.json
// lands with real signed contents, THIS is the file that changes.
//
// ⚠️ WHY THIS PAGE NAMES BODIES, NOT DOCUMENT TITLES.
// An earlier draft rendered all thirteen evidence-pack rows verbatim and
// tripped claims-boundary-copy.test.ts four ways: the ADCES handout's title
// contains a banned word, one policy document is published by an agency whose
// acronym is banned outright (the scanner cannot tell "we cite their policy"
// from "they approved us"), and the two trials trip `study-association`.
//
// /how-it-works holds the two exemptions that let a surface name research —
// deliberately, so exactly one page carries that risk. The fix here was the
// one the audit's own rule asks for: change the copy, not the scanner. Naming
// the issuing bodies is the trust signal; the itemized titles live in
// docs/safety/evidence-pack.md and on /how-it-works. Do not add an exemption
// for this file — move the citation to /how-it-works instead.
const SOURCE_BODIES = [
  // Acronym only, and not by accident: the agency's spelled-out name contains
  // a word the claims scanner bans outright, and the scanner is right not to
  // special-case it — see the block above.
  "the CDC, the US federal public health agency",
  "the National Institute of Diabetes and Digestive and Kidney Diseases (NIDDK)",
  "the Association of Diabetes Care & Education Specialists (ADCES)",
  "the Substance Abuse and Mental Health Services Administration (SAMHSA)",
  "the Federal Trade Commission (FTC)"
] as const;

export default function AboutPage() {
  const { copy } = loadSafetyContract();
  const operatorName = process.env.LEGAL_ENTITY_NAME?.trim() || "Revora";

  // Outside the (app) route group on purpose. In the group this page rendered
  // `ƒ` — the shell's async getPlanBox() forces dynamic, so the E-E-A-T anchor
  // every content page links to would get no prerender and no CDN cache, and
  // would wear the app's sidebar/tab chrome. Out here it builds `○` like the
  // guides, whose layout states the same rule: "the SEO/content surface:
  // standalone document-style pages in the page-shell frame, indexable, no app
  // shell." The frame is inlined rather than given its own layout.tsx —
  // one page does not need one.
  return (
    <>
      <a href="#about-content" className="app-skip">
        Skip to content
      </a>
      <main className="page-shell">
        <div className="page-frame" id="about-content" tabIndex={-1}>
          <nav className="backbar" aria-label="About">
            <Link className="backlink" href="/">
              Revora home
            </Link>
            <Link className="backlink" href="/how-it-works">
              How it works
            </Link>
          </nav>
      <section className="surface-card hero-card">
        <p className="hero-eyebrow">About</p>
        <h1 className="page-title">Who built Revora, and what it stands on</h1>
        <p className="page-copy">
          Revora answers one question: is the plate in front of you a
          reasonable fit for an A1C between 5.7% and 6.4%? This page is the
          part most health sites leave out — who is behind it, what the
          guidance is built on, and what has not been checked yet.
        </p>
      </section>

      <section className="surface-card legal-card">
        <h2>Who makes it</h2>
        <p>
          {operatorName} operates Revora. It is a small independent product,
          not a clinic, not a care provider, and not affiliated with any of the
          public health bodies whose published guidance it draws on.
        </p>

        <h2>Why it exists</h2>
        <p>
          An A1C between 5.7% and 6.4% usually arrives as a number on a lab
          report with very little around it. The advice available afterwards
          tends to come in two sizes: a general article about food groups, or
          an app that asks you to weigh, log, and search a database at every
          meal. Neither answers the question people actually have at dinner.
          Revora does that one thing and tries not to do anything else.
        </p>

        <h2>Who it is for</h2>
        <p>
          Adults using an A1C in the 5.7% to 6.4% range. If the number you
          enter falls outside that range, Revora says so plainly and points you
          to a clinician rather than guessing. That boundary is enforced in the
          product, not just described here.
        </p>

        <h2>What it is not</h2>
        <ul>
          <li>
            not medical advice, and never a substitute for a clinician who
            knows your history;
          </li>
          <li>
            not a predictor — it describes general meal-composition patterns
            and does not estimate how your body will respond;
          </li>
          <li>not a calorie counter, a tracker, or a food log;</li>
          <li>not a device, and not registered with any regulator as one.</li>
        </ul>

        <h2>What the guidance is built on</h2>
        <p>
          Every claim Revora is permitted to make is tied to a published
          source, recorded in an evidence pack that ships in the repository
          alongside the code. Thirteen sources are currently behind the
          product&apos;s copy, published by:
        </p>
        <ul>
          {SOURCE_BODIES.map((body) => (
            <li key={body}>{body}</li>
          ))}
        </ul>
        {/* Points at the evidence pack, NOT at /how-it-works. An earlier draft
            said the itemized list "is on How it works" — that page carries the
            research grounding for the weekly recap, not the thirteen-row
            source table, so the sentence promised something the link did not
            deliver. No scanner catches a cross-page claim; only reading both
            pages does. If the table ever lands on /how-it-works (roadmap 1.9),
            this is the sentence that changes. */}
        <p>
          Two more are peer-reviewed trials on the order foods are eaten in.
          The itemized list — every source, and the exact statement each one is
          allowed to support — lives in the evidence pack that ships with the
          code. For the research behind the weekly recap specifically, see{" "}
          <Link href="/how-it-works">How it works</Link>. Where the evidence
          supports only a general, qualitative statement, Revora is limited to
          a general, qualitative statement.
        </p>

        <h2>How the words are governed</h2>
        <p>
          Health copy drifts. To stop it, every user-facing string that makes a
          claim is registered in a copy ledger alongside the evidence rows
          behind it, and an automated check runs against that ledger on every
          build. The check fails the build if approved copy starts reaching for
          a stronger kind of claim than the boundary allows — anything that
          would turn general education into a personal clinical statement, or
          put a number on an outcome. The same rule covers marketing pages,
          including this one.
        </p>

        <h2>Clinical review: commissioned, not yet complete</h2>
        <p>
          <strong>
            No external clinician has signed off on Revora&apos;s guidance
            copy.
          </strong>{" "}
          We would rather say that here than let the sources above imply
          otherwise.
        </p>
        <p>
          What exists today is engineering verification: the copy has been
          checked line by line against the sources listed above, most recently
          on 2026-07-16, and the clinical safety routes carry recorded evidence
          references. What does not exist yet is independent clinical sign-off.
        </p>
        <p>
          The review is designed and commissioned. The protocol calls for three
          independent reviewers — at least two actively credentialed RDNs, at
          least one who is also a CDCES, with credentials verified and
          conflicts disclosed before review begins. Reviewers see production
          responses in randomized order, with the model identity blinded, and
          record their assessment independently before any discussion. Until
          those results are signed and published, this section will keep saying
          so, and it will change the day they are.
        </p>

        <h2>Your data</h2>
        <p>
          You can use Revora as a guest with no account and no server-side
          history. If you create an account, your history is encrypted and you
          can delete it, and deleting your account removes your data with it.
          The full detail is in the{" "}
          <Link href="/privacy">privacy policy</Link>.
        </p>

        <h2>Contact</h2>
        <p>
          Corrections, questions, or a clinical concern about something Revora
          said:{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>. If you are a
          credentialed RDN or CDCES interested in the review panel, that is the
          same address.
        </p>

        <p className="result-disclaimer">{copy.disclaimer}</p>
      </section>

          <footer className="page-footer">
            <Link href="/">Back to Revora</Link>
            <Link href="/guides">Prediabetes guides</Link>
            <Link href="/privacy">Privacy</Link>
          </footer>
        </div>
      </main>
    </>
  );
}
