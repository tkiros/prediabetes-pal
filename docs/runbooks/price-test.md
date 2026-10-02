# Runbook: Price Test + Paywall Flip / Rollback

Operational runbook for running a trial-price A/B test and for flipping the
production paywall from `legacy` to `trial` (and rolling back). Execute
top-to-bottom; every step names how to verify it.

Payment model is **Decision D** (card-gated 7-day free trial, no permanent free
tier) — see `docs/adr/billing.md` ("Decision D"). Production stays on
`PAYWALL_MODE=legacy` until a founder runs the flip procedure below.

---

## 1. Cohorting

**One variant per traffic window.** A price variant is set by the
`TRIAL_PRICE_VARIANT` env var and read by `resolvePriceVariant()` in
`lib/server/pricing.ts`. The wall display price and the Stripe price ID both
derive from it, so the wall can never show a price checkout won't charge.

Rules:
- Set `TRIAL_PRICE_VARIANT` to one of `999`, `1299`, `1999`, then **redeploy**
  (env changes only take effect on a new deployment).
- **Never run two variants while one community is actively linked.** If
  r/prediabetes (or any single source) is driving a window, that window sees
  exactly one price. Matched cohorts only — no split within one community.
- Change the variant only at a clean window boundary, and log the switch in the
  window table below.

### Window log (fill one row per window)

| Window start (UTC) | Window end (UTC) | Variant | Traffic source | Notes |
|--------------------|------------------|---------|----------------|-------|
|                    |                  |         |                |       |
|                    |                  |         |                |       |
|                    |                  |         |                |       |

---

## 2. Metrics

Track exactly three metrics per variant.

### 2.1 Trial-start rate (Umami)

`trial_start_rate = trial_started / wall_viewed`

Both are client analytics events (`lib/client/analytics.ts`), each carrying a
`variant` prop. `wall_viewed` fires when the card wall is shown; `trial_started`
fires on `app/trial/started/page.tsx`. Read the counts, filtered by `variant`,
from the Umami dashboard for the window.

### 2.2 Trial → paid conversion (NEW-ONLY, SQL)

Run against the production Postgres DB. A row converts exactly once, so renewals
cannot pollute the ratio:

```sql
SELECT price_variant,
       COUNT(*) FILTER (WHERE status='active') AS converted,
       COUNT(*)                                AS started
FROM subscriptions
WHERE provider='stripe'
  AND price_variant IS NOT NULL
GROUP BY 1;
```

Verified against `lib/server/db/schema.ts`: `subscriptions` has
`provider` (`'play' | 'stripe'`), `price_variant` (text, nullable), and
`status` (`'active' | 'trialing' | 'canceled' | 'grace' | 'expired' | 'refunded'`).
`converted / started` per row is the conversion rate for that variant.

This query is a point-in-time snapshot: read it **~1 week after the window's
last trial start** so trials have had the full 7 days to mature — reading too
early leaves late-window trials still `trialing` (deflating the ratio), and
reading long after lets churn move converts back out of the `active` numerator.

Where to run it: the production Postgres console (Neon/Vercel Postgres dashboard
→ SQL editor), or `psql "$POSTGRES_URL"` against prod.

### 2.3 Margin per user (manual, for now)

`margin_per_user = Stripe revenue (window) − OpenAI spend (taster + trial, window)`

- Stripe revenue: Stripe Dashboard, filtered to the window.
- OpenAI spend: the OpenAI usage dashboard over the same window. Manual — there
  is no automated join yet.

---

## 3. Guardrails

Stop or reconsider a variant if any of these move against you:

- **Taster → wall → trial-start drop-off** — if the funnel from taster to
  `wall_viewed` to `trial_started` collapses, the wall / price is too scary.
  Read from Umami.
- **Refund / chargeback count** — Stripe Dashboard. A spike means the trial felt
  like a trap; the transparency guarantees (pre-charge email + one-tap cancel)
  are what keep this low.
- **Community sentiment** — manual. Watch the linked community thread; a distrust
  audience will say so loudly.

---

## 4. Decision rule

- Pre-commit to a sample per arm **before** looking: roughly 2 weeks **or**
  ~100 activated users per arm, whichever comes first.
- Promote the variant that wins on **margin per user** without cratering
  trial-start rate.
- Only **paid** conversions count. Card-abandon happens at the checkout form and
  is not a conversion.

---

## 5. Flip procedure (prod: `legacy` → `trial`)

Do these in order. Each step states how to verify before moving on.

**Step 1 — Migration 0002 applied.**
The trial columns come from `drizzle/0002_trial-billing.sql` (`price_variant`,
`pre_charge_email_sent_at`, both nullable).
Verify against prod DB:
```sql
SELECT column_name FROM information_schema.columns
WHERE table_name='subscriptions' AND column_name='price_variant';
```
Expect one row. If empty, apply migrations before continuing.

