import type { Metadata } from "next";
import Link from "next/link";

import { DemoCheckCard } from "../components/demo-check-card";
import {
  EXAMPLE_RESULTS,
  ExampleResultCard,
  LandingVerdictCard
} from "../components/example-result-card";
import { LandingIncludes } from "../components/landing-includes";
import { LandingPause } from "../components/landing-pause";
import { TASTER_LIMIT } from "../lib/client/taster-store";
import type { PalRisk } from "../lib/client/ui-state";
import { FREE_DAILY_CHECKS } from "../lib/free-tier";
import { photoInputEnabled } from "../lib/photo-input-flag";
import { BOUNDARY_DISCLAIMER } from "../lib/pal/boundary-copy";
import { RISK_LABELS } from "../lib/pal/labels";
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
  title: "Prediabetes Meal Checker — What You Can Eat | Prediabetes Pal",
  description: LANDING_DESCRIPTION,
  // Resolved against metadataBase (app/layout.tsx) to the production origin.
  // Every launch channel is a tagged link (components/attribution-capture.tsx),
  // and ?utm_* variants of this page are 200s with identical content — without
  // this they are crawlable near-duplicates competing with the page itself.
  alternates: { canonical: "/" }
};

/**
 * The marquee band's six lines (`Prediabetes Pal Landing v4 Product.dc.html`, §3).
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

/**
 * ⭐ NEW 2026-08-11, `Revora Landing(2).html` §2 — the six-card replacement for
 * the four-pain list this block used to be. Ledger `landing-familiar-cards`,
 * which supersedes `landing-audience-pains` (deactivated in the same pass; all
 * four of its pains survive here, restated in the reader's voice).
 *
 * Each card is a MOMENT, not a category, and the design draws a photograph
 * under each one. The photographs are generated stills, not stock of real
 * people: every one is a still life or a hand, nobody's face, no legible text.
 * That is deliberate and it is the only honest option here — a photograph of a
 * person on a prediabetes page reads as a customer, and this page has no
 * customers to show yet (`no fabricated social proof`, below). The six
 * generation prompts are recorded verbatim in
 * `docs/landing/2026-08-11-design-copy-7-rules-audit.md`, because a re-crop or
 * a seventh card needs the brief and nothing else in the repo carries it.
 *
 * ⛔ `alt` describes the PICTURE, never the product. These are mood, not
 * evidence — an alt that says "a person struggling to choose a healthy meal"
 * would be asserting something the image cannot show.
 */
const FAMILIAR = [
  {
    title: "“Eat better.”",
    lines: ["Better than what?", "Nobody said."],
    art: "fridge-door",
    alt: "A hand holding open a fridge door in a dim kitchen, the interior light spilling out."
  },
  {
    title: "Six months away",
    lines: ["That’s your next appointment.", "Dinner is tonight."],
    art: "appointment-card",
    alt: "A small paper appointment card and a set of keys on a wooden kitchen table."
  },
  {
    title: "Every article disagrees",
    lines: ["Fruit’s fine. Fruit’s sugar.", "You’ve read both. Twice."],
    art: "open-tabs",
    alt: "A laptop open on a bedside table at night, its screen glowing in a dark bedroom."
  },
  {
    title: "The apps want an accountant",
    lines: ["Weigh it. Log it. Scan it.", "You asked about dinner."],
    art: "kitchen-scale",
    alt: "A bowl of uncooked rice resting on a white digital kitchen scale."
  },
  {
    title: "You eat, then you worry",
    lines: ["The hour after the meal", "is the worst part."],
    art: "cleared-plate",
    alt: "A cleared dinner plate with the knife and fork set down together, beside a crumpled napkin."
  },
  {
    title: "Nothing to show the doctor",
    lines: ["Six months of meals.", "No record of a single one."],
    art: "empty-notebook",
    alt: "An open notebook with blank pages and a pen resting in the gutter."
  }
] as const;

/**
 * ⭐ NEW 2026-08-11, `Revora Landing(2).html` §3, ledger `landing-myth-reality`
 * — "Why “eating healthy” still leaves you guessing". The one section on this page with no shipped
 * predecessor, and one of the two the owner called out as the design's
 * polished work.
 *
 * ⛔ EVERY REALITY IS A STATEMENT ABOUT FOOD OR ABOUT THIS PAGE'S OWN CONDUCT,
 * never about a health outcome. That is what keeps eight consecutive
 * myth-busting rows on the safe side of the claims boundary
 * (tests/unit/pal/claims-boundary-copy.test.ts scans this file). "Refined carbs
 * behave a lot like it" is a statement about carbohydrate, not a promise about
 * anyone's blood sugar; row 7 is a statement about what the product cannot do.
 *
 * The icons are decoration and carry `aria-hidden` at the call site — the myth
 * text is the term, and an emoji read aloud before every row is noise.
 */
