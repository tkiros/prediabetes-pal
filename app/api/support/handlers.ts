import { NextResponse } from "next/server";
import { z } from "zod";

import { SUPPORT_MESSAGE_MAX } from "../../../lib/pal/contact";
import { captureServerError } from "../../../lib/pal/sentry-capture";
import { encryptField } from "../../../lib/server/crypto";
import { getDb, schema, type Db } from "../../../lib/server/db";
import { sendEmail, supportInbox } from "../../../lib/server/email";
import {
  getSessionInfo,
  type SessionInfo
} from "../../../lib/server/session";

/**
 * P0.4 (C7 plan §9): the in-account "Request help or refund" door.
 *
 * POST stores an authenticated case (message encrypted at rest) and then
 * sends a PII-minimized queue notification to the support inbox. The encrypted
 * row is the source of truth and is readable only through the authenticated
 * admin support endpoint. It is written first, and an email failure
 * never loses the case — the user still gets their case id, the failure is
 * captured, and the confirmation copy names the direct-email fallback.
 *
 * Rate limiting happens in the Edge proxy (`support_ip`, fail-closed — this
 * door is an email amplifier). Validation here is the trust boundary:
 * kind whitelist, trimmed non-empty message, hard length cap.
 */

export { SUPPORT_MESSAGE_MAX };

const BodySchema = z.object({
  kind: z.enum(["help", "refund"]),
  message: z
    .string()
    .trim()
    .min(1)
    .max(SUPPORT_MESSAGE_MAX)
});

export type SupportRouteDeps = {
  db?: () => Db;
  getSession?: () => Promise<SessionInfo>;
  sendEmailImpl?: typeof sendEmail;
};

export function createSupportCaseHandler(deps: SupportRouteDeps = {}) {
  const db = deps.db ?? getDb;
  const getSession = deps.getSession ?? getSessionInfo;
  const send = deps.sendEmailImpl ?? sendEmail;

  return async function POST(request: Request) {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    }

    let raw: unknown = null;
    try {
      raw = await request.json();
    } catch {
      raw = null;
    }
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Choose help or refund and write a short message (up to 2000 characters)." },
        { status: 400 }
      );
    }

    const { kind, message } = parsed.data;

    const [row] = await db()
      .insert(schema.supportCases)
      .values({
        userId: session.userId,
        kind,
        messageCiphertext: encryptField(message)
      })
      .returning({ id: schema.supportCases.id });

    let emailed = false;
    try {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
      const result = await send({
        to: supportInbox(),
        subject: `[${kind}] Support case ${row.id}`,
        text:
          `Case: ${row.id}\n` +
          `Kind: ${kind}\n` +
          `Review in the authenticated support queue:\n` +
          `${appUrl}/api/admin/support\n`,
        category: "support_case",
        idempotencyKey: `support-case/${row.id}`
      });
      emailed = result.ok;
      if (!result.ok) {
        await captureServerError(
          new Error(`support case email failed (status ${result.status})`),
          "support"
        );
      }
    } catch (error) {
      await captureServerError(error, "support");
    }

    return NextResponse.json({ caseId: row.id, emailed }, { status: 201 });
  };
}
