"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { DisclaimerLine } from "../../../components/disclaimer-line";
import { JourneyCard } from "../../../components/journey-card";
import { LearningSummary } from "../../../components/learning-summary";
import { WeekStrip } from "../../../components/week-strip";
import { learningJourneyUiEnabled } from "../../../lib/learning-journey-flag";
import {
  resolveProgressState,
  type CoachInsightWire,
  type LatestBai,
  type ProgressState,
  type VerdictWeekDayWire
} from "../../../lib/coach/progress-state";
import { RECAP_POSTURE_LINE, recapSentences } from "../../../lib/coach/recap";
import { SUPPORT_EMAIL } from "../../../lib/pal/contact";

/**
 * My Journey — "show me what I'm learning" (C7 four-jobs restructure,
 * design-review D3: ONE document, four utility-headline sections, not a card
 * stack):
 *
 *   1. Where you are        — journey stage + pause/graduate controls (flag)
 *   2. What you learned     — weekly brief (flag) or the non-scored recap,
 *                             with the daypart insight folded in as a line
 *   3. Try this next        — exactly one experiment (the page's action)
 *   4. Your week            — verdict week strip + counts
 *
 * RV-3: no score, no band words, no percentages anywhere on this surface.
 * The recap states facts that cannot "decline" (lib/coach/recap.ts); the
 * bai_weekly pipeline still computes for internal S2 measurement only.
 *
 * Free tier gets sections 3 (generic) and 4 (week facts are free-computable
 * from /api/coach) plus ONE labeled locked section — never a full-page
 * paywall (DESIGN.md "never dead-end a paid or signed-in user").
 */

function formatWeekStart(weekStart: string): string {
  const date = new Date(`${weekStart}T00:00:00.000Z`);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    timeZone: "UTC"
  });
}

