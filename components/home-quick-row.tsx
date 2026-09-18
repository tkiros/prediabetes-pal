"use client";

import Link from "next/link";

import { track } from "../lib/client/analytics";
import { dispatchIdeasExpand } from "../lib/client/ideas-expand";
import { IconBookmark, IconCheckCircle, IconCompass, IconLeaf } from "./icons";

/**
 * Task 5.1: the quick-action row (review A-54, below the hero, outside the
 * fold budget). Four equal jobs, all quiet — DESIGN.md §8 keeps the app's one
 * accent fill to the tab bar's Check puck and the hero above; a third fill
 * here (including on Check) breaks the one colour moment (review A-74).
 *
 * Ideas is Task 4.4's See-all trigger, not a plain anchor to the block above:
 * its anchor link to the ideas heading keeps the scroll native (no scroll
 * code here), and the CustomEvent dispatch (R-2, `lib/client/ideas-expand.ts`) asks
 * <GuideIdeas> to expand in place. A client leaf — like LearnLink and
 * StepLink (ruling F-38) — so DashboardView stays a server tree; Learn's tap
 * reports `learn_opened` (Task 3.6).
 */
export function HomeQuickRow() {
  return (
    <nav className="quick-row" aria-label="Quick actions">
      <Link href="#ideas-title" className="quick-action" onClick={dispatchIdeasExpand}>
        <IconLeaf size={22} />
        <span>Ideas</span>
      </Link>
      <Link href="/check" className="quick-action">
        <IconCheckCircle size={22} />
        <span>Check</span>
      </Link>
      <Link
        href="/learn"
        className="quick-action"
        onClick={() => track({ name: "learn_opened", props: { page: "index", from: "home" } })}
      >
        <IconCompass size={22} />
        <span>Learn</span>
      </Link>
      <Link href="/journey" className="quick-action">
        <IconBookmark size={22} />
        <span>Journey</span>
      </Link>
    </nav>
  );
}
