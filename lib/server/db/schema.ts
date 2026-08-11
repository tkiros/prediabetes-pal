import { isNotNull, sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid
} from "drizzle-orm/pg-core";
import type { AdapterAccountType } from "next-auth/adapters";

/**
 * Plan §3.3. Exact A1C and food text are stored ONLY as AES-256-GCM
 * ciphertext (lib/server/crypto.ts). Coarse, query-needed fields (risk,
 * band, timestamps) stay plaintext so coach compute never decrypts.
 */

// ── Auth.js standard tables (@auth/drizzle-adapter shape) ──────────────────

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: timestamp("email_verified", { withTimezone: true }),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow()
});

export const accounts = pgTable(
  "accounts",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    // AUD-006: Unix-epoch seconds — smallint overflowed at 32767. Email-only
    // auth never writes it, but OAuth would on day one.
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state")
  },
  (table) => [
    primaryKey({ columns: [table.provider, table.providerAccountId] })
  ]
);

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { withTimezone: true }).notNull()
});

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { withTimezone: true }).notNull()
  },
  (table) => [primaryKey({ columns: [table.identifier, table.token] })]
);

// ── Prediabetes Pal stateful layer ───────────────────────────────────────────────────

export const profiles = pgTable("profiles", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  a1cCiphertext: text("a1c_ciphertext").notNull(),
  a1cBand: text("a1c_band", {
    enum: ["prediabetes_57_59", "prediabetes_60_62", "prediabetes_63_64"]
  }).notNull(),
  timezone: text("timezone").notNull().default("America/New_York"),
  nudgeOptIn: boolean("nudge_opt_in").notNull().default(false),
  nudgeHour: smallint("nudge_hour").notNull().default(11),
  // Personal journey nudges (Task 19 / §P4.3). Cadence the user chose and an
  // optional quiet-hours window the cron respects. `nudgeCadence` defaults to
  // "daily" so existing opted-in users keep the one-per-day behavior; the quiet
  // columns are nullable and null means "no quiet window" (never suppressed).
  // Hours are 0–23 local-hour integers; a wrap-around window (start > end) is
  // valid (e.g. 22 → 7). Bounded enums/ranges only — no health data here.
  nudgeCadence: text("nudge_cadence", {
    enum: ["daily", "few_per_week", "weekly"]
  })
    .notNull()
    .default("daily"),
  nudgeQuietStart: smallint("nudge_quiet_start"),
  nudgeQuietEnd: smallint("nudge_quiet_end"),
  onboardedAt: timestamp("onboarded_at", { withTimezone: true }),
  consentedAt: timestamp("consented_at", { withTimezone: true }).notNull()
}, (table) => [
  check(
    "profiles_nudge_cadence_check",
    sql`${table.nudgeCadence} IN ('daily','few_per_week','weekly')`
  ),
  check(
    "profiles_nudge_quiet_start_check",
    sql`${table.nudgeQuietStart} IS NULL OR (${table.nudgeQuietStart} >= 0 AND ${table.nudgeQuietStart} <= 23)`
  ),
  check(
    "profiles_nudge_quiet_end_check",
    sql`${table.nudgeQuietEnd} IS NULL OR (${table.nudgeQuietEnd} >= 0 AND ${table.nudgeQuietEnd} <= 23)`
  )
]);

