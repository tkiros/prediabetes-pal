# Handoff: guide redesign — PR-1 merged and live (dormant), migration 0019 not applied, three PRs waiting on it

*Written 2026-09-17 (GitHub time; this machine's clock reads about a day behind, see §8).
Supersedes the **status and actions** (§0, §1, §3, §7) of
`docs/handoff/2026-09-16-guide-redesign-four-prs-open-merge-blocked-session-handoff.md`.
That file still holds the full 09-13 → 09-16 history. The PR-2/PR-3 ruling log (F-1 … F-56) and
its traps are in `docs/handoff/2026-09-15-guide-redesign-pr2-pr3-continuation-prompt.md` §4–§6;
read those before touching the orientation code.*

**What to paste into a new Claude Code session:** everything below the line.

---

You are continuing the Prediabetes Pal **guide redesign** in `/home/tefera/Desktop/Revora`.

- **Plan:** `docs/superpowers/plans/2026-09-13-guide-redesign.md` (3,539 lines, reviewed and
  approved; inline "review A-nn" notes supersede the text they annotate; the Decision Audit Trail
  A-01…A-121 is at the end). Now tracked on `main`.
- **Spec:** `PRD/Prediabetes_Pal_Guide_Redesign_PRD_v1.1.md`, **as tracked on `main`**. The
  untracked copy in the main checkout is older and lacks the A-93/A-95 amendments. The spec wins
  any conflict.
- **Earlier handoffs:** `docs/handoff/2026-09-16-…-merge-blocked-session-handoff.md` (history),
  `docs/handoff/2026-09-15-guide-redesign-pr2-pr3-continuation-prompt.md` (PR-2/PR-3 rulings, traps).

## Hard rules for this session

1. **Never push, merge, run a production migration, change a CI/security gate, or change GitHub
   repo settings without the user's explicit OK in this session.** Standing rule: "Never push or
   merge without asking." Approval given in an earlier session does not carry over.
2. **Never run `npm run eval:pal:ideas` yourself.** It makes ~1,440 live model calls (~$15). It is
   an owner action.
3. **Never set a copy-ledger row to `Approved`**, and never change an existing row's Copy or Status
   cell. New user-facing strings get a new row filed `Pending | Yes`.
4. **Never propose or perform switching `NEXT_PUBLIC_GUIDE_DOOR` on in production.** Production
   never carries the value `1`; it carries an explicit surface list, and only after that list's
   gates are met (§5).
5. Every user-visible change goes behind `guideDoorEnabled("<surface>")`, server side too.
6. Next.js here is 16.3 with breaking changes: read `node_modules/next/dist/docs/` before touching
   a Next API.
7. **Do not `git pull` or `git checkout` another branch in the main checkout** until §3 A is done.
   Two untracked copies and the locally modified `docs/ops/env-reference.md` collide with files
   `main` now carries, so git refuses.
8. **Do not delete `feat/guide-redesign`** (local or remote) until #146 has been retargeted to
   `main`; #146's base still names it.

---

## 0. Status in one paragraph

PR-1, PR-2 and PR-3 of the plan's six Tier-1 PRs are built. **PR-1 (#144) is merged**
(`78798b8`) and deployed to production, dormant: every guide surface reports `off`. The
secret-scan false positive is fixed, and `main` now requires six checks, including the two
flag-on e2e legs. **Migration 0019 has not been applied to production.** This machine has no
production database credentials, and the owner deferred it. Until it is applied, **#145
(migration), #146 (PR-2 + PR-3) and #147 (first-week finish) stay open.** All three are green.
#145 is up to date with `main`; #146 and #147 still sit on their stacked bases. PR-4, PR-5, PR-6
and every gated module are **not started**. Turning on any surface is a later step gated on the
owner and the safety owner (§5). No human has reviewed any guide PR on GitHub.

---

## 1. Where things are (verified 2026-09-17)

### Checkouts

| Path | Branch @ head | Notes |
|---|---|---|
| `/home/tefera/Desktop/Revora` | `main` @ `76eab01` locally; **`origin/main` is `78798b8`** (30 commits ahead) | Dirty, and cannot pull until §3 A. See "Main checkout" below. |
| `.claude/worktrees/guide-redesign` | `feat/guide-redesign` @ `7d1d6d5` (= remote; merged via #144) | Own `node_modules`, no `.env*` except `.env.example`. Dirty `.planning/STATE.md` (GSD tool state from 09-14, not guide work; leave it). **Reusable for the migration run (§3 B).** |
| `.claude/worktrees/guide-pr23` | `feat/guide-orient-finish` @ `7d7aa5e` (= remote) | #147's branch. Clean except an untracked copy of the 09-15 handoff. |
| ~~`.claude/worktrees/app-shell-dashboard`~~ | removed this session | Branch `feat/app-shell-dashboard` still exists locally at `9bc5cf3` (see §2). |

### Branches

| Branch | Local | Remote | State |
|---|---|---|---|
| `feat/guide-redesign` | `7d1d6d5` | `7d1d6d5` | Merged into `main` via #144. **Keep** until #146 is retargeted. |
| `feat/guide-pr23` | `156bc20` | `156bc20` | #146 head |
| `feat/guide-orient-finish` | `7d7aa5e` | `7d7aa5e` | #147 head |
| `chore/migration-0019-profile-orientation` | **`8949028` (stale)** | `6347d8f` | #145 head; GitHub merged `main` into it this session. Use `origin/…`. |
| `feat/app-shell-dashboard` | `9bc5cf3` | — (local only) | Not in `main`. `main`'s same-titled commit `4be486c` has a different patch. Owner decides whether to delete. |

### Guide pull requests

| PR | Branch → base | Head (full SHA) | Merge state | CI | What |
|---|---|---|---|---|---|
| **#144** | `feat/guide-redesign` → `main` | `7d1d6d5` | **MERGED** as `78798b8` | all green | PR-1: ideas, source lead-in, surface-listed flag, production guard, analytics, CI legs, `.gitleaksignore` |
| **#145** | `chore/migration-0019-profile-orientation` → `main` | `6347d8ff6268a84e638c498e50b1d1d36623a2df` | CLEAN, up to date | 11/11 pass | Migration 0019 + `schema.ts` line + `lib/coach/orientation.ts`. **Apply 0019 to production before merging.** |
| **#146** | `feat/guide-pr23` → `feat/guide-redesign` | `156bc2029ebc94a3a2cee3ac36a85d20ca76e5dd` | CLEAN (vs its stacked base) | 8/8 pass | PR-2 F-CALM (`calm`) + PR-3 F-ORIENT (`orient`). Carries #145's five files, byte-identical. |
| **#147** | `feat/guide-orient-finish` → `feat/guide-pr23` | `7d7aa5e343aefe4b10f594e2d47313e82bb96e28` | CLEAN (vs its stacked base) | 8/8 pass | Day line replaces Home's date, A-83 sign-in line, A-84 auto-completion. Changes `lib/coach/orientation.ts` on top of #146's version. |

### Required checks on `main` (branch protection, `strict: true`)

`typecheck · lint · contract · build`, `unit · evals (mock — no keys, no spend)`,
`playwright (incl. axe a11y)`, `secret scan`,
`playwright (incl. axe a11y) · guide door 1`,
`playwright (incl. axe a11y) · guide door ideas,source` (the last two added this session).
`strict` means every PR must be up to date with `main` before it can merge.

### Other open pull requests (not this work's)

| PR | State | Note |
|---|---|---|
| #137, #138, #140, #141, #142, #143, #148, #150 | CLEAN | Dependabot rebased them onto `78798b8` by itself; they report the new legs. Mergeable on the owner's word. |
| #111 typescript 6 → 7 | BLOCKED | Rebased this session (`@dependabot rebase`). Fails lint: `typescript-eslint does not support TS 7.0.` |
| #128 eslint 9 → 10 | BLOCKED | Up to date. Fails lint: `Error while loading rule 'react/display-name': contextOrFilename.getFilename is not a function`. |
| #133 ops: hourly-crons heartbeat | behind 30 | From 09-06. Relevant to the cron-staleness issue below. Needs update-branch before it can merge. |
| #134 billing: pricing (draft) | behind 30 | From 09-06. |
| #135 docs: owner decisions B/C, truth-index C7 | behind 30 | From 09-06. **Edits `docs/release/truth-index.md`**, which is deleted in the main checkout (§7 item 5). |
| #136 research: cohort retention report | behind 30 | From 09-06. |

#133–#136 were built before the new legs existed. Each needs
`gh api -X PUT repos/tkiros/prediabetes-pal/pulls/<n>/update-branch` (a push; ask first) before
it can merge.

### Production (https://prediabetespal.com)

- Running `78798b8`. `/api/health` → `guideDoor`: all 12 surfaces `off`. `/home`, `/check`
  (± `?stay=1`) render no `ideas-block`. `/learn/first-week` → 404.
- **`/api/health` returns 503 `degraded` both before and after the merge.** It predates this work.
  Issues: `cron_nudge_stale`, `cron_trialPrecharge_stale`, `cron_pantrySweep_stale`,
  `cron_stripeReconcile_stale`. Every `hourly-crons.yml` run succeeds, but GitHub's scheduler
  fires it only every 3–5 h (e.g. 23:19, 02:00, 08:01 UTC) and `app/api/health/route.ts` marks
  these four stale after 2 h. That delays nudges, trial pre-charge and Stripe reconcile. It is an
  owner/ops item, separate from the guide work (options: an external or Vercel scheduler; #133
  adds a heartbeat).
- `lib/pal/guide-ideas.labels.json` does not exist on `main` (the label eval has not been run),
  so the production guard would drop `ideas` even if the variable were set.

### Main checkout — uncommitted state (nothing here is this work's to commit without asking)

| Path | State | What it is |
|---|---|---|
| `docs/superpowers/plans/2026-09-13-guide-redesign.md` | untracked | Byte-identical to the copy now tracked on `main`. **Blocks `git pull`.** |
| `PRD/Prediabetes_Pal_Guide_Redesign_PRD_v1.1.md` | untracked | Older subset of the copy tracked on `main`. **Blocks `git pull`.** |
| `PRD/Prediabetes_Pal_Guide_Redesign_PRD_v1.md` | untracked | Not tracked anywhere. Historical. |
| `TODOS.md` | modified | Two entries from the 09-14 review (A-13 result-card note; A-14 dismiss control on Home's step line). |
| `CLAUDE.md` | modified (+10) | The block `next dev` re-adds. Never commit it with feature work. |
| `app/(app)/privacy/page.tsx` | modified | "Railway-hosted" → "Neon-hosted Postgres". Pre-existing, unrelated. |
| `.planning/STATE.md`, `docs/legal/counsel-brief.md` | modified | Pre-existing, unrelated. |
| `docs/ops/env-reference.md` | modified (+5 rows, "audit 2026-09-05 doc reconcile") | Pre-existing. **#144 also changed this file, so it blocks `git pull`** (§3 A). Both add a `PAL_LIVE_EVAL` row. |
| `docs/release/truth-index.md` | **deleted** (whole `docs/release/` gone) | Cause unknown; last commit on `main` is `d279111`. #135 edits this file. **Ask before any commit that includes the deletion.** |
| `docs/handoff/2026-09-15-…`, `2026-09-16-…` (updated this session), this file | untracked | Handoffs. |
| many other `docs/**` | untracked | Historical, pre-existing. |

Backups outside the repo: `~/revora-untracked-backup/app-shell-dashboard-scratch/` (7.8 MB of
screenshots and scripts from the removed worktree).

---

## 2. What has been done

### Before this session (full detail: the 09-16 and 09-15 handoffs)
- **09-13:** plan written from PRD v1.1: move the front door from "judge my meal" to "guide
  me", in six Tier-1 PRs behind one build flag, plus gated and Tier-2/3 modules.
- **09-14:** `/autoplan` review (CEO, Design, Eng, DX), approved as-is. It gave the flag named
  surfaces (`ideas, source, calm, orient, home, intake, ideas-full, numbers, refer, doctor, plan,
  guide`; `1` = all, dev/e2e only), added a production guard that ties each surface to its ledger
  rows, and made the label eval gate the flip. It also set: ideas render as full-width rows;
  orientation starts at `startedAt`; op-based, server-merged PATCH; kill line 2 counts taps;
  the day-2 default is the sign-in line. Known gaps: Eng/DX ran single-voice (Codex quota), and
  the DX report was truncated after five findings.
- **09-15/16:** PR-1 built → #144. PR-2 + PR-3 → #146. Migration → #145. Follow-up → #147.
  26 ledger rows filed `Pending` (8 in batch 1, 18 in batch 2). Deferred minors: 27 (PR-1) and 34
  triaged (PR-2/3), listed in the PR descriptions.

### This session (2026-09-16/17)
1. **Checked the handoff against live state.** Everything matched. Both gitleaks fingerprints
   were confirmed in the failing job logs. The untracked plan copy is byte-identical to the
   branch copy; the branch's PRD is newer. #145's five files match #146 byte for byte.
2. **Found:** `ci.yml` has `pull_request:` with no `types`, so it runs only on opened,
   synchronize and reopened. A base retarget (`edited`) starts no run, and `gh run rerun` reuses
   the old merge SHA.
3. **Secret scan fixed** (user OK):
   - Committed `.gitleaksignore` (exactly the two fingerprints) on `feat/guide-redesign` as
     `7d1d6d5` and pushed it.
   - Checked locally first with gitleaks 8.24.3, the same version CI uses: both full-range scans
     pass with the file and fail with exactly one finding without it.
   - Re-triggered #146 by closing and reopening it.
   - Both CI scan steps now report "no leaks found" (29 and 28 commits).
4. **Required checks** (user OK): added the two flag-on legs to `main`'s protection.
5. **Stale worktree removed** (user OK): `.claude/worktrees/app-shell-dashboard`.
   - Its head `9bc5cf3` is local-only and not in `main`, so only the worktree was removed; the
     branch is kept.
   - Its untracked `.scratch/` was moved to `~/revora-untracked-backup/` first.
6. **Migration 0019 not applied.**
   - The user chose "creds are in env", but no credentials exist here: the shell has no DB
     variables, and `.envprod` and `.env.probe` hold `DATABASE_URL=""`.
   - `DATABASE_MIGRATION_URL` is operator-only by policy (`docs/ops/env-reference.md`) and is not
     in Vercel.
   - The user then chose to **skip the migration today** and to merge #144 first. #144 touches no
     schema or migration file.
7. **#144 merged** (user OK): merge commit `78798b8`, pinned to head `7d1d6d5`.
   - The Vercel production build succeeded; this was the guard's first production run.
   - `main`'s push CI was green on all six checks.
   - Production verified as in §1.
8. **#145 updated from `main`** (user OK): `update-branch` gave head `6347d8f`, which still
   changes only the five migration files. All 11 checks pass.
9. **Dependabot** (user OK):
   - Eight PRs had already been rebased by dependabot and are green.
   - #111 was stale (over 30 days old, so no auto-rebase). I commented `@dependabot rebase`; it
     now fails lint on TS 7.
   - #128 fails lint on eslint 10. A rebase would not help.
10. Added a status block to the top of the 09-16 handoff. Nothing was committed from the main
    checkout.

---

## 3. Exact actions — Level 1: "shipped dormant" (remaining)

Do these **in this order**. Every step marked *OK* needs the user's explicit approval in the new
session.

### A. Unblock the main checkout — *OK*

Three local files block the fast-forward (verified against `76eab01..78798b8`):
- the two untracked copies;
- **`docs/ops/env-reference.md`**, which has an uncommitted local edit and was also changed by
  #144.

The two env-reference changes touch different parts of the table (the local edit at line ~52,
#144's at line ~63), but **both add a `PAL_LIVE_EVAL` row** with different wording. Set the local
edit aside as a patch rather than stashing (the stash stack is shared across worktrees):

```bash
cd /home/tefera/Desktop/Revora
mkdir -p ~/revora-untracked-backup
cmp docs/superpowers/plans/2026-09-13-guide-redesign.md <(git show origin/main:docs/superpowers/plans/2026-09-13-guide-redesign.md) && \
  rm docs/superpowers/plans/2026-09-13-guide-redesign.md          # byte-identical to main's copy
mv PRD/Prediabetes_Pal_Guide_Redesign_PRD_v1.1.md ~/revora-untracked-backup/   # older subset
git diff -- docs/ops/env-reference.md > ~/revora-untracked-backup/env-reference-local.patch
git checkout -- docs/ops/env-reference.md
git pull --ff-only origin main                                    # 76eab01 → 78798b8 (or later)
git apply --3way ~/revora-untracked-backup/env-reference-local.patch   # tested: applies cleanly
git restore --staged docs/ops/env-reference.md                         # --3way stages it; keep it unstaged
```
Afterwards, remove the duplicate `PAL_LIVE_EVAL` row in `docs/ops/env-reference.md` (keep
#144's fuller row, which mentions the `PAL_EVAL_IDEAS` second opt-in). The file stays
uncommitted. Re-check first with
`git diff --name-only 76eab01 origin/main | grep -Fxf <(git diff --name-only; git ls-files --others --exclude-standard)`
in case `main` has moved; every file it prints needs the same treatment.

### B. Apply migration 0019 to production — owner, production credentials, *OK*

Needs `DATABASE_URL` (runtime role) and `DATABASE_MIGRATION_URL` (Neon `neondb_owner`) on
**different roles**. Neither exists on this machine. Two ways:

**B1 — the owner runs it** (on any machine with the repo and the credentials):
```bash
git fetch origin
git checkout --detach origin/chore/migration-0019-profile-orientation   # 6347d8f
PAL_DB_ENV=production DATABASE_URL='<runtime>' DATABASE_MIGRATION_URL='<owner>' npm run db:migrate:production
DATABASE_URL='<runtime>' DATABASE_MIGRATION_URL='<owner>' npm run db:governance:check   # must pass
```
The SQL is one line: `ALTER TABLE "profiles" ADD COLUMN "orientation" jsonb;`

**B2 — the agent runs it**, if the owner writes both URLs into a gitignored file
(e.g. `/home/tefera/Desktop/Revora/.env.migrate.local`, covered by `.env.*`). Use the PR-1
worktree; it has `node_modules`, and its only difference from #145's head is the five migration
files:
```bash
cd /home/tefera/Desktop/Revora/.claude/worktrees/guide-redesign
git fetch origin
git checkout --detach origin/chore/migration-0019-profile-orientation
set -a; . /home/tefera/Desktop/Revora/.env.migrate.local; set +a   # never echo the values
PAL_DB_ENV=production npm run db:migrate:production
npm run db:governance:check
rm /home/tefera/Desktop/Revora/.env.migrate.local                  # right after
git checkout feat/guide-redesign
```
(The shell does not keep state between Bash calls: run the `set -a` line and both npm commands in
**one** call.)

**Never** run `db:governance:check` from `main` between applying the migration and merging #145:
`main` lacks the 0019 file and reports a mismatch.
It is safe to apply early: nothing on `main` names the column.

### C. Merge #145 — *OK*

Re-check first: `gh pr checks 145` all pass, and `gh api repos/tkiros/prediabetes-pal/pulls/145 --jq .mergeable_state` → `clean`.
If `main` has moved, run `update-branch` again (a push, *OK*) and wait for green.
```bash
gh api -X PUT repos/tkiros/prediabetes-pal/pulls/145/merge -f merge_method=merge \
  -f sha=6347d8ff6268a84e638c498e50b1d1d36623a2df     # or the new head after an update
```
Verify production after the Vercel deploy (status on the merge commit:
`gh api repos/tkiros/prediabetes-pal/commits/<sha>/status`):
1. **owner:** create a test account through onboarding (exercises `POST /api/profile`);
2. **owner:** download the account export; it must succeed;
3. agent: the production check script below.

### D. Retarget, update and merge #146 — *OK*

```bash
gh api -X PATCH repos/tkiros/prediabetes-pal/pulls/146 -f base=main          # starts no CI run
gh api -X PUT repos/tkiros/prediabetes-pal/pulls/146/update-branch \
  -f expected_head_sha=156bc2029ebc94a3a2cee3ac36a85d20ca76e5dd             # push → full CI
```
- After the update, #146's diff against `main` should show no drizzle/schema changes, since
  they're identical to #145's. The secret scan passes because `main` has `.gitleaksignore`.
- Wait for all six required checks to pass, then merge with a merge commit pinned to the new
  head (`gh api -X PUT …/pulls/146/merge -f merge_method=merge -f sha=<new head>`).
- Verify production:
  - **owner:** onboarding, export, and the reminder-settings PATCH;
  - **agent:** the check script below, where Home must still show no ideas block and
    `/learn/first-week` must still return 404.

### E. Retarget, update and merge #147 — *OK*

```bash
gh api -X PATCH repos/tkiros/prediabetes-pal/pulls/147 -f base=main
gh api -X PUT repos/tkiros/prediabetes-pal/pulls/147/update-branch \
  -f expected_head_sha=7d7aa5e343aefe4b10f594e2d47313e82bb96e28
```
CI green → merge commit pinned to the new head → repeat D's checks.

**Production check script (agent):**
```bash
U=https://prediabetespal.com
curl -sS "$U/api/health" | jq -c '{status, issues, door: (.guideDoor|to_entries|map(.value)|unique)}'
# expect door == ["off"]; issues unchanged from the cron-staleness baseline (§1)
for p in /home "/home?stay=1" /check "/check?stay=1" /learn/first-week; do
  curl -sS -o /tmp/pal-page.html -w "$p %{http_code} " "$U$p"; grep -c ideas-block /tmp/pal-page.html
done   # expect 200 0 for the four pages, 404 for /learn/first-week
```

### F. Cleanup — *OK*
- `git worktree remove .claude/worktrees/guide-pr23` (after #147 merges; move the untracked 09-15
  handoff copy first or delete it, since the main checkout has the same file).
- `git worktree remove .claude/worktrees/guide-redesign` (after D; its dirty `.planning/STATE.md`
  is GSD noise, so `--force` is acceptable **only** with the user's OK).
- Delete the merged branches, local and remote: `feat/guide-redesign`, `feat/guide-pr23`,
  `feat/guide-orient-finish`, `chore/migration-0019-profile-orientation`
  (`git push origin --delete <b>`).
- `feat/app-shell-dashboard` (`9bc5cf3`, local-only, not in `main`): the owner decides.
- Main checkout dirty files (§1): the owner decides, especially the `docs/release/` deletion.

### G. Docs PR (optional, small) — *OK*
- The plan still says "Status as of 2026-09-13" and none of its 89 checkboxes are ticked.
  - Tick Tasks 1.1–1.14, 2.1–2.4, 3.1–3.8 and 4.2.
  - Mark Task 4.1 "built, not run".
  - In the §1 gate table: Ledger batch 1 "Filed, Pending"; Ledger batch 2 "Filed, Pending —
    18 rows"; F-CALM colour "Open".
- Commit the 09-15, 09-16 and this handoff, and the two `TODOS.md` entries, if the user agrees.
  Never include the `CLAUDE.md` `next dev` block or the `docs/release/` deletion.

### H. Non-guide PRs the user may want handled — *OK each*
- #133–#136: `update-branch` so they report the new legs (#135 touches `docs/release/truth-index.md`).
- #111 / #128: close them, or leave them until typescript-eslint supports TS 7 and the React lint
  plugin supports eslint 10.
- The eight green dependabot PRs: merge on the owner's word (each merge moves `main`, so the rest
  need a rebase afterwards; dependabot does that itself for PRs under 30 days old).

---

## 4. Safety-owner submissions — send if not already sent

The previous sessions did not record whether these were sent. Ask the user.

**Batch 1 (#144, now merged and dormant), 8 rows, all `Pending`:** `guide-ideas-breakfast`,
`guide-ideas-lunch`, `guide-ideas-dinner`, `guide-ideas-hero`, `result-source-lead`,
`check-empty-ideas`, `check-from-idea`, `check-classics-hint-guide`.
- Dinner ideas #7 and #8 were composed from the "What can I eat freely?" list in
  `app/guides/what-to-eat-with-prediabetes`, not lifted from a guide sentence. They need a safety
  read (flagged in the row Notes).
- The classics hint has two candidates: the plan's "Or try a classic — foods whose read surprises
  people." and the shipped "Or try a classic — three everyday foods." (AUD-017 removed prevalence
  framing from the sibling row). The safety owner picks.

**Batch 2 (#146 + #147), 18 rows, all `Pending`:** `orientation-intro`, `orientation-step-01` …
`orientation-step-07`, `orientation-day-eyebrow`, `orientation-controls`,
`orientation-note-hint` (contains "safe" — flagged), `orientation-save-failed`,
`orientation-step-prefix`, `learn-first-week-intro`, `journey-where-you-are`,
`onboarding-final-button`, `onboarding-first-week-line`, `orientation-signin-step`.
`landing-three-answers` (Approved) gained a treatment note only; its text is unchanged.
F-REFER did not ride along.

**Calm-audit questions:**
- Drafted amendments for `clinical-medication-dosing` and `clinical-allergy` (rows unchanged,
  `PENDING` W-05).
- The `proxy.ts` rate-limit/outage copy (`RATE_LIMIT_COPY`, `URGENT_CARE_LINE`,
  `ABUSE_LIMIT_COPY`) has no ledger row.
- `.status-card[data-state="error"]` uses raw hex colours outside the token families.

**Also decide with batch 1:** whether the idea bank waits for a dietitian pass (taste decision
A-49), given the W-05 backlog (15 live rows still `PENDING RD/CDCES`). Agree a review turnaround.

---

## 5. Level 2 — before any surface goes live (owner / safety owner; not code)

Switching on = set the Vercel env var `NEXT_PUBLIC_GUIDE_DOOR` to an explicit surface list,
**then rebuild and redeploy** (it is not a runtime switch). The guard enforces rows and
dependencies: `orient` needs `ideas`; `intake` needs `orient`; `home` needs `ideas` and
`ideas-full`.

**Gates for everything**
1. **D5 — the concierge test.** Nothing records it as started.
   - Read the r/prediabetes rules in a browser, send the plan's §5.3 draft, recruit 5, and add
     the neutral opener and the three counts.
   - Floor: ≥ 3 of 5 ask a second question. **< 3 of 5 ⇒ stop; the merged code stays dormant.**
   - The number-vs-food count picks the branch. Food order (plan §2.1) is the default. Number
     order (§2.2) applies if number questions outnumber food questions by more than 2:1 and D7
     has a class.
2. **D7 — ask the safety owner/counsel now**, in parallel with D5: which claim class does a
   general A1C-education page fall under? No class by branch-read day ⇒ F-NUMBERS deferred. Show
   them the sentence "If your number landed in the middle band, here is how to think about it"
   (plan §8 item 3).

**First flip: `ideas,source`** (plan §7.3 step 3) — all of:
- batch 1 `Approved` + `Active`;
- `npm run eval:pal:ideas` run **by the owner**, green on the current `PROMPT_VERSION`, producing
  `lib/pal/guide-ideas.labels.json` (absent today, so the guard would drop `ideas`);
- D5 read and passed;
- the revert rehearsed on a preview first (unset the variable, redeploy — about five minutes);
- a CI job that runs `scripts/check-production-config.ts`, or accept that the guard's first
  flag-on execution is a production build (the flag-off production build on 09-17 passed);
- D6 (landing): plan default is "stale until the branch is read". The landing's §3 line ships in
  the same deploy as this flip, never before;
- the competitive-framing paragraph written into PRD §11 before the flip (A-44: why this over an
  AI assistant — the boundary, a human-reviewed bank, the same read every time);
- post-deploy checks (plan §7.3 step 7), in the first five minutes and again in the first hour:
  - `/api/health` `guideDoor`;
  - `/home?stay=1` at 375×667 shows the ideas and the CTA on screen;
  - an idea tap lands on `/check` with the idea in the field;
  - `ideas_shown` arrives in Umami within the hour (if not, suspect broken analytics before
    concluding nobody visited).

**`calm`** — lists no ledger rows, so only a human gate protects it:
- the safety owner's colour-blind and "does this look like a warning" review of the landing
  verdict cards at 375 and 1280 (A-61, Task 2.3);
- that review recorded in the ledger note on `landing-three-answers` and in `DESIGN.md` §3;
- `landing-a11y.spec` green.

**`orient`** — all of:
- the 18 batch-2 rows Approved;
- `ideas` live;
- **owner decision F-56**: the completion read `orientation_step_done` counts only Done taps,
  so it undercounts once A-84 auto-completes steps. Either redefine the read in
  `docs/ops/launch-controls.md` §13.4, or ask for a small PR that emits the event on
  auto-complete;
- the privacy page mentions first-week progress stored on the account;
- D5 passed.

Accepted exposure: `dayKeyInTimezone` throws on a malformed stored timezone (Home already has
this today).

**Kill lines after going live**
- Kill line 2: sessions with `idea_tapped` ÷ sessions where an ideas block rendered, per surface,
  < 25% after four weeks ⇒ flag off (reviewed rebuild), and the PRD is marked tested and closed.
- F-ASK floor (after PR-6): < 70% of the first 50 tour starts reach the attribution screen, and
  the drop sits on Screen A or B ⇒ Task 6.7.

---

## 6. Level 3 — remaining build work (not started)

| Item | Plan section | Tasks | Starts when |
|---|---|---|---|
| **PR-4** full F-IDEAS | §2.3 PR-4 | 4.3 segment steering (`pal.segment.v1` steers the first idea); 4.4 "See all" expands in place (row `guide-ideas-see-all`, surface `ideas-full`, `idea_tapped { slot: "more" }`); grow each daypart bank to ≥ 10 lines. (4.1 and 4.2 were pulled into PR-1.) | The owner reads the ideas-viewed : checks-run counts once `ideas` is live (plan §8 item 2) |
| **PR-5** Home layout | §3 | 5.1 quick-action row below the hero; 5.2 `/learn` index of tiles; 5.3 door order (slot mechanism for F-ASK; non-default doors render two idea rows); 5.4 smoke; 5.5 hero copy "Unsure about a meal?" (row `home-check-hero-title`) | After PR-3 and PR-4. **Open: UC5** — keep the four-item quick row, cut to three, or replace with one "Learn" link |
| **PR-6** intake + F-ASK | §4 | 6.1 pure step functions; 6.2 Screen A "What is hardest right now?"; 6.3 Screen B "What would count as a win?"; 6.4 response line on Screen B; 6.5 A1C step (its link waits for D7) + final step; 6.6 smoke; 6.7 floor fallback (only if the floor fires) | After PR-5 |
| F-NUMBERS `/learn/numbers` | §2.4.1 | page, copy pass, result-footer link; flip `LEARN_NUMBERS_HREF` in `lib/coach/orientation.ts` | D7 names a class |
| F-TREND "Your A1C over time" | §2.4.2 | `a1c_entries` table + migration, route, twin flag pair, erase/export, `/journey` section | D3 (refuse / store / anchor) **and** RV-3 (a)/(b) chosen. Last in both branches |
| F-SOURCE `/how-it-works` paragraph | §2.4.3 | one paragraph + row `how-it-works-same-read` | A panel consistency run (every `stratum-*` meal × 3 bands, N ≥ 20, ≥ 95% modal class) logged in launch-controls §12 |
| F-REFER | §5.1 | one static referral section on `/learn/first-week`; gives step 6 a trigger | Safety owner clears its copy |
| F-DOCTOR | §5.2 | doctor-question bank | D2 |
| F-PLAN | §5.3 | starter meal pattern | D1 (after Tier 1 is live + Phase 5 measurement) |
| F-HABIT | §5.4 | opt-in reminder | Phase 5 shows people do not return without it |
| F-DIARY | §6 | food-and-reading diary | D4 — new intended-use statement with counsel |
| Retire the flag | §7.3 step 9 | one PR deleting flag-off branches, skip guards, env row | Kill line 2 read at four weeks, and the door stays |
| F-56 metric PR (small) | launch-controls §13.4 | emit `orientation_step_done` on auto-complete | Owner picks this over redefining the read (§7 item 7) |
| Follow-ups | `TODOS.md` (main checkout, uncommitted) | A-13 result-card note; A-14 dismiss control on the step line | After PR-4's ratio read |
| Deferred minors | #144 / #146 descriptions and review reports | 27 (PR-1) + 34 triaged (PR-2/3) | Opportunistic |

---

## 7. Open decisions for the user

| # | Decision | Recommendation |
|---|---|---|
| 1 | How migration 0019 gets applied (§3 B1 or B2), and when | B1 (owner runs it) keeps the owner credential off this machine. Do it before anything else in Level 1. |
| 2 | Approve §3 A (unblock the main checkout) | Yes. The plan copy is identical and the PRD copy is an older subset. |
| 3 | Approve the merge run C → D → E, with update-branch pushes | Yes, merge commits pinned to the verified head, with production checks after each. |
| 4 | The owner-side production checks after C/D/E (test account, export, reminder PATCH) | The owner does them; the agent cannot sign in. |
| 5 | The unexplained deletion of `docs/release/truth-index.md` in the main checkout (and #135, which edits it) | Find out who removed it before any commit from the main checkout. |
| 6 | Commit the three handoff notes and the `TODOS.md` entries? | Yes, in the §3 G docs PR. |
| 7 | F-56 completion metric (before `orient` goes live) | Emit the existing event on auto-complete — a small PR keeps the read honest. |
| 8 | UC5 quick row (before PR-5) | The plan default keeps four items below the hero; the owner may cut it. |
| 9 | Recover the DX reviewer's missing findings? | Optional: re-run `/plan-devex-review` before PR-4. |
| 10 | Were the §4 safety-owner submissions sent? | Send now if not. |
| 11 | `feat/app-shell-dashboard` (`9bc5cf3`, local-only, not in `main`) | Keep until someone compares it with `4be486c`; delete after. |
| 12 | Cron staleness (production 503 `degraded`) | Separate ops fix; consider #133 plus a scheduler that actually runs hourly. |
| 13 | Dependabot #111 / #128 and the eight green ones; #133–#136 update-branch | Owner's call (§3 H). |

---

## 8. Traps (new ones first; the full older list is in the 09-15 handoff §6)

- **This `gh` version has no `--json` on `gh pr checks`.** Parse the tab-separated output:
  `gh pr checks <n> | awk -F'\t' '{print $2"\t"$1}'` (columns: name, state, elapsed, link). A
  monitor built on `--json` loops silently forever.
- **`gh run view --log-failed` printed nothing** for these jobs. Use
  `gh api repos/tkiros/prediabetes-pal/actions/jobs/<job-id>/logs` (the job id is the last path
  segment of the check link).
- **CI runs only on opened / synchronize / reopened.** A base retarget starts no run, and
  `gh run rerun` re-checks the old merge SHA. Start a fresh run with a push (`update-branch`) or
  by closing and reopening the PR (`gh api -X PATCH …/pulls/<n> -f state=closed`, then
  `state=open`).
- **`strict: true` + six required checks:** every PR must contain the current `main`. Any PR
  created from `main` before `78798b8` never reports the two guide-door legs until it is updated.
- **Merging moves `main`**, so after each merge the next PR is `behind` again: run
  `update-branch`, wait for green, then merge.
- **Merge with a pinned SHA** via REST: `gh api -X PUT …/pulls/<n>/merge -f merge_method=merge
  -f sha=<full head sha>`. `gh pr edit` fails in this repo ("Projects (classic)"); use
  `gh api -X PATCH …/pulls/<n> -f base=…` for retargets.
- **The local branch `chore/migration-0019-profile-orientation` is stale** (`8949028` vs remote
  `6347d8f`). Use `origin/…` or `git checkout --detach`.
- **The main checkout cannot switch branches or pull** until §3 A: the two untracked copies and
  the modified `docs/ops/env-reference.md` collide.
- **Worktree path guard:** if the Bash cwd drifts into a worktree, Write/Edit refuses paths in the
  main checkout. Run `cd /home/tefera/Desktop/Revora` in Bash first. In worktree sessions keep git
  commands plain: no `$(git …)` substitutions, no loops around git, no `cd … && git …` chains.
- **No production DB credentials on this machine.** `.envprod` and `.env.probe` hold
  `DATABASE_URL=""`. Do not go looking for the owner credential; ask.
- **The local clock is about a day behind GitHub** (the local `date` read 09-16 while GitHub
  stamped the merge 2026-09-17T06:46Z). Use GitHub timestamps for anything time-sensitive.
- **Background waits:** a `pgrep -f` inside a wait loop matches its own command line, so it never
  ends. Wait on file contents or API state instead.
- **The secret scan scans the PR's commit range**, so a rename cannot clear a historical finding;
  only `.gitleaksignore` (exact fingerprints) can. Never add a broad regex allowlist to
  `.gitleaks.toml`.
- **gstack binaries** live at `~/.claude/skills/igstack/bin/`, not `~/.claude/skills/gstack/bin/`.
- **Codex CLI** hit its usage limit on 2026-09-14; expect single-voice reviews until it resets.
- **`next dev` rewrites `CLAUDE.md`.** Never commit that block with feature work.
- **Never write the literal `NEXT_PUBLIC_GUIDE_DOOR` under `tests/smoke/`** (pinned in
  `tests/unit/pal/smoke-guide-door.test.ts`). Use `doorSurfaceOn(surface)` from
  `tests/smoke/guide-door.ts`, and `PAL_E2E_GUIDE_DOOR=1 npm run e2e -- tests/smoke/<spec>.ts`
  for flag-on runs.
- **No local Postgres:** DB-backed smoke specs skip locally; that is the baseline.
- **The claims audit skips lines that begin with a comment marker** (a trailing comment *is*
  scanned). The analytics no-PII scan reads only `lib/client/analytics.ts` and strips nothing.
  New analytics union members go before `photo_draft`.
- **The orientation egress pins are two-way** (`tests/unit/pal/orientation-egress-guard.test.ts`).
- **Verify end to end before asserting.** Earlier sessions logged eight false assertions from
  checking one step and assuming the rest; this session caught two stale claims in the previous
  handoff (the "clean" PR-1 worktree, the "merged" app-shell-dashboard branch). Trust the file
  over any claim, including this one.

## 9. Standing constraints (from the user and `CLAUDE.md`)

- Keep these `revora` strings:
  - `tests/unit/pal/owned-domains.test.ts` (denylist);
  - `tests/unit/pal/sw-dev-teardown.test.ts`;
  - the docstrings in `lib/pal/contact.ts` and `lib/server/email.ts`;
  - historical docs under `docs/handoff`, `docs/archive`, `docs/audit`, `docs/qa`, `PRD`,
    `predict`, `.planning/phases`, `.planning/research`.
- Lockstep pairs:
  - `.github/workflows/hourly-crons.yml` `APP_URL` must equal `CANONICAL_APP_URL` in
    `scripts/run-hourly-crons.mjs`, byte for byte (both `https://prediabetespal.com` today);
  - the prompt-leak regex in `lib/pal/postprocess.ts` and `lib/pal/eval-rubric.ts` changes only
    together with the opening line of `lib/pal/prompt.ts`.
- Owner learnings:
  - **no synchronous selling** (sales/projects only);
  - the dashboard keeps the full shell by conviction;
  - the F-ASK ruling is settled; do not re-litigate it.
- Analytics stays a closed enum: never meal text, never an A1C or any health value.

## 10. Suggested first moves for the new session

1. Confirm nothing moved:
   ```bash
   cd /home/tefera/Desktop/Revora && git fetch origin && git log --oneline -3 origin/main
   gh pr list --limit 20
   for n in 145 146 147; do gh pr checks $n | awk -F'\t' '{print $2}' | sort | uniq -c; done
   curl -sS https://prediabetespal.com/api/health | jq -c '{status, door: (.guideDoor|to_entries|map(.value)|unique)}'
   ```
2. Ask the user, in one message, for decisions 1–5 and 10 in §7.
3. With approval: §3 A → §3 B (migration) → C (#145) → D (#146) → E (#147), with production
   checks after each merge; then F and G.
4. Only after Level 1 is done and the user asks: plan PR-4. It is gated on the owner's ratio
   read, which needs `ideas` live (§5), so confirm that read exists first.
