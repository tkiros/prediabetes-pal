# Revora — Google Play Store Listing Draft

> **Active claims-controlled draft — 2026-07-12.** Paste only after replacing
> placeholders and confirming the advertised production feature flags. This
> file is included in the automated marketing-claims audit. Only text inside
> `claims-audit` fences may be pasted into Play Console.

## 1. App title

> **AMENDED 2026-08-08.** Was `Revora — Prediabetes Coach`. "Coach" was the
> pre-pivot noun and this was the last surface still carrying it: `app/layout.tsx`
> has said `Revora — Prediabetes Meal Checker` since the pivot, and the landing
> H1 reads "A meal checker built only for prediabetes." A store title that names
> a different product than the page it links to is the one drift a reviewer sees
> first. "Coach" also over-promises a relationship the product does not have —
> it returns one card and stops.
>
> ⛔ **29 CHARACTERS, AND THAT IS THE BINDING CONSTRAINT. Play Console caps the
> app title at 30.** The obvious fix — matching `app/layout.tsx`'s
> `Revora — Prediabetes Meal Checker` exactly — is **33** and would be rejected
> at submission. Nothing in `npm run contract` measures length: the validator
> reads the Copy for claims, so this fails at the Play Console paste box, not in
> CI. **Count before you edit this line.**
>
> ⛔ **`Revora: Prediabetes Checker` (27) was REJECTED and must not be
> reintroduced as "the shorter one".** It fits, and it reads as *a checker for
> prediabetes* — a screening claim, which is the first banned family in
> `claims-boundary.md`. The word **meal** is what keeps the object of the verb
> the food and not the reader. Any shortening keeps it.
>
> The em dash went, not a word: ` — ` costs three characters and a space costs
> one, and Play titles are conventionally unpunctuated. "Check" over "Checker"
> is the last character. If the owner prefers the em dash, `Revora — Meal Check`
> (19) fits and drops the condition instead — worse for store search, which is
> why this version keeps it.

<!-- claims-audit:start -->
**Revora Prediabetes Meal Check**
<!-- claims-audit:end -->

## 2. Short description

<!-- claims-audit:start -->
**Check a meal and understand its general balance in plain language.**
<!-- claims-audit:end -->

## 3. Category

**Health & Fitness**

## 4. Full description

<!-- claims-audit:start -->
> **Check a meal. Understand its balance in seconds.**
>
> Type a meal or say it before submitting it.
> Revora returns one cautious educational label—**Clear**, **Be careful**, or
> **Hold off**—with a plain-language reason and, when appropriate, a practical
> adjustment or alternative.
>
> **Built for adults using a prediabetes-range A1C**
>
> Revora accepts an A1C from `5.7%–6.4%`. The range only makes the educational
> presentation more cautious; it is not used to predict your individual
> response. Outside that range, Revora stops and points you to a doctor or
> registered dietitian instead of returning a meal label.
>
> **What a check includes**
>
> - A general meal-pattern label: Clear, Be careful, or Hold off
> - A short explanation of the composition Revora noticed
> - A practical adjustment or alternative when appropriate
> - A clarification question when the meal description is incomplete
> - No calorie target, glucose forecast, or future laboratory prediction
>
> **Guest and Premium use**
>
> Try Revora as a guest without an account. You get 10 free checks on your first day, stored on that device. Premium adds unlimited checks,
> encrypted cross-device history, a behavior-only progress view, and an
> optional daily reminder. The purchase
> screen shows the price, billing interval, trial and first-charge terms,
> automatic renewal, refund policy, and cancellation path before you agree.
>
> **Honest limits**
>
> Revora provides general educational information about meal composition. Its
> labels do not establish that a meal is medically appropriate for you and do
> not forecast your individual glucose response. Revora is informational only
> and is not medical advice. Talk with a doctor or registered dietitian for
> guidance specific to you.
>
> **Privacy and control**
>
> With explicit consent, saved A1C and meal text are encrypted at rest. You can
> withdraw saved-health-data consent and erase that data while keeping your
> login, or delete your whole account in the app. Revora does not sell personal
> information or show ads.
<!-- claims-audit:end -->

## Search terms

<!-- claims-audit:start -->
`prediabetes` · `A1C` · `meal composition` · `food education` · `meal check`
· `balanced meals`
<!-- claims-audit:end -->

Do not use disease-outcome, personal-safety, predicted-response, clinical-proof,
or regulatory-status keywords.

## Health-app declaration

<!-- claims-audit:start -->
> Revora is an informational wellness product for adults who provide an A1C in
> the `5.7%–6.4%` range. It describes general meal-composition patterns and uses
> the A1C range only to apply a more cautious educational presentation. It does
> not make medical determinations, provide clinical care, forecast an
> individual physiologic response, or replace a doctor or registered
> dietitian. Every substantive result includes the in-app informational-use
> disclosure.
<!-- claims-audit:end -->

## Data Safety

Complete the Play Console form from `docs/ops/play-twa-runbook.md` §9.2 after
confirming it matches `/privacy` and `docs/privacy/data-flow.md`. Do not submit
if the three surfaces disagree.

## Screenshot list

Use only the seeded reviewer account and no real user data:

1. Empty meal-check form showing enabled input methods.
2. Clear educational result with its limitation text visible.
3. Be careful educational result with a practical alternative.
4. Today view with seeded history.
5. Encrypted-history explanation or History view.
6. Behavior-only progress view.
7. How It Works evidence-and-limitations section.
8. Purchase screen with price, renewal, trial, cancellation, refund, and Terms
   acceptance visible.

Meal photo-assist and longitudinal insights are omitted from this candidate
listing. Do not add either unless its production flag, evidence review, and
explicit written owner approval are all green at the submitted revision.

## Reviewer access

- **Email:** `reviewer@revora.test`
- **Secret:** `<REVIEWER_TEST_SECRET>`
- **Instructions:** “Open Sign in, choose Reviewer access, and enter the email
  and code. The reviewer account is fully onboarded and has test Premium access;
  no purchase is required.”

The reviewer shortcut must remain preview/review-only and unavailable in the
public production environment.

## Required URLs

- Account deletion: `https://<domain>/account/delete`
- Privacy: `https://<domain>/privacy`
- Terms: `https://<domain>/terms`

## Paste-in gate

- [ ] Real domain replaces every placeholder.
- [ ] `LEGAL_ENTITY_NAME` and `SUPPORT_EMAIL` are configured in production.
- [ ] Store text matches the live intended use and enabled features.
- [ ] Claims audit passes.
- [ ] Data Safety, Privacy, and data-flow documentation agree.
- [ ] Purchase and cancellation flows pass on a real Play-installed build.
