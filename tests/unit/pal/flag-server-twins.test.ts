import { describe, expect, it } from "vitest";

import {
  longitudinalInsightsServerEnabled
} from "../../../lib/longitudinal-insights-flag";
import { photoInputServerEnabled } from "../../../lib/photo-input-flag";

/**
 * Server twins for the two formerly build-time-only flags (C7 residuals,
 * outside-voice #8). Fail-closed: only the exact value "1" enables; the env is
 * injectable so nothing here mutates process.env.
 */
describe("flag server twins", () => {
  it("photoInputServerEnabled: only exact '1' enables", () => {
    expect(photoInputServerEnabled({ PHOTO_INPUT_ENABLED: "1" })).toBe(true);
    expect(photoInputServerEnabled({ PHOTO_INPUT_ENABLED: "true" })).toBe(false);
    expect(photoInputServerEnabled({ PHOTO_INPUT_ENABLED: "0" })).toBe(false);
    expect(photoInputServerEnabled({ PHOTO_INPUT_ENABLED: "" })).toBe(false);
    expect(photoInputServerEnabled({})).toBe(false);
  });

  it("longitudinalInsightsServerEnabled: only exact '1' enables", () => {
    expect(
      longitudinalInsightsServerEnabled({ LONGITUDINAL_INSIGHTS_ENABLED: "1" })
    ).toBe(true);
    expect(
      longitudinalInsightsServerEnabled({
        LONGITUDINAL_INSIGHTS_ENABLED: "true"
      })
    ).toBe(false);
    expect(
      longitudinalInsightsServerEnabled({ LONGITUDINAL_INSIGHTS_ENABLED: "" })
    ).toBe(false);
    expect(longitudinalInsightsServerEnabled({})).toBe(false);
  });
});
