import Link from "next/link";

import { BOUNDARY_DISCLAIMER } from "../lib/pal/boundary-copy";

// The one stable disclaimer across active result surfaces (claims-boundary.md
// §"one result-footer disclaimer"). Single-sourced from the SAFETY-OWNED
// boundary-copy module (verbatim `result-footer` ledger row); static pages
// import this re-export, server responses carry the same string via the
// contract. Kept as a named export so existing importers are unaffected.
export const RESULT_FOOTER_DISCLAIMER = BOUNDARY_DISCLAIMER;

export function DisclaimerLine({
  disclaimer = RESULT_FOOTER_DISCLAIMER
}: {
  disclaimer?: string;
}) {
  return (
    <p className="result-disclaimer">
      {disclaimer}{" "}
      <Link className="result-disclaimer-link" href="/privacy">
        Privacy
      </Link>
    </p>
  );
}
