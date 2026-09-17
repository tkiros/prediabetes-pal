"use client";

import { useEffect, useRef, useState } from "react";

import { orientationNote } from "../lib/client/orientation-store";
import { useHydrated } from "../lib/client/use-hydrated";
import { ORIENTATION_STEPS } from "../lib/coach/orientation";

/**
 * Orientation step 5's note (PRD v1.1 §6 F-ORIENT "Free text"). It lives in
 * this browser only: this file never calls out and never imports anything
 * that does (tests/unit/pal/orientation-egress-guard.test.ts). The note's
 * text goes to exactly one place — the textarea's value — and is never put
 * inside a sentence the app wrote.
 *
 * Review A-57: the hint is honest about storage. A probe write decides it;
 * a refused save shows the same status line.
 */
const KEPT_HINT = "Your notes stay on this device. Nothing here is sent anywhere.";
const REFUSED_HINT = "This browser isn't letting the page keep notes — copy your questions somewhere safe.";

type NoteSetters = {
  setDraft: (text: string) => void;
  setFailed: (failed: boolean) => void;
  setSaved: (saved: boolean) => void;
};

/** The "Saved on this device" timer handle, one per component instance. */
export type SavedTimerRef = { current: ReturnType<typeof setTimeout> | undefined };

/** Keeps the note on the device; "Saved on this device" for two seconds. True once kept. */
export function keepNote(text: string, ui: NoteSetters, timer: SavedTimerRef): boolean {
  ui.setDraft(text);
  const kept = orientationNote.set(text);
  ui.setFailed(!kept);
  ui.setSaved(kept);
  clearTimeout(timer.current);
  if (kept) timer.current = setTimeout(() => ui.setSaved(false), 2000);
  return kept;
}

/**
 * Review A-84: step 5 completes on this mount's first kept save with text in
 * it — once, never on every keystroke. An all-space save clears the key, so
 * it does not count.
 */
export function firstKeptSave(text: string, kept: boolean, fired: { current: boolean }): boolean {
  if (fired.current || !kept || text.trim() === "") return false;
  fired.current = true;
  return true;
}

/**
 * `onSaved` runs once, after that first kept save. It carries no text, and it
 * is the caller's: this file still never calls out.
 */
export function OrientationNote({ onSaved }: { onSaved?: () => void }) {
  const hydrated = useHydrated();
  const [draft, setDraft] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [saved, setSaved] = useState(false);
  // #24: one timer per instance, cleared on unmount so a late "Saved on this
  // device" reset never lands after the field is gone.
  const savedTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(savedTimer.current), []);
  const savedOnce = useRef(false);
  // Read and probe only once hydrated, like every other device read (A-20).
  // ponytail: the probe re-runs each render (a set + remove of one key); cheap,
  // and it notices storage that stops working mid-visit.
  const storageWorks = hydrated ? orientationNote.writable() : null;
  const value = draft ?? (hydrated ? orientationNote.get() : "");
  // #25: one status node mounted from the first render, role="status" present
  // the whole time — only its text changes — so a screen reader announces a
  // failed save instead of missing a role and text that would otherwise
  // arrive together. Rendering it unconditionally (rather than from a
  // useEffect) also means aria-describedby="note-hint" below never points at
  // an element that is not yet in the markup.
  const hint = storageWorks === null ? "" : storageWorks && !failed ? KEPT_HINT : REFUSED_HINT;

  return (
    <section className="surface-card hero-card field-stack">
      <label className="field-label" htmlFor="note">
        {ORIENTATION_STEPS[4].text}
      </label>
      <textarea
        id="note"
        aria-describedby="note-hint"
        className="text-input"
        onChange={(event) => {
          const text = event.target.value;
          const kept = keepNote(text, { setDraft, setFailed, setSaved }, savedTimer);
          if (firstKeptSave(text, kept, savedOnce)) onSaved?.();
        }}
        value={value}
      />
      <p className="field-hint" id="note-hint" role="status">
        {hint}
      </p>
      <p className="field-hint" aria-live="polite">
        {saved ? "Saved on this device" : ""}
      </p>
    </section>
  );
}
