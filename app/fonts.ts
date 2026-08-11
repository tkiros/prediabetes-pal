import localFont from "next/font/local";

// ── Why these are self-hosted (2026-08-10) ──────────────────────────────────
// These used to be `next/font/google`, which fetches the woff2 from
// fonts.gstatic.com AT BUILD TIME. That fetch fails intermittently from both
// Vercel's builder and GitHub Actions runners:
//
//   Module not found: Can't resolve '@vercel/turbopack-next/internal/font/google/font'
//
// It hit three unrelated production redeploys on 2026-08-10 and then failed CI
// on a docs-only PR (#83). Nothing about the build is wrong — a rerun goes
// green — but that means every deploy and every PR was a coin flip on a third
// party's network, and a red build that means nothing trains people to ignore
// red builds.
//
// The files below are the latin-subset variable woff2 for these families, both
// SIL Open Font License 1.1 — each family's license text is vendored verbatim
// beside it (`*-OFL.txt`; the two bodies are not byte-identical, so they are
// kept separate rather than merged). Vendoring the files deletes the
// build-time network dependency outright rather than retrying it.
//
// ⛔ PROVENANCE MATTERS — these were lifted from the RUNNING PRODUCTION BUILD
// (`/_next/static/media/*.woff2`), not re-downloaded from fonts.gstatic.com.
// Google's current CDN build of both families is a slightly later revision:
// same glyph count, same coverage, same wght axis, but ~2-4% different advance
// widths. Measured with those files, "For an A1C of 5.7-6.4%" went 232px → 223px
// and a mobile disclaimer lost a line. Using production's own bytes made the
// swap provably free: 28/28 text boxes identical across two viewports, and a
// 2x-DPR pixel diff of the landing against live production came back 0/4,608,000
// and 0/1,316,640 pixels changed.
//
// So: to refresh these, re-measure. Do not assume a newer Google build is a
// drop-in — it is a typographic change wearing a maintenance commit's clothes.
//
// A variable file replaces the previous list of static weights: it carries the
// whole axis, so no weight can go missing, and it is one request instead of
// five. `next/font/local` still derives a METRIC-ADJUSTED fallback by reading
// the file (`getFallbackMetricsFromFontFile`), so the flicker-safe offline
// behavior the notes below depend on is unchanged.
//
// If you ever do need a fresh copy: request the family from fonts.googleapis.com
// with a modern browser UA and take the woff2 from the `U+0000-00FF` (latin)
// @font-face block — then diff the landing before shipping it.

// Brand typeface (DESIGN.md §Type). Applied via sans.className on <body>,
// and that class is LOAD-BEARING: globals.css declares `body { font: inherit }`
// (L75-80) right after the body font-family block, which kills the elemental
// rule at equal specificity — the className is the only thing between the app
// and the UA default face (the FINDING-030 Times New Roman incident; the
// original diagnosis blamed the var() cascade, but the reset is the mechanism
// — see TODOS "body font reset"). next/font's metric-adjusted local fallback
// keeps offline test runs (Playwright, no network) flicker-safe.
export const sans = localFont({
  src: "./fonts/PlusJakartaSans-Variable-latin.woff2",
  variable: "--font-sans",
  display: "swap",
  // Plus Jakarta Sans' wght axis. Supersedes the old ["400"…"800"] list.
  weight: "200 800",
  style: "normal"
});

// Reading face (added 2026-07-27). Plus Jakarta Sans was carrying headlines AND
// body copy; it is a geometric sans, and geometric sans at 14–15px is the wrong
// tool for paragraphs read by 40–60-year-olds on a phone. Source Sans 3 has a
// larger x-height and open apertures, so it stays legible small and at low
// contrast. Headlines, the wordmark, and buttons keep Plus Jakarta Sans — the
// pairing is deliberate contrast (geometric display + humanist text), not two
// fonts doing the same job.
//
// reading.className goes on the LANDING ROOT (app/page.tsx), not <body>: two
// font classNames on <body> would race by stylesheet injection order and could
// flip the whole app's face. On the landing root it is the single, literal
// (var-free) source of the landing body family — the same class-over-cascade
// protection sans.className gives the app. Imported ONLY by app/page.tsx, so
// Source Sans 3's @font-face + preloads ship with the landing route, not with
// every app route. Nothing reads var(--font-body); the variable stays declared
// only so a future consumer doesn't silently get an undefined var.
export const reading = localFont({
  src: "./fonts/SourceSans3-Variable-latin.woff2",
  variable: "--font-body",
  display: "swap",
  // Source Sans 3's wght axis. Supersedes the old ["400","600","700"] list.
  weight: "200 900",
  style: "normal"
});
