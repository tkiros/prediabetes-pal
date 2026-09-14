import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import type { Daypart } from "../../lib/coach/insights";
import { ideasFor } from "../../lib/pal/guide-ideas";
import { doorSurfaceOn } from "./guide-door";

// Dashboard smoke (M1): FirstRunGate regression, guest day-0, guest with
// data, and the >=1024px shell. Both configured projects are mobile devices,
// so desktop assertions set the viewport explicitly.

// WS-7: the per-suite retries:2 override is gone — `npm run e2e` runs
// optimized `next start` servers, so the dev cold-compile race this shielded
// no longer exists, and silent retries hide real flakes. The serial warm-up
// below stays (cheap, keeps first-hit latency out of test budgets).

test.beforeAll(async ({ playwright }) => {
  const request = await playwright.request.newContext({
    baseURL: "http://127.0.0.1:3100"
  });
  try {
    for (const route of ["/home", "/check", "/onboarding"]) {
      await request.get(route, { timeout: 90_000 }).catch(() => {});
    }
  } finally {
    await request.dispose();
  }
});

function moderateResult() {
  return {
    kind: "result",
    risk: "MODERATE",
    reason: "This leans heavily on refined carbs.",
    adjustment: "If practical, add protein or nonstarchy vegetables.",
    swap: "If you have the option, swap to a less refined version.",
    disclaimer: "Not medical advice."
  };
}

async function stubModerate(page: Page) {
  await page.route("**/api/check", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(moderateResult())
    });
  });
}

test("CRITICAL REGRESSION: brand-new visitor at /home is routed to onboarding", async ({
  page
}) => {
  // Empty localStorage = no checks, no profile, no taster → FirstRunGate fires.
  await page.goto("/home");
  await expect(page).toHaveURL(/\/onboarding/);
});

test("guest day-0 dashboard: preview note, CTA above the fold, top bar only", async ({
  page
}) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto("/home?stay=1");

  await expect(page.getByTestId("dash-day0-note")).toBeVisible();
  const cta = page.getByTestId("dash-check-cta");
  await expect(cta).toBeVisible();

  // Design-review pin: the visible date title is Home's h1 (was a styled <p>,
  // leaving Home with no h1 at all).
  await expect(page.getByRole("heading", { level: 1 })).toHaveClass(
    /dash-greet-date/
  );

  // Decision #8: at <768px the check CTA is the first interactive element
  // above the fold.
  const box = await cta.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.y + box!.height).toBeLessThanOrEqual(667);

  await expect(page.locator(".app-topbar")).toBeVisible();
  await expect(page.locator(".app-tabbar")).toBeVisible();
  await expect(page.locator(".app-sidebar")).toBeHidden();

  // C7 four-jobs: five tab slots, the accent Check action among them.
  await expect(page.locator(".app-tabbar .app-tab")).toHaveCount(5);
  await expect(page.locator(".app-tabbar .app-tab-action")).toHaveText(/Check/);
});

test("guest dashboard fills in from on-device history", async ({ page }) => {
  await stubModerate(page);
  await page.goto("/check?stay=1");
  await page
    .getByLabel(/what are you thinking about eating/i)
    .fill("white rice with beans");
  await page.getByLabel(/latest a1c/i).fill("6.1");
  await page.getByRole("button", { name: "Check this meal" }).click();
  await expect(page.getByTestId("result-card")).toBeVisible();

  await page.goto("/home?stay=1");
  await expect(page.getByTestId("today-list")).toContainText(
    "white rice with beans"
  );
  // A-106 (Task 1.8 fix round 1): with the guide door's ideas surface on, the
  // greeting is one date line — the week summary is not rendered (/journey
  // owns the week). The branch follows the built app's effective state from
  // /api/health (Task 1.12). Asserted after today-list, so the guest data has
  // loaded before absence is checked.
  if (await doorSurfaceOn("ideas")) {
    await expect(page.getByTestId("dash-summary")).toHaveCount(0);
  } else {
    await expect(page.getByTestId("dash-summary")).toContainText(
      "1 meal checked this week."
    );
  }

  // C7: Home is "help me decide now" — exactly one next-action line, and the
  // week strip / insight / progress surfaces live on /journey, not here.
  await expect(page.getByTestId("next-action")).toHaveCount(1);
  await expect(page.getByTestId("dash-week")).toHaveCount(0);
  await expect(page.getByTestId("dash-insight")).toHaveCount(0);
  await expect(page.getByTestId("dash-progress")).toHaveCount(0);

  // RV-3: no score/band/percent language on Home.
  const text = await page.locator("main").innerText();
  expect(text).not.toMatch(/%/);
  expect(text).not.toMatch(/excellent|on track|building|getting started/i);
});

