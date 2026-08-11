import OpenAI from "openai";
import { z } from "zod";

import {
  assertModelIdMatchesTransport,
  resolveTransportBaseUrl
} from "../model-transport";
import { readPrivatePantryPhotoDataUrl } from "../server/pantry/blob-access";

/**
 * Vision EXTRACTOR for the Pantry Review pipeline. It transcribes food items
 * from a photo into text and does nothing else — it never judges, never
 * advises, never sees the buyer's A1C. All health judgments happen later in
 * the Prediabetes Pal engine's service checkFood() on the buyer-CONFIRMED list (design
 * doc locked decision 1). This module deliberately imports nothing from the
 * Prediabetes Pal engine (the lib/ engine directory).
 */

export const DEFAULT_VISION_MODEL = "gpt-5.4-mini";
export const MAX_ITEMS_PER_ORDER = 40;

export type ExtractedItem = { name: string; portion: string | null };

export interface PantryVisionClient {
  extractFromPhoto(photoUrl: string): Promise<ExtractedItem[]>;
}

export type PantryVisionTransport = {
  responses: {
    create(params: Record<string, unknown>): Promise<{ output_text?: string }>;
  };
};

const EXTRACT_PROMPT = [
  "You are an inventory transcriber. List the distinct food and drink items",
  "you can clearly identify in this photo of a home pantry, fridge, or meal.",
  "Rules:",
  "- Transcribe only what is visibly present. Never guess brands, never infer",
  "  items that might be nearby, never add items you are not sure about.",
  "- If you can read a label, use its product name.",
  "- Include a rough portion or package size only when it is visible",
  '  (for example "12 oz box", "half loaf"); otherwise use null.',
  "- Ignore non-food objects, people, and any text that is not a food label.",
  "- No advice, no health judgments, no commentary of any kind.",
  "If nothing is clearly identifiable, return an empty list."
].join("\n");

const extractJsonSchema = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          portion: { type: ["string", "null"] }
        },
        required: ["name", "portion"],
        additionalProperties: false
      }
    }
  },
  required: ["items"],
  additionalProperties: false
} as const;

const ExtractedItemsSchema = z.object({
  items: z.array(
    z.object({
      name: z.string().trim().min(1).max(80),
      portion: z.string().trim().min(1).max(80).nullable()
    })
  )
});

export function normalizeItemName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, " ");
}

const STUB_ITEMS: ExtractedItem[] = [
  { name: "rolled oats", portion: "1 canister" },
  { name: "orange juice", portion: "64 oz bottle" },
  { name: "white rice", portion: "5 lb bag" }
];

export function createPantryVisionClient(options?: {
  apiKey?: string;
  model?: string;
  client?: PantryVisionTransport;
  loadPhoto?: (photoUrl: string) => Promise<string>;
}): PantryVisionClient {
  return {
    async extractFromPhoto(photoUrl) {
      // Test/E2E seam — never active in production (same posture as
      // reviewer-signin and AUTH_EMAIL_STUB_DIR).
      if (
        process.env.PANTRY_EXTRACT_STUB === "1" &&
        process.env.VERCEL_ENV !== "production"
      ) {
        return STUB_ITEMS;
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
      const imageDataUrl = await (
        options?.loadPhoto ?? readPrivatePantryPhotoDataUrl
      )(photoUrl);

      const response = await transport.responses.create({
        model,
        input: [
          {
            role: "user",
            content: [
              { type: "input_text", text: EXTRACT_PROMPT },
              { type: "input_image", image_url: imageDataUrl, detail: "auto" }
            ]
          }
        ],
        store: false,
        text: {
          format: {
            type: "json_schema",
            name: "pantry_extracted_items",
            schema: extractJsonSchema,
            strict: true
          }
        }
      });

      const outputText = response.output_text?.trim();
      if (!outputText) {
        throw new Error("Vision extraction returned no output_text.");
      }

      const parsed = ExtractedItemsSchema.parse(JSON.parse(outputText));
      return parsed.items.slice(0, MAX_ITEMS_PER_ORDER);
    }
  };
}

function createTransport(apiKey: string | undefined): PantryVisionTransport {
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required for pantry vision extraction.");
  }
  // WS-2 (NEW-001): same transport policy as the text engine — OpenRouter in
  // production only via the shared allowlist, direct OpenAI otherwise.
  const baseURL = resolveTransportBaseUrl();
  // 60s per photo (vision is slower than the text judge); the batch route's
  // own budget (Task 2.11) is the real ceiling. maxRetries 0 — the caller
  // owns retry policy per photo.
  return new OpenAI({
    apiKey,
    timeout: 60_000,
    maxRetries: 0,
    ...(baseURL ? { baseURL } : {})
  });
}
