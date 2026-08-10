import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { mealMemoryServerEnabled } from "../../../lib/meal-memory-flag";
import { normalize as normalizeFood } from "../../../lib/pal/input-precheck";
import { captureServerError } from "../../../lib/pal/sentry-capture";
import { capabilitiesFor } from "../../../lib/server/capabilities";
import {
  decryptField,
  encryptField,
  safeDecrypt as safeDecryptField
} from "../../../lib/server/crypto";
import { getDb, schema, type Db } from "../../../lib/server/db";
import {
  getEntitlement,
  type Entitlement
} from "../../../lib/server/entitlement";
import {
  getSessionInfo,
  type SessionInfo
} from "../../../lib/server/session";

/**
 * Meal memory API (plan §P3.2, §8 entity `meal_memories`).
 *
 * POST upserts the caller's single memory for one of their checks; GET lists
 * their memories joined with the check's display fields. Both gate in the same
 * order:
 *
 *   1. server flag OFF  → 404  (the feature does not exist in this build; the
 *      routes are inert without an approved rollout, global constraint §10)
 *   2. no session       → 401
 *   3. not entitled     → 403  (mealMemory is premium — the SINGLE capability
 *      matrix decides, lib/server/capabilities.ts; UI renders from this, never
 *      UI-only gating, global constraint §6)
 *
 * The 404-before-401 order is deliberate: with the flag off the endpoint must
 * look like it is simply not there, for signed-in and signed-out alike.
 *
 * Free text ("what I chose", the private note) is health-adjacent and encrypted
 * at rest (AES-256-GCM, same standard as checks.food), decrypted only here for
 * the owner. The bounded reflections (ease, label, wouldRepeat, favorite) stay
 * plaintext so the list renders without a decrypt per field. NOTHING here feeds
 * the check engine — this module is never imported by lib/pal/* (global
 * constraint §1, asserted by meal-memory-non-interference.test.ts).
 */

export type MemoryRouteDeps = {
  db?: () => Db;
  getSession?: () => Promise<SessionInfo>;
  entitlementOf?: (db: Db, userId: string) => Promise<Entitlement>;
  now?: () => Date;
  env?: { MEAL_MEMORY_ENABLED?: string };
};

export const MEMORY_CHOICE_MAX = 200;
export const MEMORY_NOTE_MAX = 500;

// Closed vocabularies — mirrors of the schema enums. Free text is never a
// reflection value; these are the only ease/label strings that may enter the DB.
export const MEMORY_EASE_VALUES = ["easy", "okay", "hard"] as const;
export const MEMORY_LABEL_VALUES = [
  "breakfast",
  "lunch",
  "dinner",
  "snack",
  "restaurant",
  "travel",
  "family_meal",
  "other"
] as const;

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

// Honest bounded scan for exact recall (plan §P3.3). Recall decrypts and compares
// the caller's own memories to the just-checked food — no hash index, no fuzzy
// search (§P3.3 "Prefer user-confirmed matching over opaque semantic inference";
// global constraint §5 "never … an unsalted hash of meal text"). The cap mirrors
// the Task 9 history search honesty: the newest 200 saved memories are searched,
// and a memory older than that is simply not recalled rather than pretending to
// scan an unbounded archive on every completed check.
export const RECALL_SCAN_LIMIT = 200;

// The just-checked meal text, transported in the POST BODY (never a URL — global
// constraint §5, health data must not appear in URLs). Bounds mirror the check
// request's food field (1..MAX_FOOD_LENGTH).
const RECALL_FOOD_MAX = 160;
const MemoryRecallSchema = z
  .object({
    food: z.string().trim().min(1).max(RECALL_FOOD_MAX)
  })
  .strict();

const MemoryUpsertSchema = z
  .object({
    checkId: z.string().uuid(),
    choice: z.string().trim().min(1).max(MEMORY_CHOICE_MAX).optional(),
    wouldRepeat: z.boolean().optional(),
    ease: z.enum(MEMORY_EASE_VALUES).optional(),
    note: z.string().trim().min(1).max(MEMORY_NOTE_MAX).optional(),
    favorite: z.boolean().optional(),
    label: z.enum(MEMORY_LABEL_VALUES).optional()
  })
  .strict();

