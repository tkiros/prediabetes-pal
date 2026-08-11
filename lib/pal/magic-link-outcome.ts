/**
 * `signIn(..., { redirect: false })` resolves with the URL @auth/core would
 * have redirected to instead of throwing: a successful email send targets
 * `/verify-request?...`, while every send failure (provider unconfigured,
 * fail-closed cooldown, Resend API error) comes back as an error-page URL
 * carrying `?error=<type>` (see @auth/core/index.js catch block). The signin
 * page previously ignored this and showed "check your email" even when no
 * email was ever sent.
 *
 * Anything that is not a parseable string is treated as failure too — if the
 * contract changes shape we must not silently claim the email was sent.
 */
export function magicLinkSendFailed(result: unknown): boolean {
  if (typeof result !== "string") {
    return true;
  }
  try {
    return new URL(result, "http://localhost").searchParams.has("error");
  } catch {
    return true;
  }
}
