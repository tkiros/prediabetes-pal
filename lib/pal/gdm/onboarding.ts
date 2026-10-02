// PRD GDM v1.1 §7.1: the door's onboarding asks three things — has she been
// told, when is her appointment (optional), and her explicit consent. No lab
// value is asked and nothing about medicine (D2), so no step exists for either.
export type GdmStep = "told" | "not_told" | "date" | "consent";
export type GdmAnswer = "yes" | "not_yet" | "continue" | "skip" | "back";

/** The whole onboarding, as a table. No step takes a lab value or asks about medicine. */
export function nextGdmStep(step: GdmStep, answer: GdmAnswer): GdmStep | "submit" {
  if (step === "told") return answer === "yes" ? "date" : "not_told";
  if (step === "not_told") return "told";
  if (step === "date") return answer === "back" ? "told" : "consent"; // G-27: was `return "consent"`, so "back" went forward
  return answer === "back" ? "date" : "submit";
}
