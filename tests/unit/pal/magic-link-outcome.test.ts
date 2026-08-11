import { describe, expect, it } from "vitest";

import { magicLinkSendFailed } from "../../../lib/pal/magic-link-outcome";

describe("magicLinkSendFailed", () => {
  it("treats the verify-request URL of a successful send as success", () => {
    expect(
      magicLinkSendFailed(
        "http://127.0.0.1:3100/api/auth/verify-request?provider=resend&type=email"
      )
    ).toBe(false);
    expect(magicLinkSendFailed("/api/auth/verify-request?provider=resend")).toBe(
      false
    );
  });

  it("treats an error redirect as failure (the old page showed check-email here)", () => {
    expect(
      magicLinkSendFailed("http://127.0.0.1:3100/api/auth/error?error=Configuration")
    ).toBe(true);
    expect(
      magicLinkSendFailed("/signin?error=EmailSignInError")
    ).toBe(true);
  });

  it("treats a non-string or unparseable result as failure, never as sent", () => {
    expect(magicLinkSendFailed(undefined)).toBe(true);
    expect(magicLinkSendFailed(null)).toBe(true);
    expect(magicLinkSendFailed({ url: "/verify-request" })).toBe(true);
    expect(magicLinkSendFailed("http://[broken")).toBe(true);
  });
});
