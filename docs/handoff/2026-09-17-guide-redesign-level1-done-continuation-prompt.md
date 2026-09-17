You are continuing the Prediabetes Pal **guide redesign** in `/home/tefera/Desktop/Revora`.

- **Plan:** `docs/superpowers/plans/2026-09-13-guide-redesign.md` (reviewed and approved).
  - Inline "review A-nn" notes supersede the text they annotate.
  - The Decision Audit Trail A-01…A-121 is at the end.
  - The status update (80 ticked boxes, gate cells) is in PR #151, which is **not merged yet**.
- **Spec:** `PRD/Prediabetes_Pal_Guide_Redesign_PRD_v1.1.md`, **as tracked on `main`**. The spec wins any conflict.
  - The older untracked copy was moved to `~/revora-untracked-backup/`.
- **Earlier handoffs:**
  - `docs/handoff/2026-09-17-guide-redesign-pr1-merged-migration-0019-pending-session-handoff.md`: the previous continuation prompt; full Level 2/3 detail.
  - `docs/handoff/2026-09-16-guide-redesign-four-prs-open-merge-blocked-session-handoff.md`: history.
  - `docs/handoff/2026-09-15-guide-redesign-pr2-pr3-continuation-prompt.md`: PR-2/PR-3 rulings and traps.
  - All three are committed on the #151 branch; until #151 merges they exist only on that branch.
- **SDD ledger (git-ignored):** `.superpowers/sdd/2026-09-13-guide-redesign/progress.md` records this session step by step.

## Hard rules for this session

1. **Never do any of these without the user's explicit OK in this session:**
   - push, merge or force-push;
   - run a production migration;
   - change a CI or security gate (including `.gitleaksignore`), GitHub repo settings or secrets, or a Vercel environment variable;
   - redeploy production.

   Standing rule: "Never push or merge without asking." Approval from an earlier session does not carry over.
2. **Never run `npm run eval:pal:ideas` yourself.** It makes ~1,440 live model calls (~$15). It is an owner action.
3. **Copy-ledger rows:** never set a row to `Approved`, and never change an existing row's Copy or Status cell. New user-facing strings get a new row filed `Pending | Yes`.
4. **Never propose or perform switching `NEXT_PUBLIC_GUIDE_DOOR` on in production.**
   - Production never carries the value `1`.
   - It carries an explicit surface list, and only after that list's gates are met (§5).
5. **Every user-visible change goes behind `guideDoorEnabled("<surface>")`,** server side too.
6. **Next.js here is 16.3 with breaking changes.** Read `node_modules/next/dist/docs/` before touching a Next API.
7. **Credentials: never print, echo or paste one.** This session leaked two production passwords into the transcript (§2.3). So:
   - Never print a raw `pg`/drizzle error: redact `user:pass@` first.
   - Never `source` or `.` an env file that holds a URL: `&` in `?sslmode=require&channel_binding=require` backgrounds the assignment, and bash job control echoes it. Load such files with `node --env-file=FILE`, or read a bare-URL file from Node.
   - Never `cat` a credential file. Inspect only its shape: key names, scheme, user, host, password length.
   - Never ask the owner to paste a URL into the chat.
   - If a credential does leak, stop and tell the user. Rotate it before anything else.

