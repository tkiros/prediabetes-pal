// tests/unit/pal/gdm-door-state.test.ts
import type { ReactElement, ReactNode } from "react";

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { GDM_COPY } from "../../../lib/pal/gdm/copy";
import { GDM_ROUTES } from "../../../lib/pal/gdm/routes";
import { encryptField } from "../../../lib/server/crypto";
import { schema } from "../../../lib/server/db";
import { gdmDoorState, requireGdmDoor } from "../../../lib/server/gdm-door";
import { createTestDb } from "../../helpers/test-db";

let testDb: Awaited<ReturnType<typeof createTestDb>>;
let userId: string;
let otherId: string;
beforeAll(async () => {
  process.env.HEALTH_DATA_KEY = Buffer.alloc(32, 4).toString("base64");
  testDb = await createTestDb();
  const [user] = await testDb.db.insert(schema.users).values({ email: "gdm-state@test.dev" }).returning({ id: schema.users.id });
  userId = user.id;
  const [other] = await testDb.db.insert(schema.users).values({ email: "gdm-state-2@test.dev" }).returning({ id: schema.users.id });
  otherId = other.id;
});
afterAll(async () => {
  delete process.env.HEALTH_DATA_KEY;
  await testDb.close();
});
beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_GDM_DOOR", "organiser");
  vi.stubEnv("GDM_DOOR_ENABLED", "1");
});
afterEach(() => vi.unstubAllEnvs());

const deps = (id: string | null) => ({
  db: () => testDb.db,
  getSession: async () => (id ? { userId: id, email: "gdm-state@test.dev" } : null)
});
const state = (id: string | null) => gdmDoorState(deps(id));

describe("gdmDoorState — the per-page guard every door page calls", () => {
  it("closed when the surface or the server twin is off — before it looks at the session", async () => {
    vi.stubEnv("GDM_DOOR_ENABLED", "");
    expect(await state(userId)).toEqual({ kind: "closed" });
  });

  it("signed_out → no_profile → open, with her own date decrypted", async () => {
    expect(await state(null)).toEqual({ kind: "signed_out" });
    expect(await state(userId)).toEqual({ kind: "no_profile", userId });
    await testDb.db.insert(schema.gdmProfiles).values({ userId, consentedAt: new Date(), appointmentCiphertext: encryptField("2026-10-08") });
    expect(await state(userId)).toEqual({ kind: "open", userId, appointmentDate: "2026-10-08" });
  });
});

describe("requireGdmDoor — notFound / redirect, and it returns only when the door is open", () => {
  it("closed → 404", async () => {
    vi.stubEnv("NEXT_PUBLIC_GDM_DOOR", "landing");
    await expect(requireGdmDoor(deps(userId))).rejects.toMatchObject({
      digest: expect.stringMatching(/NEXT_HTTP_ERROR_FALLBACK;404|NEXT_NOT_FOUND/)
    });
  });

  it("signed out → the door's own sign-up, which comes back to start", async () => {
    await expect(requireGdmDoor(deps(null))).rejects.toMatchObject({
      digest: expect.stringContaining(`;${GDM_ROUTES.signup};`)
    });
  });

  it("signed in with no profile → onboarding", async () => {
    await expect(requireGdmDoor(deps(otherId))).rejects.toMatchObject({
      digest: expect.stringContaining(`;${GDM_ROUTES.start};`)
    });
  });

  it("open → her id and her date, a date she never gave is null", async () => {
    await testDb.db
      .insert(schema.gdmProfiles)
      .values({ userId: otherId, consentedAt: new Date(), appointmentCiphertext: null });
    expect(await requireGdmDoor(deps(otherId))).toEqual({ userId: otherId, appointmentDate: null });
  });
});

// The server-component render pattern of gdm-landing.test.ts: call the
// component, walk the element tree, no jsdom.
function collectText(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(collectText).join(" ");
  if (typeof node === "object" && "props" in node) {
    const props = (node as ReactElement).props as { children?: ReactNode; href?: string };
    return (props.href ? ` ${props.href} ` : "") + collectText(props.children);
  }
  return "";
}

