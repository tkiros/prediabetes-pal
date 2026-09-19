# Continuation prompt: guide redesign, PR-6 (intake / F-ASK) open as #157, green, awaiting the owner's merge word

*Written 2026-09-19 ~03:05 UTC (2026-09-18 ~23:05 EDT). This supersedes
`docs/handoff/2026-09-18-guide-redesign-pr5-merged-pr6-next-continuation-prompt.md`, which is committed on the PR-6
branch as `ab99dd3`. That earlier doc described PR-6 as unbuilt and `main` CI as "in progress". PR-6 is now built,
reviewed, pushed and green, and `main`'s CI turned out red (see §2).*

*This file is **untracked**. Commit it by explicit path in the next docs-touching commit (§6 E).*

You are continuing the Prediabetes Pal **guide redesign** in `/home/tefera/Desktop/Revora`.

**Sources of truth**
- **Plan:** `docs/superpowers/plans/2026-09-13-guide-redesign.md`. Two kinds of note supersede the text they annotate:
  - inline "review A-nn" notes;
  - the dated "*(final review 2026-09-18, ruling R-nn: …)*" annotations.

  The Decision Audit Trail A-01…A-121 is at the end.
- **Spec:** `PRD/Prediabetes_Pal_Guide_Redesign_PRD_v1.1.md`. The spec wins any conflict.
- **SDD ledger:** `.superpowers/sdd/2026-09-13-guide-redesign/progress.md`. It is git-ignored and serves as the recovery map.
  - Its first line names the plan.
  - This session is `## Session 2026-09-18 (c)`, from **line 786** to the end.
  - It holds the PR-6 pre-flight table, rulings R-33…R-53, every deferred minor and every review verdict.
  - Briefs, reports, reviews, diff packages, `pr6-constraints.md` and `pr6-final-review.md` sit beside it.
  - **Keep the workspace.** The plan is not finished.

**How to run work:** use the `/superpowers:subagent-driven-development` loop, the same one PR-5 and PR-6 used. Put per-PR binding constraints in a file like `pr6-constraints.md`, and hand every subagent that file.

---

## 1. Hard rules (binding; approval never carries over between sessions)

1. **Never do any of these without the owner's explicit OK in the new session:**
   - push, merge, force-push or update-branch;
   - run a production migration;
   - change a CI or security gate (including `.gitleaksignore`), GitHub repo settings or secrets, or a Vercel env var;
   - redeploy production.

   Standing rule: "Never push or merge without asking." The approvals given this session ("proceed; fix in PR-6", "push and create a PR") **do not** cover merging #157.
2. **Never run `npm run eval:pal:ideas`.** It makes ~1,800 live model calls (~$19). The owner runs it.
3. **Copy ledger (`docs/safety/copy-ledger.md`):**
   - never set a row to `Approved`;
   - never change an existing row's Copy or Status cell;
   - new user-facing strings get a new row filed `Pending | Yes`;
   - a new row's own cells may be edited only in the PR that files it.
4. **Never propose or perform `NEXT_PUBLIC_GUIDE_DOOR=1` in production.** Production carries an explicit surface list, and only once that list's gates are met.
5. **Every user-visible guide change goes behind `guideDoorEnabled("<surface>")`, server side too.** With a surface off, the page stays byte-for-byte what `main` serves.
6. **Next.js here is 16.3 with breaking changes.** Read `node_modules/next/dist/docs/` before touching a Next API.
7. **Credentials:** never print, echo or paste one. See `docs/runbooks/database-governance.md`.
8. **Every subagent stages by explicit path.** Never `git add -A`, `-a` or `.`. Never commit `tsconfig.json`: the e2e build rewrites it.
9. **No reviewer may modify the working tree, even temporarily.** Mutation tests go on copies in `$CLAUDE_JOB_DIR/tmp/`.
10. **Never touch the owner's Docker containers `hl-shadow` and `open-design`.**

---

## 2. Status in one paragraph (verified 2026-09-19 03:03 UTC)

**`main` is red, production is healthy, and the fix is in the open PR #157.**

- **`main`'s CI:** the push-CI run for `5df3557` (#156's merge, run `35367954759`) failed one cell, `[Mobile Safari] tests/smoke/dashboard.spec.ts:734`. That is PR-5's signed-in door cell.
  - WebKit reported an aborted in-flight `/terms?_rsc=…` prefetch as a page error.
  - The prefetch was cut off by the cell's own final `page.goto`, after the `pageerror` listener was attached.
  - The door itself rendered correctly.
  - The owner chose (question tool, ~16:40 UTC 09-18) **"Proceed; fix in PR-6"**.
- **PR-6** (plan §4, Tasks 6.1–6.6) was built through the SDD loop on `feat/guide-pr6-intake` in 11 commits (`5df3557..3437c2a`).
  - It was reviewed per task, then as a whole branch (opus: **"Ready to merge: Yes"**, 0 Critical / 0 Important), then through one fix wave and its re-review.
  - With the owner's OK ("Push and create a PR", ~22:10 UTC) it was **pushed and opened as #157**.
  - **CI is 11/11 pass, `CLEAN`, `MERGEABLE`** (run `35416759765`). The `guide door 1` leg ran 480 passed / 28 skipped / 0 failed, and the signed-in cell passed on all 4 browsers, Mobile Safari included.
  - **#157 is NOT merged.** Merging needs the owner's word.
