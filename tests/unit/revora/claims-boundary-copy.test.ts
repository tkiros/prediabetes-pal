import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { TASTER_LIMIT } from "../../../lib/client/taster-store";
import { loadSafetyContract } from "../../../lib/revora/safety-contract";

const ROOT = process.cwd();
const contract = loadSafetyContract();

/**
 * The claims-boundary audit.
 *
 * ── What changed on 2026-07-11 (W-09) and why ────────────────────────────────
 * This file used to be the project's only copy audit, and it had three
 * structural blind spots. Each of them let a real, confirmed false claim ship:
 *
 *  1. COVERAGE was a hand-maintained list of 48 paths. A new user-facing
 *     component was opted OUT by default — you had to remember to add it.
 *     Eleven shipped surfaces were never scanned (dashboard-view, guest-
 *     dashboard, first-run-gate, /home, the pantry intake flow …), and neither
 *     was PRODUCT.md or the Play listing. The listing is the one piece of copy
 *     that goes to a *store reviewer*, and it was the least audited thing we
 *     had. It is now a GLOB (every .tsx under app/ and components/) minus an
 *     explicit, reasoned DENY list. New component ⇒ audited, automatically.
 *
 *  2. VOCABULARY caught banned *verbs* ("cure", "reverse") but not false
 *     *claims*. A page could say "Most popular" on a product with zero users,
 *     promise a swap on every verdict when the engine forbids one on SAFE, or
 *     borrow the CDC DPP trial's credibility for a behavioral streak — and pass
 *     clean. Three new families below close that: social-proof,
 *     unconditional-swap, study-association.
 *
 *  3. NUMBERS were free variables. The free-tier count was written out by hand
 *     on each surface and had drifted into three different answers. Numbers are
 *     now pinned to the constants they describe — see copy-pins.test.ts.
 *
 * ── The rule for adding to a deny/exempt list ────────────────────────────────
 * Every entry carries a reason. "It fails the test" is not a reason. If a
 * surface trips a family, the default is to fix the copy.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Text normalization
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Drop comment-leading lines from a SOURCE file before scanning it.
 *
 * The old audit scanned raw file text, comments and all. In practice that
 * produced only false positives — every single one of them: `labels.ts` says
 * "the copy-ledger guarantee"; `home/page.tsx` and `guest-dashboard.tsx` cite
 * "eng amendment #1"; `result-card.tsx` describes itself as "non-diagnostic";
 * `reviewer-signin/route.ts` says a preview env is "treated as non-prod". None
 * of that is copy. None of it renders. And an audit that cries wolf at
 * engineering prose is an audit people learn to switch off — which is precisely
 * how the eleven unscanned surfaces and the unscanned store listing happened.
 *
 * Worse, it made the rules unwritable: a comment cannot explain WHY the CDC DPP
 * citation is confined to /how-it-works without naming it, and bai.ts and
 * coach-outputs.ts both have to.
 *
 * A line whose first non-space character opens a comment is never rendered to a
 * user — JSX text and string literals never begin with `*`, `//`, or `/*` — so
 * skipping those lines drops exactly zero user-facing copy. A banned word
 * smuggled onto a *code* line's trailing comment (`const x = 1; // cures it`) is
 * still scanned, because that line does not START with a comment marker.
 *
 * Two things this deliberately does NOT strip:
 *  - JSX `{/* … *␟/}` blocks. They sit inside the render tree and are one typo
 *    away from being rendered, so they stay in scope. Don't quote banned copy in
 *    them — describe it instead (see paywall-card.tsx).
 *  - Anything in the markdown docs. A markdown bullet can legally start with
 *    `*`, so stripping `*`-leading lines there would let "* Most popular" hide
 *    from the scan. Markdown is scanned raw, inside its fences.
 */
function stripCommentLines(text: string): string {
  return text
    .split("\n")
    .filter((line) => !/^\s*(?:\/\/|\/\*|\*)/.test(line))
    .join("\n");
}

/** Source files get comments stripped; markdown/contract strings are scanned raw. */
function subjectFor(text: string, source?: string): string {
  const isSource = !!source && /\.tsx?$/.test(source);
  return isSource ? stripCommentLines(text) : text;
}

