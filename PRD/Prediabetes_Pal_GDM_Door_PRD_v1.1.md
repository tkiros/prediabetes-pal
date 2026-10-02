# Prediabetes Pal — GDM Door PRD v1.1

**Date:** 2026-09-19 · **Status:** Owner decisions D1–D7 taken 2026-09-19 · draft for safety-owner review · **Author:** orchestrator session, from the 2026-09-12 gestational research
**Supersedes** `PRD/Prediabetes_Pal_GDM_Door_PRD_v1.md` (same day, left untouched). Extends `PRD/Prediabetes_Pal_Guide_Redesign_PRD_v1.1.md` to a second door and changes nothing in it. `docs/ICP.md` stays the prediabetes source of truth and is not modified. Not committed; no existing file is modified; nothing was sent to anyone.

**Owner direction, 2026-09-19 (first):** every pain gets a **general, non-clinical answer**; no feature may touch the medical boundary.
**Owner decisions, 2026-09-19 (later the same day):** D4(b) opens food features to GDM users. That moves the **scope boundary** — who the product is for — and supersedes the first direction to that extent. **The clinical line does not move**: no product sentence about a reading, a dose, a delivery decision, the pregnancy or the baby. Where a pain is clinical, the product still organises, parks, cites and stays calm. It never rules.

### What changed in v1.1

| # | Owner's ruling | Where it landed |
|---|---|---|
| D1 | **(a)** No read without the user's own figure | §0, §2.6, §6.1 rows 2–4, §6.3 F-PLANREAD. F-READ-GDM is closed. F-IMPORT is no longer needed |
| D2 | **Never ask about medication.** Revisit if food reads open | §7.2, §10. **D4(b) opens food reads, so the revisit fires now**: it is S4, inside the safety owner's D4 review |
| D3 | **Same app, separate front door** | §7, §10. Split triggers stay |
| D4 | **(b)** Open the food features: meal ideas and meal reads | Header, §0, §2.6, §6.3, §7.1, §8 rule 3, §9, §10 S1–S3. Decided by the owner; **pending the safety owner's sign-off**. "No recommendation is made" is withdrawn |
| D5 | **Ask today**, proposing narrow wording | §8.1: three draft class rows, ready to paste. The chosen wording says "no food guidance", so it covers Tier 1 only; D4(b) adds two more asks |
| D6 | **Skip the two-week test and build** | §0, §8 (the concierge rule is removed), §9 rewritten, §11. Taken against v1's recommendation; recorded here once |
| D7 | **Plain working name; spend nothing** | §3, §10. The ruling's trigger was cut off mid-word and named the test D6 removed; it is re-anchored to the four-week Tier 1 line **[A]** |

---

## 0. Summary

The research names an audience: gestational diabetes (GDM) in the current pregnancy, currently pregnant, eating to a plan. It is **34 of 146** recent r/GestationalDiabetes posts (23.3%, Wilson 17.2–30.8%) **[H]**. It names **twelve pains** once both pre-registered denominators and the four structurally deleted rows are counted (§2.2). Only a minority are about food. The top of the ranking is about being left alone, readings that will not behave, and decisions that belong to a clinician.

This PRD **accounts for** all twelve. Each row of the traceability table (§6.1) states what the person says now, what they want, what is in the way, and what the product does about it. Three stances are used:

- **GENERAL** — a general, non-clinical answer: keep the person's own plan in one place, park the question for the appointment, give structure for the waiting weeks, stay calm. No product sentence about a reading, a dose, a delivery decision, the pregnancy or the baby.
- **SERVE** — food-side content from the product: meal ideas, and a read of a meal against her own plan. Every SERVE feature is **Tier 2**: opened by the owner (D4(b)), built when the safety owner's sign-off lands.
- **NOT THIS AUDIENCE** — the posts behind the row screen out of the audience; the door says who it is for and routes the rest to their care team.

**What the owner decided, in one paragraph.** Food features open to GDM users (D4(b)). The read compares a meal against **the figure her own care team gave her and nothing else**; no figure, no read (D1(a)). The door never asks about medication (D2). It is a separate front door on the same app (D3), under a plain working name with no spend (D7). The claim classes are asked for today (D5). The two-week hand-answered test is skipped and building starts now (D6).

**What that means for the person in the gap.** While she waits for the dietitian she has no figure, so she gets **the organiser and meal ideas, and no read**. The read switches on the day she types in what her care team gave her. This is the honest answer under D1(a) to the research's sharper question — *what does the product do between the meter arriving and the dietitian arriving?*

**The gate that remains is not the owner's.** Today the engine refuses any input that mentions pregnancy, on purpose. `lib/pal/clinical-risk.ts` carries a `pregnancy` route, a text-pattern match over what the user types, that fires on "pregnant", "gestational" and "gdm" and returns the approved ledger row `clinical-pregnancy` with no model call **[S]**. The route is evidence of intent; the lock is the intended-use statement in `docs/safety/claims-boundary.md`, which covers "adults using an A1C in the prediabetes range" and nobody else **[S]**, and an engine that reads against an A1C band a GDM user does not have. D4(b) is therefore **decided, pending sign-off**. Three things must happen by the safety owner's hand, not this PRD's: intended use extended to a GDM profile (S1), the `pregnancy` route scoped off for that profile only (S2), and a reviewer with pregnancy competence named (S3). This PRD edits none of those files.

**Two tiers, two clocks.**

- **Tier 1 — general tools — builds now.** Waiting mode, question parking, her own plan kept in her clinician's words, her own meal list, a one-page appointment summary, tone rules. No product-authored food content. It ships the day the `gdm-organiser` claim class exists (§8.1), and not before.
- **Tier 2 — meal ideas, then the read — builds when S1–S5 land.** The read also needs an engine path that does not exist today: a described meal estimated against a per-occasion figure in her clinic's unit. That is a new engine path, not a prompt change.

