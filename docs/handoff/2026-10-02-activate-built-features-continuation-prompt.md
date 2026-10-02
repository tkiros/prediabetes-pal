# Continuation prompt: activate the built features — concierge test skipped by owner ruling, release the dormant guide door and GDM Tier 1, keep the live promises, judge every move by the five pains

*Written 2026-10-02 ~00:30 UTC. Supersedes
`docs/handoff/2026-09-19-guide-redesign-tier1-merged-waiting-on-gates-continuation-prompt.md` for the
guide door; its §1 hard rules, §7 flip prerequisites, §8 decisions and §11 traps still bind except where
this file says otherwise. The GDM branch's own handoff
(`docs/handoff/2026-09-27-gdm-batch-g1-safety-owner-draft.md`, on `feat/gdm-door-tier1`) still binds for
GDM copy. The 2026-09-24 feature map (`docs/handoff/2026-09-24-feature-map-built-vs-needed.md`) is the
source for the FIX items below; read its §3.0 before touching any of them.*

*This file is **untracked**. Commit it by explicit path in the first PR.*

You are continuing Prediabetes Pal in `/home/tefera/Desktop/Revora`, on `main`. **Read
`docs/architecture.md` first** — it is the map of the whole app, both doors, every flag, every ceiling,
written 2026-10-01 from the code. Then `CLAUDE.md` (its Architecture section points at the live infra
truth) and this file. The goal of this session is stated by the owner: *make the app fully functional
with the new and old features working together, as the best experience for users to address their pain
points and achieve their desired outcomes.* "Fully functional" here means **keeping the promises the live
app already makes, and releasing what is already built** — the research found no unserved need inside
the current boundary (feature map §0.3). Nothing new gets invented in this session.

## 0. Owner rulings that change the plan (2026-10-02)

| Ruling | What it changes | What it does not change |
|---|---|---|
| **R-A: the concierge test (Guide-D5) is skipped.** | Kill line 1 is waived. The "release" column of every Tier-1 PR in plan §2.1 no longer waits on the branch read. Build order is the food branch (§2.1), the default. Record this in the plan's §1 table: D5 row → "Skipped by owner ruling 2026-10-02". | The PRD's own §11 risk 2 ("a menu, not a judge" rests on one count) now has no direct check. Kill line 2 (idea taps < 25% of block-rendered sessions after four weeks) is the only read left, so **Umami must be proven recording before the flip** (§7.3 step 7 of the plan), or the door cannot be judged. |
| **R-B: CLAUDE.md gained an Architecture section** (owner-approved) and `docs/architecture.md` is the map. | Agents read the map before touching anything outside one component. | Nothing. |

**Everything else the plans say about gates still holds.** In particular: the person who approves
health copy is not the person who built it. **Never edit a `Status` cell in
`docs/safety/copy-ledger.md` or `docs/safety/gdm-gates.md`.** If the owner is also the safety owner, the
approvals are the owner's to make by hand; your job is to make every approval a one-cell edit with the
evidence beside it, then stop at the gate with the exact ask.

## 1. What happened in the 2026-10-01 session

Read-only review of the shipped architecture, then four fixes, then the map. All of it is in the
working tree, **uncommitted** (see §2).

