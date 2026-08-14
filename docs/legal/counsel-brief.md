# Revora — Licensed-Counsel Launch-Candidate Brief

**Prepared:** 2026-07-12

**Professional review:** WAIVED BY OWNER on 2026-07-12

**Operational gate:** OWNER-RISK LAUNCH GATE ACCEPTED; COUNSEL GATE NOT CLEARED

**Current source branch:** `feat/counsel-gate-candidate`

**Candidate code SHA:** `5f6abcb31c175fdc6840b74c2c602dc5b3fc7ad8`

**Candidate status:** CLEANLY INTEGRATED AND LOCALLY VERIFIED; NOT DEPLOYED OR
COUNSEL-CLEARED. The owner has directed a budget-constrained launch without
professional counsel and accepted the residual legal uncertainty recorded in
`docs/legal/owner-risk-launch-decision-5f6abcb.md`. This candidate descends from
`main@eb28ef7` and includes the
legal-remediation package, current-main checkout/eval controls, and the
fail-closed photo/insight containment patch. The SHA-bound packet is
`docs/legal/counsel-packet/5f6abcb/`.

This document is retained as the candidate scope and as a future professional
review brief. It does not approve a public or paid launch. The simulated review
in
`docs/legal/counsel-panel-review-2026-07-12.md` is non-legal-advice issue
spotting only; it does not satisfy this gate.

## Future professional review requested (optional and deferred)

If professional review is later obtained, request a written, scoped disposition
for the exact candidate supplied in the counsel packet. Identify required
redlines, prohibited claims, residual
conditions, and the precise conditions—if any—under which the two disabled
functions below may later be enabled.

## Intended launch scope represented by the candidate

### Enabled product functions

- Guest text and reviewed voice-to-text meal descriptions at `/check`.
- A user-entered A1C value in the `5.7%–6.4%` range changes only how cautious
  the educational presentation is. It is not an individualized prediction or
  suitability determination.
- Qualitative `Clear`, `Be careful`, and `Hold off` meal-pattern labels with a
  reason and, when appropriate, one adjustment and practical alternative.
- Accounts, encrypted saved A1C and meal text, history, behavior-only progress,
  optional reminders, health-data consent withdrawal/erasure, and account
  deletion.
- Web/Google Play subscription infrastructure and the separate Pantry Review
  purchase and report flows. All paid entry points remain additionally subject
  to the current-main `LEGAL_TERMS_FINAL=1` gate after integration.
- Pantry Review photo intake is a separate commercial function. Its scope must
  be addressed expressly; it is not the disabled meal photo-assist function.

### Disabled pending function-specific evidence review and written owner approval

This section covers both **Longitudinal insights** and **Imaging input** for
the meal photo-assist function.

⚠️ **The heading is now historical.** Both functions were authorized on
2026-08-14 and both are ON in production; neither is still "disabled pending".
The heading and the *Default candidate state* column are kept because they name
what the 2026-07-12 candidate was, which is what the SHA-bound packet
describes. The **Enforcement** column is the live rule.

| Function | Default candidate state | Enforcement |
| --- | --- | --- |
| Meal photo-assist | **ON in production since 2026-07-21**, authorized 2026-08-14 (`docs/legal/owner-decision-2026-08-14-photo-assist-on.md`). OFF is still the default-candidate state. | `NEXT_PUBLIC_PHOTO_INPUT` must equal exact `1`; otherwise the client control is absent and `POST /api/check/photo-draft` returns `404` before model use (`lib/photo-input-flag.ts`, route handler, smoke/unit tests). Advertised, but as **Premium** — the draft 402s a free session, so no free-tier promise may name it |
| Longitudinal insights | **ON in production since 2026-07-21**, authorized 2026-08-14 (`docs/legal/owner-decision-2026-08-14-longitudinal-insights-on.md`). OFF is still the default-candidate state. | `NEXT_PUBLIC_LONGITUDINAL_INSIGHTS` must equal exact `1`; otherwise derivation returns `null`, server coach payloads contain no insight, guest/signed-in dashboards and daily loop render none (`lib/longitudinal-insights-flag.ts`, `lib/coach/insights.ts`, boundary tests). The runtime kill switch is the server twin `LONGITUDINAL_INSIGHTS_ENABLED` (`app/api/coach/route.ts:62`). Describable in product copy, but **free, not Premium** — the entitlement gate in that route covers progress/BAI only, so no surface may price the insight |

