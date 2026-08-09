import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * /journey smoke (C7 four-jobs restructure; was progress.spec.ts). `/api/coach`
 * is mocked directly with page.route — no real session/DB needed to exercise
 * the document states: premium-with-recap, premium-empty, free (one locked
 * section, never a page lock), unauthenticated, and outage.
 *
 * RV-3 is enforced here as a DOM regression: no percentages, no band words,
 * no score — the recap states facts that cannot "decline".
 */

async function expectNoSeriousViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  const serious = results.violations.filter((violation) =>
    ["critical", "serious"].includes(violation.impact ?? "")
  );
  expect(serious).toEqual([]);
}

const verdictWeek = [
  { key: "2026-07-13", checked: false, risk: null },
  { key: "2026-07-14", checked: true, risk: "SAFE" },
  { key: "2026-07-15", checked: true, risk: "MODERATE" },
  { key: "2026-07-16", checked: false, risk: null },
  { key: "2026-07-17", checked: true, risk: "SAFE" },
  { key: "2026-07-18", checked: false, risk: null },
  { key: "2026-07-19", checked: false, risk: null }
];

function premiumBody(latestBai: unknown) {
  return {
    streak: 3,
    weekView: [],
    insight: null,
    tier: "premium",
    verdictWeek,
    latestBai
  };
}

async function stubCoach(page: Page, status: number, body: unknown) {
  await page.route("**/api/coach", async (route) => {
    await route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(body)
    });
  });
}

async function expectRv3Clean(page: Page) {
  // RV-3 DOM regression: no percentages, no band words, no score surfaces.
  const text = await page.locator("main").innerText();
  expect(text).not.toMatch(/%/);
  expect(text).not.toMatch(/excellent|on track|building|getting started/i);
  await expect(page.getByTestId("progress-bands")).toHaveCount(0);
  await expect(page.locator('[data-testid^="dash-bai"]')).toHaveCount(0);
  await expect(page.locator('[data-testid^="bai-bar"]')).toHaveCount(0);
  // claims boundary: no banned words rendered on the page
  expect(text).not.toMatch(/revers|cure|treat|prevent|guarantee|FDA/i);
}

test("premium user with a computed week sees the non-scored recap and week facts", async ({
  page
}) => {
  await stubCoach(
    page,
    200,
    premiumBody({
      weekStart: "2026-06-29",
      score: 72,
      adherence: 71,
      consistency: 60,
      action: 100,
      prompted: 5
    })
  );

  await page.goto("/journey");

  // Design-review pin: real tab title (was bare "Prediabetes Pal").
  await expect(page).toHaveTitle("My journey — Prediabetes Pal");

  const recap = page.getByTestId("journey-recap");
  await expect(recap).toBeVisible();
  // adherence 71 → 5 of 7 days; action 100 of prompted 5 → 5 of 5.
  await expect(recap).toContainText("You checked in on 5 of 7 days last week.");
  await expect(recap).toContainText("you followed through 5 of 5 times");
  await expect(recap).toContainText(
    "Checking less as you get more confident is how this is meant to work."
  );

  // Your week: free-computable facts + the strip.
  await expect(page.getByTestId("journey-week-count")).toContainText(
    "You checked in on 3 days this week."
  );
  await expect(page.getByTestId("dash-week")).toBeVisible();

  // Exactly one next-action per surface (DV6).
  await expect(page.getByTestId("next-action")).toHaveCount(1);

  await expectRv3Clean(page);
  await expectNoSeriousViolations(page);
});

test("premium user with zero prompted checks sees the calm no-prompts sentence", async ({
  page
}) => {
  await stubCoach(
    page,
    200,
    premiumBody({
      weekStart: "2026-06-29",
      score: 88,
      adherence: 100,
      consistency: 90,
      action: 0,
      prompted: 0
    })
  );

  await page.goto("/journey");

  const recap = page.getByTestId("journey-recap");
  await expect(recap).toBeVisible();
  await expect(recap).toContainText("No meals needed a follow-up last week.");
  // The old misleading 0% follow-through framing must not resurface.
  await expect(recap).not.toContainText("Just starting");
  await expect(recap).not.toContainText("followed through 0");

  await expectRv3Clean(page);
  await expectNoSeriousViolations(page);
});

