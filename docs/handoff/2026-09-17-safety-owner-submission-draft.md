# Draft: message to the safety owner — guide redesign copy review

**Status of this file:** a draft the product owner will send to the safety owner
(clinical/regulatory reviewer) for Prediabetes Pal. Nothing below is sent yet.
The owner edits and sends it — this is not a request the agent is making on the
owner's behalf.

---

## 1. What this is

This is a review request, not a launch notice. **Nothing described below is
live.** Every guide surface (`ideas`, `source`, `orient`, `calm`) ships behind
`NEXT_PUBLIC_GUIDE_DOOR` and is off in production; with the flag unset, the app
renders byte-for-byte what it rendered before this work started. All of the
code referenced here — PR #144 (merged), PR #146 and PR #147 (open, not
merged) — is dormant until (a) its copy-ledger rows are `Approved` and (b) the
owner deliberately adds the surface to the production flag value.

Requested turnaround: **[turnaround: ____]**

What we need from you: decisions on the copy rows below (Approved / not, and
which variant), plus the design review in §4, plus the three questions in §5,
plus the classification question in §6.

---

## 2. Batch 1 — 8 rows, shipped dormant in PR #144 (merged to `main`)

Source: `docs/safety/copy-ledger.md` on `main`. All 8 rows are `Status: Pending`,
`Active: Yes`. The production door guard (`lib/guide-door-guard.ts`) refuses to
open the `ideas` or `source` surface in production while any of these is not
`Approved`.

| Row ID | Where it appears | Copy (exact) | Status |
| --- | --- | --- | --- |
| `guide-ideas-breakfast` | Home, ideas block | greek yogurt with berries and walnuts · veggie omelet with peppers and spinach · cottage cheese with sliced peach and almonds · scrambled eggs with mushrooms and cheese · hard-boiled eggs with cucumber and tomato · tofu scramble with peppers and onions · oatmeal with peanut butter and cinnamon · mashed avocado with a fried egg | Pending |
| `guide-ideas-lunch` | Home, ideas block | lentil soup with a side salad · tuna and white-bean salad · big salad with hard-boiled eggs, chickpeas, and vinaigrette · chicken salad with olive oil dressing · hummus with carrots, cucumber, and a hard-boiled egg · grilled chicken and avocado salad · hummus with chicken and mixed vegetables · pork with a side salad | Pending |
| `guide-ideas-dinner` | Home, ideas block | baked salmon with roasted broccoli · chicken stir-fry heavy on vegetables · turkey chili with plenty of beans, topped with cheese · sheet-pan chicken thighs with peppers and onions · pork tenderloin with green beans and roasted cauliflower · shrimp with zucchini noodles · grilled chicken with roasted peppers and cabbage · baked tofu with broccoli and mushrooms | Pending |
| `guide-ideas-hero` | Home, ideas block heading/labels | Ideas for breakfast · Ideas for lunch · Ideas for dinner · Ideas for today · Meal ideas that sit within Prediabetes Pal's rules. Tap one to send it to the check. · Meal ideas | Pending |
| `result-source-lead` | Result card, source lead-in | Why this label: under Prediabetes Pal's rules this description reads as generally balanced. · Why this label: under Prediabetes Pal's rules this description reads as leaning toward a concentrated or less-balanced pattern. · Why this label: under Prediabetes Pal's rules this description reads as unusually concentrated or too incomplete to read closely. | Pending |
| `check-empty-ideas` | `/check` empty state | Or start from an idea for {daypart} | Pending |
| `check-from-idea` | `/check` field hint | From today's ideas. | Pending |
| `check-classics-hint-guide` | `/check` first-run hint (flag-on variant) | Or try a classic — three everyday foods. | Pending |

**Decision needed on every row above:** Approve, reject, or request a rewrite.
Flag surfaces `ideas` and `source` cannot open in production until all 8 are
`Approved`.

### Callout — dinner ideas #7 and #8 need a specific read

