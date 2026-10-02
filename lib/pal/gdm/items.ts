import { z } from "zod";

import { GdmPlanSchema } from "./plan-record";

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
 * Per-kind body schema. A kind with no schema yet is refused by the route. A
 * plan's body is GdmPlanSchema: her words and figures, strict, with no `id`
 * (the row id travels beside the body, never inside it).
 */
export const GDM_ITEM_BODY: Partial<Record<GdmItemKind, z.ZodType>> = { ask: AskBodySchema, plan: GdmPlanSchema };

// ponytail: a flat per-kind cap instead of rate limiting — these routes make no paid call.
export const GDM_ITEM_CAP = 200;
