import { NextResponse } from "next/server";
import Stripe from "stripe";

import {
  runStripeReconcileCron,
  type ReconcileDeps
} from "../../../../lib/server/billing/reconcile";
import { getDb, type Db } from "../../../../lib/server/db";
import { sendEmail } from "../../../../lib/server/email";
import { captureServerError } from "../../../../lib/pal/sentry-capture";
import { isAuthorizedCron } from "../../../../lib/server/timing-safe";

export const runtime = "nodejs";
export const maxDuration = 60;

type Deps = {
  db?: () => Db;
  stripe?: ReconcileDeps["stripe"];
};

let stripeSingleton: Stripe | null = null;
function defaultStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not set.");
  }
  stripeSingleton ??= new Stripe(key);
  return stripeSingleton;
}

export function createStripeReconcileCronHandler(deps: Deps = {}) {
  const db = deps.db ?? getDb;
  // Only wire the live Stripe client when a key is configured — an unconfigured
  // deploy still reprocesses the inbox (job 1) without attempting Stripe calls.
  const stripe =
    deps.stripe ?? (process.env.STRIPE_SECRET_KEY ? defaultStripe : undefined);

  return async function GET(request: Request) {
    // Constant-time (N-29): a plain !== on the bearer token leaks its length and
    // matching prefix through response timing.
    if (!isAuthorizedCron(request.headers.get("authorization"))) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    try {
      const result = await runStripeReconcileCron(db(), {
        stripe,
        email: { send: sendEmail }
      });
      return NextResponse.json({ ok: true, ...result });
    } catch (error) {
      await captureServerError(error, "route");
      return NextResponse.json(
        { error: "stripe-reconcile run failed" },
        { status: 500 }
      );
    }
  };
}

export const GET = createStripeReconcileCronHandler();
