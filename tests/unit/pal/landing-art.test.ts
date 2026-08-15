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

/**
 * The six "If this sounds familiar" drawings (owner ruling 2026-08-14, which
 * replaced the generated photographs this block shipped with).
 *
 * ⛔ Why this exists. The two guards above pin a value the capture renders as
 * pixels — the free-check count, the three verdict words — because a
 * screenshot defeats `copy-pins.test.ts` completely.
 *
 * ⚠️ This block used to claim a line drawing bakes no such value in, and was
 * deliberately thin on that basis. It was wrong. Every composition hardcodes
 * `--accent-strong` and `--accent-tint` as literal hexes, because a renderer
 * outside this repo cannot read a CSS custom property — so these six PNGs
 * carry two design tokens as pixels, in the same way the captures carry
 * copy. The colour pin at the foot of this block is that coupling, and the
 * 664x360 pin is the other one the thin version missed.
 *
 * What is ALSO worth pinning is the coupling the repo has been bitten by twice: the
 * page names six files, the files are produced OUTSIDE every gate this repo
 * runs (a HyperFrames render in `videos/familiar-line-art/`), and a marketing
 * page that 404s six images is invisible to lint, typecheck and the whole unit
 * suite. `app-check.png` shipped a retired product name in pixels for two days
 * for exactly this reason: no guard here reads an image.
 */
