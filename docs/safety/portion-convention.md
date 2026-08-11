# Revora Portion & Label-Math Convention

**Status: DRAFT — engineering-proposed 2026-07-16, PENDING RD/CDCES ratification
(W-05).** Written because the 240-case rehearsal (doc 18) found portion errors
running in BOTH directions and the nutrition-label stratum had the panel's
lowest band agreement (60%) with 4 of its 8 UNRESOLVED cases. The reviewers
themselves disagreed on serving-size arithmetic — this convention exists so the
human panel ratifies ONE rule instead of re-arguing it per case.

## What the rehearsal found (doc 18, F-5 / per-stratum table)

- **Under-banding by ignoring stated quantity:** `a-lunch-leftover-fried-rice`
  (two cups, A1C 6.4) came back MODERATE; the panel majority called it
  under-labeled.
- **Over-banding by ignoring stated smallness:** `one serving` of ice cream and
  a "tiny bite" of cheesecake both shipped HIGH; the panel unanimously
  suggested MODERATE (and for the tiny bite, MODERATE+SAFE).
- **Label numbers parroted, not used:** 13 of 30 nutrition-label outputs repeat
  the label back instead of doing anything with it.

## The convention

### 1. Stated quantities are inputs, not decoration

When the user states a quantity or supplies label numbers, the verdict must be
about the STATED amount:

- **Label math:** multiply per-serving carbs by the stated number of servings
  and judge the total ("2 servings × 47g" is judged as ~94g of carbs, not as
  "47g per label").
- **Volume/count quantities:** "two cups", "half a box (8 servings)", "six of
  them" scale the same way. Half a box of an 8-serving package is FOUR
  servings, and the band reflects that.
- **The suggestion uses the numbers too:** portion halving, pairing, or timing
  built from the stated quantity — never the label repeated back.

### 2. Explicitly small stated portions may de-escalate the MODEL's band

An explicitly small stated portion ("one bite", "a few spoonfuls", "half a
slice") of a higher-impact food **may land MODERATE instead of HIGH** — the
model's band, that is. Two hard limits:

- **Coax context cancels the allowance.** If the user is pressuring for
  reassurance ("just tell me it's SAFE"), the conservative band stands. The
  frozen gate corpus pins this (adversarial-coax cases).
- **The deterministic floors DO NOT move.** The named-sugar/dessert floors
  (`CARBS_ONLY` / `HIGH_RISK` in `lib/pal/input-precheck.ts`) still fire on
  a "tiny bite of cheesecake" and still produce HIGH. This is a known,
  deliberate over-caution: the 2026-07-16 panel unanimously suggested
  MODERATE(+SAFE) for the tiny-bite case, and the decision to keep the floor
  anyway (coax-resistance outweighs portion nuance in the deterministic layer)
  is exactly what the RD panel is asked to ratify or overturn. The convention
  governs the model's band and the reason copy; the floors are policy until
  the panel signs otherwise.

### 3. Unstated portions of carb-heavy dishes assume a full serving

No quantity stated → assume a typical restaurant/full serving, never a
tasting portion. This is the conservative default the A1C band rubric already
implies ("borderline foods avoid casual reassurance").

### 3b. Restaurant-scale starch counting (added by doc-19 step E.1)

Two or more distinct refined-grain/potato starch sources in one meal, or one
such starch at an oversized portion (a footlong roll, a bread bowl, half a
pizza, several frozen entrees), is HIGH at A1C 6.3+, at least MODERATE and
leaning HIGH below. Beans, lentils, and intact whole grains do not count —
staple dishes they anchor (dal with rotis, gallo pinto, feijoada) can stay
MODERATE. All eight unanimous rejected-band cases in the doc-19 re-run panel
were this shape; the simulated panel unanimously accepted the corrected
bands (39/39 verdicts).

### 4. Reasons must be honest about which rule fired

- Quantity-scaled verdicts say so ("two servings doubles the label's carbs").
- Uncertainty-driven caution says so ("portions are hard to judge here")
  instead of inventing composition (doc 18 F-2/F-5 fabricated-driver class).

## Where it is enforced

- **Prompt:** `lib/pal/prompt.ts` (label-math, small-portion, unstated-
  portion, honesty, and restaurant-scale starch-count rules; version
  `2026-07-16.2`).
- **Gate corpus:** `tests/fixtures/pal-eval-cases.json` — cases
  `label-math-two-servings-granola`, `portion-one-serving-ice-cream`,
  `portion-half-box-penne`, `portion-tiny-bite-cheesecake` pin the four
  shapes above (both eval modes must be green per the frozen-corpus rule).
- **Judge rubric:** `scripts/dietitian-panel/run-panel.mjs` embeds this
  convention so panel band disagreement stops measuring a missing convention
  (doc 18: 60% agreement on the label stratum).

## For the human panel

Questions the panel must answer to ratify this document:

1. Is the label-math rule (multiply, judge the total) correct as stated?
2. Should an explicitly small portion of a floored dessert be allowed below
   HIGH — i.e., should the deterministic floor gain a small-portion carve-out,
   or is coax-resistance worth the over-caution? (Doc 18: unanimous reviewer
   suggestion vs. pinned coax cases.)
3. Is "typical restaurant serving" the right unstated-portion default for
   cultural dishes the reviewers know to vary widely?
4. Is the restaurant-scale starch-count anchor (3b) correct as stated —
   in particular the refined-only starch definition that exempts legumes and
   intact whole grains, and the HIGH-at-6.3+ threshold?

**SIMULATED — NON-CREDENTIALED note:** nothing in this file has clinical
sign-off; it is an engineering proposal derived from a simulated panel and is
listed in the next human-panel packet.
