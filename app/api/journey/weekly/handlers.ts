import { and, eq, gte } from "drizzle-orm";
import { NextResponse } from "next/server";

import { learningJourneyServerEnabled } from "../../../../lib/learning-journey-flag";
import {
  currentStage,
  NOT_STARTED,
  type Journey,
  type Stage
} from "../../../../lib/journey/state";
import {
  deriveWeeklyLearning,
  WEEKLY_LEARNING_VERSION,
  type ContextLabel,
  type WeeklyCheckInput,
  type WeeklyLearningArtifact,
  type WeeklyMemoryInput
} from "../../../../lib/journey/weekly-learning";
import { dayKeyInTimezone } from "../../../../lib/coach/days";
import { captureServerError } from "../../../../lib/pal/sentry-capture";
import { capabilitiesFor } from "../../../../lib/server/capabilities";
import { encryptField, safeDecrypt } from "../../../../lib/server/crypto";
import { getDb, schema, type Db } from "../../../../lib/server/db";
import {
  getEntitlement,
  type Entitlement
} from "../../../../lib/server/entitlement";
import { getSessionInfo, type SessionInfo } from "../../../../lib/server/session";

/**
 * Weekly learning artifact API (plan §P4.2, §8 entity `weekly_reflections`).
 *
 * GET returns the caller's CURRENT week (computed on the fly, never persisted)
 * plus up to the last four COMPLETED weeks. A completed week is generated LAZILY
 * the first time it is requested (deterministic projection → encrypt → persist)
 * and served from `weekly_reflections` thereafter — there is no cron. The
 * projection itself is pure (lib/journey/weekly-learning); this route only does
 * the IO: decrypt inputs, derive the stage, persist ciphertext.
 *
 * Gate order is identical to every other Phase 3/4 route (flag 404 → 401 → 403):
 *   1. server flag OFF  → 404  (endpoint inert until an approved rollout, §10)
 *   2. no session       → 401
 *   3. not entitled     → 403  (weekly learning is premium — `weeklyLearning`
 *      in the single capability matrix, lib/server/capabilities.ts)
 *
 * The persisted artifact contains the user's own meal text (`repeatedUncertainty`)
 * so it is AES-256-GCM at rest (global constraint §5) and decrypted only here for
 * the owner. Nothing in this route feeds the check engine (global constraint §1).
 */

export type WeeklyRouteDeps = {
  db?: () => Db;
  getSession?: () => Promise<SessionInfo>;
  entitlementOf?: (db: Db, userId: string) => Promise<Entitlement>;
  now?: () => Date;
  env?: { LEARNING_JOURNEY_ENABLED?: string };
};

/** How many completed weeks of history the response carries (plan: "last N (4)"). */
export const WEEKLY_HISTORY_WEEKS = 4;

// Wide enough to always contain the current + 4 prior Mon–Sun weeks for any IANA
// timezone offset, without tz-aware instant math (mirrors bai-cron's approach).
const LOOKBACK_DAYS = 7 * (WEEKLY_HISTORY_WEEKS + 1) + 7;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function resolveDeps(deps: WeeklyRouteDeps) {
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

// ── Pure Mon–Sun calendar-key math (same style as lib/server/bai-cron.ts) ──

function keyToUtcMidnight(key: string): Date {
  return new Date(`${key}T00:00:00.000Z`);
}
function addDaysToKey(key: string, days: number): string {
  const date = keyToUtcMidnight(key);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * The UTC instant of local midnight on `dateKey` in `timeZone`. Used to place a
 * calendar-day boundary at the right real instant for any IANA offset (U4).
 */
function zonedMidnightUtc(dateKey: string, timeZone: string): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  const naiveUtc = Date.UTC(year, month - 1, day);
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
  const parts: Record<string, number> = {};
  for (const part of dtf.formatToParts(new Date(naiveUtc))) {
    if (part.type !== "literal") {
      parts[part.type] = Number(part.value);
    }
  }
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  );
  return new Date(naiveUtc - (asUtc - naiveUtc));
}

