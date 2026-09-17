import fs from "node:fs";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { GUIDE_SURFACES, type GuideSurface } from "../../../lib/guide-door-flag";
import {
  assertE2EDoorOpened,
  doorSurfaceOn,
  e2eDoorValueOpens,
  guideDoorStates,
  parseGuideDoorStates,
  resetGuideDoorCache,
  type GuideDoorStates,
  type HealthFetch
} from "../../smoke/guide-door";

/**
 * Task 1.12 (review A-99, A-118): door smoke guards read the built app's
 * effective state from GET /api/health, and a flag-on e2e run fails in global
 * setup rather than passing by skipping.
 */

function states(on: readonly GuideSurface[]): GuideDoorStates {
  return Object.fromEntries(
    GUIDE_SURFACES.map((surface) => [surface, on.includes(surface) ? "on" : "off"])
  ) as GuideDoorStates;
}

function healthFetch(body: unknown, status = 503) {
  const calls: string[] = [];
  const fetcher: HealthFetch = async (url) => {
    calls.push(url);
    return { status, json: async () => body };
  };
  return { calls, fetcher };
}

afterEach(() => resetGuideDoorCache());

describe("smoke guide-door probe", () => {
  it("reads guideDoor from a degraded (503) health body", () => {
    expect(
      parseGuideDoorStates({ ok: false, guideDoor: states(["ideas"]) }, 503)
    ).toEqual(states(["ideas"]));
  });

  it("throws, never skips, when the payload cannot say whether the door is open", () => {
    for (const body of [
      null,
      "not json",
      {},
      { guideDoor: null },
      { guideDoor: { ideas: "on" } },
      { guideDoor: { ...states([]), source: true } }
    ]) {
      expect(() => parseGuideDoorStates(body, 500)).toThrow(
        "GET /api/health (HTTP 500) did not report guideDoor"
      );
    }
  });

  it("fetches /api/health once per worker and answers per surface", async () => {
    const { calls, fetcher } = healthFetch({
      guideDoor: states(["ideas", "source"])
    });

    await guideDoorStates("http://127.0.0.1:3100", fetcher);
    await guideDoorStates("http://127.0.0.1:3100", fetcher);
    expect(calls).toEqual(["http://127.0.0.1:3100/api/health"]);

    // doorSurfaceOn reuses the cached probe for the default base URL.
    expect(await doorSurfaceOn("ideas")).toBe(true);
    expect(await doorSurfaceOn("source")).toBe(true);
    expect(await doorSurfaceOn("home")).toBe(false);
    expect(calls).toHaveLength(1);
  });

  it("does not cache a failed probe", async () => {
    const bad = healthFetch({});
    await expect(
      guideDoorStates("http://127.0.0.1:3100", bad.fetcher)
    ).rejects.toThrow("did not report guideDoor");

    const good = healthFetch({ guideDoor: states(["ideas"]) });
    await expect(
      guideDoorStates("http://127.0.0.1:3100", good.fetcher)
    ).resolves.toEqual(states(["ideas"]));
  });

  it("bounds a probe whose server accepts the connection and never answers (fix round 1)", async () => {
    const signals: AbortSignal[] = [];
    // Ignores the abort signal on purpose: the deadline must not depend on the
    // fetcher honouring it.
    const hung: HealthFetch = (_url, init) => {
      signals.push(init.signal);
      return new Promise(() => {});
    };

    await expect(
      guideDoorStates("http://127.0.0.1:3100", hung, 20)
    ).rejects.toThrow(
      "GET http://127.0.0.1:3100/api/health did not answer within 20ms (base URL http://127.0.0.1:3100)"
    );
    expect(signals).toHaveLength(1);
    expect(signals[0]!.aborted).toBe(true);

    // The timed-out probe is not cached: the next call probes again.
    const good = healthFetch({ guideDoor: states(["ideas"]) });
    await expect(
      guideDoorStates("http://127.0.0.1:3100", good.fetcher, 20)
    ).resolves.toEqual(states(["ideas"]));
    expect(good.calls).toHaveLength(1);
  });

  it("bounds a response whose body never arrives", async () => {
    const stalledBody: HealthFetch = async () => ({
      status: 200,
      json: () => new Promise(() => {})
    });
    await expect(
      guideDoorStates("http://127.0.0.1:3101", stalledBody, 20)
    ).rejects.toThrow(
      "GET http://127.0.0.1:3101/api/health did not answer within 20ms"
    );
  });

  it("a probe that answers in time disarms its deadline and stays cached", async () => {
    const { calls, fetcher } = healthFetch({ guideDoor: states(["source"]) });
    const first = guideDoorStates("http://127.0.0.1:3100", fetcher, 10);
    await expect(first).resolves.toEqual(states(["source"]));

    // Outlive the deadline: a still-armed timer would surface here as an
    // unhandled rejection, and an evicted cache as a second fetch.
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(guideDoorStates("http://127.0.0.1:3100", fetcher, 10)).toBe(first);
    expect(calls).toHaveLength(1);
  });

  it("reads the e2e opt-in with the flag's own grammar", () => {
    for (const surface of GUIDE_SURFACES) {
      expect(e2eDoorValueOpens("1", surface)).toBe(true);
    }
    expect(e2eDoorValueOpens("ideas,source", "ideas")).toBe(true);
    expect(e2eDoorValueOpens("source, ideas", "ideas")).toBe(true);
    expect(e2eDoorValueOpens("ideas,source", "home")).toBe(false);
    expect(e2eDoorValueOpens("ideas-full", "ideas")).toBe(false);
    expect(e2eDoorValueOpens("true", "ideas")).toBe(false);
    expect(e2eDoorValueOpens("", "ideas")).toBe(false);
  });
});

