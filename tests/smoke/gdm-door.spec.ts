// tests/smoke/gdm-door.spec.ts
//
// Two describes, gated on the running app's OWN reported state (never the
// Playwright process's env — tests/smoke/guide-door.ts's rule, Task 0.3's
// createDoorProbe()). Dark proves the second front door leaks nothing before
// `gdm-organiser` clears its line; landing proves the door PR-L actually
// built: the working name leads, sign-up goes through the existing sign-in,
// and the door's own metadata/manifest/link-preview speak for it (G-30, R36).
import fs from "node:fs";
import path from "node:path";

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { GDM_COPY } from "../../lib/pal/gdm/copy";
import { GDM_ROUTES } from "../../lib/pal/gdm/routes";
import { loadSafetyContract } from "../../lib/pal/safety-contract";
import { doorSurfaceOn } from "./gdm-door";

const DARK_PATHS = [
  "/gdm",
  "/gdm/start",
  "/gdm/home",
  "/gdm/questions",
  "/gdm/plan",
  "/gdm/meals",
  "/gdm/summary",
  "/gdm/data",
  "/gdm/privacy"
] as const;

const TOLD = GDM_COPY["gdm-onboarding-told"];
const DATE = GDM_COPY["gdm-onboarding-date"];
const CONSENT = GDM_COPY["gdm-onboarding-consent"];
const DATA_CONTROLS = GDM_COPY["gdm-data-controls"];
const NAV = GDM_COPY["gdm-nav"];
const ASKS = GDM_COPY["gdm-asklist-controls"];
const STATUS = GDM_COPY["gdm-status"];
const PLAN = GDM_COPY["gdm-plan-controls"];
const OCCASIONS = GDM_COPY["gdm-occasions"];
const DIFFER = GDM_COPY["gdm-plan-differ"];
const WAIT = GDM_COPY["gdm-wait-controls"];
const STRUCTURE = GDM_COPY["gdm-wait-structure"];
const CHECKLIST = GDM_COPY["gdm-wait-checklist"];
const MEALS = GDM_COPY["gdm-meals-controls"];
const SUMMARY = GDM_COPY["gdm-summary-headings"];
const SAVE_FAILED = GDM_COPY["gdm-save-failed"].line;
/** A real 1×1 PNG: the sheet photo the device downscales, re-encodes and sends (Task 3.3). */
const PNG_1X1 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

test.describe("GDM door — dark", () => {
  test.beforeEach(async () => {
    test.skip(await doorSurfaceOn("landing"), "landing surface on in this build");
  });

  for (const darkPath of DARK_PATHS) {
    test(`${darkPath} is a 404 with the flag off — and the 404 carries no GDM string`, async ({ page }) => {
      const response = await page.goto(darkPath);
      expect(response?.status()).toBe(404);
      // No user-visible GDM string before `gdm-organiser` exists: not even the
      // working name, not even on an error page rendered inside app/gdm/layout.tsx.
      const body = await page.locator("body").innerText();
      expect(body).not.toContain(GDM_COPY["gdm-door-name"].name);
      expect(body).not.toMatch(/gestational/i);
      // L.1's G-30 dark leg: the door's own <title> never leaks either, even
      // where the body-text assertions above cannot see it (a <head> value).
      expect(await page.title()).not.toMatch(/gestational/i);
      // G-28: the two assertions above name only the working name and
      // "gestational" — a leaked nav (now that `gdm-nav` is filed, Task 1.4)
      // names neither, so it would otherwise pass this test undetected.
      expect(body).not.toContain(GDM_COPY["gdm-nav"].asks);
    });
  }

  test("the manifest and the link-preview image are 404 while dark (R36)", async ({ request }) => {
    expect((await request.get(GDM_ROUTES.manifest)).status()).toBe(404);
    expect((await request.get("/gdm/opengraph-image")).status()).toBe(404);
  });
});

