# Requirements: Prediabetes Pal

**Defined:** 2026-05-04
**Core Value:** Prediabetes Pal must give a clear, evidence-grounded, permission-first answer to "Can I eat this?" in under 5 seconds without increasing food anxiety.

## v1 Requirements

Requirements for the Permission MVP. Each maps to roadmap phases.

### Claims And Evidence

- [x] **CLAIM-01**: Product copy, prompt copy, result copy, and launch copy use an approved claims boundary that defines allowed informational guidance and banned medical claims.
- [x] **CLAIM-02**: The product never claims to diagnose, treat, prevent, cure, or reverse diabetes or prediabetes.
- [x] **CLAIM-03**: The product never predicts a user's future A1C or blood glucose curve.
- [x] **CLAIM-04**: Sequencing, swap, and blood-sugar-impact guidance is grounded in documented evidence sources or kept qualitative when evidence is insufficient.
- [x] **CLAIM-05**: Every result includes an informational-only disclaimer that tells the user to consult a doctor or registered dietitian for personalized medical guidance.

### Inputs

- [x] **INPUT-01**: User can enter a food name or meal description without creating an account.
- [x] **INPUT-02**: User can enter an A1C value as a numeric input that supports one decimal place.
- [x] **INPUT-03**: The app validates required food and A1C inputs before calling the model.
- [x] **INPUT-04**: The app handles A1C values below 5.7 by explaining that Prediabetes Pal is designed for the prediabetes range.
- [x] **INPUT-05**: The app handles A1C values of 6.5 or above by explaining that the value is in the Type 2 diabetes range and directing the user to clinician guidance.
- [x] **INPUT-06**: The app handles non-food input by refusing to classify it and showing concrete food examples.
- [x] **INPUT-07**: The app handles ambiguous food descriptions by asking at most one clarifying question instead of inventing meal details.
- [x] **INPUT-08**: The app handles carbs-only meals by recommending adding protein or vegetables instead of giving an impossible sequencing instruction.

### Guidance Output

- [x] **GUIDE-01**: User receives a result classified as SAFE, MODERATE, or HIGH when the food and A1C inputs are in scope.
- [x] **GUIDE-02**: The risk rubric calibrates guidance across A1C bands 5.7-5.9, 6.0-6.2, and 6.3-6.4.
- [x] **GUIDE-03**: Each in-scope result includes a one-sentence plain-English reason for the classification.
- [x] **GUIDE-04**: SAFE results lead with permission-first reassurance and do not include unnecessary swaps.
- [x] **GUIDE-05**: MODERATE and HIGH results include exactly one practical sequencing, eating-speed, or add-protein/add-vegetable instruction.
- [x] **GUIDE-06**: MODERATE and HIGH results include exactly one practical lower-glycemic swap.
- [x] **GUIDE-07**: Results use qualitative glycemic-impact language and never invent exact GI, GL, or glucose-spike numbers.
- [x] **GUIDE-08**: The app returns a useful result, clarification, or safe error state within a 5-second acceptable ceiling under normal network conditions.

### Guardrails And Evaluation

- [x] **GUARD-01**: All model requests run server-side through a single controlled inference path.
- [x] **GUARD-02**: The server validates request input and model output against explicit schemas before rendering a result.
- [x] **GUARD-03**: The server fails closed with safe retry copy when model output is malformed, incomplete, or outside the allowed schema.
- [x] **GUARD-04**: The prompt and policy layer classify uncertain or borderline cases conservatively rather than returning unsafe reassurance.
- [x] **GUARD-05**: A launch-blocking evaluation set covers clearly safe foods, borderline foods, high-risk foods, non-food input, ambiguous input, carbs-only meals, and out-of-range A1C values.
- [x] **GUARD-06**: The evaluation set has zero harmful SAFE classifications before public launch.
- [ ] **GUARD-07**: Founder manually reviews the first 50 production results and spot-checks at least 5 results per day for the first two weeks after launch.

### Mobile Public Experience

- [x] **UX-01**: User can complete the entire check from a single mobile-first page with no modal, account wall, or navigation flow.
- [x] **UX-02**: The food input and A1C input work with mobile keyboards without auto-focusing the page into an obscured state.
- [x] **UX-03**: The primary CTA is a large thumb-reachable button labeled "Should I eat this?"
- [x] **UX-04**: The submit button shows a loading state during the model request.
- [x] **UX-05**: If a model request exceeds 5 seconds, the UI tells the user the check is still running.
- [x] **UX-06**: If a request fails, times out, or is rate-limited, the UI shows friendly retry copy and never shows a raw error.
- [x] **UX-07**: Result text is high-contrast and readable on mobile in bright environments.

### Privacy And Operations

- [ ] **PRIV-01**: The MVP does not store raw food descriptions, raw A1C values, or account-linked health data by default.
- [ ] **PRIV-02**: OpenAI API calls are configured to avoid provider-side response storage where supported.
- [ ] **PRIV-03**: Analytics and telemetry exclude raw food descriptions and raw A1C values.
- [ ] **PRIV-04**: Any launch telemetry is privacy-minimal, such as pageviews, coarse result class counts, or redacted operational events.
- [ ] **OPS-01**: The app can be deployed publicly on Vercel from the git repository.
- [ ] **OPS-02**: The launch plan defines a cost/abuse threshold that triggers rate limiting or temporary shutdown.
- [ ] **OPS-03**: The launch plan includes a rollback or kill-switch procedure for harmful guidance incidents.

