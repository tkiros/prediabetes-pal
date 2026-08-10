import { NextResponse } from "next/server";

import { getLaunchControls } from "../../../lib/pal/launch-controls";
import { getPalEnv } from "../../../lib/pal/env";
import { rateLimitConfigState } from "../../../lib/pal/rate-limit";
import { captureServerError } from "../../../lib/pal/sentry-capture";
import { getDb, schema, type Db } from "../../../lib/server/db";

export const runtime = "nodejs";

// Staleness windows mirror each cron's own cadence with slack: bai-weekly runs
// Mondays via vercel.json ("30 4 * * 1"); nudge, pantry-sweep,
// trial-precharge and stripe-reconcile run hourly from the Railway scheduler
// service (see docs/runbooks/price-test.md) — all four take the same 2h window.
const NUDGE_STALE_MS = 2 * 60 * 60 * 1000; // 2 hours
const BAI_WEEKLY_STALE_MS = 8 * 24 * 60 * 60 * 1000; // 8 days
const TRIAL_PRECHARGE_STALE_MS = 2 * 60 * 60 * 1000; // 2 hours
const PANTRY_SWEEP_STALE_MS = 2 * 60 * 60 * 1000; // 2 hours
const STRIPE_RECONCILE_STALE_MS = 2 * 60 * 60 * 1000; // 2 hours

type DbProbeStatus = "ok" | "error" | "unconfigured";
type CronProbeStatus = "ok" | "stale" | "never" | "unknown";
type CronsProbe = {
  nudge: CronProbeStatus;
  baiWeekly: CronProbeStatus;
  trialPrecharge: CronProbeStatus;
  pantrySweep: CronProbeStatus;
  stripeReconcile: CronProbeStatus;
};

type ReadinessIssue =
  | "database_unavailable"
  | "database_unconfigured"
  | "email_delivery_unavailable"
  | "billing_webhook_unconfigured"
  | "rate_limit_unavailable"
  | `cron_${keyof CronsProbe}_${Exclude<CronProbeStatus, "ok" | "unknown">}`;

const UNKNOWN_CRONS: CronsProbe = {
  nudge: "unknown",
  baiWeekly: "unknown",
  trialPrecharge: "unknown",
  pantrySweep: "unknown",
  stripeReconcile: "unknown",
};

export type HealthDeps = {
  db?: () => Db;
  now?: () => Date;
};

/**
 * Handler-factory pattern (matches createNudgeCronHandler /
 * createBaiCronHandler): real defaults, PGlite-injectable for tests.
 */
export function createHealthHandler(deps: HealthDeps = {}) {
  const dbAccessor = deps.db ?? getDb;
  const now = deps.now ?? (() => new Date());

  return async function GET() {
    const { db, crons } = await probeDbAndCrons(dbAccessor, now());
    const emailDelivery = emailDeliveryConfigState();
    const billingWebhook = billingWebhookConfigState();

    let environment: "preview" | "production" | "development" | "test";

    try {
      const env = getPalEnv();
      environment = env.environment;
    } catch {
      // OPENAI_API_KEY missing — still report env/launch state from what we know
      environment = detectEnvironment(process.env);

      return NextResponse.json(
        {
          ok: false,
          status: "degraded",
          issues: ["model_configuration"],
          environment,
          launch: "missing_config",
          launchMode: "normal",
          upstash: rateLimitConfigState(),
          emailDelivery,
          billingWebhook,
          db,
          crons,
        },
        { status: 503, headers: NO_STORE_HEADERS },
      );
    }

    // Read launch state from the shared seam (same state the middleware uses)
    const controls = await getLaunchControls();
    const launchMode = controls.launchMode;
    const isPaused = !controls.publicChecksEnabled || launchMode === "paused";

    const upstash = rateLimitConfigState();
    const issues = readinessIssues({
      environment,
      upstash,
      emailDelivery,
      billingWebhook,
      db,
      crons,
    });
    const ready = issues.length === 0;

    return NextResponse.json(
      {
        ok: ready,
        status: ready ? "healthy" : "degraded",
        issues,
        environment,
        launch: isPaused ? "paused" : "ready",
        launchMode,
        // Surfaces the merge-gate dependency: middleware fails CLOSED (503) on a
        // public deploy when Upstash env is absent OR invalid. "invalid" means the
        // URL is not the https:// REST endpoint (e.g. a rediss:// TCP URL) — wire
        // monitoring to alert on anything but "configured". ponytail: static
        // validation only, no live ping — the limiter fails open on reachability,
        // so a ping failure isn't app-fatal and doesn't belong in a hot probe.
        upstash,
        emailDelivery,
        billingWebhook,
        // W-04 gate state, boolean-only (G8): checkout now 401s unauthenticated
        // before the legal gate runs, so an external probe can no longer tell
        // whether LEGAL_TERMS_FINAL is set. Same predicate as checkoutGate() in
        // app/api/billing/handlers.ts. Exposes no config values.
        checkoutGate: process.env.LEGAL_TERMS_FINAL === "0" ? "closed" : "open",
        // These bounded states contain no secrets, URLs, timestamps, or counts.
        // Unlike the process-liveness route, this endpoint is product readiness:
        // stateful features and scheduled recovery paths must actually work.
        db,
        crons,
      },
      { status: ready ? 200 : 503, headers: NO_STORE_HEADERS },
    );
  };
}

