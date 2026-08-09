import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import Stripe from "stripe";

import type { Daypart } from "../../../lib/coach/insights";
import { routeA1C } from "../../../lib/revora/a1c";
import { CLARIFY_QUESTIONS, type ClarifyReason } from "../../../lib/revora/clarify";
import { classifyClinicalRisk } from "../../../lib/revora/clinical-risk";
import {
  deriveCoachOutputs,
  type CoachOutputs
} from "../../../lib/revora/coach-outputs";
import { buildRetryResponse } from "../../../lib/revora/fallback";
import type { SnapshotMetadata } from "../../../lib/revora/postprocess";
import {
  activeModelId,
  activeModelProvider,
  createOpenAIRevoraModelClient,
  type RevoraModelClient
} from "../../../lib/revora/openai-client";
import { PROMPT_VERSION } from "../../../lib/revora/prompt";
import {
  CONTRACT_VERSION,
  loadSafetyContract
} from "../../../lib/revora/safety-contract";
import {
  CheckRequestSchema,
  type RevoraUserResponse
} from "../../../lib/revora/schemas";
import { checkUserSpendLimit } from "../../../lib/revora/rate-limit";
import { captureServerError } from "../../../lib/revora/sentry-capture";
import { checkFood } from "../../../lib/revora/service";
import {
  emitSafeEvent,
  type SafeTelemetryEvent
} from "../../../lib/revora/telemetry";
import { encryptField } from "../../../lib/server/crypto";
import { getDb, schema, type Db } from "../../../lib/server/db";
import {
  countChecksToday,
  getEntitlement,
  FREE_DAILY_CHECKS
} from "../../../lib/server/entitlement";
import { fetchPlaySubscription } from "../../../lib/server/play-api";
import { fetchStripeSubscription } from "../../../lib/server/stripe-api";
import { paywallMode } from "../../../lib/server/pricing";
import {
  getSessionInfo,
  type SessionInfo
} from "../../../lib/server/session";

export const runtime = "nodejs";

// Hard ceiling on function execution. Sits above the 10s OpenAI client timeout
// (server budget) and below/at the Vercel plan's function-duration limit so a
// stuck call is cut, not left hanging. REL-03 verified 2026-07-11: the active
// plan (Hobby, Fluid compute, 300s default limit) accepts 15 — the production
// deploy builds and serves with this value, and Vercel hard-fails builds that
// exceed the plan limit. Still ≥ the 12s client abort (plan A1/B7).
export const maxDuration = 15;

type CheckRouteDeps = {
  checkFoodImpl?: typeof checkFood;
  emitEvent?: typeof emitSafeEvent;
  modelFactory?: (model?: string) => RevoraModelClient;
  now?: () => number;
  db?: () => Db;
  getSession?: () => Promise<SessionInfo>;
  playLookup?: typeof fetchPlaySubscription;
  stripeClient?: () => Stripe;
  paywallMode?: () => "legacy" | "trial";
};

// Lazy Stripe singleton for the check route's verify-on-read heal. Constructed
// only when actually called (a stale, time-gated Stripe row) — an unset key
// throws inside getEntitlement's guarded try, which fails toward free.
let checkStripeSingleton: Stripe | null = null;
function defaultCheckStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not set.");
  }
  checkStripeSingleton ??= new Stripe(key);
  return checkStripeSingleton;
}

// Calm upsell, never a scary wall (plan 4D): the daily loop keeps working
// tomorrow; premium removes the limit. The count is derived from
// FREE_DAILY_CHECKS so the copy can never drift from the real limit.
const COUNT_WORDS = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten"
] as const;
const FREE_LIMIT_WORD = COUNT_WORDS[FREE_DAILY_CHECKS] ?? String(FREE_DAILY_CHECKS);
const FREE_LIMIT_MESSAGE = `You've used today's ${FREE_LIMIT_WORD} free checks. Premium removes the daily limit and keeps your full history — or check back in with your first meal tomorrow.`;

