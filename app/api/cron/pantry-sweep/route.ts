import { NextResponse } from "next/server";

import { captureServerError } from "../../../../lib/pal/sentry-capture";
import { getDb, type Db } from "../../../../lib/server/db";
import { defaultProcessDeps } from "../../../../lib/server/pantry/process";
import { runPantrySweep } from "../../../../lib/server/pantry/sweep";
import { isAuthorizedCron } from "../../../../lib/server/timing-safe";

export const runtime = "nodejs";
export const maxDuration = 300;

type Deps = { db?: () => Db; sweep?: typeof runPantrySweep };

export function createPantrySweepHandler(deps: Deps = {}) {
  const db = deps.db ?? getDb;
  const sweep = deps.sweep ?? runPantrySweep;

  return async function GET(request: Request) {
    // Constant-time (N-29): a plain !== on the bearer token leaks its length and
    // matching prefix through response timing.
    if (!isAuthorizedCron(request.headers.get("authorization"))) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    try {
      const result = await sweep(defaultProcessDeps(db()));
      return NextResponse.json({ ok: true, ...result });
    } catch (error) {
      await captureServerError(error, "route");
      return NextResponse.json({ error: "sweep failed" }, { status: 500 });
    }
  };
}

export const GET = createPantrySweepHandler();
