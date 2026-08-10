import { randomUUID } from "node:crypto";

import {
  and,
  eq,
  gt,
  gte,
  isNotNull,
  isNull,
  lt,
  lte,
  or
} from "drizzle-orm";

import { dayKeyInTimezone, hourInTimezone } from "../coach/days";
import { learningJourneyServerEnabled } from "../learning-journey-flag";
import {
  cadenceAllowsSend,
  isQuietHour,
  nudgeBody,
  selectJourneyNudge,
  type JourneyNudgeSignals,
  type NudgeCadence,
  type NudgeSelection
} from "../journey/nudge";
import {
  NOT_STARTED,
  currentStage,
  type Journey,
  type JourneyState
} from "../journey/state";
import {
  currentStageIntentMet,
  weeklySignalsFrom,
  type WeeklyCheckInput,
  type WeeklyMemoryInput
} from "../journey/weekly-learning";
import { capabilitiesFor } from "./capabilities";
import { safeDecrypt } from "./crypto";
import { getEntitlement } from "./entitlement";
import { schema, type Db } from "./db";
import { recordHeartbeat } from "./heartbeat";

/**
 * The daily nudge (plan §P5, §P4.3): one gentle push per user per local day,
 * only for opted-in premium users whose cadence + quiet hours allow it and who
 * haven't checked yet. When the Learning Journey flag is on and the user has a
 * journey, the trigger class + copy become journey-aware (lib/journey/nudge.ts);
 * otherwise behavior is unchanged (a plain rotating generic reminder). The
 * hourly cron calls runNudgeCron; sending is injected (web-push in prod).
 */

// Re-exported so existing callers/tests keep importing the generic bank from
// here; the single source now lives in the pure lib/journey/nudge module.
export { GENERIC_NUDGE_COPY as NUDGE_COPY_BANK } from "../journey/nudge";

export type PushSendResult = "ok" | "gone" | "error";

export type NudgeDeps = {
  now?: () => Date;
  env?: { LEARNING_JOURNEY_ENABLED?: string };
  send: (
    subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
    payload: string
  ) => Promise<PushSendResult>;
};

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const NUDGE_LEASE_MS = 5 * 60 * 1000;
const NUDGE_MAX_ATTEMPTS = 3;

type ProfileCandidate = {
  userId: string;
  timezone: string;
  nudgeHour: number;
  nudgeCadence: NudgeCadence;
  nudgeQuietStart: number | null;
  nudgeQuietEnd: number | null;
};

type PushSubscription = typeof schema.pushSubscriptions.$inferSelect;

type NudgeAttemptPlan = {
  subscription: PushSubscription;
  kind: "initial" | "retry";
  attemptCount: number;
};

type NudgeCronResult = {
  sent: number;
  pruned: number;
  failed: number;
  pending: number;
  exhausted: number;
  skipped: number;
};

const clearedNudgeAttemptState = {
  nudgeAttemptDate: null,
  nudgeAttemptCount: 0,
  nudgeRetryAfter: null,
  nudgeLeaseToken: null,
  nudgeLeaseUntil: null
} as const;

function nextHourlyTick(now: Date): Date {
  return new Date(Math.floor(now.getTime() / HOUR_MS) * HOUR_MS + HOUR_MS);
}

function retryState(
  subscription: PushSubscription,
  todayKey: string,
  now: Date
): "ready" | "pending" | "exhausted" | null {
  if (subscription.nudgeAttemptDate !== todayKey) {
    return null;
  }
  if (subscription.nudgeAttemptCount >= NUDGE_MAX_ATTEMPTS) {
    return "exhausted";
  }
  if (
    subscription.nudgeLeaseUntil &&
    subscription.nudgeLeaseUntil.getTime() > now.getTime()
  ) {
    return "pending";
  }
  if (subscription.nudgeRetryAfter) {
    return subscription.nudgeRetryAfter.getTime() <= now.getTime()
      ? "ready"
      : "pending";
  }
  // A worker can disappear after claiming but before recording a provider
  // result. Once its lease expires, a later hourly run may recover the attempt.
  return subscription.nudgeLeaseUntil ? "ready" : "pending";
}

