import { and, eq, isNull, lte, or, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import {
  EMPTY_ORIENTATION,
  OrientationStateSchema
} from "../../../lib/coach/orientation";
import { guideDoorEnabled } from "../../../lib/guide-door-flag";
import { routeA1C } from "../../../lib/pal/a1c";
// Approved boundary copy — single-sourced (SAFETY-OWNED). Out-of-range A1C gets
// guidance, never a verdict, at profile creation exactly as at check time.
import {
  BELOW_RANGE_MESSAGE,
  HIGH_RANGE_MESSAGE
} from "../../../lib/pal/boundary-copy";
import { encryptField } from "../../../lib/server/crypto";
import { getDb, schema, type Db } from "../../../lib/server/db";
import {
  getSessionInfo,
  type SessionInfo
} from "../../../lib/server/session";

export const runtime = "nodejs";

const ProfileRequestSchema = z
  .object({
    a1c: z.number().finite().gte(0).lte(20),
    consent: z.boolean(),
    timezone: z.string().trim().min(1).max(64)
  })
  .strict();

type ProfileRouteDeps = {
  db?: () => Db;
  getSession?: () => Promise<SessionInfo>;
};

export function createProfileRouteHandlers(deps: ProfileRouteDeps = {}) {
  const db = deps.db ?? getDb;
  const getSession = deps.getSession ?? getSessionInfo;

  return {
    async GET() {
      const session = await getSession();
      if (!session) {
        return NextResponse.json({ error: "Sign in first." }, { status: 401 });
      }

      const [profile] = await db()
        .select({
          a1cBand: schema.profiles.a1cBand,
          timezone: schema.profiles.timezone,
          nudgeOptIn: schema.profiles.nudgeOptIn,
          nudgeHour: schema.profiles.nudgeHour,
          nudgeCadence: schema.profiles.nudgeCadence,
          nudgeQuietStart: schema.profiles.nudgeQuietStart,
          nudgeQuietEnd: schema.profiles.nudgeQuietEnd,
          // Ruling F-18 (revised): flag off, the response carries no
          // orientation key at all and the query never names the column.
          ...(guideDoorEnabled("orient")
            ? { orientation: schema.profiles.orientation }
            : {})
        })
        .from(schema.profiles)
        .where(eq(schema.profiles.userId, session.userId));

      if (!profile) {
        return NextResponse.json({ hasProfile: false });
      }

      return NextResponse.json({ hasProfile: true, ...profile });
    },

    async POST(request: Request) {
      const session = await getSession();
      if (!session) {
        return NextResponse.json({ error: "Sign in first." }, { status: 401 });
      }

      let body: unknown = null;
      try {
        body = await request.json();
      } catch {
        body = null;
      }

      const parsed = ProfileRequestSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: "Enter your latest A1C with one decimal, like 6.1." },
          { status: 400 }
        );
      }

      if (!parsed.data.consent) {
        // GDPR Art. 9: explicit consent is the lawful basis for storing
        // health data — no consent, no profile, no storage.
        return NextResponse.json(
          {
            error:
              "Saving A1C and meal history needs your explicit health-data consent."
          },
          { status: 400 }
        );
      }

      const route = routeA1C(parsed.data.a1c);
      if (route.kind === "out_of_scope") {
        return NextResponse.json(
          {
            error:
              route.band === "below_prediabetes_range"
                ? BELOW_RANGE_MESSAGE
                : HIGH_RANGE_MESSAGE
          },
          { status: 400 }
        );
      }

      const now = new Date();
      await db()
        .insert(schema.profiles)
        .values({
          userId: session.userId,
          a1cCiphertext: encryptField(parsed.data.a1c.toFixed(1)),
          a1cBand: route.band,
          timezone: parsed.data.timezone,
          consentedAt: now,
          onboardedAt: now
        })
        .onConflictDoUpdate({
          target: schema.profiles.userId,
          set: {
            a1cCiphertext: encryptField(parsed.data.a1c.toFixed(1)),
            a1cBand: route.band,
            timezone: parsed.data.timezone,
            consentedAt: now
          }
        });

      return NextResponse.json({ ok: true, a1cBand: route.band });
    }
  };
}

