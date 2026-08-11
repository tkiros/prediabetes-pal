import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  emailStubDirectory,
  isProductionDeployment,
  writeEmailStub
} from "../../../lib/server/email-stub";

describe("email stub production boundary", () => {
  it("blocks the mailbox on Vercel production and non-Vercel production", () => {
    expect(
      emailStubDirectory({
        AUTH_EMAIL_STUB_DIR: "/tmp/mailbox",
        VERCEL_ENV: "production",
        NODE_ENV: "development"
      })
    ).toBeNull();
    expect(
      emailStubDirectory({
        AUTH_EMAIL_STUB_DIR: "/tmp/mailbox",
        NODE_ENV: "production"
      })
    ).toBeNull();
  });

  it("allows explicit preview and development deployments", () => {
    expect(
      emailStubDirectory({
        AUTH_EMAIL_STUB_DIR: " /tmp/mailbox ",
        VERCEL_ENV: "preview",
        NODE_ENV: "production"
      })
    ).toBe("/tmp/mailbox");
    expect(
      isProductionDeployment({
        VERCEL_ENV: "development",
        NODE_ENV: "production"
      })
    ).toBe(false);
  });

  it("writes mailbox material with owner-only permissions", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "pal-stub-policy-"));
    const directory = path.join(root, "mailbox");

    await writeEmailStub(directory, "message.json", { url: "https://example.test" });

    expect(fs.statSync(directory).mode & 0o777).toBe(0o700);
    expect(fs.statSync(path.join(directory, "message.json")).mode & 0o777).toBe(
      0o600
    );
  });

  it("rejects a filename that could escape the mailbox", async () => {
    await expect(
      writeEmailStub("/tmp/pal-unused-mailbox", "../escape.json", {})
    ).rejects.toThrow("must not contain a path");
  });
});
