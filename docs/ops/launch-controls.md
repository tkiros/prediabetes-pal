# Revora Launch Controls — Operator Runbook

This document describes the abuse-cost thresholds, kill-switch procedures,
WAF configuration, Edge Config setup, and rollback steps for Revora's
public-check path.

Rollback is **not** recovery until post-rollback health, logs, and one
synthetic public-check verification are complete. Each step below includes
an evidence slot — mark it `SETUP_BLOCKED` if CLI or provider auth is
unavailable.

---

## 1. Threshold Table

| Signal                      | Value                                                                               | Response                                                                                 |
| --------------------------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| WAF rate limit (Vercel WAF) | 10 requests / 10 minutes / IP on `/api/check`                                       | Vercel blocks the request; client sees friendly 429                                      |
| App daily cap               | 2,000 checks / 24h (aggregate across IPs, configurable by `PAL_DAILY_CHECK_CAP`) | Middleware returns friendly 429 before model spend and emits `reasonCode:"daily_cap"`    |
| Operator pause gate         | Any manual cost, abuse, legal, or safety concern                                    | Operator sets `public_checks_enabled = false` or `launch_mode = "paused"` in Edge Config |
| Harmful-guidance incident   | Any SAFE classification for a high-risk food                                        | Operator sets `launch_mode = paused` and reviews model outputs                           |
| Provider-failure spike      | Repeated provider errors (`check_failed` events)                                    | Operator sets `launch_mode = paused` until provider recovers                             |

Upstash backs both the per-IP limiter and the aggregate daily cap. A public
deploy with missing Upstash env fails closed on `/api/check`; `/api/health`
surfaces this as `upstash:"unconfigured"`. Edge Config remains the manual
operator kill switch for incidents and rollback drills.

---

## 2. Edge Config Setup

### 2.1 Required keys

| Key                     | Type                     | Default when absent                                               | Effect                                              |
| ----------------------- | ------------------------ | ----------------------------------------------------------------- | --------------------------------------------------- |
| `launch_mode`           | `"normal"` \| `"paused"` | `"normal"`                                                        | `"paused"` activates the kill switch                |
| `public_checks_enabled` | `boolean`                | `true`                                                            | `false` blocks all public checks before model spend |
| `incident_message`      | `string`                 | `"Revora checks are temporarily paused. Please try again later."` | Copy shown to users during a pause                  |

### 2.2 Edge Config connection string

```
EDGE_CONFIG=ecfg_<your_connection_string>
```

Add `EDGE_CONFIG` to Vercel Project → Settings → Environment Variables for
**Preview** and **Production** scopes only. Do not expose it client-side.

Evidence slot: `SETUP_BLOCKED` until connection string is obtained.

### 2.3 Pause drill (kill switch)

```bash
# Via Vercel Dashboard → Storage → Edge Config → Edit
# Set public_checks_enabled = false (or launch_mode = "paused")
# Optionally set incident_message = "We're paused briefly — please check back soon."

# Verify the kill switch is active:
curl https://your-domain.com/api/health
# Expected: {"ok":false,"environment":"production","launch":"paused","launchMode":"paused"}
```

Evidence slot: `SETUP_BLOCKED` until Edge Config store is created.

### 2.4 Restore drill

```bash
# Via Vercel Dashboard → Storage → Edge Config → Edit
# Set public_checks_enabled = true
# Set launch_mode = "normal"
# Clear or reset incident_message

# Verify restore:
curl https://your-domain.com/api/health
# Expected: {"ok":true,"environment":"production","launch":"ready","launchMode":"normal"}
```

---

## 3. WAF Rule (Rate Limit)

### 3.1 Rule configuration

| Field         | Value                         |
| ------------- | ----------------------------- |
| Rule name     | `revora-check-rate-limit`     |
| Path matcher  | `/api/check`                  |
| Limit         | 10 requests / 10 minutes / IP |
| Action        | Block (return 429)            |
| Publish state | `published`                   |

### 3.2 How to publish

1. Open Vercel Dashboard → Security → WAF.
2. Create a new rate-limit rule with the values above.
3. Publish the rule.
4. Evidence: Record the rule ID and publication timestamp below.

Evidence slot: `SETUP_BLOCKED` until WAF is accessible.

### 3.3 Verification (after publishing)

```bash
# Send 11 rapid requests from the same IP to confirm blocking:
for i in $(seq 1 11); do
  curl -s -o /dev/null -w "%{http_code}\n" \
    -X POST https://your-domain.com/api/check \
    -H 'Content-Type: application/json' \
    -d '{"food":"apple","a1c":"6.1"}'
done
# The 11th request should return 429.
```

