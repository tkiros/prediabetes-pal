# Continuation prompt — guide redesign: PR-5 merged (#156, dormant); delete its branch, then build PR-6

*Written 2026-09-18 ~16:30 UTC (12:30 EDT). Supersedes
`docs/handoff/2026-09-18-guide-redesign-pr5-tasks-1-3-built-continuation-prompt.md` (on `main`
via #155), which described PR-5 as local and unpushed and #154/#155 as unmerged. All three have
since merged.*

You are continuing the Prediabetes Pal **guide redesign** in `/home/tefera/Desktop/Revora`.

**The owner's direction for this session (given 2026-09-18):**
1. **Delete the merged PR-5 branch.**
2. **Start PR-6.**

- **Plan:** `docs/superpowers/plans/2026-09-13-guide-redesign.md` (on `main`).
  - Inline "review A-nn" notes supersede the text they annotate.
  - The Decision Audit Trail A-01…A-121 is at the end.
  - PR-6 is **§4, Tasks 6.1–6.7** (starts at line ~2165).
- **Spec:** `PRD/Prediabetes_Pal_Guide_Redesign_PRD_v1.1.md`. The spec wins any conflict.
- **SDD ledger (git-ignored, the recovery map):**
  `.superpowers/sdd/2026-09-13-guide-redesign/progress.md`. Its first line names the plan. This
  session is `## Session 2026-09-18 (b)`, at the end of the file.
  - Briefs, reports and review packages sit beside it.
  - **Keep the workspace:** PR-6 continues the same plan.
- **Run PR-6 with** `/superpowers:subagent-driven-development`, the same loop as PR-5.

---

## 1. Hard rules for the session

1. **Never do any of these without the user's explicit OK in the new session:**
   - push, merge, force-push or update-branch;
   - run a production migration;
   - change a CI or security gate (including `.gitleaksignore`), GitHub repo settings or secrets,
     or a Vercel env var;
   - redeploy production.

   Standing rule: "Never push or merge without asking." Approval never carries over between
   sessions. **One exception is pre-authorized above:** deleting the already-merged
   `feat/guide-pr5-home-layout` branch, local and remote.
2. **Never run `npm run eval:pal:ideas`.** It is ~1,800 live model calls (~$19), and the owner runs it.
3. **Copy ledger (`docs/safety/copy-ledger.md`):**
   - never set a row to `Approved`;
   - never change an existing row's Copy or Status cell;
   - new user-facing strings get a new row filed `Pending | Yes`;
   - a new row's own cells may be edited only in the PR that files it.
4. **Never propose or perform switching `NEXT_PUBLIC_GUIDE_DOOR` on in production.** Production
   never carries `1`. It carries an explicit surface list, and only once that list's gates are met.
5. **Every user-visible guide change goes behind `guideDoorEnabled("<surface>")`, server side too.**
   PR-6's surface is **`intake`**, which requires `orient`, which requires `ideas`. **With the door
   off, the tour must stay byte-for-byte the six-step tour it is today.**
6. **Next.js here is 16.3 with breaking changes.** Read `node_modules/next/dist/docs/` before
   touching a Next API.
7. **Credentials:** never print, echo or paste one. See `docs/runbooks/database-governance.md`.
8. **Every subagent stages by explicit path.** Never `git add -A`, `-a` or `.`. The working tree
   holds the owner's uncommitted files (§3).
9. **No reviewer may modify the working tree, even temporarily.** Mutation testing goes on copies in
   `$CLAUDE_JOB_DIR/tmp/` or in-memory strings.

---

## 2. Status in one paragraph

**PR-5 (Home layout) is merged and dormant, and production is healthy.** Everything this session
opened is merged:
- **#154** privacy notice → `a4ad691`;
- **#155** plan status and docs → `2ac5cc4`;
- **#156** PR-5 → **`5df3557`**, all 11 PR checks green.

The production deploy of `5df3557` succeeded:
- `/api/health` reports **`healthy`**: `db` ok, no issues, every guide door `off`.
- `/learn` correctly answers 404 in production, because `home` is off.

`main`'s push-CI run for `5df3557` was still in progress when this was written, so confirm it first
(§5 A). The only leftover is the merged PR-5 branch, local and remote. **PR-6 is unbuilt; it is
next.**

---

## 3. Where things are (verified 2026-09-18 ~16:25 UTC)

### Checkout

| Item | State |
|---|---|
| Path | `/home/tefera/Desktop/Revora` (the only worktree) |
| Current branch | `feat/guide-pr5-home-layout` @ `dc97397`, fully merged into `main` via `5df3557`. Remote branch still exists (`origin/feat/guide-pr5-home-layout` @ `dc97397`) |
| `origin/main` | **`5df3557`** Merge pull request #156 |
| Owner's uncommitted files (**not this work's; never commit them**) | `CLAUDE.md` (the `next dev` block), `.planning/STATE.md`, `docs/ops/env-reference.md`, plus many untracked files |
| Untracked handoff | **this file**. Commit it in PR-6 by explicit path (§5 C step 7) |
| Docker | the disposable `pal-e2e-pg` Postgres used this session was **removed**. The owner's containers `hl-shadow` and `open-design` are theirs; never touch them |

