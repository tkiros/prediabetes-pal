import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export type RateLimitReason = "per_ip" | "daily_cap" | "store_error";

export type RateLimitDecision =
  | { ok: true }
  | { ok: false; reason: RateLimitReason; retryAfterSeconds: number };

/**
 * Every limited bucket in the app. Buckets are keyed independently (distinct
 * Redis prefixes), so a surface can never spend another surface's budget: the
 * trial funnel fires a magic link of its own, and if it shared the auth bucket
 * two trial starts would lock the user out of signing in.
 *
 * `*_ip` buckets are enforced by the Edge proxy (which only ever sees an IP);
 * `*_email` buckets are enforced by the Node handlers that have already parsed
 * the address, and defend the case per-IP cannot: a distributed flood aimed at
 * ONE victim's mailbox.
 */
export type LimitBucket =
  | "check_ip"
  | "check_user"
  | "trial_ip"
  | "auth_signin_ip"
  | "auth_other_ip"
  | "billing_ip"
  | "trial_email"
  | "auth_email"
  | "support_ip";

// >3/h per IP or per email on the abuse-prone doors (docs/qa plan W-11). The
// looser auth_other budget covers POST /api/auth/signout + /callback, which
// send no email and cost nothing — holding those to 3/h would lock a shared
// NAT (household, cafe) out of ordinary session churn for an hour.
const BUCKETS: Record<
  LimitBucket,
  { limit: number; window: `${number} h`; prefix: string }
> = {
  check_ip: { limit: 20, window: "1 h", prefix: "pal:ip" },
  // RE-04: per-USER model-spend cap, enforced in the check handler (the Edge
  // proxy only sees IPs). One account rotating IPs could otherwise exhaust
  // the global daily cap and 429 everyone else. 200/24h is far above any
  // human usage and far below the global 2000/day.
  check_user: { limit: 200, window: "24 h", prefix: "pal:user" },
  trial_ip: { limit: 3, window: "1 h", prefix: "pal:trial:ip" },
  auth_signin_ip: { limit: 3, window: "1 h", prefix: "pal:auth:ip" },
  auth_other_ip: { limit: 30, window: "1 h", prefix: "pal:authx:ip" },
  // BC-7: pantry-checkout is unauthenticated — scripted Stripe-session
  // creation must not be free. 10/h per IP never touches a real buyer.
  billing_ip: { limit: 10, window: "1 h", prefix: "pal:billing:ip" },
  trial_email: { limit: 3, window: "1 h", prefix: "pal:trial:email" },
  auth_email: { limit: 3, window: "1 h", prefix: "pal:auth:email" },
  // P0.4: authenticated help/refund cases — each POST sends a PII-minimized
  // queue notice, so this is still an email amplifier and fails CLOSED like
  // the other email doors. 5/24h never touches a real user in distress.
  support_ip: { limit: 5, window: "24 h", prefix: "pal:support:ip" }
};

export type RateLimitDeps = {
  limitBucket(
    bucket: LimitBucket,
    key: string
  ): Promise<{ success: boolean; resetMs: number; reason?: "timeout" }>;
  incrDailyCount(): Promise<number>;
  dailyCap: number;
};

const DEFAULT_DAILY_CAP = 2_000;

// ── Route → limit table ─────────────────────────────────────────────────────

const CHECK_PATH = "/api/check";
const TRIAL_START_PATH = "/api/trial/start";
const AUTH_PREFIX = "/api/auth/";
const AUTH_SIGNIN_PREFIX = "/api/auth/signin";
const BILLING_PREFIX = "/api/billing/";
const SUPPORT_CASE_PATH = "/api/support/case";
// Provider-authenticated webhook doors (Stripe signature, Pub/Sub shared
// token). Their senders retry from shared infrastructure IPs — rate-limiting
// them would drop legitimate money-path events, and each verifies its caller.
const BILLING_WEBHOOK_PATHS = new Set([
  "/api/billing/stripe/webhook",
  "/api/billing/play/rtdn"
]);

/**
 * What a matched route costs and how it must behave when Redis is unreachable.
 *
 * `failClosed` is set ONLY on the doors whose unbounded action is externally
 * irreversible — the two that send email. A magic-link/trial flood burns our
 * Resend sender reputation, and a burnt domain means NOBODY can sign in for
 * days; that harm dwarfs the transient unavailability of failing closed during
 * a (rare, short) Upstash outage. Everything else fails OPEN, matching the
 * deliberate stance on the check path below: compute is bounded by the OpenAI
 * dashboard hard cap, so availability wins there.
 */
export type RouteLimit =
  | { kind: "check" }
  | { kind: "abuse"; bucket: LimitBucket; failClosed: boolean };