// Bounded honest search over the caller's OWN memories (Task 16 / plan §P3.4).
// Meal text is health data and never a query string (T9 reviewer finding): the
// term rides the POST body, and the match runs over decrypted food + the user's
// own choice/note words. Encrypted at rest means no SQL LIKE / plaintext index /
// unsalted hash (global constraint §5), so we decrypt-and-scan the newest rows up
// to this cap and report searchScanned/searchCapped — never a silent partial.
export const MEMORY_SEARCH_SCAN_CAP = 500;

const MemorySearchSchema = z
  .object({ q: z.string().trim().min(1).max(RECALL_FOOD_MAX) })
  .strict();

// Field-level EDIT (Task 16 / plan §P3.4): only the user-authored reflection
// fields may change — never the check snapshot (risk/food/band/checkId). `.strict()`
// makes any snapshot key a 400 (the whitelist IS the schema). Each field is
// optional (absent → left untouched); free text and the nullable reflections may
// be sent as `null` to CLEAR them. `favorite` is NOT NULL in the DB, so it takes a
// boolean only. `.refine` rejects an empty patch so an edit always means something.
const MemoryEditSchema = z
  .object({
    choice: z.string().trim().min(1).max(MEMORY_CHOICE_MAX).nullable().optional(),
    wouldRepeat: z.boolean().nullable().optional(),
    ease: z.enum(MEMORY_EASE_VALUES).nullable().optional(),
    note: z.string().trim().min(1).max(MEMORY_NOTE_MAX).nullable().optional(),
    favorite: z.boolean().optional(),
    label: z.enum(MEMORY_LABEL_VALUES).nullable().optional()
  })
  .strict()
  .refine((patch) => Object.keys(patch).length > 0, {
    message: "Provide at least one field to edit."
  });

// Delete-all carries an explicit confirm flag: the UI does the calm two-step, and
// the server refuses a bare DELETE so a stray/mis-fired request can never wipe a
// whole memory in one shot. Not a dark pattern — just a guard on an irreversible op.
const MemoryDeleteAllSchema = z.object({ confirm: z.literal(true) }).strict();

function unauthorized() {
  return NextResponse.json({ error: "Sign in first." }, { status: 401 });
}

function notFound() {
  return NextResponse.json({ error: "Not found." }, { status: 404 });
}

function forbidden() {
  return NextResponse.json({ error: "Forbidden." }, { status: 403 });
}

