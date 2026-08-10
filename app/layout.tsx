import type { Metadata, Viewport } from "next";
import Script from "next/script";
import type { ReactNode } from "react";

import { AttributionCapture } from "../components/attribution-capture";
import { SwRegister } from "../components/sw-register";
import { sans } from "./fonts";

import "./globals.css";

// Umami analytics (plan P7; docs/adr/analytics-umami.md). Rendered only when
// both env vars are set — absent in dev/test, so Playwright (serviceWorkers
// blocked, no Umami env) sees no script and lib/client/analytics.ts's
// track() stays a no-op.
const UMAMI_SRC = process.env.NEXT_PUBLIC_UMAMI_SRC;
const UMAMI_WEBSITE_ID = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID;

// Fonts live in app/fonts.ts. Only the brand face is wired here; the reading
// face (Source Sans 3) is imported by app/page.tsx alone, so its @font-face +
// preloads ship on the landing route instead of every app route. No route
// reads var(--font-body) anymore, so the reading font's variable class has no
// consumer and deliberately does not appear in this file.

// Absolute base for OG/Twitter URLs and sitemap/robots (strategy §0.2 #7 —
// every launch channel is link-sharing). Same validated origin the billing
// return URLs use; localhost keeps dev/test builds self-consistent.
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: "Prediabetes Pal — Prediabetes Meal Checker",
  description:
    "A meal checker for the prediabetes A1C range — general meal-composition education with cautious context.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Prediabetes Pal", statusBarStyle: "default" },
  // Site-wide link-preview card; app/opengraph-image.tsx supplies the image.
  // Deliberately NO og title/description here: Next backfills them from each
  // page's own metadata, so every route previews with its own copy. Setting
  // them here would override every page's og card with the landing's.
  openGraph: {
    siteName: "Prediabetes Pal",
    type: "website"
  },
  twitter: { card: "summary_large_image" }
};

export const viewport: Viewport = {
  themeColor: "#0d5f57",
  width: "device-width",
  initialScale: 1
};

export default function RootLayout({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en" className={sans.variable}>
      <body className={sans.className}>
        {children}
        <SwRegister />
        <AttributionCapture />
        {UMAMI_SRC && UMAMI_WEBSITE_ID ? (
          <Script
            src={UMAMI_SRC}
            data-website-id={UMAMI_WEBSITE_ID}
            // PR-6: never send query strings with pageviews — URL params can
            // reveal account state (?health-data-deleted=1, ?subscribed=1).
            data-exclude-search="true"
            // PR-6: honor the browser's Do Not Track signal. The in-app
            // opt-out is the localStorage `umami.disabled` flag (Account page).
            data-do-not-track="true"
            strategy="afterInteractive"
            defer
          />
        ) : null}
      </body>
    </html>
  );
}
