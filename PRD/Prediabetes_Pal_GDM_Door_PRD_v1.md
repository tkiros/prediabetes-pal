# Prediabetes Pal — GDM Door PRD v1

**Date:** 2026-09-19 · **Status:** Draft for owner review · **Author:** orchestrator session, from the 2026-09-12 gestational research
**Extends** `PRD/Prediabetes_Pal_Guide_Redesign_PRD_v1.1.md` to a second door. Changes nothing in it. `docs/ICP.md` stays the prediabetes source of truth and is not modified. Not committed; no existing file is modified; nothing was sent to anyone.

**Owner direction, 2026-09-19:** every pain gets a **general, non-clinical answer**. No feature may touch the medical boundary. This PRD is built on that line: where a pain is clinical, the product organises, parks, cites and stays calm. It never rules.

---

## 0. Summary

The research names an audience: gestational diabetes (GDM) in the current pregnancy, currently pregnant, eating to a plan. It is **34 of 146** recent r/GestationalDiabetes posts (23.3%, Wilson 17.2–30.8%) **[H]**. It names **twelve pains** once both pre-registered denominators and the four structurally deleted rows are counted (§2.2). Only a minority are about food. The top of the ranking is about being left alone, readings that will not behave, and decisions that belong to a clinician.

This PRD **accounts for** all twelve. Each row of the traceability table (§6.1) states what the person says now, what they want, what is in the way, and what the product does about it. Three stances are used:

- **GENERAL** — a general, non-clinical answer: keep the person's own plan in one place, park the question for the appointment, give structure for the waiting weeks, stay calm. No product sentence about a reading, a dose, a delivery decision, the pregnancy or the baby.
- **SERVE** — food-side content from the product (ideas, a qualitative read). Every SERVE feature is **Tier 2**, for the reason in the next paragraph.
- **NOT THIS AUDIENCE** — the posts behind the row screen out of the audience; the door says who it is for and routes the rest to their care team.

**The first gate is in the repository, not in the research.** Today the engine refuses any input that mentions pregnancy, on purpose. `lib/pal/clinical-risk.ts` carries a `pregnancy` route, a text-pattern match over what the user types, that fires on "pregnant", "gestational" and "gdm" and returns the approved ledger row `clinical-pregnancy` with no model call **[S]**. The route is evidence of intent; the lock is the intended-use statement in `docs/safety/claims-boundary.md`, which covers "adults using an A1C in the prediabetes range" and nobody else **[S]**, and an engine that reads against an A1C band a GDM user does not have. So a GDM door splits cleanly in two:

- **Tier 1 — general tools that never put food content or a label in front of a pregnant user.** Waiting mode, question parking, the person's own plan kept in their clinician's words, their own meal list, a one-page appointment summary, tone rules. The pregnancy route stays exactly as it is. Tier 1 still needs one thing from the safety owner: a claim class for the door's own copy (D5).
- **Tier 2 — anything food-facing.** It needs intended use extended, the pregnancy route scoped for a GDM profile, and a reviewer with pregnancy competence (D4). That is a change to the boundary documents, so this PRD specifies it and does not make it.

Nothing is built before a **two-week hand-answered test** with people in the referral gap (§9). It has a floor (3 of 5 send a second question **[A]**) and one branch: food-and-structure questions against number, dose and delivery questions. A number-heavy result is a **stop**, not a different door, because the second bucket is the one the product may never answer.

**What does not change:** the inference engine, the `Clear` / `Be careful` / `Hold off` labels, `docs/safety/claims-boundary.md`, `lib/pal/boundary-copy.ts`, the word families in `tests/unit/pal/claims-boundary-copy.test.ts`, `DESIGN.md`, `docs/ICP.md`, the `pregnancy` clinical route, pricing, and the prediabetes door.

---

## 1. Document information

### 1.1 Purpose and scope

Specify the product response to `docs/handoff/2026-09-12-gestational-top5-pains-outcomes.md`. Scope is the GDM door only. Prediabetes is governed by PRD v1.1. Type 2 and post-bariatric are out of scope. Postpartum is out of scope: criterion 2 of the research excluded it and it was never characterised (research §9.8).

### 1.2 Intended audience

The owner (decisions in §10), the safety owner (copy governance in §8, D4 and D5), and whoever plans the work after the concierge test.

### 1.3 Related documents

| Document | Role here |
|---|---|
| `docs/handoff/2026-09-12-gestational-top5-pains-outcomes.md` | The evidence. §3 scorecard, §4 quotes, §5 outcomes, §6 off-Reddit, §7 decisions, §8–§10 defects. **§12 is unaudited** (§1.5) |
| `PRD/Prediabetes_Pal_Guide_Redesign_PRD_v1.1.md` | House format, the concierge-test pattern (§9 Step 0), and three precedents reused here: F-DIARY/D4, F-DOCTOR/D2, F-NUMBERS/D7 |
| `docs/safety/claims-boundary.md` | Intended use, verdict semantics, claim classes. **Unchanged.** The GDM door fits none of its classes today (§2.5) |
| `docs/safety/copy-ledger.md` | Where every new user-facing string is approved. Holds `clinical-pregnancy` |
| `lib/pal/clinical-risk.ts` | The `pregnancy` route, and the four routes that outrank it |
| `lib/pal/boundary-copy.ts`, `DESIGN.md` | Boundary copy and rails. Unchanged |
| `docs/ICP.md` | Prediabetes personas. Unchanged, not extended |

### 1.4 Evidence grades

As in the research: **[H]** 3+ independent sources or structurally certain · **[M]** 2 sources or 1 strong source · **[L]** single source or inference · **[S]** repo file, or the preserved dataset read directly · **[W]** web source · **[A]** the author's judgement, not a count. Every claim below carries a grade and a research section. A threshold chosen in this PRD is always **[A]**.

### 1.5 Standing of the evidence — carried forward, not laundered

