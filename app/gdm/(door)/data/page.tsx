// app/gdm/(door)/data/page.tsx — Your data. The shared account routes do the
// work (export, erase, delete); this door adds no server code for them.
import { GdmDataControls } from "../../../../components/gdm/data-controls";
import { GDM_COPY } from "../../../../lib/pal/gdm/copy";
import { requireGdmDoor } from "../../../../lib/server/gdm-door";

export default async function GdmDataPage() {
  await requireGdmDoor();
  return (
    <>
      <h1 className="gdm-title">{GDM_COPY["gdm-data-controls"].title}</h1>
      <GdmDataControls />
    </>
  );
}
