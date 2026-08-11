import { expect, test, type Page } from "@playwright/test";

/**
 * Definition-of-Ready walkthrough for the taster → trial-wall → trial paywall
 * machine plus the one-time Pantry Review.
 *
 * ENV MECHANISM (documented per Task 8.1 brief):
 *   Paywall mode is resolved SERVER-SIDE — app/subscribe/page.tsx calls
 *   lib/server/pricing.paywallMode(), so which component renders on /subscribe
 *   (TrialWall vs PaywallCard) is fixed at request time by the server's
 *   PAYWALL_MODE env. A single webServer cannot serve both `trial` and `legacy`
 *   at once, and the shared :3100 server must stay on the `legacy` default
 *   (tests/smoke/billing-pages.spec.ts asserts the legacy paywall-card there).
 *   Resolution (a) from the brief: playwright.config.ts runs a SECOND webServer
 *   on :3101 with PAYWALL_MODE=trial (+ AUTH_EMAIL_STUB_DIR). The trial
 *   scenarios below drive that server via absolute TRIAL urls; the legacy-guard
 *   scenario uses the default baseURL (:3100, legacy). Stripe is never hit —
 *   the checkout POST is stubbed at the fetch boundary with page.route.
 *
 * SELF-CONTAINED RUN:
 *   `npm run e2e` builds the exact source twice into ignored sibling
 *   directories: `.next-e2e-legacy` and `.next-e2e-trial`. Both servers use
 *   `next start`, so static landing copy and server behavior agree with each
 *   deployment's PAYWALL_MODE and no browser races a compiler/Fast Refresh.
 *   The build runner removes only Next's generated E2E type globs from tracked
 *   tsconfig.json before Playwright starts.
 */

const TRIAL = "http://127.0.0.1:3101";

// Mirrors lib/client/taster-store.ts dayLocal(): the user's LOCAL calendar day.
function todayLocal(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

// The paywall mode reaches the client via GET /api/paywall (food-check-form and
// trial-wall both fetch it on mount). Wait for that response and flush a React
// commit so `mode` is `trial` in state before we act — otherwise the fail-open
// `legacy` default would race the gate/record decision.
async function gotoWithPaywallMode(page: Page, url: string): Promise<void> {
  // Register before navigation: an optimized production server can complete
  // this fetch before page.goto() returns.
  const paywall = page.waitForResponse(
    (response) => new URL(response.url()).pathname === "/api/paywall"
  );
  await page.goto(url);
  await paywall;
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      )
  );
}

const RESULT_STUB = {
  kind: "result",
  risk: "SAFE",
  reason: "Oatmeal is a steady pick — it leans on slow carbs and fibre.",
  adjustment: null,
  swap: null,
  sequencingTip: null,
  postMealAction: null,
  keepMost: null,
  disclaimer: "Not medical advice."
};

test("taster: first-run walk lands a guided oatmeal check and meters used===1", async ({
  page
}) => {
  // Stub the engine so the check never touches the live model.
  await page.route("**/api/check", (route) => route.fulfill({ json: RESULT_STUB }));

  // Fresh context → home bounces a brand-new visitor into the tour. The
  // redirect is a client effect gated on the home bundle hydrating, AND the
  // URL only commits after /onboarding's RSC payload arrives — so this window
  // covers TWO cold Turbopack compiles on a loaded 2-core CI runner (all 7
  // spec files compile :3100 routes in parallel). 30s failed twice on CI
  // (2026-07-19, both mobile projects, retries included) while identical code
  // passed locally in 2s; 60s keeps 30s of headroom inside the 90s budget for
  // the warm remainder of the walk.
  await page.goto(`${TRIAL}/check`);
  await expect(page).toHaveURL(/\/onboarding$/, { timeout: 60_000 });

  // Walk welcome → segment → attribution → a1c → expectations → first_check
  // (mirrors onboarding.spec).
  await page.getByRole("button", { name: "Get started" }).click();
  await page.getByRole("button", { name: "New A1C result" }).click();
  await page.getByRole("button", { name: "Reddit", exact: true }).click();
  await page.getByLabel("Latest A1C").fill("6.1");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Continue" }).click();

  const paywall = page.waitForResponse((r) => r.url().includes("/api/paywall"));
  await page.getByRole("button", { name: "oatmeal", exact: true }).click();

  // Home, with the guided food + remembered A1C prefilled.
  await expect(page).toHaveURL(/\/check$/);
  await expect(page.getByLabel(/eating/i)).toHaveValue("oatmeal");
  await expect(page.getByLabel(/latest a1c/i)).toHaveValue("6.1");

  await paywall;
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      )
  );

  await page.getByRole("button", { name: "Check this meal" }).click();

  const card = page.getByTestId("result-card");
  await expect(card).toHaveAttribute("data-kind", "result");

  const used = await page.evaluate(() => {
    const raw = window.localStorage.getItem("pal.taster.v1");
    return raw ? (JSON.parse(raw) as { used: number }).used : null;
  });
  expect(used).toBe(1);
});

