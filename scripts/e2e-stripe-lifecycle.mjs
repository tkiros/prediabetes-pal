#!/usr/bin/env node
/**
 * E2E-06 — Stripe TEST-MODE subscription lifecycle proof.
 *
 * Proves, against a throwaway local Postgres and Stripe test mode, with zero
 * real emails and zero production writes:
 *
 *   1. trial checkout    POST /api/trial/start → hosted Checkout → 4242 card
 *   2. webhook           real Stripe events relayed (signed) to /api/billing/stripe/webhook
 *   3. paid entitlement  GET /api/entitlement with a real magic-link session → premium/trialing
 *   4. pre-charge email  cron sweep writes the email via AUTH_EMAIL_STUB_DIR
 *   5. one-tap cancel    GET /api/billing/cancel?token=… flips cancel_at_period_end on Stripe
 *   6. portal            POST /api/billing/stripe/portal returns a live portal URL
 *   7. lapse             subscription deleted → row expired → entitlement free
 *
 * Usage:
 *   STRIPE_SECRET_KEY=sk_test_… node scripts/e2e-stripe-lifecycle.mjs
 *   (or put STRIPE_SECRET_KEY in .env.e2e — gitignored)
 *   node scripts/e2e-stripe-lifecycle.mjs --precheck   # verify prerequisites only
 *
 * Safety rails: refuses to run unless the key is test-mode (sk_test_ or
 * rk_test_); the DB is
 * a docker container created and destroyed by this script; emails go to disk.
 */

