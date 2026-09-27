"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * Focus moves on purpose after an action (G-39, G-46, G-76), never by a
 * setState inside an effect: a handler names the element's id, and the effect
 * after the next commit focuses it, once the element exists and is enabled.
 * Shared by the door's lists (My questions, My plan, My meals).
 */
export function useFocusAfterRender(): (id: string) => void {
  const pending = useRef<string | null>(null);
  useEffect(() => {
    const id = pending.current;
    if (!id) return;
    pending.current = null;
    document.getElementById(id)?.focus();
  });
  return useCallback((id: string) => {
    pending.current = id;
  }, []);
}

/**
 * G-39: where focus goes after an entry is deleted — the next entry's first
 * control, or, for the last one, the entry above it, or `fallback` (the add
 * field) once the list is empty. Never `<body>`. `orderedIds` is the list as
 * rendered; `controlFor` names an entry's first control.
 */
export function focusIdAfterRemove(
  orderedIds: readonly string[],
  removedId: string,
  controlFor: (id: string) => string,
  fallback: string
): string {
  const index = orderedIds.indexOf(removedId);
  const neighbour = orderedIds[index + 1] ?? orderedIds[index - 1];
  return neighbour && neighbour !== removedId ? controlFor(neighbour) : fallback;
}
