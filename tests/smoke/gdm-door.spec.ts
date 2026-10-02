// tests/smoke/gdm-door.spec.ts
//
// Two describes, gated on the running app's OWN reported state (never the
// Playwright process's env — tests/smoke/guide-door.ts's rule, Task 0.3's
// createDoorProbe()). Dark proves the second front door leaks nothing before
// `gdm-organiser` clears its line; landing proves the door PR-L actually
// built: the working name leads, sign-up goes through the existing sign-in,
// and the door's own metadata/manifest/link-preview speak for it (G-30, R36).
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { GDM_COPY } from "../../lib/pal/gdm/copy";
import { GDM_ROUTES } from "../../lib/pal/gdm/routes";
import { doorSurfaceOn } from "./gdm-door";

const DARK_PATHS = ["/gdm", "/gdm/start", "/gdm/home", "/gdm/privacy"] as const;

test.describe("GDM door — dark", () => {
  test.beforeEach(async () => {
    test.skip(await doorSurfaceOn("landing"), "landing surface on in this build");
  });

  for (const path of DARK_PATHS) {
    test(`${path} is a 404 with the flag off — and the 404 carries no GDM string`, async ({ page }) => {
      const response = await page.goto(path);
      expect(response?.status()).toBe(404);
      // No user-visible GDM string before `gdm-organiser` exists: not even the
      // working name, not even on an error page rendered inside app/gdm/layout.tsx.
      const body = await page.locator("body").innerText();
      expect(body).not.toContain(GDM_COPY["gdm-door-name"].name);
      expect(body).not.toMatch(/gestational/i);
      // L.1's G-30 dark leg: the door's own <title> never leaks either, even
      // where the body-text assertions above cannot see it (a <head> value).
      expect(await page.title()).not.toMatch(/gestational/i);
      // Task 1.5: once the nav row (`gdm-nav`) is filed, also assert its
      // "My questions" string is absent from `body` here. The two assertions
      // above name only the working name and "gestational" — a leaked nav
      // names neither, so it would otherwise pass this test undetected.
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