Evidence slot: `SETUP_BLOCKED` until WAF rule is published.

---

## 4. Preview Deploy Checklist

Before promoting to Production, collect the following evidence:

- [ ] `/api/health` returns `{"ok":true,"environment":"preview","launch":"ready","launchMode":"normal"}` on the Preview URL.
- [ ] Pause drill: set `public_checks_enabled = false` in Edge Config → verify `/api/check` returns 503 with friendly pause copy, no stack traces.
- [ ] Restore drill: set `public_checks_enabled = true` → verify `/api/check` accepts a check again.
- [ ] WAF rate-limit rule name, path, limit, and publish state recorded.
- [ ] `OPENAI_API_KEY` is set in the Preview environment.
- [ ] `EDGE_CONFIG` is set in the Preview environment.

---

## 5. Rollback Procedure

> Rollback is **not** recovery until steps 5.3–5.5 all pass.

### 5.1 Trigger rollback

```bash
vercel rollback
```

Record the deployment ID returned. Evidence slot: `SETUP_BLOCKED` if Vercel CLI is not authenticated.

### 5.2 Monitor rollback status

```bash
vercel rollback status
```

Wait until status is `COMPLETE` before proceeding.

### 5.3 Check error logs after rollback

```bash
vercel logs --environment production --status-code 5xx --since 5m
```

Confirm the 5xx rate has returned to baseline. Evidence slot: `SETUP_BLOCKED` if Vercel CLI is not authenticated.

### 5.4 Health probe verification

```bash
curl https://your-domain.com/api/health
```

Expected response after successful rollback:

```json
{
  "ok": true,
  "environment": "production",
  "launch": "ready",
  "launchMode": "normal"
}
```

If `/api/health` reports `{"ok":false,...}` after rollback, the environment
variables or Edge Config keys may not match the rolled-back deployment.

### 5.5 Synthetic public-check verification

```bash
curl -s -X POST https://your-domain.com/api/check \
  -H 'Content-Type: application/json' \
  -d '{"food":"apple","a1c":"6.1"}' | jq .kind
```

Expected: `"result"` (or `"retry"` on transient model errors).
If this returns a 503 or pause copy, Edge Config `public_checks_enabled` may
still be set to `false` — toggle it back to `true` and re-run the probe.

---

## 6. Non-Production Test Override

For local development and CI smoke tests, set:

```bash
PAL_LAUNCH_MODE_OVERRIDE=paused
```

This overrides launch mode to `paused` without touching live Edge Config.
The override is **ignored** in `production` and `VERCEL_ENV=production`
environments to prevent accidental pauses.

---

## 7. Secrets & Environment Variables

All Revora secrets are **server-only**. None may be prefixed with
`NEXT_PUBLIC_` (that would ship them to the browser). Set them in Vercel →
Settings → Environment Variables for **Production + Preview** scopes only.
`.env.example` (repo root) lists every required name with empty values.

| Variable                      | Scope         | Purpose                                               | Required                           |
| ----------------------------- | ------------- | ----------------------------------------------------- | ---------------------------------- |
| `OPENAI_API_KEY`              | prod+preview  | Live model calls (Responses API)                      | Yes                                |
| `EDGE_CONFIG`                 | prod+preview  | Kill-switch / launch-mode reads                       | Yes (for pause control)            |
| `UPSTASH_REDIS_REST_URL`      | prod+preview  | Per-IP rate limit + daily counter store               | Yes (prod fails closed without it) |
| `UPSTASH_REDIS_REST_TOKEN`    | prod+preview  | Auth for the Upstash REST client                      | Yes (prod fails closed without it) |
| `PAL_DAILY_CHECK_CAP`      | prod+preview  | Global daily cap (default `2000`)                     | No (defaults)                      |
| `PAL_MODEL`                | prod+preview  | Model id override (default `gpt-5.4-mini`)            | No                                 |
| `PAL_REASONING_EFFORT`     | prod+preview  | Reasoning-effort lever (blank = neutral)              | No                                 |
| `SENTRY_DSN`                  | prod+preview  | Server-side error capture (Responses-path exceptions) | No (SDK inert without it)          |
| `PAL_LAUNCH_MODE_OVERRIDE` | non-prod only | Force pause in dev/CI (ignored in prod)               | No                                 |
| `PAL_LIVE_EVAL`            | non-prod only | Route eval suite at the live model                    | No                                 |

