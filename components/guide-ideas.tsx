"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { track } from "../lib/client/analytics";
import { listenForIdeasExpand } from "../lib/client/ideas-expand";
import { nextIdeasRotation } from "../lib/client/ideas-rotation";
import { useHydrated } from "../lib/client/use-hydrated";
import { daypartOfHour, type Daypart } from "../lib/coach/insights";
import { guideDoorEnabled } from "../lib/guide-door-flag";
import { GUIDE_IDEAS, ideasFor, type GuideIdea } from "../lib/pal/guide-ideas";
import { IconArrowRight } from "./icons";

/**
 * The ideas block — the guide door's hero slot (PRD v1.1 §7.6). Three quiet
 * rows for the current daypart (review A-54: rows, not chips — the labels are
 * meals, not 1–3 word tags), above the check hero, which stays the one
 * accent-filled action (DESIGN.md §8 as amended in this PR).
 *
 * A hand-off, not a second check surface: a tap writes the idea into the
 * existing `pal.recheck` session prefill that /check already reads, marks the
 * source so the check form can count idea → check completions, and navigates.
 * Rendered after hydration only — the rotation counter and the daypart are
 * device state, and DashboardView is server-rendered for signed-in users.
 * Three skeleton rows hold the block's height until then, so the CTA below
 * does not jump.
 */
const DAYPART_HEADING: Record<Daypart, string> = {
  breakfast: "Ideas for breakfast",
  lunch: "Ideas for lunch",
  dinner: "Ideas for dinner"
};

/** Final review Minor #3: one literal shared by the toggle's `aria-controls`
 *  and the list's `id` — and only passed to the list under `full`, so the
 *  `ideas`-only render carries no `id` at all, as before PR-4. */
const IDEAS_LIST_ID = "ideas-list";

/**
 * The idea-list markup, shared between the Home block below and the /check
 * first-run row (Task 1.14 / plan Task 4.2, review fix round 1: this used to
 * be duplicated near-verbatim in components/food-check-form.tsx). Owns the
 * list wrapper, the row markup, and the slot ternary; the caller only
 * supplies the ideas and what a tap should do. `testIdPrefix` defaults to
 * "idea-row" (Home's existing pin); /check passes "check-idea-row" to keep
 * its own pin.
 */
export function IdeaRows({
  ideas,
  onPick,
  testIdPrefix = "idea-row",
  id
}: {
  ideas: readonly GuideIdea[];
  onPick: (idea: GuideIdea, slot: "1" | "2" | "3" | "more") => void;
  testIdPrefix?: string;
  /** Task 4.4: lets Home's "See all" button point `aria-controls` at this list. Unused by /check. */
  id?: string;
}) {
  return (
    <ul className="ideas-list" role="list" aria-label="Meal ideas" id={id}>
      {ideas.map((idea, index) => (
        <li key={idea.id}>
          <button
            type="button"
            className="idea-row"
            data-testid={`${testIdPrefix}-${index + 1}`}
            onClick={() =>
              onPick(idea, index < 3 ? (String(index + 1) as "1" | "2" | "3") : "more")
            }
          >
            <span>{idea.text}</span>
            <IconArrowRight size={16} />
          </button>
        </li>
      ))}
    </ul>
  );
}

/**
 * Task 4.4: rotates the daypart's full ten-idea bank so it starts at `first`
 * — the collapsed three-row view's own first idea — so expanding "See all"
 * never reshuffles the rows already on screen. `first` always comes from
 * GUIDE_IDEAS (it is `ideasFor`'s own output), so the lookup cannot miss.
 */
function expandFrom(daypart: Daypart, first: GuideIdea): GuideIdea[] {
  const bank = GUIDE_IDEAS.filter((idea) => idea.daypart === daypart);
  const start = Math.max(bank.findIndex((idea) => idea.id === first.id), 0);
  return Array.from({ length: bank.length }, (_, offset) => bank[(start + offset) % bank.length]);
}

