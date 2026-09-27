process.env.TZ = "America/Los_Angeles"; // set before any Date is made: CI runs in UTC, where the buggy version passes

import { describe, expect, it } from "vitest";
import { formatIsoDate, localIsoDate } from "../../../lib/client/gdm-date";

describe("the door's dates are the device's, never UTC (G-44)", () => {
  it("late in the evening, today is still today", () => {
    expect(localIsoDate(new Date(2026, 9, 8, 23, 30))).toBe("2026-10-08"); // toISOString() says the 9th
  });
  it("shows the day she typed", () => {
    expect(formatIsoDate("2026-10-08", "en-US")).toBe("Thursday, October 8");
    expect(formatIsoDate("(unreadable entry)")).toBeNull();
    expect(formatIsoDate(null)).toBeNull();
  });
});
