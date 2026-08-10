import type { MetadataRoute } from "next";

// §0.2 #7 (link-sharing basics): the public marketing surface only. App and
// account surfaces (/home, /history, /welcome, /onboarding, …) and the
// noindex fixtures route (/demo) stay out on purpose —
// tests/unit/revora/seo-meta.test.ts cross-checks this list against
// app/robots.ts so a sitemap URL can never be robots-disallowed.
export const PUBLIC_MARKETING_PATHS = [
  "/",
  "/check",
  "/about",
  "/how-it-works",
  "/subscribe",
  "/pantry",
  "/get-the-app",
  "/signin",
  "/privacy",
  "/terms",
  "/guides",
  "/guides/prediabetes-meal-plan",
  "/guides/prediabetes-snacks",
  "/guides/what-to-eat-with-prediabetes",
  "/guides/prediabetes-now-what",
  "/guides/a1c-5-7-to-6-4"
] as const;

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_MARKETING_PATHS.map((path) => ({
    url: new URL(path, APP_URL).toString()
  }));
}
