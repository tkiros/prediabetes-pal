import { describe, expect, it } from "vitest";

import {
  CARB_FORWARD_EXCLUSIONS,
  CARB_FORWARD_POLICY_VERSION,
  CARB_FORWARD_TOKENS,
  isCarbForward
} from "../../../lib/pal/input-precheck";

describe("CARB_FORWARD_TOKENS review surface", () => {
  it("has an explicit version and exported bounded vocabulary for panel review", () => {
    expect(CARB_FORWARD_POLICY_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}\.\d+$/);
    expect(CARB_FORWARD_TOKENS.length).toBeGreaterThan(30);
    expect(CARB_FORWARD_EXCLUSIONS.length).toBeGreaterThan(0);
    expect(new Set(CARB_FORWARD_TOKENS).size).toBe(CARB_FORWARD_TOKENS.length);
  });

  it.each([
    "salmon avocado sushi roll",
    "rice and dal",
    "jollof rice and chicken",
    "congee with egg",
    "naan with chana masala",
    "bean and rice burrito"
  ])("recognizes a culturally varied candidate carb-forward dish: %s", (food) => {
    expect(isCarbForward(food)).toBe(true);
  });

  it.each([
    "cauliflower rice bowl",
    "konjac rice with tofu",
    "shirataki noodles with vegetables",
    "lettuce wrap with chicken",
    "sweet potato and salmon",
    // G7: the plural escaped the singular exclusion under boundary matching
    // and hit the "potatoes" token.
    "roasted sweet potatoes and salmon"
  ])("honors a reviewed exclusion candidate: %s", (food) => {
    expect(isCarbForward(food)).toBe(false);
  });

  it("keeps flooring dishes where a token survives the exclusion strip", () => {
    // "sweet potato fries": the exclusion removes "sweet potato" but "fries"
    // is its own token — the floor must still see it.
    expect(isCarbForward("sweet potato fries")).toBe(true);
  });

  // 2026-07-16.1 cultural/staple stage (doc 18 F-1/F-2): every dish here was a
  // confirmed ontology false negative in the 240-case rehearsal — five of them
  // shipped a dangerous false "Clear". PENDING RD/CDCES confirmation (W-05).
  it.each([
    "salmon poke bowl",
    "ugali with sukuma wiki and grilled tilapia",
    "gallo pinto with eggs",
    "chicken kebab plate with tabbouleh",
    "injera with doro wat",
    "two cheese pupusas with curtido",
    "chicken biryani",
    "two pork tamales",
    "beef pho",
    "bibimbap with beef and a fried egg",
    "arroz con pollo",
    "plain dosa with sambar",
    "pierogi with sour cream and onions",
    "nasi goreng with a fried egg",
    "khao pad gai",
    "uzbek plov with lamb",
    "pancit bihon with chicken",
    "three mochi",
    "chicken pad thai from the thai place",
    "grilled pork banh mi",
    "a couple samosas",
    "1 cup cooked quinoa",
    "serving of raisin bran with skim milk"
  ])("recognizes rehearsal false-negative dish: %s", (food) => {
    expect(isCarbForward(food)).toBe(true);
  });

  // The `rotis` plural escape (doc 18 F-2) — plurals are now generated
  // mechanically for every boundary-matched term, never hand-listed.
  it.each([
    "dal with two rotis",
    "two tamales",
    "three tostadas",
    "fried plantains",
    "two idlis"
  ])("covers the plural form mechanically: %s", (food) => {
    expect(isCarbForward(food)).toBe(true);
  });

  // 2026-07-16.1 false floor-positive family (doc 18 F-2): the panel banded
  // each of these SAFE, and the floor firing on them produced the fabricated
  // "leans heavily on refined carbs" copy. PENDING RD/CDCES (W-05).
  it.each([
    "zucchini noodles with turkey meatballs",
    "zoodles with pesto and chicken",
    "shirataki rice stir fry with beef",
    "almond flour pancakes with sugar free syrup",
    "keto bread with butter",
    "low carb tortilla with eggs",
    "egg wraps with ham"
  ])("does not fire on low-carb impostor: %s", (food) => {
    expect(isCarbForward(food)).toBe(false);
  });

  it("keeps cauliflower crust pizza carb-forward — the cautious side of a split panel", () => {
    // Doc 18 grouped it with the SAFE-banded impostors; the 2026-07-16
    // flash-lite panel unanimously banded it MODERATE (starch binders in
    // commercial crusts). Two simulated panels disagreeing means the human
    // panel owns the call — until then the floor stays reachable.
    expect(isCarbForward("cauliflower crust pizza with chicken and spinach")).toBe(
      true
    );
  });

  // Negation (doc 18 F-2): an explicitly negated carb component must not
  // fire, and the bunless-burger idioms are spared entirely.
  it.each([
    "burger, no bun",
    "bunless burger with cheese",
    "grilled chicken, no rice",
    "carnitas bowl without rice or beans",
    "lettuce-wrapped burger"
  ])("does not fire on negated carb: %s", (food) => {
    expect(isCarbForward(food)).toBe(false);
  });

  it("negation only removes the negated word, not the dish", () => {
    expect(isCarbForward("taco, no lettuce")).toBe(true);
    expect(isCarbForward("burrito without sour cream")).toBe(true);
  });
});