/**
 * The last real instant of the local Mon–Sun week starting `weekStart` in
 * `timeZone` — local midnight of the following Monday minus 1ms (U4). The stage
 * is derived as of this instant so a stage boundary that falls inside a non-UTC
 * week is attributed to the correct week; the old `keyToUtcMidnight(weekEnd)`
 * used the START of Sunday UTC, mis-dating the boundary by up to a full day.
 */
function endOfLocalWeekInstant(weekStart: string, timeZone: string): Date {
  const nextMonday = addDaysToKey(weekStart, 7);
  return new Date(zonedMidnightUtc(nextMonday, timeZone).getTime() - 1);
}

/** The Monday key of the week containing `todayKey` (0=Sun..6=Sat). */
function mondayOf(todayKey: string): string {
  const weekdayUtc = keyToUtcMidnight(todayKey).getUTCDay();
  const daysSinceMonday = (weekdayUtc + 6) % 7;
  return addDaysToKey(todayKey, -daysSinceMonday);
}

type WeekWindow = { weekStart: string; weekEnd: string; completed: boolean };

/** The current week (incomplete) followed by the last N completed weeks. */
function weekWindows(now: Date, timezone: string): WeekWindow[] {
  const todayKey = dayKeyInTimezone(timezone)(now);
  const currentWeekStart = mondayOf(todayKey);
  const windows: WeekWindow[] = [
    {
      weekStart: currentWeekStart,
      weekEnd: addDaysToKey(currentWeekStart, 6),
      completed: false
    }
  ];
  for (let i = 1; i <= WEEKLY_HISTORY_WEEKS; i += 1) {
    const weekStart = addDaysToKey(currentWeekStart, -7 * i);
    windows.push({ weekStart, weekEnd: addDaysToKey(weekStart, 6), completed: true });
  }
  return windows;
}

async function loadJourney(db: Db, userId: string): Promise<Journey> {
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
    return NOT_STARTED;
  }
  return {
    state: row.state as Journey["state"],
    startedAt: row.startedAt as Date,
    pausedAt: row.pausedAt,
    accumulatedPauseMs: row.accumulatedPauseMs,
    graduatedAt: row.graduatedAt,
    maintenanceAt: row.maintenanceAt,
    pauseReason: row.pauseReason
  };
}

/** The derived journey stage as of the given instant (single source: state.ts). */
function stageAt(journey: Journey, instant: Date): Stage | null {
  return currentStage(journey, instant);
}

export function createWeeklyGetHandler(deps: WeeklyRouteDeps = {}) {
  const ctx = resolveDeps(deps);

  return async function GET() {
    const g = await gate(ctx);
    if (!g.ok) {
      return g.response;
    }

    try {
      const db = ctx.db();
      const userId = g.session.userId;
      const now = ctx.now();

      const [profile] = await db
        .select({ timezone: schema.profiles.timezone })
        .from(schema.profiles)
        .where(eq(schema.profiles.userId, userId));
      const timezone = profile?.timezone ?? "America/New_York";
      const dayKey = dayKeyInTimezone(timezone);

      const journey = await loadJourney(db, userId);

      const since = new Date(now.getTime() - LOOKBACK_DAYS * MS_PER_DAY);
      const checkRows = await db
        .select({
          createdAt: schema.checks.createdAt,
          foodCiphertext: schema.checks.foodCiphertext,
          risk: schema.checks.risk,
          wasClarified: schema.checks.wasClarified
        })
        .from(schema.checks)
        .where(and(eq(schema.checks.userId, userId), gte(schema.checks.createdAt, since)));

      const memoryRows = await db
        .select({
          createdAt: schema.mealMemories.createdAt,
          label: schema.mealMemories.label,
          favorite: schema.mealMemories.favorite
        })
        .from(schema.mealMemories)
        .where(
          and(
            eq(schema.mealMemories.userId, userId),
            gte(schema.mealMemories.createdAt, since)
          )
        );

      const windows = weekWindows(now, timezone);

      // Deriving one window: bucket that week's checks + memories by local day,
      // derive the stage as of the week's END (current week uses `now`), project.
      const deriveWindow = (window: WeekWindow): WeeklyLearningArtifact => {
        const checks: WeeklyCheckInput[] = checkRows
          .filter((row) => {
            const key = dayKey(row.createdAt);
            return key >= window.weekStart && key <= window.weekEnd;
          })
          .map((row) => ({
            food: safeDecrypt(row.foodCiphertext),
            risk: row.risk,
            wasClarified: row.wasClarified
          }));

        const memories: WeeklyMemoryInput[] = memoryRows
          .filter((row) => {
            const key = dayKey(row.createdAt);
            return key >= window.weekStart && key <= window.weekEnd;
          })
          .map((row) => ({
            label: (row.label as ContextLabel | null) ?? null,
            favorite: row.favorite
          }));

        const instant = window.completed
          ? endOfLocalWeekInstant(window.weekStart, timezone)
          : now;
        const stage = stageAt(journey, instant);

        return deriveWeeklyLearning({ checks, memories, stage }, window.weekStart);
      };

      const [currentWindow, ...completedWindows] = windows;
      const current = deriveWindow(currentWindow);
      const currentStageNumber = stageAt(journey, now);

      const history: WeeklyLearningArtifact[] = [];
      for (const window of completedWindows) {
        history.push(await resolveCompletedWeek(db, userId, window, deriveWindow));
      }

      return NextResponse.json({
        version: WEEKLY_LEARNING_VERSION,
        stage: currentStageNumber,
        current,
        history
      });
    } catch (error) {
      return serverError(error);
    }
  };
}

