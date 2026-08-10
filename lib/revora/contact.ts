/**
 * Single source of truth for the domains Revora puts in front of a user.
 *
 * These were copy-pasted literals across twelve call sites, and they drifted
 * onto two domains we did not control: `signin@revora.app` (owned by an
 * unrelated company — every magic link was sent from a third party's domain,
 * one DMARC policy change away from a total sign-in outage) and
 * `support@revora.bio` (registered to nobody — anyone could have taken it and
 * received user support mail). Same failure mode as the verdict labels in
 * `labels.ts`: a literal in N places is a guarantee in zero places.
 *
 * Change the address here and every surface moves atomically. Anything added
 * here must be on a domain we own — `tests/unit/revora/owned-domains.test.ts`
 * fails the build otherwise.
 */

/** Public support inbox. Rendered in Terms, Privacy, reports, and pantry mail. */
// ⛔ prediabetespal.com must have inbound forwarding configured at the
// registrar before this deploys, or support mail bounces (revora.plus kept
// working via Namecheap forwarding; the new apex starts with nothing).
export const SUPPORT_EMAIL = "support@prediabetespal.com";

/**
 * Support-case message cap (P0.4). One constant for the form's counter AND
 * the API's zod `.max()` — hand-synced copies drift, and a drifted cap means
 * the UI approves a message the server then 400s.
 */
export const SUPPORT_MESSAGE_MAX = 2000;

/**
 * Envelope sender for every transactional send (magic links included).
 * Overridable so preview can send from its own subdomain with its own DKIM
 * key without touching production's reputation.
 *
 * The fallback lives on `contact.prediabetespal.com` because the sending
 * domain must be the one verified in Resend — the apex keeps its MX/SPF on
 * registrar forwarding for the support inbox, and Resend's DKIM/SPF records
 * are scoped to the subdomain. Sending from an address the provider has not
 * verified silently bounces every magic link.
 *
 * ⛔ RENAME GATE (docs/ops/env-reference.md:64): production uses THIS
 * fallback (AUTH_EMAIL_FROM is a preview-only override), so this line
 * flipping IS the sender cutover. `contact.prediabetespal.com` must be
 * Resend-verified with DKIM green BEFORE this commit deploys, or every
 * magic link lands in spam — a login outage on a passwordless product.
 * (`contact.revora.plus` was the previous verified domain, P0.2 2026-07-21.)
 */
// `||` on the trimmed value, not `??`: a set-but-empty AUTH_EMAIL_FROM is not
// nullish, so `??` would keep it and give every send a blank From. An empty
// override can only ever be a mistake; fall through to the real sender.
export const EMAIL_FROM =
  process.env.AUTH_EMAIL_FROM?.trim() ||
  "Prediabetes Pal <signin@contact.prediabetespal.com>";
