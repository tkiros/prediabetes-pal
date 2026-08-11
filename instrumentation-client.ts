import * as Sentry from "@sentry/browser";

import { resolveSentryRelease } from "./lib/pal/sentry-release";
import { scrubSentryEvent } from "./lib/pal/sentry-scrub";

/**
 * Browser Sentry (W-22).
 *
 * `instrumentation.ts` initializes Sentry on the Node runtime ONLY, so until now
 * every client-side and PWA error was invisible: a crash in the check form, a
 * failed hydration, a service-worker fault, a rejected fetch on a flaky phone
 * network — none of it reached us. The app is a PWA whose whole job happens on a
 * phone, which is exactly where we had no eyes.
 *
 * ── The privacy bar is HIGHER here than on the server ────────────────────────
 * The server sees `food` and `a1c` on one request path and throws from a known
 * seam. The browser holds them in React state, in form inputs, in localStorage,
 * and in the URL — and the browser SDK's default integrations are built to hoover
 * exactly that up. So this init is an ALLOWLIST, same as the server
 * (`defaultIntegrations: false`), and the allowlist is short.
 *
 * What is loaded, and why each one is safe:
 *   globalHandlers   — window.onerror + unhandledrejection. This is the ONLY
 *                      thing that actually captures anything; without it the
 *                      whole file is decoration. Carries no user data itself.
 *   dedupe           — drops duplicate events. Reads nothing.
 *   linkedErrors     — walks `error.cause`. The messages it surfaces are
 *                      redacted by scrubSentryEvent like any other.
 *   functionToString — restores wrapped fn names in stacks. No user data.
 *
 * What is deliberately NOT loaded — each of these is a live leak on this app:
 *   breadcrumbs           — THE dangerous one. Records console output, fetch/XHR
 *                           URLs+bodies, and DOM interactions. It would capture
 *                           the food text the user typed, the /api/check request
 *                           body, and any console.log of a model response.
 *   httpContext           — attaches the page URL and headers.
 *   browserApiErrors      — wraps setTimeout/addEventListener and can capture
 *                           their arguments (which close over component state).
 *   contextLines          — pulls surrounding source lines into frames.
 *   extraErrorData        — serializes arbitrary properties off the error object.
 *   replay / tracing / profiling / webVitals — session replay would literally
 *                           record the user typing their meal and their A1C.
 *
 * scrubSentryEvent is then applied as beforeSend — the same function the server
 * uses, deleting request/user/contexts/breadcrumbs, redacting exception messages,
 * and stripping stack-frame `vars`. Defense in depth: the integrations that could
 * produce that data are never loaded in the first place, and if a future SDK
 * version starts attaching something new, the scrubber still strips it.
 *
 * ── Inert without a DSN ──────────────────────────────────────────────────────
 * No DSN ⇒ Sentry.init is never called at all. Dev, test, and a DSN-less prod
 * pay nothing and ship no client.
 *
 * NOTE ON THE ENV VAR NAME: the server reads `SENTRY_DSN`. The browser cannot —
 * Next.js only inlines `NEXT_PUBLIC_*` variables into the client bundle, so a
 * bare `SENTRY_DSN` would silently be `undefined` here and this would look
 * "working but quiet" forever, which is the worst possible failure mode for
 * observability. It therefore reads `NEXT_PUBLIC_SENTRY_DSN`, which must be set
 * separately. A DSN is a publishable, write-only ingest key — exposing it to the
 * browser is its intended use, not a leak.
 */

export const CLIENT_SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

/**
 * The init options, exported so the scrub/allowlist discipline is unit-testable
 * without booting the SDK (tests/unit/pal/sentry-client-scrub.test.ts).
 */
export function clientSentryOptions(dsn: string | undefined) {
  return {
    dsn,
    environment:
      process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
    release: resolveSentryRelease(process.env.NEXT_PUBLIC_SENTRY_RELEASE),
    tracesSampleRate: 0, // errors only — no perf spans, no transactions
    sendDefaultPii: false, // never attach IP / user
    defaultIntegrations: false as const, // allowlist: see the header
    integrations: [
      Sentry.globalHandlersIntegration(),
      Sentry.dedupeIntegration(),
      Sentry.linkedErrorsIntegration(),
      Sentry.functionToStringIntegration()
    ],
    beforeSend: scrubSentryEvent
  };
}

// Guarded on `window` as well as the DSN: this module is imported by the unit
// test in a Node environment, and booting a browser SDK there would be both
// pointless and flaky.
if (CLIENT_SENTRY_DSN && typeof window !== "undefined") {
  try {
    Sentry.init(clientSentryOptions(CLIENT_SENTRY_DSN));
  } catch (error) {
    // Observability is optional. A Sentry init fault must never take the app
    // down with it — the user came here to check a meal.
    console.warn("Client Sentry init skipped:", error);
  }
}