test("desktop shell: sidebar nav with aria-current, skip link focuses content", async ({
  page
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/home?stay=1");

  await expect(page.locator(".app-sidebar")).toBeVisible();
  await expect(page.locator(".app-topbar")).toBeHidden();

  const home = page.locator('.app-sidebar .app-navlink[aria-current="page"]');
  await expect(home).toHaveText(/Home/);

  // Skip link is the shell's first focusable.
  await page.keyboard.press("Tab");
  await expect(page.locator(".app-skip")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#app-content")).toBeFocused();
});

test("dashboard has no critical or serious a11y violations at both shell widths", async ({
  page
}) => {
  for (const width of [375, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/home?stay=1");
    await expect(page.getByTestId("dashboard")).toBeVisible();

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    const serious = results.violations
      .filter((v) => v.impact === "critical" || v.impact === "serious")
      .map((v) => `${width}px: ${v.id} (${v.impact}): ${v.nodes.length} node(s)`);
    expect(serious).toEqual([]);
  }
});

// PRD v1.1 §7.6, Task 1.8 — PR-1's real done check. With the guide door's
// ideas surface on, Home shows meal ideas above the check hero; these prove the
// ideas lead, the check CTA stays above the tab bar, and a tap prefills /check.
// The guard reads the built app's effective door state from /api/health
// (Task 1.12, A-99) — never the Playwright process env — so a list value such
// as the production `ideas,source` runs these too.
test.describe("guide door (PRD v1.1 §7.6) — only when the built app reports the ideas surface on", () => {
  test.beforeAll(async () => {
    test.skip(!(await doorSurfaceOn("ideas")), "ideas surface off in this build");
  });

  // Task 1.8 fix round 1: the fold lives only in the fold tests below, so a
  // fold miss can never hide whether the door itself works.
  test("ideas lead the check CTA; a tap prefills /check", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    // Review A-72: the daypart comes from the device clock. Pin it.
    await page.clock.install({ time: new Date("2026-09-14T19:00:00") });
    await page.goto("/home?stay=1");

    const block = page.getByTestId("ideas-block");
    await expect(block).toBeVisible();
    const chip = page.getByTestId("idea-row-1");
    await expect(chip).toBeVisible();

    const cta = page.getByTestId("dash-check-cta");
    const chipBox = await chip.boundingBox();
    const ctaBox = await cta.boundingBox();
    expect(chipBox).not.toBeNull();
    expect(ctaBox).not.toBeNull();
    expect(chipBox!.y).toBeLessThan(ctaBox!.y); // order: ideas above the check

    // RV-3 on Home: no percentages; the ideas block carries the anchor phrase.
    const text = await page.locator("main").innerText();
    expect(text).not.toMatch(/%/);
    expect(text).toMatch(/Prediabetes Pal's rules/);

    const ideaText = (await chip.innerText()).trim();
    await chip.click();
    await expect(page).toHaveURL(/\/check\?stay=1$/); // A-102
    await expect(page.getByLabel(/eating/i)).toHaveValue(ideaText);
  });

  // Review A-72 / DESIGN.md §8: the rows wrap differently at each width and
  // each daypart's lines differ in length, so the fold is pinned for every
  // width × clock, on four rotation pages each. `pal.ideas.rotation` is
  // seeded before the load and the block advances it once on mount, so seed s
  // shows ideasFor(daypart, s + 1): seed 0 is a fresh guest's first page,
  // seed 1 the second load, seed 5 the page holding each daypart's longest
  // lines, seed 7 the page that completes the set — together the four pages
  // hold every line of an eight-line bank, so the two-line check below sees
  // every idea wherever three rows show (375 and up). Explicit viewport sizes
  // keep this project-agnostic, like the rest of this file.
  const FOLD_CLOCKS: ReadonlyArray<{ time: string; daypart: Daypart }> = [
    { time: "2026-09-14T08:00:00", daypart: "breakfast" },
    { time: "2026-09-14T13:00:00", daypart: "lunch" },
    { time: "2026-09-14T19:00:00", daypart: "dinner" }
  ];
  const ROTATION_SEEDS = [0, 1, 5, 7] as const;

  for (const width of [360, 375, 430]) {
    test(`fold at ${width}×667: the check CTA clears the tab bar at every daypart and rotation page`, async ({
      page
    }) => {
      await page.setViewportSize({ width, height: 667 });
      await page.clock.install({ time: new Date(FOLD_CLOCKS[0]!.time) });
      await page.goto("/home?stay=1");
      // Let this first mount advance the counter before the loop seeds it —
      // a late hydration would otherwise bump the seed by one.
      await expect(page.getByTestId("idea-row-1")).toBeVisible();

      for (const { time, daypart } of FOLD_CLOCKS) {
        await page.clock.setSystemTime(new Date(time));

        for (const seed of ROTATION_SEEDS) {
          await page.evaluate((value) => {
            window.localStorage.setItem("pal.ideas.rotation", String(value));
          }, seed);
          await page.goto("/home?stay=1");

          const cell = `${width}px ${time.slice(11, 16)} seed ${seed}`;
          // Proves the stubbed clock and the seeded page reached the block —
          // a passing fold on the wrong daypart or page would prove nothing.
          await expect(page.locator("#ideas-title"), cell).toHaveText(
            `Ideas for ${daypart}`
          );
          await expect(page.getByTestId("idea-row-1"), cell).toHaveText(
            ideasFor(daypart, seed + 1)[0]!.text
          );

          // Task 1.8 fix round 1: below 375px the block shows two rows (A-93's
          // mechanism), three from 375 up; every visible idea fits the rows'
          // shared two-line floor (a third line grows the block past the budget).
          let visibleRows = 0;
          for (const row of await page.getByTestId(/^idea-row-\d$/).all()) {
            if (!(await row.isVisible())) continue;
            visibleRows += 1;
            const [height, floor, text] = await row.evaluate((el) => [
              el.getBoundingClientRect().height,
              Number.parseFloat(getComputedStyle(el).minHeight),
              el.textContent ?? ""
            ] as const);
            expect.soft(height, `${cell}: "${text}" wraps past two lines`).toBeLessThanOrEqual(
              floor + 0.5
            );
          }
          expect.soft(visibleRows, `${cell}: visible idea rows`).toBe(width < 375 ? 2 : 3);

          const ctaBox = await page.getByTestId("dash-check-cta").boundingBox();
          const barBox = await page.locator(".app-tabbar").boundingBox();
          expect(ctaBox, cell).not.toBeNull();
          expect(barBox, cell).not.toBeNull();
          const ctaBottom = ctaBox!.y + ctaBox!.height;
          console.log(
            `[fold] ${cell} (${daypart}): CTA bottom ${ctaBottom.toFixed(1)}, tab bar top ${barBox!.y.toFixed(1)}, slack ${(barBox!.y - ctaBottom).toFixed(1)}`
          );
          expect.soft(ctaBottom, cell).toBeLessThanOrEqual(barBox!.y);
        }
      }
    });
  }
});
