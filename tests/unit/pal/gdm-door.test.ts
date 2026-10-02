import { afterEach, describe, expect, it, vi } from "vitest";

import {
  GDM_SURFACES,
  GDM_SURFACE_GATES,
  GDM_SURFACE_REQUIRES,
  gdmDoorEnabled,
  gdmDoorServerEnabled
} from "../../../lib/gdm-door-flag";

describe("gdmDoorEnabled — the one GDM-door flag (PRD §9 Step 2; §9.2's revert lever)", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("`1` opens every surface; a list opens only its members; anything else opens none", () => {
    vi.stubEnv("NEXT_PUBLIC_GDM_DOOR", "1");
    for (const surface of GDM_SURFACES) expect(gdmDoorEnabled(surface)).toBe(true);
    vi.stubEnv("NEXT_PUBLIC_GDM_DOOR", "landing, organiser");
    expect(gdmDoorEnabled("landing")).toBe(true);
    expect(gdmDoorEnabled("organiser")).toBe(true);
    expect(gdmDoorEnabled("ideas")).toBe(false);
    expect(gdmDoorEnabled("read")).toBe(false);
    for (const value of ["true", "0", "", "yes", "organise"]) {
      vi.stubEnv("NEXT_PUBLIC_GDM_DOOR", value);
      for (const surface of GDM_SURFACES) expect(gdmDoorEnabled(surface)).toBe(false);
    }
  });

  it("the server twin is the exact string `1` only, and injectable", () => {
    expect(gdmDoorServerEnabled({ GDM_DOOR_ENABLED: "1" })).toBe(true);
    for (const value of [undefined, "", "0", "true"]) {
      expect(gdmDoorServerEnabled({ GDM_DOOR_ENABLED: value })).toBe(false);
    }
  });

  it("the food surfaces need the organiser, and carry their gates", () => {
    expect(GDM_SURFACE_REQUIRES.ideas).toEqual(["organiser"]);
    expect(GDM_SURFACE_REQUIRES.read).toEqual(["organiser"]);
    expect(GDM_SURFACE_GATES.landing).toEqual([]);
    expect(GDM_SURFACE_GATES.organiser).toEqual([]);
    expect(GDM_SURFACE_GATES.ideas).toEqual(["S1", "S2", "S3"]);
    expect(GDM_SURFACE_GATES.read).toEqual(["S1", "S2", "S3", "S4"]);
  });
});
