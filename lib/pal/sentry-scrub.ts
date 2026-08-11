import type { ErrorEvent } from "@sentry/node";

/**
 * Sentry derives coarse geolocation from the transport IP when an event has no
 * explicit user IP, even when `sendDefaultPii` is false and the project is set
 * to scrub stored IP addresses. An explicit non-routable sentinel prevents that
 * enrichment. The provider-side IP scrubber then removes the sentinel itself.
 */
export const SENTRY_IP_GEO_SENTINEL = "0.0.0.0";

/**
 * beforeSend scrubber — the last line of defense before any error event leaves
 * the box. Prediabetes Pal's non-negotiable invariant: no raw `food` / `a1c` / prompt /
 * model `output_text` (and no identifying IP/geolocation) may ever reach a
 * third party.
 *
 * The init config (sentry.server.config.ts) already disables the dangerous
 * integrations at the source (`defaultIntegrations: false`), so request bodies,
 * console/http breadcrumbs, and local-variable capture never load. This function
 * is belt-and-suspenders over the two vectors that survive a naive denylist:
 *   - stacktrace frame `vars` — the `prompt` local at the service throw site
 *     holds food + a1c.
 *   - the exception `value` (message) — a ZodError on model output can echo
 *     `output_text`.
 * The message is fully redacted; triage granularity comes from the PII-free tags
 * (`stage` / `errorClass` / `httpStatus`) set at the capture sites instead.
 */
export function scrubSentryEvent(event: ErrorEvent): ErrorEvent {
  delete event.request; // body (food/a1c) / headers / cookies / query
  // Do not merely delete `user`: Sentry then infers geo from the connection IP.
  // Overwrite every user field and explicitly suppress that inference instead.
  event.user = { ip_address: SENTRY_IP_GEO_SENTINEL };
  delete event.server_name; // hostname
  delete event.extra; // we never set PII extra; belt
  delete event.contexts; // belt: any future setContext() can't become a leak
  delete event.message; // belt: any future captureMessage() can't become a leak
  delete event.breadcrumbs; // console/http breadcrumbs

  for (const ex of event.exception?.values ?? []) {
    if (ex.value !== undefined) {
      ex.value = "[redacted]"; // a message (even "") can echo model output_text
    }
    for (const frame of ex.stacktrace?.frames ?? []) {
      delete frame.vars; // local vars: the prompt = food + a1c
    }
  }

  // Same treatment for the threads container: nothing populates it today
  // (defaultIntegrations is off), but a future SDK/integration that does must
  // not become a frame-vars leak this scrubber silently misses.
  for (const thread of event.threads?.values ?? []) {
    for (const frame of thread.stacktrace?.frames ?? []) {
      delete frame.vars;
    }
  }

  return event;
}
