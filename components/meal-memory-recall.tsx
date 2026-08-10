"use client";

import { useEffect, useRef, useState } from "react";

import { track } from "../lib/client/analytics";
import { RISK_LABELS } from "../lib/pal/labels";
import { mealMemoryUiEnabled } from "../lib/meal-memory-flag";
import {
  MEMORY_EASE_OPTIONS,
  MEMORY_LABEL_OPTIONS,
  recallMealMemory,
  shouldEmitRecalled,
  type RecalledMemory
} from "../lib/client/memory";

/**
 * "Your meal memory" recall panel (plan §P3.3).
 *
 * Rendered BELOW a completed meal card, on the just-checked meal text. After the
 * result renders it asks the server for the caller's OWN prior saved memories
 * whose meal matched this one (exact normalized match — POST /api/memory/recall,
 * meal text in the body, never a URL). If ≥1 match comes back it shows them in a
 * visually separate panel with source + date labels, a per-match dismiss, and a
 * one-tap "Check again" that pre-fills the stored meal into the standard input
 * path (`pal.recheck`, the same handoff the history page uses).
 *
 * Boundaries (global constraints §1/§6/§7):
 *  - render-after-result ONLY: this component is mounted inside the result branch,
 *    so recall never precedes or influences the check. Memory READS here; nothing
 *    it returns feeds the engine.
 *  - self-gates on the build flag AND on the server's answer: a free/guest/flag-off
 *    caller simply gets no matches (401/403/404 → empty), so the panel never
 *    renders as a paywall or an error — it just isn't there.
 *  - dismiss is session-local (sessionStorage) — hiding a wrong match needs no
 *    server write.
 */

const DISMISSED_KEY = "pal.memory.dismissed";

const EASE_LABEL = new Map(MEMORY_EASE_OPTIONS.map((o) => [o.value, o.label]));
const LABEL_LABEL = new Map(MEMORY_LABEL_OPTIONS.map((o) => [o.value, o.label]));

function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric"
      });
}

function readDismissed(): Set<string> {
  try {
    const raw = window.sessionStorage.getItem(DISMISSED_KEY);
    if (!raw) {
      return new Set();
    }
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? new Set(parsed.filter((v): v is string => typeof v === "string"))
      : new Set();
  } catch {
    return new Set();
  }
}

function persistDismissed(ids: Set<string>): void {
  try {
    window.sessionStorage.setItem(DISMISSED_KEY, JSON.stringify([...ids]));
  } catch {
    // best-effort only — dismissing is a courtesy, never load-bearing
  }
}

