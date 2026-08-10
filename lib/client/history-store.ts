import { computeStreak, dayKeyLocal } from "../coach/days";
import type { PalRisk } from "./ui-state";

/**
 * On-device meal memory (plan P3). localStorage now; after 4B the same
 * interface is backed by the server for signed-in users — this module is the
 * seam. Guests keep working from this store unchanged.
 * ponytail: localStorage now, server is the durable copy after 4B; the
 * interface is the seam.
 */

export type InputMethod = "text" | "voice" | "photo";

export type StoredCheck = {
  clientId: string;
  food: string;
  risk: PalRisk;
  a1cBand: string;
  inputMethod: InputMethod;
  createdAt: string; // ISO
  actionDoneAt?: string;
};

/**
 * Single source of truth for coercing a stored `inputMethod` (untyped text in
 * the DB, or a JSON string over the wire) onto the real union. Every read path
 * that maps a DB/server row into a StoredCheck MUST go through this — three
 * separate sites once each hand-rolled `=== "voice" ? "voice" : "text"`, which
 * silently downgraded `photo` to `text` on every read (plan §4.6 fidelity).
 */
export function normalizeInputMethod(
  value: string | null | undefined
): InputMethod {
  return value === "voice" || value === "photo" ? value : "text";
}

type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

const STORAGE_KEY = "pal.history.v1";
// ponytail: hard cap keeps localStorage bounded; server history (4B) is the
// long-term memory.
const MAX_STORED_CHECKS = 500;

const localDayKey = dayKeyLocal;

export function createHistoryStore(storage: StorageLike | null) {
  function read(): StoredCheck[] {
    if (!storage) {
      return [];
    }

    try {
      const raw = storage.getItem(STORAGE_KEY);
      if (!raw) {
        return [];
      }

      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed.filter(
        (entry): entry is StoredCheck =>
          !!entry &&
          typeof entry === "object" &&
          typeof (entry as StoredCheck).clientId === "string" &&
          typeof (entry as StoredCheck).food === "string" &&
          typeof (entry as StoredCheck).createdAt === "string"
      );
    } catch {
      return [];
    }
  }

  function write(checks: StoredCheck[]): void {
    if (!storage) {
      return;
    }

    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(checks));
    } catch {
      // Quota or private-mode failure: history is a convenience, never fatal.
    }
  }

  function sortedNewestFirst(checks: StoredCheck[]): StoredCheck[] {
    return [...checks].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  return {
    add(check: StoredCheck): void {
      const next = sortedNewestFirst([...read(), check]);
      write(next.slice(0, MAX_STORED_CHECKS));
    },

    all(): StoredCheck[] {
      return sortedNewestFirst(read());
    },

    today(now: Date = new Date()): StoredCheck[] {
      const todayKey = localDayKey(now);
      return this.all().filter(
        (check) => localDayKey(new Date(check.createdAt)) === todayKey
      );
    },

    recent(days: number, now: Date = new Date()): StoredCheck[] {
      const cutoff = new Date(now);
      cutoff.setDate(cutoff.getDate() - (days - 1));
      cutoff.setHours(0, 0, 0, 0);
      return this.all().filter(
        (check) => new Date(check.createdAt).getTime() >= cutoff.getTime()
      );
    },

    streak(now: Date = new Date()): number {
      return computeStreak(
        read().map((check) => check.createdAt),
        localDayKey,
        now
      );
    },

    markActionDone(clientId: string, now: Date = new Date()): void {
      write(
        read().map((check) =>
          check.clientId === clientId
            ? { ...check, actionDoneAt: now.toISOString() }
            : check
        )
      );
    },

    /**
     * Drop a check from the on-device store by its clientId (deletion is real,
     * plan §16). Called after a server delete succeeds so the daily-loop
     * `syncLocalHistory` — which re-migrates every local row on the next visit —
     * can never resurrect a row the user just deleted (privacy finding E1).
     * Mirrors `markActionDone`: read → filter → write, no-op when absent.
     */
    remove(clientId: string): void {
      write(read().filter((check) => check.clientId !== clientId));
    },

    clear(): void {
      storage?.removeItem(STORAGE_KEY);
    }
  };
}

function safeLocalStorage(): StorageLike | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

export const historyStore = createHistoryStore(safeLocalStorage());