/**
 * The proxy's dispatch table (W-11). Before this, the guard was a hardcoded
 * `startsWith("/api/check") && POST`, which left /api/trial/start (creates a
 * users row + sends email + opens a Stripe session, all unauthenticated) and
 * /api/auth/* (magic-link flood + account enumeration) completely unlimited.
 *
 * POST only, deliberately: GET /api/auth/session and /api/auth/csrf are polled
 * by the app on every page and would 429 a normal user within minutes.
 */
export function matchRouteLimit(
  pathname: string,
  method: string
): RouteLimit | null {
  if (method !== "POST") {
    return null;
  }
  if (pathname.startsWith(CHECK_PATH)) {
    return { kind: "check" };
  }
  if (pathname === TRIAL_START_PATH) {
    return { kind: "abuse", bucket: "trial_ip", failClosed: true };
  }
  if (pathname.startsWith(AUTH_SIGNIN_PREFIX)) {
    return { kind: "abuse", bucket: "auth_signin_ip", failClosed: true };
  }
  if (pathname.startsWith(AUTH_PREFIX)) {
    return { kind: "abuse", bucket: "auth_other_ip", failClosed: false };
  }
  // BC-7: every billing door (checkout, pantry-checkout, cancel, sync, portal,
  // play/verify) gets an abuse budget — pantry-checkout in particular is
  // unauthenticated and opens Stripe sessions. Webhooks are excluded above.
  if (
    pathname.startsWith(BILLING_PREFIX) &&
    !BILLING_WEBHOOK_PATHS.has(pathname)
  ) {
    return { kind: "abuse", bucket: "billing_ip", failClosed: false };
  }
  // P0.4: the support-case door emails the inbox on every accepted POST —
  // fail closed like the other email senders (sender-reputation stance above).
  if (pathname === SUPPORT_CASE_PATH) {
    return { kind: "abuse", bucket: "support_ip", failClosed: true };
  }
  return null;
}

// ── Decisions ───────────────────────────────────────────────────────────────

/**
 * Pure decision logic for the check path — no network. Order: per-IP first;
 * only IP-allowed requests touch the global daily counter (so an IP-blocked
 * flood cannot trip the global pause for everyone). Fails OPEN on any store
 * error — the OpenAI dashboard hard cap is the true cost ceiling.
 * ponytail: fail-open trades a small abuse window for availability; tighten to
 * fail-closed here only if logs show the open path is being exploited.
 */
export async function evaluateRateLimit(
  ip: string,
  deps: RateLimitDeps
): Promise<RateLimitDecision> {
  try {
    const ipResult = await deps.limitBucket("check_ip", ip);
    if (ipResult.reason === "timeout") {
      return { ok: true };
    }
    if (!ipResult.success) {
      return { ok: false, reason: "per_ip", retryAfterSeconds: retryAfter(ipResult.resetMs) };
    }

    const dailyCount = await deps.incrDailyCount();
    if (dailyCount > deps.dailyCap) {
      return { ok: false, reason: "daily_cap", retryAfterSeconds: 3_600 };
    }

    return { ok: true };
  } catch {
    return { ok: true };
  }
}

/**
 * Pure decision logic for the abuse buckets (trial start, auth, per-email
 * cooldowns). Unlike the check path this can fail CLOSED — see RouteLimit's
 * note on why only the email-sending doors do.
 */
export async function evaluateAbuseLimit(
  bucket: LimitBucket,
  key: string,
  deps: RateLimitDeps,
  failClosed: boolean
): Promise<RateLimitDecision> {
  try {
    const result = await deps.limitBucket(bucket, key);
    if (result.reason === "timeout") {
      return failClosed
        ? { ok: false, reason: "store_error", retryAfterSeconds: 60 }
        : { ok: true };
    }
    if (result.success) {
      return { ok: true };
    }
    return {
      ok: false,
      reason: "per_ip",
      retryAfterSeconds: retryAfter(result.resetMs)
    };
  } catch {
    if (!failClosed) {
      return { ok: true };
    }
    return { ok: false, reason: "store_error", retryAfterSeconds: 60 };
  }
}

function retryAfter(resetMs: number): number {
  return Math.max(1, Math.ceil((resetMs - Date.now()) / 1_000));
}

export function getClientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return headers.get("x-real-ip")?.trim() || "unknown";
}

// ── Per-email cooldowns (Node handlers) ─────────────────────────────────────

let sharedDeps: RateLimitDeps | null | undefined;

/**
 * Lazily-built process-wide deps for the Node runtime (the Edge proxy builds
 * its own at module scope). `undefined` = not yet built; `null` = Upstash is
 * absent/invalid, which in dev and the test runner means "skip limiting" — the
 * proxy is the fail-closed gate that guarantees a public deploy never runs
 * unlimited, so a null here can only mean a surface we already refused to serve.
 */
function nodeDeps(): RateLimitDeps | null {
  if (sharedDeps === undefined) {
    sharedDeps = createRateLimitDeps();
  }
  return sharedDeps;
}