test("exhaustion: a spent taster is walled on the next submit", async ({ page }) => {
  await page.addInitScript(
    (firstDay) => {
      window.localStorage.setItem(
        "pal.taster.v1",
        JSON.stringify({ firstDay, used: 10 })
      );
    },
    todayLocal()
  );

  await gotoWithPaywallMode(page, `${TRIAL}/check`);
  // Seeded taster → not a first-run visitor, so no bounce to the tour.
  await expect(page).toHaveURL(/\/check$/);

  await page.getByRole("button", { name: "Check this meal" }).click();
  await expect(page).toHaveURL(/\/subscribe$/);
  await expect(page.getByTestId("trial-wall")).toBeVisible();
});

// AUD-009: the device meter stands down for an entitled session. Same spent
// store as the exhaustion test above, but /api/paywall reports entitled:true —
// the submit must reach /api/check (server-authoritative) instead of bouncing
// to /subscribe, nothing is metered, and no free-checks counter renders.
test("entitled: a Premium session with a spent device store is never walled", async ({
  page
}) => {
  await page.addInitScript(
    (firstDay) => {
      window.localStorage.setItem(
        "pal.taster.v1",
        JSON.stringify({ firstDay, used: 10 })
      );
    },
    todayLocal()
  );

  await page.route("**/api/paywall", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        mode: "trial",
        variant: "1299",
        priceDisplay: "$12.99",
        annualDisplay: null,
        annualMonthlyEquivalent: null,
        entitled: true
      })
    })
  );
  let checkCalls = 0;
  await page.route("**/api/check", (route) => {
    checkCalls += 1;
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        kind: "result",
        risk: "MODERATE",
        reason: "Plain oatmeal leans carb-heavy on its own.",
        adjustment: null,
        swap: null,
        disclaimer: "Not medical advice."
      })
    });
  });

  await gotoWithPaywallMode(page, `${TRIAL}/check`);
  await expect(page).toHaveURL(/\/check$/);
  // Unlimited Premium shows no "free checks left" meter.
  await expect(page.getByTestId("taster-counter")).not.toBeVisible();

  await page.getByLabel("What are you thinking about eating?").fill("plain oatmeal");
  await page.getByLabel("Latest A1C").fill("6.1");
  await page.getByRole("button", { name: "Check this meal" }).click();

  // The server was consulted; the wall was not.
  await expect(page).toHaveURL(/\/check$/);
  await expect(page.getByText("Plain oatmeal leans carb-heavy on its own.")).toBeVisible();
  expect(checkCalls).toBe(1);

  // And the entitled result was not metered against the device store.
  const used = await page.evaluate(
    () =>
      JSON.parse(window.localStorage.getItem("pal.taster.v1") ?? "{}").used
  );
  expect(used).toBe(10);
});

test("day 2: an aged-out taster is walled on the next submit", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "pal.taster.v1",
      JSON.stringify({ firstDay: "2020-01-01", used: 2 })
    );
  });

  await gotoWithPaywallMode(page, `${TRIAL}/check`);
  await expect(page).toHaveURL(/\/check$/);

  await page.getByRole("button", { name: "Check this meal" }).click();
  await expect(page).toHaveURL(/\/subscribe$/);
  await expect(page.getByTestId("trial-wall")).toBeVisible();
});

test("wall → checkout: value → start POSTs the trial and navigates", async ({
  page
}) => {
  let trialStartEmail: string | null = null;
  await page.route("**/api/trial/start", async (route) => {
    trialStartEmail =
      (route.request().postDataJSON() as { email?: string })?.email ?? null;
    await route.fulfill({ json: { url: `${TRIAL}/__checkout_stub` } });
  });
  await page.route("**/__checkout_stub", (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<!doctype html><title>Checkout</title>ok"
    })
  );

  await gotoWithPaywallMode(page, `${TRIAL}/subscribe`);
  await expect(page.getByTestId("trial-wall")).toBeVisible();

  // The value screen tells the week as a Today → Day 5 → Day 7 timeline.
  const timeline = page.getByTestId("trial-timeline");
  await expect(timeline).toBeVisible();
  await expect(timeline).toContainText("Today");
  await expect(timeline).toContainText("Day 5");
  await expect(timeline).toContainText("Day 7");

  // Two-step wall: the first screen leads with "7 days free" + the price, so
  // one click reaches the email step.
  await page.getByRole("button", { name: "Start my free week" }).click();
  await page.getByLabel("Your email").fill("wall@pal.test");
  await page.getByTestId("trial-terms-consent").check();
  await page
    .getByRole("button", { name: "Continue to checkout — $0 due today" })
    .click();

  await expect(page).toHaveURL(/\/__checkout_stub$/);
  expect(trialStartEmail).toBe("wall@pal.test");
});