/** Sentences, with JSX/markdown line-wrapping collapsed so one sentence stays one sentence. */
function sentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .filter(Boolean);
}

// ─────────────────────────────────────────────────────────────────────────────
// Banned families
// ─────────────────────────────────────────────────────────────────────────────

type Family = {
  label: string;
  /** Regex families: tripped when the pattern matches anywhere in the text. */
  pattern?: RegExp;
  /** Predicate families: for claims that only a sentence-level rule can catch. */
  predicate?: (text: string) => boolean;
  /** Sources allowed to carry this term — each needs a reason, in a comment. */
  exemptSources?: string[];
};

/**
 * A swap or an adjustment is PROMISED — "one safer swap", "a simple adjustment".
 * Bare mentions ("Swap:", "the swap") are not promises and don't match.
 */
const SWAP_PROMISE =
  /\b(?:one|a|an)\s+(?:safer\s+|simple\s+|small\s+)?(?:swap|adjustment)\b/i;

/** A conditional. "when there's one", "when one helps", "if there is one", "where it changes". */
const HEDGE =
  /\bwhen\s+appropriate\b|\b(?:when|if|where)\s+(?:there|one|it|they)\b/i;

const BANNED: Family[] = [
  // ── The original eleven (docs/safety/claims-boundary.md "Banned Claim
  // Families"). Word-bounded so innocent substrings (secure, retreat, create,
  // prediabetes, diabetes) never trip the scan. Unchanged.
  { label: "reverse", pattern: /\brevers(?:e|es|ed|ing|al|als)\b/i },
  { label: "cure", pattern: /\bcur(?:e|es|ed|ing)\b/i },
  { label: "treat", pattern: /\btreat(?:s|ed|ing|ment|ments)?\b/i },
  { label: "prevent", pattern: /\bprevent(?:s|ed|ing|ion|ive|ative)?\b/i },
  { label: "diagnose", pattern: /\bdiagnos(?:e|es|ed|ing|is|tic|tics)\b/i },
  { label: "FDA", pattern: /\bFDA\b/i },
  { label: "guarantee", pattern: /\bguarantee(?:s|d|ing)?\b/i },
  { label: "future-claim", pattern: /\bwill\s+(?:lower|prevent)\b/i },
  { label: "mg/dL", pattern: /\bmg\s*\/\s*dl\b/i },
  {
    label: "gi-gl-number",
    // A GI/GL term with a directly attached number ("glycemic index of 73",
    // "GI: 55", "73 GI"). Kept tight so prose that merely names the concept
    // ("No GI/GL numbers anywhere") never trips the scan.
    pattern:
      /\b(?:glycemic\s+(?:index|load)|GI|GL)\b\s*(?:of|is|=|:)?\s*\d|\b\d+(?:\.\d+)?\s*(?:GI|GL)\b/i
  },
  {
    label: "glucose-percent",
    pattern: /\d+\s*%[^.!?]{0,80}?\bglucose\b|\bglucose\b[^.!?]{0,80}?\d+\s*%/i,
    // The behavior-science citation block is the single approved home for
    // published-study percentages ("29% reduction in post-meal glucose
    // spikes", Imai 2023) — hedged, attributed, and explicitly framed as not
    // describing Revora's users.
    exemptSources: ["app/(app)/how-it-works/page.tsx"]
  },
  // ── New, 2026-07-11 (W-09). Claims, not verbs. ────────────────────────────

  {
    // F-24. Revora has not launched and has zero subscribers. Every one of
    // these asserts something about a user base that does not exist — which
    // PRODUCT.md §Design Principles 4 ("No fabricated data") already forbids
    // and which nothing enforced. The paywall shipped "Most popular" on a
    // product nobody had ever bought.
    //
    // Note what is NOT here: "Best value" on the annual plan. That one is
    // computed from the live prices (paywall-card.tsx annualSavingsPct), so it
    // is an arithmetic fact, not a claim about other people.
    label: "social-proof",
    pattern: new RegExp(
      [
        /\bmost\s+popular\b/,
        // No leading \b before "#": it is not a word char, so `\b#` would only
        // match after a word char — i.e. never, in "the #1 app". Caught by the
        // KNOWN_BAD control, which is exactly what the controls are for.
        /#\s*1\b/,
        /\bnumber\s+one\b/,
        /\b(?:thousands|millions|hundreds)\s+of\s+(?:users|people|members|customers|patients)\b/,
        /\bjoin\s+[\d,]+\+?\s*(?:users|people|members|others)\b/,
        /\b[\d,]{2,}\+?\s*(?:users|members|subscribers|customers|reviews|ratings)\b/,
        /\b(?:trusted|loved|used)\s+by\s+(?:[\d,]+|thousands|millions|hundreds)\b/,
        /\b\d(?:\.\d)?\s*(?:out\s+of\s+5|stars?|★)\b/,
        /\bbest[\s-]?selling\b/,
        /\bcustomer\s+favou?rite\b/
      ]
        .map((r) => r.source)
        .join("|"),
      "i"
    )
  },

  {
    // F-14. The CDC DPP studied an intensive, year-long, in-person lifestyle
    // programme; its headline result is a 58% reduction in progression to type
    // 2 diabetes. Naming it next to a user's own behavior builds an
    // implied-efficacy bridge — "your streak looks like the thing that cut risk
    // 58%" — which is a claim we cannot make and did not intend to make. The
    // BAI "excellent" band shipped exactly that sentence.
    //
    // The trial may only be cited where it is FULLY framed: the /how-it-works
    // research disclosure, and the landing page's proof band, both of which say
    // in terms that it is not a result from Revora's users and not a promise
    // about the reader's numbers. Those two exemptions are themselves guarded —
    // see "the DPP exemption is not a blank cheque" below, which fails if the
    // framing is ever deleted out from under the citation.
    label: "study-association",
    pattern:
      /\b(?:CDC\s+)?DPP\b|\bdiabetes\s+prevention\s+program\b|\bNEJM\b|\b(?:Jenkins|Imai|Shukla)\s+et\s+al\b/i,
    exemptSources: ["app/(app)/how-it-works/page.tsx"]
  },

  {
    // F-04. lib/revora/postprocess.ts:assertNoUnsafeSafeFields THROWS if a SAFE
    // result carries an adjustment or a swap — a "Clear" verdict is
    // structurally forbidden both. So every surface that promised "one reason,
    // one adjustment, and one safer swap" was advertising a thing the engine
    // refuses to produce for a third of its own verdicts. That is not a nuance;
    // on the happiest path the product has — you're fine, eat it — the promise
    // is guaranteed to be broken.
    //
    // The rule: if a sentence PROMISES a swap or an adjustment, that same
    // sentence must carry the conditional. The Play listing already got this
    // right ("plus, when there's one, a simple adjustment") — the web surfaces
    // did not.
    label: "unconditional-swap",
    predicate: (text) =>
      sentences(text).some((s) => SWAP_PROMISE.test(s) && !HEDGE.test(s))
  },
  {
    // AUD-007 (2026-07-24). The C7 journey deliberately renders NO user-visible
    // score — no composite, no bands, no percentages (RV-3, app/(app)/journey).
    // The landing shipped "the weekly progress score …" anyway, promising a
    // recurring artifact the product does not provide. User-facing copy may
    // describe the recap; a "score" is a feature claim the journey refutes.
    // The internal BAI stays internal — if a score ever becomes user-visible
    // again, delete this family in the same PR that renders it.
    label: "score-artifact",
    pattern: /\b(?:progress|weekly|behou?rioral|behavioral)\s+score\b|\bscore\s+bands?\b/i
  },
  {
    label: "eat-decision",
    pattern: /should\s+i\s+eat\s+this/i
  },
  {
    label: "personal-safety",
    pattern: /safe\s+for\s+(?:your|my)\s+(?:blood\s+sugar|health)/i
  },
  {
    label: "future-test-outcome",
    pattern: /normal\s+at\s+every\s+test/i
  }
];

