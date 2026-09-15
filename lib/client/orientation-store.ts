// lib/client/orientation-store.ts
import {
  EMPTY_ORIENTATION,
  OrientationStateSchema,
  type OrientationState,
  type OrientationStepId
} from "../coach/orientation";

/**
 * Guest orientation state (PRD v1.1 §7.4: "one on-device key for guests, next
 * to pal.profile.v1 and pal.segment.v1"). Signed-in users keep the same shape
 * in profiles.orientation (app/api/profile PATCH). Every read validates
 * against the strict schema and falls back to the empty state.
 */
const STATE_KEY = "pal.orient.v1";
// The "write down your questions" note (F-ORIENT "Free text"): device only,
// never sent to the server or the model, never echoed inside app copy.
const NOTE_KEY = "pal.orient.note.v1";

function read(): OrientationState {
  try {
    const raw = window.localStorage.getItem(STATE_KEY);
    if (!raw) return EMPTY_ORIENTATION;
    const parsed = OrientationStateSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : EMPTY_ORIENTATION;
  } catch {
    return EMPTY_ORIENTATION;
  }
}

function write(state: OrientationState): void {
  try {
    window.localStorage.setItem(STATE_KEY, JSON.stringify(state));
  } catch {
    // storage unavailable: the step line still renders from the empty state
  }
}

export const orientationStore = {
  get: read,
  set: write,
  markDone(id: OrientationStepId): void {
    const state = read();
    if (!state.done.includes(id)) write({ ...state, done: [...state.done, id] });
  },
  dismiss(now: Date = new Date()): void {
    write({ ...read(), dismissedAt: now.toISOString() });
  },
  /** Review A-05: stamps the week's start once; later calls are no-ops. */
  start(now: Date = new Date()): void {
    const state = read();
    if (!state.startedAt) write({ ...state, startedAt: now.toISOString() });
  }
};

export const orientationNote = {
  get(): string {
    try {
      return window.localStorage.getItem(NOTE_KEY) ?? "";
    } catch {
      return "";
    }
  },
  set(text: string): void {
    try {
      if (text.trim() === "") window.localStorage.removeItem(NOTE_KEY);
      else window.localStorage.setItem(NOTE_KEY, text);
    } catch {
      // ignore
    }
  }
};
