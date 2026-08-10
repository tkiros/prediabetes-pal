/**
 * Smoke tests for launch-control behavior (Plan 04-02)
 *
 * Tests normal mode passthrough, maintenance mode pause, and friendly
 * rate-limit behavior — all via Playwright route stubs so no live Edge Config
 * or live Vercel WAF is required.
 *
 * Maintenance-mode simulation: stub /api/check to return 503 with friendly
 * pause body (what the middleware returns when paused). The test verifies the
 * UI renders calm pause copy and never shows raw errors or stack traces.
 */

import { expect, test, type Route } from "@playwright/test";

// ---------------------------------------------------------------------------
// Stub helpers
// ---------------------------------------------------------------------------

/** Stub /api/check to respond with a normal SAFE result (normal mode). */
async function stubNormalMode(route: Route) {
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      kind: "result",
      risk: "SAFE",
      reason: "This meal looks well-balanced for your plan.",
      adjustment: null,
      swap: null,
      disclaimer: "Not medical advice."
    })
  });
}

/**
 * Stub /api/check to respond with a 503 maintenance-mode pause response
 * (mirrors what middleware returns when public_checks_enabled is false).
 */
async function stubMaintenanceMode(route: Route) {
  await route.fulfill({
    status: 503,
    contentType: "application/json",
    body: JSON.stringify({
      kind: "retry",
      message: "Prediabetes Pal checks are paused right now. Please try again in a few minutes.",
      disclaimer: "Not medical advice."
    })
  });
}

/**
 * Stub /api/check to respond with a friendly rate-limit 429 response
 * (mirrors what Vercel WAF returns when rate limit is exceeded, then mapped
 * to retry copy by lib/client/check.ts).
 */
async function stubRateLimit(route: Route) {
  await route.fulfill({
    status: 429,
    contentType: "application/json",
    body: JSON.stringify({
      kind: "retry",
      message: "Too many requests right now.",
      disclaimer: "Not medical advice."
    })
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test("normal mode — public check completes successfully", async ({ page }) => {
  await page.route("**/api/check", stubNormalMode);

  await page.goto("/check?stay=1");

  // Fill in the form
  await page.getByLabel(/what are you thinking about eating/i).fill("lentil soup");
  await page.getByLabel(/latest a1c/i).fill("6.1");
  await page.getByRole("button", { name: "Check this meal" }).click();

  // Normal result should appear
  // The redesigned card renders the verdict in both the lead and the Signal
  // row — assert on the Signal row's testid, not bare text.
  await expect(page.getByTestId("result-signal")).toHaveText("Clear", {
    timeout: 10_000
  });
  await expect(
    page.getByText("This meal looks well-balanced for your plan.")
  ).toBeVisible();
  await expect(
    page.getByTestId("result-card").getByText("Not medical advice.")
  ).toBeVisible();

  // Must not contain raw errors or stack traces
  await expect(page.getByText(/Error:|stack trace|node_modules/i)).toHaveCount(0);
});

test("maintenance mode — friendly pause response before model spend", async ({
  page
}) => {
  await page.route("**/api/check", stubMaintenanceMode);

  await page.goto("/check?stay=1");

  await page.getByLabel(/what are you thinking about eating/i).fill("oatmeal");
  await page.getByLabel(/latest a1c/i).fill("6.0");
  await page.getByRole("button", { name: "Check this meal" }).click();

  // A 503 carries the middleware's calm retry payload, which lib/client/check.ts
  // surfaces as a retry response (ResultCard, kind="retry") — the user sees the
  // pause copy, not a generic error.
  await expect(
    page.getByText(/checks are paused right now/i)
  ).toBeVisible({ timeout: 10_000 });

  // Must never leak raw provider errors, stack traces, or prompt text
  await expect(
    page.getByText(/Error:|TypeError|node_modules|stack trace|prompt/i)
  ).toHaveCount(0);

  // Submitted food text must never be echoed back into the result surface.
  await expect(page.getByTestId("result-card")).not.toContainText(/oatmeal/i);

  // No SAFE/MODERATE/HIGH classification leaked — the pause renders as a retry,
  // never a risk result.
  await expect(
    page.locator('[data-testid="result-card"][data-risk]')
  ).toHaveCount(0);
  await expect(
    page.locator('[data-testid="result-card"][data-kind="retry"]')
  ).toBeVisible();
});

test("rate limit — friendly retry response (WAF 429 behavior)", async ({
  page
}) => {
  await page.route("**/api/check", stubRateLimit);

  await page.goto("/check?stay=1");

  await page.getByLabel(/what are you thinking about eating/i).fill("brown rice");
  await page.getByLabel(/latest a1c/i).fill("6.2");
  await page.getByRole("button", { name: "Check this meal" }).click();

  // A 429 is mapped to "rate_limited" → RequestStatus with "Try again on this page"
  // and "Prediabetes Pal is helping a lot of people right now" copy
  await expect(page.getByText("Try again on this page")).toBeVisible({
    timeout: 10_000
  });
  await expect(page.getByText(/a lot of people right now/i)).toBeVisible();

  // Must not contain raw error text or status codes in visible content
  await expect(page.locator(".status-title, .status-copy, .status-note").filter({
    hasText: /Error:|TypeError|node_modules|stack trace/i
  })).toHaveCount(0);

  // No SAFE/MODERATE/HIGH classification leaked
  await expect(page.getByTestId("result-card")).toHaveCount(0);
});