// Honest failure state (Task 11 error-truth): a backend fault is an explicit 500
// with retry copy — never a paywall/"locked" (global constraint §7). The error is
// captured to Sentry first via the PII-free tag seam (no health text ever reaches
// the event — sentry-scrub.ts redacts the message and frame vars).
async function serverError(error: unknown) {
  await captureServerError(error, "route");
  return NextResponse.json(
    { error: "Something went wrong. Please try again." },
    { status: 500 }
  );
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

// Null-guarding wrapper over the shared crypto.safeDecrypt (imported as
// safeDecryptField): nullable memory columns pass through as null; a present
// value degrades quietly on a rotated key but reports a failing auth tag
// (corruption/tampering) to Sentry. The old inline copy swallowed tamper
// silently on this health-data read path (PR-3).
function safeDecrypt(ciphertext: string | null): string | null {
  return ciphertext == null ? null : safeDecryptField(ciphertext);
}

/**
 * E4: a persisted weekly learning artifact is derived partly from the caller's
 * memories (their label/favorite, and the anchoring check's meal text). Any
 * memory mutation therefore staleness-invalidates the caller's cached artifacts,
 * so drop their weekly_reflections rows and let the next weekly GET regenerate
 * them lazily from current sources. Deleting all of the caller's rows is cheap
 * (≤4 completed weeks) and avoids recomputing which week the row belongs to.
 */
async function invalidateWeeklyArtifacts(db: Db, userId: string): Promise<void> {
  await db
    .delete(schema.weeklyReflections)
    .where(eq(schema.weeklyReflections.userId, userId));
}

function resolveDeps(deps: MemoryRouteDeps) {
  return {
    db: deps.db ?? getDb,
    getSession: deps.getSession ?? getSessionInfo,
    entitlementOf:
      deps.entitlementOf ??
      ((d: Db, userId: string) => getEntitlement(d, userId)),
    now: deps.now ?? (() => new Date()),
    env:
      deps.env ??
      (process.env as unknown as { MEAL_MEMORY_ENABLED?: string })
  };
}

type ResolvedDeps = ReturnType<typeof resolveDeps>;

/**
 * The one gate order every memory route shares: flag 404 → session 401 →
 * capability 403 (see the module header). Returns the authenticated session on
 * success, or the short-circuit Response to return as-is.
 */
async function gate(
  ctx: ResolvedDeps
): Promise<
  | { ok: true; session: NonNullable<SessionInfo> }
  | { ok: false; response: NextResponse }
> {
  if (!mealMemoryServerEnabled(ctx.env)) {
    return { ok: false, response: notFound() };
  }
  const session = await ctx.getSession();
  if (!session) {
    return { ok: false, response: unauthorized() };
  }
  const entitlement = await ctx.entitlementOf(ctx.db(), session.userId);
  if (!capabilitiesFor(entitlement, ctx.env).mealMemory) {
    return { ok: false, response: forbidden() };
  }
  return { ok: true, session };
}

// Single source for the joined memory + anchoring-check columns, so list, search
// and export never drift. `mapMemoryRow` owner-decrypts the free text (same trust
// boundary as the history read path) into the wire shape.
export const memorySelectColumns = {
  id: schema.mealMemories.id,
  checkId: schema.mealMemories.checkId,
  choiceCiphertext: schema.mealMemories.choiceCiphertext,
  wouldRepeat: schema.mealMemories.wouldRepeat,
  ease: schema.mealMemories.easeReflection,
  noteCiphertext: schema.mealMemories.noteCiphertext,
  favorite: schema.mealMemories.favorite,
  label: schema.mealMemories.label,
  createdAt: schema.mealMemories.createdAt,
  updatedAt: schema.mealMemories.updatedAt,
  foodCiphertext: schema.checks.foodCiphertext,
  risk: schema.checks.risk,
  a1cBand: schema.checks.a1cBand
} as const;

type MemoryRow = {
  id: string;
  checkId: string;
  choiceCiphertext: string | null;
  wouldRepeat: boolean | null;
  ease: (typeof MEMORY_EASE_VALUES)[number] | null;
  noteCiphertext: string | null;
  favorite: boolean;
  label: (typeof MEMORY_LABEL_VALUES)[number] | null;
  createdAt: Date;
  updatedAt: Date;
  foodCiphertext: string;
  risk: string;
  a1cBand: string;
};

export function mapMemoryRow(row: MemoryRow) {
  return {
    id: row.id,
    checkId: row.checkId,
    food: safeDecrypt(row.foodCiphertext),
    risk: row.risk,
    band: row.a1cBand,
    choice: safeDecrypt(row.choiceCiphertext),
    wouldRepeat: row.wouldRepeat,
    ease: row.ease,
    note: safeDecrypt(row.noteCiphertext),
    favorite: row.favorite,
    label: row.label,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

// The memory id is the last path segment of /api/memory/<id>. Returns null for a
// bare /api/memory (no id) so the caller can 404 rather than mis-target a row.
function idFromPath(request: Request): string | null {
  const segments = new URL(request.url).pathname.split("/").filter(Boolean);
  const id = segments[segments.length - 1] ?? "";
  if (!id || id === "memory") {
    return null;
  }
  return id;
}

export function createMemoryUpsertHandler(deps: MemoryRouteDeps = {}) {
  const { db, getSession, entitlementOf, now, env } = resolveDeps(deps);

  return async function POST(request: Request) {
    if (!mealMemoryServerEnabled(env)) {
      return notFound();
    }

    const session = await getSession();
    if (!session) {
      return unauthorized();
    }

    const entitlement = await entitlementOf(db(), session.userId);
    if (!capabilitiesFor(entitlement, env).mealMemory) {
      return forbidden();
    }

    const parsed = MemoryUpsertSchema.safeParse(await readJson(request));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }
    const { checkId, choice, wouldRepeat, ease, note, favorite, label } =
      parsed.data;

    // Ownership: the check must exist and belong to the caller. A missing check
    // is 404; someone else's check is 403 — no cross-user memory, and the
    // distinct codes never let a caller enumerate which ids are real (same
    // boundary as /api/feedback).
    const [check] = await db()
      .select({ userId: schema.checks.userId })
      .from(schema.checks)
      .where(eq(schema.checks.id, checkId));
    if (!check) {
      return notFound();
    }
    if (check.userId !== session.userId) {
      return forbidden();
    }

    const choiceCiphertext = choice ? encryptField(choice) : null;
    const noteCiphertext = note ? encryptField(note) : null;
    const nowTs = now();

    // Latest save replaces the prior one wholesale for this (user, check) —
    // the affordance submits the whole form at once, so an upsert (not a merge)
    // matches what the user did. Edit/delete land in Task 16.
    await db()
      .insert(schema.mealMemories)
      .values({
        userId: session.userId,
        checkId,
        choiceCiphertext,
        wouldRepeat: wouldRepeat ?? null,
        easeReflection: ease ?? null,
        noteCiphertext,
        favorite: favorite ?? false,
        label: label ?? null,
        createdAt: nowTs,
        updatedAt: nowTs
      })
      .onConflictDoUpdate({
        target: [schema.mealMemories.userId, schema.mealMemories.checkId],
        set: {
          choiceCiphertext,
          wouldRepeat: wouldRepeat ?? null,
          easeReflection: ease ?? null,
          noteCiphertext,
          favorite: favorite ?? false,
          label: label ?? null,
          updatedAt: nowTs
        }
      });

    // Upserts change memory content the weekly artifact may have projected —
    // same staleness rule as edit/delete.
    await invalidateWeeklyArtifacts(db(), session.userId);

    return NextResponse.json({ ok: true });
  };
}

export function createMemoryListHandler(deps: MemoryRouteDeps = {}) {
  const { db, getSession, entitlementOf, env } = resolveDeps(deps);

  return async function GET(request: Request) {
    if (!mealMemoryServerEnabled(env)) {
      return notFound();
    }

    const session = await getSession();
    if (!session) {
      return unauthorized();
    }

    const entitlement = await entitlementOf(db(), session.userId);
    if (!capabilitiesFor(entitlement, env).mealMemory) {
      return forbidden();
    }

    const url = new URL(request.url);
    const limit = Math.min(
      Math.max(Number(url.searchParams.get("limit")) || DEFAULT_LIMIT, 1),
      MAX_LIMIT
    );
    const offset = Math.max(Number(url.searchParams.get("offset")) || 0, 0);

    const rows = await db()
      .select({
        id: schema.mealMemories.id,
        checkId: schema.mealMemories.checkId,
        choiceCiphertext: schema.mealMemories.choiceCiphertext,
        wouldRepeat: schema.mealMemories.wouldRepeat,
        ease: schema.mealMemories.easeReflection,
        noteCiphertext: schema.mealMemories.noteCiphertext,
        favorite: schema.mealMemories.favorite,
        label: schema.mealMemories.label,
        createdAt: schema.mealMemories.createdAt,
        updatedAt: schema.mealMemories.updatedAt,
        foodCiphertext: schema.checks.foodCiphertext,
        risk: schema.checks.risk,
        a1cBand: schema.checks.a1cBand
      })
      .from(schema.mealMemories)
      .innerJoin(schema.checks, eq(schema.mealMemories.checkId, schema.checks.id))
      .where(eq(schema.mealMemories.userId, session.userId))
      .orderBy(
        desc(schema.mealMemories.createdAt),
        desc(schema.mealMemories.id)
      )
      .limit(limit)
      .offset(offset);

    const memories = rows.map((row) => ({
      id: row.id,
      checkId: row.checkId,
      // Owner-only decrypt (same trust boundary as the history read path).
      food: safeDecrypt(row.foodCiphertext),
      risk: row.risk,
      choice: safeDecrypt(row.choiceCiphertext),
      wouldRepeat: row.wouldRepeat,
      ease: row.ease,
      note: safeDecrypt(row.noteCiphertext),
      favorite: row.favorite,
      label: row.label,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString()
    }));

    return NextResponse.json({
      memories,
      nextOffset: rows.length === limit ? offset + limit : null
    });
  };
}

/**
 * Recall (plan §P3.3): after a completed check, surface the caller's OWN prior
 * saved memories whose meal text matches the just-checked meal, so the client can
 * render the "Your meal memory" panel below the current card and offer a one-tap
 * re-check.
 *
 * Matching is EXACT normalized-string equality — the same normalizer the input
 * precheck uses (lib/pal/input-precheck.normalize), so "White Rice " recalls a
 * saved "white rice". Deliberately NOT fuzzy or semantic at launch (§P3.3), and
 * NO search index: the newest RECALL_SCAN_LIMIT memories are decrypted and
 * compared in memory. There is no hash of meal text anywhere (global constraint
 * §5). The food rides the POST body, never the URL (§5).
 *
 * READ-ONLY and non-interfering: this never writes, and nothing here (or its
 * result) feeds the check engine (global constraint §1). The client calls it only
 * AFTER a result renders.
 *
 * Gate order is identical to the other memory routes: flag 404 → session 401 →
 * capability 403.
 */
export function createMemoryRecallHandler(deps: MemoryRouteDeps = {}) {
  const { db, getSession, entitlementOf, env } = resolveDeps(deps);

  return async function POST(request: Request) {
    if (!mealMemoryServerEnabled(env)) {
      return notFound();
    }

    const session = await getSession();
    if (!session) {
      return unauthorized();
    }

    const entitlement = await entitlementOf(db(), session.userId);
    if (!capabilitiesFor(entitlement, env).mealMemory) {
      return forbidden();
    }

    const parsed = MemoryRecallSchema.safeParse(await readJson(request));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    const target = normalizeFood(parsed.data.food);

    // Bounded scan: the caller's newest RECALL_SCAN_LIMIT saved memories, joined
    // to the check that anchors each so we can compare its (encrypted) food.
    const rows = await db()
      .select({
        id: schema.mealMemories.id,
        checkId: schema.mealMemories.checkId,
        choiceCiphertext: schema.mealMemories.choiceCiphertext,
        wouldRepeat: schema.mealMemories.wouldRepeat,
        ease: schema.mealMemories.easeReflection,
        noteCiphertext: schema.mealMemories.noteCiphertext,
        favorite: schema.mealMemories.favorite,
        label: schema.mealMemories.label,
        savedAt: schema.mealMemories.createdAt,
        foodCiphertext: schema.checks.foodCiphertext,
        risk: schema.checks.risk,
        a1cBand: schema.checks.a1cBand,
        checkedAt: schema.checks.createdAt
      })
      .from(schema.mealMemories)
      .innerJoin(schema.checks, eq(schema.mealMemories.checkId, schema.checks.id))
      .where(eq(schema.mealMemories.userId, session.userId))
      .orderBy(
        desc(schema.mealMemories.createdAt),
        desc(schema.mealMemories.id)
      )
      .limit(RECALL_SCAN_LIMIT);

    const matches = rows
      .map((row) => {
        const food = safeDecrypt(row.foodCiphertext);
        return { row, food };
      })
      // Exact normalized-string equality only — no substring / fuzzy match. An
      // unreadable (rotated-key) row can never accidentally match a real meal.
      .filter(({ food }) => food !== null && normalizeFood(food) === target)
      .map(({ row, food }) => ({
        id: row.id,
        checkId: row.checkId,
        // Owner-only decrypt — the stored meal text, so the client can pre-fill
        // it into the standard input path for a one-tap re-check.
        food,
        risk: row.risk,
        band: row.a1cBand,
        choice: safeDecrypt(row.choiceCiphertext),
        wouldRepeat: row.wouldRepeat,
        ease: row.ease,
        note: safeDecrypt(row.noteCiphertext),
        favorite: row.favorite,
        label: row.label,
        savedAt: row.savedAt.toISOString(),
        checkedAt: row.checkedAt.toISOString()
      }));

    return NextResponse.json({ matches });
  };
}

/**
 * Search (plan §P3.4): filter the caller's OWN memories by a meal-text term. The
 * term is health data — it travels in the POST body, NEVER a URL (T9 reviewer
 * finding, global constraint §5). We decrypt-and-scan the newest
 * MEMORY_SEARCH_SCAN_CAP rows and match the needle against the decrypted meal text
 * AND the user's own choice/note words, reporting searchScanned/searchCapped so
 * the bound is honest (same shape as history search). Read-only; nothing here
 * feeds the check engine (global constraint §1). Gate: flag 404 → 401 → 403.
 */
export function createMemorySearchHandler(deps: MemoryRouteDeps = {}) {
  const ctx = resolveDeps(deps);

  return async function POST(request: Request) {
    const g = await gate(ctx);
    if (!g.ok) {
      return g.response;
    }

    const parsed = MemorySearchSchema.safeParse(await readJson(request));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }
    const needle = parsed.data.q.toLowerCase();

    try {
      const rows = await ctx
        .db()
        .select(memorySelectColumns)
        .from(schema.mealMemories)
        .innerJoin(
          schema.checks,
          eq(schema.mealMemories.checkId, schema.checks.id)
        )
        .where(eq(schema.mealMemories.userId, g.session.userId))
        .orderBy(
          desc(schema.mealMemories.createdAt),
          desc(schema.mealMemories.id)
        )
        .limit(MEMORY_SEARCH_SCAN_CAP);

      const memories = rows
        .map((row) => mapMemoryRow(row))
        // Match the user's own words: meal text OR their choice/note. Every field
        // is already owner-decrypted; an unreadable (rotated-key) field is a
        // placeholder string and simply won't match a real term.
        .filter((m) =>
          [m.food, m.choice, m.note].some(
            (value) => value !== null && value.toLowerCase().includes(needle)
          )
        );

      return NextResponse.json({
        memories,
        searchScanned: rows.length,
        searchCapped: rows.length === MEMORY_SEARCH_SCAN_CAP
      });
    } catch (error) {
      return serverError(error);
    }
  };
}

/**
 * Edit (plan §P3.4): field-level merge of the caller's OWN user-authored fields.
 * The whitelist IS the zod schema (`.strict()`) — a snapshot/check field
 * (checkId/risk/food/band) is a 400, never a silent no-op. Absent field → left
 * as-is; a nullable field sent as `null` → cleared; free text is re-encrypted at
 * rest. Ownership is enforced in the UPDATE ... WHERE id AND userId, so a foreign
 * or missing id matches nothing → 404. Gate: flag 404 → 401 → 403.
 */
export function createMemoryEditHandler(deps: MemoryRouteDeps = {}) {
  const ctx = resolveDeps(deps);

  return async function PATCH(request: Request) {
    const g = await gate(ctx);
    if (!g.ok) {
      return g.response;
    }

    const id = idFromPath(request);
    if (!id) {
      return notFound();
    }

    const parsed = MemoryEditSchema.safeParse(await readJson(request));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }
    const patch = parsed.data;

    // Build the SET from ONLY the keys actually present. `undefined` = untouched;
    // `null` (for a nullable field) = clear; a value = set. Free text is encrypted.
    const set: Record<string, unknown> = { updatedAt: ctx.now() };
    if (patch.choice !== undefined) {
      set.choiceCiphertext = patch.choice ? encryptField(patch.choice) : null;
    }
    if (patch.note !== undefined) {
      set.noteCiphertext = patch.note ? encryptField(patch.note) : null;
    }
    if (patch.wouldRepeat !== undefined) {
      set.wouldRepeat = patch.wouldRepeat;
    }
    if (patch.ease !== undefined) {
      set.easeReflection = patch.ease;
    }
    if (patch.favorite !== undefined) {
      set.favorite = patch.favorite;
    }
    if (patch.label !== undefined) {
      set.label = patch.label;
    }

    try {
      const updated = await ctx
        .db()
        .update(schema.mealMemories)
        .set(set)
        .where(
          and(
            eq(schema.mealMemories.id, id),
            eq(schema.mealMemories.userId, g.session.userId)
          )
        )
        .returning({ id: schema.mealMemories.id });

      if (updated.length === 0) {
        return notFound();
      }
      await invalidateWeeklyArtifacts(ctx.db(), g.session.userId);
      return NextResponse.json({ ok: true });
    } catch (error) {
      return serverError(error);
    }
  };
}

