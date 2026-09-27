import { z } from "zod";

/*
 * A photo of her sheet (F-PLANKEEP, Task 3.3), kept exactly as a photo. The
 * route stores it and hands it back to her; nothing reads what it shows.
 * Shared by the route, the account export and the device that sends it.
 */

/** The kinds of image a sheet photo may be. Never SVG: an SVG can carry script. */
export const PLAN_PHOTO_MIMES = ["image/jpeg", "image/png", "image/webp"] as const;
export type PlanPhotoMime = (typeof PLAN_PHOTO_MIMES)[number];

/** Photos kept per account. At the cap the add control is not rendered (G-20). */
export const PLAN_PHOTO_CAP = 3;

/** The longest `dataBase64` the route stores: about 2 MB of image. */
export const PLAN_PHOTO_MAX_BASE64 = 2_800_000;

/** The longest POST body the route reads: the base64, plus room for the JSON around it (G-20). */
export const PLAN_PHOTO_MAX_REQUEST_BYTES = PLAN_PHOTO_MAX_BASE64 + 1_000;

/** One character class, no nested repetition: linear over the whole string. */
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

/** What is stored, encrypted, in the photo's gdm_items row. Strict: the image and its type, nothing else. */
export const PlanPhotoBodySchema = z
  .object({
    mime: z.enum(PLAN_PHOTO_MIMES),
    dataBase64: z
      .string()
      .max(PLAN_PHOTO_MAX_BASE64)
      .regex(BASE64)
      .refine((data) => data.length % 4 === 0)
  })
  .strict();
export type PlanPhotoBody = z.infer<typeof PlanPhotoBodySchema>;

/**
 * G-62: what the account export carries for a photo, in place of its bytes:
 * its type and its size. Measured on 2026-09-27: three photos at the length
 * bound make an 8.4 MB export, over the platform's 4.5 MB response cap, so
 * the export would fail for everything else she keeps. Each photo downloads
 * on its own from Your data. Keyed on the field, not the schema, so a body
 * that ever drifts from PlanPhotoBodySchema still sheds its bytes. A body
 * with no bytes is returned as it is (an unreadable row exports as its
 * placeholder, like any other item).
 */
export function planPhotoForExport(body: unknown): unknown {
  if (typeof body !== "object" || body === null || !("dataBase64" in body)) return body;
  const { dataBase64, ...rest } = body as Record<string, unknown>;
  if (typeof dataBase64 !== "string") return rest;
  const padding = dataBase64.endsWith("==") ? 2 : dataBase64.endsWith("=") ? 1 : 0;
  return { ...rest, sizeBytes: Math.floor((dataBase64.length * 3) / 4) - padding };
}
