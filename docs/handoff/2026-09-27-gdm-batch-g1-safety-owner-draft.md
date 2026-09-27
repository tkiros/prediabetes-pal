# Draft: message to the safety owner — GDM door, ledger batch G1

**Status of this file:** a draft the product owner will send to the safety owner
(clinical/regulatory reviewer) for Prediabetes Pal. Nothing below is sent yet.
The owner edits and sends it (ruling R11) — this is not a request the agent is
making on the owner's behalf.

---

## 1. What this is

A review request for the copy of the second front door: the organiser for a
person told she has gestational diabetes and waiting for her dietitian (PRD
`PRD/Prediabetes_Pal_GDM_Door_PRD_v1.1.md`, Tier 1). **Nothing described here
is live.** Every GDM surface sits behind `NEXT_PUBLIC_GDM_DOOR` and its server
twin `GDM_DOOR_ENABLED`, both unset in production. The production guard
(`lib/gdm-door-guard.ts`) refuses to open a surface while any row it renders is
not signed off, and refuses `organiser` unless `landing` is listed with it. The
work is on branch `feat/gdm-door-tier1`, not merged.

Requested turnaround: **[turnaround: ____]**

What we need from you:

1. A decision on each of the 28 rows in §2 (sign off, reject, or rewrite).
2. The three things in §3 that the rows alone do not say.
3. A read on the four first-door clinical rows in §4, which this door shows
   unchanged.
4. Answers to the open questions in §5.

Every row is `Pending`, `Active: Yes`, claim class `gdm-organiser`. The full
text of each row, with its Notes (where it renders, what it does not say, and
the automated F-CALM-GDM walk behind it), is in `docs/safety/copy-ledger.md`.

---

## 2. Batch G1 — 28 rows, grouped by PR (plan §7.5)

### PR-L — the landing

| Row ID | Surface | Gist |
| --- | --- | --- |
| `gdm-door-name` | GDM landing, organiser | The working name "Gestational Diabetes Organiser", its short form, and the skip link. |
| `gdm-landing-hero` | GDM landing | The landing's one line ("Told you have gestational diabetes and waiting for your dietitian? …") and Sign up. Also the link-preview description of every `/gdm/*` page. See §3c. |
| `gdm-landing-points` | GDM landing | Four lines on what the organiser holds, ending "An organiser. No food guidance." |
| `gdm-landing-holding` | GDM landing | What a signed-in visitor sees while the organiser is not open yet. |
| `gdm-disclaimer` | GDM landing, organiser | "This organiser keeps your own notes. It is informational only and is not medical advice. …" In the footer, and in the printed summary's body. |
| `gdm-maker` | GDM landing, organiser | "From the makers of Prediabetes Pal." — the maker named once, in the footer (G-48). You choose its claim class. |

### PR-1 — sign-up, onboarding, consent, Your data