async function clearTodayNudgeAttempts(
  db: Db,
  userId: string,
  todayKey: string,
  now: Date
): Promise<void> {
  await db
    .update(schema.pushSubscriptions)
    .set(clearedNudgeAttemptState)
    .where(
      and(
        eq(schema.pushSubscriptions.userId, userId),
        eq(schema.pushSubscriptions.nudgeAttemptDate, todayKey),
        or(
          isNull(schema.pushSubscriptions.nudgeLeaseUntil),
          lte(schema.pushSubscriptions.nudgeLeaseUntil, now)
        )
      )
    );
}

async function clearStaleNudgeAttempts(
  db: Db,
  userId: string,
  todayKey: string,
  now: Date
): Promise<void> {
  await db
    .update(schema.pushSubscriptions)
    .set(clearedNudgeAttemptState)
    .where(
      and(
        eq(schema.pushSubscriptions.userId, userId),
        or(
          lt(schema.pushSubscriptions.nudgeAttemptDate, todayKey),
          gt(schema.pushSubscriptions.nudgeAttemptDate, todayKey)
        ),
        or(
          isNull(schema.pushSubscriptions.nudgeLeaseUntil),
          lte(schema.pushSubscriptions.nudgeLeaseUntil, now)
        )
      )
    );
}

async function claimNudgeAttempt(
  db: Db,
  plan: NudgeAttemptPlan,
  todayKey: string,
  now: Date
): Promise<string | null> {
  const leaseToken = randomUUID();
  const leaseUntil = new Date(now.getTime() + NUDGE_LEASE_MS);
  const leaseAvailable = or(
    isNull(schema.pushSubscriptions.nudgeLeaseUntil),
    lte(schema.pushSubscriptions.nudgeLeaseUntil, now)
  );
  const eligibility =
    plan.kind === "initial"
      ? or(
          isNull(schema.pushSubscriptions.nudgeAttemptDate),
          lt(schema.pushSubscriptions.nudgeAttemptDate, todayKey),
          gt(schema.pushSubscriptions.nudgeAttemptDate, todayKey)
        )
      : and(
          eq(schema.pushSubscriptions.nudgeAttemptDate, todayKey),
          eq(
            schema.pushSubscriptions.nudgeAttemptCount,
            plan.subscription.nudgeAttemptCount
          ),
          lt(
            schema.pushSubscriptions.nudgeAttemptCount,
            NUDGE_MAX_ATTEMPTS
          ),
          or(
            and(
              isNotNull(schema.pushSubscriptions.nudgeRetryAfter),
              lte(schema.pushSubscriptions.nudgeRetryAfter, now)
            ),
            and(
              isNull(schema.pushSubscriptions.nudgeRetryAfter),
              isNotNull(schema.pushSubscriptions.nudgeLeaseUntil),
              lte(schema.pushSubscriptions.nudgeLeaseUntil, now)
            )
          )
        );

  const claimed = await db
    .update(schema.pushSubscriptions)
    .set({
      nudgeAttemptDate: todayKey,
      nudgeAttemptCount: plan.attemptCount,
      nudgeRetryAfter: null,
      nudgeLeaseToken: leaseToken,
      nudgeLeaseUntil: leaseUntil
    })
    .where(
      and(
        eq(schema.pushSubscriptions.id, plan.subscription.id),
        or(
          isNull(schema.pushSubscriptions.lastNudgeDate),
          lt(schema.pushSubscriptions.lastNudgeDate, todayKey)
        ),
        leaseAvailable,
        eligibility
      )
    )
    .returning({ id: schema.pushSubscriptions.id });

  return claimed.length === 1 ? leaseToken : null;
}

/** The caller's stored journey, or the not-started sentinel when there is no row. */
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
    state: row.state as JourneyState,
    startedAt: row.startedAt,
    pausedAt: row.pausedAt,
    accumulatedPauseMs: row.accumulatedPauseMs,
    graduatedAt: row.graduatedAt,
    maintenanceAt: row.maintenanceAt,
    pauseReason: row.pauseReason
  };
}

/**
 * Whether a completed-week artifact exists that postdates the user's last nudge.
 *
 * SIGNAL CHOICE (documented, Task 19): the honest, no-new-column read of "a new
 * completed-week artifact is available" is: a persisted `weekly_reflections` row
 * whose generation day (createdAt, in the user's timezone) is strictly LATER
 * than the most recent day we last nudged this user (max `lastNudgeDate` across
 * their push subscriptions). A never-nudged user with any reflection qualifies.
 *
 * CAVEAT (gap): Task 18 persists reflections lazily on first view, so in
 * practice this marks "an artifact generated since we last reminded you", not a
 * guaranteed-unseen one. A dedicated viewed-at timestamp would make "unviewed"
 * exact; that is a noted follow-up, not built here.
 */