**Step 2 — All five Stripe price IDs set (live).**
In Vercel prod env, confirm these are present and are **live-mode** price IDs:
- `STRIPE_PRICE_MONTHLY_999`
- `STRIPE_PRICE_MONTHLY_1299`
- `STRIPE_PRICE_MONTHLY_1999`
- `STRIPE_PRICE_ANNUAL_8999` (the $89.99/year annual plan, owner decision 2026-09-06)
- `STRIPE_PRICE_PANTRY`

(Env keys read by `lib/server/pricing.ts` and `app/api/billing/handlers.ts`. The
legacy `STRIPE_PRICE_MONTHLY` stays set for legacy-mode subscribers; do not
remove it.)
Verify: Vercel → Project → Settings → Environment Variables (Production), each
key present and prefixed `price_...`.

**Step 3 — Webhook secret + events (live).**
Confirm `STRIPE_WEBHOOK_SECRET` is set in Vercel prod (read at
`app/api/billing/handlers.ts:454`). The prod webhook endpoint
`https://<prod-domain>/api/billing/stripe/webhook` must be subscribed to exactly
these events (authoritative list: `docs/handoff/human-actions-required.md`, H21):
- `checkout.session.completed`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `charge.refunded`

Verify: Stripe Dashboard → Developers → Webhooks → the prod endpoint shows all
five events and points at the prod domain. Confirm delivery with Stripe CLI:
`stripe trigger checkout.session.completed` and check the endpoint logs a 2xx.

**Step 4 — Phase-3 cron deployed and alive.**
The hourly crons (`nudge`, `pantry-sweep`, `trial-precharge`) are triggered by
the Railway service `hourly-crons` in the `revora` Railway project (schedule
`0 * * * *`; it curls each `/api/cron/*` endpoint with the `CRON_SECRET`
bearer token — Vercel Hobby only allows daily crons, so only the weekly
`bai-weekly` remains in `vercel.json`). The route writes a liveness heartbeat
to the `cron_heartbeat` table with `name = 'trial-precharge'`
(`lib/server/billing/precharge.ts`, after the sweep).
Verify the schedule is live: Railway → revora → hourly-crons shows the cron
schedule enabled and a recent successful run.
**Confirm the heartbeat is fresh before flipping.** Hit `/api/health` on the
prod domain and confirm `crons.trialPrecharge` is `"ok"` (not `"stale"` or
`"never"`) — the precharge sweep is the anti-surprise-charge trust rail the
trial design is gated on, so a stale heartbeat blocks the flip. Fallback if
`/api/health` is unavailable, or to inspect the exact timestamp (after the first
scheduled run, or trigger it manually with the `CRON_SECRET` bearer token):
```sql
SELECT name, last_run_at FROM cron_heartbeat WHERE name='trial-precharge';
```
Expect one row with a recent `last_run_at`.

**Step 5 — Set the flip env vars.**
In Vercel prod env, set:
- `PAYWALL_MODE=trial`
- `TRIAL_PRICE_VARIANT=999`  (default since 2026-09-06; `paywallMode()` /
  `resolvePriceVariant()` in `lib/server/pricing.ts` default to `legacy` / `999`
  respectively)

**Step 6 — Deploy.**
Trigger a production deployment so the env changes take effect.
Verify: the deployment is Ready in Vercel, and load the app — the card wall
renders with the `$12.99` price (matching variant `1299`).

**Step 7 — One real end-to-end charge.**
With a founder's real card: hit the wall, start the trial, then immediately use
one-tap cancel.
Verify:
- A new `subscriptions` row exists with `provider='stripe'`,
  `price_variant='1299'`, `status='trialing'`.
- Umami logs a `trial_started` event.
- App logs / Stripe show the `checkout.session.completed` webhook handled with a
  2xx.

**Step 8 — Watch logs.**
Tail the production logs (Vercel → deployment → Runtime Logs) and confirm live
`trial_started` traffic and clean webhook handling as real users arrive. No 5xx
on `/api/billing/stripe/webhook`.

---

## 6. Rollback

If anything looks wrong at any point:

1. Set `PAYWALL_MODE=legacy` in Vercel prod env.
2. Redeploy.

**Why this is safe:** existing `trialing` / premium rows keep working in legacy
mode — `PREMIUM_STATUSES` includes `trialing`
(`lib/server/entitlement.ts`: `["active", "trialing", "grace", "canceled"]`), so
nobody loses paid access when you flip back.
**Data loss: none.** Every column migration 0002 added is nullable
(`price_variant`, `pre_charge_email_sent_at`), so no data is dropped by running
in legacy mode.

---

## 7. Existing-user note

At flip, a previously signed-in free user hits the **hard wall** on their next
check (entitlement status `lapsed` or `none`). This is **Decision D by design**
("no residual free checks, ever" — `docs/adr/billing.md`): the wall *is* their
trial offer. No backfill and no migration of existing users is required.
