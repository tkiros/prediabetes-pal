# Outstanding — ordered checklist (2026-08-10, second revision)

> **Current session handoff:**
> `docs/handoff/2026-08-10-revora-name-removal-session-handoff.md` — read it
> first. It has the two blockers, the safety regression, and the traps.

## ✅ #79 is merged — `e62a651`, deployed, verified

The internal `revora` → `pal` rename landed on 2026-08-10 with **zero env
changes**, on the strength of the fallback described in item 1 below.

Verified, not assumed: `app/api/health/route.ts:68` calls `getPalEnv()`, which
calls `resolveModelTransportConfig()` and reports `issues:["model_configuration"]`
when the model id and `OPENAI_BASE_URL` disagree. Production on the merge SHA
reports `issues:[]`, so the pair is coherent — the fallback is being read, or
`PAL_MODEL` was already fine. Either way there is no outage and no silent
downgrade.

⚠️ **That proves the TEXT path only.** `getPalEnv()` never reaches
`lib/meal/photo-extract.ts` or `lib/pantry/extract.ts`, which run their own
`assertModelIdMatchesTransport()` against a model now sourced from
`REVORA_VISION_MODEL`. If that variable's prefix state disagrees with
`OPENAI_BASE_URL`, meal-photo and Pantry extraction throw while `/api/health`
stays `issues:[]`. Almost certainly fine — the text path proved coherent and
this repo's own rule keeps the two ids in lockstep — but **unverified**.
Discriminate with one meal-photo upload, or grep Sentry for
`PalModelConfigurationError` since `e62a651`. Not a regression introduced here:
pre-merge the vision path used the unprefixed default and was exposed to the
mirror-image failure.

### ⚠️ Two traps armed in the working tree

1. **`local/main-latest` is behind `origin/main`** and its working tree still
   carries `tests/unit/revora/claims-boundary-copy.test.ts` — one of the four
   uncommitted owner-gated files, at a path **#79 deleted**. Fast-forwarding
   that branch hits a delete/modify conflict, and resolving it carelessly
   resurrects a stale duplicate next to `tests/unit/pal/claims-boundary-copy.test.ts`.
   Decide the file's fate (its provenance was never confirmed) before updating
   the branch — do not resolve the conflict on autopilot.
2. **The Google Fonts flake reaches GitHub Actions too.** The handoff says it is
   Vercel-only and that "the Actions `build` job passes the same commit every
   time." That is false: run `31448588601` failed
   `typecheck · lint · contract · build` with 21 × `Can't resolve
   '@vercel/turbopack-next/internal/font/google/font'` on **#83, a docs-only
   PR**. A rerun went green with no code change. Rerun, do not debug — but stop
   treating a green Actions build as evidence that a red Vercel build is a real
   fault. This also upgrades the `next/font/local` self-hosting item from
   nice-to-have to "every PR is a coin flip."

**Corrected:** the previous revision listed the Vercel project rename as
needing a same-PR code change because `revora-git-main.vercel.app` is asserted
in `tests/unit/pal/sw-dev-teardown.test.ts` and named in `.gitleaks.toml:15`.
Both are wrong. The test asserts that host is **not** local dev — a hardcoded
example string that keeps returning `false` whatever the project is called.
The `.gitleaks.toml` mention is inside a historical comment about a 2026-07
commit, not a live config value. A repo-wide grep for `revora-git` /
`vercel.app` outside `docs/` returns exactly that one test line. **Renaming
the Vercel project breaks no code.**

---

## 🔴 Blocked on the owner — nothing else is

