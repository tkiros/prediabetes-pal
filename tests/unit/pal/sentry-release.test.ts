import { describe, expect, it } from "vitest";

import { resolveSentryRelease } from "../../../lib/pal/sentry-release";

describe("Sentry release resolution", () => {
  it("prefers the exact Vercel Git SHA", () => {
    expect(
      resolveSentryRelease(
        "80ea9fb93bb015084963aa707298c58c6355eeb7",
        "manual-release"
      )
    ).toBe("80ea9fb93bb015084963aa707298c58c6355eeb7");
  });

  it("trims values and falls through empty candidates", () => {
    expect(resolveSentryRelease(" ", undefined, " fallback-release ")).toBe(
      "fallback-release"
    );
  });

  it("leaves local and test events release-less when no authority exists", () => {
    expect(resolveSentryRelease(undefined, "", null)).toBeUndefined();
  });
});