Both are build-time gates. Enabling either requires a new reviewed build and
deployment; an operator cannot silently activate the reviewed binary at
runtime.

## Public and account routes in scope

- Product: `/`, `/onboarding`, `/welcome`, `/check`, `/home`, `/history`,
  `/progress`, `/account`, `/account/delete`, `/signin`, `/subscribe`.
- Legal/support: `/terms`, `/privacy`, `/support` and the support macros in
  `docs/ops/support-playbook.md`.
- Pantry Review: `/pantry`, `/pantry/intake`, `/pantry/thanks`, `/report/[id]`.
- Material APIs: `POST /api/check`, `POST /api/check/photo-draft` (disabled),
  `GET /api/coach` (insight field disabled/null), profile/history/account
  routes, `DELETE /api/account/health-data`, subscription/trial/Play/Pantry
  purchase handlers, Pantry intake/report handlers, reminder endpoints, and
  billing webhooks.

The packet must inventory the actual integrated tree and add any route omitted
here before external delivery.

## Claims boundary

The candidate provides general educational meal-composition information. It
does not claim to diagnose, treat, cure, prevent, reverse, lower, or predict a
disease, glucose response, or laboratory result. The labels are not statements
that a meal is safe or medically appropriate for an individual. A1C changes
presentation caution only.

Counsel should review the net impression of every active result label, reason,
adjustment, alternative, progress statement, paywall statement, support macro,
store statement, and advertisement against the claim-to-evidence matrix. A
disclaimer does not expand the allowed intended use or cure an unsupported
claim.

## Data and processor summary

- Guests: meal/A1C requests transit the hosting layer and OpenAI; server-side
  history is not created. Browser-local onboarding/history may persist until
  site data is cleared.
- Consenting accounts: email, encrypted A1C, encrypted saved meal text, result
  category, timestamps, behavior-only progress inputs, and reminder settings.
- OpenAI: submitted meal and A1C for meal responses with `store: false`; Pantry
  photos and confirmed text for Pantry extraction; meal photo-assist remains
  disabled in the proposed candidate.
- Hosting/database: Vercel application hosting and Railway-hosted Postgres.
- Identity/email: Auth.js email flow and Resend.
- Commerce: Stripe and Google Play.
- Operations: Sentry with scrubbing, Umami coarse analytics, browser/push
  delivery services, and support handling.
- Erasure: `DELETE /api/account/health-data` removes saved health/profile,
  checks, progress/coach records, pushes, and Pantry data while preserving the
  login and subscription records. Full account deletion remains separate.

The external packet must add the real controller/entity, addresses, processor
contract/transfer facts, retention periods, security controls, incident owners,
and any jurisdiction-specific disclosures. Do not infer them from this brief.

## Commercial and assent summary

- Web subscriptions and trials, Google Play verification, and Pantry Review
  purchase paths require affirmative Terms/Privacy acceptance.
- Handlers reject missing, false, or stale acceptance and record the Terms
  version and acceptance time.
- `TERMS_VERSION` is `2026-07-12` in `lib/legal/terms.ts`.
- Current-main paid checkout fails closed unless `LEGAL_TERMS_FINAL=1`. The
  owner subsequently authorized a limited real-charge WTP scope in
  `docs/legal/owner-risk-launch-decision-5f6abcb.md`; the control must survive
  integration and live current-version acceptance evidence must still be
  verified.
- The exact merchant, governing law/venue, support inbox, refund owner, and
  final refund choices require owner input. They may not be invented by
  engineering.

## Known limits and unproved facts

- Local tests are engineering regression evidence, not legal clearance,
  clinical validation, production authentication proof, or deployed-runtime
  proof.
- The current browser smoke environment has no database; signed-out flows may
  emit expected Auth.js `MissingAdapter` logs.
- The candidate has not been merged to `main`, deployed to preview, or tested
  against production authentication, database, payments, email, or provider
  configuration.
- Migrations `0003_hesitant_frog_thor.sql` and
  `0004_aspiring_jocasta.sql` have not yet been proved on preview/production.
