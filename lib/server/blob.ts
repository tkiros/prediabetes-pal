import { eq, inArray, lt, ne, or, and, isNotNull } from "drizzle-orm";

import type { Db } from "./db";
import * as schema from "./db/schema";
import { captureServerError } from "../pal/sentry-capture";
import { pantryBlobToken } from "./pantry/blob-access";

/**
 * Blob lifecycle (N-23/N-24).
 *
 * Pantry photos are the only user content Prediabetes Pal persists to object storage.
 * The privacy page makes two promises about them — "deleted when the report is
 * delivered" and "we keep nothing after you delete your account" — and before
 * this module both were false: deletion fired on exactly one happy path
 * (successful report delivery), and `DELETE users` cascaded away the
 * `pantry_photos` row holding `blob_url`, destroying the only pointer to a
 * still-live private object.
 *
 * Every deletion path in the app now funnels through here.
 */

/**
 * The Blob-API call itself, injectable so tests (and the ProcessDeps seam the
 * pantry pipeline already carries) never hit the network.
 */
export type BlobDeleter = (urls: string[]) => Promise<void>;

/** Delete blob objects by URL. Safe to call with an empty list. */
export const deleteBlobUrls: BlobDeleter = async (urls) => {
  if (urls.length === 0) {
    return;
  }

  const { del } = await import("@vercel/blob");
  await del(urls, { token: pantryBlobToken() });
};

/** One object as the Blob store itself sees it — the store is the source of truth. */
export type BlobObject = { url: string; uploadedAt: Date };

/** List every object in the store, following pagination to the end. */
export type BlobLister = () => Promise<BlobObject[]>;

export const listBlobObjects: BlobLister = async () => {
  const { list } = await import("@vercel/blob");

  const objects: BlobObject[] = [];
  let cursor: string | undefined;

  do {
    const page = await list({
      cursor,
      limit: 1000,
      token: pantryBlobToken()
    });
    for (const blob of page.blobs) {
      objects.push({ url: blob.url, uploadedAt: new Date(blob.uploadedAt) });
    }
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);

  return objects;
};

/**
 * An upload is live in the store before its `pantry_photos` row is written.
 * Anything younger than this could simply be mid-flight, and deleting it would
 * yank a photo out from under a user who is still filling in the form.
 */
export const ORPHAN_MIN_AGE_MS = 60 * 60 * 1000;

/**
 * Photos are needed only while a photo is being read into an item list
 * (minutes; the stuck-order alert fires at 2h). Anything still alive after
 * this is an order nobody finished — abandoned at `awaiting_confirm`, or a
 * report whose delivery email never succeeded. This ceiling is what lets the
 * privacy page state a maximum retention at all, instead of "until the happy
 * path happens to run".
 */
export const PHOTO_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/** Orders that will never look at their photos again. */
const TERMINAL_STATUSES = ["needs_manual", "canceled"] as const;

/**
 * Delete every not-yet-deleted photo blob for an order, then mark the rows.
 *
 * The rows are marked `deleted` ONLY after the blob API confirms deletion. The
 * previous implementation marked them regardless, so a Blob-API outage
 * permanently orphaned the objects: the rows claimed "deleted", and every
 * sweep/retry filters on `status !== "deleted"`, so nothing would ever look at
 * them again. Leaving the rows untouched on failure means the sweep's GC phase
 * retries them on the next run.
 *
 * Returns the number of blobs deleted.
 */
export async function deleteOrderBlobs(
  db: Db,
  orderId: string,
  deleteBlobs: BlobDeleter = deleteBlobUrls
): Promise<number> {
  const photos = await db
    .select()
    .from(schema.pantryPhotos)
    .where(eq(schema.pantryPhotos.orderId, orderId));

  const urls = photos
    .filter((photo) => photo.status !== "deleted")
    .map((photo) => photo.blobUrl);

  if (urls.length === 0) {
    return 0;
  }

  try {
    await deleteBlobs(urls);
  } catch (error) {
    // Do NOT mark the rows deleted — the objects are still live. The sweep's
    // GC phase will retry on the next run.
    await captureServerError(error, "route");
    return 0;
  }

  await db
    .update(schema.pantryPhotos)
    .set({ status: "deleted" })
    .where(eq(schema.pantryPhotos.orderId, orderId));

  return urls.length;
}

/**
 * Delete every photo blob belonging to a user, across all their orders.
 *
 * Called by the account-delete route BEFORE the cascading `DELETE users` —
 * once the cascade runs, the `blob_url`s are gone and the objects can never be
 * reclaimed.
 */
