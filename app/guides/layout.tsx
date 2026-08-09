import Link from "next/link";
import type { ReactNode } from "react";

import { BOUNDARY_DISCLAIMER } from "../../lib/revora/boundary-copy";

// The guides are the SEO/content surface: standalone document-style pages in
// the page-shell frame (same pattern as /pantry), indexable, no app shell.
// Every word under app/guides/** is scanned by the claims-boundary audit.
// The footer disclaimer is the contract string — imported, never retyped.
export default function GuidesLayout({
  children
}: Readonly<{ children: ReactNode }>) {
  return (
    <>
      {/* Same skip affordance as the landing and app shell; tabIndex={-1} on
          the target so focus MOVES, not just scrolls. */}
      <a href="#guide-content" className="app-skip">
        Skip to content
      </a>
      <main className="page-shell">
        <div className="page-frame" id="guide-content" tabIndex={-1}>
          <nav className="backbar" aria-label="Guides">
          <Link className="backlink" href="/">
            Prediabetes Pal home
          </Link>
          <Link className="backlink" href="/guides">
            All guides
          </Link>
        </nav>
          {children}
          <footer className="surface-card legal-card">
            <p>{BOUNDARY_DISCLAIMER}</p>
          </footer>
        </div>
      </main>
    </>
  );
}
