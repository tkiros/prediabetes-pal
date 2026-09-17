# Handoff: guide redesign — PR-1 to PR-3 built, four PRs open, merges blocked on a secret-scan false positive and migration 0019

*Written 2026-09-16. Supersedes nothing: it sits on top of
`docs/handoff/2026-09-15-guide-redesign-pr2-pr3-continuation-prompt.md`, which holds the
full PR-2/PR-3 ruling log (F-1 … F-56) and its traps list. Read that file's §4–§6 before
touching the orientation code.*

**What to paste into a new Claude Code session:** everything below the line.

---

You are continuing the Prediabetes Pal **guide redesign** in `/home/tefera/Desktop/Revora`.

> **Update 2026-09-17 (overrides §0, §1, §3 A/E/F and §7 items 1, 3, 4 below).**
> - §3 A done: `.gitleaksignore` committed on `feat/guide-redesign` (`7d1d6d5`); #146 re-triggered by
>   close/reopen. Both scan steps now report "no leaks found" on #144 and #146.
> - §3 E done: main's required checks now include both flag-on legs (six required checks).
> - §3 F done: **#144 merged** (merge commit `78798b8`). Production verified: `/api/health`
>   `guideDoor` shows all 12 surfaces `off`; `/home`, `/check` (± `?stay=1`) render no
>   `ideas-block`; `/learn/first-week` 404. `/api/health` is 503 `degraded` both before and
>   after the merge — four crons stale because GitHub fires `hourly-crons.yml` only every 3–5 h
>   against a 2 h threshold. It predates this work; separate ops issue.
> - **§3 C not done:** no production DB credentials exist on this machine (`.envprod` and
>   `.env.probe` hold `DATABASE_URL=""`; the migration URL is operator-only). The owner deferred
>   the migration. #145, #146 and #147 stay open until it is applied.
> - **#145 is now blocked** by `strict` plus the two new required legs: its `ci.yml` (from
>   `76eab01`) has no guide-door legs, so they never report. Fix (a push, needs OK):
>   `gh api -X PUT repos/tkiros/prediabetes-pal/pulls/145/update-branch`. Dependabot #138–#143
>   likewise need `@dependabot rebase`.
> - #146: all green, base still `feat/guide-redesign` by design — **do not delete that branch**.
>   After 0019: retarget (§3 G), update from main, merge. #147 unchanged.
> - §3 B not approved: the untracked plan and PRD v1.1 copies are still in the main checkout, and
>   the locally modified `docs/ops/env-reference.md` was also changed by #144, so `git pull`
>   there will refuse. The tested recipe is in the 2026-09-17 handoff, §3 A.
> - **Superseded:** for current status and next actions, read
>   `docs/handoff/2026-09-17-guide-redesign-pr1-merged-migration-0019-pending-session-handoff.md`.
> - §3 I partly done: `.claude/worktrees/app-shell-dashboard` removed. Its branch still exists at
>   `9bc5cf3`, local-only and **not** in main (main's same-named `4be486c` is a different patch).
>   Its untracked `.scratch/` was moved to `~/revora-untracked-backup/app-shell-dashboard-scratch`.
>   Deleting the branch is the owner's call.
> - `.claude/worktrees/guide-redesign` has a dirty `.planning/STATE.md` (GSD state from 09-14) —
>   not guide work; left alone.
> - §7 decisions 5–9 are still open (5: the `docs/release/truth-index.md` deletion was not raised;
>   nothing was committed from the main checkout).

- **Plan:** `docs/superpowers/plans/2026-09-13-guide-redesign.md` (3,539 lines, reviewed and
  approved; inline "review A-nn" notes supersede the text they annotate; the review record and
  the Decision Audit Trail A-01…A-121 sit at the end).
- **Spec:** `PRD/Prediabetes_Pal_Guide_Redesign_PRD_v1.1.md`. The spec wins any conflict.
- **Previous handoff (PR-2/PR-3 detail):**
  `docs/handoff/2026-09-15-guide-redesign-pr2-pr3-continuation-prompt.md`.

## Hard rules for this session

1. **Never push, merge, run a production migration, change a CI/security gate, or change
   GitHub repo settings without the user's explicit OK in this session.** Standing rule:
   "Never push or merge without asking."
2. **Never run `npm run eval:pal:ideas` yourself.** It makes ~1,440 live model calls
   (~$15). It is an owner action.
3. **Never set a copy-ledger row to `Approved`**, and never change an existing row's Copy or
   Status cell. New user-facing strings get a new row filed `Pending | Yes`.
4. **Never propose or perform switching `NEXT_PUBLIC_GUIDE_DOOR` on in production.**
   Production never carries the value `1`; it carries an explicit surface list, and only
   after that list's gates are met (§5).
5. Every user-visible change goes behind `guideDoorEnabled("<surface>")`, server side too.
6. Next.js here is 16.3 with breaking changes: read `node_modules/next/dist/docs/` before
   touching a Next API.

---

## 0. Status in one paragraph

The plan was reviewed end to end on 2026-09-14 (`/autoplan`: CEO, Design, Eng, DX) and
approved as-is. Since then **PR-1, PR-2 and PR-3 of the plan's six Tier-1 PRs have been
built, reviewed and pushed as four stacked pull requests (#144–#147). None is merged.**
Everything ships dormant behind the guide-door flag. Two things block merging: a gitleaks
**false positive** fails the required `secret scan` check on #144 and #146, and **migration
0019 must be applied to production before #145 merges.** PR-4, PR-5, PR-6 and every gated
module are **not started**. Going live with any surface is a separate, later step gated on
the owner and the safety owner (§5). No human has reviewed any of the four PRs on GitHub yet
(each has only the Vercel bot comment).

---

## 1. Where things are (verified 2026-09-16)

### Checkouts

| Path | Branch @ head | Notes |
|---|---|---|
| `/home/tefera/Desktop/Revora` | `main` @ `76eab01` (= `origin/main`) | Dirty — see "Main checkout" below. |
| `.claude/worktrees/guide-redesign` | `feat/guide-redesign` @ `60d1358` | PR-1 (#144). Kept for #144's review feedback. Clean. |
| `.claude/worktrees/guide-pr23` | `feat/guide-orient-finish` @ `7d7aa5e` | PR-2/PR-3 and the follow-up (#146, #147). Clean except the untracked 09-15 handoff (now also copied into the main checkout). |
| `.claude/worktrees/app-shell-dashboard` | `feat/app-shell-dashboard` @ `9bc5cf3` | **Unrelated and stale** — its PR #4 merged long ago. Candidate for removal, with the user's OK. |

Local branch tips equal their `origin/` tips for all four guide branches.

### Pull requests (all OPEN, no human reviews)

| PR | Branch → base | Head | What it is | Merge state | CI |
|---|---|---|---|---|---|
| **#144** | `feat/guide-redesign` → `main` | `60d1358` | PR-1: ideas on Home + `/check`, source lead-in, the surface-listed flag, the production door guard, analytics, CI legs (28 commits over `76eab01`) | BLOCKED | All green **except `secret scan`** (false positive, §3 A) |
| **#145** | `chore/migration-0019-profile-orientation` → `main` | `8949028` | Migration 0019: nullable `profiles.orientation jsonb`, plus the matching `schema.ts` line and `lib/coach/orientation.ts` (byte-identical to #146) | CLEAN | All green. **Apply to production before merging** (§3 C) |
| **#146** | `feat/guide-pr23` → `feat/guide-redesign` | `156bc20` | PR-2 (F-CALM, surface `calm`) + PR-3 (F-ORIENT "Your first week", surface `orient`) | UNSTABLE | All green **except `secret scan`** (same false positive) |
| **#147** | `feat/guide-orient-finish` → `feat/guide-pr23` | `7d7aa5e` | Finishes the week: day line replaces Home's date (F-30/F-35), A-83 sign-in line, A-84 steps complete where they happen | CLEAN | All green |

Required checks on `main` (branch protection): `typecheck · lint · contract · build`,
`unit · evals (mock — no keys, no spend)`, `playwright (incl. axe a11y)`, `secret scan`.
The two flag-on legs (`… · guide door 1`, `… · guide door ideas,source`) run but are **not
required** yet.

### Main checkout — uncommitted state (none of it is this work's to commit without asking)

| Path | State | What it is |
|---|---|---|
| `docs/superpowers/plans/2026-09-13-guide-redesign.md` | untracked | Identical to the copy tracked on #144's branch. **Collides with the pull once #144 merges.** |
| `PRD/Prediabetes_Pal_Guide_Redesign_PRD_v1.1.md` | untracked | **Older** than the copy tracked on #144 (the branch added the A-95 kill-line edit). Collides with the pull. |
| `PRD/Prediabetes_Pal_Guide_Redesign_PRD_v1.md` | untracked | Not tracked anywhere. Historical. |
| `TODOS.md` | modified | Two entries added by the 09-14 review (A-13 result-card "one of today's ideas" note; A-14 dismiss control on Home's step line). Not on any PR branch. |
| `CLAUDE.md` | modified (+10 lines) | The block `next dev` re-adds ("This is NOT the Next.js you know"). |
| `app/(app)/privacy/page.tsx` | modified | "Railway-hosted Postgres" → "Neon-hosted Postgres". Pre-existing, unrelated to the guide work. |
| `.planning/STATE.md`, `docs/legal/counsel-brief.md`, `docs/ops/env-reference.md` | modified | Pre-existing, unrelated. |
| `docs/release/truth-index.md` | **deleted** (whole `docs/release/` folder gone) | It was *modified* at the start of 2026-09-14 and is now deleted. Cause unknown. **Ask the user before committing anything that includes this deletion.** |
| `docs/handoff/2026-09-15-…-continuation-prompt.md`, this file | untracked | Handoffs. |
| many other `docs/**` files | untracked | Historical, pre-existing. |

---

## 2. What has been done

### 2026-09-13 — the plan
`docs/superpowers/plans/2026-09-13-guide-redesign.md` written from PRD v1.1: move the app's
front door from "judge my meal" to "guide me", in six Tier-1 PRs behind one build flag, plus
gated modules (F-NUMBERS, F-TREND, F-SOURCE paragraph) and Tier-2/3 modules.

### 2026-09-14 — `/autoplan` review (approved as-is at the final gate)
- Four phases at full depth: CEO (SELECTIVE EXPANSION), Design (7 passes), Eng, DX.
  ~120 inline amendments, new PR-1 Tasks 1.10–1.14, audit rows A-01…A-121, user challenges
  UC1–UC5 (owner's rulings recorded). Premise gate and final gate both answered "A".
- Key decisions now in the plan: the flag is **surface-listed**
  (`GUIDE_SURFACES = ideas, source, calm, orient, home, intake, ideas-full, numbers, refer,
  doctor, plan, guide`; `1` = all, dev/e2e only); a **production guard** ties each surface to
  its ledger rows; the **label eval gates the flip** and stale labels close `ideas` at build
  instead of throwing; ideas render as **full-width rows**, not chips; the fold is measured
  against the tab bar; one orientation start rule (`startedAt`); op-based server-merged
  PATCH; kill line 2 is read as **tapped**, not shown (A-95/UC1); the day-2 paywall default
  is the **sign-in line** (A-83).
- Review concerns left open: Codex hit its usage limit, so Eng and DX ran on one voice;
  **the DX reviewer's report was truncated after its fifth finding and never recovered**; the
  design mockup tool failed on API auth.
- Artifacts: restore point
  `~/.gstack/projects/Revora/main-autoplan-restore-20260914-022800.md`; CEO plan
  `~/.gstack/projects/Revora/ceo-plans/2026-09-14-guide-redesign.md`; test plan
  `~/.gstack/projects/Revora/tefera-main-eng-review-test-plan-20260914-054030.md`; review
  logs in `~/.gstack/projects/Revora/main-reviews.jsonl` (so `/ship` recognises the reviews).

### 2026-09-15/16 — PR-1 built → #144
- **Ideas** (`components/guide-ideas.tsx`, `lib/pal/guide-ideas.ts`): three daypart ideas
  above Home's check hero, eight lines per daypart, rotating; a tap prefills `/check`
  (`/check?stay=1`), no check runs until submit. Below 375px two rows, three from 375 up.
- **Source lead-in** on the result card (surface `source`).
- **`/check` first-run empty state** gets an ideas row and a "From today's ideas." hint
  (Task 1.14 = plan Task 4.2).
- **Flag** `lib/guide-door-flag.ts`; **guard** `lib/guide-door-guard.ts`, called from
  `next.config.ts` only when `VERCEL_ENV === "production"`: throws on `1`, unknown surface,
  missing requirement, or a surface whose rows are not `Approved` + `Active`; warns and drops
  `ideas`/`ideas-full` (and dependents) when labels are stale or missing.
- **Analytics:** `ideas_shown`, `idea_tapped`, `idea_check_completed`, `onboarding_step`
  (closed enum; no meal text, no A1C).
- **Label eval** script (`npm run eval:pal:ideas`) and its unit gate — **built, not run**;
  `lib/pal/guide-ideas.labels.json` does not exist yet.
- **CI:** three e2e legs (flag off, `PAL_E2E_GUIDE_DOOR=1`, `ideas,source`); a flag-on run
  fails rather than skips if `/api/health` does not report the surface on.
- **Ops docs:** `docs/ops/launch-controls.md` §13 (the door's reads, kill line 2, prune
  trigger).
- Verification at `60d1358`: lint 0 errors, typecheck clean, `npm test` 2344 passed / 51
  skipped, contract 9/9, smoke flag-on 336/28, flag-off 316/48 (passed/skipped).
- 27 minor per-task review findings deferred with reasons (e.g. no `:focus-visible` outline
  on idea rows, possible double announce on the ideas list, duplicated labels-file reading in
  `next.config.ts` and `scripts/check-production-config.ts`).

### 2026-09-15/16 — PR-2 + PR-3 → #146, migration → #145, follow-up → #147
Full detail, every ruling and every trap: the 09-15 handoff. Summary:
- **PR-2 F-CALM:** `:root[data-calm]` re-tokens `--high-*` to neutral ink (AA: 13.35:1,
  11.87:1); calm-tone audit `docs/audit/2026-09-15-calm-tone-audit.md` (Tasks 2.3/2.4 recorded
  as proposals); a claims-boundary regex for "the product will help you manage…" (known gap:
  "will help you manage" does not match).
- **PR-3 F-ORIENT:** `lib/coach/orientation.ts` (seven steps, day math from `startedAt`);
  guest store `pal.orient.v1`; `profiles.orientation` written only by op-based PATCH
  (`markDone`, `start`, `dismiss`, `restore`, `set`), merged in SQL; Home shows the day and
  "Today's step: …"; `/learn/first-week` (404 flag-off); `/journey` "Where you are"; tour
  hands off to the week; guest→account migration; the clinician-questions note never leaves
  the device (pinned both ways). 17 ledger rows filed `Pending`.
- **#145:** migration-only would fail CI's drift gate, so it also carries `schema.ts` and
  `lib/coach/orientation.ts`, byte-identical to #146.
- **#147:** Home's single `<h1>` reads "Day N of your first week" during a week (fold slack
  65.8 / 19.9 / 19.9 px at 360 / 375 / 430; guest shift 0.00px); A-83 "Sign in to keep your
  week going" for an expired-taster guest (row `orientation-signin-step`, `Pending`); A-84
  `recordStepEvent` + `markNext` PATCH op completes steps 1, 2, 3, 4, 5, 7 where they happen
  (step 6 stays toggle-only until F-REFER). `npm test` 2617 passed / 51 skipped.

---

## 3. Exact actions — Level 1: "shipped dormant" (every PR merged, flags off, production healthy)

Do these **in this order**. Each needs the user's OK where marked.

### A. Clear the secret-scan false positive — needs the user's OK (security gate)

- gitleaks rule `generic-api-key` matches the `STATE_KEY` constant (value `pal.orient.v1`) — a
  localStorage key name, not a secret. Verified: both fingerprints below point at exactly that
  line. The matches are in commit history, so renaming the constant does not clear them.
- Fix: create a root-level `.gitleaksignore` on **`feat/guide-redesign` (#144's branch)**
  containing exactly:
  ```
  6a4fff04bd8bf5f92b864e3747cd51820253fc6d:docs/superpowers/plans/2026-09-13-guide-redesign.md:generic-api-key:1616
  ead511b513cf692d8cf41011352d06fd0a78973b:lib/client/orientation-store.ts:generic-api-key:15
  ```
  No `.gitleaksignore` exists on any branch today. PR checks run on GitHub's merge commit, so
  #146 inherits the file from its base once #144's branch carries it.
- Work in `.claude/worktrees/guide-redesign` (coordinate: that checkout is kept for #144's
  review). Commit message suggestion:
  `ci(secret-scan): ignore two false positives — a localStorage key name, not a secret`.
- Push (with OK), then re-run the `secret scan` job on #144 and #146 and confirm both pass:
  ```
  gh pr checks 144
  gh pr checks 146
  ```
  (Re-run from the Actions UI or `gh run rerun <run-id> --failed`.)
- **Do not** add a broad regex allowlist to `.gitleaks.toml`; its comments explain why its
  allowlist is scoped to single commits.

### B. Before anyone pulls `main` after #144 merges — move the untracked copies aside

In the main checkout, the untracked plan and PRD v1.1 collide with the tracked copies #144
brings. The plan is identical; the PRD on the branch is newer. With the user's OK:
```
mkdir -p /tmp/revora-untracked-backup
mv docs/superpowers/plans/2026-09-13-guide-redesign.md /tmp/revora-untracked-backup/
mv PRD/Prediabetes_Pal_Guide_Redesign_PRD_v1.1.md /tmp/revora-untracked-backup/
```

### C. Apply migration 0019 to production — owner, production credentials, before #145 merges

Merging #145 deploys a `schema.ts` that names the column. Drizzle lists every column in an
INSERT, so without the column onboarding's `POST /api/profile` and the account export fail —
**with the flag off**. Applying early is safe (nothing on `main` names the column).
```
git checkout chore/migration-0019-profile-orientation
PAL_DB_ENV=production npm run db:migrate:production   # ALTER TABLE "profiles" ADD COLUMN "orientation" jsonb;
npm run db:governance:check                            # must pass — run it from THIS branch
```
Needs `DATABASE_URL` and `DATABASE_MIGRATION_URL` on **different database roles**
(`lib/server/db/config.ts`). Do **not** run `db:governance:check` from `main` between applying
and merging: `main` lacks the 0019 file and will report a mismatch.

### D. Merge #145 (merge commit) — with OK

Vercel deploys production. Verify:
1. create a test account through onboarding (exercises `POST /api/profile`);
2. download the account export — it must succeed;
3. `/learn/first-week` returns 404 (flag off).

### E. Optional but recommended before merging #144 — with OK (repo settings)

Make the two flag-on e2e legs required checks:
`playwright (incl. axe a11y) · guide door 1` and
`playwright (incl. axe a11y) · guide door ideas,source`.

### F. Merge #144 (PR-1) — **merge commit, never squash** — with OK

A squash forces rebasing both stacked branches:
```
git rebase --onto origin/main 60d1358 feat/guide-pr23
git rebase --onto feat/guide-pr23 156bc20 feat/guide-orient-finish
```
then re-run the gates and force-push (only with OK).

Verify production after deploy: `GET /api/health` → `guideDoor` shows **every surface
`off`**; Home and `/check` look exactly as before.

### G. Retarget and merge #146 — with OK

```
gh api -X PATCH repos/tkiros/prediabetes-pal/pulls/146 -f base=main
```
(`gh pr edit` fails in this repo with a "Projects (classic)" GraphQL error.) #146's diff still
lists #145's five files; they are byte-identical, so the merge is clean. Wait for CI green,
merge with a merge commit. Verify production: onboarding, export, the reminder-settings PATCH,
Home unchanged with the flag off.

### H. Retarget and merge #147 — with OK

```
gh api -X PATCH repos/tkiros/prediabetes-pal/pulls/147 -f base=main
```
CI green → merge commit → repeat G's production checks.

### I. Cleanup — with OK

- `git worktree remove .claude/worktrees/guide-pr23` (after #147 merges).
- `git worktree remove .claude/worktrees/guide-redesign` (after #144 is done **and** the user agrees).
- `.claude/worktrees/app-shell-dashboard` is stale (PR #4 merged) — ask before removing.
- Delete the merged remote branches.
- Decide what to do with the main checkout's dirty files (§1), especially the unexplained
  `docs/release/truth-index.md` deletion, and whether to commit this handoff, the 09-15
  handoff, and the two `TODOS.md` entries.

### J. Bring the plan's own status up to date (small docs PR, optional)

The plan still says "Status as of 2026-09-13" in §1 and none of its 89 checkboxes are
ticked. After the merges: tick Tasks 1.1–1.14, 2.1–2.4, 3.1–3.8 and 4.2; mark Task 4.1 "built,
not run"; update the §1 gate table rows (Ledger batch 1 "Filed, Pending"; Ledger batch 2
"Filed, Pending — 18 rows"; F-CALM colour "Open").

---

## 4. Safety-owner submissions — send now (the PRs are open)

**Batch 1 (#144), 8 rows, all `Pending`:** `guide-ideas-breakfast`, `guide-ideas-lunch`,
`guide-ideas-dinner`, `guide-ideas-hero`, `result-source-lead`, `check-empty-ideas`,
`check-from-idea`, `check-classics-hint-guide`.
- Dinner ideas #7 and #8 were composed from the "What can I eat freely?" list in
  `app/guides/what-to-eat-with-prediabetes`, not lifted from a guide sentence — flagged in the
  row's Notes; they need a safety read.
- The classics hint has two candidate wordings: the plan's "Or try a classic — foods whose
  read surprises people." and the shipped "Or try a classic — three everyday foods." (audit
  AUD-017 removed prevalence framing from the sibling row). The safety owner picks.

**Batch 2 (#146 + #147), 18 rows, all `Pending`:** `orientation-intro`,
`orientation-step-01` … `orientation-step-07`, `orientation-day-eyebrow`,
`orientation-controls`, `orientation-note-hint` (contains the word "safe" — flagged),
`orientation-save-failed`, `orientation-step-prefix`, `learn-first-week-intro`,
`journey-where-you-are`, `onboarding-final-button`, `onboarding-first-week-line`,
`orientation-signin-step`.
- `landing-three-answers` (Approved) gained a treatment note only; text unchanged.
- F-REFER did not ride along with PR-3.

**Calm-audit questions for the safety owner:**
- drafted amendments for `clinical-medication-dosing` and `clinical-allergy` (rows unchanged,
  `PENDING` W-05);
- `proxy.ts` rate-limit/outage copy (`RATE_LIMIT_COPY`, `URGENT_CARE_LINE`,
  `ABUSE_LIMIT_COPY`) has no ledger row;
- `.status-card[data-state="error"]` uses raw hex colours outside the token families.

**Also decide with batch 1:** whether the idea bank waits for a dietitian pass (taste
decision A-49), given the W-05 backlog (15 live rows still `PENDING RD/CDCES`) in the same
queue. Agree a review turnaround.

---

## 5. Level 2 — before any surface goes live (owner / safety owner; not code)

Switching on = change the Vercel env var `NEXT_PUBLIC_GUIDE_DOOR` to an explicit surface list,
**then rebuild and redeploy** (it is not a runtime switch). The guard enforces rows and
dependencies (`orient` requires `ideas`; `intake` requires `orient`; `home` requires `ideas`
and `ideas-full`).

**Gates for everything**
1. **D5 — the concierge test.** Nothing records it as started. Read the r/prediabetes rules
   in a browser, send the §5.3 draft, recruit 5, add the neutral opener and the three counts.
   Floor: ≥ 3 of 5 second questions. **< 3 of 5 ⇒ stop; the merged code stays dormant.** The
   number-vs-food count picks the branch (plan §2.1 food order is the default; §2.2 number
   order if number questions outnumber food > 2:1 and D7 has a class).
2. **D7 — ask the safety owner/counsel now**, in parallel with D5: which claim class does a
   general A1C-education page file under? No class by branch-read day ⇒ F-NUMBERS deferred.
   Show them the guide sentence "If your number landed in the middle band, here is how to
   think about it" (plan §8 item 3).

**First flip: `ideas,source`** (plan §7.3 step 3) — all of:
- batch 1 `Approved` + `Active`;
- `npm run eval:pal:ideas` run **by the owner** and green on the current `PROMPT_VERSION`,
  producing `lib/pal/guide-ideas.labels.json` (without it the guard drops `ideas`);
- D5 read and passed;
- rehearse the revert on a preview first (unset the var, redeploy — about five minutes);
- add a CI job that runs `scripts/check-production-config.ts`, or accept that the guard's
  first real execution is the first production build (a failure there is a failed build, not
  a bad ship);
- D6 (landing): plan default is "stale until the branch is read"; the landing's §3 line ships
  in the same deploy as this flip, never with PR-1;
- write the competitive-framing paragraph into PRD §11 before the flip (A-44: why this over
  an AI assistant — the boundary, a human-reviewed bank, the same read every time).
- Post-deploy checks, first five minutes then first hour (plan §7.3 step 7): `/api/health`
  `guideDoor`; `/home?stay=1` at 375×667 shows the ideas and the CTA on screen; an idea tap
  lands on `/check` with the idea in the field; `ideas_shown` arrives in Umami within the hour
  (if not, assume analytics is blind before assuming nobody visited).

**`calm`** — lists no ledger rows, so only a human gate protects it: the safety owner's
colour-blind and "does this look like a warning" review of the landing verdict cards at 375
and 1280 (A-61, Task 2.3), recorded in the ledger note on `landing-three-answers` and in
`DESIGN.md` §3; `landing-a11y.spec` green.

**`orient`** — all of: the 18 batch-2 rows Approved; `ideas` live; **owner decision F-56**
(the completion read `orientation_step_done` counts Done taps only, so it undercounts once
A-84 auto-completes steps — redefine the read in `docs/ops/launch-controls.md` §13.4, or ask
for a small PR that emits the event on auto-complete); the privacy page mentions first-week
progress stored on the account; D5 passed. Accepted exposure: `dayKeyInTimezone` throws on a
malformed stored timezone (Home already has this today).

**Kill lines after going live**
- Kill line 2: sessions with `idea_tapped` ÷ sessions where a block rendered, per surface,
  < 25% after four weeks ⇒ flag off (reviewed rebuild), PRD marked tested and closed.
- F-ASK floor (after PR-6): < 70% of the first 50 tour starts reach the attribution screen and
  the drop sits on Screen A or B ⇒ Task 6.7.

---

## 6. Level 3 — remaining build work (not started)

| Item | Plan section | Tasks | Starts when |
|---|---|---|---|
| **PR-4** full F-IDEAS | §2.3 PR-4 | 4.3 segment steering (`pal.segment.v1` steers the first idea); 4.4 "See all" expands in place (row `guide-ideas-see-all`, surface `ideas-full`, `idea_tapped { slot: "more" }`); grow each daypart bank to ≥ 10 lines. (4.1 and 4.2 were pulled into PR-1.) | The owner reads the ideas-viewed : checks-run counts once PR-1 is live (plan §8 item 2) |
| **PR-5** Home layout | §3 | 5.1 quick-action row (below the hero); 5.2 `/learn` index of tiles; 5.3 door order (slot mechanism for F-ASK; non-default doors render two idea rows); 5.4 smoke; 5.5 hero copy "Unsure about a meal?" (row `home-check-hero-title`) | After PR-3 and PR-4. **Open: UC5** — keep the four-item quick row, cut to three, or replace with one "Learn" link |
| **PR-6** intake + F-ASK | §4 | 6.1 pure step functions; 6.2 Screen A "What is hardest right now?"; 6.3 Screen B "What would count as a win?"; 6.4 response line on Screen B; 6.5 A1C step (its link waits for D7) + final step; 6.6 smoke; 6.7 floor fallback (only if the floor fires) | After PR-5 |
| F-NUMBERS `/learn/numbers` | §2.4.1 | page + copy pass + result-footer link; flip `LEARN_NUMBERS_HREF` in `lib/coach/orientation.ts` | D7 names a class |
| F-TREND "Your A1C over time" | §2.4.2 | `a1c_entries` table + migration, route, twin flag pair, erase/export, `/journey` section | D3 (refuse / store / anchor) **and** RV-3 (a)/(b) chosen. Last in both branches |
| F-SOURCE `/how-it-works` paragraph | §2.4.3 | one paragraph + row `how-it-works-same-read` | A panel consistency run (every `stratum-*` meal × 3 bands, N ≥ 20, ≥ 95% modal class) logged in launch-controls §12 |
| F-REFER | §5.1 | one static referral section on `/learn/first-week`; gives step 6 a trigger | Safety owner clears its copy |
| F-DOCTOR | §5.2 | doctor-question bank | D2 |
| F-PLAN | §5.3 | starter meal pattern | D1 (after Tier 1 live + Phase 5 measurement) |
| F-HABIT | §5.4 | opt-in reminder | Phase 5 shows people do not return without it |
| F-DIARY | §6 | food-and-reading diary | D4 — new intended-use statement with counsel |
| Retire the flag | §7.3 step 9 | one PR deleting flag-off branches, skip guards, env row | Kill line 2 read at four weeks and the door stays |
| Follow-ups | `TODOS.md` (main checkout, uncommitted) | A-13 result-card note; A-14 dismiss control on the step line | After PR-4's ratio read |
| Deferred minors | #144 / #146 descriptions and review reports | 27 (PR-1) + 34 triaged (PR-2/3) | Opportunistic |

---

## 7. Open decisions for the user

| # | Decision | Recommendation |
|---|---|---|
| 1 | Approve the `.gitleaksignore` fix (§3 A) | Approve — both are false positives; the fix names two exact findings. |
| 2 | Who applies migration 0019, and when (§3 C) | Now, from #145's branch, before any merge. |
| 3 | Merge method for the stacked PRs | Merge commits (repo convention; avoids rebasing the stack). |
| 4 | Make the two flag-on CI legs required (§3 E) | Yes, before #144 merges. |
| 5 | The unexplained deletion of `docs/release/truth-index.md` in the main checkout | Find out who removed it before any commit from the main checkout. |
| 6 | Commit the two handoff notes and the `TODOS.md` entries? | Yes, in a small docs PR after the merges. |
| 7 | F-56 completion metric (before `orient` goes live) | Emit the existing event on auto-complete — a small PR keeps the read honest. |
| 8 | UC5 quick row (before PR-5) | Plan default keeps four items below the hero; owner may cut it. |
| 9 | Recover the DX reviewer's missing findings? | Optional: re-run `/plan-devex-review` on the plan if the DX gaps matter before PR-4. |

---

## 8. Traps (new ones first; the full list is the 09-15 handoff §6)

- **The secret scan scans the PR's commit range**, so #147 passes while #144/#146 fail on the
  same text; a rename does not help — the ignore file does.
- **`gh pr edit` fails** ("Projects (classic)"). Use
  `gh api -X PATCH repos/tkiros/prediabetes-pal/pulls/<n> -f base=…` or `-F body=@file`.
- **gstack binaries** live at `~/.claude/skills/igstack/bin/`, not `~/.claude/skills/gstack/bin/`.
- **Codex CLI** hit its usage limit on 2026-09-14; expect single-voice reviews until it resets.
- **Session-isolation guard** (in worktree sessions): keep git commands plain — no `$(git …)`,
  no loops around git, no `cd … && git …` chains; the Write tool refuses paths outside the
  session's worktree.
- **`next dev` rewrites `CLAUDE.md`** — revert that block, or leave it; never commit it by
  accident with feature work.
- **Never write the literal `NEXT_PUBLIC_GUIDE_DOOR` under `tests/smoke/`** (pinned in
  `tests/unit/pal/smoke-guide-door.test.ts`). Use `doorSurfaceOn(surface)` from
  `tests/smoke/guide-door.ts`, and `PAL_E2E_GUIDE_DOOR=1 npm run e2e -- tests/smoke/<spec>.ts`
  for flag-on runs.
- **No local Postgres**: DB-backed smoke specs skip locally; that is the baseline.
- **The claims audit skips lines that begin with a comment marker** (a trailing comment *is*
  scanned); the analytics no-PII scan reads only `lib/client/analytics.ts` and strips nothing.
  New analytics union members go before `photo_draft`.
- **The orientation egress pins are two-way** (`tests/unit/pal/orientation-egress-guard.test.ts`).
- **Verify end to end before asserting.** The previous sessions logged eight false assertions
  from checking one step and assuming the rest. Trust the file over any claim, including this
  one.

## 9. Standing constraints (from the user and `CLAUDE.md`)

- Keep these `revora` strings: `tests/unit/pal/owned-domains.test.ts` (denylist),
  `tests/unit/pal/sw-dev-teardown.test.ts`, the docstrings in `lib/pal/contact.ts` and
  `lib/server/email.ts`, and historical docs under `docs/handoff`, `docs/archive`,
  `docs/audit`, `docs/qa`, `PRD`, `predict`, `.planning/phases`, `.planning/research`.
- Lockstep pairs: `.github/workflows/hourly-crons.yml` `APP_URL` = `CANONICAL_APP_URL` in
  `scripts/run-hourly-crons.mjs`, byte for byte; the prompt-leak regex in
  `lib/pal/postprocess.ts` and `lib/pal/eval-rubric.ts` changes only with the opening line of
  `lib/pal/prompt.ts`.
- Owner learnings: **no synchronous selling** (sales/projects only); the dashboard keeps the
  full shell by conviction; the F-ASK ruling is settled — do not re-litigate it.
- Analytics stays a closed enum: never meal text, never an A1C or any health value.

## 10. Suggested first moves for the new session

1. `git status`, `gh pr list --limit 10`, and `gh pr checks 144` / `146` — confirm nothing
   moved since this note.
2. Ask the user for decisions 1–5 in §7 in one message.
3. With approval: §3 A (ignore file) → re-run the scans → hand the user §3 C (migration) →
   merge #145 → #144 → #146 → #147, verifying production after each.
4. Send the §4 safety-owner submissions if the user has not already.
5. Only after Level 1 is done and the user asks: plan PR-4 (it is gated on the owner's ratio
   read, so confirm that read first).
