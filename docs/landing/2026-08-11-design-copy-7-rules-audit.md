# Phase 1 — Design-file copy audited against the 7 psychology-backed rules

**Audited:** the copy carried inside `/home/tefera/Downloads/Revora Landing(2).html`
(unescaped from the Stitch export; the readable version is in the session
scratchpad as `landing.clean.html`).
**Against:** `/home/tefera/Downloads/7-psychology-sales-rules.md`
**Compared to:** the shipped copy in `app/page.tsx` (v4, 2026-08-08).

**Result: 5 PASS · 1 PARTIAL · 1 FAIL.** Both the PARTIAL and the FAIL have the
same root cause and the same fix.

---

## The table

| # | Rule | Where it lives in the design copy | Verdict | Guard conflict in Phase 2 |
|---|------|-----------------------------------|---------|---------------------------|
| 1 | Emotion first, logic second | Hero: “Can I eat this?” → “You were handed a number and two words of advice. ‘Eat better.’ That’s not a plan. That’s a score.” Emotion runs for three full sections (hero → *If this sounds familiar* → *Why “eating healthy” still leaves you guessing*) before the first feature appears. | **PASS** | — |
| 2 | Pain beats pleasure | The six *familiar* cards are pure pain, named better than the reader would name it: “You eat, then you worry / The hour after the meal is the worst part.” · “Nothing to show the doctor / Six months of meals. No record of a single one.” Myth row 8: “‘You’re doing something wrong.’ → You were handed a number and left alone with it.” | **PASS** (strongest section on the page) | Stays non-alarmist — no invented health consequences. Nothing to fix. |
| 3 | Sell clarity, not convincing | Eyebrow “Built only for 5.7–6.4%.” H2s state the mechanism instead of arguing: “It asks before it guesses.” · “Three meals. One layout. No score.” · ticker “One card, one answer.” The oatmeal demo *shows* the mechanism rather than claiming it. | **PASS** | — |
| 4 | Objections are rarely the real objection | Handled: the four `limits` cards (“Built for one range” · “Unsure means unsure” · “Your data is yours — deleted, all of it, in one tap” · “Not medical advice”) and the hero’s “No login. No card. Nothing to install.” | **PARTIAL** | **The design file has no FAQ at all.** The live page carries six, and they are where the real objection (“will this work *for me*?”) actually gets answered. |
| 5 | Status quo must hurt more than change | The six-month gap is the whole device: “Six months away / That’s your next appointment. Dinner is tonight.” · myth 6 “‘You’ll figure it out by your next visit.’ → Six months of guessing isn’t a method.” · moment 4 “Your next appointment — six months of meals, in your own words, saved.” Closing CTA lands it on tonight, not on a fake deadline. | **PASS** | — |
| 6 | Detachment sells | “When a meal is already fine, [Pal] says so and stops. It doesn’t invent a correction to look useful.” · “We’d rather be trusted than impressive.” · “Says so when it’s unsure.” No countdown, no scarcity, no streaks, no guilt anywhere on the page. | **PASS** | — |
| 7 | Price objections are value objections | `pricing: []`. There is no price on the page — correct per the 2026-08-05 owner instruction — but there is also **nothing** about what happens after the free checks. | **FAIL** | Regression: the live page answers this and the design file drops the answer. |

---

## The one real finding

Rules 4 and 7 fail for the same reason: **the design file deleted the FAQ and put
nothing in its place.**

What the live page has and the design file does not:

- `"Do I need an account or a card to try it?"` — branch-aware off `paywallMode()`,
  because the true answer differs in trial vs. free-tier mode.
- `"How do I cancel?"` — “One tap, on your account page… No retention screens, no
  email hoops.”
- `"What do I actually have to do?"` — “No weighing, no barcode, no portion sizes,
  no food database to search.”
- Marquee line: “If you ever subscribe, cancel is one tap — not an email.”

That block *is* the Rule 4 / Rule 7 machinery. Shipping the design file as drawn
would make the landing page score worse on those two rules than what is live
today.

**Fix (Phase 2):** port the live FAQ section into the new design between *We’d
rather be trusted than impressive* and the closing CTA, keeping it branch-aware
and keeping the FAQPage JSON-LD wired to the same strings. Keep the “cancel is one
tap” marquee line.

Nothing else in the seven rules requires a copy rewrite. The design copy is
strong — Rule 6 in particular is executed better here than on most product pages.

---

## Guard conflicts to reconcile before Phase 2 ships