**What replaced the test.** Nothing replaces it before launch. After launch, two four-week kill lines **[A]** do its job late (§9.2): whether Tier 1 is used at all, and whether the read box fills with food questions or with number, dose and delivery questions the product may never answer.

**What does not change:** the clinical line; the engine, the `Clear` / `Be careful` / `Hold off` labels and their semantics for the prediabetes door; `lib/pal/boundary-copy.ts`; the word families in `tests/unit/pal/claims-boundary-copy.test.ts`; `DESIGN.md`; `docs/ICP.md`; the `pregnancy` route for every path outside the GDM profile; the four clinical routes that outrank it; pricing; the prediabetes door.
**What D4(b) requires to change, by the safety owner and not by this PRD:** the intended-use statement and claim classes in `docs/safety/claims-boundary.md`, and the scope of the `pregnancy` route.

---

## 1. Document information

### 1.1 Purpose and scope

Specify the product response to `docs/handoff/2026-09-12-gestational-top5-pains-outcomes.md`. Scope is the GDM door only. Prediabetes is governed by PRD v1.1. Type 2 and post-bariatric are out of scope. Postpartum is out of scope: criterion 2 of the research excluded it and it was never characterised (research §9.8).

### 1.2 Intended audience

The owner (rulings in §10.1), the safety owner (copy governance in §8, S1–S5 in §10.2), and whoever plans the build.

### 1.3 Related documents

| Document | Role here |
|---|---|
| `docs/handoff/2026-09-12-gestational-top5-pains-outcomes.md` | The evidence. §3 scorecard, §4 quotes, §5 outcomes, §6 off-Reddit, §7 decisions, §8–§10 defects. **§12 is unaudited** (§1.5) |
| `PRD/Prediabetes_Pal_Guide_Redesign_PRD_v1.1.md` | House format, and three precedents reused here: F-DIARY/D4, F-DOCTOR/D2, F-NUMBERS/D7 |
| `docs/safety/claims-boundary.md` | Intended use, verdict semantics, claim classes. **Not edited by this PRD.** The GDM door fits none of its classes today (§2.5); D4(b) requires the safety owner to extend it (S1, S5) |
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
12. **Nobody has been asked anything** (research §9.9), and by owner decision D6 nobody will be before launch. Every claim here is a count of what people said to each other for their own reasons.

---

## 2. Why a GDM door: the research in one page

### 2.1 The audience

Diagnosed in this pregnancy, currently pregnant, eating to a plan. 34 of 146, hand-read in full **[H]** (§1.4). The research's fourth criterion, "no current insulin", is not written into this PRD's audience — the owner ruled that the door never asks (D2, §10.1): 15.8% are injecting and 18.5% carry any insulin signal, both in the pre-registered middle band (§1.5) **[M]**.

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
- **Rulings against lists is unresolved.** Three of four blind instruments put rulings ahead; one puts lists ahead (§5.1(3)) **[L]**. The owner's rulings build both: ideas from day one (D4(b)) and a read once she holds a figure (D1(a)). Idea taps against reads run is watched in §9.1, not assumed.

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
| A list of options · what can I eat | Yes, **Tier 2**, opened by D4(b), pending S1–S3 | A reviewed idea bank, available from day one, including the waiting weeks |
| Rule on this one food | Only against **her own figure** (D1(a)), Tier 2 | In words: heavier than, about, or lighter than what her plan says. **No figure, no read** — so none while she waits |
| Rule on this number, dose or delivery decision | **Never** | Park it as a question for the appointment |
| Why did the same meal read differently | **Never** for their reading | Park it, with their own note of what they ate |
| Tell me what happened to you | Not by this product | The subreddit does this at 84% answered (§3.5). Not built (§6.4 F-EXPERIENCES) |
| I am scared | A little | Tone, and the routes to real help that already exist |

---

## 3. Positioning

**Working line (not approved copy; needs D5):** *"Diagnosed with gestational diabetes and waiting for your dietitian? Keep your plan, your meals and your questions in one place, from today."*

The line is about **timing and organisation**, which is what the corpus shows (§7: "a meter, a target and nobody to ask for three weeks"). It is Tier-1-true: it promises nothing food-facing. Once S1–S3 land, "meal ideas" joins the line under the `gdm-food-ideas` class.

**Working name (D7).** A plain descriptive label, not a brand: **"Gestational Diabetes Organiser" (working name)**, used on the landing route and the door. No domain, no store listing and no trademark work until the four-week Tier 1 line in §9.2 is survived **[A]**. The owner may swap the label at any time; it is copy, and files under `gdm-organiser`.

**Rules for every line on this door:**

- The product is never the agent of a health outcome. Its output is a **read**, a **label** or an **answer**.
- No sentence bears on the pregnancy or the baby, in either direction (§8 rule 1).
- Anchor to **"your care team's plan"** when the user has entered one, and to nothing when they have not. The product never supplies the number (D1).
- Do not lead with outcomes. Not "in range", not "healthy", not "on track". Lead with the waiting weeks and with meals.
- The door does not show the name "Prediabetes Pal" as its headline to a pregnant reader; the working name leads (D7).

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
| G6 | Every food-facing feature is specified well enough that the safety owner's sign-off (S1–S5) is the only thing between it and a build | §10 |

### 4.2 Non-goals

