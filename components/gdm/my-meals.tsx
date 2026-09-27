"use client";

import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";

import { track } from "../../lib/client/analytics";
import { gdmFetch } from "../../lib/client/gdm-api";
import { useFocusAfterRender } from "../../lib/client/gdm-focus";
import { GDM_COPY } from "../../lib/pal/gdm/copy";
import { groupMeals, type MealBody } from "../../lib/pal/gdm/items";
import { GDM_OCCASIONS, type GdmOccasion } from "../../lib/pal/gdm/plan-record";

const CONTROLS = GDM_COPY["gdm-meals-controls"];
const OCCASIONS = GDM_COPY["gdm-occasions"];
const STATUS = GDM_COPY["gdm-status"];
const LOAD_FAILED = GDM_COPY["gdm-load-failed"];
const CANCEL = GDM_COPY["gdm-data-controls"].cancel;
const SAVE_FAILED = GDM_COPY["gdm-save-failed"].line;
const LIST_FULL = GDM_COPY["gdm-list-full"].line;

const ITEMS_PATH = "/api/gdm/items";

export const MEAL_FIELD_ID = "gdm-meal-field";
const OCCASION_FIELD_ID = "gdm-meal-occasion";

/** G-14: the field's maxLength is its bound in MealBodySchema (lib/pal/gdm/items.ts), so a 400 is unreachable. */
export const MEAL_MAX_LENGTH = 200;

export type MealItem = { id: string; createdAt: string; updatedAt: string; body: MealBody };
type MealControl = "text" | "inSummary" | "remove" | "cancel";

export const mealControlId = (id: string, control: MealControl) => `gdm-meal-${id}-${control}`;
const sectionTitleId = (occasion: GdmOccasion) => `gdm-meals-${occasion}`;

/** The meals as the page renders them: occasion by occasion in the order of her day, each keeping the server's newest-first order. */
export function mealsInOrder<T extends { body: MealBody }>(meals: T[]): T[] {
  const grouped = groupMeals(meals);
  return GDM_OCCASIONS.flatMap((occasion) => grouped[occasion]);
}

/**
 * G-39: after a Delete, focus goes to the next meal's first control (its
 * Include in my summary box), or — for the last one — the meal above it, or
 * the add field once no meal is left. Never `<body>`. `orderedIds` is the
 * list as rendered, across the occasions (`mealsInOrder`).
 */
export function focusAfterMealRemove(orderedIds: readonly string[], removedId: string): string {
  const index = orderedIds.indexOf(removedId);
  const neighbour = orderedIds[index + 1] ?? orderedIds[index - 1];
  return neighbour && neighbour !== removedId ? mealControlId(neighbour, "inSummary") : MEAL_FIELD_ID;
}

/** G-14: "try again in a moment" is untrue for a full list; everything else is the save-failed line. */
export function mealSaveFailure(status: number): string {
  return status === 409 ? LIST_FULL : SAVE_FAILED;
}

/** The select only offers the six occasions; anything else reads as the first of her day. */
function occasionFrom(value: string): GdmOccasion {
  return (GDM_OCCASIONS as readonly string[]).includes(value) ? (value as GdmOccasion) : GDM_OCCASIONS[0];
}

/**
 * My meals (PRD §6.2 F-MYMEALS): the meals she already eats, in her own words,
 * grouped the way her day runs. Top to bottom: the heading and its one line,
 * the one add form (G-70: her words, which occasion, Save), the page's polite
 * status line, then a section for each occasion that holds a meal. The product
 * reads nothing here, labels nothing and scores nothing: every word under a
 * heading is hers.
 */
