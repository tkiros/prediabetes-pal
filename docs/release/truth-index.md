# Revora Release Truth Index + Evidence Closure Checklist

**Document owner:** Engineering (branch `feat/value-retention-plan-2026-07-18`; re-verified on `feat/c7-four-jobs-and-audit-residuals`)
**Review date:** 2026-07-21 (previous: 2026-07-19)
**Next review due:** before any broad-distribution decision, and on every change to a claim surface below
**Source plan:** `docs/handoff/2026-07-18-revora-100-value-95-retention-validation-and-implementation-plan.md`
**Shipped-evidence ledger:** `.superpowers/sdd/progress.md` (Tasks T1–T22, this branch)

## Status header

- **This index is engineering-authored.** It records what code shipped and what each public
  claim now maps to. It is not sign-off.
- **All human approvals are PENDING** — credentialed RD/CDCES review, function-specific counsel,
  privacy/DPIA, and accessibility audit have not run. No row below may be read as clinical, legal,
  or clearance evidence (plan §3.3).
- **Phase 0 is DEFERRED by user instruction.** DNS/TLS, auth email, analytics deployment,
  support/refund ops, and the source-of-truth quarantine (§P0.5) are not executed. The quarantine
  rows in the claims table are structured here but marked **BLOCKED-ON-PHASE-0**; this index is the
  §P0.5 "release truth index" artifact, created ahead of the quarantine pass it will later anchor.
- No readiness score in the plan is a measured user outcome. Do not publish the 60/100 or 31/100
  proxies (plan §5, §2.3).
- **Production ops state (2026-07-19):** schema is current through migration `0012_journey-pause-reason`
  on the live Railway `Postgres` service. The drizzle migration journal, which was never created
  (schema was historically pushed), is now **baselined** — `drizzle.__drizzle_migrations` seeded with
  entries 0000–0012 via `scripts/baseline-drizzle-journal.mjs`, and `npx drizzle-kit migrate` verified
  as a clean no-op — so the documented migration command (`docs/ops/env-reference.md`) works and future
  migrations apply normally. `stripe-reconcile` is registered in the Railway `hourly-crons` scheduler
  and running hourly. Two empty orphan Postgres services (`Postgres-D2oG`, `Postgres-FOMu`, zero app
  tables each) still exist in the Railway project pending owner deletion — only `Postgres` is canonical.
