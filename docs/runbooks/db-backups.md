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
| `DB_BACKUP_URL` | the unpooled **owner** connection string. ⛔ Not the app role — `pg_dump` needs rights it deliberately lacks, and the dumps would silently miss objects |
| `BACKUP_PASSPHRASE` | the encryption passphrase — see the blocking rule below |
| `BLOB_READ_WRITE_TOKEN` | the project's Blob store token |

### ⛔ Setting `BACKUP_PASSPHRASE` is a three-step move, not one

**GitHub secrets are write-only. Nobody — not the owner, not the dashboard, not
an agent — can read one back.** A passphrase that exists only inside GitHub is
already lost; every dump encrypted with it is 79KB of noise.

1. Generate it **and store it somewhere durable first** (password manager).
2. `gh secret set BACKUP_PASSPHRASE`.
3. **Prove it decrypts** (below) before calling backups done.

This is not hypothetical: on 2026-08-11 the secret was set without being
saved, the first green run produced an unreadable dump, and the passphrase had
to be rotated and the run repeated. Cheap that day because the database was
nearly empty. Not cheap later.

### Prove you can decrypt (required after any passphrase change)

Download the newest `db-backups/*.dump.enc`, then:

```bash
read -rs P && export P && openssl enc -d -aes-256-cbc -pbkdf2 -pass env:P -in backup.enc | head -c 5; echo; unset P
```

Must print **`PGDMP`** — the PostgreSQL custom-format magic header. That single
word proves the passphrase is right, the encryption round-trips, and the
plaintext is a real dump. A trailing `error writing output file` is just
`head` closing the pipe; ignore it. `bad decrypt` means the stored passphrase
is not the one the runner used.

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

## Verification history (2026-08-11 — first run)

How each link was proven, and what broke on the way:

- ✅ **Upload half proven.** `scripts/upload-db-backup.mjs` was run against the
  real Blob store with the production token, writing to a `_selftest-*` path
  (never a real rotation slot): the token works, `addRandomSuffix:false` keeps
  the exact pathname, and a second upload to the same path **overwrites**
  rather than erroring — which is the entire basis of the rotation scheme.
  The test objects were deleted afterwards.
- ✅ **Green end to end**, decryption included: run
  `31514553641` wrote `db-backups/daily-tue.dump.enc` (79,232 bytes, openssl
  `Salted__` header) and the owner decrypted it to the `PGDMP` magic header
  with the stored passphrase. That last step is the only one that proves a
  backup is a backup.
- ⚠️ **The dump half failed on its first real run.** Installing
  `postgresql-client-17` was not enough: the runner image
  ships client **16** earlier on `PATH`, and `pg_dump` refuses to dump a newer
  server (`aborting because of server version mismatch`; server 17.10 vs
  pg_dump 16.14). Fixed by invoking `/usr/lib/postgresql/17/bin/pg_dump`
  explicitly, with a `--version` line in the log as evidence.
  **Never call bare `pg_dump` in CI** — the version it resolves to is the
  image's business, not yours.
- ⚠️ **The first passphrase was unrecoverable** — set into GitHub without being
  saved anywhere else, so the first successful dump could not be opened.
  Rotated and re-run; see the blocking rule under **Secrets**.

## Verify it's alive

The workflow fails loudly on an empty dump (both the `test -s` and the
uploader's 1KB floor). Check the Actions tab for the last `db-backup` run —
a quiet month of green is the success state; a red run is a real problem.
