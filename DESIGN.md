# Revora Design System

Canonical for every Revora surface. From `app/globals.css`, `docs/product-marketing.md`, and the landing design & copy
tournament of 2026-08-04/05 (`docs/plans/landing-tournament-*.md`, which holds the evidence this file only cites).
Rewritten 2026-08-05 (Phase 10B): every rule states its derivation in one clause or names its test. Rules that could do
neither were accidents and were cut; §15 reports what went.

**How to read it.** §1 is the floor: sixteen rails, and breaking one is a defect, not a decision. Everything after is a
system to pick from; adding a colour, shadow, radius, breakpoint or font size means editing this file in the same commit,
with the reason. §13 is the banned list; §14 is scar tissue, each row naming its test. **"The guards pass" is not claim clearance (§1.1).**

## 1. The rails

| # | Rail | Held by | Real? |
|---|---|---|---|
| 1 | Revora is never the agent of a health outcome | `claims-boundary-copy.test.ts` | **TEST** |
| 2 | No fabricated ratings, user counts or testimonials | family `social-proof` | **TEST** |
| 3 | `SAFE`/`MODERATE`/`HIGH` never render as copy; labels come from `lib/revora/labels.ts` | `copy-pins.test.ts` | **TEST** |
| 4 | A Clear verdict carries no adjustment and no swap | `assertNoUnsafeSafeFields` (throws) + family `unconditional-swap` | **TEST + RUNTIME** |
| 5 | The disclaimer is visible with the result, never behind a disclosure | `disclaimer-presence.test.ts` (engine responses only) | **TEST in-app · PROSE on marketing** |
| 6 | Statistics trace to the evidence pack; the trial citation lives only on `/how-it-works` | family `study-association` + exemption guard | **TEST** |
| 7 | **No statistic-shaped slot exists on a marketing surface** (§1.2) | structure | **STRUCTURAL** |
| 8 | WCAG AA everywhere; health information never in `--text-soft` | `tests/smoke/landing-a11y.spec.ts` (axe) | **TEST (partial)** |
| 9 | 44px touch targets, **56px** on the marketing CTA (was 52px until 2026-08-06) | `landing-design-guards.test.ts` pins the 56px; axe does not test target size at AA | **TEST (CTA) · NOT ASSERTED (44px)** |
| 10 | Nothing below 16px on a marketing surface except tracked uppercase | two CSS comments | **PROSE** |
| 11 | Verdict colour is never the sole channel; every verdict renders icon + word | icons ship, uncovered | **PROSE** |
| 12 | `prefers-reduced-motion: reduce` zeroes all motion | `globals.css:36-44`, uncovered | **NOT ASSERTED** |
| 13 | Focus visible everywhere; outlines never removed | `:focus-visible` + axe | **CSS + TEST (partial)** |
| 14 | Marketing surfaces read light. No dark bands | owner instruction 2026-07-27 | **PROSE, immutable** |
| 15 | The landing is marketing; the app lives at `/check` | nothing structural | **PROSE** |
| 16 | **Every user-facing sentence must be fileable under a claim class** (§1.3) | nothing | **PROSE, new** |

Ranked by how quietly a redesign breaks one: **10 → 7 → 12 → 9 → 8.** Until 9 and 12 have tests, a change touching
motion or targets checks them by hand.

### 1.1 Three fences, not one

`claims-boundary-copy.test.ts` reads every `.tsx` under `app/` and `components/` and proves only that no **banned family**
appears. `validate-safety-contract.mjs` reads **only `docs/safety/*.md` plus a fixture, never a source file**, and proves
only that the ledger is self-consistent. The pin suites prove named strings. **Nothing connects the ledger to the source
in either direction:** a new sentence is opted *into* the banned-word scan automatically and *out of* the ledger entirely,
and nothing goes red. That is how an unledgered comparative claim survived four reviews at `app/page.tsx:523-524`.

### 1.2 Rail 7, rewritten

The old rail was a CSS comment asking nobody to put a number into a slot styled as a 3.6rem number well. **A component
whose primary affordance must be disabled for its content to be safe is the wrong component.** The band is deleted, so
no big-number affordance exists and the rail is discharged structurally. If a stat-shaped slot returns, so does the rail.

### 1.3 Rail 16, new

> **Every user-facing sentence must be fileable under a claim class in `docs/safety/claims-boundary.md`. A sentence that
> is neither approved nor banned is not therefore permitted.**

All nine classes are *about Revora*. **There is no class for a statement about another company's product**, so
comparative copy is unavailable at any scale: outside the schema, not merely unapproved. Creating a class is a decision
for counsel, not a copy decision.

## 2. Voice: permission-first

- **Lead with what the user CAN do or eat.** Never restriction-first: the rule the landing broke by opening on a loss.
- **Utility language on app surfaces:** orientation, status, action. No mood copy, no hype, no emoji in headings, no
  exclamation marks near a verdict.
- **Errors say what to do next, never what the user did wrong.** Manual and slow paths are service, not failure.
- **Never claim the page is calm** — a surface that has to say it is calm is not. **Marketing may name the reader's
  situation in their own words;** that licence does not extend to making a claim.

## 3. Tokens

`:root` in `app/globals.css`. There are no others; a new one needs a row here in the same commit.

| Token | Value | Use |
|---|---|---|
| `--page-bg` | `#f2f7f6` | body and marketing ground |
| `--surface` / `--surface-muted` | `#ffffff` / `#f8fafc` | cards, and only cards / insets, chips |
| `--border-strong` / `--border-soft` | `#cbd5e1` / `#e2e8f0` | inputs / card borders |
| `--text-strong` · `--text-body` · `--text-muted` | `#0f172a` · `#1e293b` · `#475569` | titles and verdicts · body · labels, captions, fine print |
| `--text-soft` | `#64748b` | **plane-restricted, §3.1** |
| `--accent` · `--accent-strong` · `--accent-contrast` · `--accent-tint` | `#0d5f57` · `#0a4a44` · `#f8fafc` · `#e6f2ef` | the one brand colour. `-strong` is hover/pressed and link text; `-tint` is a selected or soft-brand fill |
| `--ink` / `--danger` | `#0f172a` / `#b91c1c` | anything that must stay neutral-dark / destructive text |
| `--safe-*` · `--moderate-*` · `--high-*` | `globals.css:16-27` | the three verdict sets: border, tint, text, badge |
| `--dur-press` · `--dur-fast` · `--dur` · `--ease` | §6 | motion |
| `--icon-sm` / `--icon` | `16px` / `20px` | icon sizes |

