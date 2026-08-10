"use client";

import { useEffect, useState } from "react";

import { track } from "../lib/client/analytics";
import { mealMemoryUiEnabled } from "../lib/meal-memory-flag";
import {
  MEMORY_CHOICE_MAX,
  MEMORY_EASE_OPTIONS,
  MEMORY_LABEL_OPTIONS,
  MEMORY_NOTE_MAX,
  memorySavedProps,
  saveMealMemory,
  type MemoryEase,
  type MemoryLabel
} from "../lib/client/memory";

/**
 * "Save to your meal memory" (plan §P3.2).
 *
 * Ships behind the meal-memory build flag (NEXT_PUBLIC_MEAL_MEMORY) AND renders
 * only for an entitled user on a PERSISTED check (a `checkId` is present). The
 * entitlement is read from the server capability matrix (/api/entitlement) —
 * never UI-only gating (global constraint §6); a free user simply never sees the
 * affordance, and the API 403s them anyway.
 *
 * The explainer states the boundary plainly: memory is the user's, and it never
 * changes how Prediabetes Pal checks a meal (global constraint §1). No glucose prompt, no
 * "did it work" claim — this phase records a choice, not a health outcome.
 */
export function MealMemorySave({ checkId }: { checkId?: string }) {
  const [entitled, setEntitled] = useState(false);
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  const [choice, setChoice] = useState("");
  const [wouldRepeat, setWouldRepeat] = useState<boolean | null>(null);
  const [ease, setEase] = useState<MemoryEase | null>(null);
  const [note, setNote] = useState("");
  const [favorite, setFavorite] = useState(false);
  const [label, setLabel] = useState<MemoryLabel | "">("");

  const enabled = mealMemoryUiEnabled() && Boolean(checkId);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    let active = true;
    void (async () => {
      try {
        const response = await fetch("/api/entitlement");
        if (!response.ok) {
          return;
        }
        const body: unknown = await response.json();
        const can =
          typeof body === "object" &&
          body !== null &&
          (body as { capabilities?: { mealMemory?: unknown } }).capabilities
            ?.mealMemory === true;
        if (active && can) {
          setEntitled(true);
        }
      } catch {
        // Entitlement read is best-effort: a failure just hides the affordance,
        // never a paywall or an error (global constraint §7).
      }
    })();
    return () => {
      active = false;
    };
  }, [enabled]);

  if (!enabled || !entitled || !checkId) {
    return null;
  }

  if (saved) {
    return (
      <p className="feedback-thanks" data-testid="memory-saved">
        Saved to your meal memory.
      </p>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        className="feedback-skip"
        data-testid="memory-open"
        onClick={() => setOpen(true)}
      >
        Save to your meal memory
      </button>
    );
  }

  async function onSave() {
    if (!checkId) {
      return;
    }
    setSaving(true);
    setError(false);
    const input = {
      choice: choice || undefined,
      wouldRepeat: wouldRepeat ?? undefined,
      ease: ease ?? undefined,
      note: note || undefined,
      favorite,
      label: label || undefined
    };
    const ok = await saveMealMemory(checkId, input);
    setSaving(false);
    if (!ok) {
      setError(true);
      return;
    }
    track({ name: "meal_memory_saved", props: memorySavedProps(input) });
    setSaved(true);
  }

  return (
    <div className="result-feedback" data-testid="memory-form">
      <p className="feedback-prompt">Save this to your meal memory</p>

      <label className="feedback-comment-label" htmlFor="memory-choice">
        What I chose (optional)
      </label>
      <input
        id="memory-choice"
        className="feedback-comment"
        data-testid="memory-choice"
        type="text"
        maxLength={MEMORY_CHOICE_MAX}
        value={choice}
        onChange={(event) =>
          setChoice(event.target.value.slice(0, MEMORY_CHOICE_MAX))
        }
      />

      <p className="feedback-prompt" id="memory-repeat-prompt">
        Would you choose this again?
      </p>
      <div
        className="feedback-reasons"
        role="group"
        aria-labelledby="memory-repeat-prompt"
      >
        <button
          type="button"
          className="feedback-chip"
          aria-pressed={wouldRepeat === true}
          data-testid="memory-repeat-yes"
          onClick={() =>
            setWouldRepeat((current) => (current === true ? null : true))
          }
        >
          Yes
        </button>
        <button
          type="button"
          className="feedback-chip"
          aria-pressed={wouldRepeat === false}
          data-testid="memory-repeat-no"
          onClick={() =>
            setWouldRepeat((current) => (current === false ? null : false))
          }
        >
          No
        </button>
      </div>

      <p className="feedback-prompt" id="memory-ease-prompt">
        How did it feel?
      </p>
      <div
        className="feedback-reasons"
        role="group"
        aria-labelledby="memory-ease-prompt"
      >
        {MEMORY_EASE_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            className="feedback-chip"
            aria-pressed={ease === option.value}
            data-testid={`memory-ease-${option.value}`}
            onClick={() =>
              setEase((current) =>
                current === option.value ? null : option.value
              )
            }
          >
            {option.label}
          </button>
        ))}
      </div>

      <label className="feedback-comment-label" htmlFor="memory-note">
        A private note (optional)
      </label>
      <textarea
        id="memory-note"
        className="feedback-comment"
        data-testid="memory-note"
        maxLength={MEMORY_NOTE_MAX}
        value={note}
        onChange={(event) =>
          setNote(event.target.value.slice(0, MEMORY_NOTE_MAX))
        }
        rows={2}
      />

      <div className="feedback-reasons">
        <button
          type="button"
          className="feedback-chip"
          aria-pressed={favorite}
          data-testid="memory-favorite"
          onClick={() => setFavorite((current) => !current)}
        >
          {favorite ? "★ Favorite" : "☆ Favorite"}
        </button>
        <label className="feedback-comment-label" htmlFor="memory-label">
          Label
        </label>
        <select
          id="memory-label"
          data-testid="memory-label"
          value={label}
          onChange={(event) => setLabel(event.target.value as MemoryLabel | "")}
        >
          <option value="">No label</option>
          {MEMORY_LABEL_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <p className="result-disclaimer" data-testid="memory-explainer">
        Your memory is yours. It never changes how Prediabetes Pal checks a meal.
      </p>

      {error ? (
        <p className="result-disclaimer" data-testid="memory-error" role="alert">
          That didn&apos;t save. Please try again.
        </p>
      ) : null}

      <div className="feedback-buttons">
        <button
          type="button"
          className="feedback-button"
          data-testid="memory-save"
          disabled={saving}
          onClick={() => void onSave()}
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          className="feedback-skip"
          data-testid="memory-cancel"
          onClick={() => setOpen(false)}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
