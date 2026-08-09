/**
 * Single source of client-safe A1C boundary + disclaimer copy.
 *
 * SAFETY-OWNED FILE. Onboarding is a client component and cannot read the
 * filesystem, so it cannot call `loadSafetyContract()` (which parses
 * `docs/safety/copy-ledger.md` server-side). That is why these strings were
 * once hardcoded in the page — and then drifted from the ledger. This module is
 * the ONE place the below-range, high-range, and disclaimer strings live, for
 * client and server surfaces alike.
 *
 * The values MUST stay byte-for-byte equal to the approved + active ledger rows
 * `below-range-route`, `high-range-route`, and `result-footer`. The drift test
 * `tests/unit/revora/boundary-copy-drift.test.ts` fails if the module and the
 * ledger diverge — so a change here that the ledger does not carry (or vice
 * versa) turns the suite red.
 *
 * Changing any string in this file REQUIRES the safety owner's sign-off, and a
 * migration note recorded in the copy ledger when the MEANING changes (not just
 * wording). Update the ledger row and this constant in the same change.
 */

/**
 * Copy version stamp. Bump when a string here changes so telemetry and reviews
 * can attribute a rendered boundary message to the exact copy that produced it.
 * Aligned to the last boundary-copy revision (high-range-route, 2026-07-16).
 */
// 2026-08-09.1: Revora → Prediabetes Pal rename. high-range-route also
// shortened (name swap pushed it past the 280-char out-of-scope cap): second
// name mention → "It", dropped the redundant "prediabetes" before "bands"
// (the product name now carries it). Meaning unchanged; owner re-approval of
// the renamed rows is counsel item N6.
export const BOUNDARY_COPY_VERSION = "2026-08-09.1";

/** Ledger row `below-range-route` — A1C below the prediabetes floor (5.7%). */
export const BELOW_RANGE_MESSAGE =
  "Prediabetes Pal is designed for the prediabetes A1C range of 5.7% to 6.4%. This value sits below that range, so use a doctor or registered dietitian for guidance that is specific to you.";

/** Ledger row `high-range-route` — A1C at or above the prediabetes ceiling (6.5%). */
export const HIGH_RANGE_MESSAGE =
  "This A1C value falls in the range clinicians use when evaluating Type 2 diabetes, and Prediabetes Pal's bands do not apply there. It does not know your medicine or glucose readings — please talk with a doctor or registered dietitian for next steps made for you.";

/** Ledger row `result-footer` — the stable informational-only disclaimer. */
export const BOUNDARY_DISCLAIMER =
  "Prediabetes Pal is informational only and is not medical advice. Talk with a doctor or registered dietitian for guidance that is specific to you.";