export function GuideIdeas() {
  const router = useRouter();
  const hydrated = useHydrated();
  const full = guideDoorEnabled("ideas-full");
  const [view, setView] = useState<{
    daypart: Daypart;
    ideas: GuideIdea[];
    allIdeas: GuideIdea[];
  } | null>(null);
  // Task 4.4: collapsed (three rows) unless the ideas-full surface is on and
  // the reader taps "See all".
  const [expanded, setExpanded] = useState(false);

  // Review A-108: StrictMode runs mount effects twice in dev, which moved the
  // counter by two per mount and (with six lines, three per page) showed the
  // same page every load — defeating the manual check. Guard with a ref so the
  // counter and ideas_shown advance once per mount.
  const shownRef = useRef(false);
  useEffect(() => {
    if (!hydrated || shownRef.current) return;
    shownRef.current = true;
    const daypart = daypartOfHour(new Date().getHours());
    const rotation = nextIdeasRotation();
    // Task 4.3 segment steering: only meaningful (and only read) under
    // ideas-full — `!full` keeps today's call and nothing else exactly as it was.
    let segment: string | null = null;
    if (full) {
      try {
        segment = window.localStorage.getItem("pal.segment.v1");
      } catch {
        segment = null;
      }
    }
    const ideas = ideasFor(daypart, rotation, { count: 3, full, segment });
    setView({
      daypart,
      ideas,
      allIdeas: full && ideas[0] ? expandFrom(daypart, ideas[0]) : ideas
    });
    track({ name: "ideas_shown", props: { daypart, surface: "home" } });
  }, [hydrated, full]);

  // R-2: the quick row's Ideas item is the See-all trigger. Expand-only —
  // tapping it twice must not collapse the block back down, so the handler
  // never reads or toggles `expanded`. Registered only under `ideas-full`,
  // the surface that owns the toggle at all; removed on unmount.
  useEffect(() => {
    if (!full) return;
    return listenForIdeasExpand(() => setExpanded(true));
  }, [full]);

  // Review A-25: a double-tap must not push /check twice (duplicate history
  // entry, Back lands on /check). First tap wins; the ref never resets because
  // the component unmounts on navigation.
  const navigatingRef = useRef(false);

  function pick(idea: GuideIdea, slot: "1" | "2" | "3" | "more", daypart: Daypart) {
    if (navigatingRef.current) return;
    navigatingRef.current = true;
    try {
      window.sessionStorage.setItem("pal.recheck", idea.text);
      window.sessionStorage.setItem("pal.recheck.source", "idea");
    } catch {
      // best-effort prefill — /check works without it
    }
    track({ name: "idea_tapped", props: { daypart, slot, surface: "home" } });
    // Review A-102: /check renders <FirstRunGate/>; a fresh guest (Task 1.8's
    // exact setup) would be bounced to /onboarding and the keys would outlive
    // the redirect. ?stay=1 is the gate's escape hatch.
    router.push("/check?stay=1");
  }

  const heading = (
    <h2 className="ideas-title" id="ideas-title">
      {view ? DAYPART_HEADING[view.daypart] : "Ideas for today"}
    </h2>
  );

  return (
    <section
      className="ideas-block"
      aria-labelledby="ideas-title"
      data-testid="ideas-block"
      data-expanded={expanded || undefined}
      data-full={full || undefined}
    >
      {/* Review fix round 1 (F1): the toggle moved into the heading row as a
          real 44px button — DESIGN.md §5 forbids faking a tap target with an
          invisible hit area, which the first cut of this button did and which
          overlapped the last idea row. The row wrapper renders only under
          `full`, so the `ideas`-only render keeps its bare `<h2>`, byte for
          byte — no markup change, not only no layout change. */}
      {full ? (
        <div className="ideas-heading-row">
          {heading}
          {/* Task 4.4 "See all": once there is a real list to expand — a
              quiet text button, not a second accent-filled action
              (DESIGN.md §8 stays the check hero's alone). */}
          {view ? (
            <button
              type="button"
              className="ideas-see-all"
              aria-expanded={expanded}
              aria-controls={IDEAS_LIST_ID}
              onClick={() => setExpanded((current) => !current)}
            >
              {expanded ? "Show fewer" : "See all"}
            </button>
          ) : null}
        </div>
      ) : (
        heading
      )}
      <p className="ideas-sub">
        Meal ideas that sit within Prediabetes Pal&apos;s rules. Tap one to send it to the check.
      </p>
      {view ? (
        <IdeaRows
          id={full ? IDEAS_LIST_ID : undefined}
          ideas={expanded ? view.allIdeas : view.ideas}
          onPick={(idea, slot) => pick(idea, slot, view.daypart)}
        />
      ) : (
        // Review A-54: the pre-hydration placeholder is three rows of the
        // real row height, so the block does not change size on hydration —
        // same "ideas-list" wrapper IdeaRows uses, kept inline here (not
        // moved into IdeaRows) since it has no ideas/onPick to give it.
        <ul className="ideas-list" role="list" aria-label="Meal ideas">
          {[1, 2, 3].map((n) => (
            <li key={n} className="idea-row idea-row--skeleton" aria-hidden="true" />
          ))}
        </ul>
      )}
    </section>
  );
}