`--landing-band` was removed 2026-07-27 with the dark bands; do not reintroduce it (rail 14). **One brand accent.** Risk
colours are semantic-only, graduate from border to the full verdict treatment, and every `-text`-on-`-bg`/`-badge` pair
clears AA. **Never use a risk colour decoratively.**

### 3.1 `--text-soft` is plane-restricted, and this is accessibility, not taste

| `--text-soft` `#64748b` on | `--surface` | `--surface-muted` | `--page-bg` | `--accent-tint` |
|---|---|---|---|---|
| Ratio | **4.76:1** pass | **4.55:1** pass, no margin | **4.40:1 FAIL** | **4.15:1 FAIL** |

> **Text colour on `--surface` and `--surface-muted` only, for hints only, never health information. Banned on
> `--page-bg` and `--accent-tint`.** The old annotation, "AA at 16px on white," was true on white and misleading
> everywhere else the product renders.

**All four in-repo uses audited 2026-08-05 and all pass, none with margin:** `:198` and `:3148`, both placeholders on an
input's own `--surface`; `:2673` `.chip-remove` on `--surface-muted`; `:2546` a decorative `background`, not text.
Separately `--text-muted` on `--page-bg` is **7.00:1**, AAA to the second decimal, and it carries captions and the footer
disclaimer; axe tests AA and would not report a drop.

## 4. Type

- **Two faces on a contrast axis.** `var(--font-sans)` is **Plus Jakarta Sans** (variable 400–800, `app/fonts.ts`) for
  display, wordmark, buttons and labels; `var(--font-body)` is **Source Sans 3** (400/600/700) for reading, on marketing
  only, because a geometric sans at 14–15px is the wrong tool for body copy read by 40–60-year-olds on a phone. **The app
  UI stays single-family.** Two proposals to collapse to one face were rejected: both audited clean without addressing
  the pin they land on (§14 row 2). **Marketing titles use 700, never 800** — Source Sans 3 loads 400/600/700 and 800
  renders faux-bold, so `globals.css:1728-1731` caps `.landing .result-title` at `22px / 700`.
- **Base `16px / 1.5`, in force** (re-verified 2026-08-05: `body` is out of the `font: inherit` control reset,
  `globals.css:83-87`). Body copy runs `1.65`. **Weights 400 / 600 / 700, nothing else.**
- **App scale:** 13px tracked uppercase eyebrow (700, `0.08em`) · 14–15px hints and meta · 16px body and inputs · 18px
  subheads (700) · titles `clamp(2rem, 7vw, 2.6rem)` at `-0.03em`.
- **Tracking is size-specific; one `letter-spacing` across a clamp is wrong at one end of it.** Tighten as size grows
  (`-0.02em` at display, `0` near body), and move line-height inversely.
- **Measure caps at 62ch on prose.** `text-wrap: balance` on `h1`–`h3`, `pretty` on prose.

## 5. Shape and space

