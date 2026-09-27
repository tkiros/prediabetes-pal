import Link from "next/link";
import { notFound } from "next/navigation";

import { GDM_DOOR_SURFACE, GdmDoorShown } from "../../components/gdm/door-shown";
import { gdmDoorEnabled } from "../../lib/gdm-door-flag";
import { GDM_COPY } from "../../lib/pal/gdm/copy";
import { GDM_ROUTES } from "../../lib/pal/gdm/routes";

export default function GdmLandingPage() {
  if (!gdmDoorEnabled("landing")) notFound();
  const points = GDM_COPY["gdm-landing-points"];
  return (
    <>
      <GdmDoorShown surface={GDM_DOOR_SURFACE.landing} />
      {/* G-38: no card around a hero (DESIGN.md §11), and a marketing CTA is 56px high
          (rails 9 and 15): give .gdm-cta a 56px min-height in the GDM block of globals.css. */}
      <section className="gdm-hero">
        <h1>{GDM_COPY["gdm-door-name"].name}</h1>
        <p>{GDM_COPY["gdm-landing-hero"].line}</p>
        {/* G-68 (owner, 2026-09-20): she is told there is no food guidance BEFORE she is asked to sign up. */}
        <p className="gdm-scope">{points.scope}</p>
        <Link className="primary-button link-button gdm-cta" href={GDM_ROUTES.signup}>
          {GDM_COPY["gdm-landing-hero"].cta}
        </Link>
      </section>
      <ul>
        {[points.plan, points.meals, points.asks].map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </>
  );
}
