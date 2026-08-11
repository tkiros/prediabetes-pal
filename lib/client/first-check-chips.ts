// The guided-first-check foods — everyday items whose impact surprises almost
// everyone, so the very first check earns an "oh, huh" moment. Varied by the
// on-device segment answer from the onboarding tour (`pal.segment.v1`); the
// classics are the default. Derived from the promise registry (the single
// source for every PROMOTED example) so the chips and the landing demo can
// never drift — and so the deploy-blocking fixture test guards that each
// classic still takes the route the chips imply. Moved here from the deleted
// onboarding first_check step (2026-08-11): the chips now render on the check
// page's first-run empty state instead of holding their own tour step.
import { promotedInputsFor } from "../pal/promise-registry";

const CLASSICS: readonly string[] = promotedInputsFor("onboarding");

const CHIPS_BY_SEGMENT: Record<string, readonly string[]> = {
  "New A1C result": CLASSICS,
  "Doctor's advice": ["brown rice", "granola", "fruit smoothie"],
  "Family history": ["white bread", "grapes", "sweet tea"],
  "Just checking": CLASSICS
};

/** Segment-aware first-check suggestions; safe on the server (returns the
 *  classics when storage is unreachable). */
export function firstCheckChips(): readonly string[] {
  try {
    const segment = window.localStorage.getItem("pal.segment.v1");
    return (segment && CHIPS_BY_SEGMENT[segment]) || CLASSICS;
  } catch {
    return CLASSICS;
  }
}
