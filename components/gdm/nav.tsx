"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { GDM_COPY } from "../../lib/pal/gdm/copy";
import { GDM_ROUTES } from "../../lib/pal/gdm/routes";
import { GdmWordmark } from "./wordmark";

type GdmNavItem = { href: string; label: string };

/**
 * Row two (G-34): the door's working surfaces, in one wrapping `.chip-row`.
 * It starts empty; PR-2, PR-3, PR-5 and PR-6 each append their surface
 * (questions, plan, meals, summary) with its `gdm-nav` label. Your data and
 * the privacy notice are not here: they sit in the frame's footer
 * (app/gdm/layout.tsx), on every page.
 */
const NAV: readonly GdmNavItem[] = [];

/**
 * The door's nav, in two rows (G-34, owner decision). Row one: the wordmark,
 * which is the Home link, and the slot for "Add a question", the door's one
 * filled action. Row two: the working surfaces.
 */
export function GdmNav() {
  const pathname = usePathname();
  return (
    <nav className="gdm-nav" aria-label={GDM_COPY["gdm-nav"].label}>
      <div className="gdm-nav-top">
        <GdmWordmark href={GDM_ROUTES.home} current={pathname === GDM_ROUTES.home} />
        {/* Slot: "Add a question" (gdm-nav.add, F-ASKLIST story 2) arrives in
            Task 2.2 as the one filled action here, never rendered on the
            questions page itself. */}
      </div>
      {NAV.length > 0 ? (
        <ul className="chip-row gdm-nav-links" role="list">
          {NAV.map(({ href, label }) => (
            <li key={href}>
              <Link className="selectable-chip link-button" href={href} aria-current={pathname === href ? "page" : undefined}>
                {label}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </nav>
  );
}
