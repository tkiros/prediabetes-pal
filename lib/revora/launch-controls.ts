/**
 * Launch-control contracts and threshold helpers for Prediabetes Pal (Plan 04-02)
 *
 * Reads Edge Config keys `launch_mode`, `public_checks_enabled`, and
 * `incident_message` when EDGE_CONFIG is present. Falls back to safe defaults
 * (normal mode, checks enabled) without invoking the SDK when EDGE_CONFIG is
 * absent.
 *
 * Non-production override seam: set REVORA_LAUNCH_MODE_OVERRIDE=paused to
 * simulate incidents in unit and smoke tests without mutating live Edge Config.
 * The override is deliberately NOT honoured when NODE_ENV is "production" or
 * VERCEL_ENV is "production".
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LaunchMode = "normal" | "paused";

export type LaunchControls = {
  launchMode: LaunchMode;
  publicChecksEnabled: boolean;
  incidentMessage: string;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_INCIDENT_MESSAGE =
  "Prediabetes Pal checks are temporarily paused. Please try again later.";

const PAUSE_COPY =
  "Prediabetes Pal checks are paused right now. Please try again in a few minutes.";

// ---------------------------------------------------------------------------
// Threshold helper
// ---------------------------------------------------------------------------

/**
 * shouldPauseForOps — operator-driven threshold helper.
 *
 * Returns true when any of the following conditions are met:
 *  - A harmful-guidance incident has been flagged (manual operator input)
 *  - A provider-failure spike has been detected (manual operator input)
 *  - Checks in the last 24 hours have reached or exceeded 2,000 (manual
 *    operator pause threshold)
 *
 * The middleware enforces the automatic Upstash-backed daily cap before model
 * spend. This helper remains for manual operator decisions, drills, and
 * dashboards that need to decide whether to flip Edge Config pause controls.
 */
export function shouldPauseForOps(input: {
  checksLast24h: number;
  harmfulGuidanceIncident: boolean;
  providerFailureSpike: boolean;
}): boolean {
  return (
    input.harmfulGuidanceIncident ||
    input.providerFailureSpike ||
    input.checksLast24h >= 2_000
  );
}

// ---------------------------------------------------------------------------
// Non-production override seam
// ---------------------------------------------------------------------------

function isProductionEnvironment(): boolean {
  return (
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL_ENV === "production"
  );
}

function getOverrideMode(): LaunchMode | null {
  // Never honour the override in production to prevent accidental ops mistakes
  if (isProductionEnvironment()) {
    return null;
  }

  const override = process.env.REVORA_LAUNCH_MODE_OVERRIDE?.trim().toLowerCase();
  if (override === "paused") {
    return "paused";
  }
  return null;
}

// ---------------------------------------------------------------------------
// Edge Config reader
// ---------------------------------------------------------------------------

// RE-02: last controls successfully read from Edge Config this runtime. When
// the store is configured but momentarily unreachable, serving the last-good
// value keeps a flipped kill switch flipped (and an unflipped one unflipped)
// instead of silently reverting to "checks enabled".
let lastGoodControls: LaunchControls | null = null;

/**
 * Three outcomes, and the distinction is the whole point (RE-02):
 *  - null          — EDGE_CONFIG is not configured. The operator has no kill
 *                    switch; defaults apply (checks enabled).
 *  - LaunchControls — a successful read (absent keys = safe defaults; an
 *                    unset store legitimately means "no incident").
 *  - "unreachable" — EDGE_CONFIG IS configured but the read failed. The old
 *                    code returned null here (with a comment claiming
 *                    "fail closed" — factually inverted): the result was
 *                    checks-ENABLED during exactly the outage windows when an
 *                    operator most needs the brake to hold. Callers must fail
 *                    closed (pause) unless a last-good value exists.
 */
async function readEdgeConfigControls(): Promise<
  LaunchControls | "unreachable" | null
> {
  // Skip Edge Config entirely when connection string is absent
  if (!process.env.EDGE_CONFIG?.trim()) {
    return null;
  }

  try {
    // Dynamic import avoids a hard dependency on the SDK in environments
    // where EDGE_CONFIG is not configured (e.g. local dev, unit tests).
    const { get } = await import("@vercel/edge-config");

    // No per-key catch: a transport failure on any key means the store is
    // unreachable and must be treated as such, not as "key unset".
    const [launchModeRaw, publicChecksEnabledRaw, incidentMessageRaw] =
      await Promise.all([
        get<string>("launch_mode"),
        get<boolean>("public_checks_enabled"),
        get<string>("incident_message")
      ]);

    // Interpret Edge Config values; an absent key falls back to safe default
    const launchMode: LaunchMode =
      launchModeRaw === "paused" ? "paused" : "normal";

    // public_checks_enabled defaults to true unless explicitly set to false
    const publicChecksEnabled =
      publicChecksEnabledRaw === false ? false : true;

    const incidentMessage =
      typeof incidentMessageRaw === "string" && incidentMessageRaw.trim()
        ? incidentMessageRaw.trim()
        : DEFAULT_INCIDENT_MESSAGE;

    const controls = { launchMode, publicChecksEnabled, incidentMessage };
    lastGoodControls = controls;
    return controls;
  } catch {
    // Do NOT propagate raw error text or stack traces
    return "unreachable";
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * getLaunchControls — primary entry point.
 *
 * Resolution order:
 *  1. Non-production REVORA_LAUNCH_MODE_OVERRIDE (test / dev only)
 *  2. Edge Config (when EDGE_CONFIG is set and accessible)
 *  3. Safe defaults: normal mode, checks enabled, empty incident message
 *
 * Never throws. Errors from the Edge Config SDK are swallowed and the caller
 * receives safe defaults.
 */
export async function getLaunchControls(): Promise<LaunchControls> {
  // 1. Test/dev override seam
  const overrideMode = getOverrideMode();
  if (overrideMode !== null) {
    return {
      launchMode: overrideMode,
      publicChecksEnabled: overrideMode === "normal",
      incidentMessage: DEFAULT_INCIDENT_MESSAGE
    };
  }

  // 2. Edge Config (when configured)
  const edgeControls = await readEdgeConfigControls();
  if (edgeControls === "unreachable") {
    // RE-02: the operator HAS a kill switch but we cannot read it. Serve the
    // last value we did read this runtime; with none, fail CLOSED (paused) —
    // for a health app, "no working emergency brake" is the worse failure.
    return (
      lastGoodControls ?? {
        launchMode: "paused",
        publicChecksEnabled: false,
        incidentMessage: DEFAULT_INCIDENT_MESSAGE
      }
    );
  }
  if (edgeControls !== null) {
    return edgeControls;
  }

  // 3. Safe defaults (no Edge Config configured at all)
  return {
    launchMode: "normal",
    publicChecksEnabled: true,
    incidentMessage: ""
  };
}

/**
 * evaluateLaunchMode — used by middleware and the health probe.
 *
 * Returns:
 *  { ok: true,  controls }                              — normal mode
 *  { ok: false, status: 503, message, controls }        — paused mode
 *
 * The pause `message` is always safe, human-readable copy — never a raw
 * provider error, stack trace, or prompt/food text.
 */
export async function evaluateLaunchMode(): Promise<
  | { ok: true; controls: LaunchControls }
  | { ok: false; status: 503; message: string; controls: LaunchControls }
> {
  const controls = await getLaunchControls();

  if (controls.launchMode === "paused" || !controls.publicChecksEnabled) {
    const message =
      controls.incidentMessage?.trim() || PAUSE_COPY;

    return {
      ok: false,
      status: 503,
      message,
      controls
    };
  }

  return { ok: true, controls };
}