> **Radius scale: outer surfaces 24px · inputs 18px · nested cards 14px · result cards 22px · pills, buttons and chips
> 999px. Pick from the scale, never invent.**
>
> ⚖️ **2026-08-06 — the scale gains two members, both marketing-only:** **20px** (the landing's illustration surfaces —
> `.landing-demo`, the hero card's frame in the design file) and **16px** (`.landing-verdict-card`). They are the design
> file's, imported with §11's other measurements, and they are recorded here rather than left in the CSS because *never
> invent* means the scale is the list. ⛔ **Marketing only.** No app surface takes 20px or 16px: inside the product the
> scale is still 24/22/18/14/999, and an illustration radius leaking into `/check` would put four radii within 4px of
> each other on one screen.

`22px` is a member, not an exception: `.result-card` is the product's most-seen surface, ships at 22px on three routes,
and the scale predates it. **The one place the product violates the scale** is `DemoCheckCard`
(`components/demo-check-card.tsx:38`), which wraps two `.result-card`s (22px) in a `.surface-card` (24px). A 2px delta is
the worst available answer: too different to read as one surface, too similar to read as two.

> **Ruling: the wrapper is not a card.** It is a labeled sequence (`aria-label="Example check"`), and this file's own
> rule is *cards earn existence*. The wrapper drops `surface-card` and becomes an unbordered labeled region carrying the
> eyebrow and the two typed lines; the two `.result-card`s stay untouched at 22px. That removes the nesting, the delta
> and the mosaic without editing the card the marketing page exists to show. **Product work item; three routes import it.**

⚖️ **2026-08-06 — discharged on the landing, still open on the other two routes.** `<DemoCheckCard layout="table" />`
gives the marketing page the design file's six-row labelled table: no nesting, no 2px delta, one surface at 20px, and
the eyebrow and the two typed lines exactly where the ruling above put them. It is a **layout prop, not a replacement**,
because `/check` and `/demo` render the same component and a marketing drawing has no authority over an in-app surface —
so those two still nest, and the work item above is still theirs. The ruling's shape is now implemented once and can be
lifted rather than redesigned.

⛔ **Do not restate a nested-card ban. This file has never had one** — the previous version gave nested cards a radius
and used it. `impeccable` bans them; this file does not. The rule above is about one 2px delta, not a category.

- **Card shadow `0 18px 40px rgba(15,23,42,0.08)`, the only shadow in the system.** Nothing else casts one.
- **Cards earn existence.** Not interactive and not semantically bounded means it is typography. Boxing three sentences
  about the reader's situation makes them look like features.
- **Touch:** global `min-height: 44px` on `button`/`input`/`textarea` (`globals.css:89-93`). ⛔ **No invisible hit-area
  expansion on inline links** — WCAG 2.5.8's inline exception covers them, and negative margins overlapped adjacent
  targets when this repo tried it.
- **Layout:** mobile-first at 375px, app pages in the `(app)` shell (§8). 16px grid gap, 20px card padding.

## 6. Motion

| Token | Value | Job |
|---|---|---|
| `--ease` | `cubic-bezier(0.23, 1, 0.32, 1)` | **the** ease. Strong ease-out |
| `--dur-press` · `--dur-fast` · `--dur` | `120ms` · `150ms` · `200ms` | pointer-down feedback · hover, colour, small state change · entrance |

> **⚖️ Ruling (10B): the curve split is closed.** The app ran `cubic-bezier(0.22, 0.61, 0.36, 1)` (easeOutCubic) while
> the marketing spec specified `cubic-bezier(0.23, 1, 0.32, 1)` (easeOutQuint) at 120ms for the press. Two curves this
> close, in a system with one shadow and one accent, is unearned duplication. **The stronger curve wins and becomes the
> system's only ease** — both `emil-design-eng` and `impeccable` prescribe it, and 120ms sits inside the 100–160ms press
> window Apple and Emil give independently. **This is a one-line token change:** all 24 consumers read `var(--ease)` and
> none hardcodes the curve. Ship it as its own revertible commit with a before/after on the result-card entrance.

- **Press feedback is on pointer-down (`:active`), never release** — the press is the moment the user watches most
  closely. `translateY(1px) scale(0.98)` at `--dur-press`. **Name the properties; never `transition: all`.**
- **Three sanctioned keyframes:** `revora-rise` (6px fade-up, once, result-card entrance), `revora-skeleton` (shimmer,
  loading placeholders only) and — ⚖️ **2026-08-08, v4 design file** — `landing-marquee` (the landing's trust band,
  `transform` only, 34s linear, infinite). **No other looping animation anywhere**, and the third one carries conditions
  the first two do not: it is `transform`-only, it **pauses on `:hover` and `:focus-within`**, and the global
  reduced-motion block zeroes it. ⛔ **`prefers-reduced-motion` is the load-bearing one and it is the ONLY one on a
  phone** — `:hover` never fires on touch and nothing inside the band is focusable, so pointer pause is a desktop
  affordance, not the accommodation. Moving text that runs past five seconds with no way to stop it is a WCAG 2.2.2
  concern, and **axe-core does not detect a CSS marquee** — `landing-a11y.spec.ts` will pass over a page that has one.
  ⚠️ **If this band ever grows a control or a link, it needs a real pause button**, because at that point a touch user
  has content they must interact with inside a moving target. The track renders its list twice and translates `-50%`, so
  the reduced-motion jump-to-end lands on an identical copy and loses nothing.
- **A reveal enhances an already-visible default.** Ship content at `opacity: 1` and let an `IntersectionObserver`
  *replay* it; transitions pause on hidden tabs and never fire headless, so a visibility-gated reveal ships the section
  blank, including to a crawler.
- **`prefers-reduced-motion: reduce` zeroes all durations** (`globals.css:36-44`); never remove it. That block is a
  safety net, so a JS-driven reveal must **also** gate the class in JS: the net only shortens what already ran.
- **Animate `transform` and `opacity` only**, and use a spring library where a gesture must be interruptible rather than
  fighting keyframes. ⛔ **No scroll reveals as section scaffolding** — a uniform entrance on every block is the tell,
  not motion; stagger inside one list is legitimate.

## 7. Icons

`components/icons.tsx` is the entire vocabulary: Check, Alert, Pause (verdicts) · Keyboard, Mic, Camera (input) · Lock,
Leaf, Heart, EyeOff (trust) · ArrowRight · Home, Person, CheckCircle, Bookmark, Compass (shell nav). Hand-written
24-viewbox strokes, `stroke: currentColor`, sized by `--icon-sm`/`--icon`, always `aria-hidden`. **No icon libraries;**
adding a glyph edits that file and this list.

**Restated:** an icon never carries meaning alone **unless it is a redundant channel for text already in the accessible
name.** The old absolute contradicted §9, where the verdict icon inside a week-strip mark is exactly that channel.

## 8. App shell

| Range | Content column | Navigation | Grid |
|---|---|---|---|
| < 1024px (designed at 375) | `app-content` max 520px | bottom tab bar, five slots: Home · My meals · Check (the one accent-filled action) · My journey · Account. Top bar is brand only, no hamburger | single column |
| ≥ 1024px | max 1000px + 280px fixed sidebar | sidebar, same five + `plan-box` | single column |
| ≥ 1440px | max 1120px | same | same |

- **The nav flips at exactly 1024px** and the inactive wrapper is `display: none`, so exactly one `Main` landmark exists
  at a time. `<nav aria-label="Main">`, `aria-current="page"` on the active link, 44px+ targets, `app-skip` first.
- **The plan box shows the plan name AND the billing date.** Hiding the renewal date from an active subscriber is banned,
  and that ban binds every rendered plan box. Home renders it only when it carries actionable billing truth; the sidebar
  and `/account` always render it in full.
- **The check CTA is the one Committed colour moment**, and at <768px the first interactive element above the fold: the
  dashboard never adds friction before the core action. **Day-0 empty state is the default design, not a fallback:** one
  CTA plus the Today card's warmth, no fake data, no guilt copy.

## 9. Progress surfaces: reassurance, not gamification

Users are anxious by definition, so progress UI manufactures reassurance and never streak pressure.

- **Additive framing only.** Counts that grow, nothing that can visually break, no loss aversion, no "streak at risk"
  state ever. **Unchecked days render neutral** (dashed `--border-strong` on `--surface-muted`), never red, never "missed".
- **Verdict colour on the week strip is information:** each day shows its most careful verdict
  (`lib/coach/days.ts verdictWeekView`) with the verdict *icon* inside the mark, so shape carries the signal, plus a
  per-day `sr-only` sentence.
- **Illustrative data is always labeled.** `demoExampleEyebrow()` (AUD-008) computes the label from the evidence state
  and swaps to `A real check, captured <date>` when a capture is authorised. ⛔ **Never hand-type it** — a literal
  becomes a false claim the day a capture lands.
- **The weekly view is the non-scored recap** (`lib/coach/recap.ts`, `/journey`): plain counts, no composite score, no
  band words, no percentages, because a more-confident user who checks less must never read "progress declined".

## 10. Component recipes

- **Result anatomy** (`.result-anatomy`) is a labeled document, not a poster: permission-first header on `--accent-tint`
  leading with the most practical action (adjustment → swap → keepMost), then rows Meal · **Signal** (verdict icon +
  label, the ONLY tinted row) · Why · Try. Card surface stays white, verdict colour appears on the border and Signal row
  only, boundary copy stays in the fineprint, visible with the result.
- **Selectable chips:** `.chip-row` (flex, 8px, wraps) of `<button class="selectable-chip">` at 999px, 1px
  `--border-strong`, `--surface`, 16px, 44px min-height. Selected is `aria-pressed="true"` plus an `--accent` fill —
  **a fill change only**, no icons or checkmarks. Buttons, never divs; one row per section, 1–3 word labels.
- **Input-method row** on `/check`: the available methods in one `.chip-row` above the textarea, so users see every way
  in before typing, and **all methods land in the same reviewed text path.** ⚠️ `photoInputEnabled()` is **false**, so
  the row ships two methods; copy naming three is wrong today.
- **Day-1 / first-win** is typography, not celebration: one `status-eyebrow` plus one `page-copy` sentence in a
  `--surface-muted` inset at the 14px nested scale, inside the daily-loop card. No confetti, animation, emoji or
  exclamation marks; at most once a day, only when `streak === 1`.
- **Home meal-check hero** (`.meal-hero`) is the dashboard's one accent-filled card and a **hand-off, not a second check
  surface**: the typed meal rides the `revora.recheck` prefill into `/check`, the one place a check runs.

## 11. Marketing surfaces

`/` is marketing; the app lives at `/check` (rail 15). Marketing keeps every token, the one shadow and the radius scale,
and relaxes exactly three app rules here only: a wider frame (`max-width: 1120px`), a larger type scale, and the reading
face.

> ### ⚖️ 2026-08-06 — the imported design file is the page, and it supersedes the tournament winner
>
> This section used to describe **`W — One Card Back`** (`docs/plans/landing-tournament-winner-spec.md`). The owner
> reviewed the built page against `Revora Landing.dc.html` and ruled the design file **"way better and more readable"**,
> and that it should be implemented as drawn. An earlier pass had implemented that file *filtered through* the rules
> below — keeping §11's type scale, one plane and no-eyebrow rule over the design's — and the owner rejected the result.
>
> **So the precedence is now: the design file wins on type, plane and layout; the tournament thesis survives only where
> the design does not contradict it.** What is preserved on purpose, because it is a safety or reachability constraint
> rather than a style rule: §11.1's desert budget, the claims boundary, the 44px touch floor, and **"the page's unit of
> composition is the product's own artifact, rendered in the live classes"** — where the design *draws* a UI (a result
> card, a phone), the implementation renders the **real component or a real capture**, because a drawing can drift from
> the app silently and the real thing cannot.
>
> ⚖️ **That last clause was narrowed on 2026-08-06, by the same owner, in the ruling below.** It now holds for the
> **hero card** (the real `ExampleResultCard`) and the **phone** (the real `/check` capture, still pinned against
> `TASTER_LIMIT` by `landing-art.test.ts`) — and NOT for §5's demo or §6's three answers, which are drawn. The owner was
> shown the drift cost and took it. Where a surface is drawn, the containment is: **words from the shared fixture,
> colours from risk tokens** (§11, card families).
>
> Everything below marked ⚖️ **2026-08-06 (design file)** is a rule this ruling changed. Measured after the whole
> change: **12,771px · 11 exits · worst desert 1,960px · 0 over budget.**
>
> ### ⚖️ 2026-08-08 — `Revora Landing v4 Product.dc.html`, and it overturns four §13 entries
>
> The owner imported a fourth design file and ruled it governs, with the §13 conflicts named and taken deliberately
> rather than discovered afterwards. **Four confirmed anti-patterns from the tournament are now shipped on purpose:**
> a **looping marquee** (§6 said there were two sanctioned keyframes; there are three), **`Step N` eyebrows** (§13 #8,
> 7/7 collapse), a **glassmorphic sticky nav** (§13 #8), and the four pains as an **identical card grid with numbered
> markers** (§13 #8, twice). Each is annotated at its rule below and at its CSS rule with what contains it. **What the
> ruling did NOT extend to:** the footer, which keeps all twelve routes against the design's six, because
> `.landing-nav-links` is `display: none` below 640px and the footer is the phone's only labelled navigation.
>
> **The section order changed**, and the plane sequence with it — hero · showpiece · marquee · glance · problem · scope ·
> what-changes · how-it-works · three answers · limits · offer · FAQ · final. Two blocks are new (the **showpiece**, a
> dark panel holding the real `/check` capture beside the real `ExampleResultCard`; and **how it works**, `#how-it-works`,
> three named steps — the block the page had been missing since the old one was deleted, while the nav link pointed at a
> methodology page with no steps on it). Two dark grounds now, not one: the showpiece opens and `.landing-final`'s panel
> closes, with `.landing-changes` between them.
>
> ⛔ **Exits are NOT the design file's.** v4 draws five; the page ships eleven, every one of them a measured position.
> This is the third pass to learn it and it is now a rule: **the design file governs layout and copy, §11.1 governs
> exits.** Measured after the whole change: **14,471px · 11 exits · worst desert 1,921px · 0 over budget** (the page is 1,700px longer than the 2026-08-06 measurement and its worst desert is 39px *shorter*, because the two new blocks arrived with two new exits).

- ⚖️ **Alternating planes — 2026-08-06 (design file).** ⛔ **This reverses the previous rule, which was "white is card
  material, never a section background."** Sections now alternate strictly between `--page-bg` and a full-bleed white
  sheet (`.landing-section--sheet`): the at-a-glance strip, the scope block, the three-answers block, the FAQ and the
  final CTA are sheets; the problem block, the pause, the limits block and the offer are the page plane; `.landing-changes`
  is the one `--accent-strong` band. **The alternation is the mechanism that resolves the old ambiguity** — a sheet is
  full-bleed with square corners and no border, a card has a border and a radius, and because sheets alternate they read
  as "next section" rather than as an enormous card. ⚠️ **Two adjacent sheets, or a sheet that breaks the alternation,
  brings the original bug straight back.** Sheets break out of the frame with `margin-inline: calc(50% - 50vw)` plus
  matching `padding-inline`, so their content column stays aligned with every other section's.
  ⚖️ **The sequence was re-cut 2026-08-08 (v4 design file) and the mechanism is unchanged.** Sheets are now the
  **marquee band, the problem block, how-it-works, the limits block and the FAQ**; the hero, showpiece, glance strip,
  scope block, three answers, offer and final CTA are the page plane. `.landing-changes` is still the one full-bleed
  `--accent-strong` band. Two blocks carry a dark or tinted **panel** inside a page-plane section rather than changing
  the plane itself — `.landing-showpiece-panel` and `.landing-final-panel` (`--accent-strong`) and `.landing-scope-panel`
  (`--accent-tint`) — which is what lets them exist without breaking the parity.
  ⛔ **ON A SHEET, A CARD GOES DOWN A PLANE — `--page-bg`, never `--surface`.** The pain cards, the step blocks, the
  sources card and the limits trio are all tinted for this reason, and the last two only became so on 2026-08-08 when the
  v4 order moved their sections onto sheets. The inverse holds too: `.landing-verdict-card` went `--surface-muted` →
  `--surface` in the same pass, because a *muted* card on `--page-bg` lands within a hair of the ground and stops reading
  as an object. **A card is always one clear step away from the plane it sits on, in whichever direction that plane
  leaves room.**
  ⛔ **A CARD MAY NOT SIT ON A SHEET WEARING THE SHEET'S OWN COLOUR.** The FAQ shipped for one day as bordered white
  `<details>` boxes on a white sheet, which is the exact card/section ambiguity the alternation exists to prevent —
  self-inflicted by making the FAQ a sheet without re-reading its rows. The design file's answer, now implemented: the
  rows are **plain, separated by a 1px `--border-soft` rule**, with a `+` / `–` marker and **no border, radius or
  background**. A hairline says *list*; a box on a same-coloured plane says nothing at all. The FAQ column is also the
  page's one narrow one — **880px, centred**, heading included, because these are its longest paragraphs.
  **Sectioning is still air plus a hairline on the block**, never an `<hr>`: `padding: clamp(56px, 7vw, 88px) 0` with
  `border-top: 1px solid var(--border-soft)`, reset on `:first-of-type`. ⚖️ **88px, with exactly two sections at 92px**
  — the problem block and the dark band, the page's two long-scroll blocks. That split is the design file's, not a
  rounding artifact in the drawing; it is invisible below 1257px, where the clamp has not reached its ceiling.
  Hero padding is deliberately smaller and
  **measured** — unifying it with the section clamp pushes the proof card off the fold.
  ⚠️ Anything setting block padding on a sheet must use **`padding-block`**, not the `padding: X 0` shorthand, or it
  silently zeroes the sheet's inline padding and jams the copy against the viewport edge.

  ⚖️ **The rhythm was `clamp(72px, 10vw, 128px)` until the owner's 2026-08-06 ruling that the imported design file governs
  layout while §11 governs type.** It pinned at its 128px ceiling from 1280px up and adjacent sections stack, so every
  block boundary measured **257px** of dead vertical space at 1280px — and at 375px it sat on its 72px floor on *both*
  sides of every seam. The new clamp computes 56px at 375px and 92px from 1314px up; boundaries land at **112px** narrow
  and **184px** wide. This was not cosmetic: the same pass added three sections (the at-a-glance strip, "What actually
  changes", the offer block), and **§11.1's worst desert had 124px of headroom** — at the old rhythm those sections could
  not have been added at all. Measured after: **10,733px, 9 exits, worst desert 1,861px, 0 over budget.**

  ⛔ **`.landing-changes` is the one section allowed the `--accent-strong` ground**, full-bleed the same way. One
  section, named explicitly; a second one re-opens the question.

  ⚖️ **`overflow-x: clip` moved from `.landing` to `html` — 2026-08-06 (design file), and it is the reason sticky works
  now.** The full-bleed sections overshoot by half a scrollbar because `vw` counts it, and that overshoot has to be
  absorbed somewhere. On `.landing` it also made every descendant's `position: sticky` fail silently, which is why the
  previous pass recorded the design's sticky columns as impossible. On `html`, overflow **propagates to the viewport**
  and the element itself stays visible, so the overshoot is still clipped and sticky resolves against the viewport.
  ⛔ **Never put a clip or scroll container on an ancestor between a sticky column and the viewport.** There is no error
  and no failing test — the design just quietly stops happening. Two sticky left columns depend on this today
  (`.landing-problem-head`, `.landing-pause-head`, both ≥900px).
- **Card families.** ⚖️ **AMENDED 2026-08-06 by owner ruling — read this before citing the old thesis.** This bullet used
  to read *"two families: the result card, inherited and unmodified, and the price tile"*, and the page's central claim
  was *marketing shows the product's card, unmodified*. The price tile went with the pricing section on 2026-08-05. The
  unmodified-card claim then went **from page-wide to hero-only**, because the design file draws §5's demo and §6's three
  answers as flat illustrations rather than as the product's card, and the owner chose the design file over the claim,
  with the drift cost stated. Three families now:
  1. **The result card, inherited and unmodified** — the hero, `<ExampleResultCard labelled withFineprint />`. This is
     where the claim survives, and it is the one card a reader meets before any argument, which is the right place for
     it to survive if it only survives once.
  2. **`.landing-verdict-*`** — §6's three flat illustrations. `--surface-muted`, 1px `--border-soft`, a 4px risk-token
     top rule, 16px radius, no labels, no disclaimer row.
  3. **`.landing-demo-*`** — §5's six-row label-gutter table, the landing's layout of `<DemoCheckCard layout="table" />`.
  ⛔ **The override ban is UNCHANGED and still tested.** No `.landing*` selector may declare `border`, `border-radius` or
  `box-shadow` on `.result-card` or `.surface-card` (landing-design-guards GUARD 1 — the claim no longer "owes a test";
  it has had one since 2026-08-05). Families 2 and 3 are separate class families precisely so the guard keeps meaning
  what it says: they do not restyle the card, they are not the card.
  ⚠️ **What the ruling actually cost.** Nothing re-renders families 2 and 3 when `result-card.tsx`'s recipe changes, so
  the illustrations can drift from the product's LOOK silently and no test will say so. Two things contain it, and both
  must be preserved by anything that touches them: every string comes from the one fixture set in
  `components/example-result-card.tsx` and from the promise registry, so the WORDS cannot drift; and every colour is a
  risk token, never a hex, so a palette change still reaches them.
- **No eyebrow above the H1**, because the hero's eyebrow words became the H1 — **de-duplication, not deletion on
  principle**. The contender that deleted the eyebrow on principle left a headline about a competitor as the only thing
  above the fold and took the tournament's worst score.
  ⚖️ **2026-08-06 (design file): this is no longer a blanket ban on uppercase micro-labels.** It was, and that is why the
  previous pass rewrote the design's `13px` stage labels to 18px sentence case. Two things were wrong with reading it
  that way. The rule is about **not restating the headline above the headline**, which is a hero problem; and the page
  was never actually free of uppercase micro-labels, because the result card renders its own (`.result-eyebrow`,
  `.anatomy-label`) and the card ships **unmodified** by design. So: `.landing-offer-when` is `13px / 700 / .09em`
  uppercase, as drawn — and note that **rail 10 has always permitted exactly this**: *"nothing below 16px on a marketing
  surface **except tracked uppercase**."* The previous pass rewrote these labels citing a floor its own rail already
  carved them out of. ⛔ **The 16px floor still holds for anything read as a sentence.** These are two-word positional
  labels that name a column ("Day one", "After that"); the floor exists for prose, and prose is what it protects. Do not
  reach for this size for anything longer.
- ⚖️ **Type: the design file's scale — 2026-08-06 (design file).** ⛔ **This replaces "one body size", which was the rule
  from 2026-07-29 until now.** The body base stays `18px / 1.65` and it is still what most of the page is set in, but the
  page no longer pretends to a single size: **the design's scale was adopted, and the reason is that the owner read the
  one-size version as less readable than the design and said so twice.**

  | | Shipped |
  |---|---|
  | H1 | `clamp(2.4rem, 5.2vw, 3.9rem)` / `1.02` / `-0.032em` / **800** |
  | H2 | `clamp(1.9rem, 3.8vw, 2.6rem)` / `1.06` / `-0.03em` / **800** |
  | H2 — **problem block only** | `clamp(2rem, 4.2vw, 2.9rem)` / `1.02` / `-0.034em`, `max-width: 14ch` |
  | H2 — **final CTA only** | `clamp(2.2rem, 5vw, 3.4rem)` / `1.02` / `-0.034em`, `max-width: 16ch` |
  | Scope display line | `clamp(1.55rem, 2.9vw, 2.05rem)` / `1.18` / `-0.028em` / 800 |
  | Lede, hero sub | `20px / 1.55` |
  | Step punch (`.landing-step-punch`), offer note | `19px / 600` |
  | FAQ summary, limits `h3`, sources `h3` | `19.5px / 700` |
  | Glance fact, offer "what" | `22–24px / 800` |
  | Step `h3` | `clamp(1.4rem, 2.4vw, 1.85rem)` / `1.14` / `-0.028em` / **800** |
  | Pain `h3` | `clamp(1.3rem, 2.1vw, 1.65rem)` / `1.16` / `-0.028em` / **800** |
  | Marquee item | `17px / 700` |
  | Body, dark-band chips (`now` and `after`) | `17.5px` |
  | Body, dark-band "now" | `18px` |
  | Trust strip, card caption, FAQ answer, pain body | `17.5px` |
  | Sources, limits body, offer body, demo row value/entry | `17px` |
  | Glance label, verdict-card why/try | `16.5px` |
  | Hero eyebrow | `13.5px / 700 / .05em` uppercase — **under the floor**, see the eyebrow bullet |
  | Stage label, demo eyebrow, step pill | `13px / 700 / .09em` (step pill `.06em`) uppercase — **under the floor**, same |
  | Dark-band column heading | `12.5px / 700 / .12em` uppercase — same carve-out |
  | Demo row label | `12px / 700 / .09em` uppercase — same carve-out, matching `.anatomy-label` |

  ⛔ **H2 IS NOT ONE STEP, and flattening it back is a regression, not a tidy-up.** The two exceptions above are the
  design file's: one heading opens the argument, one closes it, and both take a step the other six do not. The pass
  before this one normalised them to the shared step and the owner rejected the result. Both overrides are `(0,2,0)`
  against `.landing-h2`'s `(0,1,0)`, so they win on specificity rather than on source order.

  **The H1 floor is the change that carried the cost.** `1.9rem → 2.4rem` is +26% at 375px, and 375px is exactly where
  §11.1's budget is measured, because the H1 sits *on* its floor there. The previous pass refused the design's floor for
  that reason and it was right about the arithmetic — it was wrong that the arithmetic settled it. **The headroom was
  found elsewhere instead** (an exit moved to the foot of the glance strip; the pause's dare link moved after the card),
  and the result is measured, not asserted: **12,803px · 10 exits · worst desert 1,916px · 0 over.**
  **The fineprint floor stays `16px` for prose, and the result card's own copy stays app-layer `16px`** — the card is the
  unit of composition and does not get a `.landing`-layer type override for reading smaller than the prose around it.
  ⚖️ *(Superseded 2026-08-06 by the design file's scale above; kept because the reasoning about ratios still applies.)*
  **The H1 ceiling was `2.9rem` from `ea3b055` until the owner ruled it back to `3.8rem`, both on 2026-08-05.**
  Raising the body to 18px while the ceiling sat at 46.4px took the H1/body ratio to **2.6×** against the deployed page's
  **3.8×**, and the owner read the result as flat *despite* the larger body. The claim above that "H1/H2 are clamped so
  the display scale is untouched" was **false in effect**: a clamp protects the *floor*, not the ratio, and the ratio is
  what hierarchy is. **Measured in the browser against a production build, the restore is free.** Rendered H1: `30.4px`
  at 375px — the `1.9rem` floor, *identical at both ceilings*, because `5.6vw` is only 21px there — then 35.8 / 46.4 /
  50.4 / 60.5 / **60.8px** at 640 / 828 / 900 / 1080 / 1280px. Page length, exits and worst desert are unchanged at
  **7,811px · 7 exits · 1,877px**, so the reachability budget (§11.1) is unaffected and needs no re-measure. Only
  viewports ≥828px change, and the new H1/body ratio is **3.38×**. **The hero sub deliberately stays at body size**, so
  the page still has one body size; the ruling was the ceiling alone, and a hero-sub step is a separate, *un*free change
  that would cost length at 375px.
  ⛔ **`--text-soft` is banned here entirely** (§3.1) — the plane is `--page-bg`, where it fails AA. No per-block exemption.
- **Breakpoints 640 / 720 / 880:** footer two-column, three-up grids, full desktop step. Collapsed from eight ad-hoc
  values 2026-07-29; **a new one needs a reason recorded here.** The shell keeps its own set (§8).
- **The CTA is assembled once, by `LandingPrimaryCta`** — five hand-built copies had drifted into four shapes.
  Accent-filled pill (`--accent` on `--accent-contrast`, computed **7.19:1**), **56px** (⚖️ 2026-08-06, the design
  file's size, up from 52px — this raises the marketing floor, it does not relax the 44px global one), 999px;
  `.landing-cta--ghost` is the
  nav variant so the hero owns the only filled pill above the fold. **One filled pill per screenful** ⚠️ **is not
  enforced in code** — the previous version of this file claimed it was, and no such assertion exists. The two closing
  pills clear a screenful by **5px**. **Pre-specified fallback:** make the final exit a text link, not more distance.
- **Credibility is honesty, not decoration.** No fabricated ratings, counts or testimonials (rail 2). The proof points
  are the disclaimer, the research disclosure, encrypted-at-rest plus one-tap delete, and the pre-charge email promise —
  **each attached to a rendered object.** The disclosure ships as prose, not a band (§1.2); the DPP statistic stays off
  marketing entirely (rail 6); rail 16 binds every sentence here.

### 11.1 ⚖️ The reachability budget: a rule change, named as one

The tournament grafted a rule from a killed contender: *no stretch may exceed 1,460px at 375px.* **Measured in a browser
the winner fails it in three places, worst by 764px, and no arrangement of its six exits satisfies it** — the best still
misses by 15px and 103px. The figure came from a *different* contender's page, transplanted unchecked onto an 8,621px one.

> **Ruling: restated in screenfuls, and this is a rule change, not a measurement result.** A pixel distance is not what
> the reader experiences; the number of screenfuls between deciding and being able to act is. **No stretch between exits
> may exceed three screenfuls, 2,001px at 375×667.** Measured worst on the winner's best free arrangement: **1,941px**;
> on the incumbent, **5,228px, or 7.8 screenfuls**. The rule still bites hard and is no longer unachievable.
>
> **The half with real teeth is the measurement: every marketing layout change reports its measured page length, exit
> count and desert map at 375px, in the browser, with the real fonts loaded. An unmeasured desert claim does not count.**
> Estimates here ran 20% low on page length and 35% low on the worst desert.

⚖️ **Related ruling: CTA position in the offer block.** The measured reorder that buys the budget puts a button between
the price tiles and the cancel paragraph, whose power is its **adjacency to the price**, and a 661px pixel win does not
outrank a scored copy graft. **The CTA moves to the first position that does not break the adjacency: immediately after
the cancel paragraph, before the claims list.** That variant is unmeasured, so implementation measures and reports; if it
misses the budget, the measured arrangement is the fallback and the adjacency is what gets spent — a known cost, recorded.

## 12. Interaction rules

- **Focus:** themed `:focus-visible`, never removed. `3px` ring at `rgba(13, 95, 87, 0.45)`; **2px offset on cards** so
  the ring clears a 22/24px radius without colliding with the border; 6px radius on inline-link rings, deliberately off
  the card scale, because a card radius on a one-line text link looks bulbous.
- **Status updates use `aria-live="polite"`.** Progress is a text count first; a spinner is optional.
- **`list-style: none` strips list semantics in Safari/VoiceOver**, so any list that looks like a list carries `role="list"`.
- **Empty states are features:** warmth, one primary action, context. `"No X found."` alone is banned, and **no paid or
  signed-in user is ever dead-ended** — every error names the next step.
- **Print:** `@media print` hides nav, buttons and paywall; black on white; `break-inside: avoid` on item rows.

## 13. The banned list

1. **The winning organ and the killing defect must not be the same object.** True of all three killed contenders, of no survivor.
2. **A named defect is not a mitigated defect.** All three killed contenders predicted their killing score in writing.
3. **No dimension below 5.** A surface is scored on its floor; the two highest single scores both belong to corpses.
4. **Emotional fit below 5 is fatal on its own.** Its distribution has a 2.83-point void: taken or refused, not a dial.
5. **A diagnostic is not a design brief.** Three contenders built from an instrument, passed it, and lost the reader.
6. **A rail passed by deletion is a rail with no subject.** Move the coverage; deleting copy *and* its test discharges it.
7. **A ledger row that records a section's intent is not a pin.** `result-*` rows are verbatim and test-pinned;
   `landing-*` rows record intent, and one describes a hero that never shipped. Never cite the genres interchangeably.
8. **Confirmed anti-patterns.** Eight card families (0/7 defend) · three planes plus a hairline (7/7 collapse) · `Step N`
   eyebrows (7/7) · an eyebrow above every section (7/7) · a how-it-works block selling typing and talking as the
   mechanism (7/7) · a fixed conversion element held across a whole page · deleting the category answer to dodge a trope
   · replacing recognition with definitions · side-stripe borders · gradient text · decorative glassmorphism · the
   hero-metric template · identical card grids · numbered section markers as scaffolding.

   ⚖️ **FOUR OF THESE WERE OVERTURNED ON 2026-08-08** (v4 design file, owner ruling, conflicts named before the code was
   written). They are struck **on the landing only**, each with the condition that contains what the tournament was
   actually scoring — a bare reinstatement elsewhere is still the anti-pattern:
   - **`Step N` eyebrows** → `.landing-step-pill`. What collapsed 7/7 was a step eyebrow on *a how-it-works block selling
     typing and talking as the mechanism* — the same row bans that separately, and these three steps name the product's
     conduct instead, with step two ("it asks before it guesses") carrying the argument.
   - **Decorative glassmorphism** → `.landing-nav`. Not decorative: a capsule that floats over scrolling copy needs the
     blur to stay legible without going opaque. It also takes the system's second `box-shadow` (§5), for separation.
   - **Identical card grids** + **numbered section markers as scaffolding** → `.landing-pains`. The cards are `--page-bg`
     on a white sheet, so they are the page's one non-white card family and cannot be read as the result card; the
     numeral is oversized `--accent-tint` **behind** the heading, texture rather than a marker beside it, and the
     sequence still lives in a real `<ol>` counter rather than in typed content.
   - **A looping animation** (§6, not §13) → `.landing-marquee`. See §6 for the two stop mechanisms it must keep.

**NOT banned, and you will be tempted:** three price tiles (4/7 keep, surviving because the middle tile carries the least
portable sentence on the page — **if that sentence ever leaves the tile, the tiles become the generic thing and should
go**) and the 24px card radius (no convergence; inherited, §5).

## 14. Scar tissue

| Rule | Why it exists | Held by |
|---|---|---|
| `sans.className` stays on `<body>` | FINDING-030: the `font: inherit` control reset used to include `body` and killed the elemental font rules at equal specificity | `landing-wiring-pins.test.ts`, *"landing font wiring (FINDING-030)"* |
| `reading.className` goes on the landing **root**, never `<body>` | two font classNames on `<body>` race by injection order and can flip the whole app's face | `landing-wiring-pins.test.ts` |
| No `.landing*` selector declares `font-size` twice | an appended override block gave ~26 selectors two competing declarations resolved only by source order. **Never re-append an override block** | `landing-wiring-pins.test.ts`, *"no landing selector declares font-size twice"* |
| The primary CTA is assembled once | five hand-built copies drifted into four shapes | **`LandingPrimaryCta` in `app/page.tsx`. No test. Owed** |
| The DPP citation lives only on `/how-it-works` | rail 6, family `study-association` | `claims-boundary-copy.test.ts` + exemption guard |

**One live hazard with no test and no incident yet.** `.landing .result-disclaimer` (16px) and
`.result-fineprint .result-disclaimer` (13px) have **identical specificity (0,2,0)**; the landing wins only by being
**later in `globals.css`**. Moving either block silently drops the marketing compliance line to 13px and breaks rail 10,
and the duplicate-`font-size` pin cannot catch it: it counts declarations per selector and sees one on each. **The
comment belongs on the rule in `globals.css`, not only here.**

## 15. What this rewrite changed

**361 lines → 360**, while adding the rails table, the banned list, the scar-tissue table and four rulings that
existed nowhere before. ⚠️ **Word count went 3,309 → 4,657: this file is denser, not lighter.** The tournament plan
docs hold the evidence; what stays here is the rule plus one clause of derivation.

**Cut as accidents**, being rules that could not derive themselves: **§Class vocabulary**, an index half stale — it listed
`request-status`, which has **zero** rules in `globals.css`, and named 8 of the 41 files in `components/`. **"CSS only, no
animation libraries,"** a dependency policy wearing a design rule's clothes. **The 480px `.page-frame` legacy note**,
because migration status is the roadmap's business. **The scope clause "for content pages"** in §App-UI guardrails, which
is what let marketing become a card mosaic while a rule banning card mosaics sat in the same file. And **three retellings
of one font incident**, now §14.

**Corrected as false:** `--text-soft` "AA at 16px on white" (fails on two of four planes, §3.1) · "one filled pill per
viewport, now enforced in code" (enforced nowhere, §11) · rail 7 as a CSS comment (structural now, §1.2) · the radius
scale as three steps (five, and violated once, §5) · "landing body 16.5–17px" (one value, §11). **Re-verified, not
trusted:** base `16px / 1.5` is live, `body` being out of the `font: inherit` reset at `globals.css:83-87`.

**New rulings:** the reachability budget in screenfuls plus the measurement discipline that gives it teeth, and
CTA-versus-cancel-paragraph priority (§11.1) · one system ease with a named press duration (§6) · the `DemoCheckCard`
wrapper un-carded (§5) · rails 7 and 16 · banned-list item 7.

**Owed, tracked in the implementation plan:** tests for rails 9 and 12 · the card-recipe override guard (§11) · a test for
single-CTA assembly (§14) · the source-order comment written onto the `.landing .result-disclaimer` rule (§14) · the
`DemoCheckCard` wrapper change across three routes (§5) · the `--ease` token change as its own commit (§6).
