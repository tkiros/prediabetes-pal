// app/gdm/(door)/home/page.tsx — Home (PRD §6.2 F-WAIT; G-32, G-37, G-69):
// the waiting screen, or her plan once it is entered, with her appointment
// first in every state. The guard first, like every door page; then her
// plans, of which Home gets only the current ones. Her day is not decided
// here: the component computes it on her device (G-44). The heading is
// `gdm-nav.home`, not the door name: the nav's wordmark directly above
// already prints the name (G-38).
import { GdmDoorShown } from "../../../../components/gdm/door-shown";
import { WaitingMode } from "../../../../components/gdm/waiting-mode";
import { GDM_COPY } from "../../../../lib/pal/gdm/copy";
import { currentPlans, type GdmPlan } from "../../../../lib/pal/gdm/plan-record";
import { getDb } from "../../../../lib/server/db";
import { requireGdmDoor } from "../../../../lib/server/gdm-door";
import { listGdmItems } from "../../../../lib/server/gdm-items";

export default async function GdmHomePage() {
  const { userId, appointmentDate } = await requireGdmDoor();
  const plans = await listGdmItems<GdmPlan>(getDb(), userId, "plan");
  // `id` last, so nothing in a stored body can stand in for the row's id.
  const current = currentPlans(plans.map((plan) => ({ ...plan.body, id: plan.id })));
  return (
    <>
      <GdmDoorShown surface="home" />
      <h1 className="gdm-title">{GDM_COPY["gdm-nav"].home}</h1>
      <WaitingMode appointmentDate={appointmentDate} hasCurrentPlan={current.length > 0} plans={current} />
    </>
  );
}