function scan(text: string, source?: string): string[] {
  const subject = subjectFor(text, source);
  return BANNED.filter((family) => {
    if (source && family.exemptSources?.includes(source)) return false;
    return family.pattern
      ? family.pattern.test(subject)
      : family.predicate!(subject);
  }).map(({ label }) => label);
}

// ─────────────────────────────────────────────────────────────────────────────
// Coverage: a glob, not a list
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Denied paths. Each needs a REASON — never "it was failing".
 * Prefix-matched against the repo-relative path.
 */
const DENY: Array<{ prefix: string; why: string }> = [
  {
    prefix: "app/video-engine/",
    why: "Internal marketing-video dashboard. Localhost-only (next.config.ts gates it out of prod builds); never served to a user."
  },
  {
    prefix: "app/admin/",
    why: "Internal pantry-ops console behind the admin gate. Operator-facing, not user-facing."
  },
  {
    prefix: "components/icons.tsx",
    why: "Pure SVG path data. No prose."
  }
];

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(path.join(ROOT, dir), {
    withFileTypes: true
  })) {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(rel, out);
    else if (entry.name.endsWith(".tsx")) out.push(rel);
  }
  return out;
}

const globbed = [...walk("app"), ...walk("components")]
  .filter((rel) => !DENY.some((d) => rel.startsWith(d.prefix)))
  .sort();

