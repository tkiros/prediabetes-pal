import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

async function expectNoSeriousViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  const serious = results.violations.filter((violation) =>
    ["critical", "serious"].includes(violation.impact ?? "")
  );
  expect(serious).toEqual([]);
}

// §0.2 #6: the attribution step sits between segment and a1c in every path.
async function answerAttribution(page: Page, chip = "Reddit") {
  await expect(page.getByTestId("onboarding-step")).toHaveAttribute(
    "data-step",
    "attribution"
  );
  await expect(
    page.getByRole("heading", { name: "Where did you hear about us?" })
  ).toBeVisible();
  await page.getByRole("button", { name: chip, exact: true }).click();
}

test("a new user walks welcome→segment→attribution→a1c→expectations into the check page's guided chips", async ({
  page
}) => {
  await page.goto("/onboarding");

  // Step 1: welcome. (The "Reversal…" North Star line was removed 2026-07-06
  // pending counsel Q8 — launch audit BUG-05; restore this assertion only with
  // an Approved copy-ledger row.)
  await expect(page.getByTestId("onboarding-step")).toHaveAttribute(
    "data-step",
    "welcome"
  );
  // W-09: the welcome step used to promise "one reason, one adjustment, and one
  // safer swap" unconditionally. A SAFE verdict is structurally forbidden from
  // carrying either an adjustment or a swap, so that promise was false for every
  // Clear result. The copy is now hedged and this assertion follows it.
  await expect(
    page.getByText(
      /one reason and, when appropriate, an adjustment and one practical alternative/
    )
  ).toBeVisible();
  await expectNoSeriousViolations(page);
  await page.getByRole("button", { name: "Get started" }).click();

  // Step 2: segmentation — one tap advances, stored nowhere
  await expect(page.getByTestId("onboarding-step")).toHaveAttribute(
    "data-step",
    "segment"
  );
  await expect(
    page.getByRole("heading", { name: "What brought you here?" })
  ).toBeVisible();
  await expectNoSeriousViolations(page);
  await page.getByRole("button", { name: "New A1C result" }).click();

  // Step 3: attribution — one tap, closed enum, then on to A1C
  await expectNoSeriousViolations(page);
  await answerAttribution(page);

  // Step 4: A1C entry (shown because no profile is seeded)
  await expect(page.getByTestId("onboarding-step")).toHaveAttribute(
    "data-step",
    "a1c"
  );
  await page.getByLabel("Latest A1C").fill("6.1");
  await expectNoSeriousViolations(page);
  await page.getByRole("button", { name: "Continue" }).click();

  // Step 4: expectations — honesty line prepended + disclaimer
  await expect(page.getByTestId("onboarding-step")).toHaveAttribute(
    "data-step",
    "expectations"
  );
  await expect(
    page.getByText(/When we're unsure, we say so/)
  ).toBeVisible();
  await expect(page.locator(".result-disclaimer")).toContainText(
    /not medical advice/i
  );
  await expectNoSeriousViolations(page);
  // Expectations is the final step — completing the tour lands on the check
  // page, where the guided first-check chips wait in the empty state.
  await page.getByRole("button", { name: "Check my first meal" }).click();

  await expect(page).toHaveURL(/\/check$/);
  await expect(page.getByTestId("first-check-classics")).toBeVisible();
  await expect(
    page.getByText(/Try one of the classics/)
  ).toBeVisible();
  await page.getByRole("button", { name: "oatmeal", exact: true }).click();
  await expect(page.getByLabel(/eating/i)).toHaveValue("oatmeal");

  // The remembered A1C renders as the compact saved-A1C row, not a re-ask —
  // and "Change" reopens the field with the value intact.
  await expect(page.getByTestId("a1c-locked")).toContainText("6.1");
  await page.getByTestId("a1c-change").click();
  await expect(page.getByLabel(/latest a1c/i)).toHaveValue("6.1");
  await expectNoSeriousViolations(page);
});

test("a returning guest with a saved A1C skips the A1C step", async ({
  page
}) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "pal.profile.v1",
      JSON.stringify({ a1c: 6.1, onboardedAt: "2026-01-01T00:00:00.000Z" })
    );
  });

  await page.goto("/onboarding");
  await page.getByRole("button", { name: "Get started" }).click();

  await expect(page.getByTestId("onboarding-step")).toHaveAttribute(
    "data-step",
    "segment"
  );
  await page.getByRole("button", { name: "Just checking" }).click();
  await answerAttribution(page, "Somewhere else");

  // Single-source rule: the device already knows the A1C, so a1c is skipped.
  await expect(page.getByTestId("onboarding-step")).toHaveAttribute(
    "data-step",
    "expectations"
  );
  await expect(page.getByLabel("Latest A1C")).toHaveCount(0);
});

