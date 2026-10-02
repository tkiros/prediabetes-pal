/**
 * The GDM door's Tier 1 copy bank (PRD GDM v1.1 §7.4: "Bounded banks, never
 * free generation, for every product-authored string").
 *
 * Keyed by copy-ledger Copy ID; each row is a record of NAMED strings, so a
 * component reads `GDM_COPY["gdm-door-name"].home`, never an index. The row's
 * strings IN DECLARATION ORDER are the ledger's Copy cell:
 * tests/unit/pal/gdm-copy.test.ts asserts the cell equals
 * `Object.values(row).join(" · ")`, so the ledger and the source cannot drift,
 * and that lib/gdm-door-flag.ts lists exactly these rows. Components import
 * from here and carry no literal copy of their own.
 *
 * Every row ships `Pending | Yes`, class `gdm-organiser`. Rules (PRD §8): no
 * sentence about a reading, a dose, a delivery decision, the pregnancy or the
 * baby; no digit; no grading word; nothing framed as a reduction.
 */
export const GDM_COPY = {
  "gdm-door-name": {
    name: "Gestational Diabetes Organiser",
    skip: "Skip to content",
    short: "Organiser"
  },
  "gdm-landing-hero": {
    line: "Told you have gestational diabetes and waiting for your dietitian? Keep your plan, your meals and your questions in one place, from today.",
    cta: "Sign up"
  },
  "gdm-landing-points": {
    plan: "A place for what your care team gives you, in their words.",
    meals: "A list of the meals you already eat, grouped the way your day runs.",
    asks: "Somewhere to put a question the moment you have it, ready for your appointment.",
    scope: "An organiser. No food guidance."
  },
  "gdm-landing-holding": {
    line: "You are signed in. The organiser is not open yet, and we cannot email you when it is. This page will show it as soon as it opens."
  },
  "gdm-disclaimer": {
    line: "This organiser keeps your own notes. It is informational only and is not medical advice. Your care team is the place for anything about your care."
  },
  "gdm-maker": {
    line: "From the makers of Prediabetes Pal."
  }
} as const satisfies Record<string, Record<string, string>>;
