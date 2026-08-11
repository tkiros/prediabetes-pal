/**
 * Proxy (né middleware) glue tests (launch-hardening Task 1.3).
 *
 * Covers the wiring the pure decision logic (rate-limit.test.ts) cannot:
 *  - non-matching requests pass through untouched
 *  - the happy path still passes through when Upstash is unconfigured in
 *    dev/test (regression: the new abuse gate must not break normal checks)
 *  - the existing launch-mode pause gate still fires (503) ahead of any limit
 *
 * The 429 / daily_cap / prod-fail-closed branches depend on module-load env
 * (rateLimitDeps is built once at import from process.env) and on a live
 * Upstash store, so they are verified by rate-limit.test.ts (decision logic)
 * plus the manual preview-deploy curl in the plan (Task 1.3 Step 3).
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { proxy as middleware } from "../../proxy";

function post(path: string, method = "POST"): NextRequest {
  return new NextRequest(new URL(`http://localhost${path}`), { method });
}

function isPassthrough(response: Response): boolean {
  // NextResponse.next() tags the response with this internal header.
  return response.headers.get("x-middleware-next") === "1";
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("middleware", () => {
  it("passes through non-check paths", async () => {
    const response = await middleware(post("/", "GET"));
    expect(isPassthrough(response)).toBe(true);
  });

  it("passes through non-POST requests to /api/check", async () => {
    const response = await middleware(post("/api/check", "GET"));
    expect(isPassthrough(response)).toBe(true);
  });

  it("passes the happy path through when Upstash is unconfigured (dev/test)", async () => {
    const response = await middleware(post("/api/check"));
    expect(isPassthrough(response)).toBe(true);
  });

  it("fails closed (503) on a public deploy when Upstash is unconfigured", async () => {
    // rateLimitDeps was built null at import (no Upstash env). A public preview
    // deploy must NOT run public + unlimited — it fails closed.
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "preview");
    const response = await middleware(post("/api/check"));
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.kind).toBe("retry");
    // NEW-003: this 503 preempts the deterministic clinical router, so the
    // copy must carry the human-care boundary a clinical symptom needs.
    expect(body.message).toMatch(/doctor or your local emergency number/i);
  });

  it("allows an optimized local server explicitly marked Vercel development", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "development");
    const response = await middleware(post("/api/check"));
    expect(isPassthrough(response)).toBe(true);
  });

  it("returns a 503 pause response when launch mode is paused", async () => {
    vi.stubEnv("PAL_LAUNCH_MODE_OVERRIDE", "paused");
    const response = await middleware(post("/api/check"));
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.kind).toBe("retry");
    expect(typeof body.message).toBe("string");
  });
});

/**
 * W-11 — the abuse doors the matcher used to miss entirely. /api/trial/start
 * creates a users row, sends a magic-link email and opens a Stripe Checkout
 * session for any address a stranger types; /api/auth/* is a magic-link flood
 * and an account-enumeration oracle. Both were unlimited.
 *
 * Same split as the check path above: the 429 branch depends on a live Upstash
 * store (rateLimitDeps is built once at import from process.env), so it is
 * proven in rate-limit.test.ts against the pure decision logic. What can only be
 * proven HERE is the wiring — that these paths are matched at all, that GET is
 * not, and that an unconfigured public deploy fails closed rather than open.
 */
describe("middleware — abuse routes (W-11)", () => {
  it("passes POST /api/trial/start through in dev/test (Upstash unconfigured)", async () => {
    const response = await middleware(post("/api/trial/start"));
    expect(isPassthrough(response)).toBe(true);
  });

  it("fails CLOSED (503) on POST /api/trial/start on a public deploy with no Upstash", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "preview");
    const response = await middleware(post("/api/trial/start"));
    expect(response.status).toBe(503);
    expect((await response.json()).error).toMatch(/try again/i);
  });

  it("fails CLOSED (503) on POST /api/auth/signin/* on a public deploy with no Upstash", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "preview");
    const response = await middleware(post("/api/auth/signin/resend"));
    expect(response.status).toBe(503);
  });

  it("NEVER limits GET /api/auth/session — the app polls it on every page load", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "preview");
    const session = await middleware(post("/api/auth/session", "GET"));
    const csrf = await middleware(post("/api/auth/csrf", "GET"));
    expect(isPassthrough(session)).toBe(true);
    expect(isPassthrough(csrf)).toBe(true);
  });
});
