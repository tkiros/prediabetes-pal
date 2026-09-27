"use client";

import { useEffect, useState, type FormEvent } from "react";

import { track } from "../../lib/client/analytics";
import { gdmFetch } from "../../lib/client/gdm-api";
import { localIsoDate } from "../../lib/client/gdm-date";
import { useFocusAfterRender } from "../../lib/client/gdm-focus";
import { GDM_COPY } from "../../lib/pal/gdm/copy";
import type { AskBody } from "../../lib/pal/gdm/items";
import {
  currentPlans,
  detectConflicts,
  GDM_OCCASIONS,
  GDM_UNITS,
  isEmptyPlan,
  type GdmOccasion,
  type GdmPlan,
  type GdmUnit,
  type PlanConflict,
  type StoredPlan
} from "../../lib/pal/gdm/plan-record";
import { PlanCard, planEnteredId, planOccasionId } from "./plan-card";

const CONTROLS = GDM_COPY["gdm-plan-controls"];
const OCCASIONS = GDM_COPY["gdm-occasions"];
const DIFFER = GDM_COPY["gdm-plan-differ"];
const STATUS = GDM_COPY["gdm-status"];
const LOAD_FAILED = GDM_COPY["gdm-load-failed"];
const CANCEL = GDM_COPY["gdm-data-controls"].cancel;
const SAVE_FAILED = GDM_COPY["gdm-save-failed"].line;
const LIST_FULL = GDM_COPY["gdm-list-full"].line;

const ITEMS_PATH = "/api/gdm/items";

const FIELD_ID = {
  givenBy: "gdm-plan-given-by",
  note: "gdm-plan-note",
  perDay: "gdm-plan-per-day",
  unit: "gdm-plan-counts",
  choiceMeans: "gdm-plan-choice-means"
} as const;
const SAVE_ID = "gdm-plan-save";
const ADD_ANOTHER_ID = "gdm-plan-add-another";
const figureId = (occasion: GdmOccasion) => `gdm-plan-figure-${occasion}`;
const replaceId = (planId: string) => `gdm-plan-${planId}-replace`;
const parkId = (planId: string, occasion: GdmOccasion) => `gdm-plan-${planId}-${occasion}-park`;

/** G-14: each field's maxLength is its bound in GdmPlanSchema (lib/pal/gdm/plan-record.ts), so a 400 is unreachable. */
export const PLAN_MAX_LENGTH = { givenBy: 80, note: 2000, perDay: 60, choiceMeans: 40, figure: 40 } as const;

/** What the form holds: her text as typed, one field per occasion. Strings only; no row id. */
export type PlanForm = {
  givenBy: string;
  note: string;
  perDay: string;
  unit: GdmUnit;
  choiceMeans: string;
  figures: Record<GdmOccasion, string>;
};

function blankFigures(): Record<GdmOccasion, string> {
  const figures = {} as Record<GdmOccasion, string>;
  for (const occasion of GDM_OCCASIONS) figures[occasion] = "";
  return figures;
}

/** A new plan's form: every field blank, and `none`, the one value the required select must start on. */
export const EMPTY_PLAN_FORM: PlanForm = {
  givenBy: "",
  note: "",
  perDay: "",
  unit: "none",
  choiceMeans: "",
  figures: blankFigures()
};

/**
 * G-75: Replace opens the form filled with the plan it replaces. These are
 * her own stored words fed to controlled inputs, not a product default.
 * Read field by field, so the row's `id` stays behind.
 */
export function planFormFrom(plan: GdmPlan): PlanForm {
  const figures = blankFigures();
  for (const occasion of GDM_OCCASIONS) figures[occasion] = plan.figures[occasion] ?? "";
  return {
    givenBy: plan.givenBy ?? "",
    note: plan.note ?? "",
    perDay: plan.perDay ?? "",
    unit: plan.unit,
    choiceMeans: plan.choiceMeans ?? "",
    figures
  };
}

const orNull = (text: string) => text.trim() || null;

/**
 * The body a save sends (GdmPlanSchema, strict): trimmed, a blank field is
 * null, a blank figure is left out. Every figure goes as she wrote it, a
 * string: nothing is parsed, converted or compared. What one choice is
 * travels only with Choices: a value left in the hidden field (she typed it,
 * then chose another way of counting) is not stored where she cannot see it.
 * Built field by field, so a stored plan's `id` never reaches the strict schema.
 */
export function planBodyFrom(form: PlanForm, enteredOn: string): GdmPlan {
  const figures: GdmPlan["figures"] = {};
  for (const occasion of GDM_OCCASIONS) {
    const figure = form.figures[occasion].trim();
    if (figure) figures[occasion] = figure;
  }
  return {
    givenBy: orNull(form.givenBy),
    note: orNull(form.note),
    perDay: orNull(form.perDay),
    unit: form.unit,
    choiceMeans: form.unit === "choices" ? orNull(form.choiceMeans) : null,
    figures,
    enteredOn,
    replacedOn: null
  };
}

