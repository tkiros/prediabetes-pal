import type { ReactElement, ReactNode } from "react";

import { afterEach, describe, expect, it, vi } from "vitest";

import { storeWaitlistUrl } from "../../../lib/waitlist";

// The page is a static server component that reads the waitlist env vars at
// render time (no build-time inlining under vitest), so we can drive the env
// vars directly and inspect the returned element tree — no jsdom harness needed.
async function renderText(): Promise<string> {
  vi.resetModules();
  const mod = await import("../../../app/(app)/get-the-app/page");
  const tree = mod.default() as ReactElement;
  return collectText(tree);
}

function collectText(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(collectText).join(" ");
  if (typeof node === "object" && "props" in node) {
    const props = (node as ReactElement).props as {
      children?: ReactNode;
      href?: string;
    };
    const href = props.href ? ` ${props.href} ` : "";
    return href + collectText(props.children);
  }
  return "";
}

describe("get-the-app page store waitlists", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("shows coming-soon copy without links when no waitlist env is set", async () => {
    vi.stubEnv("NEXT_PUBLIC_WAITLIST_URL", "");
    vi.stubEnv("NEXT_PUBLIC_WAITLIST_ANDROID_URL", "");
    vi.stubEnv("NEXT_PUBLIC_WAITLIST_IOS_URL", "");
    const text = await renderText();
    // Install guidance always renders.
    expect(text).toContain("Prediabetes Pal already works on your phone");
    // The store section always renders (coming-soon messaging), links don't.
    expect(text).toContain("Prefer the store version?");
    expect(text).toContain("Google Play — coming soon.");
    expect(text).toContain("App Store — coming soon.");
    expect(text).not.toContain("join the Android waitlist");
    expect(text).not.toContain("join the iPhone waitlist");
  });

  it("renders both platform links from per-store env vars", async () => {
    vi.stubEnv("NEXT_PUBLIC_WAITLIST_ANDROID_URL", "https://tally.so/r/android");
    vi.stubEnv("NEXT_PUBLIC_WAITLIST_IOS_URL", "https://tally.so/r/ios");
    const text = await renderText();
    expect(text).toContain("https://tally.so/r/android");
    expect(text).toContain("https://tally.so/r/ios");
    expect(text).toContain("join the Android waitlist");
    expect(text).toContain("join the iPhone waitlist");
  });

  it("segments a single shared URL with ?platform= so demand stays measurable", async () => {
    vi.stubEnv("NEXT_PUBLIC_WAITLIST_ANDROID_URL", "");
    vi.stubEnv("NEXT_PUBLIC_WAITLIST_IOS_URL", "");
    vi.stubEnv("NEXT_PUBLIC_WAITLIST_URL", "https://tally.so/r/revora-waitlist");
    const text = await renderText();
    expect(text).toContain("https://tally.so/r/revora-waitlist?platform=android");
    expect(text).toContain("https://tally.so/r/revora-waitlist?platform=ios");
  });
});

describe("storeWaitlistUrl", () => {
  it("prefers the per-store URL and appends platform to a shared URL with existing params", () => {
    expect(
      storeWaitlistUrl("android", {
        NEXT_PUBLIC_WAITLIST_ANDROID_URL: "https://a.example",
        NEXT_PUBLIC_WAITLIST_URL: "https://shared.example"
      })
    ).toBe("https://a.example");
    expect(
      storeWaitlistUrl("ios", {
        NEXT_PUBLIC_WAITLIST_URL: "https://shared.example?src=app"
      })
    ).toBe("https://shared.example?src=app&platform=ios");
    expect(storeWaitlistUrl("ios", {})).toBeNull();
  });
});
