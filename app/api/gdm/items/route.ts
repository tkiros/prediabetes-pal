import { and, count, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import type { ClinicalRoute } from "../../../../lib/pal/clinical-risk";
import { askListCardRoute } from "../../../../lib/pal/gdm/asklist";
import { GDM_COPY } from "../../../../lib/pal/gdm/copy";
import {
  GDM_ITEM_BODY,
  GDM_ITEM_CAP,
  GDM_ITEM_KINDS,
  type AskBody,
  type GdmItemKind
} from "../../../../lib/pal/gdm/items";
import { IsoDate } from "../../../../lib/pal/gdm/plan-record";
import { loadSafetyContract, type SafetyContract } from "../../../../lib/pal/safety-contract";
import { captureServerError } from "../../../../lib/pal/sentry-capture";
import { encryptField, safeDecrypt } from "../../../../lib/server/crypto";
import { getDb, schema, type Db } from "../../../../lib/server/db";
import { listGdmItems } from "../../../../lib/server/gdm-items";
import {
  gdmInvalid,
  gdmJsonBody,
  gdmNotFound,
  gdmRouteGuard,
  type GdmRouteDeps
} from "../../../../lib/server/gdm-route";

export const runtime = "nodejs";

// What she keeps on the door: questions for her appointment (F-ASKLIST), her
// plan (F-PLANKEEP), and her meals (F-MYMEALS). No model call on this path (PRD §6.2): the one
// thing that reads her words is the existing clinical router, over an ask.

const Kind = z.enum(GDM_ITEM_KINDS);
const Id = z.string().uuid();
const PostSchema = z.object({ kind: Kind, body: z.unknown(), replaces: Id.optional() }).strict();
/**
 * A PATCH either rewrites an entry's whole body (a question or a meal), or,
 * for a plan only, retires it (final review F2): `retire.replacedOn` is her
 * device's day, never one the route makes up (G-44). Both are strict, so a
 * body beside `retire`, or any other key at either level, is a 400.
 */
const PatchSchema = z.union([
  z.object({ id: Id, body: z.unknown() }).strict(),
  z.object({ id: Id, retire: z.object({ replacedOn: IsoDate }).strict() }).strict()
]);

type Deps = GdmRouteDeps & { loadContract?: () => SafetyContract };

/** The two plan fields a replace reads and writes. GdmPlanSchema (Task 3.2) carries both. */
type PlanDates = { enteredOn: string; replacedOn: string | null };

/** R52: the kinds DELETE removes. */
const DELETABLE_KINDS: GdmItemKind[] = ["ask", "meal"];

const seal = (body: unknown) => encryptField(JSON.stringify(body));
const isItemKind = (kind: string): kind is GdmItemKind => (GDM_ITEM_KINDS as readonly string[]).includes(kind);
const ok = () => NextResponse.json({ ok: true });

export function createGdmItemsHandlers(deps: Deps = {}) {
  const db = deps.db ?? getDb;
  const loadContract = deps.loadContract ?? loadSafetyContract;

  return {
    async GET(request: Request) {
      const gate = await gdmRouteGuard(deps);
      if (gate instanceof Response) return gate;
      const kind = Kind.safeParse(new URL(request.url).searchParams.get("kind"));
      if (!kind.success) return gdmInvalid();
      return NextResponse.json({ items: await listGdmItems(db(), gate.userId, kind.data) });
    },

    async POST(request: Request) {
      const gate = await gdmRouteGuard(deps);
      if (gate instanceof Response) return gate;
      const parsed = PostSchema.safeParse(await gdmJsonBody(request));
      if (!parsed.success) return gdmInvalid();
      const { kind, replaces } = parsed.data;
      if (replaces !== undefined && kind !== "plan") return gdmInvalid();
      const body = GDM_ITEM_BODY[kind]?.safeParse(parsed.data.body);
      if (!body?.success) return gdmInvalid();
      // R47: a plan arrives current. Only the replace transaction below dates a
      // plan, so a plain POST can never store one already replaced, and a
      // replace can never leave her with no current plan. (Here, not in the
      // schema: a stored body carries its replacedOn once it is replaced.)
      if (kind === "plan" && (body.data as PlanDates).replacedOn !== null) return gdmInvalid();

      // G-11: the card is decided BEFORE anything is stored, and the contract is
      // read on EVERY ask — not first on the rarest, most serious question. A
      // ledger that cannot be read fails here, loudly, on an ordinary question,
      // with nothing saved, so a retry cannot duplicate it. R46: and before the
      // cap, so a full list never hides the card (PRD §6.2: these routes are
      // "answered by their own approved rows first").
      let route: ClinicalRoute | null = null;
      let routeCopy: string | null = null;
      if (kind === "ask") {
        let contract: SafetyContract;
        try {
          contract = loadContract();
        } catch (error) {
          await captureServerError(error, "route");
          return NextResponse.json({ error: GDM_COPY["gdm-save-failed"].line }, { status: 500 });
        }
        const { text, note } = body.data as AskBody;
        route = askListCardRoute(`${text} ${note ?? ""}`);
        routeCopy = route ? contract.copy.clinicalRoutes[route] : null;
      }

      const [held] = await db()
        .select({ n: count() })
        .from(schema.gdmItems)
        .where(and(eq(schema.gdmItems.userId, gate.userId), eq(schema.gdmItems.kind, kind)));
      if ((held?.n ?? 0) >= GDM_ITEM_CAP) {
        // G-14: "try again in a moment" is untrue for a full list. R46: the card
        // travels with the refusal; the question is not kept.
        return NextResponse.json({ error: GDM_COPY["gdm-list-full"].line, route, routeCopy }, { status: 409 });
      }

      if (replaces === undefined) {
        const [row] = await db()
          .insert(schema.gdmItems)
          .values({ userId: gate.userId, kind, bodyCiphertext: seal(body.data) })
          .returning({ id: schema.gdmItems.id });
        return NextResponse.json({ id: row.id, route, routeCopy });
      }

      const replaced = await replacePlan(db(), gate.userId, replaces, body.data as PlanDates);
      if (replaced === "not_found") return gdmNotFound();
      if (replaced === "already_replaced") return NextResponse.json({ error: "Already replaced." }, { status: 409 });
      return NextResponse.json({ id: replaced.id, route, routeCopy });
    },

    async PATCH(request: Request) {
      const gate = await gdmRouteGuard(deps);
      if (gate instanceof Response) return gate;
      const parsed = PatchSchema.safeParse(await gdmJsonBody(request));
      if (!parsed.success) return gdmInvalid();
      // Looked up by id AND her userId: another user's id is simply not found.
      const hers = and(eq(schema.gdmItems.id, parsed.data.id), eq(schema.gdmItems.userId, gate.userId));
      const [row] = await db().select({ kind: schema.gdmItems.kind }).from(schema.gdmItems).where(hers);
      if (!row) return gdmNotFound();
      if ("retire" in parsed.data) {
        // F2: only a plan is retired; a question or a meal is deleted instead.
        if (row.kind !== "plan") return gdmInvalid();
        const retired = await retirePlan(db(), gate.userId, parsed.data.id, parsed.data.retire.replacedOn);
        if (retired === "not_found") return gdmNotFound();
        // Server strings the page never shows (R47): every failure there is gdm-save-failed.
        if (retired === "already_replaced") return NextResponse.json({ error: "Already replaced." }, { status: 409 });
        if (retired === "last_current") return NextResponse.json({ error: "Last current plan." }, { status: 409 });
        return ok();
      }
      // R47: a plan is never edited in place. It is only replaced (POST with
      // `replaces`, whose new body must arrive with replacedOn null) or retired
      // (above), so `replacedOn` is set inside one of those two transactions
      // and nowhere else, and the rest of a plan's record stays as she entered it.
      if (row.kind === "plan") return gdmInvalid();
      const body = isItemKind(row.kind) ? GDM_ITEM_BODY[row.kind]?.safeParse(parsed.data.body) : undefined;
      if (!body?.success) return gdmInvalid();
      const updated = await db()
        .update(schema.gdmItems)
        .set({ bodyCiphertext: seal(body.data), updatedAt: new Date() })
        .where(hers)
        .returning({ id: schema.gdmItems.id });
      return updated.length === 0 ? gdmNotFound() : ok();
    },

    async DELETE(request: Request) {
      const gate = await gdmRouteGuard(deps);
      if (gate instanceof Response) return gate;
      const id = Id.safeParse(new URL(request.url).searchParams.get("id"));
      if (!id.success) return gdmInvalid();
      // R52: only a question or a meal is deleted here. A plan is kept and
      // only ever replaced (R47), and a photo of her sheet has its own route.
      const deleted = await db()
        .delete(schema.gdmItems)
        .where(
          and(
            eq(schema.gdmItems.id, id.data),
            eq(schema.gdmItems.userId, gate.userId),
            inArray(schema.gdmItems.kind, DELETABLE_KINDS)
          )
        )
        .returning({ id: schema.gdmItems.id });
      return deleted.length === 0 ? gdmNotFound() : ok();
    }
  };
}

/**
 * G-13: Replace is ONE server operation, so she never holds two current plans
 * and never none. In one transaction:
 *   1. load the old plan by id, HER userId and kind "plan", locked FOR UPDATE
 *      (two tabs replacing the same plan: the second waits, then sees it
 *      dated) — absent → "not_found" (404), already dated → "already_replaced" (409);
 *   2. insert the new plan;
 *   3. rewrite the old body with replacedOn = the new plan's enteredOn.
 * An old body that will not decrypt or parse throws, and the whole transaction
 * rolls back. tests/unit/pal/gdm-items-route.test.ts covers these three
 * outcomes (ruling R28).
 */
async function replacePlan(db: Db, userId: string, oldId: string, next: PlanDates) {
  return db.transaction(async (tx) => {
    const [old] = await tx
      .select({ bodyCiphertext: schema.gdmItems.bodyCiphertext })
      .from(schema.gdmItems)
      .where(and(eq(schema.gdmItems.id, oldId), eq(schema.gdmItems.userId, userId), eq(schema.gdmItems.kind, "plan")))
      .for("update");
    if (!old) return "not_found" as const;
    const oldBody = JSON.parse(safeDecrypt(old.bodyCiphertext)) as PlanDates;
    if (oldBody.replacedOn) return "already_replaced" as const;

    const [row] = await tx
      .insert(schema.gdmItems)
      .values({ userId, kind: "plan", bodyCiphertext: seal(next) })
      .returning({ id: schema.gdmItems.id });
    await tx
      .update(schema.gdmItems)
      .set({ bodyCiphertext: seal({ ...oldBody, replacedOn: next.enteredOn }), updatedAt: new Date() })
      .where(and(eq(schema.gdmItems.id, oldId), eq(schema.gdmItems.userId, userId)));
    return { id: row.id };
  });
}

/** A stored plan's two dates, or null when its body will not decrypt (safeDecrypt never throws) or parse. */
function readPlanDates(ciphertext: string): PlanDates | null {
  try {
    return JSON.parse(safeDecrypt(ciphertext)) as PlanDates;
  } catch {
    return null;
  }
}

/**
 * Final review F2: "this one no longer stands". R50 lets a second current
 * plan stand beside the first and a replace always leaves one current, so
 * without this two current plans could never go back to one. In one
 * transaction:
 *   1. lock every one of HER plan rows FOR UPDATE (whether a plan is current
 *      lives inside its encrypted body, so it cannot be filtered in SQL; two
 *      tabs retiring the last two plans: the second waits, then sees one left);
 *   2. the target must be among them — absent → "not_found" (404) — and
 *      current — already dated → "already_replaced" (409) — and at least one
 *      OTHER current plan must remain — none → "last_current" (409): she is
 *      never left with no current plan;
 *   3. rewrite the target's body with replacedOn = her device's day, as sent
 *      (the route never makes up a date — G-44), re-encrypted.
 * Another plan that will not decrypt or parse is NOT counted as current:
 * listGdmItems leaves it out of what she sees, so counting it could leave her
 * with no plan on screen. A target that will not decrypt cannot be
 * re-encrypted: JSON.parse throws and the whole transaction rolls back (500).
 */
async function retirePlan(db: Db, userId: string, id: string, replacedOn: string) {
  return db.transaction(async (tx) => {
    const plans = await tx
      .select({ id: schema.gdmItems.id, bodyCiphertext: schema.gdmItems.bodyCiphertext })
      .from(schema.gdmItems)
      .where(and(eq(schema.gdmItems.userId, userId), eq(schema.gdmItems.kind, "plan")))
      .for("update");
    const target = plans.find((plan) => plan.id === id);
    if (!target) return "not_found" as const;
    const body = JSON.parse(safeDecrypt(target.bodyCiphertext)) as PlanDates;
    if (body.replacedOn) return "already_replaced" as const;
    const anotherStands = plans.some((plan) => plan.id !== id && readPlanDates(plan.bodyCiphertext)?.replacedOn === null);
    if (!anotherStands) return "last_current" as const;

    await tx
      .update(schema.gdmItems)
      .set({ bodyCiphertext: seal({ ...body, replacedOn }), updatedAt: new Date() })
      .where(and(eq(schema.gdmItems.id, id), eq(schema.gdmItems.userId, userId)));
    return "retired" as const;
  });
}

const handlers = createGdmItemsHandlers();
export const GET = handlers.GET;
export const POST = handlers.POST;
export const PATCH = handlers.PATCH;
export const DELETE = handlers.DELETE;
