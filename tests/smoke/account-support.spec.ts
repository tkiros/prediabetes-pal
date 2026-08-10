import fs from "node:fs";
import path from "node:path";

import { expect, test, type Page } from "@playwright/test";

/**
 * P0.4 account surfaces E2E (C7 plan §11): the "Download your data" export
 * link and the help/refund round-trip — form → 201 case → confirmation with
 * case id → PII-minimized queue notice (read from the AUTH_EMAIL_STUB_DIR
 * seam, exactly like auth.spec.ts reads magic links) → full message in the
 * authenticated user's export.
 *
 * Env-gated like auth.spec.ts: needs a real database + the email stub.
 *
 *   DATABASE_URL=<disposable loopback database> \
 *     AUTH_EMAIL_STUB_DIR=/tmp/pal-mailbox \
 *     npx playwright test tests/smoke/account-support.spec.ts
 */

const STUB_DIR = process.env.AUTH_EMAIL_STUB_DIR;
const ENABLED = Boolean(process.env.DATABASE_URL && STUB_DIR);

test.skip(
  !ENABLED,
  "account-support E2E needs DATABASE_URL + AUTH_EMAIL_STUB_DIR (Railway dev database)"
);

async function signIn(page: Page): Promise<string> {
  const email = `e2e-support-${Date.now()}@pal.test`;

  await page.goto("/signin");
  await page.getByLabel("Email address").fill(email);
  await page.getByRole("button", { name: /email me a sign-in link/i }).click();
  await expect(page).toHaveURL(/check-email/);

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
  return email;
}

test("account: support case keeps free text out of the queue notice", async ({
  page
}) => {
  const email = await signIn(page);
  await page.goto("/account");

  // PR-5 residual: the export door is a plain link to the JSON export.
  await expect(page.getByTestId("account-export-link")).toHaveAttribute(
    "href",
    "/api/account/export"
  );
  const exportResponse = await page.request.get("/api/account/export");
  expect(exportResponse.ok()).toBe(true);
  const exported = await exportResponse.json();
  expect(exported).toHaveProperty("supportCases");

  // Refund kind surfaces the refund-window copy inline.
  const form = page.getByTestId("support-case-form");
  await expect(form).toBeVisible();
  await page.getByLabel("What do you need?").selectOption("refund");
  await expect(page.getByTestId("refund-window-hint")).toBeVisible();

  const message = `E2E refund probe ${Date.now()} — please disregard.`;
  await page.getByLabel("Your message").fill(message);
  const supportResponsePromise = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/support/case") &&
      response.request().method() === "POST"
  );
  await page.getByTestId("support-case-submit").click();
  const supportResponse = await supportResponsePromise;
  expect(supportResponse.status()).toBe(201);
  const result = (await supportResponse.json()) as {
    caseId: string;
    emailed: boolean;
  };
  expect(result.caseId).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  );
  expect(result.emailed).toBe(true);

  // Confirmation carries the case id; the form is replaced, not cleared.
  const done = page.getByTestId("support-case-done");
  await expect(done).toBeVisible();
  await expect(done).toContainText(`Case #${result.caseId.slice(0, 8)}`);
  await expect(page.getByTestId("support-case-form")).toHaveCount(0);

  type StubMessage = {
    category?: string;
    subject?: string;
    text?: string;
  };
  const findQueueNotice = () =>
    fs
      .readdirSync(STUB_DIR!)
      .map(
        (file) =>
          JSON.parse(
            fs.readFileSync(path.join(STUB_DIR!, file), "utf8")
          ) as StubMessage
      )
      .find(
        (stub) =>
          stub.category === "support_case" &&
          stub.subject?.includes(result.caseId)
      );

  // The operational notice identifies the encrypted queue row without
  // copying the user's email or free text into another provider surface.
  await expect
    .poll(() => Boolean(findQueueNotice()), { timeout: 10_000 })
    .toBe(true);
  const queueNotice = findQueueNotice()!;
  expect(queueNotice.text).toContain(result.caseId);
  expect(queueNotice.text).toContain("/api/admin/support");
  expect(queueNotice.text).not.toContain(message);
  expect(queueNotice.text).not.toContain(email);
  expect(queueNotice.subject).not.toContain(message);
  expect(queueNotice.subject).not.toContain(email);

  // The authenticated user's export retains the exact message.
  const afterExport = await (await page.request.get("/api/account/export")).json();
  const cases = afterExport.supportCases as Array<{
    kind?: string;
    message?: string;
  }>;
  expect(cases).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ kind: "refund", message })
    ])
  );

  // "Send another message" restores the form.
  await page.getByRole("button", { name: /send another message/i }).click();
  await expect(page.getByTestId("support-case-form")).toBeVisible();
});
