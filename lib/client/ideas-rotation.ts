const STORAGE_KEY = "pal.ideas.rotation";

/**
 * Monotonic per-device counter that cycles the idea bank (PRD v1.1 §6
 * F-IDEAS: "no two consecutive loads show the same first idea"). Same shape
 * and reasoning as lib/client/coach-rotation.ts: deterministic, testable,
 * continuous. Storage failures return 0 (first three ideas) rather than
 * breaking the block.
 */
export function nextIdeasRotation(): number {
  if (typeof window === "undefined") {
    return 0;
  }
  try {
    const current = Number.parseInt(
      window.localStorage.getItem(STORAGE_KEY) ?? "0",
      10
    );
    const next = (Number.isFinite(current) ? current + 1 : 1) % 1_000_000;
    window.localStorage.setItem(STORAGE_KEY, String(next));
    return next;
  } catch {
    return 0;
  }
}