- **The PR-5 branch** is deleted, local and remote.
- **Production:** `/api/health` reports `{"status":"healthy","db":"ok","issues":[],"door":["off"]}`.

---

## 3. Where things are (verified 2026-09-19 03:03 UTC)

### Checkout

| Item | State |
|---|---|
| Path | `/home/tefera/Desktop/Revora`, the only worktree (`git worktree list` shows one) |
| Current branch | `feat/guide-pr6-intake` @ **`3437c2a`**, tracking `origin/feat/guide-pr6-intake` (same SHA) |
| `origin/main` | **`5df3557`**, "Merge pull request #156". It is an ancestor of the PR-6 branch, so the branch is up to date |
| Owner's uncommitted files (**never commit them**) | `CLAUDE.md` (the `next dev` block), `.planning/STATE.md`, `docs/ops/env-reference.md`, plus many untracked files |
| Untracked, this session's | **this file** |
| Docker | `pal-e2e-pg` (the disposable Postgres) is **removed**. `hl-shadow` and `open-design` are the owner's |
| SDD workspace | `.superpowers/sdd/2026-09-13-guide-redesign/`, kept. Other files directly under `.superpowers/sdd/` belong to other plans; leave them alone |

### Production (https://prediabetespal.com)

- **Deployed:** `5df3557` (PR-5 merge). Every guide door is `off`, so PR-5's Home layout and PR-6's intake are dormant.
- **`/api/health`:** healthy, db ok, no issues, doors `["off"]`.
- **Crons:** `hourly-crons` scheduled runs landed at 21:18 and 23:41 on 09-18, and at 01:52 on 09-19. The gaps are ~2h20m, against a 2h staleness threshold. Earlier gaps ran ~5h. Expect `degraded` whenever a gap passes 2h.
- **Backups:** the last `db-backup` run succeeded at 2026-09-18 11:24 UTC. The next one is due ~11:24 UTC 09-19.
- **Label cache:** `lib/pal/guide-ideas.labels.json` still does not exist. The production guard therefore closes `ideas`/`ideas-full` in any build, and with them `home`, `orient` and `intake`.

### Open PRs

| PR | State | Note |
|---|---|---|
| **#157** PR-6 intake + main's WebKit fix | **CLEAN, 11/11 pass** | awaiting the owner's merge word (§6 B) |
| #137, #138, #140, #141, #142, #143, #148, #150 (dependabot) | behind / unknown | each needs update-branch under `strict`, one at a time. #142 bumps `next` 16.3.0→16.3.5 |
| #111 typescript 6→7 · #128 eslint 9→10 | lint fails | wait for upstream plugin support, or close |
| #133 cron heartbeat · #134 billing (draft) · #135 owner decisions · #136 cohort report | far behind `main` | need update-branch |

**Required checks on `main` (`strict: true`):**
- `typecheck · lint · contract · build`
- `unit · evals (mock — no keys, no spend)`
- `playwright (incl. axe a11y)`
- `secret scan`
- `playwright · guide door 1`
- `playwright · guide door ideas,source`

All Playwright legs run with a Postgres service in CI, so DB-backed (signed-in) smoke cells run there. Under `strict`, every merge puts the next PR `behind`.

---

## 4. What was done this session (2026-09-18, ~16:25 UTC → 2026-09-19 ~03:05 UTC)

### 4.1 State check, main's red CI, owner decision
1. **§5 A of the previous handoff.** `origin/main` was `5df3557`, production healthy, doors off, `pal-e2e-pg` absent. `main`'s CI for `5df3557` was still running.
2. **It finished `failure`** on the one WebKit cell described in §2. The rest: 471 passed, and CI runs with `retries: 0`. The handoff said to stop and ask, so I did.
3. **Owner's answer** (question tool): **"Proceed; fix in PR-6 (Recommended)"**.
4. **PR-5 branch deleted** (`git branch -d` + `git push origin --delete feat/guide-pr5-home-layout`; it was `dc97397`).
5. **`feat/guide-pr6-intake` cut** from the updated `main` (`5df3557`).

### 4.2 PR-6 pre-flight scan (in the ledger)
- One row for each task pair and for each task.
- **Findings:**
  - `lib/client/ask-store.ts` already existed from PR-5, so 6.2 adds only `set()`.
  - There was no `.idea-row[aria-pressed]` style.
  - 6.2's skip semantics were unspecified.
  - Screen B cannot be finished without 6.4's reply line.
  - `ALLOWED_EVENT_NAMES` must gain `intake_ask`.
  - `ask-response.ts` must join `claims-boundary-copy`'s scan list.
  - The `trust` reply depends on the `source` surface.
  - "calm first steps" conflicts with DESIGN §2.
  - The welcome h1 was unspecified.
  - All five existing tour walks and trial-wall's walk would break under `intake`.
- **Rulings R-33…R-46** were recorded before dispatch (§10).
- **An advisor check** confirmed the "never zero" progress test lists its steps explicitly, so it stays green.

### 4.3 Tasks (serial; every task edits `app/(app)/onboarding/page.tsx`)