- Real entity, address, launch jurisdiction, venue, support/refund/incident
  owners, and final merchant/refund decisions have not been supplied.
- No statement in this document represents FDA status, legal compliance, or
  counsel approval.
- Live-model and dietitian validation remain separate launch gates.

## Questions retained for any future professional review

1. FDA intended-use/device analysis for the actual A1C handling, result labels,
   one-shot meal function, longitudinal function, meal-photo function, and
   separate Pantry Review function. ⚠️ The longitudinal and photo functions
   were described here as *disabled* until 2026-08-14; both are now authorized
   and live, so a review answering this question must analyse them as **enabled
   production functions**, not as dormant code.
2. Permitted/prohibited in-product, support, store, listing, acquisition, and
   advertising language, including whether each active claim has an adequate
   substantiation basis under FTC standards.
3. Terms formation, clickwrap evidence, negative-option/trial disclosures,
   renewal, cancellation, refunds, merchant identity, governing law, venue,
   warranties, and liability allocation.
4. GDPR Art. 9 where applicable, state consumer-health-data, and Health Breach
   Notification Rule analysis; notice, consent/withdrawal, deletion,
   processor/transfer, retention, security, and incident-response requirements
   for the stated markets.
5. Any jurisdictional restriction required for a genuinely US-only launch and
   the controls needed to make that representation accurate.
6. Explicit evidence, labeling, operational, and further-review conditions for
   ever setting either disabled feature flag to `1`.

## Brand-name change — questions retained for any future professional review

**Added:** 2026-08-09. **Status:** NO NAME COMMITTED; NO DISPOSITION OBTAINED.

These are numbered `N1`–`N6` rather than continuing the list above, because
`PRODUCT.md` and `docs/safety/copy-ledger.md` both cite a "counsel Q8" that has
no corresponding item in this document. That dangling reference is unresolved
and is not clarified here; continuing this list into the 7–12 range would create
a second, conflicting `Q8`.

**Context.** `Revora` is in active use at `revora.plus` and in `twa-manifest.json`
(`packageId: app.revora.twa`, **not yet published to Play**). A rename is under
consideration because the mark is in concurrent commercial use by at least four
unrelated parties in software — including a seed-funded company at
`userevora.com` — and because `Revola Pharma` operates one letter away in
metabolic health. The candidate replacement is **`Prediabetes Pal`**, with
**`Predia Pal`** as the fallback. Supporting research is in
`docs/naming-decision-shortlist.md`.

**Nothing in `docs/naming-decision-shortlist.md` is a clearance search.** No
USPTO database search has been run; the public search API was not accessible to
the author. Findings there are limited to domain-registration status, commercial
web presence, and app-store listings.

**Operational hold — split by reversibility.** Professional review is waived
under the Gate record below, so an indefinite hold pending disposition would
block the rename permanently. The two decisions are therefore separated:

- **Reversible — may proceed on owner risk.** The domain and product-name switch
  itself. A rename is undone by re-renaming; the cost is proportional to elapsed
  brand exposure, which is currently near zero (Week 1–2 of
  `docs/Revora_60-Day_Execution_Roadmap.md` is FB-group DMs with, per
  `docs/growth/first-two-weeks-checklist.md`, "no logo, no branding" and no
  links). Proceeding requires a dated owner-risk acceptance recorded alongside
  `docs/legal/owner-risk-launch-decision-5f6abcb.md`, on the same pattern.
- **Irreversible — hard gate.** Publishing the Play listing. `packageId` is
  immutable once published; renaming afterwards forfeits the listing and its
  install history. **Do not publish before a disposition on `N1` and `N2`, or a
  separate dated owner-risk acceptance naming this specific risk.**

Delay is not neutral in the reversible case: switching cost rises with every
week of brand exposure, so "wait for counsel" is itself a decision with a price.

**N1. [GATING] Concurrent use: `PREDIABETES PAL` against `DiabetesPal`.**
`DiabetesPal` (App Store id `736631625`, developer Pascal Freiburghaus) is live
and actively maintained — v10.4, updated July, iOS 17.6+, **Medical** category.
The proposed mark wholly contains it. Same distribution surface, same store
category, adjacent condition. Both marks appear descriptive and therefore weak.
Advise whether `Prediabetes Pal` is shippable, and if not, whether `Predia Pal`
— which does not contain their mark — cures the problem. **Nothing else in this
section matters if this fails.**