export type PlanRequest = { kind: "plan"; body: GdmPlan; replaces?: string };

/**
 * G-13: a save is one POST. With `replaces`, the server inserts this plan and
 * dates the old one in a single transaction, so she never holds two current
 * plans and never none.
 */
export function planRequest(form: PlanForm, enteredOn: string, replaces: string | null): PlanRequest {
  const body = planBodyFrom(form, enteredOn);
  return replaces === null ? { kind: "plan", body } : { kind: "plan", body, replaces };
}

/**
 * Which form is open once she has a plan: a blank one for another plan beside
 * hers (R50), or one replacing a plan (G-75). With no current plan the blank
 * form is simply open, with no mode.
 */
export type FormMode = { kind: "add" } | { kind: "replace"; plan: StoredPlan };

/** The form a mode opens with: blank for another plan (R50); her own stored plan for a replace (G-75). */
export function formFor(mode: FormMode): PlanForm {
  return mode.kind === "add" ? EMPTY_PLAN_FORM : planFormFrom(mode.plan);
}

/** The plan a save replaces: the open plan's id when replacing (G-13); none for a new plan or another one beside hers (R50). */
export function replacesFor(mode: FormMode | null): string | null {
  return mode?.kind === "replace" ? mode.plan.id : null;
}

/** R47: a full list has its own line (G-14); every other failure, "Already replaced" included, is the save-failed line. A server string is never shown. */
export function saveFailure(status: number, error: string): string {
  return status === 409 && error === LIST_FULL ? LIST_FULL : SAVE_FAILED;
}

/** The list after a 200, as the server now holds it: the new plan first, and the plan it replaced dated with its enteredOn. */
export function withSavedPlan(plans: readonly StoredPlan[], saved: StoredPlan, replacedId: string | null): StoredPlan[] {
  return [saved, ...plans.map((plan) => (plan.id === replacedId ? { ...plan, replacedOn: saved.enteredOn } : plan))];
}

/** The question "Add to my questions" parks: askText, its {occasion} filled by that occasion's heading. */
export function parkedAskText(occasion: GdmOccasion): string {
  return DIFFER.askText.replace("{occasion}", OCCASIONS[occasion]);
}

/** A card's differing occasions, in the order of her day. Both cards of a pair get the same ones. */
export function differingOccasions(conflicts: readonly PlanConflict[], planId: string): GdmOccasion[] {
  return GDM_OCCASIONS.filter((occasion) =>
    conflicts.some((conflict) => conflict.occasion === occasion && conflict.planIds.includes(planId))
  );
}

const unitFrom = (value: string): GdmUnit => GDM_UNITS.find((unit) => unit === value) ?? "none";

type PlanItem = { id: string; body: GdmPlan };

/**
 * My plan (PRD §6.2 F-PLANKEEP): her plan in her care team's words. Top to
 * bottom: the heading and its one line, the page's polite status line, then
 * either the form (no plan yet, G-39) with the empty line below it, or her
 * current plan cards in one column (R51: the door's frame is 480px), each
 * with "Replace this plan", which opens the form filled with that plan
 * (G-75), then "Add another plan", which opens a blank form whose plan
 * stands beside hers (R50: a second sheet from a second clinician). Replaced
 * plans follow, kept and dated. Two current plans that differ for an
 * occasion are both flagged, and neither is picked.
 *
 * G-26: the plan is never drafted on the device (a figure is health data).
 * Instead the form keeps every value on screen through a failed save. It
 * opens only once the list has loaded: shown before, it could collapse under
 * her typing when plans arrive, or save a second current plan by mistake.
 */
