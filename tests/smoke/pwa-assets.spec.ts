import { expect, test } from "@playwright/test";

// Phase 8.1 integration bridge: the unit test (tests/unit/revora/pwa-assets.test.ts) only
// checks the files on disk. These hit the running app to confirm the PWA assets are
// actually *served* at their public paths with sane content. Raw HTTP via the `request`
// fixture — not page navigation — so it's unaffected by serviceWorkers:"block".

test("manifest is served and installable", async ({ request }) => {
  const res = await request.get("/manifest.webmanifest");
  expect(res.status()).toBe(200);
  const manifest = JSON.parse(await res.text());
  expect(manifest.name).toBe("Prediabetes Pal");
  // Identity stays pinned to the pre-dashboard start_url so existing
  // installs are not orphaned (eng amendment #6); start_url moves to /home.
  expect(manifest.id).toBe("/check");
  expect(manifest.start_url).toBe("/home");
  expect(manifest.display).toBe("standalone");
  expect(manifest.icons.length).toBeGreaterThanOrEqual(3);
});

test("service worker is served and short-circuits non-GET", async ({ request }) => {
  const res = await request.get("/sw.js");
  expect(res.status()).toBe(200);
  expect(await res.text()).toContain('request.method !== "GET"');
});

test("offline page is served with the disclaimer", async ({ request }) => {
  const res = await request.get("/offline.html");
  expect(res.status()).toBe(200);
  expect(await res.text()).toContain("is not medical advice");
});

test("icons are served", async ({ request }) => {
  for (const path of ["/icon-192.png", "/icon-512.png", "/icon-maskable-512.png"]) {
    const res = await request.get(path);
    expect(res.status(), path).toBe(200);
    expect(Number(res.headers()["content-length"] ?? "0")).toBeGreaterThan(0);
  }
});
