/**
 * AUD-025 regression — deterministic routing is provider-independent.
 *
 * The check route used to construct the model client EAGERLY while building
 * checkFood's arguments, so a missing/invalid provider credential threw before
 * any deterministic branch ran: a "shaky and clammy" input collapsed to a
 * generic retry instead of the clinical card. The model dependency is now a
 * lazy factory that only runs after every deterministic route has had its
 * chance — these tests pin that with a spy asserted at zero calls.
 *
 * Three provider-failure shapes are simulated:
 *   1. missing key      — the factory itself throws (createTransport behavior)
 *   2. invalid key      — construction succeeds, generate() rejects with 401
 *   3. unreachable base — construction succeeds, generate() rejects with a
 *                         connection error
 * In all three, deterministic inputs must return their deterministic cards
 * with the factory (case 1) or generate (cases 2-3) never invoked.
 */

import { describe, expect, it, vi } from "vitest";

import { createCheckRouteHandler } from "../../../app/api/check/route";
import { checkFood } from "../../../lib/pal/service";
import type { PalModelClient } from "../../../lib/pal/openai-client";

const CLINICAL_INPUT = { food: "feeling shaky and clammy after lunch", a1c: 6 };
const OUT_OF_SCOPE_INPUT = { food: "oatmeal with nuts", a1c: 6.5 };
const MALFORMED_INPUT = { food: 42 };
const IN_SCOPE_INPUT = { food: "oatmeal with nuts", a1c: 6 };

function throwingFactory() {
  return vi.fn((): PalModelClient => {
    throw new Error("OPENAI_API_KEY is required for live Prediabetes Pal model calls.");
  });
}

function rejectingClient(error: Error) {
  const generate = vi.fn().mockRejectedValue(error);
  const factory = vi.fn((): PalModelClient => ({ generate }));
  return { factory, generate };
}

describe("checkFood — deterministic routes never construct a model client", () => {
  const failureModes = [
    { name: "missing key (factory throws)", make: () => ({ factory: throwingFactory(), generate: null }) },
    {
      name: "invalid key (generate rejects 401)",
      make: () => rejectingClient(Object.assign(new Error("401"), { status: 401 }))
    },
    {
      name: "unreachable base URL (connection error)",
      make: () =>
        rejectingClient(
          Object.assign(new Error("connect ECONNREFUSED"), {
            name: "PalConnectionError"
          })
        )
    },
    {
      // WS-2: an OpenRouter misconfiguration (missing provider prefix, host
      // not allowlisted) throws PalModelConfigurationError at construction.
      name: "OpenRouter misconfiguration (config error at construction)",
      make: () => ({
        factory: vi.fn((): PalModelClient => {
          const error = new Error(
            "OpenRouter model ids must include their provider prefix."
          );
          error.name = "PalModelConfigurationError";
          throw error;
        }),
        generate: null
      })
    }
  ] as const;

  for (const mode of failureModes) {
    it(`clinical input returns the clinical card under ${mode.name}`, async () => {
      const { factory } = mode.make();
      const response = await checkFood(CLINICAL_INPUT, { model: factory });
      expect(response.kind).toBe("clinical");
      expect(factory).toHaveBeenCalledTimes(0);
    });

    it(`out-of-range A1C returns out_of_scope under ${mode.name}`, async () => {
      const { factory } = mode.make();
      const response = await checkFood(OUT_OF_SCOPE_INPUT, { model: factory });
      expect(response.kind).toBe("out_of_scope");
      expect(factory).toHaveBeenCalledTimes(0);
    });

    it(`malformed request returns the invalid-request retry under ${mode.name}`, async () => {
      const { factory } = mode.make();
      const response = await checkFood(MALFORMED_INPUT, { model: factory });
      expect(response.kind).toBe("retry");
      if (response.kind === "retry") {
        expect(response.message).toMatch(/numeric A1C/);
      }
      expect(factory).toHaveBeenCalledTimes(0);
    });
  }

  it("an in-scope food with a throwing factory falls to the calm retry, not a crash", async () => {
    const factory = throwingFactory();
    const onModelError = vi.fn();
    const response = await checkFood(IN_SCOPE_INPUT, {
      model: factory,
      onModelError
    });
    expect(response.kind).toBe("retry");
    expect(factory).toHaveBeenCalledTimes(1);
    expect(onModelError).toHaveBeenCalledTimes(1);
  });
});

describe("check route — the model factory is lazy end to end", () => {
  function checkRequest(body: unknown): Request {
    return new Request("http://localhost/api/check", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    });
  }

  it.each([
    ["clinical", CLINICAL_INPUT, "clinical"],
    ["out-of-scope A1C", OUT_OF_SCOPE_INPUT, "out_of_scope"],
    ["malformed", MALFORMED_INPUT, "retry"]
  ])(
    "%s input returns its deterministic card with zero factory calls when the provider is unconfigured",
    async (_label, body, expectedKind) => {
      const modelFactory = throwingFactory();
      const POST = createCheckRouteHandler({
        modelFactory,
        getSession: async () => null,
        emitEvent: () => {}
      });

      const response = await POST(checkRequest(body));
      expect(response.status).toBe(200);
      const json = (await response.json()) as { kind: string };
      expect(json.kind).toBe(expectedKind);
      expect(modelFactory).toHaveBeenCalledTimes(0);
    }
  );
});
