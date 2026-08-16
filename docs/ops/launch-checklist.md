# Revora — Launch Checklist (P10)

Ordered go-live list. This is the human-executed checklist that walks Gate 1
and Gate 2 (`docs/production-implementation-plan-2026-07-01.md` §11) to
"live on Google Play." It does not replace `docs/ops/launch-controls.md` §11
(the detailed Go-Live Sequence for the **web** production deploy) — it wraps
that sequence plus everything specific to the **Play/TWA** launch on top of
it. Check items off in order; do not skip ahead.

> **Reconciled against production 2026-08-15, re-reconciled 2026-08-16**
> (live `/api/health` + full `vercel env ls` cross-check + live probes +
> a real N=50 consistency run): 27 boxes open, 8 ticked. Unticked does
> **not** mean undone — several open boxes are annotated **Partial** or
> **Blocked** with exact evidence. Before executing any box, verify each
> of its clauses against reality; a probe that satisfies one clause is
> not a tick, and presence in `vercel env ls` is not validity (two
> preview values sat as placeholders for 24 days).
> ✅ **2026-08-16 blocker CLEARED same day**: the 38% flip rate was
> prompt-rule ambiguity (the starch-count anchor's soft "leans HIGH"
> branch), not sampling noise. Prompt `2026-08-16.1` makes every branch
> decisive; re-measure at N=50 passed at **0.0% flip** (45/45 MODERATE,
> 127/127 cumulative). Full record: `docs/ops/launch-controls.md` §12.

---

## 0. Gate 1 confirmation (Heavy-Build DoD) — must already be true

Before starting anything below, confirm Gate 1
(`docs/production-implementation-plan-2026-07-01.md` §11) is fully closed:

- [ ] Every Gate 1 checkbox is checked (accounts/DB, billing E2E, all suites
      green, engine-unchanged regression proof, Sentry + analytics live,
      production deploy done on the real domain).
- [ ] `docs/ops/launch-controls.md` §11 (Go-Live Sequence) has been run once
      already for the **web PWA** production deploy, with both rollback
      drills (§11.5) passed and timed.

