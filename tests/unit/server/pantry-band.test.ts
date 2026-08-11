import { describe, expect, it } from "vitest";

import { routeA1C } from "../../../lib/pal/a1c";
import { bandRepresentativeA1c } from "../../../lib/server/pantry/band";

describe("bandRepresentativeA1c", () => {
  it.each([
    ["prediabetes_57_59", "standard"],
    ["prediabetes_60_62", "elevated"],
    ["prediabetes_63_64", "high"]
  ] as const)("%s routes to conservativeLevel=%s", (band, level) => {
    const route = routeA1C(bandRepresentativeA1c(band));
    expect(route.kind).toBe("in_scope");
    if (route.kind === "in_scope") {
      expect(route.band).toBe(band);
      expect(route.conservativeLevel).toBe(level);
    }
  });
});