The live landing is guard-enforced. Adopting design copy verbatim trips these:

1. **`10 free checks` is hardcoded** in the hero caption and the closing CTA. The
   repo interpolates `TASTER_LIMIT` and never retypes it. Must interpolate.
2. **Verdict words** `Clear.` / `Be careful.` / `Hold off.` are retyped in the
   three example cards. They come from `RISK_LABELS` in `lib/pal/labels.ts`.
3. **Disclaimer strings** (3 occurrences) must pass
   `claims-boundary-copy.test.ts`, whose banned-family regex is negation-blind —
   a *denial* of a banned claim still trips it. Use the live FAQ’s wording, which
   was already reconciled against that test.
4. **CTA assembly.** The design draws five CTA instances. `landing-design-guards.test.ts`
   counts bare `landing-cta` occurrences to prove the pill is assembled exactly
   once — every instance must render through `LandingPrimaryCta`.
5. **Reachability budget.** Adding the myths table (8 rows), the six familiar
   cards, and the restored FAQ will move page height. `DESIGN.md §11.1` caps a
   stretch at 2,001px; re-run `node scripts/measure-landing.mjs`.
6. **Marquee.** Design has 4 ticker lines; live has 6 that are ledger-verbatim
   (`landing-marquee-strip`). Design’s “Says so when it’s unsure” duplicates
   live’s “When we’re unsure, we say so.” Live wording wins — it’s ledger-locked.
7. **F-04 / F-07 compliance is already correct** in the design: the “Clear” card
   carries no adjustment and no swap, which is what `assertNoUnsafeSafeFields`
   structurally requires. Do not “improve” it by adding one.

---

## Naming

The design file says **Revora** in 9 places: `<title>`, header wordmark, footer
wordmark, three disclaimer lines, the demo idle state (“Revora is waiting for a
plate”), the demo body copy (“Revora doesn’t answer. It asks one question
first”), myth row 7 (“Revora can’t, and won’t pretend to”), and `limits` card 1
(“Revora says so plainly”). All become **Prediabetes Pal**.

This does **not** touch the four protected `revora` string categories in
`CLAUDE.md` (`owned-domains.test.ts` denylist, the `contact.ts` / `email.ts`
docstrings, `sw-dev-teardown.test.ts` live hosts, and historical docs).

---

## Testimonials — removed

Per your instruction the entire `SOCIAL PROOF` section goes, along with the
`showSocialProof` prop in `data-props`. That is: the `Real plates. Real answers.`
heading, its subhead, and the `[PLACEHOLDER — pull from App Store / Play reviews
once live]` node.

Costs nothing against the seven rules — none of them is social proof — and it
matches the existing “no fabricated social proof” rule already written into
`app/page.tsx`.

---

## Corrections to the earlier count

I said 14 image slots. Rendered, it is **11**:

- **6 photos** — hand on fridge door · appointment card · open tabs at night ·
  kitchen scale · cleared plate · empty notebook (the `familiar` cards).
- **5 app screens** — meal input + answer · swap suggestion · meal history ·
  weekly guidance · privacy controls (the `features` carousel).

The other three (`describe input`, `result card`, `saved history`) live in a
`steps` array that **no markup references** — dead data in the export.

---

---

# Phase 2 — what shipped (2026-08-11)

## Adopted from the design

| Design section | Outcome |
|---|---|
| Hero H1 “Can I eat this?” | **Adopted** as line one; the shipped category line becomes line two (`.landing-h1-answer`) |
| “If this sounds familiar, you’re not the problem.” | **Adopted** — replaces the four ghost-numeral pains with six photo cards |
| “Why ‘eating healthy’ still leaves you guessing” | **New section.** Eight myth/reality rows as a `<dl>`, placed after the scope panel so the sheet alternation holds |
| “What does Prediabetes Pal include?” | **New section.** Five feature cards + the product’s own MODERATE result card |
| “We’d rather be trusted than impressive.” | **Adopted** as the limits H2 |
| Social proof | Not applicable — the shipped page never had it |
| Everything else | Kept as shipped. The showpiece, marquee, steps, verdict trio, what-changes, offer ladder, FAQ and footer are all guard-pinned and stronger than the drawn versions |

## Rules 4 and 7

Fixed by **not** deleting anything: the offer ladder and the six-question FAQ
stay exactly where they were, so “what happens after the free checks”, “do I
need a card”, and “how do I cancel” are still answered on the page.

## Copy rewritten against shipped truth