- Interpreting a glucose reading, a trend, a dose, a scan or a delivery plan. Ever.
- Supplying a carbohydrate number, a calorie target or a meal plan presented as *theirs*. D1(a) settles this: the only figure on the door is one she typed.
- A read without her own figure. Closed by D1(a).
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
| 2 | **The numbers won't comply** `NUMBERS_UNPREDICTABLE` · 8.8–20.6%, any-code 17.6–35.3% · **[H]**, contingent (§1.5 item 5) | "My numbers are suddenly much lower than usual!!!and I don't understand why." — `1w7yni8`, strict | Numbers in range (end state, coders split) · rule on this reading (means) | The physiology moves (§6.4); explaining a reading is interpreting a clinical number | **GENERAL** — park the question with her own note of the meal; no product sentence about the reading | F-ASKLIST; F-ROUTER catches it in the read box (Tier 2); F-LEARN-GDM (not opened) | 1 | Questions parked per active user; the router's number-side count (a floor, §9.1) |
| 3 | **Living inside the diet** `DIET_BURDEN` · 20.6–23.5%, any-code 44.1–52.9% · **[H]** presence, **[L]** calmness | "I need easy breakfast ideas to try." — `1w6jkut`, strict | A list of options · tell me what to do · to eat freely again | Intended use excludes her today (§2.5); incumbents (§6.5) | **SERVE** — opened by D4(b), pending S1–S3. Ideas from day one; a read only against her own figure (D1(a)); her own list in Tier 1 | F-MYMEALS (Tier 1); F-IDEAS-GDM, F-PLANREAD (Tier 2) | 5 | Meals saved by day 7; idea taps; reads run per user who holds a figure |
| 4 | **Nobody will tell me the rule** `RULES_UNCLEAR` · 11.8–14.7%, any-code 20.6–32.4% · **[M]** | "My local diabetes in pregnancy unit says to avoid eating too much fat because it can make insulin resistance worse - I can't find any good evidence for this specific to GDM" — `1wazu06`, strict | Tell me what to do · rule on this one thing | Handouts disagree about the unit four ways; ACOG gives no quantity (§6.1) | **GENERAL** — keep her rule in her clinician's unit; show conflicts; never adjudicate. Under D1(a) her rule is also the only thing a meal is ever read against | F-PLANKEEP, F-ASKLIST; F-PLANREAD (Tier 2) | 4 | A plan entered by day 3; conflicts recorded that become parked questions |
| 5 | **How this ends is not mine to decide** `DELIVERY_CONTROL` · 5.9% · **[M]** | "the doctor said numbers look great but it is still "their practice" to induce between 39 and 40 for GD." — `1w5pz74`, strict | The birth they want (end state) | A clinical decision; the product's output may not bear on the pregnancy | **GENERAL** — a place to write the question and bring it; zero product strings about delivery | F-ASKLIST, F-SUMMARY; F-ROUTER catches it in the read box (Tier 2); F-STARTERS (not opened) | 0 | Delivery-shaped inputs parked; copy audit finds no delivery language in any bank |
| 6 | **The drug is coming** `MEDICATION_ESCALATION` · 5.9%, any-code 11.8% · tied 5th · **[M]** | "Would you start the insulin at this point, or would you wait?" — `1wbv3fr`, strict, both coders | Rule on this one thing (means) | A dosing decision; the `medication_dosing` route already outranks everything here | **GENERAL** — the door never asks medication status (D2, decided); park the question; no blame words. Because reads are now open, the read's "lighter" copy goes through S4 | F-ASKLIST, F-CALM-GDM | 0 | The door has no medication field; copy audit finds no medication language |
| 7 | **Is this even real** `DIAGNOSIS_VALIDITY` · full-frame top five (§3.2a); PRIORITY 0 on the strict 34 | "Had my 1 hour glucose test today. The threshold per my doctors office is 136. My glucose was 148!" — `1wbx4ba`, **screened out: no GDM diagnosis** | Rule on this result (means) | **None of the 8 both-coder posts is strictly eligible**: 6 have no GDM diagnosis, 1 is not pregnant, 1 leaves management unstated; two are the known duplicate pair **[S]** | **NOT THIS AUDIENCE** — the door says who it is for; a pre-diagnosis visitor is pointed to her care team; no word about tests or cut-offs | Onboarding line (§7.2) | — | Exits at the "have you been told you have GDM?" step are counted, not chased |
| 8 | **What this is doing to the baby** `HARM_GUILT_FEAR` · 2.9–5.9%, any-code 29.4–35.3% · full-frame top five · ⛔ fails the merge gate on the strict set (overlap 0.00) | "I am just worried about all these spikes, and what they are doing to my baby." — `1wcaj1e`, **screened out: on insulin**; both coders | The baby unharmed (end state) | The one topic the product may not speak on in either direction | **GENERAL** — tone only; the existing urgent routes stay first; nothing is said about the baby | F-CALM-GDM | 0 | Feedback mentions of "scary", "judged", "guilt" absent; tone audit green |
| 9 | **The measuring is the problem** `MONITORING_BURDEN` · 12/146 = 8.2%, coder B only | "Have you guys skipped a day of tracking if you’re not feeling well?" — `1wcnokj`, **screened out: management unstated**; single coder | Rule on this one thing | **0 of 12 posts are strictly eligible** **[S]**; device and testing-schedule advice is clinical | **GENERAL** — park the question. Nothing else is built | F-ASKLIST | — | The router's device-side count (Tier 2, a floor); revisit only if it appears |
| 10 | **The machinery of managing it** `REGIMEN_LOGISTICS` · 10/146 = 6.8%, coder A only | "what can i do to exercise but not move too much?" — `1w5w2is`, strict; single coder. 1 of 10 strict **[S]** | Tell me what to do | Cost, insurance, supplies and appointments sit outside any food product | **GENERAL** — one page to bring, so the food log is written once | F-SUMMARY | — | Summary printed or shared at least once before an appointment |
| 11 | **The morning number that won't move** `FASTING_UNCONTROLLABLE` · 9/146 = 6.2%; **5/34 = 14.7% strict**, coder A only — the deleted row that matters (§3.2f) | "I’ve just been getting so frustrated at these numbers recently and wonder if I’m going to end up being put on nighttime insulin because of it." — `1wclkbp`, strict; single coder | Numbers in range (end state) | The thinnest line in this PRD: a snack list is food; a snack *that moves a fasting number* is an outcome claim | **GENERAL** for the number (park it). Food-side: a bedtime-snack occasion exists in her own list (Tier 1) and in the idea bank (Tier 2) **as an occasion, never as a remedy** | F-ASKLIST, F-MYMEALS; F-IDEAS-GDM (Tier 2) | — | Fasting questions parked; zero strings pairing a food with a fasting reading |
| 12 | **The clinician in the room is the problem** `PROVIDER_CONFLICT` · 6/146 = 4.1%, coder A only | "she just cut me off, again said I need more education, and she’s putting in a referral so they can decide if I need insulin." — `1wcshe9`, strict; single coder. 2 of 6 strict **[S]** | Care that works (end state) | Two clinicians disagreeing cannot be adjudicated by a food product (§4, Pain 4) | **GENERAL** — both instructions shown side by side in her plan; her questions on one page; never a word about the clinician | F-PLANKEEP, F-ASKLIST, F-SUMMARY | — | Conflicts recorded; summary used |

