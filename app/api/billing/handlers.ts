import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { z } from "zod";

import {
  getEntitlement,
  countChecksToday,
  FREE_DAILY_CHECKS
} from "../../../lib/server/entitlement";
import { capabilitiesFor } from "../../../lib/server/capabilities";
import { fetchPlaySubscription } from "../../../lib/server/play-api";
import { getDb, schema, type Db } from "../../../lib/server/db";
import {
  getSessionInfo,
  type SessionInfo
} from "../../../lib/server/session";
import { generateClaimToken } from "../../../lib/server/pantry/claims";
import { intakeEmailText } from "../../../lib/server/pantry/emails";
import {
  resolveAnnualPrice,
  resolvePriceVariant
} from "../../../lib/server/pricing";
import { resolvePantryPrice } from "../../../lib/server/pantry-price";
import {
  sendEmail,
  type SendEmailInput,
  type SendEmailResult
} from "../../../lib/server/email";
import {
  emitBillingEvent,
  type BillingTelemetryEvent,
  type LatencyBucket
} from "../../../lib/server/billing/telemetry";
import { ingestStripeEvent } from "../../../lib/server/billing/inbox";
import { fetchStripeSubscription } from "../../../lib/server/stripe-api";
import { verifyCancelToken } from "../../../lib/server/billing/cancel-token";
import { paymentFailedEmailText } from "../../../lib/server/billing/emails";
import { deleteOrderBlobs } from "../../../lib/server/blob";
import { timingSafeEqualSecret } from "../../../lib/server/timing-safe";
import { checkEmailCooldown } from "../../../lib/pal/rate-limit";
import { TERMS_VERSION } from "../../../lib/legal/terms";
import { playBillingEnabled } from "../../../lib/play-billing-flag";

/**
 * Billing (plan 4D / docs/adr/billing.md): Play Billing verified server-side
 * against the Play Developer API; Stripe web fallback; one `subscriptions`
 * table; entitlement read separately (lib/server/entitlement.ts).
 */

export type BillingDeps = {
  db?: () => Db;
  getSession?: () => Promise<SessionInfo>;
  playLookup?: typeof fetchPlaySubscription;
  stripeClient?: () => Stripe;
  now?: () => Date;
  email?: PantryEmailSender;
  env?: NodeJS.ProcessEnv;
};

export type PantryEmailSender = {
  send: (input: SendEmailInput) => Promise<SendEmailResult>;
};

/**
 * An email the reducer wants sent as a side effect of applying an event. B4:
 * emails must NEVER be sent inside the durable-inbox transaction — a commit
 * failure would leave the email sent while the DB rolled back (duplicate
 * dunning, an orphaned claim token referencing no committed row). So the reducer
 * COLLECTS its emails and the inbox dispatches them AFTER the transaction
 * commits (lib/server/billing/inbox.processInboxRow). `onSent` runs once, after
 * a successful send, to record that durably (the pantry intake stamp).
 *
 * A DIRECT caller that passes an `email` sender (the pantry/dunning unit tests)
 * still gets the legacy inline send — only the inbox path, which passes NO
 * sender, defers. Production reaches this reducer solely through the inbox, so
 * production always defers.
 */
export type PendingEmail = SendEmailInput & {
  onSent?: (db: Db, sentAt: Date) => Promise<void>;
};

/**
 * Either send `msg` now (legacy inline path, when a sender was passed) or defer
 * it by pushing onto `pending` for the inbox to dispatch after commit.
 */
async function emitEmail(
  db: Db,
  pending: PendingEmail[],
  email: PantryEmailSender | undefined,
  now: Date,
  msg: PendingEmail
): Promise<void> {
  if (!email) {
    pending.push(msg);
    return;
  }
  const result = await email.send({
    to: msg.to,
    subject: msg.subject,
    text: msg.text,
    category: msg.category,
    idempotencyKey: msg.idempotencyKey
  });
  if (result.ok && msg.onSent) {
    await msg.onSent(db, now);
  }
}

const PlayVerifySchema = z
  .object({
    purchaseToken: z.string().trim().min(1).max(512),
    termsAccepted: z.literal(true),
    termsVersion: z.literal(TERMS_VERSION)
  })
  .strict();

function unauthorized() {
  return NextResponse.json({ error: "Sign in first." }, { status: 401 });
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

let stripeSingleton: Stripe | null = null;
function defaultStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not set.");
  }
  stripeSingleton ??= new Stripe(key);
  return stripeSingleton;
}

/**
 * W-04 — the paid-launch gate. Checkout is OPEN by default as of the WTP
 * decision (2026-07-17, owner): counsel sign-off is deferred until the WTP
 * test returns, and /terms renders free of placeholders (asserted by
 * tests/smoke/legal-placeholders.spec.ts), so the deployed contract text is
 * real even though no lawyer has passed on it.
 *
 * ponytail: kept as a kill switch rather than deleted — LEGAL_TERMS_FINAL=0
 * closes every paid entry point again without a deploy. This path takes real
 * money; a one-line off switch is worth more than the lines it costs.
 *
 * A separately validated HTTPS return URL is still required before Stripe can
 * create a customer session.
 *
 * Deliberately NOT applied to the portal or the cancel paths — an existing
 * subscriber must ALWAYS be able to manage and leave, terms or no terms.
 */
function checkoutGate(env: NodeJS.ProcessEnv = process.env): NextResponse | null {
  if (env.LEGAL_TERMS_FINAL !== "0") {
    return null;
  }
  return NextResponse.json(
    { error: "Checkout is temporarily unavailable. Please try again soon." },
    { status: 503 }
  );
}

function paymentReturnUrl(env: NodeJS.ProcessEnv): string | null {
  const configured = env.NEXT_PUBLIC_APP_URL?.trim();
  if (!configured) {
    return null;
  }

  try {
    const url = new URL(configured);
    return url.protocol === "https:" ? url.origin : null;
  } catch {
    return null;
  }
}

function paymentReturnUrlGate(env: NodeJS.ProcessEnv): NextResponse | null {
  if (paymentReturnUrl(env)) {
    return null;
  }
  return NextResponse.json(
    { error: "Billing is not configured." },
    { status: 503 }
  );
}

// ── GET /api/entitlement ────────────────────────────────────────────────────

const LATENCY_BUCKETS: readonly LatencyBucket[] = [
  "under_60s",
  "under_5m",
  "under_1h",
  "over_1h"
];

