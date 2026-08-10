import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { EMAIL_FROM, SUPPORT_EMAIL } from "../../../lib/revora/contact";

/**
 * Every address Revora shows a user, or sends mail from, must be on a domain
 * we own.
 *
 * This test exists because both of them were not. `signin@revora.app` shipped
 * as the magic-link sender in auth.ts and lib/server/email.ts — that domain
 * belongs to an unrelated company, so every sign-in email was sent from a third
 * party's domain and one `p=reject` away from locking every user out. And
 * `support@revora.bio` was the support address on twelve surfaces (one of them
 * hardcoded past its own env override) while being registered to nobody at all,
 * free for anyone to claim and start receiving user mail.
 *
 * Neither was caught because neither was ever asserted. A literal repeated
 * across twelve files is a guarantee in zero of them. Route new addresses
 * through lib/revora/contact.ts and this stays true by construction.
 */

const ROOT = process.cwd();
const SCANNED = ["app", "components", "lib", "auth.ts"];

/** Domains we do not control. Adding one here is a bug, not a fix. */
const UNOWNED = [
  "revora.app", // live F1-graphics company, unrelated to us
  "revora.bio", // unregistered
  "revora.xyz", // held by a domain investor
  "revora.com" // held by a domain investor
];

const OWNED_SUFFIX = "@prediabetespal.com";
// Senders may live on a subdomain of the owned apex (contact.prediabetespal.com
// must be the Resend-verified sending domain; the apex keeps registrar
// forwarding for the support inbox). revora.plus stays registered (301s +
// old links) but no user-facing address may remain on it after the rename.
const OWNED_SENDER = /@(?:[a-z0-9-]+\.)?prediabetespal\.com>?$/;

function sourceFiles(rel: string): string[] {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) return [];
  if (fs.statSync(abs).isFile()) return [abs];
  return fs
    .readdirSync(abs, { withFileTypes: true })
    .flatMap((entry) =>
      entry.name === "node_modules" || entry.name.startsWith(".")
        ? []
        : sourceFiles(path.join(rel, entry.name))
    )
    .filter((file) => /\.(ts|tsx)$/.test(file));
}

describe("owned domains", () => {
  it("sends and shows only addresses on a domain we own", () => {
    expect(SUPPORT_EMAIL.endsWith(OWNED_SUFFIX)).toBe(true);
    expect(EMAIL_FROM).toMatch(OWNED_SENDER);
  });

  it("has no unowned domain anywhere in shipped source", () => {
    const contact = path.join(ROOT, "lib/revora/contact.ts");
    const offenders: string[] = [];

    for (const rel of SCANNED) {
      for (const file of sourceFiles(rel)) {
        // contact.ts names the retired domains in its own docstring, on
        // purpose: the history is why the constant exists.
        if (file === contact) continue;
        const source = fs.readFileSync(file, "utf8");
        for (const domain of UNOWNED) {
          if (source.includes(domain)) {
            offenders.push(`${path.relative(ROOT, file)} → ${domain}`);
          }
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});
