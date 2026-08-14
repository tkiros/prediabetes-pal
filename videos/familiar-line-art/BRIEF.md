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

Each drawing keeps the SUBJECT of the photograph it replaces, so the change is
medium-only and the six `alt` strings stay true after swapping "photograph"
for "line drawing". Nothing here is a new claim.

## Assets

- ../../public/landing/familiar/*.webp — the six photographs being replaced, 664x360. Delete after the PNGs land.
- ../../DESIGN.md — brand truth (general-video § 6). Not a video design spec; the app's.

## Notes

**Canvas is 664x360 and may not change.** `.landing-familiar-art` declares
`aspect-ratio: 664 / 360` and the intrinsic `width`/`height` on the tag reserve
the box before the file loads. The block was measured at that crop and has
~24px of headroom; a different ratio moves six card heights at once.

⛔ **The art is `object-fit: cover` and crops to `664 / 225` below 640px**
(`app/globals.css`, measured — the full crop ran the block 360px over its
reachability budget on a phone). A photograph survives a centre crop; a line
drawing does not. **Nothing load-bearing may sit in the top or bottom 67px.**
Treat the middle 664x225 as the only safe area.

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