### Production (https://prediabetespal.com)

- **Deployed:** `5df3557`, Vercel Production deploy `success`.
- **`/api/health`:** `{"status":"healthy","db":"ok","issues":[],"door":["off"]}`.
- **Crons:** `hourly-crons.yml` scheduled runs landed at 01:47, 06:46, 11:55 and 15:23 UTC on 09-18,
  so the gaps run up to ~5h against a 2h staleness threshold. Health is green only because the 15:23
  run was recent. **Expect `degraded` again** when the next gap opens.
- **Backups:** `db-backup` scheduled run on 09-18 at 11:24 UTC succeeded.
- **Label cache:** `lib/pal/guide-ideas.labels.json` still does not exist. The production guard
  closes `ideas` and `ideas-full` in any build, and therefore `home` and `orient` and `intake`.

### Open PRs

| PR | State | Note |
|---|---|---|
| #137, #138, #140, #141, #142, #143, #148, #150 (dependabot) | behind `main` | each needs update-branch under `strict` |
| #111 typescript 6→7 · #128 eslint 9→10 | lint fails | wait for upstream plugin support, or close |
| #133 cron heartbeat · #134 billing (draft) · #135 owner decisions · #136 cohort report | far behind `main` | need update-branch |

Required checks on `main` (`strict: true`):
- `typecheck · lint · contract · build`
- `unit · evals (mock — no keys, no spend)`
- `playwright (incl. axe a11y)`
- `secret scan`
- `playwright · guide door 1`
- `playwright · guide door ideas,source`

**All Playwright legs run with a Postgres service in CI**, so DB-backed (signed-in) smoke cells
run there even though they skip locally without a DB.

---

## 4. What was done this session (2026-09-18, resumed ~10:28 UTC)

### 4.1 Verification and owner approvals

- Confirmed nothing had moved since the prior handoff.
- The owner approved, in the question tool:
  - merge #154 now;
  - push the PR-5 branch (no PR yet);
  - amend #155, push it and merge it after #154;
  - defer the guest hydration bug.
- Later the owner approved "push and create a PR" for PR-5, then **typed "merge #156 once CI is green"**.

### 4.2 #154: privacy notice names Neon, not Railway (MERGED `a4ad691`)

- Merged at head `7333e98`.
- Verified after merge:
  - `main` CI green;
  - Production deploy success;
  - the live `/privacy` says "Neon-hosted Postgres" (twice);
  - health ok.
- Branch deleted, local and remote.

### 4.3 #155: plan status docs (MERGED `2ac5cc4`)

- #155 carried a **false** fold projection: "the `worried` door ~14px over at 375/430". It was
  corrected in a separate worktree (the main tree was busy) with a **new commit `daa758b`**, not an
  amend, because an amend needs a force-push, which was not approved.
  - The plan's §3 note now carries the measured per-door matrix, the owner's one-row ruling, and
    "the shrink order is spent".
  - The note was moved below the fold table; it had been splitting the table.
  - The 09-18 continuation prompt was committed with a status banner.
  - The PR body was corrected via REST (`gh pr edit` fails, §9).
