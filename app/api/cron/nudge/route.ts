import { NextResponse } from "next/server";
import webpush from "web-push";

import { runNudgeCron, type PushSendResult } from "../../../../lib/server/nudge";
import { getDb, type Db } from "../../../../lib/server/db";
import { captureServerError } from "../../../../lib/pal/sentry-capture";
import { isAuthorizedCron } from "../../../../lib/server/timing-safe";
import { SUPPORT_EMAIL } from "../../../../lib/pal/contact";

export const runtime = "nodejs";
export const maxDuration = 60;

type Deps = {
  db?: () => Db;
  send?: (
    subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
    payload: string
  ) => Promise<PushSendResult>;
};

let vapidConfigured = false;

async function defaultSend(
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  payload: string
): Promise<PushSendResult> {
  if (!vapidConfigured) {
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    if (!publicKey || !privateKey) {
      return "error";
    }
    webpush.setVapidDetails(
      `mailto:${SUPPORT_EMAIL}`,
      publicKey,
      privateKey
    );
    vapidConfigured = true;
  }

  try {
    await webpush.sendNotification(subscription, payload);
    return "ok";
  } catch (error) {
    const statusCode = (error as { statusCode?: number }).statusCode;
    return statusCode === 404 || statusCode === 410 ? "gone" : "error";
  }
}

export function createNudgeCronHandler(deps: Deps = {}) {
  const db = deps.db ?? getDb;
  const send = deps.send ?? defaultSend;

  return async function GET(request: Request) {
    // Constant-time (N-29): a plain !== on the bearer token leaks its length and
    // matching prefix through response timing.
    if (!isAuthorizedCron(request.headers.get("authorization"))) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    try {
      const result = await runNudgeCron(db(), { send });
      // `pending` (deferred by lease/quiet hours) and `exhausted` (bounded
      // same-day retry spent) are expected outcomes of the retry design — they
      // must not redden the hourly run or page anyone. Only true failures do.
      const ok = result.failed === 0;
      return NextResponse.json(
        { ok, ...result },
        { status: ok ? 200 : 503 }
      );
    } catch (error) {
      await captureServerError(error, "route");
      return NextResponse.json({ error: "nudge run failed" }, { status: 500 });
    }
  };
}

export const GET = createNudgeCronHandler();
