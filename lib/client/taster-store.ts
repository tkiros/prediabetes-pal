const STORAGE_KEY = "pal.taster.v1";
export const TASTER_LIMIT = 10;

export type TasterState = { firstDay: string; used: number };

// Day 1 = the user's LOCAL calendar day of first use.
function dayLocal(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function read(): TasterState | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TasterState;
    return typeof parsed.firstDay === "string" && typeof parsed.used === "number"
      ? parsed
      : null;
  } catch {
    return null;
  }
}

function write(state: TasterState): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // storage unavailable: taster silently un-metered client-side; the
    // server IP rate limit remains the backstop.
  }
}

// ponytail: device-local taster — clear storage = reset. Accepted for a
// taster (model spend bounded by the middleware IP limit); upgrade path is
// a server-side first-seen cookie/fingerprint if abuse shows in the data.
export const tasterStore = {
  get: read,
  clear(): void {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  },
  // Free checks left on the Day-1 allowance: full limit before first use,
  // zero once spent or aged out. Drives the visible "N free checks left"
  // counter so the wall is never a surprise.
  remaining(now: Date = new Date()): number {
    const state = read();
    if (!state) return TASTER_LIMIT;
    if (state.firstDay !== dayLocal(now)) return 0;
    return Math.max(0, TASTER_LIMIT - state.used);
  },
  status(now: Date = new Date()): "available" | "exhausted" | "expired" {
    const state = read();
    if (!state) return "available";
    if (state.firstDay !== dayLocal(now)) return "expired";
    return state.used >= TASTER_LIMIT ? "exhausted" : "available";
  },
  recordCheck(now: Date = new Date()): number {
    const state = read() ?? { firstDay: dayLocal(now), used: 0 };
    const next = { ...state, used: state.used + 1 };
    write(next);
    return next.used;
  }
};