export function createEntitlementHandler(deps: BillingDeps = {}) {
  const db = deps.db ?? getDb;
  const getSession = deps.getSession ?? getSessionInfo;
  const playLookup = deps.playLookup ?? fetchPlaySubscription;
  const stripe = deps.stripeClient ?? defaultStripe;
  const now = deps.now ?? (() => new Date());

  return async function GET(request?: Request) {
    const session = await getSession();
    if (!session) {
      return unauthorized();
    }

    // Checkout-return truth signal (§10.1). The "access is syncing" surface
    // tags its polls (?heal=pending while still free, ?heal=recovered on the
    // flip to premium) so the pending→recovered transition is logged
    // server-side without a separate endpoint. Bounded enums only — anything
    // else is ignored, and only a signed-in caller can emit.
    if (request) {
      const params = new URL(request.url).searchParams;
      const heal = params.get("heal");
      if (heal === "pending" || heal === "recovered") {
        const waited = params.get("waited");
        const latency = LATENCY_BUCKETS.includes(waited as LatencyBucket)
          ? (waited as LatencyBucket)
          : undefined;
        emitBillingEvent({
          name:
            heal === "pending"
              ? "entitlement_pending"
              : "entitlement_recovered",
          provider: "stripe",
          ...(latency ? { latency } : {})
        });
      }
    }

    const entitlement = await getEntitlement(db(), session.userId, {
      now,
      refreshPlaySubscription: (token) => playLookup(token),
      refreshStripeSubscription: (subscriptionId, fallbackPeriodEnd) =>
        fetchStripeSubscription(stripe(), subscriptionId, fallbackPeriodEnd)
    });

    const [profile] = await db()
      .select({ timezone: schema.profiles.timezone })
      .from(schema.profiles)
      .where(eq(schema.profiles.userId, session.userId));

    const checksToday = await countChecksToday(
      db(),
      session.userId,
      profile?.timezone ?? "America/New_York",
      now()
    );

    return NextResponse.json({
      ...entitlement,
      checksToday,
      freeDailyLimit: FREE_DAILY_CHECKS,
      // Additive (T10): the UI renders paid state from this server matrix rather
      // than re-deriving the free/premium split client-side.
      capabilities: capabilitiesFor(entitlement)
    });
  };
}

// ── POST /api/billing/play/verify ───────────────────────────────────────────

export function createPlayVerifyHandler(deps: BillingDeps = {}) {
  const db = deps.db ?? getDb;
  const getSession = deps.getSession ?? getSessionInfo;
  const playLookup = deps.playLookup ?? fetchPlaySubscription;
  const now = deps.now ?? (() => new Date());
  const env = deps.env ?? process.env;

  return async function POST(request: Request) {
    if (!playBillingEnabled({ NEXT_PUBLIC_PLAY_BILLING: env.NEXT_PUBLIC_PLAY_BILLING })) {
      return NextResponse.json({ error: "Google Play billing is not available." }, { status: 503 });
    }
    const session = await getSession();
    if (!session) {
      return unauthorized();
    }

    const parsed = PlayVerifySchema.safeParse(await readJson(request));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    let info;
    try {
      // Server-side receipt verification — the client's word is never enough.
      info = await playLookup(parsed.data.purchaseToken);
    } catch {
      return NextResponse.json(
        { error: "Could not verify the purchase with Google Play." },
        { status: 502 }
      );
    }

    await db()
      .insert(schema.subscriptions)
      .values({
        userId: session.userId,
        provider: "play",
        providerRef: parsed.data.purchaseToken,
        productId: info.productId ?? "premium_monthly",
        status: info.status,
        termsVersion: parsed.data.termsVersion,
        termsAcceptedAt: now(),
        currentPeriodEnd: info.currentPeriodEnd,
        updatedAt: now()
      })
      .onConflictDoUpdate({
        target: schema.subscriptions.providerRef,
        set: {
          status: info.status,
          termsVersion: parsed.data.termsVersion,
          termsAcceptedAt: now(),
          currentPeriodEnd: info.currentPeriodEnd,
          updatedAt: now()
        }
      });

    const entitlement = await getEntitlement(db(), session.userId, { now });
    return NextResponse.json(entitlement);
  };
}

// ── POST /api/billing/play/rtdn (Pub/Sub push) ─────────────────────────────

export function createPlayRtdnHandler(deps: BillingDeps = {}) {
  const db = deps.db ?? getDb;
  const playLookup = deps.playLookup ?? fetchPlaySubscription;
  const now = deps.now ?? (() => new Date());

  return async function POST(request: Request) {
    const url = new URL(request.url);
    // Constant-time (N-29): a plain !== on the shared token leaks its length and
    // matching prefix through response timing, and this door is unauthenticated.
    if (
      !timingSafeEqualSecret(
        url.searchParams.get("token"),
        process.env.RTDN_SHARED_TOKEN
      )
    ) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const body = (await readJson(request)) as {
      message?: { data?: string };
    } | null;

    const purchaseToken = extractPurchaseToken(body);
    if (!purchaseToken) {
      // Always ack malformed/test notifications — Pub/Sub retries otherwise.
      return NextResponse.json({ ok: true, ignored: true });
    }

    // Only update subscriptions we know (the verify call creates the row and
    // binds it to a user — RTDN alone cannot attribute a purchase).
    const [existing] = await db()
      .select({ id: schema.subscriptions.id })
      .from(schema.subscriptions)
      .where(eq(schema.subscriptions.providerRef, purchaseToken));

    if (!existing) {
      return NextResponse.json({ ok: true, ignored: true });
    }

    try {
      const info = await playLookup(purchaseToken);
      // BC-4: two RTDNs for the same purchase (renewal + refund) can race.
      // Lock the row, re-read status under the lock, and hold the same
      // guards as the Stripe reducer: refunded/expired are terminal, and the
      // paid-through date never moves backwards — EXCEPT when Play itself
      // reports a revocation (refund/expiry), which must always land.
      await db().transaction(async (tx) => {
        const [row] = await tx
          .select()
          .from(schema.subscriptions)
          .where(eq(schema.subscriptions.id, existing.id))
          .for("update");
        if (!row || row.status === "refunded" || row.status === "expired") {
          return;
        }
        const isRevocation =
          info.status === "refunded" || info.status === "expired";
        if (!isRevocation && info.currentPeriodEnd < row.currentPeriodEnd) {
          return; // stale lookup ordered behind a newer renewal
        }
        await tx
          .update(schema.subscriptions)
          .set({
            status: info.status,
            currentPeriodEnd: info.currentPeriodEnd,
            updatedAt: now()
          })
          .where(eq(schema.subscriptions.id, row.id));
      });
    } catch {
      // Lookup failure: nack via 500 so Pub/Sub retries with backoff.
      return NextResponse.json({ error: "retry" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  };
}

function extractPurchaseToken(
  body: { message?: { data?: string } } | null
): string | null {
  try {
    const decoded = JSON.parse(
      Buffer.from(body?.message?.data ?? "", "base64").toString("utf8")
    ) as {
      subscriptionNotification?: { purchaseToken?: string };
      voidedPurchaseNotification?: { purchaseToken?: string };
    };
    return (
      decoded.subscriptionNotification?.purchaseToken ??
      decoded.voidedPurchaseNotification?.purchaseToken ??
      null
    );
  } catch {
    return null;
  }
}

// ── POST /api/billing/stripe/checkout ───────────────────────────────────────

const CheckoutSchema = z
  .object({
    plan: z.enum(["monthly", "annual"]),
    termsAccepted: z.literal(true),
    termsVersion: z.literal(TERMS_VERSION)
  })
  .strict();

export function createStripeCheckoutHandler(deps: BillingDeps = {}) {
  const getSession = deps.getSession ?? getSessionInfo;
  const stripe = deps.stripeClient ?? defaultStripe;
  const env = deps.env ?? process.env;

  return async function POST(request: Request) {
    const blocked = checkoutGate(env);
    if (blocked) {
      return blocked;
    }
    const session = await getSession();
    if (!session) {
      return unauthorized();
    }

    const parsed = CheckoutSchema.safeParse(await readJson(request));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }
    const invalidReturnUrl = paymentReturnUrlGate(env);
    if (invalidReturnUrl) {
      return invalidReturnUrl;
    }

    // W-20 — the legacy (PAYWALL_MODE=legacy) rollback path used to read its own
    // STRIPE_PRICE_MONTHLY env var, a DIFFERENT variable from the trial funnel's
    // variant ladder. That silently unenforced the one invariant pricing.ts
    // exists to hold — "the wall can never show a price checkout won't charge" —
    // precisely on the path we'd be running during an incident. Both plans now
    // derive from the same resolvers as every other surface.
    const price =
      parsed.data.plan === "monthly"
        ? resolvePriceVariant(env).priceId
        : resolveAnnualPrice(env).priceId;
    const appUrl = paymentReturnUrl(env)!;

    if (!price) {
      return NextResponse.json(
        { error: "Billing is not configured." },
        { status: 503 }
      );
    }

    const checkout = await stripe().checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price, quantity: 1 }],
      client_reference_id: session.userId,
      customer_email: session.email,
      metadata: { terms_version: parsed.data.termsVersion },
      subscription_data: {
        metadata: { terms_version: parsed.data.termsVersion }
      },
      // BC-3: the {CHECKOUT_SESSION_ID} template lets the return page run a
      // server-side retrieve+upsert, so entitlement flips even if the webhook
      // is unregistered or delayed.
      success_url: `${appUrl}/account?subscribed=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/subscribe`
    });

    return NextResponse.json({ url: checkout.url });
  };
}

