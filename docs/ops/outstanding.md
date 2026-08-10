# Outstanding — ordered checklist (2026-08-10)

State of the world after the Railway outage and the rename work. Detail lives in
`docs/runbooks/incident-2026-08-10-database-outage.md` and
`docs/ops/rename-cutover-runbook.md`; this is the ordered index.

**Legend:** 🔴 owner only · 🟡 owner unblocks, then automatable · 🟢 automatable now

## Current state

| Thing | State |
|---|---|
| Database | ✅ Neon Free, `db:"ok"`, 22 tables, governance green |
| `/api/health` | ❌ **503** — all 5 crons read `never` |
| Site routes | ✅ `/`, `/check`, `/signin` all 200 |
| `revora.plus` | ✅ serving (A `216.198.79.1`) · ❌ no MX, `support@` bounces |
| `prediabetespal.com` | ❌ still Namecheap parking (A `192.64.119.172`), no TLS · ❌ no MX |
| Resend | ✅ `contact.prediabetespal.com` **verified** |
| Railway | ⚠️ expired, now unused — safe to delete |
| Branches | all **unpushed**: `rename/prediabetes-pal` (+16), `ops/hourly-crons-github-actions` (+1) |

---

## 1. 🟡 Get `/api/health` green — crons

Production reports degraded until something writes cron heartbeats; the
staleness window is 2h so it will not self-heal.

1. 🔴 GitHub → Settings → Secrets → Actions → add **`CRON_SECRET`**, same value
   as Vercel production.
2. 🟢 Push `ops/hourly-crons-github-actions` and open a PR (rebased onto
   `origin/main`, +1/−0, adds one file).
3. 🔴 Merge it. Scheduled workflows only run from the default branch.
4. 🟢 Actions → **hourly-crons** → *Run workflow* (don't wait an hour).
5. 🟢 `curl -s https://revora.plus/api/health` → expect `"ok":true`.

## 2. 🔴 Fix `support@` — both domains bounce

Adding Resend's `send.contact` MX flipped Namecheap out of Email Forwarding
mode and dropped `eforward1-5` on both apexes (confirmed n=2,
`rename-cutover-runbook.md` §2.3).

Move DNS for both domains to **Cloudflare** (free; registrar stays Namecheap),
which supports arbitrary custom MX *and* Email Routing. Re-add:
- the Resend records (`send.contact` MX/TXT, `resend._domainkey.contact` TXT)
- the Vercel A record
- Email Routing for `support@`

Confirm with a **delivered test message**, not by inspecting records.

## 3. 🔴 Point `prediabetespal.com` at Vercel

At Namecheap, replace the parking A record:

| Type | Host | Value |
|---|---|---|
| A | `@` | `216.198.79.1` |
| CNAME | `www` | `cname.vercel-dns.com` |

⛔ Do **not** accept Vercel's offer to take over nameservers. Vercel then issues
TLS automatically. Required before step 4 — the crons must reach this host.

## 4. Rename cutover

Order is load-bearing.

1. 🔴 Merge **PR #71** (`seo/about-page-and-canonicals`) first — the rename
   branch is built on it and rewrites the same landing.
2. 🟢 In the **same change** as the rename merge, update
   `.github/workflows/hourly-crons.yml` → `APP_URL: https://prediabetespal.com`.
   `validateCronConfig()` compares it byte-for-byte against `CANONICAL_APP_URL`
   and throws `invalid_app_url` otherwise, killing all four jobs.
3. 🟢 Push `rename/prediabetes-pal`, open PR, re-run gates.
4. 🔴 Merge.
5. 🔴 Vercel → set `NEXT_PUBLIC_APP_URL` = `https://prediabetespal.com`, redeploy.
6. 🔴 301 `revora.plus` → `prediabetespal.com`. **Keep `revora.plus` registered** —
   it carries every link already posted in FB groups and DMs.
7. 🟢 Re-run the marketing capture (landing copy changed).

## 5. 🔴 Backups

There was no backup, which is what made the outage dangerous. Neon Free
includes point-in-time restore with a short retention window — check the
retention and decide whether it is enough, or add a scheduled `pg_dump`.
Do this while the database is empty and it is cheap to think about.

## 6. 🔴 Decommission Railway

Nothing depends on it once step 1 lands. Delete the project, then delete
`.railway/railway.ts` and `Dockerfile.cron` rather than maintaining dead config.

---

## Smaller / deferred

- **3 uncommitted owner-gated files** — `docs/legal/counsel-brief.md`,
  `scripts/capture-marketing-shots.mjs`,
  `tests/unit/revora/claims-boundary-copy.test.ts` (the `posts.json` scan hunk).
  Provenance was never confirmed; still uncommitted by design.
- **`LEGAL_ENTITY_NAME`** in Vercel still reads `Revora` and renders in Terms
  and Privacy. Env change, arguably a legal decision.
- **Counsel item N6** — re-approval of renamed copy-ledger rows, including the
  shortened `high-range-route`.
- **Dangling "counsel Q8"** — `PRODUCT.md:23` and `copy-ledger.md:97` gate the
  reversal line on a Q8 that does not exist. Pre-existing; do not invent one.
- **`prediapal.com`** unregistered by choice — fallback name unprotected.
- **4 open Dependabot PRs** (#67, #68, #69, #38) — untouched.
- **`revora.bio`** listed in Vercel but RDAP 404s — stale team entry.
- **Manifest `short_name`** is now 15 chars and may truncate on some Android
  launchers.