/**
 * Copy that lives outside app/ and components/ — API route strings, fallback
 * copy, coach outputs, transactional email bodies. Explicit, because globbing
 * all of lib/ and app/api/ would pull in a great deal of engineering prose that
 * legitimately names banned words (`reviewer-signin/route.ts` says "treated as
 * non-prod") and would train everyone to reach for the deny list.
 */
const EXTRA_SOURCES = [
  "app/api/check/route.ts",
  "app/api/check/photo-draft/route.ts",
  "lib/client/photo-draft.ts",
  "lib/client/ui-state.ts",
  "lib/revora/fallback.ts",
  "lib/revora/coach-outputs.ts",
  "lib/revora/labels.ts",
  "lib/coach/insights.ts",
  "lib/coach/bai.ts",
  "lib/coach/recap.ts",
  "lib/coach/next-action.ts",
  "lib/server/pantry/emails.ts",
  "lib/server/billing/emails.ts",
  "docs/runbooks/marketing-assets.md",
  // The AI-crawler summary is user-facing copy served verbatim — scan it raw.
  "public/llms.txt"
];

/**
 * Documents that ship as copy. Only the FENCED regions are scanned — the text
 * that actually gets pasted into Play Console, or lifted out of the brief.
 *
 * The unfenced prose in both files discusses the banned vocabulary on purpose
 * (PRODUCT.md's "Rejected claims" section has to name the rejected line; the
 * listing's §5 has an explicit "Avoid:" list). Scanning those whole-file would
 * force us to write about the rules without naming them, which is how the rules
 * get forgotten. Fence-integrity is asserted separately below, so the audit
 * cannot be switched off by quietly deleting a fence.
 */
const FENCED_DOCS = ["docs/ops/play-listing.md", "PRODUCT.md"];

const FENCE_START = "<!-- claims-audit:start -->";
const FENCE_END = "<!-- claims-audit:end -->";

function fencedRegions(text: string): string[] {
  const out: string[] = [];
  const re = new RegExp(`${FENCE_START}([\\s\\S]*?)${FENCE_END}`, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) out.push(m[1]);
  return out;
}

const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), "utf8");

// User-facing contract copy only. The disclaimer is excluded — it is the single
// approved home for "not medical advice"; prompt snippets are excluded because
// they legitimately negate banned terms ("do not diagnose") and are governed by
// the safety-contract fixture tests instead.
const USER_FACING_COPY_KEYS = [
  "productHomeHero",
  "clarificationExample",
  "nonFoodRefusal",
  "belowRangeRoute",
  "highRangeRoute"
] as const;

