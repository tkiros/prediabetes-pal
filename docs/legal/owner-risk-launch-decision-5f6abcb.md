# Revora owner-risk launch decision — candidate `5f6abcb`

**Recorded:** 2026-07-12

**Code candidate:** `5f6abcb31c175fdc6840b74c2c602dc5b3fc7ad8`

**Evidence/documentation commit before this decision:**
`72a9190fd124636060d0b55a4c3af9eb3bf67af0`

## Decision

On 2026-07-12, the authenticated workspace owner stated that the business
cannot afford professional counsel, launch speed is important, and Revora
should proceed using the information and evidence already assembled.

**COUNSEL REVIEW: WAIVED BY OWNER**

**COUNSEL GATE: NOT CLEARED**

**OWNER-RISK LAUNCH GATE: ACCEPTED**

This record replaces professional review as an internal operational launch
prerequisite. It is an owner waiver and risk decision, not a legal opinion,
attorney-client advice, regulator determination, or finding of compliance.

## Scope of the decision

The owner-risk decision covers the locally verified candidate's constrained
core product:

- guest text and reviewed voice-to-text meal descriptions;
- qualitative educational meal-pattern labels, reasons, adjustments, and
  alternatives within the active claims boundary;
- A1C context that changes presentation caution only and does not claim an
  individualized prediction or medical suitability determination;
- accounts, consent-bearing saved checks, history, behavior-only progress,
  reminders, health-data erasure, and account deletion, subject to real
  preview/production proof.

It does not authorize these functions:

- Meal photo-assist stays **OFF**. `NEXT_PUBLIC_PHOTO_INPUT` must remain unset.
  **⛔ SUPERSEDED 2026-08-14** by
  `docs/legal/owner-decision-2026-08-14-photo-assist-on.md`. Photo-assist is
  now authorized and ON in production. This line is left standing because it
  is what was decided on 2026-07-12; it is no longer the operating
  instruction.
- Longitudinal insights stay **OFF**.
  `NEXT_PUBLIC_LONGITUDINAL_INSIGHTS` must remain unset.
  **⛔ SUPERSEDED 2026-08-14** by
  `docs/legal/owner-decision-2026-08-14-longitudinal-insights-on.md`. Insights
  are now authorized and ON in production. This line is left standing because
  it is what was decided on 2026-07-12; it is no longer the operating
  instruction.
- No advertising or paid promise may imply that either disabled function is
  available.
  **Spent as of 2026-08-14, not repealed:** both functions named above were
  authorized that day, so this clause has no remaining referent. It still
  correctly states the rule that applied while either was off, and it binds
  again the moment one is turned back off.

Enabling either disabled function requires a function-specific evidence
review, an explicit written owner decision, a new reviewed build, and new
deployment proof.

## Paid WTP launch authorization

On 2026-07-12, the owner expressly superseded the earlier paid fail-closed
direction for a WTP test. The authorized scope is real Stripe charges for:

- Premium web subscriptions and their seven-day card-gated trial; and
- one-time Pantry Review purchases.

The public operator name is **Revora** and the monitored customer contact is
**support@revora.bio**. The owner chose brand-only public identification rather
than supplying a separate entity name or consumer-contact street address. No
nonexistent entity or address may be represented as fact.

`LEGAL_TERMS_FINAL=1` is authorized for the reviewed deployed candidate after
the live Terms and Privacy pages show no drafting placeholders and the current
Terms version/checkbox evidence is present. This opens the three Stripe web
entry points above; it does not authorize a Google Play paid launch.

The owner accepts responsibility for real refund, renewal, cancellation,
support, privacy, incident, merchant, and tax obligations created by accepting
real charges. A live successful purchase, cancellation, refund, and webhook
must be recorded before treating the WTP system as operationally proved.

## Known regulatory and legal uncertainty accepted by the owner

The owner accepts proceeding without an independent opinion addressing:

- FDA intended-use/device uncertainty for patient-facing health software and
  whether every active net impression remains within a low-risk general
  wellness boundary;
- FTC claim-substantiation and deceptive-practice risk;
- FTC Health Breach Notification Rule applicability to the app's health data,
  vendors, unauthorized access, and disclosures;
- state consumer-health-data, privacy, consent, processor/transfer, retention,
  deletion, and incident-notification obligations;
- contract formation, renewal, cancellation, refund, merchant, venue, and
  platform-specific requirements.

Current primary-source background retained for this decision:

- FDA, *Clinical Decision Support Software: Guidance for Industry and Food and
  Drug Administration Staff* (January 2026):
  https://www.fda.gov/regulatory-information/search-fda-guidance-documents/clinical-decision-support-software
- FDA, *General Wellness: Policy for Low Risk Devices* (January 2026):
  https://www.fda.gov/media/90652/download?attachment=
- FTC, *Health Breach Notification Rule*:
  https://www.ftc.gov/legal-library/browse/rules/health-breach-notification-rule
- FTC, *Complying with FTC's Health Breach Notification Rule*:
  https://www.ftc.gov/business-guidance/resources/complying-ftcs-health-breach-notification-rule-0

These sources inform containment; they do not decide Revora's legal status.

## Gates not closed by this decision

- No preview or production deployment/proof exists for this candidate.
- Migrations `0003` and `0004` are not proved in preview or production.
- Real authenticated database, consent withdrawal/erasure, email, reminders,
  Stripe, Play, Pantry, cancellation, and refund flows are not proved live.
- Real entity, address, jurisdiction, support, merchant, and incident-owner
  facts remain incomplete.
- Live-model safety, clinical/dietitian validation, key/provider readiness, and
  other current-main launch controls remain separate.

## Record integrity

This record may be amended only by a later dated owner decision tied to an
exact candidate SHA. It must never be renamed or summarized as licensed-counsel
clearance.
