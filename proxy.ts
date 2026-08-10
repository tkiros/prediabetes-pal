/**
 * Prediabetes Pal proxy (né middleware; Next 16 rename) — pre-model abuse + cost gate
 * (Plans 04-02 + launch-hardening + W-11)
 *
 * Runs BEFORE any model spend, any email send, and any Stripe session, on every
 * POST the route table in lib/pal/rate-limit.ts claims:
 *   1. /api/check* — launch-mode pause gate (Edge Config kill-switch), then
 *      per-IP limit + global daily cap.
 *   2. /api/trial/start and POST /api/auth/* — per-IP abuse limits. These were
 *      previously UNPROTECTED: trial/start creates a users row, sends a
 *      magic-link email and opens a Stripe Checkout session for any address a
 *      stranger types, and /api/auth/* is a magic-link flood + account
 *      enumeration oracle.
 *
 * Order matters: IP-blocked requests must NOT increment the global daily
 * counter, or an attacker could trip the global pause cheaply (handled inside
 * evaluateRateLimit). Production with no Upstash config fails CLOSED (never run
 * public + unlimited); dev/test without config skips limiting. Transient Redis
 * errors fail OPEN for checks and fail CLOSED for the two email-sending doors
 * — see RouteLimit in rate-limit.ts for why the asymmetry is deliberate.
 *
 * Edge-runtime safe: does NOT call getPalEnv() (which requires
 * OPENAI_API_KEY and would throw when absent).
 */

import { NextRequest, NextResponse } from "next/server";
import { evaluateLaunchMode } from "./lib/pal/launch-controls";
import {
  createRateLimitDeps,
  evaluateAbuseLimit,
  evaluateRateLimit,
  getClientIp,
  matchRouteLimit,
  type RateLimitDeps
} from "./lib/pal/rate-limit";
import { emitSafeEvent } from "./lib/pal/telemetry";

const DEFAULT_PAUSE_DISCLAIMER = "Not medical advice.";
const RATE_LIMIT_COPY =
  "Prediabetes Pal is helping a lot of people right now. Please try again in a moment.";
// NEW-003: the fail-closed check 503 fires BEFORE the deterministic clinical
// router can run, so a user describing acute symptoms during a limiter outage
// would otherwise see only "try again". The abuse gate is not weakened — the
// copy carries the human-care boundary the clinical route would have given.
const URGENT_CARE_LINE =
  "If you're feeling unwell right now — shaky, faint, confused, or worse — don't wait for an app: contact your doctor or your local emergency number.";
const CHECK_UNAVAILABLE_COPY = `${RATE_LIMIT_COPY} ${URGENT_CARE_LINE}`;
// Abuse-route copy is deliberately plain: these responses go to a form, not the
// check UI, and must not hint at whether the address/account exists.
const ABUSE_LIMIT_COPY = "Too many attempts. Please try again in a little while.";

// Built once per runtime; null when Upstash env is absent OR invalid (e.g. a
// rediss:// TCP URL instead of the https:// REST URL). The factory never
// throws — a throw at module scope here is a platform 500 on every matched
// request (launch audit BUG-01); null fails closed below on public deploys.
const rateLimitDeps: RateLimitDeps | null = createRateLimitDeps();

/**
 * True for any internet-reachable Vercel deploy (preview OR production). Preview
 * URLs are public and shareable, so a missing-Upstash misconfiguration there
 * must also fail closed — never run public + unlimited. Only genuine local dev
 * and the test runner skip limiting.
 */
function isPublicDeploy(): boolean {
  if (process.env.NODE_ENV === "test") return false;
  // Optimized local E2E uses `next start`, which forces NODE_ENV=production.
  // An explicit Vercel development tier still means local/non-public; real
  // preview and production deployments remain fail-closed below.
  if (process.env.VERCEL_ENV === "development") return false;
  if (process.env.VERCEL_ENV === "preview" || process.env.VERCEL_ENV === "production") {
    return true;
  }
  return process.env.NODE_ENV === "production";
}

function environment(): "preview" | "production" | "development" | "test" {
  if (process.env.NODE_ENV === "test") return "test";
  switch (process.env.VERCEL_ENV) {
    case "preview":
      return "preview";
    case "production":
      return "production";
    case "development":
      return "development";
    default:
      return process.env.NODE_ENV === "production"
        ? "production"
        : "development";
  }
}

function pause503(message: string) {
  return NextResponse.json(
    { kind: "retry", message, disclaimer: DEFAULT_PAUSE_DISCLAIMER },
    { status: 503 }
  );
}

function abuse429(retryAfterSeconds: number) {
  return NextResponse.json(
    { error: ABUSE_LIMIT_COPY },
    { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
  );
}

function abuse503(retryAfterSeconds: number) {
  return NextResponse.json(
    { error: ABUSE_LIMIT_COPY },
    { status: 503, headers: { "Retry-After": String(retryAfterSeconds) } }
  );
}

export async function proxy(request: NextRequest) {
  const route = matchRouteLimit(request.nextUrl.pathname, request.method);
  if (!route) {
    return NextResponse.next();
  }

  // 1. Global pause gate (existing behavior) — checks only. It runs BEFORE any
  // limiter concern because the kill-switch must still fire when Upstash is
  // absent: those are independent controls, and pausing model spend cannot
  // depend on the rate limiter being configured.
  if (route.kind === "check") {
    const evaluation = await evaluateLaunchMode();
    if (!evaluation.ok) {
      return pause503(evaluation.message);
    }
  }

  // 2. Never run public + unlimited. Fail closed on any public deploy; skip in
  // local dev / test only.
  if (!rateLimitDeps) {
    if (!isPublicDeploy()) {
      return NextResponse.next();
    }
    if (route.kind === "check") {
      emitSafeEvent({
        name: "check_failed",
        environment: environment(),
        reasonCode: "paused"
      });
      return pause503(CHECK_UNAVAILABLE_COPY);
    }
    return abuse503(60);
  }

  const ip = getClientIp(request.headers);

  if (route.kind === "abuse") {
    const decision = await evaluateAbuseLimit(
      route.bucket,
      ip,
      rateLimitDeps,
      route.failClosed
    );
    if (decision.ok) {
      return NextResponse.next();
    }
    // A store error on a fail-closed door is not the caller's fault — 503 (try
    // again), not 429 (you did too much).
    return decision.reason === "store_error"
      ? abuse503(decision.retryAfterSeconds)
      : abuse429(decision.retryAfterSeconds);
  }

  // 3. Inbound abuse + cost gate.
  const decision = await evaluateRateLimit(ip, rateLimitDeps);
  if (!decision.ok) {
    emitSafeEvent({
      name: "check_failed",
      environment: environment(),
      reasonCode: decision.reason === "daily_cap" ? "daily_cap" : "rate_limited"
    });
    return NextResponse.json(
      {
        kind: "retry",
        message: RATE_LIMIT_COPY,
        disclaimer: DEFAULT_PAUSE_DISCLAIMER
      },
      {
        status: 429,
        headers: { "Retry-After": String(decision.retryAfterSeconds) }
      }
    );
  }

  return NextResponse.next();
}

// The matcher is the coarse filter (it must be statically analyzable); the
// route table in matchRouteLimit() is the precise one. GET /api/auth/session
// and /api/auth/csrf reach the proxy and are passed straight through — they are
// polled on every page load and must never be limited.
export const config = {
  matcher: [
    "/api/check",
    "/api/check/photo-draft",
    "/api/trial/start",
    "/api/auth/:path*",
    "/api/billing/:path*",
    "/api/support/case"
  ]
};
