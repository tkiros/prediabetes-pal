// app/gdm/(door)/meals/page.tsx — My meals (PRD §6.2 F-MYMEALS). The guard
// first, like every door page; the list loads its own entries from
// /api/gdm/items.
import { MyMeals } from "../../../../components/gdm/my-meals";
import { requireGdmDoor } from "../../../../lib/server/gdm-door";

export default async function GdmMealsPage() {
  await requireGdmDoor();
  return <MyMeals />;
}
