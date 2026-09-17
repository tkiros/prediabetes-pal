# Handoff: guide redesign PR-2, PR-3 and the first-week follow-up, from build finished to truly done

*Written 2026-09-15 (EDT) at the end of session 2.*

**What to paste into a new Claude Code session:** everything below the line.

---

You are continuing the Prediabetes Pal **guide redesign**. Its plan is
`docs/superpowers/plans/2026-09-13-guide-redesign.md`, and its spec is
`PRD/Prediabetes_Pal_Guide_Redesign_PRD_v1.1.md`; the spec wins any conflict.

This file is the only record of the work, together with git history and the PR descriptions. The SDD workspace, including the ledger, has been deleted.

**The engineering is finished, reviewed and pushed. Nothing has been merged.** What remains is:
- deploy steps;
- one security-gate decision;
- the merges, in order;
- safety-owner reviews;
- owner decisions before any feature flag is switched on.

**Never push, merge, run production migrations, or change a security gate without the user's explicit OK in this session.** Their standing rule is: "Never push or merge without asking."

## 0. Where things are

### Checkouts
| Path | Branch | Notes |
|---|---|---|
| `/home/tefera/Desktop/Revora` | the main checkout | A copy of this file belongs in `docs/handoff/` here. |
| `/home/tefera/Desktop/Revora/.claude/worktrees/guide-pr23` | `feat/guide-orient-finish` @ `7d7aa5e` | This work. The tree is clean apart from this handoff file, which is untracked. |
| `/home/tefera/Desktop/Revora/.claude/worktrees/guide-redesign` | PR-1's branch | **Do not touch** it unless the user asks. It is kept for PR #144's review feedback. |

To work in this work's checkout, use `EnterWorktree` with `path: /home/tefera/Desktop/Revora/.claude/worktrees/guide-pr23`, then check out the branch you need.

### Pull requests
All four are open. `origin/main` is at `76eab01`.

| PR | Branch → base | Head | What it is | CI |
|---|---|---|---|---|
| **#144** | `feat/guide-redesign` → `main` | `60d1358` | PR-1: ideas on Home, the flag, and the production guard. Stays dormant. Reviewed in the other checkout. | Green except **secret scan** (false positive, §2 A) |
| **#145** | `chore/migration-0019-profile-orientation` → `main` | `8949028` | Migration 0019: a nullable `profiles.orientation jsonb` column, with the matching `schema.ts` line and `lib/coach/orientation.ts` (the column's type) | **All green** |
| **#146** | `feat/guide-pr23` → `feat/guide-redesign` | `156bc20` | PR-2 (calm-tone audit and a neutral "Hold off" colour, behind the `calm` flag) and PR-3 ("Your first week", behind the `orient` flag). 28 commits from `60d1358`. | Green except **secret scan** (false positive, §2 A) |
| **#147** | `feat/guide-orient-finish` → `feat/guide-pr23` | `7d7aa5e` | Follow-up: during the week the day line replaces Home's date; A-83 sign-in line; A-84 steps complete where they happen. 11 commits from `156bc20`. | **All green**, including the full playwright suite in all three flag legs (unset, `1`, `ideas,source`) |

### Verification at each head (run locally)
| Head | Unit and static checks | Smoke, flag unset | Smoke, `PAL_E2E_GUIDE_DOOR=1` |
|---|---|---|---|
| `#145` (`8949028`) | typecheck clean; lint 0 errors; contract 9/9; `npm test` 2251 passed / 2 skipped. The drift probe (`drizzle-kit generate`) reports "No schema changes". | — | — |
| `#146` (`156bc20`) | lint 0 errors; typecheck clean; `test:pal` 1207 passed / 25 skipped; contract 9/9; client + server 975 passed / 0 failed; `npm test` 2561 passed / 51 skipped | `dashboard` + `first-week`: 24 passed / 24 skipped | same specs: 44 passed / 4 skipped |
| `#147` (`7d7aa5e`) | lint 0 errors; typecheck clean; contract OK; `npm test` 2617 passed / 51 skipped | `dashboard` 20/16, `first-week` 4/12, `journey` 36/8 (passed/skipped) | `dashboard` 36/0, `first-week` 12/4, `journey` 40/4 (passed/skipped) |

There is no local Postgres, so database-backed smoke tests skip. That is the expected baseline.

