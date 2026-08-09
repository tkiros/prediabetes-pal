import { describe, expect, it } from "vitest";

import { createSecurityTxtHandler } from "../../app/.well-known/security.txt/route";

const NOW = new Date("2026-07-22T12:00:00.000Z");

describe("GET /.well-known/security.txt", () => {
  it("publishes a canonical RFC 9116 contact with a bounded expiry", async () => {
    const response = createSecurityTxtHandler({ now: () => NOW })();
    const body = await response.text();
    const lines = body.trimEnd().split("\n");
    const expiresLines = lines.filter((line) => line.startsWith("Expires: "));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe(
      "text/plain; charset=utf-8",
    );
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(body.endsWith("\n")).toBe(true);
    expect(lines).toContain(
      "Contact: mailto:support@prediabetespal.com?subject=Security%20report",
    );
    expect(lines).toContain(
      "Canonical: https://prediabetespal.com/.well-known/security.txt",
    );
    expect(lines).toContain("Preferred-Languages: en");
    expect(expiresLines).toHaveLength(1);

    const expires = new Date(expiresLines[0].slice("Expires: ".length));
    expect(expires.getTime()).toBeGreaterThan(NOW.getTime());
    expect(expires.getTime()).toBeLessThan(
      new Date("2027-07-22T12:00:00.000Z").getTime(),
    );
  });
});
