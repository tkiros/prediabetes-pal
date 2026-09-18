// lib/client/home-door.ts
import type { AskState } from "./ask-store";

/**
 * PRD v1.1 §7.5 "What the answers do", 1: the F-ASK picks order the door per
 * person — the same branch the concierge test applies to the whole audience.
 * Food first → ideas lead. Number first → orientation step 1 (Learn: numbers)
 * leads. Plan first → the seven-day sequence sits at the top. Worried → the
 * clinician pointer sits higher. No pick, "other", or a skipped screen → the
 * default door, which is the concierge branch's own answer.
 */
export type Door = "ideas" | "numbers" | "plan" | "worried";

export function doorFor(ask: AskState | null): Door {
  switch (ask?.pains[0]) {
    case "number":
    case "effort":
      return "numbers";
    case "plan":
    case "clinician":
      return "plan";
    case "worried":
      return "worried";
    default:
      return "ideas";
  }
}
