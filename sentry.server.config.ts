import * as Sentry from "@sentry/node";

import { scrubSentryEvent } from "./lib/pal/sentry-scrub";
import { resolveSentryRelease } from "./lib/pal/sentry-release";

/**
 * Server-only Sentry init. Loaded from instrumentation.ts on the Node runtime
 * only (never edge/browser), so the SDK never reaches the client or the Edge
 * middleware. With no SENTRY_DSN it is inert — captureException becomes a no-op,
 * which is exactly the dev/test behavior we want.
 *
 * Privacy is enforced as an ALLOWLIST: `defaultIntegrations: false` means the
 * dangerous integrations (LocalVariables, RequestData, Console/Http breadcrumbs)
 * never load. We add back only data-safe ones. Core stack-trace parsing is not an
 * integration, so frames still attach. scrubSentryEvent is defense-in-depth.
 */
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
  release: resolveSentryRelease(
    process.env.VERCEL_GIT_COMMIT_SHA,
    process.env.SENTRY_RELEASE
  ),
  tracesSampleRate: 0, // errors only — no perf spans/transactions
  sendDefaultPii: false, // never attach IP / user
  defaultIntegrations: false, // allowlist: dangerous integrations never load
  integrations: [Sentry.dedupeIntegration(), Sentry.linkedErrorsIntegration()],
  beforeSend: scrubSentryEvent
});
