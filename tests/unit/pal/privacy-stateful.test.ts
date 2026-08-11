import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { scrubSentryEvent } from "../../../lib/pal/sentry-scrub";

/**
 * Privacy audit for the stateful posture (plan 4B) — the approved contract in
 * docs/privacy/data-flow.md, enforced as tests. Supersedes the scope (not the
 * assertions) of privacy-minimal.test.ts: guests still get the no-storage
 * path; accounts get encrypted-at-rest + scrubbed observability.
 */

const ROOT = process.cwd();

function read(rel: string) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

describe("stateful privacy allowlist", () => {
  it("persists food ONLY through encryptField — no plaintext food column writes", () => {
    for (const rel of [
      "app/api/check/route.ts",
      "app/api/history/handlers.ts",
      "app/api/profile/route.ts"
    ]) {
      const source = read(rel);
      // every write to the ciphertext columns goes through encryptField
      const writes = source.match(/foodCiphertext:\s*(\w+)/g) ?? [];
      for (const write of writes) {
        expect(write).toMatch(/foodCiphertext:\s*encryptField/);
      }
      const a1cWrites = source.match(/a1cCiphertext:\s*(\w+)/g) ?? [];
      for (const write of a1cWrites) {
        expect(write).toMatch(/a1cCiphertext:\s*encryptField/);
      }
    }
  });

  it("schema has no plaintext food/a1c columns", () => {
    const schemaSource = read("lib/server/db/schema.ts");

    expect(schemaSource).toContain("a1c_ciphertext");
    expect(schemaSource).toContain("food_ciphertext");
    // the only a1c-ish plaintext column is the coarse band
    expect(schemaSource).not.toMatch(/["']a1c["']/);
    expect(schemaSource).not.toMatch(/["']food["']/);
  });

  it("telemetry stays coarse — no email/food/a1c fields", () => {
    const telemetrySource = read("lib/pal/telemetry.ts");

    for (const banned of ["email", "food:", "a1c:", "userId", "ciphertext"]) {
      expect(telemetrySource).not.toContain(banned);
    }
  });

  it("server routes never console-log request data", () => {
    for (const rel of [
      "app/api/history/handlers.ts",
      "app/api/profile/route.ts",
      "app/api/check/route.ts"
    ]) {
      expect(read(rel)).not.toMatch(/console\.(log|info|warn|error)/);
    }
  });

  it("the Sentry scrubber removes every vector that could carry email/food/a1c", () => {
    const event = {
      request: { data: { food: "oatmeal", a1c: 6.1 } },
      user: { email: "user@example.com", ip_address: "1.2.3.4" },
      extra: { foodCiphertext: "abc123", decrypted: "oatmeal" },
      contexts: { profile: { a1c: 6.1 } },
      message: "failed for user@example.com eating oatmeal a1c 6.1",
      breadcrumbs: [{ message: "GET /api/history user@example.com" }],
      exception: {
        values: [
          {
            value: "ZodError: food 'oatmeal' a1c 6.1 user@example.com",
            stacktrace: {
              frames: [{ vars: { food: "oatmeal", email: "user@example.com" } }]
            }
          }
        ]
      }
    };

    const scrubbed = scrubSentryEvent(event as never);
    const serialized = JSON.stringify(scrubbed);

    expect(serialized).not.toContain("oatmeal");
    expect(serialized).not.toContain("6.1");
    expect(serialized).not.toContain("user@example.com");
    expect(serialized).not.toContain("abc123");
    expect(serialized).not.toContain("1.2.3.4");
  });

  it("the four lockstep artifacts all describe the stateful posture", () => {
    const privacyPage = read("app/(app)/privacy/page.tsx");
    const dataFlow = read("docs/privacy/data-flow.md");
    const runbook = read("docs/ops/play-twa-runbook.md");
    const counselBrief = read("docs/legal/counsel-brief.md");

    // privacy page: consent + encryption + deletion + guest path
    expect(privacyPage).toMatch(/encrypted at rest/i);
    expect(privacyPage).toMatch(/explicit consent/i);
    expect(privacyPage).toMatch(/account\/delete/);
    expect(privacyPage).toMatch(/as a guest/i);

    // data-flow: replaced boundary + allowlist
    expect(dataFlow).toMatch(/AES-256-GCM/);
    expect(dataFlow).toMatch(/lockstep/i);
    expect(dataFlow).toMatch(/replaces the previous/i);
    expect(dataFlow).toMatch(/Stored-data allowlist/i);

    // Play mapping: collected AND stored + deletion URL
    expect(runbook).toMatch(/collected AND stored/i);
    expect(runbook).toMatch(/account\/delete/);

    // counsel brief: posture note + the new questions
    expect(counselBrief).toMatch(/Art\. 9/);
    expect(counselBrief).toMatch(/Longitudinal insights/i);
    expect(counselBrief).toMatch(/Imaging input/i);
  });

  it("privacy page discloses pantry photos, vision extraction, and the WHOLE deletion lifecycle", () => {
    // JSX wraps prose across lines — match on the rendered sentence, not the
    // source's line breaks, so a reflow can't silently drop a promise.
    const source = read("app/(app)/privacy/page.tsx").replace(/\s+/g, " ");
    expect(source).toMatch(/Pantry Review/);
    expect(source).toMatch(/photos/i);
    expect(source).toMatch(/OpenAI/);
    expect(source).toMatch(/deleted/i);
    expect(source).toMatch(/encrypted/i);

    // Deletion-on-delivery was never the whole truth (N-23): canceled, refunded
    // and needs_manual orders kept their photos forever, and abandoned orders
    // are covered by nothing but the retention ceiling. Every one of those end
    // states now runs code (lib/server/blob.ts + the sweep's GC phase), so the
    // page must disclose every one of them — that is the promise this asserts.
    expect(source).toMatch(/report is delivered/i);
    expect(source).toMatch(/canceled, refunded, or sent for manual review/i);
    expect(source).toMatch(/when you delete your account/i);
    expect(source).toMatch(/seven days/i);

    expect(source).toMatch(/private object storage/i);
    expect(source).toMatch(/authenticated server request/i);
    expect(source).not.toMatch(/public but unlisted/i);
  });
});
