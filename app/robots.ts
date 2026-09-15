import type { MetadataRoute } from "next";

// §0.2 #7. Robots disallow is prefix-based: bare entries also cover their
// subpaths ("/account" covers "/account/delete"; "/trial/" covers
// "/trial/started"). /demo is doubly covered — it already sets
// robots:{index:false} at the page (its marketing-fixtures contract).
export const DISALLOWED_PATHS = [
  "/api/",
  "/account",
  "/admin",
  "/canceled",
  "/demo",
  "/history",
  "/home",
  "/journey",
  "/learn",
  "/meals",
  "/memory",
  "/onboarding",
  "/pantry/intake",
  "/pantry/thanks",
  "/progress",
  "/report/",
  "/signin/check-email",
  "/trial/",
  "/video-engine",
  "/welcome"
] as const;

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: [...DISALLOWED_PATHS] }],
    sitemap: new URL("/sitemap.xml", APP_URL).toString()
  };
}