Unlike the rest of the breakfast/lunch/dinner banks (six of eight lines per
daypart are lifted-and-trimmed straight from the public guides), dinner lines
7 and 8 were **composed**, not lifted from a single guide sentence. They
combine protein and non-starchy-vegetable words taken from the "What can I eat
freely?" list in `app/guides/what-to-eat-with-prediabetes` into new
dinner-shaped meals:

> "grilled chicken with roasted peppers and cabbage"

> "baked tofu with broccoli and mushrooms"

The ledger note for `guide-ideas-dinner` flags this itself ("a stricter reader
may want them replaced") and asks for the safety owner's read specifically on
these two lines.

### Callout — `check-classics-hint-guide` has two candidates

Two wordings exist for this row; the safety owner picks one:

- **The plan's wording:** "Or try a classic — foods whose read surprises
  people."
- **The shipped wording:** "Or try a classic — three everyday foods."

Context: the sibling row `onboarding-first-check` (the flag-off version of
this same hint) was revised under **AUD-017** (2026-07-24) to drop "These
three surprise almost everyone" — a prevalence claim with no evidence
linkage — in favor of neutral framing. The controller chose the shipped
wording over the plan's wording specifically because "foods whose read
surprises people" reintroduces that same surprise/prevalence framing AUD-017
removed from the sibling row. The safety owner may pick either.

### Question — should the idea bank wait for a dietitian pass?

The plan records this as taste decision **A-49**: whether dietitian (RD/CDCES)
sign-off should be a hard gate before the idea bank (batch 1) can flip on in
production, given the existing backlog of rows still waiting on that same
review queue. **Plan default: no** — the bank's gate stays safety-owner
`Approved`, not dietitian sign-off, with the backlog named here so the owner
can see the queue before deciding.

**Backlog count, counted directly against the main-branch ledger:** the
ledger uses two wordings for the same pending-review state. 5 rows read the
literal phrase **"PENDING RD/CDCES (W-05)"**:
`result-borderline-floor-reason`, `result-borderline-floor-adjustment`,
`result-borderline-floor-swap`, `result-ungrounded-reason-moderate`,
`result-ungrounded-reason-high`. A further 10 rows read **"PENDING
dietitian/CDCES sign-off (W-05)"**: `high-range-route` and the nine
`clinical-*` routes (`clinical-urgent-symptoms`,
`clinical-possible-hypoglycemia`, `clinical-medication-dosing`,
`clinical-eating-disorder`, `clinical-pregnancy`, `clinical-organ-disease`,
`clinical-allergy`, `clinical-diagnosed-diabetes`, `clinical-pediatric`). All
15 are `Active: Yes` (live today). **Total: 15 live rows**, matching the
plan's own count ("fifteen live rows still `PENDING RD/CDCES`, nine of them
the `clinical-*` routes," §7.5/§9 F5).

---

## 3. Batch 2 — 18 rows, PR #146 + PR #147 (open, not merged)

Source: `docs/safety/copy-ledger.md` on branch `feat/guide-orient-finish`
(worktree `guide-pr23`), which contains both PRs. All 18 rows below are
present in the ledger; none is missing. All are `Status: Pending`, `Active:
Yes`, surface `orient`. 17 rows were filed with PR #146; `orientation-signin-step`
was added in PR #147 (review A-83, "please queue it with batch 2 (#146)").

| Row ID | Where it appears | Copy (exact) | Status |
| --- | --- | --- | --- |
| `orientation-intro` | `/learn/first-week` hero, intro line | Seven small steps, one a day. None of them is a diet. Skip any, come back to any. | Pending |
| `orientation-step-01` | `/learn/first-week` step list, step 1 | Read what the words on a result mean, in general terms. | Pending |
| `orientation-step-02` | `/learn/first-week` step list, step 2 | Describe a meal you already ate and read its label. | Pending |
| `orientation-step-03` | `/learn/first-week` step list, step 3 | Check the meal you are least sure about. | Pending |
| `orientation-step-04` | `/learn/first-week` step list, step 4 | Try one of today's ideas and see how it reads. | Pending |
| `orientation-step-05` | `/learn/first-week` step list, step 5 (also the note field's `<label>`) | Write down the questions you have for your clinician. | Pending |
| `orientation-step-06` | `/learn/first-week` step list, step 6 | Book, or ask about, a dietitian appointment. | Pending |
| `orientation-step-07` | `/learn/first-week` step list, step 7 | Look back at the week on My journey. | Pending |
| `orientation-day-eyebrow` | Home `<h1>`, first-week list eyebrow, page `<title>` | `Day {n} of your first week` · `Your first week` · `Your first week — Prediabetes Pal` | Pending |
| `orientation-controls` | `/learn/first-week` step controls | `Done` · `Done — {step}` · `Hide this for now` · `Show it again` | Pending |
| `orientation-note-hint` | Step 5 on-device note field | `Your notes stay on this device. Nothing here is sent anywhere.` · `Saved on this device` · `This browser isn't letting the page keep notes — copy your questions somewhere safe.` | Pending |
| `orientation-save-failed` | `/learn/first-week`, failed-save state | That didn't save just now. Tap Done again in a moment. | Pending |
| `orientation-step-prefix` | Home next-action line, check hero eyebrow, list "today" marker | `Today's step: {step}` · `Today's step · Meal check` · `Today's step` | Pending |
| `learn-first-week-intro` | `/learn/first-week` hero, second paragraph | An A1C between 5.7% and 6.4% is a signal, not a sentence. It is common, it comes with real room to act, and the acting mostly happens in ordinary places: your plate, your week, your next appointment. | Pending |
| `journey-where-you-are` | `/journey`, "Where you are" line | `Day {n} of your first week` · `Day {n} of your first week · 1 step done` · `Day {n} of your first week · {k} steps done` · `Your first week · Review` · `Your first week · 1 step done · Review` · `Your first week · {k} steps done · Review` | Pending |
| `onboarding-final-button` | Onboarding tour, last screen button | Start your first week | Pending |
| `onboarding-first-week-line` | Onboarding tour, expectations screen | Your first week starts on Home: seven small steps, one a day. | Pending |
| `orientation-signin-step` | Home next-action line, expired-taster guest only | Sign in to keep your week going | Pending |

**Decision needed on every row above:** Approve, reject, or request a rewrite.
The production guard refuses the `orient` surface until all 18 (plus the
already-noted `orientation-signin-step`) are `Approved`.

### Callout — `orientation-note-hint` contains the word "safe"

One of its three variants (the refused-storage hint) reads: "This browser
isn't letting the page keep notes — copy your questions somewhere **safe**."
The ledger row flags this itself: it is the plan's exact wording (review
A-57), it is not used as a result label, and it passes the automated claims
regex — but it is called out here for a human read since "safe" is a word the
product otherwise avoids in result copy.

### Note — `landing-three-answers` is unchanged text

The already-`Approved` row `landing-three-answers` gained a **treatment note
only** in this batch (it now records the `calm` token override on the "Hold
off" card — see §4). No word of the row's approved copy changed.

---

## 3b. Batch 3 — 4 rows, PR-4 (`ideas-full`, dormant)

Source: `docs/safety/copy-ledger.md` on branch `feat/guide-pr4-ideas-full`. All
4 rows below are `Status: Pending`, `Active: Yes`, surface `ideas-full` — one
level dormant below batch 1's `ideas`: the production door guard refuses
`ideas-full` unless `ideas` is also open, so this batch cannot go live before
batch 1 does.

| Row ID | Where it appears | Copy (exact) | Status |
| --- | --- | --- | --- |
| `guide-ideas-more-breakfast` | Home, ideas block (ideas-full only) | two eggs with spinach · greek yogurt smoothie with frozen berries and chia seeds | Pending |
| `guide-ideas-more-lunch` | Home, ideas block (ideas-full only) | turkey and lentil salad with tomatoes and cucumber · fish with green beans and salad greens | Pending |
| `guide-ideas-more-dinner` | Home, ideas block (ideas-full only) | tempeh stir-fry with peppers and mushrooms · cottage cheese with tomatoes and peppers | Pending |
| `guide-ideas-see-all` | Home, ideas block toggle | See all · Show fewer | Pending |

**Decision needed on every row above:** Approve, reject, or request a rewrite.
The production guard refuses the `ideas-full` surface until all 4 are
`Approved`.

The six new idea lines (`guide-ideas-more-breakfast` / `-lunch` / `-dinner`)
go through the same live label eval as batch 1's 24 — one owner run of `npm
run eval:pal:ideas` after PR-4 merges covers all 30 lines together.

### Callout — three of the six new lines need a specific read

Same situation as batch 1's dinner lines #7 and #8 (§2 above): `prediabetes-
meal-plan`'s own lunches and dinners are already fully used by the seed bank
(each remaining day either duplicates a seed line once its carb side is
dropped, or leads with "leftover" and is excluded), so three of PR-4's six new
lines are **composed**, not lifted from one guide sentence — they combine
protein and nonstarchy-vegetable words from the same "What can I eat freely?"
list in `app/guides/what-to-eat-with-prediabetes` that batch 1's dinner #7/#8
used:

> "turkey and lentil salad with tomatoes and cucumber" (lunch)

> "fish with green beans and salad greens" (lunch)

> "tempeh stir-fry with peppers and mushrooms" (dinner)

Two more points worth a specific read:

- The fourth new dinner line, "cottage cheese with tomatoes and peppers," is
  lifted from `app/guides/prediabetes-snacks` ("Cottage cheese with tomato and
  pepper, or with a little fruit.") but shown under the **dinner** heading —
  the safety owner should read whether a snack-guide line belongs there.
- The new breakfast line "greek yogurt smoothie with frozen berries and chia
  seeds" is the one most likely to fail the live label eval: the Doctor's-
  advice segment's first-check chips already use "fruit smoothie" as a
  deliberately surprising read (`lib/client/first-check-chips.ts`), so a
  smoothie reading anything but Clear here would not be a surprise.

---

## 4. Calm-colour review (A-61 / Task 2.3)

One production-facing (though currently dormant) change needs a design/safety
review before the `calm` surface can ever be added to the production flag
value: the `Hold off` verdict card's border/background/text tokens
(`--high-border`, `--high-bg`, `--high-text`, `--high-badge`) get a
neutral-ink override under `:root[data-calm]`, replacing the current red that
is byte-identical to `--danger`. No copy changes; this is colour only.

**Requested review (protocol per plan review A-61):**
1. A colour-blind check of the three landing verdict cards and the week strip
   — Chrome DevTools "Emulate vision deficiencies" (protanopia, deuteranopia,
   tritanopia, achromatopsia).
2. A "does this look like a warning?" check — show the three verdict cards to
   two readers outside the team for five seconds and ask which one is a
   warning. The target answer is "none."
3. Do this at **375px and 1280px** widths.

**Where the result gets recorded:** the ledger note on `landing-three-answers`
in `docs/safety/copy-ledger.md`, and `DESIGN.md` §3.

**How to view it:** a preview build with the `calm` surface turned on
(`guideDoorEnabled("calm")` / `PAL_E2E_GUIDE_DOOR=calm`). The owner arranges
the preview link — none is included here.

---

## 5. Calm-audit questions

These come from the calm-tone audit run against PR #146
(`docs/audit/2026-09-15-calm-tone-audit.md`, referenced in the PR #146
description under "Owner questions from the calm audit").

### a. Drafted amendments — `clinical-medication-dosing` and `clinical-allergy`

Both rows are unchanged in the ledger and still `Approved | Yes | PENDING
dietitian/CDCES sign-off (W-05)`. The calm-tone audit drafted proposed
amendments for owner/safety-owner review only — **nothing has been edited**:

**`clinical-medication-dosing`** — current copy:
> "Prediabetes Pal never advises on medicine or doses. That is between you,
> your prescriber, and your pharmacist. Please follow the plan you were
> given, and ask them before you change anything."

Finding: the clinician is named in sentence 2, but the instruction to contact
them ("ask them…") is in sentence 3 and depends on "them" resolving back
across a sentence boundary — every other clinical route names the
professional and the instruction in the same sentence. Proposed amendment:
> "Prediabetes Pal never advises on medicine or doses — please follow the
> plan you were given, and ask your prescriber or pharmacist before you
> change anything."

**`clinical-allergy`** — current copy:
> "Prediabetes Pal cannot confirm whether a food is safe for an allergy — not
> from a description, and not from a photo. Hidden ingredients and
> cross-contact do not show up. Please check with whoever prepared the food,
> and follow your allergy plan."

Finding: of the nine `clinical-*` routes, this is the only one that never
names a clinician — it points to "whoever prepared the food" and an allergy
plan the user is assumed to already have, leaving a very worried user with no
existing plan nowhere to go. Proposed amendment:
> "Prediabetes Pal cannot confirm whether a food is safe for an allergy — not
> from a description, and not from a photo. Hidden ingredients and
> cross-contact do not show up. Please check with whoever prepared the food,
> follow your allergy plan, and if you don't have one, ask your doctor or
> allergist."

Both proposals wait on your review; the rows themselves stay untouched and
`PENDING` until W-05 clears them (with or without these amendments).

### b. Rate-limit / outage copy has no ledger row

Three user-facing strings in `proxy.ts` have no matching row in
`docs/safety/copy-ledger.md`:

> `RATE_LIMIT_COPY`: "Prediabetes Pal is helping a lot of people right now.
> Please try again in a moment."

> `URGENT_CARE_LINE`: "If you're feeling unwell right now — shaky, faint,
> confused, or worse — don't wait for an app: contact your doctor or your
> local emergency number."

> `ABUSE_LIMIT_COPY`: "Too many attempts. Please try again in a little
> while."

`URGENT_CARE_LINE` exists deliberately (code comment `NEW-003`): the
fail-closed 503 for the check route can fire *before* the deterministic
clinical router runs, so a user describing acute symptoms during a
rate-limiter outage would otherwise see only "try again" — this line exists
to still hand them to human care. `ABUSE_LIMIT_COPY` guards the
trial-start/auth abuse routes and is deliberately generic (must not hint
whether an address/account exists).

**Question: should these three strings get ledger rows?** Under "Copy
governance" in `CONSTRAINTS.md`, every user-facing string is supposed to be a
ledger row; this gap predates the guide redesign work and was not part of its
scope.

### c. `.status-card[data-state="error"]` — raw hex, outside token families

```css
.status-card[data-state="error"] {
  background: #fff7ed;
  border-color: #f97316;
}
```
(`app/globals.css:654-657`)

This uses raw hex values rather than the product's defined colour-token
families, and is unchanged by this batch of work (not behind any flag).
**Question: is this error treatment acceptable as-is, or should it be
brought into the token system** (and, if so, should that block on this
review or file separately)?

---

## 6. D7 — for the safety owner / counsel, in parallel

**Question:** which claim class does a general A1C-education page fall under
— and if none currently fits, does counsel need to add one?

The sentence in question, from the public guide the plan proposes generalizing
(plan §8 item 3):

> "If your number landed in the middle band, here is how to think about it"

This is currently second-person ("your number... you"); the plan's proposed
generalization reads "Here is how clinicians read the middle band." Either
way, the underlying page (`/guides/a1c-5-7-to-6-4`) needs a claim class before
it can be linked from in-app surfaces addressing the reader's own number.

**Consequence if unresolved:** if no claim class is assigned by "branch-read
day" (the day the owner reads the concierge-test results (D5) and picks
the food-first or number-first order), **F-NUMBERS is deferred** — the
"what these numbers mean, in general" feature does not ship, and any
in-app link that would have pointed at this page's second-person sentence is
held back per the plan's default.

---

## 7. What happens with your answers

The safety owner — not this document's author, and not any automated
process — moves rows to `Approved` in `docs/safety/copy-ledger.md` once a
decision is made. No row in this draft has been changed, and no code has been
touched to reflect anticipated answers.
