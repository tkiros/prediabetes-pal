# Human action required — running list (full-build execution)

**Started:** 2026-07-01 · **Maintained by:** the build session — appended as phases surface human-only steps.
Source inventory: `docs/production-implementation-plan-2026-07-01.md` §10. Status legend: ☐ open · ⏳ long-lead, start NOW · ✅ done.

Reconciled 2026-07-22 against the live service audit. Provider claims below
remain open until their stated provider-side evidence exists; local code or
environment-variable presence does not close them.

## ⚠ Longest-lead items — start these today

1. ✅ **Owner-risk launch decision recorded for the exact candidate.** The owner
   waived professional counsel on 2026-07-12 because of budget and launch-speed
   constraints. `docs/legal/owner-risk-launch-decision-5f6abcb.md` records the
   scope and residual risk. Automated GREEN remains engineering evidence, not a
   legal opinion or counsel clearance.
2. ⏳ **Google Play Developer account ($25)** — ID verification takes days. Decide **account type** (individual vs business) first.
3. ⏳ **Trademark clearance "Revora"** (2–4 weeks).
4. ⏳ **Domain decision + purchase** — everything in P7–P9 (DNS, Resend deliverability, assetlinks, deletion URL, listing URLs) hangs off the final domain.

## §0 Decisions before/at start (defaults let the build proceed)

- ☐ Confirm branch/commit/preview-deploy permission (Vercel authed)
- ☐ Final domain (record here: ______)
- ☐ Play account type (individual/business)
- ☐ Launch SKUs/prices — default **$12.99/mo · $99.99/yr**, lifetime deferred
- ☐ Free-tier daily check count — default **5**
- ☐ Support email — default `support@<domain>`
- ✅ Refund policy stance — first web subscription charge refundable within seven calendar days; duplicate/unauthorized/mandatory-law cases covered; Pantry refundable until processing begins
- ☐ US-only vs EU launch — default **US-only**
- ☐ Approve app name/icon/brand as final

## §1 Accounts to create

- ✅ runtime exists — canonical Railway Postgres is provisioned and production
  can query it. ☐ Still open: backup/PITR evidence, isolated restore proof,
  least-privilege role review, and a separate preview database.
- ☐ open — Resend account, API key, and sending-domain records exist, but the
  required Return-Path MX and provider/inbox/bounce proof remain incomplete.
- ✅ done — Upstash prod: signed up, API key set in environment file, CLI
  installed and authenticated
- ☐ open — Sentry is configured in production; provider receipt, scrubbing,
  source-map, and alert-delivery canaries remain unproven.
- ✅ runtime exists — Vercel Edge Config read path is proven. ☐ Still open:
  ownership, safe pause/resume drill, and owner-routed alert proof.
- ☐ open — Umami Cloud is the chosen/current production deployment and the
  script/gateway transport is configured. Provider dashboard receipt and an
  exactly-once allowlisted browser event remain unproven. Do not provision a
  Railway Umami service for launch.
- ⏳ Google Play Developer ($25)
- ☐ Google Cloud project (Play Developer API enabled, service-account JSON, RTDN Pub/Sub topic)
- ☐ Vercel Pro (hourly crons + function limits)
- ☐ OpenAI prod key/quota (exists — confirm limits)
- ☐ Domain registrar
- ✅ done — Stripe (account, verification, bank): logged in, account live,
  MCP authenticated

## §2 Secrets to provision in Vercel (preview + prod; ⚙ = session generates, human stores)

`OPENAI_API_KEY` 
· `UPSTASH_REDIS_REST_URL`/`_TOKEN` 
· `SENTRY_DSN` · Edge Config 
· `DATABASE_URL` (Railway Postgres) 
· ⚙`AUTH_SECRET` · ⚙`HEALTH_DATA_KEY` 
· ⚙`VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY` 
· `RESEND_API_KEY` 
· `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` + `PLAY_PACKAGE_NAME` + `RTDN_SHARED_TOKEN` 
· `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET`/price IDs 
· `NEXT_PUBLIC_UMAMI_SRC`/`NEXT_PUBLIC_UMAMI_WEBSITE_ID` 
· `CRON_SECRET` 
· `NEXT_PUBLIC_APP_URL` 
· ⚙`REVIEWER_TEST_SECRET` (**preview only**) 
· `NEXT_PUBLIC_REVIEWER_MODE` (**preview only, never production**)
· `NEXT_PUBLIC_PHOTO_INPUT`=`1` + `PHOTO_INPUT_ENABLED`=`1` in production —
  authorized 2026-08-14 (`docs/legal/owner-decision-2026-08-14-photo-assist-on.md`).
  ⛔ if you ever unset these, re-capture `public/landing/app-check.png` in the
  same change; it pictures the photo chip and no test reads pixels
