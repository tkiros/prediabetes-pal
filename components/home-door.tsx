"use client";

import {
  cloneElement,
  isValidElement,
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
export type DoorLayout = { order: readonly SlotKey[]; count: 2 | 3; heading?: string };

const DEFAULT_LAYOUT: DoorLayout = { order: ["ideas", "hero", "quickRow", "step"], count: 3 };

/**
 * The four door orders (plan Task 5.3, review A-62) as amended by rulings
 * R-19 and R-20. Two idea rows only while an extra line sits ABOVE the ideas
 * (A-93: the removed row pays for the added line's fold cost).
 *
 * - `numbers` / `plan`: the day's orientation step leads; with no step (week
 *   over, dismissed, or the carve-out) the whole default layout applies —
 *   "Ideas for later" only makes sense while something else leads.
 * - `worried`: the clinician line leads on days 1–3 of the week; after day 3,
 *   or with no week at all (R-19), it drops below the step line (A-88).
 */
export function doorLayout(
  door: Door,
  orientationDay: number | null,
  hasStep: boolean
): DoorLayout {
  switch (door) {
    case "numbers":
      return hasStep
        ? { order: ["step", "ideas", "hero", "quickRow"], count: 2, heading: "Ideas for later" }
        : DEFAULT_LAYOUT;
    case "plan":
      return hasStep ? { order: ["step", "ideas", "hero", "quickRow"], count: 2 } : DEFAULT_LAYOUT;
    case "worried":
      return orientationDay !== null && orientationDay <= 3
        ? { order: ["line", "ideas", "hero", "quickRow", "step"], count: 2 }
        : { order: ["ideas", "hero", "quickRow", "step", "line"], count: 3 };
    default:
      return DEFAULT_LAYOUT;
  }
}

const subscribe = () => () => {};

/**
 * Home's per-person door (PRD v1.1 §7.5). Reorder contract (A-55, A-108):
 *
 * - Every slot is keyed and a direct child of this one region; a reorder moves
 *   nodes, it never remounts them. A remount of GuideIdeas would re-run its
 *   mount effect — a second rotation step and a second `ideas_shown`.
 * - The server and the hydration render both get the default door (the
 *   server snapshot below), so there is no hydration mismatch.
 * - The door is decided once, after hydration, and frozen: React reads the
 *   client snapshot only after the hydration commit — the same mechanism as
 *   useHydrated(), done here so the focus check can read the attached region
 *   without a ref read in render. Focus inside the region at that moment ⇒ the
 *   default door for this visit; focus is never moved. No transition.
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
  hasStep
}: {
  ideas: ReactElement<{ count?: number; heading?: string }> | null;
  hero: ReactElement;
  quickRow: ReactNode;
  step: ReactNode;
  orientationDay: number | null;
  hasStep: boolean;
}) {
  const regionRef = useRef<HTMLDivElement>(null);
  const frozen = useRef<Door | null>(null);
  const door = useSyncExternalStore(
    subscribe,
    () =>
      (frozen.current ??= regionRef.current?.contains(document.activeElement)
        ? "ideas"
        : doorFor(askStore.get())),
    () => "ideas" as Door
  );
  const { order, count, heading } = doorLayout(door, orientationDay, hasStep);

  const slots: Record<SlotKey, ReactNode> = {
    line:
      door === "worried" ? (
        <p key="line" className="result-disclaimer home-door-line" data-testid="home-door-line">
          {CLINICIAN_LINE}
        </p>
      ) : null,
    // Always cloned, always keyed "ideas" — the element's identity is the
    // same on every render, whatever the door.
    ideas: isValidElement(ideas) ? cloneElement(ideas, { key: "ideas", count, heading }) : null,
    hero: cloneElement(hero, { key: "hero" }),
    quickRow: isValidElement(quickRow) ? cloneElement(quickRow, { key: "quickRow" }) : null,
    step: isValidElement(step) ? cloneElement(step, { key: "step" }) : null
  };

  return (
    <div ref={regionRef} className="home-door" data-door={door}>
      {order.map((key) => slots[key])}
    </div>
  );
}