test("premium user with no computed week yet sees the calm waiting state", async ({
  page
}) => {
  await stubCoach(page, 200, premiumBody(null));

  await page.goto("/journey");

  await expect(page.getByTestId("progress-empty")).toBeVisible();
  await expect(page.getByTestId("journey-recap")).toHaveCount(0);
  // Week facts still render — the document never blanks.
  await expect(page.getByTestId("journey-week-count")).toBeVisible();

  await expectRv3Clean(page);
  await expectNoSeriousViolations(page);
});

test("free tier gets real week facts plus ONE locked section, never a page lock", async ({
  page
}) => {
  await stubCoach(page, 200, {
    streak: 2,
    weekView: [],
    insight: null,
    tier: "free",
    verdictWeek,
    latestBai: null
  });

  await page.goto("/journey");

  // The single labeled locked section with the honest upsell.
  await expect(page.getByTestId("progress-locked")).toHaveCount(1);
  await expect(page.getByTestId("progress-subscribe-link")).toHaveAttribute(
    "href",
    "/subscribe"
  );

  // But the free document still shows REAL content: week facts + an action.
  await expect(page.getByTestId("journey-week-count")).toContainText(
    "You checked in on 3 days this week."
  );
  await expect(page.getByTestId("dash-week")).toBeVisible();
  await expect(page.getByTestId("next-action")).toHaveCount(1);

  await expectRv3Clean(page);
  await expectNoSeriousViolations(page);
});

test("guest (signed out) sees a sign-in prompt, not the Premium upsell", async ({
  page
}) => {
  await stubCoach(page, 401, { error: "Sign in first." });

  await page.goto("/journey");

  // Error-state truth: 401 is unauthenticated, never the outage-as-upsell.
  await expect(page.getByTestId("progress-unauthenticated")).toBeVisible();
  await expect(page.getByTestId("progress-signin-link")).toHaveAttribute(
    "href",
    "/signin"
  );
  await expect(page.getByTestId("progress-locked")).toHaveCount(0);

  await expectNoSeriousViolations(page);
});

test("a backend outage renders unavailable + retry, never the upsell", async ({
  page
}) => {
  let calls = 0;
  await page.route("**/api/coach", async (route) => {
    calls += 1;
    if (calls === 1) {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "boom" })
      });
      return;
    }
    // The manual retry recovers to a premium-with-recap response.
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(
        premiumBody({
          weekStart: "2026-06-29",
          score: 72,
          adherence: 71,
          consistency: 60,
          action: 100,
          prompted: 5
        })
      )
    });
  });

  await page.goto("/journey");

  // The 500 must not become the Premium upsell.
  await expect(page.getByTestId("progress-unavailable")).toBeVisible();
  await expect(page.getByTestId("progress-locked")).toHaveCount(0);
  await expect(page.getByTestId("journey-recap")).toHaveCount(0);

  // Bounded manual retry recovers the page.
  await page.getByTestId("progress-retry").click();
  await expect(page.getByTestId("journey-recap")).toBeVisible();

  await expectNoSeriousViolations(page);
});

test("legacy paths permanently redirect to the four-job routes", async ({
  page
}) => {
  await stubCoach(page, 401, { error: "Sign in first." });
  await page.goto("/progress");
  await expect(page).toHaveURL(/\/journey$/);
  await page.goto("/history");
  await expect(page).toHaveURL(/\/meals$/);
  await page.goto("/memory");
  await expect(page).toHaveURL(/\/meals$/);
});

test("how-it-works page discloses methodology and has no a11y violations", async ({
  page
}) => {
  await page.goto("/how-it-works");

  await expect(
    page.getByRole("heading", { name: /what the progress view measures/i })
  ).toBeVisible();
  await expect(page.getByText(/CDC DPP/)).toBeVisible();
  await expect(page.getByText(/individual results vary/i)).toBeVisible();

  const text = await page.locator("main").innerText();
  expect(text).not.toMatch(/revers|cure|treat|prevent|guarantee|FDA/i);

  await expectNoSeriousViolations(page);
});
