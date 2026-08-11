# Roadmap: Prediabetes Pal

## Overview

Prediabetes Pal's Permission MVP stays narrow on purpose: first lock the safety and claims contract, then build the guardrailed inference core, wrap it in a single public mobile flow, add privacy-minimal launch controls, and only then run the founder-led community launch and review loop. Scanner, native mobile apps, authentication, saved history, and payments remain deferred v2 scope unless this text-only wedge proves trust and willingness to pay.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Claims Boundary, Evidence Pack, and Safety Spec** - Lock the allowed guidance contract before broader product behavior is built.
- [x] **Phase 2: Guardrailed Inference Core and Eval Harness** - Build the server-side classification engine and its launch-blocking safety checks. (completed 2026-05-29)
- [x] **Phase 3: Public Mobile Permission Check** - Deliver the one-page mobile-first check flow for real users. (completed 2026-05-29)
- [x] **Phase 4: Privacy-Minimal Launch Controls** - Make the public MVP deployable with explicit privacy, abuse, and rollback boundaries. (completed 2026-06-19)
- [ ] **Phase 5: Community Launch and Founder Review Loop** - Launch carefully, measure demand, and decide whether expansion is earned.

## Phase Details

### Phase 1: Claims Boundary, Evidence Pack, and Safety Spec

**Goal**: Prediabetes Pal has a locked safety contract for prediabetes-only guidance before model and UI behavior expand.
**Depends on**: Nothing (first phase)
**Requirements**: CLAIM-01, CLAIM-02, CLAIM-03, CLAIM-04, INPUT-04, INPUT-05, GUIDE-02, GUIDE-07, GUARD-04
**Success Criteria** (what must be TRUE):

  1. All product, prompt, result, and launch copy stays inside one approved informational-only claims boundary and excludes diagnosis, treatment, reversal, and future-A1C predictions.
  2. The system uses explicit A1C bands for 5.7-5.9, 6.0-6.2, and 6.3-6.4, and it routes below-5.7 and 6.5+ inputs to safe out-of-scope guidance.
  3. Guidance rules stay qualitative and evidence-grounded, and borderline or uncertain cases are intentionally classified more conservatively rather than more reassuringly.

**Plans**: 3 plans

Plans:

- [x] 01-01: Lock claims boundary, evidence sources, and disclaimer language
- [x] 01-02: Define A1C band rubric and out-of-range handling rules
- [x] 01-03: Freeze conservative tone and uncertainty policies

### Phase 2: Guardrailed Inference Core and Eval Harness

**Goal**: Server-side inference returns schema-valid, conservative Prediabetes Pal answers for in-scope and edge-case checks before public launch.
**Depends on**: Phase 1
**Requirements**: CLAIM-05, INPUT-06, INPUT-07, INPUT-08, GUIDE-01, GUIDE-03, GUIDE-04, GUIDE-05, GUIDE-06, GUARD-01, GUARD-02, GUARD-03, GUARD-05, GUARD-06
**Success Criteria** (what must be TRUE):

  1. Every check runs through one server-side inference path, and malformed request or model output is rejected or converted into safe retry behavior before rendering.
  2. In-scope food checks return SAFE, MODERATE, or HIGH with one plain-English reason and the required doctor/RD disclaimer footer.
  3. SAFE results feel permission-first and avoid unnecessary swaps, while MODERATE and HIGH results include exactly one practical adjustment and exactly one lower-glycemic swap.
  4. Non-food inputs, ambiguous foods, and carbs-only meals resolve through controlled refusal, one clarifying question, or safe adjustment guidance instead of invented details.
  5. A launch-blocking evaluation set covers safe, borderline, high-risk, non-food, ambiguous, carbs-only, and out-of-range A1C cases, and it reaches zero harmful SAFE classifications before launch.

**Plans**: 5/5 plans complete

Plans:

- [x] 02-01: Implement the structured-output check service and server-side guardrails
- [x] 02-02: Implement edge-case handling, rubric application, and conservative fallback behavior
- [x] 02-03: Build the safety evaluation suite and gate launch on zero harmful SAFE results
- [x] 02-04: Close deterministic ordinary non-food refusal verification gaps
- [x] 02-05: Close carbs-only add-protein/add-vegetable enforcement gaps

