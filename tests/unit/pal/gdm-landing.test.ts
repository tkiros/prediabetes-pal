// tests/unit/pal/gdm-landing.test.ts
import type { ReactElement, ReactNode } from "react";

import { afterEach, describe, expect, it, vi } from "vitest";

import { GDM_COPY } from "../../../lib/pal/gdm/copy";

// The tests/unit/pal/get-the-app-page.test.ts pattern: call the server
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

async function renderLanding(): Promise<string> {
  vi.resetModules();
  const mod = await import("../../../app/gdm/page");
  return collectText(mod.default() as ReactElement);
}

describe("/gdm — the landing (PRD §3, §7.1)", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("404s unless the landing surface is on", async () => {
    vi.stubEnv("NEXT_PUBLIC_GDM_DOOR", "");
    await expect(renderLanding()).rejects.toThrow(/NEXT_HTTP_ERROR_FALLBACK;404|NEXT_NOT_FOUND/);
  });

  it("leads with the working name and the §3 line, and signs up through the existing sign-in", async () => {
    vi.stubEnv("NEXT_PUBLIC_GDM_DOOR", "landing");
    const text = await renderLanding();
    expect(text).toContain(GDM_COPY["gdm-door-name"].name);
    expect(text).toContain(GDM_COPY["gdm-landing-hero"].line);
    expect(text).toContain("/signin?callbackUrl=%2Fgdm%2Fstart");
    expect(text).not.toMatch(/Prediabetes Pal/); // D7: the working name leads
  });

  it("makes no food promise and links to no prediabetes-door route", async () => {
    vi.stubEnv("NEXT_PUBLIC_GDM_DOOR", "landing");
    const text = await renderLanding();
    expect(text).toContain(GDM_COPY["gdm-landing-points"].scope);
    expect(text).not.toMatch(/\s\/(?:check|home|onboarding|welcome|subscribe|journey|meals)\s/);
    expect(text).not.toMatch(/meal ideas|what to eat|recipe/i); // joins the line only under gdm-food-ideas
  });

  it("she is told there is no food guidance before she is asked to sign up (G-68)", async () => {
    vi.stubEnv("NEXT_PUBLIC_GDM_DOOR", "landing");
    const text = await renderLanding();
    expect(text.indexOf(GDM_COPY["gdm-landing-points"].scope)).toBeLessThan(text.indexOf("/signin?"));
  });

  it("the frame's metadata speaks for this door, and says nothing while it is dark (G-30)", async () => {
    vi.stubEnv("NEXT_PUBLIC_GDM_DOOR", "landing");
    vi.resetModules();
    const meta = (await import("../../../app/gdm/layout")).generateMetadata();
    expect(meta.openGraph).toMatchObject({ siteName: GDM_COPY["gdm-door-name"].name });
    expect(meta.manifest).toBe("/gdm/manifest.webmanifest");
    expect(JSON.stringify(meta)).not.toMatch(/Prediabetes Pal/);
    vi.stubEnv("NEXT_PUBLIC_GDM_DOOR", "");
    vi.resetModules();
    expect((await import("../../../app/gdm/layout")).generateMetadata()).toEqual({});
  });
});
