import { expect, test, type Page } from "@playwright/test";

import { doorSurfaceOn } from "./guide-door";

// Task 3.6, ruling F-43: /learn/first-week in a real browser. The unit tests
// run in node with no DOM, so this is where a Done tap is actually clicked.
// Guest only — a signed-in week needs a database, and the page's modes are
// unit-tested (tests/unit/pal/learn-first-week.test.ts).

const DAY_4_STEP = "Try one of today's ideas and see how it reads.";
const DAY_5_STEP = "Write down the questions you have for your clinician.";

/** A guest week on its day 4 with steps 1–3 done, dated by the installed clock. */
async function seedDayFour(page: Page) {
  await page.evaluate(() => {
    const startedAt = new Date();
    startedAt.setDate(startedAt.getDate() - 3);
    window.localStorage.setItem(
      "pal.orient.v1",
      JSON.stringify({ done: ["1", "2", "3"], dismissedAt: null, startedAt: startedAt.toISOString() })
    );
  });
}

test.describe("/learn/first-week with the orient surface on", () => {
  test.beforeAll(async () => {
    test.skip(!(await doorSurfaceOn("orient")), "orient surface off in this build");
  });

  test.beforeEach(async ({ page }) => {
    // Noon, so "three days ago" is three calendar days in any zone.
    await page.clock.install({ time: new Date("2026-09-15T12:00:00") });
    await page.goto("/learn/first-week");
    await seedDayFour(page);
  });

  test("a guest's Done sticks across a reload, and Home's step line moves past it", async ({ page }) => {
    await page.goto("/home?stay=1");
    await expect(page.getByTestId("next-action")).toHaveText(`Today's step: ${DAY_4_STEP}`);

    await page.goto("/learn/first-week");
    // The day only renders from the device week, so this also proves hydration.
    await expect(page.getByTestId("orientation-day")).toHaveText("Day 4 of your first week");
    await expect(page.getByTestId(/^orientation-step-\d$/).first()).toHaveAttribute(
      "data-testid",
      "orientation-step-4"
    );

    const done = page.getByRole("button", { name: `Done — ${DAY_4_STEP}` });
    await expect(done).toHaveAttribute("aria-pressed", "false");
    await done.click();
    await expect(done).toHaveAttribute("aria-pressed", "true");
    await expect(done).toHaveText("Done"); // A-56: never a label swap

    await page.reload();
    await expect(page.getByTestId("orientation-day")).toHaveText("Day 4 of your first week");
    await expect(page.getByRole("button", { name: `Done — ${DAY_4_STEP}` })).toHaveAttribute(
      "aria-pressed",
      "true"
    );

    await page.goto("/home?stay=1");
    const line = page.getByTestId("next-action").getByRole("link");
    await expect(line).toHaveText(`Today's step: ${DAY_5_STEP}`);
    await line.click();
    await expect(page).toHaveURL(/\/learn\/first-week#note$/);
    await expect(page.getByLabel(DAY_5_STEP, { exact: true })).toBeVisible();
  });

  test("the note is kept on the device and never sent", async ({ page }) => {
    const text = "Ask which test was used";
    const carried: string[] = [];
    page.on("request", (request) => {
      if (`${request.url()} ${request.postData() ?? ""}`.includes(text)) carried.push(request.url());
    });

    // beforeEach left this page open, so the hash alone is a same-document
    // jump; reload so the page renders from the seeded week.
    await page.goto("/learn/first-week#note");
    await page.reload();
    await expect(page.getByTestId("orientation-day")).toHaveText("Day 4 of your first week");
    await expect(page.getByText("Your notes stay on this device. Nothing here is sent anywhere.")).toBeVisible();

    const note = page.getByLabel(DAY_5_STEP, { exact: true });
    await note.fill(text);
    await expect(page.getByText("Saved on this device")).toBeVisible();

    await page.reload();
    await expect(page.getByLabel(DAY_5_STEP, { exact: true })).toHaveValue(text);
    expect(carried).toEqual([]);
  });
});

test("/learn/first-week is a 404 with the orient surface off", async ({ page }) => {
  test.skip(await doorSurfaceOn("orient"), "orient surface on in this build");
  const response = await page.goto("/learn/first-week");
  expect(response?.status()).toBe(404);
});
