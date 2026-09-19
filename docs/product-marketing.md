# Revora Product Marketing Context

> **Active source of truth — 2026-07-12.** This document supersedes all legacy
> positioning files. `docs/safety/claims-boundary.md` controls intended use,
> verdict semantics, and claim limits. No archived or superseded copy may be
> reused without passing the active claims audit.

## Product in one line

Revora gives adults using a prediabetes-range A1C a cautious, plain-language
educational read on a meal's overall composition, plus practical ways to make
the meal more balanced.

## Intended use

Revora provides general educational information about meal composition. It
uses a user-provided A1C range only to apply a more cautious educational
presentation. Its labels describe general meal patterns; they do not establish
personal safety, clinical suitability, an individual glucose response, or a
future laboratory result.

## Product truth

- Candidate inputs: text and voice-to-reviewed-text. Meal photo-assist exists
  behind a fail-closed owner/evidence gate and is not an advertised launch feature.
- Core output: `Clear`, `Be careful`, or `Hold off`, followed by a reason and,
  where appropriate, an adjustment or practical alternative.
- The labels are educational meal-pattern categories. They are not personal
  physiologic measurements or medical instructions.
- Accounts add encrypted history, progress based only on in-app behavior, and
  an optional reminder. Longitudinal insights exist behind a fail-closed
  owner/evidence gate and are not an advertised launch feature.
- Premium adds unlimited checks and the account features shown at checkout.
- Pantry Review is a separate one-time, non-renewing educational report.

## Audience

Primary audience: US adults, generally 40–60, who already have an A1C in the
`5.7%–6.4%` range and want clearer general meal-composition information after
receiving broad “eat better” guidance.

Out of scope:

- children;
- people seeking emergency, medication, or clinical-care decisions;
- Type 1 or Type 2 diabetes management;
- screening or interpreting whether someone has a condition;
- individual glucose or laboratory forecasting.

## Positioning

**Category:** cautious educational meal companion for the prediabetes A1C
range.

**Primary message:**

> Check a meal. Understand its balance in plain language.

**Supporting message:**

> Describe the meal by text or voice. Revora labels
> the general meal pattern, explains why, and offers a practical alternative
> when appropriate.

**Trust message:**

> The A1C range only makes the presentation more cautious. Revora does not
> predict your individual response or decide whether a meal is medically
> appropriate for you.

## Verdict language

| Public label | Marketing meaning |
| --- | --- |
| `Clear` | The described meal appears generally balanced under Revora's documented meal-composition rules. |
| `Be careful` | The description leans toward a concentrated or less-balanced pattern where an adjustment may be useful. |
| `Hold off` | The description warrants Revora's most cautious educational presentation because it is unusually concentrated or materially incomplete. |

Never market these labels as proof that a meal is safe or unsafe for an
individual.

## Evidence discipline

- Every objective statement must map to `docs/safety/evidence-pack.md`.
- Public-health and nutrition sources support narrow educational statements;
  they do not prove a Revora product outcome.
- Population-study percentages belong only in evidence explanations with
  explicit attribution and limitations, never in acquisition copy.
- Accuracy, precision, member-result, and disease-outcome claims are off-limits.
- A disclaimer never expands the allowed claim boundary.

## Offer and pricing

- Guest: first-day checks without an account or card.
- Trial: seven days free, with the selected post-trial price and first-charge
  date shown before checkout.
- Premium: `$9.99/month` or `$89.99/year` (owner decision 2026-09-06), subject to the live checkout price.
- Pantry Review: `$49` one-time, non-renewing purchase.
- Cancellation: directly available from Account or Google Play.
- Web refund policy: the first paid subscription charge is refundable when
  requested within seven calendar days; duplicate, unauthorized, mandatory-law,
  and confirmed material-service-failure cases are handled as stated in Terms.

Pricing remains a commercial hypothesis until real conversion and retention
data exist. Never describe price acceptance, traction, or willingness to pay as
validated before measurement.

## Claim bans

Do not publish:

- disease reversal, reduction, avoidance, or future-test promises;
- “normal at every test” or equivalent outcome language;
- personalized spike, glucose, A1C, GI, GL, or timing predictions;
- “clinically proven,” regulatory-status declarations, or clinician endorsement;
- “safe for your blood sugar,” “exactly what to eat,” or equivalent personal-
  suitability language;
- claims that changing the grammatical agent from Revora to the user makes a
  disease-outcome statement acceptable.

## Approved acquisition copy

**Headline:**

> Check a meal. Understand its balance in seconds.

**Body:**

> Type it or say it. Revora gives you a cautious
> educational label, explains the meal pattern it noticed, and offers one
> practical alternative when appropriate.

**Limitation:**

> These labels describe general meal patterns. Your A1C range only makes the
> presentation more cautious; Revora does not predict your individual response
> or decide whether a meal is medically appropriate for you.

**CTA:**

> Check your first meal — free

## Launch gate

Marketing is ready only when:

1. all active product, store, support, email, and campaign surfaces pass the
   repository claims audit;
2. the live product matches the intended-use statement;
3. every paid flow shows price, renewal, trial, cancellation, and refund terms
   before affirmative acceptance;
4. meal photo-assist and longitudinal insights remain unadvertised and
   fail-closed unless each production flag, evidence review, and written
   function-specific evidence review and explicit written owner approval are green;
5. privacy and data-safety disclosures match the launch revision.
