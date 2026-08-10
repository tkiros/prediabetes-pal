import { generateKeyPairSync, createVerify } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildServiceAccountJwt,
  fetchPlaySubscription
} from "../../../lib/server/play-api";

const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" }
});

beforeEach(() => {
  process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON = JSON.stringify({
    client_email: "svc@pal.iam.gserviceaccount.com",
    private_key: privateKey
  });
  process.env.PLAY_PACKAGE_NAME = "com.prediabetespal.twa";
});

afterEach(() => {
  delete process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON;
  delete process.env.PLAY_PACKAGE_NAME;
});

function b64urlDecode(part: string) {
  return Buffer.from(part.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

describe("buildServiceAccountJwt", () => {
  it("produces a valid RS256 JWT with the androidpublisher scope", () => {
    const jwt = buildServiceAccountJwt(
      {
        client_email: "svc@pal.iam.gserviceaccount.com",
        private_key: privateKey
      },
      1_750_000_000
    );

    const [header, claims, signature] = jwt.split(".");
    expect(JSON.parse(b64urlDecode(header).toString())).toEqual({
      alg: "RS256",
      typ: "JWT"
    });

    const parsedClaims = JSON.parse(b64urlDecode(claims).toString());
    expect(parsedClaims.iss).toBe("svc@pal.iam.gserviceaccount.com");
    expect(parsedClaims.scope).toContain("androidpublisher");
    expect(parsedClaims.exp - parsedClaims.iat).toBe(3600);

    const verifier = createVerify("RSA-SHA256");
    verifier.update(`${header}.${claims}`);
    expect(verifier.verify(publicKey, b64urlDecode(signature))).toBe(true);
  });
});

describe("fetchPlaySubscription", () => {
  function fetchStub(subscriptionBody: unknown) {
    return vi.fn(async (url: RequestInfo | URL) => {
      if (String(url).includes("oauth2.googleapis.com")) {
        return new Response(JSON.stringify({ access_token: "token-1" }), {
          status: 200
        });
      }
      return new Response(JSON.stringify(subscriptionBody), { status: 200 });
    }) as unknown as typeof fetch;
  }

  it("maps an active subscription with its expiry and product", async () => {
    const fetchImpl = fetchStub({
      subscriptionState: "SUBSCRIPTION_STATE_ACTIVE",
      lineItems: [
        { productId: "premium_monthly", expiryTime: "2026-08-01T00:00:00Z" }
      ]
    });

    const result = await fetchPlaySubscription("token-abc", { fetchImpl });

    expect(result.status).toBe("active");
    expect(result.productId).toBe("premium_monthly");
    expect(result.currentPeriodEnd.toISOString()).toBe(
      "2026-08-01T00:00:00.000Z"
    );

    // the API call carried the bearer token and the encoded package/token
    const calls = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls;
    expect(String(calls[1][0])).toContain("com.prediabetespal.twa");
    expect(String(calls[1][0])).toContain("token-abc");
  });

  it.each([
    ["SUBSCRIPTION_STATE_IN_GRACE_PERIOD", "grace"],
    ["SUBSCRIPTION_STATE_CANCELED", "canceled"],
    ["SUBSCRIPTION_STATE_EXPIRED", "expired"],
    ["SOMETHING_UNKNOWN", "expired"]
  ])("maps %s → %s", async (state, expected) => {
    const fetchImpl = fetchStub({
      subscriptionState: state,
      lineItems: [{ productId: "premium_monthly", expiryTime: "2026-08-01T00:00:00Z" }]
    });

    const result = await fetchPlaySubscription("t", { fetchImpl });
    expect(result.status).toBe(expected);
  });

  it("throws on a failed lookup instead of guessing", async () => {
    const fetchImpl = vi.fn(async (url: RequestInfo | URL) => {
      if (String(url).includes("oauth2")) {
        return new Response(JSON.stringify({ access_token: "t" }), {
          status: 200
        });
      }
      return new Response("{}", { status: 404 });
    }) as unknown as typeof fetch;

    await expect(
      fetchPlaySubscription("bad-token", { fetchImpl })
    ).rejects.toThrow(/404/);
  });
});