## 1. What has been done

### Session 1: PR-2 and PR-3, 12 tasks, subagent-driven development
Each task had its own spec-and-quality review.

- **PR-2, F-CALM (`60d1358..973fe08`)**
  - `:root[data-calm]` re-tokens `--high-*` to a neutral ink, so "Hold off" reads as *pause* rather than *alarm*. Contrast is 13.35:1 and 11.87:1, both AA.
  - `data-calm` is set on `<html>` only when the `calm` surface is on.
  - A calm-tone audit report: `docs/audit/2026-09-15-calm-tone-audit.md`.
  - A regex guard in the claims audit.
- **PR-3, F-ORIENT (`973fe08..32b2621`)**
  - The seven-step model: `lib/coach/orientation.ts`.
  - A device store for guests (`pal.orient.v1`).
  - The new `profiles.orientation` column, written only through PATCH operations that the server merges in SQL: `markDone`, `start`, `dismiss`, `restore`, and `set` (the one-time migration, which returns 409 if a week already exists).
  - Home shows the day and "Today's step: …".
  - `/learn/first-week`: the week list with one-way Done, Hide/Show, and a clinician-questions note that never leaves the device.
  - The "Where you are" line on `/journey`.
  - The onboarding tour hands off to the week.
  - A guest's week moves to their account when they sign in.
  - 17 copy-ledger rows, all Pending.

### Session 2 (this session)
1. **Whole-branch review of PR-2 + PR-3 (opus).** Verdict "with fixes": 0 Critical, 2 Important, 7 Minor, 9 of the 34 deferred items to fix.
   - One fix round (`32b2621..156bc20`), which covered:
     - the analytics test comment;
     - an unmount guard on the migration;
     - clearing the note's timer on unmount;
     - the note's status line kept mounted, and its `aria-describedby`;
     - the `DESIGN.md` contrast ratios;
     - the route's exhaustiveness guard;
     - a pin that the reminder PATCH never cancels pending reminders with `orient` off;
     - a docstring fix;
     - the ledger's Surface and Notes cells;
     - a renamed test;
     - the flag docstring;
     - an A-84 blocker comment and pin.
   - Re-review: 13 of 13 addressed.
2. **Full gates on #146** (numbers in §0), then pushed and opened as PR #146.
3. **Migration PR #145.**
   - I proved that a migration-only PR fails CI's drift gate: `drizzle-kit generate` emits `DROP COLUMN`.
   - So #145 also carries the `schema.ts` column and `lib/coach/orientation.ts`, **byte-identical to #146**, which keeps the stacked branches conflict-free.
   - Consequence: **#145 must be applied to the database before it merges** (§2 B).
4. **The user chose option C for the Home layout, and option A to build A-83 and A-84.**
   - Built as follow-up branch `feat/guide-orient-finish` in three tasks, each reviewed:
     - **Home day line (rulings F-47 and F-51).**
       - During a week, Home's single `<h1>` reads "Day N of your first week" instead of the date.
       - Fold slack with `orient` on: 65.8 / 19.9 / 19.9 px at 360 / 375 / 430 wide (it was 46.3 / 0.3 / 0.3).
       - Guest page shift: 0.00px (it was 19.5px).
     - **A-83 (ruling F-48).**
       - An expired-taster guest with a week showing sees "Sign in to keep your week going", linking to `/signin`.
       - This is the owner-approved default from the plan's final gate (2026-09-14).
       - New ledger row `orientation-signin-step`, Pending.
     - **A-84 (rulings F-49, F-50, F-53, F-54, F-55).** `lib/client/orientation-progress.ts` `recordStepEvent(kind)`:
       - A result check marks step 2, then step 3.
       - An idea check marks step 4.
       - Step 1's link marks step 1.
       - The first saved clinician-questions note marks step 5.
       - Step 7's link marks step 7.
       - Step 6 has no trigger until F-REFER ships its dietitian row.
       - Every event marks the device week **and** sends the new `markNext { steps }` PATCH. The server applies it in SQL only when the week has started and is not dismissed.
       - The egress pins were strengthened.
   - Whole-branch review of the follow-up: one fix wave, then a re-review, 8 of 8 addressed.
   - Pushed as PR #147.
   - #146's description was updated to point to #147. Use the REST API for PR edits (see §6).
