/**
 * Bounded clarify reasons (Task 3 / P1.3, plan §10.1).
 *
 * The deterministic precheck can ask exactly three ambiguity questions. This
 * module is the single source for their wording AND the closed reason enum that
 * product analytics is allowed to carry — the analytics stream never sees the
 * meal text or the raw question, only which of the three reasons fired
 * (`clarification_requested` / `clarification_resolved`, lib/client/analytics.ts).
 *
 * Pure data + string maps, no server or DOM dependencies, so both the precheck
 * (server) and the check form (client) import it without pulling anything heavy
 * into either bundle. Keeping the question strings here means the precheck and
 * the client-side reason mapping can never drift apart (clarify.test.ts
 * pins them to the live precheck output).
 */

/** The closed set of ambiguity reasons — the only clarify props analytics sees. */
export type ClarifyReason =
  | "plain_or_sweetened"
  | "protein_or_veg"
  | "underspecified";

/** The exact question the precheck asks for each reason. */
export const CLARIFY_QUESTIONS: Record<ClarifyReason, string> = {
  plain_or_sweetened: "Is this plain or sweetened?",
  protein_or_veg: "Does this come with protein or nonstarchy vegetables?",
  underspecified: "Can you name the specific dish or the main foods in it?"
};

const QUESTION_TO_REASON = new Map<string, ClarifyReason>(
  (Object.keys(CLARIFY_QUESTIONS) as ClarifyReason[]).map((reason) => [
    CLARIFY_QUESTIONS[reason],
    reason
  ])
);

/**
 * Maps a rendered clarify question back to its bounded reason, or null when the
 * question is not one of the three deterministic ambiguity prompts (a generic
 * validation clarify, or a model-authored clarify). Callers must not emit a
 * clarification metric for a null reason.
 */
export function clarifyReasonForQuestion(question: string): ClarifyReason | null {
  return QUESTION_TO_REASON.get(question) ?? null;
}

/** Elapsed-time buckets for `clarification_resolved` — closed enum, no raw ms. */
export type ClarifyElapsedBucket = "lt10s" | "lt60s" | "gte60s";

export function clarifyElapsedBucket(elapsedMs: number): ClarifyElapsedBucket {
  if (elapsedMs < 10_000) {
    return "lt10s";
  }
  if (elapsedMs < 60_000) {
    return "lt60s";
  }
  return "gte60s";
}