Three of the design’s five feature bodies claimed things this build does not
ship, and were rewritten rather than adopted:

- *“type, speak, or photograph”* — photo input is `photoInputEnabled()`, off in
  this build. Now branches off the same flag the FAQ does.
- *“a structured learning journey”* — `weeklyLearning` is premium **and**
  server-flagged (`lib/server/capabilities.ts`), so it cannot be listed as
  something the product includes.
- *“without calorie counting, streaks, or guilt”* — `components/streak-chip.tsx`
  ships inside the daily loop, so “no streaks” is false. The line now names the
  three things genuinely absent: weighing, a calorie total, and a score.

The conditional shape of the swap survives untouched (F-04 / F-07).

## Images — 11 slots, all resolved

- **6 photos, generated** → `public/landing/familiar/*.webp`, 664×360, ~12KB
  each, 70KB for the set. Still lifes and one hand; no faces, no legible text.
  The prompts are below, verbatim — `app/page.tsx` points here for them.
- **5 app screens** → ⚠️ **SUPERSEDED BY PHASE 3, BELOW.** In Phase 2 the
  carousel was dropped and the section showed a single live
  `<ExampleResultCard risk="MODERATE">`. Phase 3 restored the carousel as five
  switchable panels; read that section, not this bullet, for the shipped state.
  What has not changed is the constraint: three of the design’s five screens
  cannot be captured honestly — `/meals` and `/journey` render from local
  history and an API (a headless capture gets their empty states) and
  `/account` is behind auth. An element capture of `/demo` was tried and
  rejected: the app’s fixed chrome paints over it.

### The six image prompts, verbatim

Generated 2026-08-11. Every one carries the same closing constraint clause on
purpose — it is what keeps AI-garbled lettering, arrows and borders out of a set
that has to read as photography. Post-processing was identical for all six:
`sharp().resize(664, 360, { fit: "cover", position: "attention" }).webp({ quality: 78 })`.

1. **`fridge-door.webp`** — *A quiet documentary-style still life photograph, no text, no people's faces, no graphics or overlays. A hand resting on the handle of an open refrigerator door, seen from behind at shoulder height, soft cool light spilling out onto a dim kitchen. Muted warm-neutral colour grade, cream and oat tones, natural window light, shallow depth of field, film grain. Editorial magazine photography. Absolutely no text, no logos, no arrows, no borders.*
2. **`appointment-card.webp`** — *A quiet documentary-style still life photograph, no people, no faces, no graphics or overlays. A small paper appointment card lying on a wooden kitchen table beside a set of keys, the printed text intentionally out of focus and unreadable, soft afternoon window light falling across it. Muted warm-neutral colour grade, cream and oat tones, shallow depth of field, film grain. Editorial magazine photography. Absolutely no legible text, no logos, no arrows, no borders.*
3. **`open-tabs.webp`** — *A quiet documentary-style photograph taken at night, no people, no faces, no graphics or overlays. A laptop open on a dark bedside table in a dim bedroom, its screen glowing pale but the content completely out of focus and unreadable, a cold mug beside it. Muted warm-neutral colour grade with cool screen light, shallow depth of field, film grain. Editorial magazine photography. Absolutely no legible text, no logos, no arrows, no borders.*
4. **`kitchen-scale.webp`** — *A quiet documentary-style still life photograph, no people, no faces, no graphics or overlays. A small white digital kitchen scale on a clean worktop with a shallow bowl of uncooked rice resting on it, the scale's display out of focus and unreadable, soft diffused morning light. Muted warm-neutral colour grade, cream and oat tones, shallow depth of field, film grain. Editorial magazine photography. Absolutely no legible text, no numbers, no logos, no arrows, no borders.*
5. **`cleared-plate.webp`** — *A quiet documentary-style still life photograph, no people, no faces, no graphics or overlays. A single cleared dinner plate with knife and fork set down together, a crumpled napkin beside it, on a plain table in fading evening light. Empty chair just out of frame. Muted warm-neutral colour grade, cream and oat tones, shallow depth of field, film grain. Editorial magazine photography. Absolutely no text, no logos, no arrows, no borders.*
6. **`empty-notebook.webp`** — *A quiet documentary-style still life photograph, no people, no faces, no graphics or overlays. An open blank notebook with completely empty unlined cream pages lying on a table, a pen resting in the gutter, soft side light. Nothing written on the pages. Muted warm-neutral colour grade, cream and oat tones, shallow depth of field, film grain. Editorial magazine photography. Absolutely no text, no writing, no logos, no arrows, no borders.*

