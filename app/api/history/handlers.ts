import { and, desc, eq, gte, lt, or, type SQL } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import type { A1CBand } from "../../../lib/pal/a1c";
import { FREE_HISTORY_DAYS } from "../../../lib/free-tier";
import {
  decryptField,
  encryptField,
  safeDecrypt
} from "../../../lib/server/crypto";
import { getDb, schema, type Db } from "../../../lib/server/db";
import { getEntitlement, type Entitlement } from "../../../lib/server/entitlement";
import {
  getSessionInfo,
  type SessionInfo
} from "../../../lib/server/session";

/**
 * Server history (plan 4B). Food text is stored encrypted and decrypted only
 * here, for the authenticated owner. Coarse fields stay plaintext.
 */

export type RouteDeps = {
  db?: () => Db;
  getSession?: () => Promise<SessionInfo>;
  entitlementOf?: (db: Db, userId: string) => Promise<Entitlement>;
};

const DEFAULT_LIMIT = 50;
// Legacy ceiling. loadHistory(days) (daily-loop, dashboard-insight) still asks
// for limit=200 and filters client-side; lowering this would silently truncate
// the 35-day insight window for heavy users, so the server ceiling stays 200.
// The new paginated UI (fetchHistoryPage) requests a small page (<=50); that is
// a client-side page size, not a server cap.
const MAX_LIMIT = 200;
const MAX_MIGRATE_BATCH = 500;
// Free tier keeps the recent week (guest parity); the full archive is premium
// (plan 4D: premium = history + progress + nudge). This is a VIEW rule, not a
// storage rule — the export path (data rights) ignores it. FREE_HISTORY_DAYS is
// the single source (lib/free-tier.ts): the capability matrix imports the same
// constant so the enforced window and the promised window can never fork.

// Search happens over DECRYPTED food text (encrypted at rest — no SQL LIKE, and
// plan §P3.3 forbids a plaintext index or unsalted hash). So we decrypt-and-scan
// the caller's most-recent rows up to this hard cap, and tell the client exactly
// how many rows we looked at (searchScanned) and whether we hit the ceiling
// (searchCapped) — honest bounds, never a silent partial result.
const SEARCH_SCAN_CAP = 1000;

/**
 * Retention rules, server-authoritative and surfaced in the GET response meta so
 * the history UI renders truth from server data (plan §6.6: UI renders from the
 * server capability response, never UI-only gating). `window` = the free 7-day
 * visible slice; `full` = the whole retained archive (premium).
 */
export const HISTORY_RETENTION = {
  free: { scope: "window", windowDays: FREE_HISTORY_DAYS },
  premium: { scope: "full", windowDays: null }
} as const;

/**
 * N-27 — history-migrate imports rows the CLIENT authored. `createdAt`, `risk`
 * and `a1cBand` all come out of localStorage, which the owner can edit freely,
 * and the server used to store whatever arrived. The blast radius is self-only
 * (every row is stamped with the caller's own userId), but a forged timeline
 * still corrupts the streak and BAI series the coach reasons over — and those
 * are numbers we hand back to the user as if we had observed them.
 *
 * So bound the timeline server-side: nothing from the future beyond ordinary
 * client-clock skew, and nothing older than the guest history could plausibly
 * be. `risk` and `a1cBand` are separately constrained to their real enums (the
 * a1cBand values the app actually writes), so a hand-edited band can no longer
 * enter the DB at all.
 */
const MIGRATE_MAX_SKEW_MS = 5 * 60 * 1000;
const MIGRATE_MAX_AGE_MS = 2 * 365 * 24 * 60 * 60 * 1000;

// The bands the app itself writes (lib/pal/a1c.ts is the source of truth —
// `checks.a1c_band` is untyped text, so this schema is the only thing standing
// between a hand-edited localStorage entry and the DB). Both directions are
// asserted at compile time: `satisfies` rejects a value that is not a band, and
// the Exclude check fails the build if a NEW band is added upstream and not
// listed here — which would otherwise reject a legitimate migration silently.
const A1C_BANDS = [
  "below_prediabetes_range",
  "prediabetes_57_59",
  "prediabetes_60_62",
  "prediabetes_63_64",
  "diabetes_range_out_of_scope"
] as const satisfies readonly A1CBand[];

type UncoveredBand = Exclude<A1CBand, (typeof A1C_BANDS)[number]>;
const _allBandsCovered: UncoveredBand extends never ? true : never = true;
void _allBandsCovered;

