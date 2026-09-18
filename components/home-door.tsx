"use client";

import {
  cloneElement,
  isValidElement,
  useLayoutEffect,
  useRef,
  useSyncExternalStore,
  type ReactElement,
  type ReactNode
} from "react";

import { askStore } from "../lib/client/ask-store";
import { doorFor, type Door } from "../lib/client/home-door";
import { BOUNDARY_DISCLAIMER } from "../lib/pal/boundary-copy";

/**
 * The worried door's clinician pointer: the `result-footer` disclaimer's
 * second sentence, derived — never retyped — so the approved wording cannot
 * drift (ledger row `home-door-worried-line` points at `result-footer`).
 */
export const CLINICIAN_LINE = BOUNDARY_DISCLAIMER.slice(BOUNDARY_DISCLAIMER.indexOf(". ") + 2);

export type SlotKey = "line" | "ideas" | "hero" | "quickRow" | "step";
/**
 * `door` is the door actually applied, after the fallbacks below — what
 * `data-door` carries, so CSS scoped to a door (the owner's one-row rule
 * below 375px) never reaches a pick that fell back to the default layout.
 */
export type DoorLayout = { door: Door; order: readonly SlotKey[]; count: 2 | 3; heading?: string };

const DEFAULT_LAYOUT: DoorLayout = { door: "ideas", order: ["ideas", "hero", "quickRow", "step"], count: 3 };

/** Step 4's href ("Try one of today's ideas") — and the quick row's Ideas item. */
const IDEAS_ANCHOR = "#ideas-title";

/**
 * The four door orders (plan Task 5.3, review A-62) as amended by rulings
 * R-19, R-20 and R-22. Two idea rows only while an extra line sits ABOVE the
 * ideas (A-93: the removed row pays for the added line's fold cost).
 *
 * `stepHref` is the href of the day's orientation step, or null when there is
 * none (week over, dismissed, or the carve-out).
 *
 * - `numbers` / `plan`: the day's step leads. With no step (R-20), or a step
 *   that IS the ideas block (R-22: "Try one of today's ideas" above a block
 *   titled "Ideas for later", linking to it, contradicts itself), the whole
 *   default layout applies — the ideas lead.
 * - `worried`: the clinician line leads on days 1–3 of the week; after day 3,
 *   or with no week at all (R-19), it drops below the step line (A-88).
 */
export function doorLayout(
  door: Door,
  orientationDay: number | null,
  stepHref: string | null
): DoorLayout {
  const stepLeads = stepHref !== null && !stepHref.endsWith(IDEAS_ANCHOR);
  switch (door) {
    case "numbers":
      return stepLeads
        ? {
            door,
            order: ["step", "ideas", "hero", "quickRow"],
            count: 2,
            heading: "Ideas for later"
          }
        : DEFAULT_LAYOUT;
    case "plan":
      return stepLeads ? { door, order: ["step", "ideas", "hero", "quickRow"], count: 2 } : DEFAULT_LAYOUT;
    case "worried":
      return orientationDay !== null && orientationDay <= 3
        ? { door, order: ["line", "ideas", "hero", "quickRow", "step"], count: 2 }
        : { door, order: ["ideas", "hero", "quickRow", "step", "line"], count: 3 };
    default:
      return DEFAULT_LAYOUT;
  }
}

export function sameLayout(a: DoorLayout, b: DoorLayout): boolean {
  return (
    a.door === b.door &&
    a.count === b.count &&
    a.heading === b.heading &&
    a.order.join() === b.order.join()
  );
}

/**
 * Ruling R-21: the focus guard covers EVERY layout change, not only the
 * first. While focus is inside the region, the layout on screen stays —
 * stale but safe — and the wanted one lands on a later render with focus
 * outside. Focus is never moved.
 */
export function guardLayout(
  wanted: DoorLayout,
  committed: DoorLayout,
  focusInside: boolean
): DoorLayout {
  return focusInside && !sameLayout(wanted, committed) ? committed : wanted;
}

