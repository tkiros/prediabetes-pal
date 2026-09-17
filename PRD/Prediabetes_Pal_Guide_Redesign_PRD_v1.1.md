# Prediabetes Pal — Guide Redesign PRD v1.1

**Date:** 2026-09-13 · **Status:** Draft for safety-owner review · **Author:** orchestrator session, from the 2026-09-11 prediabetes research; v1.1 from the 2026-09-13 `/office-hours` validation
**Supersedes** `PRD/Prediabetes_Pal_Guide_Redesign_PRD_v1.md` (2026-09-12). Extends `PRD/Glucosnap_prd_v2.md` (2026-07) for the prediabetes door only. Personas and market facts remain in `docs/ICP.md`, which this document references and does not rewrite.

### What changed in v1.1

Every code claim in v1.0 was checked against the repository at commit `76eab01` (design doc: `~/.gstack/projects/revora/tefera-main-design-20260913-122107.md`). Everything referenced resolves. Eight discrepancies and four session decisions are folded in below; nothing else moved.

| # | Change | Where |
|---|---|---|
| 1 | F-TREND collides with `tests/smoke/journey.spec.ts:58` (no `%` on `/journey`) and the written rule in `DESIGN.md` §9. The carve-out is a rail-and-test change with two options for the safety owner, not a design-doc edit | §6 F-TREND, §9 Step 1 |
| 2 | F-TREND did not cover a later out-of-range A1C; `app/api/profile/route.ts:98` refuses one with a 400. D3 is revived with three options | §6 F-TREND, §10 D3 |
| 3 | §7.1 had no row for the landing while §3 changes positioning. A `/` row is added and the owner chooses stale-until-branch or change-with-Tier-1 | §7.1, §10 D6 |
| 4 | F-CALM cited `DESIGN.md` §13 as a word list. §13 is design anti-patterns; banned words are the families in `tests/unit/pal/claims-boundary-copy.test.ts` | §6 F-CALM |
| 5 | "A guest's daily check quota" does not exist; guests are IP-metered, the four-per-day tier is signed-in only | §6 F-IDEAS |
| 6 | "Pass rule 3 of 5" was PRD-chosen and untagged. It is now the feasibility floor, tagged **[A]**; the number-versus-food count is the only branch; the script opens neutral | §0, §9 Step 0, §9.1, §9.2 |
| 7 | Rail 16 (`DESIGN.md` §1.3) requires every sentence to file under a claim class; F-NUMBERS may fit none. Asked of the safety owner now, in parallel with the concierge test, with an escalation | §6 F-NUMBERS, §8, §9 Step 1, §10 D7 |
| 8 | F-SOURCE promised "same read every time"; commit `822f44e` fixed a 38% label flip on 2026-08-16. The `/how-it-works` paragraph waits for a consistency eval; the idea-label cache is keyed on `PROMPT_VERSION` | §6 F-SOURCE, §6 F-IDEAS, §7.1 |
| — | F-ASK stays (owner ruling 2026-09-13); a provisional tour-completion floor is named | §7.5 |
| — | Build order after the test: the "ideas are chips" flagged prototype first, the rest of Tier 1 when its numbers earn it | §9 Step 1 |
| — | **Amended 2026-09-14 (owner).** The F-ASK floor is read from a per-screen tour funnel event (`onboarding_step`, a closed enum of screen ids), not from completion over starts. The event ships with the prototype so the six-screen tour is measured first and the floor has a baseline. The fallback fires only when the drop sits on the two new screens. The earlier sentence "nothing new is instrumented for it" is withdrawn | §7.5, §9 Step 1, §9.1 |
| — | **Amended 2026-09-14 (review A-95).** Kill line 2 is read as **tapped**, not opened: `idea_tapped` sessions ÷ sessions in which an ideas block rendered (`ideas_shown`), per `surface`, < 25% after four weeks. The impression form cannot discriminate once the block also renders on `/check` | §9.2 |
| — | **Amended 2026-09-14 (review A-93).** The Home hero slot renders three ideas from 375px up and two below 375px; the §7.6 wireframe's "three ideas" is the 375-and-up case | §7.6 |

---

## 0. Summary

The product today is a **judge**: describe a meal, enter an A1C, receive a label. Two blind-coded studies of r/prediabetes and a four-audience validation say the people it is built for rarely ask for that. They ask, in order, what their number means, why their effort did not move it, where to start, why the clinician gave them nothing, and what they can eat. When they ask about food, they ask for **ideas** about four times more often than for a **ruling** on one plate.

This PRD redesigns the app as a **guide**: the same engine, the same labels, the same claims boundary, but a different front door. Food ideas lead and the plate check follows. The label shows where it came from. Two pages that already exist as public guides move inside the signed-in flow: what the A1C range means in general, and calm first steps for the diagnosis week. Tone is audited for alarm. The A1C the app already collects once becomes a dated list the user can add to. Three further features are specified but **gated** on decisions only the owner can take, because each one changes what the product is allowed to say.

Nothing ships before a one-week hand-answered test. That test has a floor (3 of 5 people send a second question, below which everything stops) and one branch (whether number questions or food questions lead). The floor proves a responsive human is worth returning to; only the branch says which door to build.

**What does not change:** the inference engine, the `Clear` / `Be careful` / `Hold off` labels, `docs/safety/claims-boundary.md`, the boundary copy in `lib/pal/boundary-copy.ts`, pricing, and the Phase 5 launch plan.

---

## 1. Document information

### 1.1 Purpose and scope

Specify the product changes that follow from `docs/handoff/2026-09-11-prediabetes-top5-pains-outcomes.md` (§0–§6d) and `docs/handoff/2026-09-11-four-audience-validation-report.md`. Scope is the prediabetes door only. Type 2, gestational and bariatric are out of scope until their own studies are run.

### 1.2 Intended audience

The owner (decisions in §10), the safety owner (copy governance in §8), and whoever plans Phase 5 and after.

### 1.3 Related documents

| Document | Role here |
|---|---|
| `docs/handoff/2026-09-11-prediabetes-top5-pains-outcomes.md` | The evidence. §3 scorecard, §5.1 pain→outcome, §5.4 ruling vs ideas, §6c feature ratings, §6d further candidates |
| `docs/handoff/2026-09-11-four-audience-validation-report.md` | Plan-artifact counts (§3.1), Decision 1 (§4), concierge protocol (§5) |
| `docs/ICP.md` | Personas, market, validation plan. Source of truth; unchanged |
| `docs/safety/claims-boundary.md` | Intended use, verdict semantics, allowed claim classes. Unchanged; every feature maps to a class |
| `docs/safety/copy-ledger.md` | Where every new user-facing string is approved |
| `DESIGN.md` | Rails, voice, banned list, progress-surface rule |
| `.planning/ROADMAP.md` | Phase 5 success criteria, which §9 metrics reuse |

### 1.4 Evidence grades

Grades follow the research reports: **[H]** counted by two blind coders or reproduced across rubrics · **[M]** one coder, or a resonance signal · **[L]** small n or indirect · **[A]** the author's judgement, not a count · **[W]** off-Reddit source. Regex counts on the 173-post corpus are marked **rough** and are not coder labels.

---

## 2. Why redesign: the research in one page

### 2.1 The five pains

163 clean r/prediabetes posts, 2026-08-22 to 09-11, two blind coders, κ 0.72. Shares are primary-label ranges; the any-code share counts a pain wherever it appears in a post.

