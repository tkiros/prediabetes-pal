import fs from "node:fs";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { GDM_SURFACES, type GdmSurface } from "../../../lib/gdm-door-flag";
import type { HealthFetch } from "../../smoke/guide-door";
import {
  assertE2EGdmDoorOpened,
  doorSurfaceOn,
  e2eDoorValueOpens,
  gdmDoorStates,
  parseGdmDoorStates,
  resetGdmDoorCache,
  type GdmDoorStates
} from "../../smoke/gdm-door";

/**
 * Task 0.3 (ruling R33; fix round 1). tests/smoke/gdm-door.ts is a thin
 * caller of tests/smoke/door-health.ts's createDoorProbe() — the shared
 * fetch/cache/timeout/parse-guard/grammar/assert-gate mechanics are already
 * exercised generically (tests/unit/pal/smoke-guide-door.test.ts, against
 * the guide door's own instance of the same factory; tests/unit/pal/
 * door-health.test.ts, against the factory directly). This file covers only
 * what is GDM-specific: the "gdmDoor" payload key (not "guideDoor"), GDM's
 * four surfaces, `1` opening every one of them, and that a GDM smoke spec
 * never bypasses the helper to read its own env.
 */

function states(on: readonly GdmSurface[]): GdmDoorStates {
  return Object.fromEntries(
    GDM_SURFACES.map((surface) => [surface, on.includes(surface) ? "on" : "off"])
  ) as GdmDoorStates;
}

afterEach(() => resetGdmDoorCache());

describe("smoke gdm-door probe (GDM-specific)", () => {
  it("reads its states from the gdmDoor payload key, not guideDoor", () => {
    expect(
      parseGdmDoorStates(
        { guideDoor: { ideas: "on" }, gdmDoor: states(["organiser"]) },
        200
      )
    ).toEqual(states(["organiser"]));

    expect(() =>
      parseGdmDoorStates({ guideDoor: states([]) }, 500)
    ).toThrow("GET /api/health (HTTP 500) did not report gdmDoor");
  });

  it("names GDM's four surfaces in its diagnostics", () => {
    expect(() => parseGdmDoorStates({}, 503)).toThrow(/every GDM surface/);
    expect(() => assertE2EGdmDoorOpened("nope", states([]))).toThrow(
      `PAL_E2E_GDM_DOOR="nope" names no GDM surface (expected 1 or a comma list of: ${GDM_SURFACES.join(", ")})`
    );
  });

  it("`1` opens every GDM surface", () => {
    for (const surface of GDM_SURFACES) {
      expect(e2eDoorValueOpens("1", surface)).toBe(true);
    }
    expect(() => assertE2EGdmDoorOpened("1", states(GDM_SURFACES))).not.toThrow();
    expect(() => assertE2EGdmDoorOpened("1", states([]))).toThrow(
      /should open landing, organiser, ideas, read.*never pass by skipping/s
    );
  });

  it("a comma list opens only the GDM surfaces it names", () => {
    expect(() =>
      assertE2EGdmDoorOpened("landing,organiser", states(["landing", "organiser"]))
    ).not.toThrow();
    expect(() =>
      assertE2EGdmDoorOpened("landing,organiser", states(["landing"]))
    ).toThrow('gdmDoor.organiser="off"');
  });

  it("fetches through the shared probe and answers per GDM surface", async () => {
    const fetcher: HealthFetch = async () => ({
      status: 503,
      json: async () => ({ gdmDoor: states(["landing", "read"]) })
    });

    await gdmDoorStates("http://127.0.0.1:3100", fetcher);
    expect(await doorSurfaceOn("landing")).toBe(true);
    expect(await doorSurfaceOn("organiser")).toBe(false);
    expect(await doorSurfaceOn("read")).toBe(true);
  });
});

describe("no smoke spec reads the GDM door flag from its own env", () => {
  function smokeSources(dir: string): string[] {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return smokeSources(full);
      return entry.name.endsWith(".ts") ? [full] : [];
    });
  }

  it("tests/smoke/**/*.ts never names NEXT_PUBLIC_GDM_DOOR", () => {
    const files = smokeSources(path.join(process.cwd(), "tests", "smoke"));
    expect(files.length).toBeGreaterThan(0);
    expect(files.some((file) => file.endsWith("gdm-door.ts"))).toBe(true);

    const offenders = files
      .filter((file) =>
        fs.readFileSync(file, "utf8").includes("NEXT_PUBLIC_GDM_DOOR")
      )
      .map((file) => path.relative(process.cwd(), file));
    expect(
      offenders,
      "a smoke door guard must call doorSurfaceOn() from tests/smoke/gdm-door.ts — the Playwright process env is not the build"
    ).toEqual([]);
  });

  it("global setup asserts the GDM door alongside the guide door (ruling R33)", () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), "tests", "smoke", "global-setup.ts"),
      "utf8"
    );
    expect(src).toContain("PAL_E2E_GDM_DOOR");
    expect(src).toContain("assertE2EGdmDoorOpened");
  });
});
