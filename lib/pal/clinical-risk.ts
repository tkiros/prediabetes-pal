/**
 * Deterministic clinical-risk router (F-09/F-10, W-01).
 *
 * Prediabetes Pal models *food* risk. It has never modelled *clinical* risk — so before
 * this router existed, "I'm shaky, sweating and confused, should I eat this
 * donut?" was answered with a calm dietary card. The system had no path that
 * could say anything else, because the precheck's outcome union was food-only
 * and the model's schema was food-only.
 *
 * Design constraints, in priority order:
 *
 * 1. **Deterministic.** No model call on a clinical route. A model that is
 *    asked to recognise an emergency will eventually fail to; a regex will not.
 *    This also means a clinical route costs nothing and cannot time out.
 *
 * 2. **Runs first.** `service.ts` calls this before the A1C route and before
 *    the food precheck, which is what gives medical precedence for free: a
 *    message carrying both a valid meal and a medical question ("2 slices of
 *    pizza, how much insulin should I take?") can never reach the meal model.
 *
 * 3. **Word-boundary matching.** `input-precheck.ts` matches with bare
 *    `String.includes()`, which is why "jelly beans" satisfies the "beans"
 *    protein buffer (N-17). A substring match here would be far worse — a
 *    "coma" match inside "Coma­n­dante", a "dka" inside "vodka" — so every
 *    pattern below is anchored with \b or an explicit boundary class.
 *
 * 4. **Non-generative copy.** The response text comes from the copy ledger,
 *    not from a model. See docs/safety/copy-ledger.md rows `clinical-*`.
 *
 * The class list and required behaviours come from docs/qa/sol_deep_analysis.md
 * §4. Response copy is drafted from CDC diabetic-ketoacidosis guidance and
 * NIDDK hypoglycaemia guidance and is PENDING dietitian/CDCES sign-off (W-05).
 */

/**
 * Routes in strict precedence order. First match wins, so the order IS the
 * policy: a message mentioning both vomiting and pregnancy is an urgent-care
 * message that happens to mention pregnancy, not the reverse.
 */
export const CLINICAL_ROUTES = [
  "urgent_symptoms",
  "possible_hypoglycemia",
  "medication_dosing",
  "eating_disorder",
  "pregnancy",
  "organ_disease",
  "allergy",
  "diagnosed_diabetes",
  "pediatric"
] as const;

export type ClinicalRoute = (typeof CLINICAL_ROUTES)[number];

/**
 * Patterns per route. Each entry is matched against the lower-cased input.
 *
 * Deliberately includes casual phrasing and common misspellings — the eval
 * corpus red-teams each class with ≥5 paraphrases, and a router that only
 * recognises clinical vocabulary would miss every real user, who writes
 * "gonna pass out" rather than "presyncopal".
 */
