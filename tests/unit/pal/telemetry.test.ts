import { afterEach, describe, expect, it, vi } from "vitest";

import {
  type SafeTelemetryEvent,
  emitSafeEvent
} from "../../../lib/pal/telemetry";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("emitSafeEvent", () => {
  it("emits allowlisted coarse fields only", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const event: SafeTelemetryEvent = {
      name: "check_completed",
      environment: "preview",
      responseKind: "result",
      risk: "SAFE",
      latencyBucket: "<2s",
      modelProvider: "openai"
    };

    emitSafeEvent(event);

    expect(info).toHaveBeenCalledWith(
      JSON.stringify({
        name: "check_completed",
        environment: "preview",
        responseKind: "result",
        risk: "SAFE",
        latencyBucket: "<2s",
        modelProvider: "openai"
      })
    );
  });

  it("accepts the daily_cap reason code", () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    expect(() =>
      emitSafeEvent({
        name: "check_failed",
        environment: "test",
        reasonCode: "daily_cap"
      })
    ).not.toThrow();
  });

  // RE-05: emitSafeEvent must never throw (a throw in the check route's
  // success path degraded a successful paid check to a retry card). Unsafe
  // events are DROPPED — nothing from them reaches the log — and a
  // fixed-shape miss counter is emitted instead.
  it("drops raw food text, raw A1C, prompt text, and full model output fields without throwing", () => {
    const unsafeFields = [
      { food: "sweetened cereal" },
      { a1c: 6.4 },
      { promptText: "Food: sweetened cereal\nA1C: 6.4" },
      {
        modelOutput:
          '{"kind":"result","risk":"SAFE","reason":"Looks fine."}'
      }
    ];

    for (const unsafeField of unsafeFields) {
      const info = vi.spyOn(console, "info").mockImplementation(() => {});
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

      expect(() =>
        emitSafeEvent({
          name: "check_failed",
          environment: "production",
          reasonCode: "provider_error",
          ...unsafeField
        } as SafeTelemetryEvent)
      ).not.toThrow();

      // Nothing from the unsafe event is emitted — only the miss counter.
      expect(info).not.toHaveBeenCalled();
      expect(warn).toHaveBeenCalledWith(
        JSON.stringify({ name: "telemetry_schema_miss" })
      );
      vi.restoreAllMocks();
    }
  });
});
