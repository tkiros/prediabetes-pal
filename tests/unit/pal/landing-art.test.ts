import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { TASTER_LIMIT } from "../../../lib/client/taster-store";
import { RISK_LABELS } from "../../../lib/pal/labels";

const ART = "public/landing/app-check.png";
const MEALS_ART = "public/landing/app-meals.png";
const src = fs.readFileSync(
  path.join(process.cwd(), "app/page.tsx"),
  "utf8"
);

/**
 * The landing's right-column artwork is a REAL capture of /check
 * (`scripts/capture-landing-art.mjs`), added 2026-08-05 when the owner marked
 * the empty right columns with red X's and chose captured screenshots over
 * live product components.
 *
 * ⛔ Why this file exists. Every free-tier number on the landing is
 * interpolated from TASTER_LIMIT and never retyped — `copy-pins.test.ts`
 * enforces that, because the store listing, the landing and the meter drifting
 * apart is a real defect that shipped once. The capture defeats that guard
 * completely: it renders "N free checks left today" as PIXELS, which no copy
 * audit can read. Change TASTER_LIMIT and the page would interpolate the new
 * number in its captions while the screenshot beside them showed the old one.
 *
 * So this pins the coupling instead. If TASTER_LIMIT moves, this fails and
 * says what to do about it.
 */
describe("the landing's captured artwork cannot drift from the free tier", () => {
  it("the art file exists where the page references it", () => {
    expect(fs.existsSync(path.join(process.cwd(), ART))).toBe(true);
    expect(src).toContain('src="/landing/app-check.png"');
  });

  it("TASTER_LIMIT still matches the number baked into the capture", () => {
    // ⚠️ If this fails, TASTER_LIMIT changed and the PNG is now WRONG on a
    // marketing page. Re-capture, then update this number:
    //   npm run build && npm run start &
    //   node scripts/capture-landing-art.mjs
    const BAKED_INTO_THE_PNG = 10;
    expect(
      TASTER_LIMIT,
      `The landing screenshot ${ART} shows "${BAKED_INTO_THE_PNG} free checks left today" as pixels. TASTER_LIMIT is now ${TASTER_LIMIT}. Re-run: node scripts/capture-landing-art.mjs`
    ).toBe(BAKED_INTO_THE_PNG);
  });

  it("the capture script is committed alongside the asset it produces", () => {
    // An undocumented binary nobody can regenerate is how the previous
    // screenshots went stale for a whole design era.
    expect(
      fs.existsSync(path.join(process.cwd(), "scripts/capture-landing-art.mjs"))
    ).toBe(true);
  });

  it("carries alt text, because the capture makes an argument", () => {
    // It sits opposite "The apps want you to become an accountant" and is the
    // evidence for that claim. Decorative alt would drop the argument for
    // anyone not seeing the image.
    //
    // ⚠️ THIS MATCHES SOURCE, NOT RENDER. It looks for the literal characters
    // that open the attribute, so replacing the plain string with an
    // interpolated template takes this guard down WITHOUT failing it — the
    // regex just stops recognising the source and nothing goes red. page.tsx
    // carries the same warning at the call site. Keep the alt a plain string.
    expect(src).toMatch(/alt="The Prediabetes Pal check screen on a phone:[^"]+"/);
  });
});

/**
 * The meals capture (2026-08-11), carousel panel three.
 *
 * Same failure mode as the check capture and the same remedy. This one renders
 * the three VERDICT WORDS as pixels — the fixture rows it is seeded with come
 * back labelled Clear / Be careful / Hold off — and `copy-pins.test.ts`
 * enforces everywhere else on the site that those words are read from
 * RISK_LABELS and never retyped. A screenshot defeats that guard completely,
 * so this pins the coupling instead: rename a verdict and this fails, naming
 * the command that fixes it.
 */
describe("the landing's meals capture cannot drift from the verdict words", () => {
  it("the art file exists where the page references it", () => {
    expect(fs.existsSync(path.join(process.cwd(), MEALS_ART))).toBe(true);
    expect(src).toContain('src="/landing/app-meals.png"');
  });

  it("the verdict words still match the ones baked into the capture", () => {
    // ⚠️ If this fails, a verdict label changed and the PNG is now WRONG on a
    // marketing page. Re-capture, then update these:
    //   NEXT_PUBLIC_PHOTO_INPUT=1 PHOTO_INPUT_ENABLED=1 npm run build
    //   NEXT_PUBLIC_PHOTO_INPUT=1 PHOTO_INPUT_ENABLED=1 npm run start &
    //   node scripts/capture-landing-art.mjs
    const BAKED_INTO_THE_PNG = {
      SAFE: "Clear",
      MODERATE: "Be careful",
      HIGH: "Hold off"
    };
    expect(
      { SAFE: RISK_LABELS.SAFE, MODERATE: RISK_LABELS.MODERATE, HIGH: RISK_LABELS.HIGH },
      `The landing screenshot ${MEALS_ART} shows the verdict words as pixels. Re-run: node scripts/capture-landing-art.mjs`
    ).toEqual(BAKED_INTO_THE_PNG);
  });

  it("the capture script still knows how to produce it", () => {
    // Both shots come from one script, and the script derives its clip from
    // the DOM rather than a typed pixel height — the stale `clipH` that cut
    // the check capture's suggestion chips in half is what that replaced.
    const script = fs.readFileSync(
      path.join(process.cwd(), "scripts/capture-landing-art.mjs"),
      "utf8"
    );
    expect(script).toContain("public/landing/app-meals.png");
    expect(script).toContain("clipTo");
  });

  it("carries alt text describing the screen", () => {
    expect(src).toMatch(/alt="The Prediabetes Pal meals screen on a phone:[^"]+"/);
  });
});