| # | Pain | Primary share | Any-code share | What those posters say they want (§5.1) |
|---|---|---|---|---|
| 1 | The result betrayed my effort or self-image | 9.8–16.6% | 18.4–27.6% | an explanation 7/16 · one number moved 5/16 |
| 2 | Dread of where this is going | 3.7–4.3% | — | peace of mind 4/7 · an explanation 3/7 |
| 3 | Nobody gave me a plan; where do I start | 6.7–8.6% | 15.3–17.8% | one number moved 6/11 · a course of action 5/11 |
| 4 | The clinician or the system gave me nothing | 4.9–5.5% | 13.5% | the system to act 6/8 |
| 5 | I have a number and no way to read it | 12.9–16.6% | 27.6–32.5% | an explanation 21/27 |
| 7 | What am I allowed to eat | 8.0–11.7% | 16.6–19.0% | no outcome stated 8/19 · to eat without fear 5/19 |

A third of the frame is one super-category, *I cannot read my own result*, reproduced at 33–37% by four independently written rubrics **[H]**. Pain 4 may be an artefact of one large thread in the window (0 of 58 early posts, p = 0.027) **[L]**.

### 2.2 The wanted outcomes

An answer 30.1% · one number moved 15.3% · a course of action 7.4% · data I can believe 5.5% · to eat without fear 4.9% · not becoming diabetic **0.6%**. Single coder **[M]**; 55% of posts name no end state at all.

### 2.3 The finding that reshapes the front door

- **A ruling on a named plate is 1 of 60 posts** under a stricter independent rubric (Wilson 0.3–8.9%), and 4 of 240 across all four audiences. Ideas-for-what-to-eat is 4 of 60. The same shape appears pre-registered in gestational (3 : 1) and in the all-time top 25, which holds no plate question at all **[M]**.
- **13 of the 25 highest-engagement threads end with the community contradicting itself.** Ten of those are number or effort questions the product may not answer; three are food or start-here questions it may **[M]**.
- **Most users hold no plan for the product to read.** 2 of 11 newly diagnosed name any plan artifact; about 4% corpus-wide; 0 of 6 clinician instructions name a dietary pattern **[H]**. The engine takes a food description and an A1C value and nothing else.

### 2.4 What the product may and may not do about it

| Wanted | May the app help? | Why |
|---|---|---|
| What can I eat | Yes, fully | The engine's whole scope |
| Where do I start | Mostly | Orientation and non-clinical steps; no diet prescription without Decision 1 |
| Stop giving me mixed answers | Yes | The engine is deterministic with a reviewed sentence bank; show the source |
| Help me keep at it | Partly | Reminders and calm framing; the app cannot compel behaviour |
| The clinician gave me nothing | Partly | Preparation for the next visit, never a substitute |
| What does my number mean | Not directly | A clinical interpretation; the intended-use statement forbids it |
| Why did my effort not work | Not directly | Same |
| I am scared | A little | Tone, and a route to real help |

---

## 3. Positioning

**Today:** "Check a meal. Understand its balance in plain language." (`docs/product-marketing.md`)

**Proposed:** *"You were just told you have prediabetes. Here are meal ideas, calm first steps, and plain answers about what the words mean, in one place. Check any meal when you are unsure."*

The shift is from **judge to guide**. The check remains; it stops being the front door.

**Anchor language.** The research reports wrote "your plan". The product has no plan input and most users have no plan. Every surface anchors to **"Prediabetes Pal's meal-composition rules"** or "the documented rules", never "your plan", unless Decision 1 (§10) is taken the other way. Public copy calls the output a **label** or **read**, never a verdict or a safety finding (`claims-boundary.md`, Verdict Semantics).

**Do not lead with prevention.** 0.6% of the audience frames the goal that way. Copy says "your first week", "your meals", "your questions", never "prevent", "reverse", "control", "lower" or "manage".

---

## 4. Goals and non-goals

### 4.1 Goals

| # | Goal | Evidence it answers |
|---|---|---|
| G1 | A person arriving in the diagnosis week finds ideas and orientation before being asked to grade a plate | §2.3 ruling 1/60, ideas 4/60; four-audience report: "an orientation need in the diagnosis week" |
| G2 | Every label shows the rule it came from, so the app is a single steady source where the community contradicts itself | §2.3, 13/25 threads; 3 in scope |
| G3 | The words on the result and the A1C range are explained in general terms inside the app, without touching the user's own value | Pain 5 wants an explanation 21/27; #2 all-time post is this question |
| G4 | No surface reads as alarm | Pain 2, peace of mind 4/7; `DESIGN.md` §2, §9 |
| G5 | Every gated feature is specified well enough that the owner's decision is the only thing between it and a build | §10 |

### 4.2 Non-goals

- Interpreting the user's own A1C, glucose reading, or trend. Out of scope by the intended-use statement.
- Predicting an individual glucose response to a food. Same.
- Any diet prescription, meal plan presented as *theirs*, or caloric target. Decision 1 territory.
- Type 2, gestational, bariatric doors.
- A scanner, native mobile, or new billing. Phase 5 keeps these deferred.
- Community features. The community already resolves progress-witness threads on its own (UNMET 0 of 2).

---

## 5. Users

Personas are in `docs/ICP.md` §4 and are not restated. The one that this PRD designs for is the ICP's own one-liner: *a recently diagnosed prediabetic who was sent home with "eat better" and no plan*. The research adds three facts about that person: they post in the moment (55–59% time-bound), they most often want an answer rather than a number target, and when they ask about food they usually cannot say what they are trying to achieve (8 of 19 name no outcome).

---

## 6. Feature specifications

Ratings are from report §6c and §6d (five criteria, 0–5 each, out of 25, **[A]**). Tiering is by gate, not by score: Tier 1 needs no decision; Tier 2 needs one named decision each; Tier 3 needs a change to the intended-use statement.

### Tier 1 — build after the concierge test passes

#### F-IDEAS · Food ideas before food verdicts — rating 18

**Pain:** what am I allowed to eat, 8.0–11.7% primary, 16.6–19.0% any-code. **Wanted:** to eat without fear 5/19; a frame for the 8/19 who name no goal.

**What it does.** The signed-in Home and the check page lead with a short list of meal ideas for the current daypart ("five breakfasts that sit within Prediabetes Pal's rules"), drawn from a **bounded, reviewed idea bank**. The plate check is the second control on the same screen. Each idea can be sent to the check with one tap, so the label and its reason appear for an idea exactly as for a typed meal.

**Reuse.** The bank starts from content that already exists as public guides: `app/guides/what-to-eat-with-prediabetes`, `prediabetes-meal-plan`, `prediabetes-snacks`. Authoring is promotion and review, not invention. The bank follows the pattern in `lib/pal/coach-outputs.ts`: a fixed set of audited sentences, deterministic rotation, no free generation. That is what keeps ideas inside the boundary: a list a dietitian can review in one sitting.

**Must never say.** That an idea is safe *for the user*, that it will produce any reading, or that it is *their plan*. Claim classes: `result-qualitative-impact`, `result-adjustment`. Every idea line goes through the same copy audit as the coach banks (`tests/unit/pal/claims-boundary-copy.test.ts`).

**Surfaces.** `/home` (hero), `/check` (empty state and second control), `/onboarding` expectations step (says ideas come first).

**Copy governance.** New ledger rows in `docs/safety/copy-ledger.md` for the idea bank and the hero line; safety-owner sign-off per the `boundary-copy.ts` header rule.

**Acceptance.**
- Home renders ideas before the check control for signed-in and guest users.
- The bank is **positive only**: meal ideas, never foods to limit. The source guide's "what to limit" half is not promoted; F-ORIENT already forbids naming foods to avoid.
- The engine is A1C-banded (`prompt.ts`: multi-starch meals read `Be careful` below 6.3 and `Hold off` at 6.3 and above), so every idea must return `Clear` **at every band in 5.7–6.4, including the most conservative level**, and no idea may trigger the clarify route. Any idea that fails at any band is removed from the bank.
- Ideas rotate deterministically; no two consecutive loads show the same first idea.
- The copy audit passes over the bank.