## Copy ledger

Three rows added to `docs/safety/copy-ledger.md`, because every landing block on
this page cites one and the new sections cited none:

- **`landing-familiar-cards`** — the six cards. Supersedes
  **`landing-audience-pains`**, which is flipped Active `Yes → No` in the same
  pass and left Approved, following the convention `landing-what-you-get`
  established: nothing about those four claims became false, they simply have no
  surface, and retiring the row would discard its approval history.
- **`landing-myth-reality`** — the eight pairs. The row records why row 7 (“an
  app can read your blood sugar”) is the one that earns the block, and that it
  goes red if that ever stops being true.
- **`landing-includes-five`** — the feature inventory, with the three rewritten
  bodies and their reasons recorded as the substance of the row. It explicitly
  does not double-cover `landing-what-you-get`: this block names what the *free*
  checks show, that row names what a subscription adds.

`npm run contract` passes all nine validators with the three rows active.

## Guard conflicts, all resolved

1. `10 free checks` — untouched; the new copy adds no hardcoded counts.
2. Verdict words interpolate from `RISK_LABELS` in the first feature body.
3. Two claims-boundary failures, both in **JSX comments**, which the audit scans
   like rendered copy: the word for “how a thing is styled” beginning t-r-e-a,
   and an indefinite article before the swap noun in an unhedged sentence — the
   second tripped again when the warning comment *quoted* the phrase.
4. CTA assembly untouched — every new exit renders through `LandingPrimaryCta`.
5. `.landing-includes-art` declares layout only; the result card keeps its own
   recipe (`landing-design-guards.test.ts`).
6. **Reachability re-measured four times.** Three new exits were added, all at
   measured positions: one under the familiar cards (2,756px → legal), one
   inside the includes copy column (mobile only), one at the foot of the
   includes section. The familiar photos also crop shallower below 640px
   (664/225) to buy back ~85px per card. Final: **worst desert 1,977px against
   a 2,001px budget, 15 exits, 18,804px page.**

## Gates

```
npm run lint       0 errors (4 pre-existing <img> warnings)
npm run typecheck  pass
npm run test       2,223 passed | 2 skipped | 0 failed  (192 files)
npm run build      compiled, 95 static pages
playwright landing-a11y.spec.ts   12 passed
node scripts/measure-landing.mjs  worst desert 1,977px — within budget
```

---

# Phase 3 — owner revisions, same day

Eight items, all applied. Page went **18,804px → 16,083px** (28.2 → 24.1
screenfuls) and 15 exits → 14.

| # | Ask | Outcome |
|---|-----|---------|
| 1 | Remove the offer ladder | **Done.** Both ledger rows deactivated — see the warning below |
| 2 | Hero = the design's card composition | **Done.** Phone frame + halo + two floating answers, all real fixtures |
| 3 | “Revora everywhere” | **Not reproducible** — 0 occurrences across 7 rendered routes |
| 4 | Myth block centred, table white | **Done** |
| 5 | Centre every CTA | **Done** — 14 exits, one rule |
| 6 | Click-to-switch features | **Done** — new client component, real tab semantics |
| 7 | Shorten “We’d rather be trusted than impressive” | **Done** — 3 paragraphs → 1 sentence + link |
| 8 | Restyle “The same card, three times” | **Done** — centred head, lede 5 lines → 2 |

## ⚠️ Item 1 re-opens the rule-7 finding

The offer ladder is what made **rule 7 pass** in the Phase 1 audit above. Removing
it drops rule 7 from **PASS to PARTIAL** — not back to FAIL, because the FAQ’s
branch-aware “Do I need an account or a card to try it?” answer survives, as does
“cancel is one tap — not an email” in the marquee.

There is a second cost, recorded in `landing-offer-stages`: that block was itself
the 2026-08-05 fix for a reader learning a card was involved only at the trial
wall. If anyone reports being surprised by a card, restore that block rather than
writing a new one.

## Item 3 — the name is already clean

0 occurrences of “Revora” across `/`, `/about`, `/guides`, `/how-it-works`,
`/privacy`, `/terms`, `/get-the-app`. The screenshots showing “Revora” are the
**design mockup** (`Revora Landing(2).html`), which still carries the old name in
its own markup. The two screenshots of the shipped page both read “Prediabetes
Pal”. Nothing to change.

## Item 2 — what the hero rework costs

