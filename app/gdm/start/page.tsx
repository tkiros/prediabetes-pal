// app/gdm/start/page.tsx — where the door's sign-up returns. With the organiser
// closed (a landing-only release) it is PR-L's holding line; open, it is the
// onboarding, or Home once she has a profile.
import { notFound, redirect } from "next/navigation";

import { GdmOnboarding } from "../../../components/gdm/onboarding";
import { GdmWordmark } from "../../../components/gdm/wordmark";
import { gdmDoorEnabled, gdmDoorServerEnabled } from "../../../lib/gdm-door-flag";
import { GDM_COPY } from "../../../lib/pal/gdm/copy";
import { GDM_ROUTES } from "../../../lib/pal/gdm/routes";
import { gdmDoorState } from "../../../lib/server/gdm-door";
import { getSessionInfo } from "../../../lib/server/session";

export default async function GdmStartPage() {
  const organiserOpen = gdmDoorServerEnabled() && gdmDoorEnabled("organiser");
  if (!organiserOpen) {
    if (!gdmDoorEnabled("landing")) notFound();
    // Session before the holding line, so a signed-out visitor is never told she is signed in.
    if (!(await getSessionInfo())) redirect(GDM_ROUTES.signup);
    return (
      <>
        <GdmWordmark />
        <section className="surface-card">
          <p>{GDM_COPY["gdm-landing-holding"].line}</p>
        </section>
      </>
    );
  }
  const state = await gdmDoorState();
  if (state.kind === "closed") notFound();
  if (state.kind === "signed_out") redirect(GDM_ROUTES.signup);
  if (state.kind === "open") redirect(GDM_ROUTES.home);
  return (
    <>
      <GdmWordmark />
      <GdmOnboarding />
    </>
  );
}