**Open.** Daypart-aware or one bank? Start with the three dayparts `coach-outputs.ts` already distinguishes. Cache the label per (idea, band) at review time rather than spending a model call, and an IP-metered guest request, on every tap (guests have no daily quota; they are metered by the existing IP rate limit at `app/api/check/route.ts:176`, and the four-per-day free tier is signed-in only). **The cache is keyed on `PROMPT_VERSION`** (`lib/pal/prompt.ts:34`, currently `2026-08-16.1`): every prompt bump re-runs every idea at every band, diffs against the cached labels, and pulls any idea whose label moved. Commit `822f44e` moved a canonical label class on 2026-08-16; a cache that ignores the prompt version would have kept serving the old one.

**The bank sits outside the promise registry.** `lib/client/first-check-chips.ts` derives its chips from `promotedInputsFor("onboarding")`, guarded by the deploy-blocking fixture test in `tests/unit/pal/promise-registry.test.ts`. Ideas reuse that file's segment-steered-list pattern and the `pal.recheck` hand-off, not its registry chips, so the fixture contract is untouched.

#### F-SOURCE · One steady answer, with its source shown — rating 14

**Pain:** the sources contradict each other, 4.9–7.4% (flagged as not a shared construct); 13 of 25 big threads contradicted, 3 in scope. **Wanted:** an answer.

**What it does.** Nothing new in the engine, and almost nothing new on the card. `components/result-card.tsx` already renders the engine's reason field under the label. The change is a **lead-in that names the source**: *"Why this label: under Prediabetes Pal's rules this description reads as [generally balanced / leaning concentrated / too incomplete to read closely], because [reason]."* The three brackets are the three label meanings in `claims-boundary.md` (Verdict Semantics), so `Hold off` on a materially incomplete description is covered. The lead-in makes the determinism visible: the same meal gets the same read, and the read says where it came from.

**Must never say.** "Doctors agree", "the science says", or any external authority. It cites the product's own documented rules and nothing else. Claim class: `result-qualitative-impact`.

**Surfaces.** Result card on `/check`. The `/how-it-works` paragraph on "the same read every time" is **held** until a consistency eval covers the claim: the engine is model-backed, and commit `822f44e` (2026-08-16) fixed a 38% label flip on the canonical two-starch meal that had survived until then. The lead-in above says where the read comes from; it does not say the read never changes.

**Acceptance.** Same input twice yields the same label and the same source line **on the consistency-eval panel**; the panel is the evidence, not a sentence on a page. The line contains no numeric claim. The `/how-it-works` paragraph ships only after that eval is green across the panel and the sentence is a ledger row.

#### F-CALM · Calm tone throughout — rating 15

**Pain:** dread, 3.7–4.3% primary, INTENSITY 5 (fragile: one flag moves it); a rough fear regex fires on 11% of posts. **Wanted:** peace of mind 4/7.

**What it does.** An audit, not a build. `DESIGN.md` already sets the rails (§2 permission-first voice, §9 reassurance not gamification, §13 the banned *design patterns*). The banned *words* are the families in `tests/unit/pal/claims-boundary-copy.test.ts` and the verbs in §8.5 of this document. The audit walks every surface for alarm colour, imperative warnings, banned-family hits, and the §8.5 verbs with the product as subject, and fixes what it finds. Two additions: (a) `Hold off` never renders in a colour or icon that reads as danger; (b) the clinical route (`PalUserClinicalSchema`) copy is reviewed so that a very worried user is pointed to a clinician in one calm sentence.

**Must never say.** Anything that implies urgency about the user's health. Claim class: `disclaimer-footer`, `out-of-scope-routing`.

**Surfaces.** All. **Acceptance.** Audit checklist complete; no banned-list hit remains; the three labels pass a colour-blind and "does this look like a warning" review.

#### F-NUMBERS · "What these numbers mean, in general" — rating 17

**Pain:** I cannot read my number, 12.9–16.6% primary, 27.6–32.5% any-code, the largest in the frame. **Wanted:** an explanation 21/27. The second-highest post in the subreddit's history is this exact question.

**What it does.** Promotes `app/guides/a1c-5-7-to-6-4` ("A1C 5.7% to 6.4% — What the Prediabetes Range Means") into the signed-in shell as a **Learn** page, linked from the result footer and from onboarding's A1C step. It explains, in general terms: what A1C and fasting glucose measure, the published ranges, why the two tests can disagree, why one result is not a trend. **It never takes or displays the user's own value**, and it never says which side of a line the user is on.

**Reuse.** The guide already exists and is already scanned by the copy audit. The work is navigation, a pass for the boundary, and the sentence that sends the personal question to the clinician.

**Must never say.** "Your number is …", "you are …", any wording that places the user in a category. Note the engine already bands the A1C input in `boundary-copy.ts`, so a general range statement is consistent with what ships; the line not to cross is *applying* the band to the person in prose.

**Claim class: open, and a blocker.** v1.0 filed this under `out-of-scope-routing` and `prompt-scope`. Neither fits cleanly: the first covers the below-range and high-range routes, the second covers prompt and intake copy. Rail 16 (`DESIGN.md` §1.3) says a sentence that is neither approved nor banned is not permitted, and that creating a class is counsel's decision, not a copy decision. So the question "which class does a general A1C-education page file under?" goes to the safety owner **with this document, now, in parallel with the concierge test** (§10 D7), not after the branch is read. **Escalation:** if no class is named by the day the concierge branch is read, F-NUMBERS is deferred and the build proceeds with the food-branch items regardless of which branch won. The guide stays public and untouched either way.

**Surfaces.** New in-shell route (proposed `/learn/numbers`), a link **beside** the result footer (the footer string itself is byte-for-byte tested against the ledger and is not edited), `/onboarding` A1C step link.

**Acceptance.** Page contains no second-person statement about the user's value. Safety-owner sign-off recorded in the ledger. Copy audit passes.

#### F-ORIENT · "Your first week" as orientation, not a plan — rating 17

**Pain:** nobody gave me a plan, 6.7–8.6% primary, 15.3–17.8% any-code; top five on every ordering; both coders invented the category unprompted. **Wanted:** a course of action 5/11.

**What it does.** Seven small non-clinical steps, one per day, shown after onboarding and on Home until done: learn what the words on a result mean (links F-NUMBERS) · describe one meal and read the label · check the meal you are least sure about · try one idea from the bank · write down the questions you have for your clinician (plain text, no template until F-DOCTOR is decided) · book or ask about a dietitian appointment · look back at the week on `/journey`. Every step is something the app already supports or a phone call. **No step is a diet, a target, or a food ban.**

**Reuse.** `app/guides/prediabetes-now-what` ("Calm First Steps") is the content base; `lib/coach/next-action.ts` is the mechanism, extended from one action to a seven-day sequence.

**Must never say.** "Your plan", "follow this to …", or any outcome. The four-audience report's reading of this door is "an orientation need in the diagnosis week, not a per-meal ruling need"; this feature is that and no more. Claim class: `product-role`, `launch-informational`.

