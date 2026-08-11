import { z } from "zod";

// Same transport as lib/pal/telemetry.ts: schema-validated console JSON,
// queryable in Vercel logs. No PII by construction — names + bounded enums only.
// ponytail: log-based metrics; upgrade to a real sink post-launch if log
// querying becomes the bottleneck for the §3 price-test readouts.
const BillingTelemetryEventSchema = z
  .object({
    name: z.enum([
      "trial_started",
      "trial_converted",
      "trial_canceled",
      "pantry_purchased",
      "precharge_email_sent",
      // Churn, server-side (W-10). These live HERE, not in lib/pal/telemetry,
      // because the webhook is the only thing that can see them: a canceled or
      // refunded user is precisely the user who is no longer running our
      // client-side analytics. They were previously declared on the pal
      // SafeTelemetryEvent enum, which the webhook does not import and whose
      // .strict() schema could never have accepted them — two dead enum
      // entries documenting a signal that did not exist.
      "subscription_canceled",
      "subscription_refunded",
      // Stripe self-healing (Task 8 / P2.2, §10.1). The pending/recovered pair
      // is the checkout-return truth signal ("payment received, access is
      // syncing" → premium); the remaining four are the operational alerts the
      // SLO promises to page on — a charge that produced no entitlement, an
      // entitlement with no valid subscription, a webhook that arrived > 60s
      // after it was created, and any inbox row that exhausted its retries.
      "entitlement_pending",
      "entitlement_recovered",
      "charge_without_entitlement",
      "entitlement_without_subscription",
      "stripe_event_delayed",
      "stripe_inbox_dead_letter"
    ]),
    priceVariant: z.enum(["999", "1299", "1999"]).optional(),
    // Self-healing props — all bounded, all optional (the trial/churn events
    // above carry none of them). `provider` and `latency` describe the
    // entitlement/heal events; `count` carries the dead-letter backlog size.
    provider: z.enum(["stripe", "play"]).optional(),
    latency: z.enum(["under_60s", "under_5m", "under_1h", "over_1h"]).optional(),
    count: z.number().int().nonnegative().optional(),
    environment: z
      .enum(["preview", "production", "development", "test"])
      .optional()
  })
  .strict();

export type LatencyBucket = NonNullable<BillingTelemetryEvent["latency"]>;

/** Bucket an elapsed-milliseconds gap onto the bounded latency enum. */
export function latencyBucket(elapsedMs: number): LatencyBucket {
  if (elapsedMs <= 60_000) return "under_60s";
  if (elapsedMs <= 5 * 60_000) return "under_5m";
  if (elapsedMs <= 60 * 60_000) return "under_1h";
  return "over_1h";
}

export type BillingTelemetryEvent = z.infer<typeof BillingTelemetryEventSchema>;

function currentEnvironment(): BillingTelemetryEvent["environment"] {
  if (process.env.NODE_ENV === "test") return "test";
  switch (process.env.VERCEL_ENV) {
    case "preview":
      return "preview";
    case "production":
      return "production";
    case "development":
      return "development";
    default:
      return process.env.NODE_ENV === "production" ? "production" : "development";
  }
}

export function emitBillingEvent(event: BillingTelemetryEvent): void {
  const safe = BillingTelemetryEventSchema.parse({
    environment: currentEnvironment(),
    ...event
  });
  console.info(JSON.stringify(safe));
}