| Done | Where |
|---|---|
| Architecture review: scalable to low thousands of users; the first walls are the 2,000/day global cap, the nudge cron's per-profile loop, Vercel Hobby, Neon Free, the GitHub Actions scheduler | `docs/architecture.md` §13 |
| **Nudge cron fix:** the per-user "every check ever" select is now one index seek (`ORDER BY created_at DESC LIMIT 1`). Behaviour unchanged; 42 nudge tests, eslint, typecheck green | `lib/server/nudge.ts:430-443` |
| **Stale docs fixed:** `docs/adr/hosting-hybrid.md` opens with a superseded note (Neon + GitHub Actions since the 2026-08-10 Railway expiry); `docs/adr/stack.md` rows corrected; Railway comments removed from `lib/server/db/index.ts` and `app/api/health/route.ts` | those files |
| **`docs/architecture.md` written** (339 lines): diagram, check path, 22 tables, API surface, pages, features with tier + flag, **§8 both plans' features with status**, jobs, safety architecture, flags, ceilings. The doc-scanning tests pass over it (9 files, 332 tests) | `docs/architecture.md` |
| **Production finding:** the "hourly" GitHub Actions schedule fires every 3–7 h (20 runs over 4.5 days). `/api/health` therefore reads `degraded` with all four crons `stale` most of the day; a user's daily nudge fires roughly one day in five; pre-charge, reconcile and the pantry sweep run hours late | `docs/architecture.md` §9 |
| Corrections to the first review: `docs/adr/analytics-umami.md` is **current** (amended 2026-07-22, Umami Cloud); the stale thing is the TODOS.md entry about it. All 12 guide surfaces are **off** in production (live health read), not `ideas,source` | — |
| Ranked the eight gated guide modules by pain and outcome (F-NUMBERS first, F-TREND second, F-DIARY high on pain and last on buildability) with build estimates | conversation only; summary in §4 below |

## 2. State now

- **`main` @ `7ad39eb`.** Main CI green. Dependabot PRs #138–#162 open, unchanged.
- **Uncommitted, from this session, to commit by explicit path in the first PR:**
  `lib/server/nudge.ts`, `lib/server/db/index.ts`, `app/api/health/route.ts`,
  `docs/adr/hosting-hybrid.md`, `docs/adr/stack.md`, `CLAUDE.md` (the Architecture section; the Next.js
  block in it is re-added by `next dev` and may be committed too), `docs/architecture.md` (new), this file.
- **Uncommitted, from earlier sessions, not yours to decide:** `DESIGN.md`, `TODOS.md`,
  `docs/safety/copy-ledger.md`, `docs/ops/env-reference.md`,
  `docs/superpowers/plans/2026-09-13-guide-redesign.md`, `.planning/STATE.md`. They are the 2026-09-19
  audit's documentation fixes and the 2026-09-24 map's notes. Read `git diff` on each before including
  any of them in a docs PR; never bundle them with code.
- **Production** (`https://prediabetespal.com`, read 2026-10-01 20:41 UTC): `ok:false`, issues = four
  stale crons; `guideDoor` all 12 `off`; `gdmDoor` absent (not on main); `flagTwins` all on;
  `checkoutGate: open`; `launch: ready`. `NEXT_PUBLIC_GUIDE_DOOR` is **not set** in production.
- **Plan tier:** Vercel **Hobby** (`app/api/check/route.ts:57`), Neon **Free** (incident runbook). Hobby's
  fair-use terms are non-commercial; this app sells a subscription. Counsel gate for the terms reads
  **NOT CLEARED** (`docs/legal/owner-risk-launch-decision-5f6abcb.md:18`) while checkout is open.
