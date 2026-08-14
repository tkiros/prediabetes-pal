# Landing Phase 4 shipped and green — branch is UNPUSHED, three owner calls open

**Date** 2026-08-12 · **Branch** `feat/landing-design-v5` (4 commits, clean tree,
**no remote, no PR**)
**Full record** `docs/landing/2026-08-11-design-copy-7-rules-audit.md` § *Phase 4*
**Supersedes** `docs/handoff/2026-08-11-landing-design-applied-phases-1-3-green-four-items-open-session-handoff.md`

---

## Read this first

All four items in the previous handoff are closed. Every gate is green and the
numbers are pasted below. **The single biggest gap to "shipped" is that none of
it is on the remote** — see Step 0.

Two premises in the previous handoff were **wrong**, and both were load-bearing.
If you only read two things in this document, read *Correction 1* and
*Correction 2*. Re-deriving them cost most of a session.

⚠️ **The standing warning still stands and got sharper this session:** this page
is protected by tests that read its copy, *including your JSX comments*, and one
of the two corrections below exists precisely because a guard read source text
while the defect lived in **pixels**. Assume no gate sees a screenshot.

---

## Step 0 — BEFORE ANYTHING: push the branch

Four commits exist only on this machine. `main` is at `992f82d` and unchanged.

```bash
cd /home/tefera/Desktop/Revora
git checkout feat/landing-design-v5
git log --oneline main..HEAD          # expect exactly the 4 below
git push -u origin feat/landing-design-v5
gh pr create --fill                   # gh is authed as tkiros
```

```
744dc33 fix(landing): revert panel 4 — WeekStrip is behind a sign-in wall
f999ee8 docs(landing): ledger rows and the Phase 4 record
0012b46 feat(landing): design-spec result cards, phone frames, four real carousel surfaces
f85d75f feat(landing): apply the v5 design, audit copy against the 7 sales rules
```

⚠️ `f85d75f` is the **previous** session's uncommitted work, committed at the
start of this one. It is not new, but it has never been reviewed on a PR either.

Diff vs `main`: 20 files, +2,788 / −419.

---

## What was done

### Item 4 — the three result cards, to the design

Shipped to `Revora Landing(2).html` §7. `LandingVerdictCard`
(`components/example-result-card.tsx`) + `.landing-verdict-*` (`globals.css`).

| Property | Was | Now |
|---|---|---|
| Border | coloured 4px **top rule** | `1.5px solid <risk token>` all four sides |
| Radius | 16px | 26px |
| Meal row | plain | own row, bottom rule, `min-height: 96px`, **flex-centred** |
| Verdict | tinted band + icon | **no band**; 11px dot + verdict at 20px/800 |
| Change note | plain, below | **italic, bottom-aligned** (`margin: auto 0 0`) |

Three deliberate deviations, all recorded beside the code:

1. **The note ships at 16px, not the design's 15px.** DESIGN.md rail 10's floor.
   ⚠️ Nothing goes red at 15px — the duplicate-font-size pin counts declarations
   per selector and sees one either way. Only the comment catches this.
2. **Colours are risk tokens, never the design's hexes.** This palette is cool
   where the design file is warm; token-wise mapping since 2026-08-06.
3. **`align-items: start` came off `.landing-verdicts`.** A bottom-aligned note
   is meaningless unless cards are equal height — that is the default `stretch`
   the old rule was overriding.

⚠️ **`.landing-verdict-meal` is `display: flex; align-items: center`.** That is
not styling — the 96px floor buys verdict-row alignment *across columns*, and at
375px there are no columns. The third meal is one line, and top-aligned it left
~23px of blank above the rule that read as a rendering fault. A `min-width`
media query was rejected: the grid is `auto-fit` specifically so it has no
hand-picked breakpoint, and the viewport where it goes two-up depends on the
frame padding.

⛔ **The reference screenshot in the old handoff is the BEFORE state.**
`~/Pictures/Screenshot from 2026-08-11 20-58-18.png` shows the old H2, the top
rule and the tinted band. Only the Stitch §7 block is the spec. Checking this
work against that PNG will re-introduce the band.

### Item 2 — phone frames

`.landing-showpiece-phone`'s recipe is now a `.landing-phone` utility applied to
the hero (biggest, still the showpiece), step one's capture, and every carousel
panel that is a screen.