· `NEXT_PUBLIC_LONGITUDINAL_INSIGHTS`=`1` + `LONGITUDINAL_INSIGHTS_ENABLED`=`1`
  in production — authorized 2026-08-14
  (`docs/legal/owner-decision-2026-08-14-longitudinal-insights-on.md`).
  ⛔ `vercel env pull` returns an empty string for both; that is the CLI failing
  to read them back, **not** proof they are off. Check `/privacy` for
  `derived pattern summaries` instead

## §3 Money

. Play $25 
· Vercel Pro ~$20/mo 
· domain ~$12/yr 
· OpenAI usage 
· Railway/Resend/Umami Cloud/Upstash tiers
· Stripe fees 
· optional future counsel fees

## §4 Legal / owner-risk / compliance

- ✅ Professional review waived/deferred by owner; the candidate is explicitly
  not counsel-cleared
- ☐ Owner supplies entity, address, market, venue, refund/merchant choices,
  monitored support inbox, and named refund/incident owners
- ✅ Owner accepted the documented residual risk of launching without an
  independent legal opinion
- ☐ OpenAI DPA executed
- ✅ Purpose-bound health-data consent implemented; names OpenAI, links Privacy, and is separately revocable without deleting login/subscription
- ⏳ Trademark clearance "Revora"
- ☐ Company entity confirmed (payouts/tax)
- ☐ Privacy policy + ToS live on prod domain
- ☐ Deletion URL declared in Play
- ☐ Tax/banking in Play merchant profile (W-9/W-8 + payout bank)
- ☐ CCPA stance recorded (US-only default: no sale/share)

## §5 Domain / DNS / email

- ☐ Domain → Vercel + verify
- ☐ Resend DNS (SPF/DKIM/DMARC) so magic links deliver
- ☐ `/.well-known/assetlinks.json` reachable on the live domain (needs §7 fingerprint)

## §6 Play Console

