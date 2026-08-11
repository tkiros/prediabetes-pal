import { DrizzleAdapter } from "@auth/drizzle-adapter";
import NextAuth from "next-auth";
import Resend from "next-auth/providers/resend";

import { getDb, schema } from "./lib/server/db";
import {
  emailStubDirectory,
  writeEmailStub
} from "./lib/server/email-stub";
import { checkEmailCooldown } from "./lib/pal/rate-limit";
import { EMAIL_FROM } from "./lib/pal/contact";
import { normalizeSigninIdentifier } from "./lib/server/auth-identifier";
import { sendEmail } from "./lib/server/email";

/**
 * Auth.js v5 — email magic-link via Resend, database sessions in Railway
 * Postgres (docs/adr/hosting-hybrid.md). DB sessions make sign-out-everywhere
 * and account deletion trivially correct.
 *
 * The adapter is only constructed when DATABASE_URL is present: it is always
 * present at runtime on Vercel (preview/prod) and in dev once Railway
 * Postgres is provisioned (§10); without it, importing this module stays
 * safe (builds, tests) and auth simply isn't available.
 */


const adapter = process.env.DATABASE_URL
  ? DrizzleAdapter(getDb() as unknown as Parameters<typeof DrizzleAdapter>[0], {
      usersTable: schema.users as never,
      accountsTable: schema.accounts as never,
      sessionsTable: schema.sessions as never,
      verificationTokensTable: schema.verificationTokens as never
    })
  : undefined;

export const AUTH_EMAIL_AVAILABLE = Boolean(adapter);

const emailProvider = Resend({
  apiKey: process.env.RESEND_API_KEY,
  from: EMAIL_FROM,
  // AUD-024 defense in depth: canonicalize the identifier ourselves (NFKC
  // first, exactly one ASCII "@") even though the upgraded @auth/core is
  // patched — see lib/server/auth-identifier.ts.
  normalizeIdentifier: normalizeSigninIdentifier,
  async sendVerificationRequest(params) {
    // Resolve the test seam before doing network work. In production the
    // shared policy treats AUTH_EMAIL_STUB_DIR as absent, so a one-time login
    // URL can never be written to the server filesystem.
    const stubDir = emailStubDirectory(process.env);
    const apiKey = process.env.RESEND_API_KEY?.trim();
    if (!stubDir && !apiKey) {
      throw new Error("Authentication email provider is not configured.");
    }

    // Per-email cooldown (W-11). The Edge proxy limits POST /api/auth/* per
    // IP, but per-IP cannot see the attack that matters most here: a flood
    // spread across many IPs aimed at ONE victim's mailbox. This is the
    // single choke point every magic link passes through — the sign-in form
    // AND the trial funnel's signIn() call both land here. Throwing aborts
    // the send (Auth.js surfaces its error page); trial start swallows it
    // and still returns a checkout url, which is correct: a cooled-down
    // inbox must never block a paying customer.
    const cooldown = await checkEmailCooldown("auth_email", params.identifier);
    if (!cooldown.ok) {
      throw new Error("Too many sign-in emails requested for this address.");
    }

    if (stubDir) {
      await writeEmailStub(
        stubDir,
        `${params.identifier.replace(/[^a-z0-9@.]/gi, "_")}.json`,
        { email: params.identifier, url: params.url }
      );
      return;
    }

    const result = await sendEmail({
      to: params.identifier,
      subject: "Your Prediabetes Pal sign-in link",
      text: `Sign in to Prediabetes Pal:\n\n${params.url}\n\nThis link expires in 24 hours. If you didn't request it, you can ignore this email.`,
      category: "auth_magic_link",
      idempotencyKey: `auth/${params.url}`
    });

    if (!result.ok) {
      throw new Error(`Resend error: ${result.status}`);
    }
  }
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  adapter,
  // A source/build/test environment without DATABASE_URL must still support
  // clean signed-out reads. Pairing an absent adapter with an email provider
  // or database sessions is invalid Auth.js configuration and previously
  // emitted MissingAdapter on every page. Production keeps database sessions.
  session: { strategy: adapter ? "database" : "jwt" },
  callbacks: {
    session({ session, user }) {
      session.user.id = user.id;
      return session;
    }
  },
  pages: { signIn: "/signin", verifyRequest: "/signin/check-email" },
  providers: adapter ? [emailProvider] : []
});
