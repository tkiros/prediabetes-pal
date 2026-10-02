import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { gdmDoorEnabled, gdmDoorServerEnabled } from "../../../../lib/gdm-door-flag";
import { GDM_COPY } from "../../../../lib/pal/gdm/copy";
import { encryptField, safeDecrypt } from "../../../../lib/server/crypto";
import { getDb, schema, type Db } from "../../../../lib/server/db";
import { getSessionInfo, type SessionInfo } from "../../../../lib/server/session";

export const runtime = "nodejs";

// The GDM door's consent path. Deliberately NOT app/api/profile: that route
// requires a lab value and refuses one outside its range. This door asks for
// none, and asks nothing about medicine (owner decision D2) — both schemas are
// strict, so a field for either cannot be added by accident.
const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const CreateSchema = z
  .object({ told: z.literal(true), consent: z.boolean(), appointmentDate: IsoDate.nullable().optional() })
  .strict();
const PatchSchema = z.object({ appointmentDate: IsoDate.nullable() }).strict();

type Deps = { db?: () => Db; getSession?: () => Promise<SessionInfo> };

// R27: this route writes its own closed → session checks; Task 2.1 later
// extracts a shared guard (lib/server/gdm-route.ts, G-16) and moves this route
// onto it.
const closed = () => !(gdmDoorServerEnabled() && gdmDoorEnabled("organiser"));
const notFound = () => NextResponse.json({ error: "Not found." }, { status: 404 });
const signIn = () => NextResponse.json({ error: "Sign in first." }, { status: 401 });
const invalid = () => NextResponse.json({ error: "Invalid request." }, { status: 400 });
const seal = (date: string | null | undefined) => (date ? encryptField(date) : null);
async function json(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export function createGdmProfileHandlers(deps: Deps = {}) {
  const db = deps.db ?? getDb;
  const getSession = deps.getSession ?? getSessionInfo;

  return {
    async GET() {
      if (closed()) return notFound();
      const session = await getSession();
      if (!session) return signIn();
      const [row] = await db()
        .select({ appointment: schema.gdmProfiles.appointmentCiphertext })
        .from(schema.gdmProfiles)
        .where(eq(schema.gdmProfiles.userId, session.userId));
      if (!row) return NextResponse.json({ hasProfile: false });
      return NextResponse.json({ hasProfile: true, appointmentDate: row.appointment ? safeDecrypt(row.appointment) : null });
    },

    async POST(request: Request) {
      if (closed()) return notFound();
      const session = await getSession();
      if (!session) return signIn();
      const parsed = CreateSchema.safeParse(await json(request));
      if (!parsed.success) return invalid();
      if (!parsed.data.consent) {
        // GDPR Art. 9: explicit consent is the lawful basis. No consent, no row.
        return NextResponse.json({ error: GDM_COPY["gdm-consent-required"].line }, { status: 400 });
      }
      const now = new Date();
      const appointmentCiphertext = seal(parsed.data.appointmentDate);
      await db()
        .insert(schema.gdmProfiles)
        .values({ userId: session.userId, consentedAt: now, appointmentCiphertext })
        // G-22: consentedAt is written ONCE. It is the record that explicit consent
        // was given; a double-tap on "Agree and continue" must not move it.
        .onConflictDoUpdate({ target: schema.gdmProfiles.userId, set: { appointmentCiphertext } });
      return NextResponse.json({ ok: true });
    },

    async PATCH(request: Request) {
      if (closed()) return notFound();
      const session = await getSession();
      if (!session) return signIn();
      const parsed = PatchSchema.safeParse(await json(request));
      if (!parsed.success) return invalid();
      const updated = await db()
        .update(schema.gdmProfiles)
        .set({ appointmentCiphertext: seal(parsed.data.appointmentDate) })
        .where(eq(schema.gdmProfiles.userId, session.userId))
        .returning({ userId: schema.gdmProfiles.userId });
      return updated.length === 0 ? notFound() : NextResponse.json({ ok: true });
    }
  };
}

const handlers = createGdmProfileHandlers();
export const GET = handlers.GET;
export const POST = handlers.POST;
export const PATCH = handlers.PATCH;