- ☐ Create app · internal-testing track + testers
- ☐ Subscription products/base plans/prices (after §0 SKU confirmation)
- ☐ License testers
- ☐ Forms: Data Safety, content rating, target audience (adults), health declarations, ads=none, export compliance, account-deletion URL, app-access reviewer login — code is in place (`app/api/auth/reviewer-signin/route.ts`, `/signin`'s "Reviewer access" form); enter `reviewer@revora.test` + the `REVIEWER_TEST_SECRET` value in the Play Console "App access" form (see the P9 entry below for the setup steps)
- ☐ Store listing assets (title/descriptions/feature graphic/screenshots/icon/privacy URL)
- ☐ Upload `.aab` · rollout internal → closed → production · respond to review

## §7 Signing / packaging

- ☐ Play App Signing + upload keystore (Bubblewrap); safeguard passwords
- ☐ First upload → copy App Signing SHA-256 into `public/.well-known/assetlinks.json`
- ☐ Build & sign the `.aab`

## §8 Hardware

- ☐ Physical Android device (emulators can't fully test Play Billing)
- ☐ Device Google account on internal track + license-tester payment method

## §9 Cutover approvals

- ☐ Provision prod secrets → ☐ approve production deploy (P7) → ☐ approve Play submission/rollout (P9)

## §10 Post-launch

- ☐ Acquisition execution (r/prediabetes, SEO, ASO, doctor channel)
- ☐ Support ownership · ☐ monitoring/on-call · ☐ refunds/incident response

---

## Appended during the build

*(phase-stamped additions land here)*

### P7 — Production hardening + observability (2026-07-02)

Current provider closeout actions (`docs/adr/hosting-hybrid.md`,
`docs/adr/analytics-umami.md`):

- ☐ **Finish Railway Postgres governance**: provision a separate preview DB,
  apply every checked-in migration in order, verify `drizzle.__drizzle_migrations`,
  restrict the app role, document the connection budget, and perform a timed
  restore into an isolated service (`docs/ops/env-reference.md`).
- ☐ **Finish Umami Cloud proof**: set `NEXT_PUBLIC_UMAMI_SRC` +
  `NEXT_PUBLIC_UMAMI_WEBSITE_ID` in preview and production, confirm CSP permits
  the configured script and ingest origins, and observe one allowlisted browser
  event exactly once in the intended provider website.
- ☐ **Sentry canary verification** — trigger one real error on a deployed
  preview and confirm it lands in Sentry (`SENTRY_DSN` is already wired
  through `captureServerError`; this task only verifies live delivery,
  which can't be done from this environment).
- ☐ **Run `scripts/consistency-check.mjs` N=50 against a real preview
  deploy** and record the flip rate in `docs/ops/launch-controls.md` —
  target **≥95% modal class**. Needs a deployed preview URL + live
  `OPENAI_API_KEY` traffic, neither available in this build environment.
- ☐ **Human skim of the P6 BAI band strings + `/how-it-works` citations**
  (compliance surface) — `lib/coach/bai.ts`'s `BAI_BAND_COPY` and the CDC
  DPP citation on `/how-it-works` are claims-boundary-tested (no predicted
  A1C, no "reverse," calm tone) but haven't had a human compliance read.
- ☐ **`nudge_sent` send-counts**: Umami is client-script-based, so the
  server-side send event isn't tracked there by design (see
  `docs/adr/analytics-umami.md`). Until a server-side metrics pipeline
  exists, read send/prune/skip counts from cron logs, or from
  `/api/health`'s `crons.nudge` / `crons.baiWeekly` staleness probe
  (`ok`/`stale`/`never`) for a coarse liveness signal.

### P9 — Terms of Service + reviewer test-login (2026-07-02)

Both Play-submission-readiness artifacts are implemented and tested; three
manual steps remain before Play review can use them:

- ☐ **Capture the deployed operator identity** — the owner WTP decision
  authorizes the public name `Revora` and `support@revora.bio` for the limited
  Stripe scope. Set both explicitly in production and capture `/terms` and
  `/privacy`; do not add a fictional legal identity or address.
- ☐ **Run the reviewer-account seed script against the preview database**
  once Railway Postgres is provisioned (§1):
  `DATABASE_URL=<preview-url> HEALTH_DATA_KEY=<preview-key> node
  scripts/seed-reviewer-account.mjs`. Idempotent — safe to re-run. Creates
  `reviewer@revora.test`, fully onboarded/consented, Premium.
- ☐ **Set `REVIEWER_TEST_SECRET` and `NEXT_PUBLIC_REVIEWER_MODE=1` in
  Vercel — Preview environment only, never Production** (`docs/ops/env-reference.md`).
  The bypass route (`app/api/auth/reviewer-signin/route.ts`) additionally
  hard-404s whenever `VERCEL_ENV=production`, independent of these two
  vars, so this is a belt-and-suspenders setting, not the only lock.
- ☐ **Enter the reviewer credentials in the Play Console "App access"
  form**: email `reviewer@revora.test`, and the `REVIEWER_TEST_SECRET`
  value as the access code, plus a one-line note that the sign-in form is
  the small "Reviewer access" disclosure at the bottom of `/signin` (only
  visible on preview builds).

### P8 — TWA packaging + physical-device QA (2026-07-02)

Autonomous artifacts landed: `twa-manifest.json` (repo root, Bubblewrap
config template), `docs/ops/device-qa-checklist.md` (13-section physical-
device QA script), and a §9.3 note in `docs/ops/play-twa-runbook.md`
pointing at the manifest file. Everything below needs hands, hardware, or a
Play Console session:

- ☐ **Generate the Play App Signing keystore** and safeguard the signing
  key + passwords (§7 above) — needed before `bubblewrap build` can produce
  a real, submittable `.aab`.
- ☐ **Fill `twa-manifest.json`'s human-fill fields** once the domain is
  final: `host`, `webManifestUrl`/`iconUrl`/`maskableIconUrl`/
  `fullScopeUrl` (`<domain>` → the real production domain), and
  `signingKey.path`/`signingKey.alias` (never commit the actual keystore or
  its password).
- ☐ **First internal-testing-track upload** of the signed `.aab` to Play
  Console.
- ☐ **Copy the Play App Signing SHA-256** (Play Console → Setup → App
  integrity → App signing key certificate, available only after the first
  upload) and use it to fill + commit + deploy
  `public/.well-known/assetlinks.json` from the template in
  `docs/ops/play-twa-runbook.md` §9.3 — this file must **not** be created
  before the real fingerprint exists (placeholder fingerprints fail
  validation or forge trust).
- ☐ **Create a license-tester account** on the device's Google account
  (§8 above) so Play Billing purchases in QA don't charge a real card.
- ☐ **Run the full `docs/ops/device-qa-checklist.md`** on a physical
  Android device against the internal-testing build — this is the Gate 2
  evidence artifact for "Full device QA passed on hardware incl. real Play
  purchase/restore" (`docs/production-implementation-plan-2026-07-01.md`
  §11). Needs the keystore, the upload, assetlinks live on the production
  domain, and the license-tester account above, in that order.
- ⚠ **`public/manifest.webmanifest` gap found during this pass:** P8 asks
  for a `screenshots` array and maskable icons on the web manifest. Maskable
  icons are already present (`icon-maskable-512.png`), but there is **no
  `screenshots` array** — this is a small code change (editing
  `public/manifest.webmanifest`, which this docs/config-only task is not
  scoped to touch), not a human/ops action. Flagging here so it isn't lost;
  hand to an implementation pass before the P8 device-QA/Play-listing
  screenshots work, since a manifest `screenshots` array also improves the
  browser-native "install" UI richness independent of the Play listing's own
  screenshot assets (`docs/ops/play-listing.md` §9).

### P10 — Launch, support, incident response (2026-07-02)

Autonomous artifacts landed: `docs/ops/support-playbook.md` (response
macros + escalation ladder), `docs/ops/launch-checklist.md` (ordered go-live
list), and three stateful incident scenarios appended to
`docs/ops/launch-controls.md` §10.5 (DB down, billing-webhook gap, push
misfire). Everything below needs hands, a Play Console session, or a
business decision:

- ☐ **Paste the store listing into Play Console** from
  `docs/ops/play-listing.md` (title, descriptions, tags, content-rating
  answers, health-apps declaration, Data Safety form per
  `docs/ops/play-twa-runbook.md` §9.2) once the domain, `<...>` placeholders,
  and the real operator/commercial facts (next item) are resolved.
- ☐ **Capture the screenshots** per `docs/ops/play-listing.md` §9's
  shot-list, signed in as the seeded `reviewer@revora.test` account so no
  real user's data appears in a public store asset.
- ✅ **Owner-risk decision** — professional review was waived/deferred. The
  SHA-bound decision is recorded in
  `docs/legal/owner-risk-launch-decision-5f6abcb.md`; it does not claim counsel
  clearance. Photo-assist and longitudinal insights were recorded there as off;
  both were **authorized ON on 2026-08-14** by the two dated entries beside it
  (`owner-decision-2026-08-14-photo-assist-on.md`,
  `owner-decision-2026-08-14-longitudinal-insights-on.md`). The waived counsel
  review is unchanged by either.
- ☐ **Create the `support@<domain>` inbox** and route it to whoever owns
  Tier 1/2 in `docs/ops/support-playbook.md`'s escalation ladder.
- ☐ **Stand up an uptime monitor** against `https://<domain>/api/health`
  (`docs/ops/launch-checklist.md` §7) — alert on non-200 or `ok:false`.
- ☐ **Assign on-call/refund ownership** as a named person or rotation
  (`docs/ops/support-playbook.md` §1 escalation ladder; §10 of the earlier
  running list already flags this as open).

### WS2 — Pantry Review pipeline, urgent/gates-the-build items (2026-07-04)

Copied verbatim from `docs/handoff/2026-07-04-unified-completion-plan.md`
Appendix A, items H1–H6 (the deduplicated master list):

| # | Action | Done when |
|---|---|---|
| H1 | **Rotate the Resend + Upstash keys** (they sat in `.env.example` and passed through AI transcripts) | New keys live in Resend/Upstash dashboards + updated in Vercel + local `.env`; old keys revoked |
| H2 | **Create the $25 pre-order Stripe Payment Link** (dashboard, no code) for the day-2 ask; copy its **price ID** → `STRIPE_PRICE_PANTRY` env; point the Stripe webhook endpoint at the deploy and set `STRIPE_WEBHOOK_SECRET`; **write the day-45 fallback paragraph (design doc Q1)**; **post the day-2 ask** (community rules read first). Ongoing: **pause the Payment Link whenever open orders ≥10** (weekly cap guardrail — check `/admin/pantry`) | Payment Link public; a test purchase produces a `pantry_orders` row on preview; the post is live; the paragraph is written and signed |
| H3 | **Provision a dedicated private Vercel Blob store** on the project → `PANTRY_BLOB_READ_WRITE_TOKEN` (preview + prod + approved local E2E). Do not reuse the legacy public-store `BLOB_READ_WRITE_TOKEN`; Blob access mode is immutable. | Authorized upload/process/delete passes; unauthenticated and cross-user reads fail; delete-failure pointer recovery is proven |
| H4 | Set `ADMIN_EMAIL` (founder's sign-in email) and `CRON_SECRET` in Vercel (preview + prod). Note: ADMIN_EMAIL comparison is case-sensitive — set it exactly lowercase matching the founder sign-in email. | `/admin/pantry` loads for founder, 404s for others; crons authenticate |
| H5 | **Verify Vercel Pro** is active (300s `maxDuration` + hourly crons need it) | Plan visible in Vercel dashboard settings |
| H6 | **8–10 pantry/fridge photos of your own kitchen**, exhaustively labeled into `tests/fixtures/pantry-photos/labels.json`; provide `OPENAI_API_KEY` for the two live eval runs | Task 4.1 + 4.2 verdict doc has real numbers |

### WS3 — Launch-readiness paywall + pantry plan (2026-07-05, Task 2.1 Stripe provisioning)

**Provisioned by agent (Stripe MCP, LIVE mode, Vendoval account `acct_14W8GFKweWSWjefk`, per OQ-1 founder decision 2026-07-05):**

| Object | ID | Detail |
|---|---|---|
| Product | `prod_UpYMfliiN8R9DW` | Revora Premium, `statement_descriptor: REVORA`, `metadata.app=revora` |
| Price | `price_1TptGbKweWSWjefkCeYyknna` | $9.99/mo, `lookup_key revora_monthly_999`, `metadata.price_variant=999` |
| Price | `price_1TptH2KweWSWjefkouRiU8KE` | $12.99/mo, `lookup_key revora_monthly_1299`, `metadata.price_variant=1299` (default variant) |
| Price | `price_1TptHYKweWSWjefkscWTlAfo` | $19.99/mo, `lookup_key revora_monthly_1999`, `metadata.price_variant=1999` |
| Product | `prod_UpYOONypmsbqiZ` | Revora Pantry Review, `statement_descriptor: REVORA PANTRY` |
| Price | `price_1TptIOKweWSWjefkNlWbC1qH` | $49 one-time, `lookup_key revora_pantry_49` |

No `trial_period_days` on any price (deliberate — the 7-day trial is set per Checkout Session so legacy checkout stays trial-free).

**Human actions (open):**

| # | Action | Done when |
|---|---|---|
| H20 | **Configure the Billing Portal default configuration** (dashboard → Settings → Billing → Customer portal; the portal-configuration API is not exposed via the MCP): cancellation ENABLED, mode `at_period_end`, cancellation reason NOT required (one-tap principle), payment-method update ENABLED | Portal test session shows cancel-at-period-end with no reason survey |
| H21 | **Create the production webhook endpoint** `https://<prod-domain>/api/billing/stripe/webhook` subscribed to exactly: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `charge.refunded`; set `STRIPE_WEBHOOK_SECRET` in Vercel (prod). Blocked on final prod domain. | Stripe CLI `trigger checkout.session.completed` reaches the deploy |
| H22 | **Set Vercel env vars** (prod + preview): `STRIPE_PRICE_MONTHLY_999/1299/1999` + `STRIPE_PRICE_PANTRY` = the four price IDs above; `STRIPE_PRICE_MONTHLY` = the 1299 ID (legacy handler 503 guard); `PAYWALL_MODE=legacy`; `TRIAL_PRICE_VARIANT=1299` | `/api/paywall` returns `{mode:"legacy",variant:"1299"}` on the deploy |
| H23 | **OQ-2: provision a test-mode mirror** of the same products/prices (test-mode API keys) for QA/DoR walkthrough; provide test keys + test price IDs for the preview env | Preview checkout completes with `4242…` card |
| H24 | **Verify the Stripe webhook endpoint API version is 2025-03-31.basil or later** (Dashboard → Developers → Webhooks → endpoint version) so invoice.paid payloads carry `parent.subscription_details`; the code has a legacy top-level fallback but pinning basil removes the ambiguity | Endpoint shows basil+ version |
| H25 | **Create the Tally store-intent waitlist form** (the connected Tally MCP exposes only auth endpoints — no form-creation API, so this is human-only). Fields: **email** (required) + **platform** (Android / iPhone, required) + a one-line purpose statement: "Only used to tell you when the store version ships." Then set `NEXT_PUBLIC_WAITLIST_URL` in Vercel (preview + prod) to the published Tally form URL. Task 5.6's `/get-the-app` page is env-gated and fully functional without it — the waitlist section stays hidden until the var is set. | `/get-the-app` shows the "Prefer the store version?" section + "Tell me when it ships" CTA on the deploy, and the CTA opens the Tally form |

### 2026-07-23 — service-integrations GO closeout (owner-only residuals)

The registrar is Namecheap BasicDNS (`dns1/dns2.registrar-servers.com`) and no
DNS API credential exists on this workstation, so every DNS change below is
owner-only. Apply in this order and wait for propagation between steps.

| # | Action | Done when |
|---|---|---|
| H26 | **Publish the Resend Return-Path MX** at Namecheap: host `send.contact`, type MX, value `feedback-smtp.us-east-1.amazonses.com`, priority `10`, TTL automatic. Resend's domain screen currently reports this record verified from an earlier check, but the authoritative nameservers do not serve it — trust `dig`, not the cached provider state. | `dig +short MX send.contact.revora.plus @dns1.registrar-servers.com` returns the record, and two public resolvers agree |
| H27 | **Tighten DMARC** on `_dmarc.revora.plus` from `p=none` to `p=quarantine` (then `p=reject` after a clean week of reports). Add `rua=mailto:` reporting to a monitored inbox first. | Updated TXT visible on authoritative NS + two resolvers; reports arriving |
| H28 | **Add apex CAA records** allowing only the CAs actually used (Vercel provisions via Let's Encrypt and Google Trust Services): `0 issue "letsencrypt.org"` and `0 issue "pki.goog"`. | `dig +short CAA revora.plus` shows exactly the intended CAs and certificate renewal still succeeds |
| H29 | **Enable DNSSEC** at Namecheap for `revora.plus` (BasicDNS supports one-click DNSSEC). | `dig +short DS revora.plus` returns a DS record and resolution stays healthy from two validating resolvers |
| H30 | **GitHub Pro** ($4/mo) on the `tkiros` account — the private `Revora` repo returns HTTP 403 for branch protection, rulesets, code scanning, and secret scanning on the free plan, so required reviews/checks and forbidden-merge enforcement cannot be configured by any session until the plan exists. Do not make the repository public as a workaround. | Branch-protection API returns 200; a required-checks + review ruleset on `main` rejects an unreviewed push |
| H31 | **Upstash payment method** (pay-as-you-go) if a dedicated preview Redis is wanted — the free plan is capped at one database, so preview currently runs with Upstash unbound and the abuse doors fail closed by design. | A second database named `revora-preview` exists and its REST URL/token are bound to the Vercel preview environment |
| H32 | **Umami Cloud API key** (Account → API keys) if dashboard-receipt/blackout-alert proof should be automated — only the browser transport (script load + `/api/send` 200) is provable without it. | `UMAMI_API_KEY` available to the operator session; events queryable via `api.umami.is` |