- Update-branch, then 11/11 green, then merged. Verified after merge (CI, deploy, health). Branch
  deleted, local and remote; the worktree removed.

### 4.4 PR-5, Tasks 5.4 and 5.5, through the SDD loop

- **Task 5.4 — Home layout smoke** (`6b23767`), rulings R-24…R-28.
  - Covers:
    - the quick row has four links and no accent fill (computed background checked against
      `--accent`);
    - `/learn` is reachable from it;
    - at 1280, Home's single column keeps its order and the sidebar has five slots;
    - no `%` in `main`;
    - a home-off cell: no quick row, and `/learn` 404s;
    - `/learn` at 375 and 1280, with axe.
  - **R-27 found a real bug.** A second tap on the Ideas tile, with the URL already at
    `#ideas-title`, did not scroll: Next `<Link>` keeps position on an unchanged hash. The fix in
    `components/home-quick-row.tsx` scrolls manually only when the hash already matches.
  - Review (sonnet): clean.
  - The controller independently confirmed the home-off cell **runs** (not skips) in the no-flag
    build, on all 4 browsers.
- **Task 5.5 — hero H2** (`325b918`). "Unsure about a meal?" behind `guideDoorEnabled("home")`;
  "What are you eating?" when off. Ledger row `home-check-hero-title`.
  - Review: clean. The snapshot file shows zero diff.
  - **The controller re-measured the fold after it:** `worried` at 360 is still 2.8–2.9px, and every
    door is unchanged.
- **Merged `main` into the branch** (`cb8b963`) before the final fix wave.
- **Final whole-branch review (opus):** "ready with fixes". The one Important finding:
  - Signed-in users get Home's slots from the **server** `DashboardView` as props into the client
    `HomeDoor`.
  - The flight client can deliver such a prop as a **lazy wrapper**.
  - Then `cloneElement(hero)` throws (Home crashes) and `isValidElement(ideas)` drops the ideas block.
  - Nothing in the repo had ever rendered the signed-in path.
- **Final fix wave** (`dc97397`, rulings R-29…R-32):
  - `HomeDoor` renders `<GuideIdeas key="ideas" …/>` itself behind `ideasOn`.
  - hero, quickRow and step sit in keyed `<Fragment>`s.
  - A new **DB-backed signed-in door smoke cell** (magic link, disk mailbox).
  - The "Saved meals" tile and `id="saved"` are dropped (R-30).
  - Ledger row fixes (`learn-tiles`, `home-check-hero-title`).
  - The `home-door.tsx` snapshot comment now names all three call sites.
  - The icons count is fixed.
  - Four dated plan annotations.
  - Verified against a **local disposable Postgres** (`postgres:16`, same as CI): flag-on 140
    passed / 0 failed, and the signed-in cell ran on all 4 browsers.
  - The scoped re-review (opus): all findings addressed, 5 Minors parked (§7).
- **Finishing:**
  - gates green (`test:pal` 1350 passed / 31 skipped);
  - local **gitleaks** via docker: no leaks;
  - PR opened as **#156**;
  - CI 11/11 green, with the signed-in cell ✓ on all 4 browsers in CI's `guide door 1` leg
    (472 passed);
  - **merged `5df3557`** at head `dc97397`.

### 4.5 What PR-5 contains in total (all behind `home` = `ideas` + `ideas-full`)

- `components/home-quick-row.tsx`: four quiet tiles.
  - Ideas scrolls and expands the See-all block.
  - Check.
  - Learn uses `IconBook` via `LearnLink`.
  - Journey uses Compass.
- `app/(app)/learn/page.tsx`: the `/learn` index.
  - Tiles: first week (only under `orient`), How it works, My meals, Pantry review, and "What the
    numbers mean" only once `/learn/numbers` exists.
  - No doctor tile. No Saved meals tile.
- Per-person Home door:
  - `lib/client/ask-store.ts`: **read-only** `get()` on `pal.ask.v1`, PR-6's exact enums, zod
    `.strict()`.
  - `lib/client/home-door.ts` (`doorFor`), `components/home-door.tsx`.
  - Four doors: `ideas`, `numbers`, `plan`, `worried`.
  - Default order on the server and the first client render; reorder once, after hydration.
  - Focus guard (R-21). No remount.