- **Production ops update (2026-07-21, C7 session):** migration `0013_cancel-at-period-end` applied to
  the live Railway `Postgres` (journal at 14 rows) and the RE-08 structural comparison **passed** —
  `drizzle-kit pull` of prod diffed clean against `drizzle/meta/0013_snapshot.json`. Migration
  `0014_support-cases` is authored on the C7 branch and **must be applied at C7 deploy time** (same
  flow). `www.revora.plus` now 308-redirects to the apex (P0.1 pass criterion met, verified live).
  Server twins `PHOTO_INPUT_ENABLED=1` + `LONGITUDINAL_INSIGHTS_ENABLED=1` are set in Vercel
  production, mirroring the enabled `NEXT_PUBLIC_*` values (the C7 build fails on twin mismatch).
  Sentry client DSN: CLOSED (2026-07-22, PR #25 deployed). `NEXT_PUBLIC_SENTRY_DSN` is set in
  Vercel Production + Preview and ships in the client bundle; on revora.plus the SDK initialises
  (`window.__SENTRY__` present, client live) and CSP `connect-src` now carries the DSN's ingest
  origin — verified in the live header. Before that origin landed, every envelope POST was
  CSP-blocked and errors silently never arrived, so the DSN alone was not enough. Envelope
  delivery OBSERVED (2026-07-22, owner-authorized): a deliberate uncaught error
  (`revora-sentry-verification-manual-1784733827563`) thrown on production `/home` produced a
  POST to `o4511672801820672.ingest.us.sentry.io/api/4511691306696704/envelope/` that returned
  **200** with zero CSP violations — ingest accepts the client's envelopes end to end.
  Issue-stream visibility CONFIRMED (2026-07-22): issue `PAL_1-3` (unhandled TypeError from
  `auto.browser.global_handlers.onerror` on `/signin`, collateral from the verification session's
  flaky network) appeared in the Sentry Issues feed and fired an email alert — capture → ingest →
  issue → alert all observed. NOTE for future verifiers: Sentry's data scrubbing redacts error
  MESSAGES (`[redacted]` in the issue stream), so free-text search for a planted error string will
  never match — verify by mechanism/url/first-seen instead. Stripe webhook: endpoint `we_1TqNZLKweWSWjefk1MkEUChd` →
  `/api/billing/stripe/webhook` is Active on acct_14W8GFKweWSWjefk with all 6 events bound (the
  owner added `invoice.payment_failed`; secret unrotated). Signature path PROVEN both directions
  (2026-07-22): a CLI-signed forgery got 400 and a payload hand-signed with the live endpoint
  secret got 200 `{"received":true,"outcome":"processed"}` (test audit row deleted afterward).
  Support-case round-trip FULLY PROVEN end to end (2026-07-22, four test cases). App half: magic
  link sign-in on production, case submitted from /account, API 201 `{caseId, emailed:true}`,
  case id rendered. Delivery half took a real fix: cases `3a623ed1`, `100f8c4b`, `0154b3a6` all
  BOUNCED at support@revora.plus — `revora.plus` MX is Namecheap email forwarding, whose relays
  greylist Resend's sending IPs (3/3 Resend→support@ bounced while 4/4 Resend→Gmail delivered and
  an owner Gmail→support@ test forwarded fine; real MTAs retry 4xx, Resend gives up). Fix shipped
  as PR #32: `supportInbox()` (`SUPPORT_INBOX_EMAIL` env, falling back to the public
  `SUPPORT_EMAIL`) now addresses all four internal sends (support case, pantry-sweep alert, both
  pantry needs-manual alerts); the public support@ address is unchanged on every user surface.
  Final case `08f0c637` through the deployed fix: Resend **Delivered**, email observed in the
  owner inbox. Test cases in `support_cases` are safe to close on sight.
  Route renames shipped on the C7 branch: `/progress`→`/journey`, `/history`+`/memory`→`/meals`
  (permanent redirects); the C14 progress-truth row's behavior now lives at `/journey`, and the BAI
  band/bars are replaced by the non-scored recap (RV-3) — the score is computed for internal S2
  measurement only and never rendered.

---

## 1. Claims-to-truth table

Every public/claim surface → truth status after this branch → owner + disposition.

Disposition legend: **current** (truthful, shipped) · **superseded** (must be rewritten/quarantined; do
not treat as current) · **BLOCKED-ON-PHASE-0** (quarantine deferred) · **pending counsel** (claim needs
legal classification before it may stand) · **pending flag-on** (behavior built but gated off).

