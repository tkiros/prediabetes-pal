/**
 * The GDM-door flag (PRD/Prediabetes_Pal_GDM_Door_PRD_v1.1.md §9 Step 2). One
 * env var gates every surface of the second front door and is §9.2's revert
 * lever. Same surface-listed shape as lib/guide-door-flag.ts: `1` opens every
 * surface (dev, previews, the e2e build); a comma list opens only those named;
 * anything else opens none. Production never carries `1`.
 *
 * Unlike the guide door this one has a SERVER TWIN. The corrected rule (see
 * the comment above `guideDoorStates()` in app/api/health/route.ts, G-67) is
 * that a flag may skip a twin only when there is no separate runtime kill
 * switch for it to pair with — not, as this file used to say, whenever the
 * door "adds no server boundary". The GDM door stores health data behind
 * server routes, a real server boundary with its own runtime switch
 * (GDM_DOOR_ENABLED), so it gets the full twin pair (see `gdmDoorStates()` in
 * the same file for how the two are combined). Every /api/gdm/* route 404s
 * unless GDM_DOOR_ENABLED is exactly "1".
 *
 * THE TWIN IS THE INCIDENT LEVER, AND IT FAILS CLOSED (review G-09). On Vercel
 * an env change only takes effect through a redeploy, and a redeploy runs the
 * production guard. So the guard must never refuse a missing twin: it CLOSES
 * every surface instead (lib/gdm-door-guard.ts). Unset either variable and
 * redeploy, and the door is dark. This differs on purpose from the four
 * `twinMismatch` pairs in next.config.ts, which throw.
 *
 * Surfaces map to the PRD's gates, not to features:
 *   landing   — the public route + sign-up            (gdm-organiser)
 *   organiser — all of Tier 1, one ledger batch       (gdm-organiser)
 *   ideas     — F-IDEAS-GDM                           (S1–S3, gdm-food-ideas)
 *   read      — F-ROUTER, the read box, F-PLANREAD    (S1–S4, gdm-plan-read)
 */
export const GDM_SURFACES = ["landing", "organiser", "ideas", "read"] as const;
export type GdmSurface = (typeof GDM_SURFACES)[number];

/**
 * Every copy-ledger Copy ID each surface renders. The production guard
 * (lib/gdm-door-guard.ts) refuses a surface unless every row listed here is
 * `Approved` and `Active = Yes`, and refuses a surface with no rows at all.
 * Concrete IDs only. The task that files a row adds it here.
 */
export const GDM_SURFACE_ROWS: Record<GdmSurface, readonly string[]> = {
  landing: [
    "gdm-door-name",
    "gdm-landing-hero",
    "gdm-landing-points",
    "gdm-landing-holding",
    "gdm-disclaimer",
    "gdm-maker"
  ],
  organiser: [
    "gdm-door-name",
    "gdm-disclaimer",
    "gdm-maker",
    "gdm-consent-required",
    "gdm-nav",
    "gdm-onboarding-told",
    "gdm-onboarding-not-told",
    "gdm-onboarding-date",
    "gdm-onboarding-consent",
    "gdm-save-failed",
    "gdm-data-controls",
    "gdm-privacy-notice",
    "gdm-status",
    "gdm-load-failed",
    "gdm-list-full",
    "gdm-asklist-lead",
    "gdm-asklist-controls",
    "gdm-occasions",
    "gdm-plan-controls",
    "gdm-plan-differ"
  ],
  ideas: [],
  read: []
};

export const GDM_SURFACE_REQUIRES: Partial<Record<GdmSurface, readonly GdmSurface[]>> = {
  ideas: ["organiser"],
  read: ["organiser"]
};

/** The safety owner's non-copy gates (PRD §10.2), recorded in docs/safety/gdm-gates.md. */
export const GDM_GATES = ["S1", "S2", "S3", "S4"] as const;
export type GdmGate = (typeof GDM_GATES)[number];

export const GDM_SURFACE_GATES: Record<GdmSurface, readonly GdmGate[]> = {
  landing: [],
  organiser: [],
  ideas: ["S1", "S2", "S3"],
  read: ["S1", "S2", "S3", "S4"]
};

export function gdmDoorEnabled(surface: GdmSurface): boolean {
  const value = process.env.NEXT_PUBLIC_GDM_DOOR ?? "";
  if (value === "1") return true;
  return value
    .split(",")
    .map((token) => token.trim())
    .includes(surface);
}

export function gdmDoorServerEnabled(
  env: { GDM_DOOR_ENABLED?: string } = process.env as unknown as {
    GDM_DOOR_ENABLED?: string;
  }
): boolean {
  return env.GDM_DOOR_ENABLED === "1";
}
