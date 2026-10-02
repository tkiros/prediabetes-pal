import { GDM_COPY } from "../../lib/pal/gdm/copy";

const LOAD_FAILED = GDM_COPY["gdm-load-failed"];

/** A list that did not load (G-15): the line, as an alert, and Try again. Shared by My questions and My meals. */
export function GdmLoadFailed({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="surface-card legal-card">
      <p role="alert">{LOAD_FAILED.line}</p>
      <button type="button" className="secondary-button gdm-retry" onClick={onRetry}>
        {LOAD_FAILED.retry}
      </button>
    </div>
  );
}
