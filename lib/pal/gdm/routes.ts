/**
 * The GDM door's route table (PRD GDM v1.1). Constants live here, not in a
 * `page.tsx`, so page files keep only Next's own exports. `signup` is the
 * app's existing magic-link sign-in with a `callbackUrl` back to `start` —
 * no new auth code, no waitlist vendor, no email leaves for a third party.
 */
export const GDM_ROUTES = {
  landing: "/gdm",
  start: "/gdm/start",
  home: "/gdm/home",
  questions: "/gdm/questions",
  // G-34: the nav's "Add a question" lands on the questions page's add form
  // (`id="add"` in components/gdm/ask-list.tsx), one tap from every screen.
  quickAdd: "/gdm/questions#add",
  plan: "/gdm/plan",
  meals: "/gdm/meals",
  summary: "/gdm/summary",
  data: "/gdm/data",
  privacy: "/gdm/privacy",
  manifest: "/gdm/manifest.webmanifest",
  signup: "/signin?callbackUrl=%2Fgdm%2Fstart"
} as const;
