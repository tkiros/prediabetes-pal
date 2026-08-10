# Prediabetes Pal

## What This Is

Prediabetes Pal is a permission-first food checker for people with prediabetes who are standing in front of a meal and asking, "Can I eat this?" The current MVP is a text-only web app: the user enters a food description and A1C level, then receives a SAFE / MODERATE / HIGH risk answer in plain English with one practical next action when needed.

The MVP is intentionally not the full scanner product. Its job is to validate whether prediabetes-specific, A1C-calibrated food guidance creates enough trust, sharing, and willingness-to-pay signal before investing in photo scanning, accounts, payments, databases, or mobile apps.

## Core Value

Prediabetes Pal must give a clear, evidence-grounded, permission-first answer to "Can I eat this?" in under 5 seconds without increasing food anxiety.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] User can enter a food name or meal description.
- [ ] User can enter an A1C value in the prediabetes range.
- [ ] User receives an answer in under 5 seconds that classifies the food as SAFE, MODERATE, or HIGH risk.
- [ ] SAFE answers feel enabling and reassuring, not like a warning or passing grade.
- [ ] MODERATE and HIGH answers include one practical sequencing tip or meal adjustment.
- [ ] MODERATE and HIGH answers include one practical lower-glycemic swap.
- [ ] Every result includes a non-medical-advice footer telling the user to consult a doctor or registered dietitian.
- [ ] The system handles non-food inputs, ambiguous foods, carbs-only meals, and A1C values outside 5.7-6.4 safely.
- [ ] The MVP is mobile-first and usable while standing in a kitchen, restaurant, or grocery store.
- [ ] The MVP can be deployed publicly via Vercel and shared in r/prediabetes without account creation.
- [ ] Founder can validate early demand through query count, shares, "paid version" requests, direct WTP conversations, and manual safety review.

### Out of Scope

- Photo scanner — table stakes for the future product, but not needed to validate permission framing.
- Native iOS or Android app — too slow for the 72-hour validation target.
- Authentication — account creation adds friction and is unnecessary for a signal tool.
- Database-backed user profiles — the MVP is stateless; personalization is limited to the submitted A1C.
- Payment integration — the MVP measures interest before adding Stripe or subscriptions.
- Type 2 diabetes support — Prediabetes Pal's wedge is newly diagnosed prediabetes, A1C 5.7-6.4.
- Clinical diagnosis or medical treatment advice — the product provides informational food guidance only.
- Predicted future A1C values — replaced by the future Behavioral Adherence Index concept because A1C prediction from GL adherence was unsupported.
- CGM integration — future full-product feature gated behind launch, revenue, and product-market fit.
- Healthcare-provider channel — long-term moat, not the initial acquisition channel before PMF.

## Context

98 million Americans have prediabetes, and many receive minimal guidance beyond "eat better." The lived pain is pre-meal paralysis: people Google "does this spike blood sugar?" multiple times per day, find contradictory answers, and default to avoidance. That shrinks diet variety, increases anxiety, and reduces food enjoyment.

The initial lead users are real people: the founder and the founder's aunt, both with prediabetes and both currently using Google as the meal-decision workaround. The target archetype is a newly diagnosed prediabetic adult, roughly 30-60, with a recent scary A1C reading and fear of progression to Type 2 diabetes.

Existing scanner apps such as Glycemic Snap, Logi, GluKee, and Index Scanner validate the photo + glycemic-load mechanic, but they are general food tools. Prediabetes Pal's bet is that the scanner is not the moat; prediabetes-specific permission, tone, and coaching are the reason users stay and pay.

The current recommended MVP is Approach A from the design doc: a one-page Next.js web app using the OpenAI API in text mode and Vercel deployment. The design review also suggested a lightweight telemetry variant, but any logging must avoid raw food text and raw A1C unless privacy posture is explicitly handled.

Evidence grounding matters. Sequencing guidance should be based on sources such as Shukla et al. 2019 and Imai et al. 2023. Future reversal-motivation copy should cite CDC DPP, Jenkins et al., or equivalent peer-reviewed evidence and must not fabricate a clinical prediction.

The success target for this MVP is not polished retention yet. It is WTP and usefulness signal: ship within 72 hours, post in r/prediabetes within one week, collect 50+ first-week queries, observe 5+ shares, see 3+ "is there a paid version?" requests, keep API costs under $20, and manually review early outputs for harmful SAFE classifications.

## Constraints

- **Scope**: Text-only Permission MVP — validates demand before scanner, auth, payments, or database work.
- **Timeline**: Ship within 72 hours — use boring web infrastructure and avoid nonessential architecture.
- **Audience**: Prediabetes only, A1C 5.7-6.4 — do not broaden to Type 2 or general wellness in v1.
- **Tone**: Permission-first — SAFE results should feel like a gift; MODERATE/HIGH should be direct but not alarming.
- **Safety**: Conservative on uncertainty — when uncertain or borderline, classify higher and recommend a practical adjustment.
- **Medical boundaries**: Informational guidance only — every result needs a doctor/RD consultation footer.
- **Evidence**: Use qualitative glycemic-impact language — do not hallucinate GL numbers or unsupported clinical claims.
- **Privacy**: A1C is health-adjacent data — avoid storing it in the MVP unless the privacy posture is deliberately designed.
- **Cost**: Expected OpenAI API exposure is low, but add rate limiting if usage exceeds roughly 2,000 queries in 24 hours.
- **Mobile UX**: Single-screen, high-contrast, large tap targets, no modal flow, no mobile auto-focus that obscures the page.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Build the Permission MVP before the full scanner app | The near-term question is whether permission-first prediabetes guidance creates WTP signal; scanner infrastructure can wait. | — Pending |
| Use text input instead of photo scanning for MVP | Text ships faster and tests the core emotional job without commodity scanner complexity. | — Pending |
| Use Next.js, OpenAI API text mode, and Vercel | Lowest-friction stack for a one-page AI web tool with public sharing. | — Pending |
| Do not add auth, database, or payments in MVP | Each adds friction or complexity before validating demand. | — Pending |
| Target r/prediabetes and similar communities first | Community distribution reaches lead users before healthcare-channel credibility exists. | — Pending |
| Keep healthcare channel for later | CDCE/PCP distribution is a moat after PMF, not the fastest path to early learning. | — Pending |
| Avoid predicted future A1C values | Prior formula was unsupported and would damage trust; use behavioral evidence instead. | — Pending |
| Use permission-first result framing | The product job is to reduce anxiety and enable informed moderation, not create more restriction. | — Pending |
| Resolve naming collision before full launch | "Glucosnap" was too close to Glycemic Snap; the current name is Prediabetes Pal. | — Pending |

---
*Last updated: 2026-05-04 after initialization*