**Height was paid for, not absorbed.** A frame adds its padding to the rendered
width at every breakpoint, so the image caps came *down* by roughly twice the
frame padding — `.landing-step-art--shot img`'s `clamp(210px, 24vw, 272px)`
became `.landing-step-phone`'s `clamp(190px, 22vw, 248px)`. Raising one without
lowering the other is what a re-measure will catch.

⛔ The frame never names `.result-card` or `.surface-card`. Supplying border,
radius and shadow **from the wrapper** is the only reason
`landing-design-guards` GUARD 1 permits it. Children get their own inner radius;
nothing reaches in.

### Item 1 — carousel: 3 of 5 are a real surface

| # | Panel | How |
|---|---|---|
| 1 | Check your meal | real `ExampleResultCard`, live, framed |
| 2 | Make a better choice | real `ExampleResultCard`, live, framed |
| 3 | Learn your patterns | **real `/meals` screen**, seeded-localStorage capture |
| 4 | Build better habits | statement panel — **shipped real, then reverted** |
| 5 | Stay in control | statement panel — owner ruling |

**Panel 3 is the win.** The signed-out `/meals` page falls back to the on-device
store (`fetchHistoryPage` → `guest`, then `historyStore.all()`), so seeding
`pal.history.v1` via `addInitScript` before navigation renders the real screen
with fixture rows. The `/demo` contract — real component, fixture data — pointed
at a route instead of a component.

### Item 3 — photo input (see Correction 2)

---

## ⚠️ Correction 1 — "Revora everywhere" was REAL. Phase 3 closed it wrongly.

Phase 3 recorded item 3 as *"Not reproducible. 0 occurrences across 7 rendered
routes."*

**The occurrence was in `public/landing/app-check.png`** — the step-one capture,
whose wordmark still read **Revora**. It predates the 2026-08-09 rename and no
sweep could reach it, because the check scanned *rendered text* and the name was
*pixels*. The owner was right; the page was wrong for two days. Re-capturing
fixed it.

⛔ **The general lesson, and the reason `landing-meals-capture` exists as a
ledger row:** every rename, claims and copy guard in this repo reads source or
DOM. **A committed screenshot is a hole in all of them at once.** Any new PNG on
a marketing surface needs (a) a ledger row for its editorial content and (b) a
`landing-art.test.ts`-style pin to the constants it renders.

## ⚠️ Correction 2 — the photo-input premise was inverted, and the fix is NOT "name three methods"

The old handoff said photo assist is OFF, gated twice, fail-closed, and that
picturing it would advertise an absent capability. **That was read off a local
env.** Production has both gates set:

- `prediabetespal.com/check` renders the third control's copy branch
- `POST /api/check/photo-draft` in production returns **200**, not 404
- the photo FAQ renders on the production landing page
- `docs/release/truth-index.md:35` records both flags set in Vercel (2026-07-21)

So the page was **under**-describing what ships. **But naming the camera in the
free-checks copy would have been a different, worse error.**
`components/food-check-form.tsx` passes `premium={mode === "trial" && !entitled}`:
in the shipped paywall mode a photo draft is Premium, the chip carries a Premium
tag, and the route 402s a free session before any camera opens. This page sells
the **free** checks — the includes lede promises all five features are visible on
them.

**What shipped, on the owner's ruling to "ship photo for real":**

| Surface | Before | Now |
|---|---|---|
| `app-check.png` | two chips, **"Revora"** wordmark | three chips **incl. the visible Premium tag**, correct wordmark |
| includes body one | branched to three when flagged | **two, unconditionally** |
| step one copy | two | two (unchanged) |
| "What do I actually have to do?" | two | two (unchanged) |
| photo FAQ | described the camera, **no price** | **leads with the price**, branched on `paywallMode()` |

The picture shows all three; the words describe the two a free reader gets; the
Premium tag is legible in the screenshot, so picture and copy agree.

⛔ **`tests/smoke/photo-check.spec.ts` was NOT inverted**, and must not be. The
old handoff proposed it under the wrong premise. It asserts the **flag-unset
default candidate** is fail-closed — still true, still valuable. Inverting it
deletes the guard rather than updating it. 4/4 passing, untouched.

## ⚠️ Panel 4 — shipped real, then reverted. Do not re-do it without reading this.

`WeekStrip` takes plain props, so it rendered live off `verdictWeekView` with a
fixed date. It looked like the cheapest real surface on the page. **It fails this
block's own lede:** *"you can see all of them on the free checks before you
decide anything."*

