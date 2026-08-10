# Removing the Revora name — rename shipped, identifiers migrated, two blockers

**Date:** 2026-08-10
**Production:** ✅ `ok:true`, db `ok`, all five crons `ok`, on both hosts
**Supersedes:** `2026-08-10-railway-outage-neon-migration-login-restored-rename-staged-session-handoff.md`

---

## 0. Read this first — two things are blocked on you, nothing else is

| # | Blocker | Why it can't be automated |
|---|---|---|
| 1 | Add `PAL_MODEL` + `PAL_VISION_MODEL` in Vercel | Agent is blocked from production env writes **and** from reading them. Values are encrypted — this is copy-in-dashboard. |
| 2 | Everything in Stage D (database role) | Same block. The agent cannot read `DATABASE_URL`, so it cannot reach Neon at all. |

**PR #79 must not merge before blocker 1 is done.** Both vars have code defaults
(`gpt-5.4-mini`), so merging early does not crash — it **silently downgrades the
model**, which is harder to notice than a crash.

---

## 1. What shipped today

| PR | What | State |
|---|---|---|
| **#71** | landing v4 + `/about` + canonicals | ✅ merged `899ea38` |
| **#73** | Revora → Prediabetes Pal, user-facing | ✅ merged `6d5ef95` |
| **#78** | docs: record what went live | open |
| **#79** | `revora` → `pal` internal identifiers | 🟡 **draft — blocked on env vars** |
| **#80** | Railway decommission + governance runbook | open, CI running |

Merge order for #71/#73 was load-bearing and used **merge commits**, not squash —
#73 was built on #71's commits.

### The public rename (#73) is live and verified
Zero `Revora` on the landing; privacy heading renamed; `support@prediabetespal.com`
rendered. The `APP_URL` change was proven by a **manual `hourly-crons` dispatch on
the merge SHA** returning `result=ok http_status=200` on all four jobs — that is
`validateCronConfig()`'s byte-for-byte check firing for real. `/api/health` staying
green would not have proven it for another two hours.

---

## 2. 🔴 A live safety regression was found and fixed

`lib/pal/prompt.ts` says *"You are Prediabetes Pal's server-side food guidance
classifier."* The prompt-leak detectors in `postprocess.ts` and `eval-rubric.ts`
still matched **`you are revora`**.

For one day the guard could not fire on the exact string it exists to catch. It
shipped in #73 this morning. **2,214 tests passed throughout**, because the
pairing between the prompt and its detector was never expressed as a test.

`tests/unit/pal/prompt-leak-guard.test.ts` now reads the shipped prompt and both
shipped regexes and asserts they agree. It was **mutation-checked**: reverting the
regex fails 2 of its 7 tests.

This is the class of bug a mechanical rename creates — a string in one file that
silently must match a string in another. `CLAUDE.md` now lists all three files.

---

## 3. What "remove the Revora name" actually covered

**8,015 occurrences total.** Split, per owner decision:

