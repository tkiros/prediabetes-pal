# Landing: design applied, 7-rules audit done, phases 1–3 green — four items open

**Date** 2026-08-11 · **Branch** `main` (⚠️ uncommitted — see Step 0)
**Full record** `docs/landing/2026-08-11-design-copy-7-rules-audit.md`
**Source design files**
- `/home/tefera/Downloads/Revora Landing(2).html` — the Stitch export (escaped
  HTML, `sc-for`/`{{ }}`; unescape it before reading)
- `/home/tefera/Downloads/revora_landing_page(1).html` — a React/Babel variant,
  source of the click-to-switch feature carousel

---

## Read this first

Everything below the line marked **OPEN** is unstarted. Everything above it is
shipped and green. Do not redo shipped work; several blocks look wrong-but-are-
deliberate and the reasons are in `app/page.tsx` comments, which are long on
purpose because this page is guard-enforced.

The single most important thing to internalise: **this landing page is protected
by tests that read its copy.** You cannot write a sentence here without the
claims audit reading it — including your own JSX comments. Three separate
failures this session were comments, not copy.

---

## Step 0 — BEFORE ANY EDIT: branch and commit

The work is **uncommitted on `main`**. A new session that starts editing could
lose all of it.

```bash
cd /home/tefera/Desktop/Revora
git checkout -b feat/landing-design-v5
git add app/page.tsx app/globals.css DESIGN.md docs/safety/copy-ledger.md \
        components/landing-includes.tsx public/landing/familiar/ \
        docs/landing/2026-08-11-design-copy-7-rules-audit.md \
        docs/prompts/2026-08-11-landing-design-apply-and-7-rules-audit.md \
        docs/handoff/2026-08-11-landing-design-applied-phases-1-3-green-four-items-open-session-handoff.md
git commit -m "feat(landing): apply the v5 design, audit copy against the 7 sales rules"
```

Modified: `app/page.tsx`, `app/globals.css`, `DESIGN.md`,
`docs/safety/copy-ledger.md`.
Untracked and load-bearing: `components/landing-includes.tsx`,
`public/landing/familiar/` (six .webp).

---

## What was done

### Phase 1 — copy audited against the 7 psychology rules

Source: `/home/tefera/Downloads/7-psychology-sales-rules.md`. Verdict was
**5 PASS · 1 PARTIAL · 1 FAIL**, and the single finding was that the design file
had **deleted the FAQ and the offer ladder** — the only places rules 4 and 7 were
answered. Fixed by not deleting them.

⚠️ **Then the owner deleted the offer ladder anyway in Phase 3.** Rule 7 is now
**PARTIAL**: the FAQ's branch-aware "Do I need an account or a card to try it?"
answer survives, as does "cancel is one tap — not an email". Full reasoning is in
the deactivated `landing-offer-stages` ledger row.

### Phase 2 — design implemented

- Hero H1 leads with **"Can I eat this?"**; the shipped category line is line two.
- Four ghost-numeral pains → **six "If this sounds familiar" photo cards**.
- **NEW**: "Why 'eating healthy' still leaves you guessing" — 8 myth/reality rows.
- **NEW**: "What does Prediabetes Pal include?" — 5 features.
- Limits H2 → "We'd rather be trusted than impressive."
- **Three of the design's five feature bodies were rewritten** because they
  claimed unshipped capability: photo input (flag off), the learning journey
  (premium + server-flagged), and "no streaks" (`streak-chip.tsx` ships).
- **6 photos generated** → `public/landing/familiar/*.webp`, 664×360, ~70KB total.
  The six generation prompts are recorded verbatim in the audit doc; `page.tsx`
  points there for them.

### Phase 3 — owner revisions

Page went **18,804px → 16,083px** (28.2 → 24.1 screenfuls), 15 exits → 14.

