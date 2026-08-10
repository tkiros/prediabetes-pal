import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { toResponseCheck } from "../../history/handlers";
import { mapMemoryRow, memorySelectColumns } from "../../memory/handlers";
import { safeDecrypt } from "../../../../lib/server/crypto";
import { getDb, schema, type Db } from "../../../../lib/server/db";
import {
  getSessionInfo,
  type SessionInfo
} from "../../../../lib/server/session";

export const runtime = "nodejs";

/**
 * PR-5 → AUD-012: ONE complete file. The account page promises "everything we
 * hold, as one file", so this export inlines every user-owned dataset — checks
 * and meal memories included (the dedicated endpoints stay for their in-page
 * buttons, mapped through the SAME functions so the payloads cannot drift) —
 * plus identity, subscriptions, check feedback, and the learning journey. What
 * is deliberately not inline is named in `exclusions`, each with its reason,
 * so the file accounts for every dataset instead of silently omitting it.
 */
type Deps = {
  db?: () => Db;
  getSession?: () => Promise<SessionInfo>;
  now?: () => Date;
};

export function createAccountExportHandler(deps: Deps = {}) {
  const db = deps.db ?? getDb;
  const getSession = deps.getSession ?? getSessionInfo;
  const now = deps.now ?? (() => new Date());

  return async function GET() {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    }

    // Independent user-scoped reads — run concurrently so each added data
    // set doesn't extend export latency serially.
    const [
      [identity],
      [profile],
      reflections,
      pantryOrders,
      supportCases,
      checkRows,
      memoryRows,
      feedbackRows,
      subscriptionRows,
      [journey]
    ] = await Promise.all([
      db()
        .select({
          email: schema.users.email,
          createdAt: schema.users.createdAt
        })
        .from(schema.users)
        .where(eq(schema.users.id, session.userId)),
      db()
        .select()
        .from(schema.profiles)
        .where(eq(schema.profiles.userId, session.userId)),
      db()
        .select()
        .from(schema.weeklyReflections)
        .where(eq(schema.weeklyReflections.userId, session.userId))
        .orderBy(desc(schema.weeklyReflections.weekStart)),
      db()
        .select()
        .from(schema.pantryOrders)
        .where(eq(schema.pantryOrders.userId, session.userId))
        .orderBy(desc(schema.pantryOrders.createdAt)),
      // P0.4: support-case messages are user-authored personal data — the
      // export gains them in the same PR that creates them.
      db()
        .select()
        .from(schema.supportCases)
        .where(eq(schema.supportCases.userId, session.userId))
        .orderBy(desc(schema.supportCases.createdAt)),
      // AUD-012: checks + meal memories inline, through the same mapping the
      // dedicated endpoints use — one complete file, no drift.
      db()
        .select()
        .from(schema.checks)
        .where(eq(schema.checks.userId, session.userId))
        .orderBy(desc(schema.checks.createdAt), desc(schema.checks.id)),
      db()
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
        ),
      db()
        .select()
        .from(schema.checkFeedback)
        .where(eq(schema.checkFeedback.userId, session.userId))
        .orderBy(desc(schema.checkFeedback.createdAt)),
      db()
        .select()
        .from(schema.subscriptions)
        .where(eq(schema.subscriptions.userId, session.userId)),
      db()
        .select()
        .from(schema.learningJourneys)
        .where(eq(schema.learningJourneys.userId, session.userId))
    ]);

    const exported = {
      exportedAt: now().toISOString(),
      identity: identity
        ? { email: identity.email, createdAt: identity.createdAt }
        : null,
      profile: profile
        ? {
            a1c: safeDecrypt(profile.a1cCiphertext),
            a1cBand: profile.a1cBand,
            timezone: profile.timezone,
            nudgeOptIn: profile.nudgeOptIn,
            consentedAt: profile.consentedAt
          }
        : null,
      weeklyReflections: reflections.map((row) => ({
        weekStart: row.weekStart,
        version: row.version,
        artifact: safeDecrypt(row.artifactCiphertext),
        createdAt: row.createdAt
      })),
      pantryOrders: pantryOrders.map((row) => ({
        status: row.status,
        createdAt: row.createdAt,
        a1cBand: row.a1cBand,
        a1c: row.a1cCiphertext ? safeDecrypt(row.a1cCiphertext) : null,
        notes: row.notesCiphertext ? safeDecrypt(row.notesCiphertext) : null,
        report: row.reportCiphertext ? safeDecrypt(row.reportCiphertext) : null,
        deliveredAt: row.deliveredAt
      })),
      supportCases: supportCases.map((row) => ({
        kind: row.kind,
        message: safeDecrypt(row.messageCiphertext),
        status: row.status,
        createdAt: row.createdAt,
        resolvedAt: row.resolvedAt
      })),
      checks: checkRows.map((row) =>
        toResponseCheck(row, safeDecrypt(row.foodCiphertext))
      ),
      mealMemories: memoryRows.map((row) => mapMemoryRow(row)),
      checkFeedback: feedbackRows.map((row) => ({
        checkId: row.checkId,
        helpful: row.helpful,
        reason: row.reason,
        comment: row.commentCiphertext
          ? safeDecrypt(row.commentCiphertext)
          : null,
        createdAt: row.createdAt
      })),
      subscriptions: subscriptionRows.map((row) => ({
        provider: row.provider,
        productId: row.productId,
        status: row.status,
        currentPeriodEnd: row.currentPeriodEnd,
        cancelAtPeriodEnd: row.cancelAtPeriodEnd,
        updatedAt: row.updatedAt
      })),
      learningJourney: journey
        ? {
            state: journey.state,
            startedAt: journey.startedAt,
            pausedAt: journey.pausedAt,
            pauseReason: journey.pauseReason,
            graduatedAt: journey.graduatedAt,
            maintenanceAt: journey.maintenanceAt
          }
        : null,
      // AUD-012: the documented exclusion schedule. Every user-adjacent
      // dataset NOT inlined above is named here with its reason — the file
      // accounts for everything rather than silently omitting anything.
      exclusions: [
        {
          dataset: "sign-in artifacts (sessions, oauth accounts, magic-link tokens)",
          reason:
            "Transient authentication state that expires on its own; contains no user-authored content."
        },
        {
          dataset: "push notification subscription endpoints",
          reason:
            "Device push tokens, revocable from the device's own settings; not user-authored content."
        },
        {
          dataset: "email delivery and suppression logs",
          reason:
            "Operational delivery records retained for abuse prevention and deliverability."
        },
        {
          dataset: "internal behavioral index (weekly)",
          reason:
            "Product-measurement aggregate computed from the checks included above; never shown to you and holds no data not derivable from this file."
        },
        {
          dataset: "pantry photos and item worksheets",
          reason:
            "Photos are deleted after your report is delivered; the delivered report included above is the durable artifact."
        },
        {
          dataset: "provider-side billing records (Stripe / Google Play)",
          reason:
            "Retained by the payment provider under their own terms; the subscription summary above is what Prediabetes Pal holds."
        }
      ]
    };

    const today = now().toISOString().slice(0, 10);
    return new NextResponse(JSON.stringify(exported, null, 2), {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="revora-account-${today}.json"`
      }
    });
  };
}

export const GET = createAccountExportHandler();