import { execSync, spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = 3100;
const BASE = `http://localhost:${PORT}`;
const PG_PORT = 55440;
const PG_CONTAINER = "pal-e2e-pg";
// 127.0.0.1 via --network host: docker bridge port-publishing proved unreliable
// on this machine (DNAT blackhole), host networking bypasses it entirely.
const DATABASE_URL = `postgres://postgres:e2e@127.0.0.1:${PG_PORT}/postgres`;
const STUB_DIR = path.join(ROOT, "artifacts", "qa", "e2e06-emails");
const EVIDENCE_DIR = path.join(ROOT, "artifacts", "qa");
const RUN_ID = new Date().toISOString().replace(/[:.]/g, "-");

// ── env assembly ─────────────────────────────────────────────────────────────

function readEnvFile(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=("?)(.*)\2$/);
    if (m && m[3]) out[m[1]] = m[3];
  }
  return out;
}

const fileEnv = { ...readEnvFile(path.join(ROOT, ".env")), ...readEnvFile(path.join(ROOT, ".env.e2e")) };
const STRIPE_KEY = process.env.STRIPE_SECRET_KEY ?? fileEnv.STRIPE_SECRET_KEY;

const evidence = { runId: RUN_ID, startedAt: new Date().toISOString(), steps: [] };
let failures = 0;

function record(step, ok, detail) {
  evidence.steps.push({ step, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${step} — ${typeof detail === "string" ? detail : JSON.stringify(detail)}`);
  if (!ok) failures += 1;
}

function die(msg) {
  console.error(`BLOCKED: ${msg}`);
  execSync(`docker rm -f ${PG_CONTAINER} 2>/dev/null || true`, { shell: "/bin/bash" });
  process.exit(2);
}

// ── prechecks ────────────────────────────────────────────────────────────────

if (!STRIPE_KEY) die("No STRIPE_SECRET_KEY. Put a TEST key in .env.e2e or the environment.");
if (!/^(sk|rk)_test_/.test(STRIPE_KEY)) die("STRIPE_SECRET_KEY is not a test-mode key (must start with sk_test_ or rk_test_). Refusing to run.");
try { execSync("docker info", { stdio: "ignore" }); } catch { die("docker is not available/running."); }

if (process.argv.includes("--precheck")) {
  console.log("PRECHECK OK: test-mode key present, docker running.");
  process.exit(0);
}

const { default: Stripe } = await import(path.join(ROOT, "node_modules", "stripe", "esm", "stripe.esm.node.js")).catch(() => import("stripe"));
const stripe = new Stripe(STRIPE_KEY);

// ── infra: postgres + schema + dev server ────────────────────────────────────

const AUTH_SECRET = randomBytes(32).toString("base64url");
const CRON_SECRET = randomBytes(16).toString("hex");
const WEBHOOK_SECRET = `whsec_${randomBytes(24).toString("hex")}`;

console.log("── infra: postgres, schema, prices, dev server");
execSync(`docker rm -f ${PG_CONTAINER} 2>/dev/null || true`, { shell: "/bin/bash" });
execSync(`docker run -d --rm --name ${PG_CONTAINER} --network host -e POSTGRES_PASSWORD=e2e postgres:16-alpine -c port=${PG_PORT} -c listen_addresses=127.0.0.1`, { stdio: "ignore" });

const { Pool } = await import("pg");
const pool = new Pool({ connectionString: DATABASE_URL, max: 2, connectionTimeoutMillis: 3000 });
for (let i = 0; ; i += 1) {
  try { await pool.query("select 1"); break; }
  catch (e) { if (i > 180) { die(`postgres never came up: ${e.message}`); } await new Promise((r) => setTimeout(r, 1000)); }
}

execSync(`npx drizzle-kit push --force`, {
  cwd: ROOT, stdio: "inherit", env: { ...process.env, DATABASE_URL }
});

// Test-mode prices: reuse env ids if provided AND resolvable in this account,
// else create a throwaway product + prices.
async function ensurePrice(envId, args, label) {
  if (envId) { try { await stripe.prices.retrieve(envId); return envId; } catch { /* fall through */ } }
  const product = await stripe.products.create({ name: `Prediabetes Pal E2E-06 ${label} (${RUN_ID})` });
  const price = await stripe.prices.create({ product: product.id, currency: "usd", ...args });
  return price.id;
}
const PRICE_MONTHLY = await ensurePrice(fileEnv.STRIPE_PRICE_MONTHLY_1299, { unit_amount: 1299, recurring: { interval: "month" } }, "monthly");
const PRICE_ANNUAL = await ensurePrice(fileEnv.STRIPE_PRICE_ANNUAL, { unit_amount: 9999, recurring: { interval: "year" } }, "annual");

fs.rmSync(STUB_DIR, { recursive: true, force: true });
fs.mkdirSync(STUB_DIR, { recursive: true });

const serverEnv = {
  ...process.env,
  NODE_ENV: "development",
  DATABASE_URL,
  AUTH_SECRET,
  CRON_SECRET,
  AUTH_EMAIL_STUB_DIR: STUB_DIR,
  STRIPE_SECRET_KEY: STRIPE_KEY,
  STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET,
  STRIPE_PRICE_MONTHLY_1299: PRICE_MONTHLY,
  STRIPE_PRICE_ANNUAL: PRICE_ANNUAL,
  TRIAL_PRICE_VARIANT: "1299",
  // paymentReturnUrlGate requires https (PR #11). Stripe accepts an https
  // return URL it never resolves; the harness itself always talks to the
  // server over plain-http BASE and re-origins any link before fetching it.
  NEXT_PUBLIC_APP_URL: "https://localhost:3100",
  HEALTH_DATA_KEY: Buffer.alloc(32, 7).toString("base64"),
  RESEND_API_KEY: "", // stub dir handles every email
  SENTRY_DSN: "",
  // next dev auto-loads the repo .env — blank the ambient Upstash store so
  // the email cooldown skips (dev semantics) instead of failing closed on a
  // store blip and 429ing the harness.
  UPSTASH_REDIS_REST_URL: "",
  UPSTASH_REDIS_REST_TOKEN: "",
  PAYWALL_MODE: "trial"
};

// Clear any orphaned server from a previous run, then start our own in its
// own process group so cleanup can kill npx AND the next-server child.
execSync(`fuser -k ${PORT}/tcp 2>/dev/null || true`, { shell: "/bin/bash" });
const server = spawn("npx", ["next", "dev", "-p", String(PORT)], { cwd: ROOT, env: serverEnv, stdio: ["ignore", "pipe", "pipe"], detached: true });
let serverLog = "";
server.stdout.on("data", (d) => { serverLog += d; });
server.stderr.on("data", (d) => { serverLog += d; });

async function waitFor(url, ms = 90_000) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    try { const r = await fetch(url); if (r.status < 500) return; } catch { /* retry */ }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`server never answered at ${url}\n${serverLog.slice(-2000)}`);
}

async function cleanup(code) {
  try { process.kill(-server.pid, "SIGTERM"); } catch { server.kill("SIGTERM"); }
  await pool.end().catch(() => {});
  execSync(`docker rm -f ${PG_CONTAINER} 2>/dev/null || true`, { shell: "/bin/bash" });
  evidence.finishedAt = new Date().toISOString();
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  const out = path.join(EVIDENCE_DIR, `e2e06-${RUN_ID}.json`);
  fs.writeFileSync(out, JSON.stringify(evidence, null, 2));
  console.log(`\nEvidence: ${out}`);
  console.log(failures === 0 ? "E2E-06: ALL STEPS PASSED" : `E2E-06: ${failures} step(s) FAILED`);
  process.exit(code ?? (failures === 0 ? 0 : 1));
}

process.on("SIGINT", () => cleanup(130));

// Dev-server fetches can transiently fail during cold Turbopack compiles —
// retry a few times before treating it as a real failure.
async function fetchRetry(url, init, attempts = 5) {
  for (let i = 0; ; i += 1) {
    try {
      return await fetch(url, init);
    } catch (error) {
      if (i >= attempts - 1) throw error;
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}

try {
  // Liveness, not readiness: /api/health deliberately 503s on a fresh DB
  // (cron heartbeats "never") until the first scheduler run, which this
  // harness never performs.
  await waitFor(`${BASE}/api/health/live`);

  // ── step 1: trial checkout ────────────────────────────────────────────────
  const buyer = `e2e06-${Date.now()}@pal-e2e.test`;
  let startRes;
  let startBody = {};
  for (let attempt = 0; attempt < 6; attempt += 1) {
    startRes = await fetchRetry(`${BASE}/api/trial/start`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      // termsAccepted/termsVersion: required by TrialStartSchema (paid entry
      // points always record terms acceptance) — keep in lockstep with
      // lib/legal/terms.ts TERMS_VERSION.
      body: JSON.stringify({ email: buyer, plan: "monthly", termsAccepted: true, termsVersion: "2026-07-12" })
    });
    const raw = await startRes.text();
    try {
      startBody = JSON.parse(raw);
      if (startBody.url) break;
    } catch {
      // HTML error page while the route is still compiling — retry.
    }
    // A 4xx is a real rejection, not a cold compile — retrying it just burns
    // the 3/hour per-IP abuse limit and turns the report into a 429.
    if (startRes.status >= 400 && startRes.status < 500) break;
    await new Promise((r) => setTimeout(r, 3000));
  }
  record("1a trial/start returns Checkout URL", startRes.status === 200 && /checkout\.stripe\.com/.test(startBody.url ?? ""), { status: startRes.status, url: startBody.url?.slice(0, 60) });

  const { chromium } = await import("playwright");
  const browser = await chromium.launch();
  const page = await browser.newPage();
  try {
    // Docker's host-network setup/teardown can flap Chromium's interface
    // watcher (ERR_NETWORK_CHANGED) — a plain retry rides it out.
    for (let nav = 0; ; nav += 1) {
      try {
        await page.goto(startBody.url, { waitUntil: "domcontentloaded" });
        break;
      } catch (navError) {
        if (nav >= 2) throw navError;
        await page.waitForTimeout(3000);
      }
    }

    // Checkout renders a payment-method accordion (card / cashapp / link);
    // the card form mounts only after the card radio is selected, and its
    // fields may live in a child iframe — search every frame.
    // Checkout renders a skeleton first on a slow network — wait for the real
    // payment UI before touching anything.
    await page.waitForSelector("#payment-method-accordion-item-title-card, #cardNumber", { timeout: 90_000 }).catch(() => {});
    const cardRadio = page.locator("#payment-method-accordion-item-title-card");
    const cardFieldVisible = async () => {
      for (const frame of page.frames()) {
        const el = await frame.$("#cardNumber").catch(() => null);
        if (el && (await el.isVisible().catch(() => false))) return true;
      }
      return false;
    };
    // The accordion mounts the card form on selection; no single click target
    // is reliable across Checkout revisions — keep clicking until it mounts.
    for (let sel = 0; sel < 12 && !(await cardFieldVisible()); sel += 1) {
      if (await cardRadio.count()) {
        await cardRadio.first().click({ force: true }).catch(() => {});
        await page.getByText("Card", { exact: true }).first().click().catch(() => {});
      }
      // A mid-load interface flap (docker veth churn → ERR_NETWORK_CHANGED)
      // kills Checkout's in-flight requests and strands the skeleton UI — a
      // reload recovers it.
      if (sel === 3 || sel === 7) {
        await page.reload({ waitUntil: "domcontentloaded" }).catch(() => {});
        await page.waitForSelector("#payment-method-accordion-item-title-card, #cardNumber", { timeout: 30_000 }).catch(() => {});
      }
      await page.waitForTimeout(3000);
    }

    async function fillInAnyFrame(selector, value, { required = true } = {}) {
      const until = Date.now() + 60_000;
      while (Date.now() < until) {
        for (const frame of page.frames()) {
          const el = await frame.$(selector).catch(() => null);
          if (el && (await el.isVisible().catch(() => false))) {
            if (value === null) { await el.click(); } else { await el.fill(value); }
            return true;
          }
        }
        await page.waitForTimeout(500);
      }
      if (required) throw new Error(`no visible ${selector} in any frame`);
      return false;
    }

    await fillInAnyFrame("#cardNumber", "4242424242424242");
    await fillInAnyFrame("#cardExpiry", "12/34");
    await fillInAnyFrame("#cardCvc", "123");
    await fillInAnyFrame("#billingName", "E2E Zero Six");
    await fillInAnyFrame("#billingPostalCode", "94103", { required: false });
    await fillInAnyFrame(".SubmitButton", null);
    // The success redirect goes to the https NEXT_PUBLIC_APP_URL, which no
    // local listener serves — prove payment on Stripe's side instead.
    const sessionId = startBody.url.match(/cs_(?:test|live)_[A-Za-z0-9]+/)?.[0];
    let session = null;
    for (let i = 0; i < 30 && session?.status !== "complete"; i += 1) {
      await page.waitForTimeout(2000);
      session = await stripe.checkout.sessions.retrieve(sessionId).catch(() => null);
      // A first click can land while the button is still validating — poke it
      // again while the session is open.
      if (i % 5 === 4 && session?.status === "open") {
        await fillInAnyFrame(".SubmitButton", null, { required: false });
      }
    }
    if (session?.status !== "complete") {
      throw new Error(`checkout session stayed ${session?.status ?? "unknown"}`);
    }
    record("1b hosted Checkout completed with 4242 test card", true, { sessionStatus: session.status });
  } catch (checkoutError) {
    const shot = path.join(EVIDENCE_DIR, `e2e06-${RUN_ID}-checkout.png`);
    fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
    await page.screenshot({ path: shot, fullPage: true }).catch(() => {});
    const inputs = await page
      .$$eval("input, button[type=submit]", (els) =>
        els.map((el) => `${el.tagName}#${el.id}[name=${el.getAttribute("name")}]`).slice(0, 30)
      )
      .catch(() => []);
    record("1b hosted Checkout completed with 4242 test card", false, {
      error: checkoutError.message.slice(0, 200),
      screenshot: shot,
      visibleFields: inputs
    });
    throw checkoutError;
  } finally {
    await browser.close();
  }

  // ── step 2: relay REAL Stripe events to the local webhook ────────────────
  const relayed = new Set();
  async function relayEvents(types) {
    const found = [];
    for (let attempt = 0; attempt < 20 && found.length < types.length; attempt += 1) {
      const events = await stripe.events.list({ limit: 50 });
      for (const event of events.data.reverse()) {
        if (!types.includes(event.type) || relayed.has(event.id)) continue;
        const payload = JSON.stringify(event);
        const signature = stripe.webhooks.generateTestHeaderString({ payload, secret: WEBHOOK_SECRET });
        const res = await fetchRetry(`${BASE}/api/billing/stripe/webhook`, {
          method: "POST",
          headers: { "stripe-signature": signature },
          body: payload
        });
        relayed.add(event.id);
        found.push({ type: event.type, status: res.status });
      }
      if (found.length < types.length) await new Promise((r) => setTimeout(r, 2000));
    }
    return found;
  }

  const checkoutEvents = await relayEvents(["checkout.session.completed"]);
  record("2 signed webhook accepted for checkout.session.completed", checkoutEvents.some((e) => e.status === 200), checkoutEvents);

  const { rows: subRows } = await pool.query("select id, status, provider, provider_ref, price_variant from subscriptions");
  record("2b subscriptions row upserted as trialing", subRows.length === 1 && subRows[0].status === "trialing" && subRows[0].provider === "stripe", subRows[0]);
  const subRow = subRows[0];

  // ── step 3: magic-link session → paid entitlement over the API ──────────
  const stubFiles = () => fs.readdirSync(STUB_DIR).map((f) => JSON.parse(fs.readFileSync(path.join(STUB_DIR, f), "utf8")));
  const magic = stubFiles().find((m) => m.url);
  let cookie = "";
  if (magic) {
    const cbRes = await fetchRetry(magic.url.replace(/^https?:\/\/[^/]+/, BASE), { redirect: "manual" });
    const setCookies = cbRes.headers.getSetCookie?.() ?? [];
    cookie = setCookies.map((c) => c.split(";")[0]).filter((c) => c.includes("session-token")).join("; ");
  }
  record("3a magic-link sign-in produced a DB session cookie", cookie.includes("session-token"), cookie ? "authjs.session-token set" : "no cookie — magic link stub missing");

  const entRes = await fetchRetry(`${BASE}/api/entitlement`, { headers: { cookie } });
  const ent = await entRes.json();
  record("3b GET /api/entitlement shows paid entitlement", ent.tier === "premium" && ent.status === "trialing", ent);

  // ── step 4: pre-charge email via the real cron route ─────────────────────
  // Harness note: the real trial ends in 7 days; pull the period end into the
  // sweep's 48h window on the LOCAL db only. Stripe's subscription is untouched.
  await pool.query("update subscriptions set current_period_end = now() + interval '40 hours'");
  const sweepRes = await fetchRetry(`${BASE}/api/cron/trial-precharge`, { headers: { authorization: `Bearer ${CRON_SECRET}` } });
  const sweep = await sweepRes.json();
  const precharge = stubFiles().find((m) =>
    /\/api\/billing\/cancel\?token=/.test(m.text ?? "")
  );
  const cancelLink = precharge?.text?.match(/https?:\/\/\S*\/api\/billing\/cancel\?token=\S+/)?.[0];
  record("4 pre-charge email written (amount, date, cancel link)", sweepRes.status === 200 && sweep.sent === 1 && !!cancelLink, { sweep, subject: precharge?.subject, hasCancelLink: !!cancelLink });
  const { rows: stamped } = await pool.query("select pre_charge_email_sent_at from subscriptions where id = $1", [subRow.id]);
  record("4b pre_charge_email_sent_at stamped (idempotent resend guard)", !!stamped[0]?.pre_charge_email_sent_at, stamped[0]);

  // ── step 5: cancel from the email link (signed out) ───────────────────────
  // Two-step by design: GET 303s to the confirm page (so link prefetchers
  // can't silently cancel); the confirm page's POST performs the cancel.
  const cancelRes = await fetchRetry(cancelLink.replace(/^https?:\/\/[^/]+/, BASE), { redirect: "manual" });
  const confirmToken = new URL(cancelRes.headers.get("location") ?? "", BASE).searchParams.get("token");
  const confirmRes = await fetchRetry(`${BASE}/api/billing/cancel`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token: confirmToken })
  });
  const stripeSub = await stripe.subscriptions.retrieve(subRow.provider_ref);
  record("5 email-link cancel (GET confirm 303 + POST) flips cancel_at_period_end on Stripe", cancelRes.status === 303 && confirmRes.status < 300 && stripeSub.cancel_at_period_end === true, { redirect: cancelRes.headers.get("location"), confirmStatus: confirmRes.status, cancel_at_period_end: stripeSub.cancel_at_period_end });

  const updEvents = await relayEvents(["customer.subscription.updated"]);
  const { rows: afterCancel } = await pool.query("select status from subscriptions where id = $1", [subRow.id]);
  record("5b after cancel webhook the row stays entitled (trialing until period end)", afterCancel[0]?.status === "trialing", { relayed: updEvents.length, status: afterCancel[0]?.status });

  // ── step 6: billing portal ────────────────────────────────────────────────
  const portalConfigs = await stripe.billingPortal.configurations.list({ limit: 1 });
  if (portalConfigs.data.length === 0) {
    await stripe.billingPortal.configurations.create({
      business_profile: { headline: "Prediabetes Pal test portal" },
      features: { subscription_cancel: { enabled: true }, invoice_history: { enabled: true } },
      default_return_url: `${BASE}/account`
    });
  }
  const portalRes = await fetchRetry(`${BASE}/api/billing/stripe/portal`, { method: "POST", headers: { cookie } });
  const portal = await portalRes.json();
  record("6 portal session created for the subscriber", portalRes.status === 200 && /billing\.stripe\.com/.test(portal.url ?? ""), { status: portalRes.status, url: portal.url?.slice(0, 60) });

  // ── step 7: full lapse — delete on Stripe, relay, entitlement drops ──────
  await stripe.subscriptions.cancel(subRow.provider_ref);
  const delEvents = await relayEvents(["customer.subscription.deleted"]);
  const { rows: lapsed } = await pool.query("select status from subscriptions where id = $1", [subRow.id]);
  const entAfter = await (await fetchRetry(`${BASE}/api/entitlement`, { headers: { cookie } })).json();
  record("7 deleted subscription lapses the entitlement", delEvents.some((e) => e.status === 200) && lapsed[0]?.status === "expired" && entAfter.tier === "free", { rowStatus: lapsed[0]?.status, entitlement: entAfter });
} catch (error) {
  record("harness", false, `${error.message}\n${serverLog.slice(-1500)}`);
} finally {
  await cleanup();
}
