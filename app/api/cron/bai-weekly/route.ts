import { NextResponse } from "next/server";

import { runBaiWeeklyCron } from "../../../../lib/server/bai-cron";
import { getDb, type Db } from "../../../../lib/server/db";
import { captureServerError } from "../../../../lib/pal/sentry-capture";
import { isAuthorizedCron } from "../../../../lib/server/timing-safe";

export const runtime = "nodejs";
export const maxDuration = 60;

type Deps = {
  db?: () => Db;
};

export function createBaiCronHandler(deps: Deps = {}) {
  const db = deps.db ?? getDb;

  return async function GET(request: Request) {
    // Constant-time (N-29): a plain !== on the bearer token leaks its length and
    // matching prefix through response timing.
    if (!isAuthorizedCron(request.headers.get("authorization"))) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    try {
      const result = await runBaiWeeklyCron(db());
      return NextResponse.json({ ok: true, ...result });
    } catch (error) {
      await captureServerError(error, "route");
      return NextResponse.json({ error: "bai-weekly run failed" }, { status: 500 });
    }
  };
}

export const GET = createBaiCronHandler();