// ── POST /api/billing/stripe/pantry-checkout ────────────────────────────────

const PantryCheckoutSchema = z
  .object({
    termsAccepted: z.literal(true),
    termsVersion: z.literal(TERMS_VERSION)
  })
  .strict();

export function createPantryCheckoutSessionHandler(deps: BillingDeps = {}) {
  const stripe = deps.stripeClient ?? defaultStripe;
  const env = deps.env ?? process.env;

  return async function POST(request: Request) {
    const blocked = checkoutGate(env);
    if (blocked) {
      return blocked;
    }
    const invalidReturnUrl = paymentReturnUrlGate(env);
    if (invalidReturnUrl) {
      return invalidReturnUrl;
    }

    const parsed = PantryCheckoutSchema.safeParse(await readJson(request));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Accept the Terms and Privacy Notice before checkout." },
        { status: 400 }
      );
    }

    // AUD-010: charge the SAME verified Price object the landing displays —
    // resolvePantryPrice fails closed (null) unless the configured Price is an
    // active one-time USD amount, so display and charge share one authority.
    const verifiedPrice = await resolvePantryPrice({
      stripeClient: stripe,
      env
    });
    const appUrl = paymentReturnUrl(env)!;
    if (!verifiedPrice) {
      return NextResponse.json({ error: "The Pantry Review is not available right now." }, { status: 503 });
    }
    // No session gate: buyers may be anonymous. Checkout collects the email;
    // order binding stays possession-of-claim-token, exactly like the
    // Payment Link path (applyPantryCheckout is reused byte-identically).
    const checkout = await stripe().checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: verifiedPrice.priceId, quantity: 1 }],
      metadata: { terms_version: parsed.data.termsVersion },
      success_url: `${appUrl}/pantry/thanks`,
      cancel_url: `${appUrl}/pantry`
    });
    return NextResponse.json({ url: checkout.url });
  };
}

// ── POST /api/billing/stripe/portal ─────────────────────────────────────────