/**
 * Delete one (plan §P3.4): owner-scoped hard delete by id. The WHERE pins the row
 * to the caller's userId, so a foreign id matches nothing → 404 (no cross-user
 * delete, no id enumeration). Deleting the memory NEVER deletes its anchoring
 * check — the FK points memory → check, not the reverse. Gate: flag 404 → 401 → 403.
 */
export function createMemoryDeleteHandler(deps: MemoryRouteDeps = {}) {
  const ctx = resolveDeps(deps);

  return async function DELETE(request: Request) {
    const g = await gate(ctx);
    if (!g.ok) {
      return g.response;
    }

    const id = idFromPath(request);
    if (!id) {
      return notFound();
    }

    try {
      const deleted = await ctx
        .db()
        .delete(schema.mealMemories)
        .where(
          and(
            eq(schema.mealMemories.id, id),
            eq(schema.mealMemories.userId, g.session.userId)
          )
        )
        .returning({ id: schema.mealMemories.id });

      if (deleted.length === 0) {
        return notFound();
      }
      await invalidateWeeklyArtifacts(ctx.db(), g.session.userId);
      return NextResponse.json({ ok: true });
    } catch (error) {
      return serverError(error);
    }
  };
}

/**
 * Delete ALL (plan §P3.4): wipe every memory the caller owns. Owner-scoped (WHERE
 * userId), and guarded by an explicit `{ confirm: true }` body so a bare/mis-fired
 * DELETE can never wipe a whole memory — the UI does the calm two-step confirm on
 * top. Checks are untouched. Gate: flag 404 → 401 → 403.
 */
