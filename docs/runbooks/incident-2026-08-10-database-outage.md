# Incident + recovery — Railway expiry took production's database offline

**Opened:** 2026-08-10 · **Severity:** production degraded, auth broken
**Status:** ✅ **database resolved** — `db: "ok"`. Residual: cron heartbeats.

## Resolution (2026-08-10)

`DATABASE_URL` now points at Neon. `/api/health` reports `"db":"ok"`; the
`database_unavailable` issue is gone and sign-in works again.

What was done:

| | |
|---|---|
| Provisioned | Neon `revora-db`, plan **`free_v3`** (Free), project `dry-shadow-56131409`, region `us-east-1` |
| Connected | with `--prefix NEON_`, so the integration's own vars never collided with `DATABASE_URL` |
| Migrated | all 19 migrations applied via the **owner** role on the direct (unpooled) endpoint → **22 tables** |
| Runtime role | `revora_app` created, 9 grant/revoke statements applied per `database-governance.md` |
| Governance | `npm run db:governance:check` — every boolean true, 19/19 migrations recorded |
| Production | `DATABASE_URL` replaced with the **pooled `revora_app`** URL; `DATABASE_MIGRATION_URL` deliberately NOT set in Vercel |
| Deployed | via `vercel redeploy` of the existing production deployment — **not** `vercel --prod`, which would have shipped the unmerged rename branch |

⚠️ **A `revora_app` password was printed to a session transcript** (an unquoted
`&` in the connection string caused a shell to echo it). It was **rotated
immediately** and the leaked value never reached Vercel or any deployment. The
credential in production is the post-rotation one.

### Residual — cron heartbeats

`/api/health` still returns **503**, now for a different reason: every cron
reads `never`, because `cron_heartbeat` is a fresh empty table and Railway's
runner is gone. `NUDGE_STALE_MS` and friends are **2 hours**, so this does not
self-heal.

Fix is committed on branch **`ops/hourly-crons-github-actions`**
(`.github/workflows/hourly-crons.yml`). To activate:

1. Add `CRON_SECRET` as a **repository secret**, matching Vercel production.
2. Merge that branch to `main` — scheduled workflows only run from the default
   branch, so it is inert until then.
3. Trigger it once via **workflow_dispatch** rather than waiting an hour, then
   re-check `/api/health`.

Everything below is the original record of the incident.

---

## ⚠️ SUPERSEDED — owner decision, 2026-08-10

**The owner states there are no customers and no customer records**, so data
recovery is not required. Steps 1–2 below (reactivate Railway, dump) are
**skipped**; the chosen path is a **fresh Neon database built from the 19
migrations**. Follow §"Chosen path" immediately below. Everything from
§"Symptom" down is retained as the record of what was found and why the
original ordering was recommended.

Two things to keep in mind:

- Creating a new database **destroys nothing**. The Railway volume is
  abandoned, not deleted, and stays recoverable for as long as Railway retains
  it — so this decision is reversible on that clock, not permanently.
- `STRIPE_SECRET_KEY` is production-only and a second env pull was blocked, so
  **Stripe was never checked for live subscriptions.** If any exist, they will
  reference user rows that no longer have a database. Worth one look in the
  Stripe dashboard before cutting over.

### Chosen path

Verified 2026-08-10: the migration set is sound — 19 journal entries, 19 `.sql`
files, indices sequential, no `DROP TABLE` or `TRUNCATE` anywhere, building 22
tables. It will apply cleanly to an empty database.

**Owner step (required, cannot be automated — it is a legal acceptance):**
accept Neon's marketplace terms at
`https://vercel.com/tkiros-projects/~/integrations/accept-terms/neon?source=cli`
Policies: [marketplace addendum](https://vercel.com/legal/integration-marketplace-end-users-addendum)
· [Neon privacy](https://neon.tech/privacy-policy) · [Neon EULA](https://neon.tech/terms-of-service).
Choose the **Free** plan.

Then, in this order — the order matters, because granting on `ALL TABLES`
before the tables exist grants nothing:

1. **Provision**
   ```bash
   npx vercel integration add neon --no-claim --environment production --format json
   ```
2. **Migrate as the owner role** (creates all 22 tables)
   ```bash
   export DATABASE_MIGRATION_URL='<neon DIRECT url, owner role>'
   export DATABASE_URL="$DATABASE_MIGRATION_URL"   # temporary, migration only
   npx drizzle-kit migrate
   ```
3. **Create the restricted runtime role.** Neon's web SQL editor cannot run
   psql's `\gexec`, so the governance block is written out literally here.
   Substitute the real database and owner role names:
   ```sql
   CREATE ROLE revora_app LOGIN PASSWORD '<generated>';
   REVOKE CREATE ON SCHEMA public FROM PUBLIC;
   REVOKE CREATE ON SCHEMA public FROM revora_app;
   REVOKE CREATE ON DATABASE neondb FROM revora_app;
   GRANT CONNECT ON DATABASE neondb TO revora_app;
   GRANT USAGE ON SCHEMA public TO revora_app;
   GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO revora_app;
   GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO revora_app;
   ALTER DEFAULT PRIVILEGES FOR ROLE neondb_owner IN SCHEMA public
     GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO revora_app;
   ALTER DEFAULT PRIVILEGES FOR ROLE neondb_owner IN SCHEMA public
     GRANT USAGE, SELECT ON SEQUENCES TO revora_app;
   ```
4. **Verify the split** — `resolveMigrationDatabaseUrl()` throws if both URLs
   share a role, which is the check that proves this worked:
   ```bash
   export DATABASE_URL='<neon POOLED url, revora_app role>'
   export DATABASE_MIGRATION_URL='<neon DIRECT url, owner role>'
   npm run db:governance:check
   ```
   Every boolean true; head `0018_accounts-expires-at-integer`.
5. **Fix what the integration injected.** The Neon integration writes
   `DATABASE_URL` into Vercel using the **owner** role, which would hand the web
   runtime DDL authority and violate the governance model. Replace it with the
   pooled `revora_app` URL, and never add `DATABASE_MIGRATION_URL` to Vercel:
   ```bash
   npx vercel env rm DATABASE_URL production
   npx vercel env add DATABASE_URL production   # pooled revora_app URL
   npx vercel --prod
   curl -s https://revora.plus/api/health       # expect "ok":true
   ```
6. **Set up backups now, while the database is empty and it is cheap to think
   about.** The absence of any backup is what made this incident dangerous.

Steps 3–4 in §"Step 4" (cron replacement) and §"Step 5" (`support@`) still
apply unchanged.

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
