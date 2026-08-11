import { createHash } from "node:crypto";

import { and, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import Stripe from "stripe";

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

/**
 * Account + data deletion (plan 4E). Confirms that charge-capable provider
 * subscriptions are canceled, deletes the user's pantry photos from Blob, deletes the user
 * row (every user-linked table cascades), writes an identity-free audit row,
 * and ends the session (DB sessions cascade with the user). Declared publicly
 * at /account/delete.
 */

type DeleteDeps = {
  db?: () => Db;
  getSession?: () => Promise<SessionInfo>;
  cancelStripeSubscription?: (subscriptionId: string) => Promise<void>;
  deleteBlobs?: BlobDeleter;
  now?: () => Date;
};

export async function defaultCancelStripe(
  subscriptionId: string,
  client?: Pick<Stripe, "subscriptions">
): Promise<void> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("Stripe cancellation is not configured.");
  }
  const stripe = client ?? new Stripe(key);
  try {
    await stripe.subscriptions.cancel(subscriptionId);
  } catch (error) {
    if (error instanceof Stripe.errors.StripeInvalidRequestError) {
      if (error.code === "resource_missing") {
        return;
      }
      // Retry after a partial failure: the first attempt already canceled the
      // provider subscription, but the local row stays active/trialing until
      // the deleted-webhook lands, so this route cancels again and Stripe
      // rejects the second cancel. Already-canceled is the goal state — we
      // confirm it by reading the subscription instead of pattern-matching
      // Stripe's message; any other invalid-request error still fails closed.
      const current = await stripe.subscriptions.retrieve(subscriptionId);
      if (current.status === "canceled") {
        return;
      }
    }
    throw error;
  }
}

export function createAccountDeleteHandler(deps: DeleteDeps = {}) {
  const db = deps.db ?? getDb;
  const getSession = deps.getSession ?? getSessionInfo;
  const cancelStripe = deps.cancelStripeSubscription ?? defaultCancelStripe;
  const deleteBlobs = deps.deleteBlobs ?? deleteBlobUrls;
  const now = deps.now ?? (() => new Date());

  return async function POST() {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    }

    const requestedAt = now();

    // Never destroy the only local billing pointer until the provider confirms
    // that a charge-capable subscription can no longer renew.
    const subscriptions = await db()
      .select()
      .from(schema.subscriptions)
      .where(
        and(
          eq(schema.subscriptions.userId, session.userId),
          inArray(schema.subscriptions.status, ["active", "trialing", "grace"])
        )
      );

    if (subscriptions.some((subscription) => subscription.provider === "play")) {
      return NextResponse.json(
        {
          error:
            "Cancel your Google Play subscription first, then delete your account."
        },
        { status: 409 }
      );
    }

    for (const subscription of subscriptions) {
      if (subscription.provider === "stripe") {
        try {
          await cancelStripe(subscription.providerRef);
        } catch (error) {
          await captureServerError(error, "route");
          return NextResponse.json(
            {
              error:
                "Billing cancellation could not be confirmed. Your account is unchanged; please try again."
            },
            { status: 503 }
          );
        }
      }
    }

    // MUST precede the cascade (N-23): pantry_photos.blob_url is the only
    // pointer to a live Blob object, and `DELETE users` cascades those rows
    // away — after that the photos are unreachable and undeletable forever,
    // which is exactly the "we keep nothing" promise this route exists to keep.
    // A failed provider delete must stop the cascade. Otherwise the only URL
    // pointer disappears and no retry or reaper can identify the object.
    try {
      await deleteUserBlobs(db(), session.userId, deleteBlobs);
    } catch (error) {
      await captureServerError(error, "route");
      return NextResponse.json(
        {
          error:
            "Stored-photo deletion could not be confirmed. Your account is unchanged; please try again."
        },
        { status: 503 }
      );
    }

    // One delete; profiles/checks/subscriptions/push/sessions/pantry cascade.
    await db().delete(schema.users).where(eq(schema.users.id, session.userId));

    await db()
      .insert(schema.deletionLog)
      .values({
        userIdHash: createHash("sha256").update(session.userId).digest("hex"),
        requestedAt,
        completedAt: now()
      });

    return NextResponse.json({ ok: true });
  };
}

export const POST = createAccountDeleteHandler();