**Verification:** passed in `.planning/phases/02-guardrailed-inference-core-and-eval-harness/02-VERIFICATION.md` on 2026-05-29 after gap-closure plans `02-04` and `02-05`.

### Phase 3: Public Mobile Permission Check

**Goal**: A user standing in front of food can complete the Prediabetes Pal check from one mobile-first page and get a useful answer quickly.
**Depends on**: Phase 2
**Requirements**: INPUT-01, INPUT-02, INPUT-03, GUIDE-08, UX-01, UX-02, UX-03, UX-04, UX-05, UX-06, UX-07
**Success Criteria** (what must be TRUE):

  1. A user can open one public page, enter a food description and one-decimal A1C without an account, and submit from a large thumb-reachable "Should I eat this?" button.
  2. The form validates required food and A1C values before any model call and works with mobile keyboards without auto-focus breaking the screen.
  3. The page shows clear loading, still-running, and friendly retry states instead of raw errors when checks are slow, fail, or are rate-limited.
  4. Under normal network conditions the user receives a useful result, clarification, or safe error state within the 5-second ceiling, and the rendered result stays readable in bright mobile conditions.

**Plans**: 3/3 plans complete

Plans:

- [x] 03-01-PLAN.md — Build the single-screen mobile form and local validation flow
- [x] 03-02-PLAN.md — Connect the public API route to result, clarification, and error states
- [x] 03-03-PLAN.md — Tune mobile readability, latency messaging, and bright-environment UX

**Verification:** passed in `.planning/phases/03-public-mobile-permission-check/03-VERIFICATION.md` on 2026-05-29 after Playwright-backed mobile evidence review and explicit user approval.

### Phase 4: Privacy-Minimal Launch Controls

**Goal**: Prediabetes Pal can be deployed publicly with explicit privacy, abuse, and rollback boundaries that protect user trust and operating cost.
**Depends on**: Phase 3
**Requirements**: PRIV-01, PRIV-02, PRIV-03, PRIV-04, OPS-01, OPS-02, OPS-03
**Success Criteria** (what must be TRUE):

  1. Prediabetes Pal is deployable on Vercel as a public MVP without default storage of raw food descriptions, raw A1C values, or account-linked health data.
  2. OpenAI and telemetry configuration avoid provider-side response storage where supported and exclude raw food text and raw A1C from analytics and operational events.
  3. The launch configuration defines when to rate-limit or temporarily shut down the app for abuse or cost spikes, and the rollback or kill-switch path is documented and executable.

**Plans**: 2 plans

Plans:

- [x] 04-01-PLAN.md — Lock privacy-minimal data flow, telemetry, and deployment configuration
- [x] 04-02-PLAN.md — Add abuse-cost thresholds plus rollback and kill-switch procedures

### Phase 5: Community Launch and Founder Review Loop

**Goal**: Prediabetes Pal can launch into trust-sensitive communities, measure demand, and learn safely before any broader product expansion.
**Depends on**: Phase 4
**Requirements**: GUARD-07, VALID-01, VALID-02, VALID-03, VALID-04, VALID-05, VALID-06
**Success Criteria** (what must be TRUE):

  1. The founder has an evidence-aware, non-promotional launch artifact that can be posted in r/prediabetes or an equivalent community channel.
  2. The founder can track weekly query volume, organic shares, paid-version asks, and direct willingness-to-pay conversation outcomes after launch.
  3. The founder completes the first-50-result manual review and ongoing daily spot checks, with real incidents feeding back into evals and rollback decisions.
  4. The product has an explicit scanner-next decision gate based on WTP or organic-share evidence, keeping scanner, native mobile, auth, saved history, and payments deferred unless the MVP earns expansion.

**Plans**: 2 plans

Plans:

- [ ] 05-01-PLAN.md — Prepare community launch assets and lightweight demand measurement
- [ ] 05-02-PLAN.md — Run the founder review loop and define the post-launch go/no-go gate

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Claims Boundary, Evidence Pack, and Safety Spec | 3/3 | Complete | 01-01, 01-02, 01-03 |
| 2. Guardrailed Inference Core and Eval Harness | 5/5 | Complete | 2026-05-29 |
| 3. Public Mobile Permission Check | 3/3 | Complete | 2026-05-29 |
| 4. Privacy-Minimal Launch Controls | 2/2 | Complete | 2026-06-19 |
| 5. Community Launch and Founder Review Loop | 0/2 | Not started | - |