export function createMemoryDeleteAllHandler(deps: MemoryRouteDeps = {}) {
  const ctx = resolveDeps(deps);

  return async function DELETE(request: Request) {
    const g = await gate(ctx);
    if (!g.ok) {
      return g.response;
    }

    const parsed = MemoryDeleteAllSchema.safeParse(await readJson(request));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Confirm required." },
        { status: 400 }
      );
    }

    try {
      const deleted = await ctx
        .db()
        .delete(schema.mealMemories)
        .where(eq(schema.mealMemories.userId, g.session.userId))
        .returning({ id: schema.mealMemories.id });

      await invalidateWeeklyArtifacts(ctx.db(), g.session.userId);
      return NextResponse.json({ ok: true, deleted: deleted.length });
    } catch (error) {
      return serverError(error);
    }
  };
}

/**
 * Data-rights export (plan §P3.4): ALL of the caller's memories with their own
 * decrypted fields + the anchoring check's food/band/risk/date, as a JSON
 * attachment. This is what a person can get back about themselves, so unlike
 * every OTHER memory route it does NOT gate on the feature flag or the premium
 * capability (E3) — a data-rights export must not disappear because a flag was
 * toggled off or a subscription lapsed (history export sets the precedent, and
 * `capabilities.ts` marks export as always-on). The ONLY gate is the session:
 * an unauthenticated caller is 401, and the query is owner-scoped so it can only
 * ever return the caller's own rows. Owner-only decrypt (same trust boundary as
 * the read path).
 */
export function createMemoryExportHandler(deps: MemoryRouteDeps = {}) {
  const ctx = resolveDeps(deps);

  return async function GET(_request: Request) {
    const session = await ctx.getSession();
    if (!session) {
      return unauthorized();
    }

    try {
      const rows = await ctx
        .db()
        .select(memorySelectColumns)
        .from(schema.mealMemories)
        .innerJoin(
          schema.checks,
          eq(schema.mealMemories.checkId, schema.checks.id)
        )
        .where(eq(schema.mealMemories.userId, session.userId))
        .orderBy(
          desc(schema.mealMemories.createdAt),
          desc(schema.mealMemories.id)
        );

      const memories = rows.map((row) => mapMemoryRow(row));
      const today = new Date().toISOString().slice(0, 10);

      return new NextResponse(
        JSON.stringify(
          {
            exportedAt: new Date().toISOString(),
            count: memories.length,
            memories
          },
          null,
          2
        ),
        {
          status: 200,
          headers: {
            "content-type": "application/json; charset=utf-8",
            "content-disposition": `attachment; filename="prediabetes-pal-meal-memory-${today}.json"`
          }
        }
      );
    } catch (error) {
      return serverError(error);
    }
  };
}