(The previous prompt's rules 7 and 8 are resolved. The main checkout is unblocked, and `feat/guide-redesign` has been merged and deleted.)

---

## 0. Status in one paragraph

**Level 1 ("shipped dormant") is done.**
- PR-1 (#144), migration 0019 (#145), PR-2 + PR-3 (#146) and the first-week finish (#147) are merged and deployed to production with every guide surface `off`.
- Migration 0019 was applied to the production database before #145 merged; the governance check reports 20/20.
- Two production database passwords leaked into the session transcript. Both are rotated: the agent did the runtime role, the owner did `neondb_owner`. Backups were verified with the new owner secret.
- PR #151 (docs: plan status, handoffs, safety-owner draft, two TODOS) is open, green and waiting for the owner's OK.
- **Still open for the owner:**
  - the three sign-in production checks;
  - sending the safety-owner submission (drafted, not sent);
  - merging #151;
  - reviewing the Neon integration's `NEON_*` variables in Vercel.
- **Not started:** PR-4, PR-5, PR-6 and every gated module. They wait on Level 2 (§5): nothing may go live until D5, the ledger approvals and the label eval.
- No human has reviewed any guide PR on GitHub.

---

## 1. Where things are (verified 2026-09-17 ~14:46 UTC)

### Checkout

| Path | Branch @ head | Notes |
|---|---|---|
| `/home/tefera/Desktop/Revora` (the only worktree) | **`docs/guide-redesign-level1-status` @ `ccafabf`** (= #151's head, = remote) | Not on `main`. `origin/main` is `a4b76ed`. Uncommitted local edits (not this work's): `CLAUDE.md` (the `next dev` block), `.planning/STATE.md`, `app/(app)/privacy/page.tsx` ("Railway-hosted" → "Neon-hosted Postgres"), `docs/legal/counsel-brief.md`, `docs/ops/env-reference.md` (four rows from "audit 2026-09-05 doc reconcile"; the duplicate `PAL_LIVE_EVAL` row was dropped this session). `docs/release/truth-index.md` was **restored** (owner's call). |

The `guide-pr23` and `guide-redesign` worktrees were **removed** this session.

### Branches (guide work)

| Branch | State |
|---|---|
| `feat/guide-redesign`, `feat/guide-pr23`, `feat/guide-orient-finish`, `chore/migration-0019-profile-orientation` | **Deleted** locally and on GitHub; each was verified to be contained in `origin/main` first |
| `docs/guide-redesign-level1-status` | #151's branch, local + remote @ `ccafabf` |
| `feat/app-shell-dashboard` | `9bc5cf3`, local only (its configured upstream no longer exists on origin). Not in `main`; `main`'s same-titled commit `4be486c` has a different patch. Owner decides whether to delete. |

The repo also holds about 60 other stale local branches from earlier work. They are not this work's to touch.

### Merged guide PRs

| PR | Merge commit | Head merged (pinned) | Main push CI | Production |
|---|---|---|---|---|
| #144 PR-1 | `78798b8` | `7d1d6d5` | green | dormant |
| #145 migration 0019 | `2fced06` (13:43Z) | `6347d8f` | green (6/6) | dormant; checks passed |
| #146 PR-2 + PR-3 | `88f9f7a` (13:53Z) | `fd07c5f` (update-branch merge of `2fced06`) | green (6/6) | dormant; checks passed |
| #147 first-week finish | `a4b76ed` (14:05Z) | `5cd2138` (update-branch merge of `88f9f7a`) | green (6/6), run 35231304392 | dormant; checks passed |

### Open PRs

| PR | State | Note |
|---|---|---|
| **#151** docs(guide): Level 1 shipped dormant | **CLEAN, 11/11 pass**, head `ccafabf74547ef715dd8f7ed1ba49efe8a02d419` | Plan status line (2026-09-17, `a4b76ed`); gate cells Ledger batch 1 "Filed, Pending", Ledger batch 2 "Filed, Pending — 18 rows"; F-CALM colour stays **Open**; 80 boxes ticked (1.1–1.9: 49, 2.1–2.4: 9, 3.1–3.8: 21; 4.2 has none); Task 4.1 marked "built (in PR-1), not run". Adds the 09-15/09-16/09-17 handoffs, the safety-owner draft and two TODOS (A-13, A-14). Its first secret scan hit two `generic-api-key` false positives (handoff lines quoting the `STATE_KEY` constant); the lines were reworded, the commit amended and force-pushed (`daf59ef` → `ccafabf`). **Not merged; needs the owner's OK.** |
| #137, #138, #140, #141, #142, #143, #148, #150 (dependabot) | 8 pass / 1 skipping, **behind `main` by 46** | Under `strict`, each needs a rebase (`@dependabot rebase` comment, or update-branch) before it can merge. Mergeable on the owner's word. |
| #111 typescript 6 → 7 | 1 fail, behind 46 | Lint: typescript-eslint does not support TS 7. |
| #128 eslint 9 → 10 | 1 fail, behind 46 | Lint: `react/display-name` loader error. |
| #133 ops: hourly-crons heartbeat | behind 76 | Needs update-branch (a push; ask first). |
| #134 billing: pricing (draft) | behind 76 | |
| #135 docs: owner decisions B/C, truth-index C7 | behind 76 | Edits `docs/release/truth-index.md` (restored locally; no conflict now). |
| #136 research: cohort retention report | behind 76 | |

### Required checks on `main` (branch protection, `strict: true`)

- `typecheck · lint · contract · build`
- `unit · evals (mock — no keys, no spend)`
- `playwright (incl. axe a11y)`
- `secret scan`
- `playwright (incl. axe a11y) · guide door 1`
- `playwright (incl. axe a11y) · guide door ideas,source`

### Production (https://prediabetespal.com)

- **Deployment:** `prediabetespal-q9l0xev5z` (a redeploy of `a4b76ed` carrying the rotated `DATABASE_URL`), aliased to prediabetespal.com.
- **`/api/health`:** `{"status":"healthy","db":"ok","issues":[]}`, and every one of the 12 `guideDoor` surfaces is `off`. The morning's cron-staleness 503 has cleared for now, but GitHub still fires `hourly-crons.yml` irregularly (§7 item 11).
- **Pages:** `/home`, `/home?stay=1`, `/check` and `/check?stay=1` return 200 with no `ideas-block`; `/learn/first-week` returns 404.
- **Label cache:** `lib/pal/guide-ideas.labels.json` does not exist (the label eval has not run), so the production guard would drop `ideas` even if the variable were set.

### Database (Neon project `dry-shadow-56131409`, database `neondb`)

- **Migration 0019** is applied: `profiles.orientation jsonb` exists, and `drizzle.__drizzle_migrations` has 20 rows (last `created_at` `1789458851856`).
- **`npm run db:governance:check`:** every field true, 20/20.
- **Runtime role `prediabetespal_app`:** password rotated by the agent (48-hex). The new URL is in Vercel `DATABASE_URL` (Production, Sensitive).
- **Owner role `neondb_owner`:** password reset by the owner in the Neon console. The pre-reset password is rejected (`28P01`).
- **Stale after the reset:**
  - `.env.local` `NEON_*` (it holds the pre-reset owner URL);
  - the Vercel Neon-integration `NEON_*` variables (Production, Preview and Development, **Non-sensitive**).

  No tracked code reads `NEON_*`.
- **Backups:**
  - GitHub secret `DB_BACKUP_URL` was updated by the owner (2026-09-17T14:40:21Z) with the new direct owner URL.
  - `db-backup.yml` run 35235359808 (manual, 14:42Z) succeeded with it.
  - Scheduled run 35217749174 (11:49Z) succeeded; it was the pre-migration backup.
- **Credentials on this machine:** none. `.env.migrate.local` and every temp copy were deleted. `.envprod` and `.env.probe` still hold `DATABASE_URL=""`.

### Backups outside the repo
`~/revora-untracked-backup/`:
- `app-shell-dashboard-scratch/`;
- `Prediabetes_Pal_Guide_Redesign_PRD_v1.1.md` (the old untracked copy, before the A-93/A-95 amendments);
- `env-reference-local.patch`.

---

## 2. What has been done

### 2.1 Before this session
- **09-13:** plan written from PRD v1.1 (six Tier-1 PRs behind one build flag, plus gated modules and Tier-2/3 modules).
- **09-14:** `/autoplan` review (surface-listed flag, production guard, label eval as the flip gate).
- **09-15/16:**
  - #144, #145, #146 and #147 built;
  - 26 ledger rows filed `Pending` (8 in batch 1, 18 in batch 2);
  - secret-scan false positive fixed with `.gitleaksignore`;
  - two flag-on legs made required;
  - #144 merged (`78798b8`).

### 2.2 This session (2026-09-17), in order
1. **Verified the previous handoff against live state.** Nothing had moved.
2. **§3 A: unblocked the main checkout** (owner OK):
   - removed the untracked plan copy (byte-identical);
   - moved the old PRD copy to the backup directory;
   - saved the local `env-reference.md` edit as a patch;
   - fast-forwarded `76eab01` → `78798b8`;
   - re-applied the patch unstaged and dropped the duplicate `PAL_LIVE_EVAL` row.
3. **Safety-owner submission drafted** (owner: "not sent yet"): `docs/handoff/2026-09-17-safety-owner-submission-draft.md`. It is spot-checked against the ledgers and plan.
   - It sources the medication/allergy amendment drafts from `docs/audit/2026-09-15-calm-tone-audit.md`.
   - W-05 backlog: 15 live rows.
4. **Migration 0019** (owner chose B1, then asked the agent to "just do it yourself"):
   - **Attempt 1:** literal placeholders were pasted → "must be a valid PostgreSQL URL". Nothing ran.
   - **Attempt 2** (real URLs): drizzle-kit exited 1 with no message.
     - Root cause, found and reproduced: drizzle-kit 0.31.10 `renderWithTask` (`node_modules/drizzle-kit/bin.cjs:1457`) catches the error, `MigrateProgress` renders the spinner for `rejected`, and the process exits 1. The error is discarded.
     - drizzle-orm applies pending migrations in one transaction (`pg-core/dialect.js:44`), so nothing was committed.
   - **Diagnostic runs:**
     - The pasted values lacked `postgresql:`. `pg-connection-string` 2.14 then reads `//…` as a Unix socket and throws `EINVAL`, and **the agent's script printed that error, which contained both full URLs** (leak 1).
     - The next run sourced an env file with unquoted `&`, and **bash echoed both assignments** (leak 2).
     - Both scripts were then fixed: a scheme check, redaction, and `node --env-file`.
   - **Real root cause of every connect failure:** Node 24's happy-eyeballs per-address timeout (250 ms) is shorter than this machine's connection time to Neon. The result is `AggregateError ETIMEDOUT` (IPv4 times out, IPv6 `ENETUNREACH`) although TCP 5432 is open. Fix: `NODE_OPTIONS=--network-family-autoselection-attempt-timeout=5000`.
   - **Applied by the agent:**
     1. Backup verified (run 35217749174).
     2. Diagnostic: both roles connect; column absent; only 0019 pending; a trial `ALTER` inside `BEGIN`/`ROLLBACK` succeeds.
     3. Governance pre-check: all true except `migrationJournalComplete` (19/20).
     4. `PAL_DB_ENV=production node --env-file=<0600 copy> node_modules/drizzle-kit/bin.cjs migrate` exited 0 ("migrations applied successfully").
     5. Governance post-check: all true, 20/20; column present; production `db ok`.
   - The migration used the **direct** owner host, not `-pooler`; the env-file quoting was normalised in a private 0600 copy.
5. **#145 merged** (`2fced06`, pinned `6347d8f`) → deploy success → agent production checks passed.
6. **#146:**
   - retargeted to `main`;
   - update-branch → `fd07c5f`, 11/11 green, no drizzle/schema diff against `main`;
   - merged (`88f9f7a`) → deploy success → checks passed.
7. **#147:**
   - retargeted;
   - update-branch → `5cd2138`, 11/11 green;
   - merged (`a4b76ed`) → deploy success → checks passed.
   - The main checkout was then fast-forwarded to `a4b76ed` (no collisions).
8. **Main push CI:** green for all three merges.
9. **Runtime password rotated** (owner chose "agent does it"). Order, chosen to keep the outage to seconds:
   1. `vercel env update DATABASE_URL production --sensitive --yes < <file>`;
   2. `vercel redeploy https://prediabetespal-b8yhaluaj-tkiros-projects.vercel.app --target production` → `q9l0xev5z`, Ready in 2 min;
   3. `ALTER ROLE prediabetespal_app WITH PASSWORD '<48-hex>'` over the owner connection.

   Result: the new URL logs in, the old one gets `28P01`, and `/api/health` showed `db ok` five times over 30 s.
10. **Owner password:** reset by the owner in the Neon console; `DB_BACKUP_URL` updated by the owner in GitHub. The agent verified that the pre-reset owner URL gets `28P01` and that a manual backup succeeds.
11. **Cleanup** (owner OK): worktrees removed, four branches deleted (local and remote), `docs/release/truth-index.md` restored.
12. **Docs PR #151** (owner OK): subagent commit, verified by the controller → secret-scan false positive → reworded, amended, `--force-with-lease` push → 11/11 green.
13. **Learnings logged** to gstack: `neon-connect-node-autoselect-timeout`, `db-url-handoff-leaks`.
14. **Feedback draft queued** (model behaviour: unredacted connection error).

### 2.3 Rulings the agent made on the owner's behalf (review these)

| Ruling | Cost if wrong |
|---|---|
| Took "can you just do it yourself?" as approval for the agent to run the production migration | The owner wanted guidance only; a production schema change was made by the agent (additive, nullable column; reversible with `DROP COLUMN`) |
| Migration URL moved from the `-pooler` host to the direct host; quoting normalised in a private copy | None known |
| `NODE_OPTIONS=--network-family-autoselection-attempt-timeout=5000` for every DB command | None known |
| Rotation order: env update → redeploy → `ALTER ROLE` | A few seconds in which new connections from the new deployment could fail |
| Second `git pull --ff-only` of the main checkout (`78798b8` → `a4b76ed`) without a fresh OK | Local only |
| #151's false positive fixed by rewording two historical handoff lines plus amend/force-push, instead of adding fingerprints to `.gitleaksignore` | Two lines in historical handoffs reworded |
| Main checkout left on the #151 branch | Switching to `main` early would hide the committed handoffs until #151 merges |
| Deleted `.env.migrate.local` after the migration (as the B2 plan said) | None |

---

## 3. Exact actions — next (in order)

Every step marked *OK* needs the user's explicit approval in the new session.

### A. Confirm nothing moved (agent, read-only)
```bash
cd /home/tefera/Desktop/Revora && git fetch origin --prune && git log --oneline -3 origin/main
git status --short --branch | head -3
gh pr list --limit 25
gh pr checks 151 | awk -F'\t' '{print $2}' | sort | uniq -c
gh api repos/tkiros/prediabetes-pal/pulls/151 --jq '[.head.sha, .mergeable_state] | @tsv'
curl -sS https://prediabetespal.com/api/health | jq -c '{status, db, issues, door: (.guideDoor|to_entries|map(.value)|unique)}'
gh run list --workflow db-backup.yml --limit 2
```
Expect:
- `origin/main` at `a4b76ed`, unless the owner merged something;
- #151 `ccafabf`, `clean`;
- `door == ["off"]`, `db` ok;
- the 06:17 UTC scheduled backup on 09-18 succeeded with the new secret. **If it failed, tell the owner first.**

(`gh api` sometimes prints "error connecting to api.github.com"; wait a few seconds and retry.)

### B. Owner-side production checks (owner; the agent cannot sign in)
After the #145/#146/#147 deploys and the password rotation:
1. Create a test account through onboarding (exercises `POST /api/profile` and the new `orientation` column path).
2. Download the account export; it must succeed.
3. Change a reminder setting (reminder-settings PATCH).
4. Sign in with a real account (proves the rotated runtime credential on the auth path).

Record the result in the ledger or the next handoff.

### C. Merge #151 — *OK*
```bash
gh api -X PUT repos/tkiros/prediabetes-pal/pulls/151/merge -f merge_method=merge \
  -f sha=ccafabf74547ef715dd8f7ed1ba49efe8a02d419      # re-check checks + mergeable_state first
```
If `main` has moved (`mergeable_state` = `behind`), run update-branch first (a push, *OK*) and wait for 11/11:
```bash
gh api -X PUT repos/tkiros/prediabetes-pal/pulls/151/update-branch -f expected_head_sha=ccafabf74547ef715dd8f7ed1ba49efe8a02d419
```
Then return the main checkout to `main` and delete the branch (*OK* for the remote delete):
```bash
cd /home/tefera/Desktop/Revora
git switch main && git pull --ff-only origin main        # the handoff files come back with the pull
git branch -d docs/guide-redesign-level1-status && git push origin --delete docs/guide-redesign-level1-status
```
- The local uncommitted edits (`CLAUDE.md`, `.planning/STATE.md`, privacy page, counsel brief, env-reference) do not overlap #151's files, so the switch carries them.
- This file (untracked) stays in place. Commit it later (step G) or add it to #151 before merging (a push, *OK*).

### D. Send the safety-owner submission (owner)
`docs/handoff/2026-09-17-safety-owner-submission-draft.md`:
1. Fill in `[turnaround: ____]` and send it.
2. Record "sent <date>" in the next handoff.

It covers:
- batch 1 (8 rows, #144);
- batch 2 (18 rows, #146/#147);
- dinner ideas #7/#8, which were composed rather than lifted;
- the two candidates for `check-classics-hint-guide`;
- the A-49 dietitian question (W-05 backlog: 15 live rows);
- `orientation-note-hint` ("safe");
- the A-61/Task 2.3 colour review at 375 and 1280;
- the calm-audit questions (medication/allergy drafts, the unledgered `proxy.ts` strings, the raw-hex error card);
- D7.

### E. Review the `NEON_*` exposure (owner)
- **What:** the Vercel Neon integration binds `NEON_PGUSER=neondb_owner`, `NEON_PGPASSWORD`, `NEON_DATABASE_URL`, `NEON_DATABASE_URL_UNPOOLED` and others to **Production, Preview and Development** as **Non-sensitive**. Anyone with project access can read them, and `vercel env pull` downloads them. That contradicts `docs/ops/env-reference.md` ("never bind the migration URL to Vercel").
- **Now:** they hold the **pre-reset** owner password, which is dead. The integration may re-sync them.
- **Action:** read the Neon/Vercel integration docs or ask Neon support whether the variables can be scoped down or made sensitive. Deleting integration-managed variables can break the integration. No tracked code reads them.
- **Also:** refresh or remove the stale `NEON_*` lines in `.env.local` if they're used for anything.

### F. Small ops/docs follow-ups (agent, each *OK*)
1. **`docs/runbooks/database-governance.md`:** add three notes:
   - set `NODE_OPTIONS=--network-family-autoselection-attempt-timeout=5000` for every DB command from a slow link;
   - drizzle-kit hides migrate errors, so run the governance check before and after, and use a redacted `pg` probe to see the real error;
   - use `node --env-file`, never `source`; the migration URL uses the direct host.

   Also record that `neondb_owner` passwords are reset in the Neon console (an SQL `ALTER ROLE` would be reverted by Neon's role sync) and that `DB_BACKUP_URL` must be updated with it.
2. **The `docs/runbooks/incident-2026-08-10-database-outage.md` pattern:** add a 2026-09-17 note, "two passwords printed to a transcript; both rotated the same day" (no values).
3. **The `hourly-crons` scheduler irregularity:** #133 plus an external or Vercel scheduler (owner decides).

### G. Commit this handoff — *OK*
Either add it to #151 before merging (a push) or put it in a later docs PR. First confirm it has no secrets:
```bash
gitleaks detect --no-git --redact --source docs/handoff/2026-09-17-guide-redesign-level1-done-continuation-prompt.md
```
- Install gitleaks 8.24.3 if it isn't there; the copy in the old job tmp directory is ephemeral.
- Never quote the `STATE_KEY` assignment line verbatim in docs; it trips `generic-api-key`.

### H. Non-guide PRs — *OK each*
- **Dependabot #137–#150 (eight green):** each is behind by 46. Comment `@dependabot rebase` (or update-branch), wait for green, then merge on the owner's word, one at a time, since each merge moves `main`.
- **#111 / #128:** close them, or leave them until typescript-eslint supports TS 7 and the React lint plugin supports eslint 10.
- **#133–#136:** behind by 76. Run update-branch so they report the six required checks, then the owner decides.

---

## 4. Safety-owner status
- **Batch 1:** `guide-ideas-breakfast`, `guide-ideas-lunch`, `guide-ideas-dinner`, `guide-ideas-hero`, `result-source-lead`, `check-empty-ideas`, `check-from-idea`, `check-classics-hint-guide`. All `Pending | Yes`.
- **Batch 2:** `orientation-intro`, `orientation-step-01` … `-07`, `orientation-day-eyebrow`, `orientation-controls`, `orientation-note-hint`, `orientation-save-failed`, `orientation-step-prefix`, `learn-first-week-intro`, `journey-where-you-are`, `onboarding-final-button`, `onboarding-first-week-line`, `orientation-signin-step`. All `Pending | Yes`.
- `landing-three-answers` (Approved) gained a treatment note only.
- **Status: drafted, NOT sent** (§3 D). Nothing is approved. The owner (never the agent) records approvals.

---

## 5. Level 2 — before any surface goes live (owner / safety owner; not code)

Unchanged from the previous handoff (§5 there has the full text).

**How switching on works:** set the Vercel variable `NEXT_PUBLIC_GUIDE_DOOR` to an explicit surface list, **then rebuild and redeploy**. It is not a runtime switch. The guard enforces rows and dependencies:
- `orient` needs `ideas`;
- `intake` needs `orient`;
- `home` needs `ideas` and `ideas-full`.

**Gates for everything**
1. **D5, the concierge test: not started.**
   - Read the r/prediabetes rules in a browser, send the plan's §5.3 draft, recruit 5, and add the neutral opener and the three counts.
   - Floor: ≥ 3 of 5 ask a second question. **Fewer than 3 of 5 ⇒ stop; the merged code stays dormant.**
   - The number-vs-food count picks the branch. Food order (§2.1) is the default. Number order (§2.2) applies if number questions outnumber food questions by more than 2:1 and D7 has a class.
2. **D7, for the safety owner / counsel, now** (it's in the draft): which claim class does a general A1C-education page fall under? If there's no class by branch-read day (the day D5 is read and the order chosen), F-NUMBERS is deferred.

**First flip: `ideas,source`** (plan §7.3 step 3). All of:
- batch 1 `Approved` + `Active`;
- `npm run eval:pal:ideas` **run by the owner**, green on the current `PROMPT_VERSION`, producing `lib/pal/guide-ideas.labels.json`;
- D5 passed;
- the revert rehearsed on a preview first (unset the variable, redeploy: about five minutes);
- a CI job that runs `scripts/check-production-config.ts`, or acceptance that the guard's first flag-on execution is a production build;
- D6: the landing's §3 line ships in the same deploy as this flip, never before (plan default: stay stale until the branch is read);
- the competitive-framing paragraph (A-44) written into PRD §11;
- the post-deploy checks (§7.3 step 7), in the first five minutes and again in the first hour:
  - `/api/health` `guideDoor`;
  - `/home?stay=1` at 375×667 shows the ideas and the CTA on screen;
  - an idea tap lands on `/check` with the idea in the field;
  - `ideas_shown` arrives in Umami within the hour.

**`calm`:**
- the safety owner's colour-blind and "does this look like a warning" review of the landing verdict cards at 375 and 1280 (A-61, Task 2.3);
- that review recorded in the `landing-three-answers` ledger note and in `DESIGN.md` §3;
- `landing-a11y.spec` green.

**`orient`:**
- the 18 batch-2 rows Approved;
- `ideas` live;
- **owner decision F-56:** `orientation_step_done` counts only Done taps, so it undercounts once A-84 auto-completes steps. Either redefine the read in `docs/ops/launch-controls.md` §13.4, or ask for a small PR that emits the event on auto-complete;
- the privacy page mentions first-week progress stored on the account. Note: the main checkout's uncommitted privacy-page edit is unrelated; don't mix them;
- D5 passed.

**Accepted exposure:** `dayKeyInTimezone` throws on a malformed stored timezone.

**Kill lines**
- **Kill line 2:** sessions with `idea_tapped` ÷ sessions where an ideas block rendered, per surface, below 25% after four weeks ⇒ flag off (reviewed rebuild), and the PRD is marked tested and closed.
- **F-ASK floor** (after PR-6): below 70% of the first 50 tour starts reach the attribution screen, and the drop sits on Screen A or B ⇒ Task 6.7.

---

## 6. Level 3 — remaining build work (not started)

| Item | Plan section | Tasks | Starts when |
|---|---|---|---|
| **PR-4** full F-IDEAS | §2.3 PR-4 | 4.3 segment steering (`pal.segment.v1`); 4.4 "See all" expands in place (row `guide-ideas-see-all`, surface `ideas-full`, `idea_tapped { slot: "more" }`); grow each daypart bank to ≥ 10 lines | The owner reads the ideas-viewed : checks-run counts once `ideas` is live (plan §8 item 2). **Confirm that read exists before planning.** |
| **PR-5** Home layout | §3 | 5.1 quick-action row; 5.2 `/learn` tiles; 5.3 door order (slot mechanism); 5.4 smoke; 5.5 hero copy (row `home-check-hero-title`) | After PR-4. Open question UC5: keep the four-item quick row, cut to three, or replace with one "Learn" link |
| **PR-6** intake + F-ASK | §4 | 6.1–6.6 (Screen A/B, response line, A1C step, smoke); 6.7 only if the floor fires | After PR-5 |
| F-NUMBERS `/learn/numbers` | §2.4.1 | page, copy pass, result-footer link; flip `LEARN_NUMBERS_HREF` in `lib/coach/orientation.ts` | D7 names a class |
| F-TREND "Your A1C over time" | §2.4.2 | `a1c_entries` table + migration, route, twin flag pair, erase/export, `/journey` section | D3 **and** RV-3 chosen; last in both branches |
| F-SOURCE `/how-it-works` paragraph | §2.4.3 | one paragraph + row `how-it-works-same-read` | Panel consistency run (every `stratum-*` meal × 3 bands, N ≥ 20, ≥ 95% modal class) logged in launch-controls §12 |
| F-REFER | §5.1 | static referral section on `/learn/first-week` | Safety owner clears its copy |
| F-DOCTOR / F-PLAN / F-HABIT / F-DIARY | §5.2 / §5.3 / §5.4 / §6 | — | D2 / D1 / Phase 5 / D4 |
| Retire the flag | §7.3 step 9 | one PR | Kill line 2 read at four weeks, and the door stays |
| F-56 metric PR (small) | launch-controls §13.4 | emit `orientation_step_done` on auto-complete | Owner chooses this over redefining the read |
| Follow-ups | `TODOS.md` (in #151) | A-13 result-card note; A-14 dismiss control on Home's step line | After PR-4's ratio read |
| Deferred minors | #144 / #146 descriptions and review reports | 27 (PR-1) + 34 triaged (PR-2/3) | Opportunistic |

**Future migrations** (F-TREND): follow `docs/runbooks/database-governance.md`, plus this session's traps (§8).
- Take a backup first.
- Run the governance check before and after.
- Use the direct owner host.
- Set `NODE_OPTIONS` (§8).
- Load URLs with `node --env-file`.
- Apply the migration before merging its PR.

---

## 7. Open decisions for the user

| # | Decision | Recommendation |
|---|---|---|
| 1 | Merge #151 (§3 C) | Yes: green, docs only |
| 2 | Owner-side production checks (§3 B) | Do them now; they're the only unverified part of Level 1 |
| 3 | Send the safety-owner submission (§3 D) | Now: it gates every flip |
| 4 | Start D5; ask D7 | Now, in parallel |
| 5 | `NEON_*` integration variables (§3 E) | Review scope and sensitivity with Neon's docs or support; don't delete blindly |
| 6 | Runbook notes on DB access and credential handling (§3 F.1–2) | Yes, one small docs PR |
| 7 | Commit this handoff (§3 G) | Yes, with #151 or the runbook PR |
| 8 | F-56 completion metric | Emit the event on auto-complete (small PR) |
| 9 | UC5 quick row (before PR-5) | Plan default: four items below the hero |
| 10 | Re-run `/plan-devex-review` to recover the missing DX findings (before PR-4) | Optional |
| 11 | Cron scheduler irregularity (`hourly-crons.yml` fires every 3–5 h; health goes 503 when a job is more than 2 h stale) | #133 plus a scheduler that actually runs hourly |
| 12 | Dependabot PRs; #111/#128; #133–#136 (§3 H) | Owner's call |
| 13 | `feat/app-shell-dashboard` (`9bc5cf3`, local only, not in `main`) | Compare it with `4be486c`, then delete |
| 14 | About 60 stale local branches | Optional prune after checking each is merged or abandoned |

---

## 8. Traps (new ones first; older lists: the 09-17 prompt §8, the 09-15 handoff §6)

### Database and credentials (new this session)
- **Neon connections from this machine time out** unless `NODE_OPTIONS=--network-family-autoselection-attempt-timeout=5000` is set, or `net.setDefaultAutoSelectFamilyAttemptTimeout(5000)` is called in a script.
  - Node 24 gives each address 250 ms. The link is slower, and IPv6 has no route.
  - The symptom is `AggregateError` with code `ETIMEDOUT` and an empty message, even though `bash -c '</dev/tcp/<host>/5432'` connects.
- **`drizzle-kit migrate` (0.31.10) never prints its error:** the spinner shows "applying migrations..." and it exits 1. Treat any exit other than 0 as a failure. It's safe to retry, because pending migrations commit in one transaction. Find the real error with a redacted `pg` probe.
- **`pg-connection-string` 2.14:** a value starting with `//` (the `postgresql:` scheme missing) is read as a Unix socket path, and the `EINVAL` error message contains the **whole URL including the password**.
- **Sourcing an env file with unquoted `&`** runs each line as a background job, and bash prints `[1] Done DATABASE_URL=…` with the value. The variables also end up unset. Use `node --env-file=FILE`.
- **Neon's pooled vs direct hosts:** the runtime `DATABASE_URL` uses the `-pooler` host. Migrations, backups and governance work use the **direct** host.
- **`neondb_owner` is console-managed:** reset its password in the Neon console; Neon's role sync reverts an SQL `ALTER ROLE`. `prediabetespal_app` was created in SQL, and `ALTER ROLE` over the owner connection works for it.
- **Rotating `neondb_owner`** also requires updating the GitHub secret `DB_BACKUP_URL` (direct owner URL). Otherwise the nightly `db-backup.yml` (06:17 UTC) fails.
- **Rotating `prediabetespal_app`** also requires updating Vercel `DATABASE_URL` and redeploying production:
  - `vercel env update DATABASE_URL production --sensitive --yes < file` (stdin keeps the value out of the process list);
  - then `vercel redeploy <current prod deployment URL> --target production`, not `vercel --prod`.
- **`/api/health` `db` is a real probe:** the pool's idle timeout is 10 s, so it opens fresh connections. Use it to check a rotation.
- **The session transcript JSONL** (`~/.claude/projects/-home-tefera-Desktop-Revora/<session>.jsonl`) does **not** contain text the user pasted. It can't show whether a leaked secret was rotated.
- **No Neon API key or `neonctl`** on this machine; Neon console actions are the owner's.

### GitHub, CI and tooling
- **gitleaks `generic-api-key`** matches the `STATE_KEY` assignment quoted in docs. Write it as "the `STATE_KEY` constant (value `pal.orient.v1`)". The CI scan runs `gitleaks detect --redact --log-opts=--no-merges --first-parent <base>^..<head>` (8.24.3).
  - To fix a flagged commit: reword it and amend (force-push the PR branch with `--force-with-lease=<branch>:<old sha>`, *OK*), or add exact fingerprints to `.gitleaksignore` (a security-gate change, *OK*).
  - Never add a broad allowlist to `.gitleaks.toml`.
- **`gh api` / `gh run list` sometimes print "error connecting to api.github.com".** Retry after about 5 s.
- **`gh pr checks` has no `--json` in this `gh`.** Parse the tab-separated columns with `awk -F'\t'`. `gh run list/view --json` works.
- **Failed-job logs:** `gh api repos/tkiros/prediabetes-pal/actions/jobs/<job-id>/logs`. The job id is the last path segment of the check link.
- **CI runs only on opened / synchronize / reopened.** A base retarget starts no run. Use update-branch, or close and reopen.
- **`strict: true`:** after every merge, the next PR is `behind`. Run update-branch, wait for green, then merge with a pinned SHA via REST. `gh pr edit` fails ("Projects (classic)"); retarget with `gh api -X PATCH …/pulls/<n> -f base=main`. Create PRs with `gh api repos/…/pulls -F body=@file`.
- **The local clock is correct.** It runs on EDT (UTC−4); the old "a day behind" note was a timezone misread. GitHub stamps are UTC.
- **Background waits:** wait on API state or file contents, never on `pgrep -f`.
- **Worktree path guard:** if the Bash cwd drifts into a worktree, Write/Edit refuses paths in the main checkout. None exist now.
- **gstack binaries** live at `~/.claude/skills/igstack/bin/`.
- **Codex CLI:** usage limit hit on 2026-09-14; expect single-voice reviews.
- **`next dev` rewrites `CLAUDE.md`.** Never commit that block.
- **Smoke tests:** never write the literal `NEXT_PUBLIC_GUIDE_DOOR` under `tests/smoke/`; use `doorSurfaceOn(surface)`. Run flag-on specs with `PAL_E2E_GUIDE_DOOR=1 npm run e2e -- tests/smoke/<spec>.ts`.
- **No local Postgres:** DB-backed smoke specs skip locally; that is the baseline.
- **Claims audit:** it skips lines that begin with a comment marker. The analytics no-PII scan reads only `lib/client/analytics.ts`. New analytics union members go before `photo_draft`.
- **The orientation egress pins are two-way.**
- **Verify end to end before asserting.** Trust files and API state over any claim, including this one.

---

## 9. Standing constraints (from the user and `CLAUDE.md`)

- **Keep these `revora` strings:**
  - `tests/unit/pal/owned-domains.test.ts` (denylist);
  - `tests/unit/pal/sw-dev-teardown.test.ts`;
  - the docstrings in `lib/pal/contact.ts` and `lib/server/email.ts`;
  - historical docs under `docs/handoff`, `docs/archive`, `docs/audit`, `docs/qa`, `PRD`, `predict`, `.planning/phases`, `.planning/research`.
- **Lockstep pairs:**
  - `.github/workflows/hourly-crons.yml` `APP_URL` must equal `CANONICAL_APP_URL` in `scripts/run-hourly-crons.mjs`, byte for byte;
  - the prompt-leak regex in `lib/pal/postprocess.ts` and `lib/pal/eval-rubric.ts` changes only together with the opening line of `lib/pal/prompt.ts`.
- **Owner learnings:**
  - no synchronous selling;
  - the dashboard keeps the full shell by conviction;
  - the F-ASK ruling is settled; do not re-litigate it.
- **Analytics stays a closed enum:** never meal text, never an A1C or any health value.
- **Project skill routing** (`CLAUDE.md`): bugs → `investigate`; ship → `ship`; review → `review`; and so on.

## 10. Suggested first moves for the new session

1. Run §3 A (read-only), including the 09-18 06:17 UTC backup result.
2. Ask the user, in one message, about §7 items 1–3, 5 and 6: merge #151? owner checks done? submission sent? `NEON_*` review? runbook PR?
3. With approval: §3 C (merge #151, return to `main`, delete the branch), then §3 F/G as one small docs PR.
4. Only when the user asks, and after confirming the ideas-viewed : checks-run read exists: plan PR-4 (§6). Otherwise the guide work waits on Level 2 (§5), which is owner and safety-owner work, not code.
