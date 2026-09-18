# Continuation prompt — guide redesign: PR-4 built and open, #152 and #153 await the owner

*Written 2026-09-18 ~03:50 UTC (2026-09-17 evening, local EDT). Supersedes
`docs/handoff/2026-09-17-guide-redesign-level1-done-continuation-prompt.md`
(committed in #151, still says "PR-4: not started") and the short
`2026-09-17-guide-redesign-pr4-open-session-handoff.md`.*

> **Executed 2026-09-18 — read this first.** §5 A verified nothing had moved;
> §5 B ran with the owner's approval: **#152 merged (`0dde678`)** and
> **#153 merged (`a2d327d`)** after an `update-branch` took its head to
> `036c511`. The title's "await the owner" and every "not merged" below are
> therefore historical. §5 C (the four production checks, the safety-owner
> submission, the `NEON_*` review, D5/D7) and §5 D (the paid label eval) are
> **still outstanding and still the owner's**. The privacy-page defect flagged
> in §3 shipped as PR #154. Everything else stands as written.

You are continuing the Prediabetes Pal **guide redesign** in
`/home/tefera/Desktop/Revora`.

- **Plan:** `docs/superpowers/plans/2026-09-13-guide-redesign.md` (reviewed and
  approved, on `main`).
  - Inline "review A-nn" notes supersede the text they annotate.
  - The Decision Audit Trail A-01…A-121 is at the end.
- **Spec:** `PRD/Prediabetes_Pal_Guide_Redesign_PRD_v1.1.md` on `main`. The spec
  wins any conflict.
- **Earlier handoffs** (all on `main` since #151 merged):
  - `docs/handoff/2026-09-17-guide-redesign-level1-done-continuation-prompt.md`
    — the morning's prompt; full Level 2/3 detail, the migration-0019 story, the
    credential traps.
  - `docs/handoff/2026-09-17-guide-redesign-pr1-merged-migration-0019-pending-session-handoff.md`
  - `docs/handoff/2026-09-16-…` and `2026-09-15-…` — history.
  - `docs/handoff/2026-09-17-safety-owner-submission-draft.md` — **drafted, not
    sent**; now covers batches 1, 2 and 3.
- **SDD ledger (git-ignored):**
  `.superpowers/sdd/2026-09-13-guide-redesign/progress.md` — every step, every
  ruling, plus `pr4-brief.md`, `pr4-report.md`, `pr4-review.md`,
  `pr4-rereview-1.md`, `pr4-final-review.md`, `pr4-rereview-2.md`. **Keep it**:
  PR-5 and PR-6 are unbuilt.

---

## 1. Hard rules for the session

1. **Never do any of these without the user's explicit OK in this session:**
   - push, merge or force-push;
   - run a production migration;
   - change a CI or security gate (including `.gitleaksignore`), GitHub repo
     settings or secrets, or a Vercel environment variable;
   - redeploy production.

   Standing rule: "Never push or merge without asking." Approval from an
   earlier session does not carry over.
2. **Never run `npm run eval:pal:ideas` yourself.** It is now ~1,800 live model
   calls (~$19) and is an owner action. See §5.
3. **Copy-ledger rows:** never set a row to `Approved`, and never change an
   existing row's Copy or Status cell. New user-facing strings get a new row
   filed `Pending | Yes`. (A new row's own Notes cell may be edited in the PR
   that files it.)
4. **Never propose or perform switching `NEXT_PUBLIC_GUIDE_DOOR` on in
   production.** Production never carries `1`; it carries an explicit surface
   list, and only after that list's gates are met (§6).
5. **Every user-visible change goes behind `guideDoorEnabled("<surface>")`,**
   server side too.
6. **Next.js here is 16.3 with breaking changes.** Read
   `node_modules/next/dist/docs/` before touching a Next API.
7. **Credentials: never print, echo or paste one.** Two production passwords
   leaked into a transcript on 2026-09-17; both were rotated the same day. The
   full rules now live in `docs/runbooks/database-governance.md` ("Operator
   traps", "Rotating a password") **on branch `docs/runbook-db-access-notes`
   (PR #152), not yet on `main`**. In short: never `source` an env file holding
   a URL (`node --env-file` instead), never `cat` a credential file, never
   print a raw `pg`/drizzle error, and redact `user:pass@` before any output.

---

## 2. Status in one paragraph

**Level 1 is shipped dormant and PR-4 is built.** #144, #145 (migration 0019),
#146, #147 and #151 are merged; `origin/main` is `bfcf83c`. Two PRs are open,
green and unmerged: **#152** (database runbook notes + the morning's
continuation prompt) and **#153** (PR-4 — full F-IDEAS behind the `ideas-full`
surface, dormant). Production is unchanged and every guide surface reports
`off`; the database is healthy, but `/api/health` currently reports `degraded`
because the hourly crons are stale again (§3, known issue). Nothing has been
approved by the safety owner, the label eval has not run, and the concierge
test (D5) has not started. **Not started:** PR-5, PR-6 and every gated module.

---

## 3. Where things are (verified 2026-09-18 ~03:45 UTC)

### Checkout

| Path | Branch @ head | Notes |
|---|---|---|
| `/home/tefera/Desktop/Revora` (only worktree) | **`feat/guide-pr4-ideas-full` @ `061c16a`** (= #153's head = remote) | `origin/main` is `bfcf83c`. Uncommitted, **not this work's**: `CLAUDE.md` (the `next dev` block), `.planning/STATE.md`, `app/(app)/privacy/page.tsx` ("Railway-hosted" → "Neon-hosted Postgres"), `docs/legal/counsel-brief.md`, `docs/ops/env-reference.md`, plus untracked `tests/unit/pal/privacy-provider-truth.test.ts` and ~57 other untracked files. None overlap #152's or #153's files, so `git switch main` carries them safely. |

⚠ **The live privacy page still names Railway as the database processor.** The
fix and its guard test exist only as the owner's uncommitted work above. That is
a privacy-notice defect in production; decide whether to ship it.

### Open PRs

| PR | Head | State |
|---|---|---|
| **#153** feat(ideas): PR-4 full F-IDEAS behind `ideas-full` (dormant) | `061c16a` | **11/11 pass, clean.** 9 commits from `bfcf83c`. Not merged. |
| **#152** docs(runbooks): database access traps, rotation, 0019 head | `9a92f5a` | **11/11 pass, clean.** Not merged. |
| #137, #138, #140, #141, #142, #143, #148, #150 (dependabot) | — | Behind `main`; each needs a rebase/update-branch under `strict` before it can merge |
| #111 typescript 6 → 7 | — | Lint fails: typescript-eslint does not support TS 7 |
| #128 eslint 9 → 10 | — | Lint fails: `react/display-name` loader error |
| #133 ops: hourly-crons heartbeat · #134 billing pricing (draft) · #135 docs owner decisions B/C · #136 research cohort report | — | Far behind `main`; need update-branch to report the six required checks |

### Required checks on `main` (branch protection, `strict: true`)

`typecheck · lint · contract · build` · `unit · evals (mock — no keys, no
spend)` · `playwright (incl. axe a11y)` · `secret scan` · `playwright · guide
door 1` · `playwright · guide door ideas,source`

### Production (https://prediabetespal.com)

- **Deployment:** `prediabetespal-q9l0xev5z` (redeploy of `a4b76ed` carrying the
  rotated `DATABASE_URL`), aliased to the domain. #151 was docs-only.
- **`/api/health`:** `db: "ok"`, all 12 `guideDoor` surfaces `off`, but
  `status: "degraded"` with `cron_nudge_stale`, `cron_trialPrecharge_stale`,
  `cron_pantrySweep_stale`, `cron_stripeReconcile_stale`. Cause: GitHub fires
  `hourly-crons.yml` every 2–4 hours, and the staleness threshold is 2 hours.
  Last runs (all `success`): 09-17 13:50, 17:46, 20:38, 23:10, 09-18 01:47 UTC.
  This is the known scheduler irregularity, not a new fault (§8 item 6).
- **Label cache:** `lib/pal/guide-ideas.labels.json` does not exist, so the
  production guard closes `ideas` and `ideas-full` in any build.

### Database (Neon project `dry-shadow-56131409`, database `neondb`)

- Migration 0019 applied; `npm run db:governance:check` 20/20 all true.
- Both role passwords were rotated on 2026-09-17 (runtime by the agent, owner
  role by the owner in the Neon console). `DB_BACKUP_URL` updated and verified
  by a manual `db-backup.yml` run (35235359808, success).
- Backups: last scheduled run 09-17 11:49 UTC, success. **Check the 09-18
  scheduled run** (about 11:49 UTC) at the start of the session.
- Stale, holding the dead pre-reset owner password: `.env.local` `NEON_*` and
  the Vercel Neon-integration `NEON_*` variables (Production, Preview,
  Development, **non-sensitive**). No tracked code reads them.
- No credentials on this machine.

---

## 4. What was done in the last session (2026-09-17)

1. **Verified state** (nothing had moved) and asked the owner five questions.
2. **Merged #151** (`bfcf83c`, pinned `ccafabf`), switched the checkout back to
   `main`, deleted `docs/guide-redesign-level1-status` local and remote.
3. **Opened #152** — `docs/runbook-db-access-notes`, commit `9a92f5a`:
   - `docs/runbooks/database-governance.md`: migration head `0018` → `0019`
     (20 journal entries); the migration sequence now loads URLs with
     `node --env-file` from a 0600 file and shows the exact commands; new
     **Operator traps** section (Node 24 happy-eyeballs timeout and the
     `NODE_OPTIONS=--network-family-autoselection-attempt-timeout=5000` fix;
     `drizzle-kit migrate` exiting 1 with no message; `pg` errors containing the
     whole URL; the unquoted-`&` echo; never `cat` a credential file; pooled vs
     direct hosts); new **Rotating a password** section for both roles,
     including `DB_BACKUP_URL` and the stale `NEON_*` variables.
   - `docs/runbooks/incident-2026-08-10-database-outage.md`: a 2026-09-17
     recurrence note (two passwords printed to a transcript, both rotated the
     same day; no values).
   - `docs/handoff/2026-09-17-guide-redesign-level1-done-continuation-prompt.md`.
4. **Built PR-4** (#153) through the subagent-driven-development loop: one
   implementer, a task review, a whole-branch review on the most capable model,
   and two scoped re-reviews. Nine commits, `bfcf83c..061c16a`.
5. **Wrote this handoff** and kept the SDD workspace.

### What PR-4 (#153) contains

Everything renders only under `guideDoorEnabled("ideas-full")`. With `ideas`
alone, Home and `/check` are byte-for-byte what `main` renders;
`components/food-check-form.tsx` has zero diff.

- **Bank growth (plan §2.1).** `GUIDE_IDEA_BANK` (the 8-line seed) unchanged; a
  sibling `GUIDE_IDEA_BANK_MORE` adds two lines per daypart (ten per daypart in
  total), rendered only under `ideas-full`. Seed ids unchanged; new ones are
  `-9`, `-10`. `GuideIdea` gains `more: boolean`.
  - breakfast: "two eggs with spinach" (meal-plan Day 2, toast dropped);
    "greek yogurt smoothie with frozen berries and chia seeds" (Day 6).
  - lunch: "turkey and lentil salad with tomatoes and cucumber";
    "fish with green beans and salad greens" — **both composed** from the
    guides' "What can I eat freely?" list.
  - dinner: "tempeh stir-fry with peppers and mushrooms" — **composed**;
    "cottage cheese with tomatoes and peppers" (from the *snacks* guide).
- **Task 4.3 segment steering.** `ideasFor(daypart, rotation, { count, full,
  segment })`; `pal.segment.v1` values `Doctor's advice` and `Family history`
  start from the second half of the bank, everything else default. Read only
  under `ideas-full`, Home only.
- **Task 4.4 "See all".** A quiet text button in the ideas heading row —
  `See all` / `Show fewer`, a real 44px target with `aria-expanded` and
  `aria-controls`, no new route. The expanded list starts with the same three
  rows in the same order; taps past the third emit `idea_tapped { slot: "more" }`.
- **Door guard scoping** (`lib/guide-door-guard.ts`): a stale or missing label
  on a `more` line closes only `ideas-full` (plus dependents); a stale seed line
  still closes `ideas` and `ideas-full` together. So a label file produced
  before PR-4 merges cannot close the first `ideas,source` flip.
- **Copy governance:** four rows filed `Pending | Yes` —
  `guide-ideas-more-breakfast` / `-lunch` / `-dinner`, `guide-ideas-see-all` —
  all listed in `SURFACE_ROWS["ideas-full"]`. No existing row changed; nothing
  `Approved`. The safety-owner draft gains **§3b (batch 3)** with a callout for
  the three composed lines, the snacks-guide dinner line, and the smoothie line.
- **Tests:** unit growth/steering/guard cases, and smoke coverage of
  expand/collapse, a row-4 "more" tap, and the 360px CSS override.
- **Checks:** lint, typecheck, `test:pal` (1270 passed, 31 skipped — the skips
  are the label-file suites), contract, and all three e2e legs. Fold slack
  (check CTA to tab bar): flag-on **58.2 / 12.3 / 12.3 px** at 360 / 375 / 430;
  the `ideas,source` leg unchanged at 65.8 / 19.8 / 19.9.
- **Review findings fixed:** an invisible `::before` tap area on the toggle that
  overlapped the last idea row (`DESIGN.md` §5 bans it); a false
  `"ideas-full" dropped` production build warning for lists without
  `ideas-full`; a post-load 15.6px layout shift above the check CTA.

### Rulings the agent made on the owner's behalf (review these)

| Ruling | Cost if wrong |
|---|---|
| Built PR-4 before the ideas-viewed : checks-run read (owner chose "Plan PR-4 anyway" from a menu) | Dormant work the read might have cancelled |
| Every PR-4 behaviour sits behind `ideas-full`, not `ideas`, so the first flip stays exactly PR-1's prototype | One boolean filter to remove if the grown bank should ship under `ideas` |
| New idea lines got new ledger rows (`guide-ideas-more-*`) instead of extending approved rows | Three extra rows for the safety owner |
| PR-4 does not touch `/check` (steering is Home-only, per plan Task 4.3) | A small follow-up if steering is wanted there |
| Label staleness scoped: `ideas` is stale only when a **seed** line lacks a fresh SAFE label | One filter; without it an eval run made before PR-4 merged would close `ideas` too |
| "See all" moved into the heading row as a real 44px button instead of the banned invisible hit area | Toggle sits top-right, not the wireframe's bottom-right |
| Growth tests de-pinned to computed lengths so a post-eval prune never reddens `test:pal` | A pruned 9-line daypart is not caught by a test |
| Accepted the smoke test asserting Home remounts collapsed (instead of clicking "Show fewer" first) | None; the click path was added later anyway |
| Left one known cosmetic risk: if "Show fewer" ever wraps the heading at 360px, the expanded block jumps ~11px | Cosmetic, expanded state only, no fold assertion there |

---

## 5. Exact actions — next, in order

Every step marked ***OK*** needs the user's explicit approval **in the new
session**.

### A. Confirm nothing moved (agent, read-only)

```bash
cd /home/tefera/Desktop/Revora && git fetch origin --prune && git log --oneline -1 origin/main
git status --short --branch | head -2
gh pr list --limit 25
for n in 152 153; do gh pr checks $n | awk -F'\t' '{print $2}' | sort | uniq -c; \
  gh api repos/tkiros/prediabetes-pal/pulls/$n --jq '[.head.sha, .mergeable_state] | @tsv'; done
curl -sS https://prediabetespal.com/api/health | jq -c '{status, db, issues, door: (.guideDoor|to_entries|map(.value)|unique)}'
gh run list --workflow db-backup.yml --limit 2
```

Expect: `origin/main` at `bfcf83c`; #152 `9a92f5a` and #153 `061c16a`, both
`clean`, 11/11; `door == ["off"]`, `db` ok (`status` may read `degraded` for
cron staleness); the 09-18 scheduled backup succeeded. **If the backup failed,
tell the owner first.** (`gh api` sometimes prints "error connecting to
api.github.com" — retry after ~5 s.)

### B. Merge #152 and #153 — ***OK***

Both are `clean` today, but `strict: true` means the second one goes `behind`
the moment the first merges. Do them one at a time:

```bash
# 1. #152 (docs only)
gh api -X PUT repos/tkiros/prediabetes-pal/pulls/152/merge -f merge_method=merge \
  -f sha=9a92f5af358f27a4b65df94154d29c8b50db4373

# 2. #153 — re-read its mergeable_state; if "behind", update-branch first (a push, OK),
#    wait for 11/11, then merge with the NEW head SHA
gh api -X PUT repos/tkiros/prediabetes-pal/pulls/153/update-branch \
  -f expected_head_sha=061c16ae7906de09b275a5bddfc43ed2021b2bf7
gh api -X PUT repos/tkiros/prediabetes-pal/pulls/153/merge -f merge_method=merge -f sha=<new head>
```

After each merge: watch the push CI on `main` (six required checks) and confirm
the Vercel production deploy succeeds, then re-check `/api/health` — `db` ok and
every `guideDoor` surface still `off`. Then:

```bash
git switch main && git pull --ff-only origin main
git branch -d docs/runbook-db-access-notes feat/guide-pr4-ideas-full
git push origin --delete docs/runbook-db-access-notes feat/guide-pr4-ideas-full   # OK
```

The owner's five uncommitted edits do not overlap either PR and survive the
switch.

### C. Owner-side work (the agent cannot do these)

1. **The four production checks** (never yet done, the only unverified part of
   Level 1, and they also prove the rotated runtime credential on the auth
   path): create a test account through onboarding; download the account
   export; change a reminder setting; sign in with a real account.
2. **Send the safety-owner submission**
   (`docs/handoff/2026-09-17-safety-owner-submission-draft.md`): fill in
   `[turnaround: ____]` and send. It covers batch 1 (8 rows), batch 2 (18) and
   batch 3 (4). **Add before sending:** on a steered device's first load
   (rotation starts at 1) the start index is 8, so `Doctor's advice` and
   `Family history` readers see `x-9, x-10, x-1` first — both new lines lead,
   the smoothie included.
3. **Review the Neon integration's `NEON_*` variables in Vercel** — bound to
   Production, Preview and Development as non-sensitive, holding the dead
   pre-reset owner password, contradicting `docs/ops/env-reference.md`. Read the
   Neon/Vercel integration docs or ask Neon support whether they can be scoped
   down or made sensitive; deleting integration-managed variables can break the
   integration. Also refresh or remove the stale `NEON_*` lines in `.env.local`.
4. **Start D5 (the concierge test) and ask D7** — see §6. They gate every flip
   and nothing in code moves them.
5. **The label eval, after #153 merges** (§5 E).

### D. The label eval — sequencing (owner only)

- Run `npm run eval:pal:ideas` **once, after #153 merges.** The eval iterates
  `GUIDE_IDEAS` (verified — `tests/evals/guide-ideas-label-eval.test.ts:122`),
  so one run covers all 30 lines: 30 ideas × 3 bands × 20 runs ≈ 1,800 calls,
  about $19. A run made before #153 merges buys a 24-line file that is stale the
  moment PR-4 lands.
- Needs `OPENAI_API_KEY` and `PAL_LIVE_EVAL=1` (the npm script sets the latter).
  It writes `lib/pal/guide-ideas.labels.json`; commit that file.
- If a line fails at any band: prune it by hand from the bank and record which
  and why in the ledger Notes. The growth tests compute their lengths, so a
  prune will not redden `test:pal`. Holding plan §2.1's "≥ 10 per daypart" after
  a prune means writing a replacement line and paying for a second full run.
- A cell that is *inconclusive* (a retry/throw, not a real `MODERATE`/`HIGH`)
  must not prune an idea — the eval re-runs those up to three times and fails
  loudly instead.
- Until the file exists, the production guard closes `ideas` and `ideas-full` in
  any build, whatever the flag says.

### E. Plan status and docs follow-up (agent, ***OK***)

After #153 merges, one small docs PR:
- tick PR-4's task lines and update the §1 gate-table row for the ideas surfaces
  in `docs/superpowers/plans/2026-09-13-guide-redesign.md` (same treatment #151
  gave PR-1…PR-3);
- plan line ~1892 still says "~1,440 calls … about $15"; the code now says
  ~1,800 and about $19;
- commit this continuation prompt, and delete the superseded short handoff
  `docs/handoff/2026-09-17-guide-redesign-pr4-open-session-handoff.md` if it is
  still untracked.

### F. Non-guide PRs — ***OK each***

- **Dependabot #137–#150 (eight green):** comment `@dependabot rebase` or run
  update-branch, wait for green, merge one at a time (each merge moves `main`).
- **#111 / #128:** close them, or leave them until typescript-eslint supports
  TS 7 and the React lint plugin supports eslint 10.
- **#133–#136:** update-branch so they report the six required checks, then the
  owner decides. #133 is the cron heartbeat, which is half of §8 item 6.

---

## 6. Level 2 — before any surface goes live (owner / safety owner; not code)

**How switching on works:** set the Vercel variable `NEXT_PUBLIC_GUIDE_DOOR` to
an explicit surface list, **then rebuild and redeploy**. It is not a runtime
switch. Dependencies the guard enforces: `orient` needs `ideas`; `intake` needs
`orient`; `ideas-full` needs `ideas`; `home` needs `ideas` and `ideas-full`.

**Gates for everything**

1. **D5, the concierge test: not started.** Read the r/prediabetes rules in a
   browser, send the plan's §5.3 draft, recruit 5, add the neutral opener and the
   three counts. Floor: ≥ 3 of 5 ask a second question. **Fewer than 3 of 5 ⇒
   stop; the merged code stays dormant.** The number-vs-food count picks the
   branch; food order (§2.1) is the default.
2. **D7, for the safety owner / counsel, now:** which claim class does a general
   A1C-education page fall under? No class by branch-read day ⇒ F-NUMBERS is
   deferred.

**First flip: `ideas,source`** (plan §7.3 step 3). All of: batch 1 `Approved` +
`Active`; the label eval green on the current `PROMPT_VERSION`, with
`lib/pal/guide-ideas.labels.json` committed; D5 passed; the revert rehearsed on
a preview; a CI job running `scripts/check-production-config.ts` (or accepting
that the guard's first flag-on execution is a production build); D6's landing
line shipping in the same deploy, never before; the A-44 competitive-framing
paragraph written into PRD §11; and the post-deploy checks (§7.3 step 7) in the
first five minutes and again in the first hour.

**`ideas-full` (PR-4's surface)** additionally needs its four batch-3 rows
`Approved`, and `ideas` already live.

**`calm`:** the safety owner's colour-blind and "does this look like a warning"
review of the landing verdict cards at 375 and 1280 (A-61, Task 2.3), recorded
in the `landing-three-answers` ledger note and `DESIGN.md` §3; `landing-a11y.spec`
green.

**`orient`:** the 18 batch-2 rows Approved; `ideas` live; owner decision F-56
(`orientation_step_done` counts only Done taps, so it undercounts once A-84
auto-completes steps — redefine the read in `docs/ops/launch-controls.md` §13.4
or ship a small PR that emits the event on auto-complete); the privacy page
mentioning first-week progress stored on the account; D5 passed.

**Kill lines.** Kill line 2: sessions with `idea_tapped` ÷ sessions where an
ideas block rendered, per surface, below 25% after four weeks ⇒ flag off
(reviewed rebuild) and the PRD is marked tested and closed. F-ASK floor (after
PR-6): below 70% of the first 50 tour starts reach the attribution screen, with
the drop on Screen A or B ⇒ Task 6.7.

---

## 7. Level 3 — remaining build work

| Item | Plan section | Starts when |
|---|---|---|
| **PR-5** Home layout (5.1 quick row, 5.2 `/learn` tiles, 5.3 door order, 5.4 smoke, 5.5 hero copy `home-check-hero-title`) | §3 | After PR-4 merges. Open question UC5: four-item quick row (plan default), three, or one "Learn" link. **Needs:** an external trigger for the ideas block's expanded state — `SURFACE_REQUIRES.home` says the quick row's Ideas item is the See-all toggle, but `expanded` is private component state with no hash, event or prop. Task 5.1 must add one. |
| **PR-6** intake + F-ASK (6.1–6.6; 6.7 only if the floor fires) | §4 | After PR-5 |
| F-NUMBERS `/learn/numbers` | §2.4.1 | D7 names a class |
| F-TREND "Your A1C over time" (`a1c_entries` table + migration, twin flag pair, erase/export, `/journey` section) | §2.4.2 | D3 **and** RV-3 chosen; last in both branches |
| F-SOURCE `/how-it-works` paragraph | §2.4.3 | Panel consistency run (every `stratum-*` meal × 3 bands, N ≥ 20, ≥ 95% modal class) logged in launch-controls §12 |
| F-REFER | §5.1 | Safety owner clears its copy |
| F-DOCTOR / F-PLAN / F-HABIT / F-DIARY | §5.2 / §5.3 / §5.4 / §6 | D2 / D1 / Phase 5 / D4 |
| Retire the flag | §7.3 step 9 | Kill line 2 read at four weeks and the door stays |
| F-56 metric PR (small) | launch-controls §13.4 | Owner picks it over redefining the read |
| Follow-ups in `TODOS.md` (A-13 result-card note, A-14 dismiss control on Home's step line) | — | After PR-4's ratio read |
| Deferred minors: 27 (PR-1) + 34 triaged (PR-2/3) | PR descriptions and review reports | Opportunistic |

**Future migrations** (F-TREND): follow `docs/runbooks/database-governance.md`
— back up first, governance check before and after, direct owner host, the
`NODE_OPTIONS` timeout, `node --env-file`, and apply the migration before
merging its PR.

---

## 8. Open decisions for the user

| # | Decision | Recommendation |
|---|---|---|
| 1 | Merge #152 and #153 | Yes — both green; #152 is docs, #153 is dormant |
| 2 | The four production checks | Do them now; they are the last unverified part of Level 1 |
| 3 | Send the safety-owner submission (30 rows) | Now — it gates every flip |
| 4 | Start D5; ask D7 | Now, in parallel |
| 5 | `NEON_*` integration variables | Review scope and sensitivity; don't delete blindly |
| 6 | Cron scheduler irregularity (`hourly-crons.yml` fires every 2–4 h; health goes `degraded`/503 past 2 h) | #133's heartbeat plus a scheduler that actually runs hourly (external or Vercel) |
| 7 | The privacy page still says "Railway-hosted" in production | Ship the owner's uncommitted fix (page + its guard test) as its own small PR |
| 8 | PR-5 next, or wait | Plan gate is "after PR-4 merges"; UC5 default is the four-item quick row |
| 9 | F-56 completion metric | Emit the event on auto-complete (small PR) |
| 10 | Dependabot PRs; #111/#128; #133–#136 | Owner's call, one at a time |
| 11 | `feat/app-shell-dashboard` (`9bc5cf3`, local only, not in `main`) | Compare with `4be486c`, then delete |
| 12 | ~60 stale local branches | Optional prune after checking each is merged or abandoned |

---

## 9. Traps

### New this session

- **A global `button, input, textarea { min-height: 44px }`** in
  `app/globals.css` silently wins over a class that declares no `min-height`.
  It is what makes the ideas block's fold budget tight.
- **`DESIGN.md` §5 bans invisible hit-area expansion** ("negative margins
  overlapped adjacent targets when this repo tried it"). A `::before` hit slop
  is the same defect: it painted over the last idea row and stole its taps.
- **The Home fold budget** is pinned by `tests/smoke/dashboard.spec.ts` at 360,
  375 and 430 and now has ~12px of slack with `ideas-full` on. Anything added to
  that block needs the flag-on e2e leg run before it is believed.
- **`gitleaks` 8.24.3** lives at `~/.claude/jobs/<job>/tmp/gitleaks` and is
  ephemeral; a fresh download over this link takes minutes.
- **The label eval iterates `GUIDE_IDEAS`**, not the seed constant — so bank
  growth automatically enlarges the paid run. Check this before quoting a cost.
- **A subagent can sweep the owner's uncommitted files into a commit.** Tell
  every implementer: stage by explicit path, never `-a` / `-A` / `add .`.

### Carried forward (full lists: the 09-17 morning prompt §8, the 09-15 handoff §6)

- Neon connections from this machine need
  `NODE_OPTIONS=--network-family-autoselection-attempt-timeout=5000`.
- `drizzle-kit migrate` exits 1 without printing its error; trust the governance
  check, and probe with a redacted `pg` script.
- `pg-connection-string` puts the whole URL in an `EINVAL` message when the
  `postgresql:` scheme is missing.
- `source`-ing an env file with an unquoted `&` echoes the value.
- Pooled host for runtime; direct host for migrations, backups and governance.
- `neondb_owner` is console-managed; rotating it means updating `DB_BACKUP_URL`.
- gitleaks `generic-api-key` matches the `STATE_KEY` assignment quoted in docs —
  write it as "the `STATE_KEY` constant (value `pal.orient.v1`)".
- CI runs only on opened / synchronize / reopened; a base retarget starts no run.
- `strict: true` means the next PR goes `behind` after every merge.
- `gh pr checks` has no `--json` here — parse tab-separated columns with `awk`.
- `next dev` rewrites `CLAUDE.md`; never commit that block.
- Smoke tests: never write the literal `NEXT_PUBLIC_GUIDE_DOOR` under
  `tests/smoke/`; use `doorSurfaceOn(surface)`. Flag-on runs:
  `PAL_E2E_GUIDE_DOOR=1 npm run e2e -- tests/smoke/<spec>.ts`.
- No local Postgres: DB-backed smoke specs skip locally; that is the baseline.
- Analytics stays a closed enum; new members go before `photo_draft`.
- Verify end to end before asserting — trust files and API state over any claim,
  including this one.

---

## 10. Standing constraints (from the user and `CLAUDE.md`)

- **Keep the protected `revora` strings:** `tests/unit/pal/owned-domains.test.ts`
  (denylist), `tests/unit/pal/sw-dev-teardown.test.ts`, the docstrings in
  `lib/pal/contact.ts` and `lib/server/email.ts`, and historical docs under
  `docs/handoff`, `docs/archive`, `docs/audit`, `docs/qa`, `PRD`, `predict`,
  `.planning/phases`, `.planning/research`.
- **Lockstep pairs:** `.github/workflows/hourly-crons.yml` `APP_URL` must equal
  `CANONICAL_APP_URL` in `scripts/run-hourly-crons.mjs` byte for byte; the
  prompt-leak regex in `lib/pal/postprocess.ts` and `lib/pal/eval-rubric.ts`
  changes only together with the opening line of `lib/pal/prompt.ts`.
- **Owner learnings:** no synchronous selling; the dashboard keeps the full
  shell by conviction; the F-ASK ruling is settled — do not re-litigate it.
- **Analytics** never carries meal text, an A1C, or any health value.
- **Skill routing** (`CLAUDE.md`): bugs → `investigate`; ship → `ship`; review →
  `review`; and so on.
- Every commit: `npm run lint && npm run typecheck && npm run test:pal &&
  npm run contract`.

---

## 11. Suggested first moves

1. Run §5 A (read-only), including the 09-18 scheduled backup result.
2. Ask the user in one message: merge #152 and #153? production checks done?
   submission sent? `NEON_*` reviewed? privacy-page fix shipped? PR-5 now?
3. With approval: §5 B (merge both, return to `main`, delete the branches), then
   §5 E as one small docs PR.
4. Only when the user asks: start PR-5 (§7), which needs the UC5 answer and the
   external toggle trigger noted there. Otherwise the guide work waits on
   Level 2 (§6), which is owner and safety-owner work, not code.
