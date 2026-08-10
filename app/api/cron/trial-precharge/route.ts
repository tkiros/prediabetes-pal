import { NextResponse } from "next/server";

import { captureServerError } from "../../../../lib/pal/sentry-capture";
import { runPrechargeSweep } from "../../../../lib/server/billing/precharge";
import { getDb, type Db } from "../../../../lib/server/db";
import { sendEmail } from "../../../../lib/server/email";
import { isAuthorizedCron } from "../../../../lib/server/timing-safe";

export const runtime = "nodejs";
export const maxDuration = 300;

type Deps = { db?: () => Db; sweep?: typeof runPrechargeSweep };

export function createPrechargeSweepHandler(deps: Deps = {}) {
  const db = deps.db ?? getDb;
  const sweep = deps.sweep ?? runPrechargeSweep;

  return async function GET(request: Request) {
    // Constant-time (N-29): a plain !== on the bearer token leaks its length and
    // matching prefix through response timing.
    if (!isAuthorizedCron(request.headers.get("authorization"))) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    try {
      const result = await sweep({
        db,
        email: { send: sendEmail },
        now: () => new Date(),
        secret: process.env.AUTH_SECRET
      });
      return NextResponse.json({ ok: true, ...result });
    } catch (error) {
      await captureServerError(error, "route");
      return NextResponse.json({ error: "sweep failed" }, { status: 500 });
    }
  };
}

export const GET = createPrechargeSweepHandler();
