import { z } from "zod";

import { GDM_OCCASIONS, GdmPlanSchema, type GdmOccasion } from "./plan-record";

/** What she can keep. A photo of her sheet has its own route (Task 3.3). */
export const GDM_ITEM_KINDS = ["ask", "plan", "meal"] as const;
export type GdmItemKind = (typeof GDM_ITEM_KINDS)[number];

/** Her own words only. Strict: there is no field for a reading, a dose or a medicine, and none can be slipped in. */
export const AskBodySchema = z
  .object({
    text: z.string().trim().min(1).max(500),
    note: z.string().trim().min(1).max(500).nullable(),
    asked: z.boolean(),
    answer: z.string().trim().min(1).max(1000).nullable()
  })
  .strict();
export type AskBody = z.infer<typeof AskBodySchema>;

/**
 * A meal she already eats, in her own words, under one occasion of her day
 * (PRD §6.2 F-MYMEALS). `inSummary` is her choice to copy it into her
 * appointment summary (story 3). Strict: there is no field for a reading, a
 * label or a score, and none can be slipped in.
 */
export const MealBodySchema = z
  .object({ occasion: z.enum(GDM_OCCASIONS), text: z.string().trim().min(1).max(200), inSummary: z.boolean() })
  .strict();
export type MealBody = z.infer<typeof MealBodySchema>;

/** Her meals by occasion: every occasion present (empty arrays included), in the order of her day. */
export function groupMeals<T extends { body: MealBody }>(meals: T[]): Record<GdmOccasion, T[]> {
  return Object.fromEntries(
    GDM_OCCASIONS.map((occasion) => [occasion, meals.filter((meal) => meal.body.occasion === occasion)])
  ) as Record<GdmOccasion, T[]>;
}

/**
 * Per-kind body schema. A kind with no schema yet is refused by the route. A
 * plan's body is GdmPlanSchema: her words and figures, strict, with no `id`
 * (the row id travels beside the body, never inside it).
 */
export const GDM_ITEM_BODY: Partial<Record<GdmItemKind, z.ZodType>> = {
  ask: AskBodySchema,
  plan: GdmPlanSchema,
  meal: MealBodySchema
};

// ponytail: a flat per-kind cap instead of rate limiting — these routes make no paid call.
export const GDM_ITEM_CAP = 200;