1. **n = 34 cannot order anything.** 126 of 136 row pairs, and 10 of 10 inside the top five, are not separable at 95% (research §3.1). **The top five is a set, not a sequence.** Nothing in this PRD depends on rank order.
2. **The two denominators give different top fives**, sharing only two rows (§3.2a). That is why this PRD covers twelve rows, not five.
3. **`REACHABLE` is orchestrator judgement [A]**, seventeen cells that nothing in the study measures (§8). It is printed beside each row for the owner to argue with.
4. **Every plate-ask count is a floor**: terse and image-only posts cannot enter the frame (§1.1b).
5. **The firmest pain is contingent.** Under the pre-registration's own overlap fraction, `NUMBERS_UNPREDICTABLE` becomes a single-coder row and drops out (§10.3). Its [H] is printed with that caveat.
6. **The coders may be less independent than κ suggests**: an undisclosed shared reviewer channel (§10.1).
7. **Unrepaired**: the strict-34 scorecard exists nowhere on disk; `1w5gqxe` sits in both the strict set and the contaminant set; the language gate never ran on the audited text (§10.3). No quote in this PRD comes from `1w5gqxe`.
8. **Not adversarially tested**: every PMID, every app figure, every handout quotation, four of five quote gates (§10). They are cited here at the research's grade and no higher.
9. **Research §12 is an advisory the critic never saw.** Its seven features are treated as candidates; §12 of this PRD records what happened to each.
10. **Withdrawn in the source and not relied on here:** that a list beats a ruling (§5.1(3)); that Malama pivoted away (§6.5); that 8 of 11 handouts carry no number (§6.1); that the insulin exclusion lands where distress is highest (§7).
11. **Dataset reads made for this PRD** (the quotes for rows 6–12 of §6.1, and the screen class of the posts behind rows 7–12) come from the preserved labels and corpus at `~/.gstack/projects/revora/validation-20260912-gdm/`. Every quote was string-matched against the post it is attributed to. These reads are **[S], one reader, unaudited**.

---

## 2. Why a GDM door: the research in one page

### 2.1 The audience

Diagnosed in this pregnancy, currently pregnant, eating to a plan. 34 of 146, hand-read in full **[H]** (§1.4). The research's fourth criterion, "no current insulin", is **owner Decision 2** and is not written into this PRD's audience (§10 D2): 15.8% are injecting and 18.5% carry any insulin signal, both in the pre-registered middle band (§1.5) **[M]**.

This audience is on a clock: a time-bound flag fires on 80.1–81.5% of posts (§2) **[M]**. It lasts months, replaces itself every year, and is found where pregnancy is discussed, not where diabetes is (§6.3) **[M]**.

### 2.2 The twelve pains

| Group | Rows | Why they are in scope |
|---|---|---|
| Strict-34 top five and the tie | `CARE_ABANDONED` · `NUMBERS_UNPREDICTABLE` · `DIET_BURDEN` · `RULES_UNCLEAR` · `DELIVERY_CONTROL` · `MEDICATION_ESCALATION` | §3 scorecard |
| Full-frame top five only | `DIAGNOSIS_VALIDITY` · `HARM_GUILT_FEAR` | §3.2(a): the other pre-registered denominator |
| Single-coder rows forced to PRIORITY 0 | `MONITORING_BURDEN` · `REGIMEN_LOGISTICS` · `FASTING_UNCONTROLLABLE` · `PROVIDER_CONFLICT` | §3.2(f): deleted from the ranking by a scoring choice, not ranked low. `FASTING_UNCONTROLLABLE` is 5 of 34 (14.7%) on the one coder that has it |

### 2.3 The wanted outcomes (§5, strict 34)

Tell me what happened to you 17.6–23.5% · tell me what to do 14.7–23.5% · give me a list of options 8.8–14.7% · rule on this one thing 5.9–11.8% — **all four are means-shaped, not end states**. End states: care that works 5.9% · the baby unharmed 5.9% · the birth they want 2.9% · to eat freely again 2.9–5.9% · numbers in range 2 posts (coder A) or 6 (coder B). Means-shaped asks are 70.6% and 52.9% of the frame by coder; end states 23.5% and 41.2% **[M]**.

Two facts shape the door:

- **The ruling shape is real, and mostly not about food.** Rulings are 13.0–14.4% of the full frame. Of the 17 posts both coders call a ruling, **3 are about a named food** **[M]**; about 7 of 17 are about food or eating at all **[L]** (§5.2). The rest are rulings on a number, a dose, a device or a delivery decision.
- **Rulings against lists is unresolved.** Three of four blind instruments put rulings ahead; one puts lists ahead (§5.1(3)) **[L]**. This PRD builds neither first on that evidence; the concierge test counts both (§9).

### 2.4 The obstacles between the current state and the wanted one

