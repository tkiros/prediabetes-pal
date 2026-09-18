/**
 * R-2: the quick row's "Ideas" item is Task 4.4's See-all trigger, reached
 * from outside components/guide-ideas.tsx. One window CustomEvent, defined
 * here only — no lifted state, no store, no prop drilling. Home's Ideas link
 * stays a native `#ideas-title` anchor (the scroll is the browser's, not
 * ours); this event only tells <GuideIdeas> to expand.
 */
export const IDEAS_EXPAND_EVENT = "pal:ideas-expand";

export function dispatchIdeasExpand(): void {
  window.dispatchEvent(new CustomEvent(IDEAS_EXPAND_EVENT));
}

/** Registers `onExpand` for the event and returns the matching cleanup —
 *  an effect body can `return listenForIdeasExpand(...)` directly. */
export function listenForIdeasExpand(onExpand: () => void): () => void {
  function handle() {
    onExpand();
  }
  window.addEventListener(IDEAS_EXPAND_EVENT, handle);
  return () => window.removeEventListener(IDEAS_EXPAND_EVENT, handle);
}
