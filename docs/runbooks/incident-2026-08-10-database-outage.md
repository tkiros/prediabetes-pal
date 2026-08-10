# Incident + recovery — Railway expiry took production's database offline

**Opened:** 2026-08-10 · **Severity:** production degraded, auth broken
**Status:** unresolved — awaiting owner action on step 1

---

## Symptom

`GET https://revora.plus/api/health` → **503**

```json
{"ok":false,"status":"degraded","issues":["database_unavailable"],"db":"error"}
```

Marketing routes (`/`, `/check`, `/guides`, `/signin`) still return **200**
because they are prerendered, so the site *looks* healthy. It is not:
`@auth/drizzle-adapter` writes sessions and verification tokens to Postgres, so
**no one can sign in or sign up**, and meal history, saved meals, billing, and
pantry are all failing.

## Cause

The Railway account expired. `.railway/railway.ts` defines the Postgres
services, and `docs/runbooks/database-governance.md` §"Store inventory" states
production runs against **exactly one** store — the Railway database bound by
`DATABASE_URL`.

⚠️ Not directly verified: a second production `vercel env pull` was blocked by
a permission classifier, so `DATABASE_URL`'s hostname was never read. Confirm it
points at Railway before acting, though the timing makes this near-certain.

## ⛔ There is no backup

Checked 2026-08-10:

- `~/revora-backups/` contains **only** `postgres-fomu-export-2026-07-24.json`
  — the 7-row `billing_event_inbox` export from the OA-4 cleanup. Not a dump of
  the live store.
- `~/bcb-backups/postgres/*.sql.gz` belong to a **different project** (trading).
- `psql`, `pg_dump`, `pg_restore` are **not installed** on this machine.

**The only copy of user data is inside the expired Railway account.** Provider
volumes are normally retained for a grace period after expiry and then deleted.
This is the time-sensitive part of the incident.

---

## Step 1 — Reactivate Railway (do this first, today)

Pay the outstanding balance. This is not a decision about staying on Railway; it
is the only way to reach the data. One month's fee is cheaper than losing every
account, meal record, subscription, and pantry entry.

**Reactivating also restores production on its own** — `DATABASE_URL` still
points there, so the app recovers with no migration and no deploy. Confirm:

```bash
curl -s https://revora.plus/api/health
# expect "ok":true and "db":"ok"
```

If Railway has already deleted the volume, stop and read §"If the data is gone".

## Step 2 — Take the backup that never existed

Immediately, before any migration work. Use the **owner** credential
(`DATABASE_MIGRATION_URL`), not the restricted runtime role, so the dump is
complete.

```bash
sudo apt-get update && sudo apt-get install -y postgresql-client
mkdir -p ~/revora-backups

pg_dump "<RAILWAY_OWNER_URL>?sslmode=require" \
  --format=custom --no-owner --no-privileges \
  --file ~/revora-backups/revora-$(date +%Y%m%d-%H%M).dump
```

Verify it is real, not a 2 KB stub:

```bash
ls -lh ~/revora-backups/*.dump
pg_restore --list ~/revora-backups/revora-*.dump | grep -c 'TABLE DATA'
```

Expect roughly 20+ tables. Schedule this to repeat — the absence of any backup
is the actual root cause of how bad this incident is.

---

## Step 3 — Migrate off Railway (unhurried, after steps 1–2)

Neon speaks the standard Postgres wire protocol, so the existing `pg` Pool +
`drizzle-orm` code works **unchanged**. `createDatabasePoolConfig` already
enables TLS for every non-localhost host, which Neon requires.

```bash
npx vercel integration add neon
```

### 3.1 Restore the dump into Neon (owner/direct connection string)

```bash
pg_restore --no-owner --no-privileges \
  --dbname "<NEON_OWNER_URL>" \
  ~/revora-backups/revora-<stamp>.dump
```

### 3.2 Recreate the two-role split

The governance model requires runtime and migration URLs to use **different
roles** — `resolveMigrationDatabaseUrl()` throws otherwise. Create the runtime
role, then run the `REVOKE`/`GRANT` block from
`docs/runbooks/database-governance.md` §"One-time role split" verbatim:

```sql
CREATE ROLE revora_app LOGIN PASSWORD '<generated>';
-- then the runbook's BEGIN;…COMMIT; block
```

### 3.3 Verify before touching Vercel

```bash
export DATABASE_URL='<neon POOLED url, revora_app role>'
export DATABASE_MIGRATION_URL='<neon DIRECT url, owner role>'
npm run db:governance:check
```

