import { describe, expect, it } from "vitest";
import {
  ANNUAL_PRICE,
  DEFAULT_PRICE_VARIANT,
  isAnnualPriceId,
  priceVariantDisplay,
  resolveAnnualPrice,
  resolvePriceVariant,
  RETIRED_ANNUAL_PRICE
} from "../../../lib/server/pricing";

describe("resolvePriceVariant", () => {
  // Owner decision 2026-09-06: the first paid cohort runs at $9.99.
  it("defaults to 999", () => {
    expect(DEFAULT_PRICE_VARIANT).toBe("999");
    expect(resolvePriceVariant({}).variant).toBe("999");
    expect(resolvePriceVariant({}).display).toBe("$9.99");
  });
  it("resolves the env-selected variant and its price id", () => {
    const r = resolvePriceVariant({
      TRIAL_PRICE_VARIANT: "1999",
      STRIPE_PRICE_MONTHLY_1999: "price_x"
    });
    expect(r).toEqual({ variant: "1999", priceId: "price_x", display: "$19.99" });
  });
  it("falls back to 999 on an unknown variant value", () => {
    expect(resolvePriceVariant({ TRIAL_PRICE_VARIANT: "699" }).variant).toBe("999");
  });
  it("still honours an explicit 1299 pin (production may keep it set)", () => {
    expect(resolvePriceVariant({ TRIAL_PRICE_VARIANT: "1299" }).display).toBe("$12.99");
  });
});

describe("annual price (owner decision 2026-09-06: $89.99, was $99.99)", () => {
  it("reads ONLY the amount-named env key — the retired var cannot sell $89.99", () => {
    expect(ANNUAL_PRICE.display).toBe("$89.99");
    expect(ANNUAL_PRICE.monthlyEquivalent).toBe("$7.50");
    // Retired key set, new key unset → fail closed (annual hidden, checkout 503).
    expect(resolveAnnualPrice({ STRIPE_PRICE_ANNUAL: "price_old_9999" }).priceId).toBeNull();
    expect(
      resolveAnnualPrice({ STRIPE_PRICE_ANNUAL_8999: "price_new_8999" }).priceId
    ).toBe("price_new_8999");
  });

  it("classifies both the current and the retired annual price id as annual", () => {
    const env = {
      STRIPE_PRICE_ANNUAL_8999: "price_new_8999",
      STRIPE_PRICE_ANNUAL: "price_old_9999"
    };
    expect(isAnnualPriceId("price_new_8999", env)).toBe(true);
    expect(isAnnualPriceId("price_old_9999", env)).toBe(true);
    expect(isAnnualPriceId("price_monthly", env)).toBe(false);
    expect(isAnnualPriceId(undefined, env)).toBe(false);
    // An unset var must never match an empty/undefined price id.
    expect(isAnnualPriceId("", {})).toBe(false);
  });
});

describe("priceVariantDisplay — a row renders what it was SOLD at", () => {
  it("names the current annual amount for new annual rows", () => {
    expect(priceVariantDisplay(ANNUAL_PRICE.variant)).toBe("$89.99/year");
  });
  it("keeps the retired $99.99 for rows stamped before 2026-09-06", () => {
    // Those subscriptions still renew at $99.99 on Stripe; the pre-charge email
    // must not announce a smaller charge than the one that will land.
    expect(priceVariantDisplay(RETIRED_ANNUAL_PRICE.variant)).toBe("$99.99/year");
  });
  it("keeps $12.99 for rows sold under the old monthly default", () => {
    expect(priceVariantDisplay("1299")).toBe("$12.99/month");
  });
  it("falls back to the current default for null/unknown monthly variants", () => {
    expect(priceVariantDisplay(null)).toBe("$9.99/month");
    expect(priceVariantDisplay("699")).toBe("$9.99/month");
  });
});