- Hero H2 swap.
- Ledger rows filed `Pending`: `home-quick-row`, `learn-tiles`, `guide-ideas-later`,
  `home-door-worried-line`, `home-check-hero-title`.

**Fold slack** (px from the check CTA's bottom edge to the tab bar, flag on):

| Door | 360 | 375 | 430 |
|---|---|---|---|
| default | 58.2 | 12.3 | 12.3 |
| `numbers` / `plan` | 62.9 | 17.0 | 17.0 |
| `worried` | **2.8** | 26.1 | 26.1 |

---

## 5. Exact actions — next, in order

### A. Confirm state (read-only)

```bash
cd /home/tefera/Desktop/Revora && git fetch origin --prune && git log --oneline -1 origin/main   # expect 5df3557 (or later)
gh run list --branch main --limit 4        # CI + "Push on main" for 5df3557 must be success
git status --short | grep -v '^??'          # expect only the owner's 3 files
curl -sS https://prediabetespal.com/api/health | jq -c '{status, db, issues, door: (.guideDoor|to_entries|map(.value)|unique)}'
docker ps -a --filter name=pal-e2e-pg      # expect nothing (removed)
```

- If `main`'s CI for `5df3557` is not `success`, stop and tell the owner before anything else.
- `gh api` sometimes prints "error connecting to api.github.com"; retry after ~5s.

### B. Delete the merged PR-5 branch (owner-directed)

```bash
git switch main && git pull --ff-only
git branch -d feat/guide-pr5-home-layout          # -d (not -D): refuses if not merged — it is merged
git push origin --delete feat/guide-pr5-home-layout
git branch -a | grep pr5 || echo "PR-5 branch gone"
```

`git switch main` carries the owner's three modified files unchanged: they are identical on both
branches. If `git switch` refuses because of a local change, **stop and report it**. Never stash,
reset or discard the owner's files.

### C. Start PR-6 through SDD

1. `git switch -c feat/guide-pr6-intake` from the updated `main`.
2. Invoke `/superpowers:subagent-driven-development`.
   - Workspace:
     `…/skills/subagent-driven-development/scripts/sdd-workspace docs/superpowers/plans/2026-09-13-guide-redesign.md`
     prints `.superpowers/sdd/2026-09-13-guide-redesign/`.
   - The ledger's first line names the plan; every `Task 5.x: complete` line is done.
   - Append `## Session <date> — PR-6`.
3. **Run the PR-6 pre-flight scan**, as the skill requires, and write the table to the ledger.
   - **Every** PR-6 task edits `app/(app)/onboarding/page.tsx`, so no two may run in parallel.
   - Scan for conflicts between:
     - 6.1's `STEP_PROGRESS` / `TRACKED_STEPS` edits and 6.2/6.3's new screens;
     - 6.2 (which "creates" `lib/client/ask-store.ts`: **it already exists from PR-5**, read-only,
       with the exact enums. 6.2 adds `set()` only; do not recreate the file or change the enums);
     - 6.4's response map and the §2.4 wording;
     - 6.5's welcome copy (A-73);
     - 6.6's two smoke files.
4. **Brief each task** with
   `…/scripts/task-brief docs/superpowers/plans/2026-09-13-guide-redesign.md 6.N`.
   - The script dir is
     `/home/tefera/.claude/plugins/cache/claude-plugins-official/superpowers/6.3.0/skills/subagent-driven-development/scripts/`.
   - Record BASE before each dispatch.
   - Report files are named after the briefs.
5. **Tasks:**
   - **6.1** Pure step functions and their tests: `Step` gains `ask_pains | ask_win`,
     `TRACKED_STEPS`, `STEP_PROGRESS` (typed `Record<Step, number>`, so it must gain both keys or
     typecheck fails), and `tests/unit/client/onboarding-flow.test.ts`.
   - **6.2** Screen A "What is hardest right now? Pick up to three.": seven `idea-row` buttons,
     `aria-pressed`, an `aria-live` counter "{n} of 3", Continue never disabled, and a fourth tap
     ignored with the row text "Three picked — unpick one to change". Plus `askStore.set()`.
   - **6.3** Screen B "What would count as a win for you? Pick one.": seven single-select rows.
   - **6.4** The link-free response line beneath Screen B's pick, from a closed map
     `lib/client/ask-response.ts`.
   - **6.5** Welcome copy under `intake` (A-73; the verdict badges are not rendered). The A1C link
     waits for D7. The final button stays "Start your first week".
   - **6.6** Smoke: `tests/smoke/onboarding.spec.ts` **and `tests/smoke/trial-wall.spec.ts`**, whose
     walk crosses the tour (A-68). A full eight-screen walk under the skip guard.
   - **6.7 is a follow-up, NOT built in PR-6.** It runs only if the 70% attribution floor fires
     after PR-6 is live with the flag on (an owner measurement in Umami).
6. **Carry PR-5's parked follow-ups into PR-6.** They touch HomeDoor and its smoke, which PR-6's
   picks now feed:
   - the smoke covers the **soft-navigation mount path**: the tour writes `pal.ask.v1`, then client
     navigation mounts `HomeDoor` with no hydration. This is how most picks will first reach Home;
   - pin the three **keyed Fragments** in `tests/unit/pal/home-door.test.ts` (add
     `toContain('<Fragment key="hero">{hero}</Fragment>')` for hero, quickRow and step: an unkeyed
     Fragment passes every current pin);
   - the signed-in door cell in `tests/smoke/dashboard.spec.ts` (~:714-810) positively asserts it is
     signed in: the final URL, or `page.request.get("/api/auth/session")`;
   - tighten `tests/unit/pal/home-layout.test.ts:403-404` to `expect(src).not.toContain('id="saved"')`;
   - fix the stale comments at `components/dashboard-view.tsx:72-75` and `:131-134`. They say
     "HomeDoor only reorders the slots"; it now renders ideas itself;
   - add R-29's annotation at plan line ~2119, which still shows `<HomeDoor ideas={…}>`;
   - `ideas_shown` carries no row count, so kill line 2's tap rate mixes 1-, 2- and 3-row
     impressions. Carry the door in PR-6's closed-enum event.
7. **Commit this handoff** in PR-6 by explicit path, in its first docs-touching commit:
   `git add docs/handoff/2026-09-18-guide-redesign-pr5-merged-pr6-next-continuation-prompt.md`.
8. **Final whole-branch review** on opus. Package it with
   `scripts/review-package <plan> $(git merge-base origin/main HEAD) HEAD`. Then one fix wave, one
   scoped re-review, and park the residuals with rulings.
9. **PR-6 done check (plan line ~2314):**
   - all gates, plus both smoke configurations, green;
   - rows `onboarding-ask-pains`, `onboarding-ask-win`, `onboarding-ask-response` and
     `onboarding-expectations-ideas` filed in batch 2, plus `onboarding-welcome-guide` (all already
     listed in `SURFACE_ROWS.intake`: file them in the ledger only, **never edit
     `lib/guide-door-flag.ts`**);
   - `onboarding-a1c-learn-link` is gated with `learn-numbers-*`, not filed here.
10. **Push and open PR-6 only with the owner's OK.** Run a local gitleaks first (§9). The PR body
    ends with the Claude Code attribution lines.

### D. PR-6 content constraints to hand every implementer and reviewer

- **The flag.** `intake` requires `orient` (which requires `ideas`). CI's `ideas,source` leg has
  `intake` off, so it must see the flag-off six-step tour byte for byte.
- **`pal.ask.v1` is a contract, not internal state.** PR-5's `HomeDoor` already reads it, so write
  exactly the shape `askStore.get()` validates: `{ pains: PainKey[] (max 3), win: WinKey | null }`,
  zod `.strict()`. Everything else is thrown away.
- **Analytics is a closed enum** (`lib/client/analytics.ts`).
  - New members go **before `photo_draft`**.
  - It never carries meal text, an A1C or any health value.
  - `intake_ask`'s self-reported categories are a **counsel question (A-105)**: if counsel says no,
    the event sends `pain_1` only.
- **Copy:** DESIGN.md and §2 ban "calm" claims (A-85). The `peace` response line must not claim
  calm. It must use §2.4's can / partly / not-directly wording.
- **The react-hooks lint rules are errors:** `react-hooks/refs`, `/purity` and `/set-state-in-effect`.
- **DESIGN.md §5 bans invisible hit-area expansion.** The 44px global rule does not reach `<a>`.
- **Onboarding smoke already exists.** Extend it under `test.describe` plus the
  `doorSurfaceOn("intake")` skip guard. Never write the literal `NEXT_PUBLIC_GUIDE_DOOR` under
  `tests/smoke/`.

---

## 6. Open decisions for the owner

| # | Decision | Recommendation |
|---|---|---|
| 1 | Send the safety-owner submission (`docs/handoff/2026-09-17-safety-owner-submission-draft.md`) | **Now; it gates every flip.** First add PR-5's five rows: `home-quick-row`, `learn-tiles`, `guide-ideas-later`, `home-door-worried-line`, `home-check-hero-title` |
| 2 | `/learn` "Pantry review" tile links a Learn index to a paid sales page (`app/pantry/page.tsx`, indexable, with a Buy button) | plan-level; the owner's call (the Phase-2 design review already flagged "3 of 5 Learn tiles are not learning content") |
| 3 | Guest Home hydration mismatch, every US evening. `components/guest-dashboard.tsx:114` computes `now` outside the hydration gate; `:77` formats the date with no `timeZone`; SSR (UTC) and the browser disagree, so React discards the server tree | own small PR via the `investigate` skill; the owner deferred it this session |
| 4 | Firefox CSP "Missing 'unsafe-eval'" console error on every page that builds a client `z.object` | harmless: zod 4's `allowsEval` JIT probe, which predates PR-5. Optional one-line fix: `z.config({ jitless: true })` on the client. The signed-in smoke cell filters exactly this message |
| 5 | Cron scheduler gaps of ~5h against a 2h threshold | #133 heartbeat, plus a scheduler that actually runs hourly |
| 6 | The four production checks (test account via onboarding; account export; change a reminder; sign in with a real account) | still never done |
| 7 | Label eval `npm run eval:pal:ideas` (~$19) | the owner runs it once; it opens `ideas` / `ideas-full` in a production build |
| 8 | D5 concierge test / D7 claim class | gate every flip; start in parallel |
| 9 | `NEON_*` integration variables (stale; hold the dead pre-reset password) | review scope; don't delete blindly |
| 10 | Dependabot #137–#150; #111/#128; #133–#136 | one at a time under `strict` |

**Level 2 gates are unchanged:**
- D5 and D7;
- the batch approvals;
- the label eval;
- the revert rehearsal;
- the production-config CI job;
- D6's landing line;
- the A-44 paragraph;
- the post-deploy checks.

`home` needs `ideas` and `ideas-full` live, plus batch 2's Home rows `Approved`. `intake` needs
`orient` live, plus its rows `Approved`.

---

## 7. Rulings made this session on the owner's behalf (review these)

| # | Ruling | Cost if wrong |
|---|---|---|
| — | #155 corrected with a **new commit** (`daa758b`), not an amend: rewriting `2137db1`'s message needed a force-push, which was not approved | one superseded commit message in history |
| R-24 | 5.4's Home cells nest in a `home`-gated describe inside the ideas-gated describe | none |
| R-25 | one home-off cell (no quick row, `/learn` 404s), outside the ideas describe so it runs in the no-flag and `ideas,source` builds | one test |
| R-26 | "column order at 1280" means Home's single column by y (`.dash-grid` is unused), plus five sidebar `.app-navlink` | one assertion set |
| R-27 | the Ideas tile's second tap must re-scroll. It didn't; fixed in `home-quick-row.tsx` (manual scroll only when the hash already matches) | a few lines |
| R-28 | `/learn` renders at 375 and 1280, with an axe critical/serious sweep | one test |
| R-29 | final-review Important: **hardened `HomeDoor`** (renders `GuideIdeas` itself behind `ideasOn`; keyed Fragments; no `cloneElement`/`isValidElement`) plus a DB-backed signed-in smoke cell, instead of the reviewer's manual signed-in check (impossible here: no DB credentials, flag off in production) | a few lines and one cell |
| R-30 | dropped the "Saved meals" tile and `id="saved"`, reverting R-12. The id leaked into flag-off `/meals`; the anchor can't land (the section renders after a fetch, and Next 16.3 drops a hash scroll whose target is absent at commit); the gate missed premium and server gating | re-add one tile and a post-load scroll when meal memory ships |
| R-31 | skipped `preventDefault` on the same-hash tap (the refetch is unverified) | a possible extra `/home` request on a repeat tap |
| R-32 | annotated the stale plan text: Task 5.1 icons (R-6), 5.2 border (R-16), 5.3 `useHydrated` → `useSyncExternalStore`, and R-30 on the tile list | none |
| — | parked six final-review minors as PR-6 follow-ups (the list in §5 C step 6) | test/comment only |
| — | kept the SDD workspace (the skill says delete at the end; the plan is unfinished) | a git-ignored directory |
| — | local-only merge of `main` into PR-5 before the fix wave (pushed later with the owner's PR approval) | none |

Earlier rulings (R-1…R-23, PR-4 and before) are in the superseded handoff's §7 and in the ledger.

---

## 8. Deferred minors that shipped (the final review triaged "ship as is")

- `lib/client/ideas-expand.ts:17-19`: a redundant `handle` wrapper.
- `components/home-quick-row.tsx`: the doc comment narrates fix-round history.
- `app/globals.css` ~4236: a 9-line comment for one token.
- `tests/unit/pal/home-door.test.ts`: a duplicate server-snapshot pin, and a low-value
  no-transition pin.
- `components/home-door.tsx`: `sameLayout` exported but used only in-file.
- `tests/smoke/dashboard.spec.ts`:
  - the accent check reads `backgroundColor` only;
  - it re-literals the quick-row selector once.
- `home-layout.test.ts`: source-regex pins false-fail on no-op refactors.
- The signed-in cell's `sameNode` never sees a *move*: worried with no week appends the line. The
  guest fold cells prove the move.

---

## 9. Traps

### New this session

- **`gh pr edit` fails** with a Projects-classic GraphQL deprecation error. Use
  `gh api -X PATCH repos/tkiros/prediabetes-pal/pulls/N -F body=@file`. Open PRs with
  `gh api -X POST repos/tkiros/prediabetes-pal/pulls -f title=… -f head=… -f base=main -F body=@file`.
- **Magic-link origin:** the signed-in flow lands on `localhost:3100`, not `127.0.0.1:3100`, and
  localStorage is per origin. Seed `pal.*` keys on the `localhost` origin (the `a11y.spec.ts`
  convention).
- **DB-backed smoke runs locally** against a disposable Postgres:

  ```bash
  docker run -d --name pal-e2e-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=pal_e2e -p 127.0.0.1:5432:5432 postgres:16
  env -u DATABASE_MIGRATION_URL -u PAL_DB_ENV DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/pal_e2e npx drizzle-kit migrate
  DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/pal_e2e PAL_E2E_GUIDE_DOOR=1 npm run e2e -- tests/smoke/<spec>.ts > $CLAUDE_JOB_DIR/tmp/<log> 2>&1
  docker rm -f pal-e2e-pg   # when done
  ```

  - `.env.local` has **no** `DATABASE_URL` (only stale `NEON_*`).
  - `resolveMigrationDatabaseUrl` reads the process env only.
  - The e2e runtime refuses a non-loopback DB.
  - **Always set the loopback URL explicitly. Never run `drizzle-kit` without it.**
- **Local secret scan, matching CI:**

  ```bash
  docker run --rm -v "$PWD":/repo -w /repo ghcr.io/gitleaks/gitleaks:latest git --log-opts="<merge-base>..HEAD" --config /repo/.gitleaks.toml --gitleaks-ignore-path /repo/.gitleaksignore --no-banner --redact
  ```
- **Never `tail` an e2e run's output.** It drops the `[fold] … slack` lines. Write the full log to a
  file, then grep it.
- **An untracked file that `main` later commits blocks `git merge origin/main`.** Compare it to
  main's copy, back it up to `$CLAUDE_JOB_DIR/tmp/`, and remove it before merging.
- **`git fetch` before any diff against `origin/main`.** A stale ref silently returns an empty diff.
- **Subagent idle notices repeat old reports**, and reports can arrive truncated. Ask the agent to
  write its full report to a file, and check `git log` before acting on a notice.
- **The e2e build rewrites `tsconfig.json` while it runs.** Never commit `tsconfig.json`.

### Carried forward

- **A fixed fake clock breaks hydration.** `page.clock.install({ time: <fixed date> })` makes the
  browser's date differ from the server-rendered `<h1>`, and React client-renders. Pin only the hour
  (the spec's `todayAt` helper).
- **Idea rows are 61.2px, not 44px.** The fold shrink order is spent, and `worried` at 360 has 2.8px.
  Anything added above Home's check CTA needs the flag-on e2e leg re-run.
- **The smoke `__palTaggedBeforeHydration` / `sameNode` check is the only remount detector.** Never
  weaken it.
- **`SURFACE_ROWS` is pre-populated for every surface.** New rows are ledger-only. Never edit
  `lib/guide-door-flag.ts`.
- **Smoke specs read door state only via `doorSurfaceOn(surface)`.**
- **gitleaks `generic-api-key` fires on a `STATE_KEY` constant written as an assignment of its
  quoted value.** In docs, write "the `STATE_KEY` constant (value `pal.orient.v1`)" instead.
- **Neon from this machine** needs `NODE_OPTIONS=--network-family-autoselection-attempt-timeout=5000`.
  `drizzle-kit migrate` exits 1 silently. `pg-connection-string` echoes the URL on `EINVAL`. There
  are no credentials on this machine.
- **CI runs only on PR opened/synchronize/reopened.** Under `strict: true`, the next PR goes `behind`
  after every merge. `gh pr checks` has no `--json`: parse the tab columns.
- **`next dev` rewrites `CLAUDE.md`.** Never commit that block.
- **`/pantry` lives at `app/pantry/`,** outside the `(app)` group.
- **Verify end to end before asserting.** Trust files and API state over any claim, this one included.

---

## 10. Standing constraints (from the user and `CLAUDE.md`)

- **Protected `revora` strings:**
  - `tests/unit/pal/owned-domains.test.ts` (the denylist);
  - `tests/unit/pal/sw-dev-teardown.test.ts`;
  - the docstrings in `lib/pal/contact.ts` and `lib/server/email.ts`;
  - historical docs under `docs/handoff`, `docs/archive`, `docs/audit`, `docs/qa`, `PRD`,
    `predict`, `.planning/phases` and `.planning/research`.
- **Lockstep pairs:**
  - `hourly-crons.yml`'s `APP_URL` must equal `CANONICAL_APP_URL`, byte for byte.
  - The prompt-leak regex (`postprocess.ts`, `eval-rubric.ts`) changes only together with the
    opening line of `lib/pal/prompt.ts`.
- **Owner learnings:**
  - no synchronous selling;
  - the dashboard keeps the full shell, by conviction;
  - the F-ASK ruling is settled.
- **Skill routing:** bugs → `investigate`; ship → `ship`; review → `review`.
- **Before every commit:** `npm run lint && npm run typecheck && npm run test:pal && npm run contract`.
- **Attribution:** commit messages end with the session's `Co-Authored-By` / `Claude-Session`
  lines, and PR bodies end with the Claude Code attribution.

---

## 11. Suggested first moves

1. Run §5 A. Confirm `main`'s CI for `5df3557` is green and production is still healthy with doors
   `off`.
2. Run §5 B: delete the PR-5 branch (owner-directed).
3. Tell the owner in one line:
   - the state;
   - the queue items still open in §6, especially #1 (the safety-owner submission now needs PR-5's
     five rows).
4. Run §5 C: cut `feat/guide-pr6-intake`, invoke `/superpowers:subagent-driven-development`, run the
   PR-6 pre-flight scan, then Task 6.1.
