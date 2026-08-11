import fs from "node:fs";
import path from "node:path";

import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/**
 * Magic-link auth E2E (plan 4A). Needs a real database and the email stub:
 *
 *   DATABASE_URL=<disposable loopback database> \
 *   AUTH_SECRET=<any> HEALTH_DATA_KEY=<32B base64> \
 *   AUTH_EMAIL_STUB_DIR=/tmp/pal-mailbox \
 *   npx playwright test tests/smoke/auth.spec.ts
 *
 * Skipped automatically when the isolated database isn't provisioned.
 */

const STUB_DIR = process.env.AUTH_EMAIL_STUB_DIR;
const ENABLED = Boolean(process.env.DATABASE_URL && STUB_DIR);

test.skip(
  !ENABLED,
  "auth E2E needs DATABASE_URL + AUTH_EMAIL_STUB_DIR (Railway dev database)"
);

// Runs unconditionally (no DB needed) — proves the P9 reviewer-access form
// stays invisible whenever NEXT_PUBLIC_REVIEWER_MODE isn't "1", which is the
// case for this webServer config (playwright.config.ts) and for every
// production build (docs/ops/env-reference.md: never set in production).
test("reviewer-access form is absent when NEXT_PUBLIC_REVIEWER_MODE is unset", async ({
  page
}) => {
  await page.goto("/signin");
  await expect(page.getByText("Reviewer access")).toHaveCount(0);
  await expect(page.getByTestId("reviewer-signin-submit")).toHaveCount(0);
});

test("magic-link round trip: email → link → session → consent → profile", async ({
  page
}) => {
  const email = `e2e-${Date.now()}@pal.test`;

  await page.goto("/signin");
  await page.getByLabel("Email address").fill(email);
  await page.getByRole("button", { name: /email me a sign-in link/i }).click();

  await expect(page).toHaveURL(/check-email/);

  // Read the magic link from the stubbed mailbox.
  const mailboxFile = path.join(
    STUB_DIR!,
    `${email.replace(/[^a-z0-9@.]/gi, "_")}.json`
  );
  await expect
    .poll(() => fs.existsSync(mailboxFile), { timeout: 10_000 })
    .toBe(true);
  const { url } = JSON.parse(fs.readFileSync(mailboxFile, "utf8")) as {
    url: string;
  };

  await page.goto(url);

  // Landed signed-in on /welcome: consent gate blocks until checked.
  await page.goto("/welcome");
  await expect(page.getByTestId("welcome-save")).toBeDisabled();

  // a11y gate on the real, signed-in /welcome page (same AxeBuilder pattern
  // as tests/smoke/a11y.spec.ts). Signed-out /welcome redirects/shows a
  // different state, so this is the only place the real page is reachable
  // without a DB — hence it lives in this env-gated auth flow, not a11y.spec.ts.
  const welcomeViolations = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(
    welcomeViolations.violations
      .filter((v) => v.impact === "critical" || v.impact === "serious")
      .map((v) => `${v.id} (${v.impact}): ${v.nodes.length} node(s)`)
  ).toEqual([]);

  await page.getByLabel("Latest A1C").fill("6.1");
  // Layered consent (2026-08-11): one-line label; the full counsel paragraph
  // sits in the expander at the point of consent.
  await expect(
    page.getByText(/How my health data is handled/)
  ).toBeVisible();
  await page
    .getByLabel(/I consent to Prediabetes Pal storing and using my A1C/)
    .check();
  await page.getByTestId("welcome-save").click();

  await expect(page).toHaveURL(/\/check$/);

  // Session survives a reload; profile exists.
  const profile = await page.evaluate(async () => {
    const response = await fetch("/api/profile");
    return response.json();
  });
  expect(profile).toMatchObject({
    hasProfile: true,
    a1cBand: "prediabetes_60_62"
  });
});