function boundedTimestamp() {
  return z.iso.datetime().refine(
    (value) => {
      const at = new Date(value).getTime();
      const now = Date.now();
      return (
        at <= now + MIGRATE_MAX_SKEW_MS && at >= now - MIGRATE_MAX_AGE_MS
      );
    },
    { message: "Timestamp outside the acceptable range." }
  );
}

const StoredCheckSchema = z
  .object({
    clientId: z.string().trim().min(1).max(64),
    food: z.string().trim().min(1).max(160),
    risk: z.enum(["SAFE", "MODERATE", "HIGH"]),
    a1cBand: z.enum(A1C_BANDS),
    inputMethod: z.enum(["text", "voice", "photo"]),
    createdAt: boundedTimestamp(),
    actionDoneAt: boundedTimestamp().optional()
  })
  .strict();

const MigrateRequestSchema = z
  .object({
    checks: z.array(StoredCheckSchema).min(1).max(MAX_MIGRATE_BATCH)
  })
  .strict();

const ActionRequestSchema = z
  .object({ clientId: z.string().trim().min(1).max(64) })
  .strict();

function unauthorized() {
  return NextResponse.json({ error: "Sign in first." }, { status: 401 });
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

/**
 * Keyset cursor = opaque base64url of the (createdAt, id) of the last row on the
 * previous page. `createdAt` alone is not unique (two checks can share a
 * millisecond), so the id is the stable tiebreaker — without it a keyset on
 * timestamp alone would skip or duplicate rows at a boundary. Opaque so the
 * shape can change (Task 13 snapshot columns) without a client contract break.
 */
function encodeCursor(createdAt: Date, id: string): string {
  return Buffer.from(
    JSON.stringify({ t: createdAt.toISOString(), id })
  ).toString("base64url");
}

function decodeCursor(raw: string): { t: Date; id: string } | null {
  try {
    const parsed: unknown = JSON.parse(
      Buffer.from(raw, "base64url").toString("utf8")
    );
    if (
      !parsed ||
      typeof parsed !== "object" ||
      typeof (parsed as { t?: unknown }).t !== "string" ||
      typeof (parsed as { id?: unknown }).id !== "string"
    ) {
      return null;
    }
    const t = new Date((parsed as { t: string }).t);
    if (Number.isNaN(t.getTime())) {
      return null;
    }
    return { t, id: (parsed as { id: string }).id };
  } catch {
    return null;
  }
}

// A YYYY-MM-DD date filter is interpreted as UTC calendar days (timezone-naive:
// filter on createdAt UTC). `from` is inclusive at 00:00:00Z; `to` is inclusive
// of the whole day, expressed as an exclusive upper bound at the next midnight.
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function parseFromDate(value: string | null): Date | null {
  if (!value || !DATE_ONLY.test(value)) {
    return null;
  }
  const d = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseToExclusive(value: string | null): Date | null {
  if (!value || !DATE_ONLY.test(value)) {
    return null;
  }
  const d = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) {
    return null;
  }
  d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

type Retention = (typeof HISTORY_RETENTION)[keyof typeof HISTORY_RETENTION];

function retentionFor(entitlement: Entitlement): Retention {
  return entitlement.tier === "premium"
    ? HISTORY_RETENTION.premium
    : HISTORY_RETENTION.free;
}

/**
 * Owner + free-tier VIEW window + optional date filter. Shared by the paginated
 * read (GET) and the search (POST) so both honor the same retention and date
 * bounds — search must never leak rows outside the caller's visible window.
 */
function buildBaseConditions(
  userId: string,
  retention: Retention,
  fromDate: Date | null,
  toExclusive: Date | null
): SQL[] {
  const conditions: SQL[] = [eq(schema.checks.userId, userId)];
  if (retention.windowDays !== null) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - (retention.windowDays - 1));
    cutoff.setHours(0, 0, 0, 0);
    conditions.push(gte(schema.checks.createdAt, cutoff));
  }
  if (fromDate) {
    conditions.push(gte(schema.checks.createdAt, fromDate));
  }
  if (toExclusive) {
    conditions.push(lt(schema.checks.createdAt, toExclusive));
  }
  return conditions;
}