**Verification (run before each release):**

```bash
# No client-exposed secret leaks:
git grep -nE "NEXT_PUBLIC_(OPENAI|UPSTASH|EDGE_CONFIG)" -- . ':!node_modules' ':!.next'
# Expected: no output.

# .env.example lists all required names:
grep -E "^(OPENAI_API_KEY|EDGE_CONFIG|UPSTASH_REDIS_REST_URL|UPSTASH_REDIS_REST_TOKEN)=" .env.example
```

Evidence slot: confirm in the Vercel dashboard that `UPSTASH_REDIS_REST_URL`,
`UPSTASH_REDIS_REST_TOKEN`, `OPENAI_API_KEY`, and `EDGE_CONFIG` exist for
prod+preview and none are `NEXT_PUBLIC_`. `SETUP_BLOCKED` until Vercel env is
accessible.

---

## 8. public_checks_enabled Reference

The `public_checks_enabled` Edge Config key is the primary kill switch.
When set to `false`, the middleware intercepts requests to `/api/check`
and returns a 503 pause response before any OpenAI model call is made.

This ensures:

- No model spend during a pause incident.
- No raw food text, prompt text, or stack traces in the pause response.
- The public page remains accessible; only the check path is blocked.

---

## 9. Observability & Alerting

Two distinct signal streams. They do **not** overlap — wire alerts on both.

### 9.1 Sentry — server exceptions (the provider-spike signal)

Server-only error capture (`@sentry/node`, initialized from `instrumentation.ts`
on the Node runtime only; the Edge middleware is intentionally **not**
instrumented). Set `SENTRY_DSN` (server-only, never `NEXT_PUBLIC_`) to enable; the
SDK is inert without it.

> **Why Sentry, not logs, owns the provider signal:** a model/provider failure is
> swallowed at `lib/pal/service.ts` and returned to the user as calm `retry`
> copy, so it emits `check_completed` + `responseKind:"retry"` — **not**
> `check_failed`. The only place a provider outage is visible is the explicit
> `Sentry.captureException` at that catch site. Do not try to alert on provider
> failures from the `check_failed` log stream — it won't see them.

Captured events carry only PII-free tags: `stage` (`model` | `route`),
`errorClass` (e.g. `RateLimitError`, `APIConnectionTimeoutError`, `ZodError`),
and `httpStatus`. Message, request body, IP, stack-frame locals, and breadcrumbs
are stripped (allowlist at init + `beforeSend` scrubber).

**Alert rule (ops):** notify when captured-exception volume spikes. Filter
`stage:model` for provider/model failures specifically.

### 9.2 Logs — cost/abuse counters (the cap signal)

`daily_cap`, `rate_limited`, and `paused` are emitted by `emitSafeEvent` as
single-line JSON to stdout (Vercel runtime logs). `daily_cap` fires in the **Edge
middleware**, which is why it is a log signal and not a Sentry event.

Each line looks like: `{"name":"check_failed","environment":"production","reasonCode":"daily_cap"}`

**Alert rule (ops):** in the Vercel log drain / log search, alert on:

- any line with `"reasonCode":"daily_cap"` (cost ceiling hit — investigate), and
- a rate spike of `"name":"check_failed"` lines (sustained failure burst).

---

## 10. Incident Response

One page for "something is wrong — make it stop." Target: **public checks paused
in < 60s** following only this section.

### 10.1 Pause (kill switch)

1. Vercel Dashboard → Storage → Edge Config → Edit.
2. Set `public_checks_enabled = false` **or** `launch_mode = "paused"` (either
   pauses; see §2.3). Optionally set `incident_message`.
3. Confirm: `curl https://your-domain.com/api/health`.

### 10.2 Expected `/api/health` by state

| State                                | Response                                                                                                            |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| Ready                                | `200 {"ok":true,"status":"healthy","issues":[],"launch":"ready","launchMode":"normal","upstash":"configured", ...}` |
| Degraded dependency or stale cron    | `503 {"ok":false,"status":"degraded","issues":[...], ...}`                                                          |
| Missing config (no `OPENAI_API_KEY`) | `503 {"ok":false,"launch":"missing_config", ...}`                                                                   |

`/api/health` is the end-user readiness probe. It fails when the database is
unavailable/unconfigured, a required scheduler heartbeat is stale or has never
run, or a public deployment lacks a valid Upstash REST configuration. Use
`/api/health/live` only for process liveness; it intentionally does not claim
that stateful product journeys are working.