function findElement(node: ReactNode, match: (element: ReactElement) => boolean): ReactElement | null {
  if (node == null || typeof node !== "object") return null;
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findElement(child, match);
      if (found) return found;
    }
    return null;
  }
  if (!("props" in node)) return null;
  const element = node as ReactElement;
  if (match(element)) return element;
  return findElement((element.props as { children?: ReactNode }).children, match);
}

// The row belongs to the `organiser` surface, so it can never render while
// Pending in a landing-only production build.
describe("the organiser's public pieces: the privacy notice, the footer links, the error boundary", () => {
  it("/gdm/privacy 404s unless the organiser is on, and then says all five things", async () => {
    vi.stubEnv("NEXT_PUBLIC_GDM_DOOR", "landing");
    const { default: GdmPrivacyPage } = await import("../../../app/gdm/privacy/page");
    expect(() => GdmPrivacyPage()).toThrow(/NEXT_HTTP_ERROR_FALLBACK;404|NEXT_NOT_FOUND/);
    vi.stubEnv("NEXT_PUBLIC_GDM_DOOR", "organiser");
    const text = collectText(GdmPrivacyPage());
    for (const line of Object.values(GDM_COPY["gdm-privacy-notice"])) expect(text).toContain(line);
  });

  it("the frame's footer carries Your data and the notice only with the organiser on (G-34)", async () => {
    const { default: GdmLayout } = await import("../../../app/gdm/layout");
    vi.stubEnv("NEXT_PUBLIC_GDM_DOOR", "landing");
    const landingOnly = collectText(GdmLayout({ children: null }));
    expect(landingOnly).toContain(GDM_COPY["gdm-disclaimer"].line);
    expect(landingOnly).not.toContain(GDM_ROUTES.data);
    expect(landingOnly).not.toContain(GDM_COPY["gdm-privacy-notice"].title);
    vi.stubEnv("NEXT_PUBLIC_GDM_DOOR", "landing,organiser");
    const open = collectText(GdmLayout({ children: null }));
    expect(open).toContain(` ${GDM_ROUTES.data} ${GDM_COPY["gdm-nav"].data}`);
    expect(open).toContain(` ${GDM_ROUTES.privacy} ${GDM_COPY["gdm-privacy-notice"].title}`);
  });

  it("the (door) layout renders its nav only with the organiser on (G-28)", async () => {
    const { default: GdmDoorLayout } = await import("../../../app/gdm/(door)/layout");
    vi.stubEnv("NEXT_PUBLIC_GDM_DOOR", "landing");
    const child = "door-page";
    const dark = GdmDoorLayout({ children: child }) as ReactElement;
    expect((dark.props as { children?: ReactNode }).children).toBe(child);
    vi.stubEnv("NEXT_PUBLIC_GDM_DOOR", "organiser");
    const open = GdmDoorLayout({ children: child }) as ReactElement;
    const children = (open.props as { children: ReactNode[] }).children;
    expect(children).toHaveLength(2);
    expect(children[1]).toBe(child);
  });

  it("error.tsx says it did not load and retries (G-15); with the organiser off it rethrows, so a Pending row never shows", async () => {
    const { default: GdmError } = await import("../../../app/gdm/error");
    const failure = Object.assign(new Error("db hiccup"), { digest: "x" });
    const retry = vi.fn();
    const tree = GdmError({ error: failure, retry });
    const text = collectText(tree);
    expect(text).toContain(GDM_COPY["gdm-load-failed"].line);
    const button = findElement(tree, (element) => element.type === "button");
    expect(collectText(button)).toBe(GDM_COPY["gdm-load-failed"].retry);
    (button!.props as { onClick: () => void }).onClick();
    expect(retry).toHaveBeenCalledOnce();

    vi.stubEnv("NEXT_PUBLIC_GDM_DOOR", "landing");
    expect(() => GdmError({ error: failure, retry })).toThrow(failure);
  });
});
