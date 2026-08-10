/**
 * Pins the load-bearing safety invariant (review finding #1): captureServerError
 * runs on the request's LAST recovery path, so a Sentry SDK fault must NOT
 * propagate — otherwise the catch block loses its calm-retry response and the
 * user gets an uncaught 500. If a future refactor drops the internal guard, this
 * test fails.
 */

import { describe, expect, it, vi } from "vitest";

const captureException = vi.fn();

vi.mock("@sentry/node", () => ({
  captureException: (...args: unknown[]) => captureException(...args),
  flush: vi.fn(() => Promise.resolve(true))
}));

import { captureServerError } from "../../../lib/pal/sentry-capture";

describe("captureServerError", () => {
  it("never throws or rejects even when the Sentry SDK throws", async () => {
    captureException.mockImplementationOnce(() => {
      throw new Error("SDK boom");
    });
    await expect(
      captureServerError(new Error("provider down"), "model")
    ).resolves.toBeUndefined();
  });

  it("tags survive minification: uses error.name and error.code over constructor.name", async () => {
    // Simulates a production-bundled pg DatabaseError: constructor minified to
    // "b", but `name` and `code` (SQLSTATE) are real string properties.
    class b extends Error {
      code = "42P01";
      constructor() {
        super("relation does not exist");
        this.name = "DatabaseError";
      }
    }
    await captureServerError(new b(), "route");
    expect(captureException).toHaveBeenLastCalledWith(expect.anything(), {
      tags: expect.objectContaining({
        stage: "route",
        errorClass: "DatabaseError",
        errorCode: "42P01"
      })
    });
  });

  it("keeps built-in error names and omits errorCode when absent", async () => {
    await captureServerError(new RangeError("x"), "model");
    const tags = captureException.mock.calls.at(-1)?.[1]?.tags;
    expect(tags.errorClass).toBe("RangeError");
    expect(tags.errorCode).toBeUndefined();
  });

  it("never tags free text: name/code outside the machine-token charset are dropped", async () => {
    // Tags bypass the beforeSend scrubber, so a PII-bearing name or code
    // (food text, email, prompt fragment) must not survive into the tags.
    const err = new Error("x") as Error & { code: string };
    err.name = "user ate oatmeal with a1c 6.2";
    err.code = "someone@example.com food=toast";
    await captureServerError(err, "route");
    const tags = captureException.mock.calls.at(-1)?.[1]?.tags;
    // PII name rejected → falls back to the constructor's PII-free "Error"
    expect(tags.errorClass).toBe("Error");
    expect(tags.errorCode).toBeUndefined();
  });
});