export const checks = pgTable(
  "checks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    foodCiphertext: text("food_ciphertext").notNull(),
    risk: text("risk", { enum: ["SAFE", "MODERATE", "HIGH"] }).notNull(),
    responseKind: text("response_kind").notNull().default("result"),
    a1cBand: text("a1c_band").notNull(),
    inputMethod: text("input_method", {
      enum: ["text", "voice", "photo"]
    })
      .notNull()
      .default("text"),
    clientId: text("client_id"),
    actionDoneAt: timestamp("action_done_at", { withTimezone: true }),
    // ── Immutable check-result snapshot (Task 13 / §P3.1, §8 `check_results`) ──
    //
    // APPEND-ONLY BOUNDARY. Every column below is written EXACTLY ONCE, at
    // insert, by persistCheck() (app/api/check/route.ts). No handler updates any
    // of them — a rerun creates a NEW row, never overwriting an old card (§12
    // immutable snapshots). The ONLY post-insert mutation of a checks row is
    // `actionDoneAt` (createHistoryActionHandler), which is user-activity
    // metadata, not snapshot content; that boundary is asserted by
    // check-snapshot.test.ts.
    //
    // All are nullable so the migration is forward/backward compatible: rows
    // written before this task keep working and read back as null (we never
    // invent a card we did not store). `cardCiphertext` holds the encrypted JSON
    // card the user actually saw {risk, reason, adjustment, swap, coach fields};
    // health-adjacent, so AES-256-GCM like foodCiphertext.
    cardCiphertext: text("card_ciphertext"),
    // Plaintext route/response class — NOT sensitive (mirrors responseKind).
    // Only in-scope results are persisted, so this is "result" today; the column
    // exists so the snapshot carries its own route class if that boundary widens.
    routeType: text("route_type"),
    // Clarification asked + answer supplied (§P3.1). The QUESTION is one of three
    // approved deterministic strings (lib/pal/clarify.ts) reconstructed
    // server-side from a bounded category — never health text, encrypted anyway.
    // The ANSWER is, by construction, this check's own normalized input
    // (foodCiphertext), so clarifyAnswerCiphertext is left null rather than
    // duplicating encrypted health text; `wasClarified` records that this result
    // resolved a one-question clarification.
    clarifyQuestionCiphertext: text("clarify_question_ciphertext"),
    clarifyAnswerCiphertext: text("clarify_answer_ciphertext"),
    wasClarified: boolean("was_clarified").notNull().default(false),
    // Reproducibility stamps (plaintext version strings).
    promptVersion: text("prompt_version"),
    contractVersion: text("contract_version"),
    modelId: text("model_id"),
    // Safety-floor + fallback metadata surfaced from postprocess. `floorApplied`
    // is the conservative floor that fired (null when the model draft stood);
    // `usedFallback` is true when a floor/template replaced that draft.
    floorApplied: text("floor_applied", {
      enum: ["high_risk", "carbs_only", "borderline"]
    }),
    usedFallback: boolean("used_fallback").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow()
  },
  (table) => [
    index("checks_user_day").on(table.userId, table.createdAt.desc()),
    uniqueIndex("checks_migration_dedupe")
      .on(table.userId, table.clientId)
      .where(isNotNull(table.clientId)),
    check("checks_risk_check", sql`${table.risk} IN ('SAFE','MODERATE','HIGH')`),
    check(
      "checks_input_method_check",
      sql`${table.inputMethod} IN ('text','voice','photo')`
    ),
    check(
      "checks_floor_applied_check",
      sql`${table.floorApplied} IS NULL OR ${table.floorApplied} IN ('high_risk','carbs_only','borderline')`
    )
  ]
);