If any of the above is unchecked, stop — Phase 8+ (TWA) has nothing to wrap
until the live PWA is stable (`docs/ops/play-twa-runbook.md`'s blocking note).

---

## 1. Environment + provisioning (once, before packaging)

- [ ] **Postgres** provisioned; `DATABASE_URL` set in Vercel
      (preview + production); `npx drizzle-kit migrate` run against it
      (`docs/ops/env-reference.md`). ⚠️ This line said "Railway" — the
      production DB is **Neon** (project `dry-shadow-56131409`, Vercel
      integration resource `revora-db`) since the 2026-08-10 outage
      migration; see `docs/handoff/2026-08-11-…-session-handoff.md` §4.
      **Partial 2026-08-16**: production proven (`db: "ok"`).
      ⛔ **Preview `DATABASE_URL` is a placeholder** — pulled and
      shape-checked 2026-08-16: 11 chars, no scheme, not a URL. Presence
      in `vercel env ls` is NOT validity. A real preview DB needs a Neon
      branch created in the console (the project resets direct
      connections from non-allowlisted IPs), then this var replaced and
      migrations run. Preview `HEALTH_DATA_KEY` was also a placeholder
      (not base64) — **replaced with a real 32-byte key 2026-08-16**.
- [ ] **Umami Cloud** configured with `NEXT_PUBLIC_UMAMI_SRC` +
      `NEXT_PUBLIC_UMAMI_WEBSITE_ID` in Vercel (preview + production); one
      allowlisted browser event is visible exactly once in the intended
      provider website. Self-hosting is not a launch requirement.
      **Partial 2026-08-16 — config clause fully closed**: both vars
      exist in **both** Preview and Production scopes (`vercel env ls`),
      and production renders the script tag plus
      `data-website-id: bc2160bc-c3d9-4866-9a93-eb768c1caace` (visible in
      the RSC payload — a plain-attribute grep misses it behind JSON
      escaping). Still open: the dashboard receipt of one allowlisted
      event, visible exactly once — no Umami API key exists anywhere in
      this repo or its env stores, so the receipt is console-only. ⛔ Do
      not tick on page-source evidence — a loaded script and an arriving
      event are different things.
- [ ] All other ⚙-marked and plain secrets from `docs/ops/env-reference.md`
      confirmed present in Vercel for both preview and production scopes
      (cross-check against `docs/handoff/human-actions-required.md` §2 —
      do not re-derive the list here, it is the source of truth).
      **Partial 2026-08-16 — full `vercel env ls` cross-check done.**
      Production carries the complete launch-required set (model, DB,
      Upstash, Stripe ×6 prices + keys + webhook, Resend + webhook,
      auth, VAPID ×3, Sentry client+server DSN, Umami ×2, CRON_SECRET,
      HEALTH_DATA_KEY, twins). Named preview gaps: `EDGE_CONFIG` (kill
      switch absent on preview), server `SENTRY_DSN`,
      `BLOB_READ_WRITE_TOKEN`, `SUPPORT_INBOX_EMAIL`,
      `NEXT_PUBLIC_APP_URL`; the four feature twins are unset on preview
      **deliberately** (env-reference: "keep unset in preview").
      `LEGAL_ENTITY_NAME` is set in **neither** scope — see §6 line on
      entity/support values. ⚠️ Presence ≠ validity: the preview
      DATABASE_URL/HEALTH_DATA_KEY placeholders above were "present" for
      24 days.
- [x] `REVIEWER_TEST_SECRET` + `NEXT_PUBLIC_REVIEWER_MODE=1` set on
      **preview only**, confirmed absent from production
      (`docs/ops/env-reference.md`). **Done 2026-08-16**: neither var
      existed in ANY scope before this date; both were generated
      (`openssl rand -base64 32`) and added to the Preview scope only —
      read the secret's value from Vercel → Settings → Environment
      Variables when filling the Play "App access" form. Absent from
      production confirmed two ways: `vercel env ls` shows no Production
      row, and `POST /api/auth/reviewer-signin` on
      `prediabetespal.com` returns **404** (live curl, 2026-08-16).

## 2. Seed + verify the reviewer account

- [ ] Run `DATABASE_URL=<preview-url> HEALTH_DATA_KEY=<preview-key> node
      scripts/seed-reviewer-account.mjs` against the preview database.
      Idempotent — safe to re-run. **Blocked 2026-08-16 on the preview
      database existing** (§1 first box): the preview `DATABASE_URL` is a
      placeholder, and Neon resets direct connections from
      non-allowlisted IPs, so seeding must wait for a console-created
      Neon branch. The preview `HEALTH_DATA_KEY` half is ready (real key
      set 2026-08-16).
- [ ] Confirm `reviewer@pal.test` signs in via `/signin`'s "Reviewer
      access" disclosure on the **preview** deploy and lands as a fully
      onboarded Premium account (`docs/ops/play-listing.md` §10).
      **Blocked on the same preview DB.** Note
      `NEXT_PUBLIC_REVIEWER_MODE` is build-time: the disclosure only
      appears on preview deployments built after 2026-08-16.
- [x] Confirm the same reviewer-signin path 404s on the **production**
      deploy (`docs/ops/device-qa-checklist.md` §13). **Verified
      2026-08-16**: `POST https://prediabetespal.com/api/auth/reviewer-signin`
      with a well-formed body → **404** (the route also hard-404s in
      production regardless of env, by `VERCEL_ENV` check —
      `app/api/auth/reviewer-signin/route.ts`).

## 3. Cron + health verification

- [x] `/api/health` on the production deploy shows `crons.nudge` and
      `crons.baiWeekly` as `ok` (not `stale`/`never`) after each cron has
      had at least one scheduled run. **Verified 2026-08-15**: live
      production payload showed all five crons `ok` (`nudge`, `baiWeekly`,
      `trialPrecharge`, `pantrySweep`, `stripeReconcile`), with
      `status: "healthy"`, `issues: []`.
- [ ] Sentry canary: trigger one real error on a deployed preview and
      confirm it lands in Sentry (`docs/handoff/human-actions-required.md`
      P7 entry). **Partial 2026-08-16**: `NEXT_PUBLIC_SENTRY_DSN` is set
      in both scopes and server `SENTRY_DSN` in production (`vercel env
      ls`), so the transport is wired — but no Sentry auth token exists
      anywhere agent-reachable, so the landing receipt is console-only.
- [x] `scripts/consistency-check.mjs` run at **N=50** against a real preview
      deploy with live `OPENAI_API_KEY` traffic; flip rate recorded in
      `docs/ops/launch-controls.md` (target **≥95% modal class**, per the
      P7 human-actions entry) — record the actual number, not just "done."
      **Run + recorded 2026-08-16 — ⛔ RESULT: FAIL.** Modal class
      **62%**, flip rate **38%** (MODERATE 31/50, HIGH 19/50), and a
      corroborating partial run had the OPPOSITE modal class. Full
      numbers, caveats (measured on local dev serving the production
      commit — previews are SSO-protected), and the blocker reading:
      `docs/ops/launch-controls.md` §12. The box's ask (run + record) is
      done; the **result blocks §8 rollout** until the P7 determinism
      remediation (`lib/pal/openai-client.ts`) lands and a re-run passes.
      **RESOLVED 2026-08-16 (same day):** diagnosis controls proved
      prompt-rule ambiguity, not sampling — the `openai-client.ts` reasoning
      lever was not needed. Prompt `2026-08-16.1` (decisive starch-count
      branches + sub-6.3 multi-starch worked example) re-measured at N=50:
      **0.0% flip, 45/45 MODERATE** (127/127 cumulative across four runs);
      all gates re-run green including `eval:pal:live`. §8 rollout is no
      longer blocked by this item. Full rows + harness retry-accounting
      note: `launch-controls.md` §12.

## 4. Build + package the TWA (Phase 8)

- [ ] Play App Signing keystore generated and safeguarded
      (`docs/handoff/human-actions-required.md` §7).
- [ ] `twa-manifest.json` human-fill fields completed (`host`,
      `webManifestUrl`/`iconUrl`/`maskableIconUrl`/`fullScopeUrl` pointed at
      the real domain, `signingKey.path`/`alias`) —
      `docs/ops/play-twa-runbook.md` §9.3. **Partial 2026-08-16 — only
      the keystore fields remain.** All domain fields are already filled
      with `prediabetespal.com` values and all three referenced URLs
      return 200 with correct content types (verified live). Outstanding:
      `signingKey.path`/`alias`, which depend on the §4 keystore
      (deliberately never committed). ⚠️ Note for `bubblewrap init`:
      the TWA `startUrl` is `/check` but the live webmanifest's
      `start_url` is `/home` — regeneration will flip it; keep `/check`
      deliberate or reconcile first.
- [ ] `bubblewrap build` produces a signed `.aab`.
- [ ] Uploaded to the Play Console **internal testing track**.
- [ ] Play App Signing SHA-256 copied from Play Console → Setup → App
      integrity, and `public/.well-known/assetlinks.json` created from the
      template in `docs/ops/play-twa-runbook.md` §9.3 with both
      placeholders filled, then committed + deployed to production. **Do
      not create this file before the real SHA-256 exists** (runbook §2).
- [ ] Google's Statement List Tester validates
      `https://<domain>/.well-known/assetlinks.json`.
- [ ] Install from the internal track → app launches **without a URL bar**
      (confirms asset links are correctly verified).

## 5. Physical-device QA (Phase 8)

- [ ] Full run of `docs/ops/device-qa-checklist.md` on a physical Android
      device against the internal-testing build, including the Play
      Billing purchase → entitlement → progress → cancel → grace → restore
      chain with a license-tester account. Every checkbox in that document
      checked and dated — this is the evidence artifact for the Gate 2
      "Full device QA passed on hardware incl. real Play purchase/restore"
      line.

## 6. Store listing + submission (Phase 9)

- [ ] `docs/ops/play-listing.md` paste-in complete: title, short/full
      description, tags, content-rating answers, health-apps declaration,
      Data Safety form filled from `docs/ops/play-twa-runbook.md` §9.2,
      screenshots captured per the shot-list (signed in as the reviewer
      account, no real user PII), reviewer "App access" credentials
      entered, deletion/privacy/ToS URLs filled with the real domain.
- [x] `docs/legal/owner-risk-launch-decision-5f6abcb.md` records the owner's
      decision to launch without professional counsel. It explicitly records
      that the candidate is not counsel-cleared and that internal GREEN is
      engineering evidence only.
- [x] `NEXT_PUBLIC_PHOTO_INPUT` is **authorized** at `1` in production with its
      server twin `PHOTO_INPUT_ENABLED=1` — owner decision 2026-08-14,
      `docs/legal/owner-decision-2026-08-14-photo-assist-on.md`. Verified live
      the same day: `POST https://prediabetespal.com/api/check/photo-draft`
      answers **400** (route present, body rejected), not the **404** a build
      with the flag unset returns before any model call. The feature is
      advertised as **Premium** only; no free-tier promise names it.
- [x] `NEXT_PUBLIC_LONGITUDINAL_INSIGHTS` is **authorized** at `1` in production
      — owner decision 2026-08-14,
      `docs/legal/owner-decision-2026-08-14-longitudinal-insights-on.md`.
      Verified live the same day: `https://prediabetespal.com/privacy` renders
      `derived pattern summaries` and `personalized pattern summaries`, which
      that page emits only when the flag is `1`. The insight is **free**, not
      Premium; no surface may price it.
- [x] `LONGITUDINAL_INSIGHTS_ENABLED` — **observed at runtime in production**,
      2026-08-15T15:36Z, `GET https://prediabetespal.com/api/health` →
      `flagTwins.longitudinalInsights: "on"`. All four twins read on
      (`photoInput`, `longitudinalInsights`, `mealMemory`, `learningJourney`),
      `status: healthy`, `issues: []`.

      This box sat unticked across several sessions for want of any probe, and
      the probe it asked for would have been **wrong**. The old text said to
      "observe the insight in an authenticated `GET /api/coach` response" —
      but that route returns `insight: null` when the flag is off *and* when
      `deriveInsight` bails under `MIN_CHECKS_FOR_INSIGHT` (5,
      `lib/coach/insights.ts`), which is the state any account with few checks
      is in. The two are indistinguishable. Tried on 2026-08-15 against a real
      signed-in production account with zero checks: `insight: null`,
      `tier: "free"`, every `verdictWeek` day `checked: false` — the no-data
      branch, proving nothing about the flag. ⛔ Do not restore that
      instruction; a null there is not evidence.

      `app/api/health/route.ts` now reports all four server twins as
      boolean-only state, the same shape as `checkoutGate`. That is the probe.
      ⛔ Still true: `vercel env pull` cannot close this — it returns an empty
      string for this flag *and* for `PHOTO_INPUT_ENABLED`, which is provably
      on (Trap 1). ⚠️ Read per request, so this records the value **at that
      timestamp**; re-read `/api/health` after any env change.
- [ ] `LEGAL_ENTITY_NAME` and `SUPPORT_EMAIL` are set to real, monitored values;
      `/terms` and `/privacy` show them on the production domain.
- [ ] Submit for review; respond to any Play reviewer follow-up promptly
      (health-app review typically carries extra scrutiny — plan §12 risk
      #2).

## 7. Support + monitoring stand-up (Phase 10)

- [ ] `support@<domain>` inbox created and reachable; `docs/ops/support-playbook.md`
      macros loaded/pinned wherever the inbox owner will actually work from.
- [ ] Uptime monitor configured against `https://<domain>/api/health`,
      alerting on non-200 / `ok:false`.
- [ ] Sentry alert rule live for exception-volume spikes (filtered
      `stage:model` for provider issues per `docs/ops/launch-controls.md`
      §9.1).
- [ ] Vercel log-drain alerts live for `reasonCode:"daily_cap"` and
      `check_failed` rate spikes (`docs/ops/launch-controls.md` §9.2).
- [ ] On-call/refund ownership assigned — a named person or rotation, not
      "someone will handle it" (`docs/handoff/human-actions-required.md`
      §10).

## 8. Rollout

- [ ] Promote internal → closed testing (if the account type requires it,
      per `docs/ops/play-twa-runbook.md` §9.1) → production rollout on Play.
- [ ] Staged rollout percentage chosen deliberately (do not default to
      100% on day one) — increase once the first cohort shows no
      elevated crash/ANR rate in Play Console vitals.
- [ ] Re-verify the 4 guardrails against the shipped, live surfaces one
      last time: no calories; prediabetes-only; calm/permission-first/
      action-ending; decision-not-log (Gate 2 final line).

## 9. Rollback plan (keep this one click away during rollout)

The web app's kill switch is the fast lever and works independently of the
Play rollout state:

- **Pause public checks immediately:** `launch_mode = "paused"` in Edge
  Config (`docs/ops/launch-controls.md` §10.1) — pauses the underlying
  `/api/check` path for every client, TWA included, in under 60 seconds.
  Use this first for any content/safety incident.
- **Play-specific rollback:** halt/roll back the staged rollout percentage
  in Play Console (Play Console → Production → halt rollout) if the issue
  is specific to the Android build (e.g., a TWA-only crash) rather than the
  underlying web app.
- **Vercel instant rollback:** `vercel rollback` for a bad web deploy
  (`docs/ops/launch-controls.md` §5) — affects the TWA too, since it just
  wraps the live PWA.
- Full incident procedures (pause drill, rollback drill, who to notify,
  harmful-guidance response): `docs/ops/launch-controls.md` §10, extended
  with the three stateful-layer scenarios (DB down, billing-webhook gap,
  push misfire) in the same section.

---

## Done when

Every box above is checked, the Play listing is live and passed review,
support/monitoring are staffed, and both DoD gates
(`docs/production-implementation-plan-2026-07-01.md` §11) read fully
closed.
