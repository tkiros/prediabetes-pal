# Prompt: audit landing copy against the 7 psychology rules, then implement the new landing design

Copy everything below the line into a fresh session, or just point the session at
this file path.

---

## Task

Two phases, in order. **Do not start Phase 2 until Phase 1 is reported and I have
responded.**

### Inputs

- Design source: `/home/tefera/Downloads/Revora Landing(2).html`
- Rules: `/home/tefera/Downloads/7-psychology-sales-rules.md`
- Target: `app/page.tsx` (the live landing) and its components
- Existing landing art: `public/landing/`, captured by `scripts/capture-landing-art.mjs`
- Read `CLAUDE.md` before touching any string containing "revora"

### What the design source actually is (verified 2026-08-11 — don't rediscover this)

It is **not** plain HTML you can paste. It is a Google Stitch export: one long
escaped HTML string (`/` for `/`) inside a JS wrapper, using custom elements
`sc-for`, `sc-if`, `sc-camel-on-click`, `sc-camel-on-change`, `{{ }}` bindings, and
inline `style=` on every node. The 24 `url(...)` references are all `@font-face`
sources, not images. There are zero `<img>` tags and one `<svg>`.

So the job is **translation into the repo's existing React/Next + styling
conventions**, matching the surrounding code — not a copy-paste, and not a
rewrite of the app shell.

### Phase 1 — Copy audit (blocking, report before implementing)

Audit the **copy carried inside the design file** (`heroLineOne`/`heroLineTwo`,
`familiar`, `myths`, `moments`, `features`, `limits`, `cards`, the demo block, and
all section headings) — that is the copy that will ship, so that is what gets
audited. Where the current live copy in `app/page.tsx` is stronger on a given rule,
say so and keep the better line.

For each of the 7 rules, produce a table row: rule → the exact page section and
verbatim line that satisfies it → PASS / FAIL → if FAIL, the rewritten line.

Two rules need explicit handling, don't fudge them:

- **Rule 6 (Detachment Sells)** is about the seller's energy and has no direct
  landing-page element. Map it to an observable page property (no pressure
  language, no fake countdowns, no guilt framing, CTA stated once and calmly) or
  mark it N/A with a one-line justification.
- **Rule 7 (price objections are value objections)** substantially overlaps Rule 4.
  Audit it specifically against whatever appears near the price and the primary
  CTA.

Constraint on rewrites: this is a **health product for people with prediabetes**.
Pain-framing (Rule 2) and urgency (Rule 5) must stay truthful and non-alarmist —
no invented health consequences, no implied medical claims, no "your doctor won't
tell you this." If a rule can only be satisfied by an untrue or fear-mongering
claim, mark it FAIL-with-constraint and explain, rather than inventing copy.

Stop after the table. I will approve or amend before you implement.

### Phase 2 — Implement the design

Only after Phase 1 approval.

**Image placeholders.** The design file has **14 image slots**, each rendered as a
DM Mono text label instead of an image. They split into two kinds:

1. Nine `app screen — …` slots (meal input + answer, swap suggestion, meal
   history, weekly guidance, privacy controls, describe input, result card, saved
   history). Standing owner instruction (2026-08-05, documented at the top of
   `scripts/capture-landing-art.mjs`): these are **real screenshots captured from
   the running app**, not illustrations or mockups. Extend that script rather than
   hand-rolling a new capture path.
2. Five `photo — …` slots (hand on fridge door, appointment card, open tabs at
   night, kitchen scale, cleared plate, empty notebook). These need a source
   decision — licensed stock, generated, or cut the slot. **Ask me before
   sourcing any of them.**

Also enumerate and resolve every `{{ }}` binding and every `sc-for
hint-placeholder-count` array with real content. List anything you cannot fill
rather than leaving a silent gap.

**Do not fabricate social proof.** The file contains `[PLACEHOLDER — pull from App
Store / Play reviews once live]` behind a `showSocialProof` flag. Keep that section
gated off until real reviews exist. Do not write example testimonials, not even
labelled ones.

**Naming.** The design file's `<title>` says "Revora". The product is **Prediabetes
Pal** (renamed 2026-08-09). Strip Revora branding from all new user-facing copy —
and read the "`revora` strings that must NOT be cleaned up" section of `CLAUDE.md`
first: four categories of `revora` strings are load-bearing and removing them
breaks real things. Respect the rename lockstep traps listed there too.

**Polish.** Responsive down to 360px, keyboard-reachable interactive elements
(the demo input, feature tabs, and carousel dots are all interactive in the
design), visible focus states, `prefers-reduced-motion` respected on the ticker
and any transitions, real `alt` text on every filled image slot.

**This is a diff against working code, not a greenfield build.** The current
landing is the output of many prior sessions (v4 shipped 2026-08-08) with green
gates. Before declaring done, all of these must pass and you must paste the
output:

```
npm run lint && npm run typecheck && npm run test && npm run build
npx playwright test tests/smoke/landing-a11y.spec.ts
```

If any gate was already red before your change, say so explicitly rather than
absorbing it.

### Report

End with: what shipped, which image slots are still unfilled and why, any rule
that ended FAIL-with-constraint, and anything you deliberately left out.