| # | Claim surface | Public claim (pre-branch) | Current truth after this branch | Owner | Disposition |
|---|---|---|---|---|---|
| C1 | Landing demo / demo card (`app/page.tsx`, `components/demo-check-card.tsx`) | Oatmeal produces an immediate "Be careful" card | **Now honest two-step** (T2). Registry-driven demo shows the clarify-then-answer flow: enter oatmeal → "plain or sweetened?" → answer → card. Deploy-blocking fixture test guards the promise registry. | Product / Eng | current |
| C2 | Onboarding tour (`app/onboarding/page.tsx`) | High-range clinical copy hardcoded in onboarding; oatmeal chip implies instant verdict | **Copy drift fixed** (T1): high-range/boundary copy now renders from one versioned source with a drift test; profile route drift corrected. First-check chips remain honest against registry. | Product / Safety | current |
| C3 | Paywall bullets — history (`components/*paywall*`, pricing) | "Full history, every device" | **Now true** (T9): keyset pagination, POST-body search (no meal text in URLs), export = all rows, owner-scoped delete, truthful copy + distinct error states. Replaces the old `loadHistory(7)` "last seven days on this device". | Eng / Billing | current |
| C4 | Paywall bullets — weekly insights (`lib/coach/insights.ts`, capability matrix) | "Weekly insights are Premium" | **Bullet removed pending T18 flag-on** (T10). `capabilitiesFor` is now the single source; thin longitudinal insight is free onboarding value; false weekly-insights Premium promises removed. Weekly learning artifact (T18) is the real Premium artifact but ships **flag-off** (see FF ledger). | Product / Eng | pending flag-on |
| C5 | Landing "weekly pattern" phrasing (`app/page.tsx:315`) | Flag-gated "weekly pattern" copy | Provenance note: `NEXT_PUBLIC_LONGITUDINAL_INSIGHTS` **fails closed (off) when unset in code**, but §3.2 line 130 records it **enabled in the pre-branch production deployment**. Either way, T10's disposition governs — thin insight is free for all and false weekly-insights Premium promises were removed — so this phrasing renders as a **free thin insight**, not a Premium gate (T10 minor). Reconcile wording when the insight-vs-weekly-artifact decision (P2.4/T18) lands. | Product | pending flag-on |
| C6 | Terms of Service (`/terms`) | Refund → email support; counsel draft with 2 bracketed placeholders (entity, governing law) | Directs users to support and refund macros exist, but mailbox deliverability + in-account case/SLA path are **Phase 0** work. Placeholders remain (counsel Q10). | Counsel / Owner | pending counsel |
| C7 | Public "wellness tool, not a medical device" assertion (landing, distribution copy) | "Informational-only by design (wellness tool, not a medical device)" | **Overstated — must not stand** (K5, §16). Remove the public status assertion; counsel must classify intended use/labeling/each function vs current FDA guidance before any device-status wording. | Counsel | pending counsel |
| C8 | "Check any meal" / cultural-coverage copy | "Check any meal" | **Too broad** (§4.3). Replace "any" with supported truthful copy until credentialed strata pass. Ontology expansion (T6 corpus) is engineering evidence only. | Product / Safety | superseded |
| C9 | `docs/product-marketing.md` | Photo/insights described as unadvertised while flags + public copy are live (K7) | **Superseded** — reconcile after product/claims review. Mark passages promising unreviewed features / glucose-spike / DPP / regulatory status as superseded, not silently current. | Product / Counsel | BLOCKED-ON-PHASE-0 |
| C10 | `docs/ICP.md` | "spike", individualized-effect, DPP, regulatory-status language outside conservative boundary (§4.6) | **Superseded** — quarantine and reconcile before acquisition. | Product / Counsel | BLOCKED-ON-PHASE-0 |
| C11 | `docs/Revora_90-Day_Distribution_Strategy.md` — SCRIPT 1 + §5.1 + POST 3 | **Original T2 finding was wrong** (2026-07-19 verification): "instant oatmeal, banana, orange juice" is fully described — the classifier does **not** clarify (`classifyInputBeforeModel` returns `carbs_only + high_risk`). The real mismatch: "juice" carries a deterministic `carbs_only + high_risk` floor (`input-precheck.ts:132,181`) forcing **HIGH → "Hold off"**, not the scripted "Be careful"; and HIGH is swap-led — the adjustment is suppressed (`postprocess.ts:263`), so the scripted "add protein, keep the oats" card cannot render for that input. POST 1/POST 2 carry no engine-output claims and were fine. | **Rewritten 2026-07-19**: SCRIPT 1 is now a two-beat (full breakfast → "Hold off" swap-only; juice-free retype → "Be careful" + add-protein adjustment per the registered oatmeal promise); §5.1 demo description and POST 3 verdict-anatomy corrected to match. Live-capture from current deployment before any channel test still required (§5.3). | Product / Growth | current (pending E10 counsel + live capture) |
| C12 | `docs/superpowers/plans/2026-07-05-launch-readiness-paywall-pantry.md` (oatmeal chip / first-check aha, ~lines 70, 1507, 1567, 1573) | First-check step promotes oatmeal/banana/OJ as instant "aha" verdict | **Superseded pending rewrite** (T2). Internal plan doc; align to two-step truth so it stops seeding the false promise into future work. | Product / Eng | superseded |
| C13 | `docs/superpowers/plans/2026-07-09-video-engine-slice-1.md` (hooks, ~lines 59, 247, 860) | "Watch what oatmeal does" / "Watch what it says about oatmeal" hooks imply instant verdict | **Superseded pending rewrite** (T2). Video-engine seed data must reflect clarify-then-answer. Note the doc's own `bad` fixture at :860 pairs against a banned "reversed my prediabetes" claim — keep as negative test, not promotion. | Product / Growth | superseded |
| C14 | Progress / outage surface (`app/progress`) | Fetch failures rendered as "locked" (outage → upsell) | **Now true** (T11): 6-state pure resolver; error never renders as upsell/empty; account + daily-loop fixed. | Eng | current |
| C15 | Photo history fidelity (remote history schema/API) | Photo input silently collapsed to text/voice in remote history | **Now preserved** (T4): photo survives all read paths via shared `normalizeInputMethod`; honest truncation/dedupe/empty states. | Eng | current |
| C16 | Result feedback (`components/*feedback*`, `check_feedback`) | Helpful/not-helpful sent only as anonymous aggregate, not result-linked | **Now result-linked** (T5): `check_feedback` table, ownership-gated API, admin safety queue at `/admin/feedback`, presence-only analytics. | Eng / Safety | current |
| C17 | Stripe entitlement recovery (billing handlers) | Charge could fail to grant access with no recovery; source comment over-generalized Play self-healing to Stripe (K6) | **Now self-healing** (T8): durable event inbox + dedupe, `FOR UPDATE` transactional reducer closing the refund-resurrection window, bounded charge scan, stale-gated heal, "syncing" UI, comment corrected. **Reconcile cron is registered and running** (2026-07-19): `stripe-reconcile` is in the Railway `hourly-crons` service's `CRON_ENDPOINTS` and the latest hourly run succeeded. Live production proof of an actual recovery remains (T8 minor). | Eng / Billing | current (live proof pending) |
| C18 | Meal memory / journey copy (T14–T20 surfaces) | (No prior public claim — new surfaces) | Non-clinical copy verified vs real contract; no glucose inference; structural no-text-in-analytics. All ship **flag-off** pending Phase 2.6 discovery gate (see FF ledger). | Product / Safety | pending flag-on |

