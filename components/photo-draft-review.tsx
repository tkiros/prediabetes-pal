"use client";

import { useState } from "react";

import type { MealDraftItem } from "../lib/meal/photo-extract";
import { composeDraft, dedupeDraftItems } from "../lib/client/photo-draft";

/** D5 confirm-before-verdict review card. Uncertain chips must be tapped
 *  (confirm) or removed before the draft can be used — no blanket accept of
 *  flagged doubts. Confirming composes plain text into the food textarea;
 *  the existing form and engine take it from there. */
export function PhotoDraftReview({
  dish,
  items,
  onConfirm,
  onDiscard
}: {
  dish: string | null;
  items: MealDraftItem[];
  onConfirm: (text: string) => void;
  onDiscard: () => void;
}) {
  // Collapse exact duplicates the drafter sometimes emits, once, before the
  // user ever sees the chips — and remember how many so we can say so. One
  // dedupe call seeds both pieces of state (lazy init runs it a single time).
  const [initial] = useState(() => dedupeDraftItems(items));
  const [initialCollapsed] = useState(initial.collapsed);
  const [draftDish, setDraftDish] = useState(dish ?? "");
  const [draftItems, setDraftItems] = useState<MealDraftItem[]>(initial.items);
  const [newItem, setNewItem] = useState("");

  const unresolved = draftItems.filter((item) => item.uncertain).length;
  const isEmpty = draftDish.trim() === "" && draftItems.length === 0;

  // Honest length-cap surface: composing over FOOD_MAX_LENGTH silently sheds
  // detail (plan §P1.5). Show what the check will actually use before confirm.
  const composed = composeDraft(draftDish.trim() || null, draftItems);
  const droppedItems = composed.totalItems - composed.keptItems;

  return (
    <section className="draft-card" data-testid="photo-draft-review">
      <p className="result-eyebrow">Check the draft</p>
      <p className="field-hint">
        {isEmpty
          ? "Prediabetes Pal couldn't make out the food in this photo. Add the items below, or discard and type the meal instead."
          : "This is Prediabetes Pal's best guess from your photo. Fix anything that's off — tap the highlighted items to confirm them."}
      </p>
      {initialCollapsed > 0 ? (
        <p className="field-hint" data-testid="draft-dedupe-notice">
          Combined {initialCollapsed} repeated item
          {initialCollapsed === 1 ? "" : "s"} the photo listed twice.
        </p>
      ) : null}
      {droppedItems > 0 ? (
        <p className="field-hint" data-testid="draft-truncation-notice">
          {composed.keptItems === 0
            ? "This description is too long to check. Shorten it so the meal fits."
            : `This is a long meal, so the check will use the first ${composed.keptItems} of ${composed.totalItems} items.`}
        </p>
      ) : null}
      <label htmlFor="draft-dish" className="field-label">
        Dish
      </label>
      <input
        id="draft-dish"
        className="text-input"
        value={draftDish}
        placeholder="What is this meal?"
        onChange={(event) => setDraftDish(event.target.value)}
      />
      <ul className="chip-list">
        {draftItems.map((item, index) => (
          <li
            key={`${item.name}-${index}`}
            className={item.uncertain ? "chip chip-uncertain" : "chip"}
            data-testid={item.uncertain ? "chip-uncertain" : "chip"}
          >
            <button
              type="button"
              className="chip-label"
              title={item.uncertain ? "Tap to confirm this item" : undefined}
              onClick={() =>
                setDraftItems((current) =>
                  current.map((entry, i) =>
                    i === index ? { ...entry, uncertain: false } : entry
                  )
                )
              }
            >
              {item.portion ? `${item.name} (${item.portion})` : item.name}
              {item.uncertain ? " — not sure, tap to confirm" : ""}
            </button>
            <button
              type="button"
              className="chip-remove"
              aria-label={`Remove ${item.name}`}
              onClick={() =>
                setDraftItems((current) => current.filter((_, i) => i !== index))
              }
            >
              ×
            </button>
          </li>
        ))}
      </ul>
      <div className="chip-add-row">
        <input
          className="text-input"
          value={newItem}
          placeholder="Add something it missed"
          onChange={(event) => setNewItem(event.target.value)}
        />
        <button
          type="button"
          className="secondary-button"
          disabled={newItem.trim() === ""}
          onClick={() => {
            setDraftItems((current) => [
              ...current,
              { name: newItem.trim(), portion: null, uncertain: false }
            ]);
            setNewItem("");
          }}
        >
          Add
        </button>
      </div>
      <button
        type="button"
        className="primary-button"
        data-testid="draft-confirm-button"
        disabled={unresolved > 0 || isEmpty}
        onClick={() => onConfirm(composed.text)}
      >
        {unresolved > 0
          ? `Confirm ${unresolved} highlighted item${unresolved === 1 ? "" : "s"} first`
          : "Use this description"}
      </button>
      <button type="button" className="link-button-plain" onClick={onDiscard}>
        Discard and type instead
      </button>
    </section>
  );
}
