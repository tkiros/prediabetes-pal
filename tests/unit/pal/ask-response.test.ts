import { describe, expect, it } from "vitest";

import { askResponse } from "../../../lib/client/ask-response";
import { WIN_KEYS, type WinKey } from "../../../lib/client/ask-store";

// PRD v1.1 §7.5 / plan Task 6.4: the response line beneath Screen B's pick.
const EXPECTED: Record<WinKey, string> = {
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

describe("askResponse (closed map, Task 6.4)", () => {
  it("maps every WIN_KEYS member to a non-empty line", () => {
    for (const key of WIN_KEYS) expect(askResponse(key).length, key).toBeGreaterThan(0);
  });

  it("equals the brief's table exactly", () => {
    expect(Object.fromEntries(WIN_KEYS.map((key) => [key, askResponse(key)]))).toEqual(EXPECTED);
  });

  it("never names an outcome the product is the agent of, and never claims calm", () => {
    for (const key of WIN_KEYS) {
      expect(askResponse(key), key).not.toMatch(/lower|reverse|prevent|control|manage|reach|hit|drop/i);
      expect(askResponse(key).toLowerCase(), key).not.toContain("calm");
    }
  });
});
