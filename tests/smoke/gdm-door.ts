/**
 * The GDM door's EFFECTIVE state, read from the running app (Task 0.3;
 * ruling R33). Same pattern as tests/smoke/guide-door.ts: every
 * door-conditional GDM smoke spec asks this helper — skip guards and
 * assertion branches alike — and never reads the client build flag from its
 * own process env, because the Playwright process is not the build.
 *
 * Unlike the guide door, GDM_DOOR_ENABLED is the door's server twin, and
 * `GET /api/health`'s `gdmDoor` map already folds it in: a surface reads
 * "on" only when the client flag names it AND the server twin is on
 * (app/api/health/route.ts, gdmDoorStates()) — the effective state, the one
 * smoke specs need.
 *
 * Usage, per surface (once the door's smoke specs land):
 *
 *   test("…", async ({ page }) => {
 *     test.skip(!(await doorSurfaceOn("organiser")), "organiser surface off in this build");
 *   });
 *
 * A flag-on run cannot pass by skipping: global setup calls
 * assertE2EGdmDoorOpened() before any worker starts.
 */
import { GDM_SURFACES, type GdmSurface } from "../../lib/gdm-door-flag";
import {
  E2E_BASE_URL,
  HEALTH_PROBE_TIMEOUT_MS,
  type HealthFetch
} from "./guide-door";

export type GdmDoorStates = Record<GdmSurface, "on" | "off">;

/**
 * `/api/health` answers 503 in e2e (the model key is blanked) but still
 * carries `gdmDoor` in every branch, so the status is only diagnostic. A
 * payload without a complete `"on" | "off"` map throws: a guard that cannot
 * read the door must fail, not skip.
 */
export function parseGdmDoorStates(
  body: unknown,
  status: number
): GdmDoorStates {
  const door =
    body && typeof body === "object"
      ? (body as { gdmDoor?: unknown }).gdmDoor
      : undefined;
  if (door && typeof door === "object") {
    const states = door as Record<string, unknown>;
    if (
      GDM_SURFACES.every(
        (surface) => states[surface] === "on" || states[surface] === "off"
      )
    ) {
      return states as GdmDoorStates;
    }
  }
  throw new Error(
    `GET /api/health (HTTP ${status}) did not report gdmDoor as "on" | "off" for every GDM surface — door smoke guards cannot tell whether the GDM door is open.`
  );
}

const cache = new Map<string, Promise<GdmDoorStates>>();

/**
 * One bounded probe. The deadline races the fetch AND the body read, and it
 * rejects on its own even if the fetcher ignores the abort signal, so a
 * server that accepts the connection and never answers still fails fast with
 * a diagnostic naming the URL.
 */
async function probeGdmDoorStates(
  baseURL: string,
  fetcher: HealthFetch,
  timeoutMs: number
): Promise<GdmDoorStates> {
  const url = new URL("/api/health", baseURL).href;
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(
        new Error(
          `GET ${url} did not answer within ${timeoutMs}ms (base URL ${baseURL}) — door smoke guards cannot tell whether the GDM door is open. Is the e2e server up and responsive?`
        )
      );
    }, timeoutMs);
  });

  try {
    return await Promise.race([
      (async () => {
        const response = await fetcher(url, { signal: controller.signal });
        const body: unknown = await response.json().catch(() => null);
        return parseGdmDoorStates(body, response.status);
      })(),
      deadline
    ]);
  } finally {
    clearTimeout(timer);
  }
}

/** The whole surface map, fetched once per worker (per base URL). */
export function gdmDoorStates(
  baseURL: string = E2E_BASE_URL,
  fetcher: HealthFetch = fetch,
  timeoutMs: number = HEALTH_PROBE_TIMEOUT_MS
): Promise<GdmDoorStates> {
  const cached = cache.get(baseURL);
  if (cached) return cached;

  const states = probeGdmDoorStates(baseURL, fetcher, timeoutMs);
  cache.set(baseURL, states);
  // A failed (or timed-out) probe is not cached; the caller still sees the
  // rejection. Only evict our own entry, never a newer probe's.
  states.catch(() => {
    if (cache.get(baseURL) === states) cache.delete(baseURL);
  });
  return states;
}

/** Whether the running app renders `surface`. */
export async function doorSurfaceOn(
  surface: GdmSurface,
  baseURL: string = E2E_BASE_URL
): Promise<boolean> {
  return (await gdmDoorStates(baseURL))[surface] === "on";
}

/** Test seam: forget the cached probe. */
export function resetGdmDoorCache(): void {
  cache.clear();
}

/**
 * Whether the e2e opt-in (PAL_E2E_GDM_DOOR, copied verbatim into the build
 * by scripts/e2e-runtime-env.ts, which also turns GDM_DOOR_ENABLED on with
 * it) should open `surface`: `1` opens every surface, a comma list opens the
 * surfaces it names. Same grammar as lib/gdm-door-flag.ts's gdmDoorEnabled.
 */
export function e2eDoorValueOpens(value: string, surface: GdmSurface): boolean {
  if (value === "1") return true;
  return value
    .split(",")
    .map((token) => token.trim())
    .includes(surface);
}

/**
 * Global setup's flag-on gate (ruling R33). With a non-empty opt-in, every
 * surface the value opens must report "on" — otherwise a GDM-door leg's
 * smoke specs would all test.skip() and the leg would go green without
 * testing the door. An opt-in that names no surface at all (a typo) fails
 * for the same reason.
 */
export function assertE2EGdmDoorOpened(
  value: string,
  states: GdmDoorStates
): void {
  if (value === "") return;

  const requested = GDM_SURFACES.filter((surface) =>
    e2eDoorValueOpens(value, surface)
  );
  if (requested.length === 0) {
    throw new Error(
      `PAL_E2E_GDM_DOOR="${value}" names no GDM surface (expected 1 or a comma list of: ${GDM_SURFACES.join(", ")}). A flag-on run may never pass by skipping its door specs.`
    );
  }

  const closed = requested.filter((surface) => states[surface] !== "on");
  if (closed.length > 0) {
    throw new Error(
      `PAL_E2E_GDM_DOOR="${value}" should open ${closed.join(", ")}, but GET /api/health reports ${closed
        .map((surface) => `gdmDoor.${surface}="${states[surface]}"`)
        .join(", ")}. A flag-on run may never pass by skipping its door specs — was the e2e build made without the opt-in (run it through \`npm run e2e\`, which rebuilds)?`
    );
  }
}