| Task | Model | Commits | Review |
|---|---|---|---|
| 6.1 step plumbing | haiku | `85edb1e` + fix `3f9ddbe` | ❌ first: page wiring and `trackedStep` pins missing. **1 fix round**, then clean |
| 6.2 Screen A + `askStore.set()` (+ the previous handoff committed as `ab99dd3`) | sonnet | `ab99dd3`, `b3d8c0e` | ✅ 6 Minor |
| 6.3+6.4 Screen B, `intake_ask`, reply map, expectations line | sonnet | `c224a00` | ✅ 5 Minor |
| 6.5 welcome under intake | sonnet | `d9a645e` | ✅ 4 Minor. One of them surfaced **R-52** |
| 6.6 smoke + the WebKit fix | sonnet | `438484b` | ✅ 6 Minor |
| F: PR-5 parked follow-ups + the R-52 fix | sonnet | `8fb0290`, `6dbf1bb` | ✅ 3 Minor |
| Final whole-branch review | opus | — | **Ready to merge: Yes**, 0 C / 0 I / 7 Minor, every deferred minor "ship as is" |
| Final fix wave (F1–F5) | sonnet | `4213275`, `3437c2a` | scoped re-review: all addressed |

**R-52 was the branch's real catch.** 6.5 rewrote the tour's counter line as four JSX children. That left `renderToStaticMarkup` identical, but the **served** HTML (`renderToString`) gained two `<!-- -->` text-node separators on every flag-off step. So the flag-off page's bytes had changed, invisibly to the existing snapshot. The fix restored the two-child structure. Main-vs-HEAD SSR output was compared through a temporary worktree and came out empty. The new pin `tests/unit/client/__snapshots__/onboarding-flag-off-ssr.html` is byte-equal to main's.

### 4.4 Verification
- **Gates at `3437c2a`:** lint 0 errors (14 pre-existing warnings), typecheck, contract 9/9.
- **Full `npm run test`:**
  - Green, apart from PGlite `createTestDb` hook timeouts in `tests/unit/server`. Each run hit different files (nudge, pantry-schema, trial-start, memory-controls-routes, pantry-sweep), and the machine's load average was ~91.
  - Every one of those files passes alone (66/66 and 31/31).
  - The branch touches no server code.
- **e2e, local, covering the specs PR-6 touches:**

  | Config | Specs | Result |
  |---|---|---|
  | `PAL_E2E_GUIDE_DOOR=1` + local Postgres | onboarding + trial-wall + signed-in cell | 80 passed / 0 failed, 4 browsers |
  | Same, Mobile Safari, `--repeat-each=5` | the signed-in cell | 5/5 |
  | `ideas,source` | onboarding + trial-wall | 68 passed / 8 skipped |
  | no flag | onboarding + trial-wall | 68 passed / 8 skipped |
  | Final wave, flag `1` | `onboarding.spec` | 36 / 0 |
  | Final wave, no flag | `onboarding.spec` | 28 passed / 8 skipped |

- **CI on #157:** 11/11. `guide door 1` ran 480 passed / 28 skipped / 0 failed.
- **Local gitleaks** (docker, repo config and ignore file) over `5df3557..HEAD`: 11 commits, **no leaks**.

### 4.5 Finish
- **Owner's choice** (question tool): **"Push and create a PR"**.
- Pushed, then opened **#157** via `gh api -X POST …/pulls`. The body carries:
  - the "Flip prerequisites for `intake`" section;
  - the main-CI fix;
  - the verification;
  - the Claude Code attribution.

---

## 5. What #157 contains (all user-visible parts behind `guideDoorEnabled("intake")`; `intake` → `orient` → `ideas`)

**The tour under `intake`** has eight screens:
welcome · segment · **ask_pains (Screen A)** · **ask_win (Screen B)** · attribution · a1c · expectations.
The skip link stays on every step. A1C-known guests still skip `a1c`.
**Flag off:** the six-step tour, byte-for-byte, pinned two ways:
- the static `onboarding-flag-off.html`;
- the SSR `onboarding-flag-off-ssr.html`.

