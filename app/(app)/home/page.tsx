import { and, desc, eq, gte } from "drizzle-orm";

import {
  DashboardView,
  type DashboardData
} from "../../../components/dashboard-view";
import { FirstRunGate } from "../../../components/first-run-gate";
import { GuestDashboard } from "../../../components/guest-dashboard";
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

  const [profile] = await db
    .select({ timezone: schema.profiles.timezone })
    .from(schema.profiles)
    .where(eq(schema.profiles.userId, session.userId));
  const timezone = profile?.timezone ?? "America/New_York";
  const dayKey = dayKeyInTimezone(timezone);

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
    nextAction: nextAction({
      checkedToday: todayRows.length > 0,
      undoneActionToday: todayRows.some(
        (row) => row.risk !== "SAFE" && !row.actionDoneAt
      )
    }),
    planBox,
    planBoxAttention: planBox.attention,
    isDay0: rows.length === 0
  };

  return <DashboardView data={data} />;
}
