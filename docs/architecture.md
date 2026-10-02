# Prediabetes Pal — architecture and feature map

**As of:** 2026-10-02 (main after #163–#170, #178, #180; GDM PR-1…PR-6 open as drafts #171–#177).
**Read this first**, then `docs/adr/` for the *why* behind each choice and
`docs/ops/env-reference.md` for the live configuration. Code is the source of
truth for everything else; this file names where to look.

Prediabetes Pal answers "can I eat this?" for people with a prediabetes-range
A1C. A user types, speaks, or photographs a meal; the app returns a
SAFE / MODERATE / HIGH verdict with one practical adjustment, one swap, and
plate-sequencing coaching. It is a mobile-first Next.js web app, installable as
a PWA and packaged as an Android TWA, with magic-link accounts, a card-gated
7-day trial, and a one-time paid "Pantry Review".

---

## 1. System diagram

```
            Browser / PWA / Android TWA (com.prediabetespal.twa)
            ┌────────────────────────────────────────────────────────┐
            │ Next.js 16 App Router · React 19 · service worker       │
            │ Guest state in localStorage (profile, history, taster) │
            │ Umami (typed no-PII events) · Sentry browser (scrubbed)│
            └───────────────┬────────────────────────────────────────┘
                            │ HTTPS
┌───────────────────────────▼────────────────────────────────────────┐
│ VERCEL (Fluid compute, Node runtime)                                │
│                                                                     │
│  proxy.ts — runs BEFORE any model spend / email / Stripe session    │
│    POST /api/check*      → Edge-Config kill switch → 20/h per IP   │
│                            → 2,000/day global cap                   │
│    POST trial/auth/billing/support → per-IP abuse buckets           │
│                                                                     │
│  app/api/**  (60+ route handlers, all factory + injected deps)      │
│    check · history · memory · journey · coach · profile · paywall   │
│    billing (stripe, play) · trial · pantry · account · support      │
│    push · feedback · cron/* · health · webhooks/resend · admin      │
│                                                                     │
│  lib/pal  — the judging engine (prompt, schemas, floors, contract)  │
│  lib/server — db, crypto, email, entitlement, billing, pantry, nudge│
│  app/gdm/** — second door: landing on main (dark); rest in #171–#177│
└──┬──────────┬──────────┬───────────┬───────────┬───────────┬────────┘
   │          │          │           │           │           │
   ▼          ▼          ▼           ▼           ▼           ▼
 Neon       Upstash   OpenRouter   Stripe /    Resend     Vercel Blob
 Postgres   Redis     (gpt-5.4-    Play        (email +   (private pantry
 (pooled,   (rate     mini, text   Billing     delivery   photos; encrypted
 Drizzle,   limits,   + vision,    (webhooks   webhook)   nightly DB dumps)
 AES-GCM    daily     strict JSON  → inbox)
 columns)   counter)  schema)
   ▲
   │ hourly GET with bearer token
┌──┴──────────────────────────────────────────────────────────────────┐
│ SCHEDULERS                                                           │
│  GitHub Actions hourly-crons.yml → nudge · pantry-sweep ·            │
│                                    trial-precharge · stripe-reconcile│
│  Vercel cron (vercel.json)       → bai-weekly (Mondays)              │
│  GitHub Actions db-backup.yml    → nightly pg_dump → Blob            │
└──────────────────────────────────────────────────────────────────────┘
```

## 2. Runtime components

| Concern | Choice | Where | Notes |
|---|---|---|---|
| App hosting | Vercel, Fluid compute, Node runtime | `vercel.json`, `next.config.ts` | Plan is **Hobby** (see §13) |
| Framework | Next.js 16.3 App Router, React 19, TypeScript 6 | `app/`, `components/` | `proxy.ts` is the Next 16 name for middleware |
| Database | Neon Postgres (us-east-1), pooled endpoint, `pg` + Drizzle ORM | `lib/server/db/`, `drizzle/` (20 migrations) | Runtime role is DML-only; migrations use a separate owner role (`docs/runbooks/database-governance.md`) |
| Field encryption | AES-256-GCM, versioned keyring (`HEALTH_DATA_KEY`, `_OLD`) | `lib/server/crypto.ts` | Encrypted: exact A1C, food text, result-card snapshot, clarify question, memory label/choice/note |
| Rate limiting | Upstash Redis sliding windows | `lib/pal/rate-limit.ts`, `proxy.ts` | Fails CLOSED on public deploys without config; email doors fail closed on outage, check path fails open |
| Kill switch | Vercel Edge Config (`launch_mode`, `public_checks_enabled`) | `lib/pal/launch-controls.ts` | Pauses all checks without a deploy |
| Model | OpenRouter → `openai/gpt-5.4-mini` (text + vision), Responses API, strict JSON schema | `lib/pal/openai-client.ts`, `lib/model-transport.ts` | 10 s timeout, 1 attempt, no SDK retries; unset `OPENAI_BASE_URL` to fall back to direct OpenAI |
| Auth | Auth.js v5, email magic link via Resend, **database sessions** | `auth.ts` | Per-email cooldown 3/h; identifier NFKC-normalised |
| Email | Resend over raw `fetch`, durable `email_delivery_attempts`, suppression list, signed delivery webhook | `lib/server/email.ts`, `email-delivery.ts`, `app/api/webhooks/resend` | Idempotency keys hashed; no payloads stored |
| Billing | Stripe Checkout + Portal + webhook → **durable inbox**; Google Play Billing (RTDN + verify-on-read), flag-gated off | `app/api/billing/handlers.ts`, `lib/server/billing/` | One `subscriptions` table, one `getEntitlement()` read path |
| Push | Web Push (VAPID) via `web-push` | `lib/server/nudge.ts` | Lease + bounded retry per subscription |
| File storage | Vercel Blob, **private** store for pantry photos | `lib/server/blob.ts`, `lib/server/pantry/` | Client uploads directly with a short-lived token |
| Analytics | Umami Cloud, typed closed event allowlist | `lib/client/analytics.ts` | Enforced by a unit test with a static PII scan |
| Errors | Sentry server (integration allowlist, no PII) + browser (scrubbed) | `sentry.server.config.ts`, `lib/pal/sentry-scrub.ts` | Inert without DSN |
| Readiness | `/api/health` (db, 5 cron heartbeats, Upstash, Resend, Stripe secret, flag states) | `app/api/health/route.ts` | `/api/health/live` is liveness only |
| CI | GitHub Actions: typecheck, lint, safety contract, config check, Drizzle drift, build, unit + mock evals, Playwright ×3 with axe | `.github/workflows/ci.yml` | Dependabot grouped updates |
| Backups | Nightly `pg_dump`, AES-encrypted, 7 daily + 12 monthly slots in Blob | `.github/workflows/db-backup.yml`, `docs/runbooks/db-backups.md` | Restore procedure in the runbook |

## 3. The check path (the product's hot path)

```
POST /api/check  {food, a1c}  + headers x-pal-clarified / -client-id / -coach-rotation / -daypart
  │
  ├─ proxy.ts: kill switch → per-IP → global daily cap            (no spend yet)
  │
  ├─ route.ts: session? → entitlement wall (trial mode: 402 unless premium/trialing;
  │            legacy mode: 5 free checks/day) → per-user 200/day spend cap
  │            Clinical inputs bypass the wall (HS-1).
  │
  └─ lib/pal/service.ts  checkFood()
       1. CheckRequestSchema (zod)            → invalid → calm "invalid" card
       2. classifyClinicalRisk(food)          → match → clinical card, NO model call
       3. routeA1C(a1c)                       → out of 5.7–6.4 → out-of-scope card
       4. classifyInputBeforeModel(food)      → not_food / clarify (once) / policy flags
       5. buildPalPrompt(contract, band, flags)
       6. model.generate(prompt)              → strict JSON (result | carbs_only | clarify | not_food)
       7. postprocessModelOutput              → conservative floors, forbidden-claim guard,
                                                prompt-leak guard, disclaimer merge
       8. any throw → buildRetryResponse      (calm retry card; Sentry gets the cause)
  │
  ├─ deriveCoachOutputs()  → sequencing tip, post-meal action, "keep most" (audited phrase bank)
  ├─ persistCheck()        → signed-in + consented only: encrypted food + encrypted card snapshot,
  │                          prompt/contract/model versions, floor applied (fail-soft, reported)
  └─ telemetry: check_completed / check_failed with latency + versions, never food text
```

Budgets: client aborts at 12 s, model timeout 10 s, `maxDuration = 15`.

## 4. Data model (22 tables, `lib/server/db/schema.ts`)

| Group | Tables | Notes |
|---|---|---|
| Identity | `users`, `accounts`, `sessions`, `verification_tokens` | Auth.js shape; everything user-linked cascades on delete |
| Profile | `profiles` | Consent stamp, encrypted A1C + band, timezone, nudge prefs (hour, cadence, quiet hours, opt-in), orientation state |
| Checks | `checks`, `check_feedback` | Encrypted food + card snapshot, risk, input method, versions; `checks_user_day` index; feedback review queue |
| Retention | `meal_memories`, `learning_journeys`, `weekly_reflections`, `bai_weekly` | Memory per check; 5-stage 90-day journey (pause/graduate); weekly artifact; BAI score (retire candidate) |
| Push | `push_subscriptions` | Endpoint-unique; lease token, attempt date/count, retry-after |
| Billing | `subscriptions`, `billing_event_inbox` | `provider ∈ {play, stripe}`, `provider_ref` unique; inbox dedupes on provider event id, dead-letters after 5 attempts, PII redacted after processing |
| Email | `email_delivery_attempts`, `email_suppressions` | Status machine from Resend webhooks; recipient stored as HMAC hash |
| Pantry Review | `pantry_orders`, `pantry_photos`, `pantry_items` | Stripe session id unique (idempotency); claim token; sweep index on status |
| Ops | `support_cases`, `deletion_log`, `cron_heartbeat` | Identity-free deletion audit; heartbeat read by `/api/health` |
| GDM door (draft PR) | `gdm_profiles`, `gdm_items` | Migration 0020 in draft #171, not on `main` or in production; consent-gated, field-encrypted; see §8.2 |

## 5. API surface (`app/api/`)

| Area | Routes | Auth |
|---|---|---|
| Check | `POST check`, `POST check/photo-draft` | guest or session; photo is premium |
| History | `GET history` (keyset cursor), `history/search`, `history/[id]`, `POST history/action`, `history/export`, `history/migrate` (guest → server) | session |
| Memory | `GET/POST/DELETE memory`, `memory/[id]`, `memory/recall`, `memory/search`, `memory/export` | session + premium + flag |
| Journey / coach | `journey`, `journey/weekly`, `coach` (insight + BAI progress) | session; journey flag-gated |
| Profile & paywall | `GET/PATCH profile`, `GET paywall`, `GET entitlement` | session |
| Trial & billing | `POST trial/start`; `billing/stripe/{checkout, pantry-checkout, portal, sync, webhook}`, `billing/cancel`, `billing/play/{verify, rtdn}` | mixed; webhooks provider-signed |
| Pantry | `pantry/{submit, upload, process, confirm}`, `/pantry/claim` (route) | claim-token bound to first signed-in visitor |
| Account | `account/{export, delete, health-data}` | session |
| Support & feedback | `POST support/case`, `POST feedback` | session / anonymous-by-design |
| Push | `POST push/subscribe` | session |
| Cron | `cron/{nudge, pantry-sweep, trial-precharge, stripe-reconcile, bai-weekly}` | `CRON_SECRET` bearer, constant-time compare |
| Health | `health`, `health/live` | public, `no-store` |
| Webhooks | `webhooks/resend` | svix signature |
| Admin | `admin/{feedback, pantry, support}` | `ADMIN_EMAIL` session only |
| Internal | `video-engine/*` | internal tooling (§12) |

## 6. Pages and app shell

| Surface | Routes | Purpose |
|---|---|---|
| Marketing | `/`, `/about`, `/how-it-works`, `/demo`, `/welcome`, `/guides/*` (5 SEO guides), `/get-the-app`, `public/llms.txt` | Landing, demo card, store waitlist (Tally) |
| App shell | `/home`, `/check`, `/meals`, `/journey`, `/account` | Tab bar: Home · My meals · Check · My journey · Account (`components/app-nav.tsx`); `/history`, `/memory`, `/progress` redirect here |
| Onboarding & learning | `/onboarding`, `/learn`, `/learn/first-week` | A1C intake, orientation ("your first week") |
| Account | `/signin`, `/signin/check-email`, `/account`, `/account/delete`, `/subscribe`, `/trial/started`, `/canceled`, `/canceled/confirm` | Magic link, plan box, cancel flow |
| Legal | `/privacy`, `/terms` | Copy renders flag-dependent sentences |
| Pantry Review | `/pantry`, `/pantry/intake`, `/pantry/thanks`, `/report/[id]` | $49 one-time product |
| Admin | `/admin/feedback`, `/admin/pantry` | Founder-only tables |
| Internal | `/video-engine` | Dashboard for §12 |
| GDM door | `/gdm`, `/gdm/start`, `/gdm/privacy`, `/gdm/{home, questions, plan, meals, summary, data}` | `/gdm` and the `/gdm/start` stub on `main` (404 while dark); the rest in drafts #171–#177; outside the `(app)` shell; see §8.2 |

PWA: `public/manifest.webmanifest` (start `/home`), `public/sw.js` (offline page, build-id versioned cache, dev kill switch), TWA package `com.prediabetespal.twa` (`twa-manifest.json`).

## 7. Features

| Feature | What the user gets | Tier | Gate / flag | Code |
|---|---|---|---|---|
| Food check (text) | Verdict + reason + adjustment + swap + coach lines | guest Day 1, then trial/premium | `PAYWALL_MODE` | `lib/pal/*`, `components/food-check-form.tsx`, `result-card.tsx` |
| Voice input | Dictate the meal (Web Speech API) | same | browser capability | `lib/client/speech.ts` |
| Photo assist | Vision drafts the meal text; user reviews before checking | premium | `NEXT_PUBLIC_PHOTO_INPUT` + `PHOTO_INPUT_ENABLED` | `lib/meal/photo-extract.ts`, `photo-draft-review.tsx` |
| Clinical routing | Deterministic routes (urgent symptoms, possible hypoglycemia, medication dosing, eating disorder, pregnancy, organ disease, allergy, diagnosed diabetes, …) get a "see a person" card, never a verdict, never a paywall | all | always on | `lib/pal/clinical-risk.ts` (`CLINICAL_ROUTES`) |
| Clarify once | One bounded follow-up question for ambiguous meals | all | always on | `lib/pal/clarify.ts`, `input-precheck.ts` |
| Guide door | Idea chips, source line, calm/orient copy, intake questions, Learn pages — 12 surfaces, opened per deploy (see §8) | per surface; **all 12 off in production** (live `/api/health`, 2026-10-01); first planned value `ideas,source` | `NEXT_PUBLIC_GUIDE_DOOR` surface list, build-time ledger guard | `lib/guide-door-flag.ts`, `guide-door-guard.ts`, `components/guide-ideas.tsx`, `home-door.tsx` |
| Onboarding + first week | A1C intake with boundary copy; orientation steps complete where they happen | all | — | `/onboarding`, `lib/coach/orientation.ts`, `orientation-*.tsx` |
| History / meals | 7-day window free, full archive premium; search; "I did it" action; export | signed-in | capability matrix | `app/api/history/handlers.ts`, `components/today-list.tsx`, `week-strip.tsx` |
| Meal memory | Save a label, choice, note per check; recall and search | premium | `MEAL_MEMORY_ENABLED` (+ `NEXT_PUBLIC_`) | `app/api/memory/handlers.ts`, `meal-memory-*.tsx` |
| Thin insight | Daypart / repeat-meal pattern line | free, signed-in | `LONGITUDINAL_INSIGHTS_ENABLED` | `lib/coach/insights.ts`, `dashboard-insight.tsx` |
| Learning journey | 5-stage 90-day journey, weekly learning summary, pause/graduate | premium | `LEARNING_JOURNEY_ENABLED` (+ `NEXT_PUBLIC_`) | `lib/journey/*`, `journey-card.tsx`, `learning-summary.tsx` |
| Progress / BAI | Weekly adherence score (surface replaced by learning summary; cron still runs) | premium | journey flag | `lib/coach/bai.ts`, `lib/server/bai-cron.ts` |
| Daily nudge | One push per local day, cadence + quiet hours, journey-aware copy | premium, opt-in | — | `lib/server/nudge.ts`, `lib/journey/nudge.ts`, `nudge-opt-in.tsx` |
| Trial & subscription | Card-gated 7-day trial → monthly (3 price variants); pre-charge email; cancel at period end; refunds honoured | — | `TRIAL_PRICE_VARIANT`, `LEGAL_TERMS_FINAL` (`0` closes checkout) | `app/api/billing/handlers.ts`, `trial-wall.tsx`, `paywall-card.tsx` |
| Play Billing | Digital Goods purchase inside the TWA | — | `NEXT_PUBLIC_PLAY_BILLING` (off) | `lib/client/digital-goods.ts`, `lib/server/play-api.ts` |
| Pantry Review | Pay $49, photograph the pantry (≤10 photos), vision extracts items, user confirms (≤40), each item judged, report page + emails | one-time | `STRIPE_PRICE_PANTRY`, private Blob token | `lib/server/pantry/*`, `lib/pantry/extract.ts`, `pantry-intake-flow.tsx` |
| Result feedback | Feedback on a result with a bounded reason (too vague, wrong food, felt unsafe, confusing, other) and optional comment, linked to the persisted check; founder review queue | all | — | `lib/client/feedback.ts`, `result-feedback.tsx`, `/admin/feedback` |
| Support cases | In-app help/refund request, emailed to the inbox | signed-in | — | `app/api/support/case`, `support-case-form.tsx` |
| Data rights | One-file export; account delete (cancels Stripe, deletes Blob, cascades); withdraw health-data consent | signed-in | — | `app/api/account/*` |
| Attribution | UTM source → closed channel enum (no in-app-browser detection yet: `TODOS.md` top item, row `signin-in-app-browser`) | all | — | `lib/client/attribution.ts` |

## 8. Planned, dormant and gated features

Two implementation plans extend the product. Both follow the same rule: code
merges dark behind a surface-listed build flag, a production guard refuses any
surface whose copy-ledger rows are not `Approved`, and a safety owner who is not
the executor opens each gate. Status below is as of 2026-10-02.

### 8.1 Guide redesign — `docs/superpowers/plans/2026-09-13-guide-redesign.md`

Turns the front door from "a judge" into "a guide". **Every Tier-1 PR is built
and merged on `main`, dormant** (execution audit: fully executed, 0 gaps —
`docs/audit/2026-09-19-guide-redesign-execution-audit.md`). Every surface is
off in production.

| Feature | What it is | PR | Surface | Release blockers |
|---|---|---|---|---|
| F-IDEAS (minimal) + F-SOURCE | Three idea chips on Home and the `/check` first-run row; a source lead-in on the result card; kill-line analytics | PR-1 #144 | `ideas`, `source` | D5 concierge test (not started); ledger batch 1, 8 rows `Pending`; `lib/pal/guide-ideas.labels.json` from the owner's paid `npm run eval:pal:ideas` |
| F-CALM | Calm-tone audit; neutral-ink "Hold off" verdict family | PR-2 #146 | `calm` | Colour-blind / "looks like a warning" review recorded |
| F-ORIENT | "Your first week" orientation on `/learn/first-week`, steps complete where they happen; `profiles.orientation` (migration 0019, applied) | PR-3 #145 #146 #147 | `orient` | Ledger batch 2 (18 of its 28 rows) |
| F-IDEAS (full) | Bank grown to ≥ 10 ideas per daypart, segment steering, "See all" | PR-4 #153 | `ideas-full` | Ledger batch 3, 4 rows; `ideas` live first; the ideas-viewed : checks-run ratio read |
| Home layout | Quick row, Learn tiles, hero asks the guide's question | PR-5 #156 | `home` | Ledger batch 2 (5 rows) |
| Intake / F-ASK | Onboarding Screens A/B ("what is hardest right now"), welcome line, `intake_ask` event | PR-6 #157; guard #158 | `intake` (requires `orient`, `source`, `home`) | Ledger batch 2 (5 rows); counsel's A-105 answer; design review of A/B |

Flip order (plan §7.3): batch 1 `Approved` + label eval green ⇒ `NEXT_PUBLIC_GUIDE_DOOR=ideas,source` (reviewed build; never `1`). Kill line 2: sessions with `idea_tapped` ÷ sessions that rendered a block < 25% after four weeks ⇒ flag off. Revert is a rebuild, not an env flip (no server twin by design).

Gated modules, **not built**, each waiting on a decision that is not engineering's:

| Module | What it would be | Gate |
|---|---|---|
| F-NUMBERS | `/learn/numbers`: what A1C and fasting glucose mean, in general; never the user's own value | D7: a claim class for general A1C education |
| F-TREND | "Your A1C over time" as dated points on `/journey`; `a1c_entries` table, own twin flag pair | D3 (out-of-range entries) and RV-3 (`%` rail) |
| F-SOURCE paragraph | "Same read every time" line on `/how-it-works` | Consistency eval on the whole panel (≥ 95% modal class) + an approved row |
| F-REFER | Referral / dietitian script section on `/learn/first-week` | Safety owner clears three rows |
| F-DOCTOR | `/learn/doctor`: on-device keyword match returns reviewed questions, never answers; no model, no server | D2: the question bank approved |
| F-PLAN | A default meal pattern labelled "Prediabetes Pal's default", plus an intake screener | D1: owner changes the "we never invent the rule" posture |
| F-HABIT | Free guide reminder on the existing nudge cron | After Phase 5 shows whether anyone returns without it |
| F-DIARY (Tier 3) | Food beside glucose readings | D4: a new intended-use statement; recorded, not recommended |

### 8.2 GDM door — `docs/superpowers/plans/2026-09-19-gdm-door.md`

A second front door, on the same app, for a person told she has gestational
diabetes and waiting for her dietitian. **Tier 1 is fully built and reviewed.** PR-0 (#169) and PR-L
(#170) merged dark on 2026-10-02: the flag pair, the production guard, `gdmDoor`
in `/api/health` (all four surfaces `off`), and `/gdm` (404 until `landing` is
on). PR-1 … PR-6 and the review-fix tip are stacked draft PRs #171–#177
(branches `gdm/pr-1` … `gdm/pr-6`, `feat/gdm-door-tier1`), held until migration
0020 is applied to production.

| PR | Feature | What it is | Where (branch) |
|---|---|---|---|
| PR-0 | Foundations | `NEXT_PUBLIC_GDM_DOOR` surfaces `landing`, `organiser`, `ideas`, `read` + server twin `GDM_DOOR_ENABLED` (fails closed); production guard reading `docs/safety/gdm-gates.md` and the ledger; `/api/health` `gdmDoor`; 8 analytics events; a pin that the `pregnancy` clinical route stays on every non-GDM path | `lib/gdm-door-flag.ts`, `lib/gdm-door-guard.ts` |
| PR-L | Landing | `/gdm` with a sign-up; built second so it can release first | `app/gdm/page.tsx` |
| PR-1 | Door shell | `/gdm/start` A1C-free onboarding with explicit health-data consent; `/gdm/privacy`; export + erase on `/gdm/data`; tables `gdm_profiles`, `gdm_items` (migration 0020); `/api/gdm/{profile, items, plan-photo}` | `lib/server/gdm-*.ts`, `app/api/gdm/` |
| PR-2 | F-ASKLIST | "My questions": park a question for the appointment in one tap; clinical routes answer first | `/gdm/questions`, `lib/pal/gdm/asklist.ts` |
| PR-3 | F-PLANKEEP | "My plan" in her clinician's words and unit; two current plans shown side by side with a neutral "These differ"; sheet photo encrypted in Postgres, no OCR, no model | `/gdm/plan`, `lib/pal/gdm/plan-record.ts`, `plan-photo.ts` |
| PR-4 | F-WAIT | Waiting-for-my-dietitian mode on the door's Home: ACOG's structure quoted and attributed, the appointment spoken as a phrase, never a count of days | `/gdm/home`, `lib/pal/gdm/waiting.ts` |
| PR-5 | F-MYMEALS | Her own meal list by occasion; no label, no read, no score | `/gdm/meals` |
| PR-6 | F-SUMMARY | One printable page for the appointment, only her words and fixed headings; the kill-line reads in `launch-controls.md` §14 | `/gdm/summary`, `lib/pal/gdm/summary.ts` |

Architecture facts that matter: the door lives under `app/gdm/**` outside the
`(app)` shell (no tab bar, no first-run gate, no link to `/check`); it never
imports `lib/pal/a1c.ts`; Tier 1 makes **no model call** and adds **no
dependency**; every product-authored string is in one bank (`lib/pal/gdm/copy.ts`)
tested for ledger parity; the shared export and erase routes cover the two new
tables.

Release blockers (none started as of the plan's table): the `gdm-organiser`
claim class (safety owner / counsel); ledger batch G1, 28 rows, draft unsent
(`docs/handoff/2026-09-27-gdm-batch-g1-safety-owner-draft.md` on the branch);
**migration 0020 applied to production before PR-1 merges** — the shared
export/erase routes query the new tables for every user, so code before tables
500s both routes; counsel reads the privacy notice; the two premise rows (who
reviews batch G1 and by when; where the first fifty users come from). Revert is
an env flip: unset `GDM_DOOR_ENABLED` and redeploy.

Tier 2, **gated and not built**, starts only after KL-T1 is *read* (≥ 50 door
users): F-IDEAS-GDM (meal ideas by occasion; S1, S2, S3, class S5), F-ROUTER +
the read box (S1–S4), F-PLANREAD (a meal read against her own figure; S1–S4, a
new engine path, a fixed-panel eval). Recorded and not planned, with the PRD's
reasons: F-READ-GDM, F-IMPORT, F-STARTERS, F-LEARN-GDM, F-JOURNAL,
F-EXPERIENCES, F-REMIND.

## 9. Background jobs

| Job | Schedule | What it does | Heartbeat stale after |
|---|---|---|---|
| `nudge` | `7,27,47 * * * *` (GitHub Actions, #164) | Enumerate opted-in profiles, send due pushes, prune dead endpoints, bounded same-day retry | 2 h |
| `pantry-sweep` | hourly | Resend unsent claim emails, resume stuck extractions, retry undelivered reports, alert on stuck orders | 2 h |
| `trial-precharge` | hourly | Email trialing users whose charge lands within 48 h (claim-before-send) | 2 h |
| `stripe-reconcile` | hourly | Reprocess failed inbox rows, heal stale subscription rows against Stripe, scan paid invoices without a row | 2 h |
| `bai-weekly` | Mondays 04:30 UTC (Vercel) | Compute prior week's BAI per premium user | 8 days |
| `db-backup` | nightly (GitHub Actions) | Encrypted `pg_dump` to Blob | — |

All crons: bearer `CRON_SECRET`, constant-time compare, fail-soft per user, stamp `cron_heartbeat`. The runner `scripts/run-hourly-crons.mjs` pins `APP_URL` byte-for-byte to the canonical host.

**Observed 2026-10-01:** GitHub fires the "hourly" schedule every 3–7 hours on this repo (20 scheduled runs over the previous 4.5 days, all successful). With a 2-hour staleness window, `/api/health` reads all four hourly crons `stale` most of the day and returns 503 — which is also the release gate `docs/adr/hosting-hybrid.md` names, so a deploy verified by the runbook reads red. A user's daily nudge fires only on days when a run lands inside their chosen hour: roughly one day in five at the observed cadence, and missed days do not catch up (`cadenceAllowsSend` treats each day independently). Trial pre-charge emails, the Stripe reconcile and the pantry sweep still run, hours late. This is a scheduler problem, not a code problem; see §13. **2026-10-02:** #164 moved the schedule to three times an hour, off the top of the hour. In its first 8.5 hours on `main` GitHub fired one scheduled run (16:50 UTC), so the interim has not fixed the cadence yet; read it again ~24 h after the merge (`docs/ops/outstanding.md`). Vercel Pro is the durable fix.

## 10. Safety and privacy architecture

- **Safety contract** (`lib/pal/safety-contract.ts`, `CONTRACT_VERSION 2026-07-24.1`) and **prompt** (`lib/pal/prompt.ts`, `PROMPT_VERSION 2026-08-16.1`) are versioned and stamped onto every persisted check and telemetry event.
- **Copy ledger** (`docs/safety/copy-ledger.md`): every user-facing health sentence is a ledger row; `scripts/validate-safety-contract.mjs` runs the forbidden-claim regexes over all approved strings in CI; the guide-door guard refuses a production build that renders an unapproved row.
- **Clinical precedence** is structural: the clinical classifier runs before the A1C route, before the precheck, before any prompt is built.
- **Conservative floors** in postprocess can only raise a verdict, never lower it; the floor that fired is recorded on the snapshot.
- **No health text leaves the server** in telemetry, analytics, Sentry, or URLs. Headers carry only closed enums. Stripe inbox payloads are allow-listed then redacted. Email recipients are hashed.
- **Encryption at rest** for every special-category column; keyring rotation runbook in `docs/runbooks/health-key-rotation.md`.
- **Evals** (`tests/evals/`): safety eval, graded eval (`scripts/run-graded-evals.mjs`), guide-ideas labelling, meal-photo, pantry-extract; a dietitian review packet and validator (`scripts/validate-dietitian-review.mjs`). Live evals need explicit `PAL_LIVE_EVAL=1`.

## 11. Flags and kill switches

| Flag | Kind | Effect |
|---|---|---|
| Edge Config `launch_mode` / `public_checks_enabled` | runtime, no deploy | Pause every check with a calm 503 |
| `PAL_DAILY_CHECK_CAP` | runtime env | Global daily model-spend ceiling (default 2,000) |
| `PAYWALL_MODE` | runtime env | `trial` (default) or `legacy` free tier |
| `LEGAL_TERMS_FINAL=0` | runtime env | Closes every paid Stripe entry point |
| `PHOTO_INPUT_ENABLED`, `MEAL_MEMORY_ENABLED`, `LEARNING_JOURNEY_ENABLED`, `LONGITUDINAL_INSIGHTS_ENABLED` | runtime server twins | Kill the feature's API without a rebuild; the build fails if the matching `NEXT_PUBLIC_*` is on and the twin is off |
| `NEXT_PUBLIC_GUIDE_DOOR` | build-time surface list | Opens guide-door surfaces; production is guarded by the copy ledger |
| `NEXT_PUBLIC_PLAY_BILLING` | build-time | Play purchase UI (off) |
| `NEXT_PUBLIC_GDM_DOOR` + `GDM_DOOR_ENABLED` (on `main`, all surfaces off) | build-time surface list + runtime twin | GDM door surfaces `landing`, `organiser`, `ideas`, `read`; the twin fails closed and is the revert lever (§8.2) |
| `PAL_MODEL` / `PAL_VISION_MODEL` / `OPENAI_BASE_URL` | runtime env | Model and provider switch; the fleet-wide outage fallback |

`/api/health` reports every runtime switch as an `on`/`off` name, never a value.

## 12. Internal tooling

- **Video engine** (`video-engine/`, `/video-engine`, `app/api/video-engine/*`): weekly voice-of-customer dump → insight mining → hooks → compliance-linted short-form video specs → Remotion render. Marketing tooling that lives in the repo; its routes return 404 outside local development and it never imports the database.
- **Admin** (`/admin/*`): feedback review queue, pantry order table, support cases. Gated by one `ADMIN_EMAIL`.
- **Scripts** (`scripts/`): production config check, DB governance check, graded/live evals, model bake-off, e2e runners, landing/marketing captures, seeders for reviewer accounts and pantry orders, backup upload.

## 13. Known ceilings (see the 2026-10-01 architecture review)

| Ceiling | Where | Action |
|---|---|---|
| Vercel Hobby plan on a paid product; Neon Free tier | hosting | Pro + paid Neon before launch |
| 2,000 checks/day global | `lib/pal/rate-limit.ts` | raise with budget |
| Nudge/BAI crons loop every opted-in profile hourly | `lib/server/nudge.ts`, `bai-cron.ts` | SQL-selected due set at low thousands of premium users |
| Hourly crons on GitHub Actions | `.github/workflows/hourly-crons.yml` | **Already biting:** runs land every 3–7 h, not hourly (§9), so health is degraded and nudges mostly miss their hour; 60-day inactivity would disable the schedule outright. Vercel Pro moves the four jobs back to `vercel.json` |
| `app/api/billing/handlers.ts` | 1,600 lines | split before the next billing feature |

## 14. Where to look

| Question | Start at |
|---|---|
| Why this stack / host / billing design | `docs/adr/*.md` (read the superseded note in `hosting-hybrid.md`) |
| Which env vars exist and what they do | `docs/ops/env-reference.md` |
| What is left before launch | `docs/ops/outstanding.md`, `docs/handoff/human-actions-required.md` |
| What copy is approved | `docs/safety/copy-ledger.md` |
| How to run / restore / rotate | `docs/runbooks/` |
| Recent decisions and handoffs | `docs/handoff/` (newest first), `docs/superpowers/plans/` |
| Deferred work | `TODOS.md` |