---

## 2. Feature-flag ledger

What each flag gates, its **code default** (behavior when the env var is unset), its **prod state**
(what the live production deployment was actually set to per plan §3.2 — a pre-branch snapshot, not a
code default), and the enablement gate that may flip it on. These two columns can disagree: a flag
can be enabled in the deployed environment while the code fails closed when unset.

| Flag (env var) | Layer | What it gates | Code default (unset) | Prod state (§3.2 snapshot) | Enablement gate |
|---|---|---|---|---|---|
| `NEXT_PUBLIC_MEAL_MEMORY` | Client build | Meal-memory UI: recall panel, save controls, memory controls (T14–T16) | **off** (`!== "1"`) | **ENABLED in production** since 2026-07-27 (set with the server pair; retention-layer launch) | **Phase 2.6 discovery gate** — ≥5 of 8 completing concierge participants independently recall the memory ≥twice and continue at disclosed price (plan §2.6). |
| `MEAL_MEMORY_ENABLED` | Server (not `NEXT_PUBLIC`) | `/api/memory/*` routes; 404 when off. Consumed by `lib/server/capabilities.ts` matrix | **off** | **ENABLED in production** since 2026-07-27 — re-verified 2026-07-28 by 401-vs-404 probe (`/api/memory` → 401) | Same Phase 2.6 gate; both readers must be flipped together (matrix imports both). |
| `NEXT_PUBLIC_LEARNING_JOURNEY` | Client build | Journey UI (T17 state machine), weekly learning surface (T18), journey nudges UI (T19), graduation/maintenance (T20) | **off** (`!== "1"`) | **ENABLED in production** since 2026-07-27 (set with the server pair; retention-layer launch) | **Phase 2.6 discovery gate**, then Phase 4 human approvals (cohort preregistration T21). |
| `LEARNING_JOURNEY_ENABLED` | Server (not `NEXT_PUBLIC`) | `/api/journey/*`, `/api/journey/weekly/*` routes; nudge triggers (`lib/server/nudge.ts`); coach route capability. Shared flag for journey + weekly learning + journey nudges (T17 minor: shared by design) | **off** | **ENABLED in production** since 2026-07-27 — re-verified 2026-07-28 by 401-vs-404 probe (`/api/journey` → 401, `/api/journey/weekly` → 401) | Same as above. Weekly-learning artifact is the Premium artifact only once this is on (unblocks C4). |
| `NEXT_PUBLIC_LONGITUDINAL_INSIGHTS` | Client build | Thin longitudinal "weekly pattern" phrasing on landing/dashboard (T10) | **off** (`!== "1"`) | **ENABLED in production** per plan §3.2 line 130 (pre-branch snapshot) | RD review of eval-dependent phrasing + product decision on whether thin insight stays free vs replaced by weekly artifact (P2.4 / T10). **T10 disposition governs going forward:** thin insight is free for all; false weekly-insights Premium promises removed — so the enabled prod state renders as free thin insight, not a Premium gate (see C4/C5). |
| `NEXT_PUBLIC_PHOTO_INPUT` | Client build | Photo → draft-chip input path (`lib/photo-input-flag.ts`) | **off** / fail-closed (`!== "1"`) | **ENABLED in production** per plan §3.2 line 130 (pre-branch snapshot); behavior hardened by T4 | Photo stratum in permanent eval + credentialed review (P1.5); keep confirmation-step explicit. |
| `NEXT_PUBLIC_PLAY_BILLING` | Client build | Google Play billing surfaces (`lib/play-billing-flag.ts`) | **off** (`!== "1"`) | off (not set) | Play listing / TWA readiness (separate track); byte-identical constraint holds. |

