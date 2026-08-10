import type { Metadata } from "next";
import Link from "next/link";

import { DemoCheckCard } from "../components/demo-check-card";
import {
  ExampleResultCard,
  LandingVerdictCard
} from "../components/example-result-card";
import { LandingPause } from "../components/landing-pause";
import { TASTER_LIMIT } from "../lib/client/taster-store";
import { FREE_DAILY_CHECKS } from "../lib/free-tier";
import { photoInputEnabled } from "../lib/photo-input-flag";
import { BOUNDARY_DISCLAIMER } from "../lib/revora/boundary-copy";
import { RISK_LABELS } from "../lib/revora/labels";
import { paywallMode } from "../lib/server/pricing";
import { storeWaitlistUrl } from "../lib/waitlist";
import { reading } from "./fonts";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

// One description string for the <meta> tag and the SoftwareApplication
// JSON-LD below, so the two can't drift apart. (Kept under ~160 chars so
// search snippets don't truncate it.)
const LANDING_DESCRIPTION =
  "A meal checker built only for prediabetes. Describe a meal and get cautious labels, reasons, and practical alternatives for the 5.7% to 6.4% A1C range.";

export const metadata: Metadata = {
  title: "Prediabetes Meal Checker — What You Can Eat | Revora",
  description: LANDING_DESCRIPTION,
  // Resolved against metadataBase (app/layout.tsx) to the production origin.
  // Every launch channel is a tagged link (components/attribution-capture.tsx),
  // and ?utm_* variants of this page are 200s with identical content — without
  // this they are crawlable near-duplicates competing with the page itself.
  alternates: { canonical: "/" }
};

/**
 * The marquee band's six lines (`Revora Landing v4 Product.dc.html`, §3).
 *
 * The first three are `home-trust-strip` VERBATIM — the ledger row that used to
 * render as the hero's bullet list. The design shortens the cancel line to
 * "Cancel is one tap — not an email"; it ships with its approved conditional
 * ("If you ever subscribe") intact, because that clause is what keeps a billing
 * promise from applying to a reader who never subscribes.
 *
 * The last three are ledger `landing-marquee-strip` and each restates copy the
 * page already carries: "Nothing to log" is the glance strip's fourth fact,
 * "No weighing, no barcode" is the FAQ's mechanism answer, and "One card, not a
 * dashboard" is the hero caption's "No score, no dashboard" said forward.
 *
 * ⛔ Data, not markup — the band renders this array twice (the second copy is
 * `aria-hidden`, purely so the loop can wrap seamlessly), and two hand-typed
 * lists would drift a word.
 */
const MARQUEE_LINES = [
  "No login for your first checks",
  "When we're unsure, we say so",
  "If you ever subscribe, cancel is one tap — not an email",
  "Nothing to log",
  "No weighing, no barcode",
  "One card, not a dashboard"
];

// Marketing landing (DESIGN.md §Marketing landing). The app lives at /check;
// this page's one job is credibility + the first check. No fabricated social
// proof — the page shows the product's own card instead. All copy here is
// scanned by the claims-boundary audit.
//
// Two hard rules this file must keep (F-04 / F-07, 2026-07-11 claims
// reconciliation):
//  - The adjustment and the swap are CONDITIONAL. A SAFE ("Clear") result is
//    structurally forbidden either one (lib/revora/postprocess.ts
//    assertNoUnsafeSafeFields throws), so no surface may promise them
//    unconditionally. Always hedge: "when there's one". The Clear example
//    card below demonstrates this rather than asserting it — it carries no
//    adjustment and no swap, because the engine cannot produce them there.
//  - The free tier is TASTER_LIMIT checks on day one only, device-local. The
//    number is interpolated from lib/client/taster-store.ts — never retyped —
//    so the store listing, the landing page, and the meter can't drift apart.
//    (Importing the constant is safe from a server component: taster-store
//    touches `window` only inside function bodies.)
//
// Verdict words come from lib/revora/labels.ts (RISK_LABELS) — never retyped.
//
// Surface treatment: alternating planes (DESIGN.md §11). `Revora Landing v4
// Product.dc.html` keeps the alternation and re-sequences it — page · sheet ·
// page · accent band · sheet · page · sheet · page · sheet · page — so the two
// dark grounds (the hero showpiece and the what-changes band) are the only
// tonal breaks and they sit a third of the page apart.
// The primary CTA, assembled once. Every instance on this page is the same
// button with the same destination and the same optional caption underneath;
// hand-building it per section is how the five copies drifted into four
// different shapes. `spaced` adds the top margin sections need when the CTA
// follows a block of content rather than sitting in a gap-managed grid.
// `onDark` inverts the pill for the accent-ground sections. The modifier goes
// on the WRAPPER, not the pill: the inversion is done by
// `.landing-cta-stack--on-dark .landing-cta` in CSS, so the Link's own class
// attribute stays a bare literal. That is load-bearing —
// landing-design-guards.test.ts counts bare occurrences of it to prove the
// filled pill is assembled exactly once, so interpolating the class onto the
// Link would zero that count. (Nor may this comment spell the attribute out:
// the same scan counts matches in comments, and quoting it here reads as a
// second hand-built pill. It cost a full vitest cycle to learn that.)
function LandingPrimaryCta({
  hint,
  spaced = false,
  onDark = false
}: {
  hint?: string;
  spaced?: boolean;
  onDark?: boolean;
}) {
  return (
    <div
      className={`landing-cta-stack${spaced ? " landing-cta-stack--spaced" : ""}${onDark ? " landing-cta-stack--on-dark" : ""}`}
    >
      <Link className="landing-cta" href="/check">
        Check your first meal — free
      </Link>
      {hint ? <p className="landing-cta-hint">{hint}</p> : null}
    </div>
  );
}