// Result-linked structured feedback + safety queue (plan §P1.6, §4.6, §8).
//
// One feedback row per (check, user) — upserted on re-submit. The private
// comment is health-adjacent free text → AES-256-GCM ciphertext, same standard
// as checks.food; it is stored here, in the access-controlled operational
// store, and NEVER in the analytics stream (which carries submission presence
// only). `reviewStatus` drives the founder-only safety queue: a reason of
// `unsafe_feeling`, or a not-helpful `wrong_food` (wrong-direction), enqueues
// the row for human review. Feedback never trains or alters live behavior.
export const checkFeedback = pgTable(
  "check_feedback",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    checkId: uuid("check_id")
      .notNull()
      .references(() => checks.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    helpful: boolean("helpful").notNull(),
    reason: text("reason", {
      enum: [
        "too_vague",
        "wrong_food",
        "unsafe_feeling",
        "confusing",
        "other"
      ]
    }),
    commentCiphertext: text("comment_ciphertext"),
    reviewStatus: text("review_status", {
      enum: ["none", "queued", "reviewed"]
    })
      .notNull()
      .default("none"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow()
  },
  (table) => [
    uniqueIndex("check_feedback_check_user").on(table.checkId, table.userId),
    index("check_feedback_queue").on(table.reviewStatus, table.createdAt),
    check(
      "check_feedback_reason_check",
      sql`${table.reason} IS NULL OR ${table.reason} IN ('too_vague','wrong_food','unsafe_feeling','confusing','other')`
    ),
    check(
      "check_feedback_review_status_check",
      sql`${table.reviewStatus} IN ('none','queued','reviewed')`
    )
  ]
);

// User-authored meal memory (plan §P3.2, §8 entity `meal_memories`).
//
// The user attaches, to a check they already ran: what they chose, whether they
// would choose it again, how easy it felt, a private note, a favorite flag, and
// a self-chosen label. NEVER an input to card-band logic — nothing in
// lib/pal/* imports this table, and meal-memory-non-interference.test.ts
// asserts that structurally (global constraint §1). Memory is anchored on a
// check (`checkId`, cascade) and unique per (user, check) so a save upserts the
// single row rather than piling duplicates.
//
// Free text is health-adjacent → AES-256-GCM ciphertext, same standard as
// checks.food: `choiceCiphertext` ("what I chose") and `noteCiphertext` (the
// private note). The reflections that must stay QUERYABLE / bounded are stored
// as closed enums, NOT free text: `easeReflection` (easy|okay|hard) and `label`
// (a fixed meal-context vocabulary). `wouldRepeat` is a plain nullable boolean.
// Deliberately absent: any glucose reading, any risk band derived from the
// note, any claim a choice "worked" — this phase does not infer or interpret
// health outcomes (plan §P3.2 "Do not").
export const mealMemories = pgTable(
  "meal_memories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    checkId: uuid("check_id")
      .notNull()
      .references(() => checks.id, { onDelete: "cascade" }),
    choiceCiphertext: text("choice_ciphertext"),
    wouldRepeat: boolean("would_repeat"),
    easeReflection: text("ease_reflection", {
      enum: ["easy", "okay", "hard"]
    }),
    noteCiphertext: text("note_ciphertext"),
    favorite: boolean("favorite").notNull().default(false),
    label: text("label", {
      enum: [
        "breakfast",
        "lunch",
        "dinner",
        "snack",
        "restaurant",
        "travel",
        "family_meal",
        "other"
      ]
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
  },
  (table) => [
    uniqueIndex("meal_memories_user_check").on(table.userId, table.checkId),
    index("meal_memories_user").on(table.userId, table.createdAt.desc()),
    check(
      "meal_memories_ease_check",
      sql`${table.easeReflection} IS NULL OR ${table.easeReflection} IN ('easy','okay','hard')`
    ),
    check(
      "meal_memories_label_check",
      sql`${table.label} IS NULL OR ${table.label} IN ('breakfast','lunch','dinner','snack','restaurant','travel','family_meal','other')`
    )
  ]
);

// 90-day Learning Journey (plan §P4.1, §8 entity `learning_journeys`:
// "Explicit state machine; no hidden reset"). ONE row per user (`user_id`
// UNIQUE) — the journey is a singleton per account. There is NO stage column:
// the stage and current day are DERIVED purely from startedAt + now + pause
// history (lib/journey/state.ts), the single source, so a stored stage can
// never drift from the day math. The `not_started` state is the ABSENCE of a
// row — the persisted `state` enum is only the four post-start states. Pause
// freezes the day count: `accumulated_pause_ms` banks completed pauses and
// `paused_at` marks the live one. Nothing here feeds the check engine (global
// constraint §1) — a journey is a frame around the product, never an input to a
// verdict.
export const learningJourneys = pgTable(
  "learning_journeys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: "cascade" }),
    state: text("state", {
      enum: ["active", "paused", "graduated", "maintenance"]
    }).notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    pausedAt: timestamp("paused_at", { withTimezone: true }),
    // Frozen paused time from all resumed pauses, in ms. bigint (not integer):
    // a long-paused journey can bank more ms than a 32-bit int holds. `mode:
    // "number"` — the value is always well within Number.MAX_SAFE_INTEGER
    // (90 days ≈ 7.8e9 ms), so the JS number round-trips exactly.
    accumulatedPauseMs: bigint("accumulated_pause_ms", { mode: "number" })
      .notNull()
      .default(0),
    graduatedAt: timestamp("graduated_at", { withTimezone: true }),
    maintenanceAt: timestamp("maintenance_at", { withTimezone: true }),
    // Why the CURRENT pause was taken (plan §P4.4). Bounded enum, nullable: null
    // whenever the journey is not paused, or when a pause was taken without a
    // reason. Set on pause, cleared on resume (lib/journey/state.ts). A bounded
    // reason class — never free text, never health data.
    pauseReason: text("pause_reason", {
      enum: ["need_a_break", "life_event", "not_useful_now", "other"]
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
  },
  (table) => [
    check(
      "learning_journeys_state_check",
      sql`${table.state} IN ('active','paused','graduated','maintenance')`
    ),
    check(
      "learning_journeys_pause_reason_check",
      sql`${table.pauseReason} IS NULL OR ${table.pauseReason} IN ('need_a_break','life_event','not_useful_now','other')`
    )
  ]
);

// Weekly learning artifact (plan §P4.2, §8 entity `weekly_reflections`:
// "Versioned weekly learning artifact. Derived only from allowed fields;
// reproducible."). ONE row per (user, week): the deterministic projection
// (lib/journey/weekly-learning.deriveWeeklyLearning) for a COMPLETED week,
// persisted lazily the first time it is requested — there is no cron. The
// CURRENT (in-progress) week is computed on the fly and never stored, so a row
// here is always a finished, reproducible week.
//
// `artifactCiphertext` is the AES-256-GCM ciphertext of the artifact JSON. The
// artifact carries `repeatedUncertainty` — the user's OWN meal text echoed back
// to them — so it is health-adjacent and encrypted at rest, same standard as
// checks.food (global constraint §5); it is decrypted only for the owner on
// read. `version` is the projection version (WEEKLY_LEARNING_VERSION) the row
// was built at: a persisted row from an older version is ignored and recomputed
// so a versioned re-projection can never silently mix schemas. Nothing here
// feeds the check engine (global constraint §1).
export const weeklyReflections = pgTable(
  "weekly_reflections",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    weekStart: date("week_start").notNull(),
    version: text("version").notNull(),
    artifactCiphertext: text("artifact_ciphertext").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow()
  },
  (table) => [primaryKey({ columns: [table.userId, table.weekStart] })]
);

export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull().unique(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    // Success-only local-day marker. Delivery attempts use the separate
    // bounded state below so "never due" cannot be confused with "failed".
    lastNudgeDate: date("last_nudge_date"),
    nudgeAttemptDate: date("nudge_attempt_date"),
    nudgeAttemptCount: smallint("nudge_attempt_count").notNull().default(0),
    nudgeRetryAfter: timestamp("nudge_retry_after", { withTimezone: true }),
    nudgeLeaseToken: uuid("nudge_lease_token"),
    nudgeLeaseUntil: timestamp("nudge_lease_until", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow()
  },
  (table) => [
    check(
      "push_nudge_attempt_count_check",
      sql`${table.nudgeAttemptCount} BETWEEN 0 AND 3`
    ),
    check(
      "push_nudge_attempt_state_check",
      sql`(${table.nudgeAttemptDate} IS NULL AND ${table.nudgeAttemptCount} = 0) OR (${table.nudgeAttemptDate} IS NOT NULL AND ${table.nudgeAttemptCount} BETWEEN 1 AND 3)`
    ),
    check(
      "push_nudge_lease_pair_check",
      sql`(${table.nudgeLeaseToken} IS NULL) = (${table.nudgeLeaseUntil} IS NULL)`
    ),
    check(
      "push_nudge_retry_state_check",
      sql`${table.nudgeRetryAfter} IS NULL OR (${table.nudgeAttemptDate} IS NOT NULL AND ${table.nudgeLeaseToken} IS NULL)`
    )
  ]
);

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider", { enum: ["play", "stripe"] }).notNull(),
    providerRef: text("provider_ref").notNull().unique(),
    productId: text("product_id").notNull(),
    status: text("status", {
      enum: ["active", "trialing", "canceled", "grace", "expired", "refunded"]
    }).notNull(),
    priceVariant: text("price_variant"),
    termsVersion: text("terms_version"),
    termsAcceptedAt: timestamp("terms_accepted_at", { withTimezone: true }),
    preChargeEmailSentAt: timestamp("pre_charge_email_sent_at", {
      withTimezone: true
    }),
    currentPeriodEnd: timestamp("current_period_end", {
      withTimezone: true
    }).notNull(),
    // BC-2: a canceled-but-unexpired subscriber must see "Access until X —
    // will not renew", never a fabricated "Renews X". Persisted from Stripe's
    // cancel_at_period_end (webhook) and set optimistically by the cancel
    // endpoints so the truth survives a page reload.
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
    // Stripe self-healing (Task 8 / P2.2). `lastEventAt` is the provider event
    // `created` time of the newest webhook the reducer has applied to this row;
    // it makes the entitlement reducer order-tolerant — a replayed or
    // out-of-order event whose `created` predates this is stale and must not
    // downgrade newer state (latest-event-wins per providerRef). `lastVerifiedAt`
    // time-gates Stripe verify-on-read so a stale row is re-checked against the
    // Stripe API at most once per hour, never on every read.
    lastEventAt: timestamp("last_event_at", { withTimezone: true }),
    lastVerifiedAt: timestamp("last_verified_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
  },
  (table) => [
    index("subscriptions_user").on(table.userId, table.status),
    check(
      "subscriptions_provider_check",
      sql`${table.provider} IN ('play','stripe')`
    ),
    check(
      "subscriptions_status_check",
      sql`${table.status} IN ('active','trialing','canceled','grace','expired','refunded')`
    )
  ]
);

// Stripe self-healing (Task 8 / P2.2, §8 entity `billing_event_inbox`).
//
// Durable inbox for signed provider webhook events. The webhook verifies the
// signature, writes the event HERE first, then processes it — so the money
// path never depends on the process staying alive between "signature valid"
// and "entitlement written". `providerEventId` is UNIQUE: a duplicate delivery
// conflicts and is acked without re-applying. `status`/`attempts`/`lastError`
// carry retry + dead-letter metadata for the reconciliation sweep. `payload`
// is an allowlisted replay envelope, never the raw provider event: it retains
// only event timing/type plus the exact ids/status fields the reducer needs.
// Terminal rows are deleted after the bounded retention window.
export const billingEventInbox = pgTable(
  "billing_event_inbox",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    provider: text("provider", { enum: ["stripe"] })
      .notNull()
      .default("stripe"),
    providerEventId: text("provider_event_id").notNull().unique(),
    eventType: text("event_type").notNull(),
    payload: jsonb("payload").notNull(),
    status: text("status", {
      enum: ["pending", "processed", "failed", "dead_letter"]
    })
      .notNull()
      .default("pending"),
    attempts: smallint("attempts").notNull().default(0),
    lastError: text("last_error"),
    receivedAt: timestamp("received_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    processedAt: timestamp("processed_at", { withTimezone: true })
  },
  (table) => [
    // The sweep scans non-terminal rows (pending/failed) oldest-first.
    index("billing_event_inbox_status").on(table.status, table.receivedAt),
    check(
      "billing_event_inbox_provider_check",
      sql`${table.provider} IN ('stripe')`
    ),
    check(
      "billing_event_inbox_status_check",
      sql`${table.status} IN ('pending','processed','failed','dead_letter')`
    )
  ]
);

// Provider-accepted email is not the same as recipient delivery. This table
// stores a PII-minimized state machine keyed by the Resend message id. It never
// stores the address, subject, body, magic-link token, or provider event body.
// Rows expire after 30 days; durable suppressions below retain only an HMAC.
export const emailDeliveryAttempts = pgTable(
  "email_delivery_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    providerMessageId: text("provider_message_id").unique(),
    idempotencyKey: text("idempotency_key").notNull().unique(),
    recipientHash: text("recipient_hash").notNull(),
    category: text("category", {
      enum: [
        "unknown",
        "transactional",
        "auth_magic_link",
        "pantry_intake",
        "pantry_report",
        "pantry_alert",
        "trial_precharge",
        "payment_failed",
        "support_case"
      ]
    })
      .notNull()
      .default("transactional"),
    status: text("status", {
      enum: [
        "pending",
        "accepted",
        "sent",
        "delivered",
        "delayed",
        "bounced",
        "complained",
        "suppressed",
        "failed",
        "rejected",
        "rate_limited",
        "transport_failed"
      ]
    })
      .notNull()
      .default("pending"),
    lastErrorCode: text("last_error_code"),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    lastEventAt: timestamp("last_event_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull()
  },
  (table) => [
    index("email_delivery_status").on(table.status, table.updatedAt),
    index("email_delivery_expiry").on(table.expiresAt),
    check(
      "email_delivery_category_check",
      sql`${table.category} IN ('unknown','transactional','auth_magic_link','pantry_intake','pantry_report','pantry_alert','trial_precharge','payment_failed','support_case')`
    ),
    check(
      "email_delivery_status_check",
      sql`${table.status} IN ('pending','accepted','sent','delivered','delayed','bounced','complained','suppressed','failed','rejected','rate_limited','transport_failed')`
    )
  ]
);

export const emailSuppressions = pgTable(
  "email_suppressions",
  {
    recipientHash: text("recipient_hash").primaryKey(),
    reason: text("reason", {
      enum: ["bounced", "complained", "suppressed"]
    }).notNull(),
    providerMessageId: text("provider_message_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
  },
  (table) => [
    check(
      "email_suppression_reason_check",
      sql`${table.reason} IN ('bounced','complained','suppressed')`
    )
  ]
);

export const baiWeekly = pgTable(
  "bai_weekly",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    weekStart: date("week_start").notNull(),
    score: smallint("score").notNull(),
    adherence: smallint("adherence").notNull(),
    consistency: smallint("consistency").notNull(),
    action: smallint("action").notNull(),
    // How many checks this week carried a post-meal action (risk !== SAFE),
    // i.e. computeBai's promptedCount (lib/coach/bai.ts). Lets the UI say
    // "no post-meal actions this week" instead of rendering a misleading 0%
    // Follow-through bar when nobody was prompted.
    prompted: smallint("prompted").notNull().default(0),
    computedAt: timestamp("computed_at", { withTimezone: true })
      .notNull()
      .defaultNow()
  },
  (table) => [primaryKey({ columns: [table.userId, table.weekStart] })]
);

// P0.4 (C7 plan §9): authenticated help/refund cases. The message is
// user-authored free text near health context — encrypted at rest like every
// other user-authored field. Email carries only the case id/type; authenticated
// admins read/decrypt the queue through /api/admin/support. `status` is updated
// by that same surface.
export const supportCases = pgTable(
  "support_cases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    messageCiphertext: text("message_ciphertext").notNull(),
    status: text("status").notNull().default("open"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true })
  },
  (table) => [
    // Serves the export's ordered per-user read AND the users cascade delete
    // (Postgres does not auto-index FK columns).
    index("support_cases_user").on(table.userId, table.createdAt.desc()),
    check("support_cases_kind_check", sql`${table.kind} IN ('help','refund')`),
    check(
      "support_cases_status_check",
      sql`${table.status} IN ('open','resolved')`
    )
  ]
);

