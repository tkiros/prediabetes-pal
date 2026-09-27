import { and, asc, count, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { GDM_COPY } from "../../../../lib/pal/gdm/copy";
import {
  PLAN_PHOTO_CAP,
  PLAN_PHOTO_MAX_REQUEST_BYTES,
  PlanPhotoBodySchema,
  type PlanPhotoBody
} from "../../../../lib/pal/gdm/plan-photo";
import { encryptField, safeDecrypt } from "../../../../lib/server/crypto";
import { getDb, schema } from "../../../../lib/server/db";
import { gdmInvalid, gdmNotFound, gdmRouteGuard, type GdmRouteDeps } from "../../../../lib/server/gdm-route";

export const runtime = "nodejs";

// A photo of her sheet (F-PLANKEEP), stored as a photo: encrypted, shown back
// only to her, and read by nothing. No text is taken from it and no model
// sees it.
// ponytail: the photo lives in Postgres, not Blob — erase, export and the user cascade then cover it with no second deletion path to get wrong (lib/server/blob.ts exists because that path once leaked). Move to private Blob if photos ever number in the thousands.

const KIND = "plan_photo";
const Id = z.string().uuid();

const TOO_LARGE = Symbol("too large");

/**
 * G-20: the POST body as JSON (null when it is missing or does not parse), or
 * TOO_LARGE. A declared Content-Length over the bound is refused before a
 * byte is read; a body sent without one is read only up to the bound.
 */
async function boundedJson(request: Request, maxBytes: number): Promise<unknown> {
  if (Number(request.headers.get("content-length")) > maxBytes) return TOO_LARGE;
  if (!request.body) return null;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      return TOO_LARGE;
    }
    chunks.push(value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
  } catch {
    return null;
  }
}

/** The stored photo, or null when it will not decrypt (safeDecrypt never throws) or parse. */
function readPhoto(ciphertext: string): PlanPhotoBody | null {
  try {
    const photo = PlanPhotoBodySchema.safeParse(JSON.parse(safeDecrypt(ciphertext)));
    return photo.success ? photo.data : null;
  } catch {
    return null;
  }
}

export function createGdmPlanPhotoHandlers(deps: GdmRouteDeps = {}) {
  const db = deps.db ?? getDb;
  /** Her photo by id: another user's id, or a row of another kind, is simply not found. */
  const hers = (userId: string, id: string) =>
    and(eq(schema.gdmItems.id, id), eq(schema.gdmItems.userId, userId), eq(schema.gdmItems.kind, KIND));

  return {
    /** With `?id=`: that photo's bytes, to her only. Without: her photo ids, oldest first, never their bytes. */
    async GET(request: Request) {
      const gate = await gdmRouteGuard(deps);
      if (gate instanceof Response) return gate;
      const rawId = new URL(request.url).searchParams.get("id");
      if (rawId === null) {
        const items = await db()
          .select({ id: schema.gdmItems.id })
          .from(schema.gdmItems)
          .where(and(eq(schema.gdmItems.userId, gate.userId), eq(schema.gdmItems.kind, KIND)))
          .orderBy(asc(schema.gdmItems.createdAt));
        return NextResponse.json({ items });
      }
      const id = Id.safeParse(rawId);
      if (!id.success) return gdmInvalid();
      const [row] = await db()
        .select({ bodyCiphertext: schema.gdmItems.bodyCiphertext })
        .from(schema.gdmItems)
        .where(hers(gate.userId, id.data));
      if (!row) return gdmNotFound();
      const photo = readPhoto(row.bodyCiphertext);
      if (!photo) return NextResponse.json({ error: GDM_COPY["gdm-load-failed"].line }, { status: 500 });
      return new Response(new Uint8Array(Buffer.from(photo.dataBase64, "base64")), {
        headers: {
          "content-type": photo.mime,
          // A shared phone keeps no copy, and the type is never guessed from the bytes (G-20).
          "cache-control": "private, no-store",
          "x-content-type-options": "nosniff"
        }
      });
    },

    async POST(request: Request) {
      const gate = await gdmRouteGuard(deps);
      if (gate instanceof Response) return gate;
      const body = await boundedJson(request, PLAN_PHOTO_MAX_REQUEST_BYTES);
      if (body === TOO_LARGE) return gdmInvalid();
      const photo = PlanPhotoBodySchema.safeParse(body);
      if (!photo.success) return gdmInvalid();

      // ponytail: count-then-insert, so two uploads at once can pass the cap; it bounds storage, it is not an invariant.
      const [held] = await db()
        .select({ n: count() })
        .from(schema.gdmItems)
        .where(and(eq(schema.gdmItems.userId, gate.userId), eq(schema.gdmItems.kind, KIND)));
      // G-20: unreachable from the page, which stops offering the add control at the cap.
      if ((held?.n ?? 0) >= PLAN_PHOTO_CAP) return NextResponse.json({ error: "Photo limit reached." }, { status: 409 });

      const [row] = await db()
        .insert(schema.gdmItems)
        .values({ userId: gate.userId, kind: KIND, bodyCiphertext: encryptField(JSON.stringify(photo.data)) })
        .returning({ id: schema.gdmItems.id });
      return NextResponse.json({ id: row.id });
    },

    async DELETE(request: Request) {
      const gate = await gdmRouteGuard(deps);
      if (gate instanceof Response) return gate;
      const id = Id.safeParse(new URL(request.url).searchParams.get("id"));
      if (!id.success) return gdmInvalid();
      const deleted = await db()
        .delete(schema.gdmItems)
        .where(hers(gate.userId, id.data))
        .returning({ id: schema.gdmItems.id });
      return deleted.length === 0 ? gdmNotFound() : NextResponse.json({ ok: true });
    }
  };
}

const handlers = createGdmPlanPhotoHandlers();
export const GET = handlers.GET;
export const POST = handlers.POST;
export const DELETE = handlers.DELETE;