**Surfaces.** `/onboarding` (final step introduces it), `/home` (next-action line becomes the day's step), `/journey` ("Where you are").

**Free text.** The "write down your questions" step is a note kept **on the device only**, like the onboarding segment answer: nothing is sent to the server, nothing is sent to the model, and the note is never echoed back with any value the user typed inside a sentence the app wrote. Phase 4's privacy-minimal posture holds.

**Acceptance.** Seven steps ship as audited copy; each resolves to an existing route or an external action; the sequence can be dismissed; no step names a food to avoid; the note never leaves the device.

**Why this and not the starter plan in report §6b.** The starter-plan version scores 16 and requires Decision 1. The orientation version scores 17 and requires nothing. If Decision 1 is later taken toward supplying a default, the plan version (F-PLAN, Tier 2) layers on top of this one.

#### F-TREND · "Your A1C over time" — rating 16 (re-scored 2026-09-13; was 13, Tier 2)

**Pain:** effort betrayed, 9.8–16.6% primary, 18.4–27.6% any-code. **Wanted:** one number moved, 15.3% of the frame and 5 of 16 of this pain's posters. About 3 of 173 posts ask for tracking as such (rough), which is the wrong measure: people do not post feature requests. The outcome share is the demand signal, and half of the twelve most-upvoted posts ever are result reports.

**What it does.** The app already collects one A1C at intake and stores it encrypted (`a1c_ciphertext`, erasable from Account). F-TREND lets the user add further A1C results with dates and shows them on `/journey` as **dated points**: their own lab data, entered by them, displayed back to them. Nothing is computed from the points.

**Why it was gated, and why that was wrong.** The first draft cited the high-range boundary copy ("does not know your … glucose readings") against it. That line is about meter and CGM readings, which only F-DIARY would add; it does not touch A1C, which the product already takes. The draft also conflated tracking with the A1C *estimation* and "on track to reach X by day Y" projection that earlier audits specified and the coach pivot removed. Entered values are not an estimate. The owner's objection on 2026-09-13 was right: **the A1C is the user's own information from somewhere else, and showing it back to them interprets nothing.**

**A second reason to build it.** The engine's caution level depends on the A1C band, and today the intake value is never refreshed. A result from eight months ago is a stale anchor. Periodic re-entry keeps the band current, which is an engine-correctness benefit independent of the list.

**What stays out, and this is the whole constraint.**
- **No trend line, projection, target, or "on track" wording.** The intended-use statement forbids predicting a future laboratory result; the codebase already removed exactly that formula.
- **No band word, colour, or good/bad label on any point.** The app never tells a user "normal" or "diabetes" (out-of-scope routing); it does not start here. The below-range and high-range routes apply to the *engine's band*; the list shows the point without comment.
- **Not placed beside app-usage counts.** Lab values next to "checks this week" imply the app moved the number. The list gets its own section on `/journey`, with the user's optional note ("started walking after dinner") as the only context.
- **Additive rendering.** Points render in the neutral ink; a value that rose is drawn exactly like one that fell (`DESIGN.md` §9).
- **The title is "Your A1C over time",** not "progress", which would be the app's judgement.

**Must never say.** Any sentence about what the values mean, where they are heading, or what caused a change. Claim classes: `out-of-scope-routing`, `disclaimer-footer`.

**Surfaces.** `/journey` (new section), `/account` (add or edit entries, same erase control), `/onboarding` A1C step becomes the first entry.

**Copy governance.** The section's few strings are ledger rows.

**RV-3 carve-out: a rail-and-test change, not a design-doc edit.** `/journey`'s no-score rule exists so the app's *own* weekly recap can never read as decline; user-entered lab values are not the app's score. But the rule is enforced, not just written: `tests/smoke/journey.spec.ts:55-62` (`expectRv3Clean`) asserts that `/journey`'s `main` contains no `%` character, no band word (excellent / on track / building / getting started), and no `progress-bands`, `dash-bai`, or `bai-bar` test id. A dated A1C list trips only the first assertion; a listed value is not a band word or a score surface. `DESIGN.md` §9 also says "no percentages" in words. The safety owner chooses one of two:

- **(a)** amend `DESIGN.md` §9 with *user-entered lab values may appear as dated points with no label, colour, trend or projection*, and scope the `%` assertion to the recap section instead of `main`, so the rule survives and the list is exempt from it; or
- **(b)** render each entry as "A1C 5.9" with the unit named once in the section heading, so no `%` glyph appears and rail and test stay untouched. Whether a bare A1C value still counts as "a percentage" under §9 is the safety owner's call; if it does, (b) is not available and (a) is the only path.

Either way the change is named in the ledger as touching a rail and a smoke test.

**Out-of-range later entries.** The intake path refuses any A1C outside 5.7 to 6.4: `app/api/profile/route.ts:98-108` returns 400 with `BELOW_RANGE_MESSAGE` or `HIGH_RANGE_MESSAGE`. v1.0 said "the newest entry becomes the engine's band anchor" and had no answer for a user who adds 6.5 or 5.5 eight months in. That is an owner decision (§10 D3, revived) with three options, each with its UI:

| Option | What the user sees | Cost |
|---|---|---|
| **Refuse** | The 400 stands. The list can never hold an out-of-range point. One calm sentence says the app records values in its range only and points to the clinician | Nothing new; the boundary copy already exists |
| **Store without anchoring** | The point renders like any other. The band anchor stays on the most recent *in-range* entry, and one sentence beside the list says so | One sentence (ledger row) and an anchor rule in the profile path |
| **Anchor and route** | The point renders, the anchor moves, and every check shows the existing below-range or high-range route until a new in-range entry arrives. `lib/pal/a1c.ts:40` already returns `out_of_scope_below` / `out_of_scope_high` with distinct messages | Nearly free; the routes exist |

No recommendation is made here. The list shows the point without comment under every option; what differs is what the engine does with it.

**Acceptance.** Entries stored under the same encryption and erase path as the intake A1C; never sent to the model; the anchor rule matches the D3 choice and the user is told it in one sentence; no trend line; no colour; no band word; no sentence on the section makes a numeric or directional claim; `expectRv3Clean` passes under whichever of (a) or (b) was chosen.

### Tier 2 — specified, gated on one decision each

#### F-PLAN · A starter plan the app supplies — rating 16 · **Gate: Decision 1**

**What it would do.** The orientation week gains a default meal pattern presented as a starting point. **Why gated.** 2 of 11 newly diagnosed hold any plan; the app would be supplying the reference and calling it a plan, which the four-audience report names as "a materially different product posture" that removes the "we never invent the rule" line. The owner has to choose that on purpose. **If taken:** the pattern is authored as a reviewed bank, labelled as Prediabetes Pal's default and never as *theirs*, and every line passes the copy audit. **If not taken:** F-ORIENT stands alone and this feature is closed.

#### F-DOCTOR · "Questions for my doctor" — rating 12 · **Gate: new ledger rows and a wording review**

**Pain:** I cannot read my number; the clinician gave me nothing (system to act 6/8). **Demand:** indirect. 2 of 173 posts mention asking their clinician, both about test ordering, none about visit preparation (rough). The 107- and 48-comment threads on what the clinician offered are the support.

**What it would do.** The user types what they want to ask, in their words ("My A1C is 5.9 and I've been walking daily"). The app returns a short list of **questions**, not answers: "Ask which test was used and why", "Ask what result would change the advice", "Ask whether a dietitian referral is available". The list is assembled from a reviewed question bank by **on-device keyword match** on which topics the user mentioned (test names, exercise, food, family history), **not a model call**: the text, and any value in it, never leaves the device, is never stored server-side, and is never echoed back inside a sentence the app wrote. The app never interprets the value the user typed.

**Must never say.** Anything about what the user's number means, whether it is good, or what the clinician will say. Claim class: `out-of-scope-routing`, `clarification-route`. **Why gated.** Every question line is new user-facing copy near the clinical line; the safety owner reviews the bank before it exists on any surface. **Surfaces if taken.** `/learn/doctor`, linked from the orientation step and the clinical route.

#### F-REFER · "Get me a real plan" pointer — rating 16 · **Gate: none, optional**

One static section on the orientation page: how to ask for a dietitian referral, what a diabetes-education programme is, and a plain script for the request. Demand is low (dietitian 4 of 173, referral 2, programme 0, rough), the cost is one page of reviewed copy, and it is the one thing on this list that answers "the system to act". Ship it with F-ORIENT if the safety owner clears the copy in the same pass; otherwise defer.

#### F-HABIT · Gentle reminders — rating 14 · **Gate: none, later**

A daily reminder to check one meal or read one idea, opt-in, no streaks, no scores. `DESIGN.md` §9 rules out gamification; `/journey` already shows the week. Defer until Phase 5 measures whether anyone returns without it.

### Tier 3 — requires changing the intended-use statement

#### F-DIARY · Food-and-reading diary, "which of my foods move my number" — rating 15 · **Gate: claims boundary**

**Pain:** effort betrayed, 18.4–27.6% any-code; the biggest reachable-looking pain. **Demand:** off-Reddit, personal causality is the job people hire tools for, roughly one in six reviews **[W][M]**; a meter or CGM is mentioned in 30 of 173 posts and post-meal-reading language in 46 of 173 (rough; "spike" inflates it).

**What it would do.** The user records a meal and a reading; the app shows them side by side over time. **Why it is Tier 3.** Pairing a food with a reading and letting a pattern show *is* an individual glucose response, and the intended-use statement says the product "do[es] not predict an individual glucose response". No wording review fixes that; the statement itself would change, and with it the product's regulatory posture. This PRD records the feature so the option is visible and specified, and recommends nothing. If the owner ever opens that door, the four-audience report's own warning applies: readings from the same meal vary 110–145 for the same person, and a product that shows that variance has to explain it without interpreting it.

---

## 7. Information architecture

### 7.1 Before and after

| Surface | Today | Proposed |
|---|---|---|
| `/` (landing) | "Check a meal. Understand its balance in plain language." (`docs/product-marketing.md:57`; `app/page.tsx`) | **Owner decision, §10 D6.** Either the landing stays deliberately stale until the concierge branch is known and changes with Tier 1 in one pass, or the §3 line replaces the hero in the same change as F-IDEAS. v1.0 changed the positioning and left the landing off this table, so the door outside would have contradicted the door inside |
| `/home` | Check hero · today's decisions · one next action · plan box | **Ideas for this daypart** · check control · today's decisions · **the day's orientation step** · plan box |
| `/check` | Input, first-run chips, result card | Unchanged input; empty state shows ideas; result card gains the **source line** |
| `/onboarding` | welcome · segment · attribution · a1c · expectations · boundary | Same steps; expectations says ideas come first; a1c step links **Learn: numbers**; final step introduces **your first week** |
| `/journey` | Where you are · what you learned · try this next · your week | "Where you are" shows orientation progress; gains the **Your A1C over time** section (F-TREND), separate from the week facts |
| `/meals` | History | Unchanged |
| `/how-it-works` | Recap methodology | Unchanged until the consistency eval is green (F-SOURCE); then adds the "same read every time" paragraph as a ledger row |
| `/guides/*` | Public SEO pages | Unchanged publicly; two are promoted into the shell as **Learn** pages |
| `/learn/numbers` | — | **New**, from the A1C guide |
| `/learn/first-week` | — | **New**, from the now-what guide; hosts F-ORIENT and F-REFER |
| `/learn/doctor` | — | Only if F-DOCTOR is gated in |

### 7.2 Navigation

The existing five-slot tab bar stays: Home · My meals · Check · My journey · Account (`DESIGN.md` §8; it flips to a sidebar at 1024px). **Ideas** and **Learn** live on Home's quick-action row (§7.6), not in the tab bar, so the bar does not grow to six. The order on Home is the point.

### 7.3 Copy rules that apply everywhere

- The label is a **read** or **label**. Never verdict, score, safe, risk in public copy.
- Anchor phrase: "Prediabetes Pal's rules". Never "your plan".
- Second person is for actions ("check", "try", "ask"), never for the user's clinical state.
- The footer disclaimer (`BOUNDARY_DISCLAIMER`) stays on every result and every Learn page.

### 7.4 Intake and Home: what changes, by tier

*Added 2026-09-13.* Today the tour runs welcome · segment · attribution · A1C · expectations · boundary and ends on a button that says **"Check my first meal"**; Home's hero asks **"What are you eating?"** Both are the judge posture, so both change at Tier 1. The size of the change grows by tier.

| Tier | Intake (the onboarding tour) | Home |
|---|---|---|
| **1** | No new questions. The "What to expect" step gains one line: ideas come first, the check is there when you are unsure (new ledger row; the existing general-guidance row stays). The final button becomes **"See today's ideas"** or **"Start your first week"**. The A1C step gets a link beside it to Learn: numbers. The last screen introduces the seven-day orientation. The skip link stays. Orientation progress needs one on-device key for guests (next to `pal.profile.v1` and `pal.segment.v1`) and one profile column for signed-in users. The existing "What brought you here?" answer, which already steers the first-check chips, steers the first ideas the same way. F-TREND turns the single A1C entry into the first row of a dated list, editable from Account. | Order changes, shape does not. An **ideas block** for the current daypart sits above the check hero; the hero stays and drops to second. The **one next-action line** becomes the orientation day's step (`lib/coach/next-action.ts` grows from three branches to a seven-day sequence). The "Day 1" status eyebrow already exists and becomes the orientation day. The **guest dashboard** is a separate component fed from local storage and needs the same ideas block. The Today section and the plan box are unchanged. F-TREND lives on `/journey`, not Home. |
| **2** | Only where a gate opens. F-PLAN (Decision 1) adds the screener the four-audience report suggested: *"Did your clinician give you a plan or a sheet?"* F-DOCTOR and F-REFER touch intake not at all. | Almost nothing. F-DOCTOR is a Learn page linked from the orientation step. |
| **3** | F-DIARY adds a new data type at intake with its own consent step. Phase 4's privacy-minimal posture is the blocker, not the screen. | A readings surface would be a new kind of Home content; not designed here. |

**Two rules from the codebase that this keeps.**
- **The check page stays the one place a check runs.** Home's hero is a hand-off that prefills the check through the `pal.recheck` session key. Tapping an idea uses the same hand-off, so no second check surface appears anywhere.
- **Home is one action for today; `/journey` owns the week** (the C7 four-jobs restructure). Add one ideas block and one step, not a stack of cards.

**One design rule this amends.** `DESIGN.md` §8 makes the check CTA "the first interactive element above the fold" at phone width. F-IDEAS puts ideas above it. The amendment ships with F-IDEAS: ideas render as quiet surface chips, the check stays **the one accent-filled action**, and §8's ordering sentence is rewritten in the same change. This is a design-doc edit, not an owner decision, and it is listed here so it is not done silently.

### 7.5 Intake questions on pains and wanted outcomes (F-ASK)

*Added 2026-09-13 at the owner's request.* An instrument, not a pain feature, so it is not scored on the §6 rubric.

**Proposal.** Two extra tour screens, both closed-enum, both skippable, placed after "What brought you here?" and before the A1C step.

- **Screen A: "What is hardest right now? Pick up to three."** Options are the research's own categories, in plain words: *Understanding what my number means* · *My effort is not showing in the number* · *I have no plan, I do not know where to start* · *My doctor did not give me much* · *I am worried about where this is going* · *Knowing what I can eat* · *Something else*.
- **Screen B: "What would count as a win for you? Pick one."** Options are the wanted outcomes: *A clear explanation* · *A number I can watch* · *A plan of steps* · *Food I can enjoy without worry* · *Peace of mind* · *Numbers I can trust* · *Not sure yet*.

**Why "pick up to three", not a ranked list.** A drag-to-rank control is heavy on a phone and breaks the one-question-per-screen rule. Three taps in order give the same signal. *Not sure yet* must be an option and will be common: 55% of the research frame named no end state.

**What the answers do.**
1. **They order the door per person**, the same branch the concierge test applies to the whole audience. Food first → the ideas hero leads. Number first → orientation step 1 is Learn: numbers and the hero copy says so. Plan first → the seven-day sequence sits at the top. Worried → the clinician pointer and the calm route sit higher.
2. **They feed Phase 5 measurement** as two closed-enum analytics events, exactly like the attribution answer today, the picks and the screen a tour start reached: never free text, never stored server-side for guests. The picks are kept on-device under a `pal.*` key; the screen reached is sent and not stored. This is the first real-user check on the Reddit ranking, and it costs nothing extra.
3. **They never produce a promise.** *A number I can watch* must not become "we'll help you lower it". The screen after Screen B says what the app does about the pick, in §2.4's own can/partly/not-directly wording, and routes the number and effort picks to Learn: numbers and the clinician.

**Privacy and claims.** Closed enumerations only. On-device storage like `pal.segment.v1`. Analytics as a closed enum like `storedUtmChannel`. Every option string and every response line is a ledger row (`product-role`, `out-of-scope-routing`).

**Cost and risk.** Low cost: two screens on an existing tour with a goal-gradient bar. The risk is tour length, six steps to eight; the skip link stays and the per-screen funnel is watched. If the two new screens are where starts leave, merge Screen A into "What brought you here?" rather than drop it.

**Owner ruling, 2026-09-13.** F-ASK stays in Tier 1. The validation session and an independent second opinion both argued it was premature for a product with zero users; the owner kept it as research instrumentation, which is what §7.5 says it is. **Provisional floor [A]:** if fewer than 70% of the first 50 tour starts after the two screens go live reach the attribution screen, the one after Screen B, Screen A merges into "What brought you here?" in the next change.

**Amended 2026-09-14 (owner).** The count is a per-screen funnel event, `onboarding_step`: a closed enum of screen ids, fired on each screen change, never on mount. The A1C screen and the out-of-range exit are deliberately absent from the enum, because reaching them says something about a person's result and §9.1 promises nothing here measures it. The event ships with the prototype (§9 Step 1), before the two screens exist, so the six-screen tour is measured first and the floor has a baseline: the share of starts that go from "What brought you here?" to the attribution screen, read before and after the screens land. The fallback fires only when the drop sits on Screen A or Screen B. A drop on the A1C screen is a separate finding and is not fixed by merging Screen A. The earlier sentence, "the count is the existing tour-step analytics; nothing new is instrumented for it", is withdrawn: completion over starts could not say which screen leaked, so the prescribed fix could have landed on the wrong screen, and it counted out-of-range exits as drop-offs.

**Acceptance.** Two screens, skippable, closed-enum, stored on-device; two closed-enum analytics events, the picks and the screen reached; Home order responds to the picks; no response copy names an outcome the product would be the agent of; all strings in the ledger.

### 7.6 Home layout: the reference, and what to take from it

*Added 2026-09-13.* The owner's reference is a banking super-app home: a greeting bar with the user's name, a dark hero card with a masked balance, a row of four round quick actions, a two-column grid of equal tiles, a floating "scan" pill, and a three-slot bottom bar. It is offered as an example of navigation and clarity, not as styling.

**Take the skeleton. Do not take the treatment.**

| Reference element | Verdict | In Prediabetes Pal |
|---|---|---|
| Greeting bar with name | Adopt | Already exists (the dashboard greeting and the "Day 1" eyebrow, which becomes the orientation day) |
| Hero card, dark, with a masked balance | Adopt the **slot**, not the card | **Today's ideas** on a light surface. **No number in the hero.** RV-3 and `DESIGN.md` §9 forbid a headline figure on a progress surface, and a masked "balance" is the exact thing not to build here: an A1C as the hero |
| Row of four round quick actions | Adopt | **Ideas · Check · Learn · Journey.** Check is the one accent-filled item (`DESIGN.md` §8) |
| Two-column grid of equal tiles on Home | Reject on Home; use under **Learn** | Eight equal tiles hide the order the research says matters. Home is one action for today. Tiles fit the Learn page: numbers · first week · questions for my doctor (if gated in) · how it works · my meals · saved meals · pantry review |
| Floating "scan" pill | Reject | The scanner is deferred until Phase 5 earns it |
| Purple header band and black card | Reject | Rail 14: no dark bands. One brand accent, `#0d5f57`. Risk colours are never decorative |
| Three-slot bottom bar | Keep the existing five-slot bar | Home · My meals · Check · My journey · Account; sidebar at 1024px |

**Phone-width wireframe, Tier 1.**

```
[brand]
Hello, [name] · Day 3 of your first week

┌───────────────────────────────────┐
│ Ideas for this evening            │   hero slot: three ideas,
│ • …        • …        • …         │   tap → check (pal.recheck)
│                        See all →  │
└───────────────────────────────────┘

 (Ideas)   (Check ●)   (Learn)   (Journey)      quick row; Check is the accent

 Today's step: write down the questions
 you have for your clinician  →                 one next-action line

┌ Today ────────────────────────────┐
│ your checks today                 │            unchanged
└───────────────────────────────────┘

[plan box, only when billing needs attention]

── Home · My meals · Check · My journey · Account ──
```

**Amended 2026-09-14 (review A-93, applied in Task 1.8's fold fix).** The hero slot holds **three ideas from 375px up and two below 375px**: `app/globals.css`'s `@media (max-width: 374px)` hides the third row so the block plus the check CTA still clear the fold at 360×667. The diagram's "hero slot: three ideas" is the 375-and-up case; `tests/smoke/dashboard.spec.ts` pins the visible row count at each width. Nothing else in the diagram changes.

**Why this is clearer than the tile grid for this audience.** The reference works for a bank because every tile is an equal, known errand. Here the research says the errands are not equal: ideas are asked for four times more often than a ruling, and the diagnosis-week need is orientation. A grid says "everything is here"; the wireframe says "start here".

---

## 8. Safety and copy governance

1. **Nothing in this PRD changes `claims-boundary.md`, with one open exception.** Tier 1 and Tier 2 map to existing claim classes (named per feature), except F-NUMBERS, whose class is an open question for the safety owner under Rail 16 (§6 F-NUMBERS, §10 D7). If no existing class fits, F-NUMBERS waits for counsel rather than this sentence being quietly broken. Tier 3 would change the intended-use statement and is recorded, not recommended.
2. **Every new user-facing string is a ledger row.** Idea bank, source line, orientation steps, Learn pages, doctor-question bank: each is entered in `docs/safety/copy-ledger.md`, approved by the safety owner, and covered by `claims-boundary-copy.test.ts`. The `boundary-copy.ts` header rule applies: a change in meaning needs a migration note.
3. **Bounded banks, never free generation**, for anything the user reads that is not the engine's own reason field. This is the pattern `coach-outputs.ts` already documents and the reason it is safe.
4. **The user's A1C value is never displayed with an interpretation** on any surface. F-NUMBERS explains ranges without the value; F-TREND shows values without ranges.
5. **The banned verbs stay banned** with the product as subject: prevent, reverse, control, lower, treat, manage, cure, diagnose. This PRD is scanned for them before filing.

---

## 9. Validation and sequencing

### Step 0 — the concierge test, before any build

From the four-audience report §5, prediabetes script: **five people diagnosed within 60 days**, moderator permission first, seven days, every food question answered **by hand** with a short list of ideas anchored to Prediabetes Pal's rules rather than a yes/no. The concierge will be supplying the reference in roughly 8 of 10 cases; the script says so and logs it.

**Preconditions, in order.** (1) Read the r/prediabetes rules page in a browser; it returns 403 to fetches and has not been read (four-audience report §5.3). (2) If the rules allow it, send the r/prediabetes and r/diabetes_t2 draft at four-audience report line 367, which §5.3 holds unsent pending the owner's go-ahead. (3) Wait for the mod reply. (4) Recruit five; allow up to two weeks. The seven days start at recruitment, not at sending. Three to four weeks end to end is the honest estimate.

**One addition to the script.** The concierge opens neutral: *"What would help most today?"* It does not lead with ideas. Food questions are answered with ideas as the script says; the opener must not bias the count below.

**Counts, fixed now:**
- how many send a second question unprompted within 48 hours (**feasibility floor: 3 of 5 [A]**, a line chosen here);
- how many produce any plan artifact, and how many of those name a pattern rather than a single-food ban;
- **number questions versus food questions** over the seven days. **This count is the only branch.**

**Why the floor is not the pass rule** (revised 2026-09-13 after an independent second opinion). Coming back with a second question proves a responsive human is worth returning to. It does not prove that meal ideas should be the app's front door; a 4-of-5 return driven by number questions would have passed v1.0's rule and greenlit an ideas-first build for people who wanted an explainer. So the floor stops the work, and the count chooses the door.

**The branch [A]** (thresholds chosen here; the four-audience report's 5 : 1 was a prediction, not a gate):
- fewer than 3 of 5 second questions: **stop and reassess**, whatever the count says;
- food questions ≥ number questions: F-IDEAS leads; build the Step 1 prototype;
- number questions more than 2 : 1 over food: the door's job is orientation; F-NUMBERS and F-ORIENT lead, F-IDEAS second, **unless D7's escalation has fired**, in which case the prototype ships and F-NUMBERS waits;
- number ahead but at or under 2 : 1, or a tie: build the prototype (cheaper, reversible) and keep D7 moving in parallel.

Five people make this a signal, not a proof. The branch is provisional and is revisited at the four-week kill line in §9.2.

### Step 1 — Tier 1 build

**In parallel with Step 0, not after it:** put D7 (which claim class F-NUMBERS files under) to the safety owner with this document, so counsel's clock and the concierge clock run together.

**First build under the food branch: the "ideas are chips" prototype, behind a flag.** The smallest version of F-IDEAS plus F-SOURCE's lead-in: a separate reviewed idea bank (`lib/pal/guide-ideas.ts`, static, three dayparts, drawn from the public guides, outside the promise registry); a small component rendering three idea chips above the hero on `components/dashboard-view.tsx` and `components/guest-dashboard.tsx`; each tap writes `pal.recheck` and goes to `/check`; the source lead-in on `components/result-card.tsx`; bounded analytics (door shown, idea tapped, check completed after idea, and the tour-screen funnel event that gives §7.5's floor its baseline; never meal text or A1C). One ledger batch. Effort: one new file, one component, one flag. It produces the ideas-viewed-to-checks-run ratio that §9.2's kill line needs from day one. The rest of Tier 1 ships when that ratio earns it.

Order after the prototype, food branch: F-CALM (audit, near-zero cost) → F-NUMBERS (if D7 is resolved) → F-ORIENT (+ F-REFER if cleared) → the full F-IDEAS bank and Home layout of §7.4 and §7.6. Number branch: F-NUMBERS (needs D7) → F-ORIENT → the prototype → F-CALM. F-TREND goes last in both branches: it touches the encrypted storage path, a smoke test, and a written rail, and needs D3 and the RV-3 (a)/(b) choice made first. F-SOURCE's `/how-it-works` paragraph waits for the consistency eval in every order.

### Step 2 — the owner's decisions (§10)

Taken after Tier 1 is live and Phase 5 measurement has started, not before.

### Step 3 — Tier 2 features whose gate was opened

### 9.1 What is measured

All measures are behavioural and reuse Phase 5's instruments (`.planning/ROADMAP.md`, Phase 5 success criteria). There is no baseline because there are no users yet (`docs/ICP.md` §1), so these are **gates and directions, not targets**.

| Measure | Why | Reads as success when |
|---|---|---|
| Ideas viewed : checks run, per session | Whether the new front door is used as a front door | Ideas are opened before the first check in most sessions |
| Idea → check taps | Whether ideas feed the engine rather than replace it | Non-zero and rising |
| Second-question rate within 48 h | The concierge feasibility floor, now in product | Comparable to the concierge result |
| Tour starts reaching the attribution screen, the one after Screen B (F-ASK; the `onboarding_step` funnel, amended 2026-09-14) | Whether eight screens are tolerated, and which screen loses people | At least 70% of the first 50 starts after the screens go live **[A]**, read against the six-screen baseline the same event collected before them; below that, and only when the drop sits on Screen A or B, Screen A merges into "What brought you here?" |
| Learn: numbers opened from the result footer | Whether the explanation pain reaches the page built for it | Opened by a meaningful share of first-week users |
| Orientation steps completed, days 1–7 | Whether the sequence is followed at all | Any completion beyond day 1 |
| Weekly query volume, organic shares, paid asks, WTP conversations | Phase 5's own criteria | Per Phase 5 |
| Support and feedback mentions of "confusing", "scary", "judged" | The tone audit's outcome | Absent |

Nothing here measures A1C, glucose, weight, or any health outcome, and nothing will.

### 9.2 Kill criteria

- Concierge: fewer than 3 of 5 second questions (the feasibility floor) → do not build Tier 1; return to the four-audience report's decision list. Passing the floor does not by itself greenlight anything; the number-versus-food count chooses the door (§9 Step 0).
- After launch: **Amended 2026-09-14 (review A-95).** Read as **tapped**, not opened — if `idea_tapped` sessions are fewer than a quarter of the sessions in which an ideas block rendered (`ideas_shown` is the denominator), computed per `surface`, after four weeks (**[A]**, a line chosen here without a baseline), the front door reverts to the check and this PRD is marked as tested and closed. The original impression form ("opened") is withdrawn: once the block also renders on `/check`, it reads ~100% of those sessions by construction and cannot tell a working door from a broken one. Measurement, sample floor and the owner's ruling step: `docs/ops/launch-controls.md` §13.1.

---

## 10. Decisions required from the owner

| # | Decision | Feature it gates | What each choice buys |
|---|---|---|---|
| D1 | **Decision 1** from the four-audience report: supply a default meal pattern and call it a starting plan, or keep "we never invent the rule" | F-PLAN | Yes: the orientation week gains a pattern, and the positioning line about never inventing a rule is removed. No: F-ORIENT stands alone |
| D2 | Approve a doctor-question bank near the clinical line | F-DOCTOR | Yes: the one feature aimed at "the system to act". No: the orientation step keeps a free-text note only |
| D3 | **Revived 2026-09-13 in a new form.** The v1.0 withdrawal was right about `HIGH_RANGE_MESSAGE` (it concerns meter readings, not A1C). It was wrong that no decision remained: `app/api/profile/route.ts:98` refuses any out-of-range A1C, so a later entry of 6.5 or 5.5 needs a rule. Choose **refuse**, **store without anchoring**, or **anchor and route** (table in §6 F-TREND). Separately, the safety owner chooses RV-3 option (a) or (b) | F-TREND | Refuse: nothing new, but the list can never hold the user's own out-of-range result. Store-without-anchoring: one sentence and an anchor rule. Anchor-and-route: nearly free, every check routes out of scope until a new in-range entry. **No recommendation is made** |
| D4 | Change the intended-use statement to permit showing food beside readings | F-DIARY | Yes: a different product with a different regulatory posture. No: closed. **No recommendation is made** |
| D5 | Run the concierge test now: read the subreddit rules, give the go-ahead on the §5.3 draft, add the neutral opener and the three counts | Everything in Tier 1 | The only decision this PRD asks for immediately, and the one that shrinks every risk in §11 at once |
| D6 | The landing: stays deliberately stale until the concierge branch is known and changes with Tier 1 in one pass, or takes the §3 line in the same change as the prototype | §7.1 `/` row | Stale: one door for the launch window, outside says judge while inside says guide. Change now: the ad and the app agree before the branch is known, and may both have to change again |
| D7 | Ask the safety owner which claim class F-NUMBERS files under; if none, whether counsel adds one. **Asked now, in parallel with D5.** Escalation: no class by the day the branch is read → F-NUMBERS deferred, the prototype ships regardless of branch | F-NUMBERS | A class: F-NUMBERS proceeds under §8.1 as written. No class: F-NUMBERS waits for counsel and the number branch gets F-ORIENT first |

---

## 11. Risks and honest limits

- **The winner answers a minority ask.** Food is the driver of about one post in ten. Leading with ideas is a better answer to that question; it does not move the product onto the majority pain, which is a clinical number it may not read.
- **"They want a menu, not a judge" rests on one count on this audience** (1 vs 4 of 60) plus three softer signals. The concierge test is the check on it.
- **Pain 4 may be a two-day burst**, not a base rate. Nothing in Tier 1 depends on it; F-DOCTOR and F-REFER do in part.
- **The ratings are the author's rubric, written after the evidence.** Under an alternate weighting calm tone ranks first; the top two hold under both.
- **Promotion is not free.** The three guides were written for search; a boundary pass for the signed-in context is real work, and the safety owner's queue is the bottleneck for every Tier 1 item.

### 11.1 Reducing each risk

| Risk | How to reduce it |
|---|---|
| The winner answers a minority ask | Do not market the app as the answer to the number question. Route that question honestly: F-NUMBERS in general terms, F-DOCTOR if gated in, the clinician always. Let the concierge test's number-versus-food count choose the door before anything is built. Keep the check one tap away so the minority who want a ruling still get one. |
| "A menu, not a judge" rests on one count | The concierge test is the direct check: five real people, seven days, hand-answered. Pre-register the ruling-versus-ideas split in every future corpus pass so it is a count, not a post-hoc cut. Log the in-product ideas-viewed to checks-run ratio from day one. If the owner wants a second count before building, one blind coder re-splitting the 163 existing posts on that single distinction is a small job. |
| Pain 4 may be a two-day burst | Keep Tier 1 free of it (already true). Before opening F-DOCTOR or F-REFER, re-count the clinician-failure share on a later twenty-day window; if it falls below 3%, both stay closed. Treat both as low-cost content whose value does not depend on the base rate. |
| The ratings are the author's rubric | Have one more person, the owner or the safety owner, score the same features on the same five criteria without seeing §6c, and compare. Let the concierge branch, not the rubric, set the build order; the rubric is a tiebreaker. Two weightings are already shown; if a third changes the top two, stop and re-read the evidence. |
| Promotion is not free; the safety owner is the bottleneck | Batch every Tier 1 string into one ledger review instead of five. Sequence the smallest copy sets first (source line, tone audit) so review and build overlap. Reuse already-audited guide sentences verbatim wherever possible. Let the engine do the first pass on the idea bank by labelling every idea at every band at review time, so the human reviews only the survivors. Agree a review turnaround before Step 1 starts. |

### 11.2 The same five risks, in plain English

*Added 2026-09-13 at the owner's request.*

**Risk 1: we are fixing a small problem really well.** Picture a school with 100 kids. About 10 of them ask "what can I eat?" About 33 ask "what does my number mean?" Our best feature, food ideas, helps the 10. It cannot help the 33, because only a clinician is allowed to explain someone's own number.
*How to shrink it:* do not advertise the app as the answer to the number question. Give the 33 an honest hand-off instead: a page that explains what the numbers mean in general, and a nudge to ask their clinician. Keep the plate check one tap away so the few who want a ruling still get one. Run the one-week test first; it counts number questions against food questions, so we find out which group actually shows up.

**Risk 2: our biggest idea rests on one piece of evidence.** "People want a menu, not a judge" is the headline. Only one count on this exact group backs it: 1 person asked for a ruling and 4 asked for ideas, out of 60. The other three clues point the same way but are softer. That is like deciding the whole class loves pizza because you asked one table.
*How to shrink it:* the one-week test is the direct check: five real people, seven days, answered by hand. Do they come back with a second question? Count "ideas viewed" against "plates checked" from day one in the app. If a second count is wanted before building, one blind coder re-sorting the 163 posts already collected is a small job.

**Risk 3: one pain might be a fluke.** "My doctor didn't help" showed up a lot, but only after one huge thread got everyone talking. Before that thread, zero posts said it. It might be a two-day fad, not an everyday pain.
*How to shrink it:* nothing in the first build depends on it. Before building the "questions for my doctor" feature, count again in a later month. If the pain drops under 3 in 100, leave that feature closed.

**Risk 4: the scoring rules were made up after the fact.** The five-part scorecard was invented after the evidence was in. A different scorecard puts "calm tone" first instead of "food ideas". The top two stay the same either way, but the exact order is one person's opinion.
*How to shrink it:* have one more person score the same features without seeing these scores, then compare. Let the one-week test decide the build order, not the scorecard. If any third way of scoring changes the top two, stop and re-read the evidence.

**Risk 5: "reuse what exists" still costs work.** Three of the new features are already written as web pages. Those pages were written to be found by search, not to sit inside the app. Every sentence still has to pass the safety review, and there is one safety reviewer. That person is the traffic jam.
*How to shrink it:* send all the new text to the reviewer in one batch instead of five. Start with the smallest pieces so review and building overlap. Copy already-approved sentences word for word where possible. Let the app do the first pass on the meal ideas by checking every idea at every A1C band, so the human reviews only the survivors. Agree a review turnaround before anyone starts.

**The one thing that shrinks all five at once** is the same: run the one-week hand-answered test before building anything. It is cheap, and it tests the biggest guess directly.

---

## 12. Appendix — feature ratings

From report §6c and §6d. Criteria: Size (any-code share, lower-bound FREQ band) · Hurt (SEVERITY, halved) · Fit (to the named outcome) · Shape (evidence for this shape) · Safe (inside the boundary without a decision). **[A]**. F-TREND re-scored 2026-09-13 (was 13, Tier 2); see the note in its spec.

| Feature | Size | Hurt | Fit | Shape | Safe | Total | Tier |
|---|---|---|---|---|---|---|---|
| F-IDEAS | 4 | 3 | 3 | 4 | 4 | 18 | 1 |
| F-NUMBERS | 4 | 3 | 3 | 4 | 3 | 17 | 1 |
| F-ORIENT | 4 | 4 | 3 | 2 | 4 | 17 | 1 |
| F-TREND | 4 | 4 | 3 | 1 | 4 | 16 | 1 |
| F-PLAN | 4 | 4 | 3 | 2 | 3 | 16 | 2 |
| F-REFER | 4 | 4 | 2 | 1 | 5 | 16 | 2 |
| F-CALM | 2 | 2 | 4 | 2 | 5 | 15 | 1 |
| F-DIARY | 4 | 4 | 3 | 3 | 1 | 15 | 3 |
| F-SOURCE | 2 | 2 | 3 | 2 | 5 | 14 | 1 |
| F-HABIT | 2 | 2 | 3 | 2 | 5 | 14 | 2 |
| F-DOCTOR | 4 | 3 | 2 | 1 | 2 | 12 | 2 |

---

*Filed uncommitted. Evidence pointers resolve to section numbers in the two handoff reports named in §1.3.*