1. **Vercel env** (values are encrypted → dashboard, not CLI):
   add `PAL_MODEL` and `PAL_VISION_MODEL` copied from the `REVORA_*` pair;
   set `NEXT_PUBLIC_APP_URL=https://prediabetespal.com`; **delete**
   `LEGAL_ENTITY_NAME`.
   ✅ **Did not gate #79** — it merged without them. `activeModelId()` and both vision extractors now
   read `REVORA_MODEL` / `REVORA_VISION_MODEL` as a fallback, so the merge is
   safe with production env untouched. The earlier note said an early merge
   would "silently downgrade the model" — that understated it: with
   `OPENAI_BASE_URL` on OpenRouter, the unprefixed default fails
   `assertModelIdMatchesTransport`, which is an outage on `/api/check`, not a
   quiet swap.
   The same fallback covers `REVORA_REASONING_EFFORT` and
   `REVORA_DAILY_CHECK_CAP` — both are optional with code defaults, but losing
   a tightened daily cap silently restores 2000 checks/24h, which is spend.
   The other renamed `REVORA_*` vars are dev/test/CLI only
   (`LAUNCH_MODE_OVERRIDE` is ignored in production by design,
   `LIVE_EVAL`/`MODEL_MINI`/`MODEL_NANO`/`DB_ENV`/`ALLOW_NO_MEASUREMENT`/
   `ENFORCE_COMPONENT_MENTION` are not production-set) — no fallback added.
   ⛔ **Delete the fallback** (`lib/pal/openai-client.ts` ×2,
   `lib/pal/rate-limit.ts`, `lib/meal/photo-extract.ts`,
   `lib/pantry/extract.ts`, plus the two cases in
   `tests/unit/pal/openai-client.test.ts`) once the `PAL_*` vars exist in
   Vercel production — otherwise it is permanent and `REVORA_MODEL` never gets
   removed.
   `NEXT_PUBLIC_APP_URL` is still wrong and independent of #79: the landing's
   `<link rel="canonical">` emits `revora.plus` while
   `/.well-known/security.txt` already emits `prediabetespal.com`.
2. **Database role** (Stage D) — the agent cannot read `DATABASE_URL`, so it
   cannot reach Neon. Steps in the handoff §5.

---

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
| `/api/health` | ✅ `ok:true`, all 5 crons `ok` |
| Site routes | ✅ `/`, `/check`, `/signin` all 200 |
| Rename | ✅ **merged** — #71 `899ea38`, #73 `6d5ef95`; landing has zero `Revora` |
| `revora.plus` | ✅ serving · no MX, but `support@` is no longer rendered from it |
| `prediabetespal.com` | ✅ apex + `www` serve **200** over TLS |
| Resend | ✅ `contact.prediabetespal.com` **verified** |
| Railway | ⚠️ expired, now unused — safe to delete |
| Still `Revora` in prod | ⚠️ `NEXT_PUBLIC_APP_URL` (canonical tag), `LEGAL_ENTITY_NAME` (Terms/Privacy) — §4 |

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

## 4. Rename cutover — ✅ MERGED 2026-08-10, two env items left

**#71 merged (`899ea38`), #73 merged (`6d5ef95`).** Production serves
Prediabetes Pal: zero `Revora` on the landing, privacy heading renamed,
`support@prediabetespal.com` rendered, `/api/health` `ok:true` with all five
crons green.

The `APP_URL` change landed with it and was **verified for real** — a manual
`hourly-crons` dispatch on `6d5ef95` ran with `APP_URL: https://prediabetespal.com`
and returned `result=ok http_status=200` on all four jobs plus
`bai-weekly {"ok":true}`. `validateCronConfig()` did not throw.

One defect surfaced in CI and was fixed (`95f3d3a`): the privacy page heading
had been renamed but `tests/smoke/a11y.spec.ts` still asserted the old copy,
failing on all four browser projects. Everything else matching `revora` in
`tests/smoke` is storage keys and stub dirs — deliberately retained.

### 🔴 Remaining — owner only, the agent is blocked on production env writes

Order matters. The 301 **must** come last.

```bash
# 1. Canonical URL — <link rel="canonical"> still emits https://revora.plus
printf 'https://prediabetespal.com' > /tmp/u
vercel env rm NEXT_PUBLIC_APP_URL production --yes
vercel env add NEXT_PUBLIC_APP_URL production < /tmp/u
rm /tmp/u

# 2. Legal entity — Terms and Privacy still render "Revora"
printf 'Prediabetes Pal' > /tmp/l     # or the registered entity, if different
vercel env rm LEGAL_ENTITY_NAME production --yes
vercel env add LEGAL_ENTITY_NAME production < /tmp/l
rm /tmp/l

# 3. Env vars bind at deploy time
vercel redeploy https://prediabetespal.com

# 4. Verify a REAL signin end-to-end before step 5
```

5. 🔴 **Only then** 301 `revora.plus` → `prediabetespal.com` (Vercel → Project →
   Domains → `revora.plus` → Redirect). Redirecting the old host while URLs are
   still built from it is the same shape of failure as the `AUTH_EMAIL_FROM`
   outage. **Keep `revora.plus` registered** — it carries every link already
   posted in FB groups and DMs.
6. 🟢 Re-run the marketing capture (landing copy changed).

`support@revora.plus`'s missing MX (§2) is now moot — production renders
`support@prediabetespal.com`, already verified delivering.

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
  `tests/unit/pal/claims-boundary-copy.test.ts` (the `posts.json` scan hunk).
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