- **1,650 in live code → renamed** to the `pal` prefix (#79)
- **6,365 in historical records → left alone.** A 2026-07 audit report did not
  audit "Prediabetes Pal". Rewriting it would make the paper trail false.
  Covers `docs/handoff`, `docs/archive`, `docs/audit`, `docs/qa`, `PRD`,
  `predict`, `.planning/phases`, `.planning/research`.

### ⛔ Four `revora` strings that must NEVER be "cleaned up"

1. **`tests/unit/pal/owned-domains.test.ts`** — `revora.app`, `revora.bio`,
   `revora.xyz`, `revora.com` are a **denylist of domains we do not control**.
   `revora.app` is a live unrelated company and once shipped as the real
   magic-link sender. Renaming these disarms the guard.
2. **`lib/pal/contact.ts` / `lib/server/email.ts` docstrings** — they name the
   retired domains because that history is *why* the constants exist.
3. **`tests/unit/pal/sw-dev-teardown.test.ts`** — `revora.plus` hosts are live.
4. **Historical records** — see above.

### Renamed things that surprised us
- **TWA `packageId` `app.revora.twa` → `com.prediabetespal.twa`.** The old value
  was reverse-DNS for **`revora.app`** — the other company's domain. Not yet
  published to Play, so today was the last moment it could ever change.
- **Upstash rate-limit prefixes** `revora:*` → `pal:*`. Resets counters; harmless
  at zero customers.
- **`_revora_minimized`** → `_pal_minimized`, a field inside stored Stripe billing
  payloads that `reconcile.ts` queries. Safe **only** because there are zero
  Stripe rows.

---

## 4. 🔴 Blocker 1 — Vercel env (do this first)

Values are encrypted and unreadable, so this is dashboard work, not CLI.

**Vercel → Settings → Environment Variables → Production:**

| Action | Var | Value |
|---|---|---|
| **Add** | `PAL_MODEL` | copy from `REVORA_MODEL` |
| **Add** | `PAL_VISION_MODEL` | copy from `REVORA_VISION_MODEL` |
| **Edit** | `NEXT_PUBLIC_APP_URL` | `https://prediabetespal.com` |
| **Delete** | `LEGAL_ENTITY_NAME` | code default is already "Prediabetes Pal" |

Then: undraft and merge **#79**, `vercel redeploy https://prediabetespal.com`,
and **delete** `REVORA_MODEL` + `REVORA_VISION_MODEL`.

`NEXT_PUBLIC_APP_URL` matters: the landing's `<link rel="canonical">` still emits
`https://revora.plus` while `security.txt` already emits `prediabetespal.com` —
the site currently contradicts itself about its own canonical host.

---

## 5. 🔴 Blocker 2 — Stage D, the database role

Owner chose full removal. The agent **cannot do any of this** — it cannot read
`DATABASE_URL`, so it cannot connect to Neon.

`revora_app` is embedded in `DATABASE_URL`. There is **no tolerable partial
state**: repoint before the grants exist and production loses the database.

1. Neon console → SQL editor, as `neondb_owner`. Create `prediabetespal_app` with
   a generated password and run the 9 grant/revoke statements from
   `docs/runbooks/database-governance.md` §"One-time role split", substituting
   the new role name.
2. `npm run db:governance:check` — every boolean true.
3. Vercel → `DATABASE_URL` → the **pooled** `prediabetespal_app` URL.
4. `vercel redeploy https://prediabetespal.com`.
5. Verify `/api/health` → `db:"ok"` **and a real signin end-to-end** (sessions
   live in Postgres, so a broken role is a login outage).
6. Only then `DROP ROLE revora_app;`.
7. Rename the Neon project label `revora-db` → `prediabetespal-db` (cosmetic).

⚠️ Do not echo the connection string in a shell — an unquoted `&` printed a
password into a transcript once already this week.

---

## 6. ✅ Railway is gone

Project `1b972333` deleted; `railway status` → "Project is deleted".

**The prior handoff said "nothing depends on it — safe to delete" without
recording that the project still held the pre-outage Postgres *with its volume
intact*.** That was checked before deleting and the owner confirmed the data was
worthless (zero customers, zero Stripe records). "Safe to delete" and "contains
the only copy of the old database" are different claims; the next one deserves
the same check.

#80 removes `.railway/`, `Dockerfile.cron`, two stale `.railway-config-pull-*`
dirs and the `railway` devDependency, and corrects
`database-governance.md` — which read migration head `0017` (real head:
**`0018_accounts-expires-at-integer`**, 19 entries) and called the provider
Railway, throughout the entire outage it would have been consulted for.

---

## 7. Stage C — infra names, NOT started

Deliberately deferred until #79 merges, because two of these are asserted in code.

1. **Make `prediabetespal.com` the production alias BEFORE** turning `revora.plus`
   into a redirect. `vercel project ls` still reports production as
   `https://revora.plus`; redirect it first and
   `vercel redeploy https://revora.plus` — the command in our own runbook — stops
   resolving.
2. Rename the Vercel project `revora` → `prediabetespal`. ⚠️ This changes the
   preview host `revora-git-main.vercel.app`, which is asserted in
   `tests/unit/pal/sw-dev-teardown.test.ts` and named in `.gitleaks.toml:15`.
   Same-PR lockstep.
3. Rename the GitHub repo `tkiros/Revora` → `prediabetes-pal`, then
   `git remote set-url`. GitHub redirects old URLs.
4. 301 `revora.plus` → `prediabetespal.com`, **after** a real signin is verified
   post-redeploy. **Keep the domain registered** — it carries every link already
   posted in FB groups and DMs.
5. Remove the stale `revora.bio` entry from the Vercel team (RDAP 404s).

---

## 8. Still open

- 🔴 **Backups.** Still nothing. Neon Free has short-window PITR — confirm it is
  enough or add a scheduled `pg_dump`. The absence of a backup is what made the
  outage dangerous, and the DB is still cheap to reason about.
- 🔴 **Tally waitlist form slug is literally `revora-waitlist`** — a real external
  URL, set via `NEXT_PUBLIC_WAITLIST_IOS_URL`/`ANDROID_URL`. Only the test fixture
  was renamed; the live form still carries the old name.
- 🔴 **9 Dependabot advisories (5 high)**, PRs #74 #75 #76 #67 #68 #69 #38 #36.
  Untouched — they conflict with #79 on `package.json`. Do them after it merges.
- ⚠️ **4 owner-gated files still uncommitted** in the working tree, unchanged:
  `.gitignore`, `docs/legal/counsel-brief.md`, `scripts/capture-marketing-shots.mjs`,
  `tests/unit/pal/claims-boundary-copy.test.ts`. Provenance never confirmed.
- **Counsel item N6** — re-approval of renamed copy-ledger rows.
- **Dangling "counsel Q8"** — `PRODUCT.md:23` and `copy-ledger.md:97` gate the
  reversal line on a Q8 that does not exist. Pre-existing. **Do not invent one.**
- **Manifest `short_name`** is 15 chars; may truncate on some Android launchers.
- 🟢 **Re-run the marketing capture** — landing copy changed.

---

## 9. Traps confirmed this session

1. **`gh pr edit --base` fails silently** on a deprecated-Projects GraphQL error.
   It did not retarget #73 and reported nothing useful. Use
   `gh api -X PATCH repos/OWNER/REPO/pulls/N -f base=main` and **re-read the
   result**. With `deleteBranchOnMerge: false`, GitHub never auto-retargets.
2. **`git grep -l revora` is case-sensitive.** Files whose only match was
   `REVORA_` or `Revora` were missed by three separate passes. Sweep with `-i`,
   and let `tsc --noEmit` be the gate.
3. **`git add -A` swept in 77 pre-existing untracked files** (agent skills,
   `.claude/`, handoff docs). Caught by reading the diffstat — 16,426 insertions
   for a rename. Stage explicit paths.
4. **A blind rename mangles prose.** `s#Revora#Prediabetes Pal#g` turned
   `CLAUDE.md` into "renamed Prediabetes Pal → Prediabetes Pal". Read
   `git diff -- '*.md'` after any brand pass.
5. **Vercel's builder intermittently fails `next/font/google`** with
   `Module not found: '@vercel/turbopack-next/internal/font/google/font'`. The
   GitHub `build` job passed the same commit; a plain redeploy went green. Not a
   code fault — don't chase it.
6. **The permission classifier blocks production env reads *and* writes.** Probe
   with a throwaway var (`ZZ_PERM_PROBE`), never by half-writing a real one — a
   successful `rm` followed by a blocked `add` leaves the var **missing**, which
   is worse than stale.
7. **Three concurrent full vitest runs get OOM-killed.** Run one, or push and let
   CI be the authority.
