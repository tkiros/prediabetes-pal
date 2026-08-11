#!/usr/bin/env node
// Seeds a PAID pantry order (as the Stripe webhook would) and prints the claim
// URL. The webhook itself is covered by unit tests — E2E starts from the paid
// state because Stripe can't sign events at a local server. Usage:
//   DATABASE_URL=... node scripts/seed-pantry-order.mjs buyer-e2e@pal.test
import { createHash, randomBytes } from "node:crypto";
import pg from "pg";

const email = process.argv[2] ?? `e2e-${Date.now()}@pal.test`;
const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL required");
  process.exit(1);
}

const token = randomBytes(32).toString("base64url");
const tokenHash = createHash("sha256").update(token).digest("hex");
const sessionId = `cs_e2e_${Date.now()}`;

const client = new pg.Client({ connectionString: url });
await client.connect();
await client.query(
  `INSERT INTO pantry_orders (email, stripe_session_id, stripe_payment_intent, claim_token, status)
   VALUES ($1, $2, $3, $4, 'paid')`,
  [email, sessionId, `pi_e2e_${Date.now()}`, tokenHash]
);
await client.end();

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://127.0.0.1:3100";
console.log(JSON.stringify({ email, claimUrl: `${appUrl}/pantry/claim?token=${token}` }));
