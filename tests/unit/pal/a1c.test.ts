import { describe, expect, it } from "vitest";

import { routeA1C } from "../../../lib/pal/a1c";

describe("routeA1C", () => {
  it("routes A1C values to the executed Phase 1 bands and out-of-scope ids", () => {
    expect(routeA1C(5.69)).toMatchObject({
      kind: "out_of_scope",
      responseKind: "out_of_scope_below",
      band: "below_prediabetes_range"
    });
    expect(routeA1C(5.7)).toMatchObject({
      kind: "in_scope",
      band: "prediabetes_57_59"
    });
    expect(routeA1C(5.95)).toMatchObject({
      kind: "in_scope",
      band: "prediabetes_57_59"
    });
    expect(routeA1C(6.0)).toMatchObject({
      kind: "in_scope",
      band: "prediabetes_60_62"
    });
    expect(routeA1C(6.2)).toMatchObject({
      kind: "in_scope",
      band: "prediabetes_60_62"
    });
    expect(routeA1C(6.3)).toMatchObject({
      kind: "in_scope",
      band: "prediabetes_63_64"
    });
    expect(routeA1C(6.49)).toMatchObject({
      kind: "in_scope",
      band: "prediabetes_63_64"
    });
    expect(routeA1C(6.5)).toMatchObject({
      kind: "out_of_scope",
      responseKind: "out_of_scope_high",
      band: "diabetes_range_out_of_scope"
    });
  });
});