// Review A-103: a `set` crosses the trust boundary from an untrusted body into
// the jsonb column, so it is held to more than the stored shape — unique ids,
// stamps of bounded length (z.iso.datetime() allows any number of fractional
// digits; toISOString() and the server stamp are 24 characters) and a start no
// later than now plus five minutes of clock skew.
const START_SKEW_MS = 5 * 60 * 1000;
const MAX_STAMP_LENGTH = 30;
const OrientationSetStateSchema = OrientationStateSchema.refine(
  (state) => new Set(state.done).size === state.done.length
).refine((state) =>
  [state.startedAt, state.dismissedAt].every(
    (stamp) => stamp === null || stamp.length <= MAX_STAMP_LENGTH
  )
).refine(
  (state) =>
    state.startedAt === null ||
    Date.parse(state.startedAt) <= Date.now() + START_SKEW_MS
);

// Op-based so the four writers (the Done toggle, the start stamp,
// recordStepEvent, the sign-in migration) never overwrite each other: every op
// but `set` is merged in SQL against the row's current value.
const OrientationOpSchema = z.discriminatedUnion("op", [
  z
    .object({
      op: z.literal("markDone"),
      step: OrientationStateSchema.shape.done.element
    })
    .strict(),
  // Review A-84 (recordStepEvent): the steps an event can complete, earliest
  // first. Non-empty, known ids, each once.
  z
    .object({
      op: z.literal("markNext"),
      steps: OrientationStateSchema.shape.done
        .min(1)
        .refine((steps) => new Set(steps).size === steps.length)
    })
    .strict(),
  z.object({ op: z.literal("start") }).strict(),
  z.object({ op: z.literal("dismiss") }).strict(),
  z.object({ op: z.literal("restore") }).strict(),
  z
    .object({ op: z.literal("set"), state: OrientationSetStateSchema })
    .strict()
]);

type OrientationOp = z.infer<typeof OrientationOpSchema>;

const ProfilePatchSchema = z
  .object({
    nudgeHour: z.number().int().min(0).max(23).optional(),
    nudgeOptIn: z.boolean().optional(),
    // Personal journey nudges (Task 19 / §P4.3): cadence + optional quiet-hours
    // window. Quiet hours are nullable (send null to clear the window).
    nudgeCadence: z.enum(["daily", "few_per_week", "weekly"]).optional(),
    nudgeQuietStart: z.number().int().min(0).max(23).nullable().optional(),
    nudgeQuietEnd: z.number().int().min(0).max(23).nullable().optional(),
    orientation: OrientationOpSchema.optional()
  })
  .strict();

// The server clock as a jsonb string in the exact form z.iso.datetime()
// accepts (UTC, "Z", milliseconds). to_jsonb(now()) would carry "+00:00" and
// the stored state would then fail the schema on every read.
const NOW_ISO = sql`to_jsonb(to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))`;

/**
 * The new column value for one op, evaluated inside the UPDATE against the
 * row's current jsonb, so the read and the write are one statement. Under
 * Postgres READ COMMITTED a concurrent UPDATE of the same row waits for the
 * first to commit, then re-evaluates this expression on the committed value.
 * JSON null is not SQL NULL, hence NULLIF before COALESCE on startedAt.
 */
function orientationValue(op: OrientationOp) {
  if (op.op === "set") return op.state;
  const current = sql`COALESCE(${schema.profiles.orientation}, ${JSON.stringify(EMPTY_ORIENTATION)}::jsonb)`;
  switch (op.op) {
    case "markDone": {
      const done = sql`(${current} -> 'done')`;
      const step = sql`jsonb_build_array(${op.step}::text)`;
      return sql`jsonb_set(${current}, '{done}', CASE WHEN ${done} @> ${step} THEN ${done} ELSE ${done} || ${step} END)`;
    }
    case "markNext": {
      // Review A-84: append the first listed step not yet done, and only to a
      // week that has started and is not hidden. Otherwise the column is
      // written back as it was — the raw column, never `current`, so a null
      // copy stays null and the sign-in `set` can still land.
      const column = schema.profiles.orientation;
      const done = sql`(${column} -> 'done')`;
      const firstUndone = sql.join(
        op.steps.map((id) => {
          const step = sql`jsonb_build_array(${id}::text)`;
          return sql`WHEN NOT (${done} @> ${step}) THEN ${step}`;
        }),
        sql` `
      );
      return sql`CASE WHEN NULLIF(${column} -> 'startedAt', 'null'::jsonb) IS NOT NULL AND NULLIF(${column} -> 'dismissedAt', 'null'::jsonb) IS NULL THEN jsonb_set(${column}, '{done}', ${done} || CASE ${firstUndone} ELSE '[]'::jsonb END) ELSE ${column} END`;
    }
    case "start":
      return sql`jsonb_set(${current}, '{startedAt}', COALESCE(NULLIF(${current} -> 'startedAt', 'null'::jsonb), ${NOW_ISO}))`;
    case "dismiss":
      return sql`jsonb_set(${current}, '{dismissedAt}', ${NOW_ISO})`;
    case "restore":
      return sql`jsonb_set(${current}, '{dismissedAt}', 'null'::jsonb)`;
    default:
      // #11: an op added to OrientationOpSchema but not handled here would
      // otherwise fall through with noImplicitReturns off, returning
      // undefined — a dropped column value, not a build error. `op` is
      // `never` once every case above is exhaustive, so this only compiles
      // while it stays that way.
      return op satisfies never;
  }
}