**The largest single want has no row of its own**: "tell me what happened to you" (17.6–23.5%). The product does not answer it. See F-EXPERIENCES, §6.4.

### 6.2 Tier 1 — general tools. Build now; ship when the `gdm-organiser` class exists (D5, §8.1)

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

**Deliberately not in Tier 1: a router that detects number-shaped questions.** Tier 1 has no engine box for it to intercept (`/check` is unreachable from this profile, §7.1), and the research's own saved regex nets caught 2 of 13 and 4 of 23 on this very corpus (§8). The router arrives with Tier 2, when F-PLANREAD gives people a box to type rulings into (F-ROUTER, §6.3), and it ships with must-match probes that exercise **each branch**, not only the pattern — the research's own lesson (§8, the fourth `\b` variant).

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

**Must never say.** Whether the plan is typical, strict, generous or right. No unit conversion, anywhere on the door. No comparison of a meal against the plan in Tier 1 (that is F-PLANREAD, Tier 2). No default when the field is empty.

**Acceptance.** Every figure on screen was typed by the user. An empty plan renders as empty. Plan contents are encrypted at rest as the A1C is, and never reach analytics.

#### F-MYMEALS · My own meal list

**Rows:** 3, 11. The general form of "give me a list of options": the list is hers.

**User stories.**
1. As a person who found a breakfast that suits her, I want to save it under "breakfast", so that I stop re-deciding every morning.
2. As that person, I want occasions that match the structure I was given, including a bedtime snack, so that the list fits my day.
3. As that person, I want to copy a day's meals into my appointment summary, so that the dietitian sees what I actually eat.

**Behaviour.** A user-authored list grouped by occasion. No label, no read, no score, no suggestion in Tier 1. Once Tier 2 is live and she holds a figure, a saved meal gains a "read this against my plan" action.

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

### 6.3 Tier 2 — food features. Opened by D4(b); each builds when its sign-off lands

All of Tier 2 puts product-authored food content in front of a pregnant user, so all of it waits on **S1–S3** (§10). Build order: F-IDEAS-GDM first (the bank pattern already exists), then F-ROUTER with the read box, then F-PLANREAD.

#### F-IDEAS-GDM · Meal ideas by occasion

**Rows:** 3, 11. **Wanted:** a list of options; tell me what to do; to eat freely again.

**User stories.**
1. As a person diagnosed last week with no sheet yet, I want five breakfast ideas today, so that I am not starting from a forum search.
2. As that person, I want ideas grouped by the occasions in my day, including a bedtime snack, so that the list matches the structure I was given.
3. As a vegetarian, or someone cooking a particular cuisine, I want ideas I would actually eat, so that the list is not a generic diet sheet.
4. As that person, I want to save an idea into my own meal list with one tap, so that my repertoire grows.
5. As a person who holds a figure, I want to send an idea to the read, so that I see how it sits against my own plan.

**Behaviour.** A **bounded, reviewed bank** in the `lib/pal/guide-ideas.ts` pattern: fixed entries, deterministic rotation, no free generation. Positive-only. Grouped by occasion. Available from the first session, because it needs no figure. Reviewed entry by entry by the S3 reviewer.

**Must never say.** That an idea suits *her*, produces any reading, or is her plan. Any quantity. Any food to limit. **For row 11: no sentence pairs a food with a fasting number** — the bedtime snack is an occasion like any other, never a remedy.

**Acceptance.** Every entry carries the reviewer's sign-off in the ledger. The copy tests pass over the bank. No entry contains a digit. Claim class: `gdm-food-ideas` (§8.1).

#### F-PLANREAD · A meal read against her own figure — the only read (D1(a))

**Rows:** 3, 4. **Wanted:** rule on this one food; tell me what to do.

**User stories.**
1. As a person whose dietitian gave her a figure for lunch, I want to describe my lunch and hear in words how it sits against that figure, so that I do not do the arithmetic at the table.
2. As a person whose sheet counts "choices", I want the read in choices, so that the app speaks my clinic's language.
3. As a person who is eating too little out of fear, I want "lighter than your plan says" shown as plainly as "heavier", so that the app never rewards under-eating.
4. As a person with no figure yet, I want the app to say so plainly and show me ideas instead, so that I am not given a made-up standard.
5. As a person whose plan changed last week, I want the read to use the current figure and show its date, so that I know what I am being compared with.

**Behaviour.** Input: a meal description, the occasion, and the figure and unit stored in F-PLANKEEP for that occasion. Output: **one of three word-states — heavier than your plan says · about what your plan says · lighter than your plan says —** one reason in words, and one food-level adjustment in whichever direction applies. **No number is ever shown** that she did not type: not the estimate, not the gap. It reads in the unit her clinic used; nothing is converted. Supported units: grams per occasion, and carbohydrate choices *where her sheet states what one choice is*. Food-group servings per day, or no figure, means **no read**, and the surface says why. An incomplete description gets one concrete question, as `clarification-route` does today.