// Audit trail that retains no identity: user id is hashed before insert.
export const deletionLog = pgTable("deletion_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  userIdHash: text("user_id_hash").notNull(),
  requestedAt: timestamp("requested_at", { withTimezone: true }).notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }).notNull()
});

// P7 observability: one row per cron job, upserted at the end of a
// successful run. /api/health reads staleness off `lastRunAt` — no counts,
// no user data, just a liveness timestamp per job name ("nudge",
// "bai-weekly").
export const cronHeartbeat = pgTable("cron_heartbeat", {
  name: text("name").primaryKey(),
  lastRunAt: timestamp("last_run_at", { withTimezone: true }).notNull()
});

// ── Pantry Review pipeline (design doc 2026-07-04, eng review same day) ─────
//
// One-time paid report product, fully separate from `subscriptions` and
// `checks` (report items must NEVER land in `checks` — they would corrupt
// streaks/BAI/insights). Food names, portions, notes, and the report payload
// are health-adjacent → AES-256-GCM ciphertext, same standard as `checks`.
//
// Order state machine (one direction, sweep can re-enter processing):
//
//   paid ──▶ claimed ──▶ submitted ──▶ extracting ──▶ awaiting_confirm
//                                          │                 │
//                                          ▼                 ▼
//                                    needs_manual ◀──── processing ──▶ ready
//   (canceled reachable from any state via charge.refunded)
//
// `userId` is null until the buyer clicks the claim link and signs in —
// binding is by possession of `claimToken` (same trust model as magic-link
// auth), NOT by email equality (aliases/relays/typos break equality).

