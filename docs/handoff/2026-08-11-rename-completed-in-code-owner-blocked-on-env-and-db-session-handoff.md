# Continuation prompt — the rename is done in code; four dashboard fields and a DB role remain

**Written:** 2026-08-11, end of session
**Repo on disk:** `/home/tefera/Desktop/Revora` — **the local directory name is
still `Revora` and that is fine**; only the GitHub slug changed. `git remote`
already points at `https://github.com/tkiros/prediabetes-pal.git`.
**Branch:** **`main`** @ **`e3533e4`** (= `origin/main`, no local drift)
**GitHub:** **`tkiros/prediabetes-pal`** — renamed this session; `tkiros/Revora` 301s
**Production:** ✅ `{"ok":true,"db":"ok"}`, all five crons `ok`, `/`, `/check`, `/signin`, `/about`, `/terms`, `/privacy` all 200
**Open PRs:** **0** · **Open Dependabot PRs: 0** · **Open Dependabot alerts: 0**

**Supersedes** `2026-08-10-revora-name-removal-session-handoff.md` and
`2026-08-10-remove-revora-name-continuation-prompt.md`. Where they disagree,
**this file wins.** The canonical live checklist is `docs/ops/outstanding.md`.

---

## START HERE — the task in one paragraph

Every part of the Revora → Prediabetes Pal rename that lives in code, tests, CI
or GitHub is **finished and deployed**. What remains is four fields in the
Vercel dashboard, a 301, a Vercel project rename, and a Postgres role — all of
which need credentials the agent is blocked from. Nothing in the repo is
waiting on anything. Do the env work first (§2); everything else in §3–§4 is
ordered behind it for reasons that are written down.

```bash
# First 60 seconds
curl -s https://prediabetespal.com/api/health          # expect ok:true, issues:[]
curl -s https://prediabetespal.com/ | grep canonical   # STILL WRONG: emits revora.plus
gh pr list --state open                                 # expect empty
git -C /home/tefera/Desktop/Revora status --short | grep -v '^??'
```

---

## 1. What was done this session

Seven PRs merged, all green including Playwright, all deployed and verified.

| PR | What | Merge |
|---|---|---|
| **#79** | `revora` → `pal` internal identifiers, 267 files | `e62a651` |
| **#83** | record that #79 merged without the env change; correct Stage C | `95d695f` |
| **#84** | scope the #79 verification to the text path; record two traps | `7e5457d` |
| **#85** | claims scan reaches social carousel copy; track its sources | `9abf90c` |
| **#86** | self-host the two webfonts | `2cd508a` |
| **#87** | keep majors out of grouped Dependabot PRs; drop dead docker ecosystem | `dcb43e8` |
| **#88 / #89** | regenerated dep bumps — 6 dev + 15 production | `9b93f8f` / `a3043ba` |
| **#90 / #91** | session record in `docs/ops/outstanding.md` | `d575a53` / `e3533e4` |

Auto-closed as superseded: **#69**, **#81**. Previously closed: #36, #38, #67,
#68, #74, #75, #76.

### 1.1 #79 merged without the env change — the blocker was removed in code

The previous handoff held #79 as a draft because merging before `PAL_MODEL`
existed would "silently downgrade the model". **That understated it.**
`getPalEnv()` calls `resolveModelTransportConfig()`, so with `OPENAI_BASE_URL`
on OpenRouter an unset `PAL_MODEL` resolves to the unprefixed default and
`assertModelIdMatchesTransport` **throws** — an outage on `/api/check`, not a
quiet swap.

`6cb9ed7` made the read sites fall back to the pre-rename `REVORA_*` names,
which decoupled the merge from the env work entirely. Also extended to
`REVORA_REASONING_EFFORT` and `REVORA_DAILY_CHECK_CAP` (neither is actually set
in production — confirmed by `vercel env ls` — so those two are inert there),
and fixed a pre-existing `??`-vs-`||` bug at both vision sites where a
declared-but-empty var would have asked the provider for model `""`.

**Verified, not assumed:** `app/api/health/route.ts:68` runs `getPalEnv()` and
reports `issues:["model_configuration"]` on an incoherent pair. Production on
the merge SHA reports `issues:[]`.

⚠️ **That proves the TEXT path only.** `getPalEnv()` never reaches
`lib/meal/photo-extract.ts` or `lib/pantry/extract.ts`, which assert their own
transport pairing against `REVORA_VISION_MODEL`. Still unverified — one
meal-photo upload settles it.

