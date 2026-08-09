/**
 * Browser Sentry privacy contract (W-22).
 *
 * Mirrors tests/unit/revora/sentry-scrub.test.ts, which proves the SCRUBBER
 * strips every PII vector. That test is necessary but not sufficient for the
 * client, because on the browser the bigger risk isn't a leaky scrubber — it's a
 * leaky INTEGRATION. `breadcrumbsIntegration` alone would ship the user's typed
 * meal text, the /api/check request body, and any console.log of a model
 * response, and it would do so through channels the scrubber can't fully see. So
 * this test asserts the allowlist itself: what is loaded, what is refused, and
 * that the SDK is inert without a DSN.
 *
 * A passing scrub test with `breadcrumbs` enabled would still be a health-data
 * leak. That is the gap this file closes.
 */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import type { ErrorEvent } from "@sentry/browser";
import { describe, expect, it } from "vitest";

import {
  CLIENT_SENTRY_DSN,
  clientSentryOptions
} from "../../../instrumentation-client";
import {
  SENTRY_IP_GEO_SENTINEL,
  scrubSentryEvent
} from "../../../lib/revora/sentry-scrub";

const FOOD = "SENTINEL_FOOD_two_slices_of_pizza";
const A1C = "SENTINEL_A1C_6point1";

/** Integrations that would carry health data off the device. None may be loaded. */
const FORBIDDEN_INTEGRATIONS = [
  "Breadcrumbs", // console/fetch/XHR/DOM — the typed meal, the request body
  "HttpContext", // page URL + headers
  "BrowserApiErrors", // wraps timers/listeners; captures closed-over args
  "ContextLines", // source lines around the frame
  "ExtraErrorData", // arbitrary props off the error object
  "Replay", // would record the user typing their meal and their A1C
  "ReplayCanvas",
  "BrowserTracing",
  "BrowserProfiling",
  "CaptureConsole",
  "ReportingObserver",
  "HttpClient"
];

describe("browser Sentry init contract", () => {
  it("has exactly one browser SDK initializer and does not mount a second one from the root layout", () => {
    function sourceFiles(directory: string): string[] {
      return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) return sourceFiles(path);
        return /\.[cm]?tsx?$/.test(entry.name) ? [readFileSync(path, "utf8")] : [];
      });
    }

    const rootLayout = readFileSync(join(process.cwd(), "app/layout.tsx"), "utf8");
    const browserSources = [
      readFileSync(join(process.cwd(), "instrumentation-client.ts"), "utf8"),
      ...sourceFiles(join(process.cwd(), "app")),
      ...sourceFiles(join(process.cwd(), "components"))
    ];
    const initCalls = browserSources
      .join("\n")
      .match(/\bSentry\.init\s*\(/g);

    expect(initCalls).toHaveLength(1);
    expect(rootLayout).not.toContain("client-error-reporting");
  });

  it("is fully inert without a DSN", () => {
    // No DSN in dev/test/CI, so the module-level init never runs. If this ever
    // becomes truthy in a test run, the SDK is booting where it shouldn't.
    expect(CLIENT_SENTRY_DSN).toBeUndefined();
    expect(clientSentryOptions(undefined).dsn).toBeUndefined();
  });

  it("disables the default integrations entirely (allowlist, not denylist)", () => {
    // The single most important line in the config. With defaults ON, every
    // forbidden integration below is loaded automatically and no amount of
    // careful listing helps.
    expect(clientSentryOptions("https://x@example.test/1").defaultIntegrations).toBe(
      false
    );
  });

  it("loads no integration that can carry food text, A1C, or a URL", () => {
    const loaded = clientSentryOptions("https://x@example.test/1").integrations.map(
      (i) => i.name
    );
    const leaks = loaded.filter((name) => FORBIDDEN_INTEGRATIONS.includes(name));
    expect(leaks, `forbidden integration(s) loaded: ${leaks.join(", ")}`).toEqual(
      []
    );
  });

  it("still loads globalHandlers — without it the SDK captures nothing at all", () => {
    // The failure mode this guards is silent: an allowlist tightened one step
    // too far leaves Sentry installed, configured, reporting no errors, and
    // indistinguishable from "the app has no bugs".
    const loaded = clientSentryOptions("https://x@example.test/1").integrations.map(
      (i) => i.name
    );
    expect(loaded).toContain("GlobalHandlers");
  });

  it("sends no PII by default and samples no traces", () => {
    const opts = clientSentryOptions("https://x@example.test/1");
    expect(opts.sendDefaultPii).toBe(false);
    expect(opts.tracesSampleRate).toBe(0);
  });

  it("uses the build-injected exact release when present", () => {
    const previousRelease = process.env.NEXT_PUBLIC_SENTRY_RELEASE;
    process.env.NEXT_PUBLIC_SENTRY_RELEASE =
      "80ea9fb93bb015084963aa707298c58c6355eeb7";

    try {
      expect(clientSentryOptions("https://x@example.test/1").release).toBe(
        "80ea9fb93bb015084963aa707298c58c6355eeb7"
      );
    } finally {
      if (previousRelease === undefined) {
        delete process.env.NEXT_PUBLIC_SENTRY_RELEASE;
      } else {
        process.env.NEXT_PUBLIC_SENTRY_RELEASE = previousRelease;
      }
    }
  });

  it("routes every event through the same scrubber the server uses", () => {
    expect(clientSentryOptions(undefined).beforeSend).toBe(scrubSentryEvent);
  });
});

