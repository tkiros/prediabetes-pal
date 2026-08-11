import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import {
  deleteBlobUrls,
  deleteUserBlobs,
  type BlobDeleter
} from "../../../../lib/server/blob";
import { getDb, schema, type Db } from "../../../../lib/server/db";
import { captureServerError } from "../../../../lib/pal/sentry-capture";
import {
  getSessionInfo,
  type SessionInfo
} from "../../../../lib/server/session";

export const runtime = "nodejs";

type HealthDataDeleteDeps = {
  db?: () => Db;
  getSession?: () => Promise<SessionInfo>;
  deleteBlobs?: BlobDeleter;
};

/**
 * Withdraw stored-health-data consent without deleting the login or billing
 * relationship. The order matters: dependent health rows go first, then the
 * consent-bearing profile. Pantry rows cascade to their photos and items.
 */
export function createHealthDataDeleteHandler(
  deps: HealthDataDeleteDeps = {}
) {
  const db = deps.db ?? getDb;
  const getSession = deps.getSession ?? getSessionInfo;
  const deleteBlobs = deps.deleteBlobs ?? deleteBlobUrls;

  return async function DELETE() {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    }

    const userId = session.userId;

    // Blob deletion stays OUTSIDE the transaction and must precede the order
    // cascade: `pantry_photos.blob_url` is the only pointer to each object.
    // Fail closed so a provider outage cannot turn a live object into an
    // untraceable orphan.
    try {
      await deleteUserBlobs(db(), userId, deleteBlobs);
    } catch (error) {
      await captureServerError(error, "route");
      return NextResponse.json(
        {
          error:
            "Stored-photo deletion could not be confirmed. Your health data is unchanged; please try again."
        },
        { status: 503 }
      );
    }

    // E5: every health-row delete runs in ONE transaction, so a crash
    // mid-withdrawal can never leave a half-erased account, and a concurrent
    // weekly-artifact read cannot interleave a fresh row into a partly-cleared
    // user. `weekly_reflections` is deleted LAST (after `profiles`): the weekly
    // GET's lazy insert only fires while the profiles row still exists, so once
    // profiles is gone within this tx, nothing can race a reflection back in
    // behind the erase.
    await db().transaction(async (tx) => {
      await tx
        .delete(schema.pantryOrders)
        .where(eq(schema.pantryOrders.userId, userId));
      await tx
        .delete(schema.pushSubscriptions)
        .where(eq(schema.pushSubscriptions.userId, userId));
      await tx
        .delete(schema.baiWeekly)
        .where(eq(schema.baiWeekly.userId, userId));
      // Learning journeys reference `users`, not `profiles`/`checks`, so no FK
      // cascade ever reaches them (E2) — delete them EXPLICITLY on withdrawal.
      await tx
        .delete(schema.learningJourneys)
        .where(eq(schema.learningJourneys.userId, userId));
      // Meal memories are health-adjacent (encrypted choice/note). The check
      // cascade below already removes them via the memory→check FK, but
      // withdrawal deletes health rows EXPLICITLY rather than relying on FK
      // ordering — the table postdates this handler, so name it here so intent
      // can't silently drift.
      await tx
        .delete(schema.mealMemories)
        .where(eq(schema.mealMemories.userId, userId));
      await tx
        .delete(schema.checks)
        .where(eq(schema.checks.userId, userId));
      await tx
        .delete(schema.profiles)
        .where(eq(schema.profiles.userId, userId));
      // LAST — see the transaction comment above. Weekly learning artifacts
      // embed the user's own meal text (encrypted); this table references only
      // `users`, so no cascade removes it.
      await tx
        .delete(schema.weeklyReflections)
        .where(eq(schema.weeklyReflections.userId, userId));
    });

    return NextResponse.json({ ok: true });
  };
}

export const DELETE = createHealthDataDeleteHandler();
