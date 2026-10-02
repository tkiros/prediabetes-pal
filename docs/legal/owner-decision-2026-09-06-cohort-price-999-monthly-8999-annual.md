# Owner decision — first paid cohort at $9.99/month; annual stays offered, at $89.99/year

**Recorded:** 2026-09-06
**Decided by:** workspace owner, in session (instruction quoted verbatim below)
**Recorded by:** the audit agent, for the owner's initials
**Supersedes, in part:** the 2026-07-10 annual-price decision ($99.99/year, previously the
`ANNUAL_PRICE` comment in `lib/server/pricing.ts`) and the `1299` code default
(`TRIAL_PRICE_VARIANT` unset → $12.99) that `docs/runbooks/price-test.md` §5 recorded.
**Context:** Decision A in
`docs/handoff/2026-09-06-prediabetes-pal-value-necessity-business-execution-plan.md` §2, which
recommended the retention memo's single $9.99 price with annual hidden for the cohort window.

## The instruction

> "go ahead and do the items in section 4. apply the $9.9 recommended price but the annual plan
> stays as option reduced to $89.99"

Read as: the existing `999` variant, $9.99/month (`STRIPE_PRICE_MONTHLY_999`). "$9.9" has no
other referent in the price ladder, and the recommendation being applied
(`docs/retention_flow.md` "Pricing recommendation") was $9.99. The annual plan remains offered,
at $89.99/year (was $99.99/year).

## What this decides

- **Monthly default.** `TRIAL_PRICE_VARIANT` unset now resolves to `999` ($9.99). `1299` and
  `1999` stay in the ladder for later, separately pre-registered windows.
- **Annual.** $89.99/year, monthly-equivalent $7.50. New env key `STRIPE_PRICE_ANNUAL_8999`; new
  metadata / `subscriptions.price_variant` stamp `annual_8999`. The key carries the amount, like
  the monthly ladder, so a deploy that lands before the Stripe price exists fails closed (annual
  hidden from the wall, annual checkout 503) instead of showing $89.99 and charging $99.99.
- **Existing subscribers keep their price.** Stripe subscriptions keep their price object;
  nothing migrates. Rows stamped `annual` still render `$99.99/year` in the pre-charge email
  (`priceVariantDisplay`), rows stamped `1299` still render `$12.99/month`, and the retired
  `STRIPE_PRICE_ANNUAL` id is still classified as annual by the webhook (`isAnnualPriceId`).
- **The one-price rule is overridden for annual.** `docs/retention_flow.md` asked for a single
  disclosed price in the first cohort. The owner keeps annual as an option. Consequences the
  cohort pre-registration must absorb before enrollment
  (`docs/research/retention-cohort-preregistration.md` §4.2, §5.1): disclose both prices; record
  plan (monthly vs annual) as an analysis stratum, or exclude annual buyers from the Track A
  primary outcome — an annual buyer cannot churn at D30/D60 and would inflate pooled D90.
- **No new claim.** The paywall card's "save about N% vs monthly" line is computed from the two
  live prices; nothing else names an amount (`tests/unit/pal/landing-paywall-copy.test.ts`).

## Before this takes effect in production (owner, in order)

1. **Stripe live:** create a recurring $89.99/year price on the existing product. The agent may
   not create or alter live Stripe objects.
2. **Vercel production env:** set `STRIPE_PRICE_ANNUAL_8999=<that price id>`; confirm
   `STRIPE_PRICE_MONTHLY_999` exists and is a live-mode id; leave `STRIPE_PRICE_ANNUAL` set
   (retired-price classification); unset `TRIAL_PRICE_VARIANT` or set it to `999` — if it is
   pinned to `1299` the code default is inert. Neither value could be verified from this
   session (production env listing was not permitted).
3. **Deploy.** Until step 2 is complete the deploy is safe but annual is hidden and annual
   checkout returns 503, by design.
4. **Log the window** in `docs/runbooks/price-test.md` §1.
5. **Copy:** `docs/product-marketing.md` updated in the same PR; no landing or paywall copy
   names a price.

## What this does not touch

- Claims boundary, RD/CDCES, counsel, privacy, accessibility gates: unchanged. A price is not a
  claim.
- The one-time Pantry Review price.
- The in-flight window: the product has been unreachable since 2026-08-25, so no annual trial
  can be pending a pre-charge email at the old amount; rows stamped `annual` before that date keep
  rendering $99.99/year regardless.

## Sign-off

Owner initials / date: ________