The only shipped screen that draws `WeekStrip` is `/journey`, and a signed-out
reader gets **"Sign in to see your journey"** (verified against a production
build). In the trial paywall mode an account needs a **card**. So the panel
pictured a surface behind a card wall under a sentence promising free — the same
failure as naming the camera in feature one, one panel over.

⚠️ **The FEATURE is genuinely free.** A guest week strip *does* render on
`/meals` and is visible at the top of panel three's capture — but it is a
different implementation (`.week-strip` on the meals page vs `.dash-week` in
`WeekStrip`). It is the `/journey` **drawing** that is not free.

⛔ **This was invisible to every gate.** It typechecked, linted, passed 2,229
tests, passed axe, and measured within budget. Nothing in this repo tests
*"is the pictured surface reachable by the reader this page addresses."*

---

## Gates — all green, all pasted

Run against a **production build with the deployed flags**:
`NEXT_PUBLIC_PHOTO_INPUT=1 PHOTO_INPUT_ENABLED=1`.

```
lint          0 errors (3 <img> warnings: 2 pre-existing + panel 3's capture)
typecheck     pass
test          191 files | 2,229 passed | 2 skipped | 0 failed   (+4 new capture pins)
contract      9/9 validators
build         compiled
landing-a11y  12 passed
photo-check    4 passed  (fail-closed default candidate, unchanged)
```

**Reachability, every carousel state** — the measurement bite #5 asked for and
that is now reproducible via `--tab=N`:

```
--tab=0   16,137px   worst desert 1,977px / 2,001px   within budget
--tab=1   16,294px   worst desert 1,977px             within budget
--tab=2   16,321px   worst desert 1,977px             within budget   ← tallest
--tab=3   15,929px   worst desert 1,977px             within budget
--tab=4   15,956px   worst desert 1,977px             within budget
```

⚠️ **The 1,977px worst desert is NOT this work.** It is the glance-strip exit →
familiar-cards exit stretch, unchanged in all five states. The old handoff's
"24px of headroom" is a real global figure but describes a block nothing here
touched. The frames and the taller panels land in deserts with 600px+ of slack.
**Anyone adding height to the six photo cards still has 24px.**

---

## Two landmines removed

1. **`capture-landing-art.mjs` no longer types a pixel height.** The stale
   `clipH: 700` would have cut the suggestion chips in half — re-deriving by hand
   confirmed it (the form card now ends at **923px**, not 700). Each shot names
   the **element** its capture should end at (`clipTo`) and the script measures
   it, so the clip follows the layout. It throws a readable error if the selector
   stops matching.
   ⛔ It also now documents that it must run against a **production build**:
   under `next dev` the check form never gets past its "One moment" placeholder
   headless, so a dev capture photographs a loading state.
2. **`measure-landing.mjs --tab=N`.** Bite #5 required measuring with the tallest
   panel open and gave no way to do it.

---

# OPEN — exact actions to reach true done

Ordered. #1 is mechanical; #2 is the only one that can make the page *wrong*.

## OPEN #1 — Push and open the PR

See Step 0. Nothing else in this list blocks it; the branch is green as it
stands. Everything below is either an owner decision or an optional improvement.

## OPEN #2 — ⛔ OWNER DECISION: the photo-input legal record vs production

**These two facts disagree and neither is mine to resolve:**

- `docs/legal/owner-risk-launch-decision-5f6abcb.md`: *"Meal photo-assist stays
  **OFF**. `NEXT_PUBLIC_PHOTO_INPUT` must remain unset."* Enabling it *"requires
  a function-specific evidence review, an explicit written owner decision, a new
  reviewed build, and new deployment proof."* Also: *"No advertising or paid
  promise may imply that either disabled function is available."*
- `docs/release/truth-index.md:35` and **live production**: both flags are set,
  the route answers 200, the control renders.

Same commitment repeated in `docs/legal/counsel-brief.md`,
`docs/ops/env-reference.md`, `docs/handoff/human-actions-required.md`.
This predates the session; it was not introduced here.

⛔ **THIS IS COUPLED TO `app-check.png`.** That capture shows three input chips
**unconditionally** — correct for production today. If the flag is turned **off**
to match the legal record, the landing ships a picture of a camera the build does
not have: the unadvertised-feature gate, invisible to every test because it is
pixels.

**If the owner decides photo stays ON** (ratifying production):

1. Write the superseding decision as a **new dated entry** — do not rewrite the
   existing legal record.
2. Reconcile `docs/legal/counsel-brief.md`, `docs/ops/env-reference.md`,
   `docs/ops/launch-checklist.md:112`, `docs/handoff/human-actions-required.md`.
