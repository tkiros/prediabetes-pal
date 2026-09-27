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

export type SummaryInput = { plans: StoredPlan[]; meals: Array<{ body: MealBody }>; asks: Array<{ body: AskBody }> };

/**
 * An open question is one she has not ticked Asked (final review F5): Task
 * 2.2 keeps her answer when she unticks it, and My questions shows that
 * question open, so the summary does too. Its kept answer is not printed.
 */
const isOpenAsk = (ask: { body: AskBody }) => !ask.body.asked;

/**
 * Whether the summary has anything to print: a current plan, a meal she
 * marked for it, or an open question (final review F8). The summary page's
 * all-empty screen (G-41) and Home's summary offer both read this one rule,
 * and tests/unit/pal/gdm-summary.test.ts pins it to buildSummary's sections.
 */
export function summaryHasContent(input: SummaryInput): boolean {
  return (
    currentPlans(input.plans).length > 0 ||
    input.meals.some((meal) => meal.body.inSummary) ||
    input.asks.some(isOpenAsk)
  );
}

export function buildSummary(input: SummaryInput, labels: SummaryLabels): SummaryDoc {
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
    // F6: `none` is the form's starting value, not something she wrote; the
    // plan card shows no counts row for it, and neither does the page.
    if (plan.unit !== "none") {
      planLines.push(`${labels.fields.counts}: ${labels.units[plan.unit]}`);
    }
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

  // Add conflict lines: one per occasion, in the order of her day, however
  // many pairs of plans differ there (F7). detectConflicts already walks
  // GDM_OCCASIONS in order, so a Set keeps that order.
  for (const occasion of new Set(conflicts.map((conflict) => conflict.occasion))) {
    planLines.push(`${labels.differ}: ${labels.occasions[occasion]}`);
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
    if (isOpenAsk(ask)) {
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