### Launch Validation

- [ ] **VALID-01**: Founder can post a non-promotional, evidence-aware Prediabetes Pal link in r/prediabetes or an equivalent community channel.
- [ ] **VALID-02**: Founder can track whether the MVP receives at least 50 queries in the first week.
- [ ] **VALID-03**: Founder can track whether at least 5 people share the MVP with another prediabetic.
- [ ] **VALID-04**: Founder can track whether at least 3 people ask if there is a paid version.
- [ ] **VALID-05**: Founder can run 5 direct WTP conversations asking whether engaged users would pay $5 for a month of the product.
- [ ] **VALID-06**: The MVP has a documented gate for whether to build the scanner next: 3 of 5 direct WTP yeses or 10+ organic shares within two weeks.

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Scanner And Capture

- **SCAN-01**: User can analyze a meal from a photo.
- **SCAN-02**: User can scan a barcode or nutrition label.
- **SCAN-03**: User can import or parse restaurant meals with richer structured context.

### Accounts And Personalization

- **ACCT-01**: User can create an account and save preferences.
- **ACCT-02**: User can view prior checks and favorite foods.
- **ACCT-03**: User can receive recurring personalization based on history.

### Monetization

- **PAY-01**: User can start a paid subscription.
- **PAY-02**: User can manage billing and cancellation.
- **PAY-03**: Product can support the target $13/month pricing model after WTP validation.

### Full Product Health Features

- **BAI-01**: User can view a Behavioral Adherence Index without predicted future A1C values.
- **CGM-01**: User can connect CGM or glucometer data after the full product launch.
- **CLIN-01**: User can export clinician-friendly reports after PMF.

## Out of Scope

Explicitly excluded from the Permission MVP. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Photo scanner | Tests scanner convenience instead of the permission-first guidance hypothesis. |
| Native mobile app | Adds app-store and device-distribution friction before WTP validation. |
| Authentication | Adds first-use friction and health-data storage concerns before the product proves demand. |
| Saved meal history | Creates privacy/compliance burden and turns the MVP into a tracker. |
| Payments | The MVP measures willingness to pay before adding Stripe or subscription infrastructure. |
| Type 2 diabetes support | Dilutes the prediabetes wedge and changes safety requirements. |
| Open-ended nutrition chat | Increases medical-claim drift and inconsistent advice risk. |
| Exact GI/GL scores | Creates false precision because the LLM does not have a validated GL database. |
| Future A1C prediction | Unsupported clinical claim that the design doc explicitly removed. |
| CGM integration | Future product scope gated behind launch, revenue, and PMF. |
| Clinician dashboard | Healthcare channel is a long-term moat, not a pre-PMF MVP requirement. |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| CLAIM-01 | Phase 1 | Complete |
| CLAIM-02 | Phase 1 | Complete |
| CLAIM-03 | Phase 1 | Complete |
| CLAIM-04 | Phase 1 | Complete |
| CLAIM-05 | Phase 2 | Complete |
| INPUT-01 | Phase 3 | Complete |
| INPUT-02 | Phase 3 | Complete |
| INPUT-03 | Phase 3 | Complete |
| INPUT-04 | Phase 1 | Complete |
| INPUT-05 | Phase 1 | Complete |
| INPUT-06 | Phase 2 | Complete |
| INPUT-07 | Phase 2 | Complete |
| INPUT-08 | Phase 2 | Complete |
| GUIDE-01 | Phase 2 | Complete |
| GUIDE-02 | Phase 1 | Complete |
| GUIDE-03 | Phase 2 | Complete |
| GUIDE-04 | Phase 2 | Complete |
| GUIDE-05 | Phase 2 | Complete |
| GUIDE-06 | Phase 2 | Complete |
| GUIDE-07 | Phase 1 | Complete |
| GUIDE-08 | Phase 3 | Complete |
| GUARD-01 | Phase 2 | Complete |
| GUARD-02 | Phase 2 | Complete |
| GUARD-03 | Phase 2 | Complete |
| GUARD-04 | Phase 1 | Complete |
| GUARD-05 | Phase 2 | Complete |
| GUARD-06 | Phase 2 | Complete |
| GUARD-07 | Phase 5 | Pending |
| UX-01 | Phase 3 | Complete |
| UX-02 | Phase 3 | Complete |
| UX-03 | Phase 3 | Complete |
| UX-04 | Phase 3 | Complete |
| UX-05 | Phase 3 | Complete |
| UX-06 | Phase 3 | Complete |
| UX-07 | Phase 3 | Complete |
| PRIV-01 | Phase 4 | Pending |
| PRIV-02 | Phase 4 | Pending |
| PRIV-03 | Phase 4 | Pending |
| PRIV-04 | Phase 4 | Pending |
| OPS-01 | Phase 4 | Pending |
| OPS-02 | Phase 4 | Pending |
| OPS-03 | Phase 4 | Pending |
| VALID-01 | Phase 5 | Pending |
| VALID-02 | Phase 5 | Pending |
| VALID-03 | Phase 5 | Pending |
| VALID-04 | Phase 5 | Pending |
| VALID-05 | Phase 5 | Pending |
| VALID-06 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 48 total
- Mapped to phases: 48
- Unmapped: 0

---
*Requirements defined: 2026-05-04*
*Last updated: 2026-05-29 after Phase 03-03 completion*
