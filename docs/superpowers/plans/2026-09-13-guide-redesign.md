<!-- /autoplan restore point: /home/tefera/.gstack/projects/Revora/main-autoplan-restore-20260914-022800.md -->
# Prediabetes Pal Guide Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Read me first (2026-09-14 review):** notes marked **`review A-nn`** and blocks titled **"Review amendment A-nn"** inside the tasks are the plan as it stands and supersede the sentence or code block they annotate. Everything below the heading **`# /autoplan review record`** near the end of this file is the review's own record — read it for the *why*, never implement from it. Two questions are still the owner's at the final gate (the day-2 paywall, the kill-line numerator); their plan defaults are marked.

**Goal:** Turn the app's front door from a judge (check a plate) into a guide (ideas, orientation, plain explanations) without changing the engine, the labels, or the claims boundary — shipped as flagged, PR-sized phases in the order PRD §9 fixes, with every gated feature specified so the owner's decision is the only thing between it and a build.

**Architecture:** One client build flag (`NEXT_PUBLIC_GUIDE_DOOR`) gates every door surface and is §9.2's revert lever. New user-facing text lives in bounded, reviewed banks (`lib/pal/guide-ideas.ts`, `lib/coach/orientation.ts`) following the `coach-outputs.ts` pattern; every string is a copy-ledger row. Home keeps its one prop-driven `<DashboardView>` tree (server-rendered for signed-in users, `<GuestDashboard>` from localStorage); new blocks are client components that read on-device keys after hydration. `/check` stays the one place a check runs — ideas hand off through the existing `pal.recheck` session key. Learn pages are new `(app)/learn/*` routes inside the shell. Analytics stays a closed-enum allowlist: never meal text, never A1C.

**Tech Stack:** Next 16.3 App Router (read `node_modules/next/dist/docs/01-app/` before touching an API), React 19.2, TypeScript 6, zod 4, drizzle-orm + Postgres (PGlite in tests), vitest 4 (`environment: "node"`, no jsdom), Playwright smoke under `tests/smoke/`, Umami analytics via `lib/client/analytics.ts`.

**Spec:** `PRD/Prediabetes_Pal_Guide_Redesign_PRD_v1.1.md` (wins on any conflict). Rationale only: `docs/handoff/2026-09-11-prediabetes-top5-pains-outcomes.md`. Governance: `docs/safety/claims-boundary.md`, `docs/safety/copy-ledger.md`, `DESIGN.md`, `CLAUDE.md`.

## Global Constraints

- **Nothing here ships before the concierge test reads its branch** (PRD §9 Step 0; D5). Code may be written and merged behind the flag; the flag flips on only after the branch is read. Concierge floor < 3 of 5 second questions ⇒ stop, build nothing (§9.2).
- **The engine, the three labels (`Clear` / `Be careful` / `Hold off`, `lib/pal/labels.ts`), `docs/safety/claims-boundary.md`, `lib/pal/boundary-copy.ts`, pricing and the Phase 5 launch plan do not change** (PRD §0). `lib/pal/*` engine behaviour is pinned by `tests/unit/pal/engine-regression.test.ts` — never edit those expectations.
- **Copy rules everywhere** (PRD §7.3, §8): the output is a *label* or *read*, never verdict/score/safe/risk in public copy; anchor phrase is **"Prediabetes Pal's rules"**, never "your plan"; second person only for actions, never for the user's clinical state; `BOUNDARY_DISCLAIMER` on every result and every Learn page; banned verbs with the product as subject: prevent, reverse, control, lower, treat, manage, cure, diagnose; do not lead with prevention. Never interpret a user's number. Never predict an individual glucose response.
- **Every new user-facing string is a copy-ledger row** in `docs/safety/copy-ledger.md` with a claim class from `claims-boundary.md`. Rows ship as `Pending | Yes` behind the flag (the `photo-draft-*` precedent) and flip to `Approved` on safety-owner sign-off. **The flag may be set to `1` in production only when every row it renders is `Approved`.** The ledger parser splits cells on `|` — list several items in one Copy cell with ` · `.
- **Bounded banks, never free generation** for anything the user reads that is not the engine's own reason field (PRD §8.3).
- **Analytics** (`lib/client/analytics.ts`): closed enums only, never a bare `string` prop. The no-PII source scan (`tests/unit/client/analytics.test.ts`) fails on the identifiers `a1c`, `food`, `email`, `reason`, `question`, `message`, `disclaimer`, `swap`, `adjustment`, `examples`, `sequencingTip`, `postMealAction` **anywhere in the file, comments included**. Insert every new union member **before** the `photo_draft` variant — the "no bare string" test slices the union at that end marker. **A-120 (Task 1.3):** the no-PII scan's assertion message gains the line number and the sentence "comments count — write 'idea' or 'meal'", because today it reads "expected true to be false".
- **Flag convention, and one deliberate deviation.** `NEXT_PUBLIC_GUIDE_DOOR` is a client build flag **without a server twin**: the door adds no server boundary (the bank is static; a tapped idea runs an ordinary `/api/check` call that is already IP-metered), so the twin guard's purpose (a runtime kill switch for a server surface) does not apply — the same shape as `NEXT_PUBLIC_REVIEWER_MODE`. Consequence, stated in Rollout: turning the door off is a reviewed rebuild, not an env flip. F-TREND adds an API route and therefore gets the full twin pair. Every new env var needs a row in `docs/ops/env-reference.md` (`tests/unit/env-contract.test.ts`). **Review amendment A-04 (taste, strike-able at the gate):** the flag's value is `1` (every surface) or a comma-separated surface list, and every `guideDoorEnabled()` call in this plan passes the surface named in the table under Task 1.1.
- **Storage keys** use the `pal.*` prefix (`pal.recheck` exists; new: `pal.recheck.source`, `pal.ideas.rotation`, `pal.orient.v1`, `pal.orient.note.v1`, `pal.ask.v1`). Guests keep everything on-device; nothing on-device is ever sent to the server or the model.
- **Keep the protected `revora` strings** listed in `CLAUDE.md` (owned-domains denylist, `sw-dev-teardown` hosts, historical docs). Do not "clean them up".
- **Design rails** (`DESIGN.md` §1): one accent `#0d5f57`; Check stays the one accent-filled action; no dark bands; 44px targets; icons only from `components/icons.tsx`; radius scale 24/22/18/14/999; no gamification on progress surfaces (§9). The §8 ordering sentence is amended in PR-1 (PRD §7.4) — a design-doc edit, recorded, not silent.
- **New unit tests go under `tests/unit/pal/`** unless they extend an existing file in place (`tests/unit/client/analytics.test.ts`, `tests/unit/coach/next-action.test.ts`, `tests/unit/client/onboarding-flow.test.ts`). Smoke specs under `tests/smoke/`. Every commit: `npm run lint && npm run typecheck && npm run test:pal && npm run contract`.
- **Convention used in this plan for blocked Tier-1 items** (F-NUMBERS, F-TREND, the F-SOURCE `/how-it-works` paragraph): they appear in §1's gate table and in §2.4 as gated modules — gate first, then what opens it, then files/tests/copy — not as tasks in the main sequence. The same treatment applies to Tier 2.

---

## 1. Gate / decision status table

Status as of 2026-09-19 (commit `3e87605`); §8 recommendations recorded and the F-ASK floor ruling amended 2026-09-14. "Blocks" names what may not start; "Opens when" is the unblock condition the plan waits on. Built and merged dormant 2026-09-17: PR-1 (#144), migration 0019 (#145, applied to production first), PR-2 + PR-3 (#146), the first-week finish (#147). Built and merged dormant 2026-09-18: **PR-4 (#153)** — the grown bank, segment steering and "See all", all behind the `ideas-full` surface; **PR-5 (#156)** — the Home layout, behind `home`. Built and merged dormant 2026-09-19: **PR-6 (#157)** — the intake tour (Screens A/B, the welcome under intake, `intake_ask`), behind `intake`. Every surface is off in production.

| # | Decision / gate | Decider | Status | Blocks | Opens when |
|---|---|---|---|---|---|
| D5 | Run the concierge test: read r/prediabetes rules in a browser, send the §5.3 draft, recruit 5, add the neutral opener and the three counts | Owner | **Not started** — rules page unread (403 to fetches), draft unsent | Flipping `NEXT_PUBLIC_GUIDE_DOOR=1` anywhere public; every Tier-1 PR's *release* (not its merge) | Floor ≥ 3 of 5 second questions **and** the number-vs-food count is read. Branch: food ≥ number → food order (§2.1); number > 2:1 → number order (§2.2); ≤ 2:1 or tie → food order, D7 in parallel. < 3 of 5 ⇒ stop |
| D7 | Which claim class does a general A1C-education page file under; if none, does counsel add one | Safety owner / counsel | **To ask now**, in parallel with D5 | F-NUMBERS (§2.4.1) | A class is named (row class = that class). **Escalation:** no class by branch-read day ⇒ F-NUMBERS deferred, prototype ships regardless of branch |
| Ledger batch 1 | eight rows (PR-1, all filed in Task 1.7 — A-119): `guide-ideas-breakfast`/`-lunch`/`-dinner`, `guide-ideas-hero`, `result-source-lead`, `check-empty-ideas`, `check-from-idea`, `check-classics-hint-guide` | Safety owner | **Filed, Pending** (all eight, 2026-09-15; safety-owner submission drafted 2026-09-17, not yet sent) | Production flag flip | Rows `Approved` **and** `tests/unit/pal/guide-ideas-labels.test.ts` green on the current `PROMPT_VERSION` (Task 4.1, pulled into PR-1 by review A-03) |
| Ledger batch 2 | Orientation, Learn, Home, onboarding, F-ASK rows (PR-3…PR-6) | Safety owner | **Filed, Pending — 28 rows**: the orientation half, 18 (PR-3 + #147); Home, 5 (PR-5, #156: `home-quick-row`, `learn-tiles`, `guide-ideas-later`, `home-door-worried-line`, `home-check-hero-title`); onboarding/F-ASK, 5 (PR-6, #157: `onboarding-ask-pains`, `onboarding-ask-win`, `onboarding-ask-response`, `onboarding-expectations-ideas`, `onboarding-welcome-guide`). The submission draft now carries all 28 (§3, §3c, §3d), still unsent | Production flag flip for those surfaces | Rows `Approved` |
| Ledger batch 3 | four rows (PR-4, filed in #153): `guide-ideas-more-breakfast`/`-lunch`/`-dinner`, `guide-ideas-see-all` | Safety owner | **Filed, Pending — 4 rows** (2026-09-18; added to the submission draft as §3b, still unsent) | Production flag flip for `ideas-full` | Rows `Approved` **and** `ideas` already live |
| D3 | Later out-of-range A1C entry: **refuse** / **store without anchoring** / **anchor and route** | Owner | **Open, no recommendation** | F-TREND (§2.4.2) | One of the three is chosen |
| RV-3 | `/journey` no-`%` rail: **(a)** amend `DESIGN.md` §9 + scope `expectRv3Clean`'s `%` assertion to the recap, or **(b)** render "A1C 5.9" with the unit in the heading (if a bare value still counts as a percentage under §9, (b) is unavailable) | Safety owner | **Open** | F-TREND (§2.4.2) | (a) or (b) chosen |
| Consistency eval | "Same read every time" evidence on the panel | Engineering | **Single meal green** — 127/127, 0 flips on prompt `2026-08-16.1` (`docs/ops/launch-controls.md` §12); **panel not run** | F-SOURCE `/how-it-works` paragraph (§2.4.3) | A panel run (every `stratum-*` meal × 3 bands, N ≥ 20 each) logged in §12 at ≥ 95% modal class, **and** the paragraph is an `Approved` ledger row |
| D6 | Landing: stay stale until the branch is known, or take the §3 line with the prototype | Owner | **Open** — plan default recorded 2026-09-14: stale | `/` row only | Either choice. Plan default: the §3 line ships in the same deploy as the flag flip (§7.3 step 3), never with PR-1 — the prototype is dark until batch 1 is approved, so the landing cannot advertise it. "Change now" adds one landing task to PR-1 and amends `landing-hero-moment` before the branch is known |
| D1 | Supply a default meal pattern and call it a starting plan | Owner | Step 2 (after Tier 1 live + Phase 5 measurement) | F-PLAN (§5.3) | Yes ⇒ build; No ⇒ closed, F-ORIENT stands alone |
| D2 | Approve a doctor-question bank near the clinical line | Owner + safety owner | Step 2 | F-DOCTOR (§5.2) | Bank reviewed and approved as ledger rows |
| F-REFER copy | One static referral section on `/learn/first-week` | Safety owner | Not filed | F-REFER (§5.1) | Cleared **in the same pass as** F-ORIENT's rows ⇒ ships with PR-3; otherwise deferred |
| F-HABIT | Opt-in daily reminder | Owner | Deferred | F-HABIT (§5.4) | Phase 5 measures whether anyone returns without it |
| D4 | Change the intended-use statement to permit food beside readings | Owner + counsel | **No recommendation** | F-DIARY (§6) | A new intended-use statement and regulatory posture — not a copy decision |
| Kill line 1 | Concierge floor | — | Pending D5 | Everything | < 3 of 5 ⇒ do not build Tier 1 |
| Kill line 2 | Ideas opened in < 25% of sessions after 4 weeks live | — | Instrumented by PR-1 | — | Fires ⇒ flag off (reviewed rebuild), PRD marked tested and closed |
| F-CALM colour (Task 2.3) | The colour-blind + "does this look like a warning" review of the neutral-ink `Hold off` family (§8 item 9) — **the one production change in this plan that is not behind the flag** (review A-35; **review A-40 puts the change behind the flag's `calm` surface, so PR-2 merges dormant like everything else**) | Safety owner | **Open** | Adding `calm` to the production flag value; PR-2 itself merges on readiness | The review is recorded in the ledger note on `landing-three-answers` and `DESIGN.md` §3; `landing-a11y.spec` green; the landing verdict cards eyeballed at 375 and 1280 |
| F-ASK floor | < 70% of the first 50 tour starts (after the two screens go live) reach the attribution screen, the one after Screen B | — | **Instrumented by PR-1 Task 1.9** (`onboarding_step`, per-screen funnel; the six-screen tour is the baseline) — owner ruling amended 2026-09-14. **Screens A/B are built and merged dormant in PR-6 (#157) (2026-09-19).** The floor's clock starts only when `intake` is live with its flip prerequisites (the R-40/M1 annotation at Task 6.4): `orient`, `source` and `home` live; counsel's A-105 answer on `pain_2`/`pain_3`; all five `intake` rows `Approved`; a design review of Screens A/B | — | Fires **and the drop sits on Screen A or B** ⇒ Screen A merges into "What brought you here?" (§4, Task 6.7). A drop on the A1C screen is a separate finding |

---

## 2. Tier 1 phases (PR-sized, in order)

### 2.1 Food-branch order (the default; §9 Step 1)

| PR | Phase | Feature(s) | Where the tasks are | Ships when |
|---|---|---|---|---|
| PR-1 | "Ideas are chips" prototype behind the flag | F-IDEAS (minimal) + F-SOURCE lead-in + analytics for the kill line + the tour funnel event (F-ASK floor baseline) + **the live label eval (Task 4.1, pulled forward by review A-03)** + **the `/check` first-run ideas row (Task 4.2, pulled forward by review A-42 — every landing CTA and the TWA start URL land on `/check`, so Home alone never meets a session-one guest)** | §2.3 Tasks 1.1–1.9, then Tasks 4.1 and 4.2 | Branch read (D5), ledger batch 1 filed. Production flip after batch 1 `Approved` **and** the label eval green |
| PR-2 | Calm-tone audit | F-CALM | §2.3 Tasks 2.1–2.4 | Any time after PR-1 merges (near-zero cost) |
| — | F-NUMBERS | gated | §2.4.1 | D7 resolved |
| PR-3 | Orientation week | F-ORIENT (+ F-REFER if cleared) | §2.3 Tasks 3.1–3.8; F-REFER §5.1 | Ledger batch 2 filed |
| PR-4 | Full idea bank (growth to ≥ 10 per daypart, segment steering, See all) — **built and merged dormant 2026-09-18 (#153)** behind the `ideas-full` surface | F-IDEAS (full) | §2.3 Tasks 4.3–4.4 + bank growth (4.1 and 4.2 moved to PR-1 by reviews A-03 and A-42) | PR-1's ideas-viewed : checks-run ratio "earns it" (owner reads the Umami counts; no threshold is set in the PRD — see Open questions). **The ratio read was not taken before the build** — the owner chose to build anyway, so the merge is dormant work the read could still cancel; the *release* gate is unchanged |
| PR-5 | Home layout | §7.4 / §7.6 | §3 Tasks 5.1–5.5 | After PR-3 (the step line) and PR-4 |
| PR-6 | Intake | §7.4 onboarding changes + F-ASK (§7.5) | §4 Tasks 6.1–6.7 | After PR-5 (door order needs the Home slots) |
| — | F-TREND | gated, **last in both branches** | §2.4.2 | D3 **and** RV-3 chosen |
| — | F-SOURCE `/how-it-works` paragraph | gated | §2.4.3 | Consistency eval on the panel green + ledger row |

### 2.2 Number-branch order (alternative sequence)

Applies when number questions outnumber food questions more than 2 : 1 **and** D7 has a class. Same PRs, different order; content unchanged.

1. **F-NUMBERS** (§2.4.1) — needs D7. Carries Task 1.1 (the flag module + env row), because it ships first.
2. **PR-3 F-ORIENT** — orientation step 1 links `/learn/numbers`.
3. **PR-1 prototype** — Task 1.1 already done; skip it.
4. **PR-2 F-CALM**.
5. PR-4 → PR-5 → PR-6 as in §2.1. F-TREND last.

If D7's escalation has fired (no class by branch-read day), the number branch collapses to the food order: prototype first, F-NUMBERS waits, and the number/effort F-ASK picks route to the public guide (Open questions).

### 2.3 Unblocked Tier-1 tasks

#### PR-1 — "Ideas are chips" prototype

**File structure**

| File | Responsibility |
|---|---|
| Create `lib/guide-door-flag.ts` | `guideDoorEnabled()`: exact `"1"` only |
| Create `lib/pal/guide-ideas.ts` | The reviewed idea bank (static, three dayparts, positive only) + deterministic rotation |
| Create `lib/client/ideas-rotation.ts` | On-device monotonic counter `pal.ideas.rotation` |
| Create `components/guide-ideas.tsx` | Three chips above the hero; tap → `pal.recheck` + `/check` |
| Modify `components/dashboard-view.tsx` | Render `<GuideIdeas />` above `<HomeCheckHero />` when the flag is on |
| Modify `components/result-card.tsx` | Source lead-in above the engine reason (flag on) |
| Modify `components/food-check-form.tsx` | Emit `idea_check_completed` when the check came from an idea; the first-run ideas row below the CTA (Task 4.2, review A-42) |
| Modify `tests/smoke/mobile-check.spec.ts` | The ideas row renders below the CTA on first run, flag on (Task 4.2) |
| Modify `lib/client/analytics.ts` | Four closed-enum events: three for the door (Task 1.3), one tour-screen funnel (Task 1.9) |
| Modify `tests/unit/client/analytics.test.ts` | Allowlist, exhaustive switch, `oneOfEach` |
| Create `tests/unit/pal/guide-ideas.test.ts` | Bank is precheck-clean, positive-only, rotates |
| Create `tests/unit/pal/guide-door.test.ts` | Flag + source-lead + render-site pins |
| Modify `tests/unit/pal/claims-boundary-copy.test.ts` | Add `lib/pal/guide-ideas.ts` to `EXTRA_SOURCES` |
| Modify `docs/safety/copy-ledger.md` | Ledger batch 1 |
| Modify `docs/ops/env-reference.md` | `NEXT_PUBLIC_GUIDE_DOOR` row |
| Modify `DESIGN.md` §8 | Ordering sentence amendment |
| Modify `tests/smoke/dashboard.spec.ts` | Door assertions, skipped unless the build has the flag |
| Modify `app/(app)/onboarding/page.tsx` | `onboarding_step` funnel event + `trackedStep` guard (Task 1.9; not behind the flag) |
| Modify `tests/unit/client/onboarding-flow.test.ts` | The guard never names the A1C screen or the exit |
| Create `tests/evals/guide-ideas-label-eval.test.ts`, `lib/pal/guide-ideas.labels.json`, `tests/unit/pal/guide-ideas-labels.test.ts`; modify `package.json` | Task 4.1, pulled into PR-1 (review A-03): the live label eval and its unit gate — the bank ships to production only after every line reads `Clear` at every band |
| Modify `app/api/health/route.ts`, `tests/unit/server/health.test.ts`, `tests/unit/pal/env.test.ts` | a `guideDoor` key beside `flagTwins`, one `"on"|"off"` per surface (reviews A-11, A-67) |
| Modify `next.config.ts`, `tests/unit/pal/flag-server-twins.test.ts` | production build fails when the flag opens `ideas` and the labels file is stale (review A-63) |

##### Task 1.1: The door flag

**Files:**
- Create: `lib/guide-door-flag.ts`
- Modify: `docs/ops/env-reference.md` (flag table)
- Test: `tests/unit/pal/guide-door.test.ts`

**Interfaces:**
- Produces: `guideDoorEnabled(): boolean` — every later task imports this.

**Task card:** Copy: none. Flag: `NEXT_PUBLIC_GUIDE_DOOR` (this task creates it; amendment A-04 below makes it surface-listed, and every later task names its surface). Analytics: none. Done check: `npx vitest run tests/unit/pal/guide-door.test.ts tests/unit/env-contract.test.ts` green.

- [x] **Step 1: Write the failing test**

```ts
// tests/unit/pal/guide-door.test.ts
import { afterEach, describe, expect, it, vi } from "vitest";

import { guideDoorEnabled } from "../../../lib/guide-door-flag";

describe("guideDoorEnabled — the one door flag (PRD §9 Step 1, §9.2 revert lever)", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("only the exact value '1' opens the door", () => {
    vi.stubEnv("NEXT_PUBLIC_GUIDE_DOOR", "1");
    expect(guideDoorEnabled()).toBe(true);
    for (const value of ["true", "0", "", "yes"]) {
      vi.stubEnv("NEXT_PUBLIC_GUIDE_DOOR", value);
      expect(guideDoorEnabled()).toBe(false);
    }
  });
});
```

- [x] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/unit/pal/guide-door.test.ts`
Expected: FAIL — cannot find module `lib/guide-door-flag`.

- [x] **Step 3: Write the flag module**

```ts
// lib/guide-door-flag.ts
/**
 * The guide-door flag (PRD/Prediabetes_Pal_Guide_Redesign_PRD_v1.1.md §9
 * Step 1). Gates every "guide" surface — the ideas block above the Home hero,
 * the source lead-in on the result card, the orientation line, the Learn
 * pages and the intake changes — and it is §9.2's revert lever: if ideas are
 * opened in fewer than a quarter of sessions after four weeks, this goes back
 * to unset and the front door reverts to the check.
 *
 * Client build flag, fail-closed (only exact "1"). Deliberately NO server
 * twin: the door adds no server boundary — the bank is static data and a
 * tapped idea runs an ordinary, already IP-metered /api/check call — so the
 * twin guard's job (a runtime kill switch for a server surface) does not
 * apply. Same shape as NEXT_PUBLIC_REVIEWER_MODE. Consequence: turning the
 * door off is a reviewed rebuild + redeploy, not an env flip.
 */
export function guideDoorEnabled(): boolean {
  return process.env.NEXT_PUBLIC_GUIDE_DOOR === "1";
}
```

- [x] **Step 4: Document the env var** (the env-contract test fails otherwise)

Add to the flag table in `docs/ops/env-reference.md`, next to `NEXT_PUBLIC_REVIEWER_MODE`:

```
| `NEXT_PUBLIC_GUIDE_DOOR` | guide redesign (PRD v1.1 §9) | **Guide-door build flag** (`lib/guide-door-flag.ts` `guideDoorEnabled`): only exact `1` renders the ideas block above the Home hero, the result-card source lead-in, the orientation line, the Learn pages and the intake changes. Unset ⇒ the judge front door, byte-for-byte as before. **No server twin on purpose** (no new server boundary — see the module docstring); turning it off is a reviewed rebuild. Set to `1` in production only after the concierge branch is read (D5) and every ledger row the door renders is `Approved`. §9.2 kill line: ideas opened in < 25% of sessions after four weeks ⇒ unset. |
```

- [x] **Step 5: Run the tests**

Run: `npx vitest run tests/unit/pal/guide-door.test.ts tests/unit/env-contract.test.ts`
Expected: PASS.

- [x] **Step 6: Commit**

```bash
git add lib/guide-door-flag.ts docs/ops/env-reference.md tests/unit/pal/guide-door.test.ts
git commit -m "feat(guide): add NEXT_PUBLIC_GUIDE_DOOR build flag (PRD v1.1 §9)"
```

**Review amendment A-04 — surface-listed flag (taste; the owner may strike this block at the gate, in which case Step 3 above stands and §7.3 step 4's merge rule returns).** One env var, one function, one extra parameter. `NEXT_PUBLIC_GUIDE_DOOR=1` opens every surface; a comma-separated list opens only the surfaces named; anything else opens none. **Production never carries `1`** (review A-64): `1` is for `npm run dev`, previews and the e2e build; the production value is always the explicit list of surfaces whose ledger rows are `Approved` — batch 1 ⇒ `ideas,source` (+ `calm` after the colour review), batch 2 ⇒ `ideas,source,calm,orient,home,intake`, and so on. One surface per ledger batch, so a PR that adds strings to an already-open surface (PR-4's See-all copy and segment steering) gets its own surface (`ideas-full`). The kill line still reads "unset". The module replaces Step 3:

```ts
// lib/guide-door-flag.ts  (amendment A-04 — supersedes the boolean form above)
export const GUIDE_SURFACES = [
  "ideas", "source", "calm",            // batch 1 (+ the colour review)
  "orient", "home", "intake",           // batch 2
  "ideas-full",                         // PR-4's additions to an already-open surface
  "numbers", "refer", "doctor", "plan", // gated modules (§2.4.1, §5.1–5.3)
  "guide"                               // taste A-51, if accepted
] as const;
export type GuideSurface = (typeof GUIDE_SURFACES)[number];

/**
 * `1` opens every guide surface; a comma list opens only those named; any
 * other value (unset included) opens none. Fail-closed, exact tokens only.
 * Same build-time, no-server-twin posture as documented above — the list
 * exists so a PR whose ledger rows are still Pending can merge while its
 * surface stays dark in production (§7.3 step 4).
 */
export function guideDoorEnabled(surface: GuideSurface): boolean {
  const value = process.env.NEXT_PUBLIC_GUIDE_DOOR ?? "";
  if (value === "1") return true;
  return value.split(",").map((token) => token.trim()).includes(surface);
}
```

Test (replaces Step 1's single case):

```ts
  it("`1` opens every surface; a list opens only its members; anything else opens none", () => {
    vi.stubEnv("NEXT_PUBLIC_GUIDE_DOOR", "1");
    for (const surface of GUIDE_SURFACES) expect(guideDoorEnabled(surface)).toBe(true);
    vi.stubEnv("NEXT_PUBLIC_GUIDE_DOOR", "ideas, source");
    expect(guideDoorEnabled("ideas")).toBe(true);
    expect(guideDoorEnabled("source")).toBe(true);
    expect(guideDoorEnabled("orient")).toBe(false);
    for (const value of ["true", "0", "", "yes", "idea"]) {
      vi.stubEnv("NEXT_PUBLIC_GUIDE_DOOR", value);
      for (const surface of GUIDE_SURFACES) expect(guideDoorEnabled(surface)).toBe(false);
    }
  });
```

Surface map — every `guideDoorEnabled()` call in this plan passes the surface on its row:

| Surface | Calls (task) |
|---|---|
| `ideas` | Task 1.4 mount in `dashboard-view.tsx`; Task 1.14 (= 4.2) `/check` empty-state row — rows `guide-ideas-*`, `guide-ideas-hero`, `check-empty-ideas`, `check-from-idea`, `check-classics-hint-guide` (A-119: the classics-hint variant is its own row, because a guard cannot read a variant's status) |
| `source` | Task 1.5 `result-card.tsx` lead-in |
| `orient` | Task 3.5 Home eyebrow + step; Task 3.6 `/learn/first-week` `notFound()`; Task 3.7 `/journey` line and the onboarding final button / `completeTour()` target |
| `home` | Task 5.1 quick row; Task 5.2 `/learn` index `notFound()`; Task 5.3 `<HomeDoor>`; Task 5.5 hero H2 |
| `intake` | Task 6.1 `askEnabled`; Tasks 6.2–6.4 screens and the expectations line |
| `calm` | Task 2.3: `app/layout.tsx` sets `data-calm=""` on `<html>` when `guideDoorEnabled("calm")`, and the neutral-ink `--high-*` values live under `:root[data-calm]` (review A-40) |
| `ideas-full` | Task 4.3 segment steering and Task 4.4 See all / Show fewer — new strings on an already-open surface (review A-64) |
| `numbers` · `refer` · `doctor` · `plan` | §2.4.1 F-NUMBERS, §5.1 F-REFER, §5.2 F-DOCTOR, §5.3 F-PLAN — each opens with its own approved batch (review A-64) |
| `guide` | Only if the owner accepts taste decision A-51 (idea rows on the public what-to-eat guide) |

The env-reference row (Step 4) says the same in one sentence: "`1` opens every surface; a comma list of surfaces opens only those; anything else opens none; production never carries `1`." The smoke runs keep `NEXT_PUBLIC_GUIDE_DOOR=1`.

**Review amendment A-11 — the deploy says whether the door is on.** In `app/api/health/route.ts` the payload gains a **separate** `guideDoor` key beside `flagTwins` — built from `GUIDE_SURFACES` (every surface, `ideas-full` and the gated ones included — review A-96), one `"on"|"off"` per surface and never the raw value (review A-67: `tests/unit/pal/env.test.ts` compares the whole payload and its rule is *booleans by name, never values*). Update both `env.test.ts` and `tests/unit/server/health.test.ts`. This is the only runtime probe the door has, because it has no server twin.

**Review amendment A-101 — the guard knows the rows and the dependencies.** `lib/guide-door-flag.ts` also exports `SURFACE_ROWS: Record<GuideSurface, readonly string[]>` (every ledger Copy ID a surface renders — `ideas`: `guide-ideas-breakfast/-lunch/-dinner`, `guide-ideas-hero`, `check-empty-ideas`, `check-from-idea`, the classics-hint variant of `onboarding-first-check`; `source`: `result-source-lead`; `orient`: the `orientation-*` rows incl. `orientation-signin-step`, `orientation-save-failed`, `learn-first-week-intro`, `journey-where-you-are`, `onboarding-final-button`, `onboarding-first-week-line`; `home`: `home-quick-row`, `learn-tiles`, `guide-ideas-later`, `home-door-worried-line`, `home-check-hero-title`; `intake`: `onboarding-ask-*`, `onboarding-expectations-ideas`, `onboarding-welcome-guide`; `ideas-full`: `guide-ideas-see-all`; `calm`: none) and `SURFACE_REQUIRES: Partial<Record<GuideSurface, GuideSurface[]>>` (`home` needs `ideas` and `ideas-full` — the quick row's Ideas item is the See-all toggle; `orient` needs `ideas` — step 4 points at the ideas block; `intake` needs `orient`; `ideas-full` needs `ideas`). A **pure** `checkProductionDoor(value, ledgerText)` in `lib/guide-door-guard.ts` (testable from `tests/unit/pal/flag-server-twins.test.ts`; `next.config.ts` only calls it) rejects an unknown token, a list missing a required surface, the value `1`, and any surface whose rows are not all `Status = Approved` in `docs/safety/copy-ledger.md` — its error text follows `scripts/check-production-config.ts:38`'s pattern. `validate-safety-contract.mjs` checks thirteen hardcoded IDs today; this guard is what finally connects the ledger to what a build renders (DESIGN.md §1.1's named gap).

##### Task 1.2: The idea bank

**Files:**
- Create: `lib/pal/guide-ideas.ts`
- Modify: `tests/unit/pal/claims-boundary-copy.test.ts` (`EXTRA_SOURCES`)
- Test: `tests/unit/pal/guide-ideas.test.ts`

**Interfaces:**
- Consumes: `Daypart` from `lib/coach/insights.ts`; `classifyInputBeforeModel` from `lib/pal/input-precheck.ts` and `classifyClinicalRisk` from `lib/pal/clinical-risk.ts` (tests only).
- Produces: `type GuideIdea = { id: string; text: string; daypart: Daypart }`; `GUIDE_IDEAS: readonly GuideIdea[]`; `ideasFor(daypart: Daypart, rotation: number, count?: number): GuideIdea[]`; `GUIDE_IDEA_BANK: Record<Daypart, readonly string[]>` (for the audit and the ledger diff).

**Task card:** Copy: every idea line → ledger rows `guide-ideas-breakfast`, `guide-ideas-lunch`, `guide-ideas-dinner`, class `result-qualitative-impact` (the bank), plus the two "must never say" rules recorded in the row notes (never "safe for you", never a reading, never "your plan"). Flag: none (data). Analytics: none. Done check: `npx vitest run tests/unit/pal/guide-ideas.test.ts tests/unit/pal/claims-boundary-copy.test.ts` green.

Why the bank is precheck-clean by construction: the engine floors any carb-forward token (`bread`, `toast`, `rice`, `pasta`, `potato`, `wrap`, `tortilla`, `noodles`, … — `CARB_FORWARD_TOKENS` in `lib/pal/input-precheck.ts`) to `MODERATE` in the top band, so no idea containing one can be `Clear` at every band, and `oatmeal` / `yogurt` / `smoothie` trigger the plain-or-sweetened clarify unless resolved by a named fruit, nut or protein. Ideas are drawn from the three public guides with those tokens dropped. The live model check at every band is PR-4 (Task 4.1); this task pins the deterministic half.

- [x] **Step 1: Write the failing test**

```ts
// tests/unit/pal/guide-ideas.test.ts
import { describe, expect, it } from "vitest";

import { classifyClinicalRisk } from "../../../lib/pal/clinical-risk";
import {
  GUIDE_IDEA_BANK,
  GUIDE_IDEAS,
  ideasFor,
  ideasFrom
} from "../../../lib/pal/guide-ideas";
import { classifyInputBeforeModel } from "../../../lib/pal/input-precheck";

/**
 * The idea bank (PRD v1.1 §6 F-IDEAS). Tiering rule from the PRD: every idea
 * must return Clear at every band 5.7–6.4, so the DETERMINISTIC half of that
 * (no clinical route, no clarify, no carbs-only / carb-forward / high-risk
 * floor) is pinned here without a model call. The model half is the live
 * labelling eval (tests/evals/guide-ideas-label-eval.test.ts, PR-4).
 */
describe("guide idea bank — precheck-clean, positive only", () => {
  it("has at least six ideas per daypart — two disjoint loads of three (review A-43)", () => {
    for (const daypart of ["breakfast", "lunch", "dinner"] as const) {
      expect(GUIDE_IDEA_BANK[daypart].length).toBeGreaterThanOrEqual(6);
    }
  });

  it.each(GUIDE_IDEAS.map((idea) => [idea.text, idea] as const))(
    "%s reaches the model path with no floor and no clarify",
    (_text, idea) => {
      expect(classifyClinicalRisk(idea.text)).toBeNull();
      expect(classifyInputBeforeModel(idea.text)).toEqual({
        kind: "ok",
        flags: []
      });
    }
  );

  it("names nothing to limit — the bank is positive only (§6 F-IDEAS acceptance)", () => {
    for (const idea of GUIDE_IDEAS) {
      expect(idea.text).not.toMatch(/\b(?:avoid|limit|skip|cut|without|instead of|no )\b/i);
      expect(idea.text.length).toBeLessThanOrEqual(64); // review A-54: two lines in a 315px row at 375 (FOOD_MAX_LENGTH is 160)
    }
  });

  it("ids are unique and each idea carries its daypart", () => {
    const ids = GUIDE_IDEAS.map((idea) => idea.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const idea of GUIDE_IDEAS) {
      expect(GUIDE_IDEA_BANK[idea.daypart]).toContain(idea.text);
    }
  });

  it("an empty daypart bank yields no ideas rather than NaN — a property, not a guard (reviews A-31, A-70)", () => {
    expect(ideasFrom([], "breakfast", 0)).toEqual([]);
    expect(ideasFrom(GUIDE_IDEAS.filter((idea) => idea.daypart !== "lunch"), "lunch", 5)).toEqual([]);
  });

  it("rotates deterministically: consecutive loads never share a first idea", () => {
    for (const daypart of ["breakfast", "lunch", "dinner"] as const) {
      const a = ideasFor(daypart, 0);
      const b = ideasFor(daypart, 1);
      expect(a).toHaveLength(3);
      expect(a[0].id).not.toBe(b[0].id);
      expect(ideasFor(daypart, 0)).toEqual(a); // same counter, same list
      expect(new Set(a.map((i) => i.id)).size).toBe(3); // no repeats in one load
      expect(a.filter((i) => b.some((j) => j.id === i.id))).toHaveLength(0); // review A-43: consecutive loads are disjoint
    }
  });
});
```

- [x] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/unit/pal/guide-ideas.test.ts`
Expected: FAIL — cannot find module `lib/pal/guide-ideas`.

- [x] **Step 3: Write the bank**

```ts
// lib/pal/guide-ideas.ts
import type { Daypart } from "../coach/insights";

/**
 * The reviewed idea bank (PRD v1.1 §6 F-IDEAS; §9 Step 1 prototype).
 *
 * A bounded artifact a dietitian can review in one sitting — the
 * coach-outputs.ts pattern: fixed audited lines, deterministic rotation, no
 * free generation. Every line is promoted from the public guides
 * (app/guides/what-to-eat-with-prediabetes, prediabetes-meal-plan,
 * prediabetes-snacks) with one edit: any refined-starch side the engine
 * floors in the top band (bread, toast, rice, pasta, potato, wrap, tortilla…
 * — CARB_FORWARD_TOKENS) is dropped, because the PRD requires every idea to
 * read Clear at EVERY band 5.7–6.4 including the most conservative level.
 *
 * Rules the bank keeps (PRD §6 F-IDEAS "must never say"):
 *  - positive only: meal ideas, never foods to limit;
 *  - never that an idea is safe FOR the user, never a reading, never
 *    "your plan" — the anchor phrase on the surface is "Prediabetes Pal's
 *    rules" (§7.3);
 *  - outside the promise registry: these are NOT promoted examples with a
 *    pinned route shape; tests/unit/pal/promise-registry.test.ts is untouched.
 *
 * Deterministic gates: tests/unit/pal/guide-ideas.test.ts proves each line
 * reaches the model path with no clarify and no floor. Model gate: the live
 * labelling eval (PR-4) runs every line at 5.9 / 6.2 / 6.4 and writes
 * guide-ideas.labels.json keyed on PROMPT_VERSION; a line that is not Clear
 * at any band is removed here.
 *
 * Copy ledger: guide-ideas-breakfast / -lunch / -dinner. Scanned by the claims
 * audit via EXTRA_SOURCES.
 */
export type GuideIdea = { id: string; text: string; daypart: Daypart };

// Seed list: six per daypart (review A-43) so two consecutive loads of three
// never share an idea. Fruit-carrying lines (peach) are the ones most likely
// to fall at band 63_64 in the live eval; keep them until the eval says otherwise.
export const GUIDE_IDEA_BANK: Record<Daypart, readonly string[]> = {
  breakfast: [
    "greek yogurt with berries and walnuts",
    "veggie omelet with peppers and spinach",
    "cottage cheese with sliced peach and almonds",
    "scrambled eggs with mushrooms and cheese",
    "hard-boiled eggs with cucumber and tomato",
    "tofu scramble with peppers and onions"
  ],
  lunch: [
    "lentil soup with a side salad",
    "tuna and white-bean salad",
    "big salad with hard-boiled eggs, chickpeas, and vinaigrette",
    "chicken salad with olive oil dressing",
    "hummus with carrot and cucumber sticks and a hard-boiled egg",
    "grilled chicken and avocado salad"
  ],
  dinner: [
    "baked salmon with roasted broccoli",
    "chicken stir-fry heavy on vegetables",
    "turkey chili with plenty of beans, topped with cheese",
    "sheet-pan chicken thighs with peppers and onions",
    "pork tenderloin with green beans and roasted cauliflower",
    "shrimp with zucchini noodles"
  ]
} as const;

export const GUIDE_IDEAS: readonly GuideIdea[] = (
  Object.keys(GUIDE_IDEA_BANK) as Daypart[]
).flatMap((daypart) =>
  GUIDE_IDEA_BANK[daypart].map((text, index) => ({
    id: `${daypart}-${index + 1}`,
    text,
    daypart
  }))
);

/**
 * `count` ideas for a daypart, starting at `(rotation × count) % bank.length`
 * and wrapping (review A-43: a full page per tick) — a monotonic on-device counter (lib/client/ideas-rotation.ts)
 * therefore never shows the same first idea on two consecutive loads
 * (PRD §6 F-IDEAS acceptance). Negative / NaN counters fall back to 0, as in
 * coach-outputs.ts pick().
 */
export function ideasFrom(
  ideas: readonly GuideIdea[],
  daypart: Daypart,
  rotation: number,
  count = 3
): GuideIdea[] {
  const bank = ideas.filter((idea) => idea.daypart === daypart);
  // An empty bank needs no guard (review A-70, spec review): `Math.min(count, 0)`
  // makes `Array.from` return [] and the NaN start is never used as an index.
  // Review A-43: step by `count`, not by one — two consecutive loads are then
  // disjoint while the bank holds at least 2×count lines (the seed bank has six
  // per daypart), instead of overlapping on two of three ideas.
  const start = ((Math.abs(Math.trunc(rotation) || 0) * count) % bank.length);
  return Array.from(
    { length: Math.min(count, bank.length) },
    (_, offset) => bank[(start + offset) % bank.length]
  );
}

/** The bound form every surface calls (review A-31: `ideasFrom` exists so the empty case is testable). */
export function ideasFor(daypart: Daypart, rotation: number, count = 3): GuideIdea[] {
  return ideasFrom(GUIDE_IDEAS, daypart, rotation, count);
}
```

- [x] **Step 4: Put the bank under the claims audit**

In `tests/unit/pal/claims-boundary-copy.test.ts`, `EXTRA_SOURCES`, after `"lib/pal/coach-outputs.ts",`:

```ts
  // PRD v1.1 §6 F-IDEAS: the idea bank is user-facing copy that lives in lib/.
  "lib/pal/guide-ideas.ts",
```

- [x] **Step 5: Run the tests; prune any line that fails the precheck**

Run: `npx vitest run tests/unit/pal/guide-ideas.test.ts tests/unit/pal/claims-boundary-copy.test.ts`
Expected: PASS. If a seed line trips a clarify or a flag, delete that line (do not weaken the test — the PRD says a failing idea is removed from the bank) and record the removal in the ledger row's Notes.

- [x] **Step 6: Commit**

```bash
git add lib/pal/guide-ideas.ts tests/unit/pal/guide-ideas.test.ts tests/unit/pal/claims-boundary-copy.test.ts
git commit -m "feat(guide): reviewed idea bank, precheck-clean and positive only (F-IDEAS)"
```

##### Task 1.3: Analytics events for the kill line

**Files:**
- Modify: `lib/client/analytics.ts`
- Modify: `tests/unit/client/analytics.test.ts`

**Interfaces:**
- Produces: events `ideas_shown` `{ daypart, surface }`, `idea_tapped` `{ daypart, slot, surface }`, `idea_check_completed` `{ risk }`. Together with the existing `check_completed` these give §9.1's ideas-viewed : checks-run ratio and idea → check taps from day one.

**Task card:** Copy: none. Flag: none. Analytics: the three events above — never the idea text (a closed bank, but the rule is the rule). Done check: `npx vitest run tests/unit/client/analytics.test.ts` green.

- [x] **Step 1: Extend the test allowlist (fails until the module follows)**

In `tests/unit/client/analytics.test.ts`:
1. Add `"ideas_shown", "idea_tapped", "idea_check_completed"` to `ALLOWED_NAMES` (before `"photo_draft"`).
2. Add the three `case` lines to `assertExhaustive`.
3. Add to `oneOfEach`, **before** the `photo_draft` entry:

```ts
      { name: "ideas_shown", props: { daypart: "dinner", surface: "home" } },
      { name: "idea_tapped", props: { daypart: "breakfast", slot: "2", surface: "home" } },
      { name: "idea_check_completed", props: { risk: "SAFE" } },
```

- [x] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/unit/client/analytics.test.ts`
Expected: FAIL — type errors / allowlist mismatch.

- [x] **Step 3: Add the events**

In `lib/client/analytics.ts`, add `import type { Daypart } from "../coach/insights";` and insert **before** the `photo_draft` variant of `AnalyticsEvent` (the no-bare-string test slices the union at that marker; comments must avoid the forbidden identifiers — write "idea" and "meal", never the words the no-PII scan bans):

```ts
  // PRD v1.1 §9.1 — the guide door's kill-line instruments. Bounded props
  // only: the daypart bucket the device already computes, the chip slot, the
  // risk class. Never the idea text, even though it is a closed bank.
  // `surface` = where the block rendered (review A-41): the PR-1 prototype
  // sits on Home AND on /check's first-run empty state, because session-one
  // guests land on /check. Kill line 2 counts either surface.
  | { name: "ideas_shown"; props: { daypart: Daypart; surface: "home" | "check" } }
  // `more` = a tap inside the expanded block (Task 4.4 "See all"), so the enum
  // stays closed however large the bank grows (review A-08).
  | { name: "idea_tapped"; props: { daypart: Daypart; slot: "1" | "2" | "3" | "more"; surface: "home" | "check" } }
  // The check that ran was the idea prefill (pal.recheck.source = "idea").
  | { name: "idea_check_completed"; props: { risk: PalRisk } }
```

and add `"ideas_shown", "idea_tapped", "idea_check_completed"` to `ALLOWED_EVENT_NAMES`.

- [x] **Step 4: Run the tests**

Run: `npx vitest run tests/unit/client/analytics.test.ts`
Expected: PASS, including the no-PII scan and the "no bare string" test.

- [x] **Step 5: Commit**

```bash
git add lib/client/analytics.ts tests/unit/client/analytics.test.ts
git commit -m "feat(analytics): ideas_shown / idea_tapped / idea_check_completed (PRD §9.1)"
```

##### Task 1.4: Rotation store + the chips component

**Files:**
- Create: `lib/client/ideas-rotation.ts`
- Create: `components/guide-ideas.tsx`
- Modify: `components/dashboard-view.tsx`
- Modify: `tests/unit/pal/guide-door.test.ts` (render-site pins)
- Modify: `app/globals.css` (`.ideas-block`, `.ideas-eyebrow`, `.ideas-sub`)

**Interfaces:**
- Consumes: `ideasFor`, `GuideIdea` (Task 1.2); `guideDoorEnabled` (Task 1.1); `daypartOfHour` from `lib/coach/insights.ts`; `useHydrated` from `lib/client/use-hydrated.ts`; `track` (Task 1.3).
- Produces: `nextIdeasRotation(): number`; `<GuideIdeas />`; the session keys `pal.recheck` (existing, read by `food-check-form.tsx`) and `pal.recheck.source = "idea"` (new, read in Task 1.6).

**Task card:** Copy: `guide-ideas-hero` row — "Ideas for breakfast · Ideas for lunch · Ideas for dinner · Meal ideas that sit within Prediabetes Pal's rules. Tap one to send it to the check." class `product-role`. Flag: `guideDoorEnabled("ideas")` gates the render. Analytics: `ideas_shown` once per mount, `idea_tapped` per tap. Done check: pins green; `NEXT_PUBLIC_GUIDE_DOOR=1 npm run dev` shows three chips above the hero on `/home` (signed-in and `/home?stay=1` guest), tapping lands on `/check` with the idea in the field.

- [x] **Step 1: Write the failing render-site pins** — add the two imports and the `read` helper at the **top** of `tests/unit/pal/guide-door.test.ts` (imports must precede other statements for the lint config), then append the describe block:

```ts
import fs from "node:fs";
import path from "node:path";

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");

describe("guide-door render sites (source pins, node env has no DOM)", () => {
  it("DashboardView renders the ideas block ABOVE the hero, gated by the flag", () => {
    const src = read("components/dashboard-view.tsx");
    expect(src).toMatch(/from\s+["'].*guide-door-flag["']/);
    expect(src.indexOf("<GuideIdeas")).toBeGreaterThan(-1);
    expect(src.indexOf("<GuideIdeas")).toBeLessThan(src.indexOf("<HomeCheckHero"));
  });

  it("the chips hand off through pal.recheck and mark the source — /check stays the one place a check runs", () => {
    const src = read("components/guide-ideas.tsx");
    expect(src).toContain('"pal.recheck"');
    expect(src).toContain('"pal.recheck.source"');
    expect(src).toContain('router.push("/check?stay=1")'); // A-102
    // The anchor phrase (PRD §7.3), never "your plan".
    expect(src).toMatch(/Prediabetes Pal(?:'|&apos;|’)s rules/);
    expect(src).not.toMatch(/your plan/i);
  });
});
```

- [x] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/unit/pal/guide-door.test.ts`
Expected: FAIL — `components/guide-ideas.tsx` does not exist.

- [x] **Step 3: The rotation counter**

```ts
// lib/client/ideas-rotation.ts
const STORAGE_KEY = "pal.ideas.rotation";

/**
 * Monotonic per-device counter that cycles the idea bank (PRD v1.1 §6
 * F-IDEAS: "no two consecutive loads show the same first idea"). Same shape
 * and reasoning as lib/client/coach-rotation.ts: deterministic, testable,
 * continuous. Storage failures return 0 (first three ideas) rather than
 * breaking the block.
 */
export function nextIdeasRotation(): number {
  if (typeof window === "undefined") {
    return 0;
  }
  try {
    const current = Number.parseInt(
      window.localStorage.getItem(STORAGE_KEY) ?? "0",
      10
    );
    const next = (Number.isFinite(current) ? current + 1 : 1) % 1_000_000;
    window.localStorage.setItem(STORAGE_KEY, String(next));
    return next;
  } catch {
    return 0;
  }
}
```

- [x] **Step 4: The chips component**

```tsx
// components/guide-ideas.tsx
"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { track } from "../lib/client/analytics";
import { nextIdeasRotation } from "../lib/client/ideas-rotation";
import { useHydrated } from "../lib/client/use-hydrated";
import { daypartOfHour, type Daypart } from "../lib/coach/insights";
import { ideasFor, type GuideIdea } from "../lib/pal/guide-ideas";
import { IconArrowRight } from "./icons";

/**
 * The ideas block — the guide door's hero slot (PRD v1.1 §7.6). Three quiet
 * rows for the current daypart (review A-54: rows, not chips — the labels are
 * meals, not 1–3 word tags), above the check hero, which stays the one
 * accent-filled action (DESIGN.md §8 as amended in this PR).
 *
 * A hand-off, not a second check surface: a tap writes the idea into the
 * existing `pal.recheck` session prefill that /check already reads, marks the
 * source so the check form can count idea → check completions, and navigates.
 * Rendered after hydration only — the rotation counter and the daypart are
 * device state, and DashboardView is server-rendered for signed-in users.
 * Three skeleton rows hold the block's height until then, so the CTA below
 * does not jump.
 */
const DAYPART_HEADING: Record<Daypart, string> = {
  breakfast: "Ideas for breakfast",
  lunch: "Ideas for lunch",
  dinner: "Ideas for dinner"
};

export function GuideIdeas() {
  const router = useRouter();
  const hydrated = useHydrated();
  const [view, setView] = useState<{ daypart: Daypart; ideas: GuideIdea[] } | null>(null);

  // Review A-108: StrictMode runs mount effects twice in dev, which moved the
  // counter by two per mount and (with six lines, three per page) showed the
  // same page every load — defeating the manual check. Guard with a ref so the
  // counter and ideas_shown advance once per mount.
  const shownRef = useRef(false);
  useEffect(() => {
    if (!hydrated || shownRef.current) return;
    shownRef.current = true;
    const daypart = daypartOfHour(new Date().getHours());
    setView({ daypart, ideas: ideasFor(daypart, nextIdeasRotation()) });
    track({ name: "ideas_shown", props: { daypart, surface: "home" } });
  }, [hydrated]);

  // Review A-25: a double-tap must not push /check twice (duplicate history
  // entry, Back lands on /check). First tap wins; the ref never resets because
  // the component unmounts on navigation.
  const navigatingRef = useRef(false);

  function pick(idea: GuideIdea, slot: "1" | "2" | "3" | "more", daypart: Daypart) {
    if (navigatingRef.current) return;
    navigatingRef.current = true;
    try {
      window.sessionStorage.setItem("pal.recheck", idea.text);
      window.sessionStorage.setItem("pal.recheck.source", "idea");
    } catch {
      // best-effort prefill — /check works without it
    }
    track({ name: "idea_tapped", props: { daypart, slot, surface: "home" } });
    // Review A-102: /check renders <FirstRunGate/>; a fresh guest (Task 1.8's
    // exact setup) would be bounced to /onboarding and the keys would outlive
    // the redirect. ?stay=1 is the gate's escape hatch.
    router.push("/check?stay=1");
  }

  return (
    <section className="ideas-block" aria-labelledby="ideas-title" data-testid="ideas-block">
      <h2 className="ideas-title" id="ideas-title">
        {view ? DAYPART_HEADING[view.daypart] : "Ideas for today"}
      </h2>
      <p className="ideas-sub">
        Meal ideas that sit within Prediabetes Pal&apos;s rules. Tap one to send it to the check.
      </p>
      <ul className="ideas-list" role="list" aria-label="Meal ideas">
        {view
          ? view.ideas.map((idea, index) => (
              <li key={idea.id}>
                <button
                  type="button"
                  className="idea-row"
                  data-testid={`idea-row-${index + 1}`}
                  onClick={() =>
                    pick(idea, index < 3 ? (String(index + 1) as "1" | "2" | "3") : "more", view.daypart)
                  }
                >
                  <span>{idea.text}</span>
                  <IconArrowRight size={16} />
                </button>
              </li>
            ))
          : // Review A-54: the pre-hydration placeholder is three rows of the
            // real row height, so the block does not change size on hydration.
            [1, 2, 3].map((n) => (
              <li key={n} className="idea-row idea-row--skeleton" aria-hidden="true" />
            ))}
      </ul>
    </section>
  );
}
```

CSS (`app/globals.css`, next to `.meal-hero`; light surface, nested-card radius from the scale, no shadow so the hero stays the one card):

```css
/* Review A-54: ideas are ROWS, not chips. DESIGN.md §10's selectable chip is a
   1–3 word label; idea lines run 25–60 characters and a pill holds ~38 at 375
   (content column 347px − block padding 32 − chip padding 36), so 12 of the 18
   seed lines would wrap inside the pill. A full-width row reads as a list of
   meals, wraps to a second line cleanly, and its height is known before
   hydration because the placeholder is three skeleton rows of the same size. */
.ideas-block {
  /* Review A-71 (default): a bordered --surface at the outer radius, no shadow —
     DESIGN.md §11: --surface-muted on --page-bg "stops reading as an object".
     The hero keeps the system's one shadow and stays the accent. */
  background: var(--surface);
  border: 1px solid var(--border-soft);
  border-radius: 24px;
  padding: 16px;
  margin-bottom: 12px;
}
.ideas-title {
  /* Review A-106: the page's first heading (22px/700 — recorded in DESIGN.md §4
     as the app "section title" in the same PR); the date and the day collapse
     into one .status-eyebrow line above it when the flag is on, which is what
     keeps the check CTA above the tab bar at 360×667 with two-line rows. */
  margin: 0 0 2px;
  font-size: 22px;
  font-weight: 700;
  line-height: 1.2;
  color: var(--text-strong);
}
.ideas-sub {
  margin: 0 0 10px;
  font-size: 15px;
  color: var(--text-body);
}
.ideas-list {
  list-style: none; /* §12: carries role="list" in the markup */
  margin: 0;
  padding: 0;
  display: grid;
  gap: 8px;
}
.idea-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  min-height: 44px;
  padding: 10px 14px;
  border: 1px solid var(--border-strong);
  border-radius: 14px;
  background: var(--surface);
  color: var(--text-body);
  font-size: 16px;
  line-height: 1.35;
  text-align: left;
  cursor: pointer;
  transition: border-color var(--dur-fast) var(--ease), background var(--dur-fast) var(--ease);
}
.idea-row:hover { border-color: var(--accent); }
.idea-row:active { transform: translateY(1px); }
.idea-row--skeleton {
  border-color: transparent;
  background: var(--border-soft);
  animation: pal-skeleton 1.4s ease-in-out infinite; /* §6: the sanctioned loading shimmer */
}
```

- [x] **Step 5: Mount it above the hero**

In `components/dashboard-view.tsx`: import `guideDoorEnabled` and `GuideIdeas`; replace `<HomeCheckHero />` with

```tsx
      {/* PRD v1.1 §7.4/§7.6: ideas lead, the check hero drops to second and
          stays the one accent-filled action. Flag off ⇒ unchanged Home. */}
      {guideDoorEnabled("ideas") ? <GuideIdeas /> : null}

      <HomeCheckHero />
```

`GuestDashboard` renders the same tree, so guests get the block for free (PRD §7.4 requires it).

- [x] **Step 6: Run the pins + the claims audit**

Run: `npx vitest run tests/unit/pal/guide-door.test.ts tests/unit/pal/claims-boundary-copy.test.ts`
Expected: PASS (the new component is globbed into the audit automatically).

- [x] **Step 7: Commit**

```bash
git add lib/client/ideas-rotation.ts components/guide-ideas.tsx components/dashboard-view.tsx app/globals.css tests/unit/pal/guide-door.test.ts
git commit -m "feat(guide): ideas chips above the Home hero, pal.recheck hand-off (F-IDEAS prototype)"
```

##### Task 1.5: The source lead-in on the result card (F-SOURCE)

**Files:**
- Modify: `components/result-card.tsx`
- Modify: `tests/unit/pal/guide-door.test.ts`

**Interfaces:**
- Produces: `SOURCE_LEAD: Record<PalRisk, string>` exported from `result-card.tsx` (the three sentences), rendered above `response.reason` when the flag is on.

**Task card:** Copy: `result-source-lead` row, class `result-qualitative-impact` — three variants: "Why this label: under Prediabetes Pal's rules this description reads as generally balanced." · "…reads as leaning toward a concentrated or less-balanced pattern." · "…reads as unusually concentrated or too incomplete to read closely." (the three Verdict Semantics meanings in `claims-boundary.md`; the HIGH variant names both prongs because the engine does not say which fired — Open questions). It cites the product's own rules and nothing else; no "doctors agree", no external authority, no numeric claim. Flag: `guideDoorEnabled("source")`. Analytics: none. Done check: pins green; with the flag on, a `/check` result shows the lead-in above the reason and the `/demo` fixtures page shows it too (it renders the real component — acceptable; the landing uses `ExampleResultCard`, which is untouched, so D6's "stale landing" holds).

- [x] **Step 1: Write the failing pins** — the `SOURCE_LEAD` import goes at the top of `tests/unit/pal/guide-door.test.ts`; append the describe block:

```ts
import { SOURCE_LEAD } from "../../../components/result-card";

describe("F-SOURCE lead-in (PRD v1.1 §6 F-SOURCE)", () => {
  it("has one sentence per label, each citing the product's own rules and no authority", () => {
    for (const risk of ["SAFE", "MODERATE", "HIGH"] as const) {
      const line = SOURCE_LEAD[risk];
      expect(line).toMatch(/^Why this label: under Prediabetes Pal's rules this description reads as /);
      expect(line).not.toMatch(/doctor|science|clinic|study|research/i);
      expect(line).not.toMatch(/\d/); // no numeric claim
      expect(line).not.toMatch(/same read every time|never changes/i); // the held /how-it-works claim
    }
  });

  it("result-card renders the lead-in from the map, flag-gated, above the reason", () => {
    const src = read("components/result-card.tsx");
    expect(src).toMatch(/from\s+["'].*guide-door-flag["']/);
    expect(src).toContain("SOURCE_LEAD[response.risk]");
    expect(src.indexOf("SOURCE_LEAD[response.risk]")).toBeLessThan(src.indexOf("{response.reason}"));
  });
});
```

- [x] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/unit/pal/guide-door.test.ts`
Expected: FAIL — `SOURCE_LEAD` is not exported.

- [x] **Step 3: Implement**

In `components/result-card.tsx`, import `guideDoorEnabled` and add near `RISK_ICONS`:

```ts
// PRD v1.1 §6 F-SOURCE: the lead-in that names the source. Three brackets =
// the three label meanings in docs/safety/claims-boundary.md (Verdict
// Semantics), so `Hold off` on a materially incomplete description is
// covered. Cites Prediabetes Pal's own documented rules and nothing else —
// never an external authority, never a number. Ledger row `result-source-lead`.
// The engine reason follows verbatim as its own sentence.
export const SOURCE_LEAD: Record<PalRisk, string> = {
  SAFE: "Why this label: under Prediabetes Pal's rules this description reads as generally balanced.",
  MODERATE:
    "Why this label: under Prediabetes Pal's rules this description reads as leaning toward a concentrated or less-balanced pattern.",
  HIGH: "Why this label: under Prediabetes Pal's rules this description reads as unusually concentrated or too incomplete to read closely."
};
```

and replace the Why row's paragraph:

```tsx
        <div className="anatomy-row">
          <span className="anatomy-label">Why</span>
          <p className="anatomy-copy">
            {guideDoorEnabled("source") ? (
              <span className="result-source-lead" data-testid="result-source-lead">
                {SOURCE_LEAD[response.risk]}{" "}
              </span>
            ) : null}
            {response.reason}
          </p>
        </div>
```

- [x] **Step 4: Run the pins, the copy pins and the audit**

Run: `npx vitest run tests/unit/pal/guide-door.test.ts tests/unit/pal/copy-pins.test.ts tests/unit/pal/claims-boundary-copy.test.ts tests/unit/pal/result-card-upsell.test.ts`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add components/result-card.tsx tests/unit/pal/guide-door.test.ts
git commit -m "feat(guide): source lead-in on the result card (F-SOURCE)"
```

##### Task 1.6: Count the check that came from an idea

**Files:**
- Modify: `components/food-check-form.tsx`
- Modify: `tests/unit/pal/guide-door.test.ts`

**Stale source (review A-102):** every other writer of `pal.recheck` — the Home hero, `/meals`' re-check, meal recall — also removes `pal.recheck.source`, so a hand-off that never reached the form cannot make a later typed check count as an idea. **Task card:** Copy: `check-from-idea` row — the field hint "From today's ideas." while the prefill is untouched (review A-77: the tap fills the field, it does not run the check, and the surface should say where the text came from), `product-role`, batch 1. Flag: none needed (the key is only ever written when the flag is on). Analytics: `idea_check_completed { risk }`. Done check: pin green; tapping an idea then completing the check emits `idea_check_completed` (verify in the Umami debug view or by stubbing `window.umami.track` in the console).

- [x] **Step 1: Failing pin** (append)

```ts
  it("the check form reads pal.recheck.source alongside pal.recheck and emits idea_check_completed once", () => {
    const src = read("components/food-check-form.tsx");
    expect(src).toContain('"pal.recheck.source"');
    expect(src.match(/name: "idea_check_completed"/g)).toHaveLength(1);
  });
```

- [x] **Step 2: Run to verify it fails** — `npx vitest run tests/unit/pal/guide-door.test.ts` → FAIL.

- [x] **Step 3: Implement.** In the prefill effect (where `pal.recheck` is read and removed), also read and remove `pal.recheck.source` into the same ref:

```ts
      let recheck: string | null = null;
      let recheckSource: string | null = null;
      try {
        recheck = window.sessionStorage.getItem("pal.recheck");
        recheckSource = window.sessionStorage.getItem("pal.recheck.source");
        if (recheck) {
          window.sessionStorage.removeItem("pal.recheck");
        }
        window.sessionStorage.removeItem("pal.recheck.source");
      } catch {
        // best-effort prefill only
      }
      initialPrefillRef.current = { profile, recheck, recheckSource };
```

(extend the ref's type with `recheckSource: string | null`). Add the pure rule, exported for its test (review A-32):

```ts
// components/food-check-form.tsx — exported, pure
export function shouldCountIdeaCheck(
  prefill: { recheck: string | null; recheckSource: string | null } | null,
  submittedFood: string
): boolean {
  return prefill?.recheckSource === "idea" && prefill.recheck !== null && submittedFood === prefill.recheck;
}
```

and in `tests/unit/client/food-check-form.test.ts` (the file already imports pure helpers from the form with a fake storage bootstrap): untouched prefill → true; edited text → false; source `null` → false; source `"idea"` with `recheck` null → false. In the `response.kind === "result"` branch, right after the existing `track({ name: "check_completed", … })`:

```ts
        // PRD v1.1 §9.1: idea → check completions. Only when THIS submission
        // is still the untouched idea prefill; a user who edits the text is
        // a typed check. The rule is a pure function (review A-32) so the
        // counting logic has a real test, not only a source pin.
        if (shouldCountIdeaCheck(initialPrefillRef.current, result.data.food)) {
          initialPrefillRef.current = { ...initialPrefillRef.current!, recheckSource: null };
          track({ name: "idea_check_completed", props: { risk: response.risk } });
        }
```

- [x] **Step 4: Run** `npx vitest run tests/unit/pal/guide-door.test.ts tests/unit/client/food-check-form.test.ts` → PASS.

- [x] **Step 5: Commit**

```bash
git add components/food-check-form.tsx tests/unit/pal/guide-door.test.ts
git commit -m "feat(guide): count idea → check completions (PRD §9.1)"
```

##### Task 1.7: Ledger batch 1 + the DESIGN.md §8 amendment

**Files:**
- Modify: `docs/safety/copy-ledger.md`
- Modify: `DESIGN.md` §8

**Task card:** Copy: the rows below. Done check: `npm run contract` passes; `npx vitest run tests/unit/pal/boundary-copy-drift.test.ts tests/unit/pal/claims-boundary-copy.test.ts` green (the parser must still find every existing approved row).

- [x] **Step 1: Add the rows** (one line each in the Ledger table; keep the `|` count exact; copy the bank lines from `GUIDE_IDEA_BANK` joined with ` · `):

```
| `guide-ideas-breakfast` | Home | Pending | Yes | `result-qualitative-impact` | greek yogurt with berries and walnuts · veggie omelet with peppers and spinach · cottage cheese with sliced peach and almonds · scrambled eggs with mushrooms and cheese · hard-boiled eggs with cucumber and tomato · tofu scramble with peppers and onions | CDC-MEAL-PLANNING, CDC-HEALTHY-CARBS | PRD v1.1 §6 F-IDEAS, §9 Step 1 prototype. The reviewed breakfast bank (`lib/pal/guide-ideas.ts`), promoted from the public guides with every refined-starch side dropped so each line reads Clear at every band. Positive only — never a food to limit. The surface says "within Prediabetes Pal's rules", never that an idea is safe for the user, never a reading, never "your plan". Deterministic gate: tests/unit/pal/guide-ideas.test.ts; model gate: the live labelling eval (PR-4), keyed on PROMPT_VERSION. Ships behind `NEXT_PUBLIC_GUIDE_DOOR`; production flip needs Approved. No diagnosis, treatment, reversal, future-A1C prediction, or exact glycemic numbers. |
| `guide-ideas-lunch` | Home | Pending | Yes | `result-qualitative-impact` | lentil soup with a side salad · tuna and white-bean salad · big salad with hard-boiled eggs, chickpeas, and vinaigrette · chicken salad with olive oil dressing · hummus with carrot and cucumber sticks and a hard-boiled egg · grilled chicken and avocado salad | CDC-MEAL-PLANNING, CDC-HEALTHY-CARBS | Same rules and gates as `guide-ideas-breakfast`. |
| `guide-ideas-dinner` | Home | Pending | Yes | `result-qualitative-impact` | baked salmon with roasted broccoli · chicken stir-fry heavy on vegetables · turkey chili with plenty of beans, topped with cheese · sheet-pan chicken thighs with peppers and onions · pork tenderloin with green beans and roasted cauliflower · shrimp with zucchini noodles | CDC-MEAL-PLANNING, CDC-HEALTHY-CARBS | Same rules and gates as `guide-ideas-breakfast`. |
| `guide-ideas-hero` | Home | Pending | Yes | `product-role` | Ideas for breakfast · Ideas for lunch · Ideas for dinner · Ideas for today · Meal ideas that sit within Prediabetes Pal's rules. Tap one to send it to the check. | FDA-GENERAL-WELLNESS, FTC-HEALTH-COMPLIANCE | PRD v1.1 §7.6 hero slot (`components/guide-ideas.tsx`). Anchor phrase per §7.3. Capability framing only — the tap runs the ordinary check on /check; nothing here promises a result. No diagnosis, treatment, reversal, future-A1C prediction, or exact glycemic numbers. |
| `result-source-lead` | Result | Pending | Yes | `result-qualitative-impact` | Why this label: under Prediabetes Pal's rules this description reads as generally balanced. · Why this label: under Prediabetes Pal's rules this description reads as leaning toward a concentrated or less-balanced pattern. · Why this label: under Prediabetes Pal's rules this description reads as unusually concentrated or too incomplete to read closely. | CDC-MEAL-PLANNING, FTC-HEALTH-COMPLIANCE | PRD v1.1 §6 F-SOURCE lead-in (`components/result-card.tsx` `SOURCE_LEAD`), one variant per label, mirroring the Verdict Semantics meanings in claims-boundary.md. Cites the product's own documented rules and nothing else — no "doctors agree", no "the science says", no number. Deliberately does NOT say the read never changes: that claim waits for the consistency eval on the panel (`how-it-works-same-read`, not yet filed). The engine reason renders verbatim after it. No diagnosis, treatment, reversal, future-A1C prediction, or exact glycemic numbers. |
```

- [x] **Step 2: Amend `DESIGN.md` §8** — replace the third bullet's first sentence:

```
- **The check CTA is the one Committed colour moment.** ⚖️ 2026-09 (guide redesign, PRD v1.1 §7.4): at <768px the **ideas block** renders above it as a quiet bordered `--surface` list (no accent, no shadow; review A-71), so the check is no longer the *first* interactive element — it is still the one accent-filled action and it still sits above the fold at 375×667 (`tests/smoke/dashboard.spec.ts` pins the CTA's bottom edge above the tab bar at 360/375/430 and three clocks; the ideas list is measured, not reserved — §3's fold budget). Flag off (`NEXT_PUBLIC_GUIDE_DOOR` unset) restores the previous ordering byte-for-byte. **Day-0 empty state is the default design, not a fallback:** one CTA plus the Today card's warmth, no fake data, no guilt copy.
```

- [x] **Step 2b (review A-115):** `scripts/validate-safety-contract.mjs`'s cell-count error prints the Copy ID and the offending line ("row `guide-ideas-lunch` has 9 cells; a `|` inside the Copy cell? use ` · `"), and `tests/unit/client/analytics.test.ts`'s no-bare-string assertion message adds "insert new union members before the `photo_draft` variant" — the two failures an implementer meets first, both now naming the fix.
- [x] **Step 3: Run** `npm run contract && npx vitest run tests/unit/pal/boundary-copy-drift.test.ts tests/unit/pal/claims-boundary-copy.test.ts tests/unit/pal/landing-design-guards.test.ts` → PASS.

- [x] **Step 4: Commit**

```bash
git add docs/safety/copy-ledger.md DESIGN.md
git commit -m "docs(guide): ledger batch 1 (idea bank, hero line, source lead-in); DESIGN.md §8 ordering amendment"
```

##### Task 1.8: Smoke — the door on, CTA still above the fold

**Files:**
- Modify: `tests/smoke/dashboard.spec.ts`

**Task card:** Copy: none. Flag: the e2e build must carry `NEXT_PUBLIC_GUIDE_DOOR=1` (`scripts/e2e-runtime-env.ts` spreads the caller's env, so the shell value reaches the build). Done check: **both** runs green — `npm run e2e -- tests/smoke/dashboard.spec.ts` (flag unset; door specs skip) and `NEXT_PUBLIC_GUIDE_DOOR=1 npm run e2e -- tests/smoke/dashboard.spec.ts tests/smoke/onboarding.spec.ts tests/smoke/mobile-check.spec.ts`. This is PR-1's real done check.

- [x] **Step 1: Add the door spec** (append to `tests/smoke/dashboard.spec.ts`)

```ts
test.describe("guide door (PRD v1.1 §7.6) — only in a build with NEXT_PUBLIC_GUIDE_DOOR=1", () => {
  test.skip(process.env.NEXT_PUBLIC_GUIDE_DOOR !== "1", "door flag off in this build");

  test("ideas lead, the check CTA follows and stays above the fold; a tap prefills /check", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    // Review A-72: the daypart comes from the device clock, so the block's height
    // differs by daypart (breakfast lines are the longest). Pin the clock; the
    // second test below repeats this at 08:00, 13:00 and 19:00 and at 360/430.
    await page.clock.install({ time: new Date("2026-09-14T19:00:00") });
    await page.goto("/home?stay=1");

    const block = page.getByTestId("ideas-block");
    await expect(block).toBeVisible();
    const chip = page.getByTestId("idea-row-1");
    await expect(chip).toBeVisible();

    const cta = page.getByTestId("dash-check-cta");
    const chipBox = await chip.boundingBox();
    const ctaBox = await cta.boundingBox();
    expect(chipBox!.y).toBeLessThan(ctaBox!.y); // order: ideas above the check
    // Review A-72: the fold is the tab bar's top edge, not 667 — a CTA behind the
    // fixed bar would otherwise pass. The clock is stubbed per daypart below.
    const barBox = await page.locator(".app-tabbar").boundingBox();
    expect(ctaBox!.y + ctaBox!.height).toBeLessThanOrEqual(barBox!.y); // DESIGN.md §8 still holds

    // RV-3 on Home: no percentages, no band words.
    const text = await page.locator("main").innerText();
    expect(text).not.toMatch(/%/);
    expect(text).toMatch(/Prediabetes Pal's rules/);

    const ideaText = (await chip.innerText()).trim();
    await chip.click();
    await expect(page).toHaveURL(/\/check\?stay=1$/); // A-102
    await expect(page.getByLabel(/eating/i)).toHaveValue(ideaText);
  });
});
```

- [x] **Step 2: Run both configurations** (commands above). Expected: PASS. If the CTA's bottom edge exceeds 667 with the flag on, the shrink order is in §3's fold budget (review A-54) — never the assertion. Add a second test in the same describe that repeats the fold measurement for every (width ∈ {360, 375, 430}) × (clock ∈ {08:00, 13:00, 19:00}) pair against the tab bar's top edge (review A-72) — the rows wrap differently at each width and the three dayparts have different line lengths.

- [x] **Step 3: Commit**

```bash
git add tests/smoke/dashboard.spec.ts
git commit -m "test(smoke): guide door — ideas lead, CTA above the fold, tap prefills /check"
```

##### Task 1.9: Tour-screen funnel event (the F-ASK floor's instrument, and its baseline)

**Files:**
- Modify: `lib/client/analytics.ts`
- Modify: `tests/unit/client/analytics.test.ts`
- Modify: `app/(app)/onboarding/page.tsx`
- Modify: `tests/unit/client/onboarding-flow.test.ts`

**Interfaces:**
- Consumes: `track` (existing); the page's `Step` type and `step` state.
- Produces: event `onboarding_step` `{ step }`; `trackedStep(step: Step): TrackedStep | null` exported from the page. Task 6.1 widens the set with the two F-ASK screens.

**Why here, not PR-6.** PRD §7.5 (owner ruling amended 2026-09-14): the floor is read from a per-screen funnel, and the event ships before the two screens exist so the six-screen tour is the baseline. Not behind the flag — it carries no door surface, only which screen a start reached.

**Task card:** Copy: none. Flag: none. Analytics: `onboarding_step` with a closed enum of screen ids — **never** the A1C screen or the out-of-range exit (reaching them says something about a person's result; §9.1 promises nothing measures it). The module comment must not use the identifiers the no-PII scan bans. Done check: both test files green; a mid-tour refresh re-fires nothing until the next screen change (a refresh lands on `welcome`, which is not tracked).

- [x] **Step 1: Extend the analytics test (fails until the module follows)**

In `tests/unit/client/analytics.test.ts`: add `"onboarding_step"` to `ALLOWED_NAMES` before `"photo_draft"`; add its `case` line to `assertExhaustive`; add to `oneOfEach`, **before** the `photo_draft` entry:

```ts
      { name: "onboarding_step", props: { step: "attribution" } },
```

- [x] **Step 2: Write the failing guard test**

Append to `tests/unit/client/onboarding-flow.test.ts` (add `trackedStep` to the existing import from the page):

```ts
describe("trackedStep — the tour funnel never names a result", () => {
  it("maps the screens the floor reads and nothing else", () => {
    expect(trackedStep("welcome")).toBeNull();
    expect(trackedStep("segment")).toBe("segment");
    expect(trackedStep("attribution")).toBe("attribution");
    expect(trackedStep("expectations")).toBe("expectations");
    expect(trackedStep("a1c")).toBeNull();
    expect(trackedStep("boundary")).toBeNull();
  });
});
```

- [x] **Step 3: Run both to verify they fail**

Run: `npx vitest run tests/unit/client/analytics.test.ts tests/unit/client/onboarding-flow.test.ts`
Expected: FAIL — allowlist mismatch; `trackedStep` is not exported.

- [x] **Step 4: Add the event and the guard**

In `lib/client/analytics.ts`, insert **before** the `photo_draft` variant (the no-bare-string test slices the union at that marker):

```ts
  // PRD v1.1 §7.5 (amended 2026-09-14) — tour funnel. Which screen a tour
  // start reached, as a closed enum of screen ids. The number screen and the
  // out-of-range exit are deliberately absent: reaching them says something
  // about a person's result, and §9.1 promises nothing here measures it.
  // "ask_pains" / "ask_win" arrive with the F-ASK screens (PR-6).
  | { name: "onboarding_step"; props: { step: "segment" | "ask_pains" | "ask_win" | "attribution" | "expectations" } }
```

and add `"onboarding_step"` to `ALLOWED_EVENT_NAMES`. In `app/(app)/onboarding/page.tsx`, next to `STEP_PROGRESS`:

```ts
// The tour funnel (PRD §7.5). Only these screens are reported; the number
// screen and the exit never are. Task 6.1 adds the two F-ASK screens.
export type TrackedStep = Extract<Step, "segment" | "attribution" | "expectations">;
const TRACKED_STEPS: ReadonlySet<Step> = new Set<Step>(["segment", "attribution", "expectations"]);
export function trackedStep(step: Step): TrackedStep | null {
  return TRACKED_STEPS.has(step) ? (step as TrackedStep) : null;
}
```

and inside the component, after the existing mount effect:

```ts
  // Fires on each screen change, never on mount — a refresh lands on
  // "welcome", which is not tracked, so it re-fires nothing.
  useEffect(() => {
    const tracked = trackedStep(step);
    if (tracked) track({ name: "onboarding_step", props: { step: tracked } });
  }, [step]);
```

- [x] **Step 5: Run the tests**

Run: `npx vitest run tests/unit/client/analytics.test.ts tests/unit/client/onboarding-flow.test.ts`
Expected: PASS, including the no-PII scan and the "no bare string" test.

- [x] **Step 6: Commit**

```bash
git add lib/client/analytics.ts tests/unit/client/analytics.test.ts "app/(app)/onboarding/page.tsx" tests/unit/client/onboarding-flow.test.ts
git commit -m "feat(analytics): onboarding_step tour funnel (PRD §7.5 floor, ruling amended 2026-09-14)"
```

**PR-1 done check (whole PR):** `npm run lint && npm run typecheck && npm run test:pal && npm run contract && npm test` green; both smoke runs green; `docs/safety/copy-ledger.md` has the five batch-1 rows; the PR description lists them for the safety owner.

---

##### Tasks 1.10–1.14 — work the review added to PR-1 (A-116: each amendment above is a task card, so per-task dispatch cannot drop it)

- **Task 1.10 · Health key + tests** (A-11, A-67, A-96). Files: `app/api/health/route.ts`, `tests/unit/server/health.test.ts`, `tests/unit/pal/env.test.ts`. `guideDoor` built from `GUIDE_SURFACES`, `"on"|"off"` per surface, a separate key beside `flagTwins`. Done: both tests green. Commit: `feat(health): guideDoor surface states`.
- **Task 1.11 · The production door guard** (A-63, A-94, A-100, A-101, A-119). Files: `lib/guide-door-guard.ts` (pure `checkProductionDoor(value, ledgerText, labels, promptVersion, modelId)` → `{ effective: string; errors: string[]; warnings: string[] }`), `lib/guide-door-flag.ts` (`SURFACE_ROWS`, `SURFACE_REQUIRES`), `next.config.ts` (production block: throw on errors, warn + drop `ideas`/`ideas-full` on stale labels, inline the effective value via `env`), `scripts/check-production-config.ts` (report the same), `tests/unit/pal/flag-server-twins.test.ts`. Messages, each with its fix: `NEXT_PUBLIC_GUIDE_DOOR is "1" in production — list the surfaces whose rows are Approved instead` · `unknown surface "<x>" — one of: …` · `surface "home" requires "ideas", "ideas-full" — add them or remove "home"` · `surface "ideas" renders row "guide-ideas-hero" whose Status is Pending — get it Approved or remove "ideas"` · warning `idea labels are stale (prompt 2026-08-16.1 ≠ …, or model …) — "ideas" and "ideas-full" dropped from this build; run npm run eval:pal:ideas`. Done: test green with a case per message. Commit: `feat(flag): production door guard (rows, requirements, never 1, stale labels close ideas)`.
- **Task 1.12 · CI and e2e env** (A-99, A-118). Files: `scripts/e2e-runtime-env.ts` (blank `NEXT_PUBLIC_GUIDE_DOOR` unless `PAL_E2E_GUIDE_DOOR` is set, which passes through verbatim), `.github/workflows/ci.yml` (two more e2e jobs: `PAL_E2E_GUIDE_DOOR=1` and `PAL_E2E_GUIDE_DOOR=ideas,source`), `tests/smoke/global-setup.ts` (in a flag-on job, fetch `/api/health` and **fail** if `guideDoor.ideas !== "on"` — a flag-on run may never pass by skipping), every door `describe` (skip guard reads the health probe once, cached, never `=== "1"`). Local gates build both paywall modes for `trial-wall.spec`; that is the price of testing the wall — run the flag-on matrix in CI and locally only the spec you touched. Done: three CI e2e jobs green. Commit: `ci(e2e): flag-on jobs, health-probed skip guards`.
- **Task 1.13 · The four reads** (A-34, A-65, A-95, A-107 trigger). File: `docs/ops/launch-controls.md` §13. Done: `npm run contract` unaffected; the section lists each Umami view. Commit: `docs(ops): launch-controls §13 — the guide door's reads`.
- **Task 1.14 · Task 4.2 in PR-1** (A-42, A-69, A-75, A-77). The steps are Task 4.2's; run them here, after Task 1.6, with the rows `check-empty-ideas`, `check-from-idea` and `check-classics-hint-guide` (A-119) filed in Task 1.7. Done: `mobile-check.spec` flag-on green.

The A-04 amendment's test imports `GUIDE_SURFACES` alongside `guideDoorEnabled` (A-116).

#### PR-2 — F-CALM: the calm-tone audit

An audit, not a build (PRD §6 F-CALM). Output: one report plus the fixes it finds.

##### Task 2.1: The `product-agent-verb` banned family

**Files:**
- Modify: `tests/unit/pal/claims-boundary-copy.test.ts`

**Task card:** Copy: any hit is fixed in the copy, never by exempting the family. Done check: `npx vitest run tests/unit/pal/claims-boundary-copy.test.ts` green with the new family and its `KNOWN_BAD` controls.

- [x] **Step 1: Add the family** to `BANNED` (after `future-test-outcome`):

```ts
  {
    // PRD v1.1 §8.5: the banned verbs with the PRODUCT as subject — control,
    // lower, manage (prevent / reverse / treat / cure / diagnose are already
    // families above). Subject-bound so approved qualitative language
    // ("lower impact", "a lower-impact option") never trips it.
    label: "product-agent-verb",
    pattern:
      /\b(?:Prediabetes Pal|we|it)\s+(?:will\s+|can\s+|helps?\s+(?:you\s+)?)?(?:control|lower|manage)s?\b/i
  }
```

and its controls to `KNOWN_BAD`:

```ts
    "product-agent-verb": [
      "Prediabetes Pal helps you lower your A1C",
      "it manages your blood sugar",
      "we can control the spikes"
    ]
```

- [x] **Step 2: Pre-check, then run.** First turn any surprise into a known hit:

```bash
grep -rniE "\b(it|we)\s+(will\s+|can\s+)?(lower|manage|control)" lib/pal/coach-outputs.ts lib/pal/fallback.ts app components
```

  then `npx vitest run tests/unit/pal/claims-boundary-copy.test.ts`. Expected: the controls pass; any surface that trips the family is a real finding — rewrite that copy (ledger amendment if the string is a row) and re-run. Never exempt the family.

- [x] **Step 3: Commit**

```bash
git add tests/unit/pal/claims-boundary-copy.test.ts
git commit -m "test(claims): product-agent-verb family (control/lower/manage with the product as subject)"
```

##### Task 2.2: The audit walk and report

**Files:**
- Create: `docs/audit/2026-09-XX-calm-tone-audit.md` (date of the walk)

**Task card:** Copy: fixes are ledger amendments. Done check: the report exists with every surface listed, each row marked pass / fixed (commit sha) / owner question.

- [x] **Step 1: Walk every surface** — for each file under `app/(app)/**/page.tsx`, `app/page.tsx`, `app/guides/**`, `components/*.tsx`, `lib/pal/coach-outputs.ts`, `lib/pal/fallback.ts`, `lib/client/ui-state.ts`, `app/api/check/route.ts`, `proxy.ts` copy constants — record in a table: surface · alarm colour (any `--danger` / `--high-*` use outside the Signal row and the verdict border) · imperative warnings ("never", "must", "stop", "!" near a verdict) · §8.5 verbs with the product as subject · fear framing ("dangerous", "disaster", "terrible" — the tone policy's banned phrase bank).
- [x] **Step 2: Grep assist** (record hits, then judge each by hand):

```bash
grep -rnE "\b(dangerous|disaster|terrible|warning|alarm|urgent|panic)\b" app components lib/pal/coach-outputs.ts lib/pal/fallback.ts lib/client/ui-state.ts | grep -v "^\s*//"
grep -rn "var(--danger)\|--high-" app/globals.css | head -40
```

- [x] **Step 3: Write the report** with three sections: findings fixed in this PR, findings that are owner/safety-owner questions, and the two PRD-mandated checks below (Tasks 2.3, 2.4).
- [x] **Step 4: Commit** `git add docs/audit/ && git commit -m "docs(audit): calm-tone audit walk (F-CALM)"`.

##### Task 2.3: `Hold off` never renders in a colour that reads as danger

**Files:**
- Modify: `app/globals.css` (`--high-*` tokens) · `DESIGN.md` §3 token table

**Finding, stated now so it is not discovered mid-task:** `--high-border` is `#b91c1c`, byte-identical to `--danger`; `--high-text` is `#991b1b`. The verdict icon (`IconPause`) is calm; the colour is not. PRD F-CALM (a) requires a change. **Proposed, pending the safety owner's colour-blind + "does this look like a warning" review (Open questions; protocol per review A-61: Chrome DevTools "Emulate vision deficiencies" — protanopia, deuteranopia, tritanopia, achromatopsia — on the three result cards and the week strip at 375, screenshots attached to the ledger note; plus two readers outside the team shown the three cards for five seconds and asked "which of these is a warning?" — the answer must be "none"):** a neutral-ink family so `Hold off` reads as *pause*, not *alarm* — `--high-border: #334155`, `--high-bg: #f1f5f9`, `--high-text: #1e293b`, `--high-badge: #e2e8f0` — and `--danger` stays reserved for destructive actions (account delete). Every `-text`-on-`-bg`/`-badge` pair must clear AA (`#1e293b` on `#f1f5f9` ≈ 12.6:1; on `#e2e8f0` ≈ 11.2:1).

- [x] **Step 1:** Redefine the four tokens **under `:root[data-calm]`** (review A-40) — the root layout `app/layout.tsx` renders `<html data-calm="">` only when `guideDoorEnabled("calm")`, so the judge door keeps today's red until the `calm` surface is added to the production flag, and the change reverts with the door like every other surface; record the new values in `DESIGN.md` §3 with a ⚖️ dated note and the attribute that scopes them; the week strip and landing verdict cards read tokens, so they follow when the attribute is present. A source pin in `tests/unit/pal/guide-door.test.ts`: `globals.css` declares `--high-border` exactly twice (the default and the `[data-calm]` override).
- [x] **Step 2:** Run `npm run e2e -- tests/smoke/landing-a11y.spec.ts tests/smoke/a11y.spec.ts tests/smoke/journey.spec.ts` (axe contrast) → PASS.
- [x] **Step 3:** The landing's three verdict illustrations recolour with the token (`landing-three-answers` treatment note in the ledger records that colours are tokens, so no copy row changes). Commit: `git commit -am "style(calm): Hold off renders in neutral ink, never danger red (F-CALM a)"`.

##### Task 2.4: The clinical route reads as one calm sentence to a clinician

**Files:**
- Review only: `docs/safety/copy-ledger.md` rows `clinical-*`, `components/result-card.tsx` `CLINICAL_EYEBROWS`

- [x] **Step 1:** For each of the nine `clinical-*` rows, note in the report whether a very worried user is pointed to a clinician in one calm sentence (PRD F-CALM (b)). Where a row is not, draft the amendment in the report as a **proposal** — these rows are `PENDING dietitian/CDCES sign-off (W-05)` and must not be edited without the safety owner.
- [x] **Step 2:** Commit the report update. **PR-2 done check:** report complete; `npm run test:pal && npm run contract` green; smoke a11y green.

---

#### PR-3 — F-ORIENT: "Your first week" as orientation, not a plan

**File structure**

| File | Responsibility |
|---|---|
| Create `lib/coach/orientation.ts` | The seven audited steps, day math, current-step rule, state schema |
| Create `lib/client/orientation-store.ts` | Guest state `pal.orient.v1`; the on-device note `pal.orient.note.v1` |
| Modify `lib/coach/next-action.ts` | The day's step becomes Home's one next-action line |
| Modify `lib/server/db/schema.ts` + `drizzle/0019_*.sql` | `profiles.orientation` jsonb (signed-in state) |
| Modify `app/api/profile/route.ts` | PATCH accepts `orientation` (bounded schema) |
| Modify `app/(app)/home/page.tsx`, `components/guest-dashboard.tsx`, `components/dashboard-view.tsx` | Feed the step + "Day N of your first week" eyebrow |
| Create `app/(app)/learn/first-week/page.tsx`, `components/orientation-list.tsx`, `components/orientation-note.tsx` | The page that hosts the sequence (and F-REFER's section if cleared) |
| Modify `app/(app)/journey/page.tsx` | "Where you are" line |
| Modify `app/guides/a1c-5-7-to-6-4/page.tsx` | Two sentences generalised before the shell links the page (review A-45) |
| Modify `app/(app)/onboarding/page.tsx` | Final step introduces the week (the rest of the tour changes are PR-6) |
| Modify `lib/client/analytics.ts` (+ test) | `orientation_step_done`, `orientation_dismissed` |
| Modify `app/robots.ts`, `tests/unit/pal/seo-meta.test.ts` | `/learn` private |
| Modify `docs/safety/copy-ledger.md` | Batch 2 (orientation rows) |

##### Task 3.1: The orientation module

**Files:**
- Create: `lib/coach/orientation.ts`
- Modify: `tests/unit/pal/claims-boundary-copy.test.ts` (`EXTRA_SOURCES` + `"lib/coach/orientation.ts"`)
- Test: `tests/unit/pal/orientation.test.ts`

**Interfaces:**
- Produces: `type OrientationStepId = "1"|"2"|"3"|"4"|"5"|"6"|"7"`; `type OrientationStep = { id: OrientationStepId; text: string; href: string }`; `ORIENTATION_STEPS: readonly OrientationStep[]`; `type OrientationState = { done: OrientationStepId[]; dismissedAt: string | null; startedAt: string | null }` (`startedAt` per review A-05 — stamped when the week starts, so a guest who skipped the A1C step still gets one); `EMPTY_ORIENTATION`; `OrientationStateSchema` (zod, strict); `orientationDay(startedAt: string | Date, dayKey: DayKeyFn, now?: Date): number` (1-based; 8+ means the week is over; `dayKey` from `lib/coach/days.ts` per review A-06 — `dayKeyInTimezone(profile.timezone)` on the server, `dayKeyLocal` on the device); `currentOrientationStep(state, day): OrientationStep | null`; `LEARN_NUMBERS_HREF` (= `/learn/numbers` when F-NUMBERS has shipped, else the public guide — a constant so one edit flips it).

**Task card:** Copy: rows `orientation-step-01`…`-07` (class `product-role`), `orientation-intro` (`launch-informational`), `orientation-day-eyebrow` (`product-role`). Every step resolves to an existing route or a phone call; no step is a diet, a target or a food ban; never "your plan", "follow this to…", or any outcome. Flag: none (data). Analytics: none. Done check: `npx vitest run tests/unit/pal/orientation.test.ts tests/unit/pal/claims-boundary-copy.test.ts` green.

- [x] **Step 1: Failing test**

```ts
// tests/unit/pal/orientation.test.ts
import { describe, expect, it } from "vitest";

import { dayKeyInTimezone, dayKeyLocal } from "../../../lib/coach/days";
import {
  currentOrientationStep,
  EMPTY_ORIENTATION,
  ORIENTATION_STEPS,
  orientationDay,
  OrientationStateSchema,
  type OrientationState
} from "../../../lib/coach/orientation";

describe("orientation week (PRD v1.1 §6 F-ORIENT)", () => {
  it("has exactly seven steps, ids 1..7, each with an in-app route or an external action", () => {
    expect(ORIENTATION_STEPS.map((s) => s.id)).toEqual(["1", "2", "3", "4", "5", "6", "7"]);
    for (const step of ORIENTATION_STEPS) {
      expect(step.href).toMatch(/^\/(?:learn|check|home|journey|guides)/);
      expect(step.text.length).toBeGreaterThan(10);
    }
  });

  it("no step is a diet, a target, a food ban, or a plan (acceptance)", () => {
    for (const step of ORIENTATION_STEPS) {
      expect(step.text).not.toMatch(/your plan|follow this|avoid|cut out|no more|target|goal|lower|prevent|reverse|manage|control/i);
      expect(step.text).not.toMatch(/\d+\s*(?:g|grams|carbs|calories|%)/i);
    }
  });

  it("day math: 1-based from startedAt, calendar days from the caller's DayKeyFn, 8+ once the week is over", () => {
    const started = new Date(2026, 8, 10, 22, 0); // Sep 10, 22:00 local
    expect(orientationDay(started, dayKeyLocal, new Date(2026, 8, 10, 23, 0))).toBe(1);
    expect(orientationDay(started, dayKeyLocal, new Date(2026, 8, 11, 1, 0))).toBe(2);
    expect(orientationDay(started, dayKeyLocal, new Date(2026, 8, 16, 12, 0))).toBe(7);
    expect(orientationDay(started, dayKeyLocal, new Date(2026, 8, 17, 12, 0))).toBe(8);
    expect(orientationDay(started.toISOString(), dayKeyLocal, new Date(2026, 8, 12))).toBe(3);
  });

  it("the day rolls over at the user's midnight, not the server's (review A-06)", () => {
    // 20:00Z on Sep 10 is already Sep 11 in Kiritimati (UTC+14); 09:00Z on Sep 11 is still Sep 11 there.
    const started = "2026-09-10T20:00:00Z";
    const now = new Date("2026-09-11T09:00:00Z");
    expect(orientationDay(started, dayKeyInTimezone("Pacific/Kiritimati"), now)).toBe(1);
    expect(orientationDay(started, dayKeyInTimezone("UTC"), now)).toBe(2);
  });

  it("an unparseable start reads as the week being over, never Day NaN (review A-24)", () => {
    expect(orientationDay("not a date", dayKeyLocal)).toBe(8);
    expect(orientationDay("not a date", dayKeyInTimezone("UTC"))).toBe(8);
  });

  it("current step: the day's step unless done, then the earliest undone; null when dismissed or over", () => {
    expect(currentOrientationStep(EMPTY_ORIENTATION, 3)?.id).toBe("3");
    const at = (state: Omit<OrientationState, "startedAt">): OrientationState => ({ ...state, startedAt: null });
    expect(currentOrientationStep(at({ done: ["3"], dismissedAt: null }), 3)?.id).toBe("1");
    expect(currentOrientationStep(at({ done: ["1", "2", "3"], dismissedAt: null }), 3)?.id).toBe("4");
    expect(currentOrientationStep(at({ done: [], dismissedAt: "2026-09-12T00:00:00Z" }), 3)).toBeNull();
    expect(currentOrientationStep(EMPTY_ORIENTATION, 8)).toBeNull();
    expect(currentOrientationStep(at({ done: ["1", "2", "3", "4", "5", "6", "7"], dismissedAt: null }), 5)).toBeNull();
  });

  it("state schema is strict and bounded (it is stored server-side for signed-in users)", () => {
    expect(OrientationStateSchema.safeParse({ done: ["1", "7"], dismissedAt: null, startedAt: null }).success).toBe(true);
    expect(OrientationStateSchema.safeParse({ done: ["8"], dismissedAt: null, startedAt: null }).success).toBe(false);
    expect(OrientationStateSchema.safeParse({ done: [], dismissedAt: null, startedAt: null, note: "x" }).success).toBe(false);
    expect(OrientationStateSchema.safeParse({ done: [], dismissedAt: null, startedAt: "not a date" }).success).toBe(false);
  });
});
```

- [x] **Step 2: Run to verify it fails** — `npx vitest run tests/unit/pal/orientation.test.ts` → FAIL (module missing).

- [x] **Step 3: Implement**

```ts
// lib/coach/orientation.ts
import { z } from "zod";

import type { DayKeyFn } from "./days";

/**
 * "Your first week" — orientation, not a plan (PRD v1.1 §6 F-ORIENT).
 *
 * Seven small non-clinical steps, one per day, shown after onboarding and on
 * Home until done. Every step is something the app already supports or a
 * phone call. No step is a diet, a target, or a food ban; the sequence never
 * says "your plan", "follow this to…", or any outcome (claim classes
 * product-role, launch-informational; ledger rows orientation-step-01..07).
 *
 * Content base: app/guides/prediabetes-now-what ("Calm First Steps").
 * Mechanism: lib/coach/next-action.ts, which grows from one action to this
 * seven-day sequence. Day math derives from `onboardedAt` (guest profile
 * store or profiles.onboarded_at) so no new timestamp is stored anywhere.
 *
 * Step 1 links Learn: numbers (F-NUMBERS) once it ships; until D7 resolves it
 * links the public guide, which "stays public and untouched either way".
 * Step 5's note stays on the device (lib/client/orientation-store.ts) and is
 * never sent to the server or the model.
 */
export type OrientationStepId = "1" | "2" | "3" | "4" | "5" | "6" | "7";
export type OrientationStep = { id: OrientationStepId; text: string; href: string };

// Flip to "/learn/numbers" in the F-NUMBERS PR (§2.4.1) — one edit, one place.
// Review A-45: while this points at the public guide, that page must carry no
// second-person sentence about the reader's own number (see Task 3.1 note).
export const LEARN_NUMBERS_HREF = "/guides/a1c-5-7-to-6-4";

export const ORIENTATION_STEPS: readonly OrientationStep[] = [
  { id: "1", text: "Read what the words on a result mean, in general terms.", href: LEARN_NUMBERS_HREF },
  { id: "2", text: "Describe a meal you already ate and read its label.", href: "/check" },
  { id: "3", text: "Check the meal you are least sure about.", href: "/check" },
  { id: "4", text: "Try one of today's ideas and see how it reads.", href: "/home#ideas-title" }, // A-85: no jargon
  { id: "5", text: "Write down the questions you have for your clinician.", href: "/learn/first-week#note" },
  { id: "6", text: "Book, or ask about, a dietitian appointment.", href: "/learn/first-week" }, // A-78: "#dietitian" only once F-REFER ships (an external action; the page is the destination)
  { id: "7", text: "Look back at the week on My journey.", href: "/journey" }
];

export const OrientationStateSchema = z
  .object({
    done: z.array(z.enum(["1", "2", "3", "4", "5", "6", "7"])).max(7),
    // zod 4: z.iso.datetime() (z.string().datetime() is the deprecated v3 spelling).
    dismissedAt: z.iso.datetime().nullable(),
    // Review A-05: when the week began. Null until the first flagged Home visit
    // or the tour's final button stamps it; the server falls back to
    // profiles.onboarded_at when null, guests have no fallback (a guest who
    // skipped the A1C step has no profile at all).
    startedAt: z.iso.datetime().nullable()
  })
  .strict();

export type OrientationState = z.infer<typeof OrientationStateSchema>;

export const EMPTY_ORIENTATION: OrientationState = { done: [], dismissedAt: null, startedAt: null };

const DAY_MS = 24 * 60 * 60 * 1000;

/** A "YYYY-MM-DD" day key as a UTC timestamp, so two keys subtract to whole days. */
function keyToUtc(key: string): number {
  const [year, month, day] = key.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

/**
 * 1 on the day the week started, 7 on its last day, 8+ afterwards. Review
 * A-06: calendar days come from the caller's DayKeyFn (lib/coach/days.ts) —
 * `dayKeyInTimezone(profile.timezone)` on the server, `dayKeyLocal` on the
 * device — so a signed-in user's day never rolls over at the server's UTC
 * midnight. Same helpers Home already uses for "today".
 */
export function orientationDay(
  startedAt: string | Date,
  dayKey: DayKeyFn,
  now: Date = new Date()
): number {
  const startDate = new Date(startedAt);
  // Review A-24: an unparseable start must read as "the week is over", never
  // as "Day NaN" (dayKeyLocal) or a RangeError from Intl (dayKeyInTimezone).
  if (Number.isNaN(startDate.getTime())) return 8;
  const start = keyToUtc(dayKey(startDate));
  const today = keyToUtc(dayKey(now));
  if (!Number.isFinite(start) || !Number.isFinite(today)) return 8;
  return Math.max(1, Math.floor((today - start) / DAY_MS) + 1);
}

/**
 * The step Home shows: today's step if it is not done, else the earliest
 * undone step (a user who skipped day 1 still gets it). Null once dismissed,
 * once every step is done, or once the week is over — the classic
 * next-action branches take over then.
 */
export function currentOrientationStep(
  state: OrientationState,
  day: number
): OrientationStep | null {
  if (state.dismissedAt || day > 7) return null;
  const done = new Set(state.done);
  const today = ORIENTATION_STEPS[day - 1];
  if (today && !done.has(today.id)) return today;
  return ORIENTATION_STEPS.find((step) => !done.has(step.id)) ?? null;
}
```

- [x] **Step 3b (review A-45): generalise the public guide before linking it.** Step 1 links `app/guides/a1c-5-7-to-6-4/page.tsx` in-app while D7 is open, and that page addresses the reader's own number twice. Apply the rewrite §2.4.1 already specifies, on the public page, now: "If your number landed in the middle band, here is how to think about it" → "Here is how clinicians read the middle band"; "where you sit in it is worth knowing" → "where a result sits in it matters to clinicians". The title, H1 and first sentence (the SEO targets) are untouched; the claims audit already scans the page; the safety owner sees the two-line diff with batch 2. An in-app link must not point at a second-person clinical sentence.
- [x] **Step 4: Add `"lib/coach/orientation.ts"` to `EXTRA_SOURCES`; run** `npx vitest run tests/unit/pal/orientation.test.ts tests/unit/pal/claims-boundary-copy.test.ts` → PASS.

- [x] **Step 5: Commit** `git add lib/coach/orientation.ts tests/unit/pal/orientation.test.ts tests/unit/pal/claims-boundary-copy.test.ts && git commit -m "feat(orient): seven-step orientation week module (F-ORIENT)"`.

##### Task 3.2: Guest store + on-device note

**Files:**
- Create: `lib/client/orientation-store.ts`
- Modify: `app/(app)/account/page.tsx` — **account delete and consent withdrawal also clear `pal.orient.v1`, `pal.orient.note.v1` and `pal.ask.v1` (review A-104: today they clear only `historyStore` and `profileStore`, so the clinician-questions note would outlive the account and A-66 would re-upload orientation state); test in `tests/unit/client/account-clear.test.ts`**
- Test: `tests/unit/pal/orientation-store.test.ts` (fake-storage pattern from `first-run-gate.test.ts`); **plus a no-`fetch(` / no-`navigator.sendBeacon` source pin on `orientation-note.tsx` and `orientation-store.ts` (A-104: the real egress risk is client code, not the server walk)**

**Task card:** Copy: none. Storage: `pal.orient.v1` (state), `pal.orient.note.v1` (free text, device only — PRD F-ORIENT "Free text"). Done check: test green; a source pin that no file under `app/api/` or `lib/server/` mentions `pal.orient.note` (the note never leaves the device).

- [x] **Step 1: Failing test**

```ts
// tests/unit/pal/orientation-store.test.ts
import fs from "node:fs";
import path from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

// Same fake-storage bootstrap as tests/unit/client/first-run-gate.test.ts:
// the store touches window.localStorage, vitest runs under node.
function fakeStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
    clear: () => void map.clear()
  };
}
const storage = fakeStorage();
vi.stubGlobal("localStorage", storage);
vi.stubGlobal("window", { localStorage: storage });

import { EMPTY_ORIENTATION } from "../../../lib/coach/orientation";
import { orientationNote, orientationStore } from "../../../lib/client/orientation-store";

describe("orientationStore (pal.orient.v1)", () => {
  beforeEach(() => storage.clear());

  it("returns the empty state on empty or corrupt storage", () => {
    expect(orientationStore.get()).toEqual(EMPTY_ORIENTATION);
    storage.setItem("pal.orient.v1", "{not json");
    expect(orientationStore.get()).toEqual(EMPTY_ORIENTATION);
    storage.setItem("pal.orient.v1", JSON.stringify({ done: ["9"], dismissedAt: null }));
    expect(orientationStore.get()).toEqual(EMPTY_ORIENTATION);
  });

  it("markDone is idempotent and keeps order; dismiss stamps an ISO time", () => {
    orientationStore.markDone("2");
    orientationStore.markDone("2");
    orientationStore.markDone("1");
    expect(orientationStore.get().done).toEqual(["2", "1"]);
    orientationStore.dismiss(new Date("2026-09-14T09:00:00.000Z"));
    expect(orientationStore.get().dismissedAt).toBe("2026-09-14T09:00:00.000Z");
  });

  it("start stamps the week once and never moves it (review A-05)", () => {
    orientationStore.start(new Date("2026-09-14T09:00:00.000Z"));
    orientationStore.start(new Date("2026-09-20T09:00:00.000Z"));
    expect(orientationStore.get().startedAt).toBe("2026-09-14T09:00:00.000Z");
  });
});

describe("orientationNote (pal.orient.note.v1) — device only", () => {
  beforeEach(() => storage.clear());

  it("round-trips, and an empty save removes the key", () => {
    expect(orientationNote.get()).toBe("");
    orientationNote.set("ask which test was used");
    expect(orientationNote.get()).toBe("ask which test was used");
    orientationNote.set("");
    expect(storage.getItem("pal.orient.note.v1")).toBeNull();
  });

  it("is never referenced by any server or API module (the note never leaves the device)", () => {
    const walk = (dir: string, out: string[] = []): string[] => {
      for (const entry of fs.readdirSync(path.join(process.cwd(), dir), { withFileTypes: true })) {
        const rel = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(rel, out);
        else if (/\.tsx?$/.test(entry.name)) out.push(rel);
      }
      return out;
    };
    const offenders = [...walk("app/api"), ...walk("lib/server"), ...walk("lib/pal")].filter((rel) =>
      fs.readFileSync(path.join(process.cwd(), rel), "utf8").includes("pal.orient.note")
    );
    expect(offenders).toEqual([]);
  });
});
```

- [x] **Step 2: Run to verify it fails** — `npx vitest run tests/unit/pal/orientation-store.test.ts` → FAIL (module missing).

- [x] **Step 3: Implement**

```ts
// lib/client/orientation-store.ts
import {
  EMPTY_ORIENTATION,
  OrientationStateSchema,
  type OrientationState,
  type OrientationStepId
} from "../coach/orientation";

/**
 * Guest orientation state (PRD v1.1 §7.4: "one on-device key for guests, next
 * to pal.profile.v1 and pal.segment.v1"). Signed-in users keep the same shape
 * in profiles.orientation (app/api/profile PATCH). Every read validates
 * against the strict schema and falls back to the empty state.
 */
const STATE_KEY = "pal.orient.v1";
// The "write down your questions" note (F-ORIENT "Free text"): device only,
// never sent to the server or the model, never echoed inside app copy.
const NOTE_KEY = "pal.orient.note.v1";

function read(): OrientationState {
  try {
    const raw = window.localStorage.getItem(STATE_KEY);
    if (!raw) return EMPTY_ORIENTATION;
    const parsed = OrientationStateSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : EMPTY_ORIENTATION;
  } catch {
    return EMPTY_ORIENTATION;
  }
}

function write(state: OrientationState): void {
  try {
    window.localStorage.setItem(STATE_KEY, JSON.stringify(state));
  } catch {
    // storage unavailable: the step line still renders from the empty state
  }
}

export const orientationStore = {
  get: read,
  set: write,
  markDone(id: OrientationStepId): void {
    const state = read();
    if (!state.done.includes(id)) write({ ...state, done: [...state.done, id] });
  },
  dismiss(now: Date = new Date()): void {
    write({ ...read(), dismissedAt: now.toISOString() });
  },
  /** Review A-05: stamps the week's start once; later calls are no-ops. */
  start(now: Date = new Date()): void {
    const state = read();
    if (!state.startedAt) write({ ...state, startedAt: now.toISOString() });
  }
};

export const orientationNote = {
  get(): string {
    try {
      return window.localStorage.getItem(NOTE_KEY) ?? "";
    } catch {
      return "";
    }
  },
  set(text: string): void {
    try {
      if (text.trim() === "") window.localStorage.removeItem(NOTE_KEY);
      else window.localStorage.setItem(NOTE_KEY, text);
    } catch {
      // ignore
    }
  }
};
```

- [x] **Step 4: Run → PASS; commit** `git add lib/client/orientation-store.ts tests/unit/pal/orientation-store.test.ts && git commit -m "feat(orient): on-device orientation state and clinician-questions note"`.

##### Task 3.3: Signed-in state — one profile column

**Files:**
- Modify: `lib/server/db/schema.ts` (`profiles.orientation: jsonb("orientation")`, nullable)
- Create: `drizzle/0019_profile-orientation.sql` via `npx drizzle-kit generate --name profile-orientation` (check `drizzle/meta/_journal.json` gained one entry)
- Modify: `app/api/profile/route.ts` — GET returns `orientation`; PATCH's `NudgePrefsSchema` gains `orientation: OrientationStateSchema.optional()` (rename the schema `ProfilePatchSchema`). **Review A-07:** the block that cancels pending nudge attempts (`nudgeAttemptDate`, `nudgeAttemptCount`, `nudgeRetryAfter`, lease fields) runs **only when the body carries a nudge key** (`nudgeHour`, `nudgeOptIn`, `nudgeCadence`, `nudgeQuietStart`, `nudgeQuietEnd`); an `orientation`-only PATCH updates the column and returns, so a "Done" tap on `/learn/first-week` never wipes an in-flight reminder attempt; **a PATCH that updates zero rows returns 404 (review A-92) instead of `{ ok: true }`** — test: signed-in session with no profile row → 404. **Op-based, merged server-side (review A-103):** the body is `{ orientation: { op: "markDone", step } | { op: "start" } | { op: "dismiss" } | { op: "restore" } | { op: "set", state } }`; the handler reads the current jsonb inside the update, applies the op and writes the merged state, so four writers (the toggle, the start stamp, `recordStepEvent`, the sign-in migration) never overwrite each other; `start` is `COALESCE(existing.startedAt, now())` server-side; the schema refines `done` to unique ids and `startedAt` to not-in-the-future (+5 min skew); `set` is only the one-time migration and is refused when the row already has state. Tests: two concurrent `markDone` ops both survive; a second `start` does not move the stamp; duplicate ids → 400.
- Modify: `app/api/account/export/route.ts` — the profile select already returns the whole row, so `orientation` exports automatically; add a line to the export test asserting it
- Test: extend `tests/unit/server/profile-route.test.ts` (PATCH `{ orientation: { done: ["1"], dismissedAt: null, startedAt: null } }` persists; `{ orientation: { done: ["9"] } }` → 400; GET echoes it; **an `orientation`-only PATCH leaves a pending nudge attempt untouched** — seed `nudgeAttemptCount: 1` the way the existing "cancels pending nudge state" test does and assert it is still 1 — review A-07)

The health-data erase path deletes the whole `profiles` row, so the column needs no new erase code — assert that in `tests/unit/server/health-data-delete.test.ts` by seeding `orientation` and checking the row is gone.

- [x] **Step 1: Failing tests** (the three assertions above). **Step 2:** schema + migration + route. **Step 3:** `npx vitest run tests/unit/server/profile-route.test.ts tests/unit/server/db-schema.test.ts tests/unit/server/health-data-delete.test.ts tests/unit/server/account-export.test.ts` → PASS. **Step 4:** commit `git commit -m "feat(orient): profiles.orientation column + PATCH (signed-in orientation state)"`.

##### Task 3.4: The next-action line becomes the day's step

**Files:**
- Modify: `lib/coach/next-action.ts`, `tests/unit/coach/next-action.test.ts`

**Paywall × the week (review A-83 — the plan never mentioned it; owner decision at the final gate, this is the default):** `PAYWALL_MODE` defaults to `trial` and a guest's Day-1 allowance expires at the next calendar day, so from day 2 a guest's check-steps (2, 3, 4) and idea taps land on `/subscribe` exactly as any check does today. Default: when `tasterStore.status() === "expired"` and the user is a guest, the day's step line reads "Sign in to keep your week going" → `/signin` (row `orientation-signin-step`, `product-role`); signed-in free users have four checks a day, enough for the week; day 7's step resolves for everyone because the `/journey` line renders outside the Premium recap (A-80). Alternatives for the owner: exempt week checks from the wall (a capability change — pricing changes, which PRD §0 rules out), or make "Start your first week" the sign-in moment. **Steps complete where they happen (review A-84):** `lib/client/orientation-progress.ts` `recordStepEvent(kind)` marks the earliest undone matching step — `check_completed` → 2 then 3; `idea_check_completed` → 4; a tap on step 1's link → 1; a visit to `/learn/first-week` with the note → 5; the dietitian row → 6; a `/journey` visit → 7 — through the store for guests and a fire-and-forget PATCH for signed-in users (the `/api/history/action` pattern); the Learn toggle stays for the rest.

**Interfaces:**
- `NextActionInput` gains `orientation?: OrientationStep | null`. Rule: if `orientation` is present **and** not (`href === "/check"` && `!checkedToday`) → `{ text: \`Today's step: ${orientation.text}\`, href }`. The carve-out keeps the 2026-08-11 owner rule: before the first check of the day the hero *is* the action, so a "check a meal" step would be a second way to do the same thing. Otherwise the three existing branches, unchanged.

- [x] **Step 1: Failing tests** — append to `tests/unit/coach/next-action.test.ts` (import `ORIENTATION_STEPS` from `../../../lib/coach/orientation` at the top):

```ts
describe("nextAction — the orientation week (PRD v1.1 §6 F-ORIENT, §7.4)", () => {
  const note = ORIENTATION_STEPS[4]; // step 5, href /learn/first-week#note
  const check = ORIENTATION_STEPS[1]; // step 2, href /check

  it("the day's step becomes the one next-action line", () => {
    expect(nextAction({ checkedToday: true, undoneActionToday: false, orientation: note })).toEqual({
      text: `Today's step: ${note.text}`,
      href: note.href
    });
    expect(nextAction({ checkedToday: false, undoneActionToday: false, orientation: note }).href).toBe(note.href);
  });

  it("a check-a-meal step before today's first check yields the classic branch — the PAGE then passes null so Home renders no line (Task 3.5), the hero IS the action (owner rule 2026-08-11)", () => {
    expect(nextAction({ checkedToday: false, undoneActionToday: false, orientation: check })).toEqual({
      text: "Check your next uncertain meal.",
      href: "/check"
    });
    expect(nextAction({ checkedToday: true, undoneActionToday: false, orientation: check }).text).toBe(
      `Today's step: ${check.text}`
    );
  });

  it("null / absent orientation keeps the three classic branches", () => {
    expect(nextAction({ checkedToday: true, undoneActionToday: false, orientation: null }).href).toBe("/journey");
  });

  it("never scolds: no step line mentions missing, failing, streaks, or a percentage", () => {
    for (const step of ORIENTATION_STEPS) {
      const line = nextAction({ checkedToday: true, undoneActionToday: false, orientation: step });
      expect(line.text).not.toMatch(/miss|fail|streak|behind|should have/i);
      expect(line.text).not.toMatch(/%/);
    }
  });
});
```

- [x] **Step 2: Run to verify it fails** — `npx vitest run tests/unit/coach/next-action.test.ts` → FAIL (`orientation` is not a known input).

- [x] **Step 3: Implement**

```ts
// lib/coach/next-action.ts — additions
import type { OrientationStep } from "./orientation";

export type NextActionInput = {
  checkedToday: boolean;
  undoneActionToday: boolean;
  /**
   * PRD v1.1 §7.4: the orientation day's step, when a week is active (null or
   * absent otherwise). The line becomes the step; the three classic branches
   * are the fallback. Exception, keeping the 2026-08-11 owner rule: before
   * today's first check the hero IS the action, so a step that points at
   * /check would be a second way to do the same thing — it falls through.
   */
  orientation?: OrientationStep | null;
};

export function nextAction(input: NextActionInput): NextAction {
  const step = input.orientation;
  if (step && !(step.href === "/check" && !input.checkedToday)) {
    return { text: `Today's step: ${step.text}`, href: step.href };
  }
  // …the existing three branches, unchanged…
```

- [x] **Step 4:** `npx vitest run tests/unit/coach/next-action.test.ts tests/unit/pal/claims-boundary-copy.test.ts` → PASS (`next-action.ts` is already in `EXTRA_SOURCES`). **Step 5:** commit `git add lib/coach/next-action.ts tests/unit/coach/next-action.test.ts && git commit -m "feat(orient): next-action line carries the day's orientation step"`.

##### Task 3.5: Home feeds the step and the "Day N" eyebrow

**Files:**
- Modify: `components/dashboard-view.tsx` (`DashboardData.orientationDay: number | null`; eyebrow `Day {n} of your first week` inside `.dash-greet`, replacing the first-win "Day 1" eyebrow while the week runs — the `day1-first-win` row keeps its sentence on `/check`'s daily loop), `app/(app)/home/page.tsx` and `components/guest-dashboard.tsx` (read `onboardedAt` — `profiles.onboardedAt` / `profileStore.get()?.onboardedAt` — and the orientation state — `profiles.orientation` / `orientationStore.get()`; compute `day = orientationDay(state.startedAt ?? onboardedAt, dayKey)` — `dayKey` is the page's existing `dayKeyInTimezone(timezone)` on the server and `dayKeyLocal` in the guest dashboard (review A-06) — and `step = currentOrientationStep(state, day)`. **One start rule for everyone (review A-66 — the first cut covered guests only):** the week's start is `state.startedAt` and nothing else. It is stamped (a) when the tour completes with the flag on (Task 3.7 — the tour is guest-only), or (b) on the first flagged Home render where `startedAt` is null **and** the profile is younger than seven days (`profileStore.get()?.onboardedAt` for guests, `profiles.onboardedAt` for signed-in users — the diagnosis week, not someone who has been here for months); a small client effect does the stamping (`orientationStore.start()`, or `PATCH /api/profile { orientation: { ...state, startedAt } }` when signed in) and that first render shows day 1 meanwhile. No `startedAt` and no young profile ⇒ no week; those users reach `/learn/first-week` from `/learn` (PR-5). The page never calls `orientationDay` with a null start. **Server (A-21, A-24):** add `onboardedAt` and `orientation` to the *existing* `timezone` select — one query, not two — and parse the jsonb through `OrientationStateSchema.safeParse`, falling back to `EMPTY_ORIENTATION`. **Guest (A-20):** read `orientationStore` only when `useHydrated()` is true, exactly as `historyStore.all()` is gated. **Server-side gate (review A-111):** the PATCH accepts `orientation` only when `guideDoorEnabled("orient")` (the value is available to server code too), 404 otherwise — the "no new server boundary while dark" story stays true through PR-3. **Signed in without a `profiles` row (review A-92):** a user who declined A1C storage has no row (`a1c_ciphertext`, `consented_at` are NOT NULL), so an orientation PATCH would update zero rows — the handler returns **404** when nothing updates, and the client keeps orientation on the device while `GET /api/profile` says `hasProfile: false`, exactly like a guest; the migration below runs only once a row exists. **Guest → signed-in (A-66):** device state joins the `syncLocalHistory` pattern (`lib/client/remote-history.ts` → `/api/history/migrate`): on the first signed-in visit, if the server state is null and a device state exists, PATCH the device state once; after that the server's copy wins and the device key is left alone. Then feed the line with the owner-rule guard **in the page**, because `nextAction()` never returns null and the guest dashboard calls it unconditionally today):

```ts
    // Owner rule 2026-08-11: before today's first check the hero IS the
    // action. A step that points at /check would be a second way to do the
    // same thing, so the line stays off; any other step renders from day 1.
    // Review A-109: the guest dashboard calls nextAction() unconditionally
    // today (guests see the classic line before their first check). The owner
    // rule guard applies only when the door is open, so the flag-off guest Home
    // stays byte-for-byte.
    nextAction: !guideDoorEnabled("orient")
      ? nextAction({ checkedToday: todayChecks.length > 0, undoneActionToday })
      : todayChecks.length > 0 || (step && step.href !== "/check")
        ? nextAction({ checkedToday: todayChecks.length > 0, undoneActionToday, orientation: step })
        : null,
    orientationDay: guideDoorEnabled("orient") && step ? day : null
```

  (signed-in: `todayRows` / `undoneActionToday` as computed today; `step` is `null` when the flag is off).
- Test: extend `tests/unit/pal/guide-door.test.ts` — **render, don't pin (review A-110):** `tests/unit/client/journey-card-flag.test.ts` already renders with `renderToStaticMarkup` + `vi.stubEnv` under node; use the same for `DashboardView` and `GuideIdeas`: flag off → a **snapshot of today's markup** (the byte-for-byte promise, as a test), flag on → the ideas list precedes the hero and the eyebrow reads the day. Source pins stay only where a render is impossible.

**Task card:** Copy: `orientation-day-eyebrow` row — "Day {n} of your first week" (`product-role`). **Greeting, one definition (review A-89):** `.dash-greet` = that eyebrow (13px tracked caps, `.status-eyebrow`) above today's date `h1` and the summary line, unchanged otherwise; while a week is active the first-win block does not render (the eyebrow carries day 1). **Check-step days before the first check (review A-79):** the step line stays off (owner rule), the eyebrow still reads "Day 2 of your first week", and the hero's own eyebrow reads "Today's step · Meal check" so the day is not a promise with nothing under it (`home-check-hero-title` row gains the eyebrow variant, batch 2). Flag: `guideDoorEnabled("orient")` gates the eyebrow and the step (flag off ⇒ `orientation: null`). Analytics: none here. Done check: pins green; with the flag on, a freshly onboarded guest sees "Day 1 of your first week" and, after a check, the step line.

- [x] Steps: failing pins → implement → `npx vitest run tests/unit/pal/guide-door.test.ts` → commit `git commit -m "feat(orient): Home shows the orientation day and the day's step"`.

##### Task 3.6: `/learn/first-week` — the page that hosts the week

**Files:**
- Create: `app/(app)/learn/first-week/page.tsx` (server; metadata `{ title: "Your first week — Prediabetes Pal", robots: { index: false } }`; **order (review A-76): eyebrow "Day {n} of 7" (or "Your first week" after day 7 / when dismissed) → today's step with its Done button → the other six, done ones marked → the note → the intro sentence → the F-REFER section if cleared**; `<OrientationList />`; `<OrientationNote />`; `<DisclaimerLine />`; footer links). **States (reviews A-56, A-59, A-60, A-90):** every Done button's text is the constant "Done" with `aria-pressed` carrying the state (never a label swap) and `aria-label={`Done — ${step.text}`}`; a non-2xx PATCH reverts the toggle and renders `role="status"` "That didn't save just now. Tap Done again in a moment." (row `orientation-save-failed`, `product-role`); "Hide this for now" is reversible — a "Show it again" control on this page clears `dismissedAt` (store `restore()` / PATCH), row `orientation-controls` amended
- Create: `components/orientation-list.tsx` (client; **props, not a probe — review A-33:** the server page knows the session, so it passes `mode: "guest" | "signed-in"` and, when signed in, `initialState` read from `profiles.orientation` (parsed, `EMPTY` fallback); guests read `orientationStore` after `useHydrated()`. Writes: guests through the store, signed-in through `PATCH /api/profile` with an optimistic toggle that reverts and shows a `role="status"` line on a non-2xx — the exact copy is a Phase 2 row; renders the seven steps as a `role="list"` with a "Done" toggle per step (`aria-pressed`), a "Hide this for now" dismiss; writes back via store or `PATCH /api/profile`; `track({ name: "orientation_step_done", props: { step } })`, `track({ name: "orientation_dismissed" })`)
- Create: `components/orientation-note.tsx` (client: a visible `<label htmlFor="note">` and `<textarea id="note">` bound to `pal.orient.note.v1`; **honest hint (review A-57):** on mount a probe write decides the variant — "Your notes stay on this device." when storage works, otherwise `role="status"` "This browser isn't letting the page keep notes — copy your questions somewhere safe."; on a failed save the same line appears; a successful save shows "Saved on this device" for two seconds (`aria-live="polite"`); the note is **never** rendered inside a sentence the app wrote)
- Modify: `lib/client/analytics.ts` + test — three events, inserted before `photo_draft` (`OrientationStepId` type-imported from `../coach/orientation`; comments must avoid the no-PII scan's banned identifiers):

```ts
  // PRD v1.1 §9.1 orientation and Learn instruments. Bounded: the step id,
  // the page id, the origin surface — never the note, never the page body.
  | { name: "orientation_step_done"; props: { step: OrientationStepId } }
  | { name: "orientation_dismissed" }
  | {
      name: "learn_opened";
      props: {
        page: "index" | "numbers" | "first-week" | "doctor";
        from: "home" | "result_footer" | "onboarding" | "step" | "journey";
      };
    }
```

  `learn_opened` is defined **here** (its earliest use — the step-5 link and the `/journey` line emit `from: "step"` / `"journey"`); PR-5, PR-6 and F-NUMBERS reuse it.
- Modify: `app/robots.ts` (`"/learn"` in `DISALLOWED_PATHS`), `tests/unit/pal/seo-meta.test.ts` (`"/learn"`, `"/learn/first-week"` in the private list)

**Task card:** Copy: `learn-first-week-intro` (`launch-informational`; sentences promoted verbatim from `app/guides/prediabetes-now-what` — "An A1C between 5.7% and 6.4% is a signal, not a sentence…" — reviewed for the signed-in context), `orientation-intro` ("Seven small steps, one a day. None of them is a diet. Skip any, come back to any."), `orientation-controls` ("Done · Not yet · Hide this for now"), `orientation-note-hint` (three variants, A-57: "Your notes stay on this device. Nothing here is sent anywhere." · "Saved on this device" · "This browser isn't letting the page keep notes — copy your questions somewhere safe."). Flag: page 404s (`notFound()`) when the flag is off. Analytics: the two events. Done check: `npx vitest run tests/unit/pal/seo-meta.test.ts tests/unit/client/analytics.test.ts tests/unit/pal/claims-boundary-copy.test.ts` green; manual: mark step 2 done on `/learn/first-week`, reload `/home`, the step line moves to step 3 (guest and signed-in).

- [x] Steps: failing (analytics allowlist + seo private list + a source pin that `orientation-note.tsx` never interpolates the note into a string) → implement → run → commit `git commit -m "feat(orient): /learn/first-week hosts the orientation week and the on-device note"`.

##### Task 3.7: `/journey` "Where you are" + the onboarding hand-off

**Files:**
- Modify: `app/(app)/journey/page.tsx` — a "Where you are" line above section 2 when a week is active: "Day {n} of your first week · {done} steps done" (an additive count, never "of 7" — DESIGN.md §9, review A-86; no `%` — `expectRv3Clean` stays green), linking `/learn/first-week`. **After day 7, or once dismissed, the line stays as "Your first week · {done} steps done · Review" with the same link (review A-30): in a PR-3-only build this is the page's only entry point once the Home step line is gone.** Data (review A-80 — the page is `"use client"`, not server-rendered): guests read the store after hydration and the line renders **above the sign-in card** in the guest branch; signed-in users read `GET /api/profile` (it returns `orientation` after Task 3.3); a failed fetch leaves the line out.
- Modify: `app/(app)/onboarding/page.tsx` — the expectations step gains one closing line "Your first week starts on Home: seven small steps, one a day." and the final button reads **"Start your first week"** when the flag is on (PR-6 finishes the rest of the tour); `completeTour()` pushes **`/home?stay=1`** when the flag is on (the ideas door; `?stay=1` is `FirstRunGate`'s escape hatch — without it a device whose `profileStore.set` threw would be bounced straight back into the tour, a loop the current `/check` target cannot enter because `/check` has no gate; review A-28), `/check` otherwise, and calls `orientationStore.start()` when the flag is on so the week begins at the tour's end whether or not an A1C was entered (review A-05).
- Modify: `tests/smoke/onboarding.spec.ts` — the first test's final click branches on `process.env.NEXT_PUBLIC_GUIDE_DOOR === "1"` (button name and landing URL); **`tests/smoke/trial-wall.spec.ts:98` clicks the same "Check my first meal" button and branches the same way (review A-16)**; `tests/smoke/journey.spec.ts` — add the "Where you are" assertion under the same skip guard.

**Task card:** Copy: `onboarding-final-button` ("Start your first week", `product-role`), `onboarding-first-week-line` (`product-role`), `journey-where-you-are` (`product-role`). Done check: both smoke runs (flag on/off) green.

- [x] Steps: failing smoke assertions → implement → `NEXT_PUBLIC_GUIDE_DOOR=1 npm run e2e -- tests/smoke/onboarding.spec.ts tests/smoke/journey.spec.ts tests/smoke/trial-wall.spec.ts` and the flag-off run → commit.

##### Task 3.8: Ledger batch 2 (orientation half)

- [x] Add rows `orientation-intro`, `orientation-step-01`…`-07` (Copy = the step text; class `product-role`; Notes cite F-ORIENT acceptance: resolves to an existing route or an external action, no food to avoid, no outcome), `orientation-day-eyebrow`, `orientation-controls`, `orientation-note-hint`, `learn-first-week-intro`, `journey-where-you-are`, `onboarding-final-button`, `onboarding-first-week-line`. If F-REFER's copy is cleared in the same pass, its rows (§5.1) join this batch.
- [x] `npm run contract` → PASS; commit `git commit -m "docs(orient): ledger batch 2 — orientation week rows"`.

**PR-3 done check:** all gates green; both smoke runs green; the PR lists the batch-2 rows for the safety owner and states whether F-REFER rode along.

---

#### PR-4 — Full F-IDEAS: the label cache, `/check` empty state, segment steering

##### Task 4.1: Review-time labelling, keyed on `PROMPT_VERSION`

**Status 2026-09-17: built (in PR-1), not run** — the owner runs `npm run eval:pal:ideas`; `lib/pal/guide-ideas.labels.json` does not exist yet.

**Pulled into PR-1 by review A-03.** The prototype ships a bank whose model labels are otherwise unverified until PR-4, while §7.3 step 3 flips the flag to production after PR-1 — so a tapped idea could come back `Be careful` on the product's most trust-critical surface. This task therefore runs at the end of PR-1 (after Task 1.9), the labels file is committed with PR-1, and the production flip waits on `guide-ideas-labels.test.ts` green. PR-4 re-runs it only when the bank or `PROMPT_VERSION` changes (which the unit gate enforces).

**Files:**
- Create: `tests/evals/guide-ideas-label-eval.test.ts` (live; runs only with `PAL_LIVE_EVAL=1` + `OPENAI_API_KEY`, the `pal-safety-eval` convention; uses `checkFood` with **`createEvalModelClient` from `tests/support/pal-test-model.ts`** — A-117: `getModelClient` is not exported from the check route). **Steps 2–3 are the owner's hand-off** (a paid run; ~1,440 calls when PR-1 shipped the 24-line seed, **~1,800 calls since PR-4 grew the bank to 30 lines** — the eval iterates `GUIDE_IDEAS`, not the seed constant, so bank growth enlarges the paid run automatically); the implementer finishes PR-1 with the unit suite skipped and the `ideas` surface closed by the guard until the file is committed.
- Create: `lib/pal/guide-ideas.labels.json` (written by the eval: `{ "promptVersion": "<PROMPT_VERSION>", "labels": { "<idea id>": { "text": "<the exact bank line>", "prediabetes_57_59": { "risk", "reason" }, "prediabetes_60_62": …, "prediabetes_63_64": … } } }` — **`text` is stored with every entry and the unit gate and the production guard both assert it equals the current bank line (review A-91): ids are positional, so a line reworded after the eval would otherwise keep the old wording's labels green**)
- Create: `tests/unit/pal/guide-ideas-labels.test.ts`
- Modify: `package.json` scripts: `"eval:pal:ideas": "PAL_LIVE_EVAL=1 vitest run tests/evals/guide-ideas-label-eval.test.ts"`
- ~~Modify: `tests/unit/pal/claims-boundary-copy.test.ts` `EXTRA_SOURCES` + `"lib/pal/guide-ideas.labels.json"`~~ — **dropped (A-107): cached reasons are never served (taps run live checks), and scanning unserved model prose can turn the audit red on a re-run for no user-facing reason.** Instead: a production trigger — any `idea_check_completed { risk ≠ "SAFE" }` in Umami is a §13 prune event (`docs/ops/launch-controls.md` §13 lists it): the idea comes out of the bank in the next PR.

**Task card:** Copy: the cached reasons are covered by the `guide-ideas-*` rows' Notes ("labels cached at review time; every reason is scanned by the claims audit"). Done check: `npm run eval:pal:ideas` writes the file; `npx vitest run tests/unit/pal/guide-ideas-labels.test.ts` green; **a prompt bump without re-running the eval turns the unit test red** (the PRD's requirement, mechanised). **Review A-63 (spec review):** that red is intended friction — the prompt is the safety boundary and `eval:pal` already gates prompt PRs — but the flip gets its own exact guard too: `next.config.ts`'s production block (the twin-guard shape) also throws when the flag opens `ideas` and `lib/pal/guide-ideas.labels.json` carries a `promptVersion` other than `PROMPT_VERSION` or a `text` that no longer matches the bank (A-91), **and when the production value is `1` (review A-94 — "never `1` in production" is a guard, not a sentence)**, with cases in `tests/unit/pal/flag-server-twins.test.ts`. **Superseded by review A-100 (eng voice H3):** a prompt hotfix must never be blocked by the idea bank. The staleness check leaves `test:pal` (the unit gate keeps text-match, structure and all-`SAFE`; it no longer compares `promptVersion`); `next.config.ts` computes the **effective** surface list at build — when the labels are stale (`promptVersion` or `model` differ) it drops `ideas` and `ideas-full` from the inlined value with a build-log warning and no throw (the `env` inlining precedent of `NEXT_PUBLIC_SENTRY_RELEASE`), and `/api/health.guideDoor.ideas` then reads `off`; `npm run config:production-check` reports staleness as an issue. The guard still *throws* for `1` in production (A-94) and for an unapproved or incoherent list (A-101). The seed bank grows to eight per daypart so pruning one line never breaks the ≥ 6 / disjoint tests.

- [ ] **Step 1: The unit gate (fails until the eval has run once)**

```ts
// tests/unit/pal/guide-ideas-labels.test.ts
import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { GUIDE_IDEAS } from "../../../lib/pal/guide-ideas";
import { PROMPT_VERSION } from "../../../lib/pal/prompt";

type Labels = {
  promptVersion: string;
  model: string; // activeModelId() with any provider prefix ("openai/") stripped — A-117
  labels: Record<string, { text: string } & Record<string, { risk: string; reason: string }>>;
};

const BANDS = ["prediabetes_57_59", "prediabetes_60_62", "prediabetes_63_64"] as const;

const LABELS_PATH = path.join(process.cwd(), "lib/pal/guide-ideas.labels.json");
// Review A-114/A-117: the labels file is the OWNER's hand-off (it needs a paid
// live run). Until it exists this suite SKIPS with the instruction — test:pal
// stays green for an implementer without a key, and the production door guard
// (Task 1.11) keeps `ideas` closed until the file is committed.
// 2026-09-18: the shipped wording drifted from this block when PR-4 grew the
// bank — `tests/unit/pal/guide-ideas-labels.test.ts:162` is the live literal.
// Only the count and price are corrected here (~1,440/$15 → ~1,800/$19).
const hasLabels = fs.existsSync(LABELS_PATH);
describe.skipIf(!hasLabels)(
  "guide idea labels (skipped: run `npm run eval:pal:ideas` — OPENAI_API_KEY, ~1,800 calls at twenty per cell, about $19 — and commit lib/pal/guide-ideas.labels.json)",
  () => {}
);
const labels: Labels = hasLabels ? JSON.parse(fs.readFileSync(LABELS_PATH, "utf8")) : { promptVersion: "", model: "", labels: {} };

/**
 * PRD v1.1 §6 F-IDEAS: every idea returns Clear at every band 5.7–6.4, and
 * the cache is keyed on PROMPT_VERSION — a prompt bump re-runs every idea
 * (npm run eval:pal:ideas) and pulls any idea whose label moved. Commit
 * 822f44e moved a canonical label class on 2026-08-16; a cache that ignored
 * the prompt version would have kept serving the old one.
 */
describe("guide idea labels — Clear at every band, current prompt", () => {
  // A-100/A-117: prompt and model freshness are checked by the production door
  // guard (stale labels close the ideas surfaces), not here — a prompt hotfix
  // must never turn test:pal red. This file checks structure, text and labels.

  it.each(GUIDE_IDEAS.map((idea) => [idea.id, idea.text] as const))(
    "%s (%s) reads Clear at every band",
    (id) => {
      for (const band of BANDS) {
        expect(labels.labels[id]?.text, `${id} text drifted since the eval (A-91)`).toBe(GUIDE_IDEAS.find((idea) => idea.id === id)?.text);
        expect(labels.labels[id]?.[band]?.risk, `${id} @ ${band}`).toBe("SAFE");
        expect(labels.labels[id]?.[band]?.reason).toMatch(/\S/);
      }
    }
  );

  it("carries no idea that is no longer in the bank (stale entries are pruned)", () => {
    const ids = new Set(GUIDE_IDEAS.map((idea) => idea.id));
    for (const id of Object.keys(labels.labels)) expect(ids.has(id), id).toBe(true);
  });
});
```

- [ ] **Step 2: The live eval** — for each idea × `[5.9, 6.2, 6.4]` (the most conservative value in each band) call `checkFood({ food: idea.text, a1c }, { model: () => getModelClient() })`, **twenty runs per cell (review A-107 — three runs pass a 20%-flip idea about half the time; §12's own bar is N ≥ 20)**; a cell **passes** only if every run is `kind: "result"` with `risk: "SAFE"`; record the first run's `reason`. **Review A-27 — a cell is *inconclusive*, not failed, when any run is `kind: "retry"`, throws, or returns a non-`result` kind for a reason the precheck did not predict; re-run inconclusive cells up to three times, and if still inconclusive leave the idea in the bank, mark the cell `inconclusive` in the file and fail the eval loudly (a transient provider failure must never prune an idea). A cell *fails* only on a real `MODERATE` / `HIGH` result.** Write the JSON with `promptVersion: PROMPT_VERSION` **and `model: activeModelId()` (A-107: `PAL_MODEL` changes without a redeploy; the staleness check compares both), using the eval client factory `tests/evals/pal-safety-eval.test.ts` already uses (`getModelClient` is not exported from the check route).** Print a table of failures and inconclusives. Ideas that fail at any band are **removed from `GUIDE_IDEA_BANK` by hand** in the same PR (never auto-edited), and the ledger row's Notes record which and why; the unit gate treats an `inconclusive` cell as red.
- [ ] **Step 3:** `npm run eval:pal:ideas` (needs `OPENAI_API_KEY`), prune, re-run until every remaining idea passes; then `npx vitest run tests/unit/pal/guide-ideas-labels.test.ts tests/unit/pal/guide-ideas.test.ts tests/unit/pal/claims-boundary-copy.test.ts` → PASS.
- [ ] **Step 4:** Commit `git commit -m "feat(ideas): review-time label cache keyed on PROMPT_VERSION; bank pruned to Clear-at-every-band"`.

Note: taps still run a live check (the cache is evidence, not a serving path) — see Open questions.

##### Task 4.2: Ideas on `/check`'s first-run empty state

**Pulled into PR-1 by review A-42.** Session-one guests never see Home (all four landing CTAs, `twa-manifest.json` `startUrl` and the tour's final button land on `/check`), so a Home-only prototype measures a door nobody walks through. The row emits `ideas_shown { daypart, surface: "check" }`; its `check-empty-ideas` ledger row joins batch 1.

**Files:**
- Modify: `components/food-check-form.tsx` — **below** the CTA (the `mobile-check.spec` A11Y-01 pin keeps optional content off the space above the submit button), **above** the promise-registry classics when the flag is on (review A-75, both design voices: the classics were chosen to surprise and read "breakfast staples" at dinner; the classics stay, `promise-registry.test.ts` pins their render site, not their order), a row `Ideas for {daypart}` from `ideasFor(daypart, rotation)`; flag on, the classics' hint reads "Or try a classic — foods whose read surprises people." (a flag-gated variant of the `onboarding-first-check` row, batch 1); tap fills the field exactly like a classic (no `pal.recheck` needed — same page), plus `track({ name: "idea_tapped", props: { daypart, slot, surface: "check" } })`, **and the tap sets `initialPrefillRef.current = { ...current, recheck: idea.text, recheckSource: "idea" }` so `shouldCountIdeaCheck` counts the completion exactly like a Home tap (review A-69 — without it every `/check` idea tap is invisible to the idea → check read).**
- Modify: `tests/smoke/mobile-check.spec.ts` (under the skip guard: the ideas row renders below the CTA on first run).

**Task card:** Copy: `check-empty-ideas` row ("Or start from an idea for {daypart}", `product-role`). Flag: `guideDoorEnabled("ideas")`. Done check: both smoke runs green; `promise-registry.test.ts` untouched and green. *Review A-10 → superseded by A-75:* both suggestion rows stay, ideas first, classics second with a reworded hint; the fixture contract pins the classics' presence, not their position.

##### Task 4.3: Segment steering

**Files:**
- Modify: `lib/pal/guide-ideas.ts` — `ideasFor(daypart, rotation, count, segment?: string)` (**shipped as `ideasFor(daypart, rotation, options?: IdeasOptions)` with `{ count, full, segment }` — `lib/pal/guide-ideas.ts:205`; use the options object, not this positional form**): the existing "What brought you here?" answer (`pal.segment.v1`) steers the first idea the same way it steers the first-check chips (PRD §7.4): `"Doctor's advice"` and `"Family history"` start from the second half of the bank so returning segments see variety; `"New A1C result"` / `"Just checking"` / unknown → the default. (Deterministic; unit test extends `guide-ideas.test.ts`.)
- Modify: `components/guide-ideas.tsx` — pass `localStorage.getItem("pal.segment.v1")` (try/catch).

##### Task 4.4: "See all" expands the block

- Modify `components/guide-ideas.tsx`: a "See all" text button (`aria-expanded`) that shows the whole daypart bank; the collapsed state stays three chips. Taps on chips past the third emit `idea_tapped { slot: "more" }` (review A-08). No new route (Open questions: whether a dedicated ideas page is wanted). Copy: "See all" / "Show fewer" as their own row `guide-ideas-see-all` under the `ideas-full` surface (review A-94 — a batch-1 row must not carry a later PR's strings). Smoke: expanding keeps the CTA reachable (no assertion on the fold once expanded).

**PR-4 done check:** all gates + both smoke runs green; the labels file is committed; `docs/safety/copy-ledger.md` `guide-ideas-*` Notes record any pruned ideas.

**Status 2026-09-18: merged dormant (#153), done check partly outstanding.** Green: all four gates and all three e2e legs (fold slack, check CTA to tab bar, flag-on 58.2 / 12.3 / 12.3 px at 360 / 375 / 430; the `ideas,source` leg unchanged at 65.8 / 19.8 / 19.9). Tasks 4.3 (segment steering, Home only) and 4.4 ("See all" / "Show fewer") shipped behind `ideas-full`; the bank is ten lines per daypart. **Not done, and it is the owner's:** `lib/pal/guide-ideas.labels.json` does not exist — `npm run eval:pal:ideas` has not been run, so the production guard keeps `ideas` **and** `ideas-full` closed in any build whatever the flag says. Run it once, *after* this merge: the eval iterates `GUIDE_IDEAS`, so one run now covers all 30 lines. Any ideas pruned by that run get their reason recorded in the `guide-ideas-*` Notes then, not now. Four new rows (`guide-ideas-more-breakfast`/`-lunch`/`-dinner`, `guide-ideas-see-all`) are filed `Pending`; none is `Approved`.

### 2.4 Tier 1 — gated items (blockers, not sequence tasks)

#### 2.4.1 F-NUMBERS · "What these numbers mean, in general" — **Gate: D7**

**Gate.** Rail 16 (`DESIGN.md` §1.3): every sentence files under a claim class; neither `out-of-scope-routing` nor `prompt-scope` fits a general A1C-education page. **Opens when** the safety owner names a class (or counsel adds one). **Escalation:** no class by branch-read day ⇒ deferred; the door ships without it; orientation step 1 and the F-ASK number/effort routes point at the public guide (`LEARN_NUMBERS_HREF` stays as is).

**What it is.** `app/guides/a1c-5-7-to-6-4` promoted into the shell as `/learn/numbers`: what A1C and fasting glucose measure, the published ranges, why the two tests can disagree, why one result is not a trend. **Never takes or displays the user's own value; never says which side of a line the user is on.**

**Files.** Create `app/(app)/learn/numbers/page.tsx` (server, `notFound()` when the flag is off, `<DisclaimerLine />`, "Ask your clinician what your own result means" as the one route-out sentence); modify `components/result-card.tsx` (a `<Link href="/learn/numbers">What these numbers mean, in general</Link>` **beside** the footer — the `general-guidance` paragraph is byte-tested and is not edited; `track({ name: "learn_opened", props: { page: "numbers", from: "result_footer" } })`); modify `app/(app)/onboarding/page.tsx` A1C step (link beside the field); flip `LEARN_NUMBERS_HREF` to `/learn/numbers`; modify `app/robots.ts` / `seo-meta.test.ts` private list; the `learn_opened` event already exists (defined in Task 3.6).

**Copy pass (the real work).** Every paragraph of the guide re-read for the signed-in context; the lines that address *the reader's own number* are rewritten to general terms: "If your number landed in the middle band, here is how to think about it" → "Here is how clinicians read the middle band"; "where you sit in it is worth knowing" → "where a result sits in it matters to clinicians"; "Two people with the same 6.0% can be in very different places" stays (general). Rows `learn-numbers-01…0n`, class **= D7's answer**. The guide stays public and untouched.

**Tests.** `tests/unit/pal/learn-numbers.test.ts`: render the page element tree (the `get-the-app-page.test.ts` `collectText` pattern) and assert no second-person clinical statement (`/\byou(?:r)?\s+(?:number|result|a1c|are|sit)\b/i` returns nothing except the approved clinician sentence), no `%` beyond the two range bounds, disclaimer present; source pin that `result-card.tsx` does not edit the `general-guidance` paragraph; `seo-meta` private list; smoke: `/learn/numbers` renders behind the flag and the footer link is present on a result.

**Acceptance (PRD).** No second-person statement about the user's value; safety-owner sign-off recorded in the ledger; copy audit passes.

#### 2.4.2 F-TREND · "Your A1C over time" — **Gates: D3 and RV-3 (a)/(b)**, last in both branches

**Gates.** D3 (owner): a later out-of-range entry is **refused** / **stored without anchoring** / **anchored and routed**. RV-3 (safety owner): (a) amend `DESIGN.md` §9 and scope `tests/smoke/journey.spec.ts` `expectRv3Clean`'s `%` assertion to the recap section; or (b) render "A1C 5.9" with the unit named once in the section heading. **Opens when both are chosen.** Both are recorded in the ledger as touching a rail and a smoke test.

**What it is.** The user adds further A1C results with dates; `/journey` shows them as **dated points**, own section, neutral ink, no trend line, no projection, no target, no band word, no colour, not beside app-usage counts; title "Your A1C over time"; the user's optional note is the only context. Nothing is computed from the points. Entered values are never sent to the model. Second reason: periodic re-entry keeps the engine's band current.

**Files (outline).**
- Schema: `a1c_entries` (id uuid, user_id → users cascade, `a1c_ciphertext` text, `recorded_on` date, `note_ciphertext` text nullable, created_at) + migration; `tests/unit/server/db-schema.test.ts` table list.
- Routes: `app/api/profile/a1c/route.ts` GET (list, decrypted for the owner), POST (`{ a1c, recordedOn, note? }`, consent required, `routeA1C` per D3), DELETE (`?id=`). Node runtime, session-gated, injectable deps like `createProfileRouteHandlers`. Add `a1c_ip` / user limits to `lib/pal/rate-limit.ts` if the proxy's route table is extended (or leave un-limited like `/api/profile` — decide with the twin below).
- Flags: `lib/a1c-entries-flag.ts` with the full twin pair `NEXT_PUBLIC_A1C_ENTRIES` / `A1C_ENTRIES_ENABLED`; register in `next.config.ts` twin guard, `scripts/check-production-config.ts` `PAIRS`, `app/api/health` `flagTwinStates()`, `tests/unit/pal/flag-server-twins.test.ts`, `docs/ops/env-reference.md`. The route 404s when the server twin is off.
- Erase + export: add `a1cEntries` to the health-data delete transaction (explicitly, before `profiles`) and to `tests/unit/server/health-data-delete.test.ts`; include in the account export (`tests/unit/server/account-export.test.ts` inline dataset list); account delete cascades via the users FK.
- Intake: `POST /api/profile` also inserts the first entry (`recorded_on = today`) when creating a profile.
- Surfaces: `/journey` new section (client fetch; free tier included — it is the user's own data, not the premium recap); `/account` "Stored health data" gains an "A1C entries" editor (add / delete; same erase control); onboarding A1C step copy "This becomes the first entry in your A1C list" (row).
- D3 branches, implemented as one constant `A1C_OUT_OF_RANGE_POLICY: "refuse" | "store" | "anchor"` in `lib/pal/a1c.ts`: **refuse** — POST returns 400 with the existing boundary copy plus one calm sentence row ("Prediabetes Pal records values in its range only; for a result outside it, your clinician is the right reader"); **store** — the point saves, `profiles.a1c_band` stays on the most recent in-range entry, one sentence beside the list says so (row); **anchor** — the point saves, `profiles.a1c_band` moves, every check shows the existing below/high-range route (`lib/pal/a1c.ts` already returns `out_of_scope_below` / `out_of_scope_high`) until a new in-range entry.
- RV-3 branch: (a) edit `DESIGN.md` §9 + `journey.spec.ts` (`expectRv3Clean` scopes `%` to `[data-testid="journey-recap"]`); (b) format `A1C {value}` with the unit in the heading only.

**Copy.** Rows `a1c-over-time-title`, `-empty`, `-anchor-sentence` (per D3), `-note-hint`, `-account-editor`, `onboarding-a1c-first-entry`; classes `out-of-scope-routing`, `disclaimer-footer`. No sentence on the section makes a numeric or directional claim.

**Tests.** Route tests (PGlite): encrypted at rest (`decryptField` round-trip), consent required, D3 policy behaviour, delete removes only the caller's row; erase + export coverage; `tests/unit/pal/a1c-over-time.test.ts` source pins: the section renders no `--safe|--moderate|--high` token, no `trend|progress|on track|target|excellent|building` word, no `<svg>`/line, values in `--text-body`; smoke `journey.spec.ts` stub `/api/profile/a1c` with rising and falling series and assert identical markup class per point + `expectRv3Clean` green under the chosen branch.

**Analytics.** `lab_entry_added` (presence only, **no props** — a value or a date bucket would be health data). Named without the banned token on purpose: the no-PII scan's `\ba1c\b` would only spare `a1c_entry_added` because `_` is a word character, which is too fragile to rely on; the module comment says "lab entry" too.

#### 2.4.3 F-SOURCE · the `/how-it-works` "same read every time" paragraph — **Gate: consistency eval on the panel**

**Gate.** The engine is model-backed; commit `822f44e` fixed a 38% flip on the canonical two-starch meal that had survived until 2026-08-16. `docs/ops/launch-controls.md` §12 records 127/127 with 0 flips on **one meal**. The PRD's acceptance is the **panel**: same input twice yields the same label and the same source line across the eval panel. **Opens when** a panel run is logged in §12 (every `stratum-*` meal in `tests/fixtures/pal-eval-cases.json` × 3 bands, N ≥ 20 each, ≥ 95% modal class; `scripts/consistency-check.mjs` extended with `--cases` or run per meal) **and** the sentence is an `Approved` row.

**Files when open.** `app/(app)/how-it-works/page.tsx` gains one paragraph under "What's measured" (the panel is the evidence; the sentence cites it: "Measured on the eval panel on {date}: the same description returned the same label in {n} of {n} runs"); ledger row `how-it-works-same-read` (`product-role`); `tests/smoke/journey.spec.ts` how-it-works test asserts the paragraph; `docs/ops/launch-controls.md` §12 gains the panel rows. The `SOURCE_LEAD` line (Task 1.5) deliberately does not make this claim and does not change.

---

## 3. Home / dashboard (PR-5) — layout and design from PRD §7.1, §7.4, §7.6

**Skeleton adopted, treatment rejected** (§7.6): greeting bar with the orientation day (PR-3) · the ideas block as the hero slot on a light surface, **no number in the hero** · a row of four quick actions Ideas · Check · Learn · Journey with Check the one accent-filled item · one next-action line (the day's step) · the Today card unchanged · the plan box only when billing needs attention · the existing five-slot tab bar. Rejected: the tile grid on Home (it moves to `/learn`), the floating scan pill, dark bands and a black card (rail 14, one accent).

**Phone-width order (375, flag on):** brand → `Hello, {date} · Day 3 of your first week` → ideas block → check hero → **quick row (below the hero — review A-54, so the fold holds with real strings)** → step line → Today → plan box (conditional) → tab bar. The PRD §7.6 wireframe drew the quick row between ideas and the hero; DESIGN.md §8's fold rule outranks a wireframe's order, and the row's job (reaching Learn, expanding ideas) is the same either side of the hero. Desktop ≥1024: same column (max 1000px), sidebar nav; the quick row stays (it is Home's affordance, not navigation).

**Fold budget at 375×667 (review A-09).** Task 1.8's assertion — the check CTA's bottom edge ≤ 667 — keeps running after PR-5 adds the quick row, so the stack above the CTA is budgeted here rather than discovered in PR-5:

| Element | Height (measured from the CSS, 375 wide) | Source |
|---|---|---|
| Top bar | 56 | `.app-topbar` today |
| Greeting (`.dash-greet`: title + summary + eyebrow) | 70 | `clamp(1.6rem…)` + 16px summary + 18px margin |
| Ideas block: padding 28 + eyebrow 18 + sub 33 + three rows | 227 with one-line rows · **293 worst case** (three two-line rows at 16px / 1.35) | Task 1.4 as amended (A-54): rows are 44px min, wrap to two lines; idea text ≤ 64 chars |
| Block margin | 12 | |
| Check hero, top to the CTA's bottom edge | 174 | padding 24 + eyebrow 16 + 8 + H2 29 + 6 + copy 23 + 16 + form 52 |
| `.app-content` padding-top | 12 | omitted before (eng voice M5) |
| Day eyebrow (PR-3) | 18 | `.status-eyebrow` |
| **Total above the CTA's bottom edge, as first budgeted** | **569 typical · 635 worst** against a usable **611** (667 − the 56px tab bar) | **fails by up to 24px** → A-106 |
| **A-106: the date and the day collapse into one eyebrow line (−52), the ideas title is the page's first heading (22px, +4)** | **521 typical · 587 worst** of 611 | ≥ 24px of slack; the smoke seeds the rotation (page 1 and page 2), the clock, and each door |
| Quick row (PR-5) | ~100 with labels | **below the hero**, outside the fold budget |
| Non-default doors (PR-5): a step line or the clinician line **above** the ideas | +48 (one line) / +70 (two) | review A-93: these doors render **two** idea rows, not three, so the added line is paid for by the removed row (worst case stays ≤ 605); the smoke seeds `pal.ask.v1` for each first pick, the rotation counter and the clock, and measures each door |

> **⚠ 2026-09-18, measured after PR-5 Task 5.3 (branch `feat/guide-pr5-home-layout`, `cb0d8d9`): the arithmetic in this table is superseded — plan against the measurement below.** Slack is px from the check CTA's bottom edge to the tab bar, flag on (`PAL_E2E_GUIDE_DOOR=1`), the minimum over every daypart × rotation page × the four e2e browsers. The `ideas,source` leg (no `home`) is unchanged at 65.8 / 19.8 / 19.9.
>
> | Door | 360 | 375 | 430 |
> |---|---|---|---|
> | default (`ideas`) | 58.2 | 12.3 | 12.3 |
> | `numbers` / `plan` pick with no step line, or a day whose step targets the ideas block (falls back to default) | 58.2 | 12.3 | 12.3 |
> | `worried`, days 1–3 (clinician line above two idea rows) | **2.8** | 26.1 | 26.1 |
> | `numbers`, day 1 (step line above "Ideas for later") | 62.9 | 17.0 | 17.0 |
> | `plan`, day 1 | 62.9 | 17.0 | 17.0 |
>
> **Withdrawn:** an earlier version of this note (#155's first commit) projected the `worried` door **~14px over** at 375 and 430. It fits at every width (tightest: 2.8px at 360). The projection assumed ~44px idea rows; they measure **61.2px** (two-line floor), so the dropped third row pays for more than the arithmetic said, and the clinician line uses the 14px disclaimer style. **The real overflow was `numbers` / `plan` at 360** (−6.3px with two idea rows: every step line wraps to two lines at every width, 64.5px). **Owner ruling, 2026-09-18:** below 375px the `numbers` and `plan` doors show **one** idea row instead of two, keyed on the effective door (not `worried`) — A-93's trade carried one row further at the one width where Task 1.8 already hides row 3. The shrink order below is already spent (Task 1.8: `.ideas-sub` 14px, block padding 12px, row 3 hidden under 375px), so anything added above the Home fold — Task 5.5's hero H2 included — needs the flag-on e2e leg (`PAL_E2E_GUIDE_DOOR=1 npm run e2e -- tests/smoke/dashboard.spec.ts`) re-run before it is believed. A miss goes to the owner — never the hero, never the quick-row labels, never the assertion.

The smoke measures real strings at 360, 375 and 430 (Task 1.8). If a measurement ever exceeds 667, the shrink order is: `.ideas-sub` to 14px → block padding to 12px → row padding to 8px 12px — never the hero, never the quick-row labels (an icon-only row would make Leaf/Compass/Bookmark carry meaning alone), never the assertion.

##### Task 5.1: The quick-action row

**Files:**
- Create: `components/home-quick-row.tsx` (server-safe; four `<Link>`s with icons from `components/icons.tsx` — Leaf for Ideas, CheckCircle for Check, Compass for Learn, Bookmark for Journey *(final review 2026-09-18, ruling R-6: swapped — Journey → Compass, the tab bar's own pairing; Learn → a new `IconBook`)* — **all quiet: no accent fill on any item (review A-74). The hero above it and the tab bar's puck already hold the accent; a third fill breaks DESIGN.md §8's one colour moment. The PRD §7.6 row drew Check filled; the rail wins, and dropping the row altogether is user challenge UC5;** 44px+ targets; `aria-label="Quick actions"`; Ideas is the block's **See-all toggle** — it scrolls to `#ideas-title` and expands the block (Task 4.4), so it is a control, not a link to the element above it (taste decision A-38 offers a three-item row without it); Learn `/learn`, Journey `/journey`, Check `/check`)
- Modify: `components/dashboard-view.tsx` (render **between `<HomeCheckHero />` and the step line** when the flag is on — review A-54: below the hero, so the fold budget holds with real strings), `app/globals.css` (`.quick-row` flex, four equal round targets with visible labels at every width; no fills; nothing dark)
- Test: `tests/unit/pal/home-layout.test.ts` — source pins: exactly four hrefs in order `#ideas-title`, `/check`, `/learn`, `/journey`; no `quick-action--accent` at all (A-74); DashboardView order `<GuideIdeas` < `<HomeCheckHero` < `<HomeQuickRow` < `dash-next-action` < `aria-label="Today"` (A-54).

**Task card:** Copy: `home-quick-row` row ("Ideas · Check · Learn · Journey", `product-role`). Flag: `guideDoorEnabled("home")`. Analytics: `learn_opened { page: "index", from: "home" }` (defined in Task 3.6) on the Learn link — make the row a client component (`"use client"`, `onClick` on that one link). Done check: pins green; smoke (Task 5.4).

##### Task 5.2: `/learn` — the index of tiles

**Files:**
- Create: `app/(app)/learn/page.tsx` (server; `notFound()` when the flag is off; metadata `{ title: "Learn — Prediabetes Pal", robots: { index: false } }`; two-column grid of equal tiles, the treatment §7.6 says fits **here**: "What the numbers mean" (only when `LEARN_NUMBERS_HREF` is `/learn/numbers`, i.e. F-NUMBERS shipped — otherwise the tile is omitted, not linked out), "Your first week" → `/learn/first-week`, "Questions for my doctor" → `/learn/doctor` (only if F-DOCTOR is gated in), "How it works" → `/how-it-works`, "My meals" → `/meals`, "Saved meals" → `/meals#saved` (only when `mealMemoryUiEnabled()`) *(final review 2026-09-18, ruling R-30, revert of R-12: "Saved meals" dropped — `mealMemoryUiEnabled()` carried no premium or server gate of its own, and the hash target can't land until meal memory ships for real)*, "Pantry review" → `/pantry`; `<DisclaimerLine />`; footer)
- Modify: `app/globals.css` (`.learn-grid` two columns ≥ 480px, one below; tiles = `--surface`, 1px `--border-soft`, 14px radius, no shadow — "a card is one step from its plane") *(final review 2026-09-18, ruling R-16: `--border-strong`, not `--border-soft` — "one step from its plane" is about a card's background against its page plane, not border weight)*, `app/robots.ts` (already `/learn` from PR-3), `tests/unit/pal/seo-meta.test.ts` private list (`/learn`)
- Test: `tests/unit/pal/home-layout.test.ts` — render the page element tree (`collectText`) with the flag stubbed on and assert the tile labels and hrefs; with the flag off the module throws Next's `notFound` (assert via `vi.mock("next/navigation")`).

**Task card:** Copy: `learn-tiles` row (the tile labels, `product-role`). Done check: tests green; `/learn` renders behind the flag at 375 and 1280.

##### Task 5.3: The door order (slot mechanism for F-ASK)

**Files:**
- Create: `lib/client/home-door.ts` — pure door rule. `AskState` lives in `lib/client/ask-store.ts`; create that file's **types and reader** here (Task 6.2 adds the writer) so PR-5 and PR-6 do not depend on each other circularly:

```ts
// lib/client/home-door.ts
import type { AskState } from "./ask-store";

/**
 * PRD v1.1 §7.5 "What the answers do", 1: the F-ASK picks order the door per
 * person — the same branch the concierge test applies to the whole audience.
 * Food first → ideas lead. Number first → orientation step 1 (Learn: numbers)
 * leads. Plan first → the seven-day sequence sits at the top. Worried → the
 * clinician pointer sits higher. No pick, "other", or a skipped screen → the
 * default door, which is the concierge branch's own answer.
 */
export type Door = "ideas" | "numbers" | "plan" | "worried";

export function doorFor(ask: AskState | null): Door {
  switch (ask?.pains[0]) {
    case "number":
    case "effort":
      return "numbers";
    case "plan":
    case "clinician":
      return "plan";
    case "worried":
      return "worried";
    default:
      return "ideas";
  }
}
```

  Test (`tests/unit/pal/home-door.test.ts`), the truth table:

```ts
import { describe, expect, it } from "vitest";

import { doorFor } from "../../../lib/client/home-door";

describe("doorFor (PRD v1.1 §7.5)", () => {
  it.each([
    [null, "ideas"],
    [{ pains: [], win: null }, "ideas"],
    [{ pains: ["food", "number"], win: null }, "ideas"],
    [{ pains: ["number"], win: "explanation" }, "numbers"],
    [{ pains: ["effort", "food"], win: null }, "numbers"],
    [{ pains: ["plan"], win: "steps" }, "plan"],
    [{ pains: ["clinician"], win: null }, "plan"],
    [{ pains: ["worried"], win: "peace" }, "worried"],
    [{ pains: ["other"], win: "unsure" }, "ideas"]
  ] as const)("%j → %s (first pick decides)", (ask, door) => {
    expect(doorFor(ask as never)).toBe(door);
  });
});
```
- Create: `components/home-door.tsx` — client wrapper `<HomeDoor ideas={…} quickRow={…} step={…} hero={…} />` *(final review 2026-09-18, ruling R-29: shipped without an `ideas` slot — HomeDoor renders `<GuideIdeas key="ideas" …/>` itself behind an `ideasOn` prop, and hero/quickRow/step go in keyed `<Fragment>`s; no `cloneElement`/`isValidElement` on slot props, which the flight client can deliver as lazy wrappers)* that renders the default order on the server (`ideas, hero, quickRow, step` — A-54) and after `useHydrated()` *(final review 2026-09-18: shipped as `useSyncExternalStore`, not `useHydrated()` — the react-hooks `set-state-in-effect`, `refs` and `purity` lint rules are errors in this repo)* reorders per `doorFor(askStore.get())`: `numbers` → the step line (step 1 = Learn: numbers) above the ideas block and the ideas eyebrow reads "Ideas for later" (row); `plan` → the step line first, ideas second; `worried` → a one-line clinician pointer (`BOUNDARY_DISCLAIMER`'s second sentence is the approved wording — reuse it, no new claim) above everything, then ideas.
- Modify: `components/dashboard-view.tsx` to render the four slots through `<HomeDoor>` when the flag is on. **The four orders (review A-62), each a full spec:** `ideas` — ideas · hero · quick row · step; `numbers` — step (step 1, "Learn: numbers", the generalised public guide until D7) · ideas (**two rows**, title "Ideas for later") · hero · quick row; `plan` — step · ideas (two rows) · hero · quick row; `worried` — the clinician line (the disclaimer's second sentence) · ideas (two rows) · hero · quick row · step (the two-row rule is A-93: the added line above the ideas is paid for by the third row, so the fold holds in every door), and after day 3 of the week the clinician line drops below the step line (A-88 — a pointer at the top of every visit reads as a brush-off). When the step is null (week over, dismissed, or the carve-out) `numbers` and `plan` fall back to the `ideas` order. **Reorder contract (A-55, A-108):** each slot carries a stable `key` (`"ideas"`, `"hero"`, `"quickRow"`, `"step"`) so a reorder moves nodes instead of remounting `GuideIdeas` (a remount would advance the rotation and fire `ideas_shown` twice); the default order is rendered on the server and on the first client render; a non-default door reorders exactly once, after hydration, with no CSS transition, and only when `document.activeElement` is not inside the region — focus is never moved, and the DOM order is the reading order from then on.
- Test: `tests/unit/pal/home-door.test.ts` — `doorFor` truth table; source pins that `home-door.tsx` renders the default order in the non-hydrated branch (no hydration mismatch).

**Task card:** Copy: `home-door-worried-line` (reuse of the disclaimer's clinician sentence — record as a row pointing at `result-footer`, class `disclaimer-footer`), "Ideas for later" as its own row `guide-ideas-later` under the `home` surface (review A-94). Done check: tests green; manual with `pal.ask.v1` seeded in devtools.

##### Task 5.4: Smoke for the Home layout

- Extend the door `describe` in `tests/smoke/dashboard.spec.ts`: quick row has four links and no accent fill (A-74); `/learn` reachable from it; at 1280 the column order is unchanged and the sidebar still has five slots; `page.locator("main")` text has no `%`. Run both configurations.

##### Task 5.5: The hero asks the guide's question (§8 item 8, plan default set 2026-09-14)

**Files:**
- Modify: `components/home-check-hero.tsx:38` (the `<h2>` only; eyebrow, copy line, input and button unchanged)
- Modify: `tests/unit/pal/guide-door.test.ts` (one source pin; `read` helper from Task 1.4)
- Modify: `docs/safety/copy-ledger.md` (new row)

**Why.** "What are you eating?" is the judge's question, and it has no ledger row today (`product-home-hero` is the positioning sentence, not the H2). Once ideas lead, the hero is the second control, and the PRD's own expectations line names its job: "the check is there when you are unsure." Untouched in PR-1 on purpose (the prototype stays small and the kill line reverts it cleanly); reworded here, behind the same flag. No smoke or unit test pins the old text (checked 2026-09-14).

**Task card:** Copy: `home-check-hero-title` row — "Unsure about a meal?" (flag on) · "What are you eating?" (flag off, the string shipping today), class `product-role`; §7.3: second person for an action, never a clinical state. Flag: `guideDoorEnabled("home")`. Analytics: none. Done check: pin green; the H2 reads "Unsure about a meal?" with the flag on and is byte-identical to today with it off.

- [ ] **Step 1: Pin (fails first)** — append to `tests/unit/pal/guide-door.test.ts`:

```ts
it("the hero H2 switches on the flag and keeps today's string when it is off", () => {
  const src = read("components/home-check-hero.tsx");
  expect(src).toMatch(
    /guideDoorEnabled\("home"\)\s*\?\s*"Unsure about a meal\?"\s*:\s*"What are you eating\?"/
  );
});
```

- [ ] **Step 2: Change the H2** — in `components/home-check-hero.tsx`, import `guideDoorEnabled` from `../lib/guide-door-flag` at the top of the file, then:

```tsx
<h2 id="meal-hero-title">
  {guideDoorEnabled("home") ? "Unsure about a meal?" : "What are you eating?"}
</h2>
```

- [ ] **Step 3: Ledger row, run, commit** — add `home-check-hero-title` (`Pending | Yes`, `product-role`, both strings in Copy; Notes: "flag-switched; the off string has shipped since the C7 restructure and had no row until now"). Run `npx vitest run tests/unit/pal/guide-door.test.ts tests/unit/pal/claims-boundary-copy.test.ts` → PASS. Commit: `git commit -m "feat(home): hero asks the guide's question behind the door flag (ledger home-check-hero-title)"`.

**PR-5 done check:** all gates + both smoke runs green; `home-quick-row`, `learn-tiles`, `home-check-hero-title` rows filed (batch 2).

---

## 4. Onboarding / intake (PR-6) — §7.4 changes and F-ASK (§7.5)

**Tour after this PR (flag on):** welcome · segment ("What brought you here?") · **ask_pains** (Screen A) · **ask_win** (Screen B; the F-ASK response line renders beneath the pick, link-free, and the screen advances on Continue) · attribution · a1c · expectations (now also carries the "ideas come first" line) · boundary (exit). Eight screens; the skip link stays on every step; A1C-known guests still skip `a1c`. Flag off: the six-step tour, byte-for-byte.

##### Task 6.1: Pure step functions and their tests

**Files:**
- Modify: `app/(app)/onboarding/page.tsx` — `Step` gains `"ask_pains" | "ask_win"`. `TRACKED_STEPS` and `TrackedStep` (Task 1.9) gain the same two ids, and the guard test in `tests/unit/client/onboarding-flow.test.ts` gains `expect(trackedStep("ask_pains")).toBe("ask_pains")` and the same for `ask_win` — the funnel then reads `segment → ask_pains → ask_win → attribution` (Task 6.7). `STEP_PROGRESS` is typed `Record<Step, number>`, so it must gain the two keys or it fails `npm run typecheck`: add `ask_pains: 0, ask_win: 0` to the flag-off table (unreachable when the door is off; the existing "never zero on a visible step" test iterates only the five visible steps and stays green). Its other values and tests stay exactly as they are. Three pure additions:

```ts
// Goal-gradient bar for the eight-screen tour (PRD v1.1 §7.5). Never 0 on a
// visible step; strictly increasing on every path.
export const STEP_PROGRESS_ASK: Record<Step, number> = {
  welcome: 14,
  segment: 26,
  ask_pains: 36,
  ask_win: 44,
  attribution: 52,
  a1c: 62,
  expectations: 90,
  boundary: 0
};

export function progressFor(step: Step, askEnabled: boolean): number {
  return askEnabled ? STEP_PROGRESS_ASK[step] : STEP_PROGRESS[step];
}

export function nextStepAfterSegment(askEnabled: boolean): Step {
  return askEnabled ? "ask_pains" : "attribution";
}

// stepCounter gains a third, optional argument; existing callers are unchanged.
export function stepCounter(step: Step, skipsA1c: boolean, askEnabled = false): string {
  const ask: readonly Step[] = askEnabled ? ["ask_pains", "ask_win"] : [];
  const steps: readonly Step[] = skipsA1c
    ? ["welcome", "segment", ...ask, "attribution", "expectations"]
    : ["welcome", "segment", ...ask, "attribution", "a1c", "expectations"];
  const index = steps.indexOf(step);
  return index === -1 ? "" : `Step ${index + 1} of ${steps.length}`;
}
```

  The page computes `const askEnabled = guideDoorEnabled("intake");` once and passes it to the three functions; `advanceFromSegment` calls `setStep(nextStepAfterSegment(askEnabled))`; Screen B advances to `"attribution"`.

- Modify: `tests/unit/client/onboarding-flow.test.ts` — extend in place:

```ts
import {
  nextStepAfterSegment,
  progressFor,
  STEP_PROGRESS_ASK
} from "../../../app/(app)/onboarding/page";

describe("F-ASK tour plumbing (PRD v1.1 §7.5)", () => {
  it("counts 7 / 6 contiguous steps with the two ask screens, and 5 / 4 without", () => {
    expect(stepCounter("ask_pains", false, true)).toBe("Step 3 of 7");
    expect(stepCounter("ask_win", false, true)).toBe("Step 4 of 7");
    expect(stepCounter("expectations", false, true)).toBe("Step 7 of 7");
    expect(stepCounter("expectations", true, true)).toBe("Step 6 of 6");
    expect(stepCounter("ask_pains", false, false)).toBe("");
    expect(stepCounter("expectations", false, false)).toBe("Step 5 of 5");
  });

  it("routes segment → ask_pains only when the door is on", () => {
    expect(nextStepAfterSegment(true)).toBe("ask_pains");
    expect(nextStepAfterSegment(false)).toBe("attribution");
  });

  it("the ask bar never shows a visible step at zero and only moves forward", () => {
    const full = ["welcome", "segment", "ask_pains", "ask_win", "attribution", "a1c", "expectations"] as const;
    const skip = ["welcome", "segment", "ask_pains", "ask_win", "attribution", "expectations"] as const;
    for (const path of [full, skip]) {
      for (let i = 0; i < path.length; i++) {
        expect(progressFor(path[i], true)).toBeGreaterThan(0);
        expect(progressFor(path[i], true)).toBeLessThan(100);
        if (i > 0) expect(STEP_PROGRESS_ASK[path[i]]).toBeGreaterThan(STEP_PROGRESS_ASK[path[i - 1]]);
      }
    }
    expect(progressFor("segment", false)).toBe(STEP_PROGRESS.segment);
  });
});
```

- [ ] **Step 1:** add the tests (fail: exports missing). **Step 2:** implement the three functions. **Step 3:** `npx vitest run tests/unit/client/onboarding-flow.test.ts` → PASS. **Step 4:** commit `git add "app/(app)/onboarding/page.tsx" tests/unit/client/onboarding-flow.test.ts && git commit -m "feat(intake): F-ASK step plumbing (pure functions)"`.

##### Task 6.2: Screen A — "What is hardest right now? Pick up to three."

**Files:**
- Create: `lib/client/ask-store.ts` (if not created in Task 5.3): `PAIN_KEYS = ["number","effort","plan","clinician","worried","food","other"] as const`; `WIN_KEYS = ["explanation","number_watch","steps","food_enjoy","peace","trust","unsure"] as const`; `type AskState = { pains: PainKey[]; win: WinKey | null }`; `askStore.get()/set()` on `pal.ask.v1` (strict validation on read).
- Modify: `app/(app)/onboarding/page.tsx` — the step renders seven **`idea-row` buttons** (full-width rows: the options are sentences, not the 1–3 word labels DESIGN.md §10 reserves chips for — review A-54) with `aria-pressed` and the §10 fill change, a counter "{n} of 3" in an `aria-live="polite"` region, Continue **never disabled** (at zero picks it advances exactly like Skip — review A-58; a disabled control cannot be interrogated from the keyboard), Skip; a fourth tap is ignored and the counter reads "Three picked — unpick one to change" (A-82, row text). Options, in the research's own categories, plain words: *Understanding what my number means* · *My effort is not showing in the number* · *I have no plan, I do not know where to start* · *My doctor did not give me much* · *I am worried about where this is going* · *Knowing what I can eat* · *Something else*. Order of taps is kept (it is the signal).

**Task card:** Copy: `onboarding-ask-pains` row (heading + seven options + "Pick up to three" + "Skip", class `product-role`; the options describe the reader's situation in the reader's words and assert nothing about them — the `landing-familiar-cards` precedent). Flag: `guideDoorEnabled("intake")`. Storage: `pal.ask.v1`. Analytics: none until Screen B (one event for both screens). Done check: `tests/unit/pal/ask-store.test.ts` green (fake storage; corrupt value → null; more than 3 pains rejected); smoke (Task 6.6).

##### Task 6.3: Screen B — "What would count as a win for you? Pick one."

- Modify `app/(app)/onboarding/page.tsx`: seven single-select **rows** (the same `idea-row` shape, review A-54) — *A clear explanation* · *A number I can watch* · *A plan of steps* · *Food I can enjoy without worry* · *Peace of mind* · *Numbers I can trust* · *Not sure yet* — a tap selects (`aria-pressed`) and renders the response line beneath the chips (Task 6.4); **Continue** advances (Screen A's pattern, not the segment step's one-tap advance: the response needs a moment on screen); Skip. On Continue or Skip: `askStore.set({ pains, win })` *(final review 2026-09-18, ruling R-36: the write happens only when something was picked — pains non-empty or win non-null — so skipping both screens leaves `pal.ask.v1` absent, which Task 6.6's smoke asserts; an unanswered re-take keeps the last answered value. `intake_ask` still fires exactly once either way)* and **one** event:

```ts
track({
  name: "intake_ask",
  props: {
    pain_1: pains[0] ?? "none",
    pain_2: pains[1] ?? "none",
    pain_3: pains[2] ?? "none",
    win: win ?? "skipped"
  }
});
```

- Modify `lib/client/analytics.ts` (+ test): `| { name: "intake_ask"; props: { pain_1: PainKey | "none"; pain_2: PainKey | "none"; pain_3: PainKey | "none"; win: WinKey | "skipped" } }` before `photo_draft`; `PainKey`/`WinKey` type-imported from `./ask-store` (closed enums; the module comment must not use the words the no-PII scan bans).

**Task card:** Copy: `onboarding-ask-win` row (`product-role`). Analytics: `intake_ask` (closed enum, exactly like `attribution`; never free text; never stored server-side). Done check: analytics tests green.

##### Task 6.4: The response line — what the app does about the pick

The screen after Screen B is, in this tour, the attribution screen, and the PRD counts the tour at eight; so the response renders **on Screen B itself**, beneath the chips, the moment a win is picked — adjacent to the pick, no ninth screen (§8 item 4, plan default set 2026-09-14), in §2.4's own can/partly/not-directly wording. It is **link-free**: tour state is React state, so a link out mid-tour would lose the walk. The routing the PRD asks for (number and effort picks → Learn: numbers and the clinician) happens through the Home door (`doorFor`, Task 5.3) and orientation step 1, not through a link here. *(final review 2026-09-18, ruling R-40/M1: flip `intake` only with `orient`, `source` and `home` live — the `trust` line is true only under `source`, and `pal.ask.v1`'s only reader is Home's door, which exists only under `home`. `SURFACE_REQUIRES.intake` lists only `orient`; enforcing the other two is an owner-approved change to lib/guide-door-flag.ts, not made here)*

- Modify `app/(app)/onboarding/page.tsx` Screen B (Task 6.3): when `win !== null`, render `<p className="ask-response">{askResponse(win)}</p>` beneath the chips, from a closed map (`lib/client/ask-response.ts`, pure, unit-tested; `askResponse(win: WinKey): string`):

| win | line |
|---|---|
| `explanation` | "The words on a result are explained in general terms. What your own number means is a question for your clinician." |
| `number_watch` | "The words on a result are explained in general terms. Your own results are for your clinician to read with you." (**never** mentions a list of entered results — F-TREND is gated and last in both branches, and a promise about an unshipped surface is the failure `landing-includes-five` records) |
| `steps` | "Your first week is seven small steps, one a day. None of them is a diet." |
| `food_enjoy` | "Meal ideas come first, and you can check any meal when you are unsure." |
| `peace` | "Plain words, and a clear pointer to a person when an app is not the right reader." (A-85: DESIGN.md §2 — never claim the surface is calm) |
| `trust` | "Every label says where it came from: Prediabetes Pal's rules." (the lead-in names the rule *set*, not a rule — do not overclaim) |
| `unsure` | "Meal ideas come first, the check is there when you are unsure, and the words are explained in general terms." (a Skip leaves the screen; nothing renders) |

- Modify the **expectations** step: the §7.4 line for every user, "Ideas come first. The check is there when you are unsure." — and the existing four bullets stay. The response line does **not** repeat here.

**Task card:** Copy: `onboarding-ask-response` row (all seven lines, classes `product-role` / `out-of-scope-routing` for the two routed lines), `onboarding-expectations-ideas` ("Ideas come first. The check is there when you are unsure.", `product-role`). *(ruling R-49: filed as ONE row `onboarding-ask-response` with class `product-role` — the contract validator needs one known class per row; the Notes name the two clinician-routing lines as out-of-scope-routing in character)* Rule: no line names an outcome the product would be the agent of — the `product-agent-verb` family (PR-2) and a unit test over the map (`/lower|reverse|prevent|control|manage|reach|hit|drop/i` absent) enforce it. Done check: `npx vitest run tests/unit/pal/ask-response.test.ts tests/unit/pal/claims-boundary-copy.test.ts` green.

##### Task 6.5: The A1C step (its link waits for D7) + final step

- **The link beside the A1C field waits for D7** (§8 item 3, plan default set 2026-09-14). It is the one placement where "your number" sits beside a number the user just typed — the substance of D7 — so it ships with F-NUMBERS (§2.4.1 already lists it, with `learn_opened{from:"onboarding"}`), not here. The public guide is still reached from orientation step 1 and the Home door, both outside the tour. The row `onboarding-a1c-learn-link` moves to the gated `learn-numbers-*` batch.
- Modify `app/(app)/onboarding/page.tsx`: the final button (from PR-3) stays "Start your first week"; nothing else changes on the A1C step in this PR.
- **Welcome screen, flag on (review A-73 — the first screen still pitched the judge):** under `guideDoorEnabled("intake")` the welcome copy is PRD §3's line — "You were just told you have prediabetes. Here are meal ideas, calm first steps, and plain answers about what the words mean, in one place. Check any meal when you are unsure." — the three verdict badges are not rendered, and the time claim reads "about a minute" (eight screens). Row `onboarding-welcome-guide` (`product-role`, batch 2). Flag off: today's welcome, byte for byte. *(ruling R-43: the h1 is PRD §3's first sentence, "You were just told you have prediabetes.", and the page-copy its other two; eyebrow and "Get started" kept. Under PRD §7.3 ("second person … never for the user's clinical state") that h1 cannot be Approved as written unless the PRD owner amends §3 or §7.3 — recorded on the `onboarding-welcome-guide` row)*

##### Task 6.6: Smoke

- Modify `tests/smoke/onboarding.spec.ts` **and `tests/smoke/trial-wall.spec.ts` (its walk crosses the tour too — review A-68)**: under `test.describe` + the skip guard, a full eight-screen walk: pick two pains (assert `aria-pressed`), Continue, pick a win (the response line appears beneath the chips), Continue, attribution, A1C, expectations shows the ideas line, "Start your first week" → `/home?stay=1` (review A-28) with the ideas block visible; a second test: skip both screens → `pal.ask.v1` absent (assert via `page.evaluate`), tour still completes. The flag-off walk stays as is. Run both configurations.

##### Task 6.7: The 70% floor and its fallback (a follow-up task, executed only if the floor fires)

- Measure (owner ruling amended 2026-09-14; PRD §7.5, §9.1): in Umami, sessions with `onboarding_step{step:"attribution"}` ÷ `onboarding_started`, over the first 50 starts after PR-6 is live with the flag on. Floor: 70% [A]. Read it against the baseline the same event has collected since PR-1 (Task 1.9): the share of starts that went from `segment` to `attribution` in the six-screen tour, where the two are adjacent. The per-screen counts locate the drop: `segment → ask_pains → ask_win → attribution`.
- Decision rule: the fallback below fires only when the drop sits on `ask_pains` or `ask_win`. **Review A-105:** nothing is inferred about the A1C screen from `attribution → expectations` (the funnel already exposes it by subtraction; no decision rule may rest on it), and `intake_ask`'s self-reported categories ("worried", "effort not showing") go to counsel with batch 2 against the privacy page's "coarse, non-identifying" promise — if counsel says no, the event sends `pain_1` only. A drop between `attribution` and `expectations` is the A1C screen (or the skip link there); that is a separate finding for the owner and is **not** fixed by merging Screen A.
- Fallback: merge Screen A into "What brought you here?" — the segment step's chips become the seven pain options (multi-select up to three), `pal.segment.v1` keeps its steering role from the first pick (map `food` → the classics, `number` → "New A1C result", `clinician` → "Doctor's advice", else default), Screen B stays. `STEP_PROGRESS`/`stepCounter` shrink by one; `onboarding-segment` row amended. Do **not** drop Screen A.

**PR-6 done check:** all gates + both smoke runs green; rows `onboarding-ask-pains`, `-ask-win`, `-ask-response`, `-expectations-ideas` filed (batch 2); `-a1c-learn-link` is gated with `learn-numbers-*`.

---

## 5. Tier 2 — gated modules (not counted in the main sequence)

Each module starts only when its gate is open. The gate comes first; the work follows.

### 5.1 F-REFER · "Get me a real plan" pointer — **Gate: none, optional; ships with F-ORIENT only if the safety owner clears the copy in the same pass**

**What opens it.** Rows `refer-intro`, `refer-dietitian-script`, `refer-programme` cleared with ledger batch 2. Otherwise deferred to its own PR; nothing else waits on it.

**What it is.** One static section on `/learn/first-week` (`#dietitian`, the anchor step 6 already links): how to ask for a dietitian referral, what a diabetes-education programme is, and a plain script for the request. Cost: one page of reviewed copy. Claim class `launch-informational` / `out-of-scope-routing`. It hands the person on; it delivers nothing itself — never "the system will act", never a promise about coverage or availability. Risk note (PRD §11.1): before opening, re-count the clinician-failure share on a later twenty-day window; below 3% it stays closed.

**Files.** Modify `app/(app)/learn/first-week/page.tsx` (the section, server-rendered, flag-gated with the page); `tests/unit/pal/learn-first-week.test.ts` (text pins: the script contains no dosage, no test name, no claim about what the clinician will do); `docs/safety/copy-ledger.md` rows. Analytics: none (page view is enough).

### 5.2 F-DOCTOR · "Questions for my doctor" — **Gate: D2 (new ledger rows + a wording review near the clinical line)**

**What opens it.** The safety owner reviews and approves the question bank **before it exists on any surface**; D2 recorded as yes. Re-count the clinician-failure share first (§11.1).

**What it is.** The user types what they want to ask, in their words; the app returns a short list of **questions**, not answers, assembled from a reviewed bank by **on-device keyword match** (which topics were mentioned: test names, exercise, food, family history) — **no model call**; the text and any value in it never leave the device, are never stored server-side, and are never echoed back inside a sentence the app wrote. The app never interprets the value.

**Files.** Create `lib/pal/doctor-questions.ts` (the bank: `{ topic: "tests"|"exercise"|"food"|"family"|"general"; question: string }[]` + `TOPIC_TOKENS`; pure `questionsFor(text): string[]` — topic match only, returns bank strings verbatim, never a slice of the input; `EXTRA_SOURCES` entry); create `components/doctor-questions.tsx` (client; textarea bound to `pal.doctor.draft.v1` with the same on-device rule as the orientation note; the list renders below; a "Copy list" button; nothing submits anywhere — a unit source pin asserts no `fetch(` in the component); create `app/(app)/learn/doctor/page.tsx` (flag-gated; linked from orientation step 5 and from the clinical route card `CLINICAL_EYEBROWS` block as "Questions to bring" only for routes where a visit follows — not `urgent_symptoms`); modify `app/(app)/learn/page.tsx` tile; `robots`/`seo-meta` private list.

**Copy.** Every question line is a row (`doctor-q-01…`), classes `out-of-scope-routing`, `clarification-route`; must never say anything about what the user's number means, whether it is good, or what the clinician will say. Example lines from the PRD: "Ask which test was used and why", "Ask what result would change the advice", "Ask whether a dietitian referral is available".

**Tests.** `tests/unit/pal/doctor-questions.test.ts`: `questionsFor("My A1C is 5.9 and I've been walking daily")` returns only bank strings, never contains "5.9", topic match covers the four topics, empty input → the general three; the bank passes the claims audit; the analytics event (if any) is presence-only `doctor_list_viewed` with no props.

### 5.3 F-PLAN · A starter plan the app supplies — **Gate: D1**

**What opens it.** The owner chooses, on purpose, to supply a default meal pattern and call it a starting point — a materially different posture that removes the "we never invent the rule" posture named in `docs/handoff/2026-09-11-four-audience-validation-report.md:326` from the positioning and from every surface that expresses it (review A-19: the literal line is not in `docs/product-marketing.md`; that file's primary message is "Check a meal. Understand its balance in plain language."). If D1 is "no", this module is closed and F-ORIENT stands alone.

**What it is.** The orientation week gains a default meal pattern presented as a starting point: a reviewed bank (`lib/pal/starter-pattern.ts`, one pattern per daypart drawn from `app/guides/prediabetes-meal-plan`'s plate sketch — "about half nonstarchy vegetables, about a quarter protein, about a quarter less-refined carbs" — labelled **Prediabetes Pal's default** and never *theirs*), rendered as a section on `/learn/first-week` and referenced by orientation step 4. Intake gains the screener the four-audience report suggested: "Did your clinician give you a plan or a sheet?" (closed enum: yes-with-pattern / yes-single-food / no / not sure; on-device key `pal.plan-screener.v1`; closed-enum analytics `intake_plan_screener`), placed after Screen B.

**Files.** The bank + `EXTRA_SOURCES`; `/learn/first-week` section; onboarding step `plan_screener` (+ `STEP_PROGRESS`/`stepCounter`/tests); `docs/product-marketing.md` positioning line change (ledger amendment, and `claims-boundary-copy.test.ts`'s "Approved acquisition copy" section is scanned); rows `starter-pattern-*` (`result-adjustment` / `product-role`), every line through the copy audit; no caloric target, no gram count (unit test: `/\d+\s*(?:g|grams|calories|kcal)/i` absent), never "your plan" (the pattern is "a starting point" and "Prediabetes Pal's default").

### 5.4 F-HABIT · Gentle reminders — **Gate: none, later (after Phase 5 measures return without it)**

**What opens it.** Phase 5's measurement (`.planning/ROADMAP.md` success criteria) shows whether anyone returns without a reminder. `DESIGN.md` §9 rules out gamification; `/journey` already shows the week.

**What it is.** A daily reminder to check one meal or read one idea — opt-in, no streaks, no scores. Reuse: the push subscription + nudge cron already exist (`lib/server/nudge.ts`, `app/api/cron/nudge`, `profiles.nudge*` prefs, `NudgeOptIn` on `/check`) and are **Premium-gated** in `lib/server/capabilities.ts` (`nudges`). Decision inside the gate: whether the guide reminder is free (a capability change, owner call) or stays Premium. Copy: one reminder line per variant (`nudge-guide-idea`, `nudge-guide-check`; class `product-role`; never "streak", never "missed"); the existing `NudgeClass` gains `"guide_reminder"` (closed enum in `lib/client/analytics.ts` — insert carefully, the type is mirrored). Tests: `tests/unit/journey/nudge.test.ts` extended for the new class; copy audit.

---

## 6. Tier 3 note — F-DIARY · Food-and-reading diary

**Gate: D4 — a change to the intended-use statement** in `docs/safety/claims-boundary.md` ("do[es] not predict an individual glucose response"). Pairing a food with a reading and letting a pattern show *is* an individual glucose response; no wording review fixes that, and with the statement the product's regulatory posture changes. **The PRD records the feature and recommends nothing; so does this plan.**

Rough shape of the work, if the owner ever opens that door (for sizing only, no tasks): a new health data type (`glucose_readings`, encrypted, own consent step at intake — Phase 4's privacy-minimal posture is the blocker, not the screen), a readings surface on `/journey` beside meals (a new kind of Home content, not designed), a boundary-copy revision (`HIGH_RANGE_MESSAGE` says the product "does not know your … glucose readings" — that trust line would become false), a new claim class from counsel, an updated privacy page and counsel brief (`privacy-provider-truth.test.ts` lockstep), and the four-audience report's own warning to design around: readings from the same meal vary 110–145 for the same person, and a product that shows that variance has to explain it without interpreting it.

---

## 7. Test and rollout plan

### 7.1 Gates on every PR

```bash
npm run lint && npm run typecheck && npm run test:pal && npm run contract && npm test
npm run e2e -- tests/smoke/dashboard.spec.ts tests/smoke/onboarding.spec.ts tests/smoke/journey.spec.ts tests/smoke/mobile-check.spec.ts tests/smoke/trial-wall.spec.ts
NEXT_PUBLIC_GUIDE_DOOR=1 npm run e2e -- tests/smoke/dashboard.spec.ts tests/smoke/onboarding.spec.ts tests/smoke/journey.spec.ts tests/smoke/mobile-check.spec.ts tests/smoke/trial-wall.spec.ts
```

The door specs skip themselves when the flag is absent, so the flag-off run proves the judge front door is byte-for-byte unchanged and the flag-on run proves the door. Both must be green. **Review A-99 — this only counts if CI runs both:** `ci.yml` runs one `npm run e2e` with no flag today and the plan never edited it; `scripts/e2e-runtime-env.ts` blanks every other `NEXT_PUBLIC_*` flag but not this one, so a `.env.local` value would leak into the flag-off build. PR-1 therefore (a) adds `NEXT_PUBLIC_GUIDE_DOOR` to the blanked list, (b) adds two CI e2e jobs — `NEXT_PUBLIC_GUIDE_DOOR=1` and the current production list (`ideas,source`) — beside the flag-off job, and (c) makes every skip guard read the door's *effective* state (`GET /api/health` → `guideDoor.<surface>`) instead of `=== "1"`, so the production list is tested and a list value never skips the specs. PR-4 adds `npm run eval:pal:ideas` (live, needs `OPENAI_API_KEY`) whenever `PROMPT_VERSION` or the bank changes — the unit gate `guide-ideas-labels.test.ts` turns red otherwise.

### 7.2 Test inventory by feature

| Feature | Unit (`tests/unit/pal/` unless noted) | Smoke |
|---|---|---|
| Flag | `guide-door.test.ts`; `env-contract.test.ts` | — |
| F-IDEAS | `guide-ideas.test.ts` (precheck-clean, positive, rotation); `guide-ideas-labels.test.ts` (Clear at every band, `PROMPT_VERSION`); `claims-boundary-copy` (bank + labels) ; `client/analytics.test.ts` | `dashboard.spec` door describe; `mobile-check.spec` empty-state row |
| F-SOURCE | `guide-door.test.ts` (`SOURCE_LEAD`); `copy-pins`; `result-card-upsell` | `/check` result shows the lead-in |
| F-CALM | `claims-boundary-copy` (`product-agent-verb`) | `landing-a11y`, `a11y`, `journey` (axe contrast after the token change) |
| F-ORIENT | `orientation.test.ts`; `orientation-store.test.ts`; `coach/next-action.test.ts`; `server/profile-route.test.ts`; `server/health-data-delete.test.ts`; `server/account-export.test.ts`; `seo-meta.test.ts` | `onboarding.spec` (final button), `journey.spec` ("Where you are"), `dashboard.spec` (step line) |
| Home layout | `home-layout.test.ts`; `home-door.test.ts` | `dashboard.spec` (quick row, order at 375/1280) |
| F-ASK | `client/onboarding-flow.test.ts`; `ask-store.test.ts`; `ask-response.test.ts`; `client/analytics.test.ts` | `onboarding.spec` eight-screen walk + skip walk |
| F-NUMBERS (gated) | `learn-numbers.test.ts`; `seo-meta` | `/learn/numbers` + footer link |
| F-TREND (gated) | route tests (PGlite), erase/export, `a1c-over-time.test.ts` pins; `flag-server-twins.test.ts` | `journey.spec` rising/falling series + `expectRv3Clean` |

### 7.3 Rollout order and the flag

1. Merge PR-1 with the flag **unset** everywhere (no visible change). Preview deploys may set `NEXT_PUBLIC_GUIDE_DOOR=1` for review.
2. D5 reads the branch. Floor fails ⇒ stop; the merged code stays dormant behind the flag.
3. Ledger batch 1 `Approved` **and** `npm run eval:pal:ideas` green on the current `PROMPT_VERSION` (Task 4.1, pulled into PR-1 by review A-03) ⇒ set `NEXT_PUBLIC_GUIDE_DOOR=ideas,source` in production (reviewed build + deploy; `calm` joins once the F-CALM colour review is recorded, A-35/A-40; production never carries `1`, A-64). From this moment `ideas_shown`, `idea_tapped`, `idea_check_completed` and the existing `check_completed` feed §9.1. **D6:** the landing's §3 line ships in this same deploy, never with PR-1 — the plan's default is "stale until the branch is read", and the flag flip is the first moment the landing can describe a door that is on (§8 item 11).
4. PR-2, PR-3 … merge as they are ready. Because the flag is shared, once production has it on, every later surface renders the moment its PR deploys — **under amendment A-04 the flag names the surfaces it opens, so a PR whose rows are still `Pending` merges freely and its surface joins the production value only when its batch is `Approved`.** (If the owner strikes A-04 at the gate, the prior rule returns: once the flag is live, a PR with `Pending` rows does not merge to `main`; hold it or split the flag — Open questions #12.)
5. Number branch: same steps, order per §2.2.
6. F-TREND: server twin first (`A1C_ENTRIES_ENABLED=1`), then the client flag, per the WS-5 pattern.
6b. **Migrate before PR-3 deploys (review A-98):** drizzle's insert lists every schema column, so once `profiles.orientation` is in `schema.ts` a `POST /api/profile` or an account export against a database without `0019` fails — with the flag off. Production migration is the manual `npm run db:migrate:production`; CI migrates only its own Postgres. Order: apply `0019` to Neon and run `npm run db:governance:check` **before** PR-3's deploy (or ship the migration as its own PR first). Never the other way round.
7. **Post-deploy verification (review A-36), first five minutes then first hour, after any deploy that changes the flag's value:** `GET /api/health` → `guideDoor` shows the expected surfaces on · `/home?stay=1` at 375×667 shows three chips and the check CTA's bottom edge on screen · a chip tap lands on `/check` with the idea in the field · a flag-off surface is unchanged (`/demo` renders the source lead-in only when the door is on) · `ideas_shown` arrives in Umami within the hour (if it does not, assume analytics is blind — the 2026-07-22 CSP blackout precedent — before assuming nobody visited) · after PR-3, `/learn/first-week` returns 200 and `/learn` 404s until PR-5.
8. **Revert (§9.2 kill line or any incident):** unset `NEXT_PUBLIC_GUIDE_DOOR`, rebuild, redeploy — the front door reverts to the check; no data migration is needed (`pal.*` keys are ignored when the flag is off; `profiles.orientation` is inert). This costs a reviewed rebuild, not an env flip — the price of having no server twin. On Vercel that is: unset the variable in project settings, redeploy the current commit, about five minutes; rehearse it once on a preview before the first production flip so the revert is a known path, not a first attempt (review, Section 9). F-TREND's server twin *is* an env flip.
9. **Retire the flag (review A-37):** once kill line 2 has been read at four weeks and the door stays, one PR deletes the flag-off branches, the smoke skip guards, the `DESIGN.md` §8 "flag off restores the previous ordering" clause and the env row; the guide door becomes the default design and `guideDoorEnabled` is gone. Until that PR, every off-branch is a live code path and the flag-off smoke run stays in CI.

### 7.4 What is measured, and where to read it

Umami events → PRD §9.1 rows: `ideas_shown` vs `check_completed` (ideas viewed : checks run, per session; "opened before the first check in most sessions"), `idea_tapped` → `idea_check_completed` (idea → check taps, non-zero and rising), `onboarding_step{step:"attribution"}` sessions ÷ `onboarding_started` (the F-ASK 70% floor over the first 50 starts after the screens go live, against the six-screen baseline the event collects from PR-1; the per-screen counts locate the drop — Task 6.7), `learn_opened{page:"numbers", from:"result_footer"}` (Learn: numbers from the result footer), `orientation_step_done` by step (completion beyond day 1), `intake_ask` (the first real-user check on the Reddit ranking). Kill line 2 — **plan default changed by review A-95, owner rules in UC1:** "opened" is read as **tapped**: sessions with `idea_tapped` ÷ sessions in which a block rendered, per `surface`, < 25% after four weeks. The impression form (`ideas_shown` ÷ sessions) cannot discriminate once the row sits on `/check`, the page every landing CTA reaches — it reads ~100% of `/check` sessions by construction. The impression count stays as the denominator. Previously: **read only once at least 100 sessions have rendered a block, and the four-week clock starts on the first day Phase 5 traffic exists, not at the flip (review A-41; [A], a floor chosen here — Codex 5 and Claude F1/F4 both found the line unreadable without a sample rule and a traffic source). Beside it, `idea_tapped` sessions ÷ block-rendered sessions, the action the impression count cannot see.** Read beside it (review A-15): the share of non-founder users with a check on 2+ distinct days — the owner's own 2026-07-10 evidence checkpoint — so the door is judged on return, not only on exposure; exposure can rise while nobody comes back. The query (review A-65): signed-in users other than the founder with checks on ≥ 2 distinct calendar days since the flip (`checks` grouped by `user_id`, `count(distinct day) ≥ 2`, read weekly); guests cannot be joined across days, so their proxy is `check_completed{first_check:false}` ÷ `check_completed{first_check:true}` in Umami. Both are reads *beside* kill line 2 — neither flips the flag on its own. **The four reads live in `docs/ops/launch-controls.md` §13 (review A-34), added in PR-1:** ideas-shown sessions ÷ sessions (kill line 2) · `idea_tapped` → `idea_check_completed` · `onboarding_step` by screen (the F-ASK floor and its baseline) · `orientation_step_done` by step — each with the Umami view that produces it, so "the owner reads the counts" has one place to read from. Nothing measures A1C, glucose, weight or any health outcome, and nothing will.

### 7.5 The safety-owner batch

Batch 1 (PR-1, eight rows, all filed in Task 1.7 — A-119): `guide-ideas-breakfast`, `-lunch`, `-dinner`, `guide-ideas-hero`, `result-source-lead`, `check-empty-ideas`, `check-from-idea`, `check-classics-hint-guide`. **The W-05 backlog (fifteen live rows still `PENDING RD/CDCES`, nine of them the `clinical-*` routes) is in the same reviewers' queue; agree the turnaround with that queue in view, and decide with batch 1 whether the bank also waits for a dietitian pass (taste decision A-49).** Batch 2 (PR-3…PR-6): orientation rows, `learn-first-week-intro`, `journey-where-you-are`, `onboarding-*` rows (not `onboarding-a1c-learn-link`, which is gated with F-NUMBERS), `home-quick-row`, `learn-tiles`, `guide-ideas-later`, `home-door-worried-line`, `home-check-hero-title` (Task 5.5), plus F-REFER's three if cleared; `guide-ideas-see-all` rides with PR-4 under `ideas-full`. Gated later: `learn-numbers-*` (class per D7) with `onboarding-a1c-learn-link`, `a1c-over-time-*`, `doctor-q-*`, `starter-pattern-*`, `how-it-works-same-read`. Agree a review turnaround before PR-1 starts (PRD §11.1). **Submit batch 2 for review when PR-3 opens, not when it is ready to merge**, so review and build overlap and the shared flag's merge rule (§7.3 step 4) rarely bites; split the flag only if a PR actually waits longer than the agreed turnaround (§8 item 12).

---

## 8. Open questions for the owner

Where the PRD is ambiguous this plan did not invent an answer; each item states the default the plan uses so execution is not blocked. **2026-09-14:** options and recommendations were put to the owner. Item 1 is decided and the PRD ruling is amended. Items 3, 4, 8, 11 and 12 now use the recommendation as the plan's default, with the tasks edited as named. The rest record the recommendation for the owner to confirm or overrule.

1. **"Tour starts reaching the boundary step" (§7.5, §9.1) — DECIDED 2026-09-14, owner ruling amended.** The floor is read from a per-screen funnel event, `onboarding_step` (Task 1.9, widened in Task 6.1): starts reaching the attribution screen ÷ starts, first 50 starts after the screens go live, against the six-screen baseline the same event collects from PR-1. The fallback fires only when the drop sits on Screen A or B (Task 6.7). Rejected: completed ÷ started (cannot say which screen leaks, so the prescribed merge could land on the wrong screen; out-of-range exits count as drop-offs) and the literal boundary-screen count (only out-of-range users reach it).
2. **What earns "the rest of Tier 1" (§9 Step 1).** No threshold is named. Plan default: PR-2 and PR-3 proceed on merge readiness; PR-4…PR-6 wait for the owner to read the ideas-viewed : checks-run counts once, using §9.1's own yardstick, "opened before the first check in most sessions". *Recommended: keep this.* A number set now has no baseline and could block for months; no gate at all contradicts Step 1 and enlarges what kill line 2 reverts.
3. **Number/effort F-ASK picks while D7 is unresolved — plan default changed 2026-09-14.** The public guide `/guides/a1c-5-7-to-6-4` carries the disclaimer and passes the copy scan, but it has no ledger rows, no in-app surface links to any guide today, and it says "If your number landed in the middle band, here is how to think about it" — the D7 substance. Now: orientation step 1 and the Home door link the guide (both outside the tour); the link beside the A1C field waits for D7 and ships with F-NUMBERS (Task 6.5, §2.4.1). *Ask:* show the safety owner that sentence when D7 is put to them. Alternatives: hide every link until D7 (the top-ranked pain gets no destination), or link `/how-it-works` (explains labels, not ranges).
4. **The F-ASK response screen (§7.5 item 3) — plan default changed 2026-09-14.** "The screen after Screen B" would be the attribution screen. Now: the response line renders on Screen B itself beneath the pick, link-free, and Screen B advances on Continue (Tasks 6.3, 6.4). Eight screens stay. Alternatives: the expectations step (two screens away from the pick, and that screen already gains the ideas line) or a ninth screen (against the floor the owner just set).
5. **HIGH variant of the source lead-in (§6 F-SOURCE).** Verdict Semantics gives `Hold off` three prongs; the engine does not say which fired. Plan default: one sentence naming "unusually concentrated or too incomplete to read closely", with the reason rendered verbatim on the next line rather than lowercased after "because". *Recommended: keep this.* The PRD-literal single prong is false for the multi-starch case, the commonest `Hold off`; deriving the prong from precheck flags adds a heuristic to the safety path for one clause. The safety owner may add the catch-all wording at ledger review.
6. **Serve from the label cache on tap?** The PRD's "Open" paragraph leans toward serving it. Plan default: taps run live checks; the cache (PR-4) is review evidence. *Recommended: keep this.* Serving it would be a second result path that skips the model, telemetry, history and tier counting, and §9.1's idea → check measure would count non-checks. Revisit only if idea taps appear as a cost line.
7. **Where "See all →" and the Ideas quick action go (§7.6).** Plan default: expand the block in place; the Ideas quick action is the same toggle; no ideas page. *Recommended: keep this.* Build `/learn/ideas` when the bank outgrows a comfortable expansion or the owner wants ideas under Learn.
8. **Home hero copy — plan default changed 2026-09-14.** "What are you eating?" has no ledger row today. PR-1 leaves it untouched; PR-5 rewords it behind the flag to "Unsure about a meal?" as row `home-check-hero-title` (Task 5.5), which also closes the ledger gap. The number door's "the hero copy says so" is carried by the step line at the top of Home, not by the hero. Alternative: per-door hero copy (four variants for one line).
9. **`Hold off` colour (F-CALM a).** `--high-*` is byte-identical to `--danger`. Plan default: the neutral-ink family in Task 2.3, pending the colour-blind / "does this look like a warning" review. *Recommended: approve it, or name a warm-ink family.* Known cons: grey can read as disabled, and green · amber · grey is not a severity ramp — `DESIGN.md` §9 argues against ramps, and the label word plus the pause icon carry the meaning. Keeping red fails F-CALM as written.
10. **F-HABIT's tier.** Nudges are Premium today (`capabilities.nudges`). *Recommended: defer, as the PRD says.* When the gate opens, lean to one free, opt-in, seven-day reminder with other nudges Premium — if Phase 5 shows people do not return without it.
11. **D6 (landing) — plan default recorded 2026-09-14.** Stale until the branch is read; the §3 line ships in the same deploy as the flag flip (§7.3 step 3), never with PR-1 — the prototype is dark until batch 1 is approved, so the landing cannot advertise it, and `landing-hero-moment` (a row with a standing owner ruling and byte-pinned tests) is amended once, not twice. The owner's formal D6 choice still stands in PRD §10.
12. **The shared flag and mixed approval states (§7.3 step 4) — plan default recorded 2026-09-14; review amendment A-04 (taste) applied.** One env var, surface-listed (Task 1.1 amendment) — the merge rule below is then unnecessary and returns only if the owner strikes A-04. Original default: one flag. Batch 2 rows go to the safety owner when PR-3 opens, not when it is ready to merge (§7.5), so review and build overlap. Split the flag only if a PR actually waits longer than the agreed turnaround.
13a. **The quick row (user challenge UC5; both design voices).** Both outside design voices found the four-item row repetitive — Check is already the hero and the tab bar's puck, Journey is a tab, Ideas points at a block on screen; only Learn is new. Plan default keeps the PRD's four items, quiet and below the hero (A-54, A-74); the owner may drop it for a single "Learn" text link under the ideas, or keep three items. Related taste calls: `/learn` lists only learning content vs the PRD's seven tiles (A-81, default PRD); attribution before or after Screens A/B (A-87, default the owner's ruling because the floor is read at that screen).
13. **Competitive framing — owner action (review A-44; both outside voices).** Neither the PRD nor this plan names AI assistants, which answer "what can I eat" and "what does 5.9 mean" instantly, personally and for free, and PRD §11 has no competitor section. The honest answer to "why this over an assistant" is the boundary (no number, ever), a bounded bank a human reviewed, and the same read every time once the panel proves it — write that paragraph into PRD §11 before the flip. No code.

---

# /autoplan review record

<!-- generated by /autoplan on 2026-09-14 · branch main · commit 76eab01 · restore point in the first line of this file -->

**STATUS: APPROVED as-is by the owner at the final gate, 2026-09-14** (premise gate: option A; final gate: option A). Every taste default and the A-83 paywall default stand as written; user challenges UC1–UC5 are recorded with both sides for the owner to revisit. Next step: `/ship` per PR, starting with PR-1 (Tasks 1.1–1.14) merged dormant.

## Phase 1 — CEO review (mode: SELECTIVE EXPANSION, auto-decided)

### System audit

- **Recent history (30 commits):** docs reconciliation, dependabot bumps, the engine consistency fix `822f44e` (38% flip → 0%), landing line-art, the insights kill-switch probe. No prior review cycle touched the guide door; the last plan reviews on `main` were the 2026-07-09 video-engine eng review + codex review (`main-reviews.jsonl`, 2 entries).
- **Working tree:** 6 modified files (docs + `app/(app)/privacy/page.tsx` one-liner), ~60 untracked docs including this plan, both PRDs and the research handoffs. No stash. TODO/FIXME markers only in `app/fonts.ts`, `lib/coach/next-action.ts` (the `ponytail:` note the plan's Task 3.4 sits next to) and its test.
- **Hot files (30 days):** `docs/ops/launch-checklist.md`, `docs/ops/env-reference.md`, `package.json`, landing PNGs, `docs/ops/launch-controls.md`. The plan touches `env-reference.md` and `launch-controls.md` (F-SOURCE gate) — both are live documents with their own contract tests.
- **Design doc:** `~/.gstack/projects/Revora/tefera-main-design-20260709-051441.md` matches the branch pattern but is the July dashboard design; the real design input is `PRD/Prediabetes_Pal_Guide_Redesign_PRD_v1.1.md` (read in full) and `DESIGN.md` (read: §1 rails, §3 tokens, §8 shell, §9 progress, §10 recipes). No CEO handoff note.
- **Every file the plan modifies exists** (67 checked); the four `Create:` files do not, as expected. Claims verified against source: `dayKeyInTimezone`/`hourInTimezone` exist in `lib/coach/days.ts`; the account export selects the whole `profiles` row (`app/api/account/export/route.ts:63`) so `orientation` exports for free; `/check`'s textarea label is "What are you thinking about eating?" so Task 1.8's `getByLabel(/eating/i)` resolves; icons Leaf · CheckCircle · Compass · Bookmark all exist in `components/icons.tsx`; `.selectable-chip`/`.chip-row` match DESIGN.md §10; `--high-border` is byte-identical to `--danger` (`#b91c1c`) as Task 2.3 states; `PROMPT_VERSION` is `2026-08-16.1`; the drizzle journal ends at `0018`, so `0019_profile-orientation` is the next slot.
- **Two plan claims that do not hold:** (1) §5.3 F-PLAN quotes a "we never invent the rule" positioning line from `docs/product-marketing.md` — the line is not in that file; it comes from `docs/handoff/2026-09-11-four-audience-validation-report.md:326`. (2) Task 3.7 branches `tests/smoke/onboarding.spec.ts` on the final button's new name, but `tests/smoke/trial-wall.spec.ts:98` also clicks "Check my first meal" and is not mentioned — the flag-on smoke run fails there.
- **Prior learnings applied:** `revora-progress-surface-rules` (7/10, 2026-07-10) — the "Day N of your first week" eyebrow is utility copy, "{done} of 7 steps done" is an additive count, both pass; `dashboard-reassurance-surface` (8/10) — no per-day risk on Home, unchanged; `coach-window-35d-contract` (9/10) — Home's 35-day/500 query is not touched; `igstack-path-and-local-html-fallback` (8/10) — design binary present, auth unknown, HTML fallback available; `dashboard-full-shell-by-conviction` (10/10, user-stated) — the founder holds premises against independent challenges; this review reports challenges, it does not re-litigate rulings.
- **Landscape check (three layers).** [Layer 1] The tried-and-true prediabetes app is a scorer or a logger: GlucoSpike (0–10 meal score), Levels (CGM-paired), LOGI, MyDiabetes (meal plans + grocery lists); food diaries lose 50–70% of users in month one. [Layer 2] 2026 searches: Abbott's Libre Assist moves guidance to *before* the meal; vendor content says an app that will not pair with a CGM "is not a serious metabolic tool"; a DACH review finds the category crowded and hard to choose from. [Layer 3] This product's claims boundary forbids a number on any surface, which rules out the scorer posture the incumbents converge on — the constraint *is* the differentiation, and "ideas before rulings" is the shape that constraint forces. Conventional wisdom (give them a number) and first principles (the number is the one thing this product may not give) disagree — logged as a eureka.
- **Taste calibration.** Style references: `lib/coach/next-action.ts` (pure, three branches, documented), `lib/client/analytics.ts` (closed union + runtime allowlist + static no-PII scan), `tests/unit/pal/promise-registry.test.ts` (promise → proof, model-free). Anti-patterns to avoid repeating: `app/globals.css` at 4,823 lines with appended blocks (TODOS records the consolidation debt — the plan's new rules go next to `.meal-hero`, not at the end); `components/food-check-form.tsx` at 638 lines, the file the plan grows again (`recheckSource`, the ideas row) — acceptable, but it is where accretion lands.
- **Retrospective.** Areas previously problematic that the plan re-touches: the flag twin guard (AUD-002, `next.config.ts:33-61`) — the plan deviates deliberately; landing/ledger drift (four reviews missed an unledgered claim, `DESIGN.md` §1.1) — the plan's "every string is a row" rule is the answer, and Task 5.5 closes one existing gap (`home-check-hero-title` had no row).

### 0A. Premise challenge

| # | Premise (stated or assumed) | Evidence | Verdict |
|---|---|---|---|
| P1 | People ask for meal **ideas** ~4× more often than a **ruling** on one plate, so ideas should lead | 1 vs 4 of 60 under an independent rubric [M]; 4 of 240 across audiences; PRD §11 Risk 2 concedes it rests on one count | **Provisional.** Reasonable; the plan already makes the concierge count the branch and kill line 2 the revert. Accept as a bet, not a fact. Both outside voices call it *assumed* (forum questions are not tool use; the research's own §6c marks the finding "Weakened") → premise gate |
| P2 | The front door can change without touching the engine, labels or claims boundary, so the safety posture carries over | Every new sentence is a bounded bank + ledger row; engine files are pinned by `engine-regression.test.ts`; verified the plan never edits `lib/pal/prompt.ts`, `labels.ts`, `boundary-copy.ts` | **Holds** |
| P3 | Five people, a 3-of-5 second-question floor and one count are enough to choose the door | PRD §9 Step 0 tags it [A] and calls it "a signal, not a proof". Codex: it measures human helpfulness, not product demand | **Weaker than it looks.** Both voices: at the four-audience report's own proxies (§5.1 Pass A ≈ 50% within 48 h, Pass B ≈ 82% within 7 days) "3 of 5 within 48 h" passes by coin flip or by formality, and every branch but one builds the food order → user challenge UC2 |
| P4 | One client build flag with no server twin is an acceptable revert lever | Repo convention is twin pairs (AUD-002). Plan's argument: no new server boundary in PR-1. By PR-3 there are new pages, a DB column and a PATCH field, but all are inert copy/UI, and the revert is unset + redeploy (minutes on Vercel). Search confirms build-time flags are not kill switches; the plan does not claim one | **Holds, with a mitigation** — see taste decision A-04 (surface list) and the runbook line in §7.3 |
| P5 | Every idea reads `Clear` at every band | True **after** Task 4.1's live eval — which sits in PR-4, while §7.3 step 3 flips the flag to production after PR-1. Task 1.2's own comment says the peach lines "are the ones most likely to fall at band 63_64" | **Wrong as sequenced.** The prototype can suggest an idea the engine then labels `Be careful` on the product's most trust-critical surface → A-03 |
| P6 | Home stays "one action for today" with an ideas block, a quick row and a step line added around the hero | DESIGN.md §8 amended in Task 1.7; Task 1.8 pins the CTA above the fold with the ideas block; nothing re-budgets the fold when PR-5 adds the quick row | **Holds if the fold is budgeted** → A-09 |
| P7 | F-ASK's two screens are worth an eight-screen tour on a zero-user product | Owner ruling 2026-09-13, kept against two independent challenges; floor + per-screen funnel + fallback are instrumented (Tasks 1.9, 6.7) | **Owner's decision — not re-litigated.** Reported only if both outside voices independently challenge it |
| P8 | A guest's orientation week can key off `profileStore.onboardedAt` | `persistA1c()` writes the profile only when `a1cValue !== null`; a guest who skips the A1C step (or a returning guest) has no `onboardedAt`; `OrientationState` has no `startedAt`; no other on-device timestamp exists (`taster.firstDay` is set only by a taster check) | **Wrong.** Those guests never start the week → A-05 |
| P9 | The concierge test will run | D5: rules page unread, draft unsent, 3–4 weeks end to end | **Open risk.** The plan already answers it (PR-1 merges dormant; effort is small with CC). Accept. Claude voice F7: the mod draft promises "no product, no link, nothing sold" while the concierge anchors answers to "Prediabetes Pal's rules" and Phase 5 launches in the same subreddit — an owner note at the gate (A-50) |
| P10 | Home is the session-1 front door | All four landing CTAs (`app/page.tsx:257, 679, 1313, 1601`) and the TWA `startUrl` go to `/check`; `completeTour()` lands on `/check` until PR-3; only the installed PWA (`start_url: /home`) and returning signed-in users open Home first | **Wrong for PR-1's measurement** (Claude voice F1, verified). The block must also sit where session-1 users land → A-42 (Task 4.2 into PR-1) and `ideas_shown.surface` (A-41) |
| P11 | A five-line-per-daypart bank can hold a front door | Three shown per load, stepping by one: consecutive loads overlap on two of three ideas; a returning user has seen the whole daypart by the second visit | **Thin** (Claude voice F8). A-43 makes consecutive loads disjoint (six per daypart, page-stepped rotation); PR-4 grows the bank; whether a starch-free positive list reads as a *supplied default pattern* (D1) is a question for the safety owner → premise gate |

**Is this the right problem?** The outcome that matters is: a newly diagnosed person finds something useful in the diagnosis week and comes back for a *second* meal decision. The plan's most direct path to it is PR-1 + F-ORIENT; the rest is sequenced behind the owner's read. The one proxy-metric risk is real (Codex item 5): kill line 2 counts *exposure* (ideas shown in ≥25% of sessions). The founder's own 2026-07-10 evidence checkpoint — non-founder users with checks on 2+ distinct days — is the return measure this plan should read beside it → A-15. **Doing nothing** keeps the judge door, which the research says answers one post in sixty; with zero users the cost of doing nothing is unknown, and the concierge test is the cheapest way to learn it — the plan already puts it first.

### 0B. Existing code leverage

| Sub-problem | Existing code | Plan reuses it? |
|---|---|---|
| Flag module | `lib/meal-memory-flag.ts` (exact `"1"`) | Yes — same shape, new file |
| Bounded bank + rotation | `lib/pal/coach-outputs.ts`, `lib/client/coach-rotation.ts` | Pattern yes; the 25-line counter is duplicated with a different fallback (`0` vs `undefined`) — accepted, see A-23 |
| Tap → check hand-off | `pal.recheck` in `home-check-hero.tsx` + the prefill effect in `food-check-form.tsx:138-165` | Yes |
| Daypart | `daypartOfHour` (`lib/coach/insights.ts:41`) | Yes |
| Deterministic cleanliness | `classifyInputBeforeModel`, `classifyClinicalRisk`, `CARB_FORWARD_TOKENS` | Yes (tests) |
| Segment steering | `lib/client/first-check-chips.ts` `CHIPS_BY_SEGMENT` | Pattern yes (Task 4.3) |
| Hydration gate | `lib/client/use-hydrated.ts` | Yes |
| Analytics allowlist + no-PII scan | `lib/client/analytics.ts`, `tests/unit/client/analytics.test.ts` (the `photo_draft` end-marker slice) | Yes, extends in place |
| Next-action line | `lib/coach/next-action.ts` | Yes, extends |
| Day math | `lib/coach/days.ts` `dayKeyInTimezone`, `hourInTimezone` | **No** — `orientationDay` rolls its own `localMidnight`, wrong on the server → A-06 |
| Guest state + tests | `profile-store.ts`, `first-run-gate.test.ts` fake-storage bootstrap | Yes |
| Signed-in prefs | `app/api/profile/route.ts` PATCH (`NudgePrefsSchema` → `ProfilePatchSchema`) | Yes, but the handler cancels pending nudge attempts on **any** mutation → A-07 |
| Erase / export | whole-row delete and `.select()` | Yes (verified) |
| Private routes | `app/robots.ts` `DISALLOWED_PATHS`, `seo-meta.test.ts` | Yes |
| Chips, icons, radius scale | DESIGN.md §10 recipe, `components/icons.tsx`, 24/22/18/14/999 | Yes |
| Learn content | `app/guides/a1c-5-7-to-6-4`, `prediabetes-now-what` | Yes (promotion + boundary pass) |
| Ledger + audit | `copy-ledger.md`, `claims-boundary-copy.test.ts` `EXTRA_SOURCES` | Yes |
| Consistency evidence | `scripts/consistency-check.mjs` (one meal; needs `--cases`) | Yes (F-SOURCE gate) |
| Live eval convention | `tests/evals/pal-safety-eval.test.ts`, `PAL_LIVE_EVAL=1` | Yes (Task 4.1) |
| Reminders | `lib/server/nudge.ts`, `capabilities.nudges` | Yes (F-HABIT, gated) |

Nothing is rebuilt in parallel. `ask-store`, `orientation.ts` and `home-door.ts` are new because nothing equivalent exists.

### 0C. Dream state

```
  CURRENT STATE                        THIS PLAN                                   12-MONTH IDEAL
  Judge front door: hero check,   ---> Guide front door behind one flag:      ---> A diagnosis-week companion people
  Today card, one line. Guides         ideas block, source lead-in, calm          return to for each NEW meal decision:
  public only. Zero users. Nothing     tokens, orientation week + /learn/          ideas steered by segment + daypart +
  measures return.                     first-week, quick row + /learn index,       last week's checks; an in-shell Learn
                                       door ordering, F-ASK intake. Gated:         library with a counsel-named education
                                       F-NUMBERS, F-TREND, F-REFER, F-DOCTOR,      class; a dated A1C list; one opt-in
                                       F-PLAN, F-HABIT.                            reminder; per-surface rollout control;
                                                                                   measurement that reads return-on-a-
                                                                                   new-occasion, not exposure.
```
Delta after this plan: no retention loop (F-HABIT deferred by design, PRD §6), exposure-heavy measurement (kill line 2), a coarse flag. The plan moves toward the ideal on every axis but retention, which the PRD defers on purpose.

### 0C-bis. Implementation alternatives

```
APPROACH A: As written
  Summary: one client flag, six PRs in §2.1 order, live label eval in PR-4, process rule for mixed ledger states.
  Effort: M (human ~3 weeks / CC ~1 day)   Risk: Med
  Pros: matches PRD §9 Step 1 exactly; smallest PR-1; every string ledgered
  Cons: prototype ships ideas whose model labels are unverified; server-side day math wrong for signed-in users;
        merge safety is a human rule once the flag is live; a guest who skipped A1C never gets the week
  Reuses: everything in 0B
  Completeness: 7/10

APPROACH B: Minimal viable — PR-1 + the label eval, then stop until the kill-line ratio reads
  Summary: ship the prototype with the eval as its gate; defer F-ORIENT, Home layout and F-ASK until the owner reads the counts.
  Effort: S (human ~1 week / CC ~2 h)   Risk: Low technically, High strategically
  Pros: the smallest reversible bet; nothing waits on ledger batch 2
  Cons: drops G1's orientation half and G3 entirely; contradicts the PRD's own order (F-ORIENT is Tier 1, no gate);
        the owner's F-ASK ruling and the amended floor instrument would sit unbuilt
  Reuses: same
  Completeness: 4/10

APPROACH C: As written + the defects closed  ← RECOMMENDED
  Summary: A, plus: label eval gates the PR-1 flag flip; orientation state carries `startedAt`; day math uses the profile
           timezone; PATCH nudge-cancel scoped to nudge keys; `idea_tapped.slot` widened for "See all"; fold budget
           table for 375×667; `/api/health` reports the door; trial-wall smoke branch; empty-bank guard;
           hydration-gated guest read; return-on-a-new-occasion read beside kill line 2; and (taste) a surface-list flag.
  Effort: M (+ CC ~1 h over A)   Risk: Low
  Pros: every add is < 5 files, in blast radius, and closes a defect rather than widening scope; the rollout rule
        becomes mechanical
  Cons: one more signature parameter on the flag; the surface-list is a deviation from the plan's "one flag" wording
  Reuses: same, plus `dayKeyInTimezone`, `flagTwinStates()`
  Completeness: 9/10
```
**RECOMMENDATION: C** — completeness is near-free with CC (P1), and each add is the explicit fix a new contributor reads in thirty seconds (P5). A and C are not close: C is A with its defects closed. B is rejected because it re-argues scope the PRD and the owner already fixed.

*Addendum from the outside voices (alternatives the plan never costed):* **launch first on the current check-first door** (strategy — premise gate); **a two-headline landing test, n ≥ 200 per arm, instead of five people** (strategy — premise gate; needs Phase 5 traffic either way); **ideas derived from the engine's own swap/adjustment line** (rejected — an adjustment corrects one plate, it cannot seed a menu, and it would put model text on the front door); **an emailed seven-day orientation that doubles as acquisition** (rejected for this plan — consent, a cron and deliverability are more infrastructure than a nullable jsonb column; noted for F-HABIT's gate).

### 0D. SELECTIVE EXPANSION analysis

**Complexity check.** PR-1 touches 18 files (its own table), above the 8-file smell line. Challenge: the irreducible prototype is flag · bank · rotation · component · mount · analytics (module + test) · three unit tests · ledger/env/DESIGN docs · smoke = 15; the remaining three are F-SOURCE (`result-card.tsx` + its pins) and the tour funnel event (Task 1.9), both put in PR-1 by the PRD's owner amendment. Each file has one responsibility; the count is essential, not accidental. **Accepted as-is.** New modules: `guide-door-flag`, `guide-ideas`, `ideas-rotation`, `GuideIdeas` — four, each < 60 lines.

**Minimum set that achieves the goal.** PR-1 (with the eval) is the minimum that produces the kill-line ratio. PR-2…PR-6 are already sequenced behind the owner's read (§8 item 2). Nothing further can be deferred without contradicting the PRD's tiering.

**Expansion scan (candidates, not scope).**
- *10× check:* the guide that remembers — ideas steered by segment + daypart + what the user checked last week, and the diagnosis-week companion with F-ORIENT + F-REFER + F-DOCTOR live together. Both sit behind D2/Phase 5 reads; out of blast radius. Noted for the 12-month column only.
- *Delight (≥5):* (i) "one of today's ideas" note on the result card after a tapped check; (ii) `/api/health` reports the door state; (iii) "Hide this for now" on Home's step line, not only on `/learn/first-week`; (iv) `See all` remembers its expanded state per device; (v) the ideas block hides itself when a daypart bank is empty instead of rendering an empty row; (vi) Enter on a focused chip navigates — native `<button>` already does it, no work.
- *Platform potential:* `learn_opened` + `/learn` become the home of every later Learn page (in plan); a surface-list flag becomes the rollout tool for every later guide surface.

**Cherry-pick ceremony (auto-decided by the blast-radius rule; each is a row in the audit trail):**

| # | Candidate | Radius | Decision |
|---|---|---|---|
| E1 | Task 4.1 label eval runs in PR-1 and gates the production flip | 3 files, in radius | **ADD** (A-03) |
| E2 | Surface-list flag (`NEXT_PUBLIC_GUIDE_DOOR=1` = all, or a comma list) replacing the §7.3 step 4 process rule | 2 files + a parameter at every call site | **TASTE → gate** (A-04); applied as an amendment the owner can strike |
| E3 | `OrientationState.startedAt` so A1C-skippers get the week | 2 files | **ADD** (A-05) |
| E4 | `orientationDay` takes a `DayKeyFn` (profile timezone on the server, local for guests) | 2 files | **ADD** (A-06) |
| E5 | PATCH cancels nudge attempts only when a nudge key is in the body | 2 files | **ADD** (A-07) |
| E6 | `idea_tapped.slot` widened to `"1"…"6"` or the chip count sent as a bucket | 1 file | **ADD** (A-08) |
| E7 | Fold budget table for 375×667 with the quick row, in §3 | plan only | **ADD** (A-09) |
| E8 | `/check` empty state: two suggestion rows (classics + daypart ideas) | 1 file | **TASTE → gate** (A-10); plan default kept |
| E9 | `/api/health` `flagTwins` gains `guideDoor` | 1 file + test | **ADD** (A-11) |
| E10 | Empty-bank guard in `ideasFor` / `GuideIdeas` | 1 file | **ADD** (A-12) |
| E11 | "One of today's ideas" note on the result card | 1 file + 1 ledger row | **DEFER → TODOS.md** (A-13): new copy costs safety-owner time; wait for the ratio |
| E12 | Dismiss control on Home's step line | 1 file | **DEFER → TODOS.md** (A-14): changes Home's one-line rule; design call |
| E13 | Read "checks on 2+ distinct days" beside kill line 2 | 0 files | **ADD** (A-15) |
| E14 | `trial-wall.spec.ts:98` branches on the flag like `onboarding.spec.ts` | 1 file | **ADD** (A-16) |
| E15 | `home/page.tsx` reads `onboardedAt` + `orientation` in the **same** select as `timezone` | 1 file | **ADD** (A-21) |
| E16 | `GuestDashboard` reads `orientationStore` only after `useHydrated()` | 1 file | **ADD** (A-20) |

### 0E. Temporal interrogation (human hours; CC compresses ~10–20×)

```
HOUR 1 (foundations)   `vi.stubEnv` works because guideDoorEnabled() reads env at call time — keep it a function, never a
                        module constant. The no-PII scan bans "food" in analytics.ts comments; write "idea"/"meal".
                        Insert every union member BEFORE `photo_draft` or the no-bare-string slice misses it.
HOUR 2-3 (core logic)  `ideasFor` with an empty daypart bank: `rotation % 0` is NaN → guard (A-12). StrictMode dev
                        double-fires the mount effect: rotation +2 and two ideas_shown in dev only — say so in a comment.
                        `SOURCE_LEAD` HIGH wording: plan default recorded (§8 item 5).
HOUR 4-5 (integration) trial-wall.spec.ts:98 fails flag-on (A-16). home/page.tsx: one select, not two (A-21). Server-side
                        orientationDay must use the profile timezone (A-06). PATCH wipes nudge attempts on a "Done" tap (A-07).
                        GuestDashboard: read orientation after hydration (A-20). A1C-skippers have no onboardedAt (A-05).
HOUR 6+ (polish/tests) The 375×667 fold with the quick row (A-09). "See all" breaks the slot enum (A-08). OrientationList's
                        fetch-failure state for a signed-in user is unspecified (→ Phase 2). Task 2.3's neutral-ink Hold off
                        can read as disabled — the pause icon + word carry it; colour-blind review pending (§8 item 9).
```

### 0F. Mode selection

**SELECTIVE EXPANSION** (autoplan override; the plan is an iteration on an existing system). Approach **C** applies. Committed for every section below.

### Scope expansion decisions (record)

- **Accepted:** E1, E3, E4, E5, E6, E7, E9, E10, E13, E14, E15, E16 (twelve adds, all < 5 files, all defects or zero-cost reads).
- **Taste (applied, surfaced at the gate):** E2 surface-list flag; E8 kept at the plan's default.
- **Deferred to TODOS.md:** E11, E12.
- **Skipped:** the 10× candidates (behind D2 / Phase 5); Codex's "sell a paid concierge service first" (A-17 — violates the recorded owner constraint `no-sync-sales-projects-only`, 10/10 user-stated).


### Step 0.5 — Dual voices (both ran; source = codex+subagent)

**CODEX SAYS (CEO — strategy challenge)** · `codex-cli 0.144.1`, read-only, 101k tokens. Overall **NO**: "an implementation plan for an unvalidated business proposition; it optimizes governed copy and UI sequencing before proving demand, differentiation, acquisition, or willingness to pay." Ten blind spots: (1) the concierge gate measures human helpfulness, not product demand; (2) the redesign dodges the dominant job (the person's own number) and tries to be a food-idea tool, a diagnosis-week service and a referral product at once; (3) it freezes engine, pricing and launch plan, the very things the ICP calls unvalidated; (4) "ideas before check" is not a moat — Google, a dietitian handout, Reddit and incumbents replicate it; (5) exposure is treated as value ("ideas shown in 25% of sessions" is a placement metric; pre-set cohorts and sample rules are missing); (6) a one-off content experience with no retention loop; (7) acquisition and willingness-to-pay displaced by UI work (the ICP prescribes a price ladder and a pre-pay landing test); (8) research gaps proceed as if contained; (9) the safety process is becoming the operating model — one shared flag means failure cannot identify its cause; (10) the dismissed alternative is a paid human-led concierge service. Verdicts: premises PARTLY · right problem NO · scope NO · alternatives NO · competitive NO · trajectory NO.

**CLAUDE SUBAGENT (CEO — strategic independence)** · fresh context, read the plan, the PRD, the ICP, the roadmap, the ledger and the code. Two critical, six high. **F1 (critical, verified):** PR-1 renders ideas only on Home, but every landing CTA, the TWA start URL and `completeTour()` land on `/check` — nothing sends a new guest to Home in session one, so kill line 2 is biased down by placement and up by counting impressions. **F2 (critical):** at the four-audience report's own proxies the 3-of-5 floor is a coin flip (Pass A ≈ 50%) or a formality (Pass B ≈ 82%), the branch is decorative (every outcome but one builds the food order), PR-1 merges before the read and Task 2.3 ships unflagged. **F3:** the guide demotes the only thing Premium sells (unlimited checks, `capabilities.ts:83`) and adds only free surfaces. **F4:** there is nobody to measure — Phase 5 has no date relative to the flip; the four-week clock and the 50-start floor need its traffic. **F5:** the bank's safety case names a dietitian, but the gate is safety-owner `Approved`; fifteen live rows are still `PENDING RD/CDCES (W-05)`. **F6:** orientation step 1 and the Home numbers door link the public A1C guide in-app while D7 is open, and that page says "If your number landed in the middle band…". **F7:** the r/prediabetes mod draft promises "no product, no link, nothing sold" while the concierge anchors to "Prediabetes Pal's rules" and Phase 5 launches in the same subreddit. **F8:** sixteen starch-free lines read as a low-carb default (D1 territory) and are exhausted in three loads; AI assistants are unnamed as competitors; the ICP's food-sequencing bet is dropped without comment. 10× reframings: (a) put the idea → prefilled-check hand-off on the public guides, where search traffic already lands; (b) own the allowed answer to the biggest pains (visit prep: F-REFER/F-DOCTOR) instead of six PRs for food. Alternatives never costed: launch first on the current door; a two-headline landing test (n ≥ 200 per arm); ideas from the engine's own swap line; an emailed seven-day orientation. Verdicts: premises PARTLY · right problem PARTLY · scope NO · alternatives NO · competitive NO · trajectory NO.

```
CEO DUAL VOICES — CONSENSUS TABLE:
═══════════════════════════════════════════════════════════════
  Dimension                           Claude  Codex  Consensus
  ──────────────────────────────────── ─────── ─────── ─────────
  1. Premises valid?                   PARTLY  PARTLY CONFIRMED (partly): the pain evidence holds; the leap to a self-serve door is assumed
  2. Right problem to solve?           PARTLY  NO     DISAGREE → premise gate (Claude: judge→guide is real but traffic/WTP-limited; Codex: wrong job)
  3. Scope calibration correct?        NO      NO     CONFIRMED NO → UC3 (too much sequenced before any user exists; PRD sized PR-1 at "one file, one component, one flag")
  4. Alternatives sufficiently explored? NO    NO     CONFIRMED NO → 0C-bis addendum + UC2/UC3 (launch-first, landing test, concierge design)
  5. Competitive/market risks covered? NO      NO     CONFIRMED NO → UC4 + A-44 (no competitor section; AI assistants unnamed)
  6. 6-month trajectory sound?         NO      NO     CONFIRMED NO → UC1 (a kill line that cannot fire; no retention loop by design; no WTP read)
═══════════════════════════════════════════════════════════════
CONFIRMED = both agree. DISAGREE = models differ (→ taste decision).
Missing voice = N/A (not CONFIRMED). Single critical finding from one voice = flagged regardless.
```

**Disposition of the voices' findings.**

*Auto-decided (mechanical, in blast radius):*
- **A-42** Task 4.2 (the `/check` empty-state ideas row) moves into PR-1 — the surface session-one users actually land on (Claude F1, verified: `app/page.tsx:257, 679, 1313, 1601`, `twa-manifest.json:14`).
- **A-41** `ideas_shown` carries `surface: "home" | "check"`; kill line 2 is read only once ≥ 100 sessions have rendered a block, and its four-week clock starts at the first day of Phase 5 traffic, not at the flip; `idea_tapped` sessions ÷ block-rendered sessions is read beside it (Claude F1/F4; Codex 5).
- **A-40** Task 2.3's tokens sit under `:root[data-calm]`, set from the flag's new `calm` surface, so the colour change ships dormant like everything else and reverts with the door (Claude F2; the A-35 gate row stays).
- **A-43** the seed bank is six per daypart and `ideasFrom` steps by `count`, so two consecutive loads are disjoint (Claude F8's exhaustion point, the cheap half).
- **A-45** the two second-person sentences on the public A1C guide are generalised (the plan's own §2.4.1 wording) before any in-shell link points at it (Claude F6).
- **A-44** §8 gains item 13: the PRD needs a competitor paragraph naming AI assistants and the "why this over an assistant" answer — an owner doc action, no code (Claude F8, Codex 4 — CONFIRMED).

*Taste (applied as the plan's default, surfaced at the final gate):*
- **A-49** Dietitian sign-off (W-05) as a flip gate for the bank: Claude says add it; Codex says the review machine is already the problem — they disagree. Plan default kept (safety-owner `Approved`), with the fifteen-row W-05 backlog named in §7.5 so the owner sees the queue.
- **A-51** Idea chips on the public what-to-eat guide behind a `guide` surface (Claude 10× a): search traffic exists today, Phase 5 traffic does not; recommended, the owner's call because it changes a marketing surface.

*User challenges (both voices; never auto-decided — final gate, owner's direction is the default):*
- **UC1 · Measurement.** Kill line 2 counts impressions; both recommend an action-based numerator (`idea_tapped`), a return read, a WTP read and pre-set sample rules. The plan keeps the PRD's `ideas_shown` line and adds the reads beside it (A-15, A-41); redefining the kill line itself is the owner's.
- **UC2 · The concierge test.** Both: as designed it cannot say "don't build". Recommended: pre-register a result that kills ideas-first (e.g. food < 25% of questions), log every question's type, use the 7-day return (Pass B) as the feasibility floor and the 48-h same-session rate (Pass A) as a separate read.
- **UC3 · Sequence.** Both: too much is built before a user exists. Recommended: Phase 5 traffic gets a date relative to the flip; PR-3 waits for the same counts PR-4 already waits for; Claude alone would also hold PR-1's merge until the read (the plan's "merge dormant" reading of PRD §9 Step 0 stands unless the owner says otherwise).
- **UC4 · Competitive framing and the number pains.** Both: the largest pains (own number, clinician gave nothing) get Tier 2 while food gets six PRs. Recommended: ask D2 now, in parallel with D5 and D7, so F-DOCTOR can ride with PR-3 if approved; treat F-REFER as default-in for PR-3.

*Rejected, with the reason:*
- **A-17** Codex 10 (a paid human concierge service first) — violates the recorded owner constraint `no-sync-sales-projects-only` (10/10, user-stated).
- **A-46** Claude F4's "make F-ASK's merged screen the default" — single voice; the owner kept F-ASK after two independent challenges (PRD §7.5 ruling), and the floor + fallback are instrumented.
- **A-48** an emailed seven-day orientation (consent, a cron, deliverability — more infrastructure than a jsonb column) and ideas derived from the engine's swap line (an adjustment corrects one plate; it is not a menu). Launch-first and the two-headline landing test are strategy, carried to the premise gate.

*Owner notes (no plan change):* **A-50** the mod-draft / concierge / launch-channel tension (Claude F7); **A-52** whether a starch-free positive-only bank counts as a supplied default pattern under D1 (Claude F8) — a question for the safety owner with batch 1.

**Phase 1 complete.** Codex: 10 concerns. Claude subagent: 8 findings (2 critical, 6 high) + 2 reframings + 4 alternatives. Consensus: 4/6 confirmed (all NO), 1 confirmed-partly, 1 disagreement → premise gate; 4 user challenges + 5 taste decisions → final gate. Passing to Phase 2 after the premise gate.

<!-- phase-1-voices -->

### Sections 1–11 (SELECTIVE EXPANSION; every finding auto-decided, rows A-24…A-39 in the audit trail)

#### Section 1 — Architecture review

**Dependency graph (new → existing):**

```
                 ┌──────────────────────────────────────────────┐
                 │ lib/guide-door-flag.ts  (build-time env, no   │
                 │ server twin; surface list under A-04)         │
                 └──────┬──────────────┬──────────────┬─────────┘
                        ▼              ▼              ▼
   components/dashboard-view.tsx   components/result-card.tsx   app/(app)/learn/*/page.tsx  notFound() when off
     ├─ <GuideIdeas/>  (client)      └─ SOURCE_LEAD[risk]        app/(app)/onboarding/page.tsx  askEnabled · final button · completeTour()
     ├─ <HomeQuickRow/> (PR-5)                                   components/home-check-hero.tsx  H2 (PR-5)
     ├─ <HomeDoor/>    (PR-5) ──► lib/client/home-door.ts doorFor() ◄── lib/client/ask-store.ts ◄── Screen A/B (PR-6)
     └─ "Day N" eyebrow (PR-3)
              │
              ▼
   lib/pal/guide-ideas.ts ──► lib/coach/insights.ts (Daypart, daypartOfHour)
   lib/client/ideas-rotation.ts (pal.ideas.rotation)
   lib/client/analytics.ts (+10 closed-enum events, all before `photo_draft`)
              │ tap
              ▼
   sessionStorage pal.recheck + pal.recheck.source ──► components/food-check-form.tsx prefill effect ──► POST /api/check (unchanged)
                                                        └─ idea_check_completed when the submitted text is the untouched prefill

   Orientation (PR-3)
   lib/coach/orientation.ts ◄── lib/coach/days.ts (DayKeyFn)          lib/coach/next-action.ts (+ orientation branch)
        ▲                     ▲                                        ▲
   lib/client/orientation-store.ts   app/(app)/home/page.tsx (server: profiles.timezone + onboardedAt + orientation, ONE select)
   (pal.orient.v1, pal.orient.note.v1)  components/guest-dashboard.tsx (client, reads after useHydrated)
        ▲
   components/orientation-list.tsx ──PATCH──► app/api/profile/route.ts ──► lib/server/db/schema.ts profiles.orientation (0019, nullable jsonb)
   components/orientation-note.tsx   (device only; pinned: never referenced under app/api, lib/server, lib/pal)
```

**Data flows, four paths each.** *Flow 1 — ideas render:* happy = clock → `daypartOfHour` → `ideasFor(daypart, rotation)` → three chips + `ideas_shown`; nil = no `window` (SSR) → placeholder heading + reserved 118px, hydrate, effect; empty = daypart bank empty → `[]` → block hidden (A-12); error = storage throws → rotation 0 → first three ideas (silent, by design). *Flow 2 — tap → check:* happy = `pal.recheck` + `.source` → `/check` prefilled → submit → result → `idea_check_completed`; nil = sessionStorage throws → navigates with an empty field (silent; identical to the hero today); empty = impossible (bank lines non-empty by test); error = `/api/check` fails → existing `mapCheckFailure` card, no completion event (correct). *Flow 3 — guest orientation:* happy = `pal.orient.v1` → strict parse → `orientationDay(startedAt, dayKeyLocal)` → step; nil = no key → `EMPTY` → `start()` stamps → day 1; empty/corrupt = parse fails → `EMPTY` (tested); error = storage throws → `EMPTY` every visit, `start()` never persists → "Day 1" forever on a storage-less device (silent, known ceiling, documented in A-24's comment). *Flow 4 — signed-in orientation:* happy = `profiles.orientation` → parse → day from `startedAt ?? onboardedAt` with `dayKeyInTimezone`; nil = null column → `EMPTY` + `onboardedAt` fallback; empty/corrupt = **the plan reads the jsonb without validating it** → A-24 (parse through `OrientationStateSchema`, fall back to `EMPTY`); error = DB throws → the page's existing error boundary (`app/(app)/home/error.tsx`). *Flow 5 — `OrientationList` on `/learn/first-week`:* the plan probes `GET /api/profile` and branches on 401; a 5xx or a network failure for a signed-in user is unspecified → A-33 (the server page already knows the session; pass `mode` + `initialState` as props and drop the read; writes stay PATCH with an optimistic toggle + revert, specified in Phase 2). *Flow 6 — `PATCH {orientation}`:* nil body → 400 (existing); empty object → 400 (existing); bad enum → 400; DB error → 500 → client must revert (Phase 2). *Flow 7 — tour funnel:* step change → `trackedStep` → `track`; "welcome" never fires; umami absent → no-op. *Flow 8 — F-ASK:* picks → `askStore.set` (strict) → `intake_ask`; corrupt key → null → default door; the reorder happens after hydration (CLS — Phase 2).

**State machine — the orientation week:**

```
   [no key] ──first flagged Home visit / tour end (A-05)──► { startedAt: t, done: [], dismissedAt: null }   day = f(startedAt, dayKey, now)
                                                                     │ markDone(id) — idempotent, keeps tap order
                                                                     ▼
                                                          { done: [ids…] } ── all seven ──► currentStep = null   (week complete)
                                                                     │ dismiss()
                                                                     ▼
                                                          { dismissedAt: t' } ──► currentStep = null              (no un-dismiss control — see A-26)
   any state ── day > 7 ──► currentStep = null (week over; state kept, inert)
   Impossible: an id outside 1..7 (schema → EMPTY on read, 400 on write); startedAt moving (start() is once-only); a second week (no reset; flag off ignores the key).
```

**Coupling.** New edges: `dashboard-view` → flag (a build constant); `result-card` → flag; `next-action` → `orientation` (type only); `app/api/profile` → `lib/coach/orientation` (same direction `app/api/coach` already takes into `lib/coach`); `home/page` → `orientation` + `days`; onboarding → `ask-store` ← `home-door` (leaf module, no cycle — the plan pre-empted it). The one coupling that is *product*, not code: Home's composition now depends on an intake answer (`HomeDoor`), justified by PRD §7.5.

**Scaling.** Static banks, client rendering, one widened select, one rare PATCH. Nothing new is hot at 10× or 100×; idea taps hit `/api/check` under the existing 20/h IP bucket. **Single points of failure:** OpenAI (review-time eval only, fails loud); Umami (the kill line is unreadable if analytics is blind — the 2026-07-22 CSP blackout in TODOS.md is the precedent → A-36 post-deploy check); Vercel rebuild for the revert (→ rehearsal, §7.3 step 7).

**Security architecture.** One new mutation (`PATCH {orientation}`, session-scoped by the existing `where userId`, strict schema, ≤ ~200 bytes). Three static pages with no input. No new endpoint until F-TREND (gated, outlined with encryption + erase + export tests).

**Production failure scenarios, one per integration point.** (1) `completeTour()` → `router.push("/home")` with the flag on: if `profileStore.set` threw (storage disabled), `FirstRunGate` sees no profile, no history, no taster → `router.replace("/onboarding")` → the tour repeats — **a loop the current `/check` target cannot enter, because `/check` has no gate**. Fix: push `/home?stay=1`, the escape hatch the skip path already uses → **A-28**. (2) Label eval: a provider `retry`/timeout in one of the three runs fails the cell and the plan says the idea is pruned by hand — a transient error would silently shrink the bank → **A-27** (inconclusive ≠ failed; re-run the cell, prune only on a non-`SAFE` result). (3) PATCH 5xx → Phase 2 revert spec. (4) Vercel build fails during the revert → rehearsed on preview first (§7.3 step 7).

**Rollback posture.** Before the flip: PR-1 is dormant; `git revert` is enough. After: unset + redeploy, ~5 minutes; `0019` is a nullable column and stays; `pal.*` keys are ignored when the flag is off. Reversibility 4/5.

**What would make it beautiful.** The surface list (A-04) makes each `guideDoorEnabled("orient")` call read as documentation, and it becomes the rollout tool for every later Learn surface. `orientation.ts` is data-first (steps as an array) and pure; `doorFor` is a ten-line switch. The wart that stays: two 25-line rotation counters (A-23).

**Findings:** [P1] (9/10) server day math ignores the profile timezone — closed by A-06. [P1] (9/10) A1C-skipping guests never start the week — A-05. [P1] (8/10) tour-completion loop under storage failure — **A-28**. [P2] (8/10) unvalidated server read of `profiles.orientation` + a NaN day if a bad date ever reaches `orientationDay` — **A-24**. [P2] (7/10) double-tap on a chip pushes `/check` twice — **A-25** (a `navigatingRef` guard, two lines). [P2] (8/10) `OrientationList`'s 401-probe design — **A-33**. [P3] "Hide this for now" is permanent while its copy says otherwise — **A-26**, carried to Phase 2.

#### Section 2 — Error & Rescue Map

```
  METHOD/CODEPATH                         | WHAT CAN GO WRONG                              | EXCEPTION CLASS
  ----------------------------------------|------------------------------------------------|---------------------------
  nextIdeasRotation()                     | localStorage throws (private mode, quota)      | DOMException SecurityError / QuotaExceededError
  GuideIdeas.pick()                       | sessionStorage throws                          | DOMException
  ideasFor()                              | empty daypart bank                             | (NaN, not thrown) — guarded A-12
  food-check-form prefill effect          | sessionStorage throws                          | DOMException (existing rescue)
  orientationStore.read()                 | corrupt JSON · schema mismatch · storage throws| SyntaxError · ZodError · DOMException
  orientationStore.write()/start()        | storage throws                                 | DOMException
  orientationDay()                        | invalid startedAt                              | RangeError from Intl (dayKeyInTimezone) or NaN (dayKeyLocal) — A-24
  home/page.tsx select                    | DB unavailable                                 | (drizzle/pg error) — existing error boundary
  home/page.tsx profiles.orientation read | jsonb not matching the schema                  | — (no parse in the plan) — A-24
  PATCH /api/profile {orientation}        | invalid body · DB error                        | ZodError → 400 · pg error → 500
  OrientationList GET /api/profile        | 5xx · network                                  | TypeError (fetch) · non-401 status — removed by A-33
  OrientationList PATCH                   | 5xx · network                                  | TypeError · non-2xx — Phase 2 spec
  completeTour() → /home                  | profileStore.set threw → FirstRunGate loop     | DOMException upstream — A-28
  guide-ideas-label-eval (checkFood)      | OpenAI timeout · 429 · malformed · refusal     | kind:"retry" / thrown — A-27
  askStore.get()                          | corrupt                                        | SyntaxError · schema → null
  track()                                 | umami absent                                   | — (no-op by design)
  /learn/* with flag off                  | —                                              | notFound() → 404 (intended)

  EXCEPTION CLASS / PATH                  | RESCUED?     | RESCUE ACTION                                  | USER SEES
  ----------------------------------------|--------------|------------------------------------------------|-------------------------------
  rotation storage throws                 | Y            | return 0                                       | first three ideas (silent, fine)
  pick() storage throws                   | Y            | navigate anyway                                | empty /check field (silent; same as hero)
  empty bank                              | Y (A-12)     | [] → block hidden                              | no ideas block
  orientation read failures               | Y            | EMPTY_ORIENTATION                              | day 1 / no progress (silent, tested)
  orientation write/start throws          | Y            | ignore                                         | "Day 1" every visit on a storage-less device — documented ceiling
  invalid startedAt                       | N ← GAP → Y  | A-24: schema-validated read + finite guard →   | before: "Day NaN of your first week" or a 500
                                          |              | week treated as over                           | after: no week
  unvalidated jsonb read                  | N ← GAP → Y  | A-24                                           | before: crash on a bad row · after: EMPTY
  PATCH 400/500                           | client: GAP  | Phase 2: optimistic toggle, revert, status line| before: toggle "sticks" while the server disagrees
  OrientationList read failure            | N ← GAP → —  | A-33 removes the client read                   | —
  tour-completion loop                    | N ← GAP → Y  | A-28: /home?stay=1                             | before: the tour again · after: Home
  eval provider failure                   | N ← GAP → Y  | A-27: re-run inconclusive cells; prune only on | before: an idea silently pruned · after: a
                                          |              | a real non-SAFE                                | recorded pruning with its reason
  askStore corrupt                        | Y            | null → default door                            | default Home (silent, fine)
```
No catch-all swallows a programming error on a request path: the storage `try/catch` blocks are the house pattern (`profile-store.ts`, `coach-rotation.ts`) and degrade to a documented state. For the one LLM call (the eval), malformed / empty / refusal all arrive as `kind !== "result"` and are now *inconclusive*, not *failed* (A-27).

#### Section 3 — Security & threat model

| Threat | Likelihood | Impact | Mitigated? |
|---|---|---|---|
| A user writes another user's orientation via PATCH | Low | Med | Yes — `where(eq(profiles.userId, session.userId))`, existing |
| Oversized / malformed orientation jsonb | Low | Low | Yes — strict zod, `done` ≤ 7 enums, two ISO strings |
| Health text reaches analytics | Low | High | Yes — closed enums, `onboarding_step` omits the A1C screen and the exit by design, static no-PII scan; `intake_ask` carries research categories, not free text |
| The clinician-questions note leaves the device | Low | High | Yes — device-only key, source walk pins that no file under `app/api`, `lib/server`, `lib/pal` names it, never interpolated into app copy (pin in Task 3.6) |
| Prompt injection through an idea | — | — | N/A — the bank is static and precheck-clean; the tap runs the ordinary check path with its existing patterns |
| XSS via idea text or the note | Low | High | Yes — React text nodes; the note renders only inside its `<textarea>` |
| PATCH spam | Low | Low | Unchanged — `/api/profile` has no per-user limit today; the field adds nothing hot |
| Unflagged colour change shipping before its review | Med | Med | **No** → A-35 (Task 2.3 gate row) |
| Privacy page silent on the new on-device note | Med | Low | **Verify** → A-29: `app/(app)/privacy/page.tsx` is in the dirty working tree right now; Phase 3 checks the on-device storage sentence covers `pal.orient.note.v1` |

No new secrets, no new dependencies, no new file paths, no new background jobs. Data classification: orientation state is product-usage data of the same class as `onboardedAt`; the note is potentially health text and is treated as such (device only). Audit logging: not warranted for step toggles; F-TREND's entries (gated) inherit the encrypted-at-rest + erase + export contract and are tested for it.

#### Section 4 — Data flow & interaction edge cases

```
  INTERACTION                | EDGE CASE                                  | HANDLED? | HOW
  ---------------------------|--------------------------------------------|----------|-----------------------------------------------
  Chip tap                   | double-tap                                 | GAP→A-25 | navigatingRef; second tap ignored
                             | navigate away mid-push                     | Y        | nothing pending; pal.recheck consumed on /check mount
                             | back to /home                              | Y        | remount → rotation +1 → new first idea (PRD acceptance)
                             | user edits the prefill                     | Y        | text ≠ prefill → typed check, no idea_check_completed
                             | 23:59 → 00:01 across daypart               | Y        | the idea keeps its daypart; heading only changes on remount
  Ideas block                | pre-hydration                              | Y        | placeholder + reserved height; heading swaps, no CLS
                             | zero ideas                                 | Y (A-12) | hidden
  Done toggle (guest)        | double-click                               | Y        | markDone idempotent
  Done toggle (signed-in)    | double-click · two tabs                    | Y        | PATCH is a set; last write wins
                             | offline / 5xx                              | GAP      | Phase 2: optimistic + revert + status line
  Start of week              | storage disabled                           | ceiling  | day 1 forever, documented (Section 2)
                             | DST change mid-week                        | Y (A-06) | day keys are calendar dates, not 24h spans
                             | profile timezone changed mid-week          | Y        | day may move ±1 once; acceptable
                             | week over with steps undone                | GAP→A-30 | the /journey line persists after day 7 so /learn/first-week stays reachable in a PR-3-only build
  Tour (F-ASK)               | refresh mid-tour                           | Y        | lands on welcome; nothing re-fires
                             | abandon after Screen A                     | Y        | picks are written with the win on Screen B only (by design)
                             | 0 picks                                    | Y/design | Continue disabled — a11y reading in Phase 2
  Home door                  | corrupt ask state                          | Y        | default order
                             | non-default door                           | design   | reorder after hydration = layout shift → Phase 2
  Hold off recolour          | colour-blind reading                       | gate     | A-35
```

**Data-flow tracing** for the two new persisted values: `pal.orient.v1` — `INPUT` (device) → `VALIDATE` (strict schema; nil → EMPTY, invalid → EMPTY, too long impossible) → `TRANSFORM` (day, step) → `PERSIST` (localStorage; conflict impossible, quota → silent) → `OUTPUT` (eyebrow, line). `profiles.orientation` — `INPUT` (JSON body) → `VALIDATE` (strict zod; nil → 400, wrong type → 400, unknown key → 400) → `PERSIST` (update by userId; dup key impossible; lock-free) → `OUTPUT` (Home select, `/learn/first-week` props under A-33, export). Both are tested at every node except the client-side PATCH failure, which Phase 2 specifies.

#### Section 5 — Code quality

- **Organization:** banks in `lib/pal/`, device stores in `lib/client/`, the week in `lib/coach/`, flags at `lib/*-flag.ts` — every new file lands where its siblings live.
- **DRY:** the rotation counter is duplicated (A-23, accepted: different fallbacks). Three schema-validated storage readers (`profile-store`, `orientation-store`, `ask-store`) share a shape a `readValidated(key, schema)` helper could absorb; at ~15 lines each and matching house style, left alone (P5). `STEP_PROGRESS_ASK` restates `STEP_PROGRESS` with two inserted keys — an explicit table beats a derived one here.
- **Naming:** `guideDoorEnabled`, `ideasFor`, `orientationDay`, `currentOrientationStep`, `doorFor`, `askResponse` name what they do. `SOURCE_LEAD` lives in the component next to `CLINICAL_EYEBROWS`, consistent. `LEARN_NUMBERS_HREF` is a routing constant inside `lib/coach/orientation.ts` — tolerable, one edit flips it.
- **Error handling:** storage `try/catch` everywhere, the house pattern; no request-path catch-all.
- **Missing edge cases:** closed by A-24, A-25, A-27, A-28, A-30.
- **Over-engineering check:** `HomeDoor` (four orders for a preference no user has expressed yet) is required by PRD §7.5 and is 15 lines of pure logic plus a slot component — fine. Nothing else is speculative.
- **Under-engineering check:** the two `GAP` rows above; the `idea_check_completed` equality is buried in the submit handler with a source pin as its only test → **A-32** (extract `shouldCountIdeaCheck(prefill, submitted)`; unit-test it); `ideasFor` closes over the module bank, so the empty case is untestable → **A-31** (`ideasFrom(bank, …)` with `ideasFor` as the bound default).
- **Complexity:** `nextAction` goes to four branches; `stepCounter` gains a parameter; `app/(app)/onboarding/page.tsx` grows from 421 to roughly 600 lines with Screens A and B inline — the pure functions stay exported and tested, which is what matters; extracting the two screens into `components/onboarding-ask.tsx` is left to the implementer's taste (no decision).

#### Section 6 — Test review

```
  NEW UX FLOWS      ideas block · chip tap → /check prefilled · source lead-in · "Day N" eyebrow + step line · /learn/first-week list + note
                    · /journey "Where you are" · tour final button + first-week line · quick row · /learn index · door reorder · hero H2
                    · Screen A · Screen B + response line · expectations line · See all · /check empty-state ideas · Hold off recolour
  NEW DATA FLOWS    rotation counter · pal.recheck.source · guest orientation state · profiles.orientation + PATCH · the note · ask state
                    · ten analytics events
  NEW CODEPATHS     guideDoorEnabled(surface) · ideasFor/ideasFrom · nextIdeasRotation · pick · SOURCE_LEAD lookup · shouldCountIdeaCheck
                    · trackedStep · orientationDay/currentOrientationStep · store read/write/markDone/dismiss/start · PATCH schema branch
                    + nudge-cancel scoping · nextAction orientation branch · doorFor · progressFor/nextStepAfterSegment/stepCounter(ask)
                    · askResponse · segment steering
  NEW ASYNC         OrientationList PATCH · the label eval (review time)
  NEW INTEGRATIONS  OpenAI (eval only)
  NEW ERROR PATHS   Section 2

  CODE PATHS                                                       USER FLOWS
  [+] lib/guide-door-flag.ts                                       [+] Home door (flag on)
    └── [★★★ TESTED] "1" / list / none — guide-door.test.ts          ├── [★★★ TESTED] [→E2E] order + fold + tap prefill — dashboard.spec
  [+] lib/pal/guide-ideas.ts                                          ├── [★★  TESTED] [→E2E] quick row + /learn — Task 5.4
    ├── [★★★ TESTED] precheck-clean, positive, unique, rotates       └── [GAP]  [→E2E] non-default door order — add under Task 5.4 with pal.ask.v1 seeded
    └── [GAP→A-31]  empty bank → [] (needs an injectable bank)     [+] Tour (flag on)
  [+] lib/client/ideas-rotation.ts                                   ├── [★★★ TESTED] [→E2E] eight-screen walk + skip walk — Task 6.6
    └── [★★  TESTED via pattern] storage failure → 0 (coach-rotation) ├── [GAP→A-16]  trial-wall.spec final click
  [+] components/guide-ideas.tsx                                     └── [GAP→A-28]  completeTour lands on /home?stay=1 — assert the URL
    ├── [★   TESTED] render-site source pins                       [+] Orientation
    ├── [GAP→A-25]  double-tap guard — source pin                     ├── [★★★ TESTED] day math + timezone + current step — orientation.test.ts
    └── [GAP→A-12]  hidden when empty — source pin                    ├── [★★★ TESTED] store + note walk — orientation-store.test.ts
  [+] components/result-card.tsx SOURCE_LEAD                          ├── [★★  TESTED] Home pins — guide-door.test.ts
    └── [★★  TESTED] one line per label, no authority, no digit       ├── [GAP→A-33]  /learn/first-week props mode (guest vs signed-in) — page test via collectText
  [+] components/food-check-form.tsx                                  ├── [GAP]       PATCH failure → revert + status — [→E2E] stub 500 (Phase 2 spec first)
    ├── [★   TESTED] source pin: reads pal.recheck.source              └── [GAP→A-30]  /journey line after day 7 — journey.spec under the skip guard
    └── [GAP→A-32]  shouldCountIdeaCheck(prefill, submitted)        [+] Error states
  [+] lib/client/analytics.ts                                          ├── [★★★ TESTED] storage failures → EMPTY (orientation-store.test.ts)
    └── [★★★ TESTED] allowlist · exhaustive · no-PII · no bare string  ├── [GAP→A-24]  invalid startedAt → week over — unit case
  [+] lib/coach/orientation.ts                                          └── [GAP→A-27]  eval inconclusive cell — harness unit case with a stubbed retry
    └── [★★★ TESTED]
  [+] lib/client/orientation-store.ts   [★★★ TESTED]
  [+] lib/coach/next-action.ts          [★★★ TESTED] four branches + never-scolds sweep
  [+] app/api/profile/route.ts          [★★★ TESTED after A-07] persist · 400 · GET · nudge state untouched
  [+] app/(app)/onboarding/page.tsx     [★★★ TESTED] trackedStep · stepCounter(ask) · progressFor · nextStepAfterSegment
  [+] lib/client/home-door.ts           [★★★ TESTED] truth table
  [+] lib/client/ask-store.ts           [★★★ TESTED] corrupt → null · > 3 pains rejected
  [+] lib/client/ask-response.ts        [★★★ TESTED] closed map · banned-verb sweep
  [+] app/api/health/route.ts           [★★  TESTED after A-11] flagTwins.guideDoor
  [+] every new string                  [★★★ TESTED] claims-boundary-copy.test.ts (glob + EXTRA_SOURCES) · boundary-copy-drift · contract

  LLM: [→EVAL] guide-ideas-label-eval — every idea × {5.9, 6.2, 6.4} × 3 runs, keyed on PROMPT_VERSION; unit gate goes red on a bump.
       No change to lib/pal/prompt.ts, so eval:pal's baseline is untouched.

  COVERAGE (plan as amended): 31/40 paths tested (78%)  |  Code paths: 22/26 (85%)  |  User flows: 9/14 (64%)
  QUALITY: ★★★:19 ★★:6 ★:6  |  GAPS: 9 (3 E2E, 1 eval-adjacent), all assigned above
```

**Test ambition.** *2am Friday:* the flag-off smoke run (the judge door byte-for-byte) plus the flag-on `dashboard.spec` door test. *Hostile QA:* edit one character of a prefilled idea (no completion event, by design); tap at 23:59 and submit at 00:01 (the idea keeps its daypart); fill localStorage to quota (rotation sticks at 0 — the "no two consecutive loads share a first idea" promise silently breaks on that device; accepted ceiling, now written down). *Chaos:* revoke the OpenAI key mid-eval (A-27 makes every cell inconclusive; nothing is pruned; the gate stays red). **Pyramid:** many pure-function units, source pins for render sites, four smoke specs extended, one eval — healthy. **Flakiness:** the smoke never asserts the daypart heading (time-dependent); the timezone test uses fixed instants; the live eval is gated by `PAL_LIVE_EVAL`. **Load:** nothing new is hot. **Regression rule:** Task 3.4 changes `nextAction()` for existing callers only when `orientation` is passed — no existing caller passes it, the three classic branches keep their tests; not a regression. Task 5.5 changes the hero H2 under the flag only; the flag-off pin keeps today's string.

#### Section 7 — Performance

No N+1: the Home page keeps one query for checks and one for the profile (widened by two columns — A-21). Memory: sixteen strings and a ~2KB labels file. Indexes: `profiles.userId` is the existing key; jsonb needs none. Caching: the bank is a module constant; `ideasFor` filters sixteen items. The one avoidable round trip was `OrientationList`'s `GET /api/profile` on every `/learn/first-week` mount — removed by A-33 (the server page passes the state). Slowest new path: chip tap → `/check` route load, which is the existing route (the recorded cold-compile learning applies to dev only). Bundle: `zod` is already client-side (`lib/client/ui-state.ts` imports the pal schemas), so `orientation-store` adds no new dependency to the client bundle. No connection-pool change. **No issues.**

#### Section 8 — Observability & debuggability

- **What says it works:** `ideas_shown`, `idea_tapped`, `idea_check_completed`, `onboarding_step`, `orientation_step_done`, `orientation_dismissed`, `learn_opened`, `intake_ask` — the events *are* the metrics (§7.4). **What says it is broken:** `ideas_shown` at zero after the flip means the door did not render or Umami is blind (the 2026-07-22 CSP blackout precedent) → A-36 puts "see `ideas_shown` arrive within the first hour" on the post-deploy list.
- **Logging:** the PATCH route logs nothing today and there is nothing PII-safe worth logging for a step toggle. Client errors in `GuideIdeas` / `HomeDoor` reach Sentry through the existing DSN.
- **Deploy-state probe:** the door has no server twin, so `/api/health` is the only place to ask "is it on in this build" → A-11.
- **Day-1 dashboard:** four Umami reads the owner will run by hand — ideas-shown sessions ÷ sessions; `idea_tapped` → `idea_check_completed`; `onboarding_step` by screen; `orientation_step_done` by step — belong in `docs/ops/launch-controls.md` as a new §13 so "the owner reads the counts" (§8 item 2, kill line 2, the F-ASK floor) has one place to read from → **A-34**.
- **Three weeks later, from logs alone:** a guest's week cannot be reconstructed (device state, by design); a signed-in user's `profiles.orientation` row plus `/api/health.flagTwins.guideDoor` per deploy is enough to answer "did they have the door, and where did they get to".
- **Runbooks:** revert (§7.3 step 7, now timed and rehearsed); the kill-line read (A-34). No admin tooling needed.

#### Section 9 — Deployment & rollout

- **Migration `0019`:** `ADD COLUMN orientation jsonb` nullable — metadata-only in Postgres, no table rewrite, instant lock; old code ignores it, so migrate-before-deploy or deploy-before-migrate are both safe. CI already runs `drizzle-kit migrate` (`ci.yml:132`); follow the `0018` precedent.
- **Flags:** every guide surface is behind the door; `onboarding_step` is deliberately outside it (baseline). **One unflagged production change hides in PR-2:** Task 2.3 recolours `--high-*` for the *live* judge door — every `Hold off` card, the week strip and the landing's verdict cards — and its only gate is an unrecorded colour-blind / "does this look like a warning" review (§8 item 9). → **A-35**: a gate-table row, and Task 2.3 does not merge until the review is recorded; run `landing-a11y.spec` and eyeball the landing verdict cards before merge.
- **Deploy-time window:** a new client PATCHing `orientation` at an old server → strict schema 400 → the client's revert path (Phase 2). An old client at a new server is inert. Seconds long.
- **Post-deploy verification (first five minutes / first hour)** — absent from the plan → **A-36**, added to §7.3: `/api/health.flagTwins.guideDoor` on · `/home?stay=1` at 375 shows three chips and the CTA above the fold · a tap lands on `/check` prefilled · a flag-off surface is unchanged (`/demo` shows the lead-in only when on) · `ideas_shown` in Umami within the hour · after PR-3, `/learn/first-week` returns 200 and `/learn` 404s until PR-5.
- **Flag retirement** is missing: once kill line 2 has been read and passed, the off-branches, the smoke skip guards and DESIGN.md's "flag off restores the previous ordering" clause are dead weight → **A-37**, step 8 in §7.3.
- **Environment parity:** preview builds carry `NEXT_PUBLIC_GUIDE_DOOR=1`; the twin guard runs only when `VERCEL_ENV === "production"`, so previews are unaffected; the e2e runtime env spreads the caller's shell (`scripts/e2e-runtime-env.ts:36-46`), so both smoke configurations are real builds.

#### Section 10 — Long-term trajectory

- **Debt introduced:** code — two rotation counters, twelve `guideDoorEnabled()` call sites (each self-documenting under A-04, all deleted at A-37); operational — a build-time flag with no twin (documented in the module and the env row); testing — source pins are brittle to refactors (house style, accepted); documentation — DESIGN.md §8, §3 tokens, the env row, launch-controls §13 (A-34) all named in tasks.
- **Path dependency:** `learn_opened.page/from`, `Door`, `GuideSurface` are closed enums that grow per Learn page — cheap; `pal.orient.v1` is versioned; `profiles.orientation` is jsonb. Nothing here makes F-NUMBERS, F-TREND, F-DOCTOR or F-REFER harder; each is specified as a gated module against these seams.
- **Knowledge concentration:** the plan, the PRD, the ledger rows and the module docstrings carry the why; the one question a new engineer would ask — "why no server twin?" — is answered in `lib/guide-door-flag.ts` itself.
- **Reversibility: 4/5** (unset + redeploy; the column is inert; Task 2.3 reverts by git). The one-way door in the whole plan is the F-CALM colour change *seen by real users* before its review — A-35 keeps it two-way.
- **Ecosystem fit:** App Router server pages with client islands, `useSyncExternalStore` hydration gate, zod 4 spellings — current.
- **The 12-month question:** "why does Home read three device keys and one profile column to decide one line?" — the orientation docstring answers it; "why is the ideas bank a TypeScript file and not a CMS?" — because a dietitian reviews it in one sitting and the claims audit scans it (coach-outputs precedent).
- **After this ships:** Phase 2/3 of this trajectory are the gated modules, in the order the gates open; platform potential is the `/learn` shell + `learn_opened` + the surface list. **Retrospective on the cherry-picks:** nothing deferred (E11, E12) is load-bearing for anything accepted.

#### Section 11 — Design & UX (UI scope detected; the deep pass is Phase 2)

- **Information architecture (Home, flag on, after PR-5):** first the greeting with "Day N of your first week", second the ideas block, third the quick row, then the hero, the step line, Today. That is the PRD's "start here" argument and it holds. One doubt for Phase 2: the quick row's **Ideas** item links `#ideas-title`, the block immediately above it — a control whose only effect is to scroll up a few pixels. Three items (Check · Learn · Journey) may be the honest row; four is the reference's symmetry → **A-38**, taste, Phase 2 Pass 1.
- **Interaction state coverage:**

```
  FEATURE                 | LOADING                     | EMPTY                    | ERROR                          | SUCCESS                | PARTIAL
  ------------------------|-----------------------------|--------------------------|--------------------------------|------------------------|---------------------------
  Ideas block             | placeholder, 118px reserved | hidden (A-12)            | storage → first three (silent) | three chips            | —
  Chip tap → /check       | route transition            | —                        | storage → empty field (silent) | prefilled              | edited text = typed check
  Source lead-in          | —                           | —                        | —                              | one sentence           | —
  Day eyebrow + step line | server / hydrated           | no week → absent         | storage → "Day 1" (ceiling)    | "Today's step: …"      | check-step carve-out
  /learn/first-week list  | props (A-33) — none         | 0 of 7                   | PATCH fail → UNSPECIFIED       | toggles + "Done"       | some done
  The note                | —                           | textarea + device hint   | storage fail → UNSPECIFIED     | saved on blur          | —
  /journey line           | —                           | no week → absent (A-30)  | —                              | "Day N · k of 7"       | —
  Quick row · /learn      | —                           | tiles omitted per gate   | 404 when off                   | tiles                  | conditional tiles
  Door reorder            | default order               | —                        | corrupt → default              | reordered (CLS!)       | —
  Screen A / B            | —                           | 0 picks, Continue disabled| —                             | picks + response       | Skip
  Hold off colour         | —                           | —                        | —                              | neutral ink            | —
```
  Unspecified cells go to Phase 2 Pass 2 with a proposal each.
- **Journey coherence:** diagnosis week → tour ("Ideas come first") → Home day 1 → tap → label with its source → step line → `/learn/first-week` → note → day 7 → `/journey`. Two breaks: the week ends by *absence* (the line vanishes; no closing moment) and "Hide this for now" is forever (A-26). Phase 2 Pass 3.
- **AI-slop risk:** Home adds no card grid (the tiles moved to `/learn` on purpose); chips reuse the existing recipe; no emoji, no gradients, one accent. `/learn`'s two-column tile grid is the one pattern to interrogate in Phase 2 Pass 4 — each tile must earn its card.
- **DESIGN.md alignment:** one accent (Check only), radius 14 from the scale, no shadow on the ideas block, icons from `icons.tsx`, 44px targets, §8 amended in the same PR, §9's no-`%` rule kept, §10 chip recipe reused, new `--high-*` values recorded in §3 — aligned.
- **Responsive:** designed at 375, same column at 1024 with the sidebar, the quick row stays; chips wrap at 320; the fold is now budgeted (A-09).
- **Accessibility:** chips are buttons in a labelled group; `aria-pressed` on toggles; `aria-expanded` on See all; contrast of the neutral-ink pairs computed AA in Task 2.3. Open for Phase 2: a visible `<label>` for the note (the plan says hint copy; a label is required), `aria-live` feedback on the Done toggles, and the disabled Continue on Screen A (no focus, no reason — a keyboard user cannot learn why).

**User-flow diagram:**

```
   /onboarding (flag on)                                    /home (flag on)                              /check
   welcome → segment → [ask_pains → ask_win + response]     greet + "Day N" ──► ideas ──tap──►          prefilled field ──► label + source lead-in
   → attribution → (a1c | skip) → expectations              quick row · hero · step line                └── footer link → /learn/numbers (gated on D7)
   ("Ideas come first…") → "Start your first week"          step ──► /learn/first-week (list · note · [F-REFER])
   ──► /home?stay=1 (A-28)                                  /journey ◄── "Where you are" ──► /learn/first-week (persists after day 7, A-30)
```

**Findings:** A-38 (quick-row Ideas self-anchor, taste), A-26 (dismiss permanence), the unspecified state cells, the week-end closure moment, the three a11y items — all carried into Phase 2 with the plan's own numbering.

### Required outputs — Phase 1

**NOT in scope** (considered, deferred, one line each): E11 "one of today's ideas" result note (new copy before the ratio reads) · E12 dismiss on Home's step line (Home's one-line rule) · the 10× "guide that remembers" (behind D2 / Phase 5) · a paid concierge service (owner constraint) · a `readValidated` storage helper (three 15-line readers are fine) · extracting Screens A/B to a component (implementer's taste) · per-user PATCH rate limiting (nothing hot) · a server twin for the door (deviation argued and documented; revisit only if a guide surface ever becomes a server boundary) · F-NUMBERS, F-TREND, F-REFER, F-DOCTOR, F-PLAN, F-HABIT, F-DIARY (gated modules by PRD tiering, specified in §2.4–§6, not sequenced).

**What already exists:** the table in 0B — every sub-problem maps to existing code and the plan reuses it, with the two exceptions now fixed (`orientationDay` reuses `days.ts` under A-06; the profile PATCH is scoped under A-07).

**Dream state delta:** in 0C — the plan reaches every 12-month axis but retention, which the PRD defers on purpose, and coarse rollout control, which A-04 closes if the owner keeps it.

**Failure Modes Registry:**

```
  CODEPATH                          | FAILURE MODE                          | RESCUED? | TEST?   | USER SEES?                 | LOGGED?
  ----------------------------------|---------------------------------------|----------|---------|----------------------------|--------
  completeTour → /home              | storage failure → FirstRunGate loop   | N→Y A-28 | N→smoke | the tour again → Home      | N        (was CRITICAL GAP; closed)
  label eval                        | transient provider failure prunes idea| N→Y A-27 | N→unit  | silent bank shrink → recorded| Y (table)(was CRITICAL GAP; closed)
  orientationDay                    | invalid date → NaN / RangeError       | N→Y A-24 | N→unit  | "Day NaN" or 500 → no week | via Sentry (was CRITICAL GAP; closed)
  home/page profiles.orientation    | jsonb off-schema                      | N→Y A-24 | N→unit  | 500 → EMPTY                | via Sentry (closed)
  OrientationList read              | 5xx / network                         | —  A-33  | —       | — (read removed)           | —
  OrientationList PATCH             | 5xx / network                         | client:N | N       | toggle sticks — Phase 2    | N        (OPEN until Phase 2 specifies)
  storage-less device               | rotation 0 / day 1 forever            | Y        | partial | same ideas / day 1 (silent)| N        (documented ceiling)
  Umami blind after flip            | kill line unreadable                  | N        | N       | nothing                    | N        (A-36 post-deploy check; process)
  Task 2.3 colour before review     | Hold off reads as disabled/wrong      | N→gate   | axe only| grey Hold off              | N        (A-35 gate row)
  /learn/first-week after day 7     | unreachable in a PR-3-only build      | N→Y A-30 | N→smoke | a dead end                 | N        (closed)
  chip double-tap                   | two pushes / duplicate history entry  | N→Y A-25 | N→pin   | Back goes to /check twice  | N        (closed)
```
One row stays open (PATCH failure UX) pending the Phase 2 states table; none is silent-and-unrescued after the amendments.

**Stale diagram audit:** ASCII art found in: lib/server/db/schema.ts — re-read against the change; none describes a flow this plan alters.

**Diagrams produced:** system architecture · data flow with shadow paths (Sections 1, 4) · state machine (orientation week) · error flow (Section 2 tables) · deployment sequence (§7.3 as amended, A-36/A-37) · rollback flowchart (Section 1 rollback posture) · user flow (Section 11).

### Completion summary — Phase 1

```
  +====================================================================+
  |            MEGA PLAN REVIEW — COMPLETION SUMMARY                   |
  +====================================================================+
  | Mode selected        | SELECTIVE EXPANSION (autoplan override)      |
  | System Audit         | 67 files verified; 2 plan claims wrong (fixed)|
  | Step 0               | 9 premises (2 wrong, fixed); Approach C;      |
  |                      | 16 cherry-picks: 12 add, 2 taste, 2 defer     |
  | Section 1  (Arch)    | 7 issues found (5 closed by edits, 2 → Phase 2)|
  | Section 2  (Errors)  | 18 error paths mapped, 5 GAPS (4 closed, 1 → Phase 2)|
  | Section 3  (Security)| 2 issues found, 0 High severity (1 gate, 1 verify)|
  | Section 4  (Data/UX) | 21 edge cases mapped, 3 unhandled → all assigned|
  | Section 5  (Quality) | 4 issues found (2 closed, 2 accepted)         |
  | Section 6  (Tests)   | Diagram produced, 9 gaps (all assigned)       |
  | Section 7  (Perf)    | 0 issues found (1 round trip removed)         |
  | Section 8  (Observ)  | 2 gaps found (health probe, day-1 reads)      |
  | Section 9  (Deploy)  | 3 risks flagged (colour gate, verify, retire)  |
  | Section 10 (Future)  | Reversibility: 4/5, debt items: 4             |
  | Section 11 (Design)  | 5 issues → Phase 2                            |
  +--------------------------------------------------------------------+
  | NOT in scope         | written (9 items)                             |
  | What already exists  | written (0B)                                  |
  | Dream state delta    | written (0C)                                  |
  | Error/rescue registry| 18 methods, 0 CRITICAL GAPS after amendments  |
  | Failure modes        | 11 total, 0 CRITICAL GAPS (1 open → Phase 2)  |
  | TODOS.md updates     | 2 items proposed (E11, E12), written in Phase 3|
  | Scope proposals      | 16 proposed, 12 accepted, 2 taste, 2 deferred |
  | CEO plan             | written (~/.gstack/projects/Revora/ceo-plans/)|
  | Outside voice        | ran (codex+subagent): 4/6 CONFIRMED NO, 1 DISAGREE|
  | Lake Score           | 14/14 recommendations chose the complete option|
  | Diagrams produced    | 7 (arch, data flow, state, error, deploy,     |
  |                      | rollback, user flow)                          |
  | Stale diagrams found | 0                                             |
  | Unresolved decisions | 5 taste + 4 user challenges → gates; 0 silent |
  +====================================================================+
```


## Phase 2 — Design review (UI scope detected; all seven passes; auto-decided)

### Pre-review audit
- **UI scope:** Home (ideas block, quick row, step line, day eyebrow, hero H2), `/check` first-run row, result-card lead-in, `/learn`, `/learn/first-week` (list, note, F-REFER section), `/journey` line, the eight-screen tour (two new screens, a response line, a new final button), the `Hold off` recolour. Mobile-first at 375, shell flip at 1024.
- **DESIGN.md exists (588 lines):** every decision below is calibrated against it — §2 permission-first voice, §3 tokens, §4 type scale (13px tracked eyebrow · 14–15 hints · 16 body · 18 subheads), §5 radius scale 24/22/18/14/999 and "cards earn existence", §6 the one ease and three sanctioned keyframes (`pal-skeleton` for loading placeholders), §7 the icon vocabulary, §8 the shell and the fold rule, §9 reassurance not gamification, §10 recipes (selectable chips are **1–3 word labels**), §12 interaction rules (`aria-live="polite"` for status, `role="list"`, errors name the next step, no dead ends), §13 the banned list.
- **Mockups:** the design binary is present but its API key is rejected (401; the recorded learning `igstack-path-and-local-html-fallback` predicted it). One attempt, no retry. Visual references are the PRD §7.6 wireframe and the plan's own CSS; no comparison board was generated.
- **Prior design reviews:** `main-reviews.jsonl` holds none for this surface; the 2026-07-21 post-C7 `/design-review` residuals in TODOS.md (legacy week strip on `/meals`, `.app-content--narrow` scope, spacing/radius drift, `/meals` aria-live) are adjacent but not touched by this plan. Areas previously flagged that this plan re-enters: Home's composition (C7 four-jobs), the onboarding tour (2026-08-11 first-check-step cut), the result card (permission-first anatomy).
- **Classifier:** APP UI (workspace-driven, task-focused) → App UI rules apply; `/learn` is a navigation index, not marketing.

### Step 0 — Design scope assessment

**0A. Initial design rating: 6/10.** The plan is unusually specific where most plans are vague — files, flags, event enums, the Home order, a fold budget, tokens, radius, icons from the vocabulary, `aria-pressed` / `aria-expanded` / `role="group"`, 44px targets, computed AA pairs for the recolour. It is a 6, not an 8, because: (1) the ideas "chips" reuse a recipe DESIGN.md §10 reserves for 1–3 word labels, while 12 of the 18 seed lines exceed the ~38 characters a pill holds at 375 (content column 347px, block padding 32, chip padding 36) — every chip wraps to its own row and the longer ones wrap *inside* the pill, so the 118px reservation is short by ~100px and the fold assertion is unreliable once PR-5's quick row lands above the hero; (2) five state cells are unspecified — the signed-in save failure (deferred "to a Phase 2 row"), the note's storage failure (silent loss under a hint that promises the opposite), the pre-hydration treatment (blank reserved space, no placeholder), the empty-bank fallback (hidden, unstated), and the focus/reading-order contract when `HomeDoor` reorders after hydration; (3) the four door orders are one paragraph, not four specs; (4) "Hide this for now" is permanent; (5) Screen A's Continue is disabled at zero picks, which a keyboard user cannot interrogate; (6) the week ends by absence — no closing moment on day 7. **A 10 for this plan:** every surface carries a state table with the exact sentence the user reads; the ideas block is a *list of rows* measured with real strings at 360/375/430; each door order is a four-line table (heading, slot order, what is absent, where focus is); dismiss is reversible and its control is named; the week has an end moment; every error string obeys §2 ("what to do next").

**0B. DESIGN.md status:** present — all decisions calibrated against it (see the pre-review audit).

**0C. Existing design leverage (reuse, do not reinvent):**

| Need | Existing recipe | Use |
|---|---|---|
| The ideas block surface | `.first-win` inset: `--surface-muted`, 14px radius, 14px 16px padding | The block is that inset, not a new family |
| Idea rows | `.selectable-chip` is the wrong recipe (1–3 words); the right shape is a **full-width row button**: `--surface`, 1px `--border-strong`, 14px radius, 44px min, 12px 14px padding, text left, `IconArrowRight` at the end (a redundant channel for the text) | New recipe `.idea-row`, recorded in §10 in the same PR |
| Pre-hydration | `pal-skeleton` (§6, the sanctioned loading shimmer) | Three skeleton rows of the row height, so the block's height is the same before and after hydration |
| Day eyebrow | `.status-eyebrow` (13px tracked caps, `--text-muted`) | As is |
| Step line | `.dash-next-action` (15.5px 600, `--accent-strong` link) | As is |
| Today / Learn tiles | `.dash-card` (24px, the one shadow) for Today; `/learn` tiles are interactive so they earn a card at 14px, no shadow | As the plan says |
| Intake Screen A/B options | Five-to-eight-word sentences ("Understanding what my number means") — again not chip labels: the same `.idea-row` shape with `aria-pressed` and the §10 fill change | Not `.selectable-chip` |
| Status | `aria-live="polite"` text first (§12) | Save-failure line, note line, "{n} of 3" counter |
| Verdict icons | `IconPause` for `Hold off` (§7) — shape carries the signal, colour is the second channel | The recolour keeps the icon |
| Tab bar accent | the Check puck (§8) | The quick row's Check echoes it, nothing else fills |

**0D. Focus areas:** all seven passes (autoplan override).


### Step 0.5 — Dual voices (design)

**CODEX SAYS (design — UX challenge)** · read-only, 175k tokens, given the CEO-phase findings. Verdict: "reject this as UI/UX-ready — strong implementation governance, but it serves the developer more than the user at the first screen, persistence failure, and personalisation after hydration." The skeleton is right (one accent, no dark band, five-tab shell, no Home tile grid, no number hero), but PR-5's Home has **three competing starts** (ideas, four quick actions, the check hero) and the quick row's "Ideas" item is "a dead, developer-shaped affordance." **The fold budget is the most serious defect:** 118px is a `min-height`, not a maximum; three 44px chips with real labels wrap to multiple rows at 375, the block runs 180–230px, and the CTA-at-667 assertion becomes unreliable once the quick row sits above the hero — "shrinking copy from 15px to 14px does not solve a three-row touch-target problem." Fix: move the quick row **below** the check hero, remove its Ideas item or make it the See-all toggle, and measure real strings at 360/375/430. States: pre-hydration has no loading treatment; an empty bank silently disappears and takes the proposed first action with it; `HomeDoor` reorders visual, focus and reading order after hydration; the signed-in save failure is deferred ("violates the system's rule that errors name the next step"); the note's storage failure is silent data loss under a hint that promises the opposite; Screen A's zero-pick state needs an always-visible explanation and a live count. "Hide this for now" with a permanent `dismissedAt` is dishonest — restore, do not rename. Responsive: real chip-wrap widths, the 360px icon-only quick row (an avoidable a11y regression), post-hydration reordering are undecided. A11y gaps: focus contract after reorder, error copy and focus for failed writes, the note's failure state, "Done" controls that do not name their step, a colour-blind protocol beyond "eyeball it", no test that wrapped chips keep the CTA reachable. Litmus: (1) brand YES · (2) one anchor **NO** (ideas called the hero while the check keeps the only accent and an equal-weight row sits between them) · (3) scan YES · (4) one job per section **NO** · (5) cards necessary YES · (6) motion NO (correctly static) · (7) premium without shadows YES.

**CLAUDE SUBAGENT (design — independent review)** · fresh context; **rebuilt the flag-on Home at 375×667 in headless Chromium with the real font and the plan's CSS.** Two critical, six high. **F1 (critical, measured):** the block is 285–333px tall (11 of 18 lines wrap to two lines inside a chip); the CTA's bottom edge sits at 621–669 in PR-1 (breakfast already fails ≤ 667), 640–688 with PR-3's eyebrow, 740–788 with PR-5's quick row; the assertion ignores the fixed tab bar (top ≈ 611), so a "passing" button can be hidden behind it; the shrink path saves under 10px. **F6 (critical, verified):** the week breaks on day 2 — `PAYWALL_MODE` defaults to `trial`, a guest's Day-1 allowance expires at the next calendar day (`tasterStore.status() === "expired"`), and `shouldGateSubmit` sends the check to `/subscribe`; steps 2–4 and every idea tap need a check; day 7's `/journey` shows guests a sign-in card and free users a Premium lock; day 8 has no ending; the plan never mentions the paywall. **F2:** ideas lead in the code, not to the eye — the date is the largest heading, the ideas heading is a 13px `<p>`, `--surface-muted` on `--page-bg` "stops reading as an object" (§11), the green shadowed hero wins. **F3:** the welcome screen still pitches the judge ("Check a meal. Get a cautious educational read.", three verdict badges, "about 30 seconds" for eight screens) and nothing in the plan changes it. **F4:** the quick row repeats — Check appears accent-filled three times (row, hero, tab bar), Ideas links to a block already on screen, Journey repeats a tab, only Learn is new; ~100px the page does not have. **F5:** on `/check` the classics (chosen to surprise, hinted as "breakfast staples" at dinner) sit above the ideas; two identical-looking rows with opposite jobs. **F7:** steps never complete where they are shown — only the Learn toggle marks done, so Home keeps nagging after the meal was checked; step 4 links to the page it is on. `/learn/first-week` never marks today's step. Missing states: pre-hydration growth on the signed-in page; 1–2 ideas left after pruning; a tap with no free checks; no source cue on `/check` and "Tap one to check it" promises a check the tap does not run; today-vs-done visuals; save copy; note-saved signal; lifecycle after dismiss / day 7; the `#dietitian` anchor before F-REFER; "Day 2" eyebrow with no step under it (the carve-out); `HomeDoor` reorders every visit; `/journey` is `"use client"` and guests only see a sign-in card, so the "Where you are" line has nowhere to render; 3 of 5 Learn tiles are not learning content; a fourth pick on Screen A. Medium: "{done} of 7" is a deficit count (§9); attribution right after "I'm worried" is jarring; the worried door's clinician line at the top of every visit reads as a brush-off; "from the bank" is jargon; the `peace` response line claims calm (§2 forbids it); steps 2 and 3 nearly repeat. Ambiguities: the smoke's daypart comes from the CI clock (breakfast 333px vs lunch 285px — flaky); the greeting is described three ways; "Done · Not yet" label swaps under `aria-pressed`; no un-hide; Task 3.7 calls `/journey` server-rendered. Litmus: (1) YES · (2) YES **but the wrong anchor** · (3) NO (ideas has no real heading) · (4) NO · (5) NO · (6) NO (the only motion is layout shift) · (7) YES.

```
DESIGN LITMUS SCORECARD — CONSENSUS:
═══════════════════════════════════════════════════════════════
  Check                                Claude  Codex  Consensus
  ──────────────────────────────────── ─────── ─────── ─────────
  1. Brand unmistakable first screen?  YES     YES    CONFIRMED YES
  2. One strong visual anchor?         NO*     NO     CONFIRMED NO — the hero outweighs the "hero slot" → A-71 (taste) + A-89
  3. Scannable by headlines only?      NO      YES    DISAGREE → Pass 1: a real <h2> for the ideas block resolves it (A-71 default)
  4. Each section has one job?         NO      NO     CONFIRMED NO — Check ×3, Ideas ×2, /check two rows → UC5, A-74, A-75
  5. Cards actually necessary?         NO      YES    DISAGREE → Pass 4: the ideas list needs a surface (§11), Learn tiles are interactive
  6. Motion improves hierarchy?        NO      NO     CONFIRMED NO — correctly static; the one movement is a post-hydration shift → A-54, A-55
  7. Premium without shadows?          YES     YES    CONFIRMED YES
═══════════════════════════════════════════════════════════════
* "YES, but it's the wrong one" — counted as NO on the check's intent. 5/7 confirmed, 2 disagreements raised in the passes.
```

### Passes 1–7 (0–10, gap, fix, re-rate)

**Pass 1 · Information architecture — 5/10 → 8/10.** *(A-71's default flipped by A-106 once the fold was re-measured against the tab bar: the date and day become one eyebrow line, "Ideas for dinner" is the page's first heading, the hero keeps the accent and the shadow.)* Gap: ideas lead in DOM order but the date `h1` and the shadowed accent hero win the eye; the ideas heading is a `<p>`; the quick row makes three starts; `/learn/first-week` never marks today's step. Fixes: the ideas block gets a real `<h2>` (18px/700, the app subhead) on `--surface` with a hairline, no shadow (A-71 default — the taste alternative demotes the date to an eyebrow and makes ideas the anchor); `/learn/first-week` runs Day N of 7 → today's step with Done → the rest → the note (A-76); the quick row sits below the hero with no accent fill (A-54, A-74; dropping it is UC5); the greeting is one definition (A-89). Still short of 10 because the hero and the ideas list are two objects with equal claim to "start here" until the owner rules on A-71.

```
  HOME (flag on, 375)                         /learn/first-week                /onboarding (flag on)
  ┌ top bar (brand) ─────────────┐            Day 3 of 7                       welcome (guide pitch, A-73)
  │ DAY 3 OF YOUR FIRST WEEK     │ eyebrow    ▸ today's step · [Done]          → segment → ask_pains → ask_win (+ response)
  │ Sunday, September 14         │ h1         the other six, done ones marked  → attribution → a1c | skip → expectations
  │ ┌ Ideas for dinner ────────┐ │ h2 18px    your questions (note, device)    → "Start your first week" → /home?stay=1
  │ │ row · row · row  [See all]│ │ list       [F-REFER section if cleared]
  │ └──────────────────────────┘ │
  │ ┌ MEAL CHECK ▸ Unsure…? ───┐ │ the one accent card
  │ ○ Ideas ○ Check ○ Learn ○ Journey (quiet, PR-5; UC5 may drop it)
  │ Today's step: … →            │ line (auto-completes, A-84)
  │ ┌ Today ─────────────────┐   │ card
  └ tab bar: Home · Meals · Check ● · Journey · Account ┘
```

**Pass 2 · Interaction state coverage — 4/10 → 8/10.** Every unspecified cell now has a sentence (all rows are `product-role` ledger rows unless noted):

```
  FEATURE            | LOADING                          | EMPTY                              | ERROR                                                        | SUCCESS                       | PARTIAL
  -------------------|----------------------------------|------------------------------------|--------------------------------------------------------------|-------------------------------|------------------------------
  Ideas block        | three skeleton rows (A-54)       | fewer than three rows render as    | storage → rotation 0, first three (silent by design)        | rows + See all                | 1–2 rows after pruning; the bank test forces ≥ 6 so this is a build failure, not a UI state
                     |                                  | many as exist; bank ≥ 6 by test    |                                                              |                               |
  Idea tap → /check  | route transition                 | —                                  | storage → empty field (silent; same as the hero); wall-bound | field prefilled + hint        | edited text = typed check (no cue)
                     |                                  |                                    | device → /subscribe, as any check today (A-83)               | "From today's ideas" (A-77)   |
  Day eyebrow + line | server / hydrated                | no week → eyebrow absent, line falls| storage → "Day 1" every visit (documented ceiling)           | "Today's step: …"             | check-step day before the first check → hero eyebrow reads
                     |                                  | back to the three classic branches |                                                              |                               | "Today's step · Meal check", no second link (A-79)
  First-week list    | props (A-33); guest after hydrate | 0 done: every row "Done" unpressed | PATCH non-2xx → toggle reverts, `role="status"`: "That didn't  | toggle pressed, step name in  | some done; today's step marked; after dismiss: "Show it again"
                     |                                  |                                    | save just now. Tap Done again in a moment." (A-56)           | the accessible name (A-60)    | (A-59); after day 7: list stays, eyebrow "Your first week"
  The note           | —                                | textarea + hint "Your notes stay on| setItem throws → `role="status"`: "This browser isn't letting | saved on blur; hint variant   | —
                     |                                  | this device." only when a probe    | the page keep notes — copy your questions somewhere safe."   | "Saved on this device" (A-57) |
                     |                                  | write succeeded (A-57)             | (A-57)                                                       |                               |
  /journey line      | client fetch (A-80)              | no week → absent                   | fetch fails → line absent (a summary line; silence is fine)  | "Day 3 · 2 steps done" (A-86) | after day 7 / dismissed: "Your first week · 5 steps done · Review" (A-30)
  Quick row · /learn | —                                | tiles omitted per gate             | 404 when the surface is off                                  | quiet row; tiles              | conditional tiles
  Door reorder       | default order                    | —                                  | corrupt → default                                            | reordered once, before focus  | non-default doors only; no CSS transition; skipped if focus is inside the region (A-55)
  Screen A / B       | —                                | 0 picks: Continue enabled, acts as | —                                                            | picks; "{n} of 3" aria-live;  | Skip; a fourth tap is ignored and the counter says
                     |                                  | Skip (A-58)                        |                                                              | response line under B         | "Three picked — unpick one to change" (A-82)
  Welcome (flag on)  | —                                | —                                  | —                                                            | PRD §3 line, no badges, "about| —
                     |                                  |                                    |                                                              | a minute" (A-73)              |
  Hold off colour    | —                                | —                                  | —                                                            | neutral ink under [data-calm] | —
```

**Pass 3 · User journey & emotional arc — 4/10 → 7/10.** The arc as the plan had it: landing "Check a meal" → tour opening with the judge pitch → "name your fear, name your hope" → "Where did you hear about us?" → A1C → a crowded expectations screen → Home where the date is loudest → day 1's Clear label with its source (the genuinely good moment) → step 1 sends the user *out of the shell* to a marketing page with a "No login. No card." button → **day 2: the wall** → day 7: a sign-in card or a Premium lock → day 8: nothing. Fixes: the welcome speaks the guide's line (A-73); steps auto-complete where they happen so Home stops nagging (A-84); the week has a closing line on day 7/8 — eyebrow "Your first week" with the list kept (A-30, A-86); the worried door's clinician line sits above ideas for three days, then below the step line (A-88); the public guide's second-person sentences are generalised before the shell links it (A-45) and the link opens in the same tab with the shell's back path (`/learn/first-week` is the return). **The day-2 wall is the owner's decision (A-83, final gate)** — plan default: for a guest whose allowance has expired, the step line reads "Sign in to keep your week going" → `/signin`; signed-in free users have four checks a day. Attribution's placement stays as the owner ruled (the floor is read at that screen) — the "jarring after 'I'm worried'" point is recorded as taste A-87. Not 10 because the wall decision is open and the arc's first minute still spends two screens on research questions by the owner's ruling.

**Pass 4 · AI-slop risk — 7/10 → 8/10.** Specific where it counts (tokens, radii, icons, copy rows, tests); generic in three places: four round icon buttons (the reference's treatment — kept quiet, A-74, and challenged in UC5), an equal-tile grid for 3–5 links (Learn — interactive tiles earn a card at 14px, no shadow; the mixed content is taste A-81), and a box drawn around a 13px heading (fixed: a real `<h2>` on a real surface, A-71). Disagreement on "cards necessary" resolved: the ideas list is a bounded interactive group and §11 says a muted inset on `--page-bg` does not read as an object, so it is a bordered `--surface` at 24px, no shadow; the hero keeps the system's one shadow. Hard-rejection criteria: none apply (no card grid as first impression, no busy imagery, no carousel; Home is a labelled column, not stacked cards — one list surface, one accent card, one Today card). Copy fixes in A-85 (no "bank", no "calm").

**Pass 5 · Design-system alignment — 8/10 → 9/10.** Already aligned: tokens, the 24/14/999 radii, icons from `icons.tsx`, 44px, one accent, no dark band, `aria-live`, `role="list"`, the recorded §8 and §3 amendments. Fixed: the chip recipe misuse (A-54), the third accent fill (A-74), the deficit count (A-86), the "calm" claim (A-85), the label-swapping toggle (A-90: the button text stays "Done", `aria-pressed` carries the state). New vocabulary recorded in §10 in the same PR: `.idea-row` and the ideas list surface. Remaining point: `.meal-hero h2` at weight 800 is pre-existing drift (§4 allows 400/600/700) — out of scope, already in TODOS.

**Pass 6 · Responsive & accessibility — 6/10 → 8/10.** Responsive: rows wrap cleanly at 320–430; the fold is measured at 360/375/430 against the tab bar's top edge, with the CI clock stubbed for all three dayparts (A-72); the quick row keeps visible labels at every width; desktop is the same column. Accessibility: `role="list"` + row buttons with the meal as the accessible name; "Done" buttons carry the step in their name (A-60); status lines are `aria-live="polite"` (A-56, A-57, A-82); focus is never moved by the door reorder and the reorder is skipped when focus is inside the region (A-55); Continue is never disabled (A-58); the colour-blind protocol is written (A-61: DevTools vision-deficiency emulation on the three verdict cards and the week strip, plus two non-team readers asked "which of these is a warning?", recorded in the ledger note). Contrast pairs computed in Task 2.3. Not 10: no screen-reader walk is scripted for the eight-screen tour (Phase 3's test plan adds a manual VoiceOver pass).

**Pass 7 · Unresolved design decisions.**

```
  DECISION NEEDED                                     | IF DEFERRED, WHAT HAPPENS                                   | DISPOSITION
  ----------------------------------------------------|-------------------------------------------------------------|---------------------------
  Which object anchors Home: hero or ideas?           | The engineer ships both at equal weight; two "start here"s  | A-71 taste → final gate (default: hero anchors, ideas get a real heading)
  Day-2 paywall × orientation week                    | Guests hit /subscribe on step 2 and the week reads as a bait | A-83 owner decision → final gate (default: sign-in step)
  Quick row: keep four, quiet; three; or a Learn link | Three accent fills, a dead Ideas control, 100px on the fold | UC5 (both voices) → final gate (default: four, quiet, below the hero)
  /learn tiles: Learn-only or the PRD's seven         | Three non-learning tiles on a page called Learn             | A-81 taste (default: PRD list)
  Attribution before or after Screens A/B             | The floor's read screen moves if the order moves            | A-87 taste (default: owner's ruling)
  Dismiss semantics                                   | "Hide this for now" is forever                              | A-59 decided: reversible, "Show it again" on /learn/first-week
```

### Completion summary — Phase 2

```
  +====================================================================+
  |         DESIGN PLAN REVIEW — COMPLETION SUMMARY                    |
  +====================================================================+
  | System Audit         | DESIGN.md present; 9 UI surfaces; no mockups |
  | Step 0               | 6/10; all seven passes                       |
  | Pass 1  (Info Arch)  | 5/10 → 8/10 after fixes                      |
  | Pass 2  (States)     | 4/10 → 8/10 after fixes                      |
  | Pass 3  (Journey)    | 4/10 → 7/10 after fixes                      |
  | Pass 4  (AI Slop)    | 7/10 → 8/10 after fixes                      |
  | Pass 5  (Design Sys) | 8/10 → 9/10 after fixes                      |
  | Pass 6  (Responsive) | 6/10 → 8/10 after fixes                      |
  | Pass 7  (Decisions)  | 1 resolved, 5 to the gate (2 taste, 1 owner, |
  |                      | 1 user challenge, 1 taste)                   |
  +--------------------------------------------------------------------+
  | NOT in scope         | written (4 items: the date-as-eyebrow        |
  |                      | anchor swap unless A-71 flips; a cookie for  |
  |                      | server-side door order; a scripted SR walk;  |
  |                      | weight-800 hero drift)                       |
  | What already exists  | written (Step 0C)                            |
  | TODOS.md updates     | 0 new (E12 already holds the Home dismiss)   |
  | Approved Mockups     | 0 generated (design binary auth failed)      |
  | Decisions made       | 31 added to plan (A-55…A-62, A-71…A-90)      |
  | Decisions deferred   | 5 (listed in Pass 7)                         |
  | Overall design score | 6/10 → 8/10                                  |
  +====================================================================+
```

**Phase 2 complete.** Codex: 9 concerns. Claude subagent: 8 findings (2 critical, 6 high) + 12 state gaps + 6 ambiguities. Consensus: 5/7 confirmed, 2 disagreements resolved in the passes. New user challenge UC5 (the quick row). Passing to Phase 3.

<!-- phase-2-voices -->
<!-- phase-2-passes -->


## Phase 3 — Eng review (FULL_REVIEW; Codex unavailable — usage limit mid-run; source = subagent-only)

### Step 0 — Scope challenge
- **Existing code:** the map in Phase 1 §0B stands; two more reuses found here — `lib/client/remote-history.ts` `syncLocalHistory` is the guest → signed-in migration pattern orientation now joins (A-66), and `POST /api/history/action` is the fire-and-forget write pattern `recordStepEvent` copies (A-84).
- **Minimum set:** PR-1 as amended (flag with surfaces, bank of 18, rows, hand-off, source lead-in, funnel event, label eval, `/check` row, health key, docs) is the smallest thing that produces a readable kill line; PR-2…PR-6 stay sequenced behind the owner's reads (§8 item 2, UC3).
- **Complexity check:** PR-1 now touches ~24 files. Challenged: eleven of the additions since the plan was written each close a defect an outside voice or a measurement found (the fold, the tap source, the health payload rule, the labels guard, the session-one surface). None can be folded into another file without losing the guard it carries. Accepted. New modules after all phases: `guide-door-flag`, `guide-ideas`, `ideas-rotation`, `orientation`, `orientation-store`, `orientation-progress`, `home-door`, `ask-store`, `ask-response`, `GuideIdeas`, `HomeQuickRow`, `HomeDoor`, `OrientationList`, `OrientationNote` — fourteen, each under 80 lines, each with one job.
- **Search check** (in-distribution; WebSearch used in Phase 1): [Layer 1] build-time `NEXT_PUBLIC_*` flags are constants, not kill switches — the plan says so and prices the rebuild; [Layer 1] `useSyncExternalStore` for the hydration gate is the framework's own answer; [Layer 2] Playwright's `page.clock.install` exists from 1.45 and the repo is on `^1.62.1`, so A-72's stubbed clock needs no shim; [Layer 1] `ALTER TABLE … ADD COLUMN … jsonb` nullable is a catalog-only change in Postgres; [Layer 3] no custom solution is rolled where a built-in exists.
- **TODOS cross-reference:** the "post-hoc I did it affordance" entry shares `recordStepEvent`'s fire-and-forget PATCH posture (A-84) — same pattern, so the two should land the same way; "saved-meals section must be styled before MEAL_MEMORY flips" is a precondition for the `/learn` "Saved meals" tile (Task 5.2 omits it while `mealMemoryUiEnabled()` is false, so nothing breaks); the Umami blackout entry is why A-36 checks `ideas_shown` arrives before trusting a zero. New TODO candidates from this phase: none beyond E11/E12 (already written).
- **Completeness check:** every recommendation in this review chose the complete option (lake score 14/14 in Phase 1; Phase 2 and 3 added no shortcuts).
- **Distribution check:** no new artifact type (no binary, package or image); the e2e build and the Vercel deploy are the existing pipeline.

**CLAUDE SUBAGENT (eng — independent review)** · fresh context, checked against `76eab01`. "Not safe to deploy as written": 4 HIGH, 8 MEDIUM. Confirmed: `NEXT_PUBLIC` values inline into both bundles; the analytics slice marker works; "zucchini noodle" is already excluded from the carb floor. **H1** PR-3's migration can break profile creation and export with the flag off (drizzle inserts every schema column; production migration is manual; §7.3 had no migrate step) → A-98. **H2** flag-on runs never happen in CI; the e2e env does not blank this flag; the production list value is never tested and `=== "1"` guards would skip it → A-99. **H3** a prompt hotfix is blocked by the bank (repo-wide red, a throwing build, a paid eval, then new copy when one idea is pruned) → A-100. **H4** "every rendered row is Approved" is unenforced (`validate-safety-contract.mjs` checks thirteen fixed IDs); four rows existed only in prose; `home` without `ideas-full` gives a See-all that never renders, `orient` without `ideas` sends step 4 to nothing → A-101. **M1** `/check` renders `<FirstRunGate/>` — a fresh guest tapping an idea is bounced to `/onboarding` and Task 1.8 fails as written; other `pal.recheck` writers leave a stale source → A-102. **M2** zero-row PATCH says ok; four whole-object writers lose updates; "stamp once" is device-only; future dates and duplicate ids accepted → A-103 (+ A-92). **M3** account delete and consent withdrawal clear only history and profile; the clinician note survives and A-66 re-uploads state → A-104. **M4** `intake_ask` sends self-reported health status against a "coarse, non-identifying" privacy promise; kill line 2 counts impressions (A-95); Task 6.7 must not infer the A1C-screen drop → A-105. **M5** the budget totalled against 667 while the assertion uses the tab bar's top (≈611) and omitted the content padding — worst case fails → A-106 (the date and day collapse into one eyebrow; the ideas title leads). **M6** three runs per cell pass a 20%-flip idea half the time; labels ignore `PAL_MODEL`; scanning unserved reasons can redden the audit; the client factory is not where 4.1 said → A-107. **M7** StrictMode moves the rotation by two per mount (dev shows the same page every load); an unkeyed reorder remounts the list → A-108. **M8** the guest Home changes with the flag off (`nextAction()` is unconditional today) → A-109. LOW: render instead of pin (A-110); gate the PATCH server-side (A-111); taps draw on the global check cap at 10× (A-112, noted); two doc slips fixed. Verdicts: architecture PARTLY · tests NO · performance PARTLY · security PARTLY · error paths PARTLY · deployment NO.

```
ENG DUAL VOICES — CONSENSUS TABLE (Codex unavailable — usage limit; source = subagent-only):
═══════════════════════════════════════════════════════════════
  Dimension                           Claude  Codex  Consensus
  ──────────────────────────────────── ─────── ─────── ─────────
  1. Architecture sound?               PARTLY  N/A    N/A — single voice; H4 (surface coherence) flagged regardless → A-101
  2. Test coverage sufficient?         NO      N/A    N/A — H2 (no flag-on CI) and M1 (Task 1.8 fails) flagged regardless → A-99, A-102, A-110
  3. Performance risks addressed?      PARTLY  N/A    N/A — A-112 noted
  4. Security threats covered?         PARTLY  N/A    N/A — M3 (device data survives deletion) flagged regardless → A-104; M4 → A-105
  5. Error paths handled?              PARTLY  N/A    N/A — M2 (lost updates, zero-row ok) flagged regardless → A-103
  6. Deployment risk manageable?       NO      N/A    N/A — H1 (migrate order) and H3 (hotfix blocked) flagged regardless → A-98, A-100
═══════════════════════════════════════════════════════════════
CONFIRMED = both agree. DISAGREE = models differ. Missing voice = N/A (not CONFIRMED). Single critical finding from one voice = flagged regardless.
```
Every single-voice critical/high finding was verified against the code before being applied (the gate on `/check`, the unconditional guest `nextAction()`, the e2e env blanking, drizzle's column list) — none was taken on the voice's word alone. **Phase 3 complete.** Claude subagent: 12 findings, all applied (A-98…A-112). Passing to Phase 3.5.

<!-- phase-3-voices -->

### Section 1 — Architecture (delta over Phase 1 §1)
The Phase 1 dependency graph stands. Amendments added four edges: `components/food-check-form.tsx`, `orientation-list.tsx`, `orientation-note.tsx` and `app/(app)/journey/page.tsx` → `lib/client/orientation-progress.ts` → store | `PATCH /api/profile` (A-84: **one writer for auto-completion**, never scattered `markDone` calls); `app/layout.tsx` → `guideDoorEnabled("calm")` → `<html data-calm>` (A-40); `next.config.ts` → `lib/pal/guide-ideas.labels.json` + `PROMPT_VERSION` (A-63, the twin-guard shape); `app/api/health` → `GUIDE_SURFACES` (A-67). **Production failure per new integration:** `recordStepEvent`'s signed-in PATCH fails → the step is not recorded server-side, the guest store is unaffected, the Learn toggle still works, and a Sentry breadcrumb is left (same posture as `/api/history/action`); the labels guard fires on a stale file → the production build fails loudly with the fix in the message; the root attribute is build-time, so it cannot be wrong at runtime. **Coupling:** `orientation-progress` is the one fan-in point four components share — justified, and small. **Rollback** unchanged (4/5). **Distribution architecture:** N/A.

### Section 2 — Code quality (delta)
- `orientation-progress.ts` is the single writer for auto-completion; components call `recordStepEvent(kind)` and nothing else (P5).
- `[data-calm]` doubles the four `--high-*` declarations in `globals.css`; the source pin in Task 2.3 counts them so a third copy cannot creep in.
- `GUIDE_SURFACES` is grouped by ledger batch with a comment per group — readable at the call site, which is where a surface name is chosen.
- `shouldCountIdeaCheck` and `ideasFrom` exist so two pieces of logic have real tests instead of source pins; the pins remain for render sites only (house style).
- [P3] (7/10) `app/(app)/onboarding/page.tsx` grows past 500 lines with two screens, a welcome variant and the funnel; the pure functions stay exported and tested, so it is readable — extraction is the implementer's call (A-39).

### Section 3 — Test review (coverage diagram, updated for A-40…A-90)
```
  CODE PATHS                                                             USER FLOWS
  [+] lib/guide-door-flag.ts        [★★★] "1" / list / none / production-never-1 (unit)   [+] Home door (flag on)
  [+] lib/pal/guide-ideas.ts        [★★★] precheck-clean · positive · ≤64 chars · 6/daypart   ├── [★★★][→E2E] rows · order · fold vs tab bar × 3 widths × 3 clocks
                                          · disjoint consecutive loads · empty via ideasFrom    ├── [★★ ][→E2E] quick row quiet, below hero; /learn reachable (PR-5)
  [+] lib/client/ideas-rotation.ts  [★★ ] pattern-covered (coach-rotation)                     └── [GAP→add] non-default door order with pal.ask.v1 seeded (PR-5 smoke)
  [+] components/guide-ideas.tsx    [★  ] pins: render site · skeleton rows · navigatingRef     [+] Tour (flag on)
  [+] result-card SOURCE_LEAD       [★★ ] one line per label, no authority, no digit             ├── [★★★][→E2E] eight screens + skip walk; zero-pick Continue = Skip
  [+] food-check-form               [★★★] shouldCountIdeaCheck (unit) · [★] pins                  ├── [★★ ][→E2E] trial-wall walk under the flag (A-68)
  [+] lib/client/analytics.ts       [★★★] allowlist · exhaustive · no-PII · no bare string          └── [★  ] welcome variant pin (A-73)
  [+] lib/coach/orientation.ts      [★★★] day math · timezone · invalid start · current step      [+] Orientation
  [+] lib/client/orientation-store  [★★★] read/write/markDone/dismiss/start/restore · note walk   ├── [★★★] Learn page props mode · Done names · save-failure line (unit via collectText + fake fetch)
  [+] lib/client/orientation-progress [GAP→add] which event completes which step; idempotent;   ├── [★★ ][→E2E] mark step 2 → Home shows step 3; Show it again
                                          guest vs signed-in writer (fake fetch)                  ├── [★★ ][→E2E] /journey line, guest and signed-in, after day 7
  [+] lib/coach/next-action.ts      [★★★] four branches · never scolds                            └── [GAP→add] day-2 guest with expired allowance → sign-in step (unit on the step-line rule)
  [+] app/api/profile PATCH         [★★★] persist · 400 · GET · nudge state untouched            [+] Error states
  [+] onboarding page pure fns      [★★★] trackedStep · stepCounter(ask) · progressFor · next     ├── [★★★] storage failures (rotation, store, note probe — fake storage that throws)
  [+] lib/client/home-door.ts       [★★★] truth table · reorder contract pin                        ├── [★★ ] PATCH non-2xx → revert (fake fetch)
  [+] lib/client/ask-store.ts       [★★★] corrupt → null · >3 rejected                              ├── [★★ ] eval inconclusive cell (harness unit with a stubbed retry)
  [+] lib/client/ask-response.ts    [★★★] closed map · banned-verb sweep · no "calm"               └── [★★★] invalid startedAt → week over
  [+] app/api/health guideDoor      [★★ ] env.test.ts whole payload + health.test.ts
  [+] next.config labels guard      [★★ ] flag-server-twins.test.ts case (A-63)
  [+] app/layout data-calm          [★  ] pin: attribute present under the surface; --high-* declared exactly twice
  [+] every new string              [★★★] claims-boundary-copy (glob + EXTRA_SOURCES) · boundary-copy-drift · contract
  LLM: [→EVAL] guide-ideas-label-eval — every idea × {5.9, 6.2, 6.4} × 3 runs; inconclusive ≠ failed; keyed on PROMPT_VERSION; production guard.
  COVERAGE (plan as amended): 40/44 paths tested (91%) | Code paths: 27/28 | User flows: 13/16 | GAPS: 3, all assigned above (2 unit, 1 E2E)
```
- **Regression rule:** A-75 moves the classics below the ideas row under the flag; `promise-registry.test.ts:128-136` pins that the classics *derive from the registry at their render site* (a source match), not their position — no regression, no pin change. A-74 removes the accent from the quick row; nothing pinned it yet. Task 5.5's H2 pin is updated for the surface argument (A-64). The flag-off smoke run is the regression net for everything else.
- **2am Friday:** the flag-off run + the fold matrix. **Hostile QA:** set the device clock to 23:59, tap an idea, submit at 00:01 (the idea keeps its daypart; the taster may have expired — the wall, by design); fill storage to quota (rotation 0, day 1 forever, note line explains); sign in on day 3 as a guest with two steps done (state migrates once). **Chaos:** revoke the OpenAI key mid-eval (all cells inconclusive, nothing pruned, gate red).
- **Pyramid:** many pure units, pins only for render sites, five smoke specs, one eval — healthy. **Flakiness:** the clock is stubbed (A-72); the timezone test uses fixed instants; the live eval is gated. **Load:** nothing new is hot.
- **Evals to run:** `eval:pal:ideas` in PR-1 and on any bank or `PROMPT_VERSION` change; `eval:pal` unchanged (no prompt edit). The manual VoiceOver walk of the eight-screen tour is in the test plan artifact.
- **Test plan artifact:** `~/.gstack/projects/Revora/tefera-main-eng-review-test-plan-20260914-054030.md` (written).

### Section 4 — Performance
Unchanged from Phase 1 §7: one widened select, static banks, no new hot path. `recordStepEvent` adds one fire-and-forget PATCH per completed step (≤ 7 per user per week). The stubbed clock and the fold matrix cost the e2e job ~9 extra page loads. **No issues.**

### Failure modes (delta over Phase 1)
```
  CODEPATH                        | FAILURE                                | RESCUED? | TEST? | USER SEES?                       | LOGGED?
  recordStepEvent (signed-in)     | PATCH fails                            | Y        | Y     | nothing; Learn toggle still works| Sentry breadcrumb
  next.config labels guard        | stale labels with `ideas` open         | Y (loud) | Y     | —                                | build log
  html data-calm                  | —                                      | —        | pin   | —                                | —
  page.clock in smoke             | Playwright < 1.45                      | N/A      | —     | —                                | repo is on 1.62
```
No critical gaps. The one open UX row from Phase 1 (PATCH failure copy) is closed by A-56.

### NOT in scope (eng)
A server twin for the door (deviation argued; revisit if a guide surface ever becomes a server boundary) · a cookie so the server can render the door order (privacy posture: picks stay on-device) · an emailed orientation (consent + cron) · a `readValidated` storage helper · extracting Screens A/B into a component (implementer's call) · per-user PATCH rate limiting (nothing hot) · a scripted screen-reader walk (manual, in the test plan) · fixing `.meal-hero h2`'s weight-800 drift (TODOS).

### What already exists
Phase 1 §0B, plus `syncLocalHistory` (migration pattern) and `POST /api/history/action` (fire-and-forget pattern) — both reused.

### Worktree parallelization
| Step | Modules touched | Depends on |
|---|---|---|
| PR-1 core (Tasks 1.1–1.6, 1.8) | `lib/`, `components/`, `tests/unit/pal/`, `tests/smoke/` | — |
| PR-1 funnel (Task 1.9) | `app/(app)/onboarding/`, `lib/client/analytics.ts`, `tests/unit/client/` | shares `analytics.ts` with core |
| PR-1 eval (Task 4.1) | `tests/evals/`, `lib/pal/guide-ideas.labels.json`, `package.json`, `next.config.ts` | the bank (Task 1.2) |
| PR-1 docs (Task 1.7, env row, launch-controls §13) | `docs/`, `DESIGN.md` | the bank's final lines |
| PR-2 audit (2.1, 2.2, 2.4) | `tests/unit/pal/`, `docs/audit/` | PR-1 merged |
| PR-2 calm (2.3) | `app/globals.css`, `app/layout.tsx`, `DESIGN.md` | PR-1 merged |
| PR-3 module + store (3.1, 3.2) | `lib/coach/`, `lib/client/` | PR-1 merged |
| PR-3 server (3.3) | `lib/server/db/`, `drizzle/`, `app/api/profile/` | — |
| PR-3 surfaces (3.4–3.8) | `components/`, `app/(app)/` | 3.1–3.3 |
| PR-4 · PR-5 · PR-6 | as listed in §2.3–§4 | the owner's reads |

Lanes: **Lane A** PR-1 core → docs (sequential, shared `lib/pal/guide-ideas.ts`) · **Lane B** PR-1 funnel (parallel with A; merge-conflict flag on `lib/client/analytics.ts` — insert both unions before `photo_draft`, rebase once) · **Lane C** PR-1 eval after A's Task 1.2 · then PR-2's two lanes in parallel (audit ∥ calm; both touch `DESIGN.md` — coordinate) · PR-3: **Lane G** module + store ∥ **Lane H** server, then **Lane I** surfaces. Execution: launch A + B, merge, then C; PR-2 E ∥ F; PR-3 G ∥ H then I.

### Completion summary — Phase 3
- Step 0: scope accepted as amended (complexity smell challenged and accepted; no reduction)
- Architecture: 4 issues after the voice (surface coherence, migrate order, hotfix path, server-side gate) — all closed
- Code quality: 1 note (file length, implementer's call)
- Test review: diagram produced, 3 gaps + the voice's 4 (flag-on CI, Task 1.8, render-vs-pin, eval N) — all assigned; test plan artifact written
- Performance: 0 issues
- NOT in scope: written (8 items) · What already exists: written
- TODOS.md: 0 new (2 written in Phase 1)
- Failure modes: 0 critical gaps
- Outside voice: Claude subagent only (Codex usage limit) — 12 findings, 15 amendments A-98…A-112; deployment verdict NO → closed by A-98/A-99/A-100
- Parallelization: 8 lanes, 4 parallel pairs / 3 sequential joins
- Lake score: 14/14 recommendations chose the complete option


## Phase 3.5 — DX review (DX POLISH; product type: internal — the plan itself, its flags, scripts and internal API; Codex unavailable, source = subagent-only)

**Applicability.** The mechanical scan tripped on `flag`, `onboarding`, `import`, `npm`, `api`; the product is a consumer health app with no developer-facing surface. The review is therefore scoped to the two people who will use the plan as a developer artifact — no competitive TTHW table is manufactured for a health app.

**Developer persona card**
```
Who:       (a) the agentic implementer running superpowers:subagent-driven-development task by task;
           (b) the solo owner who runs the gates — tests, the live eval, the ledger, the flag flips, the reads.
Context:   opens the plan cold; must ship PR-1 dormant, then flip surfaces as batches are Approved.
Tolerance: the implementer follows exact commands and fails loudly on ambiguity; the owner has minutes, not hours, per gate.
Expects:   copy-paste-complete task cards; a failing test whose message names the fix; one place per fact.
```

**Empathy narrative (first person, the implementer).** I open a 3,400-line file. The header tells me the goal, the architecture and the spec, and that `superpowers:subagent-driven-development` is required. Global Constraints run 27 lines and every one of them is a rule I would otherwise trip: the no-PII scan bans the word "food" in a comment; new analytics members go before `photo_draft`; the ledger splits on `|`. Then §1's gate table, then PR-1's file table — 24 files — then Task 1.1: a failing test, the module, an env row, two commands, a commit line. I paste the test, run `npx vitest run tests/unit/pal/guide-door.test.ts`, it fails on a missing module as promised, I paste the module, it passes; `env-contract.test.ts` fails until the row is in `docs/ops/env-reference.md` and its message says so. Ten minutes in, one green commit. Then I hit the first thing that is not a task: an "amendment A-04" block that supersedes Step 3 above it, and `review A-nn` notes threaded through later tasks. I need one sentence at the top telling me that inline notes marked `review A-nn` are the plan as it stands and that everything under "# /autoplan review record" is history I should not implement. Later, `guide-ideas-labels.test.ts` will be red until someone with an `OPENAI_API_KEY` runs `npm run eval:pal:ideas` — I need the failure to say that, with the cost, so I do not "fix" the test. As the owner, I want the flip to be one env change whose error, if I get the list wrong, names the surface or the row.

**Developer journey map**
```
STAGE           | DEVELOPER DOES                                        | FRICTION                                                     | STATUS
1. Discover     | reads the header, Global Constraints, §1 gate table   | no "read me first" for the amendment convention              | fixed (A-113)
2. Install      | repo already set up; `npm ci`; `.env.local` from env-reference | the door flag leaks from .env.local into the flag-off e2e | fixed (A-99)
3. Hello World  | Task 1.1: test → module → env row → commit (~10 min)   | none                                                         | ok
4. Real Usage   | Tasks 1.2–1.9, 4.1, 4.2; both smoke configs; the eval  | labels test red before the eval; cost unstated               | fixed (A-114)
5. Debug        | no-PII scan, ledger parser, twin/door guard, env-contract | messages name the fix for three of four; the ledger's does not | fixed (A-115)
6. Upgrade      | 0019 migration order; PROMPT_VERSION bumps; flag retirement; surface flips | migrate order was missing; hotfix path was blocked | fixed (A-98, A-100, A-37)
```

**First-time developer confusion report**
```
T+0:00  Opens the plan. Sees "review A-nn" notes inside tasks with no legend.                 → A-113
T+0:10  Task 1.1 green. Reads Task 1.1's amendment A-04 that replaces Step 3 — order is clear once the legend exists.
T+0:40  Task 1.3: adds the union member after `photo_draft` by habit; the no-bare-string test fails with a slice message
        that does not say "insert before photo_draft" — the Global Constraint does.                                   → A-115 (message)
T+1:30  Task 1.7: a `·` list inside a Copy cell; a stray `|` breaks `npm run contract` with "row has 9 cells" — no row id.  → A-115
T+2:00  Task 4.1: `guide-ideas-labels.test.ts` fails with ENOENT on the labels file. Is this my bug?                    → A-114 (message + cost)
T+2:30  Owner: sets NEXT_PUBLIC_GUIDE_DOOR=ideas,source on Vercel; the build guard's message names a row still Pending.  ok (A-101)
```

**DX voice** — see the consensus block below.

**CLAUDE SUBAGENT (DX — independent review)** · fresh context, read the plan at 06:31 (A-114/A-115 landed while it read). Verdicts: getting started < 10 min **NO** (Task 1.1 has six steps and an amendment that replaces two of them, behind ~2,300 words of constraints); naming **PARTLY** (`GuideSurface` catches a wrong surface at typecheck; a typo in the env value fails silently — now a guard error, A-101); errors **PARTLY**; docs **NO** (the spec is spread across ~100 amendments; some PR-1 work has no task); upgrade **PARTLY**; dev environment **NO**. **F1 HIGH:** review-added PR-1 work had no task cards — health key, guard, effective list, CI jobs, §13 reads, Task 4.2 — and per-task dispatch would drop it → **A-116** (Tasks 1.10–1.14). **F2 HIGH:** the eval contradicted A-100 (the unit test still asserted `promptVersion`; no `text`/`model` fields; the factory is `createEvalModelClient` in `tests/support/pal-test-model.ts`; A-114's throw kept `test:pal` red for an implementer without a key; ~1,440 calls at eight per daypart; the model id carries an `openai/` prefix only on OpenRouter) → **A-117** (skip-with-instruction, owner hand-off, normalised model id). **F3 HIGH:** the flag-on e2e could pass while testing nothing (the blanked flag had no pass-through; health-probed guards would skip everything; `trial-wall` doubles local builds) → **A-118** (`PAL_E2E_GUIDE_DOOR` pass-through; global setup fails a flag-on job whose door is off). **F4:** the guard would reject the plan's own ledger (a "variant" has no status; Task 1.7 filed five rows, §7.5 six; messages unwritten) → **A-119**. **F5:** the no-PII scan's message has no line number and does not say comments count → **A-120**. *The report was truncated after F5 in transit; the remainder was not retrieved — recorded as an open reviewer concern.*

```
DX DUAL VOICES — CONSENSUS TABLE (Codex unavailable; source = subagent-only):
═══════════════════════════════════════════════════════════════
  Dimension                           Claude  Codex  Consensus
  ──────────────────────────────────── ─────── ─────── ─────────
  1. Getting started < 10 min?         NO      N/A    N/A — F1 flagged regardless → A-116, A-113
  2. API/CLI naming guessable?         PARTLY  N/A    N/A — env typos now guard errors (A-101)
  3. Error messages actionable?        PARTLY  N/A    N/A — A-114, A-115, A-119, A-120
  4. Docs findable & complete?         NO      N/A    N/A — F1 → A-116; legend A-113
  5. Upgrade path safe?                PARTLY  N/A    N/A — A-117 (stale labels close, never block)
  6. Dev environment friction-free?    NO      N/A    N/A — F3 → A-118
═══════════════════════════════════════════════════════════════
```
**Scorecard after the voice:** Getting Started 7 · API 8 · Errors 8 · Docs 7 · Upgrade 8 · Dev Env 7 · Measurement 8 · **Overall 7/10** (the table above was written before the voice; these numbers supersede it). TTHW ≈ 10 min once the legend and Tasks 1.10–1.14 exist.

**Phase 3.5 complete.** DX overall: 7/10. TTHW: ~10 min → target ≤ 10 min. Claude subagent: 5 findings received (3 high), all applied (A-116…A-120); the tail of its report was lost in transit. Passing to Phase 4.

<!-- phase-35-voices -->

**Passes 1–8 (0–10).**
- **Pass 1 · Getting started — 8/10.** From opening the plan to Task 1.1 green: read the header + Global Constraints (5 min), one task card (5 min). Target ≤ 10 min: met. Gap: the amendment legend (A-113). Stripe test: the implementer never leaves the plan and the terminal.
- **Pass 2 · Ergonomics — 8/10.** `guideDoorEnabled("orient")` reads as documentation; `ideasFor` / `ideasFrom` / `orientationDay` / `currentOrientationStep` / `recordStepEvent(kind)` are verbs on nouns; surfaces are grouped by batch with comments; `SURFACE_ROWS`/`SURFACE_REQUIRES` sit beside the list. Defaults are sensible (rotation 0 on failure, `EMPTY_ORIENTATION`, the default door). Progressive disclosure: PR-1 needs five modules; PR-3 adds the week without touching PR-1's. Consistency wins over cleverness throughout.
- **Pass 3 · Error messages — 6/10 → 8/10.** Traced: (1) env-contract → "undocumented runtime env vars: X — add a row to docs/ops/env-reference.md" — problem + fix ✓; (2) the twin/door guard → names the surface, the missing requirement or the Pending row (A-101) ✓; (3) the labels test → ENOENT, no fix → **A-114**: the test asserts the file exists with the message "run `npm run eval:pal:ideas` (needs OPENAI_API_KEY; ~1,100 model calls, about $11 at twenty runs per cell)"; (4) `npm run contract`'s "row has N cells" carries no row id → **A-115**: the validator prints the Copy ID and the offending line; the no-bare-string test's message adds "insert new members before the `photo_draft` variant".
- **Pass 4 · Documentation — 8/10.** Every task card has Files / Interfaces / Task card / Steps with exact commands; the env row, `launch-controls` §13, DESIGN.md §3/§4/§8/§10 edits are named tasks; §7.1 lists both smoke commands and the CI jobs. Findable in under two minutes once the legend exists.
- **Pass 5 · Upgrade path — 8/10.** Flag retirement is a step (A-37); migration order is explicit (A-98); a prompt bump closes the ideas surfaces instead of blocking a hotfix (A-100); the revert is timed and rehearsed; `pal.*` keys are versioned. Gap: none blocking.
- **Pass 6 · Dev environment — 8/10.** Two smoke configurations and two CI jobs (A-99); Playwright's clock API is in the repo's version; the live eval needs one key and one command; `npx drizzle-kit generate` is spelled out. Cross-platform: nothing new.
- **Pass 7 · Community — N/A** (solo owner, private repo; not scored).
- **Pass 8 · Measurement — 8/10.** The four reads in `launch-controls` §13, the health probe per surface, the post-deploy checklist; the kill line's numerator is the owner's call (UC1).

```
+====================================================================+
|              DX PLAN REVIEW — SCORECARD                             |
+====================================================================+
| Dimension            | Score  | Prior  | Trend  |
|----------------------|--------|--------|--------|
| Getting Started      |  8/10  |   —    |   —    |
| API/CLI/SDK          |  8/10  |   —    |   —    |
| Error Messages       |  8/10  |   —    |   —    |  (6 before A-114/A-115)
| Documentation        |  8/10  |   —    |   —    |
| Upgrade Path         |  8/10  |   —    |   —    |
| Dev Environment      |  8/10  |   —    |   —    |
| Community            |  N/A   |   —    |   —    |
| DX Measurement       |  8/10  |   —    |   —    |
+--------------------------------------------------------------------+
| TTHW                 | ~10 min (target ≤ 10 min)                    |
| Competitive Rank     | n/a (internal artifact)                      |
| Magical Moment       | Task 1.1's red → green in two pastes          |
| Product Type         | plan + flags + scripts + internal API         |
| Mode                 | DX POLISH                                    |
| Overall DX           |  8/10                                        |
+====================================================================+
| Zero Friction: covered · Learn by Doing: covered (TDD cards)        |
| Fight Uncertainty: covered after A-114/A-115 · Opinionated + Escape |
| Hatches: covered (surfaces, retirement) · Code in Context: covered  |
| Magical Moments: covered                                            |
+====================================================================+
```

**DX implementation checklist:** [x] TTHW ≤ 10 min · [x] one command per step · [x] first run produces output (a red test with a named fix) · [x] every failure the implementer meets names problem + cause + fix (A-114, A-115) · [x] names guessable · [x] defaults sensible · [x] commands copy-paste complete · [x] examples are the real tasks · [x] upgrade path documented (retirement, migration, prompt bump) · [x] breaking changes flagged (surface argument, A-64) · [x] TypeScript types included · [x] CI without special configuration (A-99) · [—] free tier / changelog / search / community: n/a.

**NOT in scope (DX):** a generated task index; a plan linter; per-task worktree scripts (the parallelization lanes are enough).
**What already exists:** the TDD task-card format, `env-contract.test.ts`'s message, the twin-guard message pattern, `journey-card-flag.test.ts`'s render harness.


## Cross-phase themes (a concern raised independently in two or more phases — high-confidence signal)

- **T1 · The kill line measured exposure, not use.** CEO (both voices, item 5 / F1) → spec review (item 3, iteration 2 item 5) → eng voice (M4). Resolved in the plan by A-41/A-95 (surface-tagged, tapped, sample floor, clock start); the numerator is still the owner's call (UC1).
- **T2 · The Home stack was never measured.** Design (both voices; Claude rendered it) → spec review (E7) → eng voice (M5, the tab-bar fold line and the missing padding). Resolved by A-54/A-72/A-93/A-106: rows, skeleton placeholders, the quick row below the hero, the date and day collapsed into one eyebrow, a measured budget against 611 with every door, clock and rotation seeded.
- **T3 · Orientation state has two homes and the seam leaked.** Spec review (E3, A-66) → eng voice (M2, M3) → design voice (F6, the day-2 wall). Resolved by A-66/A-92/A-103/A-104 (one start rule, op-based merge, 404 on no row, device keys cleared on delete); the wall is the owner's (A-83).
- **T4 · One flag was a sentence, not a mechanism.** CEO (Codex 9) → spec review (E2, iteration 2 item 4) → eng voice (H4). Resolved by A-04/A-64/A-94/A-100/A-101: a surface list, never `1` in production, rows and requirements per surface, a pure production guard that reads the ledger, and a hotfix path that closes a surface instead of blocking a build.
- **T5 · Built before anyone can use it.** CEO (both voices) → design voice (the paywall, the launch page's judge pitch) → eng voice (flag-on CI never ran). The engineering side is closed (A-99, A-73); the sequencing side is the owner's (UC3).

<!-- review-record-end -->

<!-- AUTONOMOUS DECISION LOG -->
## Decision Audit Trail

| # | Phase | Decision | Classification | Principle | Rationale | Rejected |
|---|---|---|---|---|---|---|
| A-01 | CEO 0F | Mode = SELECTIVE EXPANSION | Mechanical | P6 | Iteration on an existing system; autoplan override | EXPANSION / HOLD / REDUCTION |
| A-02 | CEO 0C-bis | Approach C (as written + defects closed) | Mechanical | P1, P5 | Highest completeness; each add < 5 files and explicit | A (7/10), B (4/10) |
| A-03 | CEO 0D | Task 4.1 label eval moves into PR-1 and gates the production flag flip | Mechanical | P1, P2 | The prototype must not suggest an idea the engine labels `Be careful`; eval = one script + `OPENAI_API_KEY` | Keep eval in PR-4 |
| A-04 | CEO 0D | Surface-list flag (`"1"` = all, comma list = subset) replaces the §7.3 step 4 process rule; applied as an amendment | **Taste** | P5, P1 | Turns a human merge rule into a mechanical one for one parameter | Plan default: one boolean flag + process rule (owner may strike) |
| A-05 | CEO 0D | `OrientationState.startedAt`, stamped at tour completion or first flagged Home visit | Mechanical | P1 | A1C-skipping guests have no `onboardedAt`; no other device timestamp exists | Derive from first check date |
| A-06 | CEO 0D | `orientationDay(startedAt, dayKey: DayKeyFn, now)` — profile timezone on the server, `dayKeyLocal` for guests | Mechanical | P1, P4 | Server is UTC; `dayKeyInTimezone` already exists | `localMidnight` as written |
| A-07 | CEO 0D | PATCH cancels pending nudge attempts only when a nudge key is present | Mechanical | P1 | A "Done" tap must not wipe an in-flight reminder attempt | Unconditional cancel as today |
| A-08 | CEO 0D | `idea_tapped.slot` widened to cover the expanded block | Mechanical | P1 | Task 4.4 renders 5–6 chips | Leave `"1"|"2"|"3"` |
| A-09 | CEO 0D | Fold budget table for 375×667 with the quick row added to §3 | Mechanical | P1 | Task 1.8's assertion keeps running through PR-5 | Discover it in PR-5 |
| A-10 | CEO 0D | `/check` empty state keeps both suggestion rows (plan default) | **Taste** | P6 | The classics are pinned by a deploy-blocking fixture; not worth touching for overlap | Replace the classics when the door is on |
| A-11 | CEO 0D | `/api/health` reports `guideDoor` | Mechanical | P2 | One line beside `flagTwinStates()`; answers "is the door on in this deploy" | No observability |
| A-12 | CEO 0D | Empty-bank guard: `ideasFor` returns `[]`, the block renders nothing | Mechanical | P1 | `% 0` is NaN | Trust the bank never empties |
| A-13 | CEO 0D | "One of today's ideas" result note → TODOS.md | Mechanical | P3 | New copy = safety-owner cost before the ratio reads | Add now |
| A-14 | CEO 0D | Dismiss on Home's step line → TODOS.md | Mechanical | P3 | Changes Home's one-line rule; design call | Add now |
| A-15 | CEO 0D | Read "checks on 2+ distinct days" beside kill line 2 (§7.4) | Mechanical | P1 | Kill line 2 is exposure; the founder's own return checkpoint already exists | Exposure only |
| A-16 | CEO 0D | `trial-wall.spec.ts:98` branches on the flag | Mechanical | P1 | Flag-on smoke fails otherwise | — |
| A-17 | CEO 0.5 | Codex item 10 (paid concierge / sell a service first) rejected | Mechanical | — | Violates `no-sync-sales-projects-only` (10/10, user-stated, 2026-07-04) | Adopt |
| A-18 | CEO 0.5 | Codex items 1/5/7 (test proves helpfulness not demand; exposure ≠ value; WTP displaced) carried to the premise gate, not auto-decided | — | — | Premises are the user's call | — |
| A-19 | CEO audit | §5.3 F-PLAN cites the four-audience report, not `product-marketing.md`, for "we never invent the rule" | Mechanical | P5 | The line is at `2026-09-11-four-audience-validation-report.md:326` | Leave the wrong citation |
| A-20 | CEO 0D | `GuestDashboard` reads `orientationStore` after `useHydrated()` | Mechanical | P5 | Same gate `historyStore.all()` already uses | Read on every render |
| A-21 | CEO 0D | `home/page.tsx` extends the existing profile select | Mechanical | P3 | One query, not two | Second query |
| A-22 | CEO 0E | `OrientationList` fetch-failure state → Phase 2 states table | — | — | Design decision | — |
| A-23 | CEO 0B | `nextIdeasRotation` stays a separate 25-line function | Mechanical | P5 | Two counters, two fallbacks (`0` vs `undefined`); a shared helper would add a parameter for no reader | Generalize `nextRotation(key)` |
| A-24 | CEO §1/§2 | Server-side read of `profiles.orientation` parses through `OrientationStateSchema` (→ `EMPTY` on failure); `orientationDay` returns 8 when either key is non-finite | Mechanical | P1 | A bad row or date must degrade to "no week", never "Day NaN" or a 500 | Trust the column |
| A-25 | CEO §1/§4 | `GuideIdeas.pick()` ignores a second tap while navigating (`navigatingRef`) | Mechanical | P1 | Double-tap pushes `/check` twice | Leave it |
| A-26 | CEO §1 | "Hide this for now" permanence (no un-dismiss) → Phase 2 design decision | — | — | Copy says temporary, state says forever | — |
| A-27 | CEO §2 | Label eval: a `retry`/thrown cell is *inconclusive* — re-run it; prune only on a real non-`SAFE` result; the pruning table records the reason | Mechanical | P1 | A transient provider failure must not shrink the bank | Prune on any non-result |
| A-28 | CEO §1 | `completeTour()` pushes `/home?stay=1` when the flag is on | Mechanical | P1 | Storage failure + `FirstRunGate` = a tour loop; `?stay=1` is the existing escape hatch | `/home` |
| A-29 | CEO §3 | Verify the privacy page's on-device sentence covers the clinician-questions note → Phase 3 check | — | — | `app/(app)/privacy/page.tsx` is being edited right now | — |
| A-30 | CEO §4 | `/journey`'s "Where you are" line persists after day 7 as "Your first week: k of 7 · Review" → `/learn/first-week` | Mechanical | P1 | In a PR-3-only build the page has no other entry point after the week | Line disappears at day 8 |
| A-31 | CEO §5/§6 | `ideasFrom(bank, daypart, rotation, count)` pure over an injected bank; `ideasFor` binds `GUIDE_IDEAS` | Mechanical | P5 | Makes the empty-bank guard unit-testable | Source pin only |
| A-32 | CEO §5/§6 | `shouldCountIdeaCheck(prefill, submittedFood)` extracted from the submit handler and unit-tested | Mechanical | P1 | The counting rule for §9.1 had a source pin as its only test | Pin only |
| A-33 | CEO §1/§7 | `/learn/first-week` (server page) passes `mode` + `initialState` to `OrientationList`; no client `GET /api/profile` probe | Mechanical | P5, P3 | Removes a round trip and the 401-probe / fetch-failure read state | Client probe as written |
| A-34 | CEO §8 | `docs/ops/launch-controls.md` §13: the four Umami reads (kill line 2, idea → check, `onboarding_step` funnel, `orientation_step_done`) | Mechanical | P2 | "The owner reads the counts" needs a place to read from | Ad-hoc |
| A-35 | CEO §9 | Gate-table row: Task 2.3's colour change merges only after the colour-blind / "looks like a warning" review is recorded; landing verdict cards eyeballed | Mechanical | P1 | The only unflagged production change in the plan had an unrecorded gate | Merge PR-2 on readiness |
| A-36 | CEO §9 | Post-deploy checklist (first 5 min / first hour) added to §7.3 | Mechanical | P1 | The plan had no post-flip verification | None |
| A-37 | CEO §9/§10 | §7.3 step 8: flag retirement after kill line 2 passes (delete off-branches, skip guards, DESIGN.md clause) | Mechanical | P1 | Dead branches otherwise live forever | Never retire |
| A-38 | CEO §11 | Quick-row "Ideas" self-anchor → Phase 2 taste (three items vs four) | **Taste** | — | A control whose only effect is a few pixels of scroll | — |
| A-39 | CEO §5 | Screens A/B stay inline in `onboarding/page.tsx`; extraction left to the implementer | Mechanical | P6 | Pure functions are exported and tested; file length alone is not a defect | Mandate a component |
| A-40 | CEO 0.5 | Task 2.3's tokens under `:root[data-calm]`, set from a new `calm` surface | Mechanical | P1, P4 | The colour change becomes dormant and reverts with the door; A-35's gate row stays | Gate row only |
| A-41 | CEO 0.5 | `ideas_shown.surface`; kill line 2 read at ≥ 100 block-rendered sessions with the clock starting at Phase 5 traffic; `idea_tapped` ÷ rendered read beside it | Mechanical | P1 | Both voices: the line was unreadable (no sample rule, no traffic, impressions only) | As written |
| A-42 | CEO 0.5 | Task 4.2 (`/check` first-run ideas row) into PR-1; `check-empty-ideas` joins batch 1 | Mechanical | P1 | Verified: every landing CTA + TWA start URL land on `/check`; Home alone never meets a session-one guest | Home-only prototype |
| A-43 | CEO 0.5 | Six ideas per daypart; `ideasFrom` steps by `count` | Mechanical | P1 | Consecutive loads overlapped on two of three ideas | Step by one, five lines |
| A-44 | CEO 0.5 | §8 item 13: PRD §11 gains a competitor paragraph (AI assistants) — owner doc action | Mechanical | P1 | Both voices: competitive risk unaddressed | Leave the PRD |
| A-45 | CEO 0.5 | The public A1C guide's two second-person sentences generalised before the shell links it | Mechanical | P1 | An in-app link must not point at a second-person clinical sentence while D7 is open | Link as is (Open Q3 default) |
| A-46 | CEO 0.5 | Claude F4 "merged F-ASK screen as the default" rejected | Mechanical | — | Single voice; the owner kept F-ASK after two challenges; floor + fallback instrumented | Adopt |
| A-47 | CEO 0.5 | "Hold PR-1's merge until the concierge read" — plan default (merge dormant) kept, surfaced in UC3 | — | P6 | Single voice on the merge; the plan states its reading of PRD §9 Step 0 explicitly | — |
| A-48 | CEO 0.5 | Emailed orientation and swap-line ideas rejected; launch-first and the landing test carried to the premise gate | Mechanical | P3, P5 | More infra than a jsonb column; an adjustment is not a menu | Adopt |
| A-49 | CEO 0.5 | Dietitian (W-05) sign-off as a bank flip gate: plan default kept (safety-owner `Approved`); W-05 backlog named in §7.5 | **Taste** | — | Voices disagree (Claude: add it; Codex: the review machine is the problem) | Add the gate |
| A-50 | CEO 0.5 | Mod-draft / concierge anchor / launch-channel tension → owner note | — | — | D5 protocol is the owner's | — |
| A-51 | CEO 0.5 | Idea chips on the public what-to-eat guide behind a `guide` surface (E17) — recommended | **Taste** | P2 | Search traffic exists today; it changes a marketing surface | Skip |
| A-52 | CEO 0.5 | "Does a starch-free positive-only bank count as a supplied default pattern (D1)?" → safety owner with batch 1 | — | — | A boundary question, not a plan decision | — |
| UC1 | CEO 0.5 | Kill line 2 numerator/denominator/sample/WTP — both voices | **User challenge** | — | The PRD's line is the owner's; reads added beside it (A-15, A-41) | — |
| UC2 | CEO 0.5 | Concierge test design (pre-registered kill result; Pass A vs B; question-type log) — both voices | **User challenge** | — | The protocol is PRD §9 Step 0, the owner's | — |
| UC3 | CEO 0.5 | Sequence before users (Phase 5 date; PR-3 waits for counts; hold PR-1?) — both voices | **User challenge** | — | PRD §9 Step 1 and §7.3 are the owner's | — |
| UC4 | CEO 0.5 | Number/clinician pains under-served; ask D2 now; F-REFER default-in — both voices | **User challenge** | — | PRD tiering and §9 Step 2 timing are the owner's | — |
| A-53 | CEO gate | Premise gate: owner confirmed the premises as stated (option A, 2026-09-14); user challenges UC1–UC4 and taste decisions go to the final gate | User decision | — | The one non-auto-decided question before the final gate | B (amend now), C (stop for /office-hours) |
| A-54 | Design 0.5 | Ideas render as full-width rows (`.idea-row`, 14px radius, 44px min, two-line wrap) with three `pal-skeleton` rows pre-hydration; quick row moves below the hero; fold budget re-measured (539 typical / 605 worst of 667); idea text ≤ 64 chars; smoke measures 360/375/430; Screen A/B options use the same rows | Mechanical | P1, P5 | DESIGN.md §10 reserves chips for 1–3 word labels; 12 of 18 seed lines exceed a pill's ~38 chars at 375 (verified) — Codex design + spec review E7 + measurement | Chips, `min-height: 118px`, quick row above the hero |
| A-63 | Spec review 1 | Production build guard: flag opens `ideas` + stale labels ⇒ build fails; the unit test stays strict | Mechanical | P1 | The flip needs an exact guard; CI friction on prompt bumps is intended | Skip the test when the flag is off (would never run in CI) |
| A-64 | Spec review 1 | One surface per ledger batch; production never carries `1`; surfaces for PR-4 additions and the gated modules; every call site names its surface; Task 5.5's pin updated | Mechanical | P5 | A-04 left three ways to render Pending copy and a pin that would fail | As first written |
| A-65 | Spec review 1 | The A-15 return read gets its query (signed-in DB count; guest Umami proxy) and is a read, not a trigger | Mechanical | P5 | An unnamed query has no decision rule | Prose only |
| A-66 | Spec review 1 | One start rule: `startedAt` stamped at tour end or on the first flagged Home visit when the profile is < 7 days old, for guests and signed-in alike; device state joins `syncLocalHistory` on sign-in | Mechanical | P1 | A-05 covered guests only; signed-in users had no stamp; guest state was lost at sign-in | Guests only |
| A-67 | Spec review 1 | `/api/health` gets a separate `guideDoor` key with `"on"|"off"` per surface; both payload tests updated | Mechanical | P5 | `env.test.ts` compares the whole payload — booleans by name, never values | Raw value inside `flagTwins` |
| A-68 | Spec review 1 | `trial-wall.spec.ts` joins both e2e commands and Task 6.6's walk | Mechanical | P1 | The spec was named in A-16 but never run under the flag; PR-6 breaks it again | — |
| A-69 | Spec review 1 | `idea_tapped.surface`; the `/check` row's tap sets the prefill ref so `shouldCountIdeaCheck` fires | Mechanical | P1 | `/check` taps could never produce `idea_check_completed` — conversion undercounted by construction | — |
| A-70 | Spec review 1 | A-12's two guards removed as dead code; the property stays as a test over `ideasFrom` | Mechanical | P5 | `Array.from({ length: Math.min(count, 0) })` is already `[]`, and the bank test guarantees six per daypart | Keep the guards |
| A-55 | Design | Door reorder contract: once, after hydration, no transition, never when focus is inside the region; DOM order = reading order | Mechanical | P1 | Both voices: reorder scrambles focus/reading order | Reorder freely |
| A-56 | Design | `orientation-save-failed` row + optimistic revert | Mechanical | P1 | §12: errors name the next step | Deferred copy |
| A-57 | Design | Note: visible label; probe-write decides the hint; failure line; "Saved on this device" | Mechanical | P1 | Silent loss under a hint that promised the opposite | Silent |
| A-58 | Design | Continue never disabled; zero picks = Skip; live counter | Mechanical | P5 | A disabled control cannot be interrogated | Disabled Continue |
| A-59 | Design | Dismiss is reversible: "Show it again" clears `dismissedAt` | Mechanical | P1 | "for now" must mean for now | Permanent |
| A-60 | Design | Done buttons name their step in the accessible name | Mechanical | P1 | Seven identical "Done"s | — |
| A-61 | Design | Colour-blind protocol written (DevTools emulation + two readers) | Mechanical | P1 | "Eyeball it" is not a protocol | — |
| A-62 | Design | The four door orders specified in full, with fallbacks | Mechanical | P5 | One paragraph is not four specs | — |
| A-71 | Design | Home anchor: hero stays the accent anchor; ideas get a real h2 on a bordered `--surface` (default) | **Taste** | P5 | Both voices: the anchor is wrong/contested; §11 muted-on-page-bg is not an object | Demote the date to an eyebrow and make ideas the anchor |
| A-72 | Design | Fold measured against the tab bar's top edge, clock stubbed per daypart, 360/375/430 | Mechanical | P1 | Claude measured: breakfast already fails ≤ 667 and the bar hides a "passing" CTA; the daypart made the test flaky | 667 flat, live clock |
| A-73 | Design | Flag-on welcome uses PRD §3's line, no badges, "about a minute" | Mechanical | P1 | The first screen still pitched the judge | Leave it |
| A-74 | Design | Quick row has no accent fill | Mechanical | P1 | Three accent fills on one screen break §8 | PRD's filled Check |
| A-75 | Design | `/check`: ideas above the classics; classics hint reworded under the flag (supersedes A-10) | Mechanical | P1 | Both voices: two rows pulling opposite ways | Classics first |
| A-76 | Design | `/learn/first-week` leads with today's step | Mechanical | P1 | Nothing marked today's step | intro → list → note |
| A-77 | Design | "Tap one to send it to the check." + `check-from-idea` hint | Mechanical | P1 | The old line promised a check the tap does not run | — |
| A-78 | Design | Step 6 links the page until F-REFER ships | Mechanical | P1 | `#dietitian` did not exist | Dangling anchor |
| A-79 | Design | Check-step days: hero eyebrow "Today's step · Meal check" | Mechanical | P5 | "Day 2" with nothing under it | Eyebrow alone |
| A-80 | Design | `/journey` is a client component: guest line above the sign-in card; signed-in via `GET /api/profile` | Mechanical | P1 | Task 3.7 called it server-rendered; guests had nowhere to render | — |
| A-81 | Design | `/learn` tiles: PRD's seven kept | **Taste** | — | One voice: three are not learning content | Learn-only tiles |
| A-82 | Design | Fourth pick ignored, live count explains | Mechanical | P1 | Unspecified | — |
| A-83 | Design | Paywall × week: default = guest sign-in step from day 2; **owner decides at the gate** | Owner decision | — | Verified: trial default + Day-1 allowance ⇒ /subscribe on step 2 | Exempt week checks (pricing change); sign-in at "Start your first week" |
| A-84 | Design | Steps auto-complete where they happen (`recordStepEvent`) | Mechanical | P1 | Home kept nagging after the meal was checked | Toggle only |
| A-85 | Design | Copy: no "bank", no "calm", step 2 sharpened | Mechanical | P5 | §2 and plain words | — |
| A-86 | Design | "{done} steps done", never "of 7" | Mechanical | P1 | §9 additive counts only | Deficit count |
| A-87 | Design | Attribution stays after Screen B | **Taste** | — | One voice: jarring after "I'm worried"; the floor is read at that screen | Move before Screen A |
| A-88 | Design | Worried door's clinician line drops below the step line after day 3 | Mechanical | P5 | A pointer at the top of every visit reads as a brush-off | Always on top |
| A-89 | Design | The greeting has one definition; first-win block yields to the eyebrow during the week | Mechanical | P5 | Described three ways | — |
| A-90 | Design | "Done" text constant; `aria-pressed` carries state | Mechanical | P1 | Label swap under aria-pressed is an anti-pattern | "Done · Not yet" |
| UC5 | Design | Drop or shrink the quick row — both voices | **User challenge** | — | The PRD's four-item row is the owner's | — |
| A-91 | Spec review 2 | Label entries store `text`; the unit gate and the build guard assert it matches the bank line | Mechanical | P1 | Positional ids let a reworded line keep stale labels green (silent) | Ids only |
| A-92 | Spec review 2 | PATCH returns 404 when zero rows update; a signed-in user without a profile row keeps orientation on the device; migration waits for a row | Mechanical | P1 | `{ ok: true }` on zero rows lost every Done silently | As written |
| A-93 | Spec review 2 | Non-default doors render two idea rows; the smoke seeds each door, the rotation and the clock | Mechanical | P1 | The added line above the ideas spent the fold's slack | Three rows everywhere |
| A-94 | Spec review 2 | The production guard rejects `1`; Tasks 4.3/4.4 only under `ideas-full`; See-all and "Ideas for later" get their own rows | Mechanical | P5 | A written rule is not a guard; batch-1 rows carried later strings | — |
| A-95 | Spec review 2 | Kill line 2 default reads "opened" as tapped, per surface (owner rules in UC1) | Mechanical (default) | P1 | Impressions read ~100% of `/check` sessions by construction once the row sits there | Impressions |
| A-96 | Spec review 2 | `/api/health.guideDoor` built from `GUIDE_SURFACES` | Mechanical | P5 | Six of twelve surfaces were listed | Hand list |
| A-97 | Spec review 2 | Stale text corrected: §8 amendment "≤ 118px", `check-empty-ideas` in both batches, Task 3.7's e2e command | Mechanical | P5 | Consistency | — |
| A-98 | Eng voice H1 | §7.3 step 6b: apply `0019` to Neon + `db:governance:check` before PR-3 deploys | Mechanical | P1 | drizzle inserts every schema column; profile creation and export break with the flag off | Deploy first |
| A-99 | Eng voice H2 | e2e env blanks the flag; two CI e2e jobs (`1` and the production list); skip guards read `/api/health.guideDoor` | Mechanical | P1 | Flag-on specs never ran in CI; the production value was never tested | — |
| A-100 | Eng voice H3 | Stale labels close the `ideas` surfaces at build with a warning; staleness leaves `test:pal`; eight seeds per daypart | Mechanical | P1, P6 | A prompt hotfix must not be blocked by the bank | Throw (A-63) |
| A-101 | Eng voice H4 | `SURFACE_ROWS` + `SURFACE_REQUIRES`; a pure production guard rejects unknown tokens, missing requirements, `1`, and non-`Approved` rows | Mechanical | P1 | "Every rendered row is Approved" was prose; the ledger and the build were unconnected (DESIGN.md §1.1) | Process |
| A-102 | Eng voice M1 | Chips push `/check?stay=1`; every other `pal.recheck` writer clears `.source` | Mechanical | P1 | `/check` renders `FirstRunGate`; Task 1.8 failed as written; stale source | — |
| A-103 | Eng voice M2 | Op-based PATCH merged server-side; `COALESCE` start; unique `done`; no future dates | Mechanical | P1 | Four whole-object writers lost updates | Whole-object PATCH |
| A-104 | Eng voice M3 | Account delete / consent withdrawal clear the three new keys; no-`fetch` pin on the note code | Mechanical | P1 | The clinician-questions note outlived the account | — |
| A-105 | Eng voice M4 | No inference about the A1C screen; `intake_ask` categories to counsel, `pain_1`-only fallback | Mechanical | P1 | Privacy page promises coarse, non-identifying analytics | — |
| A-106 | Eng voice M5 | A-71's default flipped: date + day become one eyebrow, the ideas title is the first heading; fold re-budgeted against 611 | Mechanical (taste default) | P1 | The first budget failed by up to 24px against the tab bar with the day eyebrow | Hero-anchored layout |
| A-107 | Eng voice M6 | Twenty runs per cell; labels keyed on prompt + model; cached reasons not scanned; production non-`SAFE` idea = prune trigger | Mechanical | P1 | Three runs pass a flaky idea half the time; `PAL_MODEL` changes without a redeploy | — |
| A-108 | Eng voice M7 | Mount effect guarded by a ref; door slots keyed | Mechanical | P1 | StrictMode +2 per mount; a reorder remounted the list | — |
| A-109 | Eng voice M8 | Owner-rule guard only under `orient` | Mechanical | P1 | Flag-off guest Home changed | — |
| A-110 | Eng voice LOW | Render with `renderToStaticMarkup`; snapshot the flag-off markup | Mechanical | P1 | Pins pass on ungated code | Pins |
| A-111 | Eng voice LOW | PATCH accepts `orientation` only when `orient` is on | Mechanical | P5 | Keeps the no-server-boundary story true | — |
| A-112 | Eng voice LOW | Idea taps draw on the global `/api/check` cap at 10× — noted, no change | — | — | The PRD's cache question, revisited if taps become a cost line | — |
| A-113 | DX | "Read me first" legend at the top of the plan: `review A-nn` notes supersede; the record is history | Mechanical | P5 | The amendment convention had no legend | — |
| A-114 | DX | Labels test names the missing-file fix, the key and the cost | Mechanical | P1 | ENOENT with no fix | — |
| A-115 | DX | Ledger validator prints the Copy ID; the no-bare-string test says where to insert | Mechanical | P1 | Two first-met failures named no fix | — |
| A-116 | DX voice F1 | Tasks 1.10–1.14: every review-added PR-1 change is a task card | Mechanical | P1 | Per-task dispatch drops work that is only a note | Notes only |
| A-117 | DX voice F2 | Labels suite skips with the instruction until the owner's paid run lands; `text`/`model` fields; `createEvalModelClient`; model id normalised; ~1,440 calls | Mechanical | P1 | A throwing test blocked an implementer without a key; the test contradicted A-100 | Throw |
| A-118 | DX voice F3 | `PAL_E2E_GUIDE_DOOR` pass-through; a flag-on job fails when the door is off | Mechanical | P1 | A flag-on run could pass by skipping every door spec | — |
| A-119 | DX voice F4 | The classics-hint variant is its own row; batch 1 is eight rows filed in Task 1.7; guard messages written | Mechanical | P1 | The guard would have rejected the plan's own ledger | — |
| A-120 | DX voice F5 | The no-PII scan's message names the line and that comments count | Mechanical | P1 | "expected true to be false" | — |
| A-121 | Final gate | Owner approved the reviewed plan as-is (option A, 2026-09-14): all defaults stand, UC1–UC5 recorded | User decision | — | The second and last non-auto-decided question | B–E |
<!-- audit-end -->
