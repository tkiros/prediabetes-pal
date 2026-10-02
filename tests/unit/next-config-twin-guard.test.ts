import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * AUD-002 (V016) — the production twin guard in next.config.ts must cover ALL
 * four flag pairs. V016 proved a client-on/server-off production build for
 * Memory/Journey imported cleanly; these tests import the real config under a
 * synthetic production env and demand the throw.
 *
 * PAL_ALLOW_NO_MEASUREMENT=1 isolates the twin guard from the analytics
 * gate — the guard is deliberately OUTSIDE that waiver.
 */

const PAIRS = [
  ["NEXT_PUBLIC_PHOTO_INPUT", "PHOTO_INPUT_ENABLED"],
  ["NEXT_PUBLIC_LONGITUDINAL_INSIGHTS", "LONGITUDINAL_INSIGHTS_ENABLED"],
  ["NEXT_PUBLIC_MEAL_MEMORY", "MEAL_MEMORY_ENABLED"],
  ["NEXT_PUBLIC_LEARNING_JOURNEY", "LEARNING_JOURNEY_ENABLED"]
] as const;

function stubBase() {
  vi.stubEnv("VERCEL_ENV", "production");
  vi.stubEnv("PAL_ALLOW_NO_MEASUREMENT", "1");
  // An ambient guide-door `1` would trip the production door guard (Task 1.11)
  // before the twin guard under test could.
  vi.stubEnv("NEXT_PUBLIC_GUIDE_DOOR", "");
  // Same for the GDM door (Task 0.2) — an unset pair must load ("unset loads"
  // below on any machine whose .env.local sets them), not trip a guard other
  // tests here don't intend to exercise.
  vi.stubEnv("NEXT_PUBLIC_GDM_DOOR", "");
  vi.stubEnv("GDM_DOOR_ENABLED", "");
  for (const [client, server] of PAIRS) {
    vi.stubEnv(client, "");
    vi.stubEnv(server, "");
  }
}

async function importConfig() {
  vi.resetModules();
  await import("../../next.config");
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("next.config production twin guard (AUD-002)", () => {
  for (const [client, server] of PAIRS) {
    it(`rejects ${client}=1 without ${server}=1 in production`, async () => {
      stubBase();
      vi.stubEnv(client, "1");
      await expect(importConfig()).rejects.toThrow(server);
    });

    it(`accepts ${client}=1 when ${server}=1 (twin present)`, async () => {
      stubBase();
      vi.stubEnv(client, "1");
      vi.stubEnv(server, "1");
      await expect(importConfig()).resolves.toBeUndefined();
    });
  }

  it("does not guard outside production (preview/dev builds stay free)", async () => {
    stubBase();
    vi.stubEnv("VERCEL_ENV", "preview");
    for (const [client] of PAIRS) {
      vi.stubEnv(client, "1");
    }
    await expect(importConfig()).resolves.toBeUndefined();
  });

  it("the analytics waiver never waives flag safety", async () => {
    // PAL_ALLOW_NO_MEASUREMENT=1 is already set by stubBase — the guard
    // must still throw.
    stubBase();
    vi.stubEnv("NEXT_PUBLIC_MEAL_MEMORY", "1");
    await expect(importConfig()).rejects.toThrow("MEAL_MEMORY_ENABLED");
  });

  // G-09: this is the incident revert, and it must LOAD. (As first planned this
  // case asserted the opposite, and so pinned a kill switch that could not be pulled.)
  it("GDM door: a listed surface without GDM_DOOR_ENABLED=1 loads in production", async () => {
    stubBase();
    vi.stubEnv("NEXT_PUBLIC_GDM_DOOR", "landing,organiser");
    await expect(importConfig()).resolves.toBeUndefined();
  });

  it("GDM door: unset loads", async () => {
    stubBase();
    await expect(importConfig()).resolves.toBeUndefined();
  });
});