| Commit | What |
|---|---|
| `85edb1e`, `3f9ddbe` | `Step` gains `ask_pains`/`ask_win`, plus `STEP_PROGRESS_ASK`, `progressFor`, `nextStepAfterSegment`, a 3-argument `stepCounter` and `TRACKED_STEPS` (funnel `segment → ask_pains → ask_win → attribution → expectations`). Page wiring: `askEnabled = guideDoorEnabled("intake")` |
| `ab99dd3` | the previous session's handoff doc |
| `b3d8c0e` | **Screen A**, "What is hardest right now?" / "Pick up to three." Seven `idea-row` toggle buttons (`aria-pressed`, tap order kept) in a `role="group"`. Live counter (`field-hint`) reads "{n} of 3"; a refused fourth tap reads "Three picked — unpick one to change". Continue is never disabled (zero picks = Skip). `askStore.set()` added (the rest of `ask-store.ts` is byte-identical). `.idea-row[aria-pressed="true"]` accent fill. Row `onboarding-ask-pains` |
| `c224a00` | **Screen B**, "What would count as a win for you?" / "Pick one.", single select (tapping the picked row clears it). An always-rendered `p.page-copy.ask-response[aria-live=polite]` holds `askResponse(win)` from `lib/client/ask-response.ts`, a closed map with the plan's seven lines verbatim. Leaving B fires **one** `intake_ask` `{pain_1,pain_2,pain_3,win}` (a closed enum, before `photo_draft`, and in `ALLOWED_EVENT_NAMES`) and writes `pal.ask.v1` **only if something was picked**. Expectations gains "Ideas come first. The check is there when you are unsure." Rows `onboarding-ask-win`, `onboarding-ask-response`, `onboarding-expectations-ideas`. New `tests/unit/pal/ask-response.test.ts`. `ask-response.ts` added to `claims-boundary-copy`'s `EXTRA_SOURCES` |
| `d9a645e` | **Welcome**: h1 "You were just told you have prediabetes."; copy "Here are meal ideas, calm first steps, and plain answers about what the words mean, in one place. Check any meal when you are unsure."; no verdict badges; "about a minute" on every step's counter. Row `onboarding-welcome-guide`. The intake page pin compares renders with step numbers, bar values and the time claim masked (R-51) |
| `438484b` | **Smoke.** A `passAskScreens` helper in every walk that crosses segment (onboarding.spec ×5, trial-wall ×1). The new `intake: the eight-screen tour` describe has two tests: the full walk (worried + ideas picks → `pal.ask.v1` exact → **client soft-nav** to `/home?stay=1` → `.home-door[data-door="worried"]` under `home`), and skip-both (key absent). **Signed-in cell:** `waitForLoadState("networkidle")` after the magic-link goto and before the listeners, plus a positive `/api/auth/session` email check |
| `8fb0290` | **R-52**: counter line back to two children; `renderToString` flag-off snapshot |
| `6dbf1bb` | PR-5 follow-ups: 3 keyed-Fragment pins (`home-door.test.ts`); `not.toContain('id="saved"')` (`home-layout.test.ts`); `dashboard-view.tsx` comments; plan R-29 annotation at :2119 |
| `4213275` | Plan annotations: `intake` flip prerequisites at Task 6.4, and R-36 / R-49 / R-43 at Tasks 6.3 / 6.4 / 6.5. `onboarding-welcome-guide` Notes now state the PRD §3-vs-§7.3 conflict plainly. A CSS comment says `.ideas-list` has a second user |
| `3437c2a` | The smoke installs a `window.umami` recorder and proves **exactly one** `intake_ask` with exact props, and the exact `onboarding_step` order (both walks) |

**Ledger:** five new rows, all `Pending | Yes | product-role`, ids exactly `SURFACE_ROWS.intake`. **`lib/guide-door-flag.ts` is untouched.**

**Trailers:** three commits were written by subagents (`ab99dd3`, `b3d8c0e`, `438484b`). They carry `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>` without a `Claude-Session:` line. They were not rewritten, because the SHAs are cited in the ledger and every review package.

---

## 6. Exact actions, next, in order

### A. Confirm state (read-only)

```bash
cd /home/tefera/Desktop/Revora && git fetch origin --prune && git log --oneline -1 origin/main   # expect 5df3557 unless something merged
gh pr view 157 --json state,mergeStateStatus,mergeable,headRefOid --jq '{state,mergeStateStatus,mergeable,head:.headRefOid[0:7]}'   # expect OPEN CLEAN MERGEABLE 3437c2a
gh pr checks 157 | awk -F'\t' '{print $2}' | sort | uniq -c          # expect 11 pass
git status --short | grep -v '^??'                                    # expect only the owner's 3 files
curl -sS https://prediabetespal.com/api/health | jq -c '{status, db, issues, door: (.guideDoor|to_entries|map(.value)|unique)}'
```

- If `main` moved since `3437c2a` was pushed, #157 goes `BEHIND` under `strict`. It then needs **update-branch**, which only happens with the owner's OK, and a fresh 11/11.
- `gh api` sometimes prints "error connecting to api.github.com". Retry after ~5s.

### B. Merge #157, ONLY on the owner's explicit word in the new session

Ask in the question tool whether to "Merge #157 now (CI 11/11, CLEAN)". If they approve:

```bash
gh pr merge 157 --merge
# fallback if gh's GraphQL path errors (the Projects-classic deprecation broke `gh pr edit`):
gh api -X PUT repos/tkiros/prediabetes-pal/pulls/157/merge -f merge_method=merge
```

`main`'s history uses merge commits ("Merge pull request #N").

### C. Post-merge verification (read-only)

1. **`gh run list --branch main --limit 4`.** The CI push run for the merge commit must be `success`. **This is the proof that main's red `guide door 1` leg is fixed.** Check the Mobile Safari line of `dashboard.spec.ts:734` in that leg's log:
   ```bash
   gh api repos/tkiros/prediabetes-pal/actions/jobs/<JOB_ID>/logs | sed 's/^.*Z //' | grep 'signed-in Home renders'
   ```
   Get `<JOB_ID>` with `gh run view <RUN> --json jobs --jq '.jobs[]|select(.name|test("guide door 1"))|.databaseId'`.
   - **If it flakes again despite `networkidle`,** apply the final reviewer's deterministic fix in a small PR, with the owner's OK to push. In `tests/smoke/dashboard.spec.ts` (~:771–791), run `await page.goto("about:blank")` after seeding `pal.ask.v1` and before attaching the console/pageerror listeners. That aborts the old document's prefetches before any listener exists. Leave `tagServerIdeasBlock`'s init script as is. Never widen the error filter beyond a message matching both `_rsc=` and `access control checks`.
2. **Vercel Production deploy of the merge commit:** `success`. Check with `gh api repos/tkiros/prediabetes-pal/deployments?per_page=3` or the Vercel dashboard.
3. **`/api/health`:** healthy, doors `off`.
4. **Production `/onboarding` must still be the six-step tour.** Its server HTML should contain `Check a meal. Get a cautious educational read.` and `about 30 seconds`, and must NOT contain `What is hardest right now` or `You were just told`:
   ```bash
   curl -sS https://prediabetespal.com/onboarding | grep -c 'about 30 seconds'
   ```

