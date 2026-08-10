import { createHash } from "node:crypto";

import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  createReviewerSigninHandler,
  REVIEWER_EMAIL
} from "../../../app/api/auth/reviewer-signin/route";
import { schema } from "../../../lib/server/db";
import { createTestDb } from "../../helpers/test-db";

/**
 * P9 — Play-reviewer test-login bypass. Must be provably dead in production;
 * TDD per the brief, PGlite via tests/helpers/test-db.ts, env faked through
 * the injected `getEnv` dep rather than mutating process.env.
 */

const NOW = new Date("2026-07-02T12:00:00.000Z");
const SECRET = "reviewer-secret-value";
const AUTH_SECRET = "test-auth-secret";

let testDb: Awaited<ReturnType<typeof createTestDb>>;

beforeAll(async () => {
  testDb = await createTestDb();
});

afterAll(async () => {
  await testDb.close();
});

beforeEach(async () => {
  await testDb.db.delete(schema.verificationTokens);
});

function baseEnv(overrides: Record<string, string | undefined> = {}) {
  return {
    NODE_ENV: "production",
    VERCEL_ENV: "preview",
    REVIEWER_TEST_SECRET: SECRET,
    AUTH_SECRET,
    ...overrides
  };
}

function post(body: unknown) {
  return new Request("https://preview.prediabetespal.com/api/auth/reviewer-signin", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}

function handler(env: Record<string, string | undefined>, now = NOW) {
  return createReviewerSigninHandler({
    db: () => testDb.db,
    getEnv: () => env,
    now: () => now
  });
}

describe("POST /api/auth/reviewer-signin — production is hard-blocked", () => {
  it("404s when VERCEL_ENV is production, even with the correct secret", async () => {
    const POST = handler(baseEnv({ VERCEL_ENV: "production" }));
    const response = await POST(post({ email: REVIEWER_EMAIL, secret: SECRET }));

    expect(response.status).toBe(404);
    const rows = await testDb.db.select().from(schema.verificationTokens);
    expect(rows).toHaveLength(0);
  });

  it("404s when VERCEL_ENV is unset and NODE_ENV is production (fail-closed default)", async () => {
    const POST = handler(
      baseEnv({ VERCEL_ENV: undefined, NODE_ENV: "production" })
    );
    const response = await POST(post({ email: REVIEWER_EMAIL, secret: SECRET }));

    expect(response.status).toBe(404);
  });

  it("allows VERCEL_ENV=development even though NODE_ENV says production", async () => {
    const POST = handler(baseEnv({ VERCEL_ENV: "development" }));
    const response = await POST(post({ email: REVIEWER_EMAIL, secret: SECRET }));

    expect(response.status).toBe(302);
  });
});

describe("POST /api/auth/reviewer-signin — secret and identity checks", () => {
  it("404s when REVIEWER_TEST_SECRET is unset", async () => {
    const POST = handler(baseEnv({ REVIEWER_TEST_SECRET: undefined }));
    const response = await POST(post({ email: REVIEWER_EMAIL, secret: SECRET }));

    expect(response.status).toBe(404);
  });

  it("404s on a wrong secret", async () => {
    const POST = handler(baseEnv());
    const response = await POST(
      post({ email: REVIEWER_EMAIL, secret: "not-the-secret" })
    );

    expect(response.status).toBe(404);
  });

  it("404s on a wrong email — the allowed address is hardcoded server-side", async () => {
    const POST = handler(baseEnv());
    const response = await POST(
      post({ email: "someone-else@example.com", secret: SECRET })
    );

    expect(response.status).toBe(404);
  });

  it("404s when AUTH_SECRET is unset (Auth.js couldn't complete the callback anyway)", async () => {
    const POST = handler(baseEnv({ AUTH_SECRET: undefined }));
    const response = await POST(post({ email: REVIEWER_EMAIL, secret: SECRET }));

    expect(response.status).toBe(404);
  });

  it("404s on malformed JSON instead of throwing", async () => {
    const POST = handler(baseEnv());
    const response = await POST(
      new Request("https://preview.prediabetespal.com/api/auth/reviewer-signin", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "not json"
      })
    );

    expect(response.status).toBe(404);
  });

  it("never returns 403 — the route must not confirm its own existence", async () => {
    const POST = handler(baseEnv());
    const response = await POST(
      post({ email: "wrong@example.com", secret: "wrong" })
    );

    expect(response.status).not.toBe(403);
    expect(response.status).toBe(404);
  });
});

describe("POST /api/auth/reviewer-signin — happy path", () => {
  it("writes a verification token Auth.js's own callback can consume, and redirects into it", async () => {
    const POST = handler(baseEnv());
    const response = await POST(post({ email: REVIEWER_EMAIL, secret: SECRET }));

    expect(response.status).toBe(302);
    const location = response.headers.get("location");
    expect(location).toBeTruthy();

    const redirectUrl = new URL(location!);
    expect(redirectUrl.pathname).toBe("/api/auth/callback/resend");
    expect(redirectUrl.searchParams.get("email")).toBe(REVIEWER_EMAIL);
    const token = redirectUrl.searchParams.get("token");
    expect(token).toBeTruthy();

    // Prove the token is genuinely usable: Auth.js's email callback looks up
    // `sha256(token + AUTH_SECRET)` (see @auth/core's send-token.js /
    // callback/index.js) — recomputing that hash and finding the row proves
    // the redirect target will actually complete the sign-in.
    const expectedHash = createHash("sha256")
      .update(`${token}${AUTH_SECRET}`, "utf8")
      .digest("hex");

    const [row] = await testDb.db
      .select()
      .from(schema.verificationTokens)
      .where(
        and(
          eq(schema.verificationTokens.identifier, REVIEWER_EMAIL),
          eq(schema.verificationTokens.token, expectedHash)
        )
      );

    expect(row).toBeTruthy();
    expect(row.expires.getTime()).toBeGreaterThan(NOW.getTime());
  });

  it("each call issues a fresh single-use token (not reused across requests)", async () => {
    const POST = handler(baseEnv());

    const first = await POST(post({ email: REVIEWER_EMAIL, secret: SECRET }));
    const second = await POST(post({ email: REVIEWER_EMAIL, secret: SECRET }));

    const firstToken = new URL(first.headers.get("location")!).searchParams.get(
      "token"
    );
    const secondToken = new URL(
      second.headers.get("location")!
    ).searchParams.get("token");

    expect(firstToken).not.toBe(secondToken);

    const rows = await testDb.db
      .select()
      .from(schema.verificationTokens)
      .where(eq(schema.verificationTokens.identifier, REVIEWER_EMAIL));
    expect(rows).toHaveLength(2);
  });
});
