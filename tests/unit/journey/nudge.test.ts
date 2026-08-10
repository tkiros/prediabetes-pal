import { describe, expect, it } from "vitest";

import {
  assertNudgeBankClaimFree,
  cadenceAllowsSend,
  dayGap,
  GENERIC_NUDGE_COPY,
  INACTIVITY_STOP_DAYS,
  isQuietHour,
  JOURNEY_STEP_COPY,
  minGapDaysForCadence,
  NUDGE_COPY,
  nudgeBody,
  selectJourneyNudge,
  WEEKLY_LEARNING_READY_COPY,
  type JourneyNudgeSignals
} from "../../../lib/journey/nudge";
import { assertNoForbiddenClaims } from "../../../lib/pal/postprocess";
import { loadSafetyContract } from "../../../lib/pal/safety-contract";

function signals(
  overrides: Partial<JourneyNudgeSignals> = {}
): JourneyNudgeSignals {
  return {
    journeyState: "active",
    stage: 1,
    daysSinceLastCheck: 0,
    stageIntentMet: false,
    weeklyArtifactFresh: false,
    ...overrides
  };
}

describe("selectJourneyNudge — trigger class selection", () => {
  it("active journey with an unmet stage intent → journey_step at that stage", () => {
    expect(selectJourneyNudge(signals({ stage: 2 }))).toEqual({
      class: "journey_step",
      stage: 2
    });
  });

  it("a fresh weekly artifact outranks the stage step → weekly_learning_ready", () => {
    expect(
      selectJourneyNudge(
        signals({ stage: 3, weeklyArtifactFresh: true, stageIntentMet: false })
      )
    ).toEqual({ class: "weekly_learning_ready", stage: 3 });
  });

  it("active journey with the stage intent already met → generic (no invented step)", () => {
    expect(selectJourneyNudge(signals({ stageIntentMet: true }))).toEqual({
      class: "generic",
      stage: null
    });
  });

  it("no journey (not_started) → generic", () => {
    expect(
      selectJourneyNudge(signals({ journeyState: "not_started", stage: null }))
    ).toEqual({ class: "generic", stage: null });
  });

  it("maintenance journey → weekly artifact still fires, but never journey_step", () => {
    expect(
      selectJourneyNudge(
        signals({ journeyState: "maintenance", stage: 5, weeklyArtifactFresh: true })
      )
    ).toEqual({ class: "weekly_learning_ready", stage: 5 });

    // intent unmet but state is maintenance → generic, not journey_step
    expect(
      selectJourneyNudge(
        signals({ journeyState: "maintenance", stage: 5, stageIntentMet: false })
      )
    ).toEqual({ class: "generic", stage: null });
  });
});

describe("selectJourneyNudge — stop rules (plan §11, constraint §9)", () => {
  it("stops when the journey is paused", () => {
    expect(selectJourneyNudge(signals({ journeyState: "paused" }))).toBeNull();
  });

  it("stops when the journey is graduated", () => {
    expect(
      selectJourneyNudge(signals({ journeyState: "graduated" }))
    ).toBeNull();
  });

  it("stops after 14 days of inactivity (wind-down, not escalation)", () => {
    expect(
      selectJourneyNudge(signals({ daysSinceLastCheck: INACTIVITY_STOP_DAYS + 1 }))
    ).toBeNull();
  });

  it("does NOT stop exactly at the 14-day boundary", () => {
    expect(
      selectJourneyNudge(signals({ daysSinceLastCheck: INACTIVITY_STOP_DAYS }))
    ).not.toBeNull();
  });

  it("a user who has never checked is new, not inactive → not stopped", () => {
    expect(
      selectJourneyNudge(signals({ daysSinceLastCheck: null }))
    ).not.toBeNull();
  });
});

describe("nudgeBody", () => {
  it("uses the stage line for journey_step", () => {
    expect(nudgeBody({ class: "journey_step", stage: 2 }, 0)).toBe(
      JOURNEY_STEP_COPY[2]
    );
  });

  it("uses the weekly line for weekly_learning_ready", () => {
    expect(nudgeBody({ class: "weekly_learning_ready", stage: 3 }, 0)).toBe(
      WEEKLY_LEARNING_READY_COPY
    );
  });

  it("rotates the generic bank deterministically", () => {
    expect(nudgeBody({ class: "generic", stage: null }, 5)).toBe(
      GENERIC_NUDGE_COPY[5 % GENERIC_NUDGE_COPY.length]
    );
  });
});

describe("cadence spacing", () => {
  it("maps each cadence to its minimum day gap", () => {
    expect(minGapDaysForCadence("daily")).toBe(1);
    expect(minGapDaysForCadence("few_per_week")).toBe(2);
    expect(minGapDaysForCadence("weekly")).toBe(7);
  });

  it("dayGap counts whole days between keys", () => {
    expect(dayGap("2026-07-03", "2026-07-05")).toBe(2);
    expect(dayGap("2026-07-03", "2026-07-03")).toBe(0);
  });

  it("a never-nudged subscription always qualifies", () => {
    expect(cadenceAllowsSend("weekly", "2026-07-03", null)).toBe(true);
  });

  it("daily allows a next-day send but not a same-day repeat", () => {
    expect(cadenceAllowsSend("daily", "2026-07-03", "2026-07-03")).toBe(false);
    expect(cadenceAllowsSend("daily", "2026-07-04", "2026-07-03")).toBe(true);
  });

  it("few_per_week needs a 2-day gap", () => {
    expect(cadenceAllowsSend("few_per_week", "2026-07-04", "2026-07-03")).toBe(
      false
    );
    expect(cadenceAllowsSend("few_per_week", "2026-07-05", "2026-07-03")).toBe(
      true
    );
  });

  it("weekly needs a 7-day gap", () => {
    expect(cadenceAllowsSend("weekly", "2026-07-09", "2026-07-03")).toBe(false);
    expect(cadenceAllowsSend("weekly", "2026-07-10", "2026-07-03")).toBe(true);
  });
});

describe("quiet hours", () => {
  it("nulls never suppress", () => {
    expect(isQuietHour(3, null, null)).toBe(false);
    expect(isQuietHour(3, 22, null)).toBe(false);
  });

  it("an equal start/end window never suppresses", () => {
    expect(isQuietHour(9, 9, 9)).toBe(false);
  });

  it("a same-day window [9,17) suppresses inside, allows the edges out", () => {
    expect(isQuietHour(8, 9, 17)).toBe(false);
    expect(isQuietHour(9, 9, 17)).toBe(true);
    expect(isQuietHour(16, 9, 17)).toBe(true);
    expect(isQuietHour(17, 9, 17)).toBe(false);
  });

  it("a wrap-around window [22,7) suppresses across midnight", () => {
    expect(isQuietHour(23, 22, 7)).toBe(true);
    expect(isQuietHour(3, 22, 7)).toBe(true);
    expect(isQuietHour(7, 22, 7)).toBe(false);
    expect(isQuietHour(12, 22, 7)).toBe(false);
  });
});

describe("nudge copy bank", () => {
  const contract = loadSafetyContract();

  it("carries no forbidden clinical claims (same regexes as model output)", () => {
    expect(() => assertNudgeBankClaimFree(contract)).not.toThrow();
    expect(() => assertNoForbiddenClaims(contract, [...NUDGE_COPY])).not.toThrow();
  });

  it("has no streak / guilt / urgency language (constraint §9)", () => {
    for (const copy of NUDGE_COPY) {
      expect(copy).not.toMatch(
        /you failed|you should have|don't forget|missed|streak|last chance|hurry|now or never/i
      );
    }
  });
});
