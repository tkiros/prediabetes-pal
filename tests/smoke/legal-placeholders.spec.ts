import { expect, test } from "@playwright/test";

/**
 * F-26 / W-04 — draft Terms and an open till may not coexist.
 *
 * `/terms` renders literal counsel placeholders today ("[Prediabetes Pal's operating
 * entity — counsel to confirm]"), and that is fine while the checkout gate is
 * closed: the app cannot take money under a contract that names no entity and
 * no governing law. What is NOT fine is the two states drifting apart, in
 * either direction:
 *
 *   - placeholders live + checkout open  → money taken under a draft contract
 *   - counsel copy landed + a bracket left behind → a placeholder shipped as law
 *
 * So this test does not assert "there are no brackets" (there are, deliberately).
 * It asserts the INVARIANT that binds the two, reading the gate's real answer
 * rather than an env var: if the deploy has opened checkout, then the legal
 * pages must carry no placeholder. It therefore arms itself automatically the
 * day someone sets LEGAL_TERMS_FINAL=1 — which is the exact moment the plan
 * asked for a test and the branch shipped without one.
 */

// WS-7: retries:2 removed — `npm run e2e` serves optimized `next start`
// builds, so the dev cold-compile race is gone and silent retries would only
// hide real flakes. The generous timeout stays for loaded CI runners.
test.setTimeout(90_000);

const LEGAL_PAGES = ["/terms", "/privacy"];

test.beforeAll(async ({ playwright }) => {
  const request = await playwright.request.newContext({
    baseURL: "http://127.0.0.1:3100"
  });
  try {
    for (const route of [...LEGAL_PAGES, "/api/billing/stripe/checkout"]) {
      await request
        .fetch(route, { method: "GET", timeout: 90_000, failOnStatusCode: false })
        .catch(() => undefined);
    }
  } finally {
    await request.dispose();
  }
});

// A bracketed span of prose. Deliberately narrow: it must not fire on code
// samples or on "[1]"-style footnote markers, only on the drafting convention
// this codebase actually uses for counsel gaps.
const PLACEHOLDER = /\[[^\]\n]{8,}\]/g;

async function placeholdersOn(
  request: import("@playwright/test").APIRequestContext,
  path: string
): Promise<string[]> {
  const response = await request.get(path);
  expect(response.status(), `${path} must render`).toBe(200);

  // Strip tags so an href or a data attribute can never look like prose.
  const text = (await response.text())
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ");

  return text.match(PLACEHOLDER) ?? [];
}

test("checkout is closed while the legal pages still carry placeholders", async ({
  request
}) => {
  const checkout = await request.post("/api/billing/stripe/checkout", {
    data: { plan: "monthly" },
    failOnStatusCode: false
  });

  const found = (
    await Promise.all(LEGAL_PAGES.map((page) => placeholdersOn(request, page)))
  ).flat();

  if (checkout.status() === 503) {
    // The gate is closed. Placeholders are expected; nothing to enforce beyond
    // the gate itself, which is what we just observed.
    expect(found.length).toBeGreaterThanOrEqual(0);
    return;
  }

  // The deploy has declared the Terms final (LEGAL_TERMS_FINAL=1) and the till
  // is open. Every counsel placeholder must be gone.
  expect(
    found,
    `Checkout is OPEN but these placeholders still render: ${found.join(" · ")}`
  ).toEqual([]);
});

test("the privacy page carries no counsel placeholders", async ({ request }) => {
  // Privacy has no outstanding counsel gaps — it was rewritten under W-33 to
  // describe the blob lifecycle the code actually implements. Pin that, so a
  // future edit cannot quietly reintroduce a draft bracket on the page that
  // makes the retention promises.
  expect(await placeholdersOn(request, "/privacy")).toEqual([]);
});