The showpiece was `--accent-strong`, the **first of the page’s two dark planes**,
and the design draws it cream-on-mint. It is now light, leaving the final CTA as
the only dark ground. Recorded in `globals.css` as a deliberate override of
DESIGN.md §11’s alternation: if the top of the page reads flat, restoring the
dark panel is the first thing to try.

The `/check` capture moved to step one and took its described `alt` with it —
`landing-art.test.ts` asserts on both, and step one’s `alt=""` was only empty
because the showpiece carried the described copy.

## Item 6 — the interaction is the design’s, the contents are the product’s

`components/landing-includes.tsx`, the page’s second client component. Real tab
semantics: `role="tablist"`, `aria-selected`, roving `tabindex`, and
Left/Right/Home/End.

Two departures from `revora_landing_page(1).html`:

- **Its `AppMockup` is not shipped.** It draws five invented phone screens with
  invented product output — *“Excellent balance of lean protein, complex carbs,
  and fiber. Enjoy your meal!”* and *“may cause a rapid spike.”* Neither is a
  string this engine produces, and the second is a glycemic claim that fails
  `claims-boundary-copy.test.ts` outright. Panels 1 and 2 render the real
  `ExampleResultCard`; panels 3–5 are statement panels naming where the feature
  lives. Making all five real screens needs seeded fixture state on `/demo` — a
  follow-up.
- **No dot row.** The design draws dots below the panel *and* the five cards
  beside it: two controls for one piece of state, and a second tab list for a
  screen reader.

## Gates

```
lint       0 errors (2 <img> warnings)
typecheck  pass
test       2,225 passed | 2 skipped | 0 failed
contract   9/9 validators
build      compiled
a11y       12 passed
measure    16,083px, worst desert 1,977px / 2,001px — within budget
```

## Assumptions I carried into Phase 2

1. “Google polished *Why “eating healthy” still leaves you guessing* and *What
   does Revora include?*” → I keep both sections’ structure and copy exactly as
   drawn, and change only the name: **“What does Prediabetes Pal include?”**
2. The 5 app-screen slots get real captures via `scripts/capture-landing-art.mjs`
   (standing owner instruction, 2026-08-05: real screenshots, not illustrations).
3. **Unresolved and blocking for the 6 photo slots:** no source decided. Licensed
   stock, generated, or drop the photo column and let the `familiar` cards run as
   text-only? Text-only is the cheapest and loses nothing on the seven rules.

---

# Phase 4 — the four open items, closed (2026-08-11, later session)

Continued from
`docs/handoff/2026-08-11-landing-design-applied-phases-1-3-green-four-items-open-session-handoff.md`.
Three of the four shipped as asked; one shipped 4/5 on an owner ruling. Two of
the handoff's own premises turned out to be wrong, and correcting them is the
most important thing in this section.

## ⚠️ Correction 1 — Item 3 above is WRONG. The name was not clean.

Phase 3 closed the owner's "Revora everywhere" report as not reproducible,
having found 0 occurrences across seven rendered routes.

**The occurrence was in `public/landing/app-check.png`** — the check-screen
capture at step one, whose wordmark still read **Revora**. The capture predates
the 2026-08-09 rename and no rename sweep could reach it, because the check
scanned *rendered text* and the name was *pixels*.

The owner was right and the page was wrong for two days. Re-capturing fixed it.

**The lesson worth keeping:** every rename, claim and copy guard in this repo
reads source or DOM. A committed screenshot is a hole in all of them at once.
That is now the stated reason `landing-meals-capture` exists as a ledger row and
why `landing-art.test.ts` pins each capture to the constants it renders.

## ⚠️ Correction 2 — the photo-input premise was inverted

The handoff recorded photo assist as OFF, gated twice and fail-closed, and
warned that picturing it would advertise an absent capability.

That was read off a **local** env. The deployed build has both gates set:

- `prediabetespal.com/check` renders the third control's copy branch
- `POST /api/check/photo-draft` in production answers **200**, not 404
- the photo FAQ renders on the production landing page
- `docs/release/truth-index.md` records both flags set in Vercel on 2026-07-21

So the page was **under**-describing what ships, not over-describing it.

**But the fix is not "name three methods", and this is the part that matters.**
`components/food-check-form.tsx` passes `premium={mode === "trial" &&
!entitled}`: in the shipped paywall mode a photo draft is Premium, the chip
carries a Premium tag, and the route 402s a free session before any camera
opens. This page sells the **free** checks — the includes lede promises in as
many words that a reader sees all five features on them.

