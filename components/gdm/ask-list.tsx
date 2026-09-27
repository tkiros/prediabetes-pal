"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

import { track } from "../../lib/client/analytics";
import { gdmFetch } from "../../lib/client/gdm-api";
import { focusIdAfterRemove, useFocusAfterRender } from "../../lib/client/gdm-focus";
import { gdmSaveFailure, useGdmItems, type GdmListItem } from "../../lib/client/gdm-items-list";
import { useHydrated } from "../../lib/client/use-hydrated";
import type { ClinicalRoute } from "../../lib/pal/clinical-risk";
import { GDM_COPY } from "../../lib/pal/gdm/copy";
import type { AskBody } from "../../lib/pal/gdm/items";
import { GdmLoadFailed } from "./load-failed";

const CONTROLS = GDM_COPY["gdm-asklist-controls"];
const LEAD = GDM_COPY["gdm-asklist-lead"].line;
const STATUS = GDM_COPY["gdm-status"];
const CANCEL = GDM_COPY["gdm-data-controls"].cancel;
const SAVE_FAILED = GDM_COPY["gdm-save-failed"].line;

const ITEMS_PATH = "/api/gdm/items";

/** The add form's anchor: the nav's "Add a question" is GDM_ROUTES.quickAdd (`/gdm/questions#add`). */
const ADD_ID = "add";
export const ASK_FIELD_ID = "gdm-ask-field";
const NOTE_FIELD_ID = "gdm-ask-note";
const CARD_TITLE_ID = "gdm-ask-card-title";
/** The first door's clinical card, reused as is (components/result-card.tsx, `.result-card[data-kind="clinical"]`). */
const CLINICAL_KIND = "clinical";

/** G-14: each field's maxLength is its bound in AskBodySchema (lib/pal/gdm/items.ts), so a 400 is unreachable. */
export const ASK_MAX_LENGTH = { text: 500, note: 500, answer: 1000 } as const;

export type AskItem = GdmListItem<AskBody>;
export type AskCard = { route: ClinicalRoute; routeCopy: string };
type AskControl = "text" | "asked" | "answer" | "save" | "remove" | "cancel";

export const askControlId = (id: string, control: AskControl) => `gdm-ask-${id}-${control}`;

/** Open questions first, then the ones she has asked; each group keeps the server's newest-first order. */
export function orderAsks<T extends { body: { asked: boolean } }>(items: readonly T[]): T[] {
  return [...items.filter((item) => !item.body.asked), ...items.filter((item) => item.body.asked)];
}

/**
 * The clinical card a park answers with, if any. R46: it rides a 200 AND a
 * 409 (a full list never hides it). The copy is the server's, verbatim: the
 * Approved `clinical-*` ledger row the items API read for that route.
 */
export function cardFrom(payload: unknown): AskCard | null {
  if (!payload || typeof payload !== "object") return null;
  const { route, routeCopy } = payload as { route?: unknown; routeCopy?: unknown };
  if (typeof route !== "string" || typeof routeCopy !== "string" || routeCopy === "") return null;
  return { route: route as ClinicalRoute, routeCopy };
}

/**
 * The body a row's Save sends (PATCH). Her text and note go back unchanged
 * (R48: never edited here). What they said is kept whether or not Asked is
 * ticked: unticking Asked only hides the answer field, it never discards her
 * words. Trimmed; empty is null (AskBodySchema).
 */
export function savedAskBody(parked: AskBody, asked: boolean, answer: string): AskBody {
  return { text: parked.text, note: parked.note, asked, answer: answer.trim() || null };
}

/** G-14: "try again in a moment" is untrue for a full list; everything else is the save-failed line. */
export function parkFailure(status: number): string {
  return gdmSaveFailure(status);
}

/** `gdm_ask_parked.from`: she came through the nav's Add a question, or used the list itself. */
export function parkedFrom(hash: string): "quick_add" | "list" {
  return hash === `#${ADD_ID}` ? "quick_add" : "list";
}

/**
 * G-39: after a Delete, focus goes to the next question's first control, or
 * — for the last one — the question above it, or the add field once the list
 * is empty. Never `<body>`. `orderedIds` is the list as rendered.
 */
export function focusAfterRemove(orderedIds: readonly string[], removedId: string): string {
  return focusIdAfterRemove(orderedIds, removedId, (id) => askControlId(id, "asked"), ASK_FIELD_ID);
}

// ── The unsent draft ──────────────────────────────────────────────────────────
// On this device only, under the door's `pal.gdm.*` prefix, so sign-out, erase
// and deletion clear it with the rest (clearGdmDeviceKeys). It holds what she
// has typed and not yet parked — never a parked question — and is cleared on a
// 200, so a dropped connection or an expired session loses nothing.

type AskDraft = { text: string; note: string };
type DraftStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const DRAFT_KEY = "pal.gdm.ask.draft";
const EMPTY_DRAFT: AskDraft = { text: "", note: "" };

function deviceStorage(): DraftStorage | null {
  try {
    return window.localStorage;
  } catch {
    return null; // blocked, private mode, or no window
  }
}

