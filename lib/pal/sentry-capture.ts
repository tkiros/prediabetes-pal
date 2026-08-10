import * as Sentry from "@sentry/node";

/**
 * Single capture seam for Prediabetes Pal's two error-swallowing catch sites
 * (service.ts model catch, check route catch). Both swallow on purpose to return
 * calm retry copy, so the error is otherwise invisible.
 *
 * Tags are the ONLY diagnostic payload — PII-free by construction
 * (`errorClass` / `httpStatus`), which is why beforeSend can fully redact the
 * message.
 *
 * Two guarantees, because this runs on the request's LAST recovery path:
 *  - Never throws/rejects. A Sentry SDK fault must not break the calm-retry
 *    contract — all SDK work is wrapped and failures are swallowed.
 *  - Awaits flush. On Vercel the function can freeze the moment the response is
 *    sent, dropping un-flushed events; `flush(1000)` delivers before return. The
 *    1s ceiling is deliberate vs the request budget (openai-client 10s timeout,
 *    client abort 12s, route maxDuration 15s): on the model-error path the worst
 *    case is 10s + 1s = 11s, still under the 12s abort, and an event that can't
 *    flush in 1s won't in 2s. The browser already showed retry by 12s regardless.
 * Both `captureException` and `flush` are no-ops without `SENTRY_DSN` (no client
 * is configured), so dev/test and DSN-less prod pay nothing.
 */
export async function captureServerError(
  error: unknown,
  stage: "model" | "route" | "support"
): Promise<void> {
  try {
    // Production builds minify class names, so `constructor.name` degrades to
    // one-letter junk ("b") in the tag stream (seen live: ANDROID-2/3/4).
    // Prefer `error.name`, which Zod/pg/OpenAI set explicitly as a string
    // property that survives bundling; keep constructor.name only as fallback.
    //
    // Tags bypass the beforeSend scrubber by design, so both values pass a
    // machine-token allowlist before tagging: identifier charset only, no
    // spaces or "@" — a food string, email, or prompt fragment can never
    // ride along even if a future error stuffs PII into `name`/`code`.
    const cause = error as {
      name?: unknown;
      code?: unknown;
      status?: unknown;
      constructor?: { name?: string };
    };
    const machineToken = (v: unknown): string | undefined =>
      typeof v === "string" && /^[A-Za-z0-9_.-]{2,40}$/.test(v)
        ? v
        : undefined;
    const name = machineToken(cause?.name);
    const tags: Record<string, string> = {
      stage,
      errorClass:
        (name !== "Error" ? name : undefined) ??
        machineToken(cause?.constructor?.name) ??
        "Unknown"
    };
    // PII-free machine codes: Postgres SQLSTATE ("42P01"), node errno
    // ("ECONNREFUSED"), OpenAI error codes — the triage signal the redacted
    // message can't carry.
    const code = machineToken(cause?.code);
    if (code !== undefined) {
      tags.errorCode = code;
    }
    if (typeof cause?.status === "number") {
      tags.httpStatus = String(cause.status);
    }

    Sentry.captureException(error, { tags });
    await Sentry.flush(1000);
  } catch {
    // Observability must never break the request path — drop the event silently.
  }
}