Notes:
- **Two-column provenance:** "Code default" is what `lib/*-flag.ts` returns when the env var is unset
  (all readers fail closed on `!== "1"`). "Prod state" is the §3.2 pre-branch production snapshot;
  §3.2 line 130 records photo and longitudinal-insight flags as *enabled in production*. This index
  trusts §3.2 for both the photo row and the insight row — hence they are the two rows where the two
  columns disagree. Neither the memory nor journey flags were enabled in that snapshot.
- **Longitudinal insight reconciliation:** the flag being enabled in prod does *not* mean a Premium
  weekly-insights gate is live. T10 made `capabilitiesFor` the single source, removed the false
  weekly-insights Premium promises, and treats the thin insight as free onboarding value for all
  users. So the enabled prod flag renders as a free thin insight; C4 (bullet removed pending T18
  flag-on) and C5 (landing "weekly pattern" phrasing) are consistent with that, not with a gated
  Premium claim.
- `NEXT_PUBLIC_*` flags are build-time inlined into a reviewed build; server flags gate the API and
  are the real authority (a client flag on with the server flag off yields 404s, not data).
- Enablement of memory/journey flags is a **discovery gate (Phase 2.6)** decision, not an
  engineering toggle. Enablement of insight/weekly phrasing is **RD-review-dependent**.

---

## 3. Evidence closure checklist (Phase 6)

Each row is a human/production gate from plan §Phase 6. **All are PENDING HUMAN.** Owner slots are
unfilled by design — engineering cannot self-assign these. The §13 gate each unblocks is named.

| # | Closure item | Status | Owner slot | §13 gate it unblocks |
|---|---|---|---|---|
| E1 | Credentialed RD/CDCES review — rubric, blinded sample, all dangerous outputs, all release regressions | **PENDING HUMAN** | RD/CDCES: ______ | Dangerous false reassurance (zero in corpus); First meaningful value quality |
| E2 | Function-specific counsel review — meal check | **PENDING HUMAN** | Counsel: ______ | Premium contract / claims accuracy; C7 device-status |
| E3 | Counsel review — meal memory | **PENDING HUMAN** | Counsel: ______ | Analytics privacy; non-clinical boundary |
| E4 | Counsel review — learning journey | **PENDING HUMAN** | Counsel: ______ | Premium contract; claims |
| E5 | Counsel review — insights | **PENDING HUMAN** | Counsel: ______ | Premium contract copy-accuracy (C4/C5) |
| E6 | Counsel review — nudges | **PENDING HUMAN** | Counsel: ______ | Ethical habit strength; analytics privacy |
| E7 | Counsel review — sharing | **PENDING HUMAN** | Counsel: ______ | (Phase 5) private-share privacy |
| E8 | Counsel review — Pantry Review | **PENDING HUMAN** | Counsel: ______ | Scope-of-practice; Pantry↔memory silo decision (§5.4) |
| E9 | Counsel review — analytics claims | **PENDING HUMAN** | Counsel: ______ | Analytics privacy |
| E10 | Counsel review — distribution claims | **PENDING HUMAN** | Counsel: ______ | Promoted examples reproduce; channel eligibility (C11–C13) |
| E11 | Privacy/security review + DPIA (data-protection impact assessment) | **PENDING HUMAN** | Privacy: ______ | Analytics privacy; History export/delete; support/refund data |
| E12 | Accessibility audit + target-user usability sessions | **PENDING HUMAN** | A11y: ______ | Accessibility (no open critical/serious on core + billing) |
| E13 | Staged rollout — internal | **PENDING HUMAN** | Owner/Ops: ______ | Public availability; request routing reliability |
| E14 | Staged rollout — seeded external | **PENDING HUMAN** | Owner/Ops: ______ | Email acceptance; first meaningful value |
| E15 | Staged rollout — small beta | **PENDING HUMAN** | Owner/Ops: ______ | Cohort value (≥80% rate first card useful) |
| E16 | Staged rollout — paid cohort | **PENDING HUMAN** | Owner/Ops: ______ | Billing entitlement; Day-30 new value |
| E17 | Staged rollout — broader release | **PENDING HUMAN** | Owner: ______ | All §13 gates + no open safety/privacy/billing/availability blocker |
| E18 | Daily release dashboard + weekly evidence review | **PENDING HUMAN** | Growth/Data: ______ | Cohort value; Day-30 new value (survivor-bias denominator) |
| E19 | Stop-the-line authority — safety, billing, privacy, availability regressions | **PENDING HUMAN** | Owner + each function: ______ | Backstops every §13 gate ("any miss blocks broad distribution") |

