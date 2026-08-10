import { describe, it, expect } from "vitest";
import { disclosureLayer, MIN_HOLD_S } from "../../../video-engine/disclosure";

const DISCLAIMER =
  "Prediabetes Pal is informational only and is not medical advice. Talk with a doctor or registered dietitian for guidance that is specific to you.";

describe("disclosureLayer (compliance-critical, pure)", () => {
  it("no claims → no disclosure (myth/label-trap specs need none)", () => {
    expect(disclosureLayer({ claims_used: [], disclosure_block: "" })).toEqual({ required: false });
    // even if a stray block is present, an empty claim set means no disclosure obligation
    expect(disclosureLayer({ claims_used: [], disclosure_block: "leftover" })).toEqual({ required: false });
  });

  it("claims present → dual-mode: on-screen text + mirrored caption, both = disclosure_block", () => {
    const d = disclosureLayer({ claims_used: ["a claim"], disclosure_block: `  ${DISCLAIMER}  ` });
    expect(d.required).toBe(true);
    if (!d.required) throw new Error("unreachable");
    expect(d.onScreenText).toBe(DISCLAIMER); // trimmed
    expect(d.captionText).toBe(DISCLAIMER); // mirrored (16 CFR 255 dual-mode)
  });

  it("on-screen hold is never below the 2s compliance floor", () => {
    const short = disclosureLayer({ claims_used: ["c"], disclosure_block: "Not medical advice." });
    expect(short.required && short.holdSeconds).toBeGreaterThanOrEqual(MIN_HOLD_S);
    expect(MIN_HOLD_S).toBeGreaterThanOrEqual(2);
  });

  it("longer disclaimers hold longer than the floor (readable, not a 2s flash)", () => {
    const long = disclosureLayer({ claims_used: ["c"], disclosure_block: DISCLAIMER });
    expect(long.required && long.holdSeconds).toBeGreaterThan(MIN_HOLD_S);
  });

  it("FAILS CLOSED: claims present but blank disclosure_block throws (never renders an uncovered claim)", () => {
    expect(() => disclosureLayer({ claims_used: ["a claim"], disclosure_block: "   " })).toThrow();
  });
});
