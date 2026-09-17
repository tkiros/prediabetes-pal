# Database governance and release proof

The application and migration credentials have different jobs:

- `DATABASE_URL` is the Vercel runtime credential. It can read/write app rows
  but cannot create schemas or objects.
- `DATABASE_MIGRATION_URL` is the Neon owner credential (`neondb_owner`). It is available
  only to the operator running migrations; never bind it to Vercel.

## One-time role split

Use the existing Neon owner as the migration role. Create a separate login
with a generated password, then run the grant/revoke block below as the owner.
Do not paste credentials into this file.

> **2026-08-11 — ✅ DONE.** The app role was renamed `revora_app` →
> `prediabetespal_app` and `revora_app` was dropped. Production runs on the new
> role: governance check all-true (19/19 migrations), `/api/health` `db:"ok"`,
> a live `/api/check`, and a real signin whose verification-token row was
> confirmed written. The procedure below is retained as the reference for the
> next role rotation; the historical `psql` block after it documents the grant
> set that was reproduced.

### Neon-console procedure (current — no local credentials needed)

The Neon project is **displayed as `revora-db`** in the console;
`dry-shadow-56131409` is its project *ID* (shown in Project Settings and the
URL, and stored as `NEON_PROJECT_ID`) — not a name you can search for. Database
`neondb`, owner role `neondb_owner`. The console's SQL editor is **not** psql,
so `\gexec` does not work there — these statements are already expanded.

⛔ **Create the role with SQL, never with the Console's Roles tab.** Neon grants
`neon_superuser` to every role created through the Console/CLI/API, which would
let the "restricted" app role create schemas and databases — the exact thing
this split exists to prevent. Verified 2026-08-11: `revora_app` holds no
`neon_superuser` membership and has `rolsuper/rolcreatedb/rolcreaterole` all
false; the new role must match. `npm run db:governance:check` catches the
mistake (`runtimeCannotCreate` asserts `can_create_schema === false` and
`can_create_database === false`), but catching it after repointing production
is a bad way to find out.

1. Generate a password in the operator shell (`openssl rand -hex 24`), then in
   **Neon Console → SQL Editor** as `neondb_owner`:

```sql
CREATE ROLE prediabetespal_app LOGIN PASSWORD '<generated>';
```

2. **Neon Console → SQL Editor**, as `neondb_owner`, run:

```sql
BEGIN;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
REVOKE CREATE ON SCHEMA public FROM prediabetespal_app;
REVOKE CREATE ON DATABASE neondb FROM prediabetespal_app;
GRANT CONNECT ON DATABASE neondb TO prediabetespal_app;
GRANT USAGE ON SCHEMA public TO prediabetespal_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO prediabetespal_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO prediabetespal_app;
ALTER DEFAULT PRIVILEGES FOR ROLE neondb_owner IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO prediabetespal_app;
ALTER DEFAULT PRIVILEGES FOR ROLE neondb_owner IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO prediabetespal_app;
COMMIT;
```

