"use client";

import Link from "next/link";

import { dispatchIdeasExpand } from "../lib/client/ideas-expand";
import { IconBook, IconCheckCircle, IconCompass, IconLeaf } from "./icons";
import { LearnLink } from "./learn-link";

/**
 * Task 5.1: the quick-action row (review A-54, below the hero, outside the
 * fold budget). Four equal jobs, all quiet — DESIGN.md §8 keeps the app's one
 * accent fill to the tab bar's Check puck and the hero above; a third fill
 * here (including on Check) breaks the one colour moment (review A-74).
 *
 * Ideas is Task 4.4's See-all trigger, not a plain anchor to the block above:
 * its anchor link to the ideas heading keeps the scroll native for a first
 * tap (Next's <Link> scrolls a fresh hash into view on its own), and the
 * CustomEvent dispatch (R-2, `lib/client/ideas-expand.ts`) asks <GuideIdeas>
 * to expand in place. Learn reuses `<LearnLink>` — the one place that reports
 * the Learn-open analytics event (ruling F-38, Task 3.6) — rather than a
 * second inline tracker.
 *
 * Task 5.4, ruling R-27: a SECOND tap on Ideas, with the URL already ending
 * in `#ideas-title`, must scroll again — someone scrolled away and wants
 * back. Next's <Link> maintains scroll position when the URL does not change
 * (see the `scroll` prop docs), so a same-hash tap is a no-op for the router.
 * `handleIdeasClick` covers exactly that gap: it reads the CURRENT hash
 * (still the pre-navigation value inside onClick) and only when it already
 * matches does it scroll manually — the first tap's hash change is left to
 * Next's own scroll-to-hash behaviour, untouched.
 *
 * Fix round 1: Journey's glyph and Learn's glyph swapped from the task
 * brief's original draft — `components/app-nav.tsx`, the five-slot tab bar
 * rendered directly below this row, already binds the compass glyph to
 * `/journey` (and its own bookmark glyph to a different destination
 * entirely, unrelated to this row). Matching the tab bar's own pairing here,
 * instead of giving one glyph two meanings a few pixels apart, is the point;
 * DESIGN.md §7 lists the new book glyph for Learn.
 */
function handleIdeasClick() {
  dispatchIdeasExpand();
  if (window.location.hash === "#ideas-title") {
    document.getElementById("ideas-title")?.scrollIntoView();
  }
}

export function HomeQuickRow() {
  return (
    <nav className="quick-row" aria-label="Quick actions">
      <Link href="#ideas-title" className="quick-action" onClick={handleIdeasClick}>
        <IconLeaf size={22} />
        <span>Ideas</span>
      </Link>
      <Link href="/check" className="quick-action">
        <IconCheckCircle size={22} />
        <span>Check</span>
      </Link>
      <LearnLink href="/learn" from="home" className="quick-action">
        <IconBook size={22} />
        <span>Learn</span>
      </LearnLink>
      <Link href="/journey" className="quick-action">
        <IconCompass size={22} />
        <span>Journey</span>
      </Link>
    </nav>
  );
}
