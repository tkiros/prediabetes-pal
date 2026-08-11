const STORAGE_KEY = "pal.coach.rotation";

/**
 * A monotonic per-device counter that cycles the server's audited coach phrase
 * bank (W-17 / F-12).
 *
 * Why a counter and not a random pick: rotation must be DETERMINISTIC to be
 * testable, and it must be CONTINUOUS to guarantee the property that actually
 * matters — that a user is never shown the same coach sentence on two checks in
 * a row. A random or hash-based pick gives a 1-in-6 chance of exactly that, on
 * every check, forever; a counter gives zero.
 *
 * It lives on the client because the server has nothing durable to count for a
 * guest, and it is sent as a header rather than in the request body so the
 * engine's strict request contract stays untouched.
 *
 * Forgeable, and harmless: the only thing this value can change is which
 * pre-approved sentence is rendered. It reaches no verdict, entitlement, or
 * safety floor. Storage failures (private mode, disabled storage) degrade to
 * the server's hash fallback rather than breaking a check.
 */
export function nextCoachRotation(): number | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  try {
    const current = Number.parseInt(
      window.localStorage.getItem(STORAGE_KEY) ?? "0",
      10
    );
    const next = Number.isFinite(current) ? current + 1 : 1;

    // Wrap well below MAX_SAFE_INTEGER; the server takes it modulo the bank
    // size anyway, so the absolute value never matters.
    const wrapped = next % 1_000_000;
    window.localStorage.setItem(STORAGE_KEY, String(wrapped));
    return wrapped;
  } catch {
    return undefined;
  }
}
