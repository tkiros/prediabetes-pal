// lib/client/ask-response.ts
import type { WinKey } from "./ask-store";

/**
 * The line beneath Screen B's pick (PRD v1.1 §7.5 F-ASK, plan Task 6.4): what
 * the app does about the win someone chose, in general terms. Link-free on
 * purpose — tour state is React state, so a link out mid-tour would lose the
 * walk; routing happens through the Home door. No line names an outcome the
 * product is the agent of, and none claims the page is calm.
 */
const RESPONSES: Record<WinKey, string> = {
  explanation:
    "The words on a result are explained in general terms. What your own number means is a question for your clinician.",
  number_watch:
    "The words on a result are explained in general terms. Your own results are for your clinician to read with you.",
  steps: "Your first week is seven small steps, one a day. None of them is a diet.",
  food_enjoy: "Meal ideas come first, and you can check any meal when you are unsure.",
  peace: "Plain words, and a clear pointer to a person when an app is not the right reader.",
  trust: "Every label says where it came from: Prediabetes Pal's rules.",
  unsure:
    "Meal ideas come first, the check is there when you are unsure, and the words are explained in general terms."
};

export function askResponse(win: WinKey): string {
  return RESPONSES[win];
}
