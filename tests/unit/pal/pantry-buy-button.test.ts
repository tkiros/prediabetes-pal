import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

// The buy button is a brief-verbatim client component with hooks, so — per the
// repo's no-jsdom pattern — we assert its fetch/redirect/event/error contract
// by scanning the source. This locks the analytics event names, the checkout
// endpoint, the redirect call, and the two exact error strings against drift.
const SOURCE = fs.readFileSync(
  path.join(process.cwd(), "components/pantry-buy-button.tsx"),
  "utf8"
);

describe("PantryBuyButton contract", () => {
  it("emits pantry_viewed on mount with the source prop", () => {
    expect(SOURCE).toContain('track({ name: "pantry_viewed", props: { source } })');
  });

  it("emits pantry_checkout_started when the buy handler runs", () => {
    expect(SOURCE).toContain('track({ name: "pantry_checkout_started" })');
  });

  it("POSTs to the pantry checkout endpoint and redirects to the returned url", () => {
    expect(SOURCE).toContain('fetch("/api/billing/stripe/pantry-checkout", {');
    expect(SOURCE).toContain('method: "POST"');
    expect(SOURCE).toContain("termsAccepted");
    expect(SOURCE).toContain("termsVersion: TERMS_VERSION");
    expect(SOURCE).toContain("window.location.assign(body.url)");
  });

  it("shows the exact fallback + network error copy", () => {
    expect(SOURCE).toContain("Checkout isn't available right now.");
    expect(SOURCE).toContain("Something went wrong — you have not been charged.");
  });
});
