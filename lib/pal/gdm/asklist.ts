import { CLINICAL_ROUTES, classifyClinicalRisk, type ClinicalRoute } from "../clinical-risk";

// The routes PRD §6.2 names for the list: "urgent symptoms, possible
// hypoglycaemia, medication dosing and eating-disorder language are answered
// by their own approved rows first." They are the first four of
// CLINICAL_ROUTES — tests/unit/pal/gdm-pregnancy-route.test.ts pins that order.
// classifyClinicalRisk returns the FIRST match in precedence order, so when one
// of these four matches it is always the one returned. Every lower route gets
// no card here: nothing is read behind this list, and the fixed line above it
// already names the care team (§8 item 8 asks the safety owner to confirm).
const FIRST_FOUR: readonly ClinicalRoute[] = CLINICAL_ROUTES.slice(0, 4);

/** The approved clinical card a parked question gets above the list, if any (G-21: named for what it answers). */
export function askListCardRoute(text: string): ClinicalRoute | null {
  const hit = classifyClinicalRisk(text);
  return hit && FIRST_FOUR.includes(hit.route) ? hit.route : null;
}
