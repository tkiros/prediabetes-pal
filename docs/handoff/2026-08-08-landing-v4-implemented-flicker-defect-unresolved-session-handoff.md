# Landing v4 implemented · **flicker + missing-parts defect UNRESOLVED** · session handoff

**Date:** 2026-08-08
**Repo:** `/home/tefera/Desktop/Revora` · **Branch:** `seo/about-page-and-canonicals` (base `8bcb2f1`)
**Working tree:** 6 files modified, **nothing committed.** No PR.

---

## 0. ⛔ STATUS IN ONE TABLE — read before anything else

| | State |
|---|---|
| `Revora Landing v4 Product.dc.html` implemented | ✅ **Yes**, all sections, all four owner rulings honoured |
| Four gates (typecheck / lint / unit / contract) | ✅ **Green** |
| §11.1 reachability budget | ✅ **14,471px · 11 exits · worst desert 1,921px · 0 over** (ceiling 2,001) |
| `landing-a11y` e2e (9 tests) | ✅ **Green** |
| **Owner-reported defect: page "keeps flickering / refreshing", "parts not visible"** | ⛔ **NOT FIXED. Reported three times. Still present.** |
| Committed? | ⛔ **No** |

> **The implementation is done. The defect is not.** Do not treat the green gates as
> evidence the page is correct — **none of them can see this defect**, and §2 explains why.

---

## 1. ⛔ THE OPEN DEFECT — this is the whole job

### 1.1 What the owner sees

- The page **"keeps flickering"** / **"keeps refreshing"**.
- **"Some parts are not visible."**
- Reported after the initial build, again after fix attempt #1, and again after fix
  attempts #2 and #3. **Three reports, zero confirmed fixes.**

### 1.2 The owner's environment — ⚠️ NEVER REPRODUCED

Evidence: `/home/tefera/Videos/simplescreenrecorder-2026-08-08_05.19.19.mkv`
(15s, 1920×1080; extract frames with
`ffmpeg -i <file> -vf "fps=1,scale=1280:-1" -q:v 4 out%03d.jpg`).

| | Owner | Every check run last session |
|---|---|---|
| Browser | **Firefox** | **headless Chromium** |
| Zoom | **110%** | 100% |
| Display | real compositor | headless, no compositor |
| Build | `next dev` | `next dev` + `next start` |

⛔ **`npx playwright install firefox` HAS NEVER BEEN RUN ON THIS MACHINE.**
`~/.cache/ms-playwright/` contains `chromium-*` and `webkit-2287` only, and
`playwright.config.ts` defines three projects — Mobile Chrome, Mobile Safari,
Desktop Chrome — **and no Firefox project.** The last session's entire verification
loop was structurally incapable of seeing a Firefox-specific defect and reported
"stable, no errors" anyway. **That is the process failure to fix first.**

One frame from the recording shows the **hero showpiece image rendering as alt text
with a broken-image glyph** — the "missing parts". On a clean server in Chromium the
same image returns `200` at 94,182 bytes and `naturalWidth > 0`.

### 1.3 Three fixes shipped, none verified against the owner's browser

| # | Change | Mechanism claimed | Status |
|---|---|---|---|
| 1 | `will-change: transform` on `.landing-marquee-track` **and `.landing-nav`**; `contain: paint` on `.landing-marquee` | Chromium re-samples a `backdrop-filter` every frame; an animating unpromoted sibling behind it thrashes | ⛔ **Unverified. Chromium-specific reasoning. May be making Firefox worse — see H2.** |
| 2 | Killed dev server **PID 421544** (uptime 3h39m), `rm -rf .next`, cold restart | Its process name is `next-server`, so every `pkill -f "next dev"` missed it, while `npm run build` / `npm run e2e` rewrote `.next` underneath it → torn chunks | ✅ **Was a real bug and is really fixed.** ⛔ Did not resolve the owner's symptoms. |
| 3 | `next.config.ts` — `'unsafe-eval'` in `script-src` when `NODE_ENV === "development"` | React dev + Turbopack Fast Refresh call `eval()`; the CSP blocked it, so the refresh runtime degraded → reloads, half-built renders | ✅ **Real bug, console error confirmed gone.** ⛔ Did not resolve the owner's symptoms. |

⚠️ Fixes 2 and 3 were genuine defects worth keeping. **Neither was the reported bug.**
Each was shipped on a plausible mechanism and declared fixed on a Chromium check —
that is the same error three times.

