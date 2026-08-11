> **Status note (2026-07-01, full build 4B):** the Step-4 posture change has
> landed — accounts, server history, billing, push. This document, `/privacy`,
> `docs/privacy/data-flow.md`, and `docs/legal/counsel-brief.md` were updated
> in the same PR (the lockstep rule). §9.2 below is the current mapping.

# Revora — Google Play (TWA) Runbook

> **⛔ BLOCKED — do not execute yet.** Phase 9 is gated on two preconditions:
> 1. **The PWA is live and stable** on the production domain (Phase 8 go-live complete —
>    `docs/ops/launch-controls.md` §11). A TWA is a thin wrapper over the live PWA; there is
>    nothing to wrap until the PWA is deployed.
> 2. **The owner-risk decision is recorded**
>    (`docs/legal/owner-risk-launch-decision-5f6abcb.md`) and all real operator,
>    listing, privacy, Terms, and paid-flow facts are complete. The decision is
>    not counsel clearance.
>
> This runbook is the executable plan ops/eng runs **once both gates clear**. Most steps are
> non-code (store account, policies, asset hosting). The one code artifact —
> `public/.well-known/assetlinks.json` — **cannot be created until ops generates the Play App
> Signing key** (it carries that key's SHA-256). A placeholder fingerprint in a hosted file
> fails validation or forges trust, so the file is **not** committed yet — only templated below.

The platform facts below shift; **verify current Play requirements** before acting.

---

## What makes a TWA "trusted" (read first)

A Trusted Web Activity launches the live PWA full-screen **without a URL bar** only when
**Digital Asset Links** verify the app owns the domain. That is a JSON statement hosted at
`https://<domain>/.well-known/assetlinks.json` binding the **Android package name** to the
**Play App Signing key SHA-256**. The service worker is *not* what enables the TWA — asset
links are. Bubblewrap/PWABuilder *generate* the assetlinks content; **you must host it on the
production domain.**

---

## 9.1 — Play Console account + policy prerequisites  *(owner: ops · non-code gate)*

1. Create a Google Play Console account ($25 one-time).
2. **Verify current Play requirements (they change):**
   - Personal accounts typically require a **closed-testing cohort** (~12+ testers, ~14 days)
     before production access.
   - Organisation accounts require a **D-U-N-S** number.
3. Complete the **health-app declarations** and **content rating** questionnaire. Revora is
   **informational only** — declare no diagnosis/treatment; mirror the claims boundary
   (`docs/safety/claims-boundary.md`).

**Acceptance:** account verified; testing requirement (if any) satisfied; declarations submitted.

---

## 9.2 — Play Data Safety form  *(owner: ops/legal · non-code gate)*

The Data Safety form must be **consistent with `/privacy` and `docs/privacy/data-flow.md`**
(same facts, different artifact). Source of truth → form mapping:

> **Updated 2026-07-01 (plan 4B lockstep):** the app now has optional
> accounts, server-side history, billing, and push. Answers below reflect the
> stateful posture; the previous "transferred, not stored" table is obsolete.

| Data Safety question | Answer (from data-flow.md / `/privacy`) |
|---|---|
| Is data collected? | **Yes — collected AND stored** (for signed-in, consented users): health info (A1C), free-text meal descriptions, email address. Guests: transferred to process the check, not stored. |
| Data types | **Health info** (A1C value; meal text) · **Personal info** (email address, accounts only) · **App activity** = none beyond the above · **Device IDs** = none · Payments handled by Google Play / Stripe (Revora never receives card data). |
| Purpose | App functionality (the check, history, insights, progress, one opt-in daily reminder). No ads, no marketing, no sale/share of personal data. |
| Shared with third parties? | **OpenAI** (meal text + A1C, per-request, `store:false`, to generate the check) · **Resend** (email address, to deliver sign-in links) · **Stripe** (web subscribers' billing, handled by Stripe) · voice audio is processed by the device/browser vendor's speech service — Revora servers never receive audio. |
| Stored/retained by Revora? | Signed-in + consented only: A1C and meal text **encrypted at rest (AES-256-GCM)**; coarse fields (risk class, band, timestamps) plaintext; email for sign-in. Guests: nothing. |
| Provider retention | The model **provider may keep abuse-monitoring logs** on its side (outside Revora's control) — same caveat as `/privacy`. |
| Encrypted in transit? | Yes (HTTPS everywhere). |
| Encrypted at rest? | Yes for the sensitive fields (A1C, meal text) — column-level AES-256-GCM. |
| Can users request deletion? | **Yes — in-app and via the public URL** `https://<domain>/account/delete` (declare this in the Data-deletion section). Deletion removes profile, history, push registrations, and subscription rows; provider subscriptions are cancelled best-effort. |
| Data collection optional? | Yes — the full check flow works as a guest; storage happens only after explicit consent at account setup. |

**Acceptance:** form submitted; every answer traces to a line in `docs/privacy/data-flow.md`.

---

## 9.3 — Generate the TWA + host asset links  *(owner: eng/ops)*

### Generate the `.aab` and assetlinks
Use **Bubblewrap** (or PWABuilder) pointed at the live manifest:

```bash
npm i -g @bubblewrap/cli
bubblewrap init --manifest https://<domain>/manifest.webmanifest
# theme/background already match the manifest: #0f172a / #f3f7fb
bubblewrap build        # produces app-release-bundle.aab + a signing key
```

Upload the `.aab` to Play, and **enable Play App Signing** (Google holds the upload→app
signing key). After upload, copy the **app signing key SHA-256** from
**Play Console → Setup → App integrity → App signing key certificate**.

> **`twa-manifest.json` (repo root, P8).** A checked-in Bubblewrap config
> template — `packageId com.prediabetespal.twa`, colors/icons/start URL mirrored from
> `public/manifest.webmanifest`, `webManifestUrl` pointed at the same
> `<domain>` placeholder used throughout this runbook. Human fills before
> `bubblewrap build`: the `host` field, `webManifestUrl`/`iconUrl`/
> `maskableIconUrl`/`fullScopeUrl` (`<domain>` → the real production domain),
> and `signingKey.path`/`signingKey.alias` (never commit the actual keystore
> or its password — this file is source-controlled). `appVersionCode`/
> `appVersionName` bump on every re-submission. Either re-run
> `bubblewrap init --manifest https://<domain>/manifest.webmanifest` to
> regenerate it fresh, or hand-edit this template in place and run
> `bubblewrap build` directly — the `_comment` key is documentation-only and
> safe to delete if the CLI's validator complains about it.

### Host the asset links
Create `public/.well-known/assetlinks.json` (Next serves `public/` verbatim, so it resolves
at `https://<domain>/.well-known/assetlinks.json`). **Template — fill the two placeholders
with the real values, then commit + deploy:**

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "__PACKAGE_NAME__",
      "sha256_cert_fingerprints": ["__PLAY_APP_SIGNING_SHA256__"]
    }
  }
]
```

- `__PACKAGE_NAME__` — the Android application id chosen in `bubblewrap init` (e.g. `com.prediabetespal.twa`).
- `__PLAY_APP_SIGNING_SHA256__` — the colon-separated SHA-256 from Play App Signing (**not** the
  upload key, **not** the local Bubblewrap key).

**Verification:**
- Google **Statement List Tester** validates `https://<domain>/.well-known/assetlinks.json`.
- Install the TWA from the closed track → it launches **without a URL bar** (if the bar shows,
  the fingerprint/package don't match — re-check the App Signing key, not the upload key).

---

## 9.4 — Store assets + submit  *(owner: ops/design)*

1. Assets: app icon, feature graphic, phone screenshots. Reuse the brand mark
   (`public/icon-512.png`); screenshots from the live PWA.
2. **Listing copy must stay inside the claims boundary** — audit every line against
   `docs/safety/claims-boundary.md`. Banned families (reject any copy that implies them):
   - [ ] No **diagnose / treat / cure / prevent / reverse** ("reverse prediabetes", "lower your A1C").
   - [ ] No **future prediction** ("will keep your blood sugar down").
   - [ ] No **exact clinical values / dosing**.
   - [ ] No **FDA-clearance / medical-device** implication.
   - [ ] Positioning is **informational only**; the disclaimer is visible in-app.
3. Privacy policy URL = **`https://<domain>/privacy`** (the existing `/privacy` page).
4. Submit for review.

**Acceptance:** listing passes review; copy signed off against `docs/safety/claims-boundary.md`.

---

## Out of scope here (human/ops)
Creating the Play account, the testing cohort, the actual `.aab` build + key generation,
hosting the real `assetlinks.json` (needs the live domain + signing key), and the store
assets. Engineering's only artifact is the templated `assetlinks.json` above, committed once
the real fingerprint exists.
