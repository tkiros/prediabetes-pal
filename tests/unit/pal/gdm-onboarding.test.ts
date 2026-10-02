// tests/unit/pal/gdm-onboarding.test.ts
import { afterEach, describe, expect, it, vi } from "vitest";

import { nextGdmStep, type GdmStep } from "../../../lib/pal/gdm/onboarding";

describe("GDM onboarding (PRD §7.1: no A1C asked · told? · appointment date, optional · consent)", () => {
  it("walks told → date → consent → submit", () => {
    expect(nextGdmStep("told", "yes")).toBe("date");
    expect(nextGdmStep("date", "continue")).toBe("consent");
    expect(nextGdmStep("date", "skip")).toBe("consent");
    expect(nextGdmStep("consent", "continue")).toBe("submit");
  });

  it("a visitor not yet told exits to one fixed line, and can go back (row 7: counted, not chased)", () => {
    expect(nextGdmStep("told", "not_yet")).toBe("not_told");
    expect(nextGdmStep("not_told", "back")).toBe("told");
  });

  // G-27: as first written, `date` ignored its answer, so "back" went FORWARD to
  // consent; and consent's back branch had no string, so no control could reach it.
  it("back goes back from every step after the first", () => {
    expect(nextGdmStep("date", "back")).toBe("told");
    expect(nextGdmStep("consent", "back")).toBe("date");
  });

  it("every step that can go back has a string for the control", async () => {
    const { GDM_COPY } = await import("../../../lib/pal/gdm/copy");
    for (const row of ["gdm-onboarding-not-told", "gdm-onboarding-date", "gdm-onboarding-consent"] as const) {
      expect(GDM_COPY[row]).toHaveProperty("back");
    }
  });

  it("there are exactly four steps — none for a lab value, none for medicine (D2)", () => {
    const steps: GdmStep[] = ["told", "not_told", "date", "consent"];
    expect(new Set(steps).size).toBe(4);
  });
});

// An unsent question draft (pal.gdm.ask.draft, Task 2.2) is her typed text. It
// must not outlive a sign-out or an erase on a shared device.
describe("clearGdmDeviceKeys", () => {
  it("removes every pal.gdm.* key and leaves the prediabetes door's keys alone", async () => {
    const { clearGdmDeviceKeys } = await import("../../../lib/client/gdm-api");
    const data = new Map([
      ["pal.gdm.ask.draft", "why was it higher"],
      ["pal.gdm.ideas.rotation", "3"],
      ["pal.history.v1", "[]"]
    ]);
    const storage = {
      get length() {
        return data.size;
      },
      key: (index: number) => [...data.keys()][index] ?? null,
      removeItem: (key: string) => void data.delete(key)
    };
    clearGdmDeviceKeys([storage]);
    expect([...data.keys()]).toEqual(["pal.history.v1"]);
  });

  it("clears every storage it is given, and a storage that throws does not stop the rest", async () => {
    const { clearGdmDeviceKeys } = await import("../../../lib/client/gdm-api");
    const blocked = {
      get length(): number {
        throw new Error("SecurityError");
      },
      key: () => null,
      removeItem: () => undefined
    };
    const session = new Map([["pal.gdm.ask.draft", "x"]]);
    const sessionStorage = {
      get length() {
        return session.size;
      },
      key: (index: number) => [...session.keys()][index] ?? null,
      removeItem: (key: string) => void session.delete(key)
    };
    expect(() => clearGdmDeviceKeys([blocked, sessionStorage])).not.toThrow();
    expect(session.size).toBe(0);
  });
});