### 1.2 The Google Fonts flake is gone at the root (#86)

`next/font/google` fetched woff2 from `fonts.gstatic.com` **at build time**, and
that fetch failed on three unrelated production redeploys and then on **#83, a
docs-only PR**. Every deploy and every PR was a coin flip on a third party's
network. The fonts are now self-hosted via `next/font/local`, so there is no
fetch left to fail.

⛔ **The provenance is the whole reason this was safe.** The vendored bytes came
from the **running production build** (`/_next/static/media/*.woff2`), not a
fresh Google download. Google's current CDN build is a later revision — same
glyphs, same coverage, same `wght` axis, but ~2–4% different advance widths.
Measured with those files, `"For an A1C of 5.7–6.4%"` went 232px → 223px and a
mobile disclaimer lost a line.

| Check | Result |
|---|---|
| Text-box metrics vs live production, desktop + mobile | **28/28 identical** |
| Pixel diff of live production, before vs after deploy, desktop @2×DPR | **0 / 4,608,000** |
| Same, mobile @2×DPR | **0 / 1,316,640** |
| gstatic/googleapis references left in the build | **none** |
| Metric-adjusted fallback faces | still generated |

**Never "just refresh" these from Google.** A newer build is a typographic
change wearing a maintenance commit's clothes. Re-measure or don't touch them.

Two guards broke and were **fixed, not relaxed**: the vitest stub aliased
`next/font/google`, which nothing imports any more, so `app/fonts.ts` went
unstubbed and every landing-render test threw; and the 700 pin read a literal
`"700"` out of a static weight array, which against a range is worse than
useless (passes on `"1700"`, fails on a valid `"400 900"`). Both mutation-checked.

### 1.3 The claims-boundary audit now reaches off-site copy (#85)

It covered every on-site surface and no off-site one. Social carousel slides are
public copy about a prediabetes product, scanned by nothing — the same shape as
F-25, where a rejected line survived in a brief because nobody scans a brief.

The hunk had sat uncommitted for a reason nobody had written down: `marketing/`
was untracked **in its entirety**, so pointing `EXTRA_SOURCES` at
`marketing/carousels/posts.json` fails in a clean checkout on a missing file.
#85 tracks the three sources and ignores the rendered `out/` slides.
Mutation-checked: planting `"This will reverse your prediabetes"` in a slide
title fails that case and only that case.

Also fixed `scripts/capture-marketing-shots.mjs`, which hung 30s every run —
`waitUntil: "networkidle"` never settles against `next dev` because Turbopack's
HMR websocket keeps the connection open.

### 1.4 Dependency grouping fixed, and it demonstrably worked (#87)

A grouped Dependabot PR is all-or-nothing, so one breaking major poisoned every
safe bump beside it. #81 carried `typescript` 6→7, `eslint` 9→10 and
`@types/node` 24→26; `typescript-eslint` 8.x declares
`typescript: ">=4.8.4 <6.1.0"`, so nine safe bumps were unmergeable.

Both npm groups are now `minor`+`patch`. Dependabot regenerated, **#88/#89
merged green with 21 bumps** (`next` 16.2.11→16.3.0, `react` 19.2.5→19.2.8,
`stripe` ^22.3→^22.4, `vitest` 4.1.5→4.1.10, `playwright` 1.60→1.62), and
auto-closed #69/#81. **The majors did not ride along** — `package.json` still
pins `openai` 6.36.0, `typescript` 6.0.3, `eslint` ^9.39.5.

