import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { expect, test } from "@playwright/test";

/**
 * Pantry Review E2E. Needs (same posture as auth.spec.ts):
 *   DATABASE_URL + AUTH_EMAIL_STUB_DIR + PANTRY_BLOB_READ_WRITE_TOKEN +
 *   PANTRY_EXTRACT_STUB=1  (extraction stub — no OpenAI traffic)
 * The report-delivery test additionally needs OPENAI_API_KEY (the judge has
 * no stub, deliberately) and judges 2 items live.
 */

const STUB_DIR = process.env.AUTH_EMAIL_STUB_DIR;
const ENABLED = Boolean(
  process.env.DATABASE_URL &&
    STUB_DIR &&
    process.env.PANTRY_BLOB_READ_WRITE_TOKEN &&
    process.env.PANTRY_EXTRACT_STUB === "1"
);

test.skip(
  !ENABLED,
  "pantry E2E needs DATABASE_URL, AUTH_EMAIL_STUB_DIR, PANTRY_BLOB_READ_WRITE_TOKEN, PANTRY_EXTRACT_STUB=1"
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

async function signInVia(
  page: import("@playwright/test").Page,
  email: string,
  url: string
) {
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

test("claim → intake → edit drafts → confirm → processing (extraction stubbed)", async ({
  page
}) => {
  const email = `pantry-e2e-${Date.now()}@pal.test`;
  const { claimUrl } = seedOrder(email);

  await signInVia(page, email, claimUrl);
  // After sign-in the callback returns to the claim URL which binds + lands on intake.
  await page.goto(claimUrl);
  await expect(page).toHaveURL(/pantry\/intake/);
  await expect(page.getByText("Your Pantry Review")).toBeVisible();

  // A real JPEG for the blob upload: screenshot the page itself.
  const photoPath = path.join(STUB_DIR!, `pantry-e2e-${Date.now()}.jpg`);
  await page.screenshot({ path: photoPath, type: "jpeg" });
  await page.locator("#photos").setInputFiles(photoPath);
  await expect(page.getByText(/1 of 10/)).toBeVisible({ timeout: 30_000 });

  await page.locator("#band").selectOption("prediabetes_60_62");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: /send photos for review/i }).click();

  // Stubbed extraction returns 3 fixed items.
  await expect(page.getByRole("heading", { name: /here's what we saw/i })).toBeVisible({
    timeout: 60_000
  });

  // Edit: fix a name, remove an item, then confirm.
  await page.locator("#item-name-0").fill("steel cut oats");
  await page.getByRole("button", { name: "Remove" }).last().click();
  await page.getByRole("button", { name: /review 2 items/i }).click();

  await expect(page.getByText(/you'll get an email/i)).toBeVisible({
    timeout: 30_000
  });
});

test("report is generated and emailed (live judge)", async ({ page }) => {
  test.skip(
    !process.env.OPENAI_API_KEY,
    "needs OPENAI_API_KEY — judges 2 items live"
  );
  const email = `pantry-live-${Date.now()}@pal.test`;
  const { claimUrl } = seedOrder(email);

  await signInVia(page, email, claimUrl);
  await page.goto(claimUrl);
  const photoPath = path.join(STUB_DIR!, `pantry-live-${Date.now()}.jpg`);
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

  // Poll the stub mailbox for the report email, then open the link. The report
  // email (lib/server/pantry/emails.ts) carries subject "Your Pantry Review is
  // ready" and a /report/<orderId> link in its body — match on that link so we
  // never confuse it with the intake email (no link) or the magic link
  // (<email>.json, no timestamp separator).
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
  await expect(
    page.getByRole("button", { name: /save as pdf/i })
  ).toBeVisible();
});
