// app/gdm/start/page.tsx — PR-L version. Task 1.4 replaces the body's last branch.
import { notFound, redirect } from "next/navigation";

import { GdmWordmark } from "../../../components/gdm/wordmark";
import { gdmDoorEnabled } from "../../../lib/gdm-door-flag";
import { GDM_COPY } from "../../../lib/pal/gdm/copy";
import { GDM_ROUTES } from "../../../lib/pal/gdm/routes";
import { getSessionInfo } from "../../../lib/server/session";

export default async function GdmStartPage() {
  if (!gdmDoorEnabled("landing") && !gdmDoorEnabled("organiser")) notFound();
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
