import Link from "next/link";

import type { StoredCheck } from "../lib/client/history-store";
import type { NextAction } from "../lib/coach/next-action";
import { stepCompletesFromLink } from "../lib/coach/orientation";
import { guideDoorEnabled } from "../lib/guide-door-flag";
import type { PlanBoxData } from "../lib/server/plan-box";
import { GuideIdeas } from "./guide-ideas";
import { HomeCheckHero } from "./home-check-hero";
import { LearnLink } from "./learn-link";
import { PlanBox } from "./plan-box";
import { StepLink } from "./step-link";
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
  /**
   * The orientation day while a week runs (PRD v1.1 §7.4, Task 3.5); null
   * otherwise, and always null with the `orient` door shut.
   */
  orientationDay: number | null;
};

export function DashboardView({ data }: { data: DashboardData }) {
  // Amendment A-106: flag on ⇒ the whole greeting collapses into ONE
  // .status-eyebrow-styled date line. The week summary is not rendered: PRD
  // v1.1 §7.6's wireframe shows one greeting line, /journey owns the week, and
  // plan §3's fold budget already spent those ~28px on the ideas block (Task
  // 1.8 fix round 1). The "day" arrives with the orientation week (Task 3.5):
  // while one runs, "Day N of your first week" takes the date's place in the
  // same <h1> (F-30/F-35, option C) rather than stacking above it — the fold
  // and the guest hydration reflow both depend on staying one line.
  // Flag off ⇒ today's markup, byte-for-byte.
  const ideasOn = guideDoorEnabled("ideas");
  // Review A-89: the day eyebrow carries day 1, so the first-win block (its
  // own "Day 1" eyebrow) does not render while a week runs.
  const weekOn = data.orientationDay !== null;
  // Review A-79: on a check-step day before the first check the page keeps
  // the step line off (owner rule), so the hero names the step instead. With a
  // week running, a null next action means exactly that.
  const heroIsStep = weekOn && data.nextAction === null;

  return (
    <div data-testid="dashboard">
      {data.showFirstWin && !weekOn ? (
        <div className="first-win" style={{ marginBottom: 16 }}>
          <p className="status-eyebrow">Day 1</p>
          <p className="page-copy">
            That&apos;s Day 1. One honest check a day is the whole habit —
            nothing to keep up, just a place to look back.
          </p>
        </div>
      ) : null}

      <div className="dash-greet">
        <h1
          className={
            ideasOn || weekOn ? "dash-greet-date dash-greet-date--eyebrow" : "dash-greet-date"
          }
          data-testid={weekOn ? "orientation-day" : undefined}
        >
          {weekOn ? `Day ${data.orientationDay} of your first week` : data.todayLabel}
        </h1>
        {ideasOn ? null : (
          <p className="dash-greet-sum" data-testid="dash-summary">
            {data.weekSummary}
          </p>
        )}
      </div>

      {/* PRD v1.1 §7.4/§7.6: ideas lead, the check hero drops to second and
          stays the one accent-filled action. Flag off ⇒ unchanged Home. */}
      {ideasOn ? <GuideIdeas /> : null}

      <HomeCheckHero stepToday={heroIsStep} />

      {data.nextAction ? (
        <p className="dash-next-action" data-testid="next-action">
          {/* Ruling F-38: a step into /learn/ reports learn_opened; that
              client leaf keeps this view a server tree. Review A-84, rulings
              F-54/F-55: steps 1 and 7, picked by the line's step id, go
              through StepLink, which completes the step and reports
              learn_opened for a /learn/ href as LearnLink does. Flag off ⇒
              no step id, so the plain link, byte-for-byte. */}
          {stepCompletesFromLink(data.nextAction.step) ? (
            <StepLink href={data.nextAction.href} step={data.nextAction.step}>
              {data.nextAction.text}
            </StepLink>
          ) : data.nextAction.href.startsWith("/learn/") ? (
            <LearnLink href={data.nextAction.href} from="step">
              {data.nextAction.text}
            </LearnLink>
          ) : (
            <Link href={data.nextAction.href}>{data.nextAction.text}</Link>
          )}
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
