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
 * Task 0.3 (ruling R33): the GDM door's smoke probe/gate, same style as
 * tests/unit/pal/smoke-guide-door.test.ts — door smoke guards read the built
 * app's effective state from GET /api/health, and a flag-on e2e run fails in
 * global setup rather than passing by skipping.
 */

function states(on: readonly GdmSurface[]): GdmDoorStates {
  return Object.fromEntries(
    GDM_SURFACES.map((surface) => [surface, on.includes(surface) ? "on" : "off"])
  ) as GdmDoorStates;
}

function healthFetch(body: unknown, status = 503) {
  const calls: string[] = [];
  const fetcher: HealthFetch = async (url) => {
    calls.push(url);
    return { status, json: async () => body };
  };
  return { calls, fetcher };
}

afterEach(() => resetGdmDoorCache());

describe("smoke gdm-door probe", () => {
  it("reads gdmDoor from a degraded (503) health body", () => {
    expect(
      parseGdmDoorStates({ ok: false, gdmDoor: states(["organiser"]) }, 503)
    ).toEqual(states(["organiser"]));
  });

  it("throws, never skips, when the payload cannot say whether the door is open", () => {
    for (const body of [
      null,
      "not json",
      {},
      { gdmDoor: null },
      { gdmDoor: { organiser: "on" } },
      { gdmDoor: { ...states([]), landing: true } }
    ]) {
      expect(() => parseGdmDoorStates(body, 500)).toThrow(
        "GET /api/health (HTTP 500) did not report gdmDoor"
      );
    }
  });

  it("fetches /api/health once per worker and answers per surface", async () => {
    const { calls, fetcher } = healthFetch({
      gdmDoor: states(["landing", "organiser"])
    });

    await gdmDoorStates("http://127.0.0.1:3100", fetcher);
    await gdmDoorStates("http://127.0.0.1:3100", fetcher);
    expect(calls).toEqual(["http://127.0.0.1:3100/api/health"]);

    // doorSurfaceOn reuses the cached probe for the default base URL.
    expect(await doorSurfaceOn("landing")).toBe(true);
    expect(await doorSurfaceOn("organiser")).toBe(true);
    expect(await doorSurfaceOn("ideas")).toBe(false);
    expect(calls).toHaveLength(1);
  });

  it("does not cache a failed probe", async () => {
    const bad = healthFetch({});
    await expect(
      gdmDoorStates("http://127.0.0.1:3100", bad.fetcher)
    ).rejects.toThrow("did not report gdmDoor");

    const good = healthFetch({ gdmDoor: states(["landing"]) });
    await expect(
      gdmDoorStates("http://127.0.0.1:3100", good.fetcher)
    ).resolves.toEqual(states(["landing"]));
  });

  it("bounds a probe whose server accepts the connection and never answers", async () => {
    const signals: AbortSignal[] = [];
    // Ignores the abort signal on purpose: the deadline must not depend on the
    // fetcher honouring it.
    const hung: HealthFetch = (_url, init) => {
      signals.push(init.signal);
      return new Promise(() => {});
    };

    await expect(
      gdmDoorStates("http://127.0.0.1:3100", hung, 20)
    ).rejects.toThrow(
      "GET http://127.0.0.1:3100/api/health did not answer within 20ms (base URL http://127.0.0.1:3100)"
    );
    expect(signals).toHaveLength(1);
    expect(signals[0]!.aborted).toBe(true);

    // The timed-out probe is not cached: the next call probes again.
    const good = healthFetch({ gdmDoor: states(["landing"]) });
    await expect(
      gdmDoorStates("http://127.0.0.1:3100", good.fetcher, 20)
    ).resolves.toEqual(states(["landing"]));
    expect(good.calls).toHaveLength(1);
  });

  it("bounds a response whose body never arrives", async () => {
    const stalledBody: HealthFetch = async () => ({
      status: 200,
      json: () => new Promise(() => {})
    });
    await expect(
      gdmDoorStates("http://127.0.0.1:3101", stalledBody, 20)
    ).rejects.toThrow(
      "GET http://127.0.0.1:3101/api/health did not answer within 20ms"
    );
  });

  it("a probe that answers in time disarms its deadline and stays cached", async () => {
    const { calls, fetcher } = healthFetch({ gdmDoor: states(["ideas"]) });
    const first = gdmDoorStates("http://127.0.0.1:3100", fetcher, 10);
    await expect(first).resolves.toEqual(states(["ideas"]));

    // Outlive the deadline: a still-armed timer would surface here as an
    // unhandled rejection, and an evicted cache as a second fetch.
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(gdmDoorStates("http://127.0.0.1:3100", fetcher, 10)).toBe(first);
    expect(calls).toHaveLength(1);
  });

  it("reads the e2e opt-in with the flag's own grammar", () => {
    for (const surface of GDM_SURFACES) {
      expect(e2eDoorValueOpens("1", surface)).toBe(true);
    }
    expect(e2eDoorValueOpens("landing,organiser", "landing")).toBe(true);
    expect(e2eDoorValueOpens("organiser, landing", "landing")).toBe(true);
    expect(e2eDoorValueOpens("landing,organiser", "ideas")).toBe(false);
    expect(e2eDoorValueOpens("ideas-full", "ideas")).toBe(false);
    expect(e2eDoorValueOpens("true", "landing")).toBe(false);
    expect(e2eDoorValueOpens("", "landing")).toBe(false);
  });
});

describe("global setup's GDM flag-on gate", () => {
  it("passes when every requested surface is on, and ignores flag-off runs", () => {
    expect(() => assertE2EGdmDoorOpened("", states([]))).not.toThrow();
    expect(() =>
      assertE2EGdmDoorOpened("1", states(GDM_SURFACES))
    ).not.toThrow();
    expect(() =>
      assertE2EGdmDoorOpened("landing,organiser", states(["landing", "organiser"]))
    ).not.toThrow();
  });

  it("fails a flag-on run whose build reports a named surface off", () => {
    expect(() => assertE2EGdmDoorOpened("1", states([]))).toThrow(
      /should open landing, .*gdmDoor\.landing="off".*never pass by skipping/
    );
    expect(() =>
      assertE2EGdmDoorOpened("landing,organiser", states(["organiser"]))
    ).toThrow('gdmDoor.landing="off"');
    expect(() =>
      assertE2EGdmDoorOpened("landing,organiser", states(["landing"]))
    ).toThrow('gdmDoor.organiser="off"');
  });

  it("fails an opt-in that names no GDM surface", () => {
    expect(() => assertE2EGdmDoorOpened("lnding", states([]))).toThrow(
      'PAL_E2E_GDM_DOOR="lnding" names no GDM surface'
    );
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