**Preconditions beyond S1–S3.**
- **A new engine path, not a prompt change.** The engine today reads a description against an A1C band and nothing else (PRD v1.1 §2.3). Estimating a described meal against a per-occasion figure does not exist.
- **A new claim class**, `gdm-plan-read` (§8.1). `clarification-route` forbids nutrition-math demands and result copy must stay qualitative **[S]**; this read keeps its *output* in words, but the comparison underneath is arithmetic against a clinician's figure, and no existing class covers that.
- **Its own three word-states.** It does not reuse `Clear` / `Be careful` / `Hold off`: those are defined against meal-composition rules and an A1C band. New states mean a new Verdict Semantics entry, which is part of S1.
- **S4.** "Lighter than your plan says; consider adding …" will be read by some women who inject insulin, and the door never asks (D2). The safety owner rules on that copy and on its precedence under the `possible_hypoglycemia` route before it ships.

**Must never say.** Whether her figure is typical, strict, generous or right. Any estimate or figure of its own. That lighter is better. Anything about a reading, a dose, the pregnancy or the baby. Medication language of any kind.

**Acceptance.** With no figure stored, no read is possible from any entry point. The same description and figure give the same word-state on a fixed evaluation panel, as v1.1 requires of F-SOURCE. Both directions carry an adjustment line. No digit appears in any result string other than her own figure shown back with its date.

#### F-ROUTER · Catch what the read box must not answer

**Rows:** 2, 5, 6, 9, 11. **User story.** As a person who types "why was my fasting 106?" into the read box, I want a calm line that this is one for my care team and one tap to save it to my questions, so that I am not simply refused.

**Behaviour.** A non-generative, precedence-ordered router in the pattern of `lib/pal/clinical-risk.ts`. The existing clinical routes fire first. Then number-, dose-, delivery- and device-shaped input returns one fixed ledger line and an "add to my questions" action. Everything else goes to F-PLANREAD.

**Recall ceiling, stated.** The research's own saved nets caught 2 of 13 and 4 of 23 on this corpus (§8). This router will miss most of what it is built to catch. Two consequences: F-PLANREAD's own must-never-say rules are the real guard, not the router; and the router's counts are a **floor** (§9.2). Each route ships with a must-match probe **per branch**, not only per pattern.

#### Closed or not opened

| Feature | Status | Why |
|---|---|---|
| **F-READ-GDM** · a qualitative read with no figure | **Closed by D1(a)** | The owner chose no read without her own figure. Its too-light handling survives inside F-PLANREAD |
| **F-IMPORT** · handout importer with unit conversion | **Not needed** | Under D1(a) she types her own figure and the read stays in her unit. A photo of the sheet is already kept by F-PLANKEEP |
| **F-STARTERS** · question starters | Specified, **not opened** | Near the clinical line, as v1.1's F-DOCTOR. D4(b) did not cover it. Needs its own class |
| **F-LEARN-GDM** · a general explainer | Specified, **not opened** | No class fits; same shape as v1.1's F-NUMBERS. D4(b) did not cover it |

### 6.4 Tier 3 and not built

| Candidate | Why it is not in Tier 1 or 2 |
|---|---|
| **F-JOURNAL** · food beside readings | This is v1.1's F-DIARY. It changes the intended-use statement and the regulatory posture (v1.1 §10 D4). D4(b) opened ideas and reads, not this. Recorded, not recommended |
| **F-EXPERIENCES** · what happened to others | The largest single want (§5.1(2)), and the one the subreddit already serves at 21 of 25 answered. Moderation plus medical claims in pregnancy is the highest-risk surface available. Not built. Whether the door may simply say that communities exist is left to the safety owner |
| **F-REMIND** · testing reminders | 0 of 12 monitoring posts are in the audience **[S]**, and a testing schedule is clinician-set. Not built; revisit only if users ask for it |

---

## 7. Information architecture

### 7.1 The door

Same app, same codebase, a separate front door (D3). A GDM landing route and a GDM onboarding choice set a **profile flag**. The flag is passed into shared code as a setting; nothing is forked.

| Surface | Prediabetes door | GDM door, Tier 1 |
|---|---|---|
| Landing | unchanged | Its own route, its own line (§3), a sign-up. No food promise |
| Onboarding | A1C, tour | No A1C asked. "Have you been told you have gestational diabetes?" · appointment date (optional) · health-data consent |
| Home | ideas, check | Waiting mode, or My plan once entered; My meals; My questions. Tier 2 adds meal ideas, and the read once a figure exists |
| `/check` | the engine | **Tier 1: not reachable from the GDM profile.** **Tier 2:** a GDM read box, reachable only when F-PLANKEEP holds a figure for that occasion; F-ROUTER sits in front of it. The `pregnancy` route is scoped off for this profile only (S2) and remains the backstop on every other path |
| Summary | — | Printable page |

### 7.2 Onboarding lines that carry a stance

- **Not diagnosed yet** (row 7): one fixed line that the door is built for people who have been told they have GDM, and that her care team is the place for questions about testing. Nothing about tests, thresholds or what a result means.
- **Medication is never asked** (row 6, D2, decided). There is no field for it. A user who types a dosing question meets the existing `medication_dosing` route. Because D4(b) opens food reads, the owner's own revisit clause fires: the "lighter than your plan says" copy goes to the safety owner as S4 before F-PLANREAD ships.

### 7.3 Copy rules that apply everywhere on this door

See §8. In short: no clinical sentence, no pregnancy or baby sentence, no number the user did not type, no grading words, nothing that rewards eating less.

### 7.4 Implementation decisions

- **One profile flag, not a fork.** The split triggers are in D3.
- **Pregnancy status is health data.** The flag and everything stored under it use the explicit-consent path `app/api/profile/route.ts` already enforces for A1C, and the same field encryption.
- **Two deep modules in Tier 1, each testable alone:** (1) the *plan record* — a small typed store for occasions, unit and figures with conflict detection as a pure function; (2) the *summary builder* — three lists in, one printable document out. **Two more in Tier 2:** (3) the *question router* — text in, one of a closed set of routes out, non-generative, precedence-ordered; (4) the *plan read* — description, occasion, figure and unit in, one of three word-states out, testable on a fixed panel with no UI.
- **Bounded banks, never free generation**, for every product-authored string (v1.1 §8 rule 3).
- **Analytics are closed enums.** Events: door shown, waiting mode opened, plan entered, meal saved, question parked (a count, never text), summary printed. Never free text, plan contents, meal text or the profile flag joined to an identity outside the consent scope.
- **No new dependency** is needed for Tier 1.