/**
 * Per-email cooldown for the two doors that send mail to an address the caller
 * chose (trial start, magic link). Per-IP limiting cannot see this: a botnet
 * spread over 500 IPs mailbox-bombs one victim without any single IP tripping.
 *
 * Fails CLOSED on a store error, for the same reason those routes do in the
 * proxy — the harm being prevented (a torched sender domain) is not reversible.
 * Skips entirely when Upstash is unconfigured (dev/test).
 */
export async function checkEmailCooldown(
  bucket: "trial_email" | "auth_email",
  email: string,
  deps: RateLimitDeps | null = nodeDeps()
): Promise<RateLimitDecision> {
  if (!deps) {
    return { ok: true };
  }
  return evaluateAbuseLimit(bucket, email.trim().toLowerCase(), deps, true);
}

/**
 * RE-04: per-user model-spend cap for the check path, enforced in the Node
 * handler where the session is known (the Edge proxy only ever sees an IP —
 * one account rotating IPs could exhaust the GLOBAL daily cap and 429 every
 * other user). Fails OPEN like the check path's other limits: the OpenAI
 * dashboard hard cap is the true cost ceiling, availability wins.
 */
export async function checkUserSpendLimit(
  userId: string,
  deps: RateLimitDeps | null = nodeDeps()
): Promise<RateLimitDecision> {
  if (!deps) {
    return { ok: true };
  }
  return evaluateAbuseLimit("check_user", userId, deps, false);
}

// ── Config probes + live deps ───────────────────────────────────────────────

export type RateLimitConfigState = "configured" | "invalid" | "unconfigured";

/**
 * Config-state probe for the health endpoint and the deps factory. Cheap — no
 * allocation, no network, cannot throw. Three states:
 *   - "unconfigured": either env var absent (middleware fails CLOSED on public
 *     deploys — the merge-gate signal).
 *   - "invalid": both present but the URL is not the https:// REST endpoint
 *     (classic mistake: pasting the rediss:// TCP URL — this took prod down
 *     once, with health reading green; see 2026-07-06 launch audit BUG-01/07).
 *   - "configured": present and plausibly a REST URL.
 */
export function rateLimitConfigState(
  env: NodeJS.ProcessEnv = process.env
): RateLimitConfigState {
  const url = env.UPSTASH_REDIS_REST_URL?.trim();
  const token = env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) return "unconfigured";
  return url.startsWith("https://") ? "configured" : "invalid";
}

/**
 * True only when the Upstash config is present AND the URL scheme is valid.
 * (Reachability is still a separate concern the limiter fails open on.)
 */
export function isRateLimitConfigured(
  env: NodeJS.ProcessEnv = process.env
): boolean {
  return rateLimitConfigState(env) === "configured";
}

/**
 * Build the live Upstash-backed deps. Returns null — NEVER throws — when the
 * Upstash env is absent, invalid, or client construction fails, so the caller
 * can decide (dev: skip limiting; public deploy: fail closed with the designed
 * 503). This runs at middleware module scope: a throw here becomes a platform
 * MIDDLEWARE_INVOCATION_FAILED 500 on every matched request (launch audit
 * BUG-01), which is exactly what the null contract prevents.
 */
export function createRateLimitDeps(
  env: NodeJS.ProcessEnv = process.env
): RateLimitDeps | null {
  if (rateLimitConfigState(env) !== "configured") return null;
  const url = env.UPSTASH_REDIS_REST_URL!.trim();
  const token = env.UPSTASH_REDIS_REST_TOKEN!.trim();

  try {
    const redis = new Redis({ url, token });
    // One limiter per bucket, built once — the Ratelimit instance is the thing
    // that carries the window/limit, so they cannot be shared across buckets.
    const limiters = new Map<LimitBucket, Ratelimit>();
    for (const [bucket, config] of Object.entries(BUCKETS)) {
      limiters.set(
        bucket as LimitBucket,
        new Ratelimit({
          redis,
          limiter: Ratelimit.slidingWindow(config.limit, config.window),
          prefix: config.prefix,
          analytics: false
        })
      );
    }

    const parsedCap = Number(env.PAL_DAILY_CHECK_CAP);
    const dailyCap =
      Number.isFinite(parsedCap) && parsedCap > 0
        ? parsedCap
        : DEFAULT_DAILY_CAP;

    return {
      async limitBucket(bucket, key) {
        const result = await limiters.get(bucket)!.limit(key);
        return {
          success: result.success,
          resetMs: result.reset,
          reason: result.reason === "timeout" ? "timeout" : undefined
        };
      },
      async incrDailyCount() {
        const day = new Date().toISOString().slice(0, 10);
        const key = `pal:daily:${day}`;
        const pipeline = redis.pipeline();
        pipeline.incr(key);
        pipeline.expire(key, 172_800); // 48h — survives timezone edges
        const [count] = (await pipeline.exec()) as [number, number];
        return count;
      },
      dailyCap
    };
  } catch {
    return null;
  }
}
