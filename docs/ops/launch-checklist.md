# Revora — Launch Checklist (P10)

Ordered go-live list. This is the human-executed checklist that walks Gate 1
and Gate 2 (`docs/production-implementation-plan-2026-07-01.md` §11) to
"live on Google Play." It does not replace `docs/ops/launch-controls.md` §11
(the detailed Go-Live Sequence for the **web** production deploy) — it wraps
that sequence plus everything specific to the **Play/TWA** launch on top of
it. Check items off in order; do not skip ahead.

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

- [ ] **Railway Postgres** provisioned; `DATABASE_URL` set in Vercel
      (preview + production); `npx drizzle-kit migrate` run against it
      (`docs/ops/env-reference.md`).
- [ ] **Umami Cloud** configured with `NEXT_PUBLIC_UMAMI_SRC` +
      `NEXT_PUBLIC_UMAMI_WEBSITE_ID` in Vercel (preview + production); one
      allowlisted browser event is visible exactly once in the intended
      provider website. Self-hosting is not a launch requirement.
- [ ] All other ⚙-marked and plain secrets from `docs/ops/env-reference.md`
      confirmed present in Vercel for both preview and production scopes
      (cross-check against `docs/handoff/human-actions-required.md` §2 —
      do not re-derive the list here, it is the source of truth).
- [ ] `REVIEWER_TEST_SECRET` + `NEXT_PUBLIC_REVIEWER_MODE=1` set on
      **preview only**, confirmed absent from production
      (`docs/ops/env-reference.md`).

## 2. Seed + verify the reviewer account

- [ ] Run `DATABASE_URL=<preview-url> HEALTH_DATA_KEY=<preview-key> node
      scripts/seed-reviewer-account.mjs` against the preview database.
      Idempotent — safe to re-run.
- [ ] Confirm `reviewer@revora.test` signs in via `/signin`'s "Reviewer
      access" disclosure on the **preview** deploy and lands as a fully
      onboarded Premium account (`docs/ops/play-listing.md` §10).
- [ ] Confirm the same reviewer-signin path 404s on the **production**
      deploy (`docs/ops/device-qa-checklist.md` §13).

## 3. Cron + health verification

- [ ] `/api/health` on the production deploy shows `crons.nudge` and
      `crons.baiWeekly` as `ok` (not `stale`/`never`) after each cron has
      had at least one scheduled run.
- [ ] Sentry canary: trigger one real error on a deployed preview and
      confirm it lands in Sentry (`docs/handoff/human-actions-required.md`
      P7 entry).
- [ ] `scripts/consistency-check.mjs` run at **N=50** against a real preview
      deploy with live `OPENAI_API_KEY` traffic; flip rate recorded in
      `docs/ops/launch-controls.md` (target **≥95% modal class**, per the
      P7 human-actions entry) — record the actual number, not just "done."

## 4. Build + package the TWA (Phase 8)

- [ ] Play App Signing keystore generated and safeguarded
      (`docs/handoff/human-actions-required.md` §7).
- [ ] `twa-manifest.json` human-fill fields completed (`host`,
      `webManifestUrl`/`iconUrl`/`maskableIconUrl`/`fullScopeUrl` pointed at
      the real domain, `signingKey.path`/`alias`) —
      `docs/ops/play-twa-runbook.md` §9.3.
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
- [ ] ⛔ `LONGITUDINAL_INSIGHTS_ENABLED` — **the runtime kill switch has never
      been observed in production.** This box stays unticked deliberately.
      `GET /api/coach` returns 401 at `app/api/coach/route.ts:29` before the
      flag branch at line 62, so no unauthenticated probe exists — unlike the
      photo twin's 400-vs-404. All that is known is that `next.config.ts`
      throws on a production build whose client flag is `1` with the twin
      unset, so the twin was set **when the live build ran**; it is read per
      request, so a later env edit could have diverged. ⛔ `vercel env pull`
      cannot close this — it returns an empty string for this flag *and* for
      `PHOTO_INPUT_ENABLED`, which is provably on. To tick this box, observe
      the insight in an authenticated `GET /api/coach` response against
      production.
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
