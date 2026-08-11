/**
 * scrubSentryEvent — the last gate before an error event leaves the box.
 *
 * A naive denylist (strip request/user/breadcrumbs only) PASSES a test that
 * checks request.data alone while still leaking the two vectors that actually
 * carry Prediabetes Pal's forbidden data: stacktrace frame `vars` (the prompt = food+a1c)
 * and the exception `value` (a ZodError can echo model output_text). This test
 * feeds ALL THREE vectors with sentinel strings and proves the deep-serialized
 * event carries none of them.
 */

import { describe, expect, it } from "vitest";
import type { ErrorEvent } from "@sentry/node";

import {
  SENTRY_IP_GEO_SENTINEL,
  scrubSentryEvent
} from "../../../lib/pal/sentry-scrub";

const FOOD = "SENTINEL_FOOD_two_slices_of_pizza";
const A1C = "SENTINEL_A1C_7point4";

function eventWithAllPiiVectors(): ErrorEvent {
  return {
    type: undefined,
    message: `top-level note echoing ${FOOD}`,
    request: { data: { food: FOOD, a1c: A1C }, headers: { cookie: "x" } },
    user: { ip_address: "203.0.113.7" },
    server_name: "internal-host-1",
    contexts: { custom: { lastFood: FOOD, a1c: A1C } },
    breadcrumbs: [{ category: "console", message: `prompt: ${FOOD} ${A1C}` }],
    exception: {
      values: [
        {
          type: "ZodError",
          value: `Invalid model output echoing ${FOOD}`,
          stacktrace: {
            frames: [
              {
                function: "buildPalPrompt",
                vars: { prompt: `You ate ${FOOD}, a1c ${A1C}` }
              }
            ]
          }
        }
      ]
    },
    // Nothing populates threads today (defaultIntegrations off), but the
    // scrubber must cover the container so a future integration can't leak
    // frame vars through it.
    threads: {
      values: [
        {
          stacktrace: {
            frames: [
              {
                function: "backgroundWorker",
                vars: { prompt: `thread copy ${FOOD} ${A1C}` }
              }
            ]
          }
        }
      ]
    }
  } as unknown as ErrorEvent;
}

describe("scrubSentryEvent", () => {
  it("strips every PII vector — request body, frame vars, and exception message", () => {
    const scrubbed = scrubSentryEvent(eventWithAllPiiVectors());
    const serialized = JSON.stringify(scrubbed);

    expect(serialized).not.toContain(FOOD);
    expect(serialized).not.toContain(A1C);
    expect(serialized).not.toContain("203.0.113.7");
  });

  it("removes identifying user data and replaces the IP with the geo-suppression sentinel", () => {
    const scrubbed = scrubSentryEvent(eventWithAllPiiVectors());

    expect(scrubbed.request).toBeUndefined();
    expect(scrubbed.user).toEqual({
      ip_address: SENTRY_IP_GEO_SENTINEL
    });
    expect(scrubbed.server_name).toBeUndefined();
    expect(scrubbed.contexts).toBeUndefined();
    expect(scrubbed.breadcrumbs).toBeUndefined();
  });

  it("sets the geo-suppression sentinel even when the source event has no user", () => {
    const minimal = { type: undefined } as unknown as ErrorEvent;
    const scrubbed = scrubSentryEvent(minimal);

    expect(scrubbed.user).toEqual({
      ip_address: SENTRY_IP_GEO_SENTINEL
    });
  });

  it("redacts an empty-string message (the truthy guard would have skipped it)", () => {
    const event = {
      exception: { values: [{ type: "Error", value: "" }] }
    } as unknown as ErrorEvent;

    const scrubbed = scrubSentryEvent(event);
    expect(scrubbed.exception?.values?.[0].value).toBe("[redacted]");
  });

  it("redacts the exception message but keeps the type for grouping/triage", () => {
    const scrubbed = scrubSentryEvent(eventWithAllPiiVectors());
    const ex = scrubbed.exception?.values?.[0];

    expect(ex?.value).toBe("[redacted]");
    expect(ex?.type).toBe("ZodError");
    expect(ex?.stacktrace?.frames?.[0].vars).toBeUndefined();
    // the stack frame itself (function name) is kept — it carries no PII
    expect(ex?.stacktrace?.frames?.[0].function).toBe("buildPalPrompt");
  });

  it("tolerates an event with no exception / frames", () => {
    const minimal = { type: undefined } as unknown as ErrorEvent;
    expect(() => scrubSentryEvent(minimal)).not.toThrow();
  });
});