Every boolean must be true. The migration head is
**`0018_accounts-expires-at-integer`** (19 journal entries) — the governance
runbook still says `0017`, which is stale.

Use Neon's **pooled** endpoint (`-pooler` host) for `DATABASE_URL` and the
**direct** endpoint for migrations. Each Vercel instance opens up to
`DATABASE_POOL_MAX` (3) connections; keep it at 3.

### 3.4 Cut over

```bash
npx vercel env rm DATABASE_URL production
npx vercel env add DATABASE_URL production   # paste the POOLED revora_app URL
npx vercel --prod
curl -s https://revora.plus/api/health
```

⛔ **Never** bind `DATABASE_MIGRATION_URL` to Vercel. It is operator-only — that
is the whole point of the split.

---

## Step 4 — Replace the hourly cron runner

Railway also runs `hourly-crons`: four GET requests per hour with
`Authorization: Bearer $CRON_SECRET`, from `scripts/run-hourly-crons.mjs`
(`/api/cron/{nudge,pantry-sweep,trial-precharge,stripe-reconcile}`).

**Cloudflare cannot host the database** — D1 is SQLite and Hyperdrive is only a
pooler in front of someone else's Postgres — but it can host this. Three
options, cheapest first:

### 4a. GitHub Actions (recommended — reuses the existing script unchanged)

`.github/workflows/hourly-crons.yml`:

```yaml
name: hourly-crons
on:
  schedule: [{ cron: "0 * * * *" }]
  workflow_dispatch:
jobs:
  run:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: "24" }
      - run: node scripts/run-hourly-crons.mjs
        env:
          APP_URL: https://revora.plus
          CRON_SECRET: ${{ secrets.CRON_SECRET }}
```

No new vendor, no rewrite. Scheduled runs can be delayed a few minutes under
GitHub load, which is fine hourly.

⚠️ `validateCronConfig()` compares `APP_URL` byte-for-byte against the
hardcoded `CANONICAL_APP_URL`. It is `https://revora.plus` today and becomes
`https://prediabetespal.com` when the rename merges — change both together.

### 4b. Cloudflare Worker (free)

```js
export default {
  async scheduled(event, env) {
    for (const p of ["/api/cron/nudge", "/api/cron/pantry-sweep",
                     "/api/cron/trial-precharge", "/api/cron/stripe-reconcile"]) {
      const r = await fetch(env.APP_URL + p, {
        headers: {
          accept: "application/json",
          authorization: `Bearer ${env.CRON_SECRET}`,
          "user-agent": "revora-hourly-cron/1"
        },
        redirect: "manual"
      });
      console.log(p, r.status);
    }
  }
};
```

`wrangler.toml` sets `[triggers] crons = ["0 * * * *"]` and `APP_URL`;
`wrangler secret put CRON_SECRET` supplies the token.

### 4c. Vercel Cron — simplest, but plan-gated

Add the four paths to `vercel.json` alongside the existing `bai-weekly`. Hobby
allows only 2 cron jobs at daily granularity, which is almost certainly why
Railway existed; this needs Pro ($20/mo).

Once the cron moves, `.railway/railway.ts` is dead config — delete it rather
than maintain it, along with the merge-order warning it carries.

---

## Step 5 — `support@` on both domains

Both apexes now have **zero MX records**, so `support@revora.plus` and
`support@prediabetespal.com` both bounce. Confirmed cause: adding the Resend
`send.contact` MX flips Namecheap out of Email Forwarding mode and drops the
`eforward1-5` records. See `docs/ops/rename-cutover-runbook.md` §2.3.

Fix (free, and it resolves both domains): move DNS to **Cloudflare**, which
allows arbitrary custom MX *and* Email Routing for `support@`. Registrar stays
Namecheap. Confirm with a delivered test message, never by inspecting records.

---

## If the data is gone

If Railway has already purged the volume, production can be restored on an
empty Neon database (steps 3.1–3.4, skipping the restore, then
`npm run db:migrate:production` to build the schema from the 19 migrations).
Understand what that means: every user account, meal record, subscription link,
and pantry entry is gone, and every existing user is silently logged out with
no history. Stripe still holds the subscriptions, so billing and the app would
disagree until reconciled. Treat this as the last resort it is.

---

## Ordering against the rename

The rename branch (`rename/prediabetes-pal`) stays unmerged until production is
healthy. Its merge gates are unchanged and listed in
`docs/ops/rename-cutover-runbook.md` §4 — note that gate 3 (Railway `APP_URL`)
becomes a GitHub Actions or Cloudflare secret instead, per step 4 above.
