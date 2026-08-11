import { z } from "zod";

import { CLINICAL_ROUTES } from "./clinical-risk";

/**
 * PII-free server telemetry.
 *
 * Every field is a bounded enum or a number — there is deliberately no
 * free-text field anywhere in this schema, and `.strict()` rejects any key not
 * listed, so a future caller cannot smuggle a food description or an A1C into
 * the log by adding a property. That property is what makes it safe to emit
 * these events for health-adjacent traffic at all, and it is asserted by
 * tests/unit/pal/privacy-minimal.test.ts.
 *
 * RE-05: `emitSafeEvent` must NEVER throw. It used to `.parse()`, so a new
 * engine response-kind missing from the enum below threw inside the check
 * route's success path and degraded a successful PAID check to a retry card,
 * logged as a model fault. It now `safeParse`s: a mismatched event is dropped
 * and counted (`telemetry_schema_miss`) instead of taking the request down.
 * Keep the enums in lockstep with the engine anyway — a miss loses telemetry.
 */
const SafeTelemetryEventSchema = z
  .object({
    name: z.enum(["check_completed", "check_failed", "launch_probe"]),
    environment: z.enum(["preview", "production", "development", "test"]),
    responseKind: z
      .enum([
        "result",
        "clarify",
        "not_food",
        "out_of_scope",
        "clinical",
        "retry"
      ])
      .optional(),
    risk: z.enum(["SAFE", "MODERATE", "HIGH"]).optional(),
    /** Which clinical class routed (W-01/W-10). Never the input that matched. */
    clinicalRoute: z.enum(CLINICAL_ROUTES).optional(),
    latencyBucket: z.enum(["<2s", "2-5s", "5-12s", ">12s"]).optional(),
    // W-13 / N-13: the buckets above cannot produce a p95, so the proposed
    // ≤5s SLO was literally unmeasurable. Raw duration is still PII-free.
    durationMs: z.number().int().nonnegative().optional(),
    // W-13 / N-18: without these, a user reporting a bad answer could not be
    // attributed to a model or reproduced — two models served the same endpoint
    // and nothing recorded which one answered.
    model: z.string().regex(/^[\w.\-/]{1,60}$/).optional(),
    modelProvider: z.enum(["openai", "openrouter", "compatible"]).optional(),
    promptVersion: z.string().regex(/^[\w.\-]{1,30}$/).optional(),
    contractVersion: z.string().regex(/^[\w.\-]{1,30}$/).optional(),
    reasonCode: z
      .enum([
        "rate_limited",
        "daily_cap",
        "provider_error",
        "schema_error",
        "paused",
        // Connection never reached the provider (nothing billed) and one
        // retry also failed — split from provider_error so ops can tell a
        // network blip from a real outage (QA round 2026-07-10, REL-01).
        "connection_blip",
        // RE-01: the trial wall failed CLOSED (entitlement unreadable) —
        // distinct from daily_cap so a DB incident is visible as itself.
        "server_error"
      ])
      .optional()
  })
  .strict();

export type SafeTelemetryEvent = z.infer<typeof SafeTelemetryEventSchema>;

export function emitSafeEvent(event: SafeTelemetryEvent): void {
  const parsed = SafeTelemetryEventSchema.safeParse(event);
  if (!parsed.success) {
    // Never throw from telemetry (RE-05). Emit a fixed-shape miss counter —
    // no fields from the offending event, so the PII guarantee holds.
    console.warn(JSON.stringify({ name: "telemetry_schema_miss" }));
    return;
  }
  console.info(JSON.stringify(parsed.data));
}