// R41: the shared delete route answers 409 while a Google Play subscription is
// active (app/api/account/delete/route.ts). "Try again in a moment" can never
// fix that, so that one refusal says why; every other failure stays generic.
describe("Your data — which failure line", () => {
  it("a 409 from the account deletion says why; every other failure keeps the save-failed line", async () => {
    const { dataControlsFailure } = await import("../../../components/gdm/data-controls");
    const { GDM_COPY } = await import("../../../lib/pal/gdm/copy");
    expect(dataControlsFailure("delete", 409)).toBe(GDM_COPY["gdm-data-controls"].deleteBlocked);
    const others: Array<["erase" | "delete", number]> = [
      ["delete", 0],
      ["delete", 400],
      ["delete", 503],
      ["erase", 409],
      ["erase", 503],
      ["erase", 0]
    ];
    for (const [action, status] of others) {
      expect(dataControlsFailure(action, status), `${action} ${status}`).toBe(GDM_COPY["gdm-save-failed"].line);
    }
  });
});

// G-14: one wrapper, JSON in and out, never throws; an expired session goes to
// sign-in instead of coming back as a "try again in a moment" that cannot work.
describe("gdmFetch", () => {
  afterEach(() => vi.unstubAllGlobals());

  const stubFetch = (response: Response | Error) => {
    const fetchMock = vi.fn(async () => {
      if (response instanceof Error) throw response;
      return response;
    });
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  };
  const json = (body: unknown, status: number) =>
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

  it("sends a JSON body and returns the parsed JSON on success", async () => {
    const { gdmFetch } = await import("../../../lib/client/gdm-api");
    const fetchMock = stubFetch(json({ ok: true }, 200));
    const result = await gdmFetch<{ ok: boolean }>("/api/gdm/profile", {
      method: "POST",
      body: { told: true, consent: true, appointmentDate: null }
    });
    expect(result).toEqual({ ok: true, data: { ok: true } });
    const [path, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(path).toBe("/api/gdm/profile");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({ told: true, consent: true, appointmentDate: null });
    expect(new Headers(init.headers).get("content-type")).toBe("application/json");
  });

  it("returns the status, the server's error line and the whole refusal body (R46: a 409 can carry a card)", async () => {
    const { gdmFetch } = await import("../../../lib/client/gdm-api");
    const { GDM_COPY } = await import("../../../lib/pal/gdm/copy");
    stubFetch(json({ error: GDM_COPY["gdm-consent-required"].line }, 400));
    expect(await gdmFetch("/api/gdm/profile", { method: "POST", body: {} })).toEqual({
      ok: false,
      status: 400,
      error: GDM_COPY["gdm-consent-required"].line,
      payload: { error: GDM_COPY["gdm-consent-required"].line }
    });
    const full = { error: GDM_COPY["gdm-list-full"].line, route: "possible_hypoglycemia", routeCopy: "approved copy" };
    stubFetch(json(full, 409));
    expect(await gdmFetch("/api/gdm/items", { method: "POST", body: {} })).toEqual({
      ok: false,
      status: 409,
      error: GDM_COPY["gdm-list-full"].line,
      payload: full
    });
  });

  it("never throws: a dropped connection or a body that is not JSON is a plain failure", async () => {
    const { gdmFetch } = await import("../../../lib/client/gdm-api");
    stubFetch(new TypeError("Failed to fetch"));
    expect(await gdmFetch("/api/gdm/profile")).toEqual({ ok: false, status: 0, error: "", payload: null });
    stubFetch(new Response("<html>Bad gateway</html>", { status: 502 }));
    expect(await gdmFetch("/api/gdm/profile")).toEqual({ ok: false, status: 502, error: "", payload: null });
  });

  it("a 401 goes to sign-in and is never handed back to the caller", async () => {
    const { gdmFetch } = await import("../../../lib/client/gdm-api");
    const { GDM_ROUTES } = await import("../../../lib/pal/gdm/routes");
    const assign = vi.fn();
    vi.stubGlobal("window", { location: { assign } });
    stubFetch(json({ error: "Sign in first." }, 401));
    const pending = gdmFetch("/api/gdm/profile");
    await vi.waitFor(() => expect(assign).toHaveBeenCalledWith(GDM_ROUTES.signup));
    const settled = await Promise.race([
      pending.then(() => "settled"),
      new Promise((resolve) => setTimeout(() => resolve("pending"), 20))
    ]);
    expect(settled).toBe("pending");
  });
});
