# Calm-tone audit walk — F-CALM (PR-2)

**Date:** 2026-09-15
**Scope:** PR-2 is described by the plan as "an audit, not a build." This report is
that audit's deliverable — a full walk of every surface named in Task 2.2's brief,
plus the Task 2.3 colour check and the Task 2.4 clinical-route review, folded into
one document and one commit (see Process note at the end).

## What "calm tone" means here

Per `PRD/Prediabetes_Pal_Guide_Redesign_PRD_v1.1.md` F-CALM and
`docs/safety/claims-boundary.md`, this walk checks four things on every surface:

1. **Alarm colour** — `var(--danger)` or `--high-*` tokens used anywhere other than
   the verdict signal (the Signal row / verdict border / equivalent per-item risk
   indicator elsewhere in the app).
2. **Imperative warnings** — "never" / "must" / "stop" / "!" sitting next to a
   verdict, where the imperative reads as alarm rather than plain instruction.
3. **§8.5 banned verbs with the product as subject** — prevent / reverse / control
   / lower / treat / manage / cure / diagnose, said of Prediabetes Pal acting on
   the user's body.
4. **Fear framing** — the tone policy's banned phrase bank: dangerous, disaster,
   terrible, warning, alarm, urgent, panic.

## Methodology

Two mechanical greps (Task 2.2 Step 2), then a by-hand read of every file the
brief names, because the verb regex has a known gap: Task 2.1's pre-check pattern
(`\b(it|we)\s+(will\s+|can\s+)?(lower|manage|control)`) cannot match a construction
like "Prediabetes Pal will help you manage …", because "will" and "help…manage"
can't both be consumed by its single optional auxiliary group. The claims scanner
(`tests/unit/pal/claims-boundary-copy.test.ts`, Task 2.1) is a regression guard
against reintroducing a *known* bad string; it is not a substitute for reading the
copy. This report is the by-hand read that covers that gap.

```bash
grep -rnE "\b(dangerous|disaster|terrible|warning|alarm|urgent|panic)\b" app components lib/pal/coach-outputs.ts lib/pal/fallback.ts lib/client/ui-state.ts | grep -v "^\s*//"
grep -rn "var(--danger)\|--high-" app/globals.css | head -40
```

Both ran clean of true positives (every hit was either a dev/CSS-lint comment or a
deliberate negation — see the surface table). I additionally ran the same
fear-framing grep and a by-hand banned-verb grep (`prevent|revers|control|lower|
treat|manage|cure|diagnos`, all inflections) across every file the brief names,
including `app/(app)/**` and `app/api/check/route.ts` / `proxy.ts`, which the
literal Step 2 command text doesn't list but the Step 1 walk does.

## Findings fixed in this PR

**None.** The walk found no alarm-colour misuse, no imperative-near-verdict
copy, no product-as-subject banned verb, and no fear-framed string anywhere in
the surfaces this task covers. Tasks 2.1 (verb scanner + `KNOWN_BAD` regression
tests, `396909b`) and 2.3 (neutral-ink `--high-*` re-tokening, `932f77e`) had
already closed the two concrete gaps the plan anticipated; this walk's job was to
check everywhere else, and everywhere else was already compliant. There is
nothing to fix under the "pure token/colour issue" or "no ledger row" carve-outs
in this PR's scope boundary, because no string needing either kind of fix turned
up.

## Findings — safety-owner questions / proposals

These are **not edited** in this PR. Two touch `Approved | Pending sign-off (W-05)`
copy-ledger rows and are drafted below as proposals only; the third is a
copy-governance gap, not a tone defect.

### 1. `clinical-medication-dosing` — clinician pointer is split across two sentences

Current copy (`docs/safety/copy-ledger.md`):
> "Prediabetes Pal never advises on medicine or doses. That is between you, your
> prescriber, and your pharmacist. Please follow the plan you were given, and ask
> them before you change anything."

