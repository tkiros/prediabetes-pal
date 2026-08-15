#!/usr/bin/env node
// Captures the landing page's app screenshots from the running app.
//
// Owner instruction 2026-08-05: fill the landing's empty right columns with
// "fresh screenshots captured from the running app" rather than illustrations.
// These are REAL app routes at a phone viewport, not mockups.
//
// ⚠️ These PNGs go stale on every UI change and are versioned assets. Re-run
// this script whenever the captured routes change:
//   npm run build && npm run start &
//   node scripts/capture-landing-art.mjs
//
// ⛔ RUN IT AGAINST A PRODUCTION BUILD, NOT `next dev`. The check form is a
// client component and under `next dev` it never gets past its "One moment"
// placeholder in a headless context — a dev capture is a screenshot of a
// loading state. Learned 2026-08-11, after a dev-mode capture produced exactly
// that.
//
// ⛔ BUILD IT WITH THE FLAGS THE DEPLOYED CANDIDATE HAS. `NEXT_PUBLIC_*` is
// inlined at build time, so a capture from a flag-off build shows a different
// screen from the one production serves. As of 2026-08-11 that means:
//   NEXT_PUBLIC_PHOTO_INPUT=1 PHOTO_INPUT_ENABLED=1 npm run build
// which is what production has set (docs/release/truth-index.md), and it is
// why the check capture shows three input chips with a Premium tag on the
// third rather than two.
//
// Phone viewport at deviceScaleFactor 2 on purpose: the column renders around
// 390px wide, so a 1280px desktop capture scaled down would be illegible. A
// phone-shaped capture reads at 1:1 there and is retina-sharp.
import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const BASE = process.env.SCREENSHOT_BASE_URL ?? "http://127.0.0.1:3000";

// ⛔ THE CLIP IS DERIVED FROM THE DOM, NEVER TYPED. Until 2026-08-11 this file
// carried `clipH: 700` with a comment naming the two cards it landed between.
// The /check layout moved underneath it and the number stayed, so a re-run cut
// the suggestion chips in half — a stale magic number that no test could see,
// and one the 2026-08-11 handoff had to carry as a standing warning. Each shot
// now names the element its capture should END AT; the script measures that
// element and pads into the gap below it. Move the layout and the clip follows.
const SHOTS = [
  {
    // ?stay=1 defeats FirstRunGate's redirect to /onboarding, the same way the
    // e2e warmup does it. Without it a fresh context captures onboarding.
    path: "/check?stay=1",
    file: "public/landing/app-check.png",
    // The form is client-rendered; without this the capture races the
    // placeholder. Waiting on the LAST chip in the row also proves the build
    // under capture actually has the flag set.
    waitFor: "[data-testid='photo-input-button']",
    // Ends just under the free-checks counter. Everything the step-one caption
    // claims is above this line: the description box, the input chips, the A1C
    // field, the button. Below it are suggestion chips and an empty answer
    // placeholder — the placeholder in particular photographs as a blank box.
    clipTo: ".taster-counter"
  },
  {
    // "Learn your patterns" — carousel panel three. The signed-out /meals page
    // falls back to the on-device store (`fetchHistoryPage` returns `guest`,
    // and the page then reads `historyStore.all()`), so seeding localStorage
    // gets the REAL screen with fixture rows. No auth, no DB, no mocking.
    //
    // ⛔ The fixture is the /demo contract applied to a route instead of a
    // component: real component, real rendering, fixture DATA. It is not a
    // drawing, which is the thing this page has refused since 2026-08-05.
    path: "/meals?stay=1",
    file: "public/landing/app-meals.png",
    seedHistory: true,
    waitFor: "[data-testid='week-strip']",
    // Three meals is enough to read as a record and keeps the capture the same
    // phone-shaped crop as the check shot. The search/date filters render only
    // for a signed-in reader, so there is nothing below the list to cut into.
    // ⛔ Not `.history-filters` — that was the first guess and it matches
    // nothing on the guest page, which is what the thrown error below is for.
    clipTo: ".history-list .history-item:nth-child(3)"
  }
];

/**
 * Six checks over the last five days, written at capture time so the screen
 * shows relative recency rather than baking a date into pixels.
 *
 * ⛔ MEAL NAMES COME FROM THE LANDING'S OWN APPROVED FIXTURES. Three of these
 * are the `landing-three-answers` meals verbatim; the rest are the same shape
 * of everyday description. Nothing here is invented product OUTPUT — a stored
 * check carries only what the user typed plus the verdict it got, and the
 * verdicts are the engine's three, so this seeds no copy the page has not
 * already had approved.
 */