export const askDraft = {
  read(storage: DraftStorage | null = deviceStorage()): AskDraft {
    try {
      const raw = storage?.getItem(DRAFT_KEY);
      const parsed = raw ? (JSON.parse(raw) as { text?: unknown; note?: unknown }) : null;
      if (typeof parsed?.text !== "string" || typeof parsed.note !== "string") return EMPTY_DRAFT;
      return { text: parsed.text, note: parsed.note };
    } catch {
      return EMPTY_DRAFT;
    }
  },
  write(draft: AskDraft, storage: DraftStorage | null = deviceStorage()): void {
    try {
      if (draft.text === "" && draft.note === "") storage?.removeItem(DRAFT_KEY);
      else storage?.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {
      // Storage refused: the field still holds what she typed.
    }
  },
  clear(storage: DraftStorage | null = deviceStorage()): void {
    try {
      storage?.removeItem(DRAFT_KEY);
    } catch {
      // As above.
    }
  }
};

/**
 * My questions (PRD §6.2 F-ASKLIST): park a question the moment she has it,
 * tick it once asked, keep what they said. Top to bottom: the heading, the one
 * fixed line, the add form, the page's polite status line, the clinical card
 * when a park raised one, then the list. No model reads her words; the items
 * API's clinical router is the only thing that does.
 */
export function AskList() {
  const hydrated = useHydrated();
  // The list loads after the first commit (the form is usable at once) and
  // carries the page's polite status line: shared with My meals.
  const { items, loading, loadFailed, status, setStatus, prepend, save, remove: removeItem, retry } =
    useGdmItems<AskBody>("ask");
  const [draft, setDraft] = useState<AskDraft | null>(null);
  const [adding, setAdding] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [card, setCard] = useState<(AskCard & { key: number }) | null>(null);
  const opened = useRef(false);
  const cards = useRef(0);
  const focusLater = useFocusAfterRender();

  // Until she types, the field shows the draft this device kept (read only
  // once hydrated, so the server render and hydration agree).
  const current = draft ?? (hydrated ? askDraft.read() : EMPTY_DRAFT);
  const ordered = orderAsks(items);

  useEffect(() => {
    // The ref keeps a StrictMode double effect from counting the visit twice.
    if (opened.current) return;
    opened.current = true;
    track({ name: "gdm_asklist_opened" });
    // Arrived through the nav's Add a question: the field, not the page top.
    if (parkedFrom(window.location.hash) === "quick_add") document.getElementById(ASK_FIELD_ID)?.focus();
  }, []);

  function edit(field: keyof AskDraft, text: string) {
    const next = { ...current, [field]: text };
    setDraft(next);
    askDraft.write(next);
  }

  async function park(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (adding) return;
    const text = current.text.trim();
    if (!text) {
      // Only spaces (`required` lets those through): nothing to park, and
      // nothing is sent. The field is enabled, so focus can move at once.
      document.getElementById(ASK_FIELD_ID)?.focus();
      return;
    }
    const body: AskBody = { text, note: current.note.trim() || null, asked: false, answer: null };
    setAdding(true);
    setFailure(null);
    setStatus(STATUS.saving);
    const result = await gdmFetch<{ id: string }>(ITEMS_PATH, { method: "POST", body: { kind: "ask", body } });

    const raised = cardFrom(result.ok ? result.data : result.payload);
    if (raised) {
      cards.current += 1;
      setCard({ ...raised, key: cards.current });
      track({ name: "clinical_route", props: { route: raised.route } });
    } else {
      setCard(null);
    }

    if (result.ok) {
      const from = parkedFrom(window.location.hash);
      track({ name: "gdm_ask_parked", props: { from } });
      prepend(result.data.id, body);
      setDraft(EMPTY_DRAFT);
      askDraft.clear();
      setStatus(STATUS.saved);
    } else {
      // The draft stays in the field and on the device.
      setFailure(parkFailure(result.status));
      setStatus(null);
    }
    // G-46 over G-39: when a card came back, its heading takes focus; otherwise
    // focus returns to the field, ready for the next question.
    focusLater(raised ? CARD_TITLE_ID : ASK_FIELD_ID);
    setAdding(false);
  }

  // G-39: where focus goes is worked out from the list as rendered, before the question leaves it.
  const remove = (id: string) => removeItem(id, focusAfterRemove(ordered.map((item) => item.id), id));

  return (
    <>
      <div className="gdm-ask-head">
        <h1 className="gdm-title">{CONTROLS.title}</h1>
        <p className="gdm-lead">{LEAD}</p>
      </div>

      <form id={ADD_ID} className="surface-card form-card gdm-ask-form" onSubmit={park}>
        <div className="field-stack">
          <label className="field-label" htmlFor={ASK_FIELD_ID}>
            {CONTROLS.field}
          </label>
          <textarea
            id={ASK_FIELD_ID}
            className="text-input"
            required
            maxLength={ASK_MAX_LENGTH.text}
            value={current.text}
            onChange={(event) => edit("text", event.target.value)}
          />
        </div>
        <div className="field-stack">
          <label className="field-label" htmlFor={NOTE_FIELD_ID}>
            {CONTROLS.note}
          </label>
          <textarea
            id={NOTE_FIELD_ID}
            className="text-input gdm-ask-note-input"
            maxLength={ASK_MAX_LENGTH.note}
            value={current.note}
            onChange={(event) => edit("note", event.target.value)}
          />
        </div>
        <button type="submit" className="primary-button" disabled={adding}>
          {CONTROLS.add}
        </button>
        {failure ? (
          <p className="field-error" role="alert">
            {failure}
          </p>
        ) : null}
        {/* G-36: the page's one polite live region, for the form and every row. */}
        <p className="field-hint gdm-status" aria-live="polite">
          {loading ? STATUS.loading : status}
        </p>
      </form>

      {/* G-46: next to what she just typed, above the list; an alert, and its
          heading takes focus. The first door's clinical card, not a
          second one: `.result-card[data-kind="clinical"]`, no risk colour. */}
      {card ? (
        <section
          key={card.key}
          role="alert"
          className="result-card"
          data-kind={CLINICAL_KIND}
          data-route={card.route}
          aria-labelledby={CARD_TITLE_ID}
        >
          <h2 id={CARD_TITLE_ID} className="status-title" tabIndex={-1}>
            {CONTROLS.cardTitle}
          </h2>
          <p className="result-copy">{card.routeCopy}</p>
        </section>
      ) : null}

      <div className="gdm-ask-list" aria-busy={loading}>
        {loadFailed ? (
          <GdmLoadFailed onRetry={retry} />
        ) : ordered.length > 0 ? (
          <ul className="gdm-asks" role="list">
            {ordered.map((item) => (
              <AskRow key={item.id} item={item} onSave={save} onRemove={remove} />
            ))}
          </ul>
        ) : loading ? null : (
          <p className="gdm-ask-empty">{CONTROLS.empty}</p>
        )}
      </div>
    </>
  );
}

/**
 * One parked question: her words, her note, then Asked, what they said (shown
 * while Asked is ticked, kept when it is not), Save and Delete. Her text is
 * never edited here (R48), so a save never needs the clinical router again.
 * Delete takes two presses (G-76).
 */
function AskRow({
  item,
  onSave,
  onRemove
}: {
  item: AskItem;
  onSave: (id: string, body: AskBody) => Promise<boolean>;
  onRemove: (id: string) => Promise<boolean>;
}) {
  const { id, body } = item;
  const [asked, setAsked] = useState(body.asked);
  const [answer, setAnswer] = useState(body.answer ?? "");
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const focusLater = useFocusAfterRender();
  const textId = askControlId(id, "text");
  const answerId = askControlId(id, "answer");

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || removing) return;
    setSaving(true);
    setFailure(null);
    const saved = await onSave(id, savedAskBody(body, asked, answer));
    if (!saved) setFailure(SAVE_FAILED);
    // Save was disabled in flight, and saving an asked question moves the row
    // below the open ones: focus goes back to Save, wherever it now sits.
    focusLater(askControlId(id, "save"));
    setSaving(false);
  }

  function confirm() {
    setFailure(null);
    setConfirming(true);
    focusLater(askControlId(id, "cancel"));
  }

  function cancel() {
    setConfirming(false);
    focusLater(askControlId(id, "remove"));
  }

  async function remove() {
    if (removing) return;
    setRemoving(true);
    setFailure(null);
    const removed = await onRemove(id);
    if (removed) return; // the row is gone; the list moves focus on
    setFailure(SAVE_FAILED);
    focusLater(askControlId(id, "cancel"));
    setRemoving(false);
  }

  return (
    <li className="surface-card gdm-ask">
      <p id={textId} className="gdm-ask-text">
        {body.text}
      </p>
      {body.note ? <p className="gdm-ask-note">{body.note}</p> : null}
      <form className="gdm-ask-edit" onSubmit={save}>
        <div className="gdm-ask-check">
          <input
            id={askControlId(id, "asked")}
            type="checkbox"
            checked={asked}
            onChange={(event) => setAsked(event.target.checked)}
            aria-describedby={textId}
          />
          <label htmlFor={askControlId(id, "asked")}>{CONTROLS.asked}</label>
        </div>
        {asked ? (
          <div className="field-stack">
            <label className="field-label" htmlFor={answerId}>
              {CONTROLS.answer}
            </label>
            <textarea
              id={answerId}
              className="text-input"
              maxLength={ASK_MAX_LENGTH.answer}
              value={answer}
              onChange={(event) => setAnswer(event.target.value)}
              aria-describedby={textId}
            />
          </div>
        ) : null}
        <div className="gdm-actions">
          <button
            id={askControlId(id, "save")}
            type="submit"
            className="secondary-button"
            disabled={saving || removing}
            aria-describedby={textId}
          >
            {CONTROLS.save}
          </button>
          {confirming ? (
            <>
              <button
                id={askControlId(id, "remove")}
                type="button"
                className="danger-button"
                disabled={removing}
                onClick={() => void remove()}
                aria-describedby={textId}
              >
                {CONTROLS.remove}
              </button>
              <button
                id={askControlId(id, "cancel")}
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
              id={askControlId(id, "remove")}
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
      </form>
    </li>
  );
}