3. Confirm the grants landed **and that the role is genuinely restricted**
   (expect `22`, then zero rows — 22 is the public-table count at the
   2026-08-11 head, matching `revora_app`'s current grant count):

```sql
SELECT count(*) FROM information_schema.table_privileges
WHERE grantee = 'prediabetespal_app' AND privilege_type = 'SELECT';

-- MUST return zero rows. Any row here means the role was created through the
-- Console UI and inherited neon_superuser — drop it and redo step 1 in SQL.
SELECT g.rolname AS granted_role
FROM pg_auth_members am
JOIN pg_roles r ON r.oid = am.member
JOIN pg_roles g ON g.oid = am.roleid
WHERE r.rolname = 'prediabetespal_app';
```

4. Repoint `DATABASE_URL` in **Vercel** to the **pooled** `prediabetespal_app`
   URL and redeploy. ⛔ `DATABASE_MIGRATION_URL` stays out of Vercel.
5. Verify `/api/health` → `db:"ok"` **and** a real signin (sessions live in
   Postgres, so a broken app role is also a login outage).
6. Only then retire the old role. ⚠️ **`DROP OWNED BY` fails on Neon** with
   `permission denied to drop objects` — `neondb_owner` is not a true
   superuser. Revoke explicitly instead; the role owns no objects
   (`neondb_owner` does), so this is equivalent:

```sql
ALTER DEFAULT PRIVILEGES FOR ROLE neondb_owner IN SCHEMA public REVOKE ALL ON TABLES FROM revora_app;
ALTER DEFAULT PRIVILEGES FOR ROLE neondb_owner IN SCHEMA public REVOKE ALL ON SEQUENCES FROM revora_app;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM revora_app;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM revora_app;
REVOKE ALL ON SCHEMA public FROM revora_app;
REVOKE ALL ON DATABASE neondb FROM revora_app;
REVOKE revora_app FROM neondb_owner;   -- the owner is a member of the app role
DROP ROLE revora_app;
```

There is **no tolerable partial state** between steps 4 and 5: repointing
before the grants exist takes production's database away.

### Historical `psql` block (documents the existing `revora_app` grants)

Run this block with `psql` (it uses `\gexec` to quote the provider-generated
database and owner-role identifiers safely):

```sql
BEGIN;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
REVOKE CREATE ON SCHEMA public FROM revora_app;
SELECT format('REVOKE CREATE ON DATABASE %I FROM revora_app', current_database()) \gexec
SELECT format('GRANT CONNECT ON DATABASE %I TO revora_app', current_database()) \gexec
GRANT USAGE ON SCHEMA public TO revora_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO revora_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO revora_app;
SELECT format(
  'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO revora_app',
  current_user
) \gexec
SELECT format(
  'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO revora_app',
  current_user
) \gexec
COMMIT;
```

Review the transaction before commit. Do not revoke the owner role or transfer
object ownership during this change.

## Migration sequence

The current source journal ends at `0019_profile-orientation.sql`
(20 journal entries; applied to production 2026-09-17). Migrations `0014`
through `0019` are additive. Migration `0017` adds only bounded operational
attempt/lease metadata to `push_subscriptions`; existing rows receive
`nudge_attempt_count = 0` and require no data backfill. Migration `0019` adds
one nullable `profiles.orientation jsonb` column (no backfill).

⚠️ When this head advances, update this line. It read `0017` for the whole of
the 2026-08-10 outage and rebuild, which is exactly when an operator would
have trusted it.

1. Take/verify a provider backup and record its timestamp.
2. Put both URLs in a private (`chmod 600`) env file, each value in double
   quotes, and load it with `node --env-file` (see the traps below — never
   `source` it). `DATABASE_MIGRATION_URL` uses the **direct** owner host (no
   `-pooler`). Confirm both target the same database and different usernames
   without printing passwords.
3. Run the governance check. A pending migration makes
   `migrationJournalComplete` false; every other field must already be true.
4. Run the migration. It refuses missing credentials or the same username for
   runtime and migration roles.
5. Run the governance check again. Every boolean must be true and the
   expected/recorded migration counts must match. **This is the only reliable
   success signal** — see the drizzle-kit trap below.
6. Deploy the application with only the restricted `DATABASE_URL`, then verify
   `/api/health` and one owner-scoped read/write/delete journey.

Steps 3–5 from the operator shell (`FILE` is the private env file):

```bash
export NODE_OPTIONS=--network-family-autoselection-attempt-timeout=5000
node --env-file=FILE scripts/check-db-governance.mjs
PAL_DB_ENV=production node --env-file=FILE node_modules/drizzle-kit/bin.cjs migrate
node --env-file=FILE scripts/check-db-governance.mjs
rm FILE
```

### Operator traps (learned 2026-09-17, migration 0019)

- **Connections time out from a slow link.** Node 24 gives each resolved
  address 250 ms before trying the next. When the link to Neon is slower (and
  IPv6 has no route), every connect fails with `AggregateError` / `ETIMEDOUT`
  and an empty message, although `bash -c '</dev/tcp/<host>/5432'` connects.
  Set `NODE_OPTIONS=--network-family-autoselection-attempt-timeout=5000` for
  every database command, or call
  `net.setDefaultAutoSelectFamilyAttemptTimeout(5000)` in a script.
- **`drizzle-kit migrate` (0.31.x) never prints its error.** The spinner shows
  "applying migrations..." and the process exits 1 with no message. Treat any
  non-zero exit as a failure. Retrying is safe: pending migrations commit in one
  transaction, so a failed run commits nothing. To see the real error, connect
  with a small `pg` script that redacts `user:pass@` before printing anything.
- **Never print a raw `pg` error.** A value that has lost its `postgresql:`
  scheme (starts with `//`) is parsed as a Unix-socket path, and the resulting
  `EINVAL` message contains the whole URL, password included.
- **Never `source` or `.` an env file that holds a URL.** An unquoted `&` in
  `?sslmode=require&channel_binding=require` turns each line into a background
  job; bash then prints `[1] Done DATABASE_URL=…` with the full value, and the
  variables end up unset anyway. Use `node --env-file`. This leaked a password
  on 2026-08-10 and again on 2026-09-17.
- **Never `cat` a credential file.** Check its shape only: key names, scheme,
  username, host, password length.
- **Pooled vs direct.** The runtime `DATABASE_URL` uses the `-pooler` host.
  Migrations, backups (`DB_BACKUP_URL`) and the governance check's migration
  URL use the direct host.

## Rotating a password

Rotate immediately if a password is ever printed to a terminal, log or
transcript.

**Runtime role (`prediabetespal_app`)** — created in SQL, so SQL can rotate it.
Order chosen to keep the gap to seconds:

1. Generate a password (`openssl rand -hex 24`) and build the new **pooled**
   URL in a private file.
2. `vercel env update DATABASE_URL production --sensitive --yes < FILE`
   (stdin keeps the value out of the process list).
3. `vercel redeploy <current production deployment URL> --target production`
   — not `vercel --prod`, which ships the local checkout.
4. Once the redeploy is Ready, as `neondb_owner`:
   `ALTER ROLE prediabetespal_app WITH PASSWORD '<generated>';`
5. Verify: the new URL logs in, the old one is rejected (`28P01`), and
   `/api/health` reports `db:"ok"` several times over 30 s (the pool's idle
   timeout is 10 s, so this probes fresh connections). Delete the file.

**Owner role (`neondb_owner`)** — console-managed. Reset its password in the
**Neon console** (the role's "Reset password" action), not with SQL — Neon
manages this role and its role sync can revert an SQL `ALTER ROLE`. Then, in
the same sitting:

1. Update the GitHub secret `DB_BACKUP_URL` with the new **direct** owner URL,
   or the nightly `db-backup.yml` fails.
2. Run `db-backup.yml` manually (workflow_dispatch) and confirm it succeeds.
3. The Vercel Neon integration's `NEON_*` variables and any local `.env.local`
   `NEON_*` lines still hold the old password. No tracked code reads them;
   refresh or remove them.

## Connection budget

Each Vercel instance defaults to at most three connections, with a five-second
connect timeout and ten-second idle timeout. `DATABASE_POOL_MAX` accepts only
`1..10`. Keep it at three until provider metrics show a reason to change it.

Record peak active connections, Neon's connection limit, and the maximum
simultaneous Vercel instances. If `instances × pool max` can approach 70% of the
provider limit, introduce a transaction pooler and repeat the full billing,
auth, and `FOR UPDATE` inbox tests against it; do not simply raise the pool cap.

## Evidence boundary

Checked-in migrations and passing PGlite tests prove source consistency only.
Launch evidence requires the post-migration governance check against the exact
production database plus provider backup/restore proof. Never put database URLs,
role names, query output containing user rows, or passwords in a handoff.

## Store inventory (NEW-002 / OA-4)

Production runs against exactly ONE Postgres store — the Neon database the
deployed `DATABASE_URL` binds. A second provisioned store, `Postgres-FOMu`,
was found during the 2026-07 service-integrations audit holding **7 billing
inbox rows and nothing else** (V013): an artifact of an earlier binding, not a
live dependency.

Status: **OA-4 CLOSED (Option A, 2026-07-24, owner-authorized).** The full
contents were exported to the owner's local backup
(`~/revora-backups/postgres-fomu-export-2026-07-24.json`), the 7
`billing_event_inbox` rows plus 1 `email_suppressions` row were migrated into
the live store with conflict-safe inserts (0 duplicates; 2 email-delivery log
rows and 1 cron heartbeat were export-only), and the `Postgres-FOMu` service
was deleted from the Neon project. Production now runs against exactly one
store, verified healthy post-deletion.