/**
 * A completed week: serve the persisted artifact if one exists at the current
 * version; otherwise derive it, persist the ciphertext lazily, and return it.
 * Regeneration is byte-identical (the projection is deterministic), so a race
 * that inserts twice is harmless — onConflictDoNothing keeps the first write and
 * the response uses the freshly-derived value either way.
 */
async function resolveCompletedWeek(
  db: Db,
  userId: string,
  window: WeekWindow,
  deriveWindow: (window: WeekWindow) => WeeklyLearningArtifact
): Promise<WeeklyLearningArtifact> {
  const [existing] = await db
    .select({
      version: schema.weeklyReflections.version,
      artifactCiphertext: schema.weeklyReflections.artifactCiphertext
    })
    .from(schema.weeklyReflections)
    .where(
      and(
        eq(schema.weeklyReflections.userId, userId),
        eq(schema.weeklyReflections.weekStart, window.weekStart)
      )
    );

  if (existing && existing.version === WEEKLY_LEARNING_VERSION) {
    try {
      return JSON.parse(safeDecrypt(existing.artifactCiphertext)) as WeeklyLearningArtifact;
    } catch {
      // Unreadable/rotated-key row → fall through and recompute rather than fail.
    }
  }

  const artifact = deriveWindow(window);
  const ciphertext = encryptField(JSON.stringify(artifact));

  if (existing) {
    // Stale version → replace with the current-version projection.
    await db
      .update(schema.weeklyReflections)
      .set({ version: WEEKLY_LEARNING_VERSION, artifactCiphertext: ciphertext })
      .where(
        and(
          eq(schema.weeklyReflections.userId, userId),
          eq(schema.weeklyReflections.weekStart, window.weekStart)
        )
      );
  } else {
    // E5: guard the lazy insert on the profiles (consent) row still existing, so
    // a weekly read that races a consent withdrawal cannot resurrect a reflection
    // for a user who has withdrawn. The profiles row is locked FOR UPDATE, so a
    // concurrent withdrawal's profiles-delete serializes against this insert;
    // withdrawal then deletes weekly_reflections LAST, cleaning up anything
    // inserted just before it committed.
    await db.transaction(async (tx) => {
      const [profile] = await tx
        .select({ userId: schema.profiles.userId })
        .from(schema.profiles)
        .where(eq(schema.profiles.userId, userId))
        .for("update");
      if (!profile) {
        return; // Consent withdrawn — never create a new artifact behind the erase.
      }
      await tx
        .insert(schema.weeklyReflections)
        .values({
          userId,
          weekStart: window.weekStart,
          version: WEEKLY_LEARNING_VERSION,
          artifactCiphertext: ciphertext
        })
        .onConflictDoNothing();
    });
  }

  return artifact;
}