export function PlanKeep() {
  const [plans, setPlans] = useState<StoredPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [attempt, setAttempt] = useState(0); // a retry after a failed load is the next attempt
  const [status, setStatus] = useState<string | null>(null);
  const [mode, setMode] = useState<FormMode | null>(null);
  const [form, setForm] = useState<PlanForm>(EMPTY_PLAN_FORM);
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [parking, setParking] = useState(false);
  const [parkFailed, setParkFailed] = useState<string | null>(null);
  const focusLater = useFocusAfterRender();

  const current = currentPlans(plans);
  const replaced = plans.filter((plan) => plan.replacedOn !== null);
  const conflicts = detectConflicts(plans);
  const formOpen = !loading && !loadFailed && (current.length === 0 || mode !== null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const result = await gdmFetch<{ items: PlanItem[] }>(`${ITEMS_PATH}?kind=plan`);
      if (cancelled) return;
      if (result.ok) setPlans(result.data.items.map((item) => ({ ...item.body, id: item.id })));
      setLoadFailed(!result.ok);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  function edit(change: Partial<Omit<PlanForm, "figures">>) {
    setForm((shown) => ({ ...shown, ...change }));
  }

  function editFigure(occasion: GdmOccasion, figure: string) {
    setForm((shown) => ({ ...shown, figures: { ...shown.figures, [occasion]: figure } }));
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const replaces = replacesFor(mode);
    const request = planRequest(form, localIsoDate(), replaces);
    if (isEmptyPlan(request.body)) {
      // Nothing written: nothing is sent. A plan can be replaced but never
      // removed, so a stray Save must not leave an empty one behind.
      document.getElementById(FIELD_ID.givenBy)?.focus();
      return;
    }
    setSaving(true);
    setFailure(null);
    setStatus(STATUS.saving);
    const result = await gdmFetch<{ id: string }>(ITEMS_PATH, { method: "POST", body: request });
    if (result.ok) {
      const unit = request.body.unit;
      const hasFigure = Object.keys(request.body.figures).length > 0;
      track({ name: "gdm_plan_entered", props: { unit, has_figure: hasFigure } });
      const saved: StoredPlan = { ...request.body, id: result.data.id };
      setPlans((shown) => withSavedPlan(shown, saved, replaces));
      setMode(null);
      setForm(EMPTY_PLAN_FORM);
      setStatus(STATUS.saved);
      focusLater(replaceId(saved.id));
    } else {
      // G-26: the form stays as she filled it.
      setFailure(saveFailure(result.status, result.error));
      setStatus(null);
      focusLater(SAVE_ID);
    }
    setSaving(false);
  }

  /** Replace (G-75) or Add another plan (R50): the form opens below her plans, focus on its first field. */
  function open(next: FormMode) {
    setMode(next);
    setForm(formFor(next));
    setFailure(null);
    setStatus(null);
    focusLater(FIELD_ID.givenBy);
  }

  /** G-75, R50: Cancel closes the form, sends nothing, and returns focus to the control that opened it. */
  function cancel() {
    if (!mode) return;
    setMode(null);
    setForm(EMPTY_PLAN_FORM);
    setFailure(null);
    focusLater(mode.kind === "add" ? ADD_ANOTHER_ID : replaceId(mode.plan.id));
  }

  async function park(planId: string, occasion: GdmOccasion) {
    if (parking) return;
    setParking(true);
    setParkFailed(null);
    setStatus(STATUS.saving);
    const ask: AskBody = { text: parkedAskText(occasion), note: null, asked: false, answer: null };
    const result = await gdmFetch<{ id: string }>(ITEMS_PATH, { method: "POST", body: { kind: "ask", body: ask } });
    if (result.ok) {
      track({ name: "gdm_ask_parked", props: { from: "plan_differ" } });
      setStatus(STATUS.saved);
    } else {
      setParkFailed(saveFailure(result.status, result.error));
      setStatus(null);
    }
    focusLater(parkId(planId, occasion));
    setParking(false);
  }

  function retry() {
    setLoading(true);
    setLoadFailed(false);
    setAttempt((count) => count + 1);
  }

  const parkButton = (planId: string, occasion: GdmOccasion) => (
    <button
      id={parkId(planId, occasion)}
      type="button"
      className="secondary-button gdm-differ-park"
      disabled={parking}
      aria-describedby={planOccasionId(planId, occasion)}
      onClick={() => void park(planId, occasion)}
    >
      {DIFFER.park}
    </button>
  );

  const planForm = formOpen ? (
    <form className="surface-card form-card gdm-plan-form" onSubmit={save}>
      <div className="field-stack">
        <label className="field-label" htmlFor={FIELD_ID.givenBy}>
          {CONTROLS.givenBy}
        </label>
        <input
          id={FIELD_ID.givenBy}
          type="text"
          className="text-input"
          maxLength={PLAN_MAX_LENGTH.givenBy}
          value={form.givenBy}
          onChange={(event) => edit({ givenBy: event.target.value })}
        />
      </div>
      <div className="field-stack">
        <label className="field-label" htmlFor={FIELD_ID.note}>
          {CONTROLS.note}
        </label>
        <textarea
          id={FIELD_ID.note}
          className="text-input"
          maxLength={PLAN_MAX_LENGTH.note}
          value={form.note}
          onChange={(event) => edit({ note: event.target.value })}
        />
      </div>
      <div className="field-stack">
        <label className="field-label" htmlFor={FIELD_ID.perDay}>
          {CONTROLS.perDay}
        </label>
        <input
          id={FIELD_ID.perDay}
          type="text"
          className="text-input"
          maxLength={PLAN_MAX_LENGTH.perDay}
          value={form.perDay}
          onChange={(event) => edit({ perDay: event.target.value })}
        />
      </div>
      <div className="field-stack">
        <label className="field-label" htmlFor={FIELD_ID.unit}>
          {CONTROLS.counts}
        </label>
        <select
          id={FIELD_ID.unit}
          className="text-input"
          value={form.unit}
          onChange={(event) => edit({ unit: unitFrom(event.target.value) })}
        >
          {GDM_UNITS.map((unit) => (
            <option key={unit} value={unit}>
              {CONTROLS[unit]}
            </option>
          ))}
        </select>
      </div>
      {form.unit === "choices" ? (
        <div className="field-stack">
          <label className="field-label" htmlFor={FIELD_ID.choiceMeans}>
            {CONTROLS.choiceMeans}
          </label>
          <input
            id={FIELD_ID.choiceMeans}
            type="text"
            inputMode="text"
            className="text-input"
            maxLength={PLAN_MAX_LENGTH.choiceMeans}
            value={form.choiceMeans}
            onChange={(event) => edit({ choiceMeans: event.target.value })}
          />
        </div>
      ) : null}
      {/* G-39: one fieldset, its legend the `figure` string, each input labelled by its occasion. Text, never a number field. */}
      <fieldset className="gdm-plan-figures">
        <legend className="field-label">{CONTROLS.figure}</legend>
        {GDM_OCCASIONS.map((occasion) => (
          <div key={occasion} className="field-stack">
            <label className="gdm-plan-occasion" htmlFor={figureId(occasion)}>
              {OCCASIONS[occasion]}
            </label>
            <input
              id={figureId(occasion)}
              type="text"
              inputMode="text"
              className="text-input"
              maxLength={PLAN_MAX_LENGTH.figure}
              value={form.figures[occasion]}
              onChange={(event) => editFigure(occasion, event.target.value)}
            />
          </div>
        ))}
      </fieldset>
      <div className="gdm-actions">
        <button id={SAVE_ID} type="submit" className="secondary-button" disabled={saving}>
          {CONTROLS.save}
        </button>
        {mode === null ? null : (
          <button type="button" className="secondary-button" disabled={saving} onClick={cancel}>
            {CANCEL}
          </button>
        )}
      </div>
      {failure ? (
        <p className="field-error" role="alert">
          {failure}
        </p>
      ) : null}
    </form>
  ) : null;

  return (
    <>
      <div className="gdm-plan-head">
        <h1 className="gdm-title">{CONTROLS.title}</h1>
        <p className="gdm-lead">{CONTROLS.sub}</p>
      </div>

      {/* G-36: the page's one polite live region, for the form and every park. */}
      <p className="field-hint gdm-status" aria-live="polite">
        {loading ? STATUS.loading : status}
      </p>

      <div className="gdm-plan" aria-busy={loading}>
        {loadFailed ? (
          <div className="surface-card legal-card">
            <p role="alert">{LOAD_FAILED.line}</p>
            <button type="button" className="secondary-button gdm-retry" onClick={retry}>
              {LOAD_FAILED.retry}
            </button>
          </div>
        ) : loading ? null : current.length === 0 ? (
          <>
            {planForm}
            {plans.length === 0 ? <p className="gdm-plan-empty">{CONTROLS.empty}</p> : null}
          </>
        ) : (
          <>
            <ul className="gdm-plan-current" role="list">
              {current.map((plan) => (
                <li key={plan.id} className="gdm-plan-slot">
                  <PlanCard
                    plan={plan}
                    differs={differingOccasions(conflicts, plan.id)}
                    renderDiffer={(occasion) => parkButton(plan.id, occasion)}
                  />
                  {mode === null ? (
                    <button
                      id={replaceId(plan.id)}
                      type="button"
                      className="secondary-button gdm-plan-replace"
                      aria-describedby={planEnteredId(plan.id)}
                      onClick={() => open({ kind: "replace", plan })}
                    >
                      {CONTROLS.replace}
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
            {/* R50: a second sheet from a second clinician is kept beside the first, never in its place. */}
            {mode === null ? (
              <button
                id={ADD_ANOTHER_ID}
                type="button"
                className="secondary-button gdm-plan-add"
                onClick={() => open({ kind: "add" })}
              >
                {CONTROLS.addAnother}
              </button>
            ) : null}
            {parkFailed ? (
              <p className="field-error" role="alert">
                {parkFailed}
              </p>
            ) : null}
            {planForm}
          </>
        )}

        {replaced.length > 0 ? (
          <ul className="gdm-plan-replaced" role="list">
            {replaced.map((plan) => (
              <li key={plan.id}>
                <PlanCard plan={plan} differs={[]} />
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </>
  );
}
