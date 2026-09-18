# Continuation prompt — guide redesign: PR-4 merged, PR-5 Tasks 5.1–5.3 built (local, unpushed), #154/#155 await the owner

*Written 2026-09-18 ~09:35 UTC (05:35 EDT). Supersedes
`docs/handoff/2026-09-17-guide-redesign-pr4-open-continuation-prompt.md`, which lives
on the **#155** branch (not yet on `main`) and says #152/#153 still await merge;
both have since merged.*

> **Being executed 2026-09-18 (resumed ~10:28 UTC) — read this first.** §5 A
> verified nothing had moved. With the owner's approval in that session:
> **#154 merged (`a4ad691`)**; the PR-5 branch `feat/guide-pr5-home-layout` was
> **pushed** (no PR yet), so it no longer exists on one disk only; §5 C ran —
> this file rides in #155's correcting commit, which replaces the withdrawn
> `worried` projection with the measured matrix and the owner's one-row ruling.
> #155 merges after an update-branch. §5 D–F (Tasks 5.4, 5.5, the final review)
> were under way; the SDD ledger has their state. The guest hydration bug (§6)
> is deferred by the owner to its own PR. Every "unpushed", "await the owner"
> and "not merged" below about #154 and the PR-5 branch is therefore historical.

You are continuing the Prediabetes Pal **guide redesign** in
`/home/tefera/Desktop/Revora`.

- **Plan:** `docs/superpowers/plans/2026-09-13-guide-redesign.md` (on `main`).
  Inline "review A-nn" notes supersede the text they annotate; the Decision Audit
  Trail A-01…A-121 is at the end.
- **Spec:** `PRD/Prediabetes_Pal_Guide_Redesign_PRD_v1.1.md`. The spec wins any
  conflict.
- **SDD ledger (git-ignored, the recovery map):**
  `.superpowers/sdd/2026-09-13-guide-redesign/progress.md`. Its first line names the
  plan. Every step, ruling, fix round and verification from this session is there,
  under `## Session 2026-09-18`.
  - Per-task briefs and reports sit beside it (`task-5.N-brief.md`,
    `task-5.N-report.md`), with review packages (`review-<base>..<head>.diff`).
  - **Keep the ledger.** PR-5 is unfinished and PR-6 is unbuilt.
- **Run this work with** `/superpowers:subagent-driven-development`, the same loop as
  this session.

---

## 1. Hard rules for the session

1. **Never do any of these without the user's explicit OK in the new session:**
   - push, merge or force-push, **including pushing the local PR-5 branch**;
   - run a production migration;
   - change a CI or security gate (including `.gitleaksignore`), GitHub repo
     settings or secrets, or a Vercel environment variable;
   - redeploy production.

   Standing rule: "Never push or merge without asking." **Approval from this session
   does not carry over.** (This session had approval for the #152/#153 merge chain
   and for opening #154/#155. It did **not** have approval to merge #154/#155, and
   did not.)
2. **Never run `npm run eval:pal:ideas` yourself.** It is ~1,800 live model calls
   (~$19) and is an owner action.
3. **Copy-ledger rows:** never set a row to `Approved`; never change an existing
   row's Copy or Status cell. New user-facing strings get a new row filed
   `Pending | Yes`. A new row's own cells may be edited in the PR that files it.
4. **Never propose or perform switching `NEXT_PUBLIC_GUIDE_DOOR` on in production.**
   Production never carries `1`; it carries an explicit surface list, and only after
   that list's gates are met.
5. **Every user-visible guide change goes behind `guideDoorEnabled("<surface>")`,**
   server side too. (Exception ruled this session: a factual correction to a legal
   disclosure ships unflagged. See #154.)
6. **Next.js here is 16.3 with breaking changes.** Read `node_modules/next/dist/docs/`
   before touching a Next API.
7. **Credentials: never print, echo or paste one.** Rules are in
   `docs/runbooks/database-governance.md`, "Operator traps" and "Rotating a
   password" (now on `main` via #152).
8. **Every subagent stages by explicit path.** Never `git add -a`, `-A` or `.`: the
   working tree holds the owner's uncommitted files (§3).
9. **No reviewer may modify the working tree, even temporarily.** Mutation testing
   happens on copies in `$CLAUDE_JOB_DIR/tmp/` or on in-memory strings. See the trap
   in §9.

---

## 2. Status in one paragraph

**PR-4 is merged and dormant; PR-5 is about 60% built on a local, unpushed branch.**
#152 (runbook) and #153 (PR-4) merged this session; `origin/main` is `a2d327d`, all
six required checks are green on it, and the production deploy of `a2d327d`
succeeded. Two PRs this session opened are green and **unmerged, awaiting the
owner**: **#154** (privacy disclosure names Neon, not Railway) and **#155** (plan
status docs). **#155 now contains one false statement that must be corrected before
it merges** (§5 C). PR-5 lives on local branch `feat/guide-pr5-home-layout` with 8
commits:
- **Tasks 5.1** (quick-action row), **5.2** (`/learn` index) and **5.3** (per-person
  door order) are **complete and review-clean**. 5.3's re-review verdict arrived just
  after this was first drafted: all 7 findings addressed, no Critical or Important
  issues.
- **Tasks 5.4 (smoke) and 5.5 (hero H2) are not started.**
- **The final whole-branch review has not run.**

