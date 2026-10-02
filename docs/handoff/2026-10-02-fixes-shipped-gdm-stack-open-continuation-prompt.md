# Continuation prompt: 18 PRs open and green, nothing merged — merge in order, then stop at the owner's gates

*Written 2026-10-02 ~07:00 UTC, end of the session that executed §5 A of
`docs/handoff/2026-10-02-activate-built-features-continuation-prompt.md` (call it "the activation
prompt"). That file still binds: its §0 owner rulings (R-A: concierge test skipped), §1 hard rules,
§3 pains yardstick, §4 gated-module ranking, §5 C flip order and §6 traps. This file says what
changed since and what to do next.*

*This file is **untracked**. Commit it by explicit path in the first PR you open.*

You are continuing Prediabetes Pal in `/home/tefera/Desktop/Revora`, on `main`. **Read
`docs/architecture.md` first.** It isn't on `main` yet; it's in PR #163, so read it with
`git show origin/docs/architecture-map-nudge-index-seek:docs/architecture.md` until #163 merges. Then
read the activation prompt's §0, §5 and §6, then this file.

## 0. State at hand-off (verify with `gh pr list` — the owner may have merged since)

- `main` @ `7ad39eb`. **Nothing from this session is merged.** All 18 PRs below were green and
  `CLEAN` at 07:00 UTC.
- The owner was asked which PRs to merge and **declined to answer in-session**. Merging is a
  production deploy: **ask before merging anything**, even though every PR is green.
- Working tree on `main` carries six earlier-session tracked diffs: `.planning/STATE.md`,
  `DESIGN.md`, `TODOS.md`, `docs/ops/env-reference.md`, `docs/safety/copy-ledger.md`,
  `docs/superpowers/plans/2026-09-13-guide-redesign.md`. All but `.planning/STATE.md` were copied into
  #179. Once #179 merges, `git checkout --` those five (they will equal `main`). `.planning/STATE.md`
  is a GSD-tool artefact on a historical file. Leave it, or ask the owner whether to discard it.
- Production (`/api/health`, 05:00 UTC): `ok:true`, all five crons `ok` at that moment (it flips to
  `degraded` most of the day, see #164); `guideDoor` all 12 `off`; `gdmDoor` null (not on main);
  `flagTwins` all on; `checkoutGate: open`. `NEXT_PUBLIC_MEAL_MEMORY` is set in production.

## 1. The PRs

| PR | Item | What it does | Ready? |
|---|---|---|---|
| #163 | A1 | `docs/architecture.md` (the map), CLAUDE.md Architecture section, ADR superseded notes (Neon + GitHub Actions), Railway comments removed, nudge cron per-user select → one index seek | merge |
| #164 | A2 / FIX2b | hourly crons `"0 * * * *"` → `"7,27,47 * * * *"`. Before: 40 runs over 7.4 days, median gap 4.4 h, max 8.6 h. Overlap is safe (leases, claim-before-send, durable email idempotency, `concurrency`) | merge. Fires only once on `main`; fill the "After" slot in `docs/ops/outstanding.md` ~24 h later |
| #165 | A3 / FIX4 | deletes "The daily check is free." from the guest plan box (both copies); empty meta renders nothing; source-scan test bans `check(s) is/are/stays free` (legacy-only subscribe page allowlisted) | merge |
| #166 | A4 / FIX11 | `/welcome` keeps the device taster; in trial mode the route lets a non-premium session through on the **account's first local day** while persisted checks today < 10 (migrated guest checks count). No `profiles` row ⇒ walled (second commit, a reviewer-found hole: such accounts never persist checks). Read errors ⇒ wall. PGlite tests + a trial-wall smoke step (ran locally, 11/11) | merge. **Policy note:** relaxes "Decision D: no residual free checks" for exactly the day-1 taster the landing promises |
| #167 | A5 / FIX1 | clinical text reaches the router: `shouldGateSubmit` never walls a `classifyClinicalRisk` match; `URGENT_CARE_LINE` moved verbatim to `lib/pal/urgent-care.ts` and appended to the proxy 429, the launch-pause 503 and the client's own `rate_limited`/`paused` copy (the client ignores a 429 body) | merge |
| #168 | A6 / FIX2a | reminders: `enableReminder()`/`pushSupported()` shared; the `/check` card reappears when profile opt-in is off even with a browser subscription; `/account` off-state deletes the false "home page" sentence and offers the existing "Turn on the reminder" button. 2 smoke tests (local, Chrome + Safari) | merge |
| #178 | A7 / FIX10 | result card's "How Prediabetes Pal chooses a signal" → `/about#guidance` (was `/how-it-works`, the weekly-recap page); `id="guidance"` added; pin test | merge |
| #180 | A8+A9 / FIX5-7 | saved-meals CSS (classes join the history-list rules); pre-charge email date in `profiles.timezone`; pantry stuck-order alert = one email per order keyed `pantry-stuck/<id>` (durable idempotency, 7-day lookback, **no migration**: `0020` is GDM's); `CronName` lists all five crons, precharge + sweep use `recordHeartbeat` | merge |
| #179 | A11 docs, A12, A13 | R-A recorded (plan §1 D5, §7.3 step 2, `launch-controls.md` §13.1: kill line 2 is the only read); three `Pending` rows filed (§2 below); submission draft §3e + §5b/§6 updates; the earlier sessions' doc fixes carried after reading each diff | merge |
| #169 | A10 | GDM PR-0: flag pair, production guard, health `gdmDoor`, analytics. Renders nothing | merge (dark) |
| #170 | A10 | GDM PR-L: `/gdm` landing, 404s dark | merge (dark) |
| #171 | A10 | GDM PR-1: door shell + **migration 0020** | **draft. Hold until 0020 is in production** (export/erase would 500 for every user) |
| #172–#176 | A10 | GDM PR-2…PR-6 (F-ASKLIST, F-PLANKEEP, F-WAIT, F-MYMEALS, F-SUMMARY) | drafts, stacked on #171 |
| #177 | A10 | GDM tip: 12 final-review fixes + batch G1 packet | draft, stacked on #176 |

**Merge order (recommended).** GDM #169 → #170 first (merge commits; the stack's base branches
retarget), then the A-PRs in any order. The A-PRs touch disjoint files. Each overlaps PR-0/PR-L in at
most one file, in different hunks (`app/api/health/route.ts` #163, `docs/safety/copy-ledger.md` and
`docs/ops/env-reference.md` #179, `app/globals.css` #180), so rebase whichever reports a conflict.
After all A-PRs land, rebase the GDM drafts onto `main`. #168 and #177 both edit
`app/(app)/account/page.tsx`. GDM stack refs are local and pushed: `gdm/pr-0`, `gdm/pr-l`,
`gdm/pr-1` … `gdm/pr-6`, `feat/gdm-door-tier1` (worktree `.claude/worktrees/gdm-door`).

After each merge, verify the deploy: `/api/health` 200, `/check` a guest check works,
`/home?stay=1` unchanged (all guide surfaces off).

## 2. Deviations from the activation prompt, and why

- **No `/ship`.** It creates `VERSION` and `CHANGELOG.md`, which this repo has never had (159 PRs).
  PRs were opened by hand with the same gates.
- **A11's D6 landing line is not built.** D6 is still Open, and PRD §3's line opens "You were just
  told you have prediabetes", the PRD §7.3 conflict already flagged on `onboarding-welcome-guide`.
  Row `landing-hero-guide` is filed `Pending`, Active `No`. Build it behind
  `guideDoorEnabled("ideas")` (keeping `landing-hero-moment`'s byte pins for flag-off) when it or a
  variant is Approved.
- **A13 is not built.** `/signin` has no flag to hide an unapproved string. Row
  `signin-in-app-browser` is filed `Pending`, Active `No`. The user-agent check (none exists in the
  repo; `lib/client/attribution.ts` maps UTM only) and the line ship together once Approved (~30 min).
- **`check-unavailable-urgent-line`** filed `Pending` for the live `URGENT_CARE_LINE` (FIX8 start).
- **FIX7** used per-order email idempotency instead of an `alerted_at` column, so it doesn't claim
  migration `0020`.
- `npm run config:production-check` today: only `calm` would load (zero rows); `source` refused
  (rows Pending); `ideas`/`ideas-full` dropped (no `lib/pal/guide-ideas.labels.json`).

## 3. Open issues found while building (need a row or a decision, not code)

1. Day-1 wall copy is false for a day-1 user who spends all 10 checks: route `trial-wall-402` ("was
   yesterday's checks") and client `trial-wall-value` ("Yesterday was the free taste."). Both
   Approved; a reworded pair goes to the safety owner with batch 2.
2. A signed-in non-premium user on a fresh device after day 1 sees "10 free checks left today" before
   the server walls them (pre-existing; the counter reads the device taster).
3. `docs/architecture.md` §7 Attribution row says "in-app-browser detection"; it maps UTM sources
   only. Fix in the next docs PR.

## 4. The owner message (never delivered in-session — deliver it first, as one table)

| # | Ask | Unlocks | Note |
|---|---|---|---|
| M | Which PRs to merge (§1) | everything below | each merge is a production deploy |
| B1 | **Vercel Pro**, then move `nudge`, `pantry-sweep`, `trial-precharge`, `stripe-reconcile` into `vercel.json` crons and delete `hourly-crons.yml` | hourly cadence, health green, daily reminders | **Compliance, not preference:** Vercel's fair-use page (updated 2026-09-14) says "Hobby teams are restricted to non-commercial personal use only", and commercial includes "any method of requesting or processing payment from visitors". Checkout is open |
| B2 | Neon paid tier | no idle suspend, compute budget, PITR | the only database |
| B3 | Send both safety-owner submissions: guide (`docs/handoff/2026-09-17-safety-owner-submission-draft.md`, 40 rows + §3e's 3) and GDM (`docs/handoff/2026-09-27-gdm-batch-g1-safety-owner-draft.md` on #177, 28 rows + the `gdm-organiser` class) | every flip | if the owner is the safety owner: approve by hand, one `Status` cell per row. **Agents never edit a `Status` cell** |
| B4 | Run `npm run eval:pal:ideas` (~1,440 paid calls, ~$15–19), commit `lib/pal/guide-ideas.labels.json`, or authorise the agent with the owner's key | `ideas`, `ideas-full`, then `orient`, `home`, `intake` | re-run on any `PROMPT_VERSION`/model change |
| B5 | Apply migration `0020` to production (`npm run db:migrate:production`, `DATABASE_MIGRATION_URL` quoted, `PAL_DB_ENV=production`), then `npm run db:governance:check` | GDM #171…#177 | runbook `docs/runbooks/database-governance.md` |
| B6 | Decisions, by value: D7 (→ F-NUMBERS), D3 + RV-3 (→ F-TREND), F-SOURCE panel-eval spend, D2 (→ F-DOCTOR), D1 (→ F-PLAN), D4 (→ F-DIARY, not recommended) | gated modules | activation prompt §4 |
| B7 | Counsel: terms gate (counsel NOT CLEARED, checkout open); GDM privacy notice + data-flow rows | taking money defensibly; GDM `organiser` | |
| B8 | GDM premise rows: who reviews batch G1 and by when; where the first fifty door users come from | GDM `organiser` | |
| N1 | D6 + PRD §7.3: amend §3/§7.3, or send a landing variant | `landing-hero-guide` | |
| N2 | F-56: redefine the orientation completion read (`launch-controls.md` §13.4) | the `orient` flip | |
| N3 | Prove Umami records in production (one test event seen in the dashboard) and say who does it | the `ideas` flip (R-A: kill line 2 is the only read) | |
| N4 | `calm` loads today with zero rows. Is the colour/"looks like a warning" review recorded? | a `calm`-only flip | |
| N5 | Open non-Dependabot PRs #133 (cron heartbeat dead-man's switch; compatible with #164), #134 ($9.99 pricing), #135 (decision templates), #136 (cohort report): merge, close or park? | hygiene | |
| N6 | #179 carries the earlier sessions' doc diffs (read first); `.planning/STATE.md` left out | — | the activation prompt called those "not yours to decide" |

## 5. First moves

1. `gh pr list`; `git fetch`; confirm §0 and §1 still hold.
2. Deliver §4 to the owner. Merge only what they approve, in §1's order, verifying each deploy.
3. ~24 h after #164 is on `main`: fill the "After" slot in `docs/ops/outstanding.md` (2026-10-02
   section) from `gh run list --workflow hourly-crons.yml --event schedule --limit 40`.
4. After B5: mark #171 ready, merge the GDM stack in order, rebasing onto `main`.
5. As rows turn Approved: build `landing-hero-guide` (A11) and `signin-in-app-browser` (A13); flip
   surfaces per the activation prompt §5 C.1. Production never carries `1`.
6. Gated modules in the activation prompt's §4 order as each decision lands; F-NUMBERS first.
7. Commit this file and fix §3 item 3 in the first docs PR.

## 6. Traps learned this session (add to the activation prompt's §6)

- **This machine is slow under load.** A full `npx vitest run` takes ~3.5 min idle but 30–35 min with
  load average ~20. **Never run two vitest processes at once:** PGlite `beforeAll` setups time out and
  files fail spuriously (seen: "7 failed files, 1 failed test"). For parallel work, use a scratch
  worktree (`git worktree add --detach <scratchpad>/wt <ref>` + symlink `node_modules`) and run
  suites there one at a time, or rely on CI's unit job (~3 min).
- **Snapshot artefacts.** A retried `toMatchSnapshot` under load writes a `" 2"` entry to
  `tests/unit/pal/__snapshots__/guide-door.test.ts.snap` (vitest writes new snapshots outside CI).
  `git checkout --` it; never commit it. Always `git add` by explicit path.
- **`gh pr edit` fails** on GitHub's Projects-classic deprecation (GraphQL). Edit bodies via REST:
  `gh api -X PATCH repos/tkiros/prediabetes-pal/pulls/<n> -F body=@file`.
- **Local e2e works:** `docker run -d --name pal-e2e-pg -e POSTGRES_PASSWORD=postgres -e
  POSTGRES_DB=pal_e2e -p 127.0.0.1:55432:5432 postgres:16`, then
  `DATABASE_URL=postgres://postgres:postgres@127.0.0.1:55432/pal_e2e npx drizzle-kit migrate`, then
  the same `DATABASE_URL` + `HEALTH_DATA_KEY=AAAA…=` (43 A's + `=`) with
  `npm run e2e -- tests/smoke/<spec> --project="Mobile Chrome"`. Remove the container after.
- **The GDM "gdm door 1" leg's Mobile Safari magic-link test is flaky.** It failed once on #171 and
  passed on re-run (`gh run rerun <id> --failed`).
- **Migration numbering:** `0020` belongs to the GDM branch. Any new migration on `main` before GDM
  PR-1 lands must coordinate, or the stack renumbers.
- **A tool-use rejection is not an answer.** The owner rejected the merge question this session.
  That is not consent to merge, and not a "no" to every PR either. Ask again, plainly.