export function MealMemoryRecall({ food }: { food?: string }) {
  const [matches, setMatches] = useState<RecalledMemory[]>([]);
  // Seed session-dismissed ids from sessionStorage at mount. This component only
  // renders after a result (client-only), so the initializer runs with `window`
  // available — no setState-in-effect needed just to hydrate the set.
  const [dismissed, setDismissed] = useState<Set<string>>(() =>
    typeof window === "undefined" ? new Set() : readDismissed()
  );
  // A ref mirror of `dismissed`, read inside the recall effect so the emit
  // decision sees session-dismissed ids WITHOUT making `dismissed` an effect
  // dependency — dismissing a match must never re-fire the recall network call.
  const dismissedRef = useRef(dismissed);
  // The food this panel last emitted `meal_memory_recalled` for. Keyed on food
  // (not a once-per-session boolean) so a SECOND, different recalled meal in the
  // same session emits again, while a StrictMode double-invoke for the same meal
  // does not (plan §P3.3/§10.1).
  const emittedForRef = useRef<string | null>(null);

  const enabled = mealMemoryUiEnabled() && Boolean(food);

  useEffect(() => {
    if (!enabled || !food) {
      return;
    }
    let active = true;
    void (async () => {
      const found = await recallMealMemory(food);
      if (!active) {
        return;
      }
      setMatches(found);
      // §10.1: emit when the panel renders with ≥1 VISIBLE match — matches whose
      // only entries were session-dismissed render null and must not emit. Match
      // CLASS only ("exact" at launch): no meal text, no count.
      const visibleCount = found.filter(
        (m) => !dismissedRef.current.has(m.id)
      ).length;
      if (shouldEmitRecalled(food, visibleCount, emittedForRef.current)) {
        emittedForRef.current = food;
        track({ name: "meal_memory_recalled", props: { match: "exact" } });
      }
    })();
    return () => {
      active = false;
    };
  }, [enabled, food]);

  if (!enabled) {
    return null;
  }

  const visible = matches.filter((m) => !dismissed.has(m.id));
  if (visible.length === 0) {
    return null;
  }

  function dismiss(id: string) {
    setDismissed((current) => {
      const next = new Set(current);
      next.add(id);
      persistDismissed(next);
      // Keep the ref in sync so a later recall of the same meal sees the
      // dismissal and correctly suppresses both the panel and the emit.
      dismissedRef.current = next;
      return next;
    });
  }

  function checkAgain(mealText: string | null) {
    if (!mealText) {
      return;
    }
    try {
      window.sessionStorage.setItem("pal.recheck", mealText);
    } catch {
      // best-effort prefill only — /check still works without it
    }
    // Full navigation to /check so the form remounts and reads the prefill into
    // the standard input path (editable before submit). The engine still runs
    // history-independent on the pre-filled text (global constraint §1).
    window.location.assign("/check");
  }

  return (
    <section
      className="memory-recall"
      data-testid="memory-recall"
      aria-labelledby="memory-recall-title"
    >
      <h2 id="memory-recall-title" className="memory-recall-title">
        Your meal memory
      </h2>
      <p className="result-disclaimer" data-testid="memory-recall-explainer">
        Your memory is yours. It never changes how Prediabetes Pal checks a meal.
      </p>

      <ul className="memory-recall-list">
        {visible.map((memory) => (
          <li
            key={memory.id}
            className="memory-item"
            data-testid="memory-recall-item"
          >
            <div className="memory-item-head">
              <span className="memory-food">
                {memory.favorite ? (
                  <span aria-label="Favorite" title="Favorite">
                    ★{" "}
                  </span>
                ) : null}
                {memory.food ?? "(unreadable entry)"}
              </span>
              <span
                className="risk-chip"
                data-risk={memory.risk}
                data-testid="memory-recall-band"
              >
                {RISK_LABELS[memory.risk]}
              </span>
            </div>

            {/* Source + date label (§P3.3). */}
            <p className="memory-date" data-testid="memory-recall-source">
              You saved this on {formatDate(memory.savedAt)}
            </p>

            {memory.choice ? (
              <p className="memory-field">
                <strong>Chose:</strong> {memory.choice}
              </p>
            ) : null}
            {memory.wouldRepeat !== null ? (
              <p className="memory-field">
                <strong>Again?</strong> {memory.wouldRepeat ? "Yes" : "No"}
              </p>
            ) : null}
            {memory.ease ? (
              <p className="memory-field">
                <strong>Felt:</strong> {EASE_LABEL.get(memory.ease)}
              </p>
            ) : null}
            {memory.label ? (
              <p className="memory-field">
                <strong>Label:</strong> {LABEL_LABEL.get(memory.label)}
              </p>
            ) : null}
            {memory.note ? (
              <p className="memory-field">
                <strong>Note:</strong> {memory.note}
              </p>
            ) : null}

            <div className="memory-recall-actions">
              <button
                type="button"
                className="feedback-button"
                data-testid="memory-recall-again"
                onClick={() => checkAgain(memory.food)}
                disabled={!memory.food}
              >
                Check again
              </button>
              <button
                type="button"
                className="feedback-skip"
                data-testid="memory-recall-dismiss"
                onClick={() => dismiss(memory.id)}
              >
                Not this meal
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
