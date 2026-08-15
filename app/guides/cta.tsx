import Link from "next/link";

import { TASTER_LIMIT } from "../../lib/client/taster-store";

// The one conversion element on every guide: same destination and free-tier
// hint as the landing CTA, with the count interpolated from TASTER_LIMIT —
// never retyped (the copy-pins invariant).
export function GuideCta({ label = "Check a meal now" }: { label?: string }) {
  return (
    <div className="landing-cta-stack landing-cta-stack--spaced landing-cta-stack--start">
      <Link className="landing-cta" href="/check">
        {label}
      </Link>
      <p className="landing-cta-hint">
        No login. No card. {TASTER_LIMIT} free checks on your first day.
      </p>
    </div>
  );
}