- **Guide door:** PR-1…PR-6 merged dormant (#144–#159). 44 ledger rows `Pending` (40 guide + 4 others).
  `lib/pal/guide-ideas.labels.json` **does not exist** — the guard closes `ideas` without it.
  The safety-owner submission `docs/handoff/2026-09-17-safety-owner-submission-draft.md` is **unsent**.
- **GDM door:** Tier 1 fully built and reviewed on `feat/gdm-door-tier1` (worktree
  `.claude/worktrees/gdm-door`), 58 commits ahead, eight stacked local refs `gdm/pr-0` … `gdm/pr-6`,
  **none pushed, no PR**. Final checks green 2026-09-27. Batch G1 (28 rows) draft unsent. Migration
  `0020` not generated on main. `gdm-organiser` claim class not asked.
- **Surface dependency map** (`lib/guide-door-flag.ts` `SURFACE_REQUIRES`): `home` needs `ideas` +
  `ideas-full`; `orient` needs `ideas`; `intake` needs `orient` + `source` + `home`; `ideas-full` needs
  `ideas`. `calm` has zero rows and always loads.

## 3. The yardstick: pains, outcomes, and which feature serves which

From `PRD/Prediabetes_Pal_Guide_Redesign_PRD_v1.1.md` §2 (163 posts, two blind coders). Any move in this
session is judged by which row it serves and whether the app *may* serve it.

| Pain (any-code share) | Wanted outcome | May the app help? | Built feature that serves it | State |
|---|---|---|---|---|
| I have a number and no way to read it (27.6–32.5%, the largest) | an explanation (21/27) | not directly — only general education + a hand-off | **F-NUMBERS** (gated, D7); the orientation step 1 link to the public guide (dormant, `orient`) | not built / dormant |
| The result betrayed my effort (18.4–27.6%) | one number moved (15% of frame) | not directly | **F-TREND** (gated, D3 + RV-3) | not built |
| What am I allowed to eat (16.6–19%) | to eat without fear | **yes, fully** | the check (live); **F-IDEAS** chips + bank (dormant, `ideas`, `ideas-full`) | live / dormant |
| Nobody gave me a plan; where do I start (15.3–17.8%) | a course of action | mostly | **F-ORIENT** first week (dormant, `orient`); **Home layout** (dormant, `home`); **F-ASK intake** (dormant, `intake`); F-PLAN (gated, D1) | dormant / not built |
| The clinician gave me nothing (13.5%, may be one-thread artefact) | the system to act (6/8) | partly | F-REFER, F-DOCTOR (gated) | not built |
| Dread of where this is going (3.7–4.3%) | peace of mind | a little | **F-CALM** (dormant, `calm`); clinical routing (live) | dormant / live |
| The sources contradict each other (4.9–7.4%) | an answer | yes | **F-SOURCE** lead-in (dormant, `source`); the paragraph (gated on the panel eval) | dormant / not built |

**Reading:** the two largest pains are ones the product may address only indirectly. Releasing the
dormant surfaces serves rows 3, 4, 6 and 7 directly. F-NUMBERS is the single highest-value gated item
because it is the honest hand-off for row 1; it needs one claim-class answer and about two agent-hours.

## 4. Gated modules, ranked (second scorer, per PRD §11 risk 4)

| Rank | Module | PRD §12 | Impact 1–10 | Gate holder | Agent build |
|---|---|---|---|---|---|
| 1 | F-NUMBERS | 17 | 9 | safety owner / counsel (D7 class) | 1–2 h |
| 2 | F-TREND | 16 | 8 | owner (D3) + safety owner (RV-3) | 6–8 h + production migration |
| 3 | F-DIARY | 15 | 8 on pain, **last on buildability** | owner + counsel (D4, intended-use change) | 2–3 days; not an engineering decision |
| 4 | F-PLAN | 16 | 6 | owner (D1, posture change) | 3–4 h |
| 5 | F-REFER | 16 | 5 | safety owner (3 rows) | 30 min |
| 6 | F-DOCTOR | 12 | 5 | owner + safety owner (D2) | 2–3 h |
| 7 | F-SOURCE paragraph | 14 | 3 | engineering runs the panel eval (paid); safety owner approves one row | 1–2 h + eval |
| 8 | F-HABIT | 14 | 3 | sequencing rule, after Phase 5; **and the scheduler must be fixed first** | 1–2 h |

The guide plan's rule for these is "gate first, then work" (§5). Do not build one ahead of its gate.
The one item worth running regardless is the F-SOURCE **panel eval**: it is safety evidence about
whether the engine gives the same answer twice. It costs money; ask before running (§6 B4).

## 5. The session plan — in this order

Work in small PRs through `/ship`. Every PR: `npm run lint && npm run typecheck && npm run contract &&
npm test` green, plus the doc-scanning suites when docs change (`docs-provider-truth`,
`privacy-provider-truth`, `claims-boundary-copy`, `privacy-stateful`, `env-contract`, `copy-pins`,
`safety-contract-script`, `launch-controls`, `owned-domains`). Nothing user-visible ships without an
Approved row; a **deletion** of a false sentence needs no row (feature map K21).

### A. Agent-executable now — no human gate

| # | Action | Why (pain / promise) | Notes |
|---|---|---|---|
| A1 | **Commit the 2026-10-01 work** (files in §2) as one PR: nudge query fix + ADR corrections + the map + CLAUDE.md + this file | hygiene; the map is the next session's entry point | explicit paths only |
| A2 | **Scheduler interim:** in `.github/workflows/hourly-crons.yml` add two more schedule lines (`20 * * * *`, `40 * * * *`). Every job is idempotent (leases, claim-before-send, upserts), so overlapping runs are safe and `concurrency` already serialises them. Record the observed cadence before/after in `docs/ops/outstanding.md` | FIX2b: a paid feature (reminders) failing on most days; health 503 | **Interim only.** The durable fix is Vercel Pro + the four paths back in `vercel.json` (§6 B1). Do not delete the workflow until that lands |
| A3 | **FIX4:** delete "The daily check is free." from `lib/server/plan-box.ts` and `components/guest-dashboard.tsx` (feature map §3.0) | false promise to every guest of every door; pain 3 ("where do I start") answered with a lie | deletion, no row. Add a copy test asserting no shipped string promises free checks beyond day 1 |
| A4 | **FIX11:** keep the day-1 taster through sign-in (`app/welcome/page.tsx:110` clears it; `app/api/check/route.ts` then walls with "yesterday's checks", false on day 1). Prefer carrying the taster over; a reworded wall needs a row | lost free checks + a false wall on the day the user signed up | PGlite route test + a smoke step in `trial-wall.spec.ts` |
| A5 | **FIX1:** let clinical text reach the router on all three paths that answer first: (a) the client taster wall — run `classifyClinicalRisk` client-side before redirecting to `/subscribe` (the classifier is pure, `lib/pal/clinical-risk.ts`); (b) the proxy 429s and (c) the launch-pause 503 — reuse the existing `URGENT_CARE_LINE` string from `proxy.ts` verbatim (no new row; file a row for it under FIX8 later) | a safety route withheld; pain 6 (dread) and the clinical boundary | tests: unit on the wall gate, proxy test for the 429/503 bodies |
| A6 | **FIX2a:** reminders — give an in-app way back on (the opt-in card hides while a browser subscription exists, `components/nudge-opt-in.tsx:58-61`; "Turn off" only PATCHes `nudgeOptIn:false`) and fix the off-state pointer to `/check`, not "the home page". Keep existing strings | paid feature with no way back | row needed only if a string changes — do not change strings |
| A7 | **FIX10:** the result card's "How Prediabetes Pal chooses a signal" link opens the weekly-recap page. Retarget the link (code) rather than rewording it (row) | mislabelled link under every result | — |
| A8 | **FIX5, FIX6, FIX7:** saved-meals CSS missing (`components/saved-meals-section.tsx`); pre-charge email date has no timezone (`lib/server/billing/precharge.ts:77-80`); pantry stuck-order alert window misses at the real cadence (`lib/server/pantry/sweep.ts`, add `alerted_at` per its own `ponytail:` note) | premium polish; a money email; a $49 order with no alert | small, code-only |
| A9 | **Stale `CronName` type:** `lib/server/heartbeat.ts` lists three names; `trial-precharge` and `pantry-sweep` write the table directly. Widen the type, route both through `recordHeartbeat` | hygiene | tiny |
| A10 | **GDM: push the branch and open the stacked PRs** `gdm/pr-0` … `gdm/pr-6` from the worktree. CI already has the GDM e2e leg. **Merge PR-0 and PR-L** (they render nothing — no user-visible string). **Hold PR-1** until migration `0020` is applied to production (§6 B5): the shared export/erase routes query the new tables for every user; code before tables 500s both | releases nothing yet; makes the door mergeable the day the class lands | from `.claude/worktrees/gdm-door`; **do not `cd` there in a shell you then use to edit main** — a path guard blocks edits across the two checkouts (bit the 2026-10-01 session) |
| A11 | **Flip-ready PR for the guide door** (dark until merged *and* the flag is set): the D6 landing line (`landing-hero-moment` amended once, plan §8 item 11) and the `docs/ops/launch-controls.md` §13 reads checked. Then `npm run config:production-check` — it runs the real guard against today's ledger and tells you which surfaces would load | so the flip is one env change + one deploy the hour batch 1 is Approved | the landing line is a row: file it in the submission, do not ship it until Approved |
| A12 | **Record R-A** in the plan's §1 D5 row and in `docs/ops/launch-controls.md` §13 (kill line 2 is now the only read) | truth in the plan | docs PR |
| A13 | **TODOS top item** (in-app browser sign-in loss): build detect-and-tell on `/signin` behind a row; file the row | P1 the week `organiser` goes live; silent funnel loss for both doors | the sentence needs a row — file it with batch 2 |

### B. Needs the owner — put these to the owner in one message, with the asks pre-written

| # | Ask | Unlocks | Notes |
|---|---|---|---|
| B1 | **Vercel Pro**, then move `nudge`, `pantry-sweep`, `trial-precharge`, `stripe-reconcile` into `vercel.json` crons and delete `hourly-crons.yml` | hourly cadence; health green; reminders daily; removes the 60-day schedule trap; Hobby's non-commercial terms | verify Hobby's fair-use clause against Vercel's current policy first; if it still says non-commercial, Pro is required before taking money |
| B2 | **Neon paid tier** | no idle suspend, a compute budget that does not run out mid-month, longer PITR | the only database |
| B3 | **Send the two safety-owner submissions:** guide (`docs/handoff/2026-09-17-safety-owner-submission-draft.md`, 40 rows, add the D6 landing row and the A13 row) and GDM (`docs/handoff/2026-09-27-gdm-batch-g1-safety-owner-draft.md` on the branch, 28 rows + the `gdm-organiser` class) | every flip | if the owner is the safety owner: approve by hand, one `Status` cell per row |
| B4 | **Run `npm run eval:pal:ideas`** (≈1,440 paid calls, ≈$15–19) and commit `lib/pal/guide-ideas.labels.json`; or authorise the agent to run it with the owner's key | `ideas`, `ideas-full`, and transitively `orient`, `home`, `intake` | re-run whenever `PROMPT_VERSION` or the model changes |
| B5 | **Apply migration `0020`** to production (`npm run db:migrate:production` with `DATABASE_MIGRATION_URL` + `PAL_DB_ENV=production`, then `npm run db:governance:check`) **before GDM PR-1 merges** | GDM PR-1…PR-6 | `docs/runbooks/database-governance.md` — quote the URL; unquoted `&` leaked two passwords before |
| B6 | **Decisions, ranked by value:** D7 (class for general number education → F-NUMBERS), D3 + RV-3 (→ F-TREND), the F-SOURCE panel-eval spend, D2 (→ F-DOCTOR), D1 (→ F-PLAN), D4 (→ F-DIARY; recorded, not recommended) | the gated modules, in §4 order | one message, one table |
| B7 | **Counsel:** the terms gate (`LEGAL_TERMS_FINAL` is set in production, checkout open, counsel gate NOT CLEARED); the GDM privacy notice and data-flow rows | taking money defensibly; GDM `organiser` | — |
| B8 | **GDM premise rows** (plan §1): who reviews batch G1 and by when; where the first fifty door users come from | GDM `organiser` | non-code rows the owner fills in |

### C. After approvals — agent executes

1. **Guide door, in dependency order,** one surface group per deploy, each verified in the first five
   minutes: `/api/health` → `guideDoor` shows exactly the expected surfaces on · `/home?stay=1` at
   375×667 shows three chips with the check CTA's bottom edge on screen · a chip tap lands on `/check`
   with the idea in the field · a flag-off surface is unchanged · `ideas_shown` arrives in Umami within
   the hour (if not, assume analytics is blind before assuming nobody came — the 2026-07-22 CSP
   precedent).
   - `ideas,source` (batch 1 Approved + labels file) — the D6 landing line ships in this deploy.
   - `+calm` (colour review recorded).
   - `+ideas-full` (batch 3) — plan §2.1 asks for the ideas-viewed : checks-run read first; read it once.
   - `+orient` (batch 2's 18 rows). `+home` (batch 2's 5 rows; needs `ideas-full`).
   - `+intake` (batch 2's 5 rows + A-105) — needs `orient`, `source`, `home`.
   - Production **never** carries `1`. Revert = unset the variable, rebuild, redeploy (no server twin).
2. **GDM door:** merge PR-1…PR-6 after B5. Then `GDM_DOOR_ENABLED=1` + `NEXT_PUBLIC_GDM_DOOR=landing`
   (class exists + `landing` rows Approved), then `landing,organiser` (batch G1 Approved, counsel read
   the notice). Rehearse the revert with `npm run config:production-check` first. Verify: `gdmDoor`
   and `flagTwins.gdmDoor` in health · `/gdm` at 375 · sign-in from `/gdm` lands on `/gdm/start` ·
   `/check` and `/home` unchanged · `gdm_door_shown` in Umami.
3. **Gated modules** in §4 order as each decision lands; F-NUMBERS first.
4. **Four weeks after each flip:** read kill line 2 (guide) and KL-T1 / KL-D1 (GDM, ≥ 50 door users)
   from `docs/ops/launch-controls.md` §13 / §14. Then the retire-the-flag PRs (plan §7.3 step 9; GDM
   §7.3 step 8 — `GDM_DOOR_ENABLED` stays as the kill switch).

### How the released features work with the live ones

An idea chip runs a real check through `/api/check`: the trial wall, entitlement, history, memory and
telemetry apply exactly as to a typed check (plan §8 item 6: taps are never served from the label
cache). Orientation writes `profiles.orientation` through the existing profile route; migration 0019 is
applied. Home and intake extend the existing shell and tour. Guests keep the same local stores. The GDM
door shares sign-in, export, erase, email and the database, links to nothing in the prediabetes door,
and a GDM user who types `/check` gets the public door with the `pregnancy` route as backstop.

## 6. Traps (new this session; the 2026-09-19 §11 traps still apply)

- **Worktree path guard.** A shell `cd` into `.claude/worktrees/gdm-door` makes every later Edit of a
  main-checkout file fail with "Worktree path guard". Use `git -C` or absolute paths for reads; `cd`
  back to `/home/tefera/Desktop/Revora` before editing main.
- **The doc-scanning suites read `docs/**`.** Any new doc can fail `docs-provider-truth`,
  `privacy-provider-truth`, `claims-boundary-copy` or `owned-domains`. Run them after every docs change.
- **`vercel env ls` shows names only;** sensitive values are write-only. `NEXT_PUBLIC_GUIDE_DOOR` is
  absent in production today; set it with `vercel env add --force --value …` (argv, no trailing newline).
- **The production guard runs only when `VERCEL_ENV=production`.** A preview cannot rehearse a refused
  flag; `npm run config:production-check` can.
- **Hourly crons have production side effects** (emails, Stripe calls). Do not `gh workflow run` them to
  "fix" health; the A2 schedule change is the interim.
- **`CANONICAL_APP_URL`** in `scripts/run-hourly-crons.mjs` must equal `APP_URL` in the workflow
  byte-for-byte, and the prompt-leak regex in `postprocess.ts` / `eval-rubric.ts` must match
  `prompt.ts`'s first line (CLAUDE.md "Rename lockstep traps").
- **Never commit** the earlier sessions' tracked diffs (§2) in a code PR.

## 7. First moves for the next session

1. Read `docs/architecture.md`, then this file's §0 and §5.
2. `git status --short`; confirm the §2 lists; open PR A1.
3. A2 (scheduler interim) as its own PR; note the cadence in `docs/ops/outstanding.md`.
4. A3 → A9 as small PRs in that order (harm to a user outranks hygiene).
5. A10: from the worktree, push `feat/gdm-door-tier1` and the eight refs; open the stacked PRs; merge
   PR-0 and PR-L; hold PR-1.
6. A11, A12, A13.
7. Write the owner message for §5 B as one table and **stop at the gates.** Report what shipped, what
   is ready to flip the hour a row is Approved, and the exact human actions outstanding.
