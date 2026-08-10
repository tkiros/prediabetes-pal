import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import robots, { DISALLOWED_PATHS } from "../../../app/robots";
import sitemap, { PUBLIC_MARKETING_PATHS } from "../../../app/sitemap";

const ROOT = process.cwd();
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), "utf8");

/**
 * §0.2 #7 — link-sharing basics. Every launch channel is link-sharing; these
 * pins keep the three pieces (OG/Twitter meta, sitemap, robots) present and
 * mutually consistent so a marketing URL can never be robots-blocked and a
 * private surface can never leak into the sitemap.
 */

// Mirror of robots.txt prefix semantics: a bare entry blocks itself and its
// subpaths; a trailing-slash entry blocks the subtree.
function isDisallowed(pathname: string): boolean {
  return DISALLOWED_PATHS.some(
    (rule) =>
      pathname === rule ||
      pathname.startsWith(rule.endsWith("/") ? rule : `${rule}/`)
  );
}

describe("sitemap", () => {
  it("lists exactly the public marketing paths", () => {
    const paths = sitemap().map((entry) => new URL(entry.url).pathname);
    expect(paths).toEqual([...PUBLIC_MARKETING_PATHS]);
  });

  it("never lists a robots-disallowed URL", () => {
    for (const entry of sitemap()) {
      const pathname = new URL(entry.url).pathname;
      expect(isDisallowed(pathname), `${pathname} is robots-disallowed`).toBe(
        false
      );
    }
  });

  it("every sitemap path resolves to a real page route", () => {
    // Route-group segments like (app) vanish from the URL; dynamic segments
    // never appear in the static marketing list, so a plain walk suffices.
    const collectRoutes = (dir: string, prefix: string): string[] =>
      fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        if (entry.isDirectory()) {
          const seg = entry.name.startsWith("(") ? "" : `/${entry.name}`;
          return collectRoutes(path.join(dir, entry.name), prefix + seg);
        }
        return entry.name === "page.tsx" ? [prefix === "" ? "/" : prefix] : [];
      });
    const routes = collectRoutes(path.join(ROOT, "app"), "");
    for (const pub of PUBLIC_MARKETING_PATHS) {
      expect(routes, `${pub} has no page.tsx`).toContain(pub);
    }
  });

  it("keeps private and functional surfaces out", () => {
    for (const priv of [
      "/account",
      "/history",
      "/home",
      "/meals",
      "/journey",
      "/memory",
      "/onboarding",
      "/welcome",
      "/demo",
      "/admin/pantry",
      "/video-engine"
    ]) {
      expect(PUBLIC_MARKETING_PATHS).not.toContain(priv);
    }
  });
});

describe("robots", () => {
  const result = robots();

  it("blocks the API and private surfaces for all agents", () => {
    const rules = Array.isArray(result.rules) ? result.rules : [result.rules];
    expect(rules).toHaveLength(1);
    expect(rules[0]?.userAgent).toBe("*");
    expect(rules[0]?.disallow).toContain("/api/");
    expect(rules[0]?.disallow).toContain("/account");
    expect(rules[0]?.disallow).toContain("/admin");
  });

  it("advertises the sitemap", () => {
    expect(String(result.sitemap)).toMatch(/\/sitemap\.xml$/);
  });
});

describe("link-preview metadata", () => {
  it("root layout declares metadataBase, OpenGraph, and a large Twitter card", () => {
    const src = read("app/layout.tsx");
    expect(src).toContain("metadataBase: new URL(APP_URL)");
    expect(src).toContain("openGraph:");
    expect(src).toContain('siteName: "Prediabetes Pal"');
    expect(src).toContain('card: "summary_large_image"');
  });

  it("the OG image route exists at 1200×630 and derives verdict words from RISK_LABELS", async () => {
    const og = await import("../../../app/opengraph-image");
    expect(og.size).toEqual({ width: 1200, height: 630 });
    expect(og.contentType).toBe("image/png");
    expect(og.alt.length).toBeGreaterThan(10);
    // Import — not retyped words — so a relabel reaches the preview card too.
    expect(read("app/opengraph-image.tsx")).toMatch(
      /from\s+["'].*pal\/labels["']/
    );
  });
});
