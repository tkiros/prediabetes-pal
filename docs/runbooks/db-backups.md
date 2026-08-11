# Database backups

Nightly logical backups of the production Neon database, on top of Neon's own
(short) Free-tier PITR window. Running since 2026-08-11 via
`.github/workflows/db-backup.yml` (daily 06:17 UTC + `workflow_dispatch`).

## What exists

- `pg_dump --format=custom --no-owner` over the **unpooled** owner URL.
- Encrypted on the runner with AES-256-CBC (PBKDF2) before leaving it — the
  repo is public and blob URLs are treated as public, so nothing readable is
  ever stored.
- Stored in the project's Vercel Blob store under rotating names, so there is
  no prune job:
  - `db-backups/daily-mon.dump.enc` … `daily-sun.dump.enc` — 7-day window
  - `db-backups/monthly-01.dump.enc` … `monthly-12.dump.enc` — written on the
    1st of each month, 12-month window

## Secrets (GitHub → repo → Settings → Secrets → Actions)

| Secret | Value |
|---|---|
| `DB_BACKUP_URL` | the unpooled `neondb_owner` connection string |
| `BACKUP_PASSPHRASE` | the encryption passphrase — **also keep a copy outside GitHub**; without it every backup is noise |
| `BLOB_READ_WRITE_TOKEN` | the project's Blob store token |

## Restore

1. Download the newest slot from the Blob store (Vercel dashboard → Storage →
   Blob → `db-backups/`).
2. Decrypt and restore (postgres client ≥ the server major):

```bash
openssl enc -d -aes-256-cbc -pbkdf2 -pass env:BACKUP_PASSPHRASE \
  -in daily-mon.dump.enc -out backup.dump
pg_restore --no-owner --dbname "$TARGET_DATABASE_URL" backup.dump
```

3. Restore into an EMPTY database (a fresh Neon branch/database), verify, then
   repoint `DATABASE_URL` — never `pg_restore --clean` straight over a live
   production database.

## Verify it's alive

The workflow fails loudly on an empty dump (both the `test -s` and the
uploader's 1KB floor). Check the Actions tab for the last `db-backup` run —
a quiet month of green is the success state; a red run is a real problem.
