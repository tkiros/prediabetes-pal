import { describe, expect, it } from "vitest";

import { RESULT_FOOTER_DISCLAIMER } from "../../../components/disclaimer-line";

describe("RESULT_FOOTER_DISCLAIMER", () => {
  it("is the verbatim approved copy-ledger result-footer row", () => {
    expect(RESULT_FOOTER_DISCLAIMER).toBe(
      "Prediabetes Pal is informational only and is not medical advice. Talk with a doctor or registered dietitian for guidance that is specific to you."
    );
  });
});
