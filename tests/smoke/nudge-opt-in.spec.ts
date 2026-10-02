import { expect, test, type Page } from "@playwright/test";

/**
 * Nudge opt-in smoke (plan P5): permission + SW mocked; asserts the two-step
 * pattern — our calm ask first, subscription POSTed only after an explicit
 * yes — and that fresh users never see the prompt.
 */

async function mockPushEnvironment(page: Page, subscribed = false) {
  await page.addInitScript((alreadySubscribed) => {
    const fakeSubscription = {
      toJSON: () => ({
        endpoint: "https://push.example/e2e",
        keys: { p256dh: "k", auth: "a" }
      }),
      unsubscribe: async () => true
    };
    const pushManager = {
      getSubscription: async () => (alreadySubscribed ? fakeSubscription : null),
      subscribe: async () => fakeSubscription
    };
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: {
        register: async () => ({}),
        ready: Promise.resolve({ pushManager })
      }
    });
    (window as unknown as Record<string, unknown>).PushManager = function () {
      /* feature-detect only */
    };
    (window as unknown as Record<string, unknown>).Notification = {
      permission: "default",
      requestPermission: async () => "granted"
    };
  }, subscribed);
}

async function mockPremiumOptedOut(page: Page) {
  await page.route("**/api/entitlement", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ tier: "premium", source: "stripe", checksToday: 0, freeDailyLimit: 5 })
    })
  );
  // "Turn off" on /account PATCHes nudgeOptIn:false and leaves the browser's
  // push subscription in place.
  await page.route("**/api/profile", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ hasProfile: true, nudgeOptIn: false, nudgeHour: 11, nudgeCadence: "daily" })
    })
  );
  await page.route("**/api/history**", (route) =>
    route.fulfill({ status: 401, contentType: "application/json", body: "{}" })
  );
}

async function seedPriorDayHistory(page: Page) {
  await page.addInitScript(() => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    window.localStorage.setItem(
      "pal.history.v1",
      JSON.stringify([
        {
          clientId: "prior-1",
          food: "lentil soup",
          risk: "SAFE",
          a1cBand: "prediabetes_60_62",
          inputMethod: "text",
          createdAt: yesterday.toISOString()
        }
      ])
    );
  });
}

test("premium user with a prior-day check gets the two-step opt-in", async ({
  page
}) => {
  await mockPushEnvironment(page);
  await seedPriorDayHistory(page);

  await page.route("**/api/entitlement", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        tier: "premium",
        source: "stripe",
        checksToday: 0,
        freeDailyLimit: 5
      })
    });
  });
  await page.route("**/api/history**", async (route) => {
    await route.fulfill({ status: 401, contentType: "application/json", body: "{}" });
  });

  let subscribeCalls = 0;
  await page.route("**/api/push/subscribe", async (route) => {
    subscribeCalls += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true })
    });
  });

  await page.goto("/check");
  await expect(page.getByTestId("nudge-opt-in")).toBeVisible();
  // step 1 shown; nothing subscribed yet
  expect(subscribeCalls).toBe(0);

  await page.getByTestId("nudge-enable").click();
  await expect(page.getByTestId("nudge-enabled")).toBeVisible();
  expect(subscribeCalls).toBe(1);
});

test("fresh users and guests never see the nudge ask", async ({ page }) => {
  await mockPushEnvironment(page);
  await page.route("**/api/entitlement", async (route) => {
    await route.fulfill({ status: 401, contentType: "application/json", body: "{}" });
  });

  // This test owns the empty-check surface, not FirstRunGate. A truly fresh
  // visitor at `/check` is intentionally redirected to onboarding; asserting
  // DailyLoop during that redirect made the test pass or fail based on which
  // client effect won the race. `stay=1` is the product's explicit bypass for
  // tests and direct check flows that need to remain on this surface.
  // DailyLoop renders null until loadHistory() resolves, and that awaits
  // fetch("/api/history"). Under `next dev` the route is compiled on first
  // request, so asserting straight after goto() races a cold compile — this
  // test failed, passed, then failed again across three CI runs. Wait for the
  // response the component is actually blocked on instead of widening a timeout
  // and hoping.
  const history = page.waitForResponse((r) => r.url().includes("/api/history"));
  await page.goto("/check?stay=1");
  await history;

  await expect(page.getByTestId("daily-loop-empty")).toBeVisible();
  await expect(page.getByTestId("nudge-opt-in")).toHaveCount(0);
});

test("FIX2a: after Turn off, the ask comes back on /check even with a browser subscription", async ({
  page
}) => {
  await mockPushEnvironment(page, true);
  await seedPriorDayHistory(page);
  await mockPremiumOptedOut(page);

  await page.goto("/check");
  await expect(page.getByTestId("nudge-opt-in")).toBeVisible();
});

test("FIX2a: /account turns a reminder back on in-app, and never points at the home page", async ({
  page
}) => {
  await mockPushEnvironment(page, true);
  await mockPremiumOptedOut(page);
  let subscribeCalls = 0;
  await page.route("**/api/push/subscribe", (route) => {
    subscribeCalls += 1;
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });

  await page.goto("/account");
  const section = page.getByTestId("nudge-settings");
  await expect(section).toContainText("The reminder is off.");
  await expect(section).not.toContainText("home page");

  await page.getByTestId("nudge-turn-on").click();
  await expect(section).toContainText("One gentle reminder a day, at the hour you pick.");
  expect(subscribeCalls).toBe(1);
});