// Hard wall (Decision D): under PAYWALL_MODE=trial there are no residual free
// checks. The client renders this as the wall CTA; the copy stays calm and
// names the exact next step.
export const TRIAL_WALL_MESSAGE =
  "Your free taste of Prediabetes Pal was yesterday's checks. Start your free week — card required, unlimited everything, and we email you before any charge — to keep going.";

// Model selection (W-02, reversing the 2026-07-11 tiering decision).
//
// Every check — guest, trialing, or paying — runs on the primary model
// (REVORA_MODEL, default gpt-5.4-mini). There is deliberately NO per-user
// routing here.
//
// The removed code downgraded a user to gpt-5.4-nano after 10 stored checks.
// Because the trial wall 402s every non-premium session upstream of that line,
// the only sessions that could ever reach it were *paying and trialing* ones —
// so the downgrade applied exclusively to customers, silently, while the wall
// sold them "unlimited everything". It also contradicted the repo's own
// bakeoff, which failed nano on the ≥98% schema-validity threshold and scoped
// it to provider-outage degradation only.
//
// Nano remains reachable as a manual outage fallback by setting REVORA_MODEL
// (openai-client.ts) — a deliberate, disclosed, whole-fleet decision rather
// than an invisible per-user one. Any future routing must first pass the full
// ratified gate on the production provider path, and must be disclosed.
const modelClients = new Map<string, RevoraModelClient>();

function getModelClient(model?: string) {
  const key = model ?? "default";
  let client = modelClients.get(key);
  if (!client) {
    client = createOpenAIRevoraModelClient(model ? { model } : {});
    modelClients.set(key, client);
  }
  return client;
}

