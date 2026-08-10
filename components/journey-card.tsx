"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { track, type PauseReasonProp } from "../lib/client/analytics";
import { learningJourneyUiEnabled } from "../lib/learning-journey-flag";

/**
 * 90-day Learning Journey card (plan §P4.1). The smallest consistent surface:
 * one card on the progress page (the app's existing longitudinal home), showing
 * the journey state, the current stage name + day, and start / pause / resume.
 *
 * Graduation and maintenance are Task 20 (with pause reasons), so this card
 * exposes start/pause/resume, and — at day 90 (`isComplete`) — the four honest
 * completion paths of plan §P4.4: graduate & take your playbook, pause (with a
 * bounded reason), continue in maintenance, and a calm "outside Prediabetes Pal's scope?"
 * pointer to professional care. Graduation is framed as a SUCCESS, none of these
 * paths touches billing, and there is no retention dark pattern (global
 * constraint §9): the copy honestly says graduating does not change a
 * subscription and links to the existing cancel flow.
 *
 * Ships behind the CLIENT build flag (`NEXT_PUBLIC_LEARNING_JOURNEY`): a build
 * with the flag off renders nothing at all (returns null), so the surface simply
 * does not exist until an approved rollout (global constraint §10). Error-truth
 * (global constraint §7): a backend fault is an explicit retry state, never a
 * paywall/"locked".
 */

type ViewStatus =
  | "loading"
  | "guest"
  | "unavailable"
  | "error"
  | "ready";

type StageDescriptor = {
  stage: number;
  startDay: number;
  endDay: number;
  name: string;
  focus: string;
};

type JourneyView = {
  state: "not_started" | "active" | "paused" | "graduated" | "maintenance";
  day: number;
  stage: number | null;
  isComplete: boolean;
  completedStages: number;
};

type JourneyPayload = {
  journey: JourneyView;
  currentStage: StageDescriptor | null;
};

/**
 * The bounded pause-reason options (plan §P4.4). Honest, non-judgmental labels —
 * pausing is a legitimate choice, never a failure (global constraint §9). The
 * `value` mirrors lib/journey/state PauseReason / the analytics enum.
 */
const PAUSE_REASON_OPTIONS: ReadonlyArray<{
  value: PauseReasonProp;
  label: string;
}> = [
  { value: "need_a_break", label: "I need a break" },
  { value: "life_event", label: "Life got busy" },
  { value: "not_useful_now", label: "Not useful right now" },
  { value: "other", label: "Another reason" }
];

// ── Completion-surface copy (plan §P4.4) ────────────────────────────────────
// Exported so the dark-pattern/banned-phrase copy test can assert directly on
// the strings the user actually sees. Every line here is celebratory or calm —
// graduation is a SUCCESS, and NONE of this copy guilts, pressures, or hides a
// way out (global constraint §9).

/** Graduation is framed as an accomplishment, not an exit to be discouraged. */
export const GRADUATION_HEADING = "You did it — you've graduated";

export const GRADUATION_BODY =
  "Ninety days of calm, steady checks. You've built a way of reading your meals that's yours to keep. Take your playbook with you.";

/**
 * Cancellation independence (plan §P4.4 / global constraint §9): graduating is a
 * product milestone and changes nothing about billing. We say so plainly and
 * link straight to the real cancel flow — no guilt, no hidden path.
 */
export const CANCEL_INDEPENDENCE_COPY =
  "You can cancel or keep your subscription — it's your choice, and graduating doesn't change your billing.";

/** Calm pointer to professional care (reuses the boundary-copy tone). */
export const OUTSIDE_SCOPE_HEADING = "Is your question outside Prediabetes Pal's scope?";

export const OUTSIDE_SCOPE_COPY =
  "Prediabetes Pal is informational only and is not medical advice. If something about your health has you worried, talk with a doctor or registered dietitian for guidance that's specific to you.";

/** Every user-facing completion string, for the copy test to iterate over. */
export const JOURNEY_COMPLETION_COPY = {
  GRADUATION_HEADING,
  GRADUATION_BODY,
  CANCEL_INDEPENDENCE_COPY,
  OUTSIDE_SCOPE_HEADING,
  OUTSIDE_SCOPE_COPY
} as const;

