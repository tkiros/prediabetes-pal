# Outstanding — ordered checklist (2026-08-10)

## ✅ RESOLVED 2026-08-10 — production is healthy

```
/api/health → {"ok":true,"status":"healthy","issues":[],"db":"ok",
  "crons":{"nudge":"ok","baiWeekly":"ok","trialPrecharge":"ok",
           "pantrySweep":"ok","stripeReconcile":"ok"}}
```

| Was broken | Fix | Verified by |
|---|---|---|
| Database gone (Railway expiry) | Neon Free, 19 migrations, `revora_app` role | `db:"ok"`, 22 tables, governance green |
| **Login — magic links 403'd** | `AUTH_EMAIL_FROM` → `signin@contact.prediabetespal.com` + redeploy | real signin POST → 302 `verify-request`, **verification token written to DB** |
| `support@` bounced | Cloudflare Email Routing | live Resend send → `last_event: delivered` |
| Crons never ran | GitHub Actions (#72) + bai-weekly recovery (#77) | all 5 heartbeats `ok` |
| `prediabetespal.com` not serving | grey-cloud the apex; add `www` to the Vercel project | both return **200** over TLS |
| `CRON_SECRET` unreadable | rotated in Vercel + GitHub together | workflow runs succeed |

Everything below §0 is either done or deliberately deferred.

---

## ~~0. LOGIN IS DOWN~~ — FIXED (record retained)

**Verified 2026-08-10.** `contact.revora.plus` was deleted from Resend during
the hard cutover, but production still sends from it:

```
POST /emails  from: Revora <signin@contact.revora.plus>
→ 403 "The contact.revora.plus domain is not verified."
```

`AUTH_EMAIL_FROM` was last modified **20 days ago** — before
`prediabetespal.com` was registered (2026-08-09) — so it cannot reference the
new domain. Every magic link fails. On a passwordless product that is a total
login and signup outage. Existing sessions are unaffected.

This is exactly what the 2026-08-09 handoff §3.1 warned about; the domains
could not overlap because Resend Free allows only one.

**Fix — one variable, then redeploy** (blocked for the agent by the
production-env classifier, so the owner must run it):

```bash
printf 'Prediabetes Pal <signin@contact.prediabetespal.com>' > /tmp/from
vercel env rm AUTH_EMAIL_FROM production --yes
vercel env add AUTH_EMAIL_FROM production < /tmp/from
rm /tmp/from
vercel redeploy https://revora.plus     # required — env vars bind at deploy
```

Sending from the new domain is already proven working: a live Resend send from
`signin@contact.prediabetespal.com` reached `support@prediabetespal.com` with
`last_event: delivered`.

The brand mismatch (site says Revora, email says Prediabetes Pal) is temporary
and strictly better than no login. **Alternatively, merge the rename** — every
blocker on it is now cleared, and it fixes the sender as a side effect.


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

## ~~1. Get `/api/health` green — crons~~ ✅ DONE

Merged as **#72** (hourly runner) and **#77** (manual-only bai-weekly
recovery). `bai-weekly` is a Vercel cron with an 8-day staleness window; it
fired at 04:30 on 2026-08-10 against the dead Railway database and would not
have retried until 2026-08-17, so #77 added the lever to recover it by hand.
Original plan retained below.

<details><summary>original steps</summary>

### (superseded)

Production reports degraded until something writes cron heartbeats; the
staleness window is 2h so it will not self-heal.

1. 🔴 GitHub → Settings → Secrets → Actions → add **`CRON_SECRET`**, same value
   as Vercel production.
2. 🟢 Push `ops/hourly-crons-github-actions` and open a PR (rebased onto
   `origin/main`, +1/−0, adds one file).
3. 🔴 Merge it. Scheduled workflows only run from the default branch.
4. 🟢 Actions → **hourly-crons** → *Run workflow* (don't wait an hour).
5. 🟢 `curl -s https://revora.plus/api/health` → expect `"ok":true`.

</details>

## 2. 🔴 `support@` — done on the new domain, still dead on `revora.plus`

`support@prediabetespal.com` **works** (Cloudflare Email Routing; verified by a
real Resend send reaching it). `support@revora.plus` still has no MX — that
domain is still on Namecheap nameservers. It matters only until the rename
merges, since production currently renders the `revora.plus` address in Terms,
Privacy and `security.txt`. Moving it to Cloudflare too is the fix; do not
re-enable Namecheap Email Forwarding, which is what wiped the records twice.

<details><summary>original instructions</summary>

Adding Resend's `send.contact` MX flipped Namecheap out of Email Forwarding
mode and dropped `eforward1-5` on both apexes (confirmed n=2,
`rename-cutover-runbook.md` §2.3).

Move DNS for both domains to **Cloudflare** (free; registrar stays Namecheap),
which supports arbitrary custom MX *and* Email Routing. Re-add:
- the Resend records (`send.contact` MX/TXT, `resend._domainkey.contact` TXT)
- the Vercel A record
- Email Routing for `support@`

Confirm with a **delivered test message**, not by inspecting records.

</details>

## ~~3. Point `prediabetespal.com` at Vercel~~ ✅ DONE

Apex `A → 216.198.79.1` (grey cloud), `www → cname.vercel-dns.com`. Both serve
**200** over TLS. `www` needed adding to the Vercel project before a
certificate would issue — DNS alone was not enough.

<details><summary>original instructions</summary>

At Namecheap, replace the parking A record:

| Type | Host | Value |
|---|---|---|
| A | `@` | `216.198.79.1` |
| CNAME | `www` | `cname.vercel-dns.com` |

⛔ Do **not** accept Vercel's offer to take over nameservers. Vercel then issues
TLS automatically. Required before step 4 — the crons must reach this host.

</details>

## 4. Rename cutover — the only substantial work left

Every technical blocker is cleared. What remains is a deliberate product
decision (shipping a public rebrand), not a defect.

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
