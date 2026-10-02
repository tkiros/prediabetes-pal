// app/gdm/privacy/page.tsx — the door's privacy notice. Public, but only with
// the organiser: the row belongs to that surface, so it can never render while
// Pending in a landing-only production build. No `metadata` export (R8): a
// static title would reach a dark 404. Counsel reads this row before
// `organiser` goes live (plan §1).
import { notFound } from "next/navigation";

import { GdmWordmark } from "../../../components/gdm/wordmark";
import { gdmDoorEnabled } from "../../../lib/gdm-door-flag";
import { GDM_COPY } from "../../../lib/pal/gdm/copy";

export default function GdmPrivacyPage() {
  if (!gdmDoorEnabled("organiser")) notFound();
  const notice = GDM_COPY["gdm-privacy-notice"];
  return (
    <>
      <GdmWordmark />
      <section className="surface-card legal-card">
        <h1 className="gdm-title">{notice.title}</h1>
        <p>{notice.what}</p>
        <p>{notice.how}</p>
        <p>{notice.never}</p>
        <p>{notice.choices}</p>
      </section>
    </>
  );
}