Naming the camera in that clause would advertise, as free, the one input method
a free reader cannot use. The pre-existing `photoEnabled ? …` branch in the
includes body did exactly that in any build with the flag on, which is every
deployed build.

**What shipped, on the owner's (a) ruling:**

| Surface | Before | Now |
|---|---|---|
| The capture | two chips, "Revora" wordmark | three chips **including the visible Premium tag**, correct wordmark |
| includes body one | branched to three when flagged | two, unconditionally |
| step one copy | two | two (unchanged) |
| "What do I actually have to do?" | two | two (unchanged) |
| photo FAQ | described the camera, no price | **leads with the price**, branched on `paywallMode()` |

The picture shows all three options, which is what the ask was about; the words
describe the two a free reader gets; and the Premium tag is legible in the
screenshot, so picture and copy agree. The photo FAQ had been reaching real
readers describing a paid feature with no mention that it was paid — that is the
one thing here that was actively wrong in production, and it is fixed.

⛔ **`tests/smoke/photo-check.spec.ts` was NOT inverted.** The handoff proposed
it under the same wrong premise. It asserts the **flag-unset default candidate**
is fail-closed — still true, still valuable, and inverting it would have deleted
the guard rather than updated it. It passes unchanged (4/4).

⚠️ **Left for the owner, outside landing scope:**
`docs/legal/owner-risk-launch-decision-5f6abcb.md` states *"Meal photo-assist
stays OFF. `NEXT_PUBLIC_PHOTO_INPUT` must remain unset"* and requires a
function-specific evidence review plus a written owner decision to enable it.
Production has it enabled. The record and reality disagree; that predates this
session and only the owner can reconcile it.

## Item 1 — carousel panels: 3 of 5 are a real surface

| # | Panel | How |
|---|---|---|
| 1 | Check your meal | real `ExampleResultCard`, live, framed |
| 2 | Make a better choice | real `ExampleResultCard`, live, framed |
| 3 | Learn your patterns | **real `/meals` screen**, captured with seeded localStorage |
| 4 | Build better habits | statement panel — see the reverted attempt below |
| 5 | Stay in control | statement panel — owner ruling |

**Panel 3.** The signed-out `/meals` page falls back to the on-device store
(`fetchHistoryPage` returns `guest`, then the page reads `historyStore.all()`),
so seeding `pal.history.v1` via `addInitScript` before navigation renders the
real screen with fixture rows. This is the `/demo` contract — real component,
fixture data — pointed at a route instead of a component.

### ⚠️ Panel 4 was shipped real and then reverted. Read this before trying again.

`WeekStrip` takes plain props, so it needed no capture at all — it rendered live
off `verdictWeekView` with a fixed date, and it looked like the cheapest real
surface on the page. It is not usable here.

**The test every panel in this block has to pass is the block's own lede:** *"you
can see all of them on the free checks before you decide anything."* The only
shipped screen that draws `WeekStrip` is `/journey`, and a signed-out reader gets
**"Sign in to see your journey"** (verified against a production build,
2026-08-11). In the trial paywall mode an account needs a card. So the panel
would have pictured a surface behind a card wall under a sentence promising
free — the same failure as naming the camera in feature one, one panel over.

⚠️ **The FEATURE is genuinely free.** A guest week strip does render on `/meals`
— it is visible at the top of panel three's capture — but it is a different
implementation (`.week-strip` on the meals page vs `.dash-week` in `WeekStrip`).
It is the `/journey` **drawing** that is not free, not the capability.

This is worth recording because the mistake was invisible to every gate: it
typechecked, linted, passed 2,229 tests, passed axe, and measured within budget.
Nothing in this repo tests "is the pictured surface reachable by the reader this
page is addressing." The only thing that catches it is asking.

**Panel 5 stays prose, on the owner's ruling, and the reason is not difficulty.**
A real `/account` capture needs three API routes mocked and would put a
delete-my-health-data control on a marketing page. Its copy already says the
controls *live on your account page* rather than showing them, so panel and
sentence agree. Recorded here as the Definition of Done allows.

⚠️ The element-shot-of-`/demo` problem is unchanged and still real: the app's
fixed chrome paints over a captured element. What changed is that neither
surface needed one. A route capture takes the whole viewport, chrome included,
because there the chrome *is* the screen.

## Item 2 — phone frames