function notFound() {
  return NextResponse.json({ error: "Not found." }, { status: 404 });
}

export function createProfilePatchHandler(deps: ProfileRouteDeps = {}) {
  const db = deps.db ?? getDb;
  const getSession = deps.getSession ?? getSessionInfo;

  return async function PATCH(request: Request) {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    }

    let body: unknown = null;
    try {
      body = await request.json();
    } catch {
      body = null;
    }

    // Ruling F-4: orientation is the `orient` guide surface. While it is off
    // the key does not exist on this route — 404 before any validation.
    if (
      typeof body === "object" &&
      body !== null &&
      "orientation" in body &&
      !guideDoorEnabled("orient")
    ) {
      return notFound();
    }

    const parsed = ProfilePatchSchema.safeParse(body);
    if (!parsed.success || Object.keys(parsed.data).length === 0) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    const { orientation, ...nudgePrefs } = parsed.data;
    // `set` is only the one-time sign-in migration: refused once the row
    // already has state. The guard sits in the WHERE clause, so two racing
    // migrations cannot both land.
    const isSet = orientation?.op === "set";
    const updated = await db()
      .update(schema.profiles)
      .set(
        orientation
          ? { ...nudgePrefs, orientation: orientationValue(orientation) }
          : nudgePrefs
      )
      .where(
        and(
          eq(schema.profiles.userId, session.userId),
          isSet ? isNull(schema.profiles.orientation) : undefined
        )
      )
      .returning({ userId: schema.profiles.userId });

    // Review A-92: zero rows is not success. For a refused `set` the lookup
    // only picks the status code; nothing was written either way.
    if (updated.length === 0) {
      if (isSet) {
        const [row] = await db()
          .select({ userId: schema.profiles.userId })
          .from(schema.profiles)
          .where(eq(schema.profiles.userId, session.userId));
        if (row) {
          return NextResponse.json(
            { error: "Invalid request." },
            { status: 409 }
          );
        }
      }
      return notFound();
    }

    // Review A-07: only a reminder-preference change cancels a pending attempt.
    // An orientation-only PATCH (a "Done" tap) must never wipe one.
    if (Object.keys(nudgePrefs).length === 0) {
      return NextResponse.json({ ok: true });
    }

    // A preference mutation (including opt-out, cadence, hour, or quiet hours)
    // cancels a pending attempt. A future send must be newly eligible under the
    // updated preferences; confirmed last-send history remains intact.
    // Leases are respected exactly like the cron's own clears: wiping the
    // token of an in-flight send would make its delivered `ok` finalize
    // against zero rows and get recorded as a failure, then re-send.
    await db()
      .update(schema.pushSubscriptions)
      .set({
        nudgeAttemptDate: null,
        nudgeAttemptCount: 0,
        nudgeRetryAfter: null,
        nudgeLeaseToken: null,
        nudgeLeaseUntil: null
      })
      .where(
        and(
          eq(schema.pushSubscriptions.userId, session.userId),
          or(
            isNull(schema.pushSubscriptions.nudgeLeaseUntil),
            lte(schema.pushSubscriptions.nudgeLeaseUntil, new Date())
          )
        )
      );

    return NextResponse.json({ ok: true });
  };
}

const handlers = createProfileRouteHandlers();
export const GET = handlers.GET;
export const POST = handlers.POST;
export const PATCH = createProfilePatchHandler();
