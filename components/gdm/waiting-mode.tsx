"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { track } from "../../lib/client/analytics";
import { gdmFetch } from "../../lib/client/gdm-api";
import { formatIsoDate, localIsoDate } from "../../lib/client/gdm-date";
import { useFocusAfterRender } from "../../lib/client/gdm-focus";
import { useHydrated } from "../../lib/client/use-hydrated";
import { GDM_COPY } from "../../lib/pal/gdm/copy";
import { detectConflicts, type StoredPlan } from "../../lib/pal/gdm/plan-record";
import { GDM_ROUTES } from "../../lib/pal/gdm/routes";
import {
  appointmentPhrase,
  homeParts,
  isoDayNumber,
  summaryOfferDue,
  waitingState,
  type AppointmentPhrase,
  type WaitingState
} from "../../lib/pal/gdm/waiting";
import { PlanCard } from "./plan-card";
import { differingOccasions } from "./plan-keep";

const WAIT = GDM_COPY["gdm-wait-controls"];
const STRUCTURE = GDM_COPY["gdm-wait-structure"];
const CHECKLIST = GDM_COPY["gdm-wait-checklist"];
const NAV = GDM_COPY["gdm-nav"];
const STATUS = GDM_COPY["gdm-status"];
const SAVE = GDM_COPY["gdm-plan-controls"].save;
const SAVE_FAILED = GDM_COPY["gdm-save-failed"].line;

const PROFILE_PATH = "/api/gdm/profile";

const APPOINTMENT_TITLE_ID = "gdm-home-appointment-title";
const DATE_FIELD_ID = "gdm-home-appointment";
const SAVE_ID = "gdm-home-appointment-save";
const WAIT_TITLE_ID = "gdm-home-wait-title";
const PLAN_TITLE_ID = "gdm-home-plan-title";

/** Part (d): the door's three working surfaces, in the nav's own words. */
const LINKS = [
  { href: GDM_ROUTES.questions, label: NAV.asks },
  { href: GDM_ROUTES.plan, label: NAV.plan },
  { href: GDM_ROUTES.meals, label: NAV.meals }
] as const;

/** Her stored date when it is a real YYYY-MM-DD; null for none, and for an entry that would not decrypt. */
const readableDate = (date: string | null): string | null => (isoDayNumber(date) === null ? null : date);

export type HomeViewState = {
  state: WaitingState;
  parts: ReturnType<typeof homeParts>;
  phrase: AppointmentPhrase;
  offer: boolean;
};

/**
 * What Home shows, from her date and her device's day. `today` is null until
 * the page has hydrated: the server cannot know her timezone (G-44), so until
 * then nothing that depends on the day is decided — no phrase, no summary
 * offer, no after-appointment prompt — and only whether a plan exists shapes
 * the page. The first client render after hydration fills them in.
 */
export function homeView(input: { hasCurrentPlan: boolean; appointmentDate: string | null; today: string | null }): HomeViewState {
  const { hasCurrentPlan, appointmentDate, today } = input;
  if (today === null) {
    const state: WaitingState = hasCurrentPlan ? "ended" : "waiting";
    return { state, parts: homeParts(state), phrase: "none", offer: false };
  }
  const state = waitingState({ hasCurrentPlan, appointmentDate, today });
  return {
    state,
    parts: homeParts(state),
    phrase: appointmentPhrase(appointmentDate, today),
    offer: summaryOfferDue(appointmentDate, today)
  };
}

/** The PATCH body for her date: the field's own value, and null once she has emptied it. */
export function profilePatchBody(draft: string): { appointmentDate: string | null } {
  return { appointmentDate: draft === "" ? null : draft };
}