test("decline catch: /subscribe?declined=1 offers the one-time Pantry Review", async ({
  page
}) => {
  // Seed two local checks so the endowment note has something to name.
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "pal.history.v1",
      JSON.stringify([
        { clientId: "a", food: "oatmeal", createdAt: "2026-07-06T10:00:00.000Z" },
        { clientId: "b", food: "banana", createdAt: "2026-07-06T11:00:00.000Z" }
      ])
    );
  });
  await page.goto(`${TRIAL}/subscribe?declined=1`);

  const catchLine = page.getByTestId("pantry-catch");
  await expect(catchLine).toBeVisible();
  await expect(
    catchLine.getByRole("link", { name: /pantry review/i })
  ).toHaveAttribute("href", "/pantry");

  // Gentle loss-aversion: the declined state names the checks already saved.
  const savedNote = page.getByTestId("saved-checks-note");
  await expect(savedNote).toBeVisible();
  await expect(savedNote).toContainText("2 checks");
});

test("pantry: the landing page shows the sample report + buy button", async ({
  page
}) => {
  await page.goto(`${TRIAL}/pantry`);

  await expect(
    page.getByRole("heading", { name: "Enjoy freely" })
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Worth a tweak" })
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Handle with care" })
  ).toBeVisible();
  // Two buy CTAs since the 2026-07-10 design pass: one in the hero, one after
  // the sample report.
  await expect(page.getByTestId("pantry-buy")).toHaveCount(2);
  await expect(page.getByTestId("pantry-buy").first()).toBeVisible();
});

test("legacy guard: PAYWALL_MODE=legacy shows the paywall card, never the wall", async ({
  page
}) => {
  // Default baseURL (:3100) runs on the `legacy` default.
  await page.goto("/subscribe");
  await expect(page.getByTestId("paywall-card")).toBeVisible();
  // The regression this catches: legacy must NEVER render the trial wall.
  await expect(page.getByTestId("trial-wall")).toHaveCount(0);

  // A seeded returning user is not a first-run visitor and must stay home.
  await page.addInitScript(
    (firstDay) => {
      window.localStorage.setItem(
        "pal.taster.v1",
        JSON.stringify({ firstDay, used: 3 })
      );
    },
    todayLocal()
  );
  await page.goto("/check");
  // Waiting on the hydrated check form proves FirstRunGate's effect ran: had it
  // redirected, we'd be on /onboarding (no such button there).
  await expect(
    page.getByRole("button", { name: "Check this meal" })
  ).toBeVisible();
  await expect(page).toHaveURL(/\/check$/);
  await expect(page.getByTestId("onboarding-step")).toHaveCount(0);
});

// §0.2 #4 mirror of billing-pages.spec.ts's legacy landing check.
//
// This used to assert the landing's price tiles matched the mode this server
// runs. The pricing section was deleted on 2026-08-05 ("the price should not
// be mentioned, only focus on free check"), so the assertion inverts: under
// the trial mode too, the landing must show NO section and NO amount. Proving
// the absence on a live server is the point — a build-time pin cannot see
// what a server-flag branch actually rendered.
test("the trial-mode landing renders no pricing section and no amount", async ({
  page
}) => {
  await page.goto(`${TRIAL}/`);
  await expect(page.locator("#pricing")).toHaveCount(0);
  await expect(page.locator(".landing-price-what")).toHaveCount(0);
  // The nav link went with the section: a live anchor to a deleted target is
  // the exact defect W9 shipped with #how-it-works and nothing caught.
  await expect(page.locator('a[href="#pricing"]')).toHaveCount(0);
  // No amount anywhere in the rendered page, in any currency shape.
  await expect(page.locator("main.landing")).not.toContainText(/\$\d/);
});

// The one §0.2 #4 mechanism that survived the deletion: "do I need a card?"
// has a different true answer per mode, so the FAQ still branches on the live
// flag. This server runs trial, so the trial answer must be the one rendered.
test("the trial-mode landing FAQ describes the card the trial needs", async ({
  page
}) => {
  await page.goto(`${TRIAL}/`);
  const faq = page.locator("#faq");
  await expect(faq).toContainText("The 7-day free trial needs a card");
  await expect(faq).toContainText("we email you before any charge");
  // ...and never the legacy answer, which would promise a free daily
  // allowance this server does not grant.
  await expect(faq).not.toContainText("a free account includes");
});