export function createHistoryGetHandler(deps: RouteDeps = {}) {
  const db = deps.db ?? getDb;
  const getSession = deps.getSession ?? getSessionInfo;
  const entitlementOf =
    deps.entitlementOf ?? ((d: Db, userId: string) => getEntitlement(d, userId));

  return async function GET(request: Request) {
    const session = await getSession();
    if (!session) {
      return unauthorized();
    }

    const url = new URL(request.url);
    const limit = Math.min(
      Math.max(Number(url.searchParams.get("limit")) || DEFAULT_LIMIT, 1),
      MAX_LIMIT
    );

    // NOTE: this GET carries NO `q`. Meal text is health data and plan §16
    // forbids it in URLs/logs — search is POST-only (createHistorySearchHandler).
    // cursor/from/to are not health text and may stay on the query string.
    const entitlement = await entitlementOf(db(), session.userId);
    const retention = retentionFor(entitlement);
    const conditions = buildBaseConditions(
      session.userId,
      retention,
      parseFromDate(url.searchParams.get("from")),
      parseToExclusive(url.searchParams.get("to"))
    );

    // Keyset pagination: (createdAt, id) DESC. The cursor is the last row of the
    // previous page; the next page is everything strictly older than it. Legacy
    // `before` (timestamp-only) still works for older callers.
    const cursorParam = url.searchParams.get("cursor");
    const cursor = cursorParam ? decodeCursor(cursorParam) : null;
    if (cursor) {
      conditions.push(keysetOlderThan(cursor));
    } else {
      const beforeParam = url.searchParams.get("before");
      const before = beforeParam ? new Date(beforeParam) : null;
      if (before && !Number.isNaN(before.getTime())) {
        conditions.push(lt(schema.checks.createdAt, before));
      }
    }

    const rows = await db()
      .select()
      .from(schema.checks)
      .where(and(...conditions))
      .orderBy(desc(schema.checks.createdAt), desc(schema.checks.id))
      .limit(limit);

    const checks = rows.map((row) =>
      toResponseCheck(row, safeDecrypt(row.foodCiphertext))
    );
    const last = rows.length === limit ? rows[rows.length - 1] : null;

    return NextResponse.json({
      checks,
      nextCursor: last ? encodeCursor(last.createdAt, last.id) : null,
      // Kept for backward compatibility with any timestamp-only caller.
      nextBefore: last ? last.createdAt.toISOString() : null,
      meta: { tier: entitlement.tier, retention }
    });
  };
}

function keysetOlderThan(cursor: { t: Date; id: string }): SQL {
  return or(
    lt(schema.checks.createdAt, cursor.t),
    and(eq(schema.checks.createdAt, cursor.t), lt(schema.checks.id, cursor.id))
  ) as SQL;
}

const SearchRequestSchema = z
  .object({
    // Meal text — carried in the POST body, never the URL (plan §16).
    q: z.string().trim().min(1).max(160),
    from: z.string().optional(),
    to: z.string().optional(),
    // Accepted for forward-compatibility; search is a single bounded scan today
    // (nextCursor is always null), so these do not paginate the result.
    cursor: z.string().optional(),
    limit: z.number().int().positive().optional()
  })
  .strict();

/**
 * Search over DECRYPTED food text. Food is encrypted at rest, so there is no SQL
 * LIKE and (plan §P3.3) no plaintext index / unsalted hash. The query term is
 * health data, so it travels in the POST body — never a query string (plan §16,
 * no health text in URLs/logs). We decrypt-and-scan the caller's most-recent
 * rows (within their retention window + any date filter) up to a hard cap and
 * match in memory, reporting searchScanned/searchCapped so the bound is honest.
 */