The professionals are named in sentence 2; the instruction to contact them
("ask them…") is in sentence 3 and depends on "them" resolving back across a
sentence boundary. Every other clinical route names the professional and the
instruction in the same sentence. **Proposed amendment** (safety owner's call,
not applied here):
> "Prediabetes Pal never advises on medicine or doses — please follow the plan
> you were given, and ask your prescriber or pharmacist before you change
> anything."

### 2. `clinical-allergy` — no clinician pointer at all

Current copy:
> "Prediabetes Pal cannot confirm whether a food is safe for an allergy — not
> from a description, and not from a photo. Hidden ingredients and cross-contact
> do not show up. Please check with whoever prepared the food, and follow your
> allergy plan."

Of the nine clinical routes, this is the one row that never names a clinician —
it points to "whoever prepared the food" and an allergy plan the user is assumed
to already have. A very worried user with no existing allergy plan (PRD F-CALM
(b)'s exact case) has nowhere to go here. **Proposed amendment:**
> "Prediabetes Pal cannot confirm whether a food is safe for an allergy — not
> from a description, and not from a photo. Hidden ingredients and cross-contact
> do not show up. Please check with whoever prepared the food, follow your
> allergy plan, and if you don't have one, ask your doctor or allergist."

### 3. `proxy.ts` rate-limit/outage copy has no copy-ledger row (governance gap, not a tone finding)

`RATE_LIMIT_COPY`, `URGENT_CARE_LINE`, and `ABUSE_LIMIT_COPY` (`proxy.ts:39-50`)
are user-facing strings with no matching row in `docs/safety/copy-ledger.md`. The
tone itself is clean — no banned phrase-bank word, and `URGENT_CARE_LINE` is
deliberately scoped (comment `NEW-003`): it exists so a user describing acute
symptoms during a rate-limiter outage still gets a human-care line, since the
fail-closed 503 fires *before* the deterministic clinical router can run. That is
sound design. What's missing is ledger coverage — under "Copy governance" in
`CONSTRAINTS.md`, every user-facing string is supposed to be a ledger row. This
predates PR-2 and isn't part of what Tasks 2.1/2.3 touched; flagging it here as an
owner question rather than adding a row unilaterally, since these strings sit in
the abuse/outage path rather than the result path this PR's scope is about.

## Task 2.3 check (cited, not re-verified)

`932f77e` (`style(calm): Hold off renders in neutral ink, never danger red
(F-CALM a)`) re-tokened `--high-border` / `--high-bg` / `--high-text` /
`--high-badge` to `#334155` / `#f1f5f9` / `#1e293b` / `#e2e8f0` under
`:root[data-calm]`. Previously `--high-border` was `#b91c1c`, byte-identical to
`--danger`. The change ships **dormant**: `app/layout.tsx` sets `data-calm` only
when `guideDoorEnabled("calm")`, and `calm` is in no production flag value
pending the safety owner's colour-blind review. Root `:root` tokens (undated,
`app/globals.css:25-28`) are unchanged and still resolve to `#b91c1c` — that is
correct and expected, not a gap this walk should "fix," because flipping the
default would ship the untested colour ahead of the safety review the dormancy
exists to wait for.

axe/a11y was run both ways (flag off, flag on with `PAL_E2E_GUIDE_DOOR=calm`)
by Task 2.3 against `tests/smoke/landing-a11y.spec.ts`, `tests/smoke/a11y.spec.ts`,
and `tests/smoke/journey.spec.ts`: 76 passed / 8 skipped (DB-dependent, expected
baseline) / 0 failed in both runs, across Mobile Chrome, Mobile Safari, Desktop
Chrome, Desktop Firefox, with no critical/serious violations on landing, home,
result, and journey pages under the calm flag. This report cites that result
rather than re-running it (none of this task's own changes touch rendered
markup).

## Task 2.4 check — the nine `clinical-*` rows, reviewed for "one calm sentence to a clinician"

Review only (`docs/safety/copy-ledger.md` `clinical-*` rows,
`components/result-card.tsx` `CLINICAL_EYEBROWS`) — PRD F-CALM (b): does a very
worried user get pointed to a clinician in one calm sentence? All nine rows are
`Approved | Yes`, `PENDING dietitian/CDCES sign-off (W-05)`; none are edited here.