/** Clamp a stage number to the closed "1".."5" analytics enum. */
function stageProp(stage: number | null): "1" | "2" | "3" | "4" | "5" | null {
  if (stage === null) {
    return null;
  }
  const clamped = Math.min(5, Math.max(1, Math.round(stage)));
  return String(clamped) as "1" | "2" | "3" | "4" | "5";
}

/** Bucket a completed-stage COUNT to the closed "0".."5" analytics enum. */
function completedStagesProp(
  count: number
): "0" | "1" | "2" | "3" | "4" | "5" {
  const clamped = Math.min(5, Math.max(0, Math.round(count)));
  return String(clamped) as "0" | "1" | "2" | "3" | "4" | "5";
}

/**
 * Emit the §10.1 completion analytics for the action that just succeeded —
 * bounded props only (stage class, pause-reason class, completed-stage count,
 * offer variant); never a day count or free text. `graduate_maintenance` is one
 * user step that IS both a graduation and a maintenance choice, so it emits both
 * events.
 */
function emitJourneyEvent(
  action:
    | "start"
    | "pause"
    | "resume"
    | "graduate"
    | "graduate_maintenance"
    | "maintenance",
  journey: JourneyView,
  reason?: PauseReasonProp
): void {
  if (action === "pause" && reason) {
    const stage = stageProp(journey.stage);
    if (stage) {
      track({ name: "journey_paused", props: { stage, pauseReason: reason } });
    }
    return;
  }
  if (action === "graduate" || action === "graduate_maintenance") {
    track({
      name: "journey_graduated",
      props: { completedStages: completedStagesProp(journey.completedStages) }
    });
  }
  if (action === "maintenance" || action === "graduate_maintenance") {
    track({ name: "maintenance_selected", props: { variant: "standard" } });
  }
}

function isPayload(value: unknown): value is JourneyPayload {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { journey?: unknown }).journey === "object" &&
    (value as { journey: { state?: unknown } }).journey !== null
  );
}

