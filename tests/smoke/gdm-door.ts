/**
 * The GDM door's EFFECTIVE state, read from the running app (Task 0.3;
 * ruling R33). Every door-conditional GDM smoke spec asks this helper — skip
 * guards and assertion branches alike — and never reads the client build
 * flag from its own process env, because the Playwright process is not the
 * build (same reasoning as tests/smoke/guide-door.ts).
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
 *
 * This file is a thin, GDM-flavoured caller of
 * tests/smoke/door-health.ts's createDoorProbe() — the fetch/cache/timeout/
 * parse/grammar/assert mechanics live there, shared with the guide door.
 */
import { GDM_SURFACES, type GdmSurface } from "../../lib/gdm-door-flag";
import { createDoorProbe, type DoorStates } from "./door-health";

export type GdmDoorStates = DoorStates<GdmSurface>;

const probe = createDoorProbe<GdmSurface>({
  payloadKey: "gdmDoor",
  surfaces: GDM_SURFACES,
  doorLabel: "GDM",
  envVarName: "PAL_E2E_GDM_DOOR"
});

export const parseGdmDoorStates = probe.parseStates;
export const gdmDoorStates = probe.doorStates;
export const doorSurfaceOn = probe.doorSurfaceOn;
export const resetGdmDoorCache = probe.resetCache;
export const e2eDoorValueOpens = probe.e2eValueOpens;
export const assertE2EGdmDoorOpened = probe.assertE2EOpened;
