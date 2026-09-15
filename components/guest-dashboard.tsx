"use client";

import { useEffect } from "react";

import { historyStore, type StoredCheck } from "../lib/client/history-store";
import { orientationStore } from "../lib/client/orientation-store";
import { profileStore } from "../lib/client/profile-store";
import { useHydrated } from "../lib/client/use-hydrated";
import {
  computeStreak,
  dayKeyLocal,
  showFirstWin,
  weekView
} from "../lib/coach/days";
import { nextAction } from "../lib/coach/next-action";
import {
  homeOrientation,
  type HomeOrientation
} from "../lib/coach/orientation";
import { guideDoorEnabled } from "../lib/guide-door-flag";
import type { PlanBoxData } from "../lib/server/plan-box";
import { DashboardView, type DashboardData } from "./dashboard-view";

/**
 * Guest dashboard (eng amendment #1): same <DashboardView> tree, fed from
 * the on-device store instead of the server. Renders the layout instantly
 * and fills in after mount — localStorage isn't available during prerender.
 * C7 restructure: guests get the same decluttered composition as signed-in
 * users (hero, next action, Today); week strip / insight / progress moved to
 * /journey, where guests see the sign-in state.
 */

const GUEST_PLAN_BOX: PlanBoxData = {
  planName: "Free plan",
  meta: "The daily check is free.",
  isFree: true,
  signedIn: false,
  attention: false
};

function buildData(
  checks: StoredCheck[],
  week: HomeOrientation | null,
  now: Date
): DashboardData {
  const todayKey = dayKeyLocal(now);
  const todayChecks = checks.filter(
    (check) => dayKeyLocal(new Date(check.createdAt)) === todayKey
  );
  const streak = computeStreak(
    checks.map((check) => check.createdAt),
    dayKeyLocal,
    now
  );
  // Same "this week" as the signed-in Home (last seven calendar-day keys),
  // so a guest and a signed-in user with identical checks read the same count.
  const weekKeys = new Set(weekView([], dayKeyLocal, now).map((day) => day.key));
  const weekCount = checks.filter((check) =>
    weekKeys.has(dayKeyLocal(new Date(check.createdAt)))
  ).length;
  const checkedToday = todayChecks.length > 0;
  const undoneActionToday = todayChecks.some(
    (check) => check.risk !== "SAFE" && !check.actionDoneAt
  );
  const step = week?.step ?? null;

  return {
    todayLabel: now.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric"
    }),
    weekSummary:
      weekCount === 0
        ? "No meals checked yet."
        : weekCount === 1
          ? "1 meal checked this week."
          : `${weekCount} meals checked this week.`,
    showFirstWin: showFirstWin(streak, todayChecks.length),
    todayChecks,
    // Owner rule 2026-08-11: before today's first check the hero IS the
    // action. A step that points at /check would be a second way to do the
    // same thing, so the line stays off; any other step renders from day 1.
    // Review A-109: the guest dashboard calls nextAction() unconditionally
    // today (guests see the classic line before their first check). The owner
    // rule guard applies only when the door is open, so the flag-off guest Home
    // stays byte-for-byte.
    nextAction: !guideDoorEnabled("orient")
      ? nextAction({ checkedToday, undoneActionToday })
      : checkedToday || (step && step.href !== "/check")
        ? nextAction({ checkedToday, undoneActionToday, orientation: step })
        : null,
    planBox: GUEST_PLAN_BOX,
    planBoxAttention: false,
    isDay0: checks.length === 0,
    orientationDay: week?.day ?? null
  };
}

export function GuestDashboard() {
  const hydrated = useHydrated();
  const checks = hydrated ? historyStore.all() : [];
  const now = new Date();
  // Review A-20: device orientation is read behind the same hydration gate as
  // the history; the door gate keeps the flag-off Home from reading it at all.
  const week =
    hydrated && guideDoorEnabled("orient")
      ? homeOrientation(
          orientationStore.get(),
          profileStore.get()?.onboardedAt,
          dayKeyLocal,
          now
        )
      : null;

  // Review A-66: a young profile's first flagged Home visit starts the week;
  // this render already shows day 1.
  const needsStart = week?.needsStart ?? false;
  useEffect(() => {
    if (needsStart) orientationStore.start();
  }, [needsStart]);

  return <DashboardView data={buildData(checks, week, now)} />;
}
