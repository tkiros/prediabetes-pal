"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { track } from "../../lib/client/analytics";
import { gdmFetch } from "../../lib/client/gdm-api";
import { GDM_COPY } from "../../lib/pal/gdm/copy";
import { nextGdmStep, type GdmAnswer, type GdmStep } from "../../lib/pal/gdm/onboarding";
import { GDM_ROUTES } from "../../lib/pal/gdm/routes";

const TOLD = GDM_COPY["gdm-onboarding-told"];
const NOT_TOLD = GDM_COPY["gdm-onboarding-not-told"];
const DATE = GDM_COPY["gdm-onboarding-date"];
const CONSENT = GDM_COPY["gdm-onboarding-consent"];
const NOTICE = GDM_COPY["gdm-privacy-notice"];
const STATUS = GDM_COPY["gdm-status"];
const CONSENT_REQUIRED = GDM_COPY["gdm-consent-required"].line;
const SAVE_FAILED = GDM_COPY["gdm-save-failed"].line;

/**
 * The door's onboarding (PRD §7.1): told? · appointment date, optional ·
 * explicit consent. The steps are the table in lib/pal/gdm/onboarding.ts.
 * Everything she enters stays in memory until the one POST after consent, so a
 * step change, a Back, or a failed save loses nothing (G-26).
 */
export function GdmOnboarding() {
  const router = useRouter();
  const [step, setStep] = useState<GdmStep>("told");
  const [appointmentDate, setAppointmentDate] = useState("");
  const [consent, setConsent] = useState(false); // unticked by default
  const [consentMissing, setConsentMissing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const shownStep = useRef<GdmStep | null>(null);

  // On entering a step: count it (a closed enum, never her answer), and after
  // the first step move focus to the new step's heading (G-39). The ref guard
  // keeps a StrictMode double effect from counting a step twice.
  useEffect(() => {
    if (shownStep.current === step) return;
    const first = shownStep.current === null;
    shownStep.current = step;
    if (step !== "not_told") track({ name: "gdm_onboarding_step", props: { step } });
    if (!first) headingRef.current?.focus();
  }, [step]);

  async function submit() {
    if (saving) return;
    if (!consent) {
      // G-35: the button stays enabled; unticked, it explains and sends nothing.
      setConsentMissing(true);
      return;
    }
    setSaving(true);
    setFailure(null);
    const result = await gdmFetch<{ ok: true }>("/api/gdm/profile", {
      method: "POST",
      body: { told: true, consent, appointmentDate: appointmentDate || null }
    });
    if (result.ok) {
      track({ name: "gdm_onboarding_step", props: { step: "done" } });
      setSaved(true);
      router.push(GDM_ROUTES.home);
      return; // stays disabled while Home loads
    }
    setSaving(false);
    setFailure(result.error === CONSENT_REQUIRED ? CONSENT_REQUIRED : SAVE_FAILED);
  }

  function answer(choice: GdmAnswer) {
    const next = nextGdmStep(step, choice);
    if (next === "submit") {
      void submit();
      return;
    }
    if (choice === "not_yet") track({ name: "gdm_onboarding_step", props: { step: "not_told_exit" } });
    // Skip means no date: a date typed and then skipped is not sent.
    if (choice === "skip") setAppointmentDate("");
    setFailure(null);
    setStep(next);
  }

  function onContinue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    answer("continue");
  }

  const heading = (text: string) => (
    <h1 id="gdm-step-title" className="gdm-title" ref={headingRef} tabIndex={-1}>
      {text}
    </h1>
  );

  return (
    <section className="surface-card form-card gdm-step">
      {step === "told" ? (
        <>
          {heading(TOLD.ask)}
          <div className="gdm-actions">
            <button type="button" className="secondary-button" onClick={() => answer("yes")}>
              {TOLD.yes}
            </button>
            <button type="button" className="secondary-button" onClick={() => answer("not_yet")}>
              {TOLD.notYet}
            </button>
          </div>
        </>
      ) : null}

      {step === "not_told" ? (
        <>
          {heading(NOT_TOLD.line)}
          <button type="button" className="link-button-plain gdm-back" onClick={() => answer("back")}>
            {NOT_TOLD.back}
          </button>
        </>
      ) : null}

      {step === "date" ? (
        <form className="gdm-step" onSubmit={onContinue}>
          {heading(DATE.ask)}
          <input
            id="gdm-appointment"
            className="text-input"
            type="date"
            value={appointmentDate}
            onChange={(event) => setAppointmentDate(event.target.value)}
            aria-labelledby="gdm-step-title"
            aria-describedby="gdm-appointment-hint"
          />
          <p id="gdm-appointment-hint" className="field-hint">
            {DATE.hint}
          </p>
          <div className="gdm-actions">
            <button type="submit" className="primary-button">
              {DATE.next}
            </button>
            <button type="button" className="secondary-button" onClick={() => answer("skip")}>
              {DATE.skip}
            </button>
          </div>
          <button type="button" className="link-button-plain gdm-back" onClick={() => answer("back")}>
            {DATE.back}
          </button>
        </form>
      ) : null}

      {step === "consent" ? (
        <form className="gdm-step" onSubmit={onContinue}>
          {heading(CONSENT.what)}
          <div className="consent-row">
            <input
              id="gdm-consent"
              type="checkbox"
              checked={consent}
              onChange={(event) => {
                setConsent(event.target.checked);
                setConsentMissing(false);
              }}
              aria-describedby={consentMissing ? "gdm-consent-required" : undefined}
            />
            <label htmlFor="gdm-consent" className="consent-label">
              {CONSENT.agree}
            </label>
          </div>
          {/* G-47: the notice opens in place, so the date she just typed is not
              thrown away by a navigation. The full page is linked from the footer. */}
          <details className="gdm-notice">
            <summary>{CONSENT.notice}</summary>
            <p>{NOTICE.what}</p>
            <p>{NOTICE.how}</p>
            <p>{NOTICE.never}</p>
            <p>{NOTICE.choices}</p>
          </details>
          {consentMissing ? (
            <p id="gdm-consent-required" className="field-error" role="alert">
              {CONSENT_REQUIRED}
            </p>
          ) : null}
          {failure ? (
            <p className="field-error" role="alert">
              {failure}
            </p>
          ) : null}
          <button type="submit" className="primary-button" disabled={saving}>
            {CONSENT.go}
          </button>
          <button type="button" className="link-button-plain gdm-back" disabled={saving} onClick={() => answer("back")}>
            {CONSENT.back}
          </button>
        </form>
      ) : null}

      <p className="field-hint gdm-status" aria-live="polite">
        {saving ? (saved ? STATUS.saved : STATUS.saving) : null}
      </p>
    </section>
  );
}
