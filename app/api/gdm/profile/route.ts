import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { GDM_COPY } from "../../../../lib/pal/gdm/copy";
import { encryptField, safeDecrypt } from "../../../../lib/server/crypto";
import { getDb, schema } from "../../../../lib/server/db";
import { gdmInvalid, gdmJsonBody, gdmNotFound, gdmRouteGuard, type GdmRouteDeps } from "../../../../lib/server/gdm-route";

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

// The shared guard (G-16) with `{ consent: false }`: this is the route that
// records consent, so it checks closed → session and nothing more.
const guard = (deps: GdmRouteDeps) => gdmRouteGuard(deps, { consent: false });
const seal = (date: string | null | undefined) => (date ? encryptField(date) : null);

export function createGdmProfileHandlers(deps: GdmRouteDeps = {}) {
  const db = deps.db ?? getDb;

  return {
    async GET() {
      const gate = await guard(deps);
      if (gate instanceof Response) return gate;
      const [row] = await db()
        .select({ appointment: schema.gdmProfiles.appointmentCiphertext })
        .from(schema.gdmProfiles)
        .where(eq(schema.gdmProfiles.userId, gate.userId));
      if (!row) return NextResponse.json({ hasProfile: false });
      return NextResponse.json({ hasProfile: true, appointmentDate: row.appointment ? safeDecrypt(row.appointment) : null });
    },

    async POST(request: Request) {
      const gate = await guard(deps);
      if (gate instanceof Response) return gate;
      const parsed = CreateSchema.safeParse(await gdmJsonBody(request));
      if (!parsed.success) return gdmInvalid();
      if (!parsed.data.consent) {
        // GDPR Art. 9: explicit consent is the lawful basis. No consent, no row.
        return NextResponse.json({ error: GDM_COPY["gdm-consent-required"].line }, { status: 400 });
      }
      const now = new Date();
      const appointmentCiphertext = seal(parsed.data.appointmentDate);
      await db()
        .insert(schema.gdmProfiles)
        .values({ userId: gate.userId, consentedAt: now, appointmentCiphertext })
        // G-22: consentedAt is written ONCE. It is the record that explicit consent
        // was given; a double-tap on "Agree and continue" must not move it.
        .onConflictDoUpdate({ target: schema.gdmProfiles.userId, set: { appointmentCiphertext } });
      return NextResponse.json({ ok: true });
    },

    async PATCH(request: Request) {
      const gate = await guard(deps);
      if (gate instanceof Response) return gate;
      const parsed = PatchSchema.safeParse(await gdmJsonBody(request));
      if (!parsed.success) return gdmInvalid();
      const updated = await db()
        .update(schema.gdmProfiles)
        .set({ appointmentCiphertext: seal(parsed.data.appointmentDate) })
        .where(eq(schema.gdmProfiles.userId, gate.userId))
        .returning({ userId: schema.gdmProfiles.userId });
      return updated.length === 0 ? gdmNotFound() : NextResponse.json({ ok: true });
    }
  };
}

const handlers = createGdmProfileHandlers();
export const GET = handlers.GET;
export const POST = handlers.POST;
export const PATCH = handlers.PATCH;
