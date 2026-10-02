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
 *
 * Task 0.3 fix round 1: the fetch/cache/timeout/parse/grammar/assert
 * mechanics below are domain-neutral and shared with the GDM door
 * (tests/smoke/gdm-door.ts) via tests/smoke/door-health.ts's
 * createDoorProbe(). This file is a thin, guide-door-flavoured caller of
 * that factory — every export below keeps its original name and behaviour.
 */
import { GUIDE_SURFACES, type GuideSurface } from "../../lib/guide-door-flag";
import {
  E2E_BASE_URL,
  HEALTH_PROBE_TIMEOUT_MS,
  createDoorProbe,
  type DoorStates,
  type HealthFetch
} from "./door-health";

export { E2E_BASE_URL, HEALTH_PROBE_TIMEOUT_MS };
export type { HealthFetch };

export type GuideDoorStates = DoorStates<GuideSurface>;

const probe = createDoorProbe<GuideSurface>({
  payloadKey: "guideDoor",
  surfaces: GUIDE_SURFACES,
  doorLabel: "guide",
  envVarName: "PAL_E2E_GUIDE_DOOR"
});

export const parseGuideDoorStates = probe.parseStates;
export const guideDoorStates = probe.doorStates;
export const doorSurfaceOn = probe.doorSurfaceOn;
export const resetGuideDoorCache = probe.resetCache;
export const e2eDoorValueOpens = probe.e2eValueOpens;
export const assertE2EDoorOpened = probe.assertE2EOpened;
