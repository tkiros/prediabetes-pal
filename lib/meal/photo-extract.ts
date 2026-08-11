import OpenAI from "openai";
import { z } from "zod";

import {
  assertModelIdMatchesTransport,
  resolveTransportBaseUrl
} from "../model-transport";

/**
 * Vision DRAFTER for the D5 photo-assist check input. It transcribes a meal
 * photo into an editable text draft and does nothing else — it never judges,
 * never advises, never sees the user's A1C. The health verdict happens later
 * in the Prediabetes Pal engine via /api/check on the user-CONFIRMED text (same locked
 * decision as the Pantry extractor, lib/pantry/extract.ts). This module
 * deliberately imports nothing from lib/pal/ or lib/pantry/.
 */

export const DEFAULT_VISION_MODEL = "gpt-5.4-mini";
export const MAX_DRAFT_ITEMS = 20;

export type MealDraftItem = { name: string; portion: string | null; uncertain: boolean };
export type MealDraft = { dish: string | null; items: MealDraftItem[] };

export interface MealVisionClient {
  draftFromPhoto(imageDataUrl: string): Promise<MealDraft>;
}

export type MealVisionTransport = {
  responses: {
    create(params: Record<string, unknown>): Promise<{ output_text?: string }>;
  };
};

const DRAFT_PROMPT = [
  "You are a meal transcriber. Describe the food in this photo of a single",
  "meal or plate so the eater can confirm or correct your draft.",
  "Rules:",
  "- dish: your best short guess at the overall dish name (like \"chicken",
  "  burrito bowl\"); null when the photo is not clearly a meal or dish.",
  "- items: the distinct visible foods/components. Transcribe only what is",
  "  visibly present. Never guess brands, never infer hidden ingredients.",
  "- portion: a rough visible amount only when apparent (like \"1 cup\",",
  "  \"2 slices\"); otherwise null. Never estimate grams, carbs, or calories.",
  "- uncertain: true when you are not confident about that item's identity or",
  "  preparation (for example, a white grain that could be rice or couscous, a",
  "  dressing or sauce you cannot identify, a drink that may be sweetened).",
  "- No advice, no health judgments, no risk words, no numbers other than",
  "  visible portions, no commentary of any kind.",
  "If nothing food-like is clearly identifiable, return dish: null and an",
  "empty items list."
].join("\n");

const draftJsonSchema = {
  type: "object",
  properties: {
    dish: { type: ["string", "null"] },
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          portion: { type: ["string", "null"] },
          uncertain: { type: "boolean" }
        },
        required: ["name", "portion", "uncertain"],
        additionalProperties: false
      }
    }
  },
  required: ["dish", "items"],
  additionalProperties: false
} as const;

const MealDraftSchema = z.object({
  dish: z.string().trim().min(1).max(80).nullable(),
  items: z.array(
    z.object({
      name: z.string().trim().min(1).max(80),
      portion: z.string().trim().min(1).max(80).nullable(),
      uncertain: z.boolean()
    })
  )
});

export const STUB_DRAFT: MealDraft = {
  dish: "chicken and rice bowl",
  items: [
    { name: "grilled chicken", portion: null, uncertain: false },
    { name: "white rice", portion: "1 cup", uncertain: true },
    { name: "mixed salad", portion: null, uncertain: false }
  ]
};

export function createMealVisionClient(options?: {
  apiKey?: string;
  model?: string;
  client?: MealVisionTransport;
}): MealVisionClient {
  return {
    async draftFromPhoto(imageDataUrl) {
      // Test/E2E seam — never active in production (same posture as
      // PANTRY_EXTRACT_STUB).
      if (
        process.env.MEAL_EXTRACT_STUB === "1" &&
        process.env.VERCEL_ENV !== "production"
      ) {
        return STUB_DRAFT;
      }

      // `||`, not `??`: a declared-but-empty var is a string and would win the
      // coalesce, asking the provider for model "".
      const model =
        options?.model ||
        process.env.PAL_VISION_MODEL?.trim() ||
        DEFAULT_VISION_MODEL;
      // Injected clients (tests) own their routing; real transports must pair
      // the model-id naming with the configured base URL before a paid call.
      if (!options?.client) {
        assertModelIdMatchesTransport(model, resolveTransportBaseUrl());
      }
      const transport =
        options?.client ?? createTransport(options?.apiKey ?? process.env.OPENAI_API_KEY);

      const response = await transport.responses.create({
        model,
        input: [
          {
            role: "user",
            content: [
              { type: "input_text", text: DRAFT_PROMPT },
              { type: "input_image", image_url: imageDataUrl, detail: "auto" }
            ]
          }
        ],
        store: false,
        text: {
          format: {
            type: "json_schema",
            name: "meal_photo_draft",
            schema: draftJsonSchema,
            strict: true
          }
        }
      });

      const outputText = response.output_text?.trim();
      if (!outputText) {
        throw new Error("Meal photo draft returned no output_text.");
      }

      const parsed = MealDraftSchema.parse(JSON.parse(outputText));
      return { dish: parsed.dish, items: parsed.items.slice(0, MAX_DRAFT_ITEMS) };
    }
  };
}

function createTransport(apiKey: string | undefined): MealVisionTransport {
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required for meal photo drafts.");
  }
  // WS-2 (NEW-001): vision follows the same transport policy as the text
  // engine — OpenRouter in production only via the shared allowlist, direct
  // OpenAI otherwise. Before this, photo drafts silently stayed on direct
  // OpenAI whatever OPENAI_BASE_URL said.
  const baseURL = resolveTransportBaseUrl();
  // 25s: vision is slower than the text judge but this is an interactive
  // request (user is watching a spinner) — well under the route's maxDuration
  // and far under the pantry batch budget. maxRetries 0 — one paid attempt;
  // the user can retake.
  return new OpenAI({
    apiKey,
    timeout: 25_000,
    maxRetries: 0,
    ...(baseURL ? { baseURL } : {})
  });
}