export const GET = createHealthHandler();

const NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const;

function readinessIssues(input: {
  environment: "preview" | "production" | "development" | "test";
  upstash: ReturnType<typeof rateLimitConfigState>;
  emailDelivery: "configured" | "unconfigured";
  billingWebhook: "configured" | "unconfigured";
  db: DbProbeStatus;
  crons: CronsProbe;
}): ReadinessIssue[] {
  const issues: ReadinessIssue[] = [];

  if (input.db === "unconfigured") {
    issues.push("database_unconfigured");
  } else if (input.db === "error") {
    issues.push("database_unavailable");
  } else {
    for (const [name, status] of Object.entries(input.crons) as Array<
      [keyof CronsProbe, CronProbeStatus]
    >) {
      if (status === "stale" || status === "never") {
        issues.push(`cron_${name}_${status}`);
      }
    }
  }

  if (
    (input.environment === "production" || input.environment === "preview") &&
    input.upstash !== "configured"
  ) {
    issues.push("rate_limit_unavailable");
  }
  if (
    (input.environment === "production" || input.environment === "preview") &&
    input.emailDelivery !== "configured"
  ) {
    issues.push("email_delivery_unavailable");
  }
  if (
    (input.environment === "production" || input.environment === "preview") &&
    input.billingWebhook !== "configured"
  ) {
    issues.push("billing_webhook_unconfigured");
  }

  return issues;
}

function emailDeliveryConfigState(): "configured" | "unconfigured" {
  return process.env.RESEND_API_KEY?.trim() &&
    process.env.RESEND_WEBHOOK_SECRET?.trim() &&
    process.env.AUTH_SECRET?.trim()
    ? "configured"
    : "unconfigured";
}

// The Stripe webhook handler fails CLOSED (503) without its signing secret,
// which silently stops entitlement minting — readiness must surface that the
// money path is down, exactly like email delivery above.
function billingWebhookConfigState(): "configured" | "unconfigured" {
  return process.env.STRIPE_WEBHOOK_SECRET?.trim()
    ? "configured"
    : "unconfigured";
}

/**
 * db: "unconfigured" is detected from getDb()'s own "DATABASE_URL is not
 * set." throw rather than reading process.env.DATABASE_URL directly — tests
 * inject a PGlite `db` accessor that never consults that env var, so this
 * keeps the three states (ok/error/unconfigured) correct under injection
 * instead of only under the real singleton.
 *
 * crons stays "unknown"/"unknown" whenever db isn't "ok" (chosen over
 * omitting the key — see task report — so consumers always get a stable
 * response shape to parse).
 */
async function probeDbAndCrons(
  dbAccessor: () => Db,
  now: Date,
): Promise<{ db: DbProbeStatus; crons: CronsProbe }> {
  let db: Db;

  try {
    db = dbAccessor();
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "DATABASE_URL is not set."
    ) {
      return { db: "unconfigured", crons: UNKNOWN_CRONS };
    }
    await captureServerError(error, "route");
    return { db: "error", crons: UNKNOWN_CRONS };
  }

  try {
    const heartbeats = await db.select().from(schema.cronHeartbeat);
    const nudgeAt = heartbeats.find((row) => row.name === "nudge")?.lastRunAt;
    const baiAt = heartbeats.find(
      (row) => row.name === "bai-weekly",
    )?.lastRunAt;
    const prechargeAt = heartbeats.find(
      (row) => row.name === "trial-precharge",
    )?.lastRunAt;
    const pantryAt = heartbeats.find(
      (row) => row.name === "pantry-sweep",
    )?.lastRunAt;
    const reconcileAt = heartbeats.find(
      (row) => row.name === "stripe-reconcile",
    )?.lastRunAt;

    return {
      db: "ok",
      crons: {
        nudge: cronStatus(nudgeAt, now, NUDGE_STALE_MS),
        baiWeekly: cronStatus(baiAt, now, BAI_WEEKLY_STALE_MS),
        trialPrecharge: cronStatus(prechargeAt, now, TRIAL_PRECHARGE_STALE_MS),
        pantrySweep: cronStatus(pantryAt, now, PANTRY_SWEEP_STALE_MS),
        stripeReconcile: cronStatus(
          reconcileAt,
          now,
          STRIPE_RECONCILE_STALE_MS,
        ),
      },
    };
  } catch (error) {
    await captureServerError(error, "route");
    return { db: "error", crons: UNKNOWN_CRONS };
  }
}

function cronStatus(
  lastRunAt: Date | undefined,
  now: Date,
  staleMs: number,
): CronProbeStatus {
  if (!lastRunAt) {
    return "never";
  }
  return new Date(lastRunAt).getTime() < now.getTime() - staleMs
    ? "stale"
    : "ok";
}

function detectEnvironment(
  input: NodeJS.ProcessEnv,
): "preview" | "production" | "development" | "test" {
  if (input.NODE_ENV === "test") {
    return "test";
  }

  switch (input.VERCEL_ENV) {
    case "preview":
      return "preview";
    case "production":
      return "production";
    case "development":
      return "development";
    default:
      return input.NODE_ENV === "production" ? "production" : "development";
  }
}
