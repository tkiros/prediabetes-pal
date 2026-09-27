import { currentPlans, detectConflicts, GDM_OCCASIONS, type GdmOccasion, type GdmUnit, type StoredPlan } from "./plan-record";
import { groupMeals, type AskBody, type MealBody } from "./items";

export type SummarySection = { key: "plan" | "meals" | "asks"; heading: string; lines: string[] };
export type SummaryDoc = { title: string; sections: [SummarySection, SummarySection, SummarySection]; emptyLine: string };
export type SummaryLabels = {
  title: string;
  plan: string;
  meals: string;
  asks: string;
  empty: string;
  differ: string;
  occasions: Record<GdmOccasion, string>;
  units: Record<GdmUnit, string>;
  fields: { givenBy: string; perDay: string; counts: string; choiceMeans: string; enteredOn: string };
};

export function buildSummary(
  input: { plans: StoredPlan[]; meals: Array<{ body: MealBody }>; asks: Array<{ body: AskBody }> },
  labels: SummaryLabels
): SummaryDoc {
  const current = currentPlans(input.plans);
  const conflicts = detectConflicts(input.plans);

  // Build plan section
  const planLines: string[] = [];
  for (const plan of current) {
    if (plan.givenBy !== null) {
      planLines.push(`${labels.fields.givenBy}: ${plan.givenBy}`);
    }
    if (plan.perDay !== null) {
      planLines.push(`${labels.fields.perDay}: ${plan.perDay}`);
    }
    if (plan.choiceMeans !== null) {
      planLines.push(`${labels.fields.choiceMeans}: ${plan.choiceMeans}`);
    }
    planLines.push(`${labels.fields.counts}: ${labels.units[plan.unit]}`);
    planLines.push(`${labels.fields.enteredOn}: ${plan.enteredOn}`);

    // Add figures for each occasion in GDM_OCCASIONS order
    for (const occasion of GDM_OCCASIONS) {
      const figure = plan.figures[occasion];
      if (figure !== undefined) {
        planLines.push(`${labels.occasions[occasion]}: ${figure}`);
      }
    }

    if (plan.note !== null) {
      planLines.push(plan.note);
    }
  }

  // Add conflict lines
  for (const conflict of conflicts) {
    planLines.push(`${labels.differ}: ${labels.occasions[conflict.occasion]}`);
  }

  // Build meals section
  const mealsByOccasion = groupMeals(input.meals);
  const mealLines: string[] = [];
  for (const occasion of Object.keys(mealsByOccasion) as GdmOccasion[]) {
    const mealsForOccasion = mealsByOccasion[occasion];
    for (const meal of mealsForOccasion) {
      if (meal.body.inSummary) {
        mealLines.push(`${labels.occasions[occasion]}: ${meal.body.text}`);
      }
    }
  }

  // Build asks section
  const askLines: string[] = [];
  for (const ask of input.asks) {
    if (ask.body.asked === false && ask.body.answer === null) {
      askLines.push(ask.body.text);
      if (ask.body.note !== null) {
        askLines.push(ask.body.note);
      }
    }
  }

  return {
    title: labels.title,
    sections: [
      { key: "plan", heading: labels.plan, lines: planLines },
      { key: "meals", heading: labels.meals, lines: mealLines },
      { key: "asks", heading: labels.asks, lines: askLines }
    ],
    emptyLine: labels.empty
  };
}
