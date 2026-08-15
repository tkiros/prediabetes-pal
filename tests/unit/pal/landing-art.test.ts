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

  it("only renders in a photo-flag-ON build, because that is what it pictures", () => {
    // ⛔ The capture is taken against a photo-flag-ON build —
    // capture-landing-art.mjs waits on [data-testid='photo-input-button'] — so
    // it bakes in the third input chip and its Premium tag. Rendered
    // unconditionally, a photo-off build advertises a control /check does not
    // draw. Every other photo-dependent surface on the page already branches
    // on photoInputEnabled(); this one did not, and the only thing holding it
    // was a sentence in docs/ops/env-reference.md. No gate reads a PNG, so
    // this pins the branch in source instead.
    //
    // ⚠️ SOURCE, NOT RENDER — same caveat as the alt pin below.
    const guarded = /\{photoEnabled \? \([\s\S]{0,400}?src="\/landing\/app-check\.png"/;
    expect(
      src,
      "app-check.png must render inside a `photoEnabled ?` branch — it pictures the photo chip"
    ).toMatch(guarded);
  });

  it("declares the height the PNG actually is, or the box collapses on load", () => {
    // The <img> has no CSS aspect-ratio, so the browser reserves the box from
    // these attributes and re-lays out when the bytes arrive. app-check.png
    // went 1400 -> 1360 device px when clipH became derived rather than typed,
    // and height={700} was left behind: a ~2.9% collapse directly above a
    // measured exit. Read the real size instead of trusting a literal.
    for (const [file, name] of [
      [ART, "app-check.png"],
      [MEALS_ART, "app-meals.png"]
    ] as const) {
      const header = fs.readFileSync(path.join(process.cwd(), file)).subarray(16, 24);
      // deviceScaleFactor 2 in the capture script, so CSS px is half.
      const cssW = header.readUInt32BE(0) / 2;
      const cssH = header.readUInt32BE(4) / 2;
      const declared = src.match(
        new RegExp(`src="/landing/${name.replace(".", "\\.")}"[\\s\\S]{0,400}?width=\\{(\\d+)\\}\\s*height=\\{(\\d+)\\}`)
      );
      expect(declared, `no width/height found next to ${name}`).not.toBeNull();
      expect(
        [Number(declared![1]), Number(declared![2])],
        `${name} is ${cssW}x${cssH} CSS px; app/page.tsx declares ${declared![1]}x${declared![2]}. Re-run node scripts/capture-landing-art.mjs or fix the attributes.`
      ).toEqual([cssW, cssH]);
    }
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
    //
    // ⛔ THE ASSERTION IS THE ABSENCE OF A TYPED HEIGHT, not the presence of
    // the word `clipTo`. `toContain("clipTo")` was satisfied by the script's
    // own COMMENTS — the ones explaining why the typed height was removed —
    // so reverting to `clipH: 700` left this test green while restoring the
    // exact defect it was written to catch.
    const script = fs.readFileSync(
      path.join(process.cwd(), "scripts/capture-landing-art.mjs"),
      "utf8"
    );
    expect(script).toContain("public/landing/app-meals.png");
    // ⛔ CODE ONLY. The script's header explains, in prose, that it used to
    // carry `clipH: 700` — so asserting against the raw file makes the record
    // of the defect trip the guard against the defect. That is the same
    // read-the-comments-as-code mistake this test was fixed for, inverted.
    const code = script
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    expect(
      code,
      "capture-landing-art.mjs declares a literal clipH again. The clip must be MEASURED from the element named by clipTo — a typed pixel height goes stale the next time /check or /meals moves, and no test can see a mis-cropped PNG."
    ).not.toMatch(/clipH\s*:\s*\d/);
    // Every shot names the element it ends at, as a real property.
    const shots = code.match(/^\s*file:\s*"/gm) ?? [];
    const clipTos = code.match(/^\s*clipTo:\s*"/gm) ?? [];
    expect(clipTos.length, "every shot needs its own clipTo").toBe(shots.length);
    expect(shots.length).toBeGreaterThanOrEqual(2);
  });

  it("carries alt text describing the screen", () => {
    expect(src).toMatch(/alt="The Prediabetes Pal meals screen on a phone:[^"]+"/);
  });
});
