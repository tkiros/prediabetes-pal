"use client"; // Error boundaries must be Client Components.

// The door's one error-boundary component (G-15), re-exported as the default
// from BOTH app/gdm/(door)/error.tsx and app/gdm/start/error.tsx (R45) so the
// two special files share this logic instead of duplicating it.
//
// It wraps every page under app/gdm/(door) (not the (door) nav or the frame in
// app/gdm/layout.tsx, which stay around it) AND app/gdm/start (a live database
// read outside the (door) group, added by R45 after R43's move left it
// uncovered). Both segments already ship the bank in their public JS (R44:
// measured — /gdm/start's own onboarding chunk imports it), so reusing this
// client component adds nothing new to public JS at either site.
//
// The button calls `retry()`, not `reset()`: in this Next version `reset()`
// clears the boundary and re-renders WITHOUT re-fetching, so a Server Component
// that failed on the database would fail again from the same payload; `retry()`
// re-fetches and re-renders the segment (Next docs, 03-file-conventions/error.md).
//
// `gdm-load-failed` is an organiser row. With the organiser off this rethrows,
// so the error bubbles to the parent boundary and the row never renders.
import { gdmDoorEnabled } from "../../lib/gdm-door-flag";
import { GDM_COPY } from "../../lib/pal/gdm/copy";

export function GdmErrorBoundary({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  if (!gdmDoorEnabled("organiser")) throw error;
  const copy = GDM_COPY["gdm-load-failed"];
  return (
    <section className="surface-card legal-card">
      <p role="alert">{copy.line}</p>
      <button type="button" className="secondary-button gdm-retry" onClick={() => retry()}>
        {copy.retry}
      </button>
    </section>
  );
}