async function weeklyArtifactFresh(
  db: Db,
  userId: string,
  tzDayKey: (d: Date) => string,
  lastNudgeDate: string | null
): Promise<boolean> {
  const rows = await db
    .select({ createdAt: schema.weeklyReflections.createdAt })
    .from(schema.weeklyReflections)
    .where(eq(schema.weeklyReflections.userId, userId));
  if (rows.length === 0) {
    return false;
  }
  const latest = rows.reduce(
    (max, row) => (row.createdAt > max ? row.createdAt : max),
    rows[0].createdAt
  );
  if (!lastNudgeDate) {
    return true;
  }
  // Both are YYYY-MM-DD keys — lexicographic compare is chronological.
  return tzDayKey(latest) > lastNudgeDate;
}

/**
 * The week's journey signals (last 7 days): distinct meals explored (needs the
 * encrypted food text, decrypted here exactly as the weekly route does) plus the
 * plaintext memory fields. Used only to decide whether the current stage's
 * headline intent is already met — never to alter a card (constraint §1).
 */
async function loadStageIntentMet(
  db: Db,
  userId: string,
  stage: NonNullable<ReturnType<typeof currentStage>>,
  windowStart: Date
): Promise<boolean> {
  const checkRows = await db
    .select({
      foodCiphertext: schema.checks.foodCiphertext,
      risk: schema.checks.risk,
      wasClarified: schema.checks.wasClarified
    })
    .from(schema.checks)
    .where(
      and(
        eq(schema.checks.userId, userId),
        gte(schema.checks.createdAt, windowStart)
      )
    );
  const memoryRows = await db
    .select({
      label: schema.mealMemories.label,
      favorite: schema.mealMemories.favorite
    })
    .from(schema.mealMemories)
    .where(
      and(
        eq(schema.mealMemories.userId, userId),
        gte(schema.mealMemories.createdAt, windowStart)
      )
    );

  const checks: WeeklyCheckInput[] = checkRows.map((row) => ({
    food: safeDecrypt(row.foodCiphertext),
    risk: row.risk,
    wasClarified: row.wasClarified
  }));
  const memories: WeeklyMemoryInput[] = memoryRows.map((row) => ({
    label: row.label,
    favorite: row.favorite
  }));

  return currentStageIntentMet(stage, weeklySignalsFrom(checks, memories));
}