export default function JourneyPage() {
  const learningEnabled = learningJourneyUiEnabled();
  const [state, setState] = useState<ProgressState>("loading");
  const [latestBai, setLatestBai] = useState<LatestBai | null>(null);
  const [verdictWeek, setVerdictWeek] = useState<VerdictWeekDayWire[] | null>(
    null
  );
  const [insight, setInsight] = useState<CoachInsightWire | null>(null);
  // Whether the learning summary actually rendered (it self-nulls on
  // guest / not-premium / flag-off); the recap is the honest fallback.
  const [learningShown, setLearningShown] = useState(true);
  const handleLearningResolved = useCallback((shown: boolean) => {
    setLearningShown(shown);
  }, []);
  const [reloadNonce, setReloadNonce] = useState(0);

  const retry = useCallback(() => {
    setState("loading");
    setReloadNonce((nonce) => nonce + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const response = await fetch("/api/coach", { cache: "no-store" });
        if (cancelled) {
          return;
        }
        let body: unknown = null;
        try {
          body = await response.json();
        } catch {
          body = null;
        }
        if (cancelled) {
          return;
        }
        const resolved = resolveProgressState({
          outcome: "response",
          ok: response.ok,
          status: response.status,
          body
        });
        setLatestBai(resolved.latestBai);
        setVerdictWeek(resolved.verdictWeek);
        setInsight(resolved.insight);
        setState(resolved.state);
      } catch {
        if (!cancelled) {
          setState(resolveProgressState({ outcome: "network" }).state);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [reloadNonce]);

  // The recap is the honest fallback whenever the learning summary isn't
  // actually rendering — flag off, OR flag on but the summary self-nulled
  // (guest / not-premium / server flag off). Never leave section 2 blank.
  const showRecap =
    state === "ready" && latestBai && (!learningEnabled || !learningShown);
  const weekDays = verdictWeek ?? [];
  const checkedThisWeek = weekDays.filter((day) => day.checked).length;

  return (
    <div className="app-content--narrow">
      <section className="surface-card hero-card">
        <p className="hero-eyebrow">My journey</p>
        <h1 className="page-title">What you&apos;re learning</h1>
        <p className="page-copy">
          A behavioral view of your weeks — what you checked, what you kept,
          and one thing worth trying next. Never a prediction about a lab
          result.
        </p>
      </section>

      {state === "loading" ? (
        <section className="surface-card hero-card">
          <p className="page-copy">Loading your week…</p>
        </section>
      ) : null}

      {state === "unauthenticated" ? (
        <section
          className="surface-card hero-card"
          data-testid="progress-unauthenticated"
        >
          <h2 className="section-title">Sign in to see your journey</h2>
          <p className="page-copy">
            Your journey lives with your account. Sign in and it syncs back —
            nothing is lost.
          </p>
          <Link
            className="primary-button link-button"
            href="/signin"
            data-testid="progress-signin-link"
          >
            Sign in
          </Link>
        </section>
      ) : null}

      {state === "unavailable" ? (
        <section
          className="surface-card hero-card"
          data-testid="progress-unavailable"
          aria-live="polite"
        >
          <h2 className="section-title">Your journey is temporarily unavailable</h2>
          <p className="page-copy">
            We couldn&apos;t load your week just now. Your checks are safe —
            this is on our side, not yours.
          </p>
          <button
            type="button"
            className="primary-button"
            data-testid="progress-retry"
            onClick={retry}
          >
            Try again
          </button>
          <p className="field-hint">
            Still stuck? Email{" "}
            <a className="inline-link" href={`mailto:${SUPPORT_EMAIL}`}>
              {SUPPORT_EMAIL}
            </a>
            .
          </p>
        </section>
      ) : null}

      {state === "ready" || state === "empty" || state === "free" ? (
        <article className="surface-card hero-card journey-doc">
          {/* 1 — Where you are. JourneyCard self-gates (flag + premium);
              renders nothing pre-rollout, so the document simply starts at
              section 2 today. */}
          <JourneyCard />

          {/* 2 — What you learned this week. */}
          <section aria-label="What you learned this week">
            <h2 className="section-title">What you learned this week</h2>
            {learningEnabled ? (
              <LearningSummary onResolved={handleLearningResolved} />
            ) : null}
            {showRecap ? (
              <div data-testid="journey-recap">
                <p className="hero-eyebrow">
                  Week of {formatWeekStart(latestBai.weekStart)}
                </p>
                {recapSentences(latestBai).map((sentence) => (
                  <p className="page-copy" key={sentence}>
                    {sentence}
                  </p>
                ))}
                <p className="field-hint">{RECAP_POSTURE_LINE}</p>
              </div>
            ) : null}
            {state === "empty" ? (
              <p className="page-copy" data-testid="progress-empty">
                Your first weekly recap arrives after a few days of checks.
              </p>
            ) : null}
            {insight ? (
              <p className="page-copy" data-testid="journey-insight">
                {insight.text}
              </p>
            ) : null}
            {state === "free" ? (
              <div data-testid="progress-locked">
                <p className="field-hint">Part of Premium</p>
                <p className="page-copy">
                  The weekly recap — what you checked in on and followed
                  through with, computed every Monday — is one of the things
                  Premium keeps around.
                </p>
                <Link
                  className="primary-button link-button"
                  href="/subscribe"
                  data-testid="progress-subscribe-link"
                >
                  See what Premium includes
                </Link>
              </div>
            ) : null}
          </section>

          {/* 3 — Try this next: exactly ONE experiment (DV6). The flag-on
              artifact experiment renders inside LearningSummary; this generic
              line appears only when that surface isn't rendering. */}
          {!learningEnabled || !learningShown ? (
            <section aria-label="Try this next">
              <h2 className="section-title">Try this next</h2>
              <p className="page-copy" data-testid="next-action">
                <Link href="/check">
                  Check one meal you&apos;re unsure about this week.
                </Link>
              </p>
            </section>
          ) : null}

          {/* 4 — Your week: free-computable facts for every signed-in tier. */}
          <section aria-label="Your week">
            <h2 className="section-title">Your week</h2>
            {/* verdictWeek is per-day (most careful verdict per day), so this
                counts DAYS — say so; "N meals" would misreport a 3-check day. */}
            <p className="page-copy" data-testid="journey-week-count">
              {checkedThisWeek === 0
                ? "No check-ins yet this week."
                : checkedThisWeek === 1
                  ? "You checked in on 1 day this week."
                  : `You checked in on ${checkedThisWeek} days this week.`}
            </p>
            {weekDays.length > 0 ? (
              <WeekStrip
                week={weekDays.map((day) => ({
                  key: day.key,
                  checked: day.checked,
                  risk: day.risk ?? undefined
                }))}
                isDay0={checkedThisWeek === 0}
              />
            ) : null}
          </section>
        </article>
      ) : null}

      <section className="surface-card hero-card">
        <p className="page-copy">
          Curious how this is computed, and what it is not?{" "}
          <Link className="inline-link" href="/how-it-works">
            How this works
          </Link>
          .
        </p>
      </section>

      <DisclaimerLine />

      <footer className="page-footer">
        <Link href="/home">Home</Link>
        <Link href="/meals">My meals</Link>
        <Link href="/privacy">Privacy</Link>
        <Link href="/terms">Terms</Link>
      </footer>
    </div>
  );
}
