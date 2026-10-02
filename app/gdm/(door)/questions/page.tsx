// app/gdm/(door)/questions/page.tsx — My questions (PRD §6.2 F-ASKLIST). The
// guard first, like every door page; the list loads its own entries from
// /api/gdm/items, so this page works with nothing else on the door built.
import { AskList } from "../../../../components/gdm/ask-list";
import { requireGdmDoor } from "../../../../lib/server/gdm-door";

export default async function GdmQuestionsPage() {
  await requireGdmDoor();
  return <AskList />;
}