export function createCheckRouteHandler(deps: CheckRouteDeps = {}) {
  const checkFoodImpl = deps.checkFoodImpl ?? checkFood;
  const emitEvent = deps.emitEvent ?? emitSafeEvent;
  const modelFactory = deps.modelFactory ?? getModelClient;
  const now = deps.now ?? Date.now;
  const db = deps.db ?? getDb;
  const getSession = deps.getSession ?? getSessionInfo;
  const playLookup = deps.playLookup ?? fetchPlaySubscription;
  const stripe = deps.stripeClient ?? defaultCheckStripe;
  const paywallModeDep = deps.paywallMode ?? (() => paywallMode());

  return async function POST(request: Request) {
    const startedAt = now();
    const environment = getEnvironment();
    let body: unknown = null;

    try {
      body = await request.json();
    } catch {
      body = null;
    }

    // HS-1: clinical/emergency routing must never be preempted by the paywall.
    // A signed-in user without an active entitlement who describes acute
    // symptoms needs the deterministic "see a person" redirect, not a 402
    // upsell. checkFood runs classifyClinicalRisk before any model call and
    // returns the clinical card at zero cost, so clinical-matching inputs skip
    // the entitlement wall below. A clinical match can only yield the clinical
    // card (never a meal verdict), so this grants no free check and no abuse.
    const clinicalPreempt =
      typeof (body as { food?: unknown } | null)?.food === "string" &&
      classifyClinicalRisk((body as { food: string }).food) !== null;

    // 4D free tier, enforced server-side BEFORE any model spend. Signed-in
    // only (guests are metered by the existing IP rate limit).
    //
    // RE-01: the failure stances are SPLIT, not one fail-open blanket. The
    // trial wall is a paid boundary — a DB error there fails CLOSED (retry
    // card, no model spend) so partial degradation can never hand out paid
    // checks. Session resolution and the legacy courtesy cap keep failing
    // open: a session hiccup demotes to the IP-metered guest path, and the
    // courtesy cap is availability-first by design.
    let session: Awaited<ReturnType<typeof getSession>> = null;
    try {
      session = await getSession();
    } catch (error) {
      await captureServerError(error, "route");
    }

    if (session && !clinicalPreempt) {
      const mode = paywallModeDep();
      const readEntitlement = () =>
        getEntitlement(db(), session!.userId, {
          refreshPlaySubscription: (token) => playLookup(token),
          // Heal a lost-renewal Stripe row on the hot path too (reviewer #3):
          // the row is only re-checked when premium-status AND past its period
          // end AND not verified in the last hour, so this is ≤1 Stripe call
          // per hour per row — cheap next to denying a paying user their checks.
          refreshStripeSubscription: (subscriptionId, fallbackPeriodEnd) =>
            fetchStripeSubscription(stripe(), subscriptionId, fallbackPeriodEnd)
        });

      if (mode === "trial") {
        let entitlement;
        try {
          entitlement = await readEntitlement();
        } catch (error) {
          await captureServerError(error, "route");
          // Fail CLOSED: the wall is unreadable, so no paid spend — a retry
          // card, not a free check and not a 402 (the user may well be paid).
          emitEvent({
            name: "check_failed",
            environment,
            reasonCode: "server_error",
            latencyBucket: getLatencyBucket(now() - startedAt)
          });
          return NextResponse.json(
            {
              kind: "retry",
              message:
                "Prediabetes Pal had a hiccup checking your plan. Please try again in a moment.",
              disclaimer: loadSafetyContract().copy.disclaimer
            },
            { status: 503 }
          );
        }

        // Hard wall: any signed-in user without an active entitlement
        // (lapsed/none) is stopped before any model spend — no residual free
        // checks, so countChecksToday never runs. trialing/premium fall
        // through untouched. reasonCode "daily_cap" is reused deliberately;
        // the mode is distinguishable from the paywall config in analysis.
        if (entitlement.tier !== "premium") {
          emitEvent({
            name: "check_failed",
            environment,
            reasonCode: "daily_cap",
            latencyBucket: getLatencyBucket(now() - startedAt)
          });
          return NextResponse.json(
            {
              kind: "upsell",
              upsellKind: "trial",
              message: TRIAL_WALL_MESSAGE,
              disclaimer: loadSafetyContract().copy.disclaimer
            },
            { status: 402 }
          );
        }
      } else {
        try {
          const entitlement = await readEntitlement();
          if (entitlement.tier === "free") {
            const [profile] = await db()
              .select({ timezone: schema.profiles.timezone })
              .from(schema.profiles)
              .where(eq(schema.profiles.userId, session.userId));
            const used = await countChecksToday(
              db(),
              session.userId,
              profile?.timezone ?? "America/New_York"
            );

            if (used >= FREE_DAILY_CHECKS) {
              emitEvent({
                name: "check_failed",
                environment,
                reasonCode: "daily_cap",
                latencyBucket: getLatencyBucket(now() - startedAt)
              });
              return NextResponse.json(
                {
                  kind: "upsell",
                  upsellKind: "legacy",
                  message: FREE_LIMIT_MESSAGE,
                  disclaimer: loadSafetyContract().copy.disclaimer
                },
                { status: 402 }
              );
            }
          }
        } catch (error) {
          // Courtesy free cap only — availability wins here, by design.
          await captureServerError(error, "route");
        }
      }

      // RE-04: per-USER model-spend cap (the proxy's buckets are IP-keyed, so
      // one account rotating IPs could exhaust the global daily cap for
      // everyone). Generous — 200/day — and fails open inside the helper.
      const spend = await checkUserSpendLimit(session.userId);
      if (!spend.ok) {
        emitEvent({
          name: "check_failed",
          environment,
          reasonCode: "rate_limited",
          latencyBucket: getLatencyBucket(now() - startedAt)
        });
        return NextResponse.json(
          {
            kind: "retry",
            message:
              "You've reached today's check limit. Please come back tomorrow.",
            disclaimer: loadSafetyContract().copy.disclaimer
          },
          {
            status: 429,
            headers: { "Retry-After": String(spend.retryAfterSeconds) }
          }
        );
      }
    }

    // Task 13 snapshot sink: postprocess writes which conservative floor fired
    // (if any) here, so the persisted card records what the user actually saw.
    // Starts as "no floor"; a mocked checkFoodImpl leaves it untouched.
    const snapshot: SnapshotMetadata = {
      floorApplied: null,
      usedFallback: false
    };

    try {
      let modelFailure: unknown;
      const response = await checkFoodImpl(body, {
        // AUD-025: lazy — the client is constructed only if a model call is
        // actually needed. Deterministic routes (clinical, out-of-scope,
        // invalid, not_food, clarify) must return even when the provider
        // credential is missing or broken.
        model: () => modelFactory(undefined),
        // One-clarification cap (§8/P1.3): the client sets this header when the
        // submission is the user's answer to a prior clarify, so the precheck
        // does not chain into a second ambiguity question. Forgeable and
        // harmless if forged — it can only suppress a clarify, never a floor or
        // a clinical route.
        clarified: request.headers.get("x-revora-clarified") === "1",
        snapshot,
        onModelError(error) {
          modelFailure = error;
        }
      });

      const durationMs = now() - startedAt;

      const modelTruth = {
        model: activeModelId(),
        modelProvider: activeModelProvider(),
        promptVersion: PROMPT_VERSION,
        contractVersion: CONTRACT_VERSION
      } as const;

      if (response.kind === "retry") {
        // checkFood deliberately converts provider/schema exceptions into calm
        // retry copy. That is a user-safety boundary, not a successful check:
        // retain the fallback while recording the operational truth.
        emitEvent({
          name: "check_failed",
          environment,
          responseKind: response.kind,
          reasonCode: modelFailure
            ? classifyFailureReason(modelFailure)
            : "schema_error",
          latencyBucket: getLatencyBucket(durationMs),
          durationMs,
          ...modelTruth
        });
      } else {
        emitEvent({
          name: "check_completed",
          environment,
          responseKind: response.kind,
          risk: response.kind === "result" ? response.risk : undefined,
          // W-01: which clinical class fired — never the text that matched it.
          clinicalRoute:
            response.kind === "clinical" ? response.route : undefined,
          latencyBucket: getLatencyBucket(durationMs),
          // W-13: raw ms makes p95 computable (the buckets never could); the
          // model + version stamps make a reported bad answer reproducible.
          durationMs,
          ...modelTruth
        });
      }

      // Decision card v2 (plan P1): coach outputs are derived rule-based from
      // the engine response at the route layer — the engine stays untouched.
      //
      // W-17: the food text decides suppression (a drink gets no plate-
      // sequencing tip) and the rotation counter cycles the phrase bank so a
      // daily user is not read the same three sentences every day. Both are
      // used to select AUDITED copy and neither is logged. Computed ONCE here so
      // the persisted snapshot card is byte-identical to what the client renders.
      const coach = deriveCoachOutputs(response, {
        food: readFood(body),
        rotation: readRotation(request.headers),
        seed: request.headers.get("x-revora-client-id") ?? undefined,
        daypart: readDaypart(request.headers)
      });

      // 4B / §P3.1: immutable meal-memory snapshot for signed-in users.
      // Fail-soft by design — a broken DB must never break the check itself
      // (incident runbook scenario).
      //
      // The persisted id is threaded back to the client (result kind only, and
      // only when a row was actually stored) so result-linked feedback (§P1.6)
      // can reference it. Guests and non-persisted checks get no id — the
      // client's feedback surface then stays anonymous.
      let persistedCheckId: string | undefined;
      // RE-10: fail-soft must not be SILENT. When the row genuinely failed to
      // store (vs. a guest, who never persists), the client is told so it can
      // show a quiet "shown, not saved" note instead of a false success — a
      // journaling product that silently drops entries poisons its own trust.
      let persistFailed = false;
      if (response.kind === "result") {
        try {
          persistedCheckId = await persistCheck({
            db,
            getSession,
            body,
            result: response,
            coach,
            snapshot,
            headers: request.headers
          });
        } catch (error) {
          persistFailed = true;
          await captureServerError(error, "route");
        }
      }

      return NextResponse.json({
        ...response,
        ...(persistedCheckId ? { checkId: persistedCheckId } : {}),
        ...(persistFailed ? { persisted: false } : {}),
        ...coach
      });
    } catch (error) {
      // Surface schema/infra throws to Sentry (awaited, guarded, no-op without
      // SENTRY_DSN), then keep the existing safe telemetry + calm retry response
      // unchanged. captureServerError never throws, so the calm-retry contract
      // below always runs.
      await captureServerError(error, "route");

      const durationMs = now() - startedAt;
      emitEvent({
        name: "check_failed",
        environment,
        reasonCode: classifyFailureReason(error),
        latencyBucket: getLatencyBucket(durationMs),
        durationMs,
        model: activeModelId(),
        modelProvider: activeModelProvider(),
        promptVersion: PROMPT_VERSION,
        contractVersion: CONTRACT_VERSION
      });

      const retry = buildRetryResponse(loadSafetyContract());
      return NextResponse.json({ ...retry, ...deriveCoachOutputs(retry) });
    }
  };
}