const ROUTE_PATTERNS: Record<ClinicalRoute, RegExp[]> = {
  // Vomiting, confusion, breathing difficulty, inability to keep fluids down.
  // Anything here means "stop reading a food app and get help".
  urgent_symptoms: [
    // Vomiting is an emergency signal — UNLESS it is self-induced, which is a
    // disclosure of purging and belongs to the eating-disorder route. Urgency
    // outranks that route, so the discriminator (intentionality) has to live
    // here, in the pattern, or "I make myself throw up after meals" gets
    // answered with "call your local emergency number".
    /(?<!\bmyself\s)\bvomit(?:ing|ed|s)?\b/,
    /(?<!\bmyself\s)\bthrow(?:ing)?\s+up\b/,
    /(?<!\bmyself\s)\bthrew\s+up\b/,
    /\bcan'?t\s+keep\s+(?:anything|food|fluids?|water|liquids?)\s+down\b/,
    /\bkeep(?:ing)?\s+nothing\s+down\b/,
    /\bconfus(?:ed|ion)\b/,
    /\bdisorient(?:ed|ation)\b/,
    /\bcan'?t\s+(?:breathe|breath)\b/,
    /\btrouble\s+breathing\b/,
    /\bshort(?:ness)?\s+of\s+breath\b/,
    /\bchest\s+pain\b/,
    /\bpassing\s+out\b/,
    /\bpass(?:ed)?\s+out\b/,
    /\bfaint(?:ed|ing)\b/,
    /\bunconscious\b/,
    /\bseizure\b/,
    /\bketoacidosis\b/,
    /\bket[o0]\s*acidosis\b/,
    /\bdka\b/,
    /\bfruity\s+breath\b/,
    /\bslurred\s+speech\b/
  ],

  // Possible low blood glucose. NIDDK: treat per the user's own plan, escalate
  // if severe. Never "here's a donut verdict".
  possible_hypoglycemia: [
    /\bhypo(?:glycemi[ac]|glycaemi[ac])?\b/,
    /\bhypoglicemi[ac]\b/, // common misspelling
    // "low sugar" alone is a FOOD phrase ("low sugar yogurt") and must not
    // route — the low-glucose reading needs blood/glucose context or a verb.
    /\blow\s+blood\s+(?:sugar|glucose)\b/,
    /\b(?:blood\s+sugar|glucose|bg)\s+(?:is\s+)?(?:low|dropping|crashing|falling)\b/,
    /\bmy\s+sugar\s+(?:is\s+)?(?:low|crashing|dropping)\b/,
    /\bsugar\s+(?:is\s+)?(?:crash(?:ing|ed)|dropp(?:ing|ed))\b/,
    /\bblood\s+sugar\s+(?:is\s+)?\d{1,2}\b/, // e.g. "blood sugar is 48"
    // "shaky" is never a food; bare "shaking" is — "shaking beef" (bò lúc lắc)
    // is a real dish — so the -ing form needs a body/person subject.
    /\bshaky\b/,
    /\bshakiness\b/,
    /\b(?:i'?m|im|i\s+am|feel(?:ing)?|hands?\s+(?:are\s+)?)\s*shaking\b/,
    /\btrembl(?:y|ing)\b/,
    /\bclammy\b/,
    /\bcold\s+sweat\b/,
    /\bsweat(?:y|ing)\b/,
    /\bdizzy\b/,
    /\blight[\s-]?headed\b/,
    /\bheart\s+(?:is\s+)?(?:racing|pounding)\b/
  ],

  // Insulin or medication dose/change. Prediabetes Pal must never touch a dose.
  medication_dosing: [
    // "insulin pump" identifies an insulin-dependent user, not a dosing
    // question — that is the diagnosed_diabetes route, whose copy actually
    // addresses it ("Prediabetes Pal does not know your medicine or your readings").
    // A pump user who DOES ask a dosing question still lands here via the
    // how-much/units pattern below.
    /\binsulin\b(?!\s+pump)/,
    /\binsulen\b/, // misspelling
    /\bmetformin\b/,
    /\bozempic\b/,
    /\bwegovy\b/,
    /\bmounjaro\b/,
    /\bsemaglutide\b/,
    /\btirzepatide\b/,
    /\bjardiance\b/,
    /\bglipizide\b/,
    /\bjanuvia\b/,
    // "units" needs dosing context — a UK user writing "2 units of wine" is
    // describing a drink, not asking about a dose. Likewise a bare
    // "should I skip the..." is an ordinary food question ("skip the fries"),
    // so dosing verbs only route when they land near a dosing NOUN.
    /\b(?:how\s+(?:much|many)|what\s+dose|adjust|skip|double|halve|increase|decrease|take)\b[^.]{0,40}\b(?:dose|dosage|meds?|medication|pills?|shot|injection|units?)\b/,
    /\b(?:dose|dosage)\b[^.]{0,30}\b(?:for|before|with|after)\b/,
    /\bmy\s+meds?\b/,
    /\bblood\s+pressure\s+(?:med|pill|tablet)/,
    /\bstatin\b/,
    /\bwarfarin\b/
  ],

  // Eating-disorder language. A restriction-oriented verdict is actively
  // harmful here; route to compassionate professional support instead.
  eating_disorder: [
    /\banorexi[ac]\b/,
    /\bbulimi[ac]\b/,
    // Bare "binge" is not a clinical signal — "binge watching snacks". The
    // disclosure of binge *eating* is. "purge" carries the rest.
    /\bbinge[\s-]?eat(?:ing|er)?\b/,
    /\bbinged\s+on\b/,
    /\bbinge\s+and\s+purge\b/,
    /\bpurg(?:e|ed|ing)\b/,
    /\beating\s+disorder\b/,
    /\bed\s+recovery\b/,
    /\bmak(?:e|es|ing)\s+myself\s+(?:throw\s+up|sick|vomit)\b/,
    /\bmade\s+myself\s+(?:throw\s+up|sick|vomit)\b/,
    /\bthrow\s+it\s+(?:back\s+)?up\b/,
    /\bstarv(?:e|ing)\s+myself\b/,
    /\bhaven'?t\s+eaten\s+(?:in|for)\s+\d+\s+days?\b/,
    /\bnot\s+eaten\s+(?:in|for)\s+\d+\s+days?\b/,
    /\bhate\s+my\s+body\b/,
    /\bfeel\s+(?:so\s+)?(?:fat|disgusting)\b/,
    /\bpunish\s+myself\b/,
    /\bcompensate\s+for\s+(?:eating|the)\b/,
    /\blaxative/
  ],

  // Pregnancy / gestational diabetes — individual clinical guidance required;
  // the A1C bands Prediabetes Pal reasons over are not the ones used in pregnancy.
  pregnancy: [
    // pregnant / pregnancy / pregnent / pregnat — plus the manglings people
    // actually type. ("pregame" does not match: the char after "preg" must be
    // an n.)
    /\bpregn\w*\b/,
    /\b(?:pregant|prengant|pregent|preggers|prego)\b/,
    /\bgestational\b/,
    /\bgdm\b/,
    /\bexpecting\s+a\s+baby\b/,
    /\b\d{1,2}\s+weeks?\s+pregnant\b/,
    /\bbreastfeed(?:ing)?\b/,
    /\bnursing\s+(?:my\s+)?baby\b/,
    /\btrying\s+to\s+conceive\b/
  ],

  // Kidney / liver / serious cardiovascular disease. Generic "add protein",
  // "add salt-free seasoning", "go for a walk" advice can be wrong or unsafe.
  organ_disease: [
    /\bkidney\s+(?:disease|failure|problems?|issues?)\b/,
    /\bckd\b/,
    /\bdialysis\b/,
    /\brenal\b/,
    /\bnephropathy\b/,
    /\bliver\s+(?:disease|failure|problems?)\b/,
    /\bcirrhosis\b/,
    /\bfatty\s+liver\b/,
    /\bhepat(?:ic|itis)\b/,
    /\bheart\s+(?:failure|disease|attack)\b/,
    /\bcongestive\b/,
    /\bstroke\b/,
    /\bhad\s+a\s+(?:cardiac|heart)\b/,
    /\bstent\b/,
    /\bbypass\s+surgery\b/,
    /\bgout\b/,
    /\bpancreatitis\b/
  ],

  // Serious allergy or intolerance. Prediabetes Pal cannot confirm allergen safety —
  // especially not from a photo, and especially not for anaphylaxis risk.
  allergy: [
    /\ballerg(?:y|ic|ies)\b/,
    /\banaphyla(?:xis|ctic)\b/,
    /\bepi[\s-]?pen\b/,
    /\bcoeliac\b/,
    /\bceliac\b/,
    /\bintoleran(?:t|ce)\b/,
    /\bcross[\s-]?contamina/,
    /\bcontains?\s+(?:nuts|peanuts|gluten|shellfish)\b[^.]{0,30}\?/,
    /\bsafe\s+for\s+(?:my\s+)?(?:nut|peanut|gluten|shellfish|dairy)\s+allerg/
  ],

  // Type 1 / established type 2 — out of Prediabetes Pal's stated scope. The advice
  // does not incorporate medication or glucose-monitor data and must not imply
  // that it does.
  diagnosed_diabetes: [
    /\btype\s*[12]\s+diabet/,
    /\bt1d\b/,
    /\bt2d\b/,
    /\btype\s*[12]\b[^.]{0,20}\bdiagnos/,
    /\bi\s+(?:have|am)\s+(?:a\s+)?diabetic\b/,
    /\bi'?m\s+diabetic\b/,
    /\bmy\s+diabetes\b/,
    /\bdiagnosed\s+with\s+diabetes\b/,
    /\bcgm\b/,
    /\bcontinuous\s+glucose\s+monitor\b/,
    /\bdexcom\b/,
    // "libre" is a Spanish/French word that can appear in a food name; only the
    // CGM brand name routes.
    /\bfreestyle\s+libre\b/,
    /\blibre\s+(?:sensor|reading|cgm)\b/,
    /\binsulin\s+pump\b/
  ],

  // Pediatric context (AUD-030). Prediabetes Pal's A1C bands and meal framing are
  // adult-only; a check described as being for a child must route to human
  // care, deterministically, before any A1C/food/model step. Patterns need
  // CHILD context, not just an age phrase — "5 year old cheddar" and
  // "10 year old scotch" are foods, and "my daughter" alone can name an
  // adult, so bare relations without a child marker do not route.
  pediatric: [
    /\b(?:my|our|her|his|their)\s+\d{1,2}[\s-]?(?:year|yr)s?[\s-]?old\b/,
    /\b\d{1,2}[\s-]?(?:year|yr)s?[\s-]?old\s+(?:son|daughter|kid|child|boy|girl|grandson|granddaughter)\b/,
    /\b(?:my|our)\s+(?:kid|kids|child|children|toddler|teen|teenager|little\s+(?:one|boy|girl)|grandkid|grandchild)\b/,
    /\b(?:toddler|preschooler|kindergartner)\b/,
    /\bfor\s+(?:a|my|our)\s+child\b/,
    /\bchild'?s\s+(?:meal|lunch|dinner|breakfast|snack|plate)\b/,
    /\bschool\s+lunch\s+for\b/
  ]
};

export type ClinicalClassification = {
  route: ClinicalRoute;
  /** The pattern source that matched — for tests and telemetry, never shown. */
  matched: string;
};

/**
 * Classify an input for clinical risk. Returns null for ordinary food input.
 *
 * Order is precedence: the first route with a matching pattern wins, so a
 * message combining classes resolves to the most urgent one.
 */
export function classifyClinicalRisk(
  food: string
): ClinicalClassification | null {
  const normalized = food.toLowerCase();

  for (const route of CLINICAL_ROUTES) {
    for (const pattern of ROUTE_PATTERNS[route]) {
      if (pattern.test(normalized)) {
        return { route, matched: pattern.source };
      }
    }
  }

  return null;
}