### D. Delete the merged branch, only with the owner's OK

```bash
git switch main && git pull --ff-only
git branch -d feat/guide-pr6-intake          # -d refuses if not merged
git push origin --delete feat/guide-pr6-intake
```

- If `git switch` refuses because of a local change, stop and report it. Never stash, reset or discard the owner's files.
- **An untracked file that `main` later commits blocks `git pull`/merge.** This session's handoff is untracked and not on `main`, so it won't block. But check the rule before any merge: compare, back up to `$CLAUDE_JOB_DIR/tmp/`, remove, then merge.

### E. Plan-status docs PR (push and PR only with the owner's OK)

The plan's **§1 gate table is stale**:
- **Status line** (plan line 35): still says "as of 2026-09-18 (commit `a2d327d`)" and lists merged work only through PR-4. Add PR-5 (#156, `5df3557`) and PR-6 (#157), both merged dormant.
- **"Ledger batch 2" row** (line 42): still says "the Home/onboarding/F-ASK rows of PR-5/PR-6 are not filed". Both are now filed, **Pending**:
  - PR-5 filed `home-quick-row`, `learn-tiles`, `guide-ideas-later`, `home-door-worried-line`, `home-check-hero-title`;
  - PR-6 filed `onboarding-ask-pains`, `onboarding-ask-win`, `onboarding-ask-response`, `onboarding-expectations-ideas`, `onboarding-welcome-guide`.
- **"F-ASK floor" row** (line 56): add that the screens are built and dormant, and that the floor clock starts only when `intake` is live with its prerequisites (§7).

Commit **this handoff** in the same PR, by explicit path:
`git add docs/handoff/2026-09-18-guide-redesign-pr6-built-continuation-prompt.md`

Precedent: #155 (`docs/guide-pr4-merged-plan-status`). Branch from the updated `main`, run the gates, run the local gitleaks (§11), then push and open the PR only with the owner's OK.

### F. Update the safety-owner submission draft (docs only; sending it is the owner's act)

- `docs/handoff/2026-09-17-safety-owner-submission-draft.md` currently covers batch 1, part of batch 2, and batch 3 (§3b).
- Add PR-5's five rows and PR-6's five rows, with their Copy cells verbatim from the ledger.
- Add the two welcome-row questions (§8 #2, #3) and the A-105 counsel question (§8 #4).
- **This submission gates every production flip.**

### G. What the plan does next, after PR-6

**Tier 1's main PR sequence (PR-1…PR-6) is complete once #157 merges.** Nothing in Tier 1 is buildable right now without an owner or safety decision:

- **Task 6.7** (the 70% floor fallback) is a follow-up **only if** the floor fires. That needs `intake` live, 50 tour starts, and the owner's Umami reading. Do not build it.
- **Gated Tier-1 modules** (plan §2.4) wait on their gates:
  - **F-NUMBERS** (`/learn/numbers`, and the A1C step's Learn link `onboarding-a1c-learn-link`) waits on **D7**: the claim class, from the safety owner or counsel.
  - **F-TREND** waits on **D3** (out-of-range handling) and **RV-3** (the `/journey` `%` rail).
  - **The F-SOURCE `/how-it-works` paragraph** waits on the consistency-eval **panel** run and an `Approved` row.
- **Tier 2** (§5: F-REFER, F-DOCTOR, F-PLAN, F-HABIT) waits on D1, D2 and the safety owner. **Tier 3** (F-DIARY) waits on D4.
- **Small, buildable follow-ups** (below). Each needs a plan/owner nod and its own PR:
  - M4: move focus to the step's h1, or to `#app-content`, on each tour step change, **gated to `intake`** so flag-off stays byte-identical;
  - M7: `aria-labelledby` instead of repeating the h1 in the group label;
  - a `min-height` on `.ask-response` so Continue doesn't jump on the first pick;
  - M6: an eyebrow for Screens A/B. This is new copy, so it needs a new ledger row;
  - the `ideas_shown` effective-door prop (§8 #5).

---

## 7. Flip prerequisites for `intake` (none met yet; also in #157's body)

1. **`orient`, `source` and `home` live.**
   - `source`: the `trust` reply "Every label says where it came from: Prediabetes Pal's rules." is true only under `source`.
   - `home`: `pal.ask.v1`'s only reader is Home's door (`components/home-door.tsx`), so without `home` the picks change nothing.
   - `SURFACE_REQUIRES.intake` in `lib/guide-door-flag.ts` lists only `orient`, so **the production guard does not enforce this** (§8 #1).
2. **Counsel's answer on A-105.** May `intake_ask` send `pain_2`/`pain_3`? These are self-reported categories such as "worried", and the question is whether they fit the privacy page's "coarse, non-identifying" promise. If the answer is no, send `pain_1` only (a small code change).
3. **All five `intake` rows `Approved`,** including the two welcome questions (§8 #2, #3).
4. **A design review of Screens A/B:**
   - the dark-mode pressed fill (same tokens as `.selectable-chip`);
   - the response line pushes Continue down on the first pick;
   - there is no eyebrow;
   - focus falls to `<body>` on step change;
   - the group label repeats the h1.
5. **Plus the plan's Level-2 gates for any flip:**
   - D5 (concierge test) and D7;
   - batch approvals;
   - the label eval (the owner runs `npm run eval:pal:ideas`, which opens `ideas`/`ideas-full`);
   - the revert rehearsal;
   - the production-config CI job;
   - D6's landing line;
   - the A-44 paragraph;
   - post-deploy checks.

---

## 8. Open decisions for the owner

| # | Decision | Recommendation |
|---|---|---|
| 1 | Amend `SURFACE_REQUIRES.intake` to `["orient", "source", "home"]`. This is a one-line change to `lib/guide-door-flag.ts`, which PR-6 was not allowed to touch; tests in `tests/unit/pal/flag-server-twins.test.ts` pin the current errors | **Yes**, as its own small approved PR, before any `intake` flip |
| 2 | Welcome h1 "You were just told you have prediabetes." is PRD §3 verbatim but breaks PRD §7.3 ("second person … never for the user's clinical state"). It also appears before "Family history"/"Just checking" users identify themselves | **The PRD author's call:** amend §3 or §7.3. The row cannot be Approved as written; this is recorded in the row's Notes |
| 3 | "calm first steps" (PRD §3) against DESIGN.md §2 ("Never claim the page is calm"; no mood copy) | Safety owner / PRD author. A one-word amendment to a Pending row |
| 4 | Counsel on A-105: may `intake_ask` send `pain_2`/`pain_3`? | Send with the batch-2 submission (§6 F) |
| 5 | `ideas_shown` should carry the **effective** Home door as a closed enum. Kill line 2's tap rate mixes 1-, 2- and 3-row impressions, and the effective door differs from `doorFor(pains)` when the step is null or `home` is off | Add when kill line 2 is first read (R-39) |
| 6 | PRD §7.4 gives the "ideas come first" expectations line to every user at Tier 1. The plan and `SURFACE_ROWS` put it under `intake` (R-48), so an `orient`-only build never shows it | Note only; this was decided upstream |
| 7 | **Send the safety-owner submission** (after §6 F) | **Now.** It gates every flip |
| 8 | `/learn`'s "Pantry review" tile links a Learn index to a paid sales page (`app/pantry/page.tsx`, indexable, with a Buy button) | Plan-level, the owner's call. The Phase-2 design review already flagged "3 of 5 Learn tiles are not learning content" |
| 9 | Guest Home hydration mismatch every US evening. `components/guest-dashboard.tsx:114` computes `now` outside the hydration gate, and `:77` formats the date with no `timeZone`. SSR (UTC) and the browser disagree, so React discards the server tree | Its own small PR via the `investigate` skill (deferred by the owner on 09-18) |
| 10 | Firefox CSP "Missing 'unsafe-eval'" console error on pages that build a client `z.object` (zod 4's JIT probe) | Harmless. Optional one-liner: `z.config({ jitless: true })` on the client |
| 11 | Cron scheduler gaps (up to ~5h earlier; ~2h20m now) against a 2h staleness threshold | #133 heartbeat, plus a scheduler that actually runs hourly |
| 12 | The four production checks (test account via onboarding; account export; change a reminder; sign in with a real account) | Still never done |
| 13 | Label eval `npm run eval:pal:ideas` (~$19) | The owner runs it once. It opens `ideas`/`ideas-full` in a production build |
| 14 | D5 concierge test / D7 claim class | These gate every flip; start in parallel |
| 15 | `NEON_*` integration variables (stale; they hold the dead pre-reset password) | Review scope; don't delete blindly |
| 16 | Dependabot #137–#150; #111/#128; #133–#136 | One at a time under `strict`. #142 is `next` 16.3.5 |

---

## 9. Deferred minors (the final review triaged all of them "ship as is")

- **6.1:** flag-off `STEP_PROGRESS` `ask_pains`/`ask_win` = 0 is not asserted (unreachable; typecheck forces the keys).
- **6.2:**
  - dark-mode pressed contrast is unverified;
  - a repeated refused fourth tap is not re-announced;
  - page wiring is covered by smoke, not unit.

  (The counter class and the transition `color` were already fixed in 6.3.)
- **6.3:**
  - the `pickWin` toggle is inline and untested;
  - `if (skip) setWin(null)` is a dead write;
  - the empty `.ask-response` has no min-height (a design-review item);
  - nothing asserts the reply lines are link-free;
  - the `ask_win` render test covers only the empty state.
- **6.5:**
  - the intake welcome is pinned with `toContain` only;
  - there is no "about a minute" assertion on A/B.
- **6.6:**
  - `passAskScreens` is duplicated in two specs;
  - the url-not-`/signin` check is point-in-time;
  - there is no `.ok()` check before `.json()`;
  - `networkidle` is timing-based;
  - skip-both doesn't assert Home's ideas mounted;
  - `.home-door` is unscoped.
- **F:**
  - the SSR test duplicates `renderStep`'s try/finally;
  - the `dashboard-view.tsx` ~:133 comment wording;
  - the Fragment pins are source-substring matches.
- **Final review M4–M7:** listed in §6 G as follow-ups.

---

## 10. Rulings made this session on the owner's behalf (full text in the ledger; review these)

| # | Ruling | Cost if wrong |
|---|---|---|
| — | Asked the owner when `main` went red instead of proceeding (the handoff's stop rule). The owner chose "fix in PR-6" | none |
| R-33 | New test imports merged into the existing import from the page | none |
| R-34 | 6.1 wired the page before the screens existed | a blank card in intermediate commits, under `intake` only |
| R-35 | `ask-store.ts` gains `set()` only; the enums, schema and `get()` are byte-identical (the PR-5 contract) | none |
| R-36 | Skip means "no answer". Continue at zero picks = Skip. Skip on A clears the picks. `pal.ask.v1` is written only if something was picked. An unanswered re-take keeps the last answer. *Premise corrected by the final review:* re-takes are ordinary (daily-loop links `/onboarding`; FirstRunGate re-sends profile-less guests) | a stale door for someone who deliberately skips a re-take |
| R-37 | 6.3 and 6.4 built and reviewed as one unit | a larger review |
| R-38 | `intake_ask` sends all three pains; counsel's A-105 answer gates the flip, not the build | two props removed later |
| R-39 | No separate `door` prop (it is `doorFor(pain_1)`, already derivable). The `ideas_shown` effective-door prop is parked | one prop added later |
| R-40 | The `trust` reply ships verbatim; its `source` dependency is recorded in its row, the plan and the PR body | an unenforced flip order (§8 #1 fixes it) |
| R-41 | Always-rendered `aria-live` reply `<p>`, empty until a pick | an empty `<p>` on Screen B |
| R-42 | "calm first steps" ships verbatim from PRD §3, flagged on the row | a one-word amendment |
| R-43 | Welcome h1 = PRD §3's first sentence, copy = its other two; nothing invented; §7.3 conflict flagged | a heading swap |
| R-44 | A spec-local `passAskScreens` helper in every walk that crosses segment | a helper call per walk |
| R-45 | The eight-screen walk picks "worried" first, so the soft-nav mount of a non-default door is tested | one assertion block |
| R-46 | The PR-5 non-smoke follow-ups batched as Task F | none |
| R-47 | Screens A/B: no eyebrow; h1 = the question, `page-copy` = "Pick up to three." / "Pick one."; rows in `div.ideas-list[role=group]` | a heading/sub split |
| R-48 | The "Ideas come first" line sits after the four bullets, before the first-week line | a move |
| R-49 | `onboarding-ask-response` is one row, class `product-role` (the validator needs one class); the Notes name the two clinician-routing lines | a relabel on approval |
| R-50 | Screen B: tapping the picked row clears it | one line |
| R-51 | 6.5's pin masks step numbers and bar values as well as the time claim (6.1 changes both under intake) | a looser comparison on those tokens |
| R-52 | Restore the flag-off counter line's SSR bytes and pin them with a `renderToString` snapshot proven equal to main | a few lines |
| R-53 | One final fix wave, F1–F5 (flip prerequisites, plan annotations, welcome row Notes, the `umami` recorder smoke, a CSS comment). M4/M6/M7, the reply jump, the guard change and the `ideas_shown` prop go to the owner or the next handoff | one dispatch + one e2e run |
| — | Kept the SDD workspace (the skill says delete it; the plan is unfinished) | a git-ignored directory |
| — | Accepted the three subagent commits' `Claude Sonnet 5` trailers without rewriting history | three commits without `Claude-Session:` |

Earlier rulings (R-1…R-32) are in the ledger and in the previous handoffs.

---

## 11. Traps

### New this session
- **`test:pal` runs only `tests/unit/pal`.** CI's unit leg runs **`npm run test`** (the whole suite). Any change under `tests/unit/client/` needs `npx vitest run tests/unit/client` too.
- **`renderToStaticMarkup` cannot see text-node splits.** Real SSR separates adjacent text children with `<!-- -->`, so `{a} ·{" "}{b}` and `{a} · text` serve different bytes. The flag-off tour is pinned both ways. **Never regenerate `onboarding-flag-off.html` or `onboarding-flag-off-ssr.html`.** A JSX refactor on the onboarding page must keep both at zero diff.
- **Full `npm run test` under heavy machine load:** PGlite `createTestDb` hooks in `tests/unit/server` hit the 120s hook timeout (different files each run; load average ~91 here). Re-run the named files alone before believing it.
- **Onboarding smoke:**
  - "Skip" needs `exact: true`, because every step also shows "Skip setup and check a meal".
  - `window.umami` is absent in e2e, so an `addInitScript` recorder captures `track()` calls.
  - A full reload would wipe the recorder; the walks prove none happens (`__palSoftNav`).
- **Subagents choose their own `Co-Authored-By` line.** Give them the exact trailer, and check with `git log --format='%h %s%n%(trailers)' <base>..HEAD`.
- **`gh run list --branch main` mixes in `hourly-crons` runs.** Use `--workflow CI` to see CI.
- **The playwright `file:line` filter works** (`tests/smoke/dashboard.spec.ts:734`), and `--project="Mobile Safari" --repeat-each=5` is the cheap flake check.

### Carried forward
- **`gh pr edit` fails** with a Projects-classic GraphQL deprecation error. Use these instead:
  - `gh api -X PATCH repos/tkiros/prediabetes-pal/pulls/N -F body=@file`
  - open PRs with `gh api -X POST repos/tkiros/prediabetes-pal/pulls -f title=… -f head=… -f base=main -F body=@file`
- **`gh pr checks` has no `--json`.** Parse the tab columns.
- **Magic-link origin:** the signed-in flow lands on `localhost:3100`, not `127.0.0.1:3100`, and localStorage is per origin. Seed `pal.*` keys on `localhost`.
- **DB-backed smoke locally** uses a disposable Postgres. Always set the loopback URL explicitly; never run `drizzle-kit` without it. `.env.local` has no `DATABASE_URL`.

  ```bash
  docker run -d --name pal-e2e-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=pal_e2e -p 127.0.0.1:5432:5432 postgres:16
  env -u DATABASE_MIGRATION_URL -u PAL_DB_ENV DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/pal_e2e npx drizzle-kit migrate
  DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/pal_e2e PAL_E2E_GUIDE_DOOR=1 npm run e2e -- tests/smoke/<spec>.ts > $CLAUDE_JOB_DIR/tmp/<log> 2>&1
  docker rm -f pal-e2e-pg   # when done
  ```
- **Local secret scan, matching CI:**

  ```bash
  docker run --rm -v "$PWD":/repo -w /repo ghcr.io/gitleaks/gitleaks:latest git --log-opts="<merge-base>..HEAD" --config /repo/.gitleaks.toml --gitleaks-ignore-path /repo/.gitleaksignore --no-banner --redact
  ```
- **Never `tail` an e2e log.** Write the full log to a file and grep it; strip ANSI with `sed 's/\x1b\[[0-9;]*m//g'`.
- **`git fetch` before any diff against `origin/main`.** A stale ref silently returns an empty diff.
- **Subagent idle notices repeat old reports**, and reports can arrive truncated. Have agents write full reports to files, and check `git log` before acting on a notice.
- **A fixed fake clock breaks hydration.** Pin only the hour (the spec's `todayAt` helper).
- **Idea rows are 61.2px.** The Home fold's shrink order is spent, and `worried` at 360px has 2.8px of slack. Anything added above Home's check CTA needs the flag-on e2e fold cells re-run.
- **The smoke `__palTaggedBeforeHydration` / `sameNode` check is the only remount detector.** Never weaken it.
- **`SURFACE_ROWS` is pre-populated for every surface.** New rows are ledger-only.
- **Smoke specs read door state only via `doorSurfaceOn(surface[, baseURL])`.** Never write the literal `NEXT_PUBLIC_GUIDE_DOOR` under `tests/smoke/`. trial-wall runs on `http://127.0.0.1:3101`.
- **gitleaks `generic-api-key` fires on a `STATE_KEY` constant written as an assignment of its quoted value.** In docs, write "the `STATE_KEY` constant (value `pal.orient.v1`)".
- **Neon from this machine** needs `NODE_OPTIONS=--network-family-autoselection-attempt-timeout=5000`. There are no credentials on this machine.
- **CI runs only on PR opened/synchronize/reopened.** Under `strict: true`, the next PR goes `behind` after every merge.
- **`next dev` rewrites `CLAUDE.md`.** Never commit that block. **The e2e build rewrites `tsconfig.json`.** Never commit it.
- **`/pantry` lives at `app/pantry/`**, outside the `(app)` group.
- **Verify end to end before asserting.** Trust files and API state over any claim, this one included.

---

## 12. Standing constraints (from the owner and `CLAUDE.md`)

- **Protected `revora` strings:**
  - `tests/unit/pal/owned-domains.test.ts` (the denylist);
  - `tests/unit/pal/sw-dev-teardown.test.ts`;
  - the docstrings in `lib/pal/contact.ts` and `lib/server/email.ts`;
  - historical docs under `docs/handoff`, `docs/archive`, `docs/audit`, `docs/qa`, `PRD`, `predict`, `.planning/phases`, `.planning/research`.
- **Lockstep pairs:**
  - `hourly-crons.yml`'s `APP_URL` must equal `CANONICAL_APP_URL`, byte for byte.
  - The prompt-leak regex (`postprocess.ts`, `eval-rubric.ts`) changes only together with the opening line of `lib/pal/prompt.ts`.
- **Owner learnings:**
  - no synchronous selling;
  - the dashboard keeps the full shell, by conviction;
  - the F-ASK ruling is settled (F-ASK stays in Tier 1 as research instrumentation).
- **Skill routing:** bugs → `investigate`; ship → `ship`; review → `review`.
- **Before every commit:** `npm run lint && npm run typecheck && npm run test:pal && npm run contract`, plus `npx vitest run tests/unit/client` when client tests or their code change.
- **Attribution:**
  - commit messages end with the session's `Co-Authored-By` / `Claude-Session` lines;
  - PR bodies end with the Claude Code attribution.

---

## 13. Suggested first moves for the new session

1. Run §6 A and confirm #157 is still `OPEN / CLEAN / 11 pass` and production healthy.
2. Tell the owner the state in one or two lines, then ask in the question tool:
   - merge #157 now? (§6 B)
   - send the safety-owner submission once §6 F updates it? (§8 #7)
   - approve the `SURFACE_REQUIRES.intake` guard PR? (§8 #1)
3. If #157 merges: run §6 C (**main must go green**), then §6 D. Then run §6 E, the plan-status docs PR that also commits this handoff. Push and PR only with OK.
4. Do §6 F (the submission draft, docs only).
5. Pick up any owner-approved follow-up from §6 G, or the guest hydration bug (§8 #9) via `investigate`. Otherwise the plan is waiting on owner/safety gates (D5, D7, D3, RV-3, the batch approvals, the label eval).
