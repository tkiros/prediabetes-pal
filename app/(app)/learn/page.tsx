import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { DisclaimerLine } from "../../../components/disclaimer-line";
import { LEARN_NUMBERS_HREF } from "../../../lib/coach/orientation";
import { guideDoorEnabled } from "../../../lib/guide-door-flag";
import { mealMemoryUiEnabled } from "../../../lib/meal-memory-flag";

export const metadata: Metadata = {
  title: "Learn — Prediabetes Pal",
  robots: { index: false }
};

type LearnTile = { label: string; href: string };

/**
 * /learn — the index of tiles (Task 5.2). Gated on the `home` surface, the
 * same surface Task 5.1's quick row is gated on: this page only exists to be
 * landed on from that row's Learn item.
 *
 * Tiles are conditional, never links to a page that would 404:
 *  - "What the numbers mean" only once F-NUMBERS ships (`LEARN_NUMBERS_HREF`
 *    flips to "/learn/numbers" — until then the tile is omitted, not linked
 *    to the public guide).
 *  - "Your first week" only with `orient` on: `home` alone does not imply
 *    `orient` (SURFACE_REQUIRES.home is ["ideas", "ideas-full"]), and
 *    /learn/first-week 404s without it.
 *  - "Questions for my doctor" is left out entirely — F-DOCTOR's page
 *    doesn't exist yet.
 *  - "Saved meals" only once meal memory's UI is on, same gate the memory
 *    page itself uses.
 *
 * Tiles here are plain `<Link>`s, not `<LearnLink>`: LearnLink's
 * `learn_opened` event carries a closed `from` enum (home | result_footer |
 * onboarding | step | journey) with no "index" member — adding one is
 * outside this task's file list (it would touch lib/client/analytics.ts and
 * its own test) and not requested. Entry INTO Learn is already instrumented
 * at every existing entry point (Home's row, Journey, the step line); this
 * page just needs its own links to work.
 */
export default function LearnPage() {
  if (!guideDoorEnabled("home")) notFound();

  const tiles: LearnTile[] = [];
  // Cast: LEARN_NUMBERS_HREF is a literal-typed constant today ("/guides/a1c-5-7-to-6-4"),
  // so TS sees this comparison as impossible until the F-NUMBERS PR widens or
  // flips it. Keying on the constant itself (not a flag) is deliberate — see
  // the module comment above.
  if ((LEARN_NUMBERS_HREF as string) === "/learn/numbers") {
    tiles.push({ label: "What the numbers mean", href: "/learn/numbers" });
  }
  if (guideDoorEnabled("orient")) {
    tiles.push({ label: "Your first week", href: "/learn/first-week" });
  }
  // ponytail: "Questions for my doctor" (/learn/doctor) lands here once
  // F-DOCTOR ships its page — added together, same PR.
  tiles.push({ label: "How it works", href: "/how-it-works" });
  tiles.push({ label: "My meals", href: "/meals" });
  if (mealMemoryUiEnabled()) {
    tiles.push({ label: "Saved meals", href: "/meals#saved" });
  }
  tiles.push({ label: "Pantry review", href: "/pantry" });

  return (
    <div className="app-content--narrow">
      <section className="surface-card hero-card">
        <h1 className="page-title">Learn</h1>
      </section>

      <nav className="learn-grid" aria-label="Learn">
        {tiles.map((tile) => (
          <Link key={tile.href} href={tile.href} className="learn-tile">
            {tile.label}
          </Link>
        ))}
      </nav>

      <DisclaimerLine />

      <footer className="page-footer">
        <Link href="/home">Home</Link>
        <Link href="/journey">My journey</Link>
        <Link href="/privacy">Privacy</Link>
        <Link href="/terms">Terms</Link>
      </footer>
    </div>
  );
}
