"use client";

import { useState } from "react";

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

// ponytail: one timer for the module — the page carries one note.
let savedTimer: ReturnType<typeof setTimeout> | undefined;

/** Keeps the note on the device; "Saved on this device" for two seconds. */
export function keepNote(text: string, ui: NoteSetters): void {
  ui.setDraft(text);
  const kept = orientationNote.set(text);
  ui.setFailed(!kept);
  ui.setSaved(kept);
  clearTimeout(savedTimer);
  if (kept) savedTimer = setTimeout(() => ui.setSaved(false), 2000);
}

export function OrientationNote() {
  const hydrated = useHydrated();
  const [draft, setDraft] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [saved, setSaved] = useState(false);
  // Read and probe only once hydrated, like every other device read (A-20).
  // ponytail: the probe re-runs each render (a set + remove of one key); cheap,
  // and it notices storage that stops working mid-visit.
  const storageWorks = hydrated ? orientationNote.writable() : null;
  const value = draft ?? (hydrated ? orientationNote.get() : "");

  return (
    <section className="surface-card hero-card field-stack">
      <label className="field-label" htmlFor="note">
        {ORIENTATION_STEPS[4].text}
      </label>
      <textarea
        id="note"
        aria-describedby="note-hint"
        className="text-input"
        onChange={(event) => keepNote(event.target.value, { setDraft, setFailed, setSaved })}
        value={value}
      />
      {storageWorks === null ? null : storageWorks && !failed ? (
        <p className="field-hint" id="note-hint">
          {KEPT_HINT}
        </p>
      ) : (
        <p className="field-hint" id="note-hint" role="status">
          {REFUSED_HINT}
        </p>
      )}
      <p className="field-hint" aria-live="polite">
        {saved ? "Saved on this device" : ""}
      </p>
    </section>
  );
}
