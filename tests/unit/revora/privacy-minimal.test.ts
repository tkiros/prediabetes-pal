import fs from "node:fs";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import { createCheckRouteHandler } from "../../../app/api/check/route";
import { buildRetryResponse } from "../../../lib/revora/fallback";
import { loadSafetyContract } from "../../../lib/revora/safety-contract";
import { checkFood } from "../../../lib/revora/service";

const DISCLAIMER =
  "Prediabetes Pal is informational only and is not medical advice. Talk with a doctor or registered dietitian for guidance that is specific to you.";

const PROJECT_ROOT = process.cwd();

function readProjectFile(relativePath: string) {
  return fs.readFileSync(path.join(PROJECT_ROOT, relativePath), "utf8");
}

function collectTsFiles(relativeDir: string): string[] {
  const absoluteDir = path.join(PROJECT_ROOT, relativeDir);

  return fs.readdirSync(absoluteDir, { recursive: true })
    .filter((entry) => typeof entry === "string")
    .map((entry) => path.join(relativeDir, entry))
    .filter((entry) => entry.endsWith(".ts") || entry.endsWith(".tsx"));
}

function createRequest(body: unknown) {
  return new Request("http://localhost/api/check", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
}

describe("privacy-minimal audit", () => {
  it("keeps one OpenAI wrapper, one route-to-service path, and no raw request logging", () => {
    const routeSource = readProjectFile("app/api/check/route.ts");
    const serviceSource = readProjectFile("lib/revora/service.ts");
    const wrapperSource = readProjectFile("lib/revora/openai-client.ts");
    const telemetrySource = readProjectFile("lib/revora/telemetry.ts");

    expect(routeSource).toMatch(/checkFood/);
    expect(routeSource).toMatch(/emitSafeEvent/);
    expect(routeSource).not.toMatch(/console\.(log|info|warn|error)/);
    expect(routeSource).not.toMatch(
      /console\.(log|info|warn|error)\([^)]*(food|a1c|prompt|output_text)/i
    );

    expect(serviceSource).toMatch(/from "\.\/openai-client"/);
    expect(serviceSource).not.toMatch(/responses\.create/);

    expect(wrapperSource).toMatch(/store:\s*false/);

    expect(telemetrySource).not.toMatch(/food:/);
    expect(telemetrySource).not.toMatch(/a1c:/i);
    expect(telemetrySource).not.toMatch(/promptText/);
    expect(telemetrySource).not.toMatch(/modelOutput/);

    const sdkImportsOutsideWrapper = [
      "app/page.tsx",
      "app/(app)/privacy/page.tsx",
      "app/api/check/route.ts",
      "lib/revora/service.ts",
      ...collectTsFiles("components"),
      ...collectTsFiles("lib/client")
    ].filter((filePath) => {
      const source = readProjectFile(filePath);
      return /from ["']openai["']|new OpenAI\(/.test(source);
    });

    expect(sdkImportsOutsideWrapper).toEqual([]);
  });

  it("emits coarse completion telemetry after checkFood returns", async () => {
    const emitEvent = vi.fn();
    const model = { generate: vi.fn() };
    const checkFoodImpl = vi.fn().mockResolvedValue({
      kind: "result",
      risk: "SAFE",
      reason: "This looks balanced.",
      adjustment: null,
      swap: null,
      disclaimer: DISCLAIMER
    });

    const POST = createCheckRouteHandler({
      checkFoodImpl,
      emitEvent,
      modelFactory: () => model,
      now: vi.fn().mockReturnValueOnce(1_000).mockReturnValueOnce(2_500)
    });

    const response = await POST(
      createRequest({
        food: "lentil soup",
        a1c: 6.1
      })
    );

    expect(checkFoodImpl).toHaveBeenCalledWith(
      {
        food: "lentil soup",
        a1c: 6.1
      },
      // P1.3 §8: the route also passes the one-clarification-cap signal (false
      // here — no x-revora-clarified header). Task 13 §P3.1: plus the snapshot
      // sink postprocess writes the conservative-floor metadata into.
      // AUD-025: the model is now a LAZY factory, so deterministic routes can
      // return before any provider client is constructed.
      {
        model: expect.any(Function),
        clarified: false,
        snapshot: { floorApplied: null, usedFallback: false },
        onModelError: expect.any(Function)
      }
    );
    const lazyModel = checkFoodImpl.mock.calls[0][1].model as () => unknown;
    expect(lazyModel()).toBe(model);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      kind: "result",
      risk: "SAFE"
    });
    expect(emitEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "check_completed",
        environment: "test",
        responseKind: "result",
        risk: "SAFE",
        latencyBucket: "<2s",
        // W-13: model + versions make a reported bad answer reproducible, and
        // durationMs makes p95 computable (the buckets never could). All four
        // are bounded, non-PII values.
        durationMs: expect.any(Number),
        model: expect.any(String),
        promptVersion: expect.any(String),
        contractVersion: expect.any(String)
      })
    );

    // The point of this whole file: the new attribution fields must not have
    // opened a channel for health data. Nothing emitted may echo the input.
    // The version stamps are date-shaped ("2026-07-16.1") and can legally
    // contain an A1C-looking substring, so they are removed before the leak
    // check — they are pinned constants, not request data.
    const emitted = JSON.stringify(
      emitEvent.mock.calls.map((call) =>
        call.map((event: Record<string, unknown>) => {
          const { promptVersion, contractVersion, ...rest } = event;
          void promptVersion;
          void contractVersion;
          return rest;
        })
      )
    );
    expect(emitted).not.toMatch(/lentil/i);
    expect(emitted).not.toMatch(/6\.1/);
  });

  it("emits coarse failure telemetry and returns a safe retry response", async () => {
    const emitEvent = vi.fn();
    const model = { generate: vi.fn() };
    const checkFoodImpl = vi
      .fn()
      .mockRejectedValue(new Error("provider timeout for sweetened cereal"));

    const POST = createCheckRouteHandler({
      checkFoodImpl,
      emitEvent,
      modelFactory: () => model,
      now: vi.fn().mockReturnValueOnce(1_000).mockReturnValueOnce(9_000)
    });

    const response = await POST(
      createRequest({
        food: "sweetened cereal",
        a1c: 6.4
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      kind: "retry",
      disclaimer: DISCLAIMER
    });
    expect(emitEvent).toHaveBeenCalledWith({
      name: "check_failed",
      environment: "test",
      reasonCode: "provider_error",
      latencyBucket: "5-12s",
      durationMs: expect.any(Number),
      model: expect.any(String),
      modelProvider: expect.any(String),
      promptVersion: expect.any(String),
      contractVersion: expect.any(String)
    });
  });

  it("records a swallowed model fallback as failure, never completion", async () => {
    const emitEvent = vi.fn();
    const modelError = Object.assign(new Error("provider failed"), {
      status: 503
    });
    const checkFoodImpl: typeof checkFood = async (_request, deps) => {
      deps.onModelError?.(modelError);
      return buildRetryResponse(loadSafetyContract());
    };
    const POST = createCheckRouteHandler({
      checkFoodImpl,
      emitEvent,
      modelFactory: () => ({ generate: vi.fn() }),
      now: vi.fn().mockReturnValueOnce(1_000).mockReturnValueOnce(1_439)
    });

    const response = await POST(
      createRequest({ food: "synthetic meal", a1c: 6.1 })
    );

    await expect(response.json()).resolves.toMatchObject({ kind: "retry" });
    expect(emitEvent).toHaveBeenCalledOnce();
    expect(emitEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "check_failed",
        responseKind: "retry",
        reasonCode: "provider_error",
        durationMs: 439,
        modelProvider: "openai"
      })
    );
  });
});
