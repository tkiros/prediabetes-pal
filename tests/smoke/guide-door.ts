/**
 * The guide door's EFFECTIVE state, read from the running app (Task 1.12;
 * review A-99, A-118). Every door-conditional smoke spot asks this helper —
 * skip guards and assertion branches alike — and never reads the door flag
 * from its own process env:
 *
 * - The Playwright process is not the build. What a spec's process env says
 *   and what `next build` inlined can differ (a stale `.next-e2e-*` output, a
 *   value blanked by scripts/e2e-runtime-env.ts). `GET /api/health` reports
 *   the value the server was actually built with.
 * - A list value (`ideas,source`, the production shape) must run the ideas
 *   specs. An `=== "1"` guard skipped them, so the production list was never
 *   tested.
 *
 * Usage, per surface:
 *
 *   test("…", async ({ page }) => {
 *     test.skip(!(await doorSurfaceOn("ideas")), "ideas surface off in this build");
 *   });
 *
 *   test.describe("Home door", () => {
 *     test.beforeAll(async () => {
 *       test.skip(!(await doorSurfaceOn("home")), "home surface off in this build");
 *     });
 *   });
 *
 * It uses Node's fetch rather than the `request` fixture so it works in a
 * test body, in `beforeAll` (which gets no test-scoped fixtures) and in
 * global setup alike. The health payload is fetched once per worker process
 * (bounded by HEALTH_PROBE_TIMEOUT_MS) and cached. A flag-on run cannot pass by skipping: global setup calls
 * assertE2EDoorOpened() before any worker starts.
 */
import { GUIDE_SURFACES, type GuideSurface } from "../../lib/guide-door-flag";

/** The :3100 server every door spec runs against (playwright.config.ts). */
export const E2E_BASE_URL = "http://127.0.0.1:3100";

export type GuideDoorStates = Record<GuideSurface, "on" | "off">;

/**
 * Upper bound on one `/api/health` probe, response body included — the same
 * explicit-timeout convention as global setup's `warmRoutes` (120s per route).
 * The health route answers from a warm production server in well under a
 * second; 30s stays below Playwright's 90s test timeout, so a probe made
 * inside a test fails with this diagnostic rather than a bare test timeout,
 * and a hung server can never stall global setup until the CI job times out.
 */
export const HEALTH_PROBE_TIMEOUT_MS = 30_000;

export type HealthFetch = (
  url: string,
  init: { signal: AbortSignal }
) => Promise<{ status: number; json(): Promise<unknown> }>;

/**
 * `/api/health` answers 503 in e2e (the model key is blanked, so readiness is
 * `degraded`) but still carries `guideDoor` in every branch, so the status is
 * only diagnostic. A payload without a complete `"on" | "off"` map throws: a
 * guard that cannot read the door must fail, not skip.
 */
export function parseGuideDoorStates(
  body: unknown,
  status: number
): GuideDoorStates {
  const door =
    body && typeof body === "object"
      ? (body as { guideDoor?: unknown }).guideDoor
      : undefined;
  if (door && typeof door === "object") {
    const states = door as Record<string, unknown>;
    if (
      GUIDE_SURFACES.every(
        (surface) => states[surface] === "on" || states[surface] === "off"
      )
    ) {
      return states as GuideDoorStates;
    }
  }
  throw new Error(
    `GET /api/health (HTTP ${status}) did not report guideDoor as "on" | "off" for every guide surface — door smoke guards cannot tell whether the door is open.`
  );
}

const cache = new Map<string, Promise<GuideDoorStates>>();

/**
 * One bounded probe. The deadline races the fetch AND the body read, and it
 * rejects on its own even if the fetcher ignores the abort signal, so a
 * server that accepts the connection and never answers still fails fast with
 * a diagnostic naming the URL.
 */
async function probeGuideDoorStates(
  baseURL: string,
  fetcher: HealthFetch,
  timeoutMs: number
): Promise<GuideDoorStates> {
  const url = new URL("/api/health", baseURL).href;
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(
        new Error(
          `GET ${url} did not answer within ${timeoutMs}ms (base URL ${baseURL}) — door smoke guards cannot tell whether the guide door is open. Is the e2e server up and responsive?`
        )
      );
    }, timeoutMs);
  });

  try {
    return await Promise.race([
      (async () => {
        const response = await fetcher(url, { signal: controller.signal });
        const body: unknown = await response.json().catch(() => null);
        return parseGuideDoorStates(body, response.status);
      })(),
      deadline
    ]);
  } finally {
    clearTimeout(timer);
  }
}

/** The whole surface map, fetched once per worker (per base URL). */
export function guideDoorStates(
  baseURL: string = E2E_BASE_URL,
  fetcher: HealthFetch = fetch,
  timeoutMs: number = HEALTH_PROBE_TIMEOUT_MS
): Promise<GuideDoorStates> {
  const cached = cache.get(baseURL);
  if (cached) return cached;

  const states = probeGuideDoorStates(baseURL, fetcher, timeoutMs);
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
  surface: GuideSurface,
  baseURL: string = E2E_BASE_URL
): Promise<boolean> {
  return (await guideDoorStates(baseURL))[surface] === "on";
}

/** Test seam: forget the cached probe. */
export function resetGuideDoorCache(): void {
  cache.clear();
}

/**
 * Whether the e2e opt-in (PAL_E2E_GUIDE_DOOR, copied verbatim into the build
 * by scripts/e2e-runtime-env.ts) should open `surface`: `1` opens every
 * surface, a comma list opens the surfaces it names. The e2e build carries no
 * production door guard (next.config.ts keys it on VERCEL_ENV=production), so
 * requested and effective state must agree exactly.
 */
export function e2eDoorValueOpens(value: string, surface: GuideSurface): boolean {
  if (value === "1") return true;
  return value
    .split(",")
    .map((token) => token.trim())
    .includes(surface);
}

/**
 * Global setup's flag-on gate. With a non-empty opt-in, every surface the
 * value opens must report "on" — above all `ideas`, whose specs would
 * otherwise skip and leave a flag-on job green without testing the door. An
 * opt-in that names no surface at all (a typo) fails for the same reason.
 */
export function assertE2EDoorOpened(
  value: string,
  states: GuideDoorStates
): void {
  if (value === "") return;

  const requested = GUIDE_SURFACES.filter((surface) =>
    e2eDoorValueOpens(value, surface)
  );
  if (requested.length === 0) {
    throw new Error(
      `PAL_E2E_GUIDE_DOOR="${value}" names no guide surface (expected 1 or a comma list of: ${GUIDE_SURFACES.join(", ")}). A flag-on run may never pass by skipping its door specs.`
    );
  }

  const closed = requested.filter((surface) => states[surface] !== "on");
  if (closed.length > 0) {
    throw new Error(
      `PAL_E2E_GUIDE_DOOR="${value}" should open ${closed.join(", ")}, but GET /api/health reports ${closed
        .map((surface) => `guideDoor.${surface}="${states[surface]}"`)
        .join(", ")}. A flag-on run may never pass by skipping its door specs — was the e2e build made without the opt-in (run it through \`npm run e2e\`, which rebuilds)?`
    );
  }
}