export const pantryOrders = pgTable(
  "pantry_orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    email: text("email").notNull(), // Stripe customer_details at purchase
    stripeSessionId: text("stripe_session_id").notNull().unique(), // webhook idempotency
    stripePaymentIntent: text("stripe_payment_intent"), // refund matching
    claimToken: text("claim_token").notNull().unique(),
    claimedAt: timestamp("claimed_at", { withTimezone: true }),
    status: text("status", {
      enum: [
        "paid",
        "claimed",
        "submitted",
        "extracting",
        "awaiting_confirm",
        "processing",
        "ready",
        "needs_manual",
        "canceled"
      ]
    })
      .notNull()
      .default("paid"),
    termsVersion: text("terms_version"),
    termsAcceptedAt: timestamp("terms_accepted_at", { withTimezone: true }),
    // Buyer provides at intake (no profile requirement) — same bands as profiles.
    a1cBand: text("a1c_band", {
      enum: ["prediabetes_57_59", "prediabetes_60_62", "prediabetes_63_64"]
    }),
    a1cCiphertext: text("a1c_ciphertext"),
    consentedAt: timestamp("consented_at", { withTimezone: true }), // Art. 9, at intake
    notesCiphertext: text("notes_ciphertext"),
    reportCiphertext: text("report_ciphertext"),
    // Processing lease: sweep may resume only after lease expiry; the
    // processor extends it while alive. Prevents double-runs (browser retry
    // vs cron overlap) without a queue.
    processingLeaseUntil: timestamp("processing_lease_until", {
      withTimezone: true
    }),
    intakeEmailSentAt: timestamp("intake_email_sent_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
  },
  (table) => [
    index("pantry_orders_user").on(table.userId),
    // Sweep scans non-terminal orders by age.
    index("pantry_orders_sweep").on(table.status, table.updatedAt),
    check(
      "pantry_orders_status_check",
      sql`${table.status} IN ('paid','claimed','submitted','extracting','awaiting_confirm','processing','ready','needs_manual','canceled')`
    )
  ]
);