**N2. [GATING] Does the disease name in the app title alter our intended-use
posture?** The product is already prediabetes-exclusive by design, so the FDA
general-wellness enforcement-discretion policy is arguably already unavailable
on intended use — see item 1 above, which this does not supersede. The question
is narrow: does moving the condition name into the **title and store listing**,
where it becomes labeling, change the analysis or the disclosure obligations?
Comparable apps do this (`PCOS Pal`, `MySugr`). The author's non-legal
assessment is that posture is unchanged; confirm rather than assume.

**N3. Registrability.** `PREDIABETES PAL` and `PREDIA PAL` in Classes 9 and 44.
A §2(e)(1) descriptiveness refusal on the word mark is expected. Advise whether
a stylized or logo mark plus common-law use is an adequate position at
pre-revenue stage, or whether registrability should drive the name choice at
all.

**N4. Does `Rev-ora` read as `reverse`?** If the current name is itself heard as
the disease-reversal claim, that is an independent reason to move, resolvable on
claims grounds without any trademark search. The reversal family is banned by
`docs/safety/claims-boundary.md §Banned Claim Families`; the specific rejected
line is `onboarding-reversal-line` in `docs/safety/copy-ledger.md`. This is the
cheapest question in this section to answer.

**N5. Knockout on the incumbent.** `REVORA`, plus `REVOLA` / `REVARA` /
`REVIVA`, in Classes 9, 42, 44, and 5. Needed to determine whether the rename is
merely advisable or compelled.

**N6. Does a rename require re-approval of ledgered copy?**
`docs/safety/copy-ledger.md` holds Approved rows whose text contains the product
name, and `tests/unit/revora/claims-boundary-copy.test.ts` enforces the boundary
across `app/**`, `components/**`, `PRODUCT.md`, and the Play listing. Advise
whether substituting the name in Approved copy preserves approval or requires
re-review row by row.

## Required attachments

- `docs/safety/claims-boundary.md`, `docs/safety/copy-ledger.md`, and the
  candidate claim-to-evidence matrix.
- Candidate feature/route/claim inventory and data/processor map.
- Screenshots/captures of every substantive public, consent, legal, paid,
  cancellation, refund, withdrawal, and deletion surface.
- Commercial packet showing exact price/trial/renewal/refund/cancellation and
  acceptance evidence.
- Exact candidate SHA, diff, migrations, launch-flag table, test outputs, and a
  list of items not tested against production.
- `docs/legal/counsel-panel-review-2026-07-12.md`, clearly labeled as
  non-legal-advice background only.

For the brand-name section (`N1`–`N6`) only:

- `docs/naming-decision-shortlist.md`, clearly labeled as non-legal research
  and **not** a clearance search.
- Current-name evidence: `twa-manifest.json` (`packageId`, `host`), the
  `revora.plus` production origin, and the concurrent-use list in the research
  doc above.
- The `DiabetesPal` App Store listing (id `736631625`) as captured, for `N1`.
- `docs/safety/copy-ledger.md` rows whose Approved text contains the product
  name, for `N6`.

## Gate record

The owner has waived professional review for this launch because of budget and
speed constraints. The operational prerequisite formerly called the counsel
gate is replaced by the dated owner-risk decision for this exact candidate.
This is not a legal opinion or a finding of compliance, and no artifact may
state `COUNSEL GATE: CLEARED`. Meal photo-assist and longitudinal insights stay
disabled unless a later function-specific evidence review and explicit written
owner decision authorize a new reviewed build. **Both conditions were met on
2026-08-14** — `docs/legal/owner-decision-2026-08-14-photo-assist-on.md` and
`docs/legal/owner-decision-2026-08-14-longitudinal-insights-on.md` authorize
the two functions as ratifications of a state production had already been in
since 2026-07-21, the written decision following the build rather than
preceding it. The waived counsel review is **unchanged** by either. Paid entry
points remain
separately fail-closed until the real operator and commercial facts are supplied
and the live assent path is proved.