`.landing-showpiece-phone`'s recipe is now a `.landing-phone` utility, applied
to the hero (biggest, still the showpiece), step one's capture, and every
carousel panel that is a screen.

**Height was paid for, not absorbed.** A frame adds its padding to the rendered
width at every breakpoint, so the image caps came *down* by roughly twice the
frame padding — step art from `clamp(210px, 24vw, 272px)` to
`clamp(190px, 22vw, 248px)`. Framed art occupies the space the bare art did.

⛔ The frame never names `.result-card` or `.surface-card`; it supplies border,
radius and shadow from the **wrapper**, which is the only reason
`landing-design-guards` GUARD 1 permits it at all. Children get their own inner
radius; nothing reaches in.

⚠️ **Steps 2 and 3 are not framed, and this is a deliberate deviation from the
literal ask.** Step 2's art is `DemoCheckCard layout="table"` — a layout the app
does not render, adopted as the design file's marketing treatment. Putting it in
a phone frame would assert it *is* a screen, which is the fake-UI line this page
has held since 2026-08-05. The design file agrees: it draws step two's demo as a
bordered card, not a device. Step 3 carries no art by design — its copy hands
off to the three cards below. **Every app screenshot on the page is framed;**
steps 2 and 3 have no screenshot to frame. Flagged for the owner rather than
silently skipped.

### ⚖️ OWNER RULING, 2026-08-14 — step 2 is framed, and the table is gone

The owner took the second branch the paragraph above offered: **render step two
in the app's real layout, then frame that.** The table was never framed — it was
deleted.

| | Before | After |
|---|---|---|
| Component call | `<DemoCheckCard layout="table" />` | `<DemoCheckCard />` |
| Shape | design file's six-row label-gutter table | the layout `/check` and `/demo` render |
| Wrapper | bare `.landing-step-art` | `.landing-phone .landing-step-live-phone` → `.landing-step-screen` |
| CSS | `.landing-demo-*`, ~120 lines | none — the landing styles no part of it |
| Card families on the page | three | **two** |

**Why the whole prop went rather than just the call site.** `app/page.tsx` was
its only consumer. Leaving a marketing-only layout in a component that three
routes import is the same drift GUARD 1 blocks in CSS, wearing a different hat —
and this one had no guard at all.

**Three things this change is quietly buying, and their costs:**

1. ⛔ **The 2026-08-06 nesting ruling is live again on the landing.** That ruling
   routed *around* the card-in-card nesting by adopting the flat table; the
   landing now shows the nesting, at phone width, because that is what a reader
   meets at `/check`. `DESIGN.md` §11's work item went from two routes to three.
   The flat shape is no longer implemented anywhere to lift from — it is in this
   file and in git.
2. ⚠️ **`.landing-step-live-phone` is 390px and may NOT borrow
   `.landing-step-phone`'s `clamp(190px, 22vw, 248px)`.** That cap wraps a
   *scaling image*, where a smaller number just draws the picture smaller. This
   one wraps *live DOM*, where width sets the wrap and therefore sets the
   height. 390px is what `app-check.png` is drawn at, so the frame is honest.
3. ⚠️ **`.landing-step-screen` is not decoration.** The bezel needs a page plane
   behind the card — step one's capture has one — or the frame reads as an
   outline drawn around a card. It supplies its own background and radius and
   names neither card class, which is what keeps GUARD 1 true. **That guard just
   stopped being academic:** §5 now puts a real `.surface-card` inside a landing
   wrapper for the first time.

**Measured, production build, `--tab=2`.** The desert this art lands in is the
one from the step-two exit to the next CTA — the same region that hard-failed
this budget once before, at 2,172px, and forced the exit link out of step three.

```
before   1,318px      after   1,428px      budget 2,001px      +110px, 573px slack
page     16,321px  →  16,431px             worst desert 1,977px, unchanged
```

The growth is small because at 375px the frame is near full width anyway, so the
card reflows at roughly the width the table already used. **The number that would
have blown it is the width**, not the layout — see cost 2.

⚠️ **Step 3 is still unframed and that has not changed.** It carries no art at
all. There was nothing to frame and nothing was invented to fill it.

## Item 4 — the three result cards

Shipped to `Revora Landing(2).html` §7: 1.5px risk-coloured border on all four
sides, 26px radius, rule-separated meal row at `min-height: 96px`, the tinted
verdict band replaced by an 11px dot plus the verdict at 20px/800, and the change
note italic and bottom-aligned via `margin: auto 0 0`.