const HISTORY_FIXTURE = `(() => {
  const hoursAgo = (h) => new Date(Date.now() - h * 3600 * 1000).toISOString();
  return [
    ["Grilled chicken, brown rice, and a side salad", "SAFE", 2],
    ["A bagel with jam and a glass of orange juice", "MODERATE", 26],
    ["Greek yogurt with walnuts", "SAFE", 30],
    ["A large soda with fries on the side", "HIGH", 52],
    ["Lentil soup and a slice of rye bread", "SAFE", 76],
    ["Porridge with honey", "MODERATE", 99]
  ].map(([food, risk, h], i) => ({
    clientId: "landing-fixture-" + i,
    food,
    risk,
    a1cBand: "5.7-6.4",
    inputMethod: "text",
    createdAt: hoursAgo(h)
  }));
})()`;

await mkdir("public/landing", { recursive: true });
const browser = await chromium.launch();

const VIEWPORT = { width: 390, height: 844 };

for (const shot of SHOTS) {
  // ⛔ ONE PAGE PER SHOT, not one page for the run. `addInitScript` registers
  // for every subsequent navigation on the page that receives it, so a seeded
  // shot used to leak its localStorage fixture into every shot after it. That
  // was inert only because the seeded shot happens to be last — an ordering
  // dependency nothing asserted. A fresh page makes the seed genuinely
  // per-shot and costs one browser context.
  const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: 2 });

  if (shot.seedHistory) {
    // Before `goto`, or the page reads the store before the seed lands.
    await page.addInitScript(`
      try {
        window.localStorage.setItem("pal.history.v1", JSON.stringify(${HISTORY_FIXTURE}));
      } catch {}
    `);
  }

  await page.goto(`${BASE}${shot.path}`, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  if (shot.waitFor) {
    await page.waitForSelector(shot.waitFor, { timeout: 60_000 });
  }
  // Entrance transitions and the fonts swapping in both move things a few px.
  await page.waitForTimeout(1200);

  const clipH = await page.evaluate((selector) => {
    const el = document.querySelector(selector);
    if (!el) return null;
    // 8px into the gap under the element, so the cut is clearly past it rather
    // than shaving its bottom border.
    //
    // ⛔ VIEWPORT COORDINATES, deliberately — no `+ scrollY`. The screenshot
    // below is NOT `fullPage`, and a non-fullPage `clip` is read against the
    // viewport. Adding the scroll offset mixed document and viewport space;
    // it was inert only because nothing on these two routes scrolls before
    // the capture, which is not a property anything enforces.
    return Math.round(el.getBoundingClientRect().bottom + 8);
  }, shot.clipTo);

  if (clipH === null) {
    throw new Error(
      `${shot.file}: no element matched ${shot.clipTo} on ${shot.path}. The layout moved — pick the new element the capture should end at rather than typing a pixel height.`
    );
  }

  // ⛔ A non-fullPage clip is SILENTLY TRIMMED to the viewport. Push the
  // element this shot ends at below 844px and the capture would just stop
  // there — the exact stale-crop failure `clipTo` exists to prevent, back
  // again and invisible. Throw instead.
  //
  // ⚠️ The fix is NOT `fullPage: true`. Both PNGs' dimensions are pinned in
  // tests/unit/pal/landing-art.test.ts against what app/page.tsx declares, so
  // changing what the capture contains owes a re-capture — which needs a
  // production build carrying the deployed flags (see the header). Taller
  // shots want a taller viewport here, and the pinned heights updated with it.
  if (clipH > VIEWPORT.height) {
    throw new Error(
      `${shot.file}: ${shot.clipTo} ends at ${clipH}px, past the ${VIEWPORT.height}px viewport. Playwright would trim the clip silently. Raise VIEWPORT.height, re-capture, and update the declared height in app/page.tsx.`
    );
  }

  await page.screenshot({
    path: shot.file,
    clip: { x: 0, y: 0, width: VIEWPORT.width, height: clipH }
  });
  console.log(`captured ${shot.file}  ${VIEWPORT.width}x${clipH}`);
  await page.close();
}

await browser.close();
