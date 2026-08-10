import type { NextConfig } from "next";

import { resolveSentryRelease } from "./lib/revora/sentry-release";

// P0.3: a production deploy without measurement is a silent analytics outage —
// the funnel reads as zero and nobody notices. Fail the BUILD when production
// is missing the analytics env, unless the owner explicitly waives it
// (REVORA_ALLOW_NO_MEASUREMENT=1) for a deliberate dark launch. The Sentry
// client DSN is warn-only until one is provisioned — client error reporting
// missing is bad, but not worth blocking a deploy the analytics gate allows.
if (
  process.env.VERCEL_ENV === "production" &&
  process.env.REVORA_ALLOW_NO_MEASUREMENT !== "1"
) {
  const missing = [
    !process.env.NEXT_PUBLIC_UMAMI_SRC && "NEXT_PUBLIC_UMAMI_SRC",
    !process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID && "NEXT_PUBLIC_UMAMI_WEBSITE_ID"
  ].filter((v): v is string => Boolean(v));
  if (missing.length > 0) {
    throw new Error(
      `Production build without measurement: set ${missing.join(", ")} ` +
        "(or REVORA_ALLOW_NO_MEASUREMENT=1 to deploy dark deliberately)."
    );
  }
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) {
    console.warn(
      "⚠ NEXT_PUBLIC_SENTRY_DSN is not set — client-side errors will be " +
        "invisible in production. Provision a Sentry DSN and add it to Vercel."
    );
  }
}

// Flag server twins: a NEXT_PUBLIC flag baked ON with its runtime twin unset
// means the feature ships with a kill switch that does nothing. Fail the
// build so the mismatch can never ship silently. Deliberately OUTSIDE the
// REVORA_ALLOW_NO_MEASUREMENT waiver above — waiving analytics must never
// also waive flag safety.
if (process.env.VERCEL_ENV === "production") {
  const twinMismatch = [
    process.env.NEXT_PUBLIC_PHOTO_INPUT === "1" &&
      process.env.PHOTO_INPUT_ENABLED !== "1" &&
      "PHOTO_INPUT_ENABLED",
    process.env.NEXT_PUBLIC_LONGITUDINAL_INSIGHTS === "1" &&
      process.env.LONGITUDINAL_INSIGHTS_ENABLED !== "1" &&
      "LONGITUDINAL_INSIGHTS_ENABLED",
    // AUD-002 (V016): the two retention features shipped twin pairs without
    // guard coverage — a client-on/server-off build passed. Same rule as
    // photo/insights: the server twin is the runtime kill switch.
    process.env.NEXT_PUBLIC_MEAL_MEMORY === "1" &&
      process.env.MEAL_MEMORY_ENABLED !== "1" &&
      "MEAL_MEMORY_ENABLED",
    process.env.NEXT_PUBLIC_LEARNING_JOURNEY === "1" &&
      process.env.LEARNING_JOURNEY_ENABLED !== "1" &&
      "LEARNING_JOURNEY_ENABLED"
  ].filter((v): v is string => Boolean(v));
  if (twinMismatch.length > 0) {
    throw new Error(
      `NEXT_PUBLIC flag is "1" but its server twin is unset: set ${twinMismatch.join(", ")}=1 ` +
        "(the server twin is the runtime kill switch; without it the flag cannot be turned off without a rebuild)."
    );
  }
}