3. Nothing in the landing changes. Done.

**If the owner decides photo goes OFF:**

```bash
# 1. Unset BOTH in Vercel (the twin guard in next.config.ts fails the build
#    if the client flag is 1 and the server flag is not).
# 2. RE-CAPTURE IN THE SAME CHANGE — this is not optional:
pkill -9 -f "[n]ext-server"
npm run build && npm run start &        # NO photo flags this time
node scripts/capture-landing-art.mjs
# 3. The photo FAQ disappears on its own (it is gated on photoInputEnabled()).
# 4. Re-run: npm run test && npm run contract
```

## OPEN #3 — ⛔ OWNER DECISION: panel 4, and whether it should be a picture

It is prose today for the reason above. If it should be a picture, the artifact
must be **guest-reachable**.

**The cheapest honest route** — a second crop of the same `/meals` capture, since
the guest week strip is already at the top of it:

```js
// scripts/capture-landing-art.mjs — add a third SHOT
{
  path: "/meals?stay=1",
  file: "public/landing/app-week.png",
  seedHistory: true,
  waitFor: "[data-testid='week-strip']",
  clipTo: "[data-testid='week-strip']"      // ends just under the strip
}
```

⚠️ **Why it was not done that way:** both crops share the page header, so the two
panels would read as the same screenshot twice. Solving that means either
cropping with a `y` offset (the script currently hardcodes `y: 0`) or accepting
the repetition. Owner's call on which is worse.

⛔ Whichever way: a new PNG needs a ledger row **and** a `landing-art.test.ts`
pin. See Correction 1.

## OPEN #4 — ⛔ OWNER DECISION: steps 2 and 3 carry no phone frame

**A deliberate deviation from the literal ask** ("including steps 1, 2 and 3"),
flagged rather than silently skipped.

- **Step 1** — framed. It is a real screen capture. ✅
- **Step 2** — its art is `DemoCheckCard layout="table"`, a layout **the app does
  not render**, adopted as the design file's marketing treatment on 2026-08-06.
  Framing it as a phone screen would assert it *is* a screen — the fake-UI line
  this page has held since 2026-08-05. ⚠️ **The design file agrees**: its own §
  draws step two's demo as a bordered card (`border-radius: 28px`, a shadow),
  **not a device**.
- **Step 3** — carries no art at all, by design; its copy hands off to the three
  cards below.

**Every app screenshot on the page is framed.** Steps 2 and 3 have no screenshot
to frame.

**If the owner wants step 2 framed anyway**, the honest way is to render
`DemoCheckCard` in the **app's own layout** there (drop `layout="table"`) and
frame that — which overturns the 2026-08-06 ruling that adopted the table.
Do not frame the table.

## OPEN #5 — Panel 5, if it should stop being prose

Statement panel by ruling, not by limitation. The path if that changes: three
`page.route` mocks in the capture script (`/api/paywall`, `/api/entitlement`,
`/api/profile` — `tests/smoke/journey.spec.ts` is the precedent), plus a fourth
versioned PNG. ⚠️ The shot would feature a delete-my-health-data control on a
marketing page, and its copy already says the controls *live on your account
page* rather than showing them.

## OPEN #6 — Small, optional cleanups (nobody has asked for these)

1. **Dead CSS.** `app/globals.css:2964-2968` hides
   `.landing-includes-copy .landing-cta-stack` above 900px. `LandingIncludes`
   renders **no CTA** (`grep -c "landing-cta" components/landing-includes.tsx`
   → 0), so the rule matches nothing. Vestigial from an earlier structure;
   its long comment describes a layout that no longer exists.
2. **`app-meals.png` bakes timestamps** ("Aug 11, 8:30 PM"). Unavoidable for a
   capture, harmless, but it will read as dated in a few months. Re-running the
   script refreshes them — the fixture is written at capture time.
3. **No `AUTH_SECRET` locally.** Neither `.env` nor `.env.local` has it, so
   `next start` logs `[auth][error] MissingSecret` on any auth-touching route.
   The landing is a public server component and is unaffected; signed-in flows
   will not work locally.

---

# Things that will bite you

Carried forward from the previous handoff, plus what this session added.

1. **The claims audit reads your comments.** `claims-boundary-copy.test.ts` globs
   every `.tsx` under `app/` and `components/` and strips only *comment-leading*
   lines, so the second line of a JSX block comment is scanned exactly like
   rendered copy. **Describe, never quote.**