describe("global setup's flag-on gate", () => {
  it("passes when every requested surface is on, and ignores flag-off runs", () => {
    expect(() => assertE2EDoorOpened("", states([]))).not.toThrow();
    expect(() =>
      assertE2EDoorOpened("1", states(GUIDE_SURFACES))
    ).not.toThrow();
    expect(() =>
      assertE2EDoorOpened("ideas,source", states(["ideas", "source"]))
    ).not.toThrow();
  });

  it("fails a flag-on run whose build reports ideas off", () => {
    expect(() => assertE2EDoorOpened("1", states([]))).toThrow(
      /should open ideas, .*guideDoor\.ideas="off".*never pass by skipping/
    );
    expect(() =>
      assertE2EDoorOpened("ideas,source", states(["source"]))
    ).toThrow('guideDoor.ideas="off"');
    expect(() =>
      assertE2EDoorOpened("ideas,source", states(["ideas"]))
    ).toThrow('guideDoor.source="off"');
  });

  it("fails an opt-in that names no surface", () => {
    expect(() => assertE2EDoorOpened("idea", states([]))).toThrow(
      'PAL_E2E_GUIDE_DOOR="idea" names no guide surface'
    );
  });
});

describe("no smoke spec reads the door flag from its own env", () => {
  function smokeSources(dir: string): string[] {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return smokeSources(full);
      return entry.name.endsWith(".ts") ? [full] : [];
    });
  }

  it("tests/smoke/**/*.ts never names NEXT_PUBLIC_GUIDE_DOOR", () => {
    const files = smokeSources(path.join(process.cwd(), "tests", "smoke"));
    expect(files.length).toBeGreaterThan(0);
    expect(files.some((file) => file.endsWith("guide-door.ts"))).toBe(true);

    const offenders = files
      .filter((file) =>
        fs.readFileSync(file, "utf8").includes("NEXT_PUBLIC_GUIDE_DOOR")
      )
      .map((file) => path.relative(process.cwd(), file));
    expect(
      offenders,
      "a smoke door guard must call doorSurfaceOn() from tests/smoke/guide-door.ts — the Playwright process env is not the build"
    ).toEqual([]);
  });
});