### 1.4 Hypotheses, ranked — ⚠️ H2 first, it may be self-inflicted

- **H2 (check first): `will-change: transform` on `.landing-nav` is the flicker.**
  Added in fix #1, *after* the first report, and the owner reported the problem again
  after it. `will-change: transform` makes an element a **containing block** and forces
  its own layer. On a `position: sticky` element in Firefox this is a known source of
  jitter and detachment. **Highest suspicion precisely because it was added between
  report 1 and report 2 and never tested in Firefox.**
- **H1: `backdrop-filter: blur(14px)` on the sticky nav.** Firefox's implementation is
  newer than Chromium's; blurring a backdrop that contains a continuously animating
  ~3,500px track is the single most expensive thing on the page.
- **H3: the marquee animation itself** — `landing-marquee 34s linear infinite` on a
  `width: max-content` flex track. Remove it and see.
- **H4: `contain: paint` on `.landing-marquee`** interacting with the sticky nav's
  backdrop sampling.
- **H5: the "missing parts" is a separate bug** — `loading="lazy"` images inside a
  `contain: paint` ancestor, or Firefox not resolving `clamp()` `max-width` the same way.
- **H6: still environmental** — Turbopack HMR over the Firefox websocket. **§2.1 rules
  this in or out in one step and costs nothing.**

---

## 2. ✅ EXACT NEXT ACTIONS — in this order, do not skip step 1

### 2.1 STEP 1 — Split environment from CSS. One command, decides everything.

```bash
pkill -9 -f "next-server"; pkill -9 -f "next dev"
cd /home/tefera/Desktop/Revora
npm run build && npm run start          # PRODUCTION build, no HMR, no dev CSP, no Turbopack
```

Ask the owner to load `http://localhost:3000/` **in Firefox** and say whether it still
flickers.

| Result | Meaning | Go to |
|---|---|---|
| **Flicker GONE** | It was never CSS. It is `next dev` / HMR / the dev overlay. | §2.4 |
| **Flicker REMAINS** | It is CSS, and it is Firefox-specific. | §2.2 |

⛔ **Do not skip this.** Three sessions of CSS work were spent without knowing which
half of the problem was being debugged.

### 2.2 STEP 2 — Make Firefox reproducible, once and for all

```bash
npx playwright install firefox
```

Add a Firefox project to `playwright.config.ts` beside the three that exist (~line 118):

```ts
{ name: "Desktop Firefox", use: { ...devices["Desktop Firefox"] } },
```

Then capture the defect as evidence — a video, not a screenshot, because a
flicker does not appear in a still:

```js
// run from the repo root so `playwright` resolves
import { firefox } from "playwright";
const b = await firefox.launch();
const ctx = await b.newContext({
  viewport: { width: 1280, height: 900 },
  deviceScaleFactor: 1.1,                    // the owner's 110% zoom
  recordVideo: { dir: "./fx-video", size: { width: 1280, height: 900 } }
});
const p = await ctx.newPage();
await p.goto("http://localhost:3000/", { waitUntil: "networkidle" });
await p.waitForTimeout(20000);               // sit still and let it flicker
await ctx.close(); await b.close();
```

**Success for this step = a video that shows the flicker.** Until one exists, every
fix below is another guess.

### 2.3 STEP 3 — Bisect, one property per run, re-checking the video each time

Comment out **one** at a time in `app/globals.css` and re-record:

1. `will-change: transform` on **`.landing-nav`** ← H2, do this one first
2. `backdrop-filter` + `-webkit-backdrop-filter` on `.landing-nav` ← H1
3. `contain: paint` on `.landing-marquee` ← H4
4. `animation: landing-marquee …` on `.landing-marquee-track` ← H3