| Row ID | Surface | Gist |
| --- | --- | --- |
| `gdm-consent-required` | GDM organiser | Why nothing is kept until she gives explicit health-data consent. |
| `gdm-nav` | GDM organiser | The nav labels (Home, My plan, My meals, My questions, Summary, Your data, Add a question). Also the summary's empty-state links (§5). |
| `gdm-onboarding-told` | GDM organiser | "Have you been told you have gestational diabetes?" Yes / Not yet. No A1C, no reading. |
| `gdm-onboarding-not-told` | GDM organiser | Who the door is for, and that testing questions go to her care team. |
| `gdm-onboarding-date` | GDM organiser | Her appointment date, optional. |
| `gdm-onboarding-consent` | GDM organiser | What is stored, how, and the consent box (never ticked for her). |
| `gdm-save-failed` | GDM organiser | "That did not save just now. Try again in a moment." |
| `gdm-data-controls` | GDM organiser | Download, erase (with a warning that it erases the whole account's health data), delete account, sign out, Cancel. `deleteBlocked` (R41) is added after the plan's list: the shared delete route's Google Play refusal, where "try again" could never work. |
| `gdm-privacy-notice` | GDM organiser | The door's own privacy notice at `/gdm/privacy`, in four parts. Counsel reads it too (plan §1). |
| `gdm-status` | GDM organiser | Saving · Saved. · Removed. · Loading — the one polite status line on each page. The two in-progress words take no full stop (R40). |
| `gdm-load-failed` | GDM organiser | "That did not load just now." and Try again. |

### PR-2 — My questions

| Row ID | Surface | Gist |
| --- | --- | --- |
| `gdm-list-full` | GDM organiser | "This list is full. Delete an entry to add another." — at the per-list cap. See §5 on plans. |
| `gdm-asklist-lead` | GDM organiser | "Your care team is the place these questions get answered." |
| `gdm-asklist-controls` | GDM organiser | The questions list's labels, its empty state, and `cardTitle` "Before anything else", which heads the first door's clinical copy (§4). |

### PR-3 — My plan

| Row ID | Surface | Gist |
| --- | --- | --- |
| `gdm-occasions` | GDM organiser | The six occasions of her day, as headings (the bedtime snack is a heading, never advice). |
| `gdm-plan-controls` | GDM organiser | Her plan in her care team's words: field labels, the four ways a clinic counts, Replace, the sheet photo's controls, the dates on a card. Added after the plan's list: `addAnother` "Add another plan" (R50), `photoAlt` "Photo of your sheet" (R54), and `retire` "This one no longer stands" (final review F2: how two current plans go back to one; it dates one plan, never removes it, and never picks which one stands). |
| `gdm-plan-differ` | GDM organiser | The neutral "These differ" chip on two current plans, and the question it parks: "Two entries in my plan differ for {occasion}. Which one stands?" |

### PR-4 — Home and waiting mode

| Row ID | Surface | Gist |
| --- | --- | --- |
| `gdm-wait-structure` | GDM organiser | ACOG's sentence, quoted and attributed. See §3b. |
| `gdm-wait-checklist` | GDM organiser | Four organisational steps, as a plain list (nothing to tick). |
| `gdm-wait-controls` | GDM organiser | Home's words: her appointment spoken as a phrase (never a count of days), the date control, the after-appointment prompt, and the summary offer (§5). |

### PR-5 — My meals

| Row ID | Surface | Gist |
| --- | --- | --- |
| `gdm-meals-controls` | GDM organiser | Her own meals by occasion: the add form, Include in my summary, Delete, the empty state. No label, no read, no score. |

### PR-6 — the printable summary

| Row ID | Surface | Gist |
| --- | --- | --- |
| `gdm-summary-headings` | GDM organiser | The one-page summary's title, its three headings, Print, and the empty line. See §5. |

---

## 3. Three things the rows alone do not say

### a. The `gdm-organiser` class must exist first

No row above can be signed off until you add the `gdm-organiser` claim class to
`docs/safety/claims-boundary.md` (PRD §8.1, gate S5). `npm run contract` checks
the class only on signed-off rows, so the `Pending` rows pass today without it.

### b. `gdm-wait-structure` quotes a professional body (D5)

Home shows, while she waits: "Often, three meals and two to three snacks per day
are recommended", attributed to ACOG's patient FAQ. Three things to rule on:

- whether the door may quote a professional body at all (the F-WAIT "Open" item,
  D5). If not, Home drops this part only;
- the quote leaves out the source sentence's final full stop (G-24);
- it is a count in words she did not type ("three meals and two to three
  snacks"), against the rule "no number the user did not type". If you want the
  quote tied to its own evidence row, that row goes into
  `docs/safety/evidence-pack.md` with your review (plan §8 item 17).

### c. `gdm-landing-hero` departs from the PRD's working line (plan §8 item 7)

The PRD's line opens "Diagnosed with gestational diabetes…". The existing claims
audit refuses the `diagnose` family on every page, and the PRD says those word
families do not change. The draft therefore opens "Told you have gestational
diabetes…", matching the onboarding question. The alternative is an
`exemptSources` entry for `app/gdm/page.tsx` in the audit, with a reason — your
call, not the build's.

---

## 4. Four first-door clinical rows shown on this door

On My questions, when a question she parks matches one of the first four
clinical routes, the items API answers first with that route's row from the
first door, unchanged, in a card headed "Before anything else" above her list
(also when her list is full, R46). These rows are already signed off for the
first door and in force on its result route. They were not written for this
door, are not in batch G1, and the GDM copy test does not scan them. They were
**not edited** (ruling R61). Each one, read on this door:

| Row | What it says here that the GDM rules would not |
| --- | --- |
| `clinical-urgent-symptoms` | "Prediabetes Pal cannot give you a food answer while this is going on." It names the other product (G-48 names the maker once, in the footer), and this door gives no food answers at all. |
| `clinical-possible-hypoglycemia` | "…that needs your attention now, not a meal verdict." This door gives no meal verdicts. It also speaks of low blood sugar, near the door's clinical line (no product sentence about a reading). |
| `clinical-medication-dosing` | "Prediabetes Pal never advises on medicine or doses." It names the other product. |
| `clinical-eating-disorder` | "…you deserve real support, not a label on a plate." "Deserve" is on F-CALM-GDM's grading list, the door has no labels, and "a meal verdict is not what would help" speaks of something this door never gives. It carries a digit (988), where the door's own bank has none. |

The question for you: accept these four as they are on this door, or ask for
GDM-specific clinical rows (a Tier 1 follow-up, which would add rows to a later
batch).

---

## 5. Open questions from the task reviews

Each has a default the build took so it was not blocked. Say which to keep.

1. **Routes below the first four get no card on the list** (plan §8 item 8). On
   My questions only the four routes the PRD names raise a card. The `pregnancy`
   row is about A1C ranges and would fire on nearly every question here, so it
   is not shown; nothing is read behind the list. Please confirm that reading.
2. **Dates the product stamps.** A plan card shows "Entered on" and, once
   replaced or no longer standing, "Replaced on": her device's date at the
   moment she saved, not a figure she typed. The F-CALM walks carved these out
   of "no number she did not type". Please confirm the carve-out.
3. **ACOG's meal count in words** — see §3b.
4. **`eraseWarn` reused for account deletion.** The Delete my account confirm
   reuses the erase warning, which says the health data goes but never says the
   account itself goes.
5. **A "These differ" chip on a unit alone.** Two plans that differ only in how
   the clinic counts (for example grams against none given) are flagged, but the
   card with none given shows no counts row, so the chip there is unexplained.
6. **The occasion mid-sentence.** The parked question reads "Two entries in my
   plan differ for Bedtime snack. Which one stands?" — the occasion's heading
   dropped into the sentence as written.
7. **`summaryOffer`, "Your summary is ready to print."** Home shows it the day
   before and on the day of her appointment, and now only when the summary has
   something to print (final review F8). Please confirm "ready" is a word you
   accept here.
8. **The Breakfast default, and an occasion that cannot be changed.** The
   occasion select on My meals starts on Breakfast and keeps the last choice (a
   blank first option would need a new string). A meal's occasion cannot be
   changed in Tier 1, only deleted and added again.
9. **Two rows' Notes.** `gdm-summary-headings`' Notes do not say that `empty`
   also shows under a single empty section in a summary that has other
   content; `gdm-nav`'s Notes do not name its reuse as the summary's
   empty-state links.
10. **"Nothing to print yet."** In a summary with some content, an empty
    section shows "Nothing to print yet. Your plan, meals and questions appear
    here as you add them." It is now kept off the printed page (final review
    F9, no new string); its heading still prints. The words themselves are
    yours to keep or redraft.
11. **"Delete an entry to add another" is untrue for plans at the cap.** A plan
    cannot be deleted, only replaced or marked as no longer standing, so at the
    per-list cap `gdm-list-full` tells her to do something she cannot do with a
    plan. Reachable only at the cap; parked for your copy pass.
12. **Pending copy in public JavaScript (R44).** The bank's strings, the working
    name included, ship inside the site's public script files once the code is
    merged, even while every surface is closed; the flag stops them rendering,
    not being fetchable. This is an owner decision before the first merge; you
    should know the text is readable by anyone who reads the scripts before you
    sign it off.

---

## 6. What happens with your answers

You — not this document's author, and not any automated process — change a
row's `Status` in `docs/safety/copy-ledger.md` once you decide. No row in this
draft has been changed, and no code has been touched to reflect anticipated
answers. Once every row a surface renders is signed off (and the class in §3a
exists), the owner can list that surface in the production flag value. A
rewrite comes back to the build as a copy change against the same row, filed
`Pending` again.