---

## 8. Safety and copy governance

1. **Two strings are banned from every surface of this door and from this document's own prose: `safe` and `for your baby`**, in either direction. A product described as making food so, and one described as not doing so, are both sentences about a pregnancy outcome (research header). They appear in this document only here, as the definition of the rule.
2. **Output is a read, a label or an answer.** Never a finding about her, the pregnancy or the baby.
3. **This PRD edits no boundary file; D4(b) requires the safety owner to.** `claims-boundary.md`, `boundary-copy.ts`, `DESIGN.md` and `lib/pal/clinical-risk.ts` are untouched by this document. The owner has decided to open food features; what that needs is listed as S1–S5 in §10 and drafted in §8.1. **Until `gdm-organiser` exists, no GDM-door string ships**, including the landing line. **Until S1–S3 land, no product-authored food content reaches a GDM user**, and until S4 lands, no read does.
4. **Under-eating is the named hazard** (§6.4). Every bank is positive-only. Nothing is framed as a reduction. F-PLANREAD surfaces "lighter" as plainly as "heavier". The `eating_disorder` route keeps its precedence.
5. **No number the user did not type.** No carbohydrate figure, no target, no range, no default, no estimate (D1(a)).
6. **Population studies are never product evidence.** The umbrella review and the ketonuria study inform this PRD; `claims-boundary.md` bans using them as evidence that the product does the same **[S]**. None of it reaches copy.
7. **Every new string is a ledger row**, approved by the safety owner, covered by the copy tests. The reviewer queue already holds the clinical routes pending sign-off (W-05); this door joins that queue rather than jumping it. **Skipping the hand-answered test (D6) skips none of this.**
8. **The banned verbs stay banned** with the product as subject: prevent, reverse, control, lower, treat, manage, cure, diagnose.

### 8.1 The three claim-class asks (D5) — drafted for the safety owner, not sent

Rows follow the column shape of `claims-boundary.md`. The first uses the owner's chosen wording. It says "no food guidance", so it cannot cover Tier 2; D4(b) is what creates the second and third.

| Claim Class | Applies To | Allowed Language | Not Allowed | Notes |
|---|---|---|---|---|
| `gdm-organiser` | GDM landing, onboarding and every Tier 1 surface | Describe the door as a place to keep your plan, meals and questions; no food guidance. Quote a professional body's published meal structure, attributed, without quantities | Any food guidance. Any figure the user did not type. Any statement about a reading, a dose, a delivery decision, the pregnancy or the baby. Outcome language | **Ask today.** Gates everything in Tier 1, including the working name |
| `gdm-food-ideas` | F-IDEAS-GDM bank | General meal ideas by occasion, from a bounded bank reviewed entry by entry by a pregnancy-competent RDN/CDCES. Positive-only | That an idea suits the user, produces a reading, or is her plan. Quantities. Foods to limit. Any pairing of a food with a reading | Arrives with S1. Needs S3 |
| `gdm-plan-read` | F-PLANREAD result copy | Say in words whether a described meal reads heavier than, about, or lighter than the figure the user entered from her own care team, with one food-level adjustment in either direction | Supplying, altering or judging her figure. Showing any estimate. "Lighter is better". Any statement about a reading, a dose, the pregnancy or the baby. Medication language | Arrives with S1. Needs S4. New Verdict Semantics entry for the three word-states |

---

## 9. Sequencing and what is measured

### Step 0 — the hand-answered test: skipped (owner decision D6, 2026-09-19)

v1 put a two-week hand-answered test before any build, with a floor and one branch. The owner has chosen to build without it. The risk it carried is in §11 and the late substitute is §9.2.

### Step 1 — today, in parallel with the build

Put the §8.1 rows and S1–S4 (§10) to the safety owner. The `gdm-organiser` class is the only thing between Tier 1 and a ship date; S1–S3 are the only things between F-IDEAS-GDM and one.

### Step 2 — Tier 1 build, now, behind a flag

Order: F-ASKLIST (the general answer to eight rows, smallest copy set, a plain list) → F-PLANKEEP → F-WAIT → F-MYMEALS → F-SUMMARY. F-CALM-GDM runs over each as it lands. The landing route with a sign-up goes first if `gdm-organiser` clears its line. One ledger batch for all Tier 1 strings.

### Step 3 — Tier 2 build, as sign-offs land

F-IDEAS-GDM (needs S1–S3; no new engine work) → F-ROUTER and the read box → F-PLANREAD (needs S4, the `gdm-plan-read` class, and the new engine path). Building F-PLANREAD's engine path may start before S4; nothing reaches a user before it.

### 9.1 What is measured

Behavioural only. No baseline exists, so these are **gates and directions, not targets**.

| Measure | Why | Reads as success when |
|---|---|---|
| Questions parked per active user | Whether the general answer is used at all | Non-zero in week 1 for most users who open the list |
| Plans entered; unit chosen | Whether the plan arrives, and in what unit. **Under D1(a) this is also the ceiling on who can ever get a read** | Entered by most users within days of their appointment date |
| Meals saved by day 7 | Whether the own-list form of "options" is wanted | Non-zero and rising |
| Idea taps; ideas saved (Tier 2) | Whether ideas serve the waiting weeks | Used before any figure exists |
| Reads run per user who holds a figure; split of the three word-states (Tier 2) | Whether the read is used, and whether "lighter" is as common as the hazard suggests | Any; the split is watched, not targeted |
| Router counts: food-side against number-, dose-, delivery- and device-side (Tier 2) | The branch the skipped test would have read. **A floor with poor recall** (§6.3 F-ROUTER) | Food-side leads |
| Summaries printed before an appointment date | Whether the door serves the visit | Any |
| Feedback mentions of "scary", "judged", "guilt", "confusing" | The tone audit's outcome | Absent |

