import { describe, expect, it } from "vitest";

import { appointmentPhrase, isoDayNumber, summaryOfferDue, waitingState } from "../../../lib/pal/gdm/waiting";

describe("waiting mode (PRD §6.2 F-WAIT)", () => {
  it("ends on its own when a plan is entered", () => {
    expect(waitingState({ hasCurrentPlan: true, appointmentDate: "2026-10-08", today: "2026-10-01" })).toBe("ended");
  });

  it("waits until the appointment date passes, then asks once for what she was given", () => {
    expect(waitingState({ hasCurrentPlan: false, appointmentDate: null, today: "2026-10-01" })).toBe("waiting");
    expect(waitingState({ hasCurrentPlan: false, appointmentDate: "2026-10-08", today: "2026-10-08" })).toBe("waiting");
    expect(waitingState({ hasCurrentPlan: false, appointmentDate: "2026-10-08", today: "2026-10-09" })).toBe("after_appointment");
  });

  it.each([
    ["2026-10-01", "today"],
    ["2026-10-02", "tomorrow"],
    ["2026-10-05", "thisWeek"],
    ["2026-10-12", "nextWeek"],
    ["2026-11-20", "later"],
    [null, "none"],
    ["(unreadable entry)", "none"],
    ["2026-09-20", "none"]
  ] as const)("speaks %s as %s — a phrase, never a day count", (date, phrase) => {
    expect(appointmentPhrase(date, "2026-10-01")).toBe(phrase);
  });

  it("offers the summary the day before, and on the day", () => {
    expect(summaryOfferDue("2026-10-08", "2026-10-07")).toBe(true);
    expect(summaryOfferDue("2026-10-08", "2026-10-08")).toBe(true);
    expect(summaryOfferDue("2026-10-08", "2026-10-06")).toBe(false);
    expect(summaryOfferDue(null, "2026-10-06")).toBe(false);
  });

  it("validates dates: garbage and null return null, valid YYYY-MM-DD returns whole days since epoch", () => {
    expect(isoDayNumber(null)).toBeNull();
    expect(isoDayNumber("(unreadable entry)")).toBeNull();
    expect(isoDayNumber("2026-13-45")).toBeNull();
    expect(isoDayNumber("2026-10-08")).toBeGreaterThan(0);
    const oct8 = isoDayNumber("2026-10-08");
    const oct9 = isoDayNumber("2026-10-09");
    expect(oct9! - oct8!).toBe(1);
  });
});