export function MyMeals() {
  const [items, setItems] = useState<MealItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [text, setText] = useState("");
  // The first occasion of her day to start; after a save it keeps her choice,
  // since she often adds several under one. An occasion, never a figure.
  const [occasion, setOccasion] = useState<GdmOccasion>(GDM_OCCASIONS[0]);
  const [adding, setAdding] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0); // a retry after a failed load is the next attempt
  const focusLater = useFocusAfterRender();

  // The list loads after the first commit; the form is usable at once.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const result = await gdmFetch<{ items: MealItem[] }>(`${ITEMS_PATH}?kind=meal`);
      if (cancelled) return;
      if (result.ok) {
        const fetched = result.data.items;
        // One saved while the list was loading stays at the top.
        setItems((shown) => [...shown.filter((item) => !fetched.some((f) => f.id === item.id)), ...fetched]);
      }
      setLoadFailed(!result.ok);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (adding) return;
    const typed = text;
    const words = typed.trim();
    if (!words) {
      // Only spaces (`required` lets those through): nothing to keep, and
      // nothing is sent. The field is enabled, so focus can move at once.
      document.getElementById(MEAL_FIELD_ID)?.focus();
      return;
    }
    const meal: MealBody = { occasion, text: words, inSummary: false };
    setAdding(true);
    setFailure(null);
    setStatus(STATUS.saving);
    const result = await gdmFetch<{ id: string }>(ITEMS_PATH, { method: "POST", body: { kind: "meal", body: meal } });
    if (result.ok) {
      track({ name: "gdm_meal_saved", props: { occasion } });
      const now = new Date().toISOString();
      setItems((shown) => [{ id: result.data.id, createdAt: now, updatedAt: now, body: meal }, ...shown]);
      // Cleared only if she has not typed on while it was saving.
      setText((current) => (current === typed ? "" : current));
      setStatus(STATUS.saved);
    } else {
      // Her words stay in the field.
      setFailure(mealSaveFailure(result.status));
      setStatus(null);
    }
    // G-39: back to the field, ready for the next meal.
    focusLater(MEAL_FIELD_ID);
    setAdding(false);
  }

  async function save(id: string, meal: MealBody): Promise<boolean> {
    setStatus(STATUS.saving);
    const result = await gdmFetch(ITEMS_PATH, { method: "PATCH", body: { id, body: meal } });
    if (!result.ok) {
      setStatus(null);
      return false;
    }
    const now = new Date().toISOString();
    setItems((shown) => shown.map((item) => (item.id === id ? { ...item, updatedAt: now, body: meal } : item)));
    setStatus(STATUS.saved);
    return true;
  }

  async function remove(id: string): Promise<boolean> {
    setStatus(null);
    const result = await gdmFetch(`${ITEMS_PATH}?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    // A 404 is a meal already gone (another tab): the list catches up.
    if (!result.ok && result.status !== 404) return false;
    focusLater(focusAfterMealRemove(mealsInOrder(items).map((item) => item.id), id));
    setItems((shown) => shown.filter((item) => item.id !== id));
    setStatus(STATUS.removed);
    return true;
  }

  function retry() {
    setLoading(true);
    setLoadFailed(false);
    setAttempt((count) => count + 1);
  }

  return (
    <>
      <div className="gdm-meals-head">
        <h1 className="gdm-title">{CONTROLS.title}</h1>
        <p className="gdm-lead">{CONTROLS.sub}</p>
      </div>

      {/* G-70: one add form, not one per occasion. */}
      <form className="surface-card form-card gdm-meal-form" onSubmit={add}>
        <div className="field-stack">
          <label className="field-label" htmlFor={MEAL_FIELD_ID}>
            {CONTROLS.field}
          </label>
          <textarea
            id={MEAL_FIELD_ID}
            className="text-input"
            required
            maxLength={MEAL_MAX_LENGTH}
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
        </div>
        <div className="field-stack">
          <label className="field-label" htmlFor={OCCASION_FIELD_ID}>
            {CONTROLS.occasion}
          </label>
          <select
            id={OCCASION_FIELD_ID}
            className="text-input"
            value={occasion}
            onChange={(event) => setOccasion(occasionFrom(event.target.value))}
          >
            {GDM_OCCASIONS.map((key) => (
              <option key={key} value={key}>
                {OCCASIONS[key]}
              </option>
            ))}
          </select>
        </div>
        {/* Not the filled accent: on this page that stays the nav's Add a question. */}
        <button type="submit" className="secondary-button gdm-meal-save" disabled={adding}>
          {CONTROLS.save}
        </button>
        {failure ? (
          <p className="field-error" role="alert">
            {failure}
          </p>
        ) : null}
        {/* G-36: the page's one polite live region, for the form and every meal. */}
        <p className="field-hint gdm-status" aria-live="polite">
          {loading ? STATUS.loading : status}
        </p>
      </form>

      <div className="gdm-meal-list" aria-busy={loading}>
        {loadFailed ? (
          <div className="surface-card legal-card">
            <p role="alert">{LOAD_FAILED.line}</p>
            <button type="button" className="secondary-button gdm-retry" onClick={retry}>
              {LOAD_FAILED.retry}
            </button>
          </div>
        ) : loading && items.length === 0 ? null : (
          <MealSections meals={items} onSave={save} onRemove={remove} />
        )}
      </div>
    </>
  );
}

export type MealSectionsProps = {
  meals: MealItem[];
  onSave: (id: string, meal: MealBody) => Promise<boolean>;
  onRemove: (id: string) => Promise<boolean>;
};

/**
 * G-70: an occasion's heading renders only once it holds a meal, in the order
 * of her day, the bedtime snack like any other. G-25: with no meal at all, one
 * page-level line instead, never an empty heading.
 */
export function MealSections({ meals, onSave, onRemove }: MealSectionsProps) {
  if (meals.length === 0) return <p className="gdm-meal-empty">{CONTROLS.empty}</p>;
  const grouped = groupMeals(meals);
  return (
    <>
      {GDM_OCCASIONS.filter((key) => grouped[key].length > 0).map((key) => (
        <section key={key} className="gdm-meal-section" aria-labelledby={sectionTitleId(key)}>
          <h2 id={sectionTitleId(key)} className="gdm-section-title">
            {OCCASIONS[key]}
          </h2>
          <ul className="gdm-meals" role="list">
            {grouped[key].map((item) => (
              <MealRow key={item.id} item={item} onSave={onSave} onRemove={onRemove} />
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}

/**
 * One meal: her words, then Include in my summary (saved the moment it
 * changes) and Delete, which takes two presses (G-76). Her words are not
 * edited here.
 */
function MealRow({
  item,
  onSave,
  onRemove
}: {
  item: MealItem;
  onSave: (id: string, meal: MealBody) => Promise<boolean>;
  onRemove: (id: string) => Promise<boolean>;
}) {
  const { id, body } = item;
  const [inSummary, setInSummary] = useState(body.inSummary);
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const focusLater = useFocusAfterRender();
  const textId = mealControlId(id, "text");
  const checkId = mealControlId(id, "inSummary");

  async function toggle(event: ChangeEvent<HTMLInputElement>) {
    if (saving || removing) return;
    const next = event.target.checked;
    setInSummary(next);
    setSaving(true);
    setFailure(null);
    const saved = await onSave(id, { ...body, inSummary: next });
    if (!saved) {
      // Nothing changed on the server: the box goes back to what is stored.
      setInSummary(!next);
      setFailure(SAVE_FAILED);
    }
    // The box was disabled in flight, which drops focus: it goes back to the box.
    focusLater(checkId);
    setSaving(false);
  }

  function confirm() {
    setFailure(null);
    setConfirming(true);
    focusLater(mealControlId(id, "cancel"));
  }

  function cancel() {
    setConfirming(false);
    focusLater(mealControlId(id, "remove"));
  }

  async function remove() {
    if (removing) return;
    setRemoving(true);
    setFailure(null);
    const removed = await onRemove(id);
    if (removed) return; // the meal is gone; the list moves focus on
    setFailure(SAVE_FAILED);
    focusLater(mealControlId(id, "cancel"));
    setRemoving(false);
  }

  return (
    <li className="surface-card gdm-meal">
      <p id={textId} className="gdm-meal-text">
        {body.text}
      </p>
      <div className="gdm-meal-check">
        <input
          id={checkId}
          type="checkbox"
          checked={inSummary}
          disabled={saving || removing}
          onChange={(event) => void toggle(event)}
          aria-describedby={textId}
        />
        <label htmlFor={checkId}>{CONTROLS.inSummary}</label>
      </div>
      <div className="gdm-actions">
        {confirming ? (
          <>
            <button
              id={mealControlId(id, "remove")}
              type="button"
              className="danger-button"
              disabled={removing}
              onClick={() => void remove()}
              aria-describedby={textId}
            >
              {CONTROLS.remove}
            </button>
            <button
              id={mealControlId(id, "cancel")}
              type="button"
              className="secondary-button"
              disabled={removing}
              onClick={cancel}
            >
              {CANCEL}
            </button>
          </>
        ) : (
          <button
            id={mealControlId(id, "remove")}
            type="button"
            className="secondary-button"
            disabled={saving}
            onClick={confirm}
            aria-describedby={textId}
          >
            {CONTROLS.remove}
          </button>
        )}
      </div>
      {failure ? (
        <p className="field-error" role="alert">
          {failure}
        </p>
      ) : null}
    </li>
  );
}