const MYTHS = [
  {
    icon: "🍬",
    myth: "“Just cut sugar.”",
    reality: "Refined carbs behave a lot like it."
  },
  {
    icon: "🥣",
    myth: "“Healthy food is healthy.”",
    reality:
      "Oatmeal, smoothies, juice — reputation isn’t the whole story."
  },
  {
    icon: "📓",
    myth: "“Log everything and you’ll learn.”",
    reality: "You’ll learn to log. Not what to order."
  },
  {
    icon: "🍎",
    myth: "“Fruit is off-limits.”",
    reality: "It depends what’s on the plate with it."
  },
  {
    icon: "💪",
    myth: "“It’s a willpower thing.”",
    reality: "Nobody gave you instructions to follow."
  },
  {
    icon: "⏳",
    myth: "“You’ll figure it out by your next visit.”",
    reality: "Six months of guessing isn’t a method."
  },
  {
    icon: "📱",
    myth: "“An app can read your blood sugar.”",
    // The one row that is about this product, and it is a DENIAL of a
    // capability rather than a claim of one. It belongs in a myth table
    // precisely because a reader arriving from a CGM ad needs it early.
    reality: "Prediabetes Pal can’t, and won’t pretend to."
  },
  {
    icon: "🧍",
    myth: "“You’re doing something wrong.”",
    reality: "You were handed a number and left alone with it."
  }
] as const;

// Marketing landing (DESIGN.md §Marketing landing). The app lives at /check;
// this page's one job is credibility + the first check. No fabricated social
// proof — the page shows the product's own card instead. All copy here is
// scanned by the claims-boundary audit.
//
// Two hard rules this file must keep (F-04 / F-07, 2026-07-11 claims
// reconciliation):
//  - The adjustment and the swap are CONDITIONAL. A SAFE ("Clear") result is
//    structurally forbidden either one (lib/pal/postprocess.ts
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
// Verdict words come from lib/pal/labels.ts (RISK_LABELS) — never retyped.
//
// Surface treatment: alternating planes (DESIGN.md §11). `Prediabetes Pal Landing v4
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

/**
 * One of the two answers floating beside the hero's card — the verdict word
 * and the meal it belongs to, nothing else.
 *
 * ⛔ Reads the shipped fixtures rather than taking props for the copy.
 * `EXAMPLE_RESULTS` is the same map the full card renders from and
 * `RISK_LABELS` is the only source of the three verdict words (copy-pins), so
 * a float can never disagree with the card it is a summary of.
 */
function ShowpieceAnswer({ risk }: { risk: PalRisk }) {
  return (
    <p className="landing-showpiece-answer" data-risk={risk}>
      <span className="landing-showpiece-verdict">
        <span className="landing-showpiece-dot" aria-hidden="true" />
        {RISK_LABELS[risk]}
      </span>
      <span className="landing-showpiece-meal">{EXAMPLE_RESULTS[risk].meal}</span>
    </p>
  );
}