Record which one stops it. **Then fix that one property properly rather than deleting
it** — the owner ruled on 2026-08-08 that the glass nav and the marquee ship as drawn
(see `DESIGN.md` §13 #8's overturn block), so removing either needs a fresh ruling.

Likely shapes of a proper fix, once the culprit is known:
- Nav: drop `will-change` and keep `backdrop-filter`; or keep the blur but raise the
  background opacity so a Firefox fallback is still legible.
- Marquee: animate with the Web Animations API and pause it via `IntersectionObserver`
  when the band is off-screen, so it is not compositing behind the nav at all.

### 2.4 STEP 4 — If §2.1 showed it is environmental

- The dev CSP fix (`next.config.ts`) already landed; keep it.
- Check `.next/dev/logs/next-development.log` for a recompile loop.
- ⛔ **Never run `npm run build` or `npm run e2e` while a `next dev` server is up.**
  They rewrite `.next` underneath it and it serves torn chunks. Kill dev first:
  `pkill -9 -f "next-server"` — ⚠️ the pattern is **`next-server`**, not `next dev`;
  that is exactly how PID 421544 survived for 3h39m and corrupted a preview.

### 2.5 STEP 5 — Only after the owner confirms the page is clean in Firefox

Re-run the full gate set (§5), then `/ship`. **Nothing is committed yet.**

---

## 3. ✅ WHAT IS DONE AND VERIFIED — do not redo this

`Revora Landing v4 Product.dc.html` is implemented in full.
Design file: `DesignSync` → `get_file`, project `f1b17b04-3ac7-4856-96c3-7d2e7ae001c2`.

### 3.1 Section order and planes (the v4 re-cut)

hero(page) · showpiece(page + dark panel) · marquee(**sheet**) · glance(page) ·
problem(**sheet**) · scope(page + tint panel) · what-changes(**accent band**) ·
how-it-works(**sheet**) · three answers(page) · limits(**sheet**) · offer(page) ·
FAQ(**sheet**) · final(page + dark panel) · footer

Two blocks are new: the **showpiece** (dark panel, real `/check` capture beside the real
`ExampleResultCard`) and **how it works** (`#how-it-works`, three steps) — the block the
page had been missing while the nav link pointed at a methodology page with no steps.

### 3.2 Owner rulings honoured (do not re-litigate)

1. **The four `DESIGN.md` §13 anti-patterns ship as drawn** — looping marquee, `Step N`
   pills, glassmorphic sticky nav, pain cards with ghost numerals. §13 #8 and §6 were
   amended with the containing condition for each.
2. **Footer keeps all 12 routes** against the design's 6 — `.landing-nav-links` is
   `display: none` below 640px, so the footer is the phone's only labelled navigation.
3. **Exits are §11.1's, not the design's** — v4 draws 5, the page ships 11.
4. **Phones are real** — the pinned `/check` capture and real components, never drawn UI.

### 3.3 Layout corrections made after the owner's second report (verified in Chromium)

| Block | Was | Now |
|---|---|---|
| Four pains | 3-up + orphan | **2×2** (`minmax(400px)`, the design's track) |
| Limits | wide sources + stacked trio | **three equal cards**, data + boundary merged into card 3 |
| Glance strip | hairline per fact | **no rules**, four bare stacks |
| How-it-works | steps 1 & 3 had empty right halves | step 1 gets the capture, step 2 the clarify flow, step 3 is a centred coda |
| Two-up steps | `align-items: start` → voids | `align-items: center` |
| What-changes | columns misaligned | **row subgrid**, pair N aligns |

### 3.4 Free wins folded in from the prior plan

- `app/page.tsx` JSON-LD Organization → `slogan: "The prediabetes meal checker"`.
- `docs/ops/play-listing.md` → `Revora Prediabetes Meal Check`.
  ⛔ **29 chars. Play Console caps app titles at 30.** Matching `app/layout.tsx`
  exactly (`Revora — Prediabetes Meal Checker`) is 33 and is rejected at submission.
  ⛔ `Revora: Prediabetes Checker` (27) was **rejected** — it reads as a screening
  claim. **Any shortening keeps the word "meal".**
- Footer "Learn" relabelled; nav "How it works" retargeted to `#how-it-works`.

---

## 4. ⚠️ CONSTRAINTS — verified this session, do not re-derive

- **GUARD 5** (`landing-design-guards.test.ts:154`) counts *bare* `className="landing-cta"`
  and requires exactly **1**, inside `LandingPrimaryCta`. ⛔ The scan counts matches in
  **comments** too — never spell that attribute out anywhere in `app/page.tsx`.
- **`Check your first meal — free` must appear exactly once in source.**
- **No `.landing` selector may declare `font-size` twice** (`landing-wiring-pins.test.ts:97`).
  ⚠️ **Rules inside `@media` blocks DO count** — the filter only skips selectors
  containing `:` or `@`. Use `clamp()`, never a media-query font-size override.
- **The claims audit scans JSX `{/* … */}` comments.** Only *line-leading* `//`, `/*`
  and `*` are stripped. It went red this session on the words **"reverses"** and
  **"treatment"** inside JSX comments. Use "overturns" and "styling".
- **`unconditional-swap` hedge whitelist is narrow:** only `when appropriate`, or
  `when|if|where` + `there|one|it|they`. 🚨 `when a`, `when available`, `if suitable`,
  `may`, `sometimes` **all fail**. `when there's one` passes; `when a meal needs one` does not.
- **Interpolate `{RISK_LABELS.SAFE}`**, never the literal verdict word.
- **Load-bearing selectors** for `tests/smoke/landing-a11y.spec.ts`:
  `ul.landing-trust-strip[role=list]` (it is the marquee's **first** list; the second is
  `.landing-marquee-echo` + `aria-hidden`, and giving it the same class breaks Playwright
  strict mode), `#landing-hero`, `nav[aria-label="Main"]`, `nav[aria-label="Footer"]`.
- **`landing-art.test.ts`** pins `src="/landing/app-check.png"` and
  `alt="The Revora check screen on a phone:…"`. The capture appears **twice** now; the
  showpiece copy carries the described alt, step one's carries `alt=""` deliberately.
- **`#landing-hero`, `#how-it-works`, `#faq`, `#live-example` carry `scroll-margin-top: 96px`.**
  Without it the sticky nav parks each target underneath itself. ⚠️ Add an id to that
  rule the moment you add an anchor. No test catches this.
- **Ledger:** writing a row is a real gate (Copy is claim-scanned, `Allowed Claim Class`
  must exist in `claims-boundary.md`, every `Evidence Rows` id must exist in
  `evidence-pack.md`). House style: **prepend** amendment history to `Notes`.

---

## 5. Verification commands

```bash
npm run typecheck
npm run lint                    # 1 pre-existing <img> warning, 0 errors
npm run test:revora             # 914/914
npm test                        # full unit suite
npm run contract                # 9 validators
npm run e2e -- tests/smoke/landing-a11y.spec.ts     # 9/9 — MUST use `npm run e2e`,
                                # bare `npx playwright test` runs stale .next-e2e-* builds
node scripts/measure-landing.mjs                     # needs `npm run dev` up
```

**Baseline to hold:** `14,471px · 11 exits · worst desert 1,921px · 0 over budget`.
Prior era: `12,771px · 11 exits · 1,960px`. Ceiling is 2,001px; **80px of headroom.**

⚠️ `measure-landing.mjs` is **manual** — not in `package.json`, not in CI, no git hook.
`DESIGN.md` §11.1 requires running it and reporting the numbers anyway.

---

## 6. Files changed (uncommitted)

| File | Change |
|---|---|
| `app/page.tsx` | +927/−? — full v4 restructure |
| `app/globals.css` | +917/−? — nav capsule, showpiece, marquee, steps, pain cards, limits, panels; three stale comment regions rewritten |
| `DESIGN.md` | §6 third keyframe · §11 v4 ruling + plane sequence + type table · §13 #8 overturn block |
| `docs/safety/copy-ledger.md` | +2 rows (`landing-marquee-strip`, `landing-how-it-works-steps`), 4 amended |
| `docs/ops/play-listing.md` | Play title + the 30-char constraint note |
| `next.config.ts` | ⚠️ **dev-only `'unsafe-eval'`** — the one change outside landing scope. `NODE_ENV` is `production` for `next build`/`next start`, so the deployed header is byte-identical. Revert if unwanted; the dev preview goes back to reloading. |

---

## 7. Suggested opening prompt for the new session

```
Read docs/handoff/2026-08-08-landing-v4-implemented-flicker-defect-unresolved-session-handoff.md
in full before touching anything.

The v4 landing is implemented and all gates are green — do NOT redo that work, and do
not re-litigate the four owner rulings in §3.2. Your only job is the open defect in §1:
the owner sees the page flickering and rendering with parts missing, in FIREFOX at 110%
zoom, and it has been reported three times and "fixed" three times without ever being
reproduced.

Start with §2.1 — build for production and have the owner load it in Firefox. That one
step tells you whether this is CSS or the dev server, and three sessions have been spent
not knowing. Then install Firefox for Playwright (§2.2) and capture a VIDEO of the
defect before changing any CSS. Bisect per §2.3, H2 first — a `will-change: transform`
I added to the sticky nav is the leading suspect and may be self-inflicted.

Do not declare it fixed on a headless Chromium check. That is the exact mistake that
produced three false fixes. Nothing is committed; commit only once the owner confirms
Firefox is clean.
```
