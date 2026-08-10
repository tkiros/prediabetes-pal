# Railway outage → Neon · login restored · rename staged · session handoff

**Date:** 2026-08-10
**Branch at handoff:** `rename/prediabetes-pal` @ **`73542b7`** · ⚠️ 3 tracked files uncommitted
**Production:** ✅ **HEALTHY** — `/api/health` → `{"ok":true,"status":"healthy","issues":[]}`

> The previous handoff (`2026-08-09-rename-revora-to-prediabetes-pal-session-handoff.md`)
> is **superseded in three places**. Where they disagree, this file wins. See §6.

---

## 0. Where things live

| | |
|---|---|
| **Ordered checklist** | `docs/ops/outstanding.md` — the living index. Start here. |
| **Outage record** | `docs/runbooks/incident-2026-08-10-database-outage.md` |
| **Rename runbook** | `docs/ops/rename-cutover-runbook.md` — DNS, Resend, merge order |
| **Naming decision** | `docs/naming-decision-shortlist.md` — why Prediabetes Pal |
| **DB governance** | `docs/runbooks/database-governance.md` — ⚠️ says migration head is `0017`; it is **`0018`** |

⚠️ `cd X && cmd` does not persist cwd here. Use absolute paths.
⚠️ `main` is checked out in a worktree (`.claude/worktrees/counsel-gate-candidate`),
so `git checkout main` **fails**. Branch from `origin/main` instead.

---

## 1. What happened, in one paragraph

The Railway account expired and took **the production Postgres database** with it —
not just the cron runner. `/api/health` returned 503 `database_unavailable`, and
because `@auth/drizzle-adapter` writes sessions to Postgres, nobody could sign in.
There was **no backup** (only a 7-row JSON export from July). The owner confirmed
zero customers and zero Stripe records, so the database was rebuilt fresh on Neon
from the 19 checked-in migrations rather than recovered. Along the way a **second,
hidden outage** surfaced: `contact.revora.plus` had been deleted from Resend during
the rename's hard cutover, so *every magic link was 403ing* — production could not
send mail at all. Both are fixed and verified.

---

## 2. What was fixed — with the evidence, not just the claim