/**
 * ⚖️ THE INPUT-METHODS QUESTION, SETTLED 2026-08-11 — read this before adding
 * the camera to any sentence on this page.
 *
 * The owner asked for all three input options to appear on the check screen.
 * The 2026-08-11 handoff said that was impossible because photo assist is off;
 * that was read off a LOCAL env and is wrong about the deployed build, where
 * both gates are set and `/api/check/photo-draft` answers 200. So the control
 * genuinely is on the shipped screen, and the CAPTURE at step one shows all
 * three — which is what the ask was about.
 *
 * ⛔ THE COPY STILL SAYS TWO, AND THAT IS NOT AN OVERSIGHT.
 * `components/food-check-form.tsx` passes `premium={mode === "trial" &&
 * !entitled}`: in the shipped paywall mode a photo draft is paid-only, the
 * chip carries a Premium tag, and the route 402s a free session before any
 * camera opens. This page sells the FREE checks — the includes lede promises
 * in as many words that a reader can see all five features on them — so
 * folding the camera into that clause would advertise, as free, the one input
 * method a free reader cannot use. That is the unadvertised-feature gate
 * pointing the other way, and it is why the sentence stays at the two methods
 * every reader actually gets.
 *
 * The camera is named in exactly one place instead: the photo FAQ below, which
 * is already gated on the same build flag and is the only sentence with room
 * to carry the qualifier. The capture shows the Premium tag as drawn, so the
 * picture and the words agree.
 */
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
      q: "Is Prediabetes Pal medical advice?",
      a: "No. Prediabetes Pal is informational only and gives general educational information about meal composition. It does not identify any condition, does not predict your individual response, and does not replace a doctor or registered dietitian. Talk with a clinician for guidance that is specific to you."
    },
    {
      q: "Who is Prediabetes Pal for?",
      a: "People in the prediabetes A1C range of 5.7% to 6.4%. If your number falls outside that range, Prediabetes Pal says so plainly and points you to a clinician instead of pretending."
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
            // ⛔ THE PRICE CLAUSE IS LOAD-BEARING, not politeness. This answer
            // shipped describing the camera with nothing about what it costs,
            // while the control it describes carries a Premium tag on the
            // screen and its route 402s a free session
            // (components/food-check-form.tsx). A reader who met the camera
            // here and the wall there would have been told half of it. The
            // clause branches on the same paywall flag the account FAQ does,
            // because in the other mode the gate is not there to describe.
            // ⛔ Names the TIER, never an amount — this page states no price
            // anywhere (§0.2 #4), and "Premium" is the same word the cancel
            // answer already uses.
            q: "How does the photo check work?",
            a: trialMode
              ? "A photo check is part of Premium — your free checks are typed or spoken. The photo becomes a draft list of what's on the plate, and you review and confirm the words before anything is checked. The photo never skips your judgment. Photos are not kept."
              : "Your photo becomes a draft list of what's on the plate. You review and confirm the words before anything is checked. The photo never skips your judgment. Photos are not kept."
          }
        ]
      : []),
    {
      // 🆕 2026-08-06, the v2 design's one added question. "Say it" is a
      // shipped affordance, not an aspiration — .voice-input in globals.css
      // and inputMethod: z.enum(["text","voice","photo"]) in the history
      // handler. Do not let it drift into naming photo input unqualified: the
      // control ships, but a photo draft is paid-only in this mode, and this
      // answer is about the minimum a reader has to do. The photo FAQ above
      // carries the camera, with its price named.
      q: "What do I actually have to do?",
      a: "Describe the meal in your own words — type it or say it. No weighing, no barcode, no portion sizes, no food database to search. If the description is ambiguous, Prediabetes Pal asks one question."
    },
    {
      q: "How do I cancel?",
      a: "One tap, on your account page, effective at the end of the paid period. No retention screens, no email hoops. Deleting your account removes your data with it."
    }
  ];
  /**
   * ⭐ NEW 2026-08-11, `Revora Landing(2).html` §4 ("What does Revora
   * include?"), ledger `landing-includes-five` — the second section the owner
   * named as the design's polished work, renamed for the 2026-08-09 rename.
   * It does not double-cover `landing-what-you-get`: this block names what the
   * FREE checks show, that row names what a subscription adds.
   *
   * ⛔ THREE OF THE DESIGN'S FIVE BODIES CLAIM THINGS THIS BUILD DOES NOT SHIP
   * UNCONDITIONALLY, and each is rewritten rather than adopted:
   *  - "type, speak, or photograph" — photo input is `photoInputEnabled()`,
   *    off in this build. Branches off the same flag the FAQ does.
   *  - "a structured learning journey" — `weeklyLearning` in
   *    lib/server/capabilities.ts is premium AND server-flagged, so it cannot
   *    be listed as something the product "includes".
   *  - "without calorie counting, streaks, or guilt" — components/streak-chip
   *    ships inside the daily loop, so "no streaks" is false. The line names
   *    the three things that genuinely are absent: weighing, calorie totals,
   *    and a score.
   * The conditional shape of the swap survives the rewrite untouched (F-04 /
   * F-07): "when a meal needs adjusting", never a promise it always arrives.
   *
   * Verdict words interpolate from RISK_LABELS, never retyped (copy-pins).
   */
  const includes = [
    {
      title: "Check your meal.",
      lede: "Know where a plate lands before you eat it",
      // ⛔ TWO METHODS, UNCONDITIONALLY. This used to branch on the photo flag
      // and name the camera as a third. It cannot: this block's own lede
      // promises the reader sees all five features on the FREE checks, and a
      // photo draft is paid-only in the shipped mode. See the note above the
      // component.
      body: `Describe what you are about to eat — type it or say it — and get one answer in plain language: ${RISK_LABELS.SAFE}, ${RISK_LABELS.MODERATE}, or ${RISK_LABELS.HIGH}.`
    },
    {
      title: "Make a better choice.",
      lede: "A swap when the meal needs one, and nothing when it doesn’t",
      body: "You never just get told no. When a meal needs adjusting you get a practical change or a safer swap — and when it does not, you get told that instead."
    },
    {
      title: "Learn your patterns.",
      lede: "Your own meals, saved in your own words",
      body: "A history of what you actually ate, so the meals that keep coming back and the easiest changes to them are visible without logging anything."
    },
    {
      title: "Build better habits.",
      lede: "No weighing, no calorie total, no score",
      body: "Your week shows up as the answers you already got, not as a number to chase. Nothing to weigh and nothing to hit."
    },
    {
      title: "Stay in control.",
      lede: "Private by design, and clear about where it stops",
      body: "Your A1C and meal text are encrypted at rest and stored only with your explicit consent. Download all of it, or delete all of it, from your account page."
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
        name: "Prediabetes Pal",
        url: APP_URL,
        description: LANDING_DESCRIPTION,
        applicationCategory: "HealthApplication",
        operatingSystem: "Web",
        publisher: {
          "@type": "Organization",
          name: "Prediabetes Pal",
          url: APP_URL,
          // The brand descriptor, machine-readable. app/layout.tsx's openGraph
          // siteName says "Prediabetes Pal — Prediabetes Meal Checker" and the Play
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
            Prediabetes Pal
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
          {/* ⚖️ TWO LINES NOW, `Revora Landing(2).html`'s, adopted
              2026-08-11. Line one is the reader's own question and line two is
              the shipped H1 unchanged.
              ⛔ This is NOT the eyebrow ledger `landing-hero-moment` deleted.
              That one RESTATED the category above a headline that already said
              it. "Can I eat this?" states nothing about the product — it is the
              sentence the reader arrived typing, and line two is the answer to
              it. Cutting it costs the page its only line of recognition above
              the fold. */}
          <h1 className="landing-h1">
            Can I eat this?
            <span className="landing-h1-answer">
              A meal checker built only for prediabetes.
            </span>
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
            ⚖️ THE `Revora Landing(2).html` COMPOSITION, owner ruling
            2026-08-11: one answer held in a phone frame on a mint halo, with
            the two answers it is NOT floating either side of it.

            ⛔ EVERY CARD HERE IS REAL. The centre is the product's own
            `ExampleResultCard`; the two floats read `EXAMPLE_RESULTS` for
            their meal and `RISK_LABELS` for their word, so neither can drift
            from the card in block 7 that shows them in full. The design draws
            invented meals with invented verdicts — these are the shipped
            fixtures instead.

            ⚠️ THIS COSTS THE PAGE ITS FIRST DARK PLANE, and that is a
            deliberate override of DESIGN.md §11's alternation, not an
            oversight. The block was `--accent-strong` and was one of the two
            dark grounds the page used as bookends; the design draws it cream
            on mint. The remaining dark moment is the final CTA. Taken with the
            cost stated: the hero now runs light for four consecutive planes,
            and if the page reads flat at the top, THIS is the change to
            revisit first.

            ⚠️ THE /check CAPTURE MOVED TO STEP ONE and took its described alt
            with it. landing-art.test.ts asserts the page still references the
            PNG *and* still carries the long alt, so step one's `alt=""` became
            the described version in the same edit — it is now the only copy of
            that image on the page, so there is nothing left for it to
            duplicate. */}
        <section className="landing-showpiece">
          <div className="landing-showpiece-stage">
            {/* Decoration, and the only reason it is an element at all is that
                a radial-gradient background on the stage would sit behind the
                floats too. Out of the a11y tree. */}
            <div className="landing-showpiece-halo" aria-hidden="true" />
            <div className="landing-showpiece-aside">
              <ShowpieceAnswer risk="MODERATE" />
              {/* Restates the marquee's ledgered "Nothing to log". */}
              <span className="landing-showpiece-chip">no logging</span>
            </div>
            {/* `landing-phone` is the shared frame recipe (2026-08-11); the
                showpiece modifier only makes this instance the biggest one on
                the page. See globals.css — the frame may never name the card
                class it wraps. */}
            <div className="landing-phone landing-showpiece-phone">
              <ExampleResultCard risk="SAFE" labelled withFineprint />
            </div>
            <div className="landing-showpiece-aside">
              {/* The clarify question, the same one the steps block names. */}
              <span className="landing-showpiece-chip">plain or sweetened?</span>
              <ShowpieceAnswer risk="HIGH" />
            </div>
          </div>
          <p className="landing-card-caption">
            One card, whatever the answer is. This meal already looks balanced,
            so there is no change to make — and that is the whole answer.
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
            {/* ⚖️ THE DESIGN FILE'S H2, adopted 2026-08-11 over "Six months is
                a long time to guess." Both name the same gap; this one names
                the reader's position in it and takes the blame off them
                explicitly, which is the whole argument the six cards below
                make. The six-month framing is not lost — it is card two, the
                lede here, and the myth table's sixth row. */}
            <h2 className="landing-h2">
              If this sounds familiar, you’re not the problem.
            </h2>
            <p className="landing-section-lede">
              Nobody handed you a plan. You were handed a number, two words
              of advice, and an appointment half a year away. Everything in
              between is supposed to be your job to figure out.
            </p>
          </div>
          {/* ⚖️ SIX CARDS WITH PHOTOGRAPHS, replacing the four ghost-numeral
              pains. The ghost numerals go with them: a photograph and a
              counter in the same card is two decorations arguing.
              (⛔ The word for "how a thing is styled" that starts with t-r-e-a
              cannot appear on this line. claims-boundary-copy.test.ts strips
              only comment-LEADING lines, so the second line of a JSX comment
              is audited exactly like rendered copy — it caught this one.)

              ⛔ `loading="lazy"` on all six and fixed width/height on every
              one — six images below the fold with no intrinsic size is six
              layout shifts, and this block sits directly above a measured
              exit. The files are 664×360 webp, ~12KB each. */}
          <ul className="landing-familiar" role="list">
            {FAMILIAR.map(({ title, lines, art, alt }) => (
              <li key={art} className="landing-familiar-card">
                <div className="landing-familiar-copy">
                  <h3>{title}</h3>
                  <p>
                    {lines[0]}
                    <br />
                    {lines[1]}
                  </p>
                </div>
                <img
                  className="landing-familiar-art"
                  src={`/landing/familiar/${art}.webp`}
                  alt={alt}
                  width={664}
                  height={360}
                  loading="lazy"
                  decoding="async"
                />
              </li>
            ))}
          </ul>
          {/* ⚠️ MEASURED POSITION (DESIGN.md §11.1), and an exit the four-pain
              block it replaces did not need. Six carded pains with a
              photograph each run 2,357px at 375px against the four's ~1,400 —
              measured, the glance strip's pill to the scope panel's ran 2,756px,
              755 over. Re-measure before removing it:
              node scripts/measure-landing.mjs */}
          <LandingPrimaryCta spaced />
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
                Prediabetes Pal exists for that gap and nothing else.
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

        {/* ── Why "eating healthy" still leaves you guessing ──────
            ⭐ NEW 2026-08-11, `Revora Landing(2).html` §3, and one of the two
            sections the owner named as the design's polished work. The page
            had no myth-correction block at all; the objection it answers
            ("I already eat healthily") was reaching the FAQ unanswered.

            ⚠️ PLANE. It sits AFTER the scope panel, not before it, purely so
            the alternation holds: the familiar cards are the sheet before it
            and the what-changes band is the accent ground after, so a second
            sheet here would put two white planes back to back. Thematically
            either position works — this one also lets the scope panel say what
            the product is for before eight rows argue why the usual advice
            isn't enough.

            A <dl>, not the design's <table>. The design draws a two-column
            grid with "Myth" and "Reality" heads; a dl renders the same pixels,
            stacks on a phone without the display:block hack a real table
            needs, and dt→dd already carries the pairing to a screen reader —
            which is what lets the column heads be decorative. */}
        <section className="landing-section landing-section--sheet landing-myths-section">
          <div className="landing-section-head landing-section-head--centred">
            <h2 className="landing-h2">
              Why “eating healthy” still leaves you guessing
            </h2>
            <p className="landing-section-lede">
              Most food advice was never written for this specific range.
            </p>
          </div>
          {/* aria-hidden: the dt/dd relationship is the real header
              association, and a screen reader announcing "Myth / Reality"
              once at the top of a stacked list would describe a two-column
              layout the listener never gets. */}
          <div className="landing-myths-heads" aria-hidden="true">
            <span>Myth</span>
            <span>Reality</span>
          </div>
          <dl className="landing-myths">
            {MYTHS.map(({ icon, myth, reality }) => (
              <div key={myth} className="landing-myth">
                <dt>
                  <span className="landing-myth-icon" aria-hidden="true">
                    {icon}
                  </span>
                  {myth}
                </dt>
                <dd>{reality}</dd>
              </div>
            ))}
          </dl>
          {/* ⚠️ MEASURED POSITION (DESIGN.md §11.1). Eight rows is the tallest
              single list on the page; without an exit here the stretch from
              the scope panel's pill to the dark band's ran over budget.
              Re-measure before removing it: node scripts/measure-landing.mjs */}
          <LandingPrimaryCta spaced />
        </section>

        {/* ── What actually changes ─────────────────────────────
            Ledger `landing-what-changes`. The page's one `--accent-strong`
            full-bleed band.

            ⚖️ TWO COLUMNS NOW — "Today" beside "With Prediabetes Pal", the v4 design
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
                With Prediabetes Pal
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

        {/* ── What Prediabetes Pal includes ──────────────────────
            ⭐ NEW 2026-08-11. See the `includes` note above for the three
            design bodies that were rewritten to match what this build ships.

            ⛔ FOUR REAL SURFACES AND ONE STATEMENT — see the note at the
            `panels` prop for which is which and why the fifth stays prose.
            The design draws five phone mockups with invented product output;
            what ships is four real surfaces in the design's frames, reached
            two different ways (a seeded capture for the route, live props for
            the component), and one honest paragraph.

            A MODERATE card, deliberately: the SAFE one is already in the
            showpiece, and MODERATE is the only verdict the engine lets carry
            adjustment copy at all — which is what feature two describes.
            (⛔ Describing it took three tries. The unconditional-swap family
            matches an indefinite article followed by that noun in any sentence
            with no conditional in it, a JSX comment is scanned like rendered
            copy, and quoting the offending phrase to warn about it trips the
            same rule — which is exactly what the audit's own note says to do
            instead: describe, never quote.)

            ⚠️ AN ELEMENT SHOT OF /demo IS STILL THE WRONG TOOL, and the reason
            is worth keeping: the app's fixed chrome paints over the captured
            element. What changed is that neither surface needed one. A route
            capture takes the whole viewport, chrome included, because there
            the chrome is part of the screen; and a component that takes plain
            props never needed a picture at all. */}
        <section className="landing-section landing-includes-section">
          <div className="landing-section-head">
            <h2 className="landing-h2">What does Prediabetes Pal include?</h2>
            <p className="landing-section-lede">
              Five things, and you can see all of them on the free checks
              before you decide anything.
            </p>
          </div>
          <LandingIncludes
            features={includes}
            /* ⚖️ THREE REAL SURFACES, TWO STATEMENTS (2026-08-11). The previous
               pass shipped two real cards and three typographic panels, on the
               reading that /meals and /journey could only be captured in their
               empty states and /account is behind auth. One of those three was
               wrong:

                 3 · /meals — the SIGNED-OUT page falls back to the on-device
                   store, so seeding localStorage before navigation renders the
                   real screen with fixture rows. The capture script does it;
                   this is the /demo contract (real component, fixture data)
                   pointed at a route rather than at a component.

               ⛔ THE TEST EVERY PANEL HERE HAS TO PASS IS THIS BLOCK'S OWN
               LEDE: the reader can see all five on the FREE checks. A panel
               that pictures a surface they cannot reach makes that sentence
               false, and it is the same failure as naming the camera in
               feature one — see the note above the component. Two panels fail
               it and stay prose:

                 4 · the week — `WeekStrip` takes plain props, so it briefly
                   rendered live here. Reverted: the only shipped screen that
                   draws it is /journey, which answers a signed-out reader with
                   a sign-in wall, and in this paywall mode an account needs a
                   card. The FEATURE is free — a guest week strip renders on
                   /meals and is visible at the top of panel three's capture —
                   but that particular drawing is not.
                 5 · the account controls — owner ruling, and the reason is not
                   difficulty. A real capture needs three API routes mocked and
                   would put a delete-my-health-data control on a marketing
                   page. Its copy already says the controls live on your account
                   page rather than showing them, so panel and sentence agree.

               ⛔ PANELS 1-2 CARRY THE ILLUSTRATION LABEL (AUD-008: anything
               that looks like product output says it is an example until an
               authorised live capture exists). Panel 3 does not need one — it
               is a real screenshot of the real screen, and the only thing
               fixture about it is the reader's own typed history. */
            panels={[
              <div key="safe" className="landing-phone landing-includes-phone">
                <ExampleResultCard risk="SAFE" labelled />
              </div>,
              <div
                key="moderate"
                className="landing-phone landing-includes-phone"
              >
                <ExampleResultCard risk="MODERATE" labelled />
              </div>,
              <div key="history" className="landing-phone landing-includes-phone">
                {/* ⛔ The alt describes the SCREEN, not the benefit. It is a
                    picture of a list; claiming it shows a reader learning
                    anything would assert something the image cannot show. */}
                <img
                  src="/landing/app-meals.png"
                  alt="The Prediabetes Pal meals screen on a phone: a strip of the last seven days across the top, then a list of recent checks — each one the meal in the words it was described in, the answer it got, and when it was checked."
                  width={390}
                  height={673}
                  loading="lazy"
                  decoding="async"
                />
              </div>,
              /* ⛔ THIS PANEL BRIEFLY RENDERED THE REAL `WeekStrip` AND MUST
                 NOT AGAIN under this block's current lede. It is a live
                 component taking plain props, so it looked like the cheapest
                 real surface on the page — but the only shipped screen that
                 draws it is /journey, and /journey answers a signed-out reader
                 with a sign-in wall (verified 2026-08-11). In the shipped
                 paywall mode an account needs a card, so the artifact sits
                 behind one while the lede above promises the reader sees all
                 five features on the FREE checks. Same failure as naming the
                 camera in feature one, one panel over.
                 ⚠️ The FEATURE is genuinely free — a guest week strip renders
                 on /meals, and it is visible at the top of panel three's
                 capture. It is the /journey DRAWING that is not free, which is
                 why this is a statement rather than that picture.
                 (A plain block comment, not a braced one: this is an ARRAY
                 literal, and the braced form is JSX-children syntax.) */
              <div key="habits" className="landing-includes-note">
                <p className="landing-includes-note-lead">
                  A week of answers, not a week of numbers.
                </p>
                <p>
                  No calorie total, no macro split, no grade. The only thing
                  that accumulates is the meals you already asked about.
                </p>
              </div>,
              <div key="privacy" className="landing-includes-note">
                <p className="landing-includes-note-lead">
                  Download all of it, or delete all of it, in one tap.
                </p>
                <p>
                  Both live on your account page. Deleting the account removes
                  the data with it.
                </p>
              </div>
            ]}
          />
          {/* ⚠️ THE SECOND EXIT IN THIS SECTION, and like the steps block's
              pair it is measured, not decorative. One exit inside the copy
              column fixed the stretch above it and left 2,097px below —
              the result card, this section's foot, and the steps head all sit
              between it and the oatmeal dare, which is the next exit. Two
              exits split the section into three legal stretches; one does not.
              Re-measure before removing it: node scripts/measure-landing.mjs */}
          <LandingPrimaryCta spaced />
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
              Type “oatmeal” and Prediabetes Pal asks whether it is plain or sweetened,
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
              {/* ⛔ THE PAGE'S ONLY COPY OF THIS CAPTURE, and it carries the
                  described alt. Until 2026-08-11 the showpiece rendered it too
                  and this one was `alt=""` so a screen reader would not hear
                  the same screen described twice; the showpiece is now the
                  design's card composition and holds no screenshot, so the
                  described version moved here. landing-art.test.ts asserts on
                  the opening of this attribute — it is the evidence for
                  "describe the plate", so decorative alt would drop the
                  argument.

                  ⛔ THE ALT IS A PLAIN STRING AND MUST STAY ONE. The pin
                  matches the literal characters that open the attribute, so
                  swapping in an interpolated template would take the guard
                  down WITHOUT failing it: the regex just stops matching source
                  it no longer recognises, and nothing goes red.

                  ⛔ It therefore may not count the input methods, even though
                  the picture shows them. The control row is build-flagged
                  while the capture is one committed file, so any number
                  written here is right in one build and wrong in the other.
                  Naming the row without counting it is true in both. The
                  COPY beside it can count, because copy branches; see
                  `inputMethods` above. */}
              <div className="landing-step-art landing-step-art--shot">
                <span className="landing-phone landing-step-phone">
                  <img
                    src="/landing/app-check.png"
                    alt="The Prediabetes Pal check screen on a phone: one box to describe the meal in your own words, the input options beside it, one field for your latest A1C, and a button to check it."
                    width={390}
                    height={700}
                    loading="lazy"
                    decoding="async"
                  />
                </span>
              </div>
            </li>
            <li className="landing-step landing-step--art">
              <div className="landing-step-copy">
                <span className="landing-step-pill">Step two</span>
                <h3>One question, when it needs one</h3>
                <p>
                  If a food is ambiguous, Prediabetes Pal asks one clarifying question
                  instead of guessing — and errs on the careful side.
                </p>
                <p className="landing-step-punch">
                  Without that one question, Prediabetes Pal would have been guessing.
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
                {/* ⚖️ OWNER RULING 2026-08-14, overturning 2026-08-06. This
                    used to render the design file's six-row label-gutter
                    table, which the app does not draw anywhere. Framing that
                    would have asserted it was a screen — so the table went
                    instead, and the component's own shape got the frame.

                    ⛔ WHY THE FRAME IS ENTITLED TO ASSERT A SCREEN, which is
                    the test panel 4 failed: this component's default layout
                    renders inside `/check` itself, below the form, and again
                    on `/demo`. Both answer 200 signed out in production —
                    checked 2026-08-14, not inferred. A reader who follows the
                    link in the copy beside this lands on the surface the
                    frame is showing them. Re-check that before changing what
                    goes in here; a frame around an unreachable surface is the
                    defect this page shipped once already.

                    ⛔ This is the only framed surface on the page whose pixels
                    are live DOM rather than a capture, and that is the point:
                    it is the real component at phone width.

                    ⚠️ `.landing-step-screen` exists because the bezel needs a
                    page plane behind the card, exactly as the step-one
                    capture shows one. Without it the card sits flush and the
                    frame reads as an outline drawn around a card rather than
                    a phone. It may not reach into the card itself —
                    landing-design-guards GUARD 1. */}
                <div className="landing-phone landing-step-live-phone">
                  <div className="landing-step-screen">
                    <LandingPause>
                      <DemoCheckCard />
                    </LandingPause>
                  </div>
                </div>
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
          {/* ⚖️ CENTRED AND SHORTENED, owner ruling 2026-08-11, from
              `Revora Landing(2).html` §7. The H2 is the design's — it says what
              the three cards are instead of describing them — and the lede
              drops from five lines to two.
              ⛔ The clause that survived the cut is the load-bearing one:
              "says so and stops" is the F-04 behaviour (`assertNoUnsafeSafeFields`
              throws on a Clear result carrying a change), so it is the one
              sentence here that is falsifiable against shipped code rather than
              a description of the layout. What went was the paragraph
              explaining that card one repeats the hero's card — true, but it
              was the page narrating its own construction. */}
          <div className="landing-section-head landing-section-head--centred">
            {/* AUD-008: "the kind of answer", not "the actual answer" — the
                cards below are illustrations until a live capture exists. */}
            <h2 className="landing-h2">Three meals. One layout. No score.</h2>
            <p className="landing-section-lede">
              When a meal already looks balanced, Prediabetes Pal says so and
              stops. It does not invent a correction to look useful.
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
              Illustrated examples. Every card ends with the same line: Prediabetes Pal
              is informational only and is not medical advice.
            </p>
            <LandingPrimaryCta />
          </div>
        </section>

        {/* ── Limits ────────────────────────────────────────────
            Ledger `landing-limits-trio` covers the two commitment cards and
            `landing-sources-note` the first.
            ⚠️ BOUNDARY_DISCLAIMER USED TO RENDER HERE TOO, inside card three,
            and does not any more (2026-08-11 shortening). It is not lost: the
            footer renders it from the same constant on every page, which is
            where it is ledgered and where the legal line belongs. Do not
            re-add it here — a page that states the disclaimer twice in two
            screenfuls is the "article, not landing page" the owner called
            out. */}
        <section className="landing-section landing-section--sheet">
          <div className="landing-section-head landing-section-head--centred">
            {/* ⚖️ THE DESIGN FILE'S H2, adopted 2026-08-11. "Calm, and honest
                about its limits" describes the section; this one states the
                trade the section is actually making, and it is the page's
                clearest line of non-desperation — the thing that makes a
                limits block read as confidence rather than as hedging. */}
            <h2 className="landing-h2">
              We’d rather be trusted than impressive.
            </h2>
            <p className="landing-section-lede">
              Three commitments you can check, not promises you have to take on
              faith.
            </p>
          </div>
          {/* ⚖️ SHORTENED, owner ruling 2026-08-11: "it looks like an
              article rather than landing page copy, and the elements are
              misaligned and look awkward". Both complaints had the same cause
              — the Sources card carried three paragraphs beside two cards
              carrying one each, so the row could never line up and the block
              read as prose in a grid.

              The fix is subtractive. Three cards, one paragraph each, equal
              height. ⛔ WHAT WAS CUT IS THE HEDGING, NOT THE SUBSTANCE:
              "Prediabetes Pal's general meal-planning principles map to
              public-health guidance and cited nutrition research" plus the
              paragraph explaining that those sources are not evidence of a
              health result both go — the FIRST because /how-it-works is where
              the methodology actually lives and this was a summary of a
              summary, the SECOND because it is a disclaimer about a claim this
              page no longer makes anywhere. Nothing falsifiable was removed:
              both surviving commitments are still checkable against shipped
              behaviour, which is the only reason they may sit under a heading
              about honesty. The link to the full sources stays, and it is now
              the card's whole job. */}
          <div className="landing-limits">
            {/* Ledger `landing-sources-note`, narrowed. The one cited-trial
                statistic in the corpus stays off this page — family
                `study-association`, exempt only on /how-it-works. (Naming that
                trial here, even in a comment, goes red:
                claims-boundary-copy.test.ts strips only comment-LEADING lines,
                so a JSX comment is audited exactly like rendered copy.) */}
            <div className="landing-limits-card">
              <h3>Sources you can check</h3>
              <p>
                The food principles behind every answer are public-health
                guidance and cited nutrition research, not our opinion.
              </p>
              <p>
                <Link className="inline-link" href="/how-it-works">
                  Read the sources and the limits
                </Link>
              </p>
            </div>
            {/* Ledger `landing-limits-trio`. Both are falsifiable against
                shipped behaviour rather than being assertions — which is the
                only reason they are allowed to sit under a heading about
                honesty. The clarify claim is the one DemoCheckCard renders from
                the promise registry two blocks up; the consent clause was
                checked against schema.ts (`consentedAt`, notNull) and /privacy,
                which lists storing health data without explicit consent among
                the things Prediabetes Pal does not do. */}
            <div className="landing-limits-card">
              <h3>When we&apos;re unsure, we say so</h3>
              <p>
                If a food is ambiguous, Prediabetes Pal asks one clarifying
                question instead of guessing — and errs on the careful side.
              </p>
            </div>
            <div className="landing-limits-card">
              <h3>Your health data stays yours</h3>
              <p>
                Your A1C and meal text are encrypted at rest, stored only with
                your explicit consent, and deleted — all of it — in one tap.
              </p>
            </div>
          </div>
          {/* ⚠️ MEASURED POSITION (§11.1) — this and the exit in the dark band
              are what keep the back half of the page legal. */}
          <LandingPrimaryCta spaced />
        </section>

        {/* ── The offer ladder was DELETED here ─────────────────
            ⚖️ OWNER RULING 2026-08-11: "remove this part". The three-stage
            "Try it before you pay a cent" block (ledger `landing-offer-stages`,
            plus `landing-what-you-get` for stage three's body) is gone, and
            both rows are flipped Active No in the same pass.

            ⚠️ WHAT THIS COSTS, recorded so the next pass does not rediscover
            it. The 2026-08-11 copy audit scored this page against the seven
            psychology rules and rule 7 ("price objections are value
            objections") passed ONLY because of this block plus the FAQ. The
            block was also the answer to a specific failure the page had in
            2026-08-05: with every price deleted, a reader learned a card was
            involved at the trial wall, which is the bait-and-switch the
            honesty positioning exists to rule out.

            What still carries it, and why rule 7 degrades to PARTIAL rather
            than back to FAIL: the FAQ's "Do I need an account or a card to try
            it?" answer is branch-aware off the same `paywallMode()` flag this
            block used, and the marquee still says cancel is one tap and not an
            email. If a reader ever reports being surprised by a card, this
            block — not a new one — is the thing to restore. */}

        {/* ── FAQ ─────────────────────────────────────────────── */}
        {/* ⚠️ NO LONGER A SHEET (2026-08-11). The offer ladder used to sit
            between this and the limits block and was the page-ground plane
            that separated them; with it deleted, two white sheets ran back to
            back. This one drops to the page ground so the alternation holds. */}
        <section className="landing-section landing-faq-section" id="faq">
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
              <Link href="/about">About Prediabetes Pal</Link>
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
