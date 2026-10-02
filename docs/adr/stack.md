# ADR: Stateful-layer stack

**Date:** 2026-07-01 · **Status:** Accepted · **Phases:** 4A–4E, 5, 7

## Decision

| Concern | Choice | One-line why |
|---|---|---|
| Database | **Neon Postgres (Vercel Marketplace)** + **Drizzle ORM/kit** migrations | Serverless-native Postgres with branching (dev/preview/prod); Drizzle is schema-as-TS with plain SQL migrations, no runtime magic. **Superseded by `docs/adr/hosting-hybrid.md` (DB)** — the database became Railway Postgres (2026-07), then **Neon Postgres** again after Railway expired (2026-08-10; see the superseded note in that ADR) |
| Auth | **Auth.js v5** email magic-link, **DB sessions**, Drizzle adapter | Passwordless fits the 40–65 audience; no password storage; DB sessions are revocable and power deletion |
| Email | **Resend** | One API for magic links + transactional; dev key works locally |
| Field encryption | **AES-256-GCM via `node:crypto`**, key = `HEALTH_DATA_KEY` (32-byte base64 env), format `base64(iv‖tag‖ciphertext)` | A1C + food text are GDPR Art. 9 / health-adjacent; env-key AES-GCM is the smallest correct at-rest control. `ponytail:` upgrade path = KMS/managed keys if compliance posture demands |
| Push | **web-push** (VAPID) + hourly cron (~~Railway scheduler~~ GitHub Actions since 2026-08-10) | Standard Web Push works in TWA/Android Chrome; no vendor SDK |
| Cron | ~~**Railway scheduler**~~ **GitHub Actions** (`.github/workflows/hourly-crons.yml`, since 2026-08-10) for the hourly jobs (nudge, pantry-sweep, trial-precharge, stripe-reconcile); **Vercel cron** (`vercel.json`) only for weekly `bai-weekly` | A fresh readiness heartbeat, not checked-in config, proves the scheduler is operating (`docs/adr/hosting-hybrid.md`, superseded note) |
| Analytics | ~~Plausible~~ script + a typed no-PII event allowlist (`lib/client/analytics.ts`) | The allowlist is enforced by a unit test. **Superseded by `docs/adr/analytics-umami.md`** — the current vendor deployment is Umami Cloud; self-hosting is only a future option |
| Billing | see `docs/adr/billing.md` | |

## Non-choices (rejected)

- **Prisma**: heavier runtime + engine binary on serverless; Drizzle's SQL
  migrations are easier to audit for the encrypted-column rules.
- **NextAuth JWT sessions**: DB sessions make sign-out-everywhere and
  account deletion trivially correct.
- **`googleapis`**: one endpoint (`subscriptionsv2.get`) does not justify the
  dependency; RS256 JWT via `node:crypto` + `fetch` suffices.
- **Google Analytics / PostHog default config**: PII risk in a health app;
  Plausible's model matches the privacy posture.

## Constraints carried by this stack

- Exact A1C and food text are **only** stored encrypted (`profiles.a1c_ciphertext`,
  `checks.food_ciphertext`); coarse fields (band, risk, timestamps) stay
  plaintext so coach compute never decrypts.
- `HEALTH_DATA_KEY`, `AUTH_SECRET`, VAPID keys are generated in-session and
  **stored by the human** (plan §10 §2).
