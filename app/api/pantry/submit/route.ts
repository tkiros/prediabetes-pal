import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { and, eq, inArray, lt, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import {
  createPantryVisionClient,
  normalizeItemName,
  MAX_ITEMS_PER_ORDER,
  type PantryVisionClient
} from "../../../../lib/pantry/extract";
import { captureServerError } from "../../../../lib/pal/sentry-capture";
import { encryptField } from "../../../../lib/server/crypto";
import { getDb, schema, type Db } from "../../../../lib/server/db";
import {
  sendEmail,
  type SendEmailInput,
  type SendEmailResult
} from "../../../../lib/server/email";
import { bandRepresentativeA1c } from "../../../../lib/server/pantry/band";
import { isPrivatePantryBlobUrlForOrder } from "../../../../lib/server/pantry/blob-access";
import { supportInbox } from "../../../../lib/server/email";
import {
  getSessionInfo,
  type SessionInfo
} from "../../../../lib/server/session";

export const runtime = "nodejs";
// Extraction runs inside this request (≤10 photos × ≤60s worst case);
// OPS: requires the Vercel plan's 300s function ceiling (Pro default).
export const maxDuration = 300;

const SubmitSchema = z
  .object({
    orderId: z.string().uuid(),
    photoUrls: z
      .array(
        z.string().url().max(2048)
      )
      .min(1)
      .max(10),
    a1cBand: z.enum([
      "prediabetes_57_59",
      "prediabetes_60_62",
      "prediabetes_63_64"
    ]),
    notes: z.string().trim().max(500).optional(),
    consent: z.literal(true)
  })
  .strict();

type PantryRateLimit = (
  userId: string
) => Promise<{ ok: true } | { ok: false; retryAfterSeconds: number }>;

type Deps = {
  db?: () => Db;
  getSession?: () => Promise<SessionInfo>;
  vision?: () => PantryVisionClient;
  email?: { send: (input: SendEmailInput) => Promise<SendEmailResult> };
  rateLimit?: PantryRateLimit;
  now?: () => Date;
};

// Extraction endpoint limiter (locked decision 8): pal:pantry prefix,
// keyed by user (buyers are always signed in here). Fail-open on store
// errors, same posture as lib/pal/rate-limit.ts.
let limiter: Ratelimit | null | undefined;
async function defaultRateLimit(userId: string) {
  if (limiter === undefined) {
    const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
    const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
    limiter =
      url && token
        ? new Ratelimit({
            redis: new Redis({ url, token }),
            limiter: Ratelimit.slidingWindow(5, "1 h"),
            prefix: "pal:pantry",
            analytics: false
          })
        : null;
  }
  if (!limiter) return { ok: true } as const;
  try {
    const result = await limiter.limit(userId);
    return result.success
      ? ({ ok: true } as const)
      : ({
          ok: false,
          retryAfterSeconds: Math.max(
            1,
            Math.ceil((result.reset - Date.now()) / 1000)
          )
        } as const);
  } catch {
    return { ok: true } as const;
  }
}

export function createPantrySubmitHandler(deps: Deps = {}) {
  const db = deps.db ?? getDb;
  const getSession = deps.getSession ?? getSessionInfo;
  const vision = deps.vision ?? (() => createPantryVisionClient());
  const email = deps.email ?? { send: sendEmail };
  const rateLimit = deps.rateLimit ?? defaultRateLimit;
  const now = deps.now ?? (() => new Date());

  return async function POST(request: Request) {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    }

    let parsed;
    try {
      parsed = SubmitSchema.safeParse(await request.json());
    } catch {
      parsed = SubmitSchema.safeParse(null);
    }
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }
    const input = parsed.data;
    if (
      new Set(input.photoUrls).size !== input.photoUrls.length ||
      !input.photoUrls.every((url) =>
        isPrivatePantryBlobUrlForOrder(url, input.orderId)
      )
    ) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    const limit = await rateLimit(session.userId);
    if (!limit.ok) {
      return NextResponse.json(
        { error: "Please try again in a little while." },
        {
          status: 429,
          headers: { "Retry-After": String(limit.retryAfterSeconds) }
        }
      );
    }

    const [order] = await db()
      .select()
      .from(schema.pantryOrders)
      .where(
        and(
          eq(schema.pantryOrders.id, input.orderId),
          eq(schema.pantryOrders.userId, session.userId)
        )
      );
    if (!order) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    // WS-7: the submit lease. One conditional transition claims the order for
    // extraction — a concurrent double-submit loses the CAS and 409s with
    // ZERO vision spend (this is a paid workflow; extraction must run once).
    // A crashed run parks the order in `extracting` forever, so the lease is
    // reclaimable once updatedAt is older than the function ceiling
    // (maxDuration 300s) plus buffer — that makes a fault mid-extraction a
    // RECOVERABLE state: the buyer's retry re-runs from a clean slate.
    const staleLeaseCutoff = new Date(now().getTime() - 10 * 60_000);
    const claimed = await db()
      .update(schema.pantryOrders)
      .set({
        a1cBand: input.a1cBand,
        a1cCiphertext: encryptField(
          bandRepresentativeA1c(input.a1cBand).toFixed(1)
        ),
        notesCiphertext: input.notes ? encryptField(input.notes) : null,
        consentedAt: now(),
        status: "extracting",
        updatedAt: now()
      })
      .where(
        and(
          eq(schema.pantryOrders.id, order.id),
          or(
            inArray(schema.pantryOrders.status, ["claimed", "submitted"]),
            and(
              eq(schema.pantryOrders.status, "extracting"),
              lt(schema.pantryOrders.updatedAt, staleLeaseCutoff)
            )
          )
        )
      )
      .returning();
    if (claimed.length === 0) {
      return NextResponse.json(
        { error: "This order is already being processed." },
        { status: 409 }
      );
    }

    // Idempotent restart: a reclaimed stale lease starts from a clean slate —
    // drop any photo rows and draft items a crashed run left behind so a
    // retry can never double them up.
    await db()
      .delete(schema.pantryItems)
      .where(
        and(
          eq(schema.pantryItems.orderId, order.id),
          eq(schema.pantryItems.status, "draft")
        )
      );
    await db()
      .delete(schema.pantryPhotos)
      .where(eq(schema.pantryPhotos.orderId, order.id));

    // Record intake: photos + encrypted health-adjacent fields + consent.
    const photoRows = await db()
      .insert(schema.pantryPhotos)
      .values(
        input.photoUrls.map((blobUrl) => ({ orderId: order.id, blobUrl }))
      )
      .returning();

    // Extract per photo — failure isolation feeds the designed partial state.
    const client = vision();
    const seen = new Set<string>();
    const drafts: { name: string; portion: string | null }[] = [];
    let failedPhotos = 0;

    for (const photo of photoRows) {
      try {
        const extracted = await client.extractFromPhoto(photo.blobUrl);
        for (const item of extracted) {
          const key = normalizeItemName(item.name);
          if (!seen.has(key) && drafts.length < MAX_ITEMS_PER_ORDER) {
            seen.add(key);
            drafts.push(item);
          }
        }
        await db()
          .update(schema.pantryPhotos)
          .set({ status: "extracted" })
          .where(eq(schema.pantryPhotos.id, photo.id));
      } catch (error) {
        failedPhotos += 1;
        // captureServerError's stage union is model|route; pantry extraction
        // is a route-path failure (drift from brief's "pantry-extract" label).
        await captureServerError(error, "route");
        await db()
          .update(schema.pantryPhotos)
          .set({ status: "failed" })
          .where(eq(schema.pantryPhotos.id, photo.id));
      }
    }

    if (drafts.length === 0) {
      // Manual fallback is a designed service state, not an error apology.
      await db()
        .update(schema.pantryOrders)
        .set({ status: "needs_manual", updatedAt: now() })
        .where(eq(schema.pantryOrders.id, order.id));
      await email.send({
        to: supportInbox(),
        subject: `Pantry order needs manual review: ${order.id}`,
        text: `Extraction produced zero items for order ${order.id} (${failedPhotos} photo(s) failed). Handle via /admin/pantry.`,
        category: "pantry_alert",
        idempotencyKey: `pantry-extraction-alert/${order.id}`
      });
      return NextResponse.json({ status: "needs_manual" });
    }

    // WS-7: item writes + the awaiting_confirm transition are ONE transaction,
    // so a fault between them can't leave confirmable drafts on an order still
    // marked `extracting` (or the transition without its items).
    const inserted = await db().transaction(async (tx) => {
      const rows = await tx
        .insert(schema.pantryItems)
        .values(
          drafts.map((draft, position) => ({
            orderId: order.id,
            position,
            nameCiphertext: encryptField(draft.name),
            portionCiphertext: draft.portion
              ? encryptField(draft.portion)
              : null,
            source: "vision" as const,
            status: "draft" as const,
            updatedAt: now()
          }))
        )
        .returning();
      await tx
        .update(schema.pantryOrders)
        .set({ status: "awaiting_confirm", updatedAt: now() })
        .where(eq(schema.pantryOrders.id, order.id));
      return rows;
    });

    return NextResponse.json({
      status: "awaiting_confirm",
      failedPhotos,
      items: inserted.map((item, index) => ({
        id: item.id,
        name: drafts[index].name,
        portion: drafts[index].portion
      }))
    });
  };
}

export const POST = createPantrySubmitHandler();