export const POST = createCheckRouteHandler();

async function persistCheck(input: {
  db: () => Db;
  getSession: () => Promise<SessionInfo>;
  body: unknown;
  result: Extract<RevoraUserResponse, { kind: "result" }>;
  coach: CoachOutputs;
  snapshot: SnapshotMetadata;
  headers: Headers;
}): Promise<string | undefined> {
  const session = await input.getSession();
  if (!session) {
    return undefined; // guests: nothing stored, existing promise intact
  }

  const parsed = CheckRequestSchema.safeParse(input.body);
  if (!parsed.success) {
    return undefined;
  }

  const route = routeA1C(parsed.data.a1c);
  if (route.kind !== "in_scope") {
    return undefined;
  }

  // A signed-in session is not consent. Persist only while the consent-bearing
  // profile exists; withdrawing stored-health-data consent deletes that row.
  const [profile] = await input
    .db()
    .select({ consentedAt: schema.profiles.consentedAt })
    .from(schema.profiles)
    .where(eq(schema.profiles.userId, session.userId));
  if (!profile?.consentedAt) {
    return undefined;
  }

  const methodHeader = input.headers.get("x-revora-input-method");
  const rawClientId = input.headers.get("x-revora-client-id");
  const clientId = rawClientId && rawClientId.length <= 64 ? rawClientId : null;

  // §P3.1 immutable snapshot: encrypt the exact card the user saw (verdict +
  // coach fields) as one JSON blob — same AES-256-GCM standard as food, so no
  // plaintext card content is ever at rest.
  const result = input.result;
  const cardCiphertext = encryptField(
    JSON.stringify({
      risk: result.risk,
      reason: result.reason,
      adjustment: result.adjustment,
      swap: result.swap,
      sequencingTip: input.coach.sequencingTip,
      postMealAction: input.coach.postMealAction,
      keepMost: input.coach.keepMost
    })
  );

  // Clarification asked (§P3.1). The QUESTION is not health text: it is one of
  // three approved deterministic strings reconstructed from a bounded category
  // the client sends (same closed enum analytics already carries), never the
  // raw question or meal text over the wire. Stored only when this check truly
  // resolved a clarification. The ANSWER is this check's own normalized input
  // (foodCiphertext), so clarifyAnswerCiphertext stays null by construction.
  const wasClarified = input.headers.get("x-revora-clarified") === "1";
  const clarifyQuestion = wasClarified
    ? clarifyQuestionFromHeader(input.headers)
    : null;

  const inserted = await input
    .db()
    .insert(schema.checks)
    .values({
      userId: session.userId,
      foodCiphertext: encryptField(parsed.data.food),
      risk: result.risk,
      responseKind: result.kind,
      a1cBand: route.band,
      inputMethod:
        methodHeader === "voice" || methodHeader === "photo"
          ? methodHeader
          : "text",
      clientId,
      // Immutable snapshot fields — written once, here, never updated.
      cardCiphertext,
      routeType: result.kind,
      clarifyQuestionCiphertext: clarifyQuestion
        ? encryptField(clarifyQuestion)
        : null,
      clarifyAnswerCiphertext: null,
      wasClarified,
      promptVersion: PROMPT_VERSION,
      contractVersion: CONTRACT_VERSION,
      modelId: activeModelId(),
      floorApplied: input.snapshot.floorApplied,
      usedFallback: input.snapshot.usedFallback
    })
    .onConflictDoNothing()
    .returning({ id: schema.checks.id });

  if (inserted.length > 0) {
    return inserted[0].id;
  }

  // The insert was a dedupe no-op (same clientId already stored). Recover the
  // existing row's id so a re-submitted check still links feedback to the one
  // canonical row rather than dropping the association.
  if (clientId) {
    const [existing] = await input
      .db()
      .select({ id: schema.checks.id })
      .from(schema.checks)
      .where(
        and(
          eq(schema.checks.userId, session.userId),
          eq(schema.checks.clientId, clientId)
        )
      );
    return existing?.id;
  }

  return undefined;
}