export async function runNudgeCron(
  db: Db,
  deps: NudgeDeps
): Promise<NudgeCronResult> {
  const now = deps.now?.() ?? new Date();
  const journeyEnabled = learningJourneyServerEnabled(
    deps.env ??
      (process.env as unknown as { LEARNING_JOURNEY_ENABLED?: string })
  );
  let sent = 0;
  let pruned = 0;
  let failed = 0;
  let pending = 0;
  let exhausted = 0;
  let skipped = 0;

  const candidates = (await db
    .select({
      userId: schema.profiles.userId,
      timezone: schema.profiles.timezone,
      nudgeHour: schema.profiles.nudgeHour,
      nudgeCadence: schema.profiles.nudgeCadence,
      nudgeQuietStart: schema.profiles.nudgeQuietStart,
      nudgeQuietEnd: schema.profiles.nudgeQuietEnd
    })
    .from(schema.profiles)
    .where(eq(schema.profiles.nudgeOptIn, true))) as ProfileCandidate[];

  for (const candidate of candidates) {
    const localHour = hourInTimezone(candidate.timezone)(now);
    const dayKey = dayKeyInTimezone(candidate.timezone);
    const todayKey = dayKey(now);

    // Retry state is local-day bounded. Remove yesterday's metadata before
    // considering a new initial attempt; a stale retry never rolls forward.
    await clearStaleNudgeAttempts(db, candidate.userId, todayKey, now);

    const subscriptions = await db
      .select()
      .from(schema.pushSubscriptions)
      .where(eq(schema.pushSubscriptions.userId, candidate.userId));

    // Cadence spacing remains tied to the last confirmed success. Attempt
    // metadata cannot make a user who was never due eligible for a late send.
    const due = subscriptions.filter((subscription) =>
      cadenceAllowsSend(
        candidate.nudgeCadence,
        todayKey,
        subscription.lastNudgeDate
      )
    );
    const retrying = due.filter(
      (subscription) => subscription.nudgeAttemptDate === todayKey
    );
    const initialWindow =
      localHour === candidate.nudgeHour &&
      due.some((subscription) => subscription.nudgeAttemptDate !== todayKey);
    if (!initialWindow && retrying.length === 0) {
      skipped += 1;
      continue;
    }

    // Checked today already? The nudge's whole job is done. Also compute the
    // most recent check date for the inactivity wind-down.
    const recent = await db
      .select({ createdAt: schema.checks.createdAt })
      .from(schema.checks)
      .where(eq(schema.checks.userId, candidate.userId));
    if (recent.some((row) => dayKey(row.createdAt) === todayKey)) {
      await clearTodayNudgeAttempts(db, candidate.userId, todayKey, now);
      skipped += 1;
      continue;
    }

    const entitlement = await getEntitlement(db, candidate.userId, {
      now: () => now
    });
    // The nudge is a paid capability — gate on the matrix, not an inline tier
    // check, so "who gets a reminder" has exactly one definition (T10).
    if (!capabilitiesFor(entitlement).nudges) {
      await clearTodayNudgeAttempts(db, candidate.userId, todayKey, now);
      skipped += 1;
      continue;
    }

    // AUD-019: pause/graduate is the user's RECORDED intent to stop journey
    // nudging, and it must survive a flag-off rollback — so the stop-state is
    // checked BEFORE the flag gate. Rolling LEARNING_JOURNEY_ENABLED back off
    // can never silently resume reminders for a paused or graduated journey.
    const journey = await loadJourney(db, candidate.userId);
    if (journey.state === "paused" || journey.state === "graduated") {
      await clearTodayNudgeAttempts(db, candidate.userId, todayKey, now);
      skipped += 1;
      continue;
    }

    // Journey-aware trigger selection (flag-gated). When the flag is off, the
    // class is always generic and the remaining journey rules (stage choice,
    // 14-day inactivity, weekly-artifact freshness) do not apply.
    let selection: NudgeSelection = { class: "generic", stage: null };
    if (journeyEnabled) {
      const stage = currentStage(journey, now);

      const daysSinceLastCheck = mostRecentCheckAgeDays(recent, now);

      const lastNudgeDate = subscriptions.reduce<string | null>(
        (max, sub) =>
          sub.lastNudgeDate && (!max || sub.lastNudgeDate > max)
            ? sub.lastNudgeDate
            : max,
        null
      );

      const signals: JourneyNudgeSignals = {
        journeyState: journey.state,
        stage,
        daysSinceLastCheck,
        // Only "active" journeys can produce a journey_step; skip the extra
        // reads otherwise (maintenance/not_started never use stageIntentMet).
        stageIntentMet:
          journey.state === "active" && stage !== null
            ? await loadStageIntentMet(
                db,
                candidate.userId,
                stage,
                new Date(now.getTime() - WEEK_MS)
              )
            : true,
        weeklyArtifactFresh:
          (journey.state === "active" || journey.state === "maintenance") &&
          stage !== null
            ? await weeklyArtifactFresh(
                db,
                candidate.userId,
                dayKey,
                lastNudgeDate
              )
            : false
      };

      const chosen = selectJourneyNudge(signals);
      if (!chosen) {
        // A stop rule fired (paused / graduated / 14-day inactivity).
        await clearTodayNudgeAttempts(db, candidate.userId, todayKey, now);
        skipped += 1;
        continue;
      }
      selection = chosen;
    }

    // Quiet hours apply again at the actual retry hour. An initial attempt is
    // simply suppressed; an explicit same-day retry remains pending until a
    // later non-quiet hourly tick.
    if (
      isQuietHour(localHour, candidate.nudgeQuietStart, candidate.nudgeQuietEnd)
    ) {
      for (const subscription of retrying) {
        const state = retryState(subscription, todayKey, now);
        if (state === "exhausted") {
          exhausted += 1;
        } else if (state !== null) {
          pending += 1;
        }
      }
      skipped += 1;
      continue;
    }

    const attempts: NudgeAttemptPlan[] = [];
    for (const subscription of due) {
      const state = retryState(subscription, todayKey, now);
      if (state === "ready") {
        attempts.push({
          subscription,
          kind: "retry",
          attemptCount: subscription.nudgeAttemptCount + 1
        });
      } else if (state === "pending") {
        pending += 1;
      } else if (state === "exhausted") {
        exhausted += 1;
      } else if (localHour === candidate.nudgeHour) {
        attempts.push({
          subscription,
          kind: "initial",
          attemptCount: 1
        });
      }
    }

    if (attempts.length === 0) {
      skipped += 1;
      continue;
    }

    // Deterministic generic rotation by day so all of a user's devices say the
    // same thing (and tests stay stable).
    const dayNumber = Number(todayKey.replace(/-/g, ""));
    const body = nudgeBody(selection, dayNumber);
    const payload = JSON.stringify({
      title: "Prediabetes Pal",
      body,
      // Bounded routing metadata only — no health text. The SW opens
      // /check?nudge=<class>&stage=<stage>; the client emits nudge_opened.
      class: selection.class,
      stage: selection.stage === null ? "none" : String(selection.stage)
    });

    for (const plan of attempts) {
      const leaseToken = await claimNudgeAttempt(db, plan, todayKey, now);
      if (!leaseToken) {
        // Another overlapping run or a concurrent preference/subscription
        // change won. Do not send without owning the exact attempt.
        pending += 1;
        continue;
      }

      let result: PushSendResult = "error";
      try {
        result = await deps.send(
          {
            endpoint: plan.subscription.endpoint,
            keys: {
              p256dh: plan.subscription.p256dh,
              auth: plan.subscription.auth
            }
          },
          payload
        );
      } catch {
        // Treat an injected/provider transport rejection the same as the
        // sender's bounded "error" result. Never let one endpoint prevent the
        // rest of the cohort from being attempted. A provider/network error can
        // be acknowledgement-ambiguous: bounded at-least-once retry may produce
        // a duplicate if delivery succeeded but its acknowledgement was lost.
      }

      if (result === "gone") {
        const deleted = await db
          .delete(schema.pushSubscriptions)
          .where(
            and(
              eq(schema.pushSubscriptions.id, plan.subscription.id),
              eq(schema.pushSubscriptions.nudgeLeaseToken, leaseToken)
            )
          )
          .returning({ id: schema.pushSubscriptions.id });
        pruned += deleted.length;
        continue;
      }

      if (result === "ok") {
        const finalized = await db
          .update(schema.pushSubscriptions)
          .set({
            lastNudgeDate: todayKey,
            ...clearedNudgeAttemptState
          })
          .where(
            and(
              eq(schema.pushSubscriptions.id, plan.subscription.id),
              eq(schema.pushSubscriptions.nudgeLeaseToken, leaseToken)
            )
          )
          .returning({ id: schema.pushSubscriptions.id });
        if (finalized.length === 1) {
          sent += 1;
        } else {
          // Provider success without a durable matching lease is not safe to
          // report as a completed attempt.
          failed += 1;
        }
        continue;
      }

      await db
        .update(schema.pushSubscriptions)
        .set({
          nudgeRetryAfter:
            plan.attemptCount < NUDGE_MAX_ATTEMPTS
              ? nextHourlyTick(now)
              : null,
          nudgeLeaseToken: null,
          nudgeLeaseUntil: null
        })
        .where(
          and(
            eq(schema.pushSubscriptions.id, plan.subscription.id),
            eq(schema.pushSubscriptions.nudgeLeaseToken, leaseToken)
          )
        );
      failed += 1;
    }
  }

  // Liveness, not delivery success: the heartbeat means "the cron executed",
  // exactly like the other four crons stamp unconditionally. `pending`
  // (lease/quiet-hour deferral) and `exhausted` (bounded same-day retry gave
  // up) are EXPECTED outcomes; gating the stamp on them made one stuck push
  // endpoint suppress the heartbeat all day, flipping /api/health to a false
  // `cron_nudge_stale` 503 while the cron ran fine every hour. Delivery
  // failures still surface through the returned counters and the route's 503.
  await recordHeartbeat(db, "nudge", now);

  return { sent, pruned, failed, pending, exhausted, skipped };
}

/**
 * Whole days since the user's most recent check, or null if they have never
 * checked (a new user is not "inactive" — see INACTIVITY_STOP_DAYS).
 */
function mostRecentCheckAgeDays(
  checks: Array<{ createdAt: Date }>,
  now: Date
): number | null {
  if (checks.length === 0) {
    return null;
  }
  const latest = checks.reduce(
    (max, row) => (row.createdAt > max ? row.createdAt : max),
    checks[0].createdAt
  );
  return Math.floor((now.getTime() - latest.getTime()) / (24 * 60 * 60 * 1000));
}
