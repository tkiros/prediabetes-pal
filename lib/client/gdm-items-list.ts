"use client";

import { useEffect, useState } from "react";

import { GDM_COPY } from "../pal/gdm/copy";
import type { GdmItemKind } from "../pal/gdm/items";
import { gdmFetch } from "./gdm-api";
import { useFocusAfterRender } from "./gdm-focus";

const STATUS = GDM_COPY["gdm-status"];
const ITEMS_PATH = "/api/gdm/items";

/** One of her entries as the items API lists it: the row id and dates beside her body, never inside it. */
export type GdmListItem<T> = { id: string; createdAt: string; updatedAt: string; body: T };

/** G-14: "try again in a moment" is untrue for a full list (409); everything else is the save-failed line. */
export function gdmSaveFailure(status: number): string {
  return status === 409 ? GDM_COPY["gdm-list-full"].line : GDM_COPY["gdm-save-failed"].line;
}

/**
 * The list state My questions and My meals share: her entries of one kind
 * from /api/gdm/items, loaded after the first commit (the add form is usable
 * at once), and the page's one polite status line (G-36). Adding stays with
 * each page, since what a save does around the POST differs; `prepend` puts a
 * saved entry at the top, where the server's newest-first order will have it.
 */
export function useGdmItems<T>(kind: GdmItemKind) {
  const [items, setItems] = useState<Array<GdmListItem<T>>>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0); // a retry after a failed load is the next attempt
  const focusLater = useFocusAfterRender();

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const result = await gdmFetch<{ items: Array<GdmListItem<T>> }>(`${ITEMS_PATH}?kind=${kind}`);
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
  }, [kind, attempt]);

  function prepend(id: string, body: T) {
    const now = new Date().toISOString();
    setItems((shown) => [{ id, createdAt: now, updatedAt: now, body }, ...shown]);
  }

  /** PATCH one entry's whole body; "Saved." on success, the status cleared on failure. */
  async function save(id: string, body: T): Promise<boolean> {
    setStatus(STATUS.saving);
    const result = await gdmFetch(ITEMS_PATH, { method: "PATCH", body: { id, body } });
    if (!result.ok) {
      setStatus(null);
      return false;
    }
    const now = new Date().toISOString();
    setItems((shown) => shown.map((item) => (item.id === id ? { ...item, updatedAt: now, body } : item)));
    setStatus(STATUS.saved);
    return true;
  }

  /**
   * DELETE one entry. A 404 is an entry already gone (another tab): the list
   * catches up. `focusId` (G-39, from `focusIdAfterRemove`) is worked out by
   * the page from the list as rendered, before the entry leaves it.
   */
  async function remove(id: string, focusId: string): Promise<boolean> {
    setStatus(null);
    const result = await gdmFetch(`${ITEMS_PATH}?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (!result.ok && result.status !== 404) return false;
    focusLater(focusId);
    setItems((shown) => shown.filter((item) => item.id !== id));
    setStatus(STATUS.removed);
    return true;
  }

  function retry() {
    setLoading(true);
    setLoadFailed(false);
    setAttempt((count) => count + 1);
  }

  return { items, loading, loadFailed, status, setStatus, prepend, save, remove, retry };
}
