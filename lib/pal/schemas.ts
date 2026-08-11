import { z } from "zod";

import { CLINICAL_ROUTES } from "./clinical-risk";

export const FOOD_MAX_LENGTH = 160;
const RESPONSE_TEXT_MAX_LENGTH = 280;

const TrimmedResponseTextSchema = z
  .string()
  .trim()
  .min(1)
  .max(RESPONSE_TEXT_MAX_LENGTH);

const NullableResponseTextSchema = TrimmedResponseTextSchema.nullable();

export const CheckRequestSchema = z
  .object({
    food: z.string().trim().min(1).max(FOOD_MAX_LENGTH),
    a1c: z.number().finite().gte(0).lte(20)
  })
  .strict();

export type CheckRequest = z.infer<typeof CheckRequestSchema>;

export const PalRiskSchema = z.enum(["SAFE", "MODERATE", "HIGH"]);
export type PalRisk = z.infer<typeof PalRiskSchema>;

export const PalClinicalRouteSchema = z.enum(CLINICAL_ROUTES);

export const PalResponseKindSchema = z.enum([
  "result",
  "clarify",
  "not_food",
  "out_of_scope",
  "clinical",
  "retry"
]);
export type PalResponseKind = z.infer<typeof PalResponseKindSchema>;

// The kinds the MODEL may emit. "clinical" is deliberately absent: a clinical
// route is decided before the model runs and answered from approved copy, so
// the model is never given the option of composing a medical response.
export const PalModelKindSchema = z.enum([
  "result",
  "clarify",
  "not_food",
  "carbs_only"
]);
export type PalModelKind = z.infer<typeof PalModelKindSchema>;

export const PalPolicyFlagSchema = z.enum([
  "safe_food",
  "borderline",
  "high_risk",
  "ambiguous",
  "carbs_only",
  "non_food"
]);
export type PalPolicyFlag = z.infer<typeof PalPolicyFlagSchema>;

const ExamplesSchema = z.array(z.string().trim().min(1).max(FOOD_MAX_LENGTH));

const BasePalModelOutputSchema = z
  .object({
    kind: PalModelKindSchema,
    // Composition-first fields (doc 18 item 17f). REQUIRED in the provider
    // JSON schema (ordered before `risk`, so the model commits to the dish's
    // driver before it picks a band) but OPTIONAL here so the frozen mock
    // fixtures parse unchanged. Postprocess reads neither for the verdict —
    // they are the model's working notes, not a trusted signal.
    components: z.array(z.string().trim().min(1).max(60)).optional(),
    glycemic_driver: z.string().trim().min(1).max(120).nullable().optional(),
    risk: PalRiskSchema.nullable(),
    reason: NullableResponseTextSchema,
    adjustment: NullableResponseTextSchema,
    swap: NullableResponseTextSchema,
    question: NullableResponseTextSchema,
    examples: ExamplesSchema,
    policy_flags: z.array(PalPolicyFlagSchema)
  })
  .strict();

export const PalModelOutputSchema = BasePalModelOutputSchema.superRefine(
  (value, ctx) => {
    if (value.kind === "result" || value.kind === "carbs_only") {
      if (value.risk === null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["risk"],
          message: "Result outputs must include a risk classification."
        });
      }

      if (value.reason === null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["reason"],
          message: "Result outputs must include a qualitative reason."
        });
      }
    }

    if (value.kind === "clarify" && value.question === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["question"],
        message: "Clarification outputs must include one question."
      });
    }

    if (value.kind === "not_food" && value.examples.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["examples"],
        message: "Non-food outputs must include concrete food examples."
      });
    }
  }
);

export type PalModelOutput = z.infer<typeof PalModelOutputSchema>;

export const palModelJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "kind",
    "components",
    "glycemic_driver",
    "risk",
    "reason",
    "adjustment",
    "swap",
    "question",
    "examples",
    "policy_flags"
  ],
  properties: {
    kind: {
      type: "string",
      enum: ["result", "clarify", "not_food", "carbs_only"]
    },
    // Composition-first (doc 18 item 17f): generated BEFORE risk under
    // constrained decoding, so the driver is committed before the band.
    components: {
      type: "array",
      items: { type: "string", minLength: 1, maxLength: 60 }
    },
    glycemic_driver: { type: ["string", "null"], minLength: 1, maxLength: 120 },
    risk: {
      type: ["string", "null"],
      enum: ["SAFE", "MODERATE", "HIGH", null]
    },
    // Length bounds mirror the Zod schema (TrimmedResponseTextSchema /
    // ExamplesSchema) so locally invalid strings — e.g. the benchmarked
    // examples:[""] failure — are rejected by the provider's constrained
    // decoding instead of falling to the retry fallback. Verified accepted by
    // the OpenAI Responses API in strict mode (2026-07-11 probe).
    reason: { type: ["string", "null"], minLength: 1, maxLength: 280 },
    adjustment: { type: ["string", "null"], minLength: 1, maxLength: 280 },
    swap: { type: ["string", "null"], minLength: 1, maxLength: 280 },
    question: { type: ["string", "null"], minLength: 1, maxLength: 280 },
    examples: {
      type: "array",
      items: { type: "string", minLength: 1, maxLength: 160 }
    },
    policy_flags: {
      type: "array",
      items: {
        type: "string",
        enum: [
          "safe_food",
          "borderline",
          "high_risk",
          "ambiguous",
          "carbs_only",
          "non_food"
        ]
      }
    }
  }
} as const;

const DisclaimerSchema = TrimmedResponseTextSchema;
const UserMessageSchema = TrimmedResponseTextSchema;

export const PalUserResultSchema = z
  .object({
    kind: z.literal("result"),
    risk: PalRiskSchema,
    reason: UserMessageSchema,
    adjustment: NullableResponseTextSchema,
    swap: NullableResponseTextSchema,
    disclaimer: DisclaimerSchema
  })
  .strict();

export const PalUserClarifySchema = z
  .object({
    kind: z.literal("clarify"),
    question: UserMessageSchema,
    examples: ExamplesSchema,
    disclaimer: DisclaimerSchema
  })
  .strict();

export const PalUserNotFoodSchema = z
  .object({
    kind: z.literal("not_food"),
    message: UserMessageSchema,
    examples: ExamplesSchema,
    disclaimer: DisclaimerSchema
  })
  .strict();

export const PalUserOutOfScopeSchema = z
  .object({
    kind: z.literal("out_of_scope"),
    route: z.enum([
      "below_prediabetes_range",
      "diabetes_range_out_of_scope"
    ]),
    message: UserMessageSchema,
    disclaimer: DisclaimerSchema
  })
  .strict();

export const PalUserRetrySchema = z
  .object({
    kind: z.literal("retry"),
    message: UserMessageSchema,
    disclaimer: DisclaimerSchema
  })
  .strict();

/**
 * Clinical route (W-01). Structurally incapable of carrying a verdict: there is
 * no `risk` field, so no code path — however broken — can attach "Clear" to a
 * message about insulin dosing or a hypoglycaemic episode.
 */
export const PalUserClinicalSchema = z
  .object({
    kind: z.literal("clinical"),
    route: PalClinicalRouteSchema,
    message: UserMessageSchema,
    disclaimer: DisclaimerSchema
  })
  .strict();

export const PalUserResponseSchema = z.discriminatedUnion("kind", [
  PalUserResultSchema,
  PalUserClarifySchema,
  PalUserNotFoodSchema,
  PalUserOutOfScopeSchema,
  PalUserClinicalSchema,
  PalUserRetrySchema
]);

export type PalUserResponse = z.infer<typeof PalUserResponseSchema>;
