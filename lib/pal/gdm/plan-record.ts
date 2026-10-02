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
