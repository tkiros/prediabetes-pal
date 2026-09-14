/**
 * The guide-door flag (PRD/Prediabetes_Pal_Guide_Redesign_PRD_v1.1.md §9
 * Step 1). Gates every "guide" surface — the ideas block above the Home hero,
 * the source lead-in on the result card, the orientation line, the Learn
 * pages and the intake changes — and it is §9.2's revert lever: if ideas are
 * opened in fewer than a quarter of sessions after four weeks, this goes back
 * to unset and the front door reverts to the check.
 *
 * Client build flag, fail-closed (only exact "1"). Deliberately NO server
 * twin: the door adds no server boundary — the bank is static data and a
 * tapped idea runs an ordinary, already IP-metered /api/check call — so the
 * twin guard's job (a runtime kill switch for a server surface) does not
 * apply. Same shape as NEXT_PUBLIC_REVIEWER_MODE. Consequence: turning the
 * door off is a reviewed rebuild + redeploy, not an env flip.
 *
 * Amendment A-04 extends this to a surface-listed gate. `1` opens every
 * surface; a comma-separated list opens only the surfaces named; anything
 * else opens none. Production never carries `1` — the production value is
 * always the explicit list of surfaces whose ledger rows are `Approved`,
 * allowing a PR to merge while its surface stays dark in production.
 */

export const GUIDE_SURFACES = [
  "ideas",
  "source",
  "calm",
  "orient",
  "home",
  "intake",
  "ideas-full",
  "numbers",
  "refer",
  "doctor",
  "plan",
  "guide",
] as const;

export type GuideSurface = (typeof GUIDE_SURFACES)[number];

/**
 * `1` opens every guide surface; a comma list opens only those named; any
 * other value (unset included) opens none. Fail-closed, exact tokens only.
 * Same build-time, no-server-twin posture as documented above — the list
 * exists so a PR whose ledger rows are still Pending can merge while its
 * surface stays dark in production.
 */
export function guideDoorEnabled(surface: GuideSurface): boolean {
  const value = process.env.NEXT_PUBLIC_GUIDE_DOOR ?? "";
  if (value === "1") return true;
  return value
    .split(",")
    .map((token) => token.trim())
    .includes(surface);
}
