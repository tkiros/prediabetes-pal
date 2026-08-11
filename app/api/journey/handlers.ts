import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { learningJourneyServerEnabled } from "../../../lib/learning-journey-flag";
import {
  applyAction,
  completedStages,
  currentDay,
  currentStage,
  graduateToMaintenance,
  isComplete,
  JourneyTransitionError,
  NOT_STARTED,
  PAUSE_REASONS,
  type Journey,
  type JourneyAction
} from "../../../lib/journey/state";
import { STAGE_DESCRIPTORS, stageDescriptor } from "../../../lib/journey/stages";
import { captureServerError } from "../../../lib/pal/sentry-capture";
import { capabilitiesFor } from "../../../lib/server/capabilities";
import { getDb, schema, type Db } from "../../../lib/server/db";
import {
  getEntitlement,
  type Entitlement
} from "../../../lib/server/entitlement";
import { getSessionInfo, type SessionInfo } from "../../../lib/server/session";

/**
 * Learning Journey API (plan §P4.1, §8 entity `learning_journeys`).
 *
 * GET returns the caller's current journey with the DERIVED stage + day (never a
 * stored stage — lib/journey/state.ts is the single source), plus the stage
 * descriptor copy. POST applies one explicit action (start/pause/resume/
 * graduate/maintenance) through the same pure state machine, server-side.
 *
 * The endpoint accepts the full action set — start/pause/resume/graduate/
 * maintenance plus the `graduate_maintenance` convenience that runs both
 * explicit day-90 transitions in one request (plan §P4.4). `pause` takes an
 * optional bounded `reason`; entering maintenance relaxes a daily nudge cadence
 * to weekly (the lower-intensity product-state effect).
 *
 * Gate order is identical to every other Phase 3/4 route (flag 404 → 401 → 403):
 *   1. server flag OFF  → 404  (feature not in this build; endpoint inert until
 *      an approved rollout — global constraint §10)
 *   2. no session       → 401
 *   3. not entitled     → 403  (the journey is premium — `weeklyLearning` in the
 *      single capability matrix, lib/server/capabilities.ts; UI renders from this,
 *      never UI-only gating — global constraint §6)
 *
 * Illegal transitions are a 409 (not a 400): the request was well-formed, the
 * state just didn't allow it — "no hidden reset" means an out-of-order action is
 * refused, never silently absorbed.
 */

export type JourneyRouteDeps = {
  db?: () => Db;
  getSession?: () => Promise<SessionInfo>;
  entitlementOf?: (db: Db, userId: string) => Promise<Entitlement>;
  now?: () => Date;
  env?: { LEARNING_JOURNEY_ENABLED?: string };
};

export const JOURNEY_ACTIONS = [
  "start",
  "pause",
  "resume",
  "graduate",
  "maintenance"
] as const satisfies readonly JourneyAction[];

/**
 * The action set the ENDPOINT accepts. The five above are the pure state-machine
 * transitions; `graduate_maintenance` is the plan §P4.4 day-90 "graduate into
 * maintenance" convenience — one request that runs both explicit transitions
 * (lib/journey/state.graduateToMaintenance) so the UI needn't fire two POSTs and
 * risk a half-applied graduate.
 */
export const JOURNEY_API_ACTIONS = [
  ...JOURNEY_ACTIONS,
  "graduate_maintenance"
] as const;

const JourneyActionSchema = z
  .object({
    action: z.enum(JOURNEY_API_ACTIONS),
    // Optional bounded pause reason (plan §P4.4). Only meaningful for `pause`;
    // ignored for every other action. Never free text.
    reason: z.enum(PAUSE_REASONS).optional()
  })
  .strict();

function unauthorized() {
  return NextResponse.json({ error: "Sign in first." }, { status: 401 });
}

function notFound() {
  return NextResponse.json({ error: "Not found." }, { status: 404 });
}

function forbidden() {
  return NextResponse.json({ error: "Forbidden." }, { status: 403 });
}