| Obstacle | Evidence |
|---|---|
| **The plan has not arrived.** 13 referred and waiting against 10 seen; of those who mention the clinical channel, 52–57% are waiting; 8 : 3 to 9 : 4 on the strict set | §6.2 · direction **[M]**, magnitude **[L]** |
| **The guideline gives structure and no quantity.** ACOG's patient FAQ: three meals and two to three snacks, zero carbohydrate-quantity language | §6.1 **[H]** |
| **Handouts disagree about the unit, four ways**: grams per occasion, a daily total split, carbohydrate choices, food-group servings. 3 of 14 hand the quantity back to a clinician not yet seen | §6.1 **[M]** |
| **The physiology moves.** Insulin sensitivity falls 60–65% by the third trimester; matched-carbohydrate meals differing in fat give different peaks | §6.4, PMID 42305028, 42597028 **[W][M]**, not adversarially tested |
| **The named hazard is under-eating.** 27.7% of 517 women had ketonuria; intake fell after diagnosis; therapy that *added* structure resolved it | §6.4, PMID 42654245 **[W][M]**, not adversarially tested |
| **Incumbents are liked.** A GDM tracker at 4.85★ on 570 ratings, none of whose low-star reviews mention missing guidance; Malama at 4.78★ on 215, maintained, doing AI meal analysis; the subreddit answered 21 of 25 depth threads, latency unknown | §6.5 **[M]**/**[L]**, §3.5 **[M]**, §9.4. iOS only |

### 2.5 What the repository says today

- **Any input that mentions pregnancy is refused, by design, and intended use excludes pregnancy.** The route is a pattern match on typed text, not a check on the person: a pregnant user who never says so gets a read today. The `pregnancy` route in `lib/pal/clinical-risk.ts` matches "pregn\*", "gestational", "gdm", "breastfeeding" and "trying to conceive" and returns `clinical-pregnancy`: fixed copy, no model call, no food instruction, class `out-of-scope-routing`. The ledger row is marked pending dietitian/CDCES sign-off (W-05) **[S]**.
- **Four routes outrank it and stay first**: `urgent_symptoms`, `possible_hypoglycemia`, `medication_dosing`, `eating_disorder` **[S]**. For this audience the last two matter most.
- **The engine reads a food description against an A1C band and nothing else** (PRD v1.1 §2.3). `app/api/profile/route.ts` refuses any A1C outside the prediabetes range through `routeA1C` **[S]**. A GDM user has no such A1C.
- **No claim class fits a GDM door.** `product-role`, `prompt-scope` and `launch-informational` all name the prediabetes range **[S]**. This is the same shape as v1.1's D7.
- **A bounded, reviewed idea bank already exists** as a pattern: `lib/pal/guide-ideas.ts`, with `tests/unit/pal/guide-ideas.test.ts` and `guide-ideas-labels.test.ts` **[S]**.

### 2.6 What the product may and may not do about it

| Wanted | May the door help? | How, in general terms |
|---|---|---|
| Something to hold on to while I wait | Yes, Tier 1 | Waiting mode, their own plan, their own meal list |
| Tell me the rule | Partly, Tier 1 | Keep their clinician's rule in their clinician's unit; show two conflicting instructions side by side; never pick one |
| A list of options · what can I eat | Yes, **Tier 2 only** | A reviewed idea bank, behind D4 |
| Rule on this one food | Yes, **Tier 2 only** | A qualitative read, behind D4 and D1 |
| Rule on this number, dose or delivery decision | **Never** | Park it as a question for the appointment |
| Why did the same meal read differently | **Never** for their reading | Park it, with their own note of what they ate |
| Tell me what happened to you | Not by this product | The subreddit does this at 84% answered (§3.5). Not built (§6.4 F-EXPERIENCES) |
| I am scared | A little | Tone, and the routes to real help that already exist |

---

## 3. Positioning

**Working line (not approved copy; needs D5):** *"Diagnosed with gestational diabetes and waiting for your dietitian? Keep your plan, your meals and your questions in one place, from today."*

The line is about **timing and organisation**, which is what the corpus shows (§7: "a meter, a target and nobody to ask for three weeks"). It is Tier-1-true: it promises nothing food-facing. If D4 opens Tier 2, "meal ideas" may join the line.

**Rules for every line on this door:**

- The product is never the agent of a health outcome. Its output is a **read**, a **label** or an **answer**.
- No sentence bears on the pregnancy or the baby, in either direction (§8 rule 1).
- Anchor to **"your care team's plan"** when the user has entered one, and to nothing when they have not. The product never supplies the number (D1).
- Do not lead with outcomes. Not "in range", not "healthy", not "on track". Lead with the waiting weeks and with meals.
- The door does not carry the name "Prediabetes Pal" to a pregnant reader without the owner deciding so (D7).

---

## 4. Goals and non-goals

### 4.1 Goals

| # | Goal | Evidence it answers |
|---|---|---|
| G1 | A person in the referral gap has structure, their own plan and a place for their questions on day one, without the product saying anything clinical | §6.2 waiting 13 : 10; Pain 1 |
| G2 | Every question the product may not answer has somewhere to go that is better than a refusal | §5.2: most rulings are not about food; owner direction 2026-09-19 |
| G3 | The person's clinician-issued rule is kept in the clinician's own unit, and conflicts are made visible, never resolved | §6.1 four units; Pain 4; `PROVIDER_CONFLICT` |
| G4 | Nothing on the door pushes toward eating less | §6.4, PMID 42654245 |
| G5 | No surface reads as alarm, blame or a grade | `HARM_GUILT_FEAR`, `MEDICATION_ESCALATION`; distress flags on 19.9–21.9% of the frame (§2) |
| G6 | Every food-facing feature is specified well enough that D4 is the only thing between it and a build | §10 |

### 4.2 Non-goals

- Interpreting a glucose reading, a trend, a dose, a scan or a delivery plan. Ever.
- Supplying a carbohydrate number, a calorie target or a meal plan presented as *theirs*.
- Showing food beside readings. That is v1.1's F-DIARY under D4 there: a change to the intended-use statement.
- A glucose tracker. The logging workflow is served at 4.85★ (§6.5).
- Community or shared experiences.
- Device, meter or CGM advice.
- Postpartum, and any hand-off into the prediabetes door (awareness evidence is weak, PMID 42651340 **[L]**).
- A second codebase (D3).

---

## 5. Users

One person: **diagnosed with GDM in this pregnancy, holding a meter and a target, with the dietitian appointment days or weeks away.** In her words: "I have three weeks of little guidelines!" [reddit.com/comments/1w6psxq, strictly eligible]. The research adds four facts. She posts on a clock (§2). She writes about food more than anything else, and calmly (§3.3, **[L]** after the routing caveat in §5.4). When she asks for a ruling it is usually not about food (§5.2). Medication may arrive partway through while she keeps eating to a plan (§7).

No personas are added to `docs/ICP.md`. No sizing exists: not one number in the research says how many such people there are or what they would pay (§9.1).

---

## 6. Traceability and feature specifications

### 6.1 The traceability table — one row per pain

Shares are primary-label ranges on the strict 34 unless marked. Quotes are verbatim, with post id and screen class. `Rch` is the research's `REACHABLE`, graded **[A]**; rows 7–12 were not scored in the printed table.

| # | Pain (share, grade) | Current state, in posters' words | Wanted outcome (§5) | Obstacle | Stance | Feature | Rch [A] | Success metric (behavioural) |
|---|---|---|---|---|---|---|---|---|
| 1 | **Nobody is looking after me** `CARE_ABANDONED` · 11.8–17.6%, any-code 20.6–32.4% · **[M]** §4 | "I have three weeks of little guidelines!" — `1w6psxq`, strict | Care that works (end state) · tell me what to do (means) | The plan has not arrived (§6.2) | **GENERAL** — structure and organisation for the gap; never a substitute for care | F-WAIT, F-ASKLIST, F-SUMMARY | 3 | Waiting mode opened in the first session; at least one question parked in week 1 |
| 2 | **The numbers won't comply** `NUMBERS_UNPREDICTABLE` · 8.8–20.6%, any-code 17.6–35.3% · **[H]**, contingent (§1.5 item 5) | "My numbers are suddenly much lower than usual!!!and I don't understand why." — `1w7yni8`, strict | Numbers in range (end state, coders split) · rule on this reading (means) | The physiology moves (§6.4); explaining a reading is interpreting a clinical number | **GENERAL** — park the question with her own note of the meal; no product sentence about the reading | F-ASKLIST; F-LEARN-GDM (Tier 2, D5) | 1 | Questions parked per active user; the number-versus-food split is read from the concierge test, where a human classifies |
| 3 | **Living inside the diet** `DIET_BURDEN` · 20.6–23.5%, any-code 44.1–52.9% · **[H]** presence, **[L]** calmness | "I need easy breakfast ideas to try." — `1w6jkut`, strict | A list of options · tell me what to do · to eat freely again | The `pregnancy` route refuses her today (§2.5); incumbents (§6.5) | **SERVE**, Tier 2 behind D4. Tier 1 gives the general form: her own list | F-MYMEALS (Tier 1); F-IDEAS-GDM, F-READ-GDM (Tier 2) | 5 | Tier 1: meals saved by day 7. Tier 2: idea-to-read taps |
| 4 | **Nobody will tell me the rule** `RULES_UNCLEAR` · 11.8–14.7%, any-code 20.6–32.4% · **[M]** | "My local diabetes in pregnancy unit says to avoid eating too much fat because it can make insulin resistance worse - I can't find any good evidence for this specific to GDM" — `1wazu06`, strict | Tell me what to do · rule on this one thing | Handouts disagree about the unit four ways; ACOG gives no quantity (§6.1) | **GENERAL** — keep her rule in her clinician's unit; show conflicts; never adjudicate | F-PLANKEEP, F-ASKLIST; F-IMPORT (Tier 2, D1) | 4 | A plan entered by day 3; conflicts recorded that become parked questions |
| 5 | **How this ends is not mine to decide** `DELIVERY_CONTROL` · 5.9% · **[M]** | "the doctor said numbers look great but it is still "their practice" to induce between 39 and 40 for GD." — `1w5pz74`, strict | The birth they want (end state) | A clinical decision; the product's output may not bear on the pregnancy | **GENERAL** — a place to write the question and bring it; zero product strings about delivery | F-ASKLIST, F-SUMMARY; F-STARTERS (Tier 2, D5) | 0 | Delivery-shaped inputs parked; copy audit finds no delivery language in any bank |
| 6 | **The drug is coming** `MEDICATION_ESCALATION` · 5.9%, any-code 11.8% · tied 5th · **[M]** | "Would you start the insulin at this point, or would you wait?" — `1wbv3fr`, strict, both coders | Rule on this one thing (means) | A dosing decision; the `medication_dosing` route already outranks everything here | **GENERAL** — the door never asks medication status and nothing it says depends on it (D2); park the question; no blame words | F-ASKLIST, F-CALM-GDM | 0 | The door has no medication field; copy audit finds no medication language |
| 7 | **Is this even real** `DIAGNOSIS_VALIDITY` · full-frame top five (§3.2a); PRIORITY 0 on the strict 34 | "Had my 1 hour glucose test today. The threshold per my doctors office is 136. My glucose was 148!" — `1wbx4ba`, **screened out: no GDM diagnosis** | Rule on this result (means) | **None of the 8 both-coder posts is strictly eligible**: 6 have no GDM diagnosis, 1 is not pregnant, 1 leaves management unstated; two are the known duplicate pair **[S]** | **NOT THIS AUDIENCE** — the door says who it is for; a pre-diagnosis visitor is pointed to her care team; no word about tests or cut-offs | Onboarding line (§7.2) | — | Exits at the "have you been told you have GDM?" step are counted, not chased |
| 8 | **What this is doing to the baby** `HARM_GUILT_FEAR` · 2.9–5.9%, any-code 29.4–35.3% · full-frame top five · ⛔ fails the merge gate on the strict set (overlap 0.00) | "I am just worried about all these spikes, and what they are doing to my baby." — `1wcaj1e`, **screened out: on insulin**; both coders | The baby unharmed (end state) | The one topic the product may not speak on in either direction | **GENERAL** — tone only; the existing urgent routes stay first; nothing is said about the baby | F-CALM-GDM | 0 | Feedback mentions of "scary", "judged", "guilt" absent; tone audit green |
| 9 | **The measuring is the problem** `MONITORING_BURDEN` · 12/146 = 8.2%, coder B only | "Have you guys skipped a day of tracking if you’re not feeling well?" — `1wcnokj`, **screened out: management unstated**; single coder | Rule on this one thing | **0 of 12 posts are strictly eligible** **[S]**; device and testing-schedule advice is clinical | **GENERAL** — park the question. Nothing else is built | F-ASKLIST | — | Monitoring questions counted in the concierge test; revisit only if they appear |
| 10 | **The machinery of managing it** `REGIMEN_LOGISTICS` · 10/146 = 6.8%, coder A only | "what can i do to exercise but not move too much?" — `1w5w2is`, strict; single coder. 1 of 10 strict **[S]** | Tell me what to do | Cost, insurance, supplies and appointments sit outside any food product | **GENERAL** — one page to bring, so the food log is written once | F-SUMMARY | — | Summary printed or shared at least once before an appointment |
| 11 | **The morning number that won't move** `FASTING_UNCONTROLLABLE` · 9/146 = 6.2%; **5/34 = 14.7% strict**, coder A only — the deleted row that matters (§3.2f) | "I’ve just been getting so frustrated at these numbers recently and wonder if I’m going to end up being put on nighttime insulin because of it." — `1wclkbp`, strict; single coder | Numbers in range (end state) | The thinnest line in this PRD: a snack list is food; a snack *that moves a fasting number* is an outcome claim | **GENERAL** for the number (park it). Food-side: a bedtime-snack occasion exists in her own list (Tier 1) and in the idea bank (Tier 2) **as an occasion, never as a remedy** | F-ASKLIST, F-MYMEALS; F-IDEAS-GDM (Tier 2) | — | Fasting questions parked; zero strings pairing a food with a fasting reading |
| 12 | **The clinician in the room is the problem** `PROVIDER_CONFLICT` · 6/146 = 4.1%, coder A only | "she just cut me off, again said I need more education, and she’s putting in a referral so they can decide if I need insulin." — `1wcshe9`, strict; single coder. 2 of 6 strict **[S]** | Care that works (end state) | Two clinicians disagreeing cannot be adjudicated by a food product (§4, Pain 4) | **GENERAL** — both instructions shown side by side in her plan; her questions on one page; never a word about the clinician | F-PLANKEEP, F-ASKLIST, F-SUMMARY | — | Conflicts recorded; summary used |

**The largest single want has no row of its own**: "tell me what happened to you" (17.6–23.5%). The product does not answer it. See F-EXPERIENCES, §6.4.

### 6.2 Tier 1 — general tools. Build after the concierge test passes and D5 is answered

Tier 1 puts **no product-authored food content and no label** in front of a pregnant user. The `pregnancy` route is untouched. Everything the user reads is either her own words or a line from a bounded, reviewed bank.

#### F-WAIT · Waiting-for-my-dietitian mode

**Rows:** 1. **Wanted:** tell me what to do; care that works.

**User stories.**
1. As a person diagnosed last week with an appointment three weeks out, I want one screen that says what I can get on with today, so that the waiting weeks are not empty.
2. As that person, I want the meal *structure* my professional body publishes, with its source, so that I am not piecing it together from a forum.
3. As that person, I want to tell the app my appointment date, so that it counts down to it and offers the summary the day before.
4. As that person, once I have seen the dietitian, I want the app to ask me to enter what I was given, so that my plan replaces the waiting screen.

**Behaviour.** A single screen with four parts: (a) ACOG's published structure, quoted and attributed — "Often, three meals and two to three snacks per day are recommended" (research §6.1, saved at `web:sheet_acog.txt`) — and **no quantity of any kind**; (b) a short checklist of organisational steps from a bounded bank (book the educator, ask about a cancellation list, start a food list, write questions down); (c) the appointment date, user-entered; (d) links into F-ASKLIST, F-PLANKEEP and F-MYMEALS. After the appointment date passes, one prompt: "Add what your care team gave you."

**Must never say.** Any carbohydrate, calorie or portion figure. Any food to limit (positive-only, as v1.1 F-IDEAS). That the structure is *her* plan. That following it leads to any reading or outcome. Anything about what waiting means for the pregnancy.

**Acceptance.** The structure line is verbatim and attributed. The bank contains no digits other than a date the user typed. The checklist is a fixed set of ledger rows. The mode ends on its own when a plan is entered.

**Open.** Quoting a professional body is an external authority, which v1.1 F-SOURCE forbids *for labels*. Here it sources a general statement, not a label. The safety owner rules on it under D5.

#### F-ASKLIST · Questions for my appointment

**Rows:** 1, 2, 4, 5, 6, 9, 11, 12. This is the general answer to every ruling the product may not give. It is v1.1's F-DOCTOR without the bank, and needs no near-clinical copy.

**User stories.**
1. As a person with a question about a reading, a dose or a date, I want somewhere to put it the moment I have it, so that I do not lose it before the appointment.
2. As that person, I want "add a question" within one tap of every screen on the door, so that parking it is easier than searching a forum.
3. As that person, I want to add my own note of what I ate or what happened, in my own words, so that the clinician sees the context.
4. As that person, I want to tick questions off after the visit and write the answer I was given, so that the answer lives next to my plan.

**Behaviour.** A plain free-text list, stored with the health-data consent the profile route already requires, reachable in one tap from every GDM-door screen. One fixed ledger line sits above it, naming the care team as the place these questions get answered. **The existing clinical routes run over the text as they do everywhere**: urgent symptoms, possible hypoglycaemia, medication dosing and eating-disorder language are answered by their own approved rows first.

**Deliberately not in Tier 1: a router that detects number-shaped questions.** Tier 1 has no engine box for it to intercept (`/check` is unreachable from this profile, §7.1), and the research's own saved regex nets caught 2 of 13 and 4 of 23 on this very corpus (§8). The router arrives with Tier 2, when F-READ-GDM gives people a box to type rulings into, and it ships with must-match probes that exercise **each branch**, not only the pattern — the research's own lesson (§8, the fourth `\b` variant).

**Must never say.** Anything about the content of the question. Not "that is common", not "that can happen late in pregnancy", not "worth asking" as a judgement on the reading. The fixed line names the care team; it says nothing else.

**Acceptance.** No model call on this path. The user's text is never echoed into analytics. The list works with nothing else on the door built.

#### F-PLANKEEP · My plan, in my clinician's words

**Rows:** 4, 12, and 1 once the appointment has happened.

**User stories.**
1. As a person handed a sheet, I want to type or photograph it and have it kept, so that it is in my pocket at every meal.
2. As a person whose sheet counts "choices" and whose friend's counts grams, I want mine shown in the unit my clinic used, so that the app does not add a fifth version.
3. As a person told two different things by two clinicians, I want both kept side by side and marked as different, so that I can ask which one stands.
4. As a person whose plan changes mid-pregnancy, I want to replace it and keep the old one dated, so that the record is honest.

**Behaviour.** A stored note with optional structured fields the user fills: occasions per day, the unit her clinic uses (grams · choices · servings · none given), and the figure per occasion **exactly as written for her**. A photo is stored as a photo. Two entries for the same occasion are flagged "these differ" with a one-tap "add to my questions".

**Must never say.** Whether the plan is typical, strict, generous or right. No unit conversion (that is F-IMPORT, Tier 2). No comparison of a meal against the plan (that is F-PLANREAD, Tier 2). No default when the field is empty.

**Acceptance.** Every figure on screen was typed by the user. An empty plan renders as empty. Plan contents are encrypted at rest as the A1C is, and never reach analytics.

#### F-MYMEALS · My own meal list

**Rows:** 3, 11. The general form of "give me a list of options": the list is hers.

**User stories.**
1. As a person who found a breakfast that suits her, I want to save it under "breakfast", so that I stop re-deciding every morning.
2. As that person, I want occasions that match the structure I was given, including a bedtime snack, so that the list fits my day.
3. As that person, I want to copy a day's meals into my appointment summary, so that the dietitian sees what I actually eat.

**Behaviour.** A user-authored list grouped by occasion. No label, no read, no score, no suggestion in Tier 1. If D4 opens Tier 2, a saved meal gains a "get a read" action.

**Must never say.** That a saved meal "worked", "fits", or did anything to a reading. The save button says "Save", not "This worked". The bedtime-snack occasion is a heading, not advice.

**Acceptance.** No product-authored food text on the surface. No readings field anywhere near it.

#### F-SUMMARY · One page for the appointment

**Rows:** 1, 5, 10, 12. **User story.** As a person with fifteen minutes in front of a clinician, I want my plan as I understand it, my usual meals and my open questions on one page, so that the time goes on answers.

**Behaviour.** A printable page built from F-PLANKEEP, F-MYMEALS and F-ASKLIST. Browser print; no PDF library. **No readings.** The tracker apps own that report (§6.5), and food beside readings is a Tier 3 line.

**Acceptance.** The page contains only user-entered text and fixed headings. It carries the reusable disclaimer's GDM-door equivalent once D5 supplies it.

#### F-CALM-GDM · Tone rules for the door

**Rows:** 6, 8, and every other row. An audit, not a surface.

**Rules, in addition to `DESIGN.md` and v1.1 F-CALM.** No grading words for a person or a day: good, bad, cheat, fail, slip, earn, deserve, behave. No blame grammar ("you went over"). No streaks, scores or badges. No countdown framed as pressure. Nothing that makes eating less read as success (G4). The strongest single line in the research's depth read is a commenter's: "GDM is not a contest to win! Insulin is not cheating!" [reddit.com/comments/1w5e5jc, commenter; research §7]. The product makes no such statement, in either direction; it simply never implies the opposite.

**Acceptance.** A word-family test over every GDM-door bank, in the pattern of `tests/unit/pal/claims-boundary-copy.test.ts`.

### 6.3 Tier 2 — specified, gated on one named decision each

All of Tier 2 is behind **D4**, because all of it puts product-authored food content in front of a pregnant user.

| Feature | What it does | Gate | Must never say |
|---|---|---|---|
| **F-IDEAS-GDM** · meal-list builder | "Five breakfasts", by occasion, from a **bounded, reviewed bank** in the `lib/pal/guide-ideas.ts` pattern. Positive-only. Cuisine-aware. The bedtime snack is an occasion like any other | D4, plus a reviewer with pregnancy competence | That an idea suits *her*, produces any reading, or is her plan. For row 11: **no sentence pairs a food with a fasting number** |
| **F-READ-GDM** · a qualitative read of one meal | The existing three labels and reason line for a described meal. **Too-light is handled as `result-adjustment` copy** ("this reads light; consider adding …"), which that class already allows at the food level, so **no fourth label** and no change to Verdict Semantics | D4 and D1 (which reference the read uses when there is no A1C band) | Anything numeric. That a meal is appropriate in pregnancy. That lighter is better |
| **F-PLANREAD** · a read against her own figure | "Heavier / lighter than your plan says" | D4 and D1. It is nutrition arithmetic against a clinician's number; `clarification-route` forbids nutrition-math demands and result copy must stay qualitative **[S]**. Needs a new claim class | — |
| **F-IMPORT** · handout importer | Extract structure and unit from a photographed sheet and show it back in one consistent form | D1. Converting between units is interpreting the plan. Tier 1 keeps the clinic's own unit instead | — |
| **F-STARTERS** · question starters | A short bank of neutral openers for F-ASKLIST ("What is the reason for this timing in my case?") | D5. Near the clinical line, as v1.1's F-DOCTOR under D2 there | Any starter that presumes an answer |
| **F-LEARN-GDM** · a general explainer | What the words on a handout mean in general; that units differ between clinics | D5. No claim class fits it today; same shape as v1.1's F-NUMBERS under D7 there | Anything about the user's own reading, and any sentence about pregnancy physiology that reads as applying to her |

### 6.4 Tier 3 and not built

| Candidate | Why it is not in Tier 1 or 2 |
|---|---|
| **F-JOURNAL** · food beside readings | This is v1.1's F-DIARY. It changes the intended-use statement and the regulatory posture (v1.1 §10 D4). Out of scope under the owner's direction. Recorded, not recommended |
| **F-EXPERIENCES** · what happened to others | The largest single want (§5.1(2)), and the one the subreddit already serves at 21 of 25 answered. Moderation plus medical claims in pregnancy is the highest-risk surface available. Not built. Whether the door may simply say that communities exist is left to the safety owner |
| **F-REMIND** · testing reminders | 0 of 12 monitoring posts are in the audience **[S]**, and a testing schedule is clinician-set. Not built; revisit only if the concierge test surfaces it |

---

## 7. Information architecture

### 7.1 The door

Same app, same codebase, a separate front door (D3). A GDM landing route and a GDM onboarding choice set a **profile flag**. The flag is passed into shared code as a setting; nothing is forked.

| Surface | Prediabetes door | GDM door, Tier 1 |
|---|---|---|
| Landing | unchanged | Its own route, its own line (§3), a sign-up. No food promise |
| Onboarding | A1C, tour | No A1C asked. "Have you been told you have gestational diabetes?" · appointment date (optional) · health-data consent |
| Home | ideas, check | Waiting mode, or My plan once entered; My meals; My questions |
| `/check` | the engine | **Not reachable from the GDM profile in Tier 1.** The `pregnancy` route remains the backstop if a pregnant user reaches it another way |
| Summary | — | Printable page |

### 7.2 Onboarding lines that carry a stance

- **Not diagnosed yet** (row 7): one fixed line that the door is built for people who have been told they have GDM, and that her care team is the place for questions about testing. Nothing about tests, thresholds or what a result means.
- **Medication is never asked** (row 6, D2). There is no field for it. A user who types a dosing question meets the existing `medication_dosing` route.

### 7.3 Copy rules that apply everywhere on this door

See §8. In short: no clinical sentence, no pregnancy or baby sentence, no number the user did not type, no grading words, nothing that rewards eating less.

### 7.4 Implementation decisions

- **One profile flag, not a fork.** The split triggers are in D3.
- **Pregnancy status is health data.** The flag and everything stored under it use the explicit-consent path `app/api/profile/route.ts` already enforces for A1C, and the same field encryption.
- **Two deep modules in Tier 1, each testable alone:** (1) the *plan record* — a small typed store for occasions, unit and figures with conflict detection as a pure function; (2) the *summary builder* — three lists in, one printable document out. **A third arrives with Tier 2:** the *question router* — text in, one of a closed set of routes out, non-generative, precedence-ordered, modelled on the clinical-risk router.
- **Bounded banks, never free generation**, for every product-authored string (v1.1 §8 rule 3).
- **Analytics are closed enums.** Events: door shown, waiting mode opened, plan entered, meal saved, question parked (a count, never text), summary printed. Never free text, plan contents, meal text or the profile flag joined to an identity outside the consent scope.
- **No new dependency** is needed for Tier 1.

---

## 8. Safety and copy governance

1. **Two strings are banned from every surface of this door and from this document's own prose: `safe` and `for your baby`**, in either direction. A product described as making food so, and one described as not doing so, are both sentences about a pregnancy outcome (research header). They appear in this document only here, as the definition of the rule.
2. **Output is a read, a label or an answer.** Never a finding about her, the pregnancy or the baby.
3. **Nothing in this PRD changes `claims-boundary.md`, `boundary-copy.ts`, `DESIGN.md` or the `pregnancy` route.** Tier 1 needs a claim class that does not exist yet (D5); until the safety owner supplies one, **no GDM-door string ships**, including the landing line. Tier 2 needs the route scoped and the intended-use statement extended (D4); that is recorded, not done.
4. **Under-eating is the named hazard** (§6.4). Every bank is positive-only. Nothing is framed as a reduction. In Tier 2, too-light is surfaced as clearly as too-heavy, through `result-adjustment`. The `eating_disorder` route keeps its precedence.
5. **No number the user did not type.** No carbohydrate figure, no target, no range, no default.
6. **Population studies are never product evidence.** The umbrella review and the ketonuria study inform this PRD; `claims-boundary.md` bans using them as evidence that the product does the same **[S]**. None of it reaches copy.
7. **Every new string is a ledger row**, approved by the safety owner, covered by the copy tests. The reviewer queue already holds the clinical routes pending sign-off (W-05); this door joins that queue rather than jumping it.
8. **The concierge is product output.** A hand-written answer to a pregnant person follows rules 1–6 exactly as a screen would, and the script is approved before anyone is recruited (§9).
9. **The banned verbs stay banned** with the product as subject: prevent, reverse, control, lower, treat, manage, cure, diagnose.

---

## 9. Validation and sequencing

### Step 0 — the concierge fortnight, before any build

From research §7 and §12.5, in the shape of v1.1 §9 Step 0. **Five people** diagnosed with GDM who are **referred and waiting** for a dietitian, educator or class. **Fourteen days.** Every question answered **by hand**.

**Preconditions, in order.** (1) Read the r/GestationalDiabetes rules in a browser; they have not been read. (2) Draft the recruitment message; **none exists** (research §9.9). (3) The safety owner approves the concierge script under §8 rule 8, including who answers: a food answer to a pregnant person should come from, or be reviewed by, someone with the competence D4 would require **[A]**. (4) The owner approves the message. **Nothing is sent without that.** (5) Moderator permission. (6) Recruit; the fourteen days start at recruitment.

**The script.** Opens neutral: *"What would help most today?"* Food and structure questions get a short list of ideas anchored to ACOG's structure and to the person's own sheet if she has one. **No figure is ever supplied by the concierge.** Number, dose, delivery and device questions get the F-ASKLIST treatment by hand: acknowledged, written down for her appointment, not answered.

**Counts, fixed now:**
- second unprompted question within 48 hours — **feasibility floor: 3 of 5 [A]**;
- **food-and-structure questions against number, dose, delivery and device questions — the only branch**;
- among food questions, rulings against lists (unresolved in §5.1(3));
- who holds a sheet at the start, and its unit: grams, choices, servings, none (informs D1);
- whether questions stop once the appointment happens (tests whether the door has a life beyond the gap);
- for each question, whether she also asked the subreddit and how long each took to answer — the latency the research could not obtain (§9.4).

**The branch [A]:**
- fewer than 3 of 5 second questions → **stop**;
- number-side questions more than 2 : 1 over food-side → **stop**. The door's only permitted answer to most of what is asked would be "bring it to your appointment", and that does not justify a door;
- number-side ahead at or under 2 : 1, or a tie → Tier 1 only; Tier 2 is not put to D4;
- food-side ahead → Tier 1, and D4 goes to the safety owner with the counts attached.

Five people make this a signal, not a proof.

### Step 1 — Tier 1 build

**In parallel with Step 0, not after it:** put D5 to the safety owner. Escalation as v1.1 D7: no class by the day the branch is read → nothing user-facing ships and the result is filed.

Order: F-ASKLIST (the general answer to eight rows, smallest copy set) → F-PLANKEEP → F-WAIT → F-MYMEALS → F-SUMMARY. F-CALM-GDM runs over each as it lands. A landing route with a sign-up may go first if D5 clears its line (research §12.6 "first step").

### Step 2 — the owner's decisions (§10). Step 3 — Tier 2 features whose gate opened

### 9.1 What is measured

Behavioural only. No baseline exists, so these are **gates and directions, not targets**.

| Measure | Why | Reads as success when |
|---|---|---|
| Second-question rate within 48 h | The concierge floor, now in product | Comparable to the concierge result |
| Questions parked per active user | Whether the general answer is used at all | Non-zero in week 1 for most users who open the list |
| Plans entered; unit chosen | Whether the plan arrives, and in what unit | Entered by most users within days of their appointment date |
| Meals saved by day 7 | Whether the own-list form of "options" is wanted | Non-zero and rising |
| Summaries printed before an appointment date | Whether the door serves the visit | Any |
| Time-to-answer against the subreddit (concierge only) | The competitive bar | Faster on food-side questions |
| Feedback mentions of "scary", "judged", "guilt", "confusing" | The tone audit's outcome | Absent |

**Nothing here measures glucose, weight, medication, delivery or any pregnancy outcome, and nothing will.** Retention is not a goal: this audience leaves by design within months (§6.3).

### 9.2 Kill criteria

- Concierge below the floor, or number-side more than 2 : 1 → no build; this PRD is marked tested and closed.
- D5 unanswered at the branch date → nothing ships.
- After launch **[A]**: if, after four weeks, fewer than a quarter of users who opened the questions list parked anything, F-ASKLIST is not working as the general answer and the door is re-read before anything else is added. The number-versus-food split is never read from product analytics in Tier 1; it comes from the concierge test, where a human classifies.

### 9.3 Testing decisions

Test external behaviour only: given this input, this route, this string, this document. Never implementation detail.

| Module | What is tested | Prior art |
|---|---|---|
| Questions list | Existing clinical routes still win over text typed into it; text never reaches analytics | `tests/unit/pal/clinical-risk.test.ts` |
| Question router (Tier 2) | Each route has a must-match probe **per branch** and a must-not-match probe; precedence under the existing clinical routes | same |
| GDM copy banks | The two banned strings, the grading-word family, medication words, delivery words, digits | `tests/unit/pal/claims-boundary-copy.test.ts`, `clinical-copy-no-treatment.test.ts` |
| Plan record | Conflict detection; an empty plan renders empty; no conversion anywhere | — |
| Summary builder | Output contains only user text and fixed headings; no readings field exists | — |
| Idea bank (Tier 2) | Every idea at every reference, as today | `tests/unit/pal/guide-ideas.test.ts`, `guide-ideas-labels.test.ts` |
| The `pregnancy` route | Still fires for every non-GDM-profile path | `clinical-risk.test.ts` |

---

## 10. Decisions required from the owner

Evidence is laid beside each. D1–D4 are not made here.

| # | Decision | Gates | For | Against |
|---|---|---|---|---|
| **D1** | **A plan-anchored read, and what happens when there is no number.** Options: (a) no read without the user's own figure; (b) a general reference the user confirms; (c) a qualitative GDM rule set with no figure at all. And the research's sharper question: *what does the product do between the meter arriving and the dietitian arriving?* | F-READ-GDM, F-PLANREAD, F-IMPORT | The plan genuinely exists for this audience. `DIET_BURDEN` is first by any-code presence (44.1–52.9%). Handouts do carry per-occasion figures in 7 of 14 found | It has usually not arrived (13 : 10). The units disagree four ways. A fixed figure meets a moving physiology (PMID 42305028). **The most conservative reference is not automatically the cautious one** — the hazard is under-eating (PMID 42654245). The handout counts are search-biased and settle nothing (§6.1) **[L]**. Tier 1 answers the sharper question without D1 |
| **D2** | **Does "no insulin" stay an inclusion rule?** Working assumption: **the door never asks and nothing it says depends on it.** Alternative: screen at onboarding | Audience definition, §7.2 | 15.8–18.5% at any moment, the pre-registered middle band, so the research declines to resolve it (§1.5). Medication arrives partway through and people keep eating to a plan; 13% of those on metformin still need insulin (PMID 42639277). Not asking needs no medication language at all | A screen is the cautious reading of "the product knows nothing about her medicine" (compare `clinical-diagnosed-diabetes`). The pre-registered insulin-versus-diet test was never run (§10.3). The claim that exclusion lands where distress is highest was refuted |
| **D3** | **Architecture.** Working assumption: a separate front door on the same app; the GDM profile is a setting, not a fork (research §12.6, unaudited) | §7 | One engine, one set of fixes, one set of fixed costs; demand is unproven | Split when: the profile needs core-engine changes, not settings · a store or counsel requires pregnancy content to be separate · the concierge test and the landing show demand that earns its own listing |
| **D4** | **The `pregnancy` route and the intended-use statement.** (a) Leave both; ship a Tier-1-only door. (b) Scope the route off for the GDM profile and extend intended use, with a pregnancy-competent reviewer. (c) No door | All of Tier 2 | (b): food is the one pain the product can fully answer (`Rch` 5 **[A]**); digital interventions in GDM have the strongest external support in the programme (PMID 42623941 **[W][M]**, untested) | (b) undoes a shipped, approved guard whose own comment says the engine's bands "are not the ones used in pregnancy" **[S]**; the reviewer queue is already pending (W-05); Malama already does this at 4.78★. **No recommendation is made** |
| **D5** | **Which claim class does GDM-door copy file under**, and if none, does counsel add one? **Asked now, in parallel with D6** | Every Tier 1 string, F-STARTERS, F-LEARN-GDM, the landing line | A class: Tier 1 proceeds under §8 | No class: nothing ships. Same shape and same escalation as v1.1 D7 |
| **D6** | **Run the concierge fortnight now**: read the subreddit rules, approve the script and the message, seek moderator permission | Everything | The only instrument in the programme that can tell a wanted answer from one wanted enough to act on (§10.4). Cheap. Shrinks every risk in §11 | It is the first time anyone in this programme speaks to a human; it needs the safety owner's time before it starts |
| **D7** | **The door's name.** "Prediabetes Pal" reads as the wrong condition to a pregnant person (research §12.6) | Landing, onboarding | A door name is copy, not a product rename | A second name near a regulated audience needs its own domain and store checks. The owner's call |

---

## 11. Risks and honest limits

- **The door's general answer may not be worth a door.** Eight of twelve rows resolve to "write it down and bring it". The concierge branch tests exactly this, and a number-heavy result stops the work.
- **The one pain the product can fully answer is behind a guard it shipped itself.** Tier 1 is deliberately thin. If D4 stays closed, the door is an organiser beside a 4.85★ tracker.
- **Nobody has been asked anything** (§9.9). No sizing, no willingness to pay, no Android data (§9.1, §9.7). Every claim is a count of what people said to each other.
- **Food is the most present topic and, as coded, the calmest** (§3.3, **[L]**). Calm topics are weak reasons to install something.
- **The subreddit answers five questions in six for free**, and its latency is unknown (§3.5, §9.4).
- **The evidence is provisional**: 34 posts; 11 claims refuted; the firmest row contingent on an unregistered choice; coder independence in doubt (§1.5).
- **The stakes are higher than in any other door.** A copy error here is a sentence to a pregnant person. The reviewer queue is the bottleneck and should be.
- **Short lifecycle.** Weeks of use per person. Acquisition has to repeat every year, and the research found this audience in pregnancy spaces, which were screened but never coded (§9.6).

### 11.1 Reducing each risk

| Risk | How to reduce it |
|---|---|
| The general answer is not worth a door | Let the branch decide. Build F-ASKLIST first; it is a plain list, and whether anyone parks anything is the cheapest live test |
| Tier 1 is thin | Do not market food. Position on the waiting weeks only. Put D4 to the safety owner only with concierge counts attached |
| Nobody has been asked | D6 |
| The community is free and good | Measure time-to-answer in the concierge test. If the subreddit is as fast, say so and stop |
| Provisional evidence | Depend on set membership, never rank. Re-run the ranking both ways on single-coder rows before any row is dropped from this table |
| Higher stakes | One batch of strings, one reviewer with pregnancy competence, bounded banks only, the banned-string test in CI |

### 11.2 The same risks, in plain English

**We may be building a notebook.** Most of what these women ask is for a clinician. The honest thing the app can do is help them carry the question to the appointment. The two-week test tells us whether that is worth having.

**The useful part is locked, and we locked it.** The app refuses pregnant users today, on purpose. Meal ideas for this audience need that lock opened by someone qualified. Until then the door organises; it does not advise.

**We have only read posts.** Thirty-four of them. Five real people for two weeks will teach more than another corpus.

**The one thing that shrinks all of these at once** is the same as in v1.1: run the hand-answered test before building anything.

---

## 12. Appendix

### 12.1 Research §12.4's seven candidates — what happened to each

| Candidate | Here | Why |
|---|---|---|
| 1. Meal in, a read against your plan, plus swaps | Split: F-READ-GDM and F-PLANREAD, Tier 2 | Food content to a pregnant user (D4); arithmetic against a clinician's figure (D1). Too-light handled through `result-adjustment`, no fourth label |
| 2. Plan importer | Split: F-PLANKEEP (Tier 1, her unit, her words) and F-IMPORT (Tier 2, conversion) | "One consistent form" means converting units, which is interpreting the plan |
| 3. "Waiting for my dietitian" mode | **Kept**, F-WAIT, Tier 1 | Structure with no quantity; the grocery list becomes her own F-MYMEALS |
| 4. Meal-list builder | F-IDEAS-GDM, Tier 2. **Added** F-MYMEALS as its Tier 1 general form | D4 |
| 5. Food and reading journal | **Cut** to Tier 3, F-JOURNAL | v1.1 already ruled on it as F-DIARY: an intended-use change |
| 6. Question prep | **Kept and promoted**, F-ASKLIST, first in the build order | The general answer to eight of twelve rows; needs no near-clinical copy |
| 7. Experiences from others | **Cut**, F-EXPERIENCES | Highest-risk surface; the want is already served for free |
| — | **Added:** F-SUMMARY, F-CALM-GDM, F-STARTERS, F-LEARN-GDM | Rows 1, 5, 6, 8, 10, 12 |

### 12.2 Done check

- [x] Twelve pains, each with a stance and a reason (§6.1)
- [x] Every feature traces to a row; every claim carries a grade and a section
- [x] The two banned strings appear only in §8 rule 1 and this line's reference to it; no feature interprets a reading, a dose or a delivery decision
- [x] D1–D3 open with evidence on both sides; D4 added from the repository and also left open
- [x] The concierge gate precedes all build work
- [x] Nothing committed; no existing file modified
