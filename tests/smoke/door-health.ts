/**
 * Domain-neutral plumbing shared by every door's smoke probe (Task 0.3 fix
 * round 1; controller ruling on R33). `tests/smoke/guide-door.ts` and
 * `tests/smoke/gdm-door.ts` are thin callers of `createDoorProbe()` below —
 * neither hand-rolls its own fetch/cache/timeout/parse/grammar/assert logic
 * any more.
 *
 * What is genuinely shared, regardless of which door: fetch `GET
 * /api/health` once per worker (bounded by a timeout that races the fetch
 * AND the body read), cache the parsed result per base URL, evict a failed
 * probe, read the flag's own "1"/comma-list grammar, and fail (never skip)
 * global setup's flag-on gate when a named surface did not open.
 *
 * What differs per door, and is therefore a parameter rather than hardcoded
 * here: the `GET /api/health` payload key (`guideDoor` vs `gdmDoor`), the
 * surface list, a label for diagnostics, and the e2e opt-in's env var name
 * (also diagnostics only — this module never reads `process.env` itself;
 * callers pass the opt-in value in).
 */

/** The :3100 server every door spec runs against (playwright.config.ts). */
export const E2E_BASE_URL = "http://127.0.0.1:3100";

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

export type DoorStates<Surface extends string> = Record<Surface, "on" | "off">;

export type DoorProbeConfig<Surface extends string> = {
  /** The `GET /api/health` payload key this door's map lives under. */
  payloadKey: string;
  /** Every surface this door has, in the flag's own order. */
  surfaces: readonly Surface[];
  /** Singular, lowercase, used only in error text (e.g. "guide", "GDM"). */
  doorLabel: string;
  /** The e2e opt-in's env var name, used only in error text. */
  envVarName: string;
};

export type DoorProbe<Surface extends string> = {
  /**
   * `/api/health` answers 503 in e2e (the model key is blanked) but still
   * carries every door's map in every branch, so the status is only
   * diagnostic. A payload without a complete `"on" | "off"` map throws: a
   * guard that cannot read the door must fail, not skip.
   */
  parseStates(body: unknown, status: number): DoorStates<Surface>;
  /** The whole surface map, fetched once per worker (per base URL). */
  doorStates(
    baseURL?: string,
    fetcher?: HealthFetch,
    timeoutMs?: number
  ): Promise<DoorStates<Surface>>;
  /** Whether the running app renders `surface`. */
  doorSurfaceOn(surface: Surface, baseURL?: string): Promise<boolean>;
  /** Test seam: forget the cached probe. */
  resetCache(): void;
  /** Whether the e2e opt-in's value should open `surface` (`1`, or a comma list naming it). */
  e2eValueOpens(value: string, surface: Surface): boolean;
  /**
   * Global setup's flag-on gate. With a non-empty opt-in, every surface the
   * value opens must report "on" — an opt-in whose door specs would
   * otherwise all `test.skip()` must not go green. An opt-in that names no
   * surface at all (a typo) fails for the same reason.
   */
  assertE2EOpened(value: string, states: DoorStates<Surface>): void;
};

export function createDoorProbe<Surface extends string>(
  config: DoorProbeConfig<Surface>
): DoorProbe<Surface> {
  const { payloadKey, surfaces, doorLabel, envVarName } = config;

  function parseStates(body: unknown, status: number): DoorStates<Surface> {
    const door =
      body && typeof body === "object"
        ? (body as Record<string, unknown>)[payloadKey]
        : undefined;
    if (door && typeof door === "object") {
      const states = door as Record<string, unknown>;
      if (
        surfaces.every(
          (surface) => states[surface] === "on" || states[surface] === "off"
        )
      ) {
        return states as DoorStates<Surface>;
      }
    }
    throw new Error(
      `GET /api/health (HTTP ${status}) did not report ${payloadKey} as "on" | "off" for every ${doorLabel} surface — door smoke guards cannot tell whether the ${doorLabel} door is open.`
    );
  }

  const cache = new Map<string, Promise<DoorStates<Surface>>>();

  /**
   * One bounded probe. The deadline races the fetch AND the body read, and
   * it rejects on its own even if the fetcher ignores the abort signal, so
   * a server that accepts the connection and never answers still fails
   * fast with a diagnostic naming the URL.
   */
  async function probeStates(
    baseURL: string,
    fetcher: HealthFetch,
    timeoutMs: number
  ): Promise<DoorStates<Surface>> {
    const url = new URL("/api/health", baseURL).href;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(
          new Error(
            `GET ${url} did not answer within ${timeoutMs}ms (base URL ${baseURL}) — door smoke guards cannot tell whether the ${doorLabel} door is open. Is the e2e server up and responsive?`
          )
        );
      }, timeoutMs);
    });

    try {
      return await Promise.race([
        (async () => {
          const response = await fetcher(url, { signal: controller.signal });
          const body: unknown = await response.json().catch(() => null);
          return parseStates(body, response.status);
        })(),
        deadline
      ]);
    } finally {
      clearTimeout(timer);
    }
  }

  function doorStates(
    baseURL: string = E2E_BASE_URL,
    fetcher: HealthFetch = fetch,
    timeoutMs: number = HEALTH_PROBE_TIMEOUT_MS
  ): Promise<DoorStates<Surface>> {
    const cached = cache.get(baseURL);
    if (cached) return cached;

    const states = probeStates(baseURL, fetcher, timeoutMs);
    cache.set(baseURL, states);
    // A failed (or timed-out) probe is not cached; the caller still sees the
    // rejection. Only evict our own entry, never a newer probe's.
    states.catch(() => {
      if (cache.get(baseURL) === states) cache.delete(baseURL);
    });
    return states;
  }

  async function doorSurfaceOn(
    surface: Surface,
    baseURL: string = E2E_BASE_URL
  ): Promise<boolean> {
    return (await doorStates(baseURL))[surface] === "on";
  }

  function resetCache(): void {
    cache.clear();
  }

  function e2eValueOpens(value: string, surface: Surface): boolean {
    if (value === "1") return true;
    return value
      .split(",")
      .map((token) => token.trim())
      .includes(surface);
  }

  function assertE2EOpened(value: string, states: DoorStates<Surface>): void {
    if (value === "") return;

    const requested = surfaces.filter((surface) => e2eValueOpens(value, surface));
    if (requested.length === 0) {
      throw new Error(
        `${envVarName}="${value}" names no ${doorLabel} surface (expected 1 or a comma list of: ${surfaces.join(", ")}). A flag-on run may never pass by skipping its door specs.`
      );
    }

    const closed = requested.filter((surface) => states[surface] !== "on");
    if (closed.length > 0) {
      throw new Error(
        `${envVarName}="${value}" should open ${closed.join(", ")}, but GET /api/health reports ${closed
          .map((surface) => `${payloadKey}.${surface}="${states[surface]}"`)
          .join(", ")}. A flag-on run may never pass by skipping its door specs — was the e2e build made without the opt-in (run it through \`npm run e2e\`, which rebuilds)?`
      );
    }
  }

  return {
    parseStates,
    doorStates,
    doorSurfaceOn,
    resetCache,
    e2eValueOpens,
    assertE2EOpened
  };
}