2. **🆕 `{/* … */}` is JSX-children syntax and is INVALID inside the `panels={[…]}`
   array.** That array is a JS array literal — use a plain `/* … */` block
   comment. This cost a full typecheck cycle (`TS17008: JSX element 'section' has
   no corresponding closing tag`, thrown ~80 lines away from the real fault).

3. **🆕 `landing-art.test.ts` matches SOURCE, not render.** It looks for the
   literal characters that open `alt="…"`. Swapping the plain string for an
   interpolated template **takes the guard down without failing it** — the regex
   simply stops recognising source it does not match. The alt must stay a plain
   string, which is also why it **cannot enumerate the input methods**: the
   control row is build-flagged while the capture is one committed file, so any
   count is right in one build and wrong in the other.

4. **Never retype these.** Verdict words from `RISK_LABELS`; the free-check count
   from `TASTER_LIMIT`; the disclaimer from `BOUNDARY_DISCLAIMER`.
   `copy-pins.test.ts` enforces all three.

5. **The swap/adjustment conditional is contractual.** `assertNoUnsafeSafeFields`
   **throws** on a Clear result carrying either, so any sentence promising one
   must hedge in the *same sentence*.

6. **Reachability.** `node scripts/measure-landing.mjs` needs a running server.
   Budget 2,001px per desert. 🆕 **Use `--tab=N` and measure the tallest panel**
   (currently `--tab=2`), not just the default.

7. **New copy needs a ledger row.** The `--require-copy-ledger` validator passes
   without them, so this is convention the tests will not catch. 🆕 **And a new
   screenshot needs one too** — see Correction 1.

8. **Plane alternation.** Sheet / page must alternate. Check the neighbours of
   anything you add or delete.

9. **The hero is no longer dark.** Deliberate override recorded in `globals.css`.
   If the top of the page reads flat, that is the first thing to revisit.

10. **🆕 Capture only from a production build, with the deployed flags.** Under
    `next dev` the check form never leaves its placeholder headless.

11. **🆕 The gates cannot see reachability.** Before picturing any surface, ask:
    *can the reader this page addresses actually get to it?* Panel 4 passed every
    gate and was still wrong.

---

# Definition of true done

- [ ] **Branch pushed and PR opened** (OPEN #1) — the only mechanical gap
- [ ] Owner has ruled on the photo-input legal-record conflict (OPEN #2), and if
      the answer is OFF, `app-check.png` was **re-captured in the same change**
- [ ] Owner has ruled on panel 4 (OPEN #3) — prose, or a guest-reachable picture
      with a ledger row and a test pin
- [ ] Owner has ruled on steps 2/3 framing (OPEN #4)
- [ ] Owner has ruled on panel 5 (OPEN #5)
- [x] Three result cards match the design spec, risk tokens only
- [x] Every app screenshot sits in a phone frame
- [x] Input-options decision made explicitly and implemented
- [x] Carousel panels are real surfaces or are named, with a reason, in the audit
      doc
- [x] New/changed copy has ledger rows; removed copy deactivated with a reason
- [x] All gates green **and pasted**
- [x] `measure-landing.mjs` re-run with the tallest panel selected — and the
      selection is now reproducible
- [x] `docs/landing/2026-08-11-design-copy-7-rules-audit.md` has a Phase 4 section

---

## Preview

```bash
cd /home/tefera/Desktop/Revora
pkill -9 -f "[n]ext-server"
NEXT_PUBLIC_PHOTO_INPUT=1 PHOTO_INPUT_ENABLED=1 npm run build
nohup env NEXT_PUBLIC_PHOTO_INPUT=1 PHOTO_INPUT_ENABLED=1 npm run start \
  > /tmp/preview.log 2>&1 & disown
# http://localhost:3000
```

⚠️ Use `nohup … & disown`, not a harness background task — a backgrounded task
gets torn down with the turn and the server dies under you.

| Look at | Where |
|---|---|
| Redesigned result cards | "Three meals. One layout. No score." |
| Phone frames | hero · step one · carousel panels |
| Real `/meals` screen | includes carousel → **"Learn your patterns"** |
| Three input chips + Premium tag | step one's capture, and live at `/check` |
| The photo FAQ's price clause | "Fair questions" → "How does the photo check work?" |
| **The stacked meal-row fix** | narrow to **375px**, third card |
| **Why panel 4 was reverted** | `/journey` signed out |
