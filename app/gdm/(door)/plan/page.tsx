// app/gdm/(door)/plan/page.tsx — My plan (PRD §6.2 F-PLANKEEP). The guard
// first, like every door page; the plan loads its own entries from
// /api/gdm/items.
import { PlanKeep } from "../../../../components/gdm/plan-keep";
import { requireGdmDoor } from "../../../../lib/server/gdm-door";

export default async function GdmPlanPage() {
  await requireGdmDoor();
  return <PlanKeep />;
}