test("skip the tour leaves for the escape hatch, never looping back", async ({
  page
}) => {
  await page.goto("/onboarding");
  await page.getByRole("button", { name: "Skip setup and check a meal" }).click();

  // ?stay=1 is FirstRunGate's signal to stay on the check page instead of
  // bouncing back (the app moved from / to /check, 2026-07-07).
  await expect(page).toHaveURL(/\/check\?stay=1$/);
  await expect(page.getByTestId("onboarding-step")).toHaveCount(0);
});

test("an A1C entered mid-tour survives 'Skip setup' — never re-asked on /check", async ({
  page
}) => {
  // Regression (design-review 2026-07-21): the A1C used to persist only on
  // completing the tour, so entering 6.1 and then leaving via "Skip setup and
  // check a meal" dropped it and /check asked again — breaking step 4's
  // "It stays on this device" promise. Persistence fires on INTENTIONAL exits
  // only (skip + completing the tour), never mid-tour — a mid-tour persist
  // would mark tab-close abandoners as onboarded forever (FirstRunGate keys
  // on a non-null profile).
  await page.goto("/onboarding");
  await page.getByRole("button", { name: "Get started" }).click();
  await page.getByRole("button", { name: "New A1C result" }).click();
  await answerAttribution(page);
  await page.getByLabel("Latest A1C").fill("6.1");
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByTestId("onboarding-step")).toHaveAttribute(
    "data-step",
    "expectations"
  );
  await page.getByRole("button", { name: "Skip setup and check a meal" }).click();

  await expect(page).toHaveURL(/\/check\?stay=1$/);
  // Remembered A1C renders as the saved-A1C row — never a re-ask.
  await expect(page.getByTestId("a1c-locked")).toContainText("6.1");
});

test("invalid A1C shows a field error, not progress", async ({ page }) => {
  await page.goto("/onboarding");
  await page.getByRole("button", { name: "Get started" }).click();
  await page.getByRole("button", { name: "New A1C result" }).click();
  await answerAttribution(page, "Search");

  // Empty submit (number inputs refuse non-numeric text entirely)
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByText(/one decimal, like 6.1/i)).toBeVisible();
  await expect(page.getByTestId("onboarding-step")).toHaveAttribute(
    "data-step",
    "a1c"
  );
});

test.describe("out-of-range A1C ends at boundary guidance, never a verdict", () => {
  for (const [value, expected] of [
    ["5.2", /below that range/i],
    ["7.1", /range clinicians use when evaluating Type 2 diabetes/i]
  ] as const) {
    test(`A1C ${value}`, async ({ page }) => {
      await page.goto("/onboarding");
      await page.getByRole("button", { name: "Get started" }).click();
      await page.getByRole("button", { name: "New A1C result" }).click();
      await answerAttribution(page, "Facebook");
      await page.getByLabel("Latest A1C").fill(value);
      await page.getByRole("button", { name: "Continue" }).click();

      await expect(page.getByTestId("onboarding-step")).toHaveAttribute(
        "data-step",
        "boundary"
      );
      await expect(page.getByTestId("boundary-message")).toContainText(expected);
      // No verdict language, no way to continue the tour
      await expect(page.getByText(/clear|be careful|hold off/i)).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Continue" })).toHaveCount(0);
      await expectNoSeriousViolations(page);
    });
  }
});