const nextConfig: NextConfig = {
  // E2E builds the legacy and trial deployments into isolated ignored
  // directories, then starts both optimized servers together. Normal builds
  // leave NEXT_DIST_DIR unset and continue to use Next's default `.next`.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // The browser SDK cannot read server-only system variables. Vercel exposes
  // the exact Git SHA at build time, so deliberately inline that public,
  // non-secret identifier and keep browser/server events on the same release.
  env: {
    NEXT_PUBLIC_SENTRY_RELEASE:
      resolveSentryRelease(
        process.env.VERCEL_GIT_COMMIT_SHA,
        process.env.SENTRY_RELEASE,
        process.env.NEXT_PUBLIC_SENTRY_RELEASE
      ) ?? ""
  },
  // C7 four-jobs restructure (2026-07-21): old bookmarks and deep links keep
  // working. /memory folded into /meals as its "Saved meals" section.
  redirects: async () => [
    { source: "/history", destination: "/meals", permanent: true },
    { source: "/memory", destination: "/meals", permanent: true },
    { source: "/progress", destination: "/journey", permanent: true }
  ],
  // A stray ~/package-lock.json (unrelated home-dir tooling) makes Next infer
  // the wrong workspace root and warn about multiple lockfiles (E2E-08).
  // Pin the root to this repo.
  turbopack: { root: __dirname },
  // SEC-04 (QA round 2026-07-10): baseline security headers. CSP notes:
  // - script/style 'unsafe-inline' is required by Next's inline runtime unless
  //   we move to nonce-based CSP via middleware.
  // - Umami is the ONE third-party script we embed (app/layout.tsx, env-gated).
  //   Its origin is derived from the SAME env var the layout reads, for both
  //   the script tag and the tracker's POST beacons — without it the WTP
  //   funnel's analytics silently die under this CSP.
  // - connect-src includes Vercel Blob because pantry photos upload directly
  //   from the browser (@vercel/blob/client, components/pantry-intake-flow.tsx).
  // - camera/microphone stay self-allowed: photo check input + voice input.
  headers: async () => {
    // " https://origin" (leading space, ready to append to a CSP directive)
    // or "" when the env var is unset or malformed — a bad value must never
    // widen or break the policy.
    const originFromEnv = (value?: string): string => {
      try {
        if (!value) {
          return "";
        }
        const url = new URL(value);
        // Non-special schemes make .origin the literal string "null", and an
        // http: origin would be mixed-content-blocked on the https site
        // anyway — either way a silently useless CSP token. https only.
        return url.protocol === "https:" ? ` ${url.origin}` : "";
      } catch {
        return "";
      }
    };
    const umami = originFromEnv(process.env.NEXT_PUBLIC_UMAMI_SRC);
    // Umami's tracker POSTs events to its INGEST host, which on umami cloud is
    // a different host than the script: cloud.umami.is serves script.js, but
    // that build hardcodes `https://gateway.umami.is/api/send` as its default
    // target (grep the served script for /api/send). Allowing only the script
    // origin left every track() call CSP-refused in production — the whole
    // activation funnel, onboarding_started included, silently recorded
    // nothing while the page looked fine. Self-hosted installs serve script
    // and ingest from one origin, so they need no second token and must not be
    // widened to a third party; NEXT_PUBLIC_UMAMI_HOST_URL overrides for any
    // install whose ingest host is neither of those.
    // Exact origin, not a substring: `cloud.umami.is.example.com` must not be
    // read as umami cloud. (`umami` carries a leading space for CSP joining.)
    const umamiIngest = originFromEnv(
      process.env.NEXT_PUBLIC_UMAMI_HOST_URL ??
        (umami.trim() === "https://cloud.umami.is"
          ? "https://gateway.umami.is"
          : "")
    );
    // Sentry browser transport: without its ingest origin in connect-src, the
    // client DSN ships but every envelope POST is CSP-blocked and errors
    // silently never arrive.
    const sentry = originFromEnv(process.env.NEXT_PUBLIC_SENTRY_DSN);
    return [
    {
      source: "/(.*)",
      headers: [
        {
          key: "Content-Security-Policy",
          value: [
            "default-src 'self'",
            // ⚠️ `'unsafe-eval'` IN DEVELOPMENT ONLY, and it is not a relaxation
            // of the shipped policy — `NODE_ENV` is "production" for `next
            // build`/`next start` and every deployed request, so the header
            // served to a real user is byte-identical to what it was before.
            //
            // Why it has to be here: React's development build and Turbopack's
            // Fast Refresh runtime both call `eval()`. Without it every dev page
            // load throws "eval() is not supported in this environment", the
            // refresh runtime degrades, and the page reloads itself repeatedly
            // and renders half-built — which reads as a broken layout rather
            // than as a CSP problem. It cost a design review to diagnose.
            `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}${umami}`,
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' blob: data: https://*.blob.vercel-storage.com https://*.public.blob.vercel-storage.com",
            "font-src 'self' data:",
            // https://vercel.com: private-store client uploads
            // (@vercel/blob/client with access "private") exchange and upload
            // through vercel.com/api/blob, not *.blob.vercel-storage.com —
            // without it the paid Pantry photo upload is CSP-refused.
            `connect-src 'self' https://vercel.com https://*.blob.vercel-storage.com https://blob.vercel-storage.com${umami}${umamiIngest}${sentry}`,
            "frame-ancestors 'none'",
            "base-uri 'self'",
            "form-action 'self'",
            "object-src 'none'"
          ].join("; ")
        },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        {
          key: "Permissions-Policy",
          value: "camera=(self), microphone=(self), geolocation=()"
        },
        // ⚠️ NOT the 2026-08-08 flicker fix — unrelated defect found while
        // diagnosing it, fixed because it was there. `next dev` serves plain
        // HTTP on localhost, and we were sending a 2-year HSTS pin with
        // `includeSubDomains` over it. RFC 6797 §8.1 says a UA MUST ignore an
        // STS header received over insecure transport, so in practice it was
        // ignored — but `localhost` is a "potentially trustworthy" origin, and a
        // browser that ever did honour it would refuse plain HTTP to localhost
        // for two years, on every port, for every project on the machine. That
        // is an unrecoverable-looking dev machine in exchange for a header that
        // does nothing in dev. Production is unaffected: `NODE_ENV` is
        // "production" for `next build`/`next start` and every deployed request,
        // so the shipped header is byte-identical.
        ...(process.env.NODE_ENV === "development"
          ? []
          : [
              {
                key: "Strict-Transport-Security",
                value: "max-age=63072000; includeSubDomains"
              }
            ])
      ]
    }
  ];
  }
  // Note: the Video Engine dashboard's run.json writes (~1×/s under
  // video-engine/output/) can churn Fast Refresh, but the run is a DETACHED
  // child and survives HMR regardless, so churn is cosmetic. A webpack
  // watchOptions.ignored was tried but Next 16 defaults to Turbopack (a webpack
  // config is a hard build error). Revisit with a turbopack-native ignore only
  // if the churn actually annoys.
};

export default nextConfig;
