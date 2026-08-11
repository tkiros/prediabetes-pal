import { createHash, randomBytes } from "node:crypto";

import { NextResponse } from "next/server";
import { z } from "zod";

import { getDb, schema, type Db } from "../../../../lib/server/db";
import { timingSafeEqualSecret } from "../../../../lib/server/timing-safe";

/**
 * Play-reviewer test-login bypass (P9, docs/handoff/human-actions-required.md).
 * A Google Play reviewer has no mailbox, so this route lets a single seeded
 * account (`scripts/seed-reviewer-account.mjs`) sign in with a shared secret
 * instead of a real magic-link email. It must be impossible in production:
 * every rejection path returns a bare 404 (never 403 — the route does not
 * confirm its own existence).
 *
 * Session mechanism: rather than hand-writing a `sessions` row and a cookie,
 * this route re-enters Auth.js's OWN magic-link verification path end to
 * end. Auth.js's email callback (`@auth/core/lib/actions/callback/index.js`)
 * looks up a `verification_tokens` row keyed by `sha256(rawToken +
 * AUTH_SECRET)` (`@auth/core/lib/actions/signin/send-token.js` writes it the
 * same way) and, on a match, creates the user/session and sets the session
 * cookie itself. That's the exact code path a real emailed link uses.
 *
 * This was chosen over directly inserting into `schema.sessions` and setting
 * the cookie by hand because the cookie's name and `secure` flag depend on
 * Auth.js's internal `useSecureCookies` check (`config.useSecureCookies ??
 * url.protocol === "https:"`, `@auth/core/lib/init.js`) — reimplementing
 * that here would silently drift if Auth.js changes it, and a subtly wrong
 * cookie is a much worse failure mode (looks like it works, reviewer can't
 * sign in) than the token route, which fails loudly if Auth.js's shape ever
 * changes (the redirect 404s upstream instead of setting a broken cookie).
 */

// The only account this route will ever sign in — never taken from the
// request body, so a leaked secret still can't be used to sign in as
// anyone else.
export const REVIEWER_EMAIL = "reviewer@pal.test";

const TOKEN_TTL_MS = 10 * 60 * 1000; // single-use, short-lived
const PROVIDER_ID = "resend"; // matches the Resend provider id in auth.ts
const BASE_PATH = "/api/auth"; // Auth.js's default basePath (unset in auth.ts)

const BodySchema = z
  .object({
    email: z.string().trim().min(1).max(320),
    secret: z.string().min(1).max(512)
  })
  .strict();

export type ReviewerSigninEnv = {
  NODE_ENV?: string;
  VERCEL_ENV?: string;
  REVIEWER_TEST_SECRET?: string;
  AUTH_SECRET?: string;
};

export type ReviewerSigninDeps = {
  db?: () => Db;
  getEnv?: () => ReviewerSigninEnv;
  now?: () => Date;
};

/**
 * Fail-closed: only VERCEL_ENV=preview/development are treated as non-prod.
 * VERCEL_ENV=production always blocks. With VERCEL_ENV unset (non-Vercel
 * host, local `node`, etc.) fall back to NODE_ENV — Next.js sets
 * NODE_ENV=production for every optimized build, including Vercel previews,
 * which is exactly why VERCEL_ENV=preview must short-circuit that check
 * rather than be blocked by it.
 */
function isProductionDeployment(env: ReviewerSigninEnv): boolean {
  if (env.VERCEL_ENV === "production") {
    return true;
  }
  if (env.VERCEL_ENV === "preview" || env.VERCEL_ENV === "development") {
    return false;
  }
  return env.NODE_ENV === "production";
}

function notFound(): NextResponse {
  return new NextResponse(null, { status: 404 });
}

function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

export function createReviewerSigninHandler(deps: ReviewerSigninDeps = {}) {
  const db = deps.db ?? getDb;
  const getEnv = deps.getEnv ?? (() => process.env);
  const now = deps.now ?? (() => new Date());

  return async function POST(request: Request): Promise<NextResponse> {
    const env = getEnv();

    if (isProductionDeployment(env) || !env.REVIEWER_TEST_SECRET) {
      return notFound();
    }

    // Auth.js can't complete the callback this route redirects to without
    // its own signing secret — fail closed rather than issue a dead link.
    const authSecret = env.AUTH_SECRET;
    if (!authSecret) {
      return notFound();
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return notFound();
    }

    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return notFound();
    }

    if (
      !timingSafeEqualSecret(parsed.data.secret, env.REVIEWER_TEST_SECRET) ||
      parsed.data.email !== REVIEWER_EMAIL
    ) {
      return notFound();
    }

    const token = randomBytes(32).toString("hex");
    const expires = new Date(now().getTime() + TOKEN_TTL_MS);

    await db()
      .insert(schema.verificationTokens)
      .values({
        identifier: REVIEWER_EMAIL,
        token: sha256Hex(`${token}${authSecret}`),
        expires
      });

    const origin = new URL(request.url).origin;
    const callbackUrl = new URL(`${BASE_PATH}/callback/${PROVIDER_ID}`, origin);
    callbackUrl.searchParams.set("callbackUrl", "/");
    callbackUrl.searchParams.set("token", token);
    callbackUrl.searchParams.set("email", REVIEWER_EMAIL);

    return NextResponse.redirect(callbackUrl, 302);
  };
}

export const runtime = "nodejs";
export const POST = createReviewerSigninHandler();
