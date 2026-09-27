"use client"; // Error boundaries must be Client Components.

// G-15: the door's error boundary, so a database hiccup never shows an anxious
// user Next's raw error page. It wraps every page under app/gdm/(door) (not
// the (door) nav or the frame in app/gdm/layout.tsx, which stay around it).
//
// R43: it lives here, not at app/gdm/error.tsx. A client boundary that imports
// the bank puts the whole bank in a chunk every page under its segment loads;
// at app/gdm that was the landing too, so a landing-only build shipped the
// organiser's Pending rows in public JS. The door pages exist only under
// `organiser`.
//
// The button calls `retry()`, not `reset()`: in this Next version `reset()`
// clears the boundary and re-renders WITHOUT re-fetching, so a Server Component
// that failed on the database would fail again from the same payload; `retry()`
// re-fetches and re-renders the segment (Next docs, 03-file-conventions/error.md).
//
// `gdm-load-failed` is an organiser row. With the organiser off this rethrows,
// so the error bubbles to the parent boundary and the row never renders.
import { gdmDoorEnabled } from "../../../lib/gdm-door-flag";
import { GDM_COPY } from "../../../lib/pal/gdm/copy";

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