---

## 4. Deferred-Phase-0 register

Deferred by explicit user instruction. Each row lists its §P0 pass criteria; none are executed.

| # | Phase 0 item | Deferred | §P0 pass criteria |
|---|---|---|---|
| P0.1 | DNS/TLS + domain (now `revora.plus`, `www`) | **DONE (2026-07-21)** | Apex live with valid TLS; `www.revora.plus` 308 canonical redirect to apex added via Vercel API and verified. (The register originally named `revora.bio`; the shipped domain is `revora.plus`.) |
| P0.2 | Authentication email (Resend domain, From address) | DEFERRED (user) | ≥99% test sends accepted; seeded Gmail + Outlook receive links; every failure state (resend/expired/reused/wrong-device/changed-email) recoverable. |
| P0.3 | Minimized first-party analytics deployment (Umami) | DEFERRED (user) | Production events arrive with zero prohibited fields (no meal text, photo, A1C, email, notes, rationale); privacy review approves data map; env validation fails deploy when measurement expected but unconfigured. (Current: production points at Umami **cloud** and recording began **2026-07-22** when PR #27 unblocked the CSP `connect-src` for `gateway.umami.is`. **Re-baseline rule:** every `track()` call before 2026-07-22 was CSP-refused, so there is NO client analytics history before that date — figures are *missing, not zero*. Do not compare funnel numbers across 2026-07-22; treat it as day one. `docs/adr/analytics-umami.md` still describes an unused self-hosted install — TODOS.) |
| P0.4 | Support + refund operations | **SHIPPED (C7 branch, privacy-hardened 2026-07-23) — mailbox monitoring on owner** | Built: in-account authenticated "Help & refunds" form with case id (`support_cases` ledger, encrypted row first, PII-minimized queue notice, authenticated no-store admin queue, `{caseId, emailed}` confirmation, 5/24h fail-closed rate limit, full user-authored cases in the user's `/api/account/export`); SLA published in-product ("We reply by email within 2 business days"); operator procedure in `docs/runbooks/refunds.md`; seeded traversal = env-gated `tests/smoke/account-support.spec.ts`. Still human: a monitored operational inbox and named response ownership. |
| P0.5 | Source-of-truth quarantine | DEFERRED (user) | Stale passages in `docs/product-marketing.md`, `docs/ICP.md`, `docs/Revora_90-Day_Distribution_Strategy.md` marked superseded where they promise unreviewed features / glucose-spike / DPP / regulatory status; this release truth index links claims/flags/pricing/support/privacy/safety/authorization; owner + review date on each launch-critical source. No active launch document conflicts with deployed behavior. (This index is the linking artifact; claims rows C9–C13 are pre-staged as **BLOCKED-ON-PHASE-0**.) |

---

## 5. Cross-references

- Plan gates: §13 (SLOs and release gates), §16 (Do not build or claim), §17 (Definition of done).
- Shipped-code evidence: `.superpowers/sdd/progress.md` — Tasks T1–T22 (this branch, base `a5424b1`).
- Concierge discovery protocol (Phase 2.6): T12 doc (commit `0944104`) — PENDING HUMAN EXECUTION.
- Cohort preregistration (P4.5/4.6): T21 doc (commit `4710027`) — PENDING HUMAN EXECUTION.
- Growth / sharing + distribution prerequisites (Phase 5): T22 doc (commit `54c5891`) — PENDING HUMAN EXECUTION.

> Reminder (§16): no glucose-spike prediction, A1C-improvement/prevention claim, DPP equivalence,
> public "not a medical device" assertion without counsel wording, "check any meal" until coverage
> proven, or health data in third-party analytics/pixels/logs/URLs/previews.