const surfaces = [
  ...[...globbed, ...EXTRA_SOURCES].map((rel) => ({
    source: rel,
    text: read(rel)
  })),
  ...FENCED_DOCS.map((rel) => ({
    source: rel,
    text: fencedRegions(read(rel)).join("\n\n")
  })),
  ...USER_FACING_COPY_KEYS.map((key) => ({
    source: `contract.copy.${key}`,
    text: contract.copy[key]
  })),
  {
    source: "docs/product-marketing.md#Approved acquisition copy",
    text: extractSection(
      fs.readFileSync(path.join(ROOT, "docs/product-marketing.md"), "utf8"),
      "## Approved acquisition copy",
      "## Launch gate"
    )
  }
];

// ─────────────────────────────────────────────────────────────────────────────
function extractSection(text: string, start: string, end: string): string {
  const startIndex = text.indexOf(start);
  const endIndex = text.indexOf(end, startIndex + start.length);
  if (startIndex === -1 || endIndex === -1) {
    throw new Error(`Missing audited marketing section: ${start} → ${end}`);
  }
  return text.slice(startIndex, endIndex);
}

describe("claims-boundary copy audit", () => {
  it.each(surfaces)(
    "$source stays inside the claims boundary",
    ({ source, text }) => {
      expect(scan(text, source)).toEqual([]);
    }
  );

  it("scans every user-facing surface, not a hand-kept list", () => {
    // The regression guard for blind spot #1. These eleven were shipped and
    // unaudited until 2026-07-11; if the glob ever silently stops reaching
    // them, this fails rather than going quietly green.
    const mustBeCovered = [
      "components/dashboard-view.tsx",
      "components/guest-dashboard.tsx",
      "components/dashboard-insight.tsx",
      "components/plan-box.tsx",
      "components/pantry-confirm-list.tsx",
      "components/pantry-intake-flow.tsx",
      "components/first-run-gate.tsx",
      "app/(app)/home/page.tsx",
      "app/pantry/intake/page.tsx",
      "docs/ops/play-listing.md",
      "PRODUCT.md"
    ];
    const scanned = new Set(surfaces.map((s) => s.source));
    expect(mustBeCovered.filter((f) => !scanned.has(f))).toEqual([]);
    // And a floor, so a broken walk() that returns [] can't pass the above.
    expect(globbed.length).toBeGreaterThan(40);
  });

  it("keeps the fenced docs actually fenced", () => {
    // A deleted fence would silently drop a doc from the audit while every
    // other test stayed green — the exact failure mode this whole file exists
    // to prevent.
    for (const rel of FENCED_DOCS) {
      const text = read(rel);
      const starts = text.split(FENCE_START).length - 1;
      const ends = text.split(FENCE_END).length - 1;
      expect(starts, `${rel}: unbalanced audit fences`).toBe(ends);
      expect(starts, `${rel}: has no audit fence`).toBeGreaterThan(0);
      expect(
        fencedRegions(text).join("").trim().length,
        `${rel}: audit fences are empty`
      ).toBeGreaterThan(200);
    }
  });

  it("does not let the DPP exemption become a blank cheque", () => {
    // app/page.tsx and /how-it-works may cite the trial ONLY because they carry
    // the framing that makes it honest. If someone trims the disclaimer but
    // leaves the "58%", the exemption is silently hollowed out and the page
    // starts making the claim the exemption was granted on the promise of not
    // making. So: hold the framing, not just the citation.
    //
    // JSX escapes apostrophes as &apos;, so the framing has to be matched
    // through the entity — a naive /Prediabetes Pal's/ matches nothing and this
    // guard would pass vacuously.
    //
    // ⚠️ The brand name is spelled out here on purpose, and it is why the
    // 2026-08-09 rename turned this red instead of letting it drift. Keep it in
    // step with the copy in app/(app)/how-it-works/page.tsx. Do NOT "fix" a
    // failure here by loosening the brand to `.*` — the whole point is that this
    // sentence is present and about US, and a wildcard would pass on a page that
    // had quietly dropped the subject.
    const apos = "(?:'|&apos;|’)";
    const hiw = read("app/(app)/how-it-works/page.tsx");
    expect(hiw).toMatch(
      new RegExp(
        `none of the following describes Prediabetes Pal${apos}s own users`,
        "i"
      )
    );
    expect(hiw).toMatch(/individual results vary/i);
  });

  it("keeps the trial citation off every other surface", () => {
    // The positive statement of F-14: exactly two surfaces may name it. Stated
    // as an equality, not a subset — so a THIRD surface picking up the citation
    // fails here even though that surface would also fail its own scan. Belt.
    const citing = surfaces
      .filter(({ text, source }) => /\bDPP\b/i.test(subjectFor(text, source)))
      .map(({ source }) => source)
      .sort();
    expect(citing).toEqual(["app/(app)/how-it-works/page.tsx"]);
  });

  it("pins the free-tier number in the Play listing to TASTER_LIMIT", () => {
    // F-07: the listing promised "five a day, every day". The truth is
    // TASTER_LIMIT checks on day one, device-local. A store listing is a claim
    // made to a reviewer, so this one is not allowed to drift ever again.
    const listing = fencedRegions(read("docs/ops/play-listing.md")).join("\n");
    expect(listing).toMatch(
      new RegExp(`${TASTER_LIMIT}\\s+free checks on your\\s+first day`)
    );
    expect(listing).not.toMatch(/five a day/i);
    expect(listing).not.toMatch(/free,?\s+every\s+day/i);
  });

  // One known-bad sample per family — and per ALTERNATIVE within a family — so a
  // typo in any pattern fails loudly instead of quietly passing everything.
  const KNOWN_BAD: Record<string, string[]> = {
    reverse: ["supports prediabetes reversal"],
    cure: ["this will help cure prediabetes"],
    treat: ["a way to treat your blood sugar"],
    prevent: ["preventive care for prediabetes"],
    diagnose: ["Revora can diagnose prediabetes"],
    FDA: ["fda cleared for prediabetes"],
    guarantee: ["results are guaranteed"],
    "future-claim": ["this will lower your A1C"],
    "mg/dL": ["keeps you under 140 mg/dL"],
    "gi-gl-number": ["white rice has a glycemic index of 73"],
    "glucose-percent": ["cuts your glucose spikes by 40%"],
    "social-proof": [
      "Most popular",
      "the #1 prediabetes app",
      "join thousands of users",
      "trusted by 40,000 people",
      "rated 4.8 stars",
      "our best-selling plan",
      "12,000 subscribers and counting"
    ],
    "study-association": [
      "your check-ins match the consistency profile studied in the CDC DPP trial",
      "as shown in the Diabetes Prevention Program",
      "published in NEJM",
      "per Imai et al"
    ],
    "unconditional-swap": [
      "one reason, one adjustment, and one safer swap",
      "every verdict comes with a safer swap",
      "you always get a simple adjustment"
    ],
    "score-artifact": [
      "the weekly progress score is behavioral",
      "your progress score updates every Monday",
      "four plain-language score bands"
    ],
    "eat-decision": ["Should I eat this?"],
    "personal-safety": ["safe for your blood sugar"],
    "future-test-outcome": ["Normal at every test"]
  };

  it("has a control sample for every family", () => {
    // Without this, adding a family and forgetting its KNOWN_BAD row gives you
    // an unverified regex that is indistinguishable from a working one.
    expect(Object.keys(KNOWN_BAD).sort()).toEqual(
      BANNED.map((f) => f.label).sort()
    );
  });

  it.each(
    Object.entries(KNOWN_BAD).flatMap(([label, samples]) =>
      samples.map((sample) => [label, sample] as const)
    )
  )("flags the %s family: %s", (label, sample) => {
    expect(scan(sample)).toContain(label);
  });

  // The counterpart control: hedged copy must NOT trip unconditional-swap, or
  // the family is just a ban on the word "swap" and every surface will route
  // around it by deleting the feature from its copy.
  it.each([
    "one reason and, when there's one, an adjustment and a safer swap",
    "plus, when there's one, a simple adjustment, a swap that fits your kitchen",
    "A swap, when one helps, that works with what you actually have",
    "Swap: steel-cut oats hold up steadier than instant packets"
  ])("allows a properly hedged swap: %s", (sample) => {
    expect(scan(sample)).not.toContain("unconditional-swap");
  });
});