export async function deleteUserBlobs(
  db: Db,
  userId: string,
  deleteBlobs: BlobDeleter = deleteBlobUrls
): Promise<number> {
  const rows = await db
    .select({
      blobUrl: schema.pantryPhotos.blobUrl,
      status: schema.pantryPhotos.status
    })
    .from(schema.pantryPhotos)
    .innerJoin(
      schema.pantryOrders,
      eq(schema.pantryPhotos.orderId, schema.pantryOrders.id)
    )
    .where(eq(schema.pantryOrders.userId, userId));

  const urls = rows
    .filter((row) => row.status !== "deleted")
    .map((row) => row.blobUrl);

  if (urls.length === 0) {
    return 0;
  }

  // Unlike deleteOrderBlobs we do not mark rows — the caller is about to delete
  // them anyway. A provider failure MUST propagate so the caller can stop the
  // cascade. That leaves every URL in the database for a safe retry.
  await deleteBlobs(urls);

  return urls.length;
}

/**
 * GC/reaper: every photo that no longer has a reason to exist.
 *
 * Two claims, because a terminal state alone leaves the abandoned orders
 * (never confirmed, never canceled) alive forever:
 *  1. the order reached a state that will never read a photo again —
 *     `needs_manual` / `canceled` (admin's manual paths re-judge item *text*,
 *     never photos), or `ready` and actually delivered;
 *  2. the photo is simply older than PHOTO_MAX_AGE_MS, whatever the order says.
 *
 * Also the retry path for an outage: deleteOrderBlobs leaves rows unmarked when
 * the Blob API throws, so those orders match again on the next sweep.
 *
 * Returns the number of blobs deleted.
 */
export async function reapPantryBlobs(
  db: Db,
  now: Date,
  deleteBlobs: BlobDeleter = deleteBlobUrls
): Promise<number> {
  const rows = await db
    .select({ orderId: schema.pantryPhotos.orderId })
    .from(schema.pantryPhotos)
    .innerJoin(
      schema.pantryOrders,
      eq(schema.pantryPhotos.orderId, schema.pantryOrders.id)
    )
    .where(
      and(
        ne(schema.pantryPhotos.status, "deleted"),
        or(
          inArray(schema.pantryOrders.status, [...TERMINAL_STATUSES]),
          and(
            eq(schema.pantryOrders.status, "ready"),
            isNotNull(schema.pantryOrders.deliveredAt)
          ),
          lt(
            schema.pantryPhotos.createdAt,
            new Date(now.getTime() - PHOTO_MAX_AGE_MS)
          )
        )
      )
    );

  // One deleteOrderBlobs call per order, not per photo — it is the single
  // place that owns the delete-then-mark invariant.
  let deleted = 0;
  for (const orderId of new Set(rows.map((row) => row.orderId))) {
    deleted += await deleteOrderBlobs(db, orderId, deleteBlobs);
  }
  return deleted;
}

/**
 * The ORPHAN reaper — the one deletion path that cannot start from the database.
 *
 * Every other function here walks `pantry_photos` to find objects. A true orphan
 * is precisely the object whose row is already GONE: before the account-delete
 * fix, `DELETE users` cascaded the row away and destroyed the only pointer to a
 * still-live private object. No query over that table can ever see one
 * again — the evidence was deleted along with the pointer.
 *
 * So this walks the other way: the STORE is the source of truth, and any object
 * the database cannot account for is garbage. That inversion is the whole point.
 * It is what reclaims the blobs orphaned by deletions that happened before the
 * fix landed, and it is the backstop for any future path that forgets to clean
 * up after itself.
 *
 * Two safety rails, because this deletes objects the DB knows nothing about:
 *  1. an age floor (ORPHAN_MIN_AGE_MS) — an upload is live in the store before
 *     its row is written, so a young unmatched object is a race, not an orphan;
 *  2. the known-URL set is built from EVERY row regardless of status, so a row
 *     that merely failed to delete is never mistaken for an orphan and stays on
 *     the normal retry path.
 *
 * Returns the number of orphans deleted.
 */
export async function reapOrphanBlobs(
  db: Db,
  now: Date,
  listBlobs: BlobLister = listBlobObjects,
  deleteBlobs: BlobDeleter = deleteBlobUrls
): Promise<number> {
  let objects: BlobObject[];
  try {
    objects = await listBlobs();
  } catch (error) {
    // A listing failure must not take the whole sweep down with it — the
    // DB-driven GC above has already run and is the load-bearing half.
    await captureServerError(error, "route");
    return 0;
  }

  if (objects.length === 0) {
    return 0;
  }

  const known = new Set(
    (
      await db
        .select({ blobUrl: schema.pantryPhotos.blobUrl })
        .from(schema.pantryPhotos)
    ).map((row) => row.blobUrl)
  );

  const cutoff = now.getTime() - ORPHAN_MIN_AGE_MS;
  const orphans = objects
    .filter((object) => !known.has(object.url))
    .filter((object) => object.uploadedAt.getTime() < cutoff)
    .map((object) => object.url);

  if (orphans.length === 0) {
    return 0;
  }

  try {
    await deleteBlobs(orphans);
  } catch (error) {
    await captureServerError(error, "route");
    return 0;
  }

  return orphans.length;
}