describe("the landing's six familiar drawings exist and are regenerable", () => {
  // ⛔ DERIVED FROM THE PAGE, NEVER HAND-COPIED. This was a literal array
  // transcribed from `FAMILIAR` in app/page.tsx, which meant a seventh card
  // added there with no PNG behind it passed every assertion in this file
  // while the page 404'd an image — the guard would have been checking the six
  // names it already knew about and nothing else. Reading the page's own keys
  // is what makes "the page names a file that is not there" detectable at all.
  const FAMILIAR_ART = [...src.matchAll(/art: "([a-z-]+)"/g)].map((m) => m[1]);

  // ⛔ The re-render command every failure below prints. Kept in one place so
  // the three that name it cannot drift apart, and correct in the two ways the
  // old copy was not: it PINS the CLI version (the project pins 0.7.86 in its
  // own npm scripts precisely so a re-render is reproducible; bare
  // `npx hyperframes` fetches whatever is current and silently renders with a
  // different engine), and it does not stop at `-o renders/<name>`, which is a
  // gitignored path. Following the old text verbatim left the test still red
  // with no idea why, because the PNG the page reads had never been updated.
  const rerender = (name: string) =>
    `  cd videos/familiar-line-art\n` +
    `  npx --yes hyperframes@0.7.86 render . -c compositions/${name}.html \\\n` +
    `    --format=png-sequence -o renders/${name} --fps 1\n` +
    `  cp renders/${name}/frame_000001.png ../../public/landing/familiar/${name}.png\n` +
    `  npx --yes hyperframes@0.7.86 check .\n` +
    `  # then re-screenshot ALL SIX cards at 375px — the crop is 664/225 there\n` +
    `  # and three frames place their lowest ink within ~1px of its edge.`;

  it("the page names exactly six drawings", () => {
    // The block IS six cards (ledger `landing-familiar-cards`), and every
    // assertion below is generated from this list — an empty or short match
    // would make the whole describe vacuously green, which is the failure mode
    // a derived list trades for the hand-copied one it replaces.
    expect(
      FAMILIAR_ART,
      "app/page.tsx no longer yields six `art:` keys. If a card was added or removed deliberately, update this count and the copy ledger together."
    ).toHaveLength(6);
    expect(new Set(FAMILIAR_ART).size).toBe(FAMILIAR_ART.length);
  });

  it.each(FAMILIAR_ART)("%s.png is on disk", (name) => {
    expect(
      fs.existsSync(path.join(process.cwd(), `public/landing/familiar/${name}.png`)),
      `public/landing/familiar/${name}.png is missing. Re-render it:\n${rerender(name)}`
    ).toBe(true);
  });

  it.each(FAMILIAR_ART)("%s is 664x360, the ratio the card is built to", (name) => {
    // ⛔ 664x360 IS LOAD-BEARING, as app/page.tsx says in as many words:
    // `.landing-familiar-art` pins that aspect ratio and crops to 664/225
    // below 640px, so a frame drawn to a different ratio moves six card
    // heights at once and re-crops six drawings. Nothing pinned it — the guard
    // called fs.existsSync and stopped, so a re-render at another size shipped
    // green. The two app captures are pinned this way; this is the same read.
    //
    // ⚠️ NO deviceScaleFactor here. The capture script shoots at 2x so its
    // PNGs are twice their CSS size; HyperFrames renders these 1:1, so the
    // header IS the declared size. Do not copy the `/2` from the block above.
    const header = fs
      .readFileSync(path.join(process.cwd(), `public/landing/familiar/${name}.png`))
      .subarray(16, 24);
    expect(
      [header.readUInt32BE(0), header.readUInt32BE(4)],
      `${name}.png is ${header.readUInt32BE(0)}x${header.readUInt32BE(4)}, not 664x360. The card's aspect-ratio and its 664/225 phone crop are both built to that frame. Re-render it:\n${rerender(name)}`
    ).toEqual([664, 360]);
  });

  it("the page still asks for .png, which is what the renderer emits", () => {
    // ⚠️ Interpolated on purpose — one literal, six cards. If this ever goes
    // back to .webp the six PNGs stop resolving and nothing else fails.
    expect(src).toContain("`/landing/familiar/${art}.png`");
  });

  it("the compositions that produce them are committed", () => {
    // An undocumented binary nobody can regenerate is how this page's previous
    // screenshots went stale for a whole design era.
    for (const name of FAMILIAR_ART) {
      expect(
        fs.existsSync(
          path.join(process.cwd(), `videos/familiar-line-art/compositions/${name}.html`)
        ),
        `The drawing ${name}.png has no source composition. Do not hand-edit the PNG.`
      ).toBe(true);
    }
  });

  it("every drawing carries alt text that describes a drawing", () => {
    // ⛔ `landing-familiar-cards` (copy ledger): the alt describes the PICTURE,
    // never the product — these are mood, not evidence. They now describe a
    // line drawing, because they used to describe a photograph and the medium
    // changed underneath them.
    const alts = src.match(/alt: "A line drawing of [^"]+"/g) ?? [];
    expect(alts).toHaveLength(FAMILIAR_ART.length);
  });

  it("the ink and ground the drawings bake in are still the page's tokens", () => {
    // ⛔ THE DOCBLOCK ABOVE USED TO SAY "A line drawing bakes no such value in".
    // That is false, and it is the reason this test exists. Every composition
    // hardcodes the palette as literal hexes — a renderer outside this repo
    // cannot read a CSS custom property — so the drawings carry two of the
    // page's design tokens as PIXELS. Change either token and six images ship
    // the old colour against the new ground, with lint, typecheck, the axe
    // spec and every other gate green: exactly the drift the TASTER_LIMIT and
    // RISK_LABELS pins above exist to stop, in colour rather than in words.
    //
    // The fix when this fails is to re-render, not to edit the number here.
    const css = fs.readFileSync(path.join(process.cwd(), "app/globals.css"), "utf8");
    const token = (name: string) =>
      css.match(new RegExp(`--${name}:\\s*(#[0-9a-f]{3,8})`, "i"))?.[1]?.toLowerCase();

    // Ink, then ground. Named here so a failure says which is which.
    const ink = token("accent-strong");
    const ground = token("accent-tint");
    expect([ink, ground], "app/globals.css no longer defines both accent tokens").toEqual([
      "#0a4a44",
      "#e6f2ef"
    ]);

    for (const name of FAMILIAR_ART) {
      const composition = fs.readFileSync(
        path.join(process.cwd(), `videos/familiar-line-art/compositions/${name}.html`),
        "utf8"
      );
      for (const [role, hex] of [
        ["ink (--accent-strong)", ink],
        ["ground (--accent-tint)", ground]
      ] as const) {
        expect(
          composition.toLowerCase(),
          `${name}.html no longer carries ${hex} as its ${role}. The six PNGs are rendered from these files and bake the colour in, so a token change means a re-render, not an edit to this test:\n${rerender(name)}`
        ).toContain(hex!);
      }
    }
  });
});
