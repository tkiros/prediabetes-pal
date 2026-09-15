/**
 * The guide-door flag (PRD/Prediabetes_Pal_Guide_Redesign_PRD_v1.1.md §9
 * Step 1). Gates every "guide" surface — the ideas block above the Home hero,
 * the source lead-in on the result card, the orientation line, the Learn
 * pages and the intake changes — and it is §9.2's revert lever: if ideas are
 * opened in fewer than a quarter of sessions after four weeks, this goes back
 * to unset and the front door reverts to the check.
 *
 * Client build flag, fail-closed (only exact "1"). Deliberately NO server
 * twin for the flag itself. That used to mean no surface it gated added a
 * server boundary either — the ideas bank is static data and a tapped idea
 * runs an ordinary, already IP-metered /api/check call — but `orient` (PR-3)
 * is not boundary-free: it adds a real `PATCH /api/profile` orientation op
 * and a `profiles.orientation` column, and the server gates both directly on
 * `guideDoorEnabled("orient")` (A-111). So the "no runtime kill switch"
 * reasoning below only holds while a surface with a server boundary stays
 * dark — same build-time posture as NEXT_PUBLIC_REVIEWER_MODE either way:
 * turning `orient` off after it has shipped is still a reviewed rebuild +
 * redeploy, never an env flip, because the server's own check reads this
 * same build-time env.
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
 * Every copy-ledger Copy ID each surface renders (A-101, A-119). The
 * production door guard (lib/guide-door-guard.ts) refuses a surface unless
 * every row listed here is `Status = Approved` in docs/safety/copy-ledger.md —
 * a row missing from the ledger counts as not Approved. Concrete IDs only,
 * never a wildcard: the guard cannot read a pattern's status.
 *
 * The zero-rows rule: `calm` renders no new copy, so it opens with an empty
 * list. Every OTHER surface with an empty list (`numbers`, `refer`, `doctor`,
 * `plan`, `guide` today) is refused in production — "no rows" means its rows
 * are not filed yet, not that it has nothing to approve. The PR that files a
 * surface's rows lists them here.
 */
export const SURFACE_ROWS: Record<GuideSurface, readonly string[]> = {
  ideas: [
    "guide-ideas-breakfast",
    "guide-ideas-lunch",
    "guide-ideas-dinner",
    "guide-ideas-hero",
    "check-empty-ideas",
    "check-from-idea",
    // A-119: the classics-hint variant is its own row — a guard cannot read a
    // variant's status inside onboarding-first-check.
    "check-classics-hint-guide"
  ],
  source: ["result-source-lead"],
  calm: [],
  // The plan's `orientation-*` rows as named so far; later PRs extend the list.
  orient: [
    "orientation-intro",
    "orientation-step-01",
    "orientation-step-02",
    "orientation-step-03",
    "orientation-step-04",
    "orientation-step-05",
    "orientation-step-06",
    "orientation-step-07",
    "orientation-day-eyebrow",
    "orientation-controls",
    "orientation-note-hint",
    // A-83 shipped: the guest dashboard now renders this row (an
    // expired-taster guest's sign-in line, owner default 2026-09-14). Stays
    // listed until A-84 (recordStepEvent) also ships — without it, Home
    // re-asks for a check on days 2 and 3 after one (final review I2).
    "orientation-signin-step",
    "orientation-save-failed",
    "learn-first-week-intro",
    "journey-where-you-are",
    "onboarding-final-button",
    "onboarding-first-week-line",
    "orientation-step-prefix"
  ],
  home: [
    "home-quick-row",
    "learn-tiles",
    "guide-ideas-later",
    "home-door-worried-line",
    "home-check-hero-title"
  ],
  // The plan's `onboarding-ask-*` rows as named so far; later PRs extend the list.
  intake: [
    "onboarding-ask-pains",
    "onboarding-ask-win",
    "onboarding-ask-response",
    "onboarding-expectations-ideas",
    "onboarding-welcome-guide"
  ],
  "ideas-full": ["guide-ideas-see-all"],
  numbers: [],
  refer: [],
  doctor: [],
  plan: [],
  guide: []
};

/**
 * Surfaces that only make sense with others open (A-101). The production
 * guard refuses a list that names a surface without everything it requires.
 */
export const SURFACE_REQUIRES: Partial<Record<GuideSurface, readonly GuideSurface[]>> = {
  // The quick row's Ideas item is the See-all toggle.
  home: ["ideas", "ideas-full"],
  // Step 4 points at the ideas block.
  orient: ["ideas"],
  intake: ["orient"],
  "ideas-full": ["ideas"]
};

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