const subscribe = () => () => {};

/**
 * Home's per-person door (PRD v1.1 §7.5). Reorder contract (A-55, A-108):
 *
 * - Every slot is keyed and a direct child of this one region; a reorder moves
 *   nodes, it never remounts them. A remount of GuideIdeas would re-run its
 *   mount effect — a second rotation step and a second `ideas_shown`.
 * - The server and the hydration render both get the default layout (the
 *   server snapshot below), so there is no hydration mismatch.
 * - The layout is a useSyncExternalStore snapshot. The pick is read from
 *   `pal.ask.v1` once and frozen; the layout follows the live props through
 *   `guardLayout`, measured against `committed` — what the DOM shows. React
 *   calls the client snapshot in two places: in its post-commit consistency
 *   check (a passive effect — this is how a hydrated page gets its door, with
 *   the region's ref attached), and during render on every client render
 *   after that, and on a mount with no hydration (a soft navigation). During
 *   a mount render the ref is still null, so nothing can be focused inside a
 *   region that is not on the page yet — the guard correctly reads "outside".
 *   Doing it in the snapshot keeps the ref and `document` reads out of the
 *   component body (react-hooks/refs, react-hooks/purity) and needs no
 *   setState in an effect (react-hooks/set-state-in-effect). No transition.
 *
 * `display: contents` (globals.css `.home-door`) keeps the region out of
 * layout, so the slots lay out exactly as direct children of the dashboard.
 */
export function HomeDoor({
  ideas,
  hero,
  quickRow,
  step,
  orientationDay,
  stepHref
}: {
  ideas: ReactElement<{ count?: number; heading?: string }> | null;
  hero: ReactElement;
  quickRow: ReactNode;
  step: ReactNode;
  orientationDay: number | null;
  /** The day's orientation step href, or null when no orientation step shows. */
  stepHref: string | null;
}) {
  const regionRef = useRef<HTMLDivElement>(null);
  const pick = useRef<Door | null>(null);
  const committed = useRef<DoorLayout>(DEFAULT_LAYOUT);
  const snapshot = useRef<DoorLayout>(DEFAULT_LAYOUT);
  const layout = useSyncExternalStore(
    subscribe,
    () => {
      pick.current ??= doorFor(askStore.get());
      const next = guardLayout(
        doorLayout(pick.current, orientationDay, stepHref),
        committed.current,
        regionRef.current?.contains(document.activeElement) ?? false
      );
      // useSyncExternalStore needs a stable snapshot: same layout, same object.
      if (!sameLayout(next, snapshot.current)) snapshot.current = next;
      return snapshot.current;
    },
    () => DEFAULT_LAYOUT
  );
  // What the DOM shows now. A layout effect, so it is current before the
  // store's post-commit re-check (a passive effect) calls the snapshot.
  useLayoutEffect(() => {
    committed.current = layout;
  });
  const { order, count, heading } = layout;

  const slots: Record<SlotKey, ReactNode> = {
    // Only rendered when the layout's order names it.
    line: (
      <p key="line" className="result-disclaimer home-door-line" data-testid="home-door-line">
        {CLINICIAN_LINE}
      </p>
    ),
    // Always cloned, always keyed "ideas" — the element's identity is the
    // same on every render, whatever the door.
    ideas: isValidElement(ideas) ? cloneElement(ideas, { key: "ideas", count, heading }) : null,
    hero: cloneElement(hero, { key: "hero" }),
    quickRow: isValidElement(quickRow) ? cloneElement(quickRow, { key: "quickRow" }) : null,
    step: isValidElement(step) ? cloneElement(step, { key: "step" }) : null
  };

  return (
    <div ref={regionRef} className="home-door" data-door={layout.door}>
      {order.map((key) => slots[key])}
    </div>
  );
}
