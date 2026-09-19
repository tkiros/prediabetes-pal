# Owner decision (PROPOSED) — the product is a 90-day program plus optional maintenance, not an open-ended subscription

**Drafted:** 2026-09-06 by the audit agent · **Status:** awaiting owner signature — nothing here is in force until initialled
**Context:** Decision C in `docs/handoff/2026-09-06-prediabetes-pal-value-necessity-business-execution-plan.md` §2; recommendation in `docs/retention_flow.md` ("Choose the 90-day program plus optional maintenance model").

## What is true today

- The journey code already implements the shape: `lib/journey/state.ts` — five stages over `JOURNEY_LENGTH_DAYS = 90`, `graduate` from day ≥ 1, `graduated → maintenance`; pause freezes the day count.
- Billing does not know about it: graduation "doesn't change billing" (`docs/Revora_Targeting_Correction_Playbook.md` §0), the paywall sells `$X/month` and `$Y/year` with no end date, and the pre-registration separates Track A (program, D7–D90) from Track B (maintenance, D180/D365) precisely so the two are never pooled.
- The retention memo's finding, unrefuted: recurring value fades once a user has learned their common meals; an indefinite subscription is "not recommended now".

## Proposed decision

**Adopt the program model as the product definition and the cohort's measurement frame.**

1. **Definition.** Prediabetes Pal is a 90-day meal-confidence program that ends in graduation, followed by an optional lighter maintenance service. Graduation is the intended outcome, reported as success, never as churn (protocol §4.6, §6).
2. **Measurement first, copy later.** The Phase 5 cohort is enrolled and reported under this frame (Track A = program; Track B = maintenance, offered only after Day 90). No landing, paywall, or email copy changes until RD/CDCES and counsel review the wording — "program", "graduation", and anything implying a health outcome are claims-boundary territory.
3. **Billing shape to design after the cohort reports** (not now): a finite 90-day price or three monthly cycles with an explicit end, then a separately priced maintenance plan. Until then the current monthly/annual subscription stays as the billing mechanic; annual buyers are stratified or excluded in Track A (see Decision A).
4. **Exit condition.** If Track A reports in the pre-registered STOP band, the program framing is not rescued by copy; the owner re-runs the office-hours questions before any further spend (60-day roadmap kill rule).

## What this does not touch

- Any user-facing text. This is an internal product definition and a reporting frame.
- Safety, claims, privacy, and accessibility gates. All remain open and govern every word that would eventually describe the program.
- Existing subscribers' billing.

## Sign-off

Owner initials / date: ________
