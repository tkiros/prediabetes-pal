# Social carousels

Six-slide photo carousels for Instagram, Facebook, Pinterest and TikTok photo
mode. One template, one JSON file; each new post is a JSON entry, never a
layout edit.

The format and the reasoning behind it are in
`docs/research/pcospal-tiktok-adaptation.md` — a competitor built 20K followers
and 3.3M views on exactly this, with no camera, no face and no video.

## Make a post

0. If `../screenshots/` is empty, populate it — it is **gitignored**, so a
   fresh clone has none of it and slide 6 renders a dashed placeholder:
   `npx next dev` then `node scripts/capture-marketing-shots.mjs`.
1. Add an entry to `posts.json` (copy the last one, bump `part`).
2. `npx vitest run tests/unit/revora/claims-boundary-copy.test.ts`
3. `node scripts/render-carousel.mjs <part>`
4. Post `out/pt-NN/01.png` … `06.png` in order, with the entry's `caption`.

Step 2 is not optional and not a formality — see "The audit" below.

## Files

| | |
|---|---|
| `template.html` | Layout, tokens, slide markup. Open it directly in a browser and call `renderPost(...)` from the console to eyeball a change. |
| `posts.json` | All copy. The only file a new post touches. |
| `../../scripts/render-carousel.mjs` | Playwright renderer → `out/pt-NN/*.png` at 1080×1350. |
| `out/` | Generated. Safe to delete; regenerate with the script. |

## The deck is fixed at six slides

Cover → four pairs → CTA. The renderer throws if a post has anything other
than four pairs. 41 of the competitor's 51 posts were exactly six slides; the
constraint is what makes the series cheap to produce, so it is enforced rather
than documented.

## The audit

`posts.json` is in `EXTRA_SOURCES` in
`tests/unit/revora/claims-boundary-copy.test.ts`, so every slide string and
caption is scanned against the same banned families as shipped product copy.
The regex is **negation-blind** — writing a claim in order to refute it fails
identically to asserting it.

Two that bite in a food carousel specifically, and both appear in the
competitor's own slides:

- **`cure`** — "cured meats" trips it. Say "deli meats".
- **`treat`** — "sweet treats" trips it. Say "something sweet".

Also avoid: `reverse`, `prevent`, `diagnose`, `guarantee`, "will lower",
`mg/dL`, a GI/GL term with a number attached, and any sentence that promises
"a swap" or "an adjustment" without the conditional (`unconditional-swap` —
a `Clear` result structurally carries neither, which is why the promise has to
be hedged). The pair labels are `Instead of` / `Try` for this reason.

## What the template will not let you remove

**The disclaimer.** It is hard-coded in `template.html`, not read from
`posts.json`, and renders on every slide that carries a verdict word or a
product claim. If it costs you layout room, shorten the slide.

**The verdict chip is a label, not a screenshot.** It uses the product's words
(`lib/revora/labels.ts`) and the product's tokens, but it does not impersonate
the result card. The card appears once, on slide 6, as a real `/demo` capture —
which is what `docs/runbooks/marketing-assets.md` requires of off-site assets.

## One open question, for whoever owns the claims perimeter

**The cover eyebrow and the A1C-value ban.** `marketing-assets.md` §Hard bans
says no A1C values in any asset. The landing page states the 5.7–6.4 range
above the fold, and on short-form a range like that is a strong
self-qualifying hook — it stops exactly the right reader and nobody else. The
default here is the non-numeric `"Built only for prediabetes"`. If the intent
of the ban is *the reader's own value and before/after numbers* rather than
*the scope statement the landing already ships*, the range is the better hook.
Not a default to drift into either way.

## Cadence

Every 2–3 days. This is the finding with the clearest evidence behind it: the
competitor held a ~46K median at that rhythm, dropped to one post in a month,
collapsed to ~7K, and never recovered — nine posts crammed into the following
ten days did not buy it back.

## Photos

`cover.photo` and each side's `img` take a path relative to this folder, and
render a labelled placeholder when null, so the deck composes before any
photography exists. Cover shots are **back to camera, no face** — no creator
identity to maintain across thirty posts, and the reader projects herself into
the frame.
