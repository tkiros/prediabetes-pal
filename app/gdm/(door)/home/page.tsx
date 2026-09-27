// app/gdm/(door)/home/page.tsx — a placeholder Home; Task 4.2 gives it its
// content. The heading is `gdm-nav.home`, not the door name: the nav's
// wordmark directly above already prints the name (G-38).
import { GdmDoorShown } from "../../../../components/gdm/door-shown";
import { GDM_COPY } from "../../../../lib/pal/gdm/copy";
import { requireGdmDoor } from "../../../../lib/server/gdm-door";

export default async function GdmHomePage() {
  await requireGdmDoor();
  return (
    <>
      <GdmDoorShown surface="home" />
      <h1 className="gdm-title">{GDM_COPY["gdm-nav"].home}</h1>
    </>
  );
}
