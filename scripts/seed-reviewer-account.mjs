#!/usr/bin/env node
/**
 * Idempotently seeds the Google Play reviewer test account (P9,
 * docs/handoff/human-actions-required.md — "App access" reviewer login).
 *
 * A Play reviewer has no mailbox, so `app/api/auth/reviewer-signin/route.ts`
 * lets them sign in as this one hardcoded account with a shared secret
 * instead of a real magic-link email. This script creates/updates that
 * account directly in the database so the reviewer sees a fully onboarded,
 * Premium profile (progress/BAI and paywall-gated surfaces included) rather
 * than a blank first run.
 *
 * Run against the PREVIEW database only (human runs this manually, per
 * docs/handoff/human-actions-required.md):
 *
 *   DATABASE_URL=<preview-neon-url> HEALTH_DATA_KEY=<preview-key> \
 *     node scripts/seed-reviewer-account.mjs
 *
 * Plain node + `pg` (already a dependency) — no drizzle-kit runtime needed.
 * The A1C ciphertext format below mirrors lib/server/crypto.ts's
 * encryptField() (AES-256-GCM, base64(iv || authTag || ciphertext)) byte
 * for byte; it's duplicated rather than imported because this script runs
 * outside the TypeScript build and can't import a .ts module directly.
 */
import { createCipheriv, randomBytes } from "node:crypto";

import pg from "pg";

const REVIEWER_EMAIL = "reviewer@revora.test";
const REVIEWER_A1C = "6.1"; // mid prediabetes band (5.7%-6.4%), matches onboarding framing
const REVIEWER_A1C_BAND = "prediabetes_60_62"; // lib/revora/a1c.ts routeA1C(6.1)
const REVIEWER_TIMEZONE = "UTC";
const REVIEWER_SUBSCRIPTION_REF = "reviewer-seed-subscription";

function encryptField(plain, healthDataKeyBase64) {
  const key = Buffer.from(healthDataKeyBase64, "base64");
  if (key.length !== 32) {
    throw new Error("HEALTH_DATA_KEY must be 32 bytes, base64-encoded.");
  }
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plain, "utf8"),
    cipher.final()
  ]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString(
    "base64"
  );
}

function isLocalhost(url) {
  try {
    const { hostname } = new URL(url);
    return hostname === "localhost" || hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  const healthDataKey = process.env.HEALTH_DATA_KEY;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set.");
  }
  if (!healthDataKey) {
    throw new Error("HEALTH_DATA_KEY is not set.");
  }

  const client = new pg.Client({
    connectionString: databaseUrl,
    ssl: isLocalhost(databaseUrl) ? undefined : { rejectUnauthorized: true }
  });
  await client.connect();

  try {
    await client.query("BEGIN");

    const { rows: userRows } = await client.query(
      `INSERT INTO users (email, email_verified, name)
       VALUES ($1, now(), 'Play Reviewer')
       ON CONFLICT (email) DO UPDATE SET email_verified = now()
       RETURNING id`,
      [REVIEWER_EMAIL]
    );
    const userId = userRows[0].id;

    const a1cCiphertext = encryptField(REVIEWER_A1C, healthDataKey);
    const now = new Date();

    // Fully onboarded + consented, so the reviewer lands straight on the
    // real product (not the consent/onboarding gate).
    await client.query(
      `INSERT INTO profiles
         (user_id, a1c_ciphertext, a1c_band, timezone, nudge_opt_in, onboarded_at, consented_at)
       VALUES ($1, $2, $3, $4, false, $5, $5)
       ON CONFLICT (user_id) DO UPDATE SET
         a1c_ciphertext = EXCLUDED.a1c_ciphertext,
         a1c_band = EXCLUDED.a1c_band,
         timezone = EXCLUDED.timezone,
         onboarded_at = EXCLUDED.onboarded_at`,
      [userId, a1cCiphertext, REVIEWER_A1C_BAND, REVIEWER_TIMEZONE, now]
    );

    // Premium, far in the future — satisfies getEntitlement()'s
    // PREMIUM_STATUSES + currentPeriodEnd > now condition
    // (lib/server/entitlement.ts) so paywall-gated surfaces render.
    const periodEnd = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
    await client.query(
      `INSERT INTO subscriptions
         (user_id, provider, provider_ref, product_id, status, current_period_end, updated_at)
       VALUES ($1, 'play', $2, 'premium_annual', 'active', $3, now())
       ON CONFLICT (provider_ref) DO UPDATE SET
         status = 'active',
         current_period_end = EXCLUDED.current_period_end,
         updated_at = now()`,
      [userId, REVIEWER_SUBSCRIPTION_REF, periodEnd]
    );

    await client.query("COMMIT");
    console.log(
      `Seeded reviewer account "${REVIEWER_EMAIL}" (user ${userId}) — onboarded, consented, Premium through ${periodEnd.toISOString()}.`
    );
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
