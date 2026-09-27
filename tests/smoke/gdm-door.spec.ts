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
import { expect, test } from "@playwright/test";

import { GDM_COPY } from "../../lib/pal/gdm/copy";
import { GDM_ROUTES } from "../../lib/pal/gdm/routes";
import { loadSafetyContract } from "../../lib/pal/safety-contract";
import { doorSurfaceOn } from "./gdm-door";

const DARK_PATHS = ["/gdm", "/gdm/start", "/gdm/home", "/gdm/questions", "/gdm/plan", "/gdm/data", "/gdm/privacy"] as const;

const TOLD = GDM_COPY["gdm-onboarding-told"];
const DATE = GDM_COPY["gdm-onboarding-date"];
const CONSENT = GDM_COPY["gdm-onboarding-consent"];
const DATA_CONTROLS = GDM_COPY["gdm-data-controls"];
const NAV = GDM_COPY["gdm-nav"];
const ASKS = GDM_COPY["gdm-asklist-controls"];
const STATUS = GDM_COPY["gdm-status"];

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
// the list, a number-shaped worry raises nothing. Gated on the organiser
// surface via /api/health (this file's rule throughout) — never the
// Playwright env.
test.describe("GDM door — organiser, signed in", () => {
  test.beforeEach(async () => {
    test.skip(!(await doorSurfaceOn("organiser")), "organiser surface off in this build");
  });

  test("no A1C onboarding, an unticked consent explains itself, questions park and only a clinical one raises the card, erase returns her to onboarding", async ({
    page
  }) => {
    const stubDir = process.env.AUTH_EMAIL_STUB_DIR;
    // A fresh, unique email per run: reruns of this spec share the disposable
    // e2e database, and a repeated address would collide with the earlier
    // run's (erased, but possibly still in-flight) profile.
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
    // confirmed by the rest of this test succeeding. tests/smoke/auth.spec.ts
    // sidesteps the same thing by never asserting where the link itself
    // lands and re-navigating to a known path next.
    await page.goto(url);
    await page.goto(GDM_ROUTES.start);

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
    await page.goto(GDM_ROUTES.data);
    await page.getByRole("button", { name: DATA_CONTROLS.erase }).click();
    await page.getByRole("button", { name: DATA_CONTROLS.eraseGo }).click();
    await expect(page).toHaveURL(new RegExp(`${GDM_ROUTES.landing}$`));

    // The erased profile means onboarding again, never Home.
    await page.goto(GDM_ROUTES.start);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(TOLD.ask);
  });
});