Production is unchanged. Every guide surface reports `off`; `db` is ok; `status` is
`degraded` from the known cron staleness, which has worsened (§3). **A pre-existing
production bug was found and verified**: a guest Home hydration mismatch (§6). It was
not fixed.

---

## 3. Where things are (verified 2026-09-18 09:30 UTC)

### Checkout

| Item | State |
|---|---|
| Path | `/home/tefera/Desktop/Revora` (only worktree) |
| Branch | **`feat/guide-pr5-home-layout` @ `cb0d8d9`**. **LOCAL ONLY.** `git ls-remote` shows no remote branch. |
| Base | `origin/main` = `a2d327d` (PR-5 has 8 commits on top, §4) |
| Owner's uncommitted files (**not this work's; never commit them**) | `CLAUDE.md` (the `next dev` block), `.planning/STATE.md`, `docs/ops/env-reference.md` (four unrelated env rows from a 2026-09-05 audit reconcile), plus ~57 untracked files |

⚠️ **The PR-5 branch exists on one disk only.** Eight commits of reviewed work are
unpushed. Pushing it (with the owner's OK) is a priority action (§5 F).

### Open PRs

| PR | Head | State | Note |
|---|---|---|---|
| **#154** fix(privacy): sub-processor disclosure names Neon, not Railway | `7333e98` | **11/11 pass, clean, open** | privacy page, counsel brief, guard test, `auth.ts` docstring |
| **#155** docs(guide): PR-4 merged dormant — plan status, batch 3, stale figures | `2137db1` | **11/11 pass, clean, open** | ⚠️ **contains a now-false fold projection; amend before merging** (§5 C) |
| #137, #138, #140, #141, #142, #143, #148, #150 (dependabot) | — | behind `main` | each needs update-branch under `strict` |
| #111 typescript 6→7 · #128 eslint 9→10 | — | lint fails | wait for upstream plugin support, or close |
| #133 cron heartbeat · #134 billing (draft) · #135 owner decisions · #136 cohort report | — | far behind `main` | need update-branch |

Required checks on `main` (`strict: true`): `typecheck · lint · contract · build` ·
`unit · evals (mock — no keys, no spend)` · `playwright (incl. axe a11y)` ·
`secret scan` · `playwright · guide door 1` · `playwright · guide door ideas,source`.
CI sets `PAL_E2E_GUIDE_DOOR` from the matrix (`.github/workflows/ci.yml:145`).

### Production (https://prediabetespal.com)

- **Deployment:** `a2d327d` (the #153 merge), deploy status `success`
  (`prediabetespal-7q9ozsr98-…`).
- **`/api/health`:** `db: "ok"`, all 12 `guideDoor` surfaces `off`,
  `status: "degraded"` with `cron_nudge_stale`, `cron_trialPrecharge_stale`,
  `cron_pantrySweep_stale`, `cron_stripeReconcile_stale`.
- **Cron gap is worsening.** `hourly-crons.yml` scheduled runs (all `success`):
  09-17 20:38, 23:10, 09-18 01:47, **06:46**. That is a **5-hour** gap
  (01:47→06:46) against a 2-hour staleness threshold. Known GitHub scheduler
  irregularity, getting worse (§8 item 6).
- **Label cache:** `lib/pal/guide-ideas.labels.json` does not exist, so the production
  guard closes `ideas` and `ideas-full` in any build.

### Database / backups

- Neon project `dry-shadow-56131409`, migration 0019 applied, governance 20/20.
- **Backups:** last scheduled run was 09-17 11:49 UTC, success. **The 09-18 scheduled
  run (~11:49 UTC) had not fired when this was written. Check it first thing.**
- Unchanged from the prior handoff: stale `NEON_*` values in `.env.local` and in the
  Vercel Neon integration (Production, Preview and Development; non-sensitive, holding
  the dead pre-reset owner password). No credentials on this machine.

---

## 4. What was done this session (2026-09-18)

### 4.1 Merge chain (owner-approved in-session)

1. **Verified state unchanged** from the prior handoff; asked the owner four
   questions. Approved: the whole merge chain; the privacy fix as its own PR; the docs
   follow-up and then PR-5; UC5 = the four-item quick row.
2. **Merged #152** → `0dde678`.
3. **#153** went `behind`; ran update-branch → `036c511`; CI 11/11 clean;
   **merged** → `a2d327d`.
4. **Verified:** all six required checks green on `main`; production deploy of
   `a2d327d` succeeded; `/api/health` shows `db` ok and every door `off`.
5. **Deleted** `docs/runbook-db-access-notes` and `feat/guide-pr4-ideas-full`, local
   and remote. The owner's uncommitted files survived the branch switches.

### 4.2 Opened #154 (privacy): **opened, not merged**

- `app/(app)/privacy/page.tsx`: "Railway-hosted Postgres" → "Neon-hosted Postgres".
  **The live production privacy notice still names Railway until this merges.**
- `docs/legal/counsel-brief.md`: the same correction (the page's lockstep twin).
- `tests/unit/pal/privacy-provider-truth.test.ts`: the owner's guard test.
  **Verified real**: both files matched `/Railway-hosted/` at `main`, so it fails
  without the fix.
- `auth.ts` docstring: two stale "database sessions in Railway Postgres" lines
  corrected. Comment only, not pinned by a test.
- **Left out:** `docs/ops/env-reference.md`, which is unrelated and still
  uncommitted, and `app/api/health/route.ts:22`, which says the crons run "from the
  Railway scheduler" when they now fire from GitHub Actions; that is a scheduler
  claim, not a database one.

### 4.3 Opened #155 (docs): **opened, not merged**

- Plan §1 status line names PR-4 (#153); new **Ledger batch 3** row (four `Pending`
  rows).
- §2.1 PR-4 row: merged dormant, and records that the ratio read was never taken.
- Task 4.1 done-check status block: green, but the labels file is outstanding and is
  the owner's.
- Eval cost ~1,440 calls / $15 → **~1,800 / $19** (the code was already right; only
  the plan was stale).
- Two corrections for the PR-5 implementer: Task 4.3's stale `ideasFor` signature,
  and a fold-budget warning. **The warning's projection turned out wrong** (§5 C).
- Also commits the 09-17 continuation prompt, with an "executed" banner.

### 4.4 PR-5 (Home layout), through the SDD loop

Branch `feat/guide-pr5-home-layout`, cut from `a2d327d`.

| Task | Commits | Status |
|---|---|---|
| **5.1** quick-action row | `1015651` feat · `da1a786` fix r1 · `beb1079` fix r2 | ✅ **complete, review clean** |
| **5.2** `/learn` index of tiles | `77efeb4` feat · `bf60917` fix r1 | ✅ **complete, review clean** |
| **5.3** door order (per-person Home) | `b4c63b9` WIP · `d07e2c8` owner ruling · `cb0d8d9` review fix r1 | ✅ **complete, review clean** (re-review: 7/7 addressed, 0 Critical, 0 Important) |
| **5.4** smoke for the Home layout | — | ⬜ not started |
| **5.5** hero H2 "Unsure about a meal?" | — | ⬜ not started |

**What PR-5 contains so far** (all behind `guideDoorEnabled("home")`, which requires
`ideas` and `ideas-full`):

- **5.1:** `components/home-quick-row.tsx` (client component). Four quiet tiles:
  Ideas→`#ideas-title` (Leaf), Check→`/check` (CheckCircle), Learn→`/learn` (**new
  `IconBook`**), Journey→`/journey` (**Compass**). They render below the hero, outside
  the fold budget.
  - The Ideas tile dispatches a window **CustomEvent**, `IDEAS_EXPAND_EVENT` in
    `lib/client/ideas-expand.ts`, which **expands only** (never toggles) the PR-4
    "See all" block. The listener is registered only under `ideas-full`.
  - Learn goes through the existing `LearnLink`, which gained an optional `className`
    prop.
  - Tiles: 14px radius, `--border-strong`. `IconBook` was added to
    `components/icons.tsx` **and** to DESIGN.md §7's vocabulary list.
  - Ledger row `home-quick-row` (`Pending`), including the `aria-label` "Quick
    actions".
- **5.2:** `app/(app)/learn/page.tsx` (server component; `notFound()` unless `home`).
  - Tiles: "Your first week" (**only when `orient` is on**), "How it works", "My
    meals", "Saved meals" (only when `mealMemoryUiEnabled()`), "Pantry review".
  - "What the numbers mean" appears only when `LEARN_NUMBERS_HREF === "/learn/numbers"`
    (absent today).
  - "Questions for my doctor" is **omitted**.
  - `id="saved"` added to `components/saved-meals-section.tsx`. `.learn-grid`
    (2 columns ≥480px), 14px radius, `--border-strong`, no shadow.
  - Ledger row `learn-tiles` (`Pending`).
- **5.3:**
  - `lib/client/ask-store.ts`: types plus a **read-only** `askStore.get()` on
    `pal.ask.v1`, using PR-6's exact enums (`PAIN_KEYS`, `WIN_KEYS`); zod `.strict()`
    and `.max(3)`; no `set()`.
  - `lib/client/home-door.ts`: `doorFor`, per the plan.
  - `components/home-door.tsx`: one constant `display: contents` wrapper carrying
    `data-door`, rendering one keyed slot array.
  - `GuideIdeas` gains `count` / `heading`, applied at **render** time. The mount
    effect is unchanged, so there is no remount, no second rotation advance and no
    double `ideas_shown`.
  - Four doors: `ideas` (default), `numbers`, `plan`, `worried`.
  - Ledger rows `home-door-worried-line` and `guide-ideas-later` (both `Pending`).

**Fold slack after 5.3** (px from the check CTA's bottom edge to the tab bar, every
daypart × rotation page × 4 browsers). **Provenance:** the controller's independent
run was at `d07e2c8` and matched every row **except the R-22 row, which exists only at
`cb0d8d9` and is implementer-reported.** That `d07e2c8` run also hit the fixed-clock
hydration mismatch (§9), so it confirmed the *layout numbers*, not the hydration or
reorder path.

| Door | 360 | 375 | 430 |
|---|---|---|---|
| default | 58.2 | 12.3 | 12.3 |
| numbers pick, no step (falls back) | 58.2 | 12.3 | 12.3 |
| numbers pick, day-4 ideas step (R-22 fallback) | 58.2 | 12.3 | 12.3 |
| **worried**, days 1–3 | **2.8** (thinnest in the matrix) | 26.1 | 26.1 |
| numbers, day 1 (1 idea row at 360, owner ruling) | 62.9 | 17.0 | 17.0 |
| plan, day 1 (1 idea row at 360, owner ruling) | 62.9 | 17.0 | 17.0 |

**Gates at `cb0d8d9`:**
- lint: 0 errors (14 pre-existing warnings)
- typecheck: clean
- `test:pal`: **1345 passed, 31 skipped**
- contract: 9/9
- `PAL_E2E_GUIDE_DOOR=1 npm run e2e -- tests/smoke/dashboard.spec.ts`: **108 passed, 0 failed**

---

## 5. Exact actions — next, in order

Every step marked ***OK*** needs the user's explicit approval **in the new session**.

### A. Confirm nothing moved (read-only)

```bash
cd /home/tefera/Desktop/Revora && git fetch origin --prune && git log --oneline -1 origin/main
git status --short --branch | head -1          # expect feat/guide-pr5-home-layout
git log --oneline origin/main..HEAD            # expect 8 commits, top cb0d8d9
git status --short | grep -v '^??'             # expect only the owner's 3 files
for n in 154 155; do gh pr checks $n | awk -F'\t' '{print $2}' | sort | uniq -c; \
  gh api repos/tkiros/prediabetes-pal/pulls/$n --jq '[.head.sha[0:7], .mergeable_state] | @tsv'; done
curl -sS https://prediabetespal.com/api/health | jq -c '{status, db, issues, door: (.guideDoor|to_entries|map(.value)|unique)}'
gh run list --workflow db-backup.yml --limit 3      # the 09-18 ~11:49 UTC scheduled run
gh run list --workflow hourly-crons.yml --limit 5   # cron gap trend
```

Expect: `origin/main` = `a2d327d`; #154 and #155 `clean` at 11/11; `door == ["off"]`;
`db` ok. **If the 09-18 backup failed, tell the owner first.** (`gh api` sometimes
prints "error connecting to api.github.com"; retry after ~5 s.)

### B. Task 5.3 is DONE, so skip ahead to §5 C

**Already closed.** The scoped re-review (opus) of `d07e2c8..cb0d8d9` reported all 7
findings addressed, with 0 Critical and 0 Important. The ledger holds
`Task 5.3: complete (commits bf60917..cb0d8d9, …, review clean)`. **Do not re-run the
review.** The reviewer mutation-tested with its own React 19.2.8 hydration harness:
- R-21 holds under a discarded concurrent render.
- The "own root per door" remount mutation is caught by the smoke's expando check.
- A detached focus ref is caught by the focus cell.

Its two Minors (N1, N2) and several notes are deferred in §7 for the final review.

**Two facts from that review worth carrying forward:**
- **The smoke expando check is the ONLY thing that detects a remount.** The unit pins
  are blind to it: 0 red under both remount mutations. Never delete or weaken
  `dashboard.spec.ts`'s `__palTaggedBeforeHydration` / `sameNode` assertions.
- **A guest's held layout never catches up.** Nothing re-renders `HomeDoor` after
  hydration for a guest, so if focus was inside the region at hydration, the door stays
  default for that whole visit. That is a safe fallback, accepted under R-21.

The re-review procedure below is kept **only** for reference, in case a future change
reopens 5.3:

- Package: `.superpowers/sdd/2026-09-13-guide-redesign/review-d07e2c8..cb0d8d9.diff`
  (already generated). Brief: `task-5.3-brief.md`. Report: `task-5.3-report.md` (the
  "Review fix round 1" section). Original review:
  `$CLAUDE_JOB_DIR/tmp/review-5.3.md`, mutation script `…/tmp/mut.cjs`. **The job tmp
  dir may be gone in a new session.** The findings are recorded in the ledger either
  way.
- Findings to verdict (full text in the ledger at "Task 5.3 review (opus)"):
  - **R-21:** the focus guard on every layout change.
  - **I1:** a no-remount check that can fail.
  - **I2:** a focus-guard smoke with a control.
  - **R-22:** the day-4 ideas-step fallback.
  - **M1–M3.**
- **Scrutinise hardest: the R-21 mechanism.** `useSyncExternalStore` now hands React
  the *layout*. Confirm `getSnapshot` is pure and reference-stable, that a discarded
  concurrent render can't leave a phantom "on-screen" layout, and that the frozen pick
  cannot flip mid-session.
- Also verify the implementer's correction: the door smoke cells now keep the server's
  date and genuinely hydrate the server tree, rather than hitting a date mismatch that
  forces a client re-render.
- Use **opus**; reviewers must not touch the working tree.
- If findings come back: this is review fix round 2. **The original implementer won't
  survive either**, so dispatch a *fresh* implementer with the brief path, the report
  path and the findings (the report is the persistent memory). Then run a scoped
  re-review.
- When clean, append to the ledger:
  `Task 5.3: complete (commits bf60917..<head>, <N> fix rounds, review clean)`.

### C. Correct #155 before it merges (push to the #155 branch: ***OK***)

#155's inline plan warning (the §3 fold-budget table) says the `worried` door is
"projected **~14px over** at 375 and 430". **That projection was wrong.** It assumed
~44px idea rows; they are 61.2px, and the clinician line uses the 14px disclaimer
style. Measured (§4.4): `worried` fits everywhere (tightest 2.8px at 360). The real
overflow was `numbers`/`plan` at **360** (−6.3px), resolved by the owner's ruling
(one idea row below 375px for those two doors).

1. `git switch docs/guide-pr4-merged-plan-status` (or edit via a worktree).
2. Replace that warning paragraph in
   `docs/superpowers/plans/2026-09-13-guide-redesign.md` with the measured matrix and
   the owner ruling.
3. Fix the matching sentences in #155's **PR body** and the commit message's
   description (the PR body via `gh pr edit 155 --body-file …`).
4. **Also commit this handoff** in the same amendment
   (`git add docs/handoff/2026-09-18-guide-redesign-pr5-tasks-1-3-built-continuation-prompt.md`,
   by explicit path). That matches the prior sessions' pattern of the continuation
   prompt riding in the next docs PR, and it stops the file sitting untracked on one
   disk.
5. Gates, commit, push, wait for 11/11.

### D. Task 5.4: smoke for the Home layout

Brief: `.superpowers/sdd/2026-09-13-guide-redesign/task-5.4-brief.md`. It is only two
lines, and it is under-specified.

- **Already done by 5.3, do not duplicate:** seeding `pal.ask.v1` per door and the
  per-door fold measurement (ruling R-3 is satisfied).
- **Still to do:**
  - The quick row has exactly four links and no accent fill (A-74).
  - `/learn` is reachable from it.
  - At 1280 the column order is unchanged and the sidebar still has five slots.
  - `page.locator("main")` text has no `%`.
- **Carried in from earlier tasks. Assert these explicitly:**
  - **`/learn` renders behind the flag at 375 and 1280** (Task 5.2's done check,
    browser-only, not yet verified).
  - **A second tap on the quick row's Ideas tile, when the URL already ends in
    `#ideas-title`:** does Next `<Link>` scroll again? (A 5.1 review ⚠️ item.) The
    expand still fires via the CustomEvent; the question is the scroll.
- Run both configurations: `PAL_E2E_GUIDE_DOOR=1 npm run e2e -- tests/smoke/dashboard.spec.ts`
  and `PAL_E2E_GUIDE_DOOR=ideas,source npm run e2e -- tests/smoke/dashboard.spec.ts`.
- Never write the literal `NEXT_PUBLIC_GUIDE_DOOR` under `tests/smoke/`; use
  `doorSurfaceOn(surface)`.
- Model: standard (sonnet) implementer, sonnet reviewer.

### E. Task 5.5: the hero asks the guide's question

Brief: `task-5.5-brief.md`. It has the exact code, the test and the commit message.

- `components/home-check-hero.tsx`: the `<h2>` is at **line 47** now, not the plan's
  `:38`. Change it to
  `{guideDoorEnabled("home") ? "Unsure about a meal?" : "What are you eating?"}`.
- Add a pin to `tests/unit/pal/guide-door.test.ts`, and file the ledger row
  `home-check-hero-title` (`Pending`, `product-role`, both strings).
- **Verified safe:** "What are you eating?" appears only in
  `guide-door.test.ts.snap` entries whose flags are `""` and `"ideas,source"`, where
  `home` is off, so they stay byte-identical. No smoke pins the text.
- ⚠️ **Do NOT assume the change is fold-neutral.** Both strings are 20 characters, but
  glyph widths differ, the H2 is ~29px, and **`worried` at 360 has only 2.8px of
  slack**. This session's fold projection was wrong twice (§9). **Require the flag-on
  e2e leg after 5.5** (`PAL_E2E_GUIDE_DOOR=1 npm run e2e -- tests/smoke/dashboard.spec.ts`)
  and read the `worried` 360 row before believing it. If the new H2 wraps or widens and
  the fold fails, that goes back to the owner, as the last fold decision did.
- Model: cheapest tier (the code is transcription), sonnet reviewer.

### F. Final whole-branch review, then push and open PR-5 (push/PR: ***OK***)

1. `scripts/review-package docs/superpowers/plans/2026-09-13-guide-redesign.md a2d327d HEAD`,
   then dispatch the final review on **opus**. Point it at every `minor (deferred)`
   line in the ledger (§7) so it can triage what must be fixed before merge.
2. One fix dispatch for all findings, one scoped re-review, and adjudicate the
   residuals.
3. **PR-5 done check (plan):** all gates plus both smoke configurations green; rows
   `home-quick-row`, `learn-tiles` and `home-check-hero-title` filed (batch 2).
4. ***OK*** → push `feat/guide-pr5-home-layout` and open PR-5 against `main`. PR
   bodies end with the Claude Code attribution lines. Given §3's single-disk risk,
   **ask to push the branch at the start of the session.** 5.1–5.3 are all
   review-clean now; opening the PR can wait for 5.4, 5.5 and the final review.
5. Under `strict: true`, once #154 or #155 merges PR-5 will be `behind`, and
   update-branch is a push (***OK***).

### G. Merge #154 and #155 (***OK each***; one at a time under `strict`)

- **#154 first.** It fixes a live privacy-notice defect. Its CI is 11/11 and clean.
  `gh api -X PUT repos/tkiros/prediabetes-pal/pulls/154/merge -f merge_method=merge -f sha=7333e98c01e3062239fed4deeead3ca8ac8f6438`
  (re-read the head first; if it moved, use the new one). #155's head at writing was
  `2137db1e0e57cde218d28d78da886cec021f60d5`, which changes once §5 C amends it.
- **#155 only after §5 C amends it.** It will go `behind` after #154 merges, so run
  update-branch first (a push, ***OK***).
- After each merge: six push checks green on `main`, the Vercel production deploy
  succeeds, and `/api/health` shows `db` ok with every door still `off`. Then delete
  the branch local and remote (***OK***).

### H. The pre-existing guest hydration bug (owner's call; own PR)

See §6. Recommend a separate small PR via the `investigate` skill (CLAUDE.md routing:
bugs → `investigate`). Do not fold it into PR-5.

---

## 6. Pre-existing production bug found this session (verified, NOT fixed)

**Guest Home hydration text mismatch, every evening in the US.**

- `components/guest-dashboard.tsx:114` computes `now = new Date()` **outside** the
  hydration gate.
- `:77` formats `todayLabel: now.toLocaleDateString("en-US", …)` with **no
  `timeZone`**.
- `components/dashboard-view.tsx:122` renders `data.todayLabel` in the Home `<h1>`
  **with every flag off** (`weekOn` is false while `orient` is shut). It is live in
  production today.
- SSR formats the date in the server's zone (UTC on Vercel); the browser formats it in
  the guest's. Whenever those dates differ — US Eastern 20:00–24:00 and US Pacific
  17:00–24:00, every day — hydration hits a text mismatch, React discards the server
  tree and client-renders all of Home.
- **Cost:** the SSR benefit is lost on the most-visited signed-out page, and the
  headline can flash the wrong date.
- **Signed-in users are unaffected.** `app/(app)/home/page.tsx:149` passes
  `timeZone: timezone`, and `DashboardView` is a server component for them.
- **Side effect on tests:** the PR-1 default fold smoke uses a fixed date, so it hits
  the same mismatch. Its numbers are valid, but it does not exercise real hydration.
  The 5.3 door cells were fixed to avoid this; the PR-1 cells were left alone, as out
  of scope.

---

## 7. Rulings made this session on the owner's behalf (review these)

**One owner ruling, asked via the question tool:** below 375px, the `numbers` and
`plan` doors show **one** idea row instead of two (keyed on the *effective* door; not
`worried`). This is A-93's trade, carried one row further at the one width where
Task 1.8 already hides row 3.

**Controller rulings** (full text in the ledger):

| # | Ruling | Cost if wrong |
|---|---|---|
| — | #154 includes `auth.ts`'s docstring (same stale Railway claim, 2 comment lines) | revert two comments |
| — | #154 ships **unflagged**: a false legal disclosure must not wait behind a feature flag | ~zero |
| — | #154 files **no** ledger row (the ledger governs none of the sub-processor list; this replaces a string rather than adding one) | one row later |
| — | `env-reference.md` left out of #154 (an unrelated audit reconcile) | one docs commit later |
| R-1 | Quick row is a **client** component (the brief contradicted itself) | one directive |
| R-2 | See-all trigger is a **window CustomEvent**, expand-only, listener only under `ideas-full` | swap for a store |
| R-3 | 5.4 seeds `pal.ask.v1` per door and measures the fold per door (satisfied by 5.3) | longer smoke |
| R-4 | 5.3 adds `count`/`heading` to `GuideIdeas` | none |
| R-5 | An exhausted shrink order escalates to the owner, not the implementer | — (it fired; the owner ruled) |
| **R-6** | **Overrode the plan's icons.** DESIGN.md §7 marks Bookmark/Compass as shell nav, and the tab bar on the same screen binds Compass→Journey, Bookmark→Meals. So Journey→**Compass** and Learn→**new IconBook** | two icon swaps + one SVG |
| R-7 | Learn reuses `LearnLink` (ruling F-38: one emitter of `learn_opened`) | revert to inline `track` |
| **R-8** | **Overrode the brief's "round."** Quick tiles are 14px / `--border-strong` like `.idea-row`: the brief's 16px is off DESIGN.md's radius scale, and C7 rejects icon-in-circle | one radius value |
| — | `grid repeat(4,1fr)` is fine vs the brief's "flex" | none |
| R-9 | `/learn` gates on `home` (plan line 252) | one surface name |
| R-10 | Numbers tile keyed on the `LEARN_NUMBERS_HREF` constant, not a flag | none |
| **R-11** | **Omitted the doctor tile.** `=1` opens `doctor` and `/learn/doctor` doesn't exist, so the tile would be a 404 | one conditional tile |
| R-12 | Added `id="saved"` (the brief's `/meals#saved` anchor did not exist) | one attribute |
| **R-13** | First-week tile only when `orient` is on (`home` doesn't require `orient`, so a valid production list would have shown a 404 tile) | one conditional |
| R-14 | No change to `robots.ts`/`seo-meta.test.ts` (PR-3 already did it) | none |
| R-15 | Test must not copy `collectText` verbatim | — |
| **R-16** | **Overrode the brief's `--border-soft`** on `/learn` tiles → `--border-strong`. The plan's only reason, DESIGN.md "one step from its plane", is about *background*, not border | one token |
| R-17 | `ask-store.ts` uses PR-6's exact enums; read-only `get()` | a type edit in PR-6 |
| R-18 | Door reaches `GuideIdeas` via render-time props (never a remount) | alternate prop path |
| R-19 | `worried`: `orientationDay === null` counts as past day 3 | line position for no-week users |
| R-20 | Two idea rows only while a line sits *above* the ideas; otherwise three | one row count per door |
| R-21 | Focus guard on **every** layout change (the migration refresh can re-layout); stale-but-safe | one rare-path rule |
| **R-22** | `numbers`/`plan` fall back to default when the day's step targets `#ideas-title` (it contradicted "Ideas for later") | one condition |
| R-23 | Accept `hasStep` excluding A-83's `SIGNIN_STEP` (a sign-in line is not the plan sequence) | one condition |
| — | 5.3 implementer on **opus** (the advisor had suggested standard) | cost only |

**Deferred minors for the final review to triage:**

- 5.1: `lib/client/ideas-expand.ts:17-19` redundant `handle` wrapper.
- 5.1: `components/icons.tsx:3` says "fourteen glyphs"; there are now 17 (the count
  was already wrong before).
- 5.1: `home-quick-row.tsx`'s doc comment narrates the fix-round history.
- 5.2: `.learn-tile` comment (`globals.css` ~4236-4244) is ~9 lines for one token.
- 5.3: M4, the server-snapshot source pin (necessarily edited in fix r1).
- 5.3: M5, a low-value no-transition pin on a `display: contents` box.
- 5.3 (re-review N1): `home-door.tsx:114-120`'s comment says React calls the snapshot in
  "two places". There are three. It omits the pre-commit consistency check on
  non-blocking lanes, which is exactly what makes R-21 hold under `router.refresh()`.
- 5.3 (re-review N2): `home-door.tsx:79` exports `sameLayout` but uses it only in the
  file.
- 5.3 notes:
  - R-23's `SIGNIN_STEP` exclusion has no pin (mutation U12: 0 red).
  - No repo test exercises the transition-tear path behaviourally; the harness proved
    it, but the harness is not in the repo.
  - The door cells no longer cover the soft-nav mount path.
  - `todayAt` (`spec:477`) mismatches if a run straddles midnight. It fails loudly, not
    silently.
- Note → **PR-6:** `ideas_shown` carries no row count, so kill line 2's tap rate now
  mixes 1-, 2- and 3-row impressions. The door belongs in PR-6's closed-enum event.

---

## 8. Open decisions for the user

| # | Decision | Recommendation |
|---|---|---|
| 1 | **Merge #154** (live privacy notice names Railway) | **Yes, now.** Green, clean, one-line user-facing fix |
| 2 | Merge #155 | After §5 C corrects the false fold projection |
| 3 | Push the local PR-5 branch | **Yes, now.** 5.3 has closed, so all 8 commits are review-clean and sit on one disk. Pushing a branch is not merging it: the PR can be opened later |
| 4 | Guest Home hydration bug (§6) | Own small PR via `investigate`; not in PR-5 |
| 5 | The four production checks (test account via onboarding; account export; change a reminder; sign in with a real account) | Still never done: the last unverified part of Level 1 |
| 6 | Cron scheduler: gap now **5 h** vs a 2 h threshold | #133 heartbeat plus a scheduler that actually runs hourly (external or Vercel) |
| 7 | Send the safety-owner submission (`docs/handoff/2026-09-17-safety-owner-submission-draft.md`) | Now; it gates every flip. **Add PR-5's new rows** (§9 trap): `home-quick-row`, `learn-tiles`, `home-door-worried-line`, `guide-ideas-later`, and (after 5.5) `home-check-hero-title`. Also add the steered-device note carried from the prior handoff |
| 8 | `NEON_*` integration variables | Review scope and sensitivity; don't delete blindly |
| 9 | D5 concierge test / D7 claim class | Start now, in parallel. They gate every flip |
| 10 | Label eval `npm run eval:pal:ideas` (~$19) | Owner runs it once; one run covers all 30 lines |
| 11 | Dependabot #137–#150; #111/#128; #133–#136 | One at a time |

**Level 2 gates are unchanged** from the prior handoff (§6 there): D5, D7, the batch
approvals, the label eval, the revert rehearsal, the production-config CI job, D6's
landing line, the A-44 paragraph, and the post-deploy checks. `home` additionally
needs `ideas` and `ideas-full` live, plus batch 2's Home rows `Approved`.

---

## 9. Traps

### New this session

- **The e2e build rewrites `tsconfig.json`.** A flag-on e2e build temporarily adds
  `.next-e2e-legacy/types/**/*.ts` to its includes and restores it afterwards. An
  agent staging with `-A` during a concurrent run would commit it. Explicit-path
  staging is what prevents this. **Never commit `tsconfig.json`.**
- **Reviewers mutation-testing in the shared tree.** The 5.2 reviewer edited files in
  place and restored them; no harm, but it races an implementer's commit. Rule from
  then on: mutate copies in `$CLAUDE_JOB_DIR/tmp/` or in-memory strings only.
- **A fixed fake clock breaks hydration.** `page.clock.install({ time: <fixed date> })`
  makes the browser's date differ from the server-rendered `<h1>` date. React then
  discards the server tree and client-renders, so **a test can never observe a
  post-hydration reorder or a remount**. The 5.3 door cells now keep the server's
  date and set only the hour. The PR-1 default fold cells still use a fixed date.
- **Idea rows are 61.2px, not 44px** (two-line floor: 8px×2 padding + 2px border).
  Plan-era fold arithmetic assuming 44 is wrong. Measure; don't project.
- **The plan's shrink order is already spent** (Task 1.8, `5de93b6`): `.ideas-sub` is
  14px, block padding is 12px, and `@media (max-width: 374px)` hides row 3 for
  everyone. There is nothing left to shrink.
- **`worried` at 360 has 2.8px of slack.** Anything added above the Home fold needs
  the flag-on e2e leg re-run before it is believed.
- **The react-hooks lint rules are errors:** `react-hooks/refs`, `/purity` and
  `/set-state-in-effect` (from `eslint-config-next`'s recommended set; the repo
  restates `set-state-in-effect` at `eslint.config.mjs:72`). They rule out
  `useHydrated()` plus setState-in-effect patterns. 5.3 uses `useSyncExternalStore`
  directly.
- **`SURFACE_ROWS` is pre-populated.** `SURFACE_ROWS.home` has listed `home-quick-row`,
  `learn-tiles`, `guide-ideas-later`, `home-door-worried-line` and
  `home-check-hero-title` since PR-1 (A-101). New rows need filing in the ledger only;
  don't edit `lib/guide-door-flag.ts`.
- **`/pantry` lives at `app/pantry/`,** outside the `(app)` group.
- **The safety-owner submission is stale for PR-5.** It covers batches 1, 2 (18 rows)
  and 3. PR-5 files batch-2 Home rows not in it.
- **Subagent messages cross and repeat.** Idle notifications re-send old reports; a
  "resume" message can arrive after the work is done. Check `git log` and `git status`
  before acting on a stale notice.
- **Next `<Link href="#…">` re-scroll on a second tap** is unverified (§5 D).
- **Every step line wraps to two lines at every width** (64.5px), even the shortest
  (50 characters). Shortening step copy cannot recover fold space.

### Carried forward (full lists in the 09-17 prompts)

- Neon from this machine needs
  `NODE_OPTIONS=--network-family-autoselection-attempt-timeout=5000`; `drizzle-kit
  migrate` exits 1 silently; `pg-connection-string` echoes the URL on `EINVAL`;
  `source`-ing an env file with an unquoted `&` echoes it; the pooled host is for
  runtime and the direct host for migrations, backups and governance.
- gitleaks `generic-api-key` matches the quoted `STATE_KEY` assignment; write "the
  `STATE_KEY` constant (value `pal.orient.v1`)".
- CI runs only on opened / synchronize / reopened. `strict: true` means the next PR
  goes `behind` after every merge. `gh pr checks` has no `--json`; parse the tab
  columns.
- `next dev` rewrites `CLAUDE.md`; never commit that block.
- Smoke: never write the literal `NEXT_PUBLIC_GUIDE_DOOR` under `tests/smoke/`; use
  `doorSurfaceOn(surface)`. No local Postgres, so DB-backed smoke specs skip locally.
- Analytics is a closed enum; new members go before `photo_draft`. It never carries
  meal text, an A1C or any health value.
- DESIGN.md §5 bans invisible hit-area expansion. The global
  `button, input, textarea { min-height: 44px }` does not reach `<a>`.
- Verify end to end before asserting. Trust files and API state over any claim,
  including this one.

---

## 10. Standing constraints (from the user and `CLAUDE.md`)

- **Protected `revora` strings:** `tests/unit/pal/owned-domains.test.ts` (the
  denylist), `tests/unit/pal/sw-dev-teardown.test.ts`, the docstrings in
  `lib/pal/contact.ts` and `lib/server/email.ts`, and historical docs under
  `docs/handoff`, `docs/archive`, `docs/audit`, `docs/qa`, `PRD`, `predict`,
  `.planning/phases`, `.planning/research`.
- **Lockstep pairs:** `hourly-crons.yml` `APP_URL` must equal `CANONICAL_APP_URL`
  byte for byte. The prompt-leak regex (`postprocess.ts`, `eval-rubric.ts`) changes
  only with the opening line of `lib/pal/prompt.ts`.
- **Owner learnings:** no synchronous selling; the dashboard keeps the full shell by
  conviction; the F-ASK ruling is settled.
- **Skill routing:** bugs → `investigate`; ship → `ship`; review → `review`.
- **Every commit:** `npm run lint && npm run typecheck && npm run test:pal && npm run contract`.
- Commit messages end with the session's `Co-Authored-By` / `Claude-Session` lines;
  PR bodies end with the Claude Code attribution.

---

## 11. Suggested first moves

1. Run §5 A (read-only), including the 09-18 scheduled backup and the cron gap.
2. Ask the user in one message:
   - merge #154 now?
   - push the PR-5 branch once 5.3 closes?
   - correct and then merge #155?
   - handle the hydration bug now or later?
   - the production checks, the submission (now needing PR-5's rows), `NEON_*`,
     D5/D7.
3. Invoke `/superpowers:subagent-driven-development`. Tasks 5.1–5.3 are complete in
   the ledger (§5 B), so **resume at Task 5.4** (§5 D), then 5.5 (§5 E), then the final
   whole-branch review (§5 F).
4. With approval: §5 C (amend #155), §5 G (merges), §5 F (push and open PR-5).
