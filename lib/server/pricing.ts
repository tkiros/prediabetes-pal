const VARIANTS = {
  "999": { display: "$9.99", envKey: "STRIPE_PRICE_MONTHLY_999" },
  "1299": { display: "$12.99", envKey: "STRIPE_PRICE_MONTHLY_1299" },
  "1999": { display: "$19.99", envKey: "STRIPE_PRICE_MONTHLY_1999" }
} as const;

export type PriceVariant = keyof typeof VARIANTS;

// Owner decision 2026-09-06
// (docs/legal/owner-decision-2026-09-06-cohort-price-999-monthly-8999-annual.md):
// the first pre-registered paid cohort runs at $9.99/month. 1299/1999 stay in
// the ladder for later, separately pre-registered windows
// (docs/runbooks/price-test.md). Production may still pin TRIAL_PRICE_VARIANT
// explicitly; this is only what an unset var resolves to.
export const DEFAULT_PRICE_VARIANT: PriceVariant = "999";

// One price per deployment window (matched cohorts — never two prices to one
// community at once). The variant is an env var; display + Stripe price ID both
// derive from it here, so the wall can never show a price checkout won't charge.
export function resolvePriceVariant(
  env: Partial<NodeJS.ProcessEnv> = process.env
): { variant: PriceVariant; priceId: string | null; display: string } {
  const raw = env.TRIAL_PRICE_VARIANT ?? DEFAULT_PRICE_VARIANT;
  const variant: PriceVariant =
    raw in VARIANTS ? (raw as PriceVariant) : DEFAULT_PRICE_VARIANT;
  return {
    variant,
    priceId: env[VARIANTS[variant].envKey] ?? null,
    display: VARIANTS[variant].display
  };
}

// Annual plan (owner decision 2026-09-06, superseding 2026-07-10's $99.99):
// one price, no variants. Display values live ONLY here — the wall, the legacy
// paywall, and checkout all derive from this so no surface can show a price
// checkout won't charge.
//
// The env key carries the amount, like the monthly ladder, on purpose: a deploy
// that lands BEFORE the owner creates the $89.99 Stripe price and sets the new
// var fails CLOSED — annual disappears from the wall (app/api/paywall gates on
// priceId) and annual checkout 503s — instead of showing $89.99 and charging
// the retired $99.99 price that `STRIPE_PRICE_ANNUAL` still points at.
export const ANNUAL_PRICE = {
  display: "$89.99",
  monthlyEquivalent: "$7.50",
  envKey: "STRIPE_PRICE_ANNUAL_8999",
  // Stamped into Stripe subscription metadata → subscriptions.price_variant at
  // checkout, so the pre-charge email can name the amount this row will charge.
  variant: "annual_8999"
} as const;

// Retired 2026-09-06. Rows stamped price_variant "annual" were sold at this
// price and keep renewing at it on Stripe, so their pre-charge email must keep
// saying so, and the webhook must keep classifying that price id as annual.
// The env var may stay set in production for exactly that; nothing sells off it.
export const RETIRED_ANNUAL_PRICE = {
  display: "$99.99",
  envKey: "STRIPE_PRICE_ANNUAL",
  variant: "annual"
} as const;

export function resolveAnnualPrice(
  env: Partial<NodeJS.ProcessEnv> = process.env
): { priceId: string | null; display: string; monthlyEquivalent: string } {
  return {
    priceId: env[ANNUAL_PRICE.envKey] ?? null,
    display: ANNUAL_PRICE.display,
    monthlyEquivalent: ANNUAL_PRICE.monthlyEquivalent
  };
}

/**
 * True when `priceId` is the current OR the retired annual Stripe price. Used
 * by the webhook reducer to stamp `premium_annual`; a replayed checkout for a
 * pre-2026-09-06 annual subscriber must not be mislabelled monthly.
 */
export function isAnnualPriceId(
  priceId: string | null | undefined,
  env: Partial<NodeJS.ProcessEnv> = process.env
): boolean {
  if (!priceId) return false;
  return [ANNUAL_PRICE.envKey, RETIRED_ANNUAL_PRICE.envKey].some(
    (key) => !!env[key] && env[key] === priceId
  );
}

// Trial is the launch funnel (owner decision 2026-07-07): Day-1 free taste →
// Day-2 wall → 7-day trial → paid. `PAYWALL_MODE=legacy` is the explicit
// escape hatch back to the old 5-checks/day free tier, kept for rollback and
// for the legacy-mode test server.
export function paywallMode(env: Partial<NodeJS.ProcessEnv> = process.env): "legacy" | "trial" {
  return env.PAYWALL_MODE === "legacy" ? "legacy" : "trial";
}

// Single source for the human-readable price of a stored variant. The price
// ladder lives only in VARIANTS (never hard-coded twice); callers that have a
// persisted `price_variant` (e.g. the pre-charge email) derive display from
// here. A row is charged what it was SOLD at, so the retired annual variant
// still renders its own amount. Unknown/null monthly variants fall back to the
// default variant. Returns the amount WITH its billing period ("$9.99/month",
// "$89.99/year") so the pre-charge email can't mislabel an annual charge as
// monthly.
export function priceVariantDisplay(variant: string | null | undefined): string {
  if (variant === ANNUAL_PRICE.variant) {
    return `${ANNUAL_PRICE.display}/year`;
  }
  if (variant === RETIRED_ANNUAL_PRICE.variant) {
    return `${RETIRED_ANNUAL_PRICE.display}/year`;
  }
  const monthly = (variant != null && variant in VARIANTS
    ? VARIANTS[variant as PriceVariant]
    : VARIANTS[DEFAULT_PRICE_VARIANT]
  ).display;
  return `${monthly}/month`;
}