| Copy ID | Clinician pointer in one calm sentence? | Notes |
| --- | --- | --- |
| `clinical-urgent-symptoms` | **Yes** | "Please contact your doctor or your local emergency number now." — self-contained, no fear-bank word, urgency is warranted (this is the acute-symptom route). |
| `clinical-possible-hypoglycemia` | **Yes** | "If you don't have one, or you feel worse or confused, contact your doctor or your local emergency number now." — one conditional sentence, calm. |
| `clinical-medication-dosing` | **Partial — proposal above** | Professional named in sentence 2, instruction to contact them in sentence 3; not self-contained. |
| `clinical-eating-disorder` | **Yes** | "Please talk with your doctor or a professional soon; you deserve real support, not a label on a plate." — one sentence (semicolon-joined), calm, plus the 988 line ahead of it for the urgent case. |
| `clinical-pregnancy` | **Yes** | "Please ask your midwife, doctor, or dietitian for guidance made for you." |
| `clinical-organ-disease` | **Yes** | "Please ask the doctor or dietitian who knows your case." |
| `clinical-allergy` | **No — proposal above** | Points to "whoever prepared the food" and "your allergy plan"; never names a clinician. |
| `clinical-diagnosed-diabetes` | **Yes** | "please talk with your doctor or dietitian." |
| `clinical-pediatric` | **Yes** | "Please ask their pediatrician or a dietitian who works with children." |

**7 of 9 pass outright. 2 (`clinical-medication-dosing`, `clinical-allergy`) get
proposed amendments above, left unedited pending safety-owner review.**

`CLINICAL_EYEBROWS` (`components/result-card.tsx:58-68`) — the nine short framing
lines above each clinical message body — were read alongside the rows: "Please
get help now," "Follow your plan," "Ask your prescriber," "Support, not a
verdict," "Outside Prediabetes Pal's scope" (×4), "Prediabetes Pal cannot confirm
this." All calm, none use a fear-bank word, none carry alarm colour — confirmed
in CSS (`app/globals.css:522-527`): `.result-card[data-kind="clinical"]` is
"Deliberately NOT styled like a verdict — no risk colour, no verdict glyph,"
using `var(--border-strong)`, never `--danger`/`--high-*`. The code comment at
`result-card.tsx:55-57` states the eyebrows are intentionally not their own
ledger rows (the message body is the approved copy; the eyebrow is framing, not
a claim) — noted as a deliberate design decision, not a gap.

## Surface walk

Every file named by Task 2.2 Step 1's glob list. "Clean" means: no `--danger`/
`--high-*` outside a verdict-signal context, no imperative-near-verdict, no
product-as-subject banned verb, no fear-bank phrase.

### `app/page.tsx` and `app/(app)/**/page.tsx`

| Surface | Alarm colour | Imperative warnings | §8.5 verbs | Fear framing | Verdict |
| --- | --- | --- | --- | --- | --- |
| `app/page.tsx` (landing) | none | none | "Stay in control." (line 566) — user controls their own data, not the product acting on the body; "the control it describes" (dev comment) — n/a | none | pass |
| `app/(app)/account/page.tsx` | `--danger` on `.danger-button`/`.pantry-row-delete`-style delete actions ("This can't be undone. Delete everything?") | imperative, but about account/data deletion, not a meal verdict | "Manage card & billing," "Manage or cancel in Google Play" — user manages billing, not product managing health | none | pass (destructive-action colour correctly scoped away from verdict tone) |
| `app/(app)/canceled/page.tsx` | none | none | none | none | pass — no risk-adjacent copy found |
| `app/(app)/check/page.tsx` | none | none | none | none | pass |
| `app/(app)/demo/page.tsx` | none | none | "lower impact" — adjectival qualitative descriptor, explicitly allowed under `result-qualitative-impact` | none | pass |
| `app/(app)/get-the-app/page.tsx` | none | none | none | none | pass |
| `app/(app)/home/page.tsx` | n/a | n/a | n/a | n/a | pass — thin wrapper, no static copy of its own (composes already-reviewed dashboard components) |
| `app/(app)/how-it-works/page.tsx` | none | none | "behavior you can see and control" — user's own behavior, in an "honest limit" section that explicitly says "Individual results vary, and Prediabetes Pal has no way to know yours" | none | pass |
| `app/(app)/journey/page.tsx` | none | none | none | "Your journey is temporarily unavailable" — neutral outage copy, not fear-framed | pass |
| `app/(app)/meals/page.tsx` | none | none | none | "History is unavailable" — neutral | pass |
| `app/(app)/onboarding/page.tsx` | none | none | none | "A quick heads-up" — calm framing for the out-of-range boundary step; body text is frozen `boundary-copy.ts` (out of scope, PRD §0) | pass |
| `app/(app)/privacy/page.tsx` | none | none | "how to control it" (user controls own data); "What Prediabetes Pal never does" heading over a privacy-commitments list | none | pass |
| `app/(app)/signin/page.tsx` | none | none | none | none | pass — no risk-adjacent copy found |
| `app/(app)/subscribe/page.tsx` | none | none | none | none | pass — no risk-adjacent copy found |
| `app/(app)/terms/page.tsx` | none | none | none | "Availability, warranties, and liability" — standard legal-boilerplate heading, not health fear framing | pass |

