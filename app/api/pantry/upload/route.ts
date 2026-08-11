import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";

import { authorizePantryUpload } from "../../../../lib/server/pantry/upload-auth";
import { pantryBlobToken } from "../../../../lib/server/pantry/blob-access";
import { captureServerError } from "../../../../lib/pal/sentry-capture";
import { getDb, type Db } from "../../../../lib/server/db";
import {
  getSessionInfo,
  type SessionInfo
} from "../../../../lib/server/session";

export const runtime = "nodejs";

type Deps = { db?: () => Db; getSession?: () => Promise<SessionInfo> };

export function createPantryUploadHandler(deps: Deps = {}) {
  const db = deps.db ?? getDb;
  const getSession = deps.getSession ?? getSessionInfo;

  return async function POST(request: Request) {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    }

    let token: string;
    try {
      token = pantryBlobToken();
    } catch (error) {
      await captureServerError(error, "route");
      return NextResponse.json(
        { error: "Photo uploads are temporarily unavailable." },
        { status: 503 }
      );
    }

    try {
      // Inside the try so a malformed body is a 400, not an uncaught 500
      // (SA-12): every other route parses defensively; this one did not.
      const body = (await request.json()) as HandleUploadBody;
      const json = await handleUpload({
        token,
        body,
        request,
        onBeforeGenerateToken: (pathname, clientPayload) =>
          authorizePantryUpload(db(), session, pathname, clientPayload),
        // Photo rows are recorded at submit (/api/pantry/submit) — this
        // callback does not fire on localhost, so nothing may depend on it.
        onUploadCompleted: async () => {}
      });
      return NextResponse.json(json);
    } catch {
      return NextResponse.json(
        { error: "Photo upload authorization failed." },
        { status: 400 }
      );
    }
  };
}

export const POST = createPantryUploadHandler();
