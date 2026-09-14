"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { track } from "../lib/client/analytics";
import { nextIdeasRotation } from "../lib/client/ideas-rotation";
import { useHydrated } from "../lib/client/use-hydrated";
import { daypartOfHour, type Daypart } from "../lib/coach/insights";
import { ideasFor, type GuideIdea } from "../lib/pal/guide-ideas";
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

export function GuideIdeas() {
  const router = useRouter();
  const hydrated = useHydrated();
  const [view, setView] = useState<{ daypart: Daypart; ideas: GuideIdea[] } | null>(null);

  // Review A-108: StrictMode runs mount effects twice in dev, which moved the
  // counter by two per mount and (with six lines, three per page) showed the
  // same page every load — defeating the manual check. Guard with a ref so the
  // counter and ideas_shown advance once per mount.
  const shownRef = useRef(false);
  useEffect(() => {
    if (!hydrated || shownRef.current) return;
    shownRef.current = true;
    const daypart = daypartOfHour(new Date().getHours());
    setView({ daypart, ideas: ideasFor(daypart, nextIdeasRotation()) });
    track({ name: "ideas_shown", props: { daypart, surface: "home" } });
  }, [hydrated]);

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

  return (
    <section className="ideas-block" aria-labelledby="ideas-title" data-testid="ideas-block">
      <h2 className="ideas-title" id="ideas-title">
        {view ? DAYPART_HEADING[view.daypart] : "Ideas for today"}
      </h2>
      <p className="ideas-sub">
        Meal ideas that sit within Prediabetes Pal&apos;s rules. Tap one to send it to the check.
      </p>
      <ul className="ideas-list" role="list" aria-label="Meal ideas">
        {view
          ? view.ideas.map((idea, index) => (
              <li key={idea.id}>
                <button
                  type="button"
                  className="idea-row"
                  data-testid={`idea-row-${index + 1}`}
                  onClick={() =>
                    pick(idea, index < 3 ? (String(index + 1) as "1" | "2" | "3") : "more", view.daypart)
                  }
                >
                  <span>{idea.text}</span>
                  <IconArrowRight size={16} />
                </button>
              </li>
            ))
          : // Review A-54: the pre-hydration placeholder is three rows of the
            // real row height, so the block does not change size on hydration.
            [1, 2, 3].map((n) => (
              <li key={n} className="idea-row idea-row--skeleton" aria-hidden="true" />
            ))}
      </ul>
    </section>
  );
}