| Was broken | Fix | Verified by |
|---|---|---|
| **Database gone** | Neon Free (`free_v3`), 19 migrations, 22 tables | `db:"ok"`; governance check all-true, 19/19 |
| **Login — every magic link 403'd** | `AUTH_EMAIL_FROM` → `Prediabetes Pal <signin@contact.prediabetespal.com>` + redeploy | real signin POST → `302 verify-request`, **and a row in `verification_tokens`** |
| **`support@` bounced** | Cloudflare Email Routing on `prediabetespal.com` | live Resend send → `last_event: delivered` |
| **Crons never ran** | GitHub Actions (**#72**) + bai-weekly recovery (**#77**) | all 5 heartbeats `ok` |
| **Domain not serving** | grey-cloud the apex; **add `www` to the Vercel project** | apex + `www` both **200** over TLS |
| **`CRON_SECRET` unreadable** | rotated in Vercel **and** GitHub together | workflow runs succeed |
| Rename mangled a repo slug | `7840b20` restored `github("tkiros/Revora")` | it is an identifier, not copy |

### Database specifics (needed to operate it)

- Neon project **`dry-shadow-56131409`**, resource name **`revora-db`**, region `us-east-1`, plan **Free**.
- Connected with **`--prefix NEON_`** so the integration's vars never collided with `DATABASE_URL`.
- Owner role `neondb_owner`, database `neondb`. Runtime role **`revora_app`** with 9 grant/revoke
  statements per `database-governance.md`.
- Production `DATABASE_URL` = **pooled** `revora_app` URL.
  ⛔ `DATABASE_MIGRATION_URL` is **deliberately NOT in Vercel** — operator-only.
- Migration head **`0018_accounts-expires-at-integer`**, 19 journal entries.

---

## 3. Current state

### Production
```
/api/health → {"ok":true,"status":"healthy","issues":[],"db":"ok",
  "crons":{"nudge":"ok","baiWeekly":"ok","trialPrecharge":"ok",
           "pantrySweep":"ok","stripeReconcile":"ok"}}
```

### DNS / TLS

| Host | State |
|---|---|
| `prediabetespal.com` | ✅ Cloudflare NS · apex `A 216.198.79.1` (**grey cloud**) · **200** |
| `www.prediabetespal.com` | ✅ `CNAME cname.vercel-dns.com` · **200** |
| mail on `prediabetespal.com` | ✅ 3× `route*.mx.cloudflare.net` · SPF · DMARC `p=none` |
| Resend `contact.prediabetespal.com` | ✅ **verified** (DKIM + `send.contact` MX/TXT live) |
| `revora.plus` | ✅ serves **200** · ❌ **no MX — `support@revora.plus` bounces** |

### Git

| Branch / PR | State |
|---|---|
| `origin/main` @ `85d9f70` | has **#72** + **#77** (the cron workflow) |
| **#71** `seo/about-page-and-canonicals` (+8) | open, mergeable — **merge first** |
| **#73** `rename/prediabetes-pal` (+19) | **draft**, base = `seo/about-page-and-canonicals` |
| #74 #75 #76 + older | Dependabot, untouched |
| Uncommitted (3 files) | `docs/legal/counsel-brief.md`, `scripts/capture-marketing-shots.mjs`, `tests/unit/revora/claims-boundary-copy.test.ts` (the `posts.json` scan hunk) — provenance never confirmed, left by design |

---

## 4. 🆕 THE TASK — the rename cutover

**Every technical blocker is cleared.** What remains is the decision to ship a public
rebrand. Order is load-bearing.

1. **Merge #71 first.** The rename is built on it and rewrites the same landing.
2. **Bring `main` into `rename/prediabetes-pal`**, and in the **same commit** change
   `.github/workflows/hourly-crons.yml` → `APP_URL: https://prediabetespal.com`.
   ⛔ `validateCronConfig()` compares `APP_URL` **byte-for-byte** against
   `CANONICAL_APP_URL` in `scripts/run-hourly-crons.mjs` and throws
   `invalid_app_url`, killing **all four** hourly jobs (including `stripe-reconcile`,
   the missed-webhook backstop). This was deliberately NOT done yet — doing it before
   #71 lands only creates conflict noise.
3. Undraft **#73**, re-run gates, merge.
4. 🔴 Vercel: `NEXT_PUBLIC_APP_URL` → `https://prediabetespal.com`, redeploy.
5. 🔴 301 `revora.plus` → `prediabetespal.com`. **Keep `revora.plus` registered** — it
   carries every link already posted in FB groups and DMs.
6. Re-run the marketing capture (landing copy changed).

### Gates before the PR
```
npm run typecheck && npm run test && npm run lint && npm run contract
npx vitest run tests/unit/revora/claims-boundary-copy.test.ts   # 146 tests
```
⚠️ Do **not** add a carve-out to make the claims test pass — the previous carve-out
mechanism was deleted deliberately (F-25).

---

## 5. ⛔ Traps — each of these already cost time once

1. **Namecheap wipes sibling MX.** Adding a custom MX flips the zone out of Email
   Forwarding mode and drops `eforward1-5` **wholesale**. Confirmed n=2 — it killed
   `support@` on *both* domains. This is why DNS moved to Cloudflare, which has no
   such mode selector. **Never re-enable Namecheap Email Forwarding on `revora.plus`**
   while `contact.revora.plus` records exist.
2. **Resend's aggregate `status` is not a gate.** `contact.revora.plus` read
   `partially_failed` for weeks while happily sending — the only failed record was the
   *optional inbound* MX. Gate on the three sending records instead.
3. **`vercel env pull` returns `""` for Sensitive vars.** `CRON_SECRET`,
   `AUTH_EMAIL_FROM`, `NEXT_PUBLIC_APP_URL`, `SUPPORT_EMAIL` are all unreadable —
   they can only be **rotated**, never recovered. Do not waste time trying to read them.
4. **DNS alone will not issue a Vercel certificate.** `www` resolved correctly for
   ~40 minutes with no cert because it had never been **added to the Vercel project**.
5. **Never run `vercel --prod` from a feature branch** — it would ship the unmerged
   rename to production. Use `vercel redeploy <production-url>` to pick up env changes.
6. **The agent cannot mutate production env vars.** The permission classifier blocks
   `vercel env rm/add` on production (it blocked both the `CRON_SECRET` rotation and
   the `AUTH_EMAIL_FROM` fix). The owner must run those; hand them the exact commands.
7. **`.github/workflows/**` pushes need the `workflow` OAuth scope.** Already granted
   via `gh auth refresh -s workflow`, but a fresh machine will hit this again.
8. **Do not rename internals.** `REVORA_*` env vars, `lib/revora/`, `tests/unit/revora/`,
   npm scripts, `x-revora-*` headers, storage keys, TWA `packageId`, `docs/handoff/**`.
   `CLAUDE.md` records why. The bulk rename already broke a repo slug once.

### ⚠️ Credential note
A `revora_app` password was echoed into a session transcript (an unquoted `&` in the
connection string made bash print it). It was **rotated immediately** and the leaked
value never reached Vercel or any deployment. Production holds the post-rotation
credential. No action needed.

---

## 6. Where the 2026-08-09 handoff is now wrong

| It said | Truth |
|---|---|
| "The old domain keeps working while the new one verifies — these overlap safely" | **Resend Free allows exactly 1 domain.** Overlap was impossible; the owner chose a hard cutover, which is what caused the magic-link outage. |
| "wait for green" on Resend | The aggregate status is unusable as a gate — see §5.2. |
| "`revora.plus`'s MX is Namecheap forwarding" | It has **no MX at all**. See §5.1. |

Also: `docs/runbooks/database-governance.md` still says the migration head is `0017`
and describes `DATABASE_MIGRATION_URL` as "the Railway owner credential". Both are
stale — it is `0018`, and the database is Neon.

---

## 7. Deferred / open

- 🔴 **Backups.** Neon Free includes point-in-time restore with a short retention
  window — confirm it is enough or add a scheduled `pg_dump`. **The absence of any
  backup is what made this outage dangerous.** Do it while the DB is still empty.
- 🔴 **Decommission Railway.** Nothing depends on it. Delete the project, then delete
  `.railway/railway.ts` and `Dockerfile.cron` rather than maintaining dead config.
- 🔴 **`support@revora.plus`** — no MX. Moot once the rename ships; until then it is
  the address production actually renders in Terms, Privacy and `security.txt`.
- 🔴 **`LEGAL_ENTITY_NAME`** in Vercel still reads `Revora`; it renders in Terms and
  Privacy. Env change, arguably a legal decision.
- 🔴 **Counsel item N6** — re-approval of renamed copy-ledger rows, including the
  shortened `high-range-route` (the longer name pushed it past the 280-char cap;
  second mention → "It"). Professional review was waived for budget.
- ⚠️ **Dangling "counsel Q8"** — `PRODUCT.md:23` and `copy-ledger.md:97` gate the
  reversal line on a Q8 that does not exist. Pre-existing. **Do not invent one.**
- **`prediapal.com` unregistered** by owner choice — the fallback name is unprotected
  if Play rejects `PrediabetesPal` over the DiabetesPal conflict.
- **Dependabot PRs** #74 #75 #76 #67 #68 #69 #38 #37 — untouched.
- **`revora.bio`** listed in Vercel but RDAP 404s — stale team entry, cosmetic.
- **Manifest `short_name`** is now 15 chars and may truncate on some Android launchers.
- ⛔ **Do not publish to Play.** `packageId app.revora.twa` is immutable once published.

---

## 8. First five minutes in a new session

```bash
curl -s https://revora.plus/api/health          # expect ok:true
gh pr list --state open                          # #71 then #73
git -C /home/tefera/Desktop/Revora status --short
```
Then read `docs/ops/outstanding.md`. If production is not `ok:true`, read
`docs/runbooks/incident-2026-08-10-database-outage.md` before changing anything.
