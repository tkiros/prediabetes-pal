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

test("subscribe page shows the soft paywall inside the claims boundary", async ({
  page
}) => {
  await page.goto("/subscribe");

  await expect(page.getByTestId("paywall-card")).toBeVisible();
  await expect(page.getByTestId("subscribe-monthly")).toContainText("$9.99");
  await expect(page.getByTestId("subscribe-annual")).toContainText("$89.99");
  // capability framing only — no outcome promises, no pressure
  const text = await page.locator("main").innerText();
  expect(text).not.toMatch(/revers|cure|treat|prevent|guarantee|lower your a1c/i);
  expect(text).toMatch(/cancel anytime/i);

  await expectNoSeriousViolations(page);
});

test("signed-out account page offers sign-in; deletion URL is public", async ({
  page
}) => {
  await page.goto("/account");
  await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();

  await page.goto("/account/delete");
  await expect(
    page.getByRole("heading", { name: /delete your account/i })
  ).toBeVisible();
  // AUD-013: the public deletion promise carries its two honest boundaries —
  // the Play-cancellation precondition and the retained-record disclosure —
  // instead of the old absolute "no retention window" claim.
  await expect(
    page.getByText(/cancel that subscription in Google Play first/i)
  ).toBeVisible();
  await expect(page.getByText(/What remains afterwards/i)).toBeVisible();
  await expect(page.getByText(/no retention window/i)).not.toBeVisible();

  await expectNoSeriousViolations(page);
});

test("free-tier limit renders the calm upsell card", async ({ page }) => {
  await page.route("**/api/check", async (route) => {
    await route.fulfill({
      status: 402,
      contentType: "application/json",
      body: JSON.stringify({
        kind: "upsell",
        message:
          "You've used today's five free checks. Premium removes the daily limit and keeps your full history — or check back in with your first meal tomorrow.",
        disclaimer: "Not medical advice."
      })
    });
  });

  await page.goto("/check?stay=1");
  await page
    .getByLabel(/what are you thinking about eating/i)
    .fill("lentil soup");
  await page.getByLabel(/latest a1c/i).fill("6.1");
  await page.getByRole("button", { name: "Check this meal" }).click();

  const card = page.getByTestId("result-card");
  await expect(card).toHaveAttribute("data-kind", "upsell");
  await expect(card).toContainText(/five for today/i);
  await expect(
    card.getByRole("link", { name: /see what premium includes/i })
  ).toBeVisible();
  // calm, not scary
  await expect(card).not.toContainText(/warning|blocked|denied/i);
});

// §0.2 #4 — this server is pinned PAYWALL_MODE=legacy.
//
// This used to assert the landing's price tiles described the legacy ladder.
// The pricing section was deleted on 2026-08-05 ("the price should not be
// mentioned, only focus on free check"), so the assertion inverts: under the
// legacy mode too, the landing must show NO section and NO amount. Its twin
// runs the same check against the trial server (trial-wall.spec.ts).
test("the legacy-mode landing renders no pricing section and no amount", async ({
  page
}) => {
  await page.goto("/");
  await expect(page.locator("#pricing")).toHaveCount(0);
  await expect(page.locator(".landing-price-what")).toHaveCount(0);
  await expect(page.locator('a[href="#pricing"]')).toHaveCount(0);
  await expect(page.locator("main.landing")).not.toContainText(/\$\d/);
});

// The surviving §0.2 #4 mechanism: the FAQ's card answer still branches on
// the live flag. This server runs legacy, so it must render the legacy answer
// and must never promise the 7-day trial it does not run.
test("the legacy-mode landing FAQ describes the free account, not a trial", async ({
  page
}) => {
  await page.goto("/");
  const faq = page.locator("#faq");
  await expect(faq).toContainText("a free account includes");
  await expect(faq).toContainText("still no card");
  await expect(faq).not.toContainText("7-day");
  await expect(faq).not.toContainText("7 days free");
});
