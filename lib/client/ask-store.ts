// lib/client/ask-store.ts
import { z } from "zod";

/**
 * The F-ASK answers (PRD v1.1 §7.5): what brought someone here, up to three
 * picks, and what would count as a win. Device-only — `pal.ask.v1` is never
 * sent to the server or the model; Home reads it to order the door
 * (lib/client/home-door.ts), and account delete clears it
 * (app/(app)/account/page.tsx DEVICE_ONLY_KEYS).
 *
 * Task 5.3 ships the types and this read-only reader; Task 6.2 adds `set()`
 * (ruling R-17: the enums are the plan's PR-6 contract, verbatim, so PR-6
 * never changes the type).
 */
export const PAIN_KEYS = ["number", "effort", "plan", "clinician", "worried", "food", "other"] as const;
export const WIN_KEYS = [
  "explanation",
  "number_watch",
  "steps",
  "food_enjoy",
  "peace",
  "trust",
  "unsure"
] as const;

export type PainKey = (typeof PAIN_KEYS)[number];
export type WinKey = (typeof WIN_KEYS)[number];
export type AskState = { pains: PainKey[]; win: WinKey | null };

const STORAGE_KEY = "pal.ask.v1";

const AskStateSchema = z
  .object({
    pains: z.array(z.enum(PAIN_KEYS)).max(3),
    win: z.enum(WIN_KEYS).nullable()
  })
  .strict();

export const askStore = {
  /** Strict read: missing, corrupt, an unknown key, or more than three pains → null. */
  get(): AskState | null {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = AskStateSchema.safeParse(JSON.parse(raw));
      return parsed.success ? parsed.data : null;
    } catch {
      return null;
    }
  }
};
