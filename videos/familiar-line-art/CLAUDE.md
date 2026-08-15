# familiar-line-art — six drawings for one landing block

⚠️ **This file replaced 95 lines of unedited HyperFrames scaffold** (2026-08-15).
That scaffold routed to nine workflows this project does not use, documented
`npm run render # render to MP4` for a project whose only output is one PNG per
composition, and described a `transcript.json`, audio tracks and a preview
server that do not exist here. `AGENTS.md` beside it was byte-identical. Being
the file an agent reads first, it was the most misleading document in the
directory. If you want the framework's general docs, run
`npx hyperframes docs <topic>` — do not paste them back in here.

## What this is

Six single-frame line drawings, one per composition in `compositions/`,
rendered to `../../public/landing/familiar/*.png` and read by the
"If this sounds familiar" block in `app/page.tsx` (`FAMILIAR`).

No motion, no audio, no MP4. `data-duration` exists only because the
composition contract requires it.

**Read `BRIEF.md` before drawing anything.** It holds the constraints that are
actually binding: the 664x360 canvas, the destructive phone crop and its safe
band, the no-faces / no-legible-text ledger row, the palette, and the stroke
weight.

## Re-rendering one drawing

```bash
cd videos/familiar-line-art
npx --yes hyperframes@0.7.86 render . -c compositions/<name>.html \
  --format=png-sequence -o renders/<name> --fps 1
cp renders/<name>/frame_000001.png ../../public/landing/familiar/<name>.png
npx --yes hyperframes@0.7.86 check .          # must stay 0 errors
```

⛔ **Use the pinned version, not bare `npx hyperframes`.** The pin is what makes
a re-render reproducible; bare `npx` fetches whatever is current and quietly
renders with a different engine. To move the pin:
`npx hyperframes@latest upgrade --project . --check`, apply it, then re-render
and name both versions in the commit.

⛔ **`renders/` is gitignored.** The `cp` is not optional — skip it and the PNG
the page actually loads is unchanged, while everything looks like it worked.

⛔ **Never hand-edit the PNGs.** The compositions are the source; a binary
nobody can regenerate is how this page's previous artwork went stale for a
whole design era.

## After any re-render

⛔ **Screenshot all six cards at 375px**, not just the one you touched. The
phone crop removes 135px of the 360 and three frames place their lowest ink
within ~1px of its edge, so one frame passing says nothing about the rest.
Nothing in the repo's test suite can see a drawing that lost its subject.

`npm run test` does pin what it can from outside: that each PNG exists, is
664x360, is named by the page, has a committed composition, carries alt text
beginning "A line drawing of", and still bakes the app's two accent tokens
(`tests/unit/pal/landing-art.test.ts`). A token change means a re-render, not
an edit to that test.