test.describe("GDM door — landing", () => {
  test.beforeEach(async () => {
    test.skip(!(await doorSurfaceOn("landing")), "landing surface off in this build");
  });

  test("leads with the working name, signs up through /signin, and is axe-clean", async ({ page }) => {
    await page.goto("/gdm");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(GDM_COPY["gdm-door-name"].name);
    await expect(page.getByRole("link", { name: GDM_COPY["gdm-landing-hero"].cta })).toHaveAttribute(
      "href",
      GDM_ROUTES.signup
    );
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });

  test("the frame's own metadata and manifest link speak for this door (G-30)", async ({ page }) => {
    await page.goto("/gdm");
    await expect(page.locator('meta[property="og:site_name"]')).toHaveAttribute(
      "content",
      GDM_COPY["gdm-door-name"].name
    );
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", GDM_ROUTES.manifest);
  });

  test("the link-preview image is a real image once the door is open (R36)", async ({ page, request }) => {
    await page.goto("/gdm");
    // The opengraph-image file convention can be served under a hashed or
    // suffixed URL (confirmed on a real build, Task L.1 report) — read the
    // actual URL from the page's own og:image meta tag rather than assuming
    // the bare route.
    const imageUrl = await page.locator('meta[property="og:image"]').getAttribute("content");
    expect(imageUrl).toBeTruthy();
    const response = await request.get(imageUrl!);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toMatch(/^image\//);
  });

  test("the no-food-guidance line appears before Sign up in document order (G-68)", async ({ page }) => {
    await page.goto("/gdm");
    const bodyHTML = await page.locator("body").innerHTML();
    const scopeIndex = bodyHTML.indexOf(GDM_COPY["gdm-landing-points"].scope);
    const signupIndex = bodyHTML.indexOf(GDM_ROUTES.signup);
    expect(scopeIndex).toBeGreaterThan(-1);
    expect(signupIndex).toBeGreaterThan(-1);
    expect(scopeIndex).toBeLessThan(signupIndex);
  });

  test("a signed-out visitor to the door is sent to sign in, never to the A1C form", async ({ page }) => {
    await page.goto("/gdm/start");
    await expect(page).toHaveURL(/\/signin\?callbackUrl=%2Fgdm%2Fstart/);
  });
});

// Task 1.5, brief Step 1: /gdm/privacy is public once the organiser is on
// (Yes: the row belongs to that surface, but no sign-in is needed to read it),
// so it gets its own describe rather than riding the "landing" one above,
// which only proves the `landing` surface is on — a landing-only build 404s
// this route (app/gdm/privacy/page.tsx).
test.describe("GDM door — organiser", () => {
  test.beforeEach(async () => {
    test.skip(!(await doorSurfaceOn("organiser")), "organiser surface off in this build");
  });

  test("/gdm/privacy renders its heading and is axe-clean", async ({ page }) => {
    await page.goto(GDM_ROUTES.privacy);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(GDM_COPY["gdm-privacy-notice"].title);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });
});

// G-03: the signed-in leg, on the pattern the guide door's PR-5 used — sign in
// through the app's own existing magic-link flow (never a real email
// provider: tests/smoke/auth.spec.ts's disk-mailbox pattern), then PR-1's own
// legs: onboarding with no A1C, an unticked consent box that explains itself
// and sends nothing before it lets her through, and an erase that returns her
// to onboarding rather than Home. PR-2 adds My questions between consent and
// erase: park a question, a shaky one raises the approved clinical card above
// the list, a number-shaped worry raises nothing. PR-3's My plan runs as its
// own test (its own time budget, its own account): two plans that differ at
// Lunch both carry the "These differ" chip and park the differ question into
// My questions; a sheet photo the device cannot open fails cleanly, one it
// can is kept, shown, linked for download on Your data (G-62) and removed in
// two presses; then one of the two plans no longer stands (final review F2),
// leaving one current plan, nothing flagged, and the other dated among her
// replaced plans, on My plan and on Home. PR-4's Home runs as its own test too: with a date given at
// consent, Home leads with the appointment (a phrase and her date, never a
// day count), then a plain checklist with nothing to tick and ACOG's line;
// her date changes there; once a plan is entered, Home shows it on the plan
// page's card, the waiting content is gone, and the appointment still leads.
// PR-5's My meals runs as its own test too: one add form with no readings
// field, a meal saved under its occasion brings that occasion's heading and
// no other, her Include in my summary tick is kept, and Delete takes two
// presses. Gated on the organiser surface via /api/health (this file's rule
// throughout) — never the Playwright env.

/** A day `offset` days from today on the BROWSER's clock, as YYYY-MM-DD, and the words Home shows for it (formatIsoDate's own recipe). */
async function deviceDay(page: Page, offset: number): Promise<{ iso: string; shown: string }> {
  return page.evaluate((days) => {
    const day = new Date();
    day.setDate(day.getDate() + days);
    const pad = (n: number) => String(n).padStart(2, "0");
    const iso = `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`;
    const local = new Date(day.getFullYear(), day.getMonth(), day.getDate());
    const shown = new Intl.DateTimeFormat(undefined, { weekday: "long", day: "numeric", month: "long" }).format(local);
    return { iso, shown };
  }, offset);
}

/** The first element appears before the second in document order. */
async function leads(page: Page, first: string, second: string): Promise<boolean> {
  return page.evaluate(
    ([a, b]) => {
      const one = document.querySelector(a);
      const two = document.querySelector(b);
      return Boolean(one && two && one.compareDocumentPosition(two) & Node.DOCUMENT_POSITION_FOLLOWING);
    },
    [first, second] as const
  );
}

/**
 * Signs a fresh account up through the app's own magic-link flow (the disk
 * mailbox) and lands on /gdm/start. A fresh, unique email per run: reruns of
 * this spec share the disposable e2e database, and a repeated address would
 * collide with an earlier run's (erased, but possibly still in-flight) profile.
 */
async function signUp(page: Page): Promise<void> {
  const stubDir = process.env.AUTH_EMAIL_STUB_DIR;
  const email = `gdm-e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@pal.test`;

  await page.goto(GDM_ROUTES.signup);
  await page.getByLabel("Email address").fill(email);
  await page.getByRole("button", { name: /email me a sign-in link/i }).click();
  await expect(page).toHaveURL(/check-email/);

  const mailboxFile = path.join(stubDir!, `${email.replace(/[^a-z0-9@.]/gi, "_")}.json`);
  await expect.poll(() => fs.existsSync(mailboxFile), { timeout: 10_000 }).toBe(true);
  const { url } = JSON.parse(fs.readFileSync(mailboxFile, "utf8")) as { url: string };

  // Follow the verification link, then navigate to /gdm/start explicitly.
  // Verified directly (curl -D-, not guessed): even though the mailbox
  // link and its embedded callbackUrl are both correctly 127.0.0.1:3100,
  // this e2e server's auth callback issues `location: http://localhost:3100`
  // and sets `authjs.callback-url=...localhost...` — most likely Auth.js's
  // default `redirect` callback computing its trusted origin as `localhost`
  // (a common default) while AUTH_URL/NEXTAUTH_URL sit blanked here
  // (scripts/e2e-runtime-env.ts) for provider isolation; the exact "why"
  // inside Auth.js was not isolated further, and this is shared auth.ts
  // infrastructure outside the door's own files either way. The session
  // cookie itself IS set against 127.0.0.1 (the host that actually served
  // the 302), so the explicit re-navigation below carries it correctly —
  // confirmed by the tests that use this succeeding. tests/smoke/auth.spec.ts
  // sidesteps the same thing by never asserting where the link itself
  // lands and re-navigating to a known path next.
  await page.goto(url);
  await page.goto(GDM_ROUTES.start);
}

/** Your data: erase, behind a second press; the landing follows. */
async function erase(page: Page): Promise<void> {
  await page.goto(GDM_ROUTES.data);
  await page.getByRole("button", { name: DATA_CONTROLS.erase }).click();
  await page.getByRole("button", { name: DATA_CONTROLS.eraseGo }).click();
  await expect(page).toHaveURL(new RegExp(`${GDM_ROUTES.landing}$`));
}

test.describe("GDM door — organiser, signed in", () => {
  test.beforeEach(async () => {
    test.skip(!(await doorSurfaceOn("organiser")), "organiser surface off in this build");
  });

  test("no A1C onboarding, an unticked consent explains itself, questions park and only a clinical one raises the card, erase returns her to onboarding", async ({
    page
  }) => {
    await signUp(page);

    // Step 1: told?
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(TOLD.ask);
    await page.getByRole("button", { name: TOLD.yes }).click();

    // Step 2: appointment date — optional; typed here to exercise the field.
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(DATE.ask);
    await page.locator("#gdm-appointment").fill("2026-10-08");
    await page.getByRole("button", { name: DATE.next }).click();

    // Step 3: consent — the checkbox is NOT checked by default.
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(CONSENT.what);
    const checkbox = page.getByRole("checkbox", { name: CONSENT.agree });
    await expect(checkbox).not.toBeChecked();

    // One axe check on an onboarding step: this one carries a checkbox, an
    // in-place details/summary notice, and (below) a live error line.
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

    // Task 1.4's carry note: an unticked press must send NOTHING, not just
    // "no navigation" — watch the wire, not only the URL.
    const profileRequests: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("/api/gdm/profile")) profileRequests.push(request.method());
    });

    // G-35: a press while unticked explains itself and sends nothing — the
    // URL does not change.
    await page.getByRole("button", { name: CONSENT.go }).click();
    // #gdm-consent-required, not a bare role=alert query: Next's route
    // announcer is also role="alert" and would make that locator ambiguous.
    await expect(page.locator("#gdm-consent-required")).toHaveText(GDM_COPY["gdm-consent-required"].line);
    await expect(page).toHaveURL(new RegExp(`${GDM_ROUTES.start}$`));
    expect(profileRequests).toEqual([]);

    await checkbox.check();
    await page.getByRole("button", { name: CONSENT.go }).click();
    await expect(page).toHaveURL(new RegExp(`${GDM_ROUTES.home}$`));
    // Positive control: the listener above is wired to something real — the
    // ticked press really does POST /api/gdm/profile.
    expect(profileRequests).toEqual(["POST"]);

    // A profile now exists: /gdm/start redirects straight to Home.
    await page.goto(GDM_ROUTES.start);
    await expect(page).toHaveURL(new RegExp(`${GDM_ROUTES.home}$`));

    // PR-2, My questions (F-ASKLIST). G-34: from Home, the nav's one filled
    // action lands on the questions form, the field ready for her words.
    await page.getByRole("link", { name: NAV.add }).click();
    await expect(page).toHaveURL(new RegExp(`${GDM_ROUTES.quickAdd}$`));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(ASKS.title);
    const field = page.getByLabel(ASKS.field, { exact: true });
    await expect(field).toBeFocused();
    // ...and it is not rendered on the questions page, where the form is first.
    await expect(page.getByRole("link", { name: NAV.add })).toHaveCount(0);
    await expect(page.getByText(ASKS.empty)).toBeVisible(); // G-25

    const addButton = page.getByRole("button", { name: ASKS.add, exact: true });
    const list = page.locator("ul.gdm-asks");
    const card = page.locator('[data-kind="clinical"]');

    // Park an ordinary question: listed, the field cleared and focused again (G-39).
    const sheets = "Which of my two sheets should I follow?";
    await field.fill(sheets);
    await addButton.click();
    await expect(list.getByText(sheets)).toBeVisible();
    await expect(field).toHaveValue("");
    await expect(field).toBeFocused();
    await expect(card).toHaveCount(0);

    // A shaky, clammy question: the Approved possible-hypoglycaemia copy,
    // served by the items API verbatim, in an alert above the list whose
    // heading takes focus (G-46). The question is still parked. Located by
    // data-kind, not role=alert: Next's route announcer is also role="alert".
    const shaky = "feeling shaky and clammy";
    await field.fill(shaky);
    await addButton.click();
    await expect(card).toHaveAttribute("role", "alert");
    await expect(card).toHaveAttribute("data-route", "possible_hypoglycemia");
    await expect(card.getByRole("heading", { level: 2 })).toHaveText(ASKS.cardTitle);
    await expect(card.locator(".result-copy")).toHaveText(
      loadSafetyContract().copy.clinicalRoutes.possible_hypoglycemia
    );
    await expect(card.getByRole("heading", { level: 2 })).toBeFocused();
    await expect(list.getByText(shaky)).toBeVisible();
    expect(
      await page.evaluate(() => {
        const alert = document.querySelector('[data-kind="clinical"]');
        const asks = document.querySelector("ul.gdm-asks");
        return Boolean(alert && asks && alert.compareDocumentPosition(asks) & Node.DOCUMENT_POSITION_FOLLOWING);
      })
    ).toBe(true);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

    // A number-shaped worry: NO card, and no product sentence about it — the
    // page's own words, outside her list and the status line, do not change.
    await page.reload();
    await expect(list.getByText(sheets)).toBeVisible();
    const productText = () =>
      page.evaluate(() => {
        const main = document.querySelector("main")!.cloneNode(true) as HTMLElement;
        main.querySelectorAll("ul.gdm-asks, .gdm-status").forEach((node) => node.remove());
        return main.textContent;
      });
    const before = await productText();
    const fasting = "why was my fasting high";
    await field.fill(fasting);
    await addButton.click();
    await expect(list.getByText(fasting)).toBeVisible();
    await expect(page.locator(".gdm-status")).toHaveText(STATUS.saved);
    await expect(card).toHaveCount(0);
    expect(await productText()).toBe(before);
    const pageText = await page.locator("body").innerText();
    for (const routeCopy of Object.values(loadSafetyContract().copy.clinicalRoutes)) {
      expect(pageText).not.toContain(routeCopy);
    }

    // Asked, and what they said: saved and announced (G-36); an asked
    // question sorts below the open ones, and focus stays on its Save.
    const sheetsRow = list.locator("li", { hasText: sheets });
    await sheetsRow.getByRole("checkbox", { name: ASKS.asked }).check();
    await sheetsRow.getByLabel(ASKS.answer).fill("The newer one stands.");
    await sheetsRow.getByRole("button", { name: ASKS.save }).click();
    await expect(page.locator(".gdm-status")).toHaveText(STATUS.saved);
    await expect(list.locator("li").last()).toContainText(sheets);
    await expect(sheetsRow.getByRole("button", { name: ASKS.save })).toBeFocused();

    // G-76: deleting her own words takes two presses. The first only asks,
    // with focus on Cancel; the second deletes, and focus moves to the next
    // question's first control (G-39).
    const fastingRow = list.locator("li", { hasText: fasting });
    await fastingRow.getByRole("button", { name: ASKS.remove }).click();
    await expect(fastingRow.getByRole("button", { name: DATA_CONTROLS.cancel })).toBeFocused();
    await expect(list.locator("li")).toHaveCount(3);
    await fastingRow.getByRole("button", { name: ASKS.remove }).click();
    await expect(list.locator("li")).toHaveCount(2);
    await expect(page.locator(".gdm-status")).toHaveText(STATUS.removed);
    await expect(list.locator("li", { hasText: shaky }).getByRole("checkbox", { name: ASKS.asked })).toBeFocused();

    // What was saved is what comes back.
    await page.reload();
    await expect(list.locator("li")).toHaveCount(2);
    await expect(list.locator("li", { hasText: sheets }).getByRole("checkbox", { name: ASKS.asked })).toBeChecked();
    await expect(list.locator("li", { hasText: sheets }).getByLabel(ASKS.answer)).toHaveValue("The newer one stands.");

    // Your data: erase, behind a second press.
    await erase(page);

    // The erased profile means onboarding again, never Home.
    await page.goto(GDM_ROUTES.start);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(TOLD.ask);
  });

  // PR-3, My plan (F-PLANKEEP; Task 3.4 folded into 3.3 — R12, R35, G-03).
  test("My plan: two plans that differ at Lunch are both flagged and park their question; a sheet photo is kept as a photo", async ({
    page
  }) => {
    // Onboarding's quick path: told, no date, consent.
    await signUp(page);
    await page.getByRole("button", { name: TOLD.yes }).click();
    await page.getByRole("button", { name: DATE.skip }).click();
    await page.getByRole("checkbox", { name: CONSENT.agree }).check();
    await page.getByRole("button", { name: CONSENT.go }).click();
    await expect(page).toHaveURL(new RegExp(`${GDM_ROUTES.home}$`));

    // The empty plan renders empty: the form first, no card, the drafted empty line.
    await page.goto(GDM_ROUTES.plan);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(PLAN.title);
    await expect(page.getByText(PLAN.empty)).toBeVisible();
    const cards = page.locator("ul.gdm-plan-current > li");
    await expect(cards).toHaveCount(0);
    const status = page.locator(".gdm-status");

    const enterPlan = async (givenBy: string, lunch: string) => {
      await page.getByLabel(PLAN.givenBy, { exact: true }).fill(givenBy);
      await page.getByLabel(PLAN.counts, { exact: true }).selectOption("grams");
      await page.getByLabel(OCCASIONS.lunch, { exact: true }).fill(lunch);
      await page.getByRole("button", { name: PLAN.save, exact: true }).click();
      await expect(status).toHaveText(STATUS.saved);
    };
    await enterPlan("the dietitian", "45 g");
    await expect(cards).toHaveCount(1);
    // R50: a second clinician's sheet stands beside the first, never in its place.
    await page.getByRole("button", { name: PLAN.addAnother }).click();
    await expect(page.getByLabel(PLAN.givenBy, { exact: true })).toBeFocused();
    await enterPlan("the clinic nurse", "30 g");
    await expect(cards).toHaveCount(2);

    // Two entries that differ at Lunch: both shown, both carrying the same
    // neutral chip at Lunch and nowhere else, neither picked (§6.1 row 12).
    await expect(cards.nth(0)).toContainText("30 g");
    await expect(cards.nth(1)).toContainText("45 g");
    for (const card of [cards.nth(0), cards.nth(1)]) {
      await expect(card.locator(".gdm-plan-row", { hasText: OCCASIONS.lunch }).locator(".gdm-differ-chip")).toHaveText(
        DIFFER.flag
      );
    }
    await expect(page.locator(".gdm-differ-chip")).toHaveCount(2);

    // "Add to my questions" parks the differ question in her list.
    const parkPost = page.waitForResponse(
      (response) => response.url().endsWith("/api/gdm/items") && response.request().method() === "POST"
    );
    await cards.nth(0).getByRole("button", { name: DIFFER.park }).click();
    expect((await parkPost).status()).toBe(200);
    await expect(status).toHaveText(STATUS.saved);
    await page.goto(GDM_ROUTES.questions);
    await expect(page.locator("ul.gdm-asks").getByText(DIFFER.askText.replace("{occasion}", OCCASIONS.lunch))).toBeVisible();

    // Task 3.3: a photo of her sheet, kept as a photo. A file the device
    // cannot open shows the save-failed line and clears the input (G-20).
    await page.goto(GDM_ROUTES.plan);
    await expect(page.getByRole("button", { name: PLAN.photoAdd })).toBeVisible();
    const fileInput = page.locator('input[type="file"]');
    const photo = page.getByRole("img", { name: PLAN.photoAlt });
    await fileInput.setInputFiles({ name: "sheet.heic", mimeType: "image/heic", buffer: Buffer.from("not a picture") });
    await expect(page.getByText(SAVE_FAILED)).toBeVisible();
    await expect(fileInput).toHaveValue("");
    await expect(photo).toHaveCount(0);

    // A picture the device can open is downscaled, sent, and shown back: a
    // lazy image whose bytes this browser decodes.
    await fileInput.setInputFiles({ name: "sheet.png", mimeType: "image/png", buffer: Buffer.from(PNG_1X1, "base64") });
    await expect(photo).toHaveCount(1);
    await expect(status).toHaveText(STATUS.saved);
    await expect(page.getByText(SAVE_FAILED)).toHaveCount(0);
    await expect(photo).toHaveAttribute("loading", "lazy");
    await photo.scrollIntoViewIfNeeded();
    await expect.poll(() => photo.evaluate((img) => (img as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);

    // G-62: the export lists a photo without its bytes, so Your data links it
    // for download, served privately and never sniffed.
    await page.goto(GDM_ROUTES.data);
    const photoLink = page.getByRole("link", { name: PLAN.photoAlt });
    await expect(photoLink).toHaveCount(1);
    const served = await page.request.get((await photoLink.getAttribute("href"))!);
    expect(served.status()).toBe(200);
    expect(served.headers()["content-type"]).toBe("image/jpeg");
    expect(served.headers()["cache-control"]).toBe("private, no-store");
    expect(served.headers()["x-content-type-options"]).toBe("nosniff");

    // Removing her photo takes two presses (G-76): the first only asks, with focus on Cancel.
    await page.goto(GDM_ROUTES.plan);
    await expect(photo).toHaveCount(1);
    await page.getByRole("button", { name: PLAN.photoRemove }).click();
    await expect(page.getByRole("button", { name: DATA_CONTROLS.cancel })).toBeFocused();
    await expect(photo).toHaveCount(1);
    await page.getByRole("button", { name: PLAN.photoRemove }).click();
    await expect(photo).toHaveCount(0);
    await expect(status).toHaveText(STATUS.removed);
    await expect(page.getByRole("button", { name: PLAN.photoAdd })).toBeFocused();

    // Final review F2: two current plans go back to one. "This one no longer
    // stands" sits on each current card while there are two; it takes two
    // presses (G-76), dates that plan with her device's day and moves it to her
    // replaced plans, and These differ is worked out again from what stands.
    await expect(cards).toHaveCount(2);
    const nurse = cards.filter({ hasText: "the clinic nurse" });
    await nurse.getByRole("button", { name: PLAN.retire }).click();
    await expect(nurse.getByRole("button", { name: DATA_CONTROLS.cancel })).toBeFocused();
    await expect(cards).toHaveCount(2);
    await nurse.getByRole("button", { name: PLAN.retire }).click();
    await expect(cards).toHaveCount(1);
    await expect(status).toHaveText(STATUS.saved);
    await expect(cards.nth(0)).toContainText("the dietitian");
    await expect(page.locator(".gdm-differ-chip")).toHaveCount(0);
    await expect(page.getByRole("button", { name: PLAN.retire })).toHaveCount(0);
    await expect(cards.nth(0).getByRole("button", { name: PLAN.replace })).toBeFocused();
    const replacedPlans = page.locator("ul.gdm-plan-replaced > li");
    const retiredOn = replacedPlans.locator(".gdm-plan-date", { hasText: PLAN.replacedOn }).locator("time");
    await expect(replacedPlans).toHaveCount(1);
    await expect(replacedPlans).toContainText("the clinic nurse");
    await expect(replacedPlans).toContainText("30 g");
    await expect(retiredOn).toHaveAttribute("datetime", /^\d{4}-\d{2}-\d{2}$/);
    await expect(retiredOn).not.toBeEmpty();
    // What the server holds is what comes back.
    await page.reload();
    await expect(cards).toHaveCount(1);
    await expect(replacedPlans).toHaveCount(1);
    await expect(page.locator(".gdm-differ-chip")).toHaveCount(0);

    // Home reads the same current plans, so it follows with no change of its own.
    await page.goto(GDM_ROUTES.home);
    const homeCards = page.locator(".gdm-home-plan .gdm-plan-card");
    await expect(homeCards).toHaveCount(1);
    await expect(homeCards).toContainText("the dietitian");
    await expect(page.locator(".gdm-differ-chip")).toHaveCount(0);

    await erase(page);
  });

  // PR-4, Home (F-WAIT; Task 4.3 folded into 4.2 — R12, R35, G-03).
  test("Home leads with her appointment in words and her date, a checklist with nothing to tick; once a plan is entered it shows her plan and keeps the appointment", async ({
    page
  }) => {
    // Hydration: Home server-renders, and nothing on it may differ between the
    // server's HTML and the first client render (React's #418/#423/#425).
    const hydrationErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error" && /hydrat|#418|#423|#425/i.test(message.text())) hydrationErrors.push(message.text());
    });
    page.on("pageerror", (error) => {
      if (/hydrat|#418|#423|#425/i.test(error.message)) hydrationErrors.push(error.message);
    });

    await signUp(page);
    await page.getByRole("button", { name: TOLD.yes }).click();
    // Ten days ahead on her own device: Next week, and still Next week if the run crosses midnight.
    const first = await deviceDay(page, 10);
    await page.locator("#gdm-appointment").fill(first.iso);
    await page.getByRole("button", { name: DATE.next }).click();
    await page.getByRole("checkbox", { name: CONSENT.agree }).check();
    await page.getByRole("button", { name: CONSENT.go }).click();
    await expect(page).toHaveURL(new RegExp(`${GDM_ROUTES.home}$`));

    // G-69: the appointment block leads — a phrase, then her date in her device's words, never a count of days.
    const block = page.locator(".gdm-appointment");
    const when = block.locator(".gdm-appointment-when");
    await expect(block.getByRole("heading", { level: 2 })).toHaveText(WAIT.appointment);
    await expect(when).toHaveText(WAIT.nextWeek);
    await expect(block.locator(`time[datetime="${first.iso}"]`)).toHaveText(first.shown);
    await expect(block).not.toContainText(/\bdays?\b/i);
    const field = block.getByLabel(WAIT.changeDate);
    await expect(field).toHaveValue(first.iso);

    // Then the waiting content: four plain steps, nothing to tick anywhere on Home, and ACOG's line, attributed.
    await expect(page.getByRole("heading", { level: 2, name: WAIT.title })).toBeVisible();
    await expect(page.locator("ul.gdm-checklist > li")).toHaveText(Object.values(CHECKLIST));
    await expect(page.getByRole("checkbox")).toHaveCount(0);
    await expect(page.locator(".gdm-structure blockquote")).toHaveText(STRUCTURE.quote);
    await expect(page.locator(".gdm-structure cite")).toHaveText(STRUCTURE.source);
    expect(await leads(page, ".gdm-appointment", "ul.gdm-checklist")).toBe(true);
    expect(await leads(page, "ul.gdm-checklist", ".gdm-structure")).toBe(true);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

    // Her date changes here, the one place on the door that does it (G-32): saved, announced, and spoken again.
    const later = await deviceDay(page, 20);
    await field.fill(later.iso);
    await block.getByRole("button", { name: PLAN.save, exact: true }).click();
    await expect(block.locator(".gdm-status")).toHaveText(STATUS.saved);
    await expect(block.getByRole("button", { name: PLAN.save, exact: true })).toBeFocused();
    await expect(when).toHaveText(WAIT.later);
    await expect(block.locator(`time[datetime="${later.iso}"]`)).toHaveText(later.shown);

    // A plan entered on My plan ends the waiting content (G-37: her plan, not a link to it).
    await page.goto(GDM_ROUTES.plan);
    await page.getByLabel(PLAN.givenBy, { exact: true }).fill("the dietitian");
    await page.getByLabel(OCCASIONS.lunch, { exact: true }).fill("45 g");
    await page.getByRole("button", { name: PLAN.save, exact: true }).click();
    await expect(page.locator(".gdm-status")).toHaveText(STATUS.saved);

    await page.goto(GDM_ROUTES.home);
    const plan = page.locator(".gdm-home-plan");
    await expect(plan.getByRole("heading", { level: 2 })).toHaveText(WAIT.planTitle);
    const card = plan.locator(".gdm-plan-card");
    await expect(card).toHaveCount(1);
    await expect(card.locator(".gdm-plan-row", { hasText: OCCASIONS.lunch })).toContainText("45 g");
    await expect(card.locator(".gdm-plan-date time")).not.toBeEmpty();
    await expect(card.getByRole("button")).toHaveCount(0);
    await expect(page.locator("ul.gdm-checklist")).toHaveCount(0);
    await expect(page.locator(".gdm-structure")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: WAIT.title })).toHaveCount(0);

    // G-32: the appointment stays, and still leads.
    await expect(when).toHaveText(WAIT.later);
    await expect(block.locator(`time[datetime="${later.iso}"]`)).toHaveText(later.shown);
    await expect(field).toHaveValue(later.iso);
    expect(await leads(page, ".gdm-appointment", ".gdm-home-plan")).toBe(true);
    expect(hydrationErrors).toEqual([]);

    await erase(page);
  });

  // PR-5, My meals (F-MYMEALS; Task 5.2 folded into 5.1 — R12, R35, G-03).
  test("My meals: one add form with no readings field; a meal saved under its occasion brings only that heading; her summary tick is kept; Delete takes two presses", async ({
    page
  }) => {
    // Onboarding's quick path: told, no date, consent.
    await signUp(page);
    await page.getByRole("button", { name: TOLD.yes }).click();
    await page.getByRole("button", { name: DATE.skip }).click();
    await page.getByRole("checkbox", { name: CONSENT.agree }).check();
    await page.getByRole("button", { name: CONSENT.go }).click();
    await expect(page).toHaveURL(new RegExp(`${GDM_ROUTES.home}$`));

    // Row two of the nav reaches it.
    await page.locator(".gdm-nav-links").getByRole("link", { name: NAV.meals }).click();
    await expect(page).toHaveURL(new RegExp(`${GDM_ROUTES.meals}$`));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(MEALS.title);
    await expect(page.locator(".gdm-nav-links").getByRole("link", { name: NAV.meals })).toHaveAttribute("aria-current", "page");

    // G-25: with no meal at all, one page-level line and no occasion heading.
    const main = page.locator("main");
    const status = page.locator(".gdm-status");
    await expect(page.getByText(MEALS.empty)).toBeVisible();
    await expect(main.getByRole("heading", { level: 2 })).toHaveCount(0);

    // G-70: one add form — her words, which occasion (six, in the order of her
    // day), Save. No readings field anywhere near it (PRD §6.2 acceptance).
    const field = page.getByLabel(MEALS.field, { exact: true });
    const occasion = page.getByLabel(MEALS.occasion, { exact: true });
    const save = page.getByRole("button", { name: MEALS.save, exact: true });
    await expect(main.locator("form")).toHaveCount(1);
    await expect(occasion.locator("option")).toHaveText(Object.values(OCCASIONS));
    await expect(main.locator("input")).toHaveCount(0);
    await expect(main.locator('[inputmode="numeric"], [inputmode="decimal"]')).toHaveCount(0);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

    // A meal saved under the bedtime snack: announced, and that occasion's
    // heading appears with her words under it — no other heading, no empty line.
    const bedtime = "toast and peanut butter";
    await occasion.selectOption("snack_bedtime");
    await field.fill(bedtime);
    await save.click();
    await expect(status).toHaveText(STATUS.saved);
    await expect(field).toHaveValue("");
    await expect(field).toBeFocused();
    await expect(main.getByRole("heading", { level: 2 })).toHaveText([OCCASIONS.snack_bedtime]);
    await expect(page.locator(".gdm-meal-section", { hasText: OCCASIONS.snack_bedtime })).toContainText(bedtime);
    await expect(page.getByText(MEALS.empty)).toHaveCount(0);

    // A second, at lunch: its heading comes before the bedtime snack, in the order of her day.
    const lunch = "dal and rice";
    await occasion.selectOption("lunch");
    await field.fill(lunch);
    await save.click();
    await expect(main.getByRole("heading", { level: 2 })).toHaveText([OCCASIONS.lunch, OCCASIONS.snack_bedtime]);
    const lunchMeal = page.locator("li.gdm-meal", { hasText: lunch });
    const bedtimeMeal = page.locator("li.gdm-meal", { hasText: bedtime });
    expect(await leads(page, "#gdm-meals-lunch", "#gdm-meals-snack_bedtime")).toBe(true);

    // Include in my summary saves the moment it changes (G-36), and comes back as she left it.
    await bedtimeMeal.getByRole("checkbox", { name: MEALS.inSummary }).check();
    await expect(status).toHaveText(STATUS.saved);
    await expect(bedtimeMeal.getByRole("checkbox", { name: MEALS.inSummary })).toBeFocused();
    await page.reload();
    await expect(bedtimeMeal.getByRole("checkbox", { name: MEALS.inSummary })).toBeChecked();
    await expect(lunchMeal.getByRole("checkbox", { name: MEALS.inSummary })).not.toBeChecked();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

    // G-76: deleting her own words takes two presses. The first only asks,
    // with focus on Cancel; the second deletes, its heading goes with it, and
    // focus moves to the next meal's first control (G-39).
    await lunchMeal.getByRole("button", { name: MEALS.remove }).click();
    await expect(lunchMeal.getByRole("button", { name: DATA_CONTROLS.cancel })).toBeFocused();
    await expect(page.locator("li.gdm-meal")).toHaveCount(2);
    await lunchMeal.getByRole("button", { name: MEALS.remove }).click();
    await expect(page.locator("li.gdm-meal")).toHaveCount(1);
    await expect(status).toHaveText(STATUS.removed);
    await expect(main.getByRole("heading", { level: 2 })).toHaveText([OCCASIONS.snack_bedtime]);
    await expect(bedtimeMeal.getByRole("checkbox", { name: MEALS.inSummary })).toBeFocused();

    // The last one: gone, the empty line back, focus on the add field.
    await bedtimeMeal.getByRole("button", { name: MEALS.remove }).click();
    await bedtimeMeal.getByRole("button", { name: MEALS.remove }).click();
    await expect(page.locator("li.gdm-meal")).toHaveCount(0);
    await expect(page.getByText(MEALS.empty)).toBeVisible();
    await expect(field).toBeFocused();

    // What was deleted stays deleted.
    await page.reload();
    await expect(page.getByText(MEALS.empty)).toBeVisible();
    await expect(page.locator("li.gdm-meal")).toHaveCount(0);

    await erase(page);
  });

  // PR-6, the printable page (F-SUMMARY; Task 6.2). Nothing entered shows the
  // empty line and the three links, and no Print button; once a plan, a
  // marked meal and an open question exist, they carry into the three
  // headings verbatim, the disclaimer prints with the page, and Print is
  // there and calls window.print() (browser print, no PDF library — G-18).
  test("Summary: nothing entered shows the empty line and three links with no Print button; entered items carry into the three headings, the disclaimer is in the body, and Print calls window.print()", async ({
    page
  }) => {
    // Onboarding's quick path: told, no date, consent.
    await signUp(page);
    await page.getByRole("button", { name: TOLD.yes }).click();
    await page.getByRole("button", { name: DATE.skip }).click();
    await page.getByRole("checkbox", { name: CONSENT.agree }).check();
    await page.getByRole("button", { name: CONSENT.go }).click();
    await expect(page).toHaveURL(new RegExp(`${GDM_ROUTES.home}$`));

    // Row two of the nav reaches it.
    await page.locator(".gdm-nav-links").getByRole("link", { name: NAV.summary }).click();
    await expect(page).toHaveURL(new RegExp(`${GDM_ROUTES.summary}$`));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(SUMMARY.title);
    await expect(page.locator(".gdm-nav-links").getByRole("link", { name: NAV.summary })).toHaveAttribute(
      "aria-current",
      "page"
    );

    // G-41: with nothing entered at all, one empty line, links to the three
    // lists, and no Print button — printing a blank page is a dead end.
    await expect(page.getByText(SUMMARY.empty)).toBeVisible();
    const links = page.locator(".gdm-summary-links");
    await expect(links.getByRole("link", { name: NAV.plan })).toHaveAttribute("href", GDM_ROUTES.plan);
    await expect(links.getByRole("link", { name: NAV.meals })).toHaveAttribute("href", GDM_ROUTES.meals);
    await expect(links.getByRole("link", { name: NAV.asks })).toHaveAttribute("href", GDM_ROUTES.questions);
    await expect(page.getByRole("button", { name: SUMMARY.print })).toHaveCount(0);
    await expect(page.locator("body")).toContainText(GDM_COPY["gdm-disclaimer"].line);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

    // Enter a plan, a meal marked for the summary, and an open question.
    const dietitian = "the dietitian";
    const lunchFigure = "45 g";
    await page.goto(GDM_ROUTES.plan);
    await page.getByLabel(PLAN.givenBy, { exact: true }).fill(dietitian);
    await page.getByLabel(PLAN.counts, { exact: true }).selectOption("grams");
    await page.getByLabel(OCCASIONS.lunch, { exact: true }).fill(lunchFigure);
    await page.getByRole("button", { name: PLAN.save, exact: true }).click();
    await expect(page.locator(".gdm-status")).toHaveText(STATUS.saved);

    // G-41's other branch: a plan entered but meals and asks still empty
    // shows each empty section's OWN heading and the empty line — not the
    // all-empty screen's single line and three links — and Print IS present.
    await page.goto(GDM_ROUTES.summary);
    await expect(page.getByRole("heading", { level: 2 })).toHaveText([SUMMARY.plan, SUMMARY.meals, SUMMARY.asks]);
    await expect(page.locator('[data-gdm-summary="plan"]')).toContainText(dietitian);
    await expect(page.locator('[data-gdm-summary="meals"]')).toContainText(SUMMARY.empty);
    await expect(page.locator('[data-gdm-summary="asks"]')).toContainText(SUMMARY.empty);
    await expect(page.getByRole("button", { name: SUMMARY.print })).toBeVisible();

    const mealText = "dal and rice";
    await page.goto(GDM_ROUTES.meals);
    await page.getByLabel(MEALS.occasion, { exact: true }).selectOption("lunch");
    await page.getByLabel(MEALS.field, { exact: true }).fill(mealText);
    await page.getByRole("button", { name: MEALS.save, exact: true }).click();
    await expect(page.locator(".gdm-status")).toHaveText(STATUS.saved);
    const mealRow = page.locator("li.gdm-meal", { hasText: mealText });
    const inSummaryBox = mealRow.getByRole("checkbox", { name: MEALS.inSummary });
    await inSummaryBox.check();
    // The status line already read "saved" from the meal save above, so it is
    // not proof this second save resolved — focus landing back on the
    // checkbox is (cc88e48's pattern), and it guards the next navigation
    // against a race with the still-in-flight PATCH.
    await expect(inSummaryBox).toBeFocused();

    const askText = "why was it higher";
    await page.goto(GDM_ROUTES.quickAdd);
    await page.getByLabel(ASKS.field, { exact: true }).fill(askText);
    await page.getByRole("button", { name: ASKS.add, exact: true }).click();
    await expect(page.locator(".gdm-status")).toHaveText(STATUS.saved);

    // Stub window.print BEFORE navigating to the summary, so the click below
    // never opens a real print sheet. addInitScript is page-scoped and runs
    // on every subsequent navigation of this page.
    await page.addInitScript(() => {
      (window as unknown as { __printed: number }).__printed = 0;
      window.print = () => {
        (window as unknown as { __printed: number }).__printed += 1;
      };
    });

    await page.goto(GDM_ROUTES.summary);
    await expect(page.getByText(SUMMARY.empty)).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 2 })).toHaveText([SUMMARY.plan, SUMMARY.meals, SUMMARY.asks]);
    const planSection = page.locator('[data-gdm-summary="plan"]');
    const mealsSection = page.locator('[data-gdm-summary="meals"]');
    const asksSection = page.locator('[data-gdm-summary="asks"]');
    await expect(planSection).toContainText(dietitian);
    await expect(planSection).toContainText(lunchFigure);
    await expect(mealsSection).toContainText(mealText);
    await expect(asksSection).toContainText(askText);
    await expect(page.locator("body")).toContainText(GDM_COPY["gdm-disclaimer"].line);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

    // Print is present now that something is entered, and it really calls
    // window.print() — never a PDF library.
    const printButton = page.getByRole("button", { name: SUMMARY.print, exact: true });
    await expect(printButton).toBeVisible();
    await printButton.click();
    expect(await page.evaluate(() => (window as unknown as { __printed: number }).__printed)).toBe(1);

    await erase(page);
  });
});
