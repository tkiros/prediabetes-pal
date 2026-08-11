import { EMAIL_FROM, SUPPORT_EMAIL } from "../pal/contact";
import { getDb, type Db } from "./db";
import {
  beginEmailAttempt,
  emailContentFingerprint,
  markEmailAccepted,
  markEmailAttemptFailed,
  safeCode,
  type EmailCategory
} from "./email-delivery";
import { emailStubDirectory, writeEmailStub } from "./email-stub";

/**
 * One transactional-email door for everything that is not a NextAuth magic
 * link (pantry intake, report delivery, founder alerts). Same raw-fetch
 * Resend call and the same AUTH_EMAIL_STUB_DIR test seam as auth.ts, so
 * Playwright reads these from disk exactly like magic links.
 * ponytail: raw fetch, no SDK; add the Resend SDK only if we ever need
 * attachments or templates.
 */


/**
 * Where the app's own notifications (support cases, pantry-sweep alerts) land.
 * SUPPORT_EMAIL stays the public address users write to, but revora.plus's MX
 * is Namecheap email forwarding, whose relays greylist Resend's sending IPs —
 * observed 2026-07-22: 3/3 Resend→support@ sends bounced ("Generic Temporary
 * Delivery Failure") while 4/4 Resend→Gmail sends delivered, and Gmail→support@
 * forwarded fine (real MTAs retry 4xx; Resend gives up). So internal mail goes
 * to a directly-deliverable inbox when SUPPORT_INBOX_EMAIL is set.
 * (Observed on revora.plus pre-rename; the same failure mode applies to
 * prediabetespal.com whenever its MX is registrar forwarding too.)
 */
export function supportInbox(): string {
  return process.env.SUPPORT_INBOX_EMAIL || SUPPORT_EMAIL;
}

export type SendEmailInput = {
  to: string;
  subject: string;
  text: string;
  category?: EmailCategory;
  /** Stable workflow seed; it is SHA-256 hashed before storage/provider use. */
  idempotencyKey?: string;
};
export type SendEmailResult = { ok: true } | { ok: false; status: number };
export type SendEmailDeps = {
  fetchImpl?: typeof fetch;
  db?: Db | null;
  now?: () => Date;
};

export async function sendEmail(
  input: SendEmailInput,
  deps: SendEmailDeps = {}
): Promise<SendEmailResult> {
  const now = deps.now?.() ?? new Date();
  const category = input.category ?? "transactional";
  let tracking:
    | { kind: "send"; attemptId: string; idempotencyKey: string }
    | null = null;

  try {
    const stubDir = emailStubDirectory(process.env);
    if (stubDir) {
      const name = `${input.to.replace(/[^a-z0-9@.]/gi, "_")}-${Date.now()}.json`;
      await writeEmailStub(stubDir, name, input);
      return { ok: true };
    }

    const db = resolveDeliveryDb(deps);
    if (!db && isPublicRuntime()) {
      // A public send without a durable attempt cannot be correlated with the
      // delivery webhook. Fail before contacting Resend.
      return { ok: false, status: 503 };
    }

    if (db) {
      const attempt = await beginEmailAttempt(
        db,
        {
          to: input.to,
          category,
          idempotencySeed: input.idempotencyKey,
          contentFingerprint: emailContentFingerprint({
            to: input.to,
            subject: input.subject,
            text: input.text,
            category
          })
        },
        now
      );
      if (attempt.kind === "already_accepted") {
        return { ok: true };
      }
      if (attempt.kind === "blocked") {
        return { ok: false, status: attempt.status };
      }
      tracking = attempt;
    }

    const apiKey = process.env.RESEND_API_KEY?.trim();
    if (!apiKey) {
      if (tracking && db) {
        await markEmailAttemptFailed(
          db,
          tracking.attemptId,
          "rejected",
          "missing_api_key",
          now
        );
      }
      return { ok: false, status: 503 };
    }

    const fetchImpl = deps.fetchImpl ?? fetch;
    const response = await fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        ...(tracking ? { "Idempotency-Key": tracking.idempotencyKey } : {})
      },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: input.to,
        subject: input.subject,
        text: input.text
      }),
      signal: AbortSignal.timeout(10_000)
    });

    if (!response.ok) {
      if (tracking && db) {
        const responseBody = await safeResponseJson(response);
        await markEmailAttemptFailed(
          db,
          tracking.attemptId,
          response.status === 429
            ? "rate_limited"
            : response.status >= 500
              ? "transport_failed"
              : "rejected",
          safeCode(
            typeof responseBody.type === "string"
              ? responseBody.type
              : `http_${response.status}`
          ),
          now
        );
      }
      return { ok: false, status: response.status };
    }

    if (tracking && db) {
      const responseBody = await safeResponseJson(response);
      const providerMessageId =
        typeof responseBody.id === "string" ? responseBody.id.trim() : "";
      if (!providerMessageId || providerMessageId.length > 255) {
        await markEmailAttemptFailed(
          db,
          tracking.attemptId,
          "transport_failed",
          "invalid_provider_response",
          now
        );
        return { ok: false, status: 502 };
      }
      await markEmailAccepted(db, tracking.attemptId, providerMessageId, now);
    }

    return { ok: true };
  } catch {
    // Every caller owns a durable retry state (Pantry order, billing inbox, or
    // cron timestamp). A transport rejection/timeout must be a normal failed
    // attempt, not an exception that aborts the rest of a recovery sweep.
    try {
      const db = resolveDeliveryDb(deps);
      if (tracking && db) {
        await markEmailAttemptFailed(
          db,
          tracking.attemptId,
          "transport_failed",
          "transport_error",
          now
        );
      }
    } catch {
      // The original failure still wins; never expose storage/provider detail.
    }
    return { ok: false, status: 503 };
  }
}

function resolveDeliveryDb(deps: SendEmailDeps): Db | null {
  if (deps.db !== undefined) {
    return deps.db;
  }
  return process.env.DATABASE_URL ? getDb() : null;
}

function isPublicRuntime(): boolean {
  if (process.env.NODE_ENV === "test") {
    return false;
  }
  return (
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL_ENV === "production" ||
    process.env.VERCEL_ENV === "preview"
  );
}

async function safeResponseJson(response: Response): Promise<Record<string, unknown>> {
  if (typeof response.json !== "function") {
    return {};
  }
  try {
    const value = (await response.json()) as unknown;
    return value !== null && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}