| # | Ask | Outcome |
|---|-----|---------|
| 1 | Remove the offer ladder | Done; 2 ledger rows deactivated |
| 2 | Hero = the design's card composition | Done — phone frame, mint halo, two floating answers, all real fixtures |
| 3 | "Revora everywhere" | **Not reproducible.** 0 occurrences across 7 rendered routes; the screenshots showing it were the mockup HTML |
| 4 | Myth block centred, table white | Done |
| 5 | Centre every CTA | Done — one rule, 14 exits |
| 6 | Click-to-switch features | Done — `components/landing-includes.tsx` |
| 7 | Shorten the limits block | Done — 3 paragraphs → 1 sentence + link |
| 8 | Restyle "The same card, three times" | **Head only.** The cards themselves are still shipped-style — see OPEN #4 |

### Ledger rows touched

Added: `landing-familiar-cards`, `landing-myth-reality`, `landing-includes-five`.
Deactivated: `landing-audience-pains`, `landing-offer-stages`,
`landing-what-you-get`.
Amended: `landing-sources-note`, `landing-three-answers`.

### Gates, all green at handoff

```
npm run lint       0 errors (2 pre-existing <img> warnings)
npm run typecheck  pass
npm run test       2,225 passed | 2 skipped | 0 failed
npm run contract   9/9 validators
npm run build      compiled
npx playwright test tests/smoke/landing-a11y.spec.ts    12 passed
node scripts/measure-landing.mjs   16,083px · worst desert 1,977px / 2,001px
```

---

# OPEN — the four items, in order

Do them in this order. #1 unblocks #2, and #3 gates whether #1 can be completed
as asked.

---

## OPEN #1 — Make all five carousel panels real screens

**Now:** panels 1–2 render the real `ExampleResultCard`; panels 3–5 are
typographic statement panels. See the note at the `<LandingIncludes panels={…}>`
call site in `app/page.tsx`.

**Wanted:** five real app screens.

**Why it wasn't done:** `/meals` and `/journey` render from localStorage and an
API, so a headless capture gets their empty states; `/account` is behind auth.
This page has refused to draw fake UI since 2026-08-05.

### The mechanism exists — here is the map

| Panel | Surface | Path |
|---|---|---|
| 1 Check your meal | `/check` | Already captured → `public/landing/app-check.png` |
| 2 Make a better choice | `ExampleResultCard risk="MODERATE"` | Already real, rendered live |
| 3 Learn your patterns | `/meals` | **Seed localStorage** — `historyStore` reads key `pal.history.v1` (`lib/client/history-store.ts:43`). `page.addInitScript` before `goto`. |
| 4 Build better habits | `WeekStrip` | **Easiest.** Takes plain props `{ week: VerdictWeekDay[], isDay0: boolean }` — render it on `/demo` with a fixture; no mocking at all. |
| 5 Stay in control | `/account` data section | **Open question.** Only surface with no established headless path. Options: extract the download/delete block into a component and render it on `/demo`; or capture `/privacy`; or seed a session. |

**The precedent to copy for anything that fetches:**
`tests/smoke/journey.spec.ts` mocks the API with `page.route` — its header says
"no real session/DB needed to exercise". `SavedMealsSection` and `JourneyCard`
both fetch and are flag-gated (`mealMemoryUiEnabled`, `learningJourneyUiEnabled`),
so they need either `page.route` interception or a props refactor.

