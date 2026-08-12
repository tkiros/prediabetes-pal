/**
 * The reachability measurement DESIGN.md §11.1 requires.
 *
 *   "Every marketing layout change reports its measured page length, exit count
 *    and desert map at 375px, in the browser, with the real fonts loaded. An
 *    unmeasured desert claim does not count."
 *
 * That rule existed as prose and had never been executable, which is why the
 * tournament shipped estimates that ran 20% low on page length and 35% low on
 * the worst desert. This is the rule, runnable.
 *
 *   pkill -9 -f "[n]ext-server"   # the [n] matters
 *   npm run dev &
 *   node scripts/measure-landing.mjs            # -> human report
 *   node scripts/measure-landing.mjs --json     # -> machine record
 *   node scripts/measure-landing.mjs --tab=2    # -> with carousel panel 3 open
 *
 * ⚠️ ONE TAB STATE PER RUN. The "what does it include" block is a tab list
 * whose panels are different heights, and at 375px the panel sits INSIDE a
 * desert — so the default reading only proves the page is legal with panel one
 * showing. `--tab=N` (0-based, matching the DOM ids) opens another panel before
 * the walk. Measure the TALLEST one before believing a green result; as of
 * 2026-08-11 that is `--tab=2`, the meals capture. Without this flag the
 * tallest panel was measured by hand and the next session could not reproduce
 * the number.
 *
 * Definitions, stated so a later run can be compared to this one:
 *   EXIT     an <a href="/check"> inside <main> — the ways into the product.
 *            Links to /pantry are counted separately: they are a different
 *            offer, not a way to run a check.
 *   DESERT   the vertical gap between one exit's BOTTOM and the next exit's
 *            TOP, in document coordinates. The head desert runs from the top
 *            of the document to the first exit, the tail from the last exit to
 *            the bottom.
 *   BUDGET   no desert may exceed three screenfuls: 2,001px at 375x667.
 */
import { chromium } from "playwright";

const URL = process.env.MEASURE_URL ?? "http://localhost:3000/";
const VIEWPORT = { width: 375, height: 667 };
const BUDGET = VIEWPORT.height * 3; // 2,001px

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: VIEWPORT });
await page.goto(URL, { waitUntil: "networkidle", timeout: 180_000 });

// Real fonts, or every measurement is of a fallback face at the wrong metrics.
await page.evaluate(() => document.fonts.ready);

// Open a non-default carousel panel, if asked. Before the scroll walk, so the
// walk measures the layout the reader would actually have.
const tabArg = process.argv.find((a) => a.startsWith("--tab="));
if (tabArg) {
  const index = Number(tabArg.slice("--tab=".length));
  const tab = page.locator(`#includes-tab-${index}`);
  if ((await tab.count()) === 0) {
    console.error(`no carousel tab #includes-tab-${index} on this page`);
    process.exit(2);
  }
  await tab.click();
  // The panel swap animates its own body open; let it settle before measuring.
  await page.waitForTimeout(600);
}

// Walk the page once so any IntersectionObserver entrance has played. The
// landing's one animation is transform/opacity only and cannot change layout,
// but an unplayed translateY(8px) would still bias every reading below it.
await page.evaluate(async () => {
  for (let y = 0; y < document.documentElement.scrollHeight; y += innerHeight) {
    scrollTo(0, y);
    await new Promise((r) => setTimeout(r, 60));
  }
  scrollTo(0, 0);
});
await page.waitForTimeout(1000);

const measured = await page.evaluate(() => {
  const abs = (el) => {
    const r = el.getBoundingClientRect();
    return { top: Math.round(r.top + scrollY), bottom: Math.round(r.bottom + scrollY) };
  };
  const label = (el) => el.textContent.replace(/\s+/g, " ").trim().slice(0, 44);

  return {
    pageHeight: document.documentElement.scrollHeight,
    exits: [...document.querySelectorAll('main a[href="/check"]')]
      .map((el) => ({ ...abs(el), text: label(el) }))
      .sort((a, b) => a.top - b.top),
    pantryLinks: [...document.querySelectorAll('main a[href="/pantry"]')].map(
      (el) => ({ ...abs(el), text: label(el) })
    ),
    blocks: [...document.querySelectorAll("main .landing-frame > *")].map(
      (el) => ({
        ...abs(el),
        tag: `${el.tagName.toLowerCase()}.${(el.className || "").split(" ")[0]}`
      })
    )
  };
});

await browser.close();

const { pageHeight, exits, pantryLinks, blocks } = measured;

const deserts = [];
if (exits.length) {
  deserts.push({ from: "top of page", to: exits[0].text, px: exits[0].top });
  for (let i = 1; i < exits.length; i += 1) {
    deserts.push({
      from: exits[i - 1].text,
      to: exits[i].text,
      px: exits[i].top - exits[i - 1].bottom
    });
  }
  deserts.push({
    from: exits.at(-1).text,
    to: "bottom of page",
    px: pageHeight - exits.at(-1).bottom
  });
}

const worst = deserts.reduce((a, b) => (b.px > a.px ? b : a), { px: -1 });
const record = {
  url: URL,
  viewport: VIEWPORT,
  pageHeight,
  screenfuls: +(pageHeight / VIEWPORT.height).toFixed(1),
  exitCount: exits.length,
  pantryLinkCount: pantryLinks.length,
  budget: BUDGET,
  worstDesert: worst.px,
  overBudget: deserts.filter((d) => d.px > BUDGET),
  deserts,
  exits,
  blocks
};

if (process.argv.includes("--json")) {
  console.log(JSON.stringify(record, null, 2));
} else {
  const screens = (px) => `${(px / VIEWPORT.height).toFixed(1)} screenfuls`;
  console.log(`\n${URL}  @ ${VIEWPORT.width}x${VIEWPORT.height}`);
  console.log(`page length   ${pageHeight}px  (${record.screenfuls} screenfuls)`);
  console.log(`exits         ${exits.length} to /check, ${pantryLinks.length} to /pantry`);
  console.log(`budget        ${BUDGET}px per desert (3 screenfuls)`);
  console.log(`worst desert  ${worst.px}px  (${screens(worst.px)})  ${worst.px > BUDGET ? "OVER" : "within budget"}\n`);
  console.log("blocks");
  for (const b of blocks) console.log(`  ${String(b.top).padStart(6)} → ${String(b.bottom).padStart(6)}  ${b.bottom - b.top}px  ${b.tag}`);
  console.log("\ndeserts");
  for (const d of deserts) {
    console.log(
      `  ${String(d.px).padStart(6)}px  ${d.px > BUDGET ? "OVER " : "     "}${d.from}  →  ${d.to}`
    );
  }
  console.log("");
}

process.exitCode = record.overBudget.length ? 1 : 0;