Two deliberate deviations, both recorded in `globals.css` beside the code:

1. **The note ships at 16px, not the design's 15px.** DESIGN.md rail 10 sets a
   16px floor on this page for everything except tracked uppercase labels, and
   `.landing-verdict-note` carries the same instruction in as many words. ⚠️
   Nothing goes red at 15px — the duplicate-font-size pin counts declarations
   per selector and sees one either way — so this is the kind of deviation only
   a note catches. It is the only §7 value under the floor.
2. **Colours are risk tokens, never the design's hexes.** This palette is cool
   where the design file is warm; the mapping has been token-wise since
   2026-08-06.

⛔ `align-items: start` came off `.landing-verdicts`. The bottom-aligned note is
meaningless unless the cards are equal height, which is the default `stretch`
that rule was overriding. At 375px they stack one per row, so it costs nothing
there.

⚠️ **The reference screenshot in the handoff is the BEFORE state.**
`~/Pictures/Screenshot from 2026-08-11 20-58-18.png` shows the old H2 ("The same
card, three times."), the coloured top rule and the tinted band — the state the
owner complained about. Only the Stitch §7 block is the spec. Anyone checking
this work against that PNG will re-introduce the band.

## Two landmines removed

1. **`capture-landing-art.mjs` no longer types a pixel height.** The stale
   `clipH: 700` — carried as a standing warning in the handoff — would have cut
   the suggestion chips in half, and re-deriving it by hand confirmed that (the
   form card now ends at 923px, not 700). Each shot names the **element** its
   capture should end at and the script measures it, so the clip follows the
   layout. It throws with a readable message if the selector stops matching.
   The script also now documents that it must run against a **production build**:
   under `next dev` the check form never gets past its "One moment" placeholder
   headless, so a dev capture photographs a loading state.
2. **`measure-landing.mjs --tab=N`.** Bite #5 required measuring with the
   tallest carousel panel open and gave no way to do it. Now reproducible.

## Gates

All run against a production build with the deployed flags
(`NEXT_PUBLIC_PHOTO_INPUT=1 PHOTO_INPUT_ENABLED=1`).

```
lint          0 errors (3 <img> warnings: 2 pre-existing + panel 3's capture)
typecheck     pass
test          191 files | 2,229 passed | 2 skipped | 0 failed   (+4: the new capture pins)
contract      9/9 validators
build         compiled
landing-a11y  12 passed
photo-check   4 passed  (the fail-closed default candidate, unchanged)
```

**Reachability, every carousel state** — the measurement bite #5 asked for:

```
--tab=0   16,137px   worst desert 1,977px / 2,001px   within budget
--tab=1   16,294px   worst desert 1,977px             within budget
--tab=2   16,321px   worst desert 1,977px             within budget   ← tallest
--tab=3   15,970px   worst desert 1,977px             within budget
--tab=4   15,956px   worst desert 1,977px             within budget
```

⚠️ **The 1,977px worst desert is not any of this work.** It is the glance-strip
exit → familiar-cards exit stretch, and it is unchanged in all five states. The
handoff's "24px of headroom" is a real global figure but it describes a block
nothing here touched; the frames and the taller panels land in deserts with
600px+ of slack. Anyone adding height to the **six photo cards** still has 24px
to play with and should re-measure.

## What is still open

- Panel 5 is a statement panel by ruling, not by limitation. If it should become
  a real screen, the path is three `page.route` mocks in the capture script.
- Panel 4 needs a guest-reachable week strip before it can be a picture. The
  cheapest honest route is a second crop of the same `/meals` capture; the
  reason it was not done that way is that both crops share the page header and
  would read as the same screenshot twice.
- **The legal-record vs production disagreement on photo input is the owner's to
  reconcile — and it is COUPLED to `app-check.png`.** That capture shows three
  input chips unconditionally, which is correct for production today. If the
  flag is turned off to match `owner-risk-launch-decision-5f6abcb.md`, the
  landing ships a picture of a camera the build does not have — the
  unadvertised-feature gate, invisible to every test because it is pixels. ⛔
  **Turning `NEXT_PUBLIC_PHOTO_INPUT` off requires re-running
  `scripts/capture-landing-art.mjs` in the same change.**
- Steps 2 and 3 carry no phone frame, for the reason given. If the owner wants
  step 2 framed anyway, the honest way is to render `DemoCheckCard` in the app's
  own layout there rather than framing the marketing table — which would
  overturn the 2026-08-06 ruling that adopted that table.