The dead `docker` ecosystem was dropped (#80 deleted the last Dockerfile), and
`ci-security.test.ts` now asserts the **biconditional** rather than losing the
check — add a Dockerfile back without a Dependabot entry and it goes red.

### 1.5 Infrastructure and housekeeping

- **GitHub repo renamed** `tkiros/Revora` → **`tkiros/prediabetes-pal`**. Old
  slug 301s, open PRs survived, Vercel's git link verified by later PR builds.
  ✅ Verified first that nothing in code depends on the repo slug or the Vercel
  project name — a repo-wide grep for `revora-git` / `vercel.app` outside
  `docs/` returns one line, a hardcoded example in a test that keeps passing
  under any project name.
- **`revora.bio` removed** from the Vercel team after confirming no DNS, no
  HTTP and no RDAP record.
- **Three worktrees pruned** after confirming each had zero dirty files, zero
  untracked files and zero commits outside `origin/main`. `main` is now checked
  out in the primary tree and current.
- **Stash cleared**, hunk by hunk, against the real `origin/main` — not a stale
  ref. (An early check used a stale `origin/main` and said the work was missing;
  a `git fetch` corrected it. Fetch before you conclude anything is unmerged.)

### 1.6 Two corrections that would have cost real damage

1. **`printf`, never `echo` or a heredoc, for `NEXT_PUBLIC_APP_URL`.**
   `app/layout.tsx:27`, `app/page.tsx:19`, `app/robots.ts:29` and
   `app/sitemap.ts:27` read it with **no `.trim()`** — the billing path trims,
   these four do not. A trailing newline emits
   `<link rel="canonical" href="https://prediabetespal.com&#10;"/>` and puts the
   same thing in `robots.txt` and `sitemap.xml`.
2. **`app/fonts.ts` claimed the reading face ships only with the landing route.**
   False. Production preloads both faces on `/signin` and `/about`. Checked
   whether the self-host caused it by building `9abf90c` (the commit before #86,
   still on `next/font/google`) and reading its prerendered output: `/about`
   already preloaded both. **Pre-existing, not a regression** — but ~28KB is
   uncosted on every app route, and `landing-wiring-pins.test.ts:74` cannot
   catch it (it asserts `app/layout.tsx` does not *reference* `reading`, which
   is source-level, not bundle-level). Comment corrected in `463472e`.

---

## 2. ⛔ NEXT — Vercel production env. Owner only.

**The agent cannot do this, and a permission grant from the user does not
change it.** Probed 2026-08-10 with a throwaway `ZZ_PERM_PROBE`, never by
half-writing a real variable:

| Command | Result |
|---|---|
| `vercel env ls` | ✅ **allowed** — this is how the variable list was confirmed |
| `vercel env pull` (decrypt) | ⛔ blocked by the permission classifier |
| `vercel env add` / `rm` | ⛔ blocked by the permission classifier |

A successful `rm` followed by a blocked `add` leaves a variable **missing**,
which is worse than stale — hence the throwaway probe. The only thing that
changes this is a Bash permission rule in settings.

**Vercel → `tkiros-projects` → project `revora` → Settings → Environment
Variables. Do Production AND Preview — both carry `REVORA_*`.**

| Do | Variable | Value |
|---|---|---|
| **Add** | `PAL_MODEL` | copy `REVORA_MODEL` **verbatim** (the `openai/` prefix is load-bearing) |
| **Add** | `PAL_VISION_MODEL` | copy `REVORA_VISION_MODEL` verbatim |
| **Edit** | `NEXT_PUBLIC_APP_URL` | `https://prediabetespal.com` — **no trailing newline** |
| **Delete** | `LEGAL_ENTITY_NAME` | all three consumers already default to "Prediabetes Pal"; owner confirmed no registered entity |

Additive steps first, so no later refusal can leave anything missing.

```bash
vercel redeploy https://prediabetespal.com   # env binds at build time
```

**Verify, in this order:**
1. `/api/health` → `issues:[]`
2. `curl -s https://prediabetespal.com/ | grep canonical` → `prediabetespal.com`, **no `&#10;`**
3. a **real signin**, end to end
4. one **meal-photo upload** — this is the vision-path check from §1.1

**Then, and only in this order:** delete `REVORA_MODEL` / `REVORA_VISION_MODEL`,
*then* strip the fallback code. The code may outlive the vars; never the reverse.

⛔ **Fallback deletion sites** — `lib/pal/openai-client.ts` (×2: `activeModelId`
and `resolveReasoningEffort`), `lib/pal/rate-limit.ts:352`,
`lib/meal/photo-extract.ts:117`, `lib/pantry/extract.ts:110`, the two cases in
`tests/unit/pal/openai-client.test.ts`, and the `REVORA_*` row in
`docs/ops/env-reference.md`. Without this it is permanent.

### Expect one build failure — but it should be rarer now
The Google-Fonts flake is fixed (#86), so a red build is more likely to mean
something real than it did last session. Do not reflexively rerun; read the log.

---

## 3. NEXT — infra names and the 301. Owner only (dashboard).

Order matters. The CLI has no `project rename` and no domain-redirect command,
so all of this is dashboard work.

1. 🔴 **Make `prediabetespal.com` the production domain FIRST.**
   `vercel project ls` still reports production as `https://revora.plus`, and
   `vercel redeploy https://revora.plus` is a command in these runbooks.
   Both domains are attached to the same project and both serve; neither
   redirects.
2. 🟡 **Rename the Vercel project** `revora` → `prediabetespal`.
   ✅ Verified safe: nothing in code depends on the project name. (The previous
   handoff claimed this needed a same-PR code change, citing
   `sw-dev-teardown.test.ts` and `.gitleaks.toml:15`. **Both were wrong** — the
   test asserts `revora-git-main.vercel.app` is *not* local dev, a hardcoded
   string that returns `false` under any project name, and the `.gitleaks.toml`
   hit is inside a historical comment about a 2026-07 commit.)
3. 🔴 **301 `revora.plus` → `prediabetespal.com`.** **Only after** §2's real
   signin passes. Redirecting the old host while URLs are still built from it
   repeats the `AUTH_EMAIL_FROM` outage shape.
   **Keep `revora.plus` registered** — it carries every link already posted in
   FB groups and DMs.

---

## 4. NEXT — the database role (Stage D). Owner only.

Fully blocked for the agent: it cannot read `DATABASE_URL`, so it cannot reach
Neon at all. `revora_app` is embedded in that connection string. Neon project
`dry-shadow-56131409`, resource `revora-db`, region `us-east-1`, plan Free,
owner role `neondb_owner`, database `neondb`
(corroborated by `docs/runbooks/incident-2026-08-10-database-outage.md:15`).
The grant/revoke statements live in `docs/runbooks/database-governance.md`
§"One-time role split" (line 10) — that file also warns that `neondb_owner` is
a placeholder to be replaced with the real owner role before executing.

**There is no tolerable partial state** — repoint before the grants exist and
production loses its database, which on a passwordless product is also a login
outage (sessions live in Postgres).

1. Neon console → SQL editor as `neondb_owner`. Create `prediabetespal_app`
   with a generated password, then run the 9 grant/revoke statements from
   `docs/runbooks/database-governance.md` §"One-time role split".
2. `npm run db:governance:check` — every boolean must be true.
3. Vercel → `DATABASE_URL` → the **pooled** `prediabetespal_app` URL.
   ⛔ `DATABASE_MIGRATION_URL` stays **out** of Vercel — operator-only.
4. `vercel redeploy https://prediabetespal.com`
5. Verify `/api/health` → `db:"ok"` **and a real signin**.
6. Only then `DROP ROLE revora_app;`
7. Rename the Neon project label `revora-db` → `prediabetespal-db` (cosmetic).

⚠️ Never echo the connection string in a shell — an unquoted `&` printed a
password into a session transcript once; it was rotated immediately.

---

## 5. Still open / deferred

- 🔴 **Backups — still nothing.** The item that made the outage dangerous, still
  true. Neon Free has short-window PITR; confirm the retention is acceptable or
  add a scheduled `pg_dump`. Cheapest to reason about while the DB is near-empty.
  Needs Neon access → owner.
- 🔴 **Tally waitlist form slug is literally `revora-waitlist`** — a real
  external URL, set via `NEXT_PUBLIC_WAITLIST_IOS_URL` /
  `NEXT_PUBLIC_WAITLIST_ANDROID_URL`. Only the test fixture was renamed.
- 🟡 **Vision path unverified** — see §1.1 and §2 step 4.
- 🟡 **Three majors held back**, each now arriving as its own PR:
  `openai` 6→7 (the SDK behind the safety classifier —
  `docs/ops/openai-cost-model.md` is explicit that this is chosen **on the
  eval**, so it needs `npm run eval:pal` behind it), and `typescript` 6→7 with
  `eslint` 9→10 (a toolchain migration; TS 7 fails outright against
  `typescript-eslint` 8.x's peer range).
- 🟡 **~28KB reading face preloads on every app route** — pre-existing, now
  documented. If it matters, the fix is a separate module for `reading` that
  only `app/page.tsx` imports.
- 🟡 **`docs/legal/counsel-brief.md` (+96 lines) still uncommitted**, by design.
  It is a legal document, so it is the owner's call, not a cleanup. It is the
  **only** remaining uncommitted tracked file; the other three shipped in #85.
- 🟡 **`.claude/worktrees/app-shell-dashboard` deliberately kept.**
  `feat/app-shell-dashboard` has one commit not in `origin/main`
  (`9bc5cf3 fix(legal): fail close unreviewed health features`) plus an
  untracked `.scratch/`. **Do not prune it** without deciding that commit's fate.
- 🟢 **Re-run the marketing capture** — landing copy changed. The script no
  longer hangs (#85).
- **Counsel item N6** — re-approval of renamed copy-ledger rows. Professional
  review was waived for budget.
- ⚠️ **Dangling "counsel Q8"** — `PRODUCT.md:23` and `copy-ledger.md:97` gate the
  reversal line on a Q8 that does not exist. Pre-existing. **Do not invent one.**
- **`prediapal.com` unregistered** by owner choice — fallback name unprotected.

---

## 6. ⛔ Four `revora` strings that must NEVER be "cleaned up"

`CLAUDE.md` documents all four. Removing any breaks something real.

1. **`tests/unit/pal/owned-domains.test.ts`** — `revora.app`, `revora.bio`,
   `revora.xyz`, `revora.com` are a **denylist of domains we do NOT control**.
   `revora.app` is a live unrelated F1-graphics company and once shipped as the
   real magic-link sender. Renaming disarms the guard.
2. **`lib/pal/contact.ts` + `lib/server/email.ts` docstrings** — they name the
   retired domains because that history is *why* the constants exist.
3. **`tests/unit/pal/sw-dev-teardown.test.ts`** — `revora.plus` /
   `www.revora.plus` are live production hosts and the 301 target.
4. **`docs/handoff/**` and `docs/archive/**`** — historical records. A 2026-07
   audit did not audit "Prediabetes Pal"; rewriting it falsifies the paper trail.

The `REVORA_*` env fallback in `lib/` is a **fifth, temporary** exception with an
explicit deletion trigger — see §2.

---

## 7. Traps

1. **`git fetch` before concluding anything is unmerged.** A stale `origin/main`
   said three merged hunks were missing, moments before a stash was dropped.
2. **The permission classifier blocks production env reads AND writes.** Probe
   with a throwaway var; never half-write a real one.
3. **`printf`, not `echo`, for `NEXT_PUBLIC_APP_URL`** — see §1.6.
4. **`gh pr edit --base` fails silently** on a deprecated-Projects GraphQL
   error. Use `gh api -X PATCH .../pulls/N -f base=main` and re-read the result.
5. **`git grep -l revora` is case-sensitive.** Sweep with `-i`; let
   `tsc --noEmit` be the gate.
6. **`git add -A` sweeps in ~77 pre-existing untracked files** (agent skills,
   `.claude/`, handoff docs). Stage explicit paths; read the diffstat.
7. **A blind brand sed mangles prose** — it once turned `CLAUDE.md` into
   "renamed Prediabetes Pal → Prediabetes Pal". Read `git diff -- '*.md'`.
8. **Merge with `--merge`, never squash**, when a downstream branch is built on
   the PR's commits.
9. **Branch protection requires up-to-date branches.** PRs go `BEHIND` the
   moment anything else merges; merge `main` in and let CI rerun. A Dependabot
   PR that goes `DIRTY` needs `@dependabot recreate`, not `rebase`.
10. **`cd X && cmd` does not persist cwd.** Use absolute paths.
11. **Symlinked `node_modules` breaks Turbopack** ("points out of the filesystem
    root"). For a throwaway worktree build, `cp -al` on the same filesystem.
12. **Three concurrent full vitest runs get OOM-killed.** Run one, or push and
    let CI be the authority.
13. **Namecheap wipes sibling MX** if Email Forwarding is re-enabled while custom
    MX records exist (confirmed n=2). DNS lives on Cloudflare now. Never re-enable.
14. **Resend's aggregate `status` is not a gate** — gate on the three sending
    records.

---

## 8. Gates

```bash
npm run typecheck && npm run lint && npm run contract && npm run test
```

`npm run lint` emits **2 pre-existing warnings** (`<img>` in `app/page.tsx`) and
0 errors — that is the clean state, not a regression.

Playwright is CI-only here and has caught things all four local gates missed.
Push and let the PR's CI be authoritative.

⚠️ Do **not** add a carve-out to make the claims test pass — the previous
carve-out mechanism was deleted deliberately (F-25).

**When you change a guard, mutation-check it.** Every guard touched this session
was proven to still fail on the regression it exists to catch. A guard edited
until it passes is worse than a deleted one, because it still looks like cover.
