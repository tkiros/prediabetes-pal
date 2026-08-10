import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// Gate: zero critical/serious WCAG A/AA violations on the real rendered pages.
async function blockingViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();

  return results.violations
    .filter((v) => v.impact === "critical" || v.impact === "serious")
    .map((v) => `${v.id} (${v.impact}): ${v.nodes.length} node(s)`);
}

test("home page has no critical or serious a11y violations", async ({ page }) => {
  await page.goto("/check?stay=1");
  await expect(
    page.getByRole("button", { name: "Check this meal" })
  ).toBeVisible();

  expect(await blockingViolations(page)).toEqual([]);
});

test("privacy page has no critical or serious a11y violations", async ({
  page
}) => {
  await page.goto("/privacy");
  await expect(
    page.getByRole("heading", { name: /how prediabetes pal handles your data/i })
  ).toBeVisible();

  expect(await blockingViolations(page)).toEqual([]);
});

test("terms page has no critical or serious a11y violations", async ({
  page
}) => {
  await page.goto("/terms");
  await expect(
    page.getByRole("heading", { name: /terms of service/i })
  ).toBeVisible();

  expect(await blockingViolations(page)).toEqual([]);
});

test("signin page has no critical or serious a11y violations", async ({
  page
}) => {
  // Default env (no NEXT_PUBLIC_REVIEWER_MODE) — the reviewer-access form is
  // absent, same as production.
  await page.goto("/signin");
  await expect(
    page.getByRole("heading", { name: /sign in with your email/i })
  ).toBeVisible();

  expect(await blockingViolations(page)).toEqual([]);
});

test("check-email page has no critical or serious a11y violations", async ({
  page
}) => {
  await page.goto("/signin/check-email");
  await expect(
    page.getByRole("heading", { name: /check your email/i })
  ).toBeVisible();

  expect(await blockingViolations(page)).toEqual([]);
});

test("signed-out /pantry/intake redirect target has no critical or serious a11y violations", async ({
  page
}) => {
  // No session → the intake page redirects to the signin variant that carries a
  // callbackUrl back to /pantry/intake. This runs on any box (the redirect fires
  // before any DB access). The signed-in real page is covered below, env-gated.
  await page.goto("/pantry/intake");
  await expect(page).toHaveURL(/\/signin\?callbackUrl=/);
  await expect(
    page.getByRole("heading", { name: /sign in with your email/i })
  ).toBeVisible();

  expect(await blockingViolations(page)).toEqual([]);
});

test("result state has no critical or serious a11y violations", async ({
  page
}) => {
  await page.route("**/api/check", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        kind: "result",
        risk: "MODERATE",
        reason: "This leans carb-heavy for your range.",
        adjustment: "Add protein or nonstarchy vegetables.",
        swap: "Swap to brown rice if you can.",
        disclaimer: "Not medical advice."
      })
    });
  });

  await page.goto("/check?stay=1");
  await page.getByLabel(/what are you thinking about eating/i).fill("white rice");
  await page.getByLabel(/latest a1c/i).fill("6.1");
  await page.getByRole("button", { name: "Check this meal" }).click();
  await expect(page.getByTestId("result-card")).toBeVisible();

  expect(await blockingViolations(page)).toEqual([]);
});

test("error/status surface has no critical or serious a11y violations", async ({
  page
}) => {
  // 500 routes to the RequestStatus error surface — the same component used for
  // the submitting/slow/paused/network states.
  await page.route("**/api/check", async (route) => {
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({
        kind: "retry",
        message: "x",
        disclaimer: "Not medical advice."
      })
    });
  });

  await page.goto("/check?stay=1");
  await page.getByLabel(/what are you thinking about eating/i).fill("white rice");
  await page.getByLabel(/latest a1c/i).fill("6.1");
  await page.getByRole("button", { name: "Check this meal" }).click();
  await expect(page.getByTestId("request-status")).toBeVisible();

  expect(await blockingViolations(page)).toEqual([]);
});

// ---------------------------------------------------------------------------
// Signed-in pantry surfaces — same env gating as tests/smoke/pantry.spec.ts.
// These render only for a signed-in user with a claimed order (intake) or a
// ready report (report page), so they skip cleanly on unprovisioned boxes.
// ---------------------------------------------------------------------------

const STUB_DIR = process.env.AUTH_EMAIL_STUB_DIR;
const PANTRY_ENABLED = Boolean(
  process.env.DATABASE_URL &&
    STUB_DIR &&
    process.env.PANTRY_BLOB_READ_WRITE_TOKEN &&
    process.env.PANTRY_EXTRACT_STUB === "1"
);

