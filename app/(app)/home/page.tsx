import { and, desc, eq, gte } from "drizzle-orm";

import {
  DashboardView,
  type DashboardData
} from "../../../components/dashboard-view";
import { FirstRunGate } from "../../../components/first-run-gate";
import { GuestDashboard } from "../../../components/guest-dashboard";
import { OrientationSync } from "../../../components/orientation-sync";
import {
  normalizeInputMethod,
  type StoredCheck
} from "../../../lib/client/history-store";
import { computeCoachView } from "../../../lib/coach/compute";
import {
  dayKeyInTimezone,
  showFirstWin,
  verdictWeekView
} from "../../../lib/coach/days";
import { nextAction } from "../../../lib/coach/next-action";
import {
  EMPTY_ORIENTATION,
  homeOrientation,
  OrientationStateSchema
} from "../../../lib/coach/orientation";
import { guideDoorEnabled } from "../../../lib/guide-door-flag";
import { safeDecrypt } from "../../../lib/server/crypto";
import { getDb, schema } from "../../../lib/server/db";
import { getPlanBox } from "../../../lib/server/plan-box";
import { getSessionInfo } from "../../../lib/server/session";

export const metadata = { title: "Home — Prediabetes Pal" };

/**
 * Home — "help me decide now" (C7 four-jobs restructure 2026-07-21). Hybrid
 * per eng amendment #1: signed-in renders server-side from one bounded query;
 * guests get <GuestDashboard> fed from localStorage. Brand-new visitors are
 * routed to /onboarding by FirstRunGate (guest branch only).
 *
 * The page carries the check hero, today's decisions, ONE next-action line,
 * and a conditional PlanBox (actionable billing truth only, eng-review D2).
 * Week strip, insight, and any progress rendering live on /journey — Home no
 * longer reads bai_weekly at all (RV-3).
 *
 * The query window is 35 days / limit 500 — the same contract
 * app/api/coach/route.ts feeds computeCoachView; a shorter window silently
 * caps streaks (eng amendment #2).
 */
export default async function HomePage() {
  const session = await getSessionInfo();

  if (!session) {
    return (
      <>
        <FirstRunGate />
        <GuestDashboard />
      </>
    );
  }

  const db = getDb();
  const now = new Date();
  const orientOn = guideDoorEnabled("orient");

  const [profile] = await db
    .select({
      timezone: schema.profiles.timezone,
      // Ruling F-25: one query (A-21), and the orientation column is named
      // only with the door open — a query that names it fails on a database
      // where migration 0019 has not run. Door shut ⇒ today's query.
      ...(orientOn
        ? {
            onboardedAt: schema.profiles.onboardedAt,
            orientation: schema.profiles.orientation
          }
        : {})
    })
    .from(schema.profiles)
    .where(eq(schema.profiles.userId, session.userId));
  const timezone = profile?.timezone ?? "America/New_York";
  const dayKey = dayKeyInTimezone(timezone);

  // Review A-24: an unreadable stored value is the empty state. No profiles
  // row (A-92) ⇒ no week here; the device keeps a guest's week.
  const stored = OrientationStateSchema.safeParse(profile?.orientation);
  const firstWeek =
    orientOn && profile
      ? homeOrientation(
          stored.success ? stored.data : EMPTY_ORIENTATION,
          profile.onboardedAt,
          dayKey,
          now
        )
      : null;
  const step = firstWeek?.step ?? null;
  // Review A-66: the server copy is still null, so a guest week begun on this
  // device moves over once (OrientationSync).
  const migrate = orientOn && profile !== undefined && profile.orientation == null;

  const since = new Date(now.getTime() - 35 * 24 * 60 * 60 * 1000);
  const rows = await db
    .select({
      id: schema.checks.id,
      clientId: schema.checks.clientId,
      createdAt: schema.checks.createdAt,
      risk: schema.checks.risk,
      actionDoneAt: schema.checks.actionDoneAt,
      foodCiphertext: schema.checks.foodCiphertext,
      a1cBand: schema.checks.a1cBand,
      inputMethod: schema.checks.inputMethod
    })
    .from(schema.checks)
    .where(
      and(
        eq(schema.checks.userId, session.userId),
        gte(schema.checks.createdAt, since)
      )
    )
    .orderBy(desc(schema.checks.createdAt))
    .limit(500);

  const coach = computeCoachView(rows, timezone, now);
  const week = verdictWeekView(rows, dayKey, now);

  const todayKey = dayKey(now);
  const todayRows = rows.filter((row) => dayKey(row.createdAt) === todayKey);
  const todayChecks: StoredCheck[] = todayRows.map((row) => ({
    clientId: row.clientId ?? row.id,
    food: safeDecrypt(row.foodCiphertext),
    risk: row.risk,
    a1cBand: row.a1cBand,
    inputMethod: normalizeInputMethod(row.inputMethod),
    createdAt: row.createdAt.toISOString(),
    actionDoneAt: row.actionDoneAt?.toISOString()
  }));

  const weekKeys = new Set(week.map((day) => day.key));
  const weekCount = rows.filter((row) =>
    weekKeys.has(dayKey(row.createdAt))
  ).length;

  const planBox = await getPlanBox();

  const data: DashboardData = {
    todayLabel: now.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      timeZone: timezone
    }),
    weekSummary:
      weekCount === 0
        ? "No meals checked yet."
        : weekCount === 1
          ? "1 meal checked this week."
          : `${weekCount} meals checked this week.`,
    showFirstWin: showFirstWin(coach.streak, todayChecks.length),
    todayChecks,
    // Before the first check of the day the hero right above IS the next
    // action — a "Check your next uncertain meal" line under it pointed at a
    // second way to do the same thing (owner testing 2026-08-11). The line
    // only renders once today has a check to follow up on, or when the day's
    // orientation step points somewhere other than /check (Task 3.5). With
    // the door shut `step` is null and this is the rule as it was.
    nextAction:
      todayRows.length > 0 || (step && step.href !== "/check")
        ? nextAction({
            checkedToday: todayRows.length > 0,
            undoneActionToday: todayRows.some(
              (row) => row.risk !== "SAFE" && !row.actionDoneAt
            ),
            orientation: step
          })
        : null,
    planBox,
    planBoxAttention: planBox.attention,
    isDay0: rows.length === 0,
    orientationDay: firstWeek?.day ?? null
  };

  return (
    <>
      {migrate || firstWeek?.needsStart ? (
        <OrientationSync migrate={migrate} start={firstWeek?.needsStart ?? false} />
      ) : null}
      <DashboardView data={data} />
    </>
  );
}
