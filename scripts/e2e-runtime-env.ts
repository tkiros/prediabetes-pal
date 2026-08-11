/**
 * Browser tests must never inherit provider credentials from `.env` or
 * `.env.local`. Next loads those files even for an optimized local
 * `next start`, so every sensitive integration gets an explicit empty value
 * here. Empty process values win over file loading.
 *
 * The only mutable service the full E2E gate accepts is the caller-provided
 * disposable DATABASE_URL. Email is redirected to an owner-only disk mailbox;
 * all other provider paths are absent, synthetic, or deliberately disabled.
 */
const E2E_AUTH_SECRET = "pal-e2e-smoke-only-secret-0000000000000000";
const E2E_HEALTH_DATA_KEY =
  "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
const E2E_VAPID_PUBLIC_KEY =
  "BDd3_hVL9fZi9Ybo2UUmA0mNzLFmwEsuJdyxdCLVQV-XFotN0jkNqp7GQ96_2enX0mUeXBIvBqXAiCveKuMhGJ0";

function isolatedDatabaseUrl(value?: string): string {
  const candidate = value?.trim();
  if (!candidate) return "";

  let hostname = "";
  try {
    hostname = new URL(candidate).hostname;
  } catch {
    throw new Error("E2E DATABASE_URL must be a valid loopback Postgres URL.");
  }
  if (!["127.0.0.1", "localhost", "[::1]"].includes(hostname)) {
    throw new Error(
      "E2E DATABASE_URL must target a disposable loopback database."
    );
  }
  return candidate;
}

export function isolatedE2ERuntimeEnv(
  base: Partial<NodeJS.ProcessEnv> = process.env
): NodeJS.ProcessEnv {
  // The private-store Pantry specs are live provider proofs: they need the
  // dedicated private Blob token, and the report-delivery case additionally
  // judges live (no stub, deliberately). E2E_PANTRY_LIVE=1 is the explicit
  // operator opt-in for exactly those two credentials; every other provider
  // credential stays blanked, and a default run stays fully isolated.
  const pantryLive = base.E2E_PANTRY_LIVE === "1";

  return {
    ...base,

    // Explicit disposable/local inputs.
    AUTH_EMAIL_FROM: "Prediabetes Pal E2E <signin@pal.test>",
    AUTH_EMAIL_STUB_DIR: base.AUTH_EMAIL_STUB_DIR?.trim() || "",
    AUTH_SECRET: E2E_AUTH_SECRET,
    DATABASE_POOL_MAX: "2",
    DATABASE_URL: isolatedDatabaseUrl(base.DATABASE_URL),
    HEALTH_DATA_KEY: E2E_HEALTH_DATA_KEY,
    LEGAL_ENTITY_NAME: "Prediabetes Pal",
    LEGAL_TERMS_FINAL: "0",
    MEAL_EXTRACT_STUB: "1",
    NEXT_PUBLIC_APP_URL: "http://127.0.0.1:3100",
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: E2E_VAPID_PUBLIC_KEY,
    PANTRY_EXTRACT_STUB: "1",
    // AUD-010: /pantry renders only a Stripe-verified price and fails closed
    // without one. E2E blanks STRIPE_SECRET_KEY, so the funnel specs need the
    // test seam (ignored in production builds, like the extract stubs above).
    PANTRY_PRICE_STUB: "1",
    PAYWALL_MODE: base.PAYWALL_MODE?.trim() || "legacy",
    PAL_ALLOW_NO_MEASUREMENT: "1",
    SUPPORT_INBOX_EMAIL: "support@pal.test",
    TRIAL_PRICE_VARIANT: "1299",
    VAPID_PUBLIC_KEY: E2E_VAPID_PUBLIC_KEY,

    // This is an optimized local server, not an internet-reachable preview.
    // `preview` would correctly make missing abuse controls fail closed.
    VERCEL_ENV: "development",

    // Build/runtime provider isolation. Keep these keys present and empty so
    // Next cannot refill them from the developer's local env files.
    ADMIN_EMAIL: "admin@pal.test",
    AUTH_URL: "",
    BLOB_READ_WRITE_TOKEN: "",
    CRON_SECRET: "",
    DATABASE_MIGRATION_URL: "",
    EDGE_CONFIG: "",
    GOOGLE_PLAY_SERVICE_ACCOUNT_JSON: "",
    NEXTAUTH_URL: "",
    // AUD-002/WS-5: the retention-feature flags (and every server twin) are
    // blanked so isolated E2E runs stop inheriting ambient flags.
    LEARNING_JOURNEY_ENABLED: "",
    LONGITUDINAL_INSIGHTS_ENABLED: "",
    MEAL_MEMORY_ENABLED: "",
    NEXT_PUBLIC_LEARNING_JOURNEY: "",
    NEXT_PUBLIC_LONGITUDINAL_INSIGHTS: "",
    NEXT_PUBLIC_MEAL_MEMORY: "",
    NEXT_PUBLIC_PHOTO_INPUT: "",
    NEXT_PUBLIC_PLAY_BILLING: "",
    NEXT_PUBLIC_REVIEWER_MODE: "",
    NEXT_PUBLIC_SENTRY_DSN: "",
    NEXT_PUBLIC_UMAMI_HOST_URL: "",
    NEXT_PUBLIC_UMAMI_SRC: "",
    NEXT_PUBLIC_UMAMI_WEBSITE_ID: "",
    NEXT_PUBLIC_WAITLIST_URL: "",
    OPENAI_API_KEY: pantryLive ? base.OPENAI_API_KEY?.trim() || "" : "",
    OPENAI_BASE_URL: "",
    OPENROUTER_API_KEY: "",
    PANTRY_BLOB_READ_WRITE_TOKEN: pantryLive
      ? base.PANTRY_BLOB_READ_WRITE_TOKEN?.trim() || ""
      : "",
    PHOTO_INPUT_ENABLED: "",
    PLAY_PACKAGE_NAME: "",
    RESEND_API_KEY: "",
    RESEND_WEBHOOK_SECRET: "",
    REVIEWER_TEST_SECRET: "",
    PAL_LAUNCH_MODE_OVERRIDE: "",
    // WS-2: model routing must not leak from the ambient shell into isolated
    // E2E — a provider-prefixed ambient model id would break the stubbed runs.
    PAL_MODEL: "",
    PAL_VISION_MODEL: "",
    RTDN_SHARED_TOKEN: "",
    SENTRY_AUTH_TOKEN: "",
    SENTRY_DSN: "",
    STRIPE_PRICE_MONTHLY: "",
    STRIPE_PRICE_MONTHLY_999: "",
    STRIPE_PRICE_MONTHLY_1299: "",
    STRIPE_PRICE_MONTHLY_1999: "",
    STRIPE_PRICE_ANNUAL: "",
    STRIPE_PRICE_PANTRY: "",
    STRIPE_SECRET_KEY: "",
    STRIPE_WEBHOOK_SECRET: "",
    UPSTASH_REDIS_REST_TOKEN: "",
    UPSTASH_REDIS_REST_URL: "",
    VAPID_PRIVATE_KEY: "",
    VERCEL_OIDC_TOKEN: ""
  } as NodeJS.ProcessEnv;
}
