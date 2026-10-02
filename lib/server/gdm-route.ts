import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { gdmDoorEnabled, gdmDoorServerEnabled } from "../gdm-door-flag";
import { GDM_COPY } from "../pal/gdm/copy";
import { getDb, schema, type Db } from "./db";
import { getSessionInfo, type SessionInfo } from "./session";

export type GdmRouteDeps = { db?: () => Db; getSession?: () => Promise<SessionInfo> };

/**
 * The first line of every /api/gdm/* method (G-16), so the order lives in one
 * tested place: a closed door is a 404 before the session or the database is
 * looked at; no session is a 401; and a signed-in session is not consent, so
 * without a gdm_profiles row the answer is a 403 in approved words. Only the
 * route that records consent passes `{ consent: false }`.
 *
 * R55: `{ sessionOnly: true }` is for reading back what she already stored
 * (one photo of her sheet, by id): it needs her session and nothing else, so
 * her data stays downloadable with the door closed and whatever became of her
 * consent, as the account export does. The route still scopes the read to
 * her own row. Nothing that writes, deletes or lists passes it.
 */
export async function gdmRouteGuard(
  deps: GdmRouteDeps,
  options: { consent?: boolean; sessionOnly?: boolean } = {}
): Promise<{ userId: string } | Response> {
  const sessionOnly = options.sessionOnly === true;
  if (!sessionOnly && !(gdmDoorServerEnabled() && gdmDoorEnabled("organiser"))) return gdmNotFound();
  const session = await (deps.getSession ?? getSessionInfo)();
  if (!session) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  if (!sessionOnly && options.consent !== false) {
    const [profile] = await (deps.db ?? getDb)()
      .select({ consentedAt: schema.gdmProfiles.consentedAt })
      .from(schema.gdmProfiles)
      .where(eq(schema.gdmProfiles.userId, session.userId));
    if (!profile?.consentedAt) {
      return NextResponse.json({ error: GDM_COPY["gdm-consent-required"].line }, { status: 403 });
    }
  }
  return { userId: session.userId };
}

export const gdmNotFound = () => NextResponse.json({ error: "Not found." }, { status: 404 });
export const gdmInvalid = () => NextResponse.json({ error: "Invalid request." }, { status: 400 });

/** The request's JSON body, or null when there is none or it does not parse. */
export async function gdmJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