export function createStripePortalHandler(deps: BillingDeps = {}) {
  const db = deps.db ?? getDb;
  const getSession = deps.getSession ?? getSessionInfo;
  const stripe = deps.stripeClient ?? defaultStripe;

  return async function POST() {
    const session = await getSession();
    if (!session) {
      return unauthorized();
    }

    // W-20 — filter on provider, exactly as the cancel path below does. Without
    // it a user who has BOTH a Play row and a Stripe row gets whichever row the
    // planner happens to return first (there is no ORDER BY), so a legitimate
    // Stripe subscriber intermittently gets a 404 from their own manage button.
    const [row] = await db()
      .select()
      .from(schema.subscriptions)
      .where(
        and(
          eq(schema.subscriptions.userId, session.userId),
          eq(schema.subscriptions.provider, "stripe")
        )
      );

    if (!row) {
      return NextResponse.json(
        { error: "No Stripe subscription to manage." },
        { status: 404 }
      );
    }

    const subscription = await stripe().subscriptions.retrieve(
      row.providerRef
    );
    const customerId =
      typeof subscription.customer === "string"
        ? subscription.customer
        : subscription.customer.id;

    const portal = await stripe().billingPortal.sessions.create({
      customer: customerId,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/account`
    });

    return NextResponse.json({ url: portal.url });
  };
}

// ── /api/billing/cancel (email-token GET + account POST) ────────────────────

// Statuses whose subscription is still entitled and therefore cancelable at
// period end. A cancel on a lapsed row is a no-op (nothing to stop).
const CANCELABLE = new Set(["trialing", "active", "grace"]);

/**
 * One-tap cancel (docs/adr/billing.md, anti-Klinio). The signed-out email
 * link's trust anchor is the verified token, never a session; the account-page
 * button is session-gated. Both flip `cancel_at_period_end` on Stripe so
 * entitlement runs out the paid period, and both are idempotent (a second
 * click re-runs the same harmless update).
 *
 * BC-1/SA-8: GET must NEVER mutate. Mail scanners (Proofpoint, Defender
 * safe-links) issue the GET at delivery time, which silently canceled a trial
 * before the human ever read the email. GET now only verifies the token and
 * redirects to a confirm page; the mutation lives exclusively in POST, which
 * accepts the same token in the body (scanners do not submit forms).
 */
export function createCancelHandlers(deps: BillingDeps = {}) {
  const db = deps.db ?? getDb;
  const getSession = deps.getSession ?? getSessionInfo;
  const stripe = deps.stripeClient ?? defaultStripe;
  const now = deps.now ?? (() => new Date());

  async function cancelRow(row: typeof schema.subscriptions.$inferSelect) {
    await stripe().subscriptions.update(row.providerRef, {
      cancel_at_period_end: true
    });
    // BC-2: persist immediately so a page reload shows "will not renew"
    // without waiting for the customer.subscription.updated webhook.
    await db()
      .update(schema.subscriptions)
      .set({ cancelAtPeriodEnd: true, updatedAt: now() })
      .where(eq(schema.subscriptions.id, row.id));
    if (row.status === "trialing") {
      emitBillingEvent({
        name: "trial_canceled",
        priceVariant:
          (row.priceVariant as BillingTelemetryEvent["priceVariant"]) ??
          undefined
      });
    }
  }

  // GET /api/billing/cancel?token=… — from the pre-charge email, works
  // signed-out. Verify-and-redirect ONLY; no side effects. Never dedupe or log
  // by the raw token (it is suffix-malleable); the verify result is the only
  // trust anchor.
  async function GET(request: Request): Promise<NextResponse> {
    const url = new URL(request.url);
    const token = url.searchParams.get("token") ?? "";

    if (!verifyCancelToken(token)) {
      return NextResponse.redirect(new URL("/canceled?invalid=1", url), 303);
    }

    const confirm = new URL("/canceled/confirm", url);
    confirm.searchParams.set("token", token);
    return NextResponse.redirect(confirm, 303);
  }

  // POST /api/billing/cancel — the account-page one-tap button (session), or
  // the email-link confirm page (body token). Cancels one Stripe row only.
  async function POST(request?: Request): Promise<NextResponse> {
    const body = request
      ? ((await readJson(request)) as { token?: unknown } | null)
      : null;
    const token = typeof body?.token === "string" ? body.token : null;

    if (token) {
      const verified = verifyCancelToken(token);
      if (!verified) {
        return NextResponse.json(
          { error: "This cancel link has expired." },
          { status: 400 }
        );
      }
      const [row] = await db()
        .select()
        .from(schema.subscriptions)
        .where(eq(schema.subscriptions.id, verified.subRowId));

      if (row && row.provider === "stripe" && CANCELABLE.has(row.status)) {
        await cancelRow(row);
      }
      // Idempotent + non-oracular: a lapsed or already-canceled row confirms
      // the same way — the caller holds a valid token either way.
      return NextResponse.json({ ok: true });
    }

    const session = await getSession();
    if (!session) {
      return unauthorized();
    }

    const [row] = await db()
      .select()
      .from(schema.subscriptions)
      .where(
        and(
          eq(schema.subscriptions.userId, session.userId),
          eq(schema.subscriptions.provider, "stripe")
        )
      );

    if (!row || row.provider !== "stripe") {
      return NextResponse.json(
        { error: "No Stripe subscription to cancel." },
        { status: 404 }
      );
    }

    await cancelRow(row);

    return NextResponse.json({ ok: true, accessUntil: row.currentPeriodEnd });
  }

  return { GET, POST };
}

// ── POST /api/billing/stripe/webhook ────────────────────────────────────────

// How long a declined card keeps premium after the FIRST failed charge (W-18).
// Long enough to genuinely fix a card (expired, bank hold), far short of the
// ~3 weeks Stripe's dunning would otherwise hand out for free.
const DUNNING_GRACE_MS = 3 * 24 * 60 * 60 * 1000;

export function createStripeWebhookHandler(deps: BillingDeps = {}) {
  const db = deps.db ?? getDb;
  const stripe = deps.stripeClient ?? defaultStripe;
  const now = deps.now ?? (() => new Date());
  const email = deps.email ?? { send: sendEmail };

  return async function POST(request: Request) {
    const payload = await request.text();
    const signature = request.headers.get("stripe-signature") ?? "";

    // Fail CLOSED on a missing secret, mirroring the Resend webhook. An empty
    // secret is not "no verification": stripe-node would HMAC under the empty
    // (public) key, so any caller could forge a passing signature and mint or
    // revoke entitlements. 503 keeps Stripe retrying until config is fixed.
    const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
    if (!secret) {
      return NextResponse.json(
        { error: "Webhook is not configured." },
        { status: 503 }
      );
    }

    let event: Stripe.Event;
    try {
      event = await stripe().webhooks.constructEventAsync(
        payload,
        signature,
        secret
      );
    } catch {
      return NextResponse.json({ error: "Bad signature." }, { status: 400 });
    }

    // Durable inbox (Task 8 / P2.2): store-then-process. The outcome picks the
    // HTTP status so Stripe's retry machinery does the right thing.
    //   duplicate / processed / dead_letter → 200 ack (redelivery won't help)
    //   failed (attempts remain)            → 500 so Stripe redelivers
    // A failed row is also retried by the reconciliation sweep, so the money
    // path recovers even if Stripe stops redelivering.
    const outcome = await ingestStripeEvent(db(), event, {
      now,
      stripe,
      email
    });

    if (outcome === "failed") {
      return NextResponse.json({ error: "retry" }, { status: 500 });
    }
    return NextResponse.json({ received: true, outcome });
  };
}

// ── POST /api/billing/stripe/sync ───────────────────────────────────────────

const SyncSchema = z
  .object({ sessionId: z.string().trim().min(1).max(255) })
  .strict();

/**
 * BC-3 defense-in-depth: without a registered live webhook, a first real
 * purchase never creates a `subscriptions` row, so NO local path (entitlement
 * read, self-heal, reconcile — all iterate existing rows) can ever flip
 * premium, and the one-trial-ever gate never trips. The success-URL return
 * carries {CHECKOUT_SESSION_ID}; this endpoint retrieves the session from
 * Stripe (the caller's word is never enough — the session id is only a lookup
 * key) and runs it through the same idempotent reducer the webhook uses.
 *
 * Unauthenticated by design: the buyer may not be signed in yet (trial flow —
 * the magic link is still in their inbox). All state written comes from
 * Stripe's API, and the reducer's terminal/stale guards hold as usual. The
 * synthetic event carries no `created`, so it can never mark a real webhook
 * event stale.
 */
export function createCheckoutSyncHandler(deps: BillingDeps = {}) {
  const db = deps.db ?? getDb;
  const stripe = deps.stripeClient ?? defaultStripe;
  const now = deps.now ?? (() => new Date());

  return async function POST(request: Request) {
    const parsed = SyncSchema.safeParse(await readJson(request));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    let session: Stripe.Checkout.Session;
    try {
      session = await stripe().checkout.sessions.retrieve(
        parsed.data.sessionId
      );
    } catch {
      // Unknown/foreign session id or Stripe unreachable — nothing to sync.
      return NextResponse.json({ ok: false }, { status: 404 });
    }

    // Subscription checkouts only. Pantry (mode=payment) stays webhook-only:
    // its reducer mints a claim token + email, which must not fire from an
    // unauthenticated return URL.
    if (session.mode !== "subscription" || session.status !== "complete") {
      return NextResponse.json({ ok: false });
    }

    const synthetic = {
      type: "checkout.session.completed",
      data: { object: session }
    } as Stripe.Event;
    await applyStripeEvent(db(), synthetic, now(), stripe);

    return NextResponse.json({ ok: true });
  };
}

/** The provider `created` time of an event as a Date, or null if absent. */
function eventCreatedAt(event: Stripe.Event): Date | null {
  return typeof event.created === "number"
    ? new Date(event.created * 1000)
    : null;
}

/**
 * Order tolerance (Task 8 / P2.2). Latest-event-wins per providerRef: an event
 * is stale for a row when we can PROVE it predates the newest event already
 * applied there — both `created` timestamps present and this one strictly
 * older. A stale event is skipped so it can never downgrade newer state (an old
 * invoice.paid arriving after a cancellation, a replayed subscription.updated).
 * Missing timestamps (older payloads, direct unit calls) are never stale, so
 * the reducer behaves exactly as it did before `last_event_at` existed.
 */
function isStaleForRow(
  event: Stripe.Event,
  row: { lastEventAt: Date | null } | undefined
): boolean {
  const created = eventCreatedAt(event);
  if (!created || !row?.lastEventAt) {
    return false;
  }
  return created.getTime() < row.lastEventAt.getTime();
}

/** The `last_event_at` set-fragment for a write (omitted when created absent). */
function eventStamp(event: Stripe.Event): { lastEventAt?: Date } {
  const created = eventCreatedAt(event);
  return created ? { lastEventAt: created } : {};
}

/**
 * Exported for direct unit testing without signature plumbing. Idempotent and
 * order-tolerant: replaying any event set in any order converges to the same
 * final state (guarded by `last_event_at`), and `refunded` is terminal. The
 * durable inbox (lib/server/billing/inbox.ts) wraps this; the raw reducer is
 * still directly callable and safe to call more than once per event.
 */
export async function applyStripeEvent(
  db: Db,
  event: Stripe.Event,
  now: Date,
  stripe?: () => Stripe,
  email?: PantryEmailSender
): Promise<PendingEmail[]> {
  // B4: emails are collected, not sent inline (except the legacy direct-call
  // path inside emitEmail). The inbox dispatches these AFTER its transaction
  // commits so a rolled-back tx never leaks an email.
  const pending: PendingEmail[] = [];

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;

    if (session.mode === "payment") {
      // Pantry Review Payment Link (one-time). Anything else in payment
      // mode is not ours — verify the price before touching the DB.
      await applyPantryCheckout(db, session, now, stripe, email, pending);
      return pending;
    }

    const userId = session.client_reference_id;
    const subscriptionId =
      typeof session.subscription === "string"
        ? session.subscription
        : session.subscription?.id;

    if (!userId || !subscriptionId) {
      return pending;
    }

    // Order tolerance + terminal statuses: read the stored row first. A
    // checkout.session.completed replayed after the subscription was refunded
    // or deleted (expired), or after a newer event landed, must NOT resurrect
    // premium (BC-9: expired is terminal here exactly as in subscription.updated).
    const [existingSub] = await db
      .select()
      .from(schema.subscriptions)
      .where(eq(schema.subscriptions.providerRef, subscriptionId))
      .for("update");
    if (
      existingSub?.status === "refunded" ||
      existingSub?.status === "expired" ||
      isStaleForRow(event, existingSub)
    ) {
      return pending;
    }

    // Fetch the subscription for period end + price.
    const subscription = stripe
      ? await stripe().subscriptions.retrieve(subscriptionId)
      : null;
    const item = subscription?.items.data[0];

    const isTrialing = subscription?.status === "trialing";
    const status = isTrialing ? "trialing" : "active";
    const priceVariant = subscription?.metadata?.price_variant ?? null;
    const termsVersion =
      subscription?.metadata?.terms_version ??
      session.metadata?.terms_version ??
      null;
    const currentPeriodEnd =
      isTrialing && subscription?.trial_end
        ? new Date(subscription.trial_end * 1000)
        : item?.current_period_end
          ? new Date(item.current_period_end * 1000)
          : new Date(now.getTime() + 31 * 24 * 60 * 60 * 1000);

    await db
      .insert(schema.subscriptions)
      .values({
        userId,
        provider: "stripe",
        providerRef: subscriptionId,
        productId:
          item?.price.id === process.env.STRIPE_PRICE_ANNUAL
            ? "premium_annual"
            : "premium_monthly",
        status,
        priceVariant,
        termsVersion,
        termsAcceptedAt: termsVersion ? now : null,
        currentPeriodEnd,
        cancelAtPeriodEnd: subscription?.cancel_at_period_end === true,
        ...eventStamp(event),
        updatedAt: now
      })
      .onConflictDoUpdate({
        target: schema.subscriptions.providerRef,
        set: {
          status,
          priceVariant,
          termsVersion,
          termsAcceptedAt: termsVersion ? now : null,
          ...(subscription
            ? { cancelAtPeriodEnd: subscription.cancel_at_period_end === true }
            : {}),
          ...eventStamp(event),
          updatedAt: now
        }
      });

    if (isTrialing) {
      emitBillingEvent({
        name: "trial_started",
        priceVariant:
          (priceVariant as BillingTelemetryEvent["priceVariant"]) ?? undefined
      });
    }
    return pending;
  }

  if (event.type === "invoice.paid") {
    const invoice = event.data.object as Stripe.Invoice;
    const subscriptionId = resolveInvoiceSubscriptionId(invoice);
    if (!subscriptionId) {
      return pending;
    }

    const [row] = await db
      .select()
      .from(schema.subscriptions)
      .where(eq(schema.subscriptions.providerRef, subscriptionId))
      .for("update");
    if (!row) {
      return pending;
    }

    // The $0 subscription-create invoice fires at trial START. It must not
    // flip trialing→active or emit a conversion. Other billing reasons
    // (subscription_cycle, …) or an absent reason proceed to conversion.
    if (invoice.billing_reason === "subscription_create") {
      return pending;
    }

    // Only trial→active and renewals of active rows are ours to touch. This
    // also holds the refunded/expired line: an old invoice.paid after a
    // cancellation or refund lands on a non-active row and is dropped here.
    if (row.status !== "trialing" && row.status !== "active") {
      return pending;
    }

    // Order tolerance: a replayed invoice.paid older than the newest applied
    // event must not re-refresh the period end backwards.
    if (isStaleForRow(event, row)) {
      return pending;
    }

    const subscription = stripe
      ? await stripe().subscriptions.retrieve(subscriptionId)
      : null;
    const item = subscription?.items.data[0];
    const currentPeriodEnd = item?.current_period_end
      ? new Date(item.current_period_end * 1000)
      : row.currentPeriodEnd;

    if (row.status === "trialing") {
      // First successful charge converts the trial. Renewals of an
      // already-active row are NOT conversions (new-only rule).
      await db
        .update(schema.subscriptions)
        .set({
          status: "active",
          currentPeriodEnd,
          ...eventStamp(event),
          updatedAt: now
        })
        .where(eq(schema.subscriptions.id, row.id));
      emitBillingEvent({
        name: "trial_converted",
        priceVariant:
          (row.priceVariant as BillingTelemetryEvent["priceVariant"]) ??
          undefined
      });
    } else {
      // Active renewal: period-end refresh only.
      await db
        .update(schema.subscriptions)
        .set({ currentPeriodEnd, ...eventStamp(event), updatedAt: now })
        .where(eq(schema.subscriptions.id, row.id));
    }
    return pending;
  }

  if (event.type === "invoice.payment_failed") {
    const invoice = event.data.object as Stripe.Invoice;
    const subscriptionId = resolveInvoiceSubscriptionId(invoice);
    if (!subscriptionId) {
      return pending; // Not a subscription invoice (e.g. the one-time Pantry charge).
    }

    const [found] = await db
      .select({ sub: schema.subscriptions, email: schema.users.email })
      .from(schema.subscriptions)
      .innerJoin(schema.users, eq(schema.subscriptions.userId, schema.users.id))
      .where(eq(schema.subscriptions.providerRef, subscriptionId))
      // Lock the subscription row only (not the joined users row) so a refund
      // racing this dunning-grace write serializes and the refunded guard holds.
      .for("update", { of: schema.subscriptions });
    if (!found || found.sub.status === "refunded") {
      return pending; // "refunded" is terminal — see the guard in subscription.updated.
    }
    const row = found.sub;

    // Order tolerance: a replayed/older failure must not re-cap or re-email a
    // row that a newer event has already moved past.
    if (isStaleForRow(event, row)) {
      return pending;
    }

    // Cap the grace window (N-07). Stripe's dunning retries a declined card for
    // ~3 weeks; mapStripeStatus turns past_due into "grace", which IS entitled,
    // and currentPeriodEnd stayed weeks out — so a card that will never clear
    // bought three more weeks of premium at zero revenue, and the user was never
    // told. Access now ends DUNNING_GRACE_MS from the first failure (or at the
    // period end already stored, whichever comes first — never extend it).
    const graceEnd = new Date(now.getTime() + DUNNING_GRACE_MS);
    const currentPeriodEnd =
      row.currentPeriodEnd < graceEnd ? row.currentPeriodEnd : graceEnd;

    // Every dunning retry re-fires this event. Once the row is capped, a later
    // retry recomputes a graceEnd LATER than the stored end — that is the
    // idempotence signal, and it costs no schema column: cap and email once.
    if (row.status === "grace" && row.currentPeriodEnd <= graceEnd) {
      return pending;
    }

    await db
      .update(schema.subscriptions)
      .set({
        status: "grace",
        currentPeriodEnd,
        ...eventStamp(event),
        updatedAt: now
      })
      .where(eq(schema.subscriptions.id, row.id));

    // B4: collect the dunning email — do NOT send it inside the inbox tx. The
    // inbox dispatches it after commit (a direct caller with a sender still
    // gets the inline send via emitEmail).
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    await emitEmail(db, pending, email, now, {
      to: found.email,
      ...paymentFailedEmailText(
        appUrl,
        currentPeriodEnd.toLocaleDateString("en-US", {
          month: "long",
          day: "numeric"
        })
      ),
      category: "payment_failed",
      idempotencyKey: `payment-failed/${event.id}`
    });
    return pending;
  }

  if (
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.deleted"
  ) {
    const subscription = event.data.object as Stripe.Subscription;
    const item = subscription.items?.data[0];
    const status = mapStripeStatus(subscription.status, event.type);

    // Read the stored row BEFORE the update — its pre-update status drives the
    // refund guard below as well as the cancel and conversion telemetry.
    const [existing] = await db
      .select()
      .from(schema.subscriptions)
      .where(eq(schema.subscriptions.providerRef, subscription.id))
      .for("update");

    // "refunded" is TERMINAL (N-06). Stripe does not guarantee webhook ordering,
    // so a customer.subscription.updated emitted before the refund can be
    // delivered after it — and this handler used to write `status` and
    // `currentPeriodEnd` unconditionally, which resurrected a refunded
    // subscription to "active" and handed back the premium we just refunded.
    // charge.refunded is the only writer of this status; nothing may undo it.
    if (existing?.status === "refunded") {
      return pending;
    }

    // "expired" is TERMINAL too (B2). mapStripeStatus turns
    // customer.subscription.deleted into "expired", and a deleted Stripe
    // subscription id never legitimately reactivates — a resubscribe is a NEW
    // subscription id and a NEW row. Without this, a customer.subscription.updated
    // whose `created` EQUALS the delete event's is NOT stale (equal is not
    // strictly older), so an out-of-order active update after a delete would
    // overwrite expired→active and hand back premium we already ended.
    if (existing?.status === "expired") {
      return pending;
    }

    // Order tolerance: a subscription.updated/deleted whose `created` predates
    // the newest applied event is stale and must not overwrite newer status or
    // period data (the classic out-of-order updated-before-refund resurrection).
    if (isStaleForRow(event, existing)) {
      return pending;
    }

    // Cancellation telemetry: a subscription flagged to cancel at period end
    // keeps its current status (entitled until it lapses); we only surface the
    // signal. Telemetry duplicates on repeated updates are tolerable.
    //
    // The two names are NOT interchangeable — a trial that never converted and
    // a paying customer who left are different business events, and W-10's
    // churn metric wants the second one. A trial cancels; a subscriber churns.
    if (
      event.type === "customer.subscription.updated" &&
      subscription.cancel_at_period_end === true &&
      (existing?.status === "trialing" || existing?.status === "active")
    ) {
      emitBillingEvent({
        name:
          existing.status === "trialing"
            ? "trial_canceled"
            : "subscription_canceled",
        priceVariant:
          (existing.priceVariant as BillingTelemetryEvent["priceVariant"]) ??
          undefined
      });
    }

    // Conversion can arrive here instead of via invoice.paid when Stripe fires
    // customer.subscription.updated (trialing→active) first. Emit exactly once:
    // the stored row still being "trialing" is the dedupe — whichever handler
    // runs first flips the row, so only one of the two emits.
    const previousStatus = (
      event.data.previous_attributes as { status?: string } | undefined
    )?.status;
    const isConversion =
      event.type === "customer.subscription.updated" &&
      previousStatus === "trialing" &&
      status === "active" &&
      existing?.status === "trialing";

    // A payload that omits current_period_end must LEAVE the stored one alone.
    // Writing `now` (the old fallback) set the paid-through date to this instant,
    // and getEntitlement requires currentPeriodEnd > now — so any such update
    // silently revoked premium from a paying, fully-active subscriber.
    const periodEnd = item?.current_period_end
      ? new Date(item.current_period_end * 1000)
      : undefined;

    await db
      .update(schema.subscriptions)
      .set({
        status,
        ...(periodEnd ? { currentPeriodEnd: periodEnd } : {}),
        // BC-2: persist the will-not-renew truth so the UI can stop showing a
        // fabricated "Renews {date}" to a canceled-but-unexpired subscriber.
        cancelAtPeriodEnd: subscription.cancel_at_period_end === true,
        ...eventStamp(event),
        updatedAt: now
      })
      .where(eq(schema.subscriptions.providerRef, subscription.id));

    if (isConversion) {
      emitBillingEvent({
        name: "trial_converted",
        priceVariant:
          (existing?.priceVariant as BillingTelemetryEvent["priceVariant"]) ??
          undefined
      });
    }
    return pending;
  }

  if (event.type === "charge.refunded") {
    const charge = event.data.object as Stripe.Charge;
    const paymentIntent =
      typeof charge.payment_intent === "string"
        ? charge.payment_intent
        : charge.payment_intent?.id;
    if (paymentIntent) {
      const canceled = await db
        .update(schema.pantryOrders)
        .set({ status: "canceled", updatedAt: now })
        .where(eq(schema.pantryOrders.stripePaymentIntent, paymentIntent))
        .returning({ id: schema.pantryOrders.id });

      // W-33 — a refunded order is over, so its photos must go. Nothing else
      // ever revisits a canceled order (the sweep only walks live states), so
      // without this the buyer's food photos would live in blob storage
      // forever, against the privacy promise. Must run here, while the
      // pantry_photos rows still hold the only pointers to the objects.
      for (const order of canceled) {
        await deleteOrderBlobs(db, order.id);
      }
    }

    // Subscription refund (launch audit BUG-17). Policy: a FULL refund of a
    // subscription invoice charge (charge.refunded === true) drops premium
    // immediately via status "refunded" — the only writer of that enum value.
    // Partial refunds keep the entitlement; a refund WITH a cancel also flows
    // through subscription.deleted, and this update is idempotent alongside it.
    // stripe@22's basil types drop charge.invoice — same safe-cast fallback as
    // the invoice.paid resolution above.
    if (!charge.refunded || !stripe) {
      return pending;
    }
    const invoiceRef = (
      charge as unknown as { invoice?: string | { id: string } | null }
    ).invoice;
    const invoiceId =
      typeof invoiceRef === "string" ? invoiceRef : invoiceRef?.id;
    if (!invoiceId) {
      return pending;
    }
    const invoice = await stripe().invoices.retrieve(invoiceId);
    const subscriptionId = resolveInvoiceSubscriptionId(invoice);
    if (!subscriptionId) {
      return pending;
    }
    const refunded = await db
      .update(schema.subscriptions)
      .set({ status: "refunded", ...eventStamp(event), updatedAt: now })
      .where(eq(schema.subscriptions.providerRef, subscriptionId))
      .returning({ priceVariant: schema.subscriptions.priceVariant });

    // W-10 churn signal. Emitted off the RETURNING rows, not the incoming
    // event, so a refund for a subscription we do not hold emits nothing —
    // the event fires if and only if a real entitlement was revoked.
    for (const row of refunded) {
      emitBillingEvent({
        name: "subscription_refunded",
        priceVariant:
          (row.priceVariant as BillingTelemetryEvent["priceVariant"]) ??
          undefined
      });
    }
  }

  return pending;
}

/**
 * Subscription id resolution across API versions. On 2025-03-31.basil+
 * payloads it lives under invoice.parent.subscription_details; older
 * account/endpoint versions send a top-level invoice.subscription that
 * stripe@22's types no longer declare — resolve via a safe cast fallback.
 */
export function resolveInvoiceSubscriptionId(
  invoice: Stripe.Invoice
): string | undefined {
  const subRef = invoice.parent?.subscription_details?.subscription;
  const fromParent = typeof subRef === "string" ? subRef : subRef?.id;
  if (fromParent) {
    return fromParent;
  }
  const legacy = (
    invoice as unknown as { subscription?: string | { id: string } }
  ).subscription;
  return typeof legacy === "string" ? legacy : legacy?.id;
}

async function applyPantryCheckout(
  db: Db,
  session: Stripe.Checkout.Session,
  now: Date,
  stripe: (() => Stripe) | undefined,
  email: PantryEmailSender | undefined,
  pending: PendingEmail[]
): Promise<void> {
  const pantryPrice = process.env.STRIPE_PRICE_PANTRY;
  if (!pantryPrice || !stripe) {
    return;
  }

  const lineItems = await stripe().checkout.sessions.listLineItems(
    session.id,
    { limit: 10 }
  );
  if (!lineItems.data.some((item) => item.price?.id === pantryPrice)) {
    return;
  }

  let buyerEmail = session.customer_details?.email ?? session.customer_email;
  if (!buyerEmail) {
    // The durable inbox intentionally does not retain buyer PII. Rehydrate the
    // one field this reducer needs from Stripe when processing/retrying a
    // minimized Pantry event.
    const current = await stripe().checkout.sessions.retrieve(session.id);
    buyerEmail = current.customer_details?.email ?? current.customer_email;
  }
  if (!buyerEmail) {
    return; // Payment Links always collect email; belt-and-suspenders.
  }

  // The claim token is minted once and its hash committed on the order row
  // BEFORE the email is dispatched (B4). Because the row (and the inbox row)
  // commit atomically, a retry only reprocesses when the insert rolled back —
  // so the token that reaches the buyer's inbox always matches a committed row,
  // never an orphan. onConflictDoNothing is the redelivery guard: a duplicate
  // delivery makes no new row and enqueues no second email.
  const { token, tokenHash } = generateClaimToken();
  const inserted = await db
    .insert(schema.pantryOrders)
    .values({
      email: buyerEmail,
      stripeSessionId: session.id,
      stripePaymentIntent:
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : (session.payment_intent?.id ?? null),
      claimToken: tokenHash,
      termsVersion: session.metadata?.terms_version ?? null,
      termsAcceptedAt: session.metadata?.terms_version ? now : null,
      updatedAt: now
    })
    .onConflictDoNothing({ target: schema.pantryOrders.stripeSessionId })
    .returning();

  if (inserted.length === 0) {
    return; // Duplicate webhook delivery — the first one already emailed.
  }

  emitBillingEvent({ name: "pantry_purchased" });

  const orderId = inserted[0].id;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  // Collect (or, for a direct caller with a sender, send inline). `onSent`
  // stamps intake-sent only after a real successful send, so a send failure
  // leaves intakeEmailSentAt null.
  await emitEmail(db, pending, email, now, {
    to: buyerEmail,
    ...intakeEmailText(appUrl, token),
    category: "pantry_intake",
    idempotencyKey: `pantry-intake/${orderId}/${tokenHash}`,
    onSent: async (d, sentAt) => {
      await d
        .update(schema.pantryOrders)
        .set({ intakeEmailSentAt: sentAt, updatedAt: sentAt })
        .where(eq(schema.pantryOrders.id, orderId));
    }
  });
}

function mapStripeStatus(
  status: Stripe.Subscription.Status,
  eventType: string
): "active" | "trialing" | "canceled" | "grace" | "expired" | "refunded" {
  if (eventType === "customer.subscription.deleted") {
    return "expired";
  }

  switch (status) {
    case "active":
      return "active";
    case "trialing":
      return "trialing";
    case "past_due":
      return "grace";
    case "canceled":
      return "canceled";
    default:
      return "expired";
  }
}

// ── POST /api/trial/start ───────────────────────────────────────────────────

const TrialStartSchema = z
  .object({
    email: z.string().trim().toLowerCase().email().max(254),
    // 2-plan wall (owner decision 2026-07-10). Absent = monthly, so existing
    // clients keep working unchanged.
    plan: z.enum(["monthly", "annual"]).optional(),
    termsAccepted: z.literal(true),
    termsVersion: z.literal(TERMS_VERSION),
    // AUD-011: a prior subscriber gets no free week (W-16). Their first
    // request answers with an ineligible-trial disclosure instead of a
    // checkout URL; only an explicit resubmit with this flag opens the
    // immediate-billing session — the UI can never promise "nothing is
    // charged today" for a checkout that charges today.
    acknowledgeImmediate: z.literal(true).optional()
  })
  .strict();

/**
 * Email-first, card-gated 7-day trial. The account is created at trial start
 * (find-or-create on the same `users` row the magic-link sign-in resolves via
 * getUserByEmail), the magic link fires non-fatally as account recovery if the
 * card step is abandoned, and a subscription Checkout session with a 7-day
 * trial is returned. Consumed by the Phase-4 paywall (Task 4.2).
 */
export function createTrialCheckoutHandler(
  deps: BillingDeps & {
    sendMagicLink?: (email: string) => Promise<void>;
    emailCooldown?: (email: string) => Promise<{ ok: boolean }>;
  } = {}
) {
  const db = deps.db ?? getDb;
  const stripe = deps.stripeClient ?? defaultStripe;
  const env = deps.env ?? process.env;
  const emailCooldown =
    deps.emailCooldown ?? ((email: string) => checkEmailCooldown("trial_email", email));
  const sendMagicLink =
    deps.sendMagicLink ??
    (async (email: string) => {
      // Reuses the exact existing magic-link path; the email doubles as
      // account recovery if the card step is abandoned.
      const { signIn } = await import("../../../auth");
      await signIn("resend", {
        email,
        redirect: false,
        redirectTo: "/welcome?trial=1"
      });
    });

  return async function POST(request: Request) {
    const blocked = checkoutGate(env);
    if (blocked) {
      return blocked;
    }
    const invalidReturnUrl = paymentReturnUrlGate(env);
    if (invalidReturnUrl) {
      return invalidReturnUrl;
    }

    const parsed = TrialStartSchema.safeParse(await readJson(request));
    if (!parsed.success) {
      return NextResponse.json({ error: "Enter a valid email." }, { status: 400 });
    }

    // Per-email cooldown (W-11). The proxy already limits this route per IP;
    // this is the half per-IP cannot see — a distributed flood pointed at ONE
    // stranger's inbox. Runs BEFORE the users row, the magic link, and the
    // Stripe session, so a blocked request costs us nothing at all.
    const cooldown = await emailCooldown(parsed.data.email);
    if (!cooldown.ok) {
      return NextResponse.json(
        { error: "Too many attempts. Please try again in a little while." },
        { status: 429 }
      );
    }

    const monthly = resolvePriceVariant(env);
    const plan = parsed.data.plan ?? "monthly";
    const priceId =
      plan === "annual" ? resolveAnnualPrice(env).priceId : monthly.priceId;
    // The metadata drives the pre-charge email's price line; annual rows carry
    // the plan name instead of a monthly variant.
    const variant = plan === "annual" ? "annual" : monthly.variant;
    if (!priceId) {
      return NextResponse.json(
        { error: "Billing is not configured." },
        { status: 503 }
      );
    }

    const email = parsed.data.email;
    // Find-or-create: the DrizzleAdapter's magic-link sign-in resolves this
    // same row via getUserByEmail, so account creation moves to trial start
    // without forking the auth model.
    let [user] = await db()
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, email));
    if (!user) {
      try {
        [user] = await db().insert(schema.users).values({ email }).returning();
      } catch {
        // Concurrent trial-start for the same new email lost the insert race
        // (users.email is UNIQUE) — the winner's row is now present.
        [user] = await db()
          .select()
          .from(schema.users)
          .where(eq(schema.users.email, email));
      }
    }

    // W-16 — one free week per account, ever. Every checkout used to carry a
    // fresh trial_period_days, so cancel → re-subscribe → cancel bought free
    // premium forever. ANY prior subscriptions row disqualifies the trial,
    // whatever its status: canceled, expired and refunded all mean the free week
    // was already taken. The row itself is the flag, so this needs no migration
    // and no new column to keep in sync. A user who merely abandoned checkout
    // never got a row — they still get the week they never used. Correct.
    // Checked BEFORE the magic link so the disclosure bounce (below) costs no
    // email send.
    const [priorSubscription] = await db()
      .select({ id: schema.subscriptions.id })
      .from(schema.subscriptions)
      .where(eq(schema.subscriptions.userId, user.id))
      .limit(1);

    // AUD-011: eligibility is disclosed before checkout, not silently priced
    // in. Without the acknowledgment flag, an ineligible account gets the
    // authoritative charge terms (amount due today, cadence) and NO Stripe
    // session — the wall re-renders them and asks before any authorization.
    if (priorSubscription && !parsed.data.acknowledgeImmediate) {
      return NextResponse.json({
        ineligibleTrial: true,
        priceDisplay:
          plan === "annual" ? resolveAnnualPrice(env).display : monthly.display,
        cadence: plan === "annual" ? "year" : "month"
      });
    }

    try {
      await sendMagicLink(email);
    } catch {
      // Non-fatal: /trial/started offers a resend; checkout must not block on email.
    }

    const appUrl = paymentReturnUrl(env)!;
    const checkout = await stripe().checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      payment_method_collection: "always",
      subscription_data: {
        ...(priorSubscription ? {} : { trial_period_days: 7 }),
        metadata: {
          price_variant: variant,
          terms_version: parsed.data.termsVersion
        }
      },
      metadata: { terms_version: parsed.data.termsVersion },
      client_reference_id: user.id,
      customer_email: email,
      // BC-3: see createStripeCheckoutHandler — enables webhook-independent
      // entitlement sync on return.
      success_url: `${appUrl}/trial/started?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/subscribe?declined=1`
    });

    return NextResponse.json({ url: checkout.url });
  };
}