export const pantryPhotos = pgTable(
  "pantry_photos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => pantryOrders.id, { onDelete: "cascade" }),
    blobUrl: text("blob_url").notNull(),
    status: text("status", {
      enum: ["uploaded", "extracted", "failed", "deleted"]
    })
      .notNull()
      .default("uploaded"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow()
  },
  (table) => [
    index("pantry_photos_order").on(table.orderId),
    check(
      "pantry_photos_status_check",
      sql`${table.status} IN ('uploaded','extracted','failed','deleted')`
    )
  ]
);

export const pantryItems = pgTable(
  "pantry_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => pantryOrders.id, { onDelete: "cascade" }),
    position: smallint("position").notNull().default(0),
    nameCiphertext: text("name_ciphertext").notNull(),
    portionCiphertext: text("portion_ciphertext"),
    source: text("source", { enum: ["vision", "buyer"] })
      .notNull()
      .default("vision"),
    status: text("status", {
      enum: ["draft", "confirmed", "judged", "failed"]
    })
      .notNull()
      .default("draft"),
    // Plaintext like checks.risk so the report summary strip aggregates
    // without decrypting; the full judged output stays ciphertext.
    risk: text("risk", { enum: ["SAFE", "MODERATE", "HIGH"] }),
    resultCiphertext: text("result_ciphertext"),
    attempts: smallint("attempts").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
  },
  (table) => [
    index("pantry_items_order").on(table.orderId, table.position),
    check(
      "pantry_items_source_check",
      sql`${table.source} IN ('vision','buyer')`
    ),
    check(
      "pantry_items_status_check",
      sql`${table.status} IN ('draft','confirmed','judged','failed')`
    ),
    check(
      "pantry_items_risk_check",
      sql`${table.risk} IS NULL OR ${table.risk} IN ('SAFE','MODERATE','HIGH')`
    )
  ]
);
