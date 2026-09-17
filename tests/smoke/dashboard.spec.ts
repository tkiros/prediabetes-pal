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

  // PR-4 Task 4.4 — "See all" expands the block to the whole daypart bank in
  // place; only meaningful with the growth bank behind it, so this whole
  // block skips unless ideas-full is on too.
  test.describe("ideas-full — 'See all' expands the block", () => {
    test.beforeAll(async () => {
      test.skip(!(await doorSurfaceOn("ideas-full")), "ideas-full surface off in this build");
    });

    // Both tests below pin the clock to dinner — compute the expected
    // expanded-row count from the bank itself (final review controller
    // ruling) rather than a literal, so a pruned/grown line never breaks this
    // assertion on its own. `count: 99` is a safe upper bound; ideasFrom caps
    // the return at the bank's real length.
    const dinnerFullCount = ideasFor("dinner", 0, { full: true, count: 99 }).length;

    test("See all shows all ten rows and stays reachable; a row past the third still reaches /check; Show fewer collapses back", async ({
      page
    }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.clock.install({ time: new Date("2026-09-14T19:00:00") });
      await page.goto("/home?stay=1");

      const seeAll = page.getByRole("button", { name: "See all" });
      await expect(seeAll).toBeVisible();
      await expect(seeAll).toHaveAttribute("aria-expanded", "false");
      await expect(page.getByTestId(/^idea-row-\d+$/)).toHaveCount(3);

      await seeAll.click();
      const showFewer = page.getByRole("button", { name: "Show fewer" });
      await expect(showFewer).toHaveAttribute("aria-expanded", "true");
      await expect(page.getByTestId(/^idea-row-\d+$/)).toHaveCount(dinnerFullCount);

      // No fold assertion once expanded (A-08/A-94) — only that the check CTA
      // stays in the DOM and reachable.
      const cta = page.getByTestId("dash-check-cta");
      await cta.scrollIntoViewIfNeeded();
      await expect(cta).toBeVisible();

      // Final review minor #4: the collapse direction gets its own exercise,
      // not just the post-navigation remount below.
      await showFewer.click();
      await expect(seeAll).toHaveAttribute("aria-expanded", "false");
      await expect(page.getByTestId(/^idea-row-\d+$/)).toHaveCount(3);
      await seeAll.click();
      await expect(showFewer).toHaveAttribute("aria-expanded", "true");
      await expect(page.getByTestId(/^idea-row-\d+$/)).toHaveCount(dinnerFullCount);

      // A row past the third emits slot "more" and still hands off to /check.
      const row4 = page.getByTestId("idea-row-4");
      const row4Text = (await row4.innerText()).trim();
      await row4.click();
      await expect(page).toHaveURL(/\/check\?stay=1$/);
      await expect(page.getByLabel(/eating/i)).toHaveValue(row4Text);

      // Home remounts fresh on the way back (same per-mount reset as the
      // rotation counter and ideas_shown) — collapsed again, three rows.
      await page.goBack();
      await expect(page).toHaveURL(/\/home\?stay=1$/);
      await expect(page.getByRole("button", { name: "See all" })).toBeVisible();
      await expect(page.getByTestId(/^idea-row-\d+$/)).toHaveCount(3);
    });

    test("360×667: expanded shows all ten rows (the fold-hide override does not apply once expanded)", async ({
      page
    }) => {
      await page.setViewportSize({ width: 360, height: 667 });
      await page.clock.install({ time: new Date("2026-09-14T19:00:00") });
      await page.goto("/home?stay=1");

      await page.getByRole("button", { name: "See all" }).click();
      await expect(page.getByTestId(/^idea-row-\d+$/)).toHaveCount(dinnerFullCount);
      for (let n = 1; n <= dinnerFullCount; n += 1) {
        await expect(page.getByTestId(`idea-row-${n}`)).toBeVisible();
      }
    });
  });

  // Review A-72 / DESIGN.md §8: the rows wrap differently at each width and
  // each daypart's lines differ in length, so the fold is pinned for every
  // width × clock, on five rotation pages each. `pal.ideas.rotation` is
  // seeded before the load and the block advances it once on mount, so seed s
  // shows ideasFor(daypart, s + 1) — three consecutive lines of an eight-line
  // bank starting at index 3(s + 1) mod 8. Seeds 0, 1, 3, 5, 7 therefore
  // start at 3, 6, 4, 2, 0:
  //   • where three rows render (375 and up) the five pages hold {3,4,5}
  //     {6,7,0} {4,5,6} {2,3,4} {0,1,2} — every line of the bank;
  //   • at 360, where only the first two rows render, they hold {3,4} {6,7}
  //     {4,5} {2,3} {0,1} — also every line.
  // Seed 3 earns its place on the second list alone: without it index 5 is
  // never wrap-measured at the narrowest width, which is the width where a
  // line is likeliest to wrap past two lines. Explicit viewport sizes keep
  // this project-agnostic, like the rest of this file.
  //
  // Final review minor #5: this "every line of the bank" accounting is for
  // the eight-line seed. On the `1` leg (`ideas-full` on too, `fullOn` true
  // above) the same five seeds draw from all ten lines and start at indices
  // 3, 6, 2, 8, 4 instead — every seed line still gets a page, and the two
  // grown lines (8, 9) get one each, but index 0 and 1 do not on that leg.
  // The seed lines' own wrap is still fully covered on the `ideas,source`
  // leg, where `fullOn` is false and the indices above apply unchanged.
  //
  // Task 3.5 / F-30 / F-35: with the orient surface on, every cell also runs
  // a first week on its day 2 — the tallest Home above the CTA: the "Day 2 of
  // your first week" line in the date's place, and the hero's own step
  // eyebrow (a check-step day before the first check). The guest here has no
  // profile, so without the seed no week would render and the fold would not
  // measure it.
  const FOLD_CLOCKS: ReadonlyArray<{ time: string; daypart: Daypart }> = [
    { time: "2026-09-14T08:00:00", daypart: "breakfast" },
    { time: "2026-09-14T13:00:00", daypart: "lunch" },
    { time: "2026-09-14T19:00:00", daypart: "dinner" }
  ];
  const ROTATION_SEEDS = [0, 1, 3, 5, 7] as const;

  for (const width of [360, 375, 430]) {
    test(`fold at ${width}×667: the check CTA clears the tab bar at every daypart and rotation page`, async ({
      page
    }) => {
      const weekOn = await doorSurfaceOn("orient");
      // PR-4 Task 4.3: with ideas-full on, the row this test pins is drawn
      // from the full ten-idea bank, not just the eight-line seed — resolved
      // once, outside the loop (the built app's door state never changes
      // mid-test).
      const fullOn = await doorSurfaceOn("ideas-full");
      await page.setViewportSize({ width, height: 667 });
      await page.clock.install({ time: new Date(FOLD_CLOCKS[0]!.time) });
      await page.goto("/home?stay=1");
      // Let this first mount advance the counter before the loop seeds it —
      // a late hydration would otherwise bump the seed by one.
      await expect(page.getByTestId("idea-row-1")).toBeVisible();

      for (const { time, daypart } of FOLD_CLOCKS) {
        await page.clock.setSystemTime(new Date(time));

        for (const seed of ROTATION_SEEDS) {
          await page.evaluate(
            ([value, week]) => {
              window.localStorage.setItem("pal.ideas.rotation", String(value));
              // PR-4 Task 4.3: a leftover segment answer from an earlier test
              // must not steer this page's first idea.
              window.localStorage.removeItem("pal.segment.v1");
              if (!week) return;
              const startedAt = new Date(); // the installed clock
              startedAt.setDate(startedAt.getDate() - 1);
              window.localStorage.setItem(
                "pal.orient.v1",
                JSON.stringify({ done: [], dismissedAt: null, startedAt: startedAt.toISOString() })
              );
            },
            [seed, weekOn] as const
          );
          await page.goto("/home?stay=1");

          const cell = `${width}px ${time.slice(11, 16)} seed ${seed}`;
          // Proves the stubbed clock and the seeded page reached the block —
          // a passing fold on the wrong daypart or page would prove nothing.
          await expect(page.locator("#ideas-title"), cell).toHaveText(
            `Ideas for ${daypart}`
          );
          await expect(page.getByTestId("idea-row-1"), cell).toHaveText(
            ideasFor(daypart, seed + 1, { full: fullOn })[0]!.text
          );
          if (weekOn) {
            // F-30/F-35: the day line now renders INSIDE Home's one <h1>, in
            // the date's place, not as a second eyebrow above it. The
            // heading-role match is strict (fails if a second <h1> exists)
            // and full-text (fails if the date is still in it); the testid
            // match pins the same node's test id.
            await expect(page.getByRole("heading", { level: 1 }), cell).toHaveText(
              "Day 2 of your first week"
            );
            await expect(page.getByTestId("orientation-day"), cell).toHaveText(
              "Day 2 of your first week"
            );
            await expect(page.locator(".meal-hero-eyebrow"), cell).toHaveText(
              "Today's step · Meal check"
            );
          }

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