export type HomeViewProps = {
  /** Her device's day (`localIsoDate`), or null until hydrated. */
  today: string | null;
  /** Her date as the server holds it. */
  appointmentDate: string | null;
  hasCurrentPlan: boolean;
  /** Her current plans (G-37). */
  plans: readonly StoredPlan[];
  /** The date field's value, as she left it. */
  draft: string;
  saving: boolean;
  status: string | null;
  failure: string | null;
  onDraft: (value: string) => void;
  onSave: (event: FormEvent<HTMLFormElement>) => void;
};

/**
 * Home, top to bottom (G-69: her appointment leads, in every state):
 *
 * - (c) the appointment block, always (G-32): the phrase for her date, never a
 *   count of days; her date in the device's words (G-44); the summary offer
 *   the day before and on the day; the field that adds or changes her date.
 * - after the date has passed with no plan: the one prompt and Open My plan.
 * - while she waits: the waiting content, (b) the checklist as a plain list
 *   (no box to tick, no progress), then (a) ACOG's line, quoted and
 *   attributed, a separable piece if the safety owner refuses it (D5).
 * - once a plan is entered: her current plan or plans, read-only, the same
 *   card the plan page renders, differing occasions flagged (G-37).
 * - (d) links to My questions, My plan and My meals.
 *
 * Which parts render comes from homeParts(state); the appointment block is
 * never conditional on it. Pure: WaitingMode holds the state.
 */