export function createHistorySearchHandler(deps: RouteDeps = {}) {
  const db = deps.db ?? getDb;
  const getSession = deps.getSession ?? getSessionInfo;
  const entitlementOf =
    deps.entitlementOf ?? ((d: Db, userId: string) => getEntitlement(d, userId));

  return async function POST(request: Request) {
    const session = await getSession();
    if (!session) {
      return unauthorized();
    }

    const parsed = SearchRequestSchema.safeParse(await readJson(request));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid search request." },
        { status: 400 }
      );
    }

    const entitlement = await entitlementOf(db(), session.userId);
    const retention = retentionFor(entitlement);
    const conditions = buildBaseConditions(
      session.userId,
      retention,
      parseFromDate(parsed.data.from ?? null),
      parseToExclusive(parsed.data.to ?? null)
    );

    const scanRows = await db()
      .select()
      .from(schema.checks)
      .where(and(...conditions))
      .orderBy(desc(schema.checks.createdAt), desc(schema.checks.id))
      .limit(SEARCH_SCAN_CAP);

    const needle = parsed.data.q.toLowerCase();
    const matches = scanRows
      .map((row) => ({ row, food: safeDecrypt(row.foodCiphertext) }))
      .filter((entry) => entry.food.toLowerCase().includes(needle));

    return NextResponse.json({
      checks: matches.map(({ row, food }) => toResponseCheck(row, food)),
      nextCursor: null,
      nextBefore: null,
      searchScanned: scanRows.length,
      searchCapped: scanRows.length === SEARCH_SCAN_CAP,
      meta: { tier: entitlement.tier, retention }
    });
  };
}

type CheckRow = typeof schema.checks.$inferSelect;

/**
 * The decrypted immutable card (§P3.1) — the exact verdict + coach copy the user
 * saw at check time. Typed export so Task 15's recall panel renders a stored
 * card from a single trusted shape instead of re-deriving one. Every field is
 * nullable: the whole object is null for rows written before Task 13, and coach
 * fields are null for SAFE cards.
 */
export const RecalledCardSchema = z
  .object({
    risk: z.enum(["SAFE", "MODERATE", "HIGH"]),
    reason: z.string(),
    adjustment: z.string().nullable(),
    swap: z.string().nullable(),
    sequencingTip: z.string().nullable(),
    postMealAction: z.string().nullable(),
    keepMost: z.string().nullable()
  })
  .strict();

export type RecalledCard = z.infer<typeof RecalledCardSchema>;

/**
 * Decode the encrypted card blob to the typed card, or null. Fail-soft like the
 * food read path: an unreadable (rotated-key) or malformed blob degrades to null
 * — a recalled card that cannot be shown, never an error that takes the whole
 * history list down.
 */
function decodeCard(ciphertext: string | null): RecalledCard | null {
  if (!ciphertext) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(decryptField(ciphertext));
    const card = RecalledCardSchema.safeParse(parsed);
    return card.success ? card.data : null;
  } catch {
    return null;
  }
}

export function toResponseCheck(row: CheckRow, food: string) {
  return {
    id: row.id,
    clientId: row.clientId ?? row.id,
    food,
    risk: row.risk,
    a1cBand: row.a1cBand,
    inputMethod: row.inputMethod,
    actionDoneAt: row.actionDoneAt?.toISOString(),
    createdAt: row.createdAt.toISOString(),
    // §P3.1 snapshot fields — additive, and null for pre-Task-13 rows so old
    // callers and old data both keep working unchanged.
    card: decodeCard(row.cardCiphertext),
    routeType: row.routeType ?? null,
    wasClarified: row.wasClarified,
    clarifyQuestion: row.clarifyQuestionCiphertext
      ? safeDecrypt(row.clarifyQuestionCiphertext)
      : null,
    promptVersion: row.promptVersion ?? null,
    contractVersion: row.contractVersion ?? null,
    modelId: row.modelId ?? null,
    floorApplied: row.floorApplied ?? null,
    usedFallback: row.usedFallback
  };
}

export function createHistoryMigrateHandler(deps: RouteDeps = {}) {
  const db = deps.db ?? getDb;
  const getSession = deps.getSession ?? getSessionInfo;

  return async function POST(request: Request) {
    const session = await getSession();
    if (!session) {
      return unauthorized();
    }

    const parsed = MigrateRequestSchema.safeParse(await readJson(request));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid migration payload." },
        { status: 400 }
      );
    }

    const inserted = await db()
      .insert(schema.checks)
      .values(
        parsed.data.checks.map((check) => ({
          userId: session.userId,
          foodCiphertext: encryptField(check.food),
          risk: check.risk,
          a1cBand: check.a1cBand,
          inputMethod: check.inputMethod,
          clientId: check.clientId,
          createdAt: new Date(check.createdAt),
          actionDoneAt: check.actionDoneAt
            ? new Date(check.actionDoneAt)
            : null
        }))
      )
      .onConflictDoNothing()
      .returning({ id: schema.checks.id });

    return NextResponse.json({ imported: inserted.length });
  };
}

