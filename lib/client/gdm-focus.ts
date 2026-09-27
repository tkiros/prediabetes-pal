"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * Focus moves on purpose after an action (G-39, G-46, G-76), never by a
 * setState inside an effect: a handler names the element's id, and the effect
 * after the next commit focuses it, once the element exists and is enabled.
 * Shared by the door's lists (My questions, My plan).
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
