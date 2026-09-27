"use client"; // Error boundaries must be Client Components.

// G-15: the door's error boundary, so a database hiccup never shows an anxious
// user Next's raw error page. It wraps every page under app/gdm (not the frame
// in app/gdm/layout.tsx, which stays around it).
//
// The button calls `retry()`, not `reset()`: in this Next version `reset()`
// clears the boundary and re-renders WITHOUT re-fetching, so a Server Component
// that failed on the database would fail again from the same payload; `retry()`
// re-fetches and re-renders the segment (Next docs, 03-file-conventions/error.md).
//
// `gdm-load-failed` is an organiser row, but this boundary also wraps the
// landing and start pages. With the organiser off it rethrows, so the error
// bubbles to the parent boundary and a Pending organiser row never renders in a
// landing-only build.
import { gdmDoorEnabled } from "../../lib/gdm-door-flag";
import { GDM_COPY } from "../../lib/pal/gdm/copy";

export default function GdmError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
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