export function createHistoryActionHandler(deps: RouteDeps = {}) {
  const db = deps.db ?? getDb;
  const getSession = deps.getSession ?? getSessionInfo;

  return async function POST(request: Request) {
    const session = await getSession();
    if (!session) {
      return unauthorized();
    }

    const parsed = ActionRequestSchema.safeParse(await readJson(request));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    // APPEND-ONLY BOUNDARY (§12 / Task 13): `actionDoneAt` is user-activity
    // metadata, not snapshot content — it is the ONE field a stored check may
    // change after insert. This `.set` must never touch a snapshot column
    // (card/risk/reason/versions/floor/clarify*); a rerun creates a new row
    // instead of overwriting an old card. Guarded by check-snapshot.test.ts.
    await db()
      .update(schema.checks)
      .set({ actionDoneAt: new Date() })
      .where(
        and(
          eq(schema.checks.userId, session.userId),
          eq(schema.checks.clientId, parsed.data.clientId)
        )
      );

    return NextResponse.json({ ok: true });
  };
}

/**
 * Per-check hard delete. Owner-scoped: the WHERE clause pins the row to the
 * caller's userId, so user A can never delete user B's row (a foreign id simply
 * matches nothing → 404). check_feedback FKs into checks with ON DELETE CASCADE,
 * so any linked feedback goes with the row. This is the ONLY mutation of an old
 * check — there is no update path; a rerun always creates a new row (§12
 * immutable snapshots).
 */
export function createHistoryDeleteHandler(deps: RouteDeps = {}) {
  const db = deps.db ?? getDb;
  const getSession = deps.getSession ?? getSessionInfo;

  return async function DELETE(request: Request) {
    const session = await getSession();
    if (!session) {
      return unauthorized();
    }

    // Testable without Next's params plumbing: the id is the last path segment
    // of /api/history/<id>.
    const segments = new URL(request.url).pathname.split("/").filter(Boolean);
    const id = segments[segments.length - 1] ?? "";
    if (!id || id === "history") {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const deleted = await db()
      .delete(schema.checks)
      .where(
        and(
          eq(schema.checks.userId, session.userId),
          eq(schema.checks.id, id)
        )
      )
      .returning({ id: schema.checks.id });

    if (deleted.length === 0) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    // E4: a persisted weekly learning artifact embeds this check's meal text
    // (repeatedUncertainty). Deleting the source check must not leave the food
    // living on inside a cached artifact, so drop the caller's weekly_reflections
    // rows — the next weekly GET regenerates them lazily from current sources.
    // Deleting all of the caller's rows is cheap (≤4 completed weeks) and avoids
    // recomputing which week the deleted check fell in.
    await db()
      .delete(schema.weeklyReflections)
      .where(eq(schema.weeklyReflections.userId, session.userId));

    return NextResponse.json({ ok: true });
  };
}

/**
 * Data-rights export. Returns ALL of the caller's retained checks regardless of
 * tier — the 7-day free rule is a VIEW rule, not a storage rule, so it must NOT
 * gate what a person can get back about themselves. Food is decrypted here for
 * the owner only (same trust boundary as the read path). Delivered as a JSON
 * attachment.
 */
export function createHistoryExportHandler(deps: RouteDeps = {}) {
  const db = deps.db ?? getDb;
  const getSession = deps.getSession ?? getSessionInfo;

  return async function GET() {
    const session = await getSession();
    if (!session) {
      return unauthorized();
    }

    const rows = await db()
      .select()
      .from(schema.checks)
      .where(eq(schema.checks.userId, session.userId))
      .orderBy(desc(schema.checks.createdAt), desc(schema.checks.id));

    const checks = rows.map((row) =>
      toResponseCheck(row, safeDecrypt(row.foodCiphertext))
    );

    const today = new Date().toISOString().slice(0, 10);
    return new NextResponse(
      JSON.stringify(
        { exportedAt: new Date().toISOString(), count: checks.length, checks },
        null,
        2
      ),
      {
        status: 200,
        headers: {
          "content-type": "application/json; charset=utf-8",
          "content-disposition": `attachment; filename="prediabetes-pal-history-${today}.json"`
        }
      }
    );
  };
}

// safeDecrypt is imported from lib/server/crypto: a rotated-key row degrades to
// a placeholder quietly, but a failing auth tag (corruption or tampering) is
// reported to Sentry. The old inline copy here conflated the two and swallowed
// tamper silently on the highest-traffic health-data read path (PR-3).
