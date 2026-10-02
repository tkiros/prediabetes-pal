import { describe, expect, it } from "vitest";

import { createDoorProbe, type HealthFetch } from "../../smoke/door-health";

/**
 * Task 0.3 fix round 1 (controller ruling on R33): tests/smoke/guide-door.ts
 * and tests/smoke/gdm-door.ts are both thin callers of createDoorProbe()
 * here. Their own tests/unit/pal/smoke-guide-door.test.ts and
 * smoke-gdm-door.test.ts already exercise the shared fetch/cache/timeout/
 * parse-guard/grammar/assert-gate behavior through those two bound
 * instances (guide-door.test.ts is the fuller of the two and is the
 * regression proof this refactor must not disturb). This file covers only
 * what neither of those exercises: that createDoorProbe() is genuinely
 * parameterised — a probe's diagnostics name ITS OWN payload key / door
 * label / env var, never a hardcoded one — and that two probe instances
 * never share cache state, even for the same base URL.
 */

type Surface = "a" | "b";
const SURFACES: readonly Surface[] = ["a", "b"];

function makeProbe(payloadKey: string, envVarName: string, doorLabel = "widget") {
  return createDoorProbe<Surface>({ payloadKey, surfaces: SURFACES, doorLabel, envVarName });
}

describe("createDoorProbe genericity", () => {
  it("reads the configured payload key, not a hardcoded one", () => {
    const probe = makeProbe("widgetDoor", "PAL_E2E_WIDGET_DOOR");
    expect(probe.parseStates({ widgetDoor: { a: "on", b: "off" } }, 200)).toEqual({
      a: "on",
      b: "off"
    });
    // A payload keyed under a DIFFERENT probe's key (e.g. another door's map
    // sitting beside this one in the same /api/health response) must not
    // satisfy this probe.
    expect(() =>
      probe.parseStates({ someOtherDoor: { a: "on", b: "off" } }, 500)
    ).toThrow("did not report widgetDoor");
  });

  it("names the configured door label and surfaces in its diagnostics", () => {
    const probe = makeProbe("widgetDoor", "PAL_E2E_WIDGET_DOOR", "gadget");
    expect(() => probe.parseStates({}, 503)).toThrow(/every gadget surface/);
  });

  it("names the configured env var and payload key in assert-opened diagnostics", () => {
    const probe = makeProbe("widgetDoor", "PAL_E2E_WIDGET_DOOR");
    expect(() => probe.assertE2EOpened("nonsense", { a: "off", b: "off" })).toThrow(
      'PAL_E2E_WIDGET_DOOR="nonsense" names no widget surface'
    );
    expect(() => probe.assertE2EOpened("a", { a: "off", b: "off" })).toThrow(
      'widgetDoor.a="off"'
    );
  });

  it("two probe instances never share cache state, even for the same base URL", async () => {
    const probeOne = makeProbe("widgetDoor", "PAL_E2E_WIDGET_DOOR");
    const probeTwo = makeProbe("widgetDoor", "PAL_E2E_WIDGET_DOOR");
    const calls: string[] = [];
    const fetcher: HealthFetch = async (url) => {
      calls.push(url);
      return { status: 200, json: async () => ({ widgetDoor: { a: "on", b: "off" } }) };
    };

    await probeOne.doorStates("http://127.0.0.1:3100", fetcher);
    await probeOne.doorStates("http://127.0.0.1:3100", fetcher);
    await probeTwo.doorStates("http://127.0.0.1:3100", fetcher);

    // probeOne's second call reuses its own cache (one fetch); probeTwo,
    // despite the identical base URL, has never probed and must fetch its own.
    expect(calls).toHaveLength(2);
  });
});