export default function LandingPage() {
  const androidWaitlist = storeWaitlistUrl("android");
  const iosWaitlist = storeWaitlistUrl("ios");
  const photoEnabled = photoInputEnabled();
  // §0.2 #4 — this page names NO amount, anywhere. The pricing section was
  // deleted on owner instruction 2026-08-05 ("the price should not be
  // mentioned, only focus on free check"), which satisfies the rule the
  // strongest way available: a page with no price on it cannot show a price
  // checkout won't charge.
  //
  // What survives is the one place the page still describes what happens
  // after the free checks — the FAQ answer below. It stays branch-aware off
  // the same server flag checkout enforces, because "do I need a card?" has a
  // different true answer in each mode, and answering it wrong is the one
  // unforced error this audience never forgives.
  const trialMode = paywallMode() === "trial";
  // FAQ copy as data: the visible <details> list and the FAQPage JSON-LD
  // render from these same strings, so the schema can never drift from the
  // page. Scanned by the claims-boundary audit like every string here.
  const faqs: Array<{ q: string; a: string }> = [
    {
      // The design file's rewrite, adopted with exactly one clause changed.
      // It writes "It does not diagnose anything" — and the banned-family
      // regex in claims-boundary-copy.test.ts is NEGATION-BLIND by design, so
      // a denial of a banned claim still trips it. That is not a bug to work
      // around: the audit cannot tell a denial from an assertion, and the
      // safe direction is to never print the token. "Identify any condition"
      // carries the same meaning at the same length and keeps the design's
      // three-clause rhythm.
      q: "Is Revora medical advice?",
      a: "No. Revora is informational only and gives general educational information about meal composition. It does not identify any condition, does not predict your individual response, and does not replace a doctor or registered dietitian. Talk with a clinician for guidance that is specific to you."
    },
    {
      q: "Who is Revora for?",
      a: "People in the prediabetes A1C range of 5.7% to 6.4%. If your number falls outside that range, Revora says so plainly and points you to a clinician instead of pretending."
    },
    {
      // ⛔ THE DESIGN FILE DRAWS THIS ROW EXPANDED. It ships collapsed, and
      // the reason is measured, not aesthetic: this is the longest answer on
      // the page, and open by default it added 246px to the stretch between
      // the limits block's exit and the final one — 2,034px against the
      // 2,001px reachability budget (DESIGN.md §11.1), which fails the build.
      // A row drawn open in a mockup is a mockup showing what open looks
      // like. If it should genuinely ship open, the budget has to be paid for
      // somewhere else first — an exit at the foot of the offer ladder is the
      // obvious candidate — and re-measured: node scripts/measure-landing.mjs
      q: "Do I need an account or a card to try it?",
      a: trialMode
        ? `No. Your first ${TASTER_LIMIT} checks, on your first day, need no login and no card. They live on this device only. The 7-day free trial needs a card but charges nothing for a week, and we email you before any charge.`
        : `No. Your first ${TASTER_LIMIT} checks, on your first day, need no login and no card. They live on this device only. After that, a free account includes ${FREE_DAILY_CHECKS} free checks a day, still no card. Premium is optional, and cancels in one tap.`
    },
    ...(photoEnabled
      ? [
          {
            q: "How does the photo check work?",
            a: "Your photo becomes a draft list of what's on the plate. You review and confirm the words before anything is checked. The photo never skips your judgment. Photos are not kept."
          }
        ]
      : []),
    {
      // 🆕 2026-08-06, the v2 design's one added question. "Say it" is a
      // shipped affordance, not an aspiration — .voice-input in globals.css
      // and inputMethod: z.enum(["text","voice","photo"]) in the history
      // handler. Do not let it drift into naming photo input, which is
      // gated above and off.
      q: "What do I actually have to do?",
      a: "Describe the meal in your own words — type it or say it. No weighing, no barcode, no portion sizes, no food database to search. If the description is ambiguous, Revora asks one question."
    },
    {
      q: "How do I cancel?",
      a: "One tap, on your account page, effective at the end of the paid period. No retention screens, no email hoops. Deleting your account removes your data with it."
    }
  ];
  // Machine-readable summary for Google rich results and AI answer engines.
  // Every string is either shared with the visible page (LANDING_DESCRIPTION,
  // faqs) or an interpolated constant — nothing is claimed here that the page
  // doesn't already say.
  // No `offers` node on purpose: this page names no amount at all (§0.2 #4),
  // and a schema.org price would put one back — invisible to the reader, and
  // still a hardcoded claim outside the live server flags.
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "SoftwareApplication",
        "@id": `${APP_URL}/#app`,
        name: "Revora",
        url: APP_URL,
        description: LANDING_DESCRIPTION,
        applicationCategory: "HealthApplication",
        operatingSystem: "Web",
        publisher: {
          "@type": "Organization",
          name: "Revora",
          url: APP_URL,
          // The brand descriptor, machine-readable. app/layout.tsx's openGraph
          // siteName says "Revora — Prediabetes Meal Checker" and the Play
          // listing now says the same; this node carried no descriptor at all,
          // which is the one place the category was missing for answer engines.
          // It costs zero visible pixels — the H1 already states the category
          // for a human reader, and stating it twice above the fold is the
          // eyebrow that ledger `landing-hero-moment` deleted once.
          slogan: "The prediabetes meal checker",
          logo: `${APP_URL}/icon-512.png`
        }
      },
      {
        "@type": "FAQPage",
        "@id": `${APP_URL}/#faq`,
        url: APP_URL,
        mainEntity: faqs.map(({ q, a }) => ({
          "@type": "Question",
          name: q,
          acceptedAnswer: { "@type": "Answer", text: a }
        }))
      }
    ]
  };
  return (
    <>
      <script
        type="application/ld+json"
        // <-escape so no string could ever terminate the script block.
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c")
        }}
      />
      {/* Same skip affordance the app shell has (DESIGN.md §App shell), and
          like the shell it lives OUTSIDE <main> — a skip link inside the
          landmark it skips within is announced as main content. Being outside
          also keeps <main>'s first child the one page frame. */}
      <a href="#landing-hero" className="app-skip">
        Skip to content
      </a>
      {/* reading.className: the load-bearing source of the landing body
          family (app/fonts.ts). */}
      <main className={`landing ${reading.className}`}>
      <div className="landing-frame">
        {/* ── Nav ───────────────────────────────────────────────
            ⚖️ A STICKY TRANSLUCENT CAPSULE, the v4 design file's, adopted on
            the owner's 2026-08-08 ruling. It overturns DESIGN.md §13 #8's
            "decorative glassmorphism": the blur here is not decoration, it is
            what keeps a pill that floats over scrolling copy legible without
            going fully opaque. ⚠️ `position: sticky` survives only because
            `overflow-x: clip` lives on `html` and not on any ancestor between
            this nav and the viewport — see `.landing` in globals.css. */}
        <nav className="landing-nav" aria-label="Main">
          <Link className="landing-wordmark" href="/">
            Revora
          </Link>
          {/* ponytail: below 640px the link row collapses to the wordmark +
              the one CTA. It used to wrap to a 136px two-row block with the
              wordmark floating between the rows. Every hidden link is still
              reachable by scrolling and is repeated in the footer, so this
              costs no navigation. */}
          <div className="landing-nav-links">
            {/* An in-page anchor now, not a route. The steps block below is
                what "How it works" means to a reader, and /how-it-works is a
                methodology disclosure — "What's measured", "The research this
                is grounded in", "An honest limit". The footer keeps the route
                under a label that says what the page actually is. */}
            <a href="#how-it-works">How it works</a>
            {/* The design file's second nav link is the FAQ, not the Pantry
                Review. Nothing is lost — the Pantry Review keeps its footer
                entry — and this points at the block a hesitant reader is
                actually looking for. */}
            <a href="#faq">Fair questions</a>
          </div>
          {/* Ghost, not filled: one filled pill per viewport (DESIGN.md
              §Marketing landing) — the hero CTA is the filled one. */}
          <Link className="landing-cta landing-cta--sm landing-cta--ghost" href="/check">
            Check a meal
          </Link>
        </nav>

        {/* ── Hero ──────────────────────────────────────────────
            tabIndex={-1}: the skip link must MOVE FOCUS here, not just
            scroll — same as the app shell's #app-content target.

            ⚖️ CENTRED, with an eyebrow, both the v4 design file's. The eyebrow
            is NOT the one ledger `landing-hero-moment` deleted: that one
            restated the H1's category ("the prediabetes meal checker" above "A
            meal checker built only for prediabetes"). This one states the
            RANGE, which the H1 does not, and which every other Approved row
            uses as its scope-first framing. It says who the page is for before
            the headline says what the thing is. */}
        <section className="landing-hero" id="landing-hero" tabIndex={-1}>
          <p className="landing-hero-eyebrow">For an A1C of 5.7–6.4%</p>
          {/* The category answer IS the headline — it used to be an eyebrow
              above a headline that said the same thing twice (ledger
              `landing-hero-moment`). */}
          <h1 className="landing-h1">
            A meal checker built only for prediabetes.
          </h1>
          {/* `the plate in front of you` is load-bearing and may not be cut
              for pixels: the H1 reads categorised, not recognised, and this
              is the only second-person, present-tense, concrete object above
              the fold. 33 words is a recorded, measured deviation from the
              20-word ceiling. */}
          <p className="landing-sub">
            Describe the plate in front of you. One card back: where it
            lands, why, and a change worth making when there is one. For an
            A1C of 5.7% to 6.4%. Nothing to log.
          </p>
          <LandingPrimaryCta
            hint={`${TASTER_LIMIT} free checks on your first day, then you decide.`}
          />
        </section>

        {/* ── The showpiece ─────────────────────────────────────
            The v4 design file's signature moment: the input screen and the
            card it returns, side by side on the page's first dark ground.

            ⛔ BOTH HALVES ARE REAL, neither is drawn. The design mocks up a
            handset with invented values because a static drawing cannot embed
            a live screen; the rule this page has held since 2026-08-05 is that
            drawn UI in a mockup means "the product's screen goes here". Left
            is a real capture of /check (`node scripts/capture-landing-art.mjs`),
            right is the product's own result component rendered from the same
            fixture block 4's first card reads — which is exactly what block 4's
            note tells the reader.

            ⛔ The card's label renders from demoExampleEyebrow(null) inside the
            component, never typed here: the day an authorised live capture
            lands, that function returns "A real check, captured <date>" and a
            hand-written "An illustrated example" becomes a false claim.

            ⛔ The capture bakes the free-check count in as PIXELS. That is the
            one number every other surface interpolates from TASTER_LIMIT so it
            cannot drift, and no copy audit can read a PNG. landing-art.test.ts
            pins the coupling: move TASTER_LIMIT and it fails, naming the
            re-capture command. */}
        <section className="landing-showpiece">
          <div className="landing-showpiece-panel">
            <div className="landing-showpiece-grid">
              <div className="landing-showpiece-art">
                <img
                  src="/landing/app-check.png"
                  alt="The Revora check screen on a phone: one box to describe the meal, one field for your latest A1C, and a button to check it."
                  width={390}
                  height={700}
                  loading="lazy"
                  decoding="async"
                />
              </div>
              <div className="landing-showpiece-card">
                <ExampleResultCard risk="SAFE" labelled withFineprint />
              </div>
            </div>
          </div>
          <p className="landing-card-caption">
            This is the whole screen. No score, no dashboard, no change to
            make: this meal already looks balanced, so that is the whole
            answer.
          </p>
        </section>

        {/* ── The marquee ───────────────────────────────────────
            ⚖️ THE PAGE'S THIRD KEYFRAME, and DESIGN.md §6 said there were two.
            Amended 2026-08-08 on the owner's ruling that the v4 design file
            governs. The band is a full-bleed white sheet in the alternation,
            so it does double duty: it carries the six de-risking facts the
            hero's bullet list used to carry, and it is the plane change
            between the hero and the glance strip.

            ⛔ The list renders TWICE. The first copy is the real list — ledger
            `home-trust-strip` plus `landing-marquee-strip`, `role="list"`, and
            the one `tests/smoke/landing-a11y.spec.ts` asserts on. The second
            is `aria-hidden` and exists only so the -50% translate wraps with no
            visible seam; without it the strip would flick back to the start.
            A screen reader hears the six lines once.

            ⚠️ The animation stops on hover and on keyboard focus, and the
            global prefers-reduced-motion block zeroes it outright. Moving text
            that cannot be stopped is a WCAG 2.2.2 failure that axe does not
            detect, so neither guard is optional. */}
        <div className="landing-marquee">
          <div className="landing-marquee-track">
            <ul className="landing-trust-strip" role="list">
              {MARQUEE_LINES.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <ul className="landing-marquee-echo" aria-hidden="true">
              {MARQUEE_LINES.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        </div>

        {/* ── At a glance ───────────────────────────────────────
            Ledger `landing-glance-strip`.

            ⛔ The first stat used to read "10 seconds" and does not any more.
            Nobody ever measured it, and a latency claim is falsifiable by any
            reader on a slow connection — it was the only unsubstantiated
            claim on the page. "Seconds, not sessions" makes the same argument
            (this is not a logging app) with nothing left to miss.

            Rule-topped, not carded: these are four facts in a row, and a
            border-top is all the styling they get. */}
        <section className="landing-section landing-glance-section">
          <ul className="landing-glance" role="list">
            <li>
              {/* The break is the design file's and it is deliberate: this is
                  the one fact of the four that is a two-part contrast rather
                  than a value, and letting it wrap on its own put "not" at
                  the end of line one at some widths. */}
              <span className="landing-glance-fact">
                Seconds,
                <br />
                not sessions
              </span>
              <span className="landing-glance-label">
                from describing the meal to the answer
              </span>
            </li>
            <li>
              <span className="landing-glance-fact">5.7–6.4%</span>
              <span className="landing-glance-label">
                if your A1C is here, this was built for you
              </span>
            </li>
            <li>
              {/* Interpolated, never typed — same constant the hero caption
                  and the FAQ answer read from (copy-pins.test.ts). */}
              <span className="landing-glance-fact">
                {TASTER_LIMIT} free checks
              </span>
              <span className="landing-glance-label">
                on day one, no login and no card
              </span>
            </li>
            <li>
              <span className="landing-glance-fact">Nothing to log</span>
              <span className="landing-glance-label">
                no weighing, no calories, no macros, ever
              </span>
            </li>
          </ul>
          {/* ⚠️ MEASURED POSITION (DESIGN.md §11.1), and the one exit in this
              stretch the design file does not draw.

              The design puts no CTA between the hero and the problem block.
              That holds at the 1280px it was drawn at and fails at the 375px
              the budget is measured at: stacked, the showpiece and the strip
              put ~1,600px between the hero's exit and the next one. One pill
              fixes it, and it belongs here rather than at the foot of the
              problem block — it lands directly under four reasons to try the
              thing, and it splits the stretch roughly evenly instead of
              leaving the first half over budget. Re-measure before moving it:
              node scripts/measure-landing.mjs */}
          <LandingPrimaryCta spaced />
        </section>

        {/* ── The problem ────────────────────────────────────────
            ⚖️ FOUR CARDS WITH GHOST NUMERALS, the v4 design file's, adopted on
            the owner's 2026-08-08 ruling. This overturns two things at once:
            the block's own "typography, not cards — boxing them would make
            them look like features", and DESIGN.md §13 #8's "identical card
            grids" and "numbered section markers as scaffolding".

            What contains the risk the old rule was protecting: these cards sit
            on a white SHEET and are `--page-bg`, so they are the one card
            family on this page that is not white — they cannot be confused
            with the result card, and the sheet cannot be confused with them.
            The numeral is `--accent-tint` behind the heading, not a label
            beside it, so it reads as texture rather than as a step in a
            sequence the reader has to follow.

            ⚠️ Sticky was dropped with the two-column layout: the design puts
            the head above a 2×2 grid, so there is nothing to hold in view. */}
        <section className="landing-section landing-section--sheet landing-problem">
          <div className="landing-section-head landing-problem-head">
            <h2 className="landing-h2">
              Six months is a long time to guess.
            </h2>
            <p className="landing-section-lede">
              Nobody handed you a plan. You were handed a number, two words
              of advice, and an appointment half a year away. Everything in
              between is supposed to be your job to figure out.
            </p>
          </div>
          {/* An <ol>, numbered by CSS counter rather than by typing "01" into
              the markup. The design draws the numerals as content; a real list
              gets the same pixels, keeps the sequence in the accessibility
              tree, and cannot fall out of order when someone inserts a fifth
              pain. */}
          <ol className="landing-pains">
            <li>
              <h3>The advice was two words long.</h3>
              <p>
                “Eat better.” Better than what? Is oatmeal fine? Is the
                sandwich at lunch a problem? Nobody said, and the appointment
                is in six months.
              </p>
            </li>
            <li>
              <h3>Every article contradicts the last one.</h3>
              <p>
                Fruit is fine, fruit is sugar. Rice is out, brown rice is in.
                You have read all of it and you still do not know about the
                plate in front of you tonight.
              </p>
            </li>
            <li>
              <h3>The apps want you to become an accountant.</h3>
              <p>
                Weigh it, log it, scan the barcode, hit your macros. You did
                not ask for a second job. You asked what to do about dinner.
              </p>
            </li>
            <li>
              <h3>So you guess, and then you worry.</h3>
              <p>
                You eat the thing, and spend the next hour wondering whether
                it was a mistake. That loop is the actual cost of being told
                nothing.
              </p>
            </li>
          </ol>
        </section>

        {/* ── Scope ─────────────────────────────────────────────
            ⚖️ A TINTED PANEL, the v4 design file's, in place of the white
            sheet + phone capture this block used to be. The capture moved up
            into the showpiece, where the design draws it and where it is the
            hero's evidence rather than a decoration beside a sentence.

            `--accent-tint` is a fill, not a plane: the section itself stays on
            the page ground, so the strict sheet alternation is untouched.

            ⚠️ MEASURED POSITION (DESIGN.md §11.1). The exit stays inside the
            panel. Re-measure before moving it: node scripts/measure-landing.mjs */}
        <section className="landing-section landing-scope">
          <div className="landing-scope-panel">
            <div className="landing-scope-grid">
              <p className="landing-scope-display">
                Revora exists for that gap and nothing else.
              </p>
              <div className="landing-scope-copy">
                <p className="landing-section-lede">
                  If your A1C sits outside 5.7% to 6.4%, it says so plainly and
                  points you to a clinician instead of pretending.
                </p>
                <LandingPrimaryCta
                  hint="No login, no card, nothing to install."
                  spaced
                />
              </div>
            </div>
          </div>
        </section>

        {/* ── What actually changes ─────────────────────────────
            Ledger `landing-what-changes`. The page's one `--accent-strong`
            full-bleed band.

            ⚖️ TWO COLUMNS NOW — "Today" beside "With Revora", the v4 design
            file's, in place of the interleaved now/after pairs. The pairing
            survives: row N of the left column is row N of the right, and the
            two columns stack in that order on a phone, so the reading order is
            the same sequence the pairs were.

            ⛔ Every "after" state is a BEHAVIOUR the reader performs, never a
            number that moves. That is what keeps this block on the safe side
            of the outcome-claim line, and it is why the lede says "Not a
            transformation" before the list rather than after it. */}
        <section className="landing-section landing-changes">
          <div className="landing-section-head">
            <h2 className="landing-h2">What actually changes</h2>
            <p className="landing-section-lede">
              Not a transformation. Four specific moments in your week that
              stop being hard.
            </p>
          </div>
          <div className="landing-changes-cols">
            <div className="landing-changes-col">
              <p className="landing-changes-heading">Today</p>
              <ul className="landing-changes-list" role="list">
                <li className="landing-changes-now">
                  Tonight you stand at the counter and guess.
                </li>
                <li className="landing-changes-now">
                  You read three articles at 11pm and they disagree.
                </li>
                <li className="landing-changes-now">
                  Eating out means ordering and then quietly worrying.
                </li>
                <li className="landing-changes-now">
                  Six months of meals, and nothing to show your doctor.
                </li>
              </ul>
            </div>
            <div className="landing-changes-col">
              <p className="landing-changes-heading landing-changes-heading--after">
                With Revora
              </p>
              <ul className="landing-changes-list" role="list">
                <li className="landing-changes-after">
                  You describe the plate and know where it lands before you sit
                  down.
                </li>
                <li className="landing-changes-after">
                  You ask about the one meal in front of you and stop reading.
                </li>
                <li className="landing-changes-after">
                  You check the menu item at the table and order on purpose.
                </li>
                <li className="landing-changes-after">
                  A saved history of what you actually ate, in your own words.
                </li>
              </ul>
            </div>
          </div>
          {/* ⚠️ MEASURED POSITION (DESIGN.md §11.1). The design file puts no
              exit in this section. It has to have one: with no CTA between the
              scope block and the steps block, that stretch runs the length of
              the band plus a section head. Re-measure before removing it:
              node scripts/measure-landing.mjs */}
          <LandingPrimaryCta spaced onDark />
        </section>

        {/* ── How it works ──────────────────────────────────────
            ⭐ NEW 2026-08-08, the v4 design file's §6, and the block the page
            has been missing since the old how-it-works section was deleted.
            "What do I actually do" was answerable only from a collapsed FAQ
            row ten sections down, while the nav link pointed at
            /how-it-works — a methodology disclosure, not steps.

            ⚖️ THE STEP PILLS ARE THE DESIGN FILE'S, and DESIGN.md §13 #8 lists
            "Step N eyebrows" as a confirmed anti-pattern (7/7). Overturned on
            the owner's 2026-08-08 ruling. What the tournament was scoring was
            a step eyebrow on a block that sold TYPING AND TALKING as the
            mechanism — the same §13 row bans that separately. These three
            steps name the product's actual conduct, and step two is the one
            the page is built to earn: it asks instead of guessing.

            ⛔ Step two's artifact is the real clarify flow, never a drawing.
            The three interaction strings come from the promise registry via
            DemoCheckCard — promise-registry.test pins them to the precheck's
            real output, so this scene cannot drift from the product. The
            card's first line — the one showing what the reader entered — is
            STATIC TEXT and must never become an input: no element, not
            focusable, no caret. (Quoting that line here verbatim goes red, and
            should: the pin strips only comment-LEADING lines, so a JSX comment
            is scanned like rendered markup.) */}
        <section
          className="landing-section landing-section--sheet landing-steps-section"
          id="how-it-works"
        >
          <div className="landing-section-head">
            <h2 className="landing-h2">It asks before it guesses</h2>
            <p className="landing-section-lede">
              Type “oatmeal” and Revora asks whether it is plain or sweetened,
              because the honest answer depends on it. Three steps, and
              nothing to weigh, log or look up in any of them.
            </p>
          </div>
          <ol className="landing-steps">
            <li className="landing-step landing-step--art">
              <div className="landing-step-copy">
                <span className="landing-step-pill">Step one</span>
                <h3>Describe the plate in front of you</h3>
                <p>
                  In your own words — type it or say it. No weighing, no
                  barcode, no portion sizes, no food database to search.
                </p>
              </div>
              {/* The same real capture the showpiece carries, and the design
                  file duplicates it the same way — it draws the input screen
                  in the hero AND again here, with different text typed. ⛔
                  alt="" is deliberate and is not laziness: the paragraph
                  beside it describes this screen in words, so a second full
                  alt would make a screen reader hear the same thing twice.
                  The showpiece's copy carries the described version, which is
                  the one landing-art.test.ts pins. */}
              <div className="landing-step-art landing-step-art--shot">
                <img
                  src="/landing/app-check.png"
                  alt=""
                  width={390}
                  height={700}
                  loading="lazy"
                  decoding="async"
                />
              </div>
            </li>
            <li className="landing-step landing-step--art">
              <div className="landing-step-copy">
                <span className="landing-step-pill">Step two</span>
                <h3>One question, when it needs one</h3>
                <p>
                  If a food is ambiguous, Revora asks one clarifying question
                  instead of guessing — and errs on the careful side.
                </p>
                <p className="landing-step-punch">
                  Without that one question, Revora would have been guessing.
                </p>
                {/* ⛔ A text link, not a pill, and no filled CTA inside the
                    steps — the absence is the argument. It is also the page's
                    most important non-primary CTA: four of the five cards on
                    this page are fixtures, and this is the one place a reader
                    can make the product do the thing. Instrument it separately
                    from the primary CTA from day one.

                    ⚠️ MEASURED POSITION (DESIGN.md §11.1). The design file
                    draws it under step three. It sits under step two because
                    that is where it measures AND where it belongs: its subject
                    is the oatmeal question, which is step two, and at the foot
                    of step three it left 2,172px between the dark band's exit
                    and itself — 171px over budget, a hard build failure.
                    Re-measure before moving it back:
                    node scripts/measure-landing.mjs */}
                <Link className="landing-dare" href="/check">
                  Type “oatmeal” and see what it asks you.
                </Link>
              </div>
              <div className="landing-step-art">
                {/* The design file's six-row label-gutter table. The layout is
                    a prop rather than the component's only shape because
                    `/check` and `/demo` render this same component, and a
                    marketing drawing does not get to restyle an in-app
                    surface. */}
                <LandingPause>
                  <DemoCheckCard layout="table" />
                </LandingPause>
              </div>
            </li>
            {/* ⛔ NO ART, and the copy says why: this step hands off to the
                three cards in the very next section, which are its
                illustration. A fourth rendering of the same card here would
                make the block below restate itself. Styled as a centred coda
                so the missing right column reads as a close rather than as a
                two-column block that failed to fill. */}
            <li className="landing-step landing-step--close">
              <div className="landing-step-copy">
                <span className="landing-step-pill">Step three</span>
                <h3>One card, and you are done</h3>
                <p>
                  Where it lands, why, and a change worth making when there is
                  one. The three cards below are the three shapes that answer
                  can take.
                </p>
              </div>
            </li>
          </ol>
          {/* ⚠️ MEASURED POSITION (DESIGN.md §11.1), and an exit the design
              file does not draw. This section is the page's tallest at 375px —
              a head, three steps and the demo card — and with only the dare
              link inside it the stretch from the dark band's exit to the three
              answers' ran over budget however the link was placed. Two exits
              inside the block split it into three legal stretches; one does
              not. Re-measure before removing it:
              node scripts/measure-landing.mjs */}
          <LandingPrimaryCta spaced />
        </section>

        {/* ── The three answers ─────────────────────────────────── */}
        <section className="landing-section" id="live-example">
          <div className="landing-section-head">
            {/* AUD-008: "the kind of answer", not "the actual answer" — the
                cards below are illustrations until a live capture exists. */}
            <h2 className="landing-h2">The same card, three times.</h2>
            {/* Sentence 2 exists because the showpiece's card and card 1 below
                are byte-identical — same meal, same result-safe-example row —
                under an H2 that says "three times". Naming the duplicate
                converts it into the block's evidence; a fourth meal fixture
                would cost two ledger rows to say less. */}
            <p className="landing-section-lede">
              One layout, whatever the answer is. The first card is the one
              from the top of this page, next to the two you have not seen.
              The {RISK_LABELS.SAFE} card carries no change to make, because
              when a meal already looks balanced Revora says so and stops. It
              does not invent a correction to look useful.
            </p>
          </div>
          {/* ⚖️ THE DESIGN FILE'S FLAT CARD, NOT THE PRODUCT'S — owner ruling,
              2026-08-06, taken with the cost stated. Until then these were
              three instances of the real card, and the page's thesis was that
              marketing shows the product's artifact unmodified. The design
              file draws illustrations instead and the owner chose the design
              file. What survives of the old rule: both families read the
              one fixture set in example-result-card.tsx, so these cannot drift
              from the real card's WORDS — only from its recipe. See that
              file's note on LandingVerdictCard, and DESIGN.md §11. */}
          <div className="landing-verdicts">
            <LandingVerdictCard risk="SAFE" />
            <LandingVerdictCard risk="MODERATE" />
            <LandingVerdictCard risk="HIGH" />
          </div>
          {/* The design's closing row: the note left, the pill right, one
              line at desk width and stacked once they no longer fit. */}
          <div className="landing-verdict-close">
            <p className="landing-verdict-note">
              Illustrated examples. Every card ends with the same line: Revora
              is informational only and is not medical advice.
            </p>
            <LandingPrimaryCta />
          </div>
        </section>

        {/* ── Limits ────────────────────────────────────────────
            Ledger `landing-limits-trio` covers the two commitment cards; the
            third is BOUNDARY_DISCLAIMER, which renders from its constant in
            the footer and is ledgered with it. */}
        <section className="landing-section landing-section--sheet">
          <div className="landing-section-head">
            <h2 className="landing-h2">Calm, and honest about its limits</h2>
            <p className="landing-section-lede">
              No miracle promises. Revora earns trust the slow way — by
              telling you exactly what it measures and where it stops.
            </p>
          </div>
          {/* ⚖️ THREE EQUAL CARDS, the v4 design file's. This was a two-column
              split — a wide sources card beside a stacked trio — which left
              the sources column ending half a section above the last card.
              The design puts all three in one `minmax(290px, 1fr)` row, and
              merges the data promise and the boundary line into the third,
              which is why that card carries two headings. */}
          <div className="landing-limits">
            {/* The sources, ledger `landing-sources-note`. The proof band that used to carry them
              is gone: a component whose primary affordance — a stat slot —
              has to be neutered for the content to be safe is the wrong
              component. Rail 7 is now discharged structurally, because no
              number-shaped slot exists to put a number into, rather than by a
              CSS comment asking nobody to. The one cited-trial statistic in
              the corpus stays off this page — family `study-association`,
              exempt only on /how-it-works. (Naming that trial here, even in
              a comment, goes red: claims-boundary-copy.test.ts strips only
              comment-LEADING lines, so a JSX comment is audited exactly like
              rendered copy. It caught two drafts of this very note.) */}
          <div className="landing-sources">
            <h3>Sources</h3>
            <p>
              Revora&apos;s general meal-planning principles map to
              public-health guidance and cited nutrition research — that carbs
              raise blood sugar, that pairing them with protein, fibre or
              nonstarchy vegetables can slow the rise, and that less-refined
              carbs generally land more gently than highly refined ones.
            </p>
            <p>
              Those sources support narrow educational statements about food.
              They are not evidence that Revora produces a particular health
              result, and nothing on this page claims otherwise.
            </p>
            <p>
              <Link className="inline-link" href="/how-it-works">
                Read the sources and the limits
              </Link>
              .
            </p>
            </div>
            {/* Ledger `landing-limits-trio`. Both of these are falsifiable
                against shipped behaviour rather than being assertions — which
                is the only reason they are allowed to sit under a heading
                about honesty. The clarify claim is the one DemoCheckCard
                renders from the promise registry two blocks up; the consent
                clause was checked against schema.ts (`consentedAt`, notNull)
                and /privacy, which lists storing health data without explicit
                consent among the things Revora does not do. */}
            <div className="landing-limits-card">
              <h3>When we&apos;re unsure, we say so</h3>
              <p>
                If a food is ambiguous, Revora asks one clarifying question
                instead of guessing — and errs on the careful side.
              </p>
            </div>
            <div className="landing-limits-card">
              <h3>Your health data stays yours</h3>
              <p>
                Your A1C and meal text are encrypted at rest, stored only with
                your explicit consent, and deleted — all of it — in one tap.
              </p>
              <h3>Not medical advice</h3>
              {/* The constant, not a retyped copy — the footer renders the
                  same string from the same import. */}
              <p>{BOUNDARY_DISCLAIMER}</p>
            </div>
          </div>
          {/* ⚠️ MEASURED POSITION (§11.1) — this and the exit in the dark band
              are what keep the back half of the page legal. */}
          <LandingPrimaryCta spaced />
        </section>

        {/* ── The offer ─────────────────────────────────────────
            Ledger `landing-offer-stages` (+ `landing-what-you-get` for stage
            3's body).

            ⛔ NO AMOUNT, EVER. This block exists precisely because deleting
            every price left the reader learning a card was involved at the
            trial wall, which is the bait-and-switch the honesty positioning
            exists to rule out. It fixes that by disclosing the SHAPE of the
            ladder and promising the figure arrives before any charge — not by
            putting the figure back. Adding one here re-breaks §0.2 #4 and
            fails landing-paywall-copy.test.ts on the spot.

            Stage 2 branches off the same live flag the FAQ does, for the same
            reason: "what happens after day one" has a different true answer
            per mode, and copy-pins asserts on RENDERED output that trial
            never claims a daily allowance while legacy always does.

            ⚖️ CARDED NOW, the v4 design file's, with stage 3 tinted. The note
            left when the `.landing-price-*` tiles were deleted said a
            replacement should earn the system's one shadow rather than
            inherit it — these do not take it. Border and radius only. */}
        <section className="landing-section landing-offer-section">
          <div className="landing-section-head">
            <h2 className="landing-h2">Try it before you pay a cent</h2>
            <p className="landing-section-lede">
              Three stages, and you find out the exact cost before any of them
              charges you.
            </p>
          </div>
          <ol className="landing-offer">
            <li>
              <span className="landing-offer-when">Day one</span>
              <span className="landing-offer-what">
                {TASTER_LIMIT} free checks
              </span>
              <p>
                No login, no card. See how the answers feel at your own table.
              </p>
            </li>
            <li>
              <span className="landing-offer-when">
                {trialMode ? "Your free week" : "After day one"}
              </span>
              <span className="landing-offer-what">
                {trialMode
                  ? "Seven days free"
                  : `${FREE_DAILY_CHECKS} free checks a day`}
              </span>
              <p>
                {trialMode
                  ? "A card is required and nothing is charged. Before it ends, we email you the exact date and amount."
                  : "A free account, still no card. Keep checking at your own pace and see whether it earns a place in your week."}
              </p>
            </li>
            <li className="landing-offer-final">
              <span className="landing-offer-when">After that</span>
              <span className="landing-offer-what">You decide</span>
              <p>
                Unlimited checks, your history on every device, and one
                optional reminder. Cancel in one tap from your account page —
                not an email.
              </p>
            </li>
          </ol>
          <p className="landing-offer-note">
            Nothing here renews without telling you first.
          </p>
        </section>

        {/* ── FAQ ─────────────────────────────────────────────── */}
        <section
          className="landing-section landing-section--sheet landing-faq-section"
          id="faq"
        >
          <div className="landing-section-head">
            <h2 className="landing-h2">Fair questions</h2>
          </div>
          <div className="landing-faq">
            {faqs.map(({ q, a }) => (
              <details key={q}>
                <summary>{q}</summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* ── Final CTA ─────────────────────────────────────────
            ⚖️ A DARK PANEL INSIDE THE FRAME, the v4 design file's, in place of
            the white sheet. It is the page's second `--accent-strong` ground
            and its last one; the band two-thirds up is the first. Two dark
            moments that far apart read as bookends rather than as a stripe
            pattern.

            The H2 and sub were deleted 2026-08-05 and restored 2026-08-06.
            The deletion's reasoning was that they restated the hero with "no
            object on screen to make the restatement mean anything" — true of
            the page as it then stood, where this block followed the FAQ
            directly. Not true now: the reader has passed the offer and the
            questions, so the closing line answers "so what do I do". */}
        <section className="landing-final">
          <div className="landing-final-panel">
            <h2 className="landing-h2">Start with tonight’s dinner.</h2>
            <p className="landing-section-lede">
              One meal, described in your own words, and an answer before you
              sit down.
            </p>
            <LandingPrimaryCta
              hint={`No login. No card. ${TASTER_LIMIT} free checks on your first day.`}
              onDark
            />
          </div>
        </section>

        {/* ── Footer ────────────────────────────────────────────── */}
        <footer className="landing-footer">
          {/* The nav collapses to wordmark+CTA below 640px and relies on the
              footer as the fallback — so the footer must BE navigation to
              assistive tech, not four bare divs, and it keeps every route.
              The v4 design draws three columns and six links; taking that
              literally would leave a phone reader with no labelled way to
              /pantry, /get-the-app, /subscribe, /about or /guides. Owner
              ruling 2026-08-08: the design's styling, the shipped routes. */}
          <nav className="landing-footer-cols" aria-label="Footer">
            <div className="landing-footer-col">
              <h3>Product</h3>
              <Link href="/check">Check a meal</Link>
              <Link href="/pantry">Pantry Review</Link>
              <Link href="/get-the-app">Get the app</Link>
              <Link href="/subscribe">Premium</Link>
            </div>
            <div className="landing-footer-col">
              <h3>Learn</h3>
              <Link href="/about">About Revora</Link>
              <a href="#how-it-works">How it works</a>
              {/* Renamed 2026-08-08. The route is a methodology disclosure —
                  "What's measured", "The research this is grounded in", "An
                  honest limit" — and the old label promised a mechanic it does
                  not deliver. The mechanic is the in-page anchor above. */}
              <Link href="/how-it-works">What&apos;s measured, and the research</Link>
              <Link href="/guides">Prediabetes guides</Link>
              <a href="#live-example">See a live example</a>
            </div>
            <div className="landing-footer-col">
              <h3>Legal</h3>
              <Link href="/privacy">Privacy</Link>
              <Link href="/terms">Terms</Link>
            </div>
            <div className="landing-footer-col">
              <h3>Apps</h3>
              {/* The true today-story leads; store waitlists render only when
                  configured. No "coming soon" placeholders — this page promises
                  "nothing on this list is coming soon", and the footer is the
                  last thing a scanner reads. */}
              <Link href="/get-the-app">Add to home screen — works today</Link>
              {androidWaitlist ? (
                <a href={androidWaitlist}>Google Play — join the waitlist</a>
              ) : null}
              {iosWaitlist ? (
                <a href={iosWaitlist}>App Store — join the waitlist</a>
              ) : null}
            </div>
          </nav>
          <p className="result-disclaimer">{BOUNDARY_DISCLAIMER}</p>
        </footer>
      </div>
      </main>
    </>
  );
}