**Nothing here measures glucose, weight, medication, delivery or any pregnancy outcome, and nothing will.** Retention is not a goal: this audience leaves by design within months (§6.3).

### 9.2 Kill criteria — the late substitute for the skipped test

All thresholds are **[A]**, chosen here without a baseline. No line is read on fewer than 50 door users **[A]**.

- **No `gdm-organiser` class → nothing ships.** No S1–S3 → no food content ships. No S4 → no read ships.
- **Tier 1, four weeks after launch:** if fewer than a quarter of users who opened the questions list parked anything, **and** fewer than a quarter entered a plan or saved a meal, the door is not being used as an organiser. Tier 2 work pauses and the door is re-read. **Surviving this line is also D7's spending trigger.**
- **Tier 2, four weeks after the read box is live:** if routed number-side inputs exceed food-side reads by more than 2 : 1, stop adding food features and re-read. The router under-counts the number side badly, so **the bias runs against this line firing**: when it fires it is credible, and when it does not it proves little.
- **Under D1(a), one more:** if after four weeks fewer than a quarter of users have entered a figure, F-PLANREAD is reaching almost nobody, and D1 goes back to the owner with that count.

### 9.3 Testing decisions

Test external behaviour only: given this input, this route, this string, this document. Never implementation detail.

| Module | What is tested | Prior art |
|---|---|---|
| Questions list | Existing clinical routes still win over text typed into it; text never reaches analytics | `tests/unit/pal/clinical-risk.test.ts` |
| Question router (Tier 2) | Each route has a must-match probe **per branch** and a must-not-match probe; precedence under the existing clinical routes | same |
| GDM copy banks | The two banned strings, the grading-word family, medication words, delivery words, digits | `tests/unit/pal/claims-boundary-copy.test.ts`, `clinical-copy-no-treatment.test.ts` |
| Plan record | Conflict detection; an empty plan renders empty; no conversion anywhere | — |
| Plan read (Tier 2) | No figure → no read from any entry point; fixed panel gives stable word-states; both directions carry an adjustment; no digit in any result string but her own figure | the consistency-eval pattern v1.1 requires of F-SOURCE |
| Summary builder | Output contains only user text and fixed headings; no readings field exists | — |
| Idea bank (Tier 2) | Every entry reviewed; no digits; copy tests green | `tests/unit/pal/guide-ideas.test.ts`, `guide-ideas-labels.test.ts` |
| The `pregnancy` route | **Fires on every path outside the GDM profile. Inside it, scoped off only after S2.** The four routes that outrank it fire everywhere, always | `clinical-risk.test.ts` |

---

## 10. Decisions

### 10.1 Taken by the owner, 2026-09-19

| # | Decision | Ruling | What it sets in motion |
|---|---|---|---|
| **D1** | What a meal read compares against | **(a) Her own care team's figure, and nothing else.** No figure, no read | F-PLANREAD is the only read. F-READ-GDM closed; F-IMPORT not needed. Nobody in the waiting weeks gets a read; they get ideas and the organiser. Needs a new engine path and the `gdm-plan-read` class. §9.2 carries a line that sends D1 back to the owner if almost nobody enters a figure |
| **D2** | Turn away women on insulin? | **Never ask about medication.** Revisit if food reads open | No medication field anywhere. **D4(b) opens food reads, so the revisit fires now** → S4 |
| **D3** | Architecture | **Same app, separate front door**; the GDM profile is a setting, not a fork | §7. Split when: the profile needs core-engine changes, not settings · a store or counsel requires pregnancy content to be separate · demand earns its own listing. **F-PLANREAD's new engine path is the first of those triggers to watch** |
| **D4** | May the app talk about food to pregnant users? | **(b) Yes: meal ideas and meal reads** | Decided, **pending the safety owner's sign-off**: S1, S2, S3. This PRD edits no boundary file |
| **D5** | Which claim class covers the wording? | **Ask today**, proposing "a place to keep your plan, meals and questions; no food guidance" | §8.1. That wording covers Tier 1 only; two further classes are drafted beside it for Tier 2 |
| **D6** | Run the two-week hand-answered test? | **Skip it and build** | §9 rewritten. No pre-build evidence from any human; §9.2's four-week lines are the only check |
| **D7** | The door's name | **Plain working name; spend nothing** | "Gestational Diabetes Organiser" (working name). The ruling's trigger was cut off and named the skipped test; **re-anchored to surviving the four-week Tier 1 line [A]**. The owner should confirm or replace that trigger |

### 10.2 Now with the safety owner — nothing food-facing ships without these

| # | Item | Gates | Note |
|---|---|---|---|
| **S1** | Extend the intended-use statement in `claims-boundary.md` to a GDM profile; add a Verdict Semantics entry for F-PLANREAD's three word-states | All of Tier 2 | The current statement names adults with a prediabetes-range A1C and nobody else **[S]**. Likely needs counsel |
| **S2** | Scope the `pregnancy` route off **for the GDM profile only** | All of Tier 2 | The route's own comment says the engine's bands "are not the ones used in pregnancy" **[S]**. It stays on for every other path. The four routes above it are untouched |
| **S3** | Name a reviewer with pregnancy competence (RDN/CDCES) | F-IDEAS-GDM bank, F-PLANREAD copy | The existing clinical rows are already pending sign-off (W-05); this joins that queue |
| **S4** | **The D2 revisit.** Rule on "lighter than your plan says; consider adding …" being read by a woman who injects insulin, when the door never asks; and on its precedence under `possible_hypoglycemia` | F-PLANREAD | This is the interplay most likely to be missed: D2 could be left unasked only while the door said nothing about food |
| **S5** | The three claim classes in §8.1 | `gdm-organiser`: all of Tier 1. The other two: Tier 2 | Drafted, not sent |

---

## 11. Risks and honest limits