export function HomeView(props: HomeViewProps) {
  const { today, appointmentDate, hasCurrentPlan, plans, draft, saving, status, failure, onDraft, onSave } = props;
  const { parts, phrase, offer } = homeView({ hasCurrentPlan, appointmentDate, today });
  const date = readableDate(appointmentDate);
  // Her date in words only once the day is known, i.e. after hydration: the
  // server's HTML never carries a locale's words for it.
  const shownDate = today === null || date === null ? null : formatIsoDate(date);
  const conflicts = parts.plan ? detectConflicts([...plans]) : [];

  return (
    <div className="gdm-home">
      <section className="surface-card gdm-appointment" aria-labelledby={APPOINTMENT_TITLE_ID}>
        <h2 id={APPOINTMENT_TITLE_ID} className="gdm-section-title">
          {WAIT.appointment}
        </h2>
        {phrase === "none" ? null : <p className="gdm-appointment-when">{WAIT[phrase]}</p>}
        {date !== null && shownDate !== null ? (
          <p className="gdm-appointment-date">
            <time dateTime={date}>{shownDate}</time>
          </p>
        ) : null}
        {offer ? (
          <p className="gdm-summary-offer">
            <Link className="inline-link" href={GDM_ROUTES.summary}>
              {WAIT.summaryOffer}
            </Link>
          </p>
        ) : null}
        <form className="gdm-appointment-form" onSubmit={onSave}>
          <label className="field-label" htmlFor={DATE_FIELD_ID}>
            {WAIT.changeDate}
          </label>
          <input
            id={DATE_FIELD_ID}
            type="date"
            className="text-input gdm-appointment-input"
            value={draft}
            onChange={(event) => onDraft(event.target.value)}
          />
          <button id={SAVE_ID} type="submit" className="secondary-button gdm-appointment-save" disabled={saving}>
            {SAVE}
          </button>
          {failure ? (
            <p className="field-error" role="alert">
              {failure}
            </p>
          ) : null}
          {/* G-36: the page's one polite live region. */}
          <p className="field-hint gdm-status" aria-live="polite">
            {status}
          </p>
        </form>
      </section>

      {parts.prompt ? (
        <div className="surface-card gdm-after">
          <p className="gdm-lead">{WAIT.after}</p>
          <Link className="secondary-button link-button" href={GDM_ROUTES.plan}>
            {WAIT.openPlan}
          </Link>
        </div>
      ) : null}

      {parts.checklist || parts.structure ? (
        <section className="surface-card gdm-wait" aria-labelledby={WAIT_TITLE_ID}>
          <h2 id={WAIT_TITLE_ID} className="gdm-section-title">
            {WAIT.title}
          </h2>
          {parts.checklist ? (
            <ul className="gdm-checklist">
              {Object.entries(CHECKLIST).map(([key, line]) => (
                <li key={key}>{line}</li>
              ))}
            </ul>
          ) : null}
          {parts.structure ? (
            <figure className="gdm-structure">
              <blockquote>
                <p>{STRUCTURE.quote}</p>
              </blockquote>
              <figcaption>
                <cite>{STRUCTURE.source}</cite>
              </figcaption>
            </figure>
          ) : null}
        </section>
      ) : null}

      {parts.plan ? (
        <section className="gdm-home-plan" aria-labelledby={PLAN_TITLE_ID}>
          <h2 id={PLAN_TITLE_ID} className="gdm-section-title">
            {WAIT.planTitle}
          </h2>
          <ul className="gdm-plan-current" role="list">
            {plans.map((plan) => (
              <li key={plan.id}>
                <PlanCard plan={plan} differs={differingOccasions(conflicts, plan.id)} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <ul className="gdm-home-links" role="list">
        {LINKS.map(({ href, label }) => (
          <li key={href}>
            <Link className="secondary-button link-button" href={href}>
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export type WaitingModeProps = {
  appointmentDate: string | null;
  hasCurrentPlan: boolean;
  /** Her current plans, from the server (G-37). */
  plans: readonly StoredPlan[];
};

/**
 * Home (PRD §6.2 F-WAIT; G-32, G-37, G-69). The page's server component reads
 * her date and her current plans; `today` is her device's day, computed here
 * with localIsoDate() and only once hydrated (G-44), so the server never
 * guesses her timezone and the client never uses UTC.
 */
export function WaitingMode({ appointmentDate, hasCurrentPlan, plans }: WaitingModeProps) {
  const hydrated = useHydrated();
  const today = hydrated ? localIsoDate() : null;
  const [saved, setSaved] = useState(appointmentDate);
  const [draft, setDraft] = useState(() => readableDate(appointmentDate) ?? "");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const opened = useRef(false);
  const focusLater = useFocusAfterRender();
  // Waiting mode shows (waiting, or after the date) whenever she has no plan:
  // that does not depend on the day, so the count is right before hydration too.
  const waiting = homeView({ hasCurrentPlan, appointmentDate: saved, today }).parts.structure;

  useEffect(() => {
    // Once per visit; the ref keeps a StrictMode double effect from counting it twice.
    if (!waiting || opened.current) return;
    opened.current = true;
    track({ name: "gdm_waiting_opened" });
  }, [waiting]);

  function editDraft(value: string) {
    setDraft(value);
    setStatus(null); // "Saved." no longer describes what the field holds
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const field = event.currentTarget.elements.namedItem(DATE_FIELD_ID);
    if (field instanceof HTMLInputElement && field.validity.badInput) {
      // A half-typed date reads as "", and sending that would erase the date
      // she has. Browsers that validate stop this submit themselves; for any
      // that do not, nothing is sent and the field keeps what she typed.
      field.focus();
      return;
    }
    const body = profilePatchBody(draft);
    setSaving(true);
    setFailure(null);
    setStatus(STATUS.saving);
    const result = await gdmFetch<{ ok: true }>(PROFILE_PATH, { method: "PATCH", body });
    if (result.ok) {
      setSaved(body.appointmentDate);
      setStatus(STATUS.saved);
    } else {
      // The field keeps her value (G-26).
      setFailure(SAVE_FAILED);
      setStatus(null);
    }
    setSaving(false);
    // G-39: Save was disabled in flight, which drops focus; it goes back there.
    focusLater(SAVE_ID);
  }

  return (
    <HomeView
      today={today}
      appointmentDate={saved}
      hasCurrentPlan={hasCurrentPlan}
      plans={plans}
      draft={draft}
      saving={saving}
      status={status}
      failure={failure}
      onDraft={editDraft}
      onSave={save}
    />
  );
}
