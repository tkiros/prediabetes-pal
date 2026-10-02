// app/gdm/layout.tsx — the frame only. No auth logic: each page does its own
// (a layout does not re-render on navigation and does not stop its children
// rendering — Next docs, 02-guides/authentication.md). The one check here is
// the BUILD-TIME flag: with the door dark the frame renders no copy at all, so
// a 404 under /gdm can never carry the working name before `gdm-organiser`
// exists — whether or not Next wraps a not-found boundary in this layout.
// Task L.2's smoke spec pins it rather than trusting that reasoning.
import type { Metadata } from "next";
import type { ReactNode } from "react";

import { gdmDoorEnabled } from "../../lib/gdm-door-flag";
import { GDM_COPY } from "../../lib/pal/gdm/copy";
import { GDM_ROUTES } from "../../lib/pal/gdm/routes";

// A function, not a constant (G-30): while the door is dark it returns {}, so a
// 404 under /gdm never carries the working name in its <title> or its preview.
export function generateMetadata(): Metadata {
  if (!gdmDoorEnabled("landing") && !gdmDoorEnabled("organiser")) return {};
  const { name, short } = GDM_COPY["gdm-door-name"];
  const line = GDM_COPY["gdm-landing-hero"].line;
  return {
    title: name,
    description: line,
    applicationName: name,
    manifest: GDM_ROUTES.manifest,
    appleWebApp: { capable: true, title: short, statusBarStyle: "default" },
    // `type` too: Next merges `openGraph` shallowly per top-level metadata key,
    // so leaving it out here would drop the root layout's `type: "website"`
    // entirely rather than inherit it (advisor review — confirmed against a
    // real build: og:type was present dark, absent once this object took over).
    openGraph: { siteName: name, title: name, description: line, type: "website" },
    robots: { index: false, follow: false }
  };
}

export default function GdmLayout({ children }: Readonly<{ children: ReactNode }>) {
  if (!gdmDoorEnabled("landing") && !gdmDoorEnabled("organiser")) return <>{children}</>;
  return (
    <>
      <a href="#gdm-content" className="app-skip">
        {GDM_COPY["gdm-door-name"].skip}
      </a>
      <main className="page-shell">
        <div className="page-frame" id="gdm-content" tabIndex={-1}>
          {/* G-38: no wordmark here. The landing's h1 IS the name; door pages get
              <GdmWordmark /> from (door)/layout.tsx, and start/privacy render it themselves. */}
          {children}
          <footer className="surface-card legal-card">
            <p>{GDM_COPY["gdm-disclaimer"].line}</p>
            {/* G-48 (owner): the maker, once, so the shared sign-in page is no surprise. */}
            <p>{GDM_COPY["gdm-maker"].line}</p>
          </footer>
        </div>
      </main>
    </>
  );
}
