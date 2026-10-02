import { eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";

import { gdmDoorEnabled, gdmDoorServerEnabled } from "../gdm-door-flag";
import { GDM_ROUTES } from "../pal/gdm/routes";
import { safeDecrypt } from "./crypto";
import { getDb, schema, type Db } from "./db";
import { getSessionInfo, type SessionInfo } from "./session";

/**
 * The GDM door's data-access guard. Auth checks live here and in each page,
 * never in a layout: a layout does not re-render on navigation and does not
 * stop its children rendering (Next docs, 02-guides/authentication.md,
 * "Layouts and auth checks"). So every page under app/gdm/(door)/ calls
 * `requireGdmDoor()` first, and app/gdm/start/page.tsx reads `gdmDoorState()`.
 */
export type GdmDoorState =
  | { kind: "closed" }
  | { kind: "signed_out" }
  | { kind: "no_profile"; userId: string }
  | { kind: "open"; userId: string; appointmentDate: string | null };

type Deps = { db?: () => Db; getSession?: () => Promise<SessionInfo> };

export async function gdmDoorState(deps: Deps = {}): Promise<GdmDoorState> {
  // The flag first: a closed door never looks at the session or the database.
  if (!(gdmDoorServerEnabled() && gdmDoorEnabled("organiser"))) return { kind: "closed" };
  const session = await (deps.getSession ?? getSessionInfo)();
  if (!session) return { kind: "signed_out" };
  const [row] = await (deps.db ?? getDb)()
    .select({ appointment: schema.gdmProfiles.appointmentCiphertext })
    .from(schema.gdmProfiles)
    .where(eq(schema.gdmProfiles.userId, session.userId));
  if (!row) return { kind: "no_profile", userId: session.userId };
  return { kind: "open", userId: session.userId, appointmentDate: row.appointment ? safeDecrypt(row.appointment) : null };
}

/**
 * Call first in every page under app/gdm/(door)/. notFound() and redirect()
 * throw, so this only returns when the door is open. `deps` exists for tests.
 */
export async function requireGdmDoor(deps: Deps = {}): Promise<{ userId: string; appointmentDate: string | null }> {
  const state = await gdmDoorState(deps);
  if (state.kind === "closed") notFound();
  if (state.kind === "signed_out") redirect(GDM_ROUTES.signup);
  if (state.kind === "no_profile") redirect(GDM_ROUTES.start);
  return { userId: state.userId, appointmentDate: state.appointmentDate };
}