**Route to prefer: `/demo`.** It already exists for exactly this
(`app/(app)/demo/page.tsx` — "the marketing-asset fixtures route… so the capture
script can screenshot each surface"), it is `noindex`, and it already carries
`data-shot="…"` hooks. Add fixture sections there rather than inventing a route.

⛔ **Element screenshots of `/demo` were tried and failed** — the app's fixed
chrome (skip link, app nav, bottom tab bar) paints over the captured element.
Either hide that chrome via `page.addStyleTag` before capture, or use a viewport
clip on a page that has no chrome.

⛔ Every new capture must go through `scripts/capture-landing-art.mjs`, committed
alongside its PNG — `landing-art.test.ts` asserts the script exists.

---

## OPEN #2 — Put every app screen in a small phone frame

**Wanted:** the app screenshots read as being *in* a phone — modest frame, not a
big showpiece device. Explicitly including **steps 1, 2 and 3** in the
"It asks before it guesses" block.

**Reuse what exists.** The hero already has this and it works — `.landing-showpiece-phone`
in `app/globals.css`:

```css
.landing-showpiece-phone {
  width: 100%;
  max-width: 380px;
  border-radius: clamp(28px, 3.4vw, 40px);
  padding: clamp(10px, 1.2vw, 14px);
  background: var(--text-strong);
}
```

Generalise it to a `.landing-phone` utility and apply it to
`.landing-step-art--shot` and the carousel panels. Keep it **smaller** in the
steps than in the hero — the hero frame is the page's showpiece and the steps
should not compete with it.

⚠️ **Height is the constraint, not taste.** Step art is inside the page's tallest
section, and the reachability budget is 2,001px per desert with the current worst
at 1,977px — **24px of headroom.** A frame adds ~28px of padding per instance.
Expect to re-measure and possibly add an exit. `.landing-showpiece-art img` in
`globals.css` carries a comment explaining why the hero capture is capped at
`clamp(220px, 26vw, 300px)`; the same logic applies.

⚠️ **`landing-art.test.ts` pins the alt text** of `/landing/app-check.png` to
`alt="The Prediabetes Pal check screen on a phone:…"`. It currently lives on step
one. If you move that image again, move the described alt with it — there must be
exactly one instance carrying it.

---

## OPEN #3 — Show all three input options (text, voice, photo) on the check screen

⛔ **THIS IS A PRODUCT DECISION, NOT A CAPTURE SETTING. Read before acting.**

Photo input is **off** and is gated twice:
- `NEXT_PUBLIC_PHOTO_INPUT` — client build flag, inlined at build time
- `PHOTO_INPUT_ENABLED` — server flag; the photo-draft route **404s** without it

Both fail closed (`lib/photo-input-flag.ts`). Neither is set locally.

**Three things break if you just flip the flag for a screenshot:**

1. `tests/smoke/photo-check.spec.ts` **asserts photo assist is absent** and the
   route returns 404 "in the default candidate". A shipped screenshot showing a
   photo button contradicts a passing test.
2. The landing's own `includes` copy branches off `photoInputEnabled()` at server
   render — so in a production build with the flag off, the **words would say
   "type it or say it" while the picture showed a camera**.
3. The copy ledger calls this the **unadvertised-feature gate**: advertising a
   capability the build does not ship is the specific failure that gate exists to
   prevent.

**Two honest options — pick one and say which:**

- **(a) Ship photo input for real.** Set both flags in the deployed env, update
  `photo-check.spec.ts` to assert presence, re-run `npm run contract`, and
  re-check the `includes` copy branch. This is an owner call about launching a
  feature, not a landing-page change.
- **(b) Capture text + voice only** (what ships today) and state it. The check
  screen genuinely shows two methods; a screenshot of two is accurate.

**Do not silently do (a) to make a screenshot look better.**

---

## OPEN #4 — Restyle the three result cards to the design

Phase 3 centred and shortened the *head* of "The same card, three times."
(now "Three meals. One layout. No score."). **The cards themselves were not
touched.** Reference: `/home/tefera/Pictures/Screenshot from 2026-08-11 20-58-18.png`
and the Stitch file.

### Spec, extracted from `Revora Landing(2).html` §7

| Property | Shipped now | Design |
|---|---|---|
| Card border | coloured **top rule** only | **`1.5px solid <risk colour>` on all four sides** |
| Radius | current | `26px` |
| Background | `--surface` | `#FFFDFA` (≈ warm white) |
| Meal row | plain | own row, `border-bottom: 1px solid #F0E7DA`, `min-height: 96px`, 17px |
| Verdict | tinted band + icon | **no band**; an `11px` round dot in the risk colour + verdict at `20px/800` |
| Why | 16.5px | 16.5px |
| Note | plain, below | **italic, 15px, bottom-aligned** via `margin: auto 0 0` |

Target is `LandingVerdictCard` in `components/example-result-card.tsx` and
`.landing-verdicts` in `globals.css`.

⛔ **Use the risk tokens, never hexes at the call site.** They are
`--safe-border` / `--moderate-border` / `--high-border` (and `-bg`, `-text`,
`-badge`) in `globals.css`. The design's `{{ c.dot }}` values map onto these.

⛔ **`landing-design-guards.test.ts` GUARD 1** fails the build if any `.landing`
selector declares `border`, `border-radius` or `box-shadow` on `.result-card` or
`.surface-card`. `LandingVerdictCard` is the *flat* family and does not use those
recipes — check which classes it emits before writing CSS.

**Keep the description below the headline.** The owner asked for shortening, not
removal; the current two-line lede is already the shortened version.

---

# Things that will bite you

1. **The claims audit reads your comments.** `claims-boundary-copy.test.ts`
   strips only *comment-leading* lines, so the second line of a JSX block comment
   is scanned exactly like rendered copy. Three failures this session:
   - the word for "how a thing is styled" beginning t-r-e-a
   - an indefinite article before the swap noun in an unhedged sentence
   - a warning comment that **quoted** the phrase it was warning about
   The audit's own rule: **describe, never quote.**

2. **Never retype these.** Verdict words come from `RISK_LABELS`
   (`lib/pal/labels.ts`); the free-check count interpolates from `TASTER_LIMIT`;
   the disclaimer renders from `BOUNDARY_DISCLAIMER`. `copy-pins.test.ts`
   enforces all three.

3. **The swap/adjustment conditional is contractual.** `assertNoUnsafeSafeFields`
   in `lib/pal/postprocess.ts` **throws** on a Clear result carrying either, so
   any sentence promising one must hedge in the *same sentence*.

4. **Reachability.** `node scripts/measure-landing.mjs` needs a running server.
   Budget 2,001px per desert; current worst **1,977px — 24px of headroom.** Any
   height you add needs a re-measure and probably an exit.

5. **`measure-landing.mjs` measures ONE tab state.** The carousel's panels differ
   in height. Measure with the tallest panel selected, not just the default.

6. **New copy needs a ledger row.** Every block on this page cites one. The
   `--require-copy-ledger` validator passes without them, so this is convention
   the tests will not catch — see the three rows added this session for the
   format, and the deactivation convention (`Active: Yes → No`, keep
   `Approved`, record why) for anything removed.

7. **Plane alternation.** Sheet / page must alternate. Removing the offer ladder
   put two sheets back to back and the FAQ had to drop to page ground. Check the
   neighbours of anything you add or delete.

8. **The hero is no longer dark.** It was `--accent-strong` and was the first of
   the page's two dark bookends; the design draws it cream-on-mint. The final CTA
   is now the only dark ground. **If the top of the page reads flat, this is the
   first thing to revisit** — it is recorded as a deliberate override in
   `globals.css`, not an accident.

9. **Pre-existing landmine, unrelated to this work.** `scripts/capture-landing-art.mjs`'s
   `clipH: 700` is **stale** against the current `/check` layout — a re-run now
   cuts the suggestion chips in half. Re-derive the clip before trusting any
   re-capture. An accidental re-capture was reverted this session for exactly
   this reason.

---

# Definition of true done

- [ ] Step 0 done — branched and committed
- [ ] Five carousel panels show five real surfaces (or the ones that cannot are
      named, with a reason, in the audit doc)
- [ ] Every app screenshot sits in a small phone frame, steps 1–3 included
- [ ] Input-options decision made explicitly — (a) ship photo, or (b) capture
      text + voice and say so
- [ ] Three result cards match the design spec, risk tokens only
- [ ] New/changed copy has ledger rows; removed copy is deactivated with a reason
- [ ] All gates green **and pasted**: `lint`, `typecheck`, `test`, `contract`,
      `build`, `landing-a11y.spec.ts`, `measure-landing.mjs`
- [ ] `measure-landing.mjs` re-run **with the tallest carousel panel selected**
- [ ] `docs/landing/2026-08-11-design-copy-7-rules-audit.md` updated with a
      Phase 4 section
