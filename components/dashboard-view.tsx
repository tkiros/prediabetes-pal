import Link from "next/link";

import type { StoredCheck } from "../lib/client/history-store";
import type { NextAction } from "../lib/coach/next-action";
import type { PlanBoxData } from "../lib/server/plan-box";
import { HomeCheckHero } from "./home-check-hero";
import { PlanBox } from "./plan-box";
import { TodayList } from "./today-list";

/**
 * The dashboard's one presentational tree (eng amendment: one prop-driven
 * <DashboardView>, two data sources) — rendered by the server page for
 * signed-in users and by <GuestDashboard> from localStorage. No hooks, no
 * data fetching; everything arrives as props.
 *
 * C7 four-jobs restructure (2026-07-21): Home's job is "help me decide now" —
 * greet, the check hero (first interactive element <768px, shell rule), ONE
 * next-action line, today's decisions, and nothing else. The week strip,
 * insight card, and progress rendering moved to /journey; the PlanBox renders
 * here ONLY when it carries actionable billing truth (trialing /
 * won't-renew — eng-review D2), because mobile has no sidebar and hiding
 * "Trial ends {date}" from the primary surface would break BC-2's spirit.
 * Steady-state "Renews {date}" and the free-plan upsell live in the sidebar
 * and /account.
 */

export type DashboardData = {
  todayLabel: string;
  weekSummary: string;
  showFirstWin: boolean;
  todayChecks: StoredCheck[];
  /** Null before today's first check — the hero is the next action then. */
  nextAction: NextAction | null;
  planBox: PlanBoxData;
  /** True when the plan box carries actionable billing truth (D2). */
  planBoxAttention: boolean;
  isDay0: boolean;
};

export function DashboardView({ data }: { data: DashboardData }) {
  return (
    <div data-testid="dashboard">
      {data.showFirstWin ? (
        <div className="first-win" style={{ marginBottom: 16 }}>
          <p className="status-eyebrow">Day 1</p>
          <p className="page-copy">
            That&apos;s Day 1. One honest check a day is the whole habit —
            nothing to keep up, just a place to look back.
          </p>
        </div>
      ) : null}

      <div className="dash-greet">
        <h1 className="dash-greet-date">{data.todayLabel}</h1>
        <p className="dash-greet-sum" data-testid="dash-summary">
          {data.weekSummary}
        </p>
      </div>

      <HomeCheckHero />

      {data.nextAction ? (
        <p className="dash-next-action" data-testid="next-action">
          <Link href={data.nextAction.href}>{data.nextAction.text}</Link>
        </p>
      ) : null}

      <section className="dash-card" aria-label="Today">
        <h3 className="dash-sect-title">Today</h3>
        {/* Day-0: the week strip was Home's sanctioned empty state until C7
            moved it to /journey; the Today card carries the warmth now
            (plan §3, design voice #2). */}
        {data.isDay0 ? (
          <p className="dash-preview-note" data-testid="dash-day0-note">
            Your checks will appear here — today stays quiet until you check a
            meal, never marked against you.
          </p>
        ) : (
          <TodayList checks={data.todayChecks} />
        )}
      </section>

      {data.planBoxAttention ? <PlanBox data={data.planBox} /> : null}
    </div>
  );
}