async function serverError(error: unknown) {
  await captureServerError(error, "route");
  return NextResponse.json(
    { error: "Something went wrong. Please try again." },
    { status: 500 }
  );
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function resolveDeps(deps: JourneyRouteDeps) {
  return {
    db: deps.db ?? getDb,
    getSession: deps.getSession ?? getSessionInfo,
    entitlementOf:
      deps.entitlementOf ??
      ((d: Db, userId: string) => getEntitlement(d, userId)),
    now: deps.now ?? (() => new Date()),
    env:
      deps.env ??
      (process.env as unknown as { LEARNING_JOURNEY_ENABLED?: string })
  };
}

type ResolvedDeps = ReturnType<typeof resolveDeps>;

async function gate(
  ctx: ResolvedDeps
): Promise<
  | { ok: true; session: NonNullable<SessionInfo> }
  | { ok: false; response: NextResponse }
> {
  if (!learningJourneyServerEnabled(ctx.env)) {
    return { ok: false, response: notFound() };
  }
  const session = await ctx.getSession();
  if (!session) {
    return { ok: false, response: unauthorized() };
  }
  const entitlement = await ctx.entitlementOf(ctx.db(), session.userId);
  if (!capabilitiesFor(entitlement, ctx.env).weeklyLearning) {
    return { ok: false, response: forbidden() };
  }
  return { ok: true, session };
}

type JourneyRow = {
  state: "active" | "paused" | "graduated" | "maintenance";
  startedAt: Date;
  pausedAt: Date | null;
  accumulatedPauseMs: number;
  graduatedAt: Date | null;
  maintenanceAt: Date | null;
  pauseReason: Journey["pauseReason"];
};

/** The caller's stored journey, or the not-started sentinel when there is no row. */
async function loadJourney(
  db: Db,
  userId: string
): Promise<{ journey: Journey; exists: boolean }> {
  const [row] = await db
    .select({
      state: schema.learningJourneys.state,
      startedAt: schema.learningJourneys.startedAt,
      pausedAt: schema.learningJourneys.pausedAt,
      accumulatedPauseMs: schema.learningJourneys.accumulatedPauseMs,
      graduatedAt: schema.learningJourneys.graduatedAt,
      maintenanceAt: schema.learningJourneys.maintenanceAt,
      pauseReason: schema.learningJourneys.pauseReason
    })
    .from(schema.learningJourneys)
    .where(eq(schema.learningJourneys.userId, userId));

  if (!row) {
    return { journey: NOT_STARTED, exists: false };
  }
  const typed = row as JourneyRow;
  return {
    journey: {
      state: typed.state,
      startedAt: typed.startedAt,
      pausedAt: typed.pausedAt,
      accumulatedPauseMs: typed.accumulatedPauseMs,
      graduatedAt: typed.graduatedAt,
      maintenanceAt: typed.maintenanceAt,
      pauseReason: typed.pauseReason
    },
    exists: true
  };
}

/** The wire shape both GET and POST return — derived stage/day + descriptors. */
function serializeJourney(journey: Journey, now: Date) {
  const stage = currentStage(journey, now);
  return {
    journey: {
      state: journey.state,
      day: currentDay(journey, now),
      stage,
      isComplete: isComplete(journey, now),
      completedStages: completedStages(journey, now),
      pauseReason: journey.pauseReason,
      startedAt: journey.startedAt ? journey.startedAt.toISOString() : null,
      pausedAt: journey.pausedAt ? journey.pausedAt.toISOString() : null,
      graduatedAt: journey.graduatedAt
        ? journey.graduatedAt.toISOString()
        : null,
      maintenanceAt: journey.maintenanceAt
        ? journey.maintenanceAt.toISOString()
        : null
    },
    currentStage: stageDescriptor(stage),
    stages: STAGE_DESCRIPTORS
  };
}

export function createJourneyGetHandler(deps: JourneyRouteDeps = {}) {
  const ctx = resolveDeps(deps);

  return async function GET() {
    const g = await gate(ctx);
    if (!g.ok) {
      return g.response;
    }
    try {
      const { journey } = await loadJourney(ctx.db(), g.session.userId);
      return NextResponse.json(serializeJourney(journey, ctx.now()));
    } catch (error) {
      return serverError(error);
    }
  };
}

export function createJourneyPostHandler(deps: JourneyRouteDeps = {}) {
  const ctx = resolveDeps(deps);

  return async function POST(request: Request) {
    const g = await gate(ctx);
    if (!g.ok) {
      return g.response;
    }

    const parsed = JourneyActionSchema.safeParse(await readJson(request));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }
    const { action, reason } = parsed.data;
    const now = ctx.now();

    try {
      const { journey, exists } = await loadJourney(ctx.db(), g.session.userId);

      let next: Journey;
      try {
        next =
          action === "graduate_maintenance"
            ? graduateToMaintenance(journey, now)
            : applyAction(
                journey,
                action,
                now,
                action === "pause" ? reason ?? null : null
              );
      } catch (error) {
        if (error instanceof JourneyTransitionError) {
          // Well-formed request, wrong state → 409. No hidden reset.
          return NextResponse.json(
            { error: `Cannot ${action} from ${journey.state}.` },
            { status: 409 }
          );
        }
        throw error;
      }

      if (!exists) {
        // Only `start` reaches here (every other action from not_started throws
        // above). Insert the singleton row. AUD-020: a racing double-start hits
        // UNIQUE(user_id) — translate it to the same 409 the CAS path returns
        // (the winner's start stands; no hidden reset, no 500).
        const inserted = await ctx
          .db()
          .insert(schema.learningJourneys)
          .values({
            userId: g.session.userId,
            state: next.state as JourneyRow["state"],
            startedAt: next.startedAt as Date,
            pausedAt: next.pausedAt,
            accumulatedPauseMs: next.accumulatedPauseMs,
            graduatedAt: next.graduatedAt,
            maintenanceAt: next.maintenanceAt,
            pauseReason: next.pauseReason,
            createdAt: now,
            updatedAt: now
          })
          .onConflictDoNothing({ target: schema.learningJourneys.userId })
          .returning({ id: schema.learningJourneys.id });
        if (inserted.length === 0) {
          return NextResponse.json(
            { error: `Cannot ${action} from active.` },
            { status: 409 }
          );
        }
      } else {
        // Compare-and-swap on the loaded state (U2): the UPDATE only lands if the
        // stored state is STILL what we transitioned from. A concurrent action
        // that already moved the journey makes this match zero rows → 409, the
        // same "no hidden reset" semantics as an illegal transition. Without the
        // state predicate, two in-flight actions would both apply against a stale
        // read and silently clobber each other.
        const updated = await ctx
          .db()
          .update(schema.learningJourneys)
          .set({
            state: next.state as JourneyRow["state"],
            pausedAt: next.pausedAt,
            accumulatedPauseMs: next.accumulatedPauseMs,
            graduatedAt: next.graduatedAt,
            maintenanceAt: next.maintenanceAt,
            pauseReason: next.pauseReason,
            updatedAt: now
          })
          .where(
            and(
              eq(schema.learningJourneys.userId, g.session.userId),
              eq(schema.learningJourneys.state, journey.state as JourneyRow["state"])
            )
          )
          .returning({ id: schema.learningJourneys.id });
        if (updated.length === 0) {
          return NextResponse.json(
            { error: `Cannot ${action} from ${journey.state}.` },
            { status: 409 }
          );
        }
      }

      // Maintenance mode's product-state effect on nudges (plan §P4.4 "lower
      // intensity"; Task 19): entering maintenance drops a DAILY cadence to
      // WEEKLY. We only ever relax `daily` → `weekly` — a user who already chose
      // `few_per_week`/`weekly` is left alone, and after maintenance the user can
      // freely turn the cadence back up in settings. Fail-open scope: this only
      // fires when the transition landed on `maintenance`.
      if (next.state === "maintenance") {
        await ctx
          .db()
          .update(schema.profiles)
          .set({ nudgeCadence: "weekly" })
          .where(
            and(
              eq(schema.profiles.userId, g.session.userId),
              eq(schema.profiles.nudgeCadence, "daily")
            )
          );
      }

      return NextResponse.json(serializeJourney(next, now));
    } catch (error) {
      return serverError(error);
    }
  };
}