export function JourneyCard() {
  const enabled = learningJourneyUiEnabled();
  const [status, setStatus] = useState<ViewStatus>("loading");
  const [payload, setPayload] = useState<JourneyPayload | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(false);
  const [pausePromptOpen, setPausePromptOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/journey", { cache: "no-store" });
      if (response.status === 401) {
        setStatus("guest");
        return;
      }
      // 403 (not premium) or 404 (server flag off) → the card simply isn't
      // available; render nothing rather than a paywall (global constraint §7).
      if (response.status === 403 || response.status === 404) {
        setStatus("unavailable");
        return;
      }
      if (!response.ok) {
        setStatus("error");
        return;
      }
      const body: unknown = await response.json();
      if (!isPayload(body)) {
        setStatus("error");
        return;
      }
      setPayload(body);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    const initialLoad = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(initialLoad);
  }, [enabled, load]);

  const act = useCallback(
    async (
      action:
        | "start"
        | "pause"
        | "resume"
        | "graduate"
        | "graduate_maintenance"
        | "maintenance",
      reason?: PauseReasonProp
    ) => {
      setBusy(true);
      setActionError(false);
      try {
        const response = await fetch("/api/journey", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(reason ? { action, reason } : { action })
        });
        if (!response.ok) {
          // Includes a 409 if the state drifted under us — surface a retry, then
          // reload the true state so the buttons re-sync.
          setActionError(true);
          await load();
          return;
        }
        const body: unknown = await response.json();
        if (isPayload(body)) {
          setPausePromptOpen(false);
          emitJourneyEvent(action, body.journey, reason);
          setPayload(body);
          setStatus("ready");
        } else {
          await load();
        }
      } catch {
        setActionError(true);
      } finally {
        setBusy(false);
      }
    },
    [load]
  );

  // Flag off → the surface does not exist.
  if (!enabled) {
    return null;
  }

  // Non-premium / flag-off-server → render nothing; the page's own gating owns
  // the premium messaging, and the journey must never appear as a paywall here.
  if (status === "unavailable") {
    return null;
  }

  if (status === "loading") {
    return (
      <section className="surface-card hero-card" data-testid="journey-card">
        <p className="hero-eyebrow">Learning journey</p>
        <p className="page-copy">Loading your journey…</p>
      </section>
    );
  }

  if (status === "guest") {
    return (
      <section
        className="surface-card hero-card"
        data-testid="journey-card"
      >
        <p className="hero-eyebrow">Learning journey</p>
        <p className="page-copy">
          <Link className="inline-link" href="/signin">
            Sign in
          </Link>{" "}
          to start your 90-day learning journey.
        </p>
      </section>
    );
  }

  if (status === "error") {
    return (
      <section
        className="surface-card hero-card"
        data-testid="journey-card"
        aria-live="polite"
      >
        <p className="hero-eyebrow">Learning journey</p>
        <h2 className="section-title">Journey is temporarily unavailable</h2>
        <p className="page-copy">
          We couldn&apos;t load your journey just now. This is on our side —
          nothing you did.
        </p>
        <button
          type="button"
          className="primary-button"
          data-testid="journey-retry"
          onClick={() => {
            setStatus("loading");
            void load();
          }}
        >
          Try again
        </button>
      </section>
    );
  }

  const journey = payload?.journey;
  const stage = payload?.currentStage ?? null;
  if (!journey) {
    return null;
  }

  // ── Shared completion-surface fragments ───────────────────────────────────

  // The bounded pause-reason picker (plan §P4.4). Opening it collects a reason
  // before pausing so the `journey_paused` event always carries a bounded class.
  const pausePicker = (
    <div
      data-testid="journey-pause-picker"
      role="group"
      aria-label="Why are you pausing?"
    >
      <p className="page-copy">
        Pausing keeps everything you&apos;ve saved. Pick whatever fits — you can
        come back any time.
      </p>
      {PAUSE_REASON_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          className="recheck-button"
          data-testid={`journey-pause-reason-${option.value}`}
          disabled={busy}
          onClick={() => void act("pause", option.value)}
        >
          {option.label}
        </button>
      ))}
      <button
        type="button"
        className="text-button"
        data-testid="journey-pause-cancel"
        disabled={busy}
        onClick={() => setPausePromptOpen(false)}
      >
        Not now
      </button>
    </div>
  );

  // Path 1 take-your-playbook: link BOTH existing exports (no combined endpoint
  // needed — plan/brief). These are GET download endpoints, so plain anchors.
  const playbookLinks = (
    <p className="page-copy" data-testid="journey-playbook-exports">
      Take your playbook with you:{" "}
      <a className="inline-link" href="/api/memory/export" download>
        download your saved meals
      </a>{" "}
      and{" "}
      <a className="inline-link" href="/api/history/export" download>
        your check history
      </a>
      .
    </p>
  );

  // Path 4 outside-scope: a calm STATIC section (never a modal trap) pointing to
  // professional care, in the boundary-copy tone (no new clinical claims).
  const outsideScope = (
    <div data-testid="journey-outside-scope">
      <h3 className="section-subtitle">{OUTSIDE_SCOPE_HEADING}</h3>
      <p className="page-copy">{OUTSIDE_SCOPE_COPY}</p>
    </div>
  );

  // Cancellation independence: honest, links to the real cancel flow.
  const cancelIndependence = (
    <p className="field-hint" data-testid="journey-cancel-independence">
      {CANCEL_INDEPENDENCE_COPY}{" "}
      <Link className="inline-link" href="/account">
        Manage your subscription
      </Link>
      .
    </p>
  );

  return (
    <section
      className="surface-card hero-card"
      data-testid="journey-card"
      data-journey-state={journey.state}
    >
      <p className="hero-eyebrow">Learning journey</p>

      {journey.state === "not_started" ? (
        <>
          <h2 className="section-title">Your 90-day learning journey</h2>
          <p className="page-copy">
            A calm, staged way to get comfortable reading the card and building
            choices that fit your life. Start whenever you like — you can pause
            any time, and it never changes how a meal is checked.
          </p>
          <button
            type="button"
            className="primary-button"
            data-testid="journey-start"
            disabled={busy}
            onClick={() => void act("start")}
          >
            {busy ? "Starting…" : "Start the journey"}
          </button>
        </>
      ) : null}

      {/* Day-90 completion surface — the four honest paths (plan §P4.4). Shown
          only for an ACTIVE journey that has reached day 90 (isComplete). */}
      {journey.state === "active" && journey.isComplete ? (
        <div data-testid="journey-complete">
          <h2 className="section-title">{GRADUATION_HEADING}</h2>
          <p className="page-copy">{GRADUATION_BODY}</p>

          {/* Path 1 — Graduate & take your playbook. */}
          {playbookLinks}
          <button
            type="button"
            className="primary-button"
            data-testid="journey-graduate"
            disabled={busy}
            onClick={() => void act("graduate")}
          >
            {busy ? "…" : "Graduate & keep my playbook"}
          </button>

          {/* Path 3 — Continue in maintenance (graduate → maintenance, one step). */}
          <p className="page-copy">
            Prefer to keep a lighter rhythm? Maintenance keeps your weekly
            learning, your meal archive, search, and re-checks — with fewer
            reminders.
          </p>
          <button
            type="button"
            className="recheck-button"
            data-testid="journey-graduate-maintenance"
            disabled={busy}
            onClick={() => void act("graduate_maintenance")}
          >
            {busy ? "…" : "Graduate into maintenance"}
          </button>

          {/* Path 2 — Pause (with a bounded reason). */}
          {pausePromptOpen ? (
            pausePicker
          ) : (
            <button
              type="button"
              className="text-button"
              data-testid="journey-pause"
              disabled={busy}
              onClick={() => setPausePromptOpen(true)}
            >
              Pause instead
            </button>
          )}

          {/* Path 4 — Outside Prediabetes Pal's scope? */}
          {outsideScope}

          {/* Cancellation independence — no dark pattern. */}
          {cancelIndependence}
        </div>
      ) : null}

      {/* In-progress card: active before day 90, or paused. */}
      {(journey.state === "active" && !journey.isComplete) ||
      journey.state === "paused" ? (
        <>
          <h2 className="section-title" data-testid="journey-stage-name">
            {stage ? `Stage ${stage.stage}: ${stage.name}` : "Your journey"}
          </h2>
          <p className="page-copy" data-testid="journey-day">
            Day {journey.day}
            {journey.state === "paused" ? " · Paused" : ""}
          </p>
          {stage ? <p className="page-copy">{stage.focus}</p> : null}

          {journey.state === "active" ? (
            pausePromptOpen ? (
              pausePicker
            ) : (
              <button
                type="button"
                className="recheck-button"
                data-testid="journey-pause"
                disabled={busy}
                onClick={() => setPausePromptOpen(true)}
              >
                Pause
              </button>
            )
          ) : (
            <button
              type="button"
              className="primary-button"
              data-testid="journey-resume"
              disabled={busy}
              onClick={() => void act("resume")}
            >
              {busy ? "…" : "Resume"}
            </button>
          )}
        </>
      ) : null}

      {/* Graduated (read-only success) — celebration, playbook, and the option
          to move into maintenance. Graduation is a SUCCESS, never an exit to
          discourage (global constraint §9). */}
      {journey.state === "graduated" ? (
        <div data-testid="journey-graduated">
          <h2 className="section-title">{GRADUATION_HEADING}</h2>
          <p className="page-copy">{GRADUATION_BODY}</p>
          {playbookLinks}
          <p className="page-copy">
            Want to keep a lighter rhythm? Maintenance keeps your weekly
            learning, meal archive, search, and re-checks going.
          </p>
          <button
            type="button"
            className="recheck-button"
            data-testid="journey-maintenance"
            disabled={busy}
            onClick={() => void act("maintenance")}
          >
            {busy ? "…" : "Continue in maintenance"}
          </button>
          {outsideScope}
          {cancelIndependence}
        </div>
      ) : null}

      {/* Maintenance — lighter-intensity mode. All affordances are existing
          features (archive/search/re-check + weekly learning). */}
      {journey.state === "maintenance" ? (
        <div data-testid="journey-maintenance-mode">
          <h2 className="section-title">You&apos;re in maintenance mode</h2>
          <p className="page-copy">
            A lighter rhythm, still fully yours: your weekly learning keeps
            arriving, and your meal archive, search, and one-tap re-checks are
            always here. Reminders are gentler now — you can change that any time
            in settings.
          </p>
          {playbookLinks}
          {outsideScope}
          {cancelIndependence}
        </div>
      ) : null}

      {actionError ? (
        <p className="field-hint" data-testid="journey-action-error">
          That didn&apos;t go through. Please try again.
        </p>
      ) : null}
    </section>
  );
}