function getEnvironment(
  input: NodeJS.ProcessEnv = process.env
): SafeTelemetryEvent["environment"] {
  if (input.NODE_ENV === "test") {
    return "test";
  }

  switch (input.VERCEL_ENV) {
    case "preview":
      return "preview";
    case "production":
      return "production";
    case "development":
      return "development";
    default:
      return input.NODE_ENV === "production" ? "production" : "development";
  }
}

/**
 * The food text, read defensively off the raw body (which is `unknown` here —
 * the engine does its own strict parse). Used ONLY to pick which audited coach
 * sentence to render; never persisted, never logged, never sent to telemetry.
 */
function readFood(body: unknown): string | undefined {
  if (!body || typeof body !== "object" || !("food" in body)) {
    return undefined;
  }

  const food = (body as { food: unknown }).food;
  return typeof food === "string" ? food : undefined;
}

/**
 * Monotonic per-client counter that cycles the coach phrase bank (W-17).
 *
 * Client-supplied and therefore forgeable — which is fine, because the only
 * thing it can influence is WHICH pre-approved sentence a user sees. It touches
 * no verdict, no entitlement, and no safety floor. Absent (older clients,
 * curl) → the bank falls back to hashing the per-check id.
 */
function readRotation(headers: Headers): number | undefined {
  const raw = headers.get("x-revora-coach-rotation");
  if (!raw) {
    return undefined;
  }

  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * The approved clarify question this check resolved (§P3.1), reconstructed from
 * the bounded category header (`x-revora-clarify-category`).
 *
 * The client sends the closed `ClarifyReason` enum — the SAME bounded value it
 * already puts on the `clarification_resolved` analytics event — never the raw
 * question or the meal text (plan §16: no health text in headers/URLs). The
 * server maps it to the canonical approved copy, so the stored question is
 * exactly what was asked and can never be a fabricated or user-authored string.
 * An absent/unknown category yields null (older clients, curl).
 */
function clarifyQuestionFromHeader(headers: Headers): string | null {
  const category = headers.get("x-revora-clarify-category");
  if (category && Object.prototype.hasOwnProperty.call(CLARIFY_QUESTIONS, category)) {
    return CLARIFY_QUESTIONS[category as ClarifyReason];
  }
  return null;
}

const DAYPARTS: readonly Daypart[] = ["breakfast", "lunch", "dinner"];

/**
 * The client's local daypart (W-17). Same trust model as the rotation counter:
 * forgeable, and harmless if forged — the only thing it can steer is WHICH
 * pre-approved sentence appears. Validated against the closed set anyway, so a
 * junk header falls back to the general phrase bank instead of indexing into
 * nothing.
 */
function readDaypart(headers: Headers): Daypart | undefined {
  const raw = headers.get("x-revora-daypart");
  return DAYPARTS.find((daypart) => daypart === raw);
}

function getLatencyBucket(
  durationMs: number
): NonNullable<SafeTelemetryEvent["latencyBucket"]> {
  if (durationMs < 2_000) {
    return "<2s";
  }

  if (durationMs < 5_000) {
    return "2-5s";
  }

  if (durationMs <= 12_000) {
    return "5-12s";
  }

  return ">12s";
}

function classifyFailureReason(
  error: unknown
): NonNullable<SafeTelemetryEvent["reasonCode"]> {
  if (
    error &&
    typeof error === "object" &&
    "status" in error &&
    error.status === 429
  ) {
    return "rate_limited";
  }

  if (error instanceof SyntaxError) {
    return "schema_error";
  }

  // Network blip vs provider outage split (REL-01).
  if (error instanceof Error && error.name === "RevoraConnectionError") {
    return "connection_blip";
  }

  if (error instanceof Error && /schema|zod|json/i.test(error.message)) {
    return "schema_error";
  }

  return "provider_error";
}