- **Nothing has been tested with a person, and now nothing will be before launch** (D6). The research is 34 forum posts. The first evidence that anyone wants this will be §9.2's four-week lines, read after the build is paid for.
- **The read reaches only women who already hold a figure** (D1(a)). Most who mention the clinical channel are still waiting (§6.2). The door's headline audience — the referral gap — never sees the read.
- **The read needs engine work that does not exist**, plus a new claim class, a new semantics entry and S4. It is the most expensive feature here and serves the smaller half of the audience.
- **The scope boundary moves for a higher-stakes audience.** A copy error here is a sentence to a pregnant person. The reviewer queue is the bottleneck and should be. S3 may take longer than the build.
- **"Lighter than your plan says" meets insulin users the door never identified** (S4).
- **The general answer may not be worth a door.** Eight of twelve rows resolve to "write it down and bring it".
- **Incumbents are liked.** A 4.85★ tracker owns logging; Malama at 4.78★ already does AI meal analysis with nutritionists attached (§6.5). No differentiation against Malama is established; its reviews could not be read.
- **The subreddit answers five questions in six for free**, and its latency is unknown (§3.5, §9.4). With the test skipped, it stays unknown.
- **Food is the most present topic and, as coded, the calmest** (§3.3, **[L]**). Calm topics are weak reasons to install something.
- **The evidence is provisional**: 11 claims refuted; the firmest row contingent on an unregistered choice; coder independence in doubt (§1.5). No sizing, no willingness to pay, no Android data (§9).
- **Short lifecycle.** Weeks of use per person. Acquisition repeats every year, in pregnancy spaces that were screened but never coded (§9.6).

### 11.1 Reducing each risk

| Risk | How to reduce it |
|---|---|
| Nothing tested with a person | Owner accepted (D6). The four-week lines are the only check; hold them. Ship Tier 1 behind a flag so the first line is read on a small group before anything else is built on it |
| The read misses the waiting weeks | Accept it as D1(a)'s cost. Make F-IDEAS-GDM, not the read, the food feature the landing line names. Let §9.2's fourth line send D1 back if almost nobody enters a figure |
| The read is the expensive part | Build it last. F-IDEAS-GDM needs no engine work; let its use earn the read |
| Higher stakes; S3 is slow | One batch of strings, bounded banks only, the banned-string test in CI. Start S1–S5 today so the reviewer's clock runs beside the build |
| Insulin users meet "lighter" copy | S4, before any read ships. If the safety owner cannot clear it, the read ships with the "heavier / about" states only and D2 returns to the owner |
| The general answer is not worth a door | F-ASKLIST is a plain list and ships first; whether anyone parks anything is the cheapest live signal |
| Incumbents, and a free community | Do not compete on logging. Position on the waiting weeks and on keeping the plan in her clinic's words |
| Provisional evidence | Depend on set membership, never rank. Re-run the ranking both ways on single-coder rows before any row is dropped from §6.1 |

### 11.2 The same risks, in plain English

**We are building before asking anyone.** Thirty-four forum posts are all we have. The first real answer comes four weeks after launch, from whether people use it.

**The meal read helps only women who already have their number.** The ones waiting for the dietitian — the people the door is named for — get meal ideas and an organiser, not a read. That is the price of never inventing a number, and it is a fair one.

**The useful part is locked, and the owner has now asked for the key.** The app refuses pregnancy today, on purpose. Opening it needs a qualified reviewer and a rewritten intended-use statement. The owner decides to open it; the safety owner decides whether it is ready.

**One interplay to watch.** We never ask about insulin. That was easy while the app said nothing about food. A message that a meal "reads light" is different for someone who injects. The safety owner rules on that sentence before any read ships.

---

## 12. Appendix

### 12.1 Research §12.4's seven candidates — what happened to each

| Candidate | Here | Why |
|---|---|---|
| 1. Meal in, a read against your plan, plus swaps | **Kept** as F-PLANREAD, Tier 2 | D4(b) opens it; D1(a) fixes what it reads against. Needs a new engine path, `gdm-plan-read`, and S4. The no-figure variant (F-READ-GDM) is closed |
| 2. Plan importer | F-PLANKEEP (Tier 1, her unit, her words). Conversion (F-IMPORT) **not needed** | Under D1(a) the read stays in her unit |
| 3. "Waiting for my dietitian" mode | **Kept**, F-WAIT, Tier 1 | Structure with no quantity; the grocery list becomes her own F-MYMEALS |
| 4. Meal-list builder | **Kept**, F-IDEAS-GDM, Tier 2, first food feature to build. **Added** F-MYMEALS as its Tier 1 general form | D4(b); needs S1–S3 |
| 5. Food and reading journal | **Cut** to Tier 3, F-JOURNAL | v1.1 already ruled on it as F-DIARY: food beside readings. D4(b) did not open it |
| 6. Question prep | **Kept and promoted**, F-ASKLIST, first in the build order; F-ROUTER added in front of the read box | The general answer to eight of twelve rows |
| 7. Experiences from others | **Cut**, F-EXPERIENCES | Highest-risk surface; the want is already served for free |
| — | **Added:** F-SUMMARY, F-CALM-GDM. **Specified, not opened:** F-STARTERS, F-LEARN-GDM | Rows 1, 5, 6, 8, 10, 12 |

### 12.2 Done check

- [x] Twelve pains, each with a stance and a reason (§6.1)
- [x] Every feature traces to a row; every claim carries a grade and a section
- [x] The two banned strings appear only in §8 rule 1; no feature interprets a reading, a dose or a delivery decision
- [x] D1–D7 recorded as the owner ruled them (§10.1); what they hand to the safety owner is S1–S5 (§10.2)
- [x] The three collisions between rulings are visible, not smoothed: D4(b) fires D2's revisit (S4) · D5's wording covers Tier 1 only (§8.1) · D7's trigger was re-anchored after D6 (§10.1)
- [x] The skipped test is replaced by dated kill lines, all **[A]** (§9.2)
- [x] Nothing committed; no existing file modified; v1 left untouched