5. **CI.** #145 and #147 are fully green. #144 and #146 fail only the gitleaks secret scan, on a false positive (§2 A).

## 2. The exact actions to reach "done"

There are two levels of done:
- **Level 1, "shipped dormant":** every PR is merged and deployed with the flags off, and production is healthy.
- **Level 2, "live":** a surface is switched on in production. That is a separate product decision behind its own gates. **Never propose switching a flag on yourself.**

### Level 1

**A. Secret-scan false positive. Needs the user's OK, because it changes a security gate.**
- gitleaks rule `generic-api-key` matches the `STATE_KEY` constant (value `pal.orient.v1`), which is a localStorage key name, not a secret.
- The match is in commit history, so renaming the constant will not clear it.
- The narrow fix is a root `.gitleaksignore` file with these two fingerprints:
  ```
  6a4fff04bd8bf5f92b864e3747cd51820253fc6d:docs/superpowers/plans/2026-09-13-guide-redesign.md:generic-api-key:1616
  ead511b513cf692d8cf41011352d06fd0a78973b:lib/client/orientation-store.ts:generic-api-key:15
  ```
- **Where it goes:** one commit on `feat/guide-redesign` (#144's branch) carrying both lines. Pull requests are tested on GitHub's merge commit, which includes the base branch's files, so #146 picks the file up from its base.
  - Coordinate with whoever owns the `guide-redesign` checkout, or ask the user.
  - Then re-run the secret-scan job on #144 and #146 and confirm both pass.
- **What not to do:** `.gitleaks.toml` has a comment explaining why its allowlist is scoped to single commits. Do not add a broad regex allowlist.

**B. Migration 0019. Must happen before #145 merges.**
Merging #145 deploys a `schema.ts` that names the column. Drizzle lists every column in an INSERT, so onboarding's `POST /api/profile` and the account export would fail on a database without the column.

The owner runs these with production credentials: `DATABASE_URL` and `DATABASE_MIGRATION_URL`, which must use different database roles.

```
git checkout chore/migration-0019-profile-orientation
PAL_DB_ENV=production npm run db:migrate:production   # runs: ALTER TABLE "profiles" ADD COLUMN "orientation" jsonb;
npm run db:governance:check                            # must pass; run from THIS branch
```

- Applying early is safe: the code running on `main` never names the column.
- **Do not** run `db:governance:check` from `main` between applying and merging. `main` does not have the 0019 file yet, so the check would report a mismatch.

**C. Merge #145** (merge commit; the repo uses "Merge pull request #…" commits). Vercel deploys to production.

Verify production:
1. Create a test account through onboarding. This exercises `POST /api/profile`.
2. Download the account export and check it succeeds.
3. Check that `/learn/first-week` returns 404, because the flag is off.

**D. #144 (PR-1).** Its review happens in the other checkout.
- Its own owner actions are in #144's description: sign off 8 rows, the dinner-line safety read, `npm run eval:pal:ideas` (**owner-only, about $15; never run it yourself**), making the flag-on CI legs required checks, the classics-hint wording, the guard's first production run, and the untracked plan and PRD copies in the main checkout.
- **Merge it with a merge commit, not a squash.** If it is squashed, #146 must be rebased: `git rebase --onto origin/main 60d1358 feat/guide-pr23`, then the same for `feat/guide-orient-finish` onto the new `feat/guide-pr23`. Re-run the gates, then force-push, but only with the user's OK.

**E. #146.**
1. After #144 merges, GitHub retargets #146 to `main` if `feat/guide-redesign` was deleted. Otherwise retarget it yourself:
   `gh api -X PATCH repos/tkiros/prediabetes-pal/pulls/146 -f base=main`
   (`gh pr edit` fails in this repo with a "Projects (classic)" GraphQL error.)
2. #146 also carries #145's five files, byte-identical, so the merge is clean even though the diff still lists them.
3. Wait for CI to go green, then merge with a merge commit.
4. **Verify production:** onboarding, export, the reminder settings PATCH, and Home unchanged with the flag off.

**F. #147.** Retarget it to `main` the same way. Wait for CI, merge with a merge commit, and repeat the production smoke checks.

**G. Safety-owner submissions.** Do these as soon as the PRs are open; they are open now.
- **Batch 2 (#146), 17 rows, all `Pending | Yes`:**
  - `orientation-intro`
  - `orientation-step-01` … `orientation-step-07`
  - `orientation-day-eyebrow` (Surface: Learn)
  - `orientation-controls`
  - `orientation-note-hint` (contains the word **"safe"**, flagged in its Notes)
  - `orientation-save-failed`
  - `orientation-step-prefix`
  - `learn-first-week-intro`
  - `journey-where-you-are`
  - `onboarding-final-button`
  - `onboarding-first-week-line`
- **Plus #147:** `orientation-signin-step` ("Sign in to keep your week going").
- Also for the safety owner:
  - The Approved row `landing-three-answers` gained a treatment note only; its text is unchanged.
  - F-REFER did not ride along.
- **Owner questions from the calm-tone audit:**
  - drafted amendments for `clinical-medication-dosing` and `clinical-allergy` (the rows are unchanged, PENDING W-05);
  - `proxy.ts` rate-limit and outage copy (`RATE_LIMIT_COPY`, `URGENT_CARE_LINE`, `ABUSE_LIMIT_COPY`) has no ledger row;
  - `.status-card[data-state="error"]` uses raw hex colours.

**H. Cleanup, once #147 has merged.**
- Remove the `guide-pr23` worktree from the main checkout: `git worktree remove .claude/worktrees/guide-pr23`.
- Delete the merged remote branches.
- Remove the `guide-redesign` worktree only after #144 is done **and** the user agrees.

### Level 2: switching a flag on

Production takes an explicit surface list in `NEXT_PUBLIC_GUIDE_DOOR`. It must never be `1`.

- **How to switch:** change the Vercel environment variable, then **rebuild and redeploy**. It is not a runtime switch.
- **What the production guard enforces** (`lib/guide-door-guard.ts`): it refuses any surface whose ledger rows are not `Approved` + `Active`, and it enforces dependencies:
  - `orient` requires `ideas`;
  - `intake` requires `orient`;
  - `home` requires `ideas` and `ideas-full`.

**`calm`**
- Lists zero ledger rows, so **only a human gate** protects it.
- **Gate:** the safety owner's colour-blind and "does this look like a warning" review (A-61, Task 2.3's protocol).
  - Look at the landing verdict cards at 375 and 1280 wide.
  - Record the result in the ledger note on `landing-three-answers` and in `DESIGN.md` §3.

**`orient`**, all of:
1. All 18 orientation rows Approved.
2. `ideas` is live, since `orient` requires it (PR-1's own gates).
3. **Owner decision F-56: the completion metric.**
   - `orientation_step_done` counts Done taps only, and A-84 emits no analytics event, so the owner's completion read will undercount steps 1–5 and 7.
   - `docs/ops/launch-controls.md` §13.4 now says this.
   - Either redefine the read, or ask for the existing event to be emitted when a device mark lands. That is a small follow-up PR.
4. The privacy page (`app/(app)/privacy/page.tsx`) should mention first-week progress stored on the account.
5. **The D5 concierge test gates any switch-on.**
6. **Known exposure, accepted:** `dayKeyInTimezone` throws on a malformed stored timezone, which Home already does today.

**Beyond this scope** (not started): the rest of the plan.
- PR-4 (full F-IDEAS)
- PR-5 (Home layout, §3; owns `home-check-hero-title`)
- PR-6 (intake, §4)
- Tier-2 gated modules: F-REFER, F-DOCTOR, F-PLAN, F-HABIT
- F-NUMBERS, which points step 1's link at `/learn/numbers`
  - One edit: `LEARN_NUMBERS_HREF` in `lib/coach/orientation.ts`.
  - Home's step link already reports `learn_opened` for `/learn/` links (F-55).

## 3. Open decisions for the user

| # | Decision | Recommendation |
|---|---|---|
| 1 | `.gitleaksignore` fingerprints (§2 A) | Approve. Both are false positives, and the fix is narrow. |
| 2 | Who applies 0019, and when (§2 B) | Now, from #145's branch, before any merge. |
| 3 | Completion metric before an `orient` switch-on (F-56) | Redefine the read, or emit the existing event when a device mark lands. |
| 4 | Calm-audit owner questions (§2 G) | Route them to the safety owner with batch 2. |
| 5 | Merge method for the stacked PRs | Merge commits, per repo convention. |
| 6 | Where this handoff file lives | Copy it into the main checkout's `docs/handoff/` (this session could not write there). Do not commit it to the PR branches unless the user asks. |

## 4. Known and accepted gaps

- **F-31:** a signed-in user with no profile row sees no week on Home. Their device week is kept and moves to the account once a row exists.
- **Task 3.7 C3:** `/journey` shows no line until the first Home visit after sign-in stamps the week's start.
- **F-33:** the "missed migration" gap is closed in practice by F-42 (the week page migrates before it writes) and F-53 (every step event marks the device week).
- **F-56:** the analytics undercount described above.
- **A-84's request volume** is above the plan's "≤7 a week":
  - one PATCH per result check (two for an idea check);
  - one per tap on step 1's or step 7's link;
  - no-op PATCHes still rewrite the profile row.
  - Harmless at today's scale.
- **Flag-off "byte-for-byte" means the rendered HTML** (A-110), as PR-1 had it. With the flag off, the data Next.js sends to the browser differs slightly (a `null` child and a `stepToday:false` prop), with no visible effect.
- **Four changes are live regardless of the flag:**
  1. the A-45 two-sentence rewrite on `app/guides/a1c-5-7-to-6-4`;
  2. `/learn` added to the `robots.txt` disallow list;
  3. the reminder PATCH returns 404 when no profile row exists (A-92);
  4. with `orient` off, a PATCH body carrying `orientation` gets 404 instead of 400 (F-4).
- **Minors left as they are, with reasons:**
  - an `orient`-only build (without `ideas`) is untested; it is not a production state;
  - a Home test title is stale but still true;
  - the step-5 once-per-mount rule is tested at unit level only;
  - after the note saves, step 5 looks undone on `/learn/first-week` until reload;
  - no smoke test taps a step-7 link; unit tests cover it;
  - the dead `start` guard at `lib/coach/orientation.ts` stays (the other half of that guard is live).
- **Unmount-cleanup code has no test.** The repo has no DOM test harness.

## 5. Every ruling made, in order

These were decided on the user's behalf. Each entry says what was decided, then **Cost if wrong**. "(rev)" marks a ruling a later one revised; "(ret)" marks one whose premise was retracted.

### Preflight
1. **F-1: A-83 and A-84 deferred from PR-3.**
   - A-83 is the sign-in line; A-84 is `recordStepEvent`. Both were plan prose with no steps or tests.
   - Both were built later in #147.
   - **Cost if wrong:** one follow-up PR, which is now #147.
2. **F-2:** Task 2.2's report states 2.3 and 2.4 as proposals. **Cost if wrong:** one report edit.
3. **F-3:** a task's Steps win over its Files list. **Cost if wrong:** a file lands in the adjacent commit.
4. **F-4:** Task 3.3 owns the `orient` gate on the PATCH route. **Cost if wrong:** none.
5. **F-5:** smoke specs use `doorSurfaceOn()`, never the flag's variable name. **Cost if wrong:** none.
6. **F-6:** `orientation-save-failed` filed; `orientation-signin-step` not filed in PR-3. **Cost if wrong:** one row, now filed in #147.
7. **F-7 (rev):** migration shipped inside Task 3.3.
   - Revised to a separate PR (#30), then corrected again (#67).
   - **Cost if wrong:** a checklist line.
8. **F-8:** F-1 holds against the PRD's acceptance list. **Cost if wrong:** same as F-1.
9. **F-9:** the A-45 rewrite ships without the flag. **Cost if wrong:** two sentences to revert.
10. **F-10 and F-11:** one row, `orientation-step-prefix`, added to `SURFACE_ROWS.orient`. **Cost if wrong:** the safety owner splits it into two rows.
11. **F-11:** 17 rows filed; `orientation-signin-step` stays listed and blocks the switch-on. **Cost if wrong:** none; blocking is intended.
12. **F-12:** PR-2 order was 2.1, then 2.3, then 2.2 and 2.4 in one dispatch. **Cost if wrong:** one commit instead of two.

### PR-2
13. **Task 2.1:** the claims regex ships verbatim, with its known gap ("will help you manage" does not match). **Cost if wrong:** one phrasing goes unguarded until the safety pass.
14. **F-13:** the calm audit applies fixes only to unledgered strings or colour tokens; any change to ledger text is a proposal. **Cost if wrong:** the owner reads proposals instead of diffs.
15. **F-14:** the `status-card` raw hex colours become an owner question. **Cost if wrong:** one hex pair stays for now.
16. The `proxy.ts` outage copy becomes an owner question, with no rows filed. **Cost if wrong:** three strings stay unledgered.

### PR-3
17. `CONSTRAINTS.md` spelled out both source-scan rules. **Cost if wrong:** none.
18. **Task 3.1:** the step-5 and step-6 links point at a page Task 3.6 builds. **Cost if wrong:** none while the flag is off.
19. **Task 3.1:** step-id uniqueness is enforced in Task 3.3. **Cost if wrong:** none.
20. **F-15:** the egress pin is a list of files that must each exist. **Cost if wrong:** one line.
21. **F-16:** an extra accurate co-author trailer was kept. **Cost if wrong:** one trailer line.
22. **F-17 (ret):** the analytics scan was re-anchored as hardening. The "silent escape" severity was retracted. **Cost if wrong:** two test lines.
23. **F-18 (rev):** GET stays ungated. **Cost if wrong:** a user can read their own null value. Revised by #24.
24. **F-18 revised:** GET and export include `orientation` only when `orient` is on. **Cost if wrong:** one conditional per route.
25. **F-19:** A-103's op-based form wins over the brief. **Cost if wrong:** one rewritten test case.
26. **F-20:** `db:governance:check` is an owner step at deploy time. **Cost if wrong:** none.
27. **F-21:** the reminder PATCH returns 404 when no row exists, without the flag. **Cost if wrong:** a hand-written API client sees 404.
28. **F-22:** a 409 on `set` replays the week as individual ops. **Cost if wrong:** a few extra PATCHes.
29. **F-18 rationale corrected** (drizzle's INSERT names every column). **Cost if wrong:** none.
30. **F-7 revised:** a migration-first PR. **Cost if wrong:** one tiny PR. Corrected by #67.
31. **F-23:** the start stamp is `{op:"start"}`, with the time taken from the server. **Cost if wrong:** none.
32. **F-24:** the day counts from `startedAt` only; `onboardedAt` only decides eligibility. **Cost if wrong:** a user with no stamp sees day 1.
33. **F-25:** Home's query reads the new fields only when `orient` is on. **Cost if wrong:** none.
34. **F-26:** Task 3.5 does not touch the route again. **Cost if wrong:** none.
35. **F-28:** the hero eyebrow is covered by `orientation-step-prefix`. **Cost if wrong:** see #10.
36. **F-29:** `weekSummary` is computed but not rendered. **Cost if wrong:** one wasted string.
37. **F-30:** the Home layout was accepted as built at the time. **Cost if wrong:** no fold room. Fixed by #68.
38. **F-31:** a signed-in user with no row is treated as a guest on the week page. **Cost if wrong:** no week on Home for that group.
39. **F-32:** a 400 on `set` is handled like a 409. **Cost if wrong:** a skewed-clock guest's start resets to the server's time.
40. **F-33:** the missed-migration gap is parked, then closed by F-42 and F-53. **Cost if wrong:** steps re-marked.
41. **F-34:** one `router.refresh()` after a migration. **Cost if wrong:** one extra render.
42. **F-35:** the guest page shift is parked with F-30, then fixed by #68. **Cost if wrong:** a visible shift.
43. **F-36:** Done is one-way; "Not yet" is not rendered. **Cost if wrong:** a mistapped Done can't be undone per step.
44. **F-37:** a `restore()` was added to the store. **Cost if wrong:** none.
45. **F-38:** a `LearnLink` client component reports `learn_opened` from Home's step line. **Cost if wrong:** one file.
46. **F-39:** `/learn/first-week` returns 404 before any query. **Cost if wrong:** none.
47. **F-40:** the page reads "Day N of your first week", never "of 7". **Cost if wrong:** different wording.
48. **F-41:** a dismissed week stays listed on the page. **Cost if wrong:** one line.
49. **F-42:** a signed-in visit to the page migrates the week before its controls unlock. **Cost if wrong:** one request of waiting.
50. **F-43:** added `first-week.spec.ts`. **Cost if wrong:** two e2e builds.
51. **F-44:** `/journey` fetches the profile only when `orient` is on. **Cost if wrong:** none.
52. **F-45:** the journey line's forms: no start → no line; active → day form; otherwise → review form. **Cost if wrong:** users with no stamp see no line.
53. **Task 3.6:** the controls unlock before `refresh()`. **Cost if wrong:** a step briefly shows undone.
54. **Task 3.6:** the app layout's timezone read runs before the 404. **Cost if wrong:** one extra read.
55. **Task 3.7:** `whereYouAreLine` placed in `orientation.ts`. **Cost if wrong:** none.
56. **Task 3.7:** `loadJourneyLine` placed in `remote-orientation.ts`. **Cost if wrong:** none.

### Session 2: final review of PR-2 and PR-3
57. **F-46:** the flag-off RSC payload differences are left as they are; byte-for-byte means the HTML. **Cost if wrong:** three edits later.
58. The dead `start` guard stays. **Cost if wrong:** one dead token.
59. **F-46:** A-84 stays deferred without a placeholder id; a comment covers it. **Cost if wrong:** days 2–3 re-ask for a check. Moot now: A-84 shipped.
60. **F-46 amended:** a test pins `orientation-signin-step` in `SURFACE_ROWS`. **Cost if wrong:** a one-line test edit.
61. No explicit column list for the export route. **Cost if wrong:** a mis-ordered deploy also breaks export.
62. A test was renamed; the page and `/journey` keep "Day N" when all steps are done. **Cost if wrong:** a small follow-up.
63. A possible hydration mismatch at midnight is left. **Cost if wrong:** a console warning.
64. Calm-rows, privacy and timezone items go on the switch-on checklist. **Cost if wrong:** none before a switch-on.
65. `orientation-day-eyebrow` gets Surface Learn. **Cost if wrong:** one cell.
66. The unmount cleanups are accepted without tests. **Cost if wrong:** a stray refresh.

### Session 2: finishing and the follow-up
67. **The migration PR** carries the 0019 migration and its metadata, the `schema.ts` column and `lib/coach/orientation.ts`, all byte-identical, and has an apply-before-merge gate. This is needed because of CI's drift gate. **Cost if wrong:** an unused module reaches `main` early.
68. **F-47:** Home's single `<h1>` shows the day line during a week, with the eyebrow class when `ideasOn || weekOn`. **Cost if wrong:** a class tweak.
69. **F-48:** the A-83 line replaces any day's step for an expired guest, with the exact text, no prefix, and `/signin`. **Cost if wrong:** an expired guest on a day whose step needs no check sees the sign-in line anyway.
70. **F-49 (rev):** the `markNext` op runs only in a started, not-dismissed week, with no day ≤ 7 check. **Cost if wrong:** a step marked after the week ends. The client fallback was revised by #74.
71. **F-50 (rev):** step 5 completes on the first saved note, through an `onSaved` prop on a client wrapper; step 6 has no trigger; step 1 completes from its link. **Cost if wrong:** step 5 completes on a save rather than a visit. The step-7 part was revised by #75.
72. **F-51:** the smoke test that only logged a measurement was deleted; a unit pin covers the mechanism. **Cost if wrong:** smoke wouldn't catch a shift.
73. **F-52:** commits whose trailer names Sonnet are kept. **Cost if wrong:** those commits name a different model.
74. **F-53:** `recordStepEvent` always marks the device week and sends the PATCH, whatever the status. **Cost if wrong:** a signed-in user's device copy collects marks it never shows.
75. **F-54:** step 7 completes only from its own links, never from a plain `/journey` visit; `nextAction()` returns the step id. **Cost if wrong:** a user who opens the tab directly on day 7 must tap Done.
76. **F-55:** the step link also reports `learn_opened` for `/learn/` links. **Cost if wrong:** a few lines.
77. **F-56:** no analytics change; the undercount is documented and the metric is the owner's call. **Cost if wrong:** a small follow-up.

## 6. Traps, and the controller's own mistakes

**Eight times the controller asserted something false.**
Each time it checked one step and assumed the rest. Always verify end to end, and trust the file over any claim, including this one.
1. It named the account-delete page as a `--danger` user; it is not.
2. It said the claims audit scans comments; it skips lines that begin with a comment marker.
3. It said the export includes the column automatically; the export builds its output field by field.
4. It said a fresh e2e guest would see the day eyebrow; that page has no profile.
5. It said the analytics scan could be silently bypassed; it failed closed.
6. It said a bare `<DashboardView/>` would be byte-for-byte; the RSC payload still differs.
7. It said a migration-only PR would pass CI; the drift gate emits `DROP COLUMN`.
8. It said A-83's wording was still an open owner decision; the owner approved it at the final gate, 2026-09-14.

**Tooling traps**
- **Session-isolation guard.** Keep git commands plain: no `$(git …)`, no loops or `for` around git, no `cd … && git …` chains. Split them into separate calls. The Write tool refuses paths outside the session's worktree, including the main checkout.
- **`gh pr edit` fails** with a "Projects (classic)" error. Use `gh api -X PATCH repos/tkiros/prediabetes-pal/pulls/<n> -F body=@file` or `-f base=…`.
- **Background tasks.** Subagents sometimes stop while waiting on their own background tasks and then send stale "finished" notices. Check `git status` and `git log` before re-dispatching.
- **The machine can be slow under load.** A client + server vitest run once took over 20 minutes. Check CPU before assuming it has hung.

**Project traps**
- **`next dev` rewrites `CLAUDE.md`.** Revert it. `CLAUDE.md` and `AGENTS.md` must not change.
- **Never write the literal `NEXT_PUBLIC_GUIDE_DOOR` under `tests/smoke/`** (pinned at `tests/unit/pal/smoke-guide-door.test.ts:192`).
  - Use `doorSurfaceOn(surface)` from `tests/smoke/guide-door.ts`.
  - To switch e2e builds, use `PAL_E2E_GUIDE_DOOR=1`.
  - Run a spec both ways: `npm run e2e -- tests/smoke/<spec>.ts` and `PAL_E2E_GUIDE_DOOR=1 npm run e2e -- …`.
  - `trial-wall.spec.ts` builds both paywall modes.
- **The two source scans behave differently.**
  - The claims audit (`tests/unit/pal/claims-boundary-copy.test.ts`) skips lines that **begin** with a comment marker, so a trailing comment **is** scanned.
  - The analytics no-PII scan reads only `lib/client/analytics.ts` and strips nothing.
- **The contract script** validates claim classes only for Approved rows.
- **Analytics union:** insert new members before `photo_draft`.
- **The orientation egress pins** (`tests/unit/pal/orientation-egress-guard.test.ts`) are two-way:
  - the note files never import a sender;
  - the sending files never name the note.
- **Copy-ledger rows:** every new user-facing string gets a row filed `Pending | Yes`. Never set one to Approved. Never change an existing row's Copy or Status cell.
- **Every user-visible change goes behind `guideDoorEnabled("<surface>")`,** server side too.
- **Next.js 16.3 has breaking changes.** Read `node_modules/next/dist/docs/` before touching a Next API.

## 7. Standing constraints (from the user and `CLAUDE.md`)

**Keep these `revora` strings. Do not "clean them up":**
- `tests/unit/pal/owned-domains.test.ts` (a denylist of domains we don't control);
- `tests/unit/pal/sw-dev-teardown.test.ts`;
- the docstrings in `lib/pal/contact.ts` and `lib/server/email.ts`;
- historical docs under `docs/handoff`, `docs/archive`, `docs/audit`, `docs/qa`, `PRD`, `predict`, `.planning/phases` and `.planning/research`.

**Lockstep pairs**
- `.github/workflows/hourly-crons.yml` `APP_URL` must equal `CANONICAL_APP_URL` in `scripts/run-hourly-crons.mjs`, byte for byte.
- The prompt-leak regex in `lib/pal/postprocess.ts` and `lib/pal/eval-rubric.ts` changes only together with the opening line of `lib/pal/prompt.ts`. `tests/unit/pal/prompt-leak-guard.test.ts` enforces this.

**Paid work, off limits:** never run the paid live eval (`PAL_LIVE_EVAL`, `PAL_EVAL_IDEAS`, `npm run eval:pal:ideas`: about 1,440 calls, about $15). It belongs to the owner.

**Commits and PRs**
- Commit trailers: use the new session's own `Co-Authored-By` and `Claude-Session` lines from its system prompt.
- PR descriptions end with the `🤖 Generated with [Claude Code]` lines.

**Where to stop and ask:**
- irreversible operations;
- security-sensitive actions (including gitleaks config);
- side effects outside the worktree: push, merge, publish, production migrations;
- a plan so broken that every path is a guess.

Otherwise, make a ruling and record it as `Ruling: <what> — <why> — <cost if wrong>`.