describe("browser events are scrubbed of every PII vector", () => {
  // The browser-shaped version of the server's event: the food text reaches
  // Sentry through a React error boundary's message, a frame var closing over
  // component state, and a DOM breadcrumb (which should never exist — but the
  // scrubber is the second wall, so it is tested as if it does).
  function browserEventWithAllPiiVectors(): ErrorEvent {
    return {
      type: undefined,
      message: `client boundary caught: ${FOOD}`,
      request: {
        url: `https://prediabetespal.com/check?food=${encodeURIComponent(FOOD)}`,
        headers: { cookie: "session=abc" }
      },
      user: { ip_address: "203.0.113.9", id: "user_123" },
      contexts: { state: { lastFood: FOOD, a1c: A1C } },
      breadcrumbs: [
        { category: "ui.input", message: `typed: ${FOOD}` },
        { category: "fetch", message: `POST /api/check {"food":"${FOOD}"}` }
      ],
      exception: {
        values: [
          {
            type: "TypeError",
            value: `Cannot read properties of undefined while rendering ${FOOD}`,
            stacktrace: {
              frames: [
                {
                  function: "FoodCheckForm",
                  vars: { food: FOOD, a1c: A1C }
                }
              ]
            }
          }
        ]
      }
    } as unknown as ErrorEvent;
  }

  it("strips food text, A1C, and IP from the serialized event", () => {
    const serialized = JSON.stringify(
      scrubSentryEvent(browserEventWithAllPiiVectors())
    );

    expect(serialized).not.toContain(FOOD);
    expect(serialized).not.toContain(A1C);
    expect(serialized).not.toContain("203.0.113.9");
    expect(serialized).not.toContain("user_123");
    expect(serialized).not.toContain("session=abc");
  });

  it("drops the URL — the meal can be in the query string", () => {
    const scrubbed = scrubSentryEvent(browserEventWithAllPiiVectors());
    expect(scrubbed.request).toBeUndefined();
  });

  it("drops ui.input and fetch breadcrumbs even if an integration ever adds them", () => {
    const scrubbed = scrubSentryEvent(browserEventWithAllPiiVectors());
    expect(scrubbed.breadcrumbs).toBeUndefined();
  });

  it("replaces browser identity with the provider geo-suppression sentinel", () => {
    const scrubbed = scrubSentryEvent(browserEventWithAllPiiVectors());

    expect(scrubbed.user).toEqual({
      ip_address: SENTRY_IP_GEO_SENTINEL
    });
  });

  it("keeps the exception type and frame function for triage", () => {
    const ex = scrubSentryEvent(browserEventWithAllPiiVectors()).exception
      ?.values?.[0];

    expect(ex?.value).toBe("[redacted]");
    expect(ex?.type).toBe("TypeError");
    expect(ex?.stacktrace?.frames?.[0].vars).toBeUndefined();
    expect(ex?.stacktrace?.frames?.[0].function).toBe("FoodCheckForm");
  });
});
