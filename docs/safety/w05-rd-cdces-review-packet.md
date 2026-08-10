# W-05 — Dietitian / CDCES Review Packet

**App:** Revora (revora.plus) — meal checks for adults with a prediabetes-range A1C.
**Date compiled:** 2026-07-24
**What we ask of you:** Read the user-facing texts below and either approve each item or propose revised wording. Every text is fixed copy (not AI-generated) shown deterministically when a user's message matches the listed situation. Revora is positioned as informational only — never diagnosis, treatment, dosing, or predictions.

Sign-off format: initial and date each numbered item, or return edits inline.

---

## Part 1 — Clinical route messages

These replace the normal food verdict when a user's text signals a clinical situation. Precedence order is as listed (first match wins).

1. **Urgent symptoms** (vomiting, confusion, breathing trouble, chest pain, fainting, seizure, DKA signs):
   > "These symptoms need a person, not an app. Please contact your doctor or your local emergency number now. Revora cannot give you a food answer while this is going on."

2. **Possible hypoglycemia** (shaky, clammy, sweating, dizzy, "sugar crashing", low BG reading). *Revised 2026-07-24: the previous version carried a 15g/15min first-aid instruction; that was removed as out of scope — the copy now defers to the user's own care plan. Please confirm this deference posture is clinically acceptable:*
   > "This can be a sign of low blood sugar — that needs your attention now, not a meal verdict. If you have a low-blood-sugar plan from your care team, follow it right away. If you don't have one, or you feel worse or confused, contact your doctor or your local emergency number now."

3. **Medication dosing** (insulin or medication dose questions):
   > "Revora never advises on medicine or doses. That is between you, your prescriber, and your pharmacist. Please follow the plan you were given, and ask them before you change anything."

4. **Eating disorder signals** (purging, restriction disclosures — US audience):
   > "It sounds like food is feeling hard, and a meal verdict is not what would help. If this feels urgent, call or text 988 now — live support, any hour, and eating struggles count. Please talk with your doctor or a professional soon; you deserve real support, not a label on a plate."

5. **Pregnancy:**
   > "Pregnancy changes what is right for you, and the A1C ranges Revora works from are not the ones used in pregnancy. Please ask your midwife, doctor, or dietitian for guidance made for you."

6. **Organ disease** (kidney, liver, heart conditions mentioned):
   > "With a condition like this, general food advice can be wrong for you — protein, salt, and activity guidance all shift. Please ask the doctor or dietitian who knows your case."

7. **Allergy:**
   > "Revora cannot confirm whether a food is safe for an allergy — not from a description, and not from a photo. Hidden ingredients and cross-contact do not show up. Please check with whoever prepared the food, and follow your allergy plan."

8. **Diagnosed diabetes:**
   > "Revora is built for the prediabetes A1C range, and it does not know your medicine or your glucose readings. For food guidance that accounts for those, please talk with your doctor or dietitian."

9. **Pediatric** (meal described for a child/teen — added 2026-07-24):
   > "Revora is built for adults using a prediabetes-range A1C. Children and teens have different needs, and the ranges Revora works from do not apply to them. Please ask their pediatrician or a dietitian who works with children."

10. **High-range A1C** (user enters 6.5% or above):
    > "This A1C value falls in the range clinicians use when evaluating Type 2 diabetes, and Revora's prediabetes bands do not apply there. Revora does not know your medicine or glucose readings — please talk with a doctor or registered dietitian for next steps made for you."

---

## Part 2 — Weekly recap descriptions (marketing/product pages)

The app shows a weekly behavioral recap (plain sentences, no score). These texts describe it:

- Landing page:
  > "Your weekly recap is behavioral — plain sentences about what you did, like days checked in and steps followed through. Never a score, a grade, or a lab prediction."

- How-it-works page:
  > "The weekly recap is entirely behavioral — it states what you did, never what a future lab result will be. Here is exactly what goes into it, the research it is grounded in, and its honest limits."
  > "These appear in your weekly recap as plain sentences — no composite score, no bands, no percentages. Checking less as you get more confident is how Revora is meant to work, so the recap states facts that cannot 'decline.' The recap is refreshed once a week, early Monday, from the seven days before."

---

## Part 3 — Food-classification heuristics needing dietary confirmation (AUD-029 + precheck rules)

Before any AI call, Revora applies deterministic rules. Please confirm these classifications are dietarily sound:

1. **"leftover" / "leftovers" alone** → asks the user to clarify what the food is (under-described); "leftover fried rice" still gets a verdict.
2. **"curry" alone** → asks for clarification (composition varies too widely); a described curry gets a verdict.
3. **"bbq sauce" quantities** treated as a sugar-heavy condiment: contributes sugar evidence to a "mostly sugary" reasoning, without alone forcing a HIGH verdict; **"bbq ribs"** recognized as a protein dish with a sugar-glazed component.
4. Sugar-heavy condiments in quantity contribute to a "mostly sugary" reason but do not alone force HIGH (see `lib/pal/input-precheck.ts` markers "PENDING RD/CDCES" for the full rule list — we can provide a live walkthrough).

---

## Notes for the reviewer

- All texts avoid: diagnosis, dosing, treatment instructions, gram/timing numbers, and lab predictions — this is a hard product boundary enforced by automated gates.
- If you believe any message SHOULD carry a first-aid instruction (e.g., hypoglycemia rule of 15), that requires a separately governed product-scope decision, not just a wording edit — flag it and we will route it to the owner.
- Source guidance used for drafting: CDC DKA guidance, NIDDK hypoglycemia guidance, CDC A1C ranges, SAMHSA 988, FDA general-wellness policy.