function seedOrder(email: string): { claimUrl: string } {
  const out = execFileSync("node", ["scripts/seed-pantry-order.mjs", email], {
    // localhost, not 127.0.0.1: next start reports request.url on localhost
    // regardless of the bind address, so the whole signed-in flow (magic link,
    // host-only session cookie, claim binding) lives on localhost — a
    // 127.0.0.1 claim URL never sees the session cookie.
    env: { ...process.env, NEXT_PUBLIC_APP_URL: "http://localhost:3100" }
  });
  return JSON.parse(out.toString());
}

async function signInVia(page: Page, email: string, url: string) {
  await page.goto(url);
  await expect(page).toHaveURL(/signin/);
  await page.getByLabel("Email address").fill(email);
  await page.getByRole("button", { name: /email me a sign-in link/i }).click();
  const mailboxFile = path.join(
    STUB_DIR!,
    `${email.replace(/[^a-z0-9@.]/gi, "_")}.json`
  );
  await expect
    .poll(() => fs.existsSync(mailboxFile), { timeout: 10_000 })
    .toBe(true);
  const { url: magicLink } = JSON.parse(fs.readFileSync(mailboxFile, "utf8"));
  await page.goto(magicLink);
}

test.describe("signed-in pantry surfaces", () => {
  test.skip(
    !PANTRY_ENABLED,
    "pantry a11y needs DATABASE_URL, AUTH_EMAIL_STUB_DIR, PANTRY_BLOB_READ_WRITE_TOKEN, PANTRY_EXTRACT_STUB=1"
  );

  test("pantry intake page has no critical or serious a11y violations", async ({
    page
  }) => {
    const email = `a11y-intake-${Date.now()}@pal.test`;
    const { claimUrl } = seedOrder(email);

    await signInVia(page, email, claimUrl);
    // The callback returns to the claim URL, which binds the order and lands on intake.
    await page.goto(claimUrl);
    await expect(page).toHaveURL(/pantry\/intake/);
    await expect(page.getByText("Your Pantry Review")).toBeVisible();

    expect(await blockingViolations(page)).toEqual([]);
  });

  test("report page has no critical or serious a11y violations", async ({
    page
  }) => {
    test.skip(
      !process.env.OPENAI_API_KEY,
      "needs OPENAI_API_KEY — the report requires a real judged report (no stub)"
    );
    const email = `a11y-report-${Date.now()}@pal.test`;
    const { claimUrl } = seedOrder(email);

    await signInVia(page, email, claimUrl);
    await page.goto(claimUrl);
    const photoPath = path.join(STUB_DIR!, `a11y-report-${Date.now()}.jpg`);
    await page.screenshot({ path: photoPath, type: "jpeg" });
    await page.locator("#photos").setInputFiles(photoPath);
    await expect(page.getByText(/1 of 10/)).toBeVisible({ timeout: 30_000 });
    await page.locator("#band").selectOption("prediabetes_60_62");
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: /send photos for review/i }).click();
    await expect(page.getByRole("heading", { name: /here's what we saw/i })).toBeVisible({
      timeout: 60_000
    });
    await page.getByRole("button", { name: "Remove" }).last().click();
    await page.getByRole("button", { name: /review 2 items/i }).click();

    // The report email carries the /report/<orderId> link; open it once ready.
    const reportEmail = () =>
      fs
        .readdirSync(STUB_DIR!)
        .filter(
          (file) =>
            file.startsWith(email.replace(/[^a-z0-9@.]/gi, "_")) &&
            file.includes("-")
        )
        .map((file) =>
          JSON.parse(fs.readFileSync(path.join(STUB_DIR!, file), "utf8"))
        )
        .find((message) => /\/report\/[a-f0-9-]+/.test(message.text));
    await expect
      .poll(() => Boolean(reportEmail()), { timeout: 120_000 })
      .toBe(true);

    const link =
      /https?:\/\/\S+\/report\/[a-f0-9-]+/.exec(reportEmail()!.text)?.[0] ?? "";
    await page.goto(link.replace(/^https?:\/\/[^/]+/, "http://localhost:3100"));
    await expect(
      page.getByText(/enjoy freely|worth a tweak|handle with care/i).first()
    ).toBeVisible();

    expect(await blockingViolations(page)).toEqual([]);
  });
});
