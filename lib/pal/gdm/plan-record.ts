import { z } from "zod";

/** The occasions of her day (ACOG's published structure: three meals, two to three snacks). Closed. */
export const GDM_OCCASIONS = [
  "breakfast",
  "snack_morning",
  "lunch",
  "snack_afternoon",
  "dinner",
  "snack_bedtime"
] as const;
export type GdmOccasion = (typeof GDM_OCCASIONS)[number];

/** How her clinic counts (research §6.1: handouts disagree four ways). Closed. Never converted. */
export const GDM_UNITS = ["grams", "choices", "servings", "none"] as const;
export type GdmUnit = (typeof GDM_UNITS)[number];

const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const words = (max: number) => z.string().trim().min(1).max(max);

/**
 * Her plan, in her clinician's words (PRD §6.2 F-PLANKEEP). Every figure is a
 * STRING, exactly as written for her: nothing here parses, converts, compares
 * by size, defaults, or judges one. Strict, so a field for a target, a reading
 * or a medicine cannot be added without editing this schema.
 */
export const GdmPlanSchema = z
  .object({
    givenBy: words(80).nullable(),
    note: words(2000).nullable(),
    perDay: words(60).nullable(),
    unit: z.enum(GDM_UNITS),
    choiceMeans: words(40).nullable(),
    figures: z.partialRecord(z.enum(GDM_OCCASIONS), words(40)),
    enteredOn: IsoDate,
    replacedOn: IsoDate.nullable()
  })
  .strict();
export type GdmPlan = z.infer<typeof GdmPlanSchema>;
export type StoredPlan = GdmPlan & { id: string };

export function currentPlans(plans: StoredPlan[]): StoredPlan[] {
  return plans.filter((plan) => plan.replacedOn === null);
}

export type PlanConflict = { occasion: GdmOccasion; planIds: [string, string] };

const asWritten = (text: string) => text.trim().replace(/\s+/g, " ").toLowerCase();

/** Pairs of CURRENT entries that say different things for one occasion. Shown side by side; never resolved. */
export function detectConflicts(plans: StoredPlan[]): PlanConflict[] {
  const current = currentPlans(plans);
  const conflicts: PlanConflict[] = [];
  for (const occasion of GDM_OCCASIONS) {
    const holders = current.filter((plan) => plan.figures[occasion] !== undefined);
    for (let i = 0; i < holders.length; i += 1) {
      for (let j = i + 1; j < holders.length; j += 1) {
        const [a, b] = [holders[i], holders[j]];
        const same = a.unit === b.unit &&
                     asWritten(a.figures[occasion]!) === asWritten(b.figures[occasion]!) &&
                     asWritten(a.choiceMeans ?? "") === asWritten(b.choiceMeans ?? "");
        if (!same) conflicts.push({ occasion, planIds: [a.id, b.id] });
      }
    }
  }
  return conflicts;
}
