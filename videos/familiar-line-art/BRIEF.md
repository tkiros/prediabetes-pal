---
workflow: general-video
flow: automation
storyboard: no
message: "Six still lifes of the gap between a prediabetes result and tonight's dinner"
aspect: 664x360
language: en
length: still
angle: concept
---

## Intent

Six single-frame line drawings that replace the generated photographs on the
Prediabetes Pal landing page's "If this sounds familiar, you're not the
problem" block (`app/page.tsx`, `FAMILIAR`). Owner asked for drawings instead
of photographs; owner also chose this framework over inline SVG after being
told HyperFrames is a video tool. Single-weight line art, one hue.

Each drawing keeps the SUBJECT of the photograph it replaces — the fridge, the
appointment card, the tabs, the scale, the plate, the notebook. Nothing here is
a new claim: these are mood, and the copy-ledger row below governs what they
may contain.

⚠️ **"Medium-only" was the plan, not the outcome, and this paragraph used to
say otherwise.** Two things changed with the medium:

- **Card one lost its hand.** The retired photograph had one; drawn unfilled it
  read as a blob, and as a filled palm it read as a plug. It is not in the
  shipped frame. ⛔ If a hand is wanted it needs a DIFFERENT approach, not a
  third attempt at the same one.
- **All six `alt` strings were rewritten**, not patched by swapping one noun.
  They describe what is actually drawn, which is not what the photographs
  showed. `app/page.tsx` holds them; `landing-art.test.ts` pins that each one
  opens "A line drawing of".

## Assets

- ../../DESIGN.md — brand truth (general-video § 6). Not a video design spec; the app's.

The six photographs these replaced were `public/landing/familiar/*.webp`. They
are **deleted** — this list named them as inputs long after they left the repo.
The generation prompts that produced them survive in
`docs/landing/2026-08-11-design-copy-7-rules-audit.md` as the record of what
they were; nothing in this project reads them.

## Notes

**Canvas is 664x360 and may not change.** `.landing-familiar-art` declares
`aspect-ratio: 664 / 360` and the intrinsic `width`/`height` on the tag reserve
the box before the file loads. The block was measured at that crop and has
~24px of headroom; a different ratio moves six card heights at once.

⛔ **The art is `object-fit: cover` and crops to `664 / 225` below 640px**
(`app/globals.css`, measured — the full crop ran the block 360px over its
reachability budget on a phone). A photograph survives a centre crop; a line
drawing does not. **Nothing load-bearing may sit in the top or bottom 67px.**
Treat the middle 664x225 — y 67 to 293 — as the only safe area.

⚠️ **"Nothing load-bearing" is the rule, and a deliberate exception exists.**
`fridge-door.html` bleeds its cabinet past the band on purpose: a cabinet
cropped top and bottom still reads as a cabinet, while the shelves and
everything on them — which carry the picture — stay inside it. The test is
whether the SUBJECT survives the crop, not whether ink stays inside a
rectangle. That exception was recorded only in the composition's own comment
until 2026-08-15; if you take another one, record it in both places.

⛔ **The crop is invisible to every gate in this repo.** Lint, typecheck, the
unit suite, the contract validators and the axe spec all stay green through a
drawing that loses its subject on a phone. The only check is to screenshot the
block at **375px** — and to re-screenshot **all six** when you re-render one,
because three frames place their lowest ink within ~1px of the crop edge.

⛔ **Constraints inherited from the `landing-familiar-cards` copy-ledger row,
all still binding:** every frame is a still life or a hand — **no faces, no
legible text, nobody who could be read as a customer.** This page renders no
social proof and a person in these cards would manufacture some. Legible text
includes digits, so the kitchen scale's display stays blank.

**Palette, from the app's tokens — no new colour is introduced.**
Line `--accent-strong` #0a4a44, ground `--accent-tint` #e6f2ef. The cards sit
at `--page-bg` #f2f7f6 on a full-bleed white sheet, so a white art panel would
read as a nested card and "cards earn existence" (DESIGN.md).

**Stroke is 3px at 664 wide**, which lands at 1.5px on the ~330px display box —
the same hairline the design file uses for the result-card border. One weight
everywhere; that is the whole style.

**No motion, no audio.** The landing has exactly one animation by design
(`.landing-pause-stage`) and that is recorded as deliberate. These are stills:
`data-duration` exists only because the composition contract requires it.
