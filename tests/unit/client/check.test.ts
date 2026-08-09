import { afterEach, describe, expect, it, vi } from "vitest";

import { submitCheck } from "../../../lib/client/check";

const input = { food: "rice and beans", a1c: 6.1 } as const;
const DISCLAIMER = "Not medical advice.";

function mockFetch(status: number, body: unknown) {
  const fetchMock = vi.fn(
    async () =>
      new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" }
      })
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function mockFetchRaw(status: number, rawBody: string) {
  const fetchMock = vi.fn(async () => new Response(rawBody, { status }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("submitCheck", () => {
  it("returns the server retry payload on 503 instead of throwing", async () => {
    const message =
      "Prediabetes Pal is helping a lot of people right now. Please try again in a moment.";
    mockFetch(503, { kind: "retry", message, disclaimer: DISCLAIMER });

    await expect(submitCheck(input)).resolves.toEqual({
      kind: "retry",
      message,
      disclaimer: DISCLAIMER
    });
  });

  it("fails closed when a 503 carries a risk result (no classification leaks)", async () => {
    mockFetch(503, {
      kind: "result",
      risk: "HIGH",
      reason: "This is a high-impact choice.",
      adjustment: "Add protein.",
      swap: "Swap to brown rice.",
      disclaimer: DISCLAIMER
    });
    await expect(submitCheck(input)).rejects.toMatchObject({ code: "paused" });
  });

  it("falls back to paused on a non-JSON 503 body (CDN maintenance page)", async () => {
    mockFetchRaw(503, "<html><body>maintenance</body></html>");
    await expect(submitCheck(input)).rejects.toMatchObject({ code: "paused" });
  });

  it("falls back to paused on a 503 retry missing its disclaimer", async () => {
    mockFetch(503, { kind: "retry", message: "paused" });
    await expect(submitCheck(input)).rejects.toMatchObject({ code: "paused" });
  });

  it("throws rate_limited on 429", async () => {
    mockFetch(429, { kind: "retry", message: "busy", disclaimer: DISCLAIMER });
    await expect(submitCheck(input)).rejects.toMatchObject({
      code: "rate_limited"
    });
  });

  it("throws server on a non-503 error status", async () => {
    mockFetch(500, { kind: "retry", message: "x", disclaimer: DISCLAIMER });
    await expect(submitCheck(input)).rejects.toMatchObject({ code: "server" });
  });

  it("normalizes a 200 result", async () => {
    mockFetch(200, {
      kind: "result",
      risk: "SAFE",
      reason: "This looks balanced enough for your usual plan.",
      adjustment: null,
      swap: null,
      disclaimer: DISCLAIMER
    });

    const response = await submitCheck(input);
    expect(response.kind).toBe("result");
    if (response.kind === "result") {
      expect(response.risk).toBe("SAFE");
    }
  });

  it("carries the coach outputs through on a MODERATE result", async () => {
    mockFetch(200, {
      kind: "result",
      risk: "MODERATE",
      reason: "This leans on refined carbs.",
      adjustment: "Add protein.",
      swap: "Swap to brown rice.",
      sequencingTip: "Start with the vegetables or protein.",
      postMealAction: "A short walk is a calm next step.",
      disclaimer: DISCLAIMER
    });

    const response = await submitCheck(input);
    if (response.kind !== "result") {
      throw new Error("Expected a result response.");
    }

    expect(response.sequencingTip).toBe(
      "Start with the vegetables or protein."
    );
    expect(response.postMealAction).toBe("A short walk is a calm next step.");
  });

  it("defaults missing or malformed coach outputs to null instead of failing", async () => {
    mockFetch(200, {
      kind: "result",
      risk: "SAFE",
      reason: "This looks balanced.",
      adjustment: null,
      swap: null,
      sequencingTip: 42,
      disclaimer: DISCLAIMER
    });

    const response = await submitCheck(input);
    if (response.kind !== "result") {
      throw new Error("Expected a result response.");
    }

    expect(response.sequencingTip).toBeNull();
    expect(response.postMealAction).toBeNull();
  });

  it("sends the x-revora-clarified header only when answering a clarify (§8 cap)", async () => {
    const okBody = {
      kind: "result",
      risk: "SAFE",
      reason: "This looks balanced.",
      adjustment: null,
      swap: null,
      disclaimer: DISCLAIMER
    };

    const withFlag = mockFetch(200, okBody);
    await submitCheck(input, { clarified: true });
    expect(headerOf(withFlag, "x-revora-clarified")).toBe("1");

    vi.unstubAllGlobals();

    const withoutFlag = mockFetch(200, okBody);
    await submitCheck(input);
    expect(headerOf(withoutFlag, "x-revora-clarified")).toBeUndefined();
  });
});

function headerOf(
  fetchMock: ReturnType<typeof vi.fn>,
  name: string
): string | undefined {
  const init = fetchMock.mock.calls[0]?.[1] as
    | { headers?: Record<string, string> }
    | undefined;
  return init?.headers?.[name];
}
