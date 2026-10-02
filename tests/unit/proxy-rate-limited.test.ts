/**
 * FIX1 (feature map 2026-09-24 §3.0): the proxy's 429 answers before the
 * deterministic clinical router can run, so its body carries the urgent-care
 * line. proxy.test.ts cannot reach this branch — rateLimitDeps is built once at
 * import from env — so the limiter is mocked to "configured, and over limit".
 */
import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("../../lib/pal/rate-limit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../lib/pal/rate-limit")>()),
  createRateLimitDeps: () => ({}),
  evaluateRateLimit: async () => ({ ok: false, reason: "ip", retryAfterSeconds: 60 })
}));

import { proxy } from "../../proxy";
import { URGENT_CARE_LINE } from "../../lib/pal/urgent-care";

describe("proxy 429 on /api/check", () => {
  it("carries the urgent-care line", async () => {
    const response = await proxy(
      new NextRequest(new URL("http://localhost/api/check"), { method: "POST" })
    );
    expect(response.status).toBe(429);
    const body = await response.json();
    expect(body.kind).toBe("retry");
    expect(body.message).toContain("a lot of people right now");
    expect(body.message).toContain(URGENT_CARE_LINE);
  });
});