### `app/guides/**`

| Surface | Alarm colour | Imperative warnings | §8.5 verbs | Fear framing | Verdict |
| --- | --- | --- | --- | --- | --- |
| `app/guides/a1c-5-7-to-6-4/page.tsx` | none | none | none | none | pass |
| `app/guides/page.tsx` (index) | none | none | none | none | pass |
| `app/guides/prediabetes-meal-plan/page.tsx` | none | none | none | none | pass |
| `app/guides/prediabetes-now-what/page.tsx` | none | none | none | "not a panic" (line 40) — the phrase-bank word appears only inside an explicit negation ("the next step is a conversation, not a panic"), the whole sentence's job is to deny alarm, not induce it | pass (hand-judged; grep's own hit, reviewed and clean) |
| `app/guides/prediabetes-snacks/page.tsx` | none | none | none | none | pass |
| `app/guides/what-to-eat-with-prediabetes/page.tsx` | none | none | none | none | pass |
| `app/guides/cta.tsx` | none | none | none | none | pass |
| `app/guides/layout.tsx` | none | none | none | none | pass |

### `components/*.tsx`

| Surface | Verdict | Notes |
| --- | --- | --- |
| `result-card.tsx` | pass | See Task 2.4 section — clinical route deliberately unstyled as a verdict; `--danger`/`--high-*` only on the actual Signal row and verdict border/badge. |
| `example-result-card.tsx` | pass | `EXAMPLE_RESULTS` fixtures are ledger copy (`landing-three-answers` / `result-safe-example` / `result-moderate-example` / `result-high-example`), not invented; `--high-*` used only on its own verdict card/dot, mirroring the real card. |
| `demo-check-card.tsx` | pass | "warning" hit from Step 2's grep is a CSS-specificity dev comment, not user copy. |
| `journey-card.tsx` | pass | "Manage your subscription," "Manage card & billing" — user manages billing, not the product managing health; "Journey is temporarily unavailable," "You're in maintenance mode" — neutral outage copy. |
| `learning-summary.tsx` | pass | "Your summary is temporarily unavailable" — neutral. |
| `paywall-card.tsx` | pass | Feature-list copy, no risk/verdict language. |
| `trial-wall.tsx` | pass | Subscription copy, no risk/verdict language. |
| `pantry-confirm-list.tsx`, `pantry-intake-flow.tsx`, `pantry-buy-button.tsx` | pass | Pantry Review flow copy, no alarm colour or fear framing. |
| `support-case-form.tsx` | pass | Refund/support copy, neutral. |
| `saved-meals-section.tsx`, `meal-memory-save.tsx`, `meal-memory-recall.tsx` | pass | No risk-adjacent copy found. |
| `photo-draft-review.tsx`, `photo-input-button.tsx`, `voice-input-button.tsx`, `print-button.tsx` | pass | No risk-adjacent copy found. |
| `reviewer-signin-form.tsx` | pass | No risk-adjacent copy found. |
| `food-check-form.tsx`, `home-check-hero.tsx` | pass | No risk-adjacent copy found. |
| `guide-ideas.tsx` | pass (container) | Container's own static strings ("Ideas for breakfast/lunch/dinner/today") are clean. The idea bank content itself lives in `lib/pal/guide-ideas.ts`, which is **not** one of the files this task's glob list names — not walked here; flag as a gap in the brief's own file list if a future audit needs the bank content covered. |
| `dashboard-view.tsx`, `guest-dashboard.tsx`, `week-strip.tsx`, `today-list.tsx`, `streak-chip.tsx`, `daily-loop.tsx`, `insight-card.tsx`, `dashboard-insight.tsx`, `plan-box.tsx` | pass | No risk-adjacent copy found (composition/short-label components; `week-strip.tsx`'s `--high-*` usage on `.dash-daymark`/`.dash-legend-mark` is a per-day verdict indicator, same category as the Signal row). |
| `landing-includes.tsx`, `landing-pause.tsx` | pass | No risk-adjacent copy found. |
| `nudge-open-tracker.tsx`, `nudge-opt-in.tsx`, `first-run-gate.tsx` | pass | No risk-adjacent copy found. |
| `disclaimer-line.tsx` | pass | Renders approved disclaimer strings verbatim; no copy of its own. |
| `result-feedback.tsx` | pass | No risk-adjacent copy found. |
| `attribution-capture.tsx`, `app-nav.tsx`, `sw-register.tsx`, `icons.tsx` | pass | Structural/icon components, no user-facing copy. |
| `admin-feedback-table.tsx`, `admin-pantry-table.tsx` | pass | Internal admin UI, no end-user tone surface. |

### `lib/pal/coach-outputs.ts`, `lib/pal/fallback.ts`, `lib/client/ui-state.ts`, `app/api/check/route.ts`, `proxy.ts`

| Surface | Alarm colour | Imperative warnings | §8.5 verbs | Fear framing | Verdict |
| --- | --- | --- | --- | --- | --- |
| `lib/pal/coach-outputs.ts` | n/a | none | none | none | pass — bounded "Try" banks (sequencing tips, "enjoy it anyway" rows) are calm and permission-first throughout |
| `lib/pal/fallback.ts` | n/a | none | none | "dangerous part when the dish was buffered" (line 35) — dev comment explaining *why* a prior copy choice was flagged in review, not user-facing text | pass |
| `lib/client/ui-state.ts` | n/a | none | none | none | pass |
| `app/api/check/route.ts` | n/a | none | none | none | pass |
| `proxy.ts` | n/a | "don't wait for an app" (`URGENT_CARE_LINE`) — deliberate, documented (`NEW-003`) as the human-care line preserved during a limiter outage; calm, no fear-bank word | none | none | pass (tone); **owner question** — no copy-ledger row (see proposals section) |

## Additional surfaces spot-checked (outside the brief's named globs)

`app/about/page.tsx`, `app/admin/**`, `app/pantry/**`, `app/report/[id]/page.tsx`,
`app/video-engine/page.tsx`, `app/welcome/page.tsx` are not covered by Task 2.2's
glob list (`app/(app)/**/page.tsx`, `app/page.tsx`, `app/guides/**`). They were
spot-checked with the same fear-framing/imperative grep out of caution; nothing
surfaced. Not included in the surface table above since they are outside this
task's defined scope.

## Gates

```
npm run test:pal   → all pass
npm run contract   → all validators pass
```
(See the implementation report for exact output; no source file was changed by
this task, so `npm run lint` was not required to re-run.)

## Process note on how this report was assembled

Task 2.2's brief was written to run *before* Task 2.3, when the SHA it needed to
cite for the colour fix didn't exist yet. It actually ran after both 2.1 and 2.3
landed, so this document folds Task 2.2's audit-walk deliverable and Task 2.4's
clinical-route review into one report and one commit, per the controller's
instruction — rather than splitting an audit across two files when every commit
sha it needs to cite already exists.