`upstash:"unconfigured"` in a healthy response is a **red flag** on a public
deploy: the rate-limit/cap store is unset, so the middleware is failing closed
(503) on every `/api/check`. Set `UPSTASH_REDIS_REST_URL` / `_TOKEN` (§7).

`emailDelivery:"unconfigured"` also fails readiness on a public deploy. At
least one of the Resend API key, signed-webhook secret, or stable `AUTH_SECRET`
correlation key is absent. Follow `docs/runbooks/email-delivery.md`; provider
API acceptance is not proof of delivery.

### 10.3 Who to notify

- On-call eng (provider/schema error spikes in Sentry, §9.1).
- Ops owner (cost: `daily_cap` in logs, §9.2; or WAF/abuse).
- Clinical reviewer **immediately** for any harmful-guidance incident (§10.4).

### 10.4 Harmful-guidance response

A `SAFE` classification for a genuinely high-risk food (per the threshold table
§1) is the highest-severity incident:

1. Pause immediately (§10.1) — do **not** wait to confirm the pattern first.
2. Notify the clinical reviewer.
3. Review recent model outputs in Vercel logs (telemetry is PII-free — `risk` /
   `responseKind` only; raw food/prompt are never logged, so reproduction uses
   the reviewer's own test inputs, not user data).
4. Restore (§2.4) only after the reviewer signs off and one synthetic check
   passes.

### 10.5 Stateful-layer incident scenarios (P10)

Added once accounts, server history, billing, and push shipped (plan 4B+).
These three scenarios are distinct from §10.1–10.4 above: none of them
require pausing public checks, because the stateful layer is designed to
fail soft around the stateless engine, not take it down with it.

**DB down (Railway Postgres unreachable).** Guests are still answered — the
check engine itself is stateless and never reads the database
(`lib/pal/service.ts`). What breaks: history, coach insights, and
progress all fail soft with calm, on-brand copy rather than a raw error
(they depend on `lib/server/db`). `/api/health` reflects this precisely with
`503`, `ok:false`, `status:"degraded"`, and `db:"error"`; `/api/health/live`
remains 200 so operators can distinguish dependency failure from a dead
process. **Action:** check Railway
status/incident page first; no engine pause is needed. Do not flip
`launch_mode = "paused"` for a DB outage alone — that would needlessly take
down the one path (public checks) that doesn't depend on the database.

**Billing webhook gap (RTDN or Stripe webhook outage).** A missed or
delayed Play RTDN / Stripe webhook does not strand a paying user: entitlement
is verify-on-read (`lib/server/entitlement.ts` `getEntitlement`), so the next
time the user's entitlement is read, a stale Play row is re-checked directly
against the Play Developer API and healed in place. Stripe rows rely on the
webhook more directly, but reconcile automatically once webhook delivery
resumes (providers retry failed webhook deliveries for a window). **Action:**
no manual entitlement edits, ever — a hand edit will simply be overwritten
by the next verify-on-read pass and can mask the real state. Confirm the
provider's webhook-delivery dashboard (Play Console / Stripe) shows the gap
closing; escalate to the provider only if deliveries stay absent well past
their normal retry window.

**Push misfire (nudge cron gap or a burst of failures).** A single missed
hourly run does not broaden the normal send window. A provider-confirmed error
does create explicit same-local-day recovery state: the worker retries on later
non-quiet hourly ticks, with an atomic five-minute lease and a maximum of three
total attempts. `lastNudgeDate` is written only after provider success and
dedupes every later tick that day. A check, entitlement loss, journey stop, or
preference change cancels retry eligibility; stale state never crosses the
local-day boundary. The cron route stays non-green and withholds its success
heartbeat while a retry is failed, pending, or exhausted.

**Residual delivery boundary:** web-push has no application idempotency key. A
network/provider error can mean “delivered but acknowledgement lost,” so a
bounded retry can rarely duplicate a notification. The attempt cap limits that
at-least-once tradeoff; do not manually re-fire a user or cohort because it
bypasses neither this ambiguity nor the lease. **Action:** check
`/api/health`'s `crons.nudge` staleness probe and the Railway
`hourly-crons` logs (`docs/runbooks/price-test.md`). Escalate an `exhausted`
count instead of editing retry rows or invoking the endpoint by hand.

---

## 11. Go-Live Sequence

The ordered path from "release commit is green" to "public link is live." The
golden rule: **publish the public link LAST — only after both rollback drills
(§11.5) pass on the production deploy.** Each step has an evidence slot.

### 11.1 Pre-flight — release gates + QA matrix

Release gates on the release commit (attach output to the release PR):

```bash
npm run typecheck         # clean
npm test                  # all unit + integration green
npm run eval:pal       # mock routing gate green
npm run eval:pal:live  # graded quality gate — SETUP_BLOCKED until OPENAI_API_KEY
                          # + domain gold labels (acceptableRisks/labelSource) are set
npx playwright test       # smoke suite green (Mobile Chrome + Mobile Safari)
```

`eval:pal:live` is **blocked** until (a) `OPENAI_API_KEY` is exported and
(b) the domain reviewer authors per-case gold labels in
`tests/fixtures/pal-eval-cases.json`. Record `SETUP_BLOCKED` here until both
land; do not publish the link on a faked pass.

Manual QA matrix — run against the **Preview** URL (§4) on real devices before
promoting. Mark each cell pass/fail:

- [ ] **Android Chrome** — happy SAFE / MODERATE / HIGH, clarify, not-food,
      out-of-scope, invalid input, slow (>5s), timeout, offline, rate-limited
      (429), paused (503).
- [ ] **iOS Safari** — same row as above.
- [ ] **Desktop** — same row as above.
- [ ] **Install + offline launch** (both mobiles): install to home screen; go
      offline; relaunch shows `offline.html` (not the browser error); confirm in
      DevTools → Network that `/api/check` is never served from cache.
- [ ] **DevTools → Application → Manifest**: no errors; install prompt available.
- [ ] **Lighthouse**: PWA "installable" passes; **accessibility ≥ 95**.
- [ ] **Manual a11y** (folds in deferred Phase 5.3): keyboard-only flow;
      VoiceOver (iOS) + TalkBack (Android) read the form, result, and disclaimer;
      200% browser zoom has no clipping or horizontal scroll.

Evidence slot: attach the filled matrix + Lighthouse report to the release PR.

### 11.2 Deploy to production

Promote the release deploy with `launch_mode = "normal"` and
`public_checks_enabled = true` in Edge Config (§2.1). Record the deployment ID.
Evidence slot: `SETUP_BLOCKED` if Vercel access is unavailable.

### 11.3 Health smoke

```bash
curl https://your-domain.com/api/health
```

Expected: `{"ok":true,"launch":"ready","launchMode":"normal","upstash":"configured", ...}`
(see the state table §10.2).

**Merge/deploy gate:** `upstash:"unconfigured"` here means the rate-limit + cap
store is unset, so the middleware is failing **closed (503)** on every
`/api/check`. Set `UPSTASH_REDIS_REST_URL` / `_TOKEN` + `PAL_DAILY_CHECK_CAP`
(§7) and re-probe before continuing — do not proceed past this step until it
reports `configured`.

### 11.4 Controlled burst — confirm rate-limit + cap

Trip the WAF rule (§3 — 10 req / 10 min / IP) from a single IP and confirm the
client-facing 429, with no model spend:

```bash
for i in $(seq 1 12); do
  curl -s -o /dev/null -w "%{http_code}\n" -X POST https://your-domain.com/api/check \
    -H 'Content-Type: application/json' \
    -d '{"food":"apple","a1c":"6.1"}'
done
# Expected: the first ~10 return 200, then 429 for the remainder.
```

The 2,000-checks/24h daily cap (§1) is enforced by middleware through Upstash.
Confirm the `daily_cap` / `rate_limited` log signals are visible in the Vercel
log drain (§9.2) so operators can distinguish cap exhaustion from per-IP abuse.
Evidence slot: record the status-code sequence + a sample log line.

### 11.5 Rehearse both rollback drills (BEFORE publishing the link)

Run both drills on the live production deploy and **time them**:

| Drill                   | Procedure                                 | Target  | Start | Restored | Elapsed | Operator |
| ----------------------- | ----------------------------------------- | ------- | ----- | -------- | ------- | -------- |
| Pause via Edge Config   | §10.1 → restore §2.4                      | < 60s   |       |          |         |          |
| Vercel instant rollback | §5.1–5.5 (incl. health + synthetic check) | < 5 min |       |          |         |          |

Both drills must pass — pause restores public checks in < 60s, and rollback
reaches recovery (§5.3–5.5 all green) in < 5 min. If either misses its target,
**do not publish**; fix the gap and re-rehearse.

### 11.6 Publish the public link

Only after 11.1–11.5 are all green. Announce the URL. Watch Sentry (§9.1) and the
log drain (§9.2) for the first hour; keep the §10 incident runbook one click away.

Evidence slot: timestamp of publication + link to the filled drill-log (11.5).
