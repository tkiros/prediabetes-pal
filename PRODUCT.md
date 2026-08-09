# Product

## Register

product

## Users

Recently-diagnosed "trying hard but flying blind" prediabetics — US adults, sweet spot 40–60, A1C 5.7–6.4% in the last ~6 months, handed vague "eat better, come back in six months" advice. Context of use: the moment of a meal decision (dinner table, grocery aisle, restaurant), phone in hand, anxious. The job: "should I eat this, now?" — answered in ~5 seconds with one calm verdict and one concrete action. (Source: docs/product-marketing.md, docs/ICP.md.)

## Product Purpose

<!-- claims-audit:start -->
A prediabetes-exclusive daily decision coach — not a tracker, not a calorie counter. The wedge is the meal-moment check: Clear / Be careful / Hold off, plus why, plus — when there is one — something to adjust and a safer swap. (A Clear verdict carries no adjustment and no swap. That is enforced in code, not left to the copywriter, so no surface may promise either one unconditionally. See F-04.) The moat is the daily relationship: memory, patterns, gentle nudges, visible evidence of okay-ness over time.

The user is always the agent; Prediabetes Pal never is. Prediabetes Pal's whole job is to give you the clarity to make your own choices — it does not claim credit for what follows from them, and no Prediabetes Pal surface may name an outcome it brings about.
<!-- claims-audit:end -->

## Rejected claims — do not reintroduce

**This section is the one place in this file that names rejected copy, and it is deliberately outside the audit fence. Nothing below may be lifted into product copy, a brief, or a store listing.**

This file used to enshrine, under "Product Purpose", a sentence labelled **"Legal North Star, verbatim"**. That sentence is **REJECTED**. It is recorded as Rejected in `docs/safety/copy-ledger.md` (row `onboarding-reversal-line`), was removed from `app/(app)/onboarding/page.tsx` on 2026-07-06 under counsel guidance (launch audit BUG-05), and is still **pending counsel Q8** (`docs/legal/counsel-brief.md`). `docs/ops/play-listing.md` bans it from the store listing by name.

It was left standing here, framed as a verbatim North Star, for five weeks after counsel pulled it. That is the actual finding (F-25): PRODUCT.md is the brief — it is the first thing a new contractor, agent, or copywriter reads and the last place anyone thinks to check for stale claims. A rejected claim sitting in the brief under the words "Legal North Star, verbatim" is the single most likely way it gets typed back into shipping copy. The claim itself never rendered to a user; the *document* was the vector.

The rule, stated positively so it needs no forbidden words to express: **Prediabetes Pal is never the agent of a health outcome — only the user is.** Any sentence that makes Prediabetes Pal, or the app's use, the thing that achieves an outcome is out of bounds, whatever verb it uses. See `docs/safety/claims-boundary.md` §Banned Claim Families for the enumerated vocabulary; `tests/unit/revora/claims-boundary-copy.test.ts` enforces it across `app/**`, `components/**`, and the fenced regions of this file and the Play listing.

If counsel Q8 ever comes back approving that line, the ledger row moves to Approved **first**, with sign-off recorded — and only then may any surface use it.

## Brand Personality

Calm, honest, permission-first. Grants calm permission or gives one clear next action — never restriction-first, never hype. Says "we're unsure" when unsure (honesty is the differentiator; the audience is burned by accuracy over-claims). Three words: calm, candid, steady.

## Anti-references

- Calorie counters and macro trackers (MyFitnessPal energy) — Prediabetes Pal is a decision coach, not a ledger.
- Gamified streak apps (Duolingo-style loss-aversion mechanics) — users are anxious by definition; broken-chain pressure is the enemy.
- Generic SaaS dashboard aesthetics: card mosaics, icon-in-circle decoration, centered-everything, decorative gradients (DESIGN.md §App-UI guardrails is binding).
- Medical-portal coldness — clinical-grade honesty without clinical-grade sterility.

## Design Principles

1. **Permission-first.** Lead with what the user CAN do/eat. Every screen grants calm permission or gives one clear next action.
2. **Reassurance surface, not gamification surface.** Progress UI shows additive evidence of okay-ness; nothing can "break," blank days are neutral, never red.
3. **Document, not dashboard.** Content surfaces read like a calm lab letter, not a widget wall. Cards earn existence.
4. **Credibility is honesty.** No fabricated data, no unlabeled examples, no accuracy promises; uncertainty is stated plainly.
5. **The tool disappears into the task.** Utility language (orientation, status, action); the check is always one tap away.

## Accessibility & Inclusion

WCAG AA contrast on all text (verdict token pairs are AA-verified in DESIGN.md). 44px minimum touch targets globally. Verdict color is never the sole information channel (text labels / aria-labels accompany every colored indicator). `prefers-reduced-motion: reduce` zeroes all motion (mandatory, never remove). Focus visible everywhere; `aria-live="polite"` for status updates. Health information never rendered in low-contrast hint styles.
