import { NextResponse } from "next/server";

import {
  createMealVisionClient,
  type MealVisionClient
} from "../../../../lib/meal/photo-extract";
import {
  photoInputEnabled,
  photoInputServerEnabled
} from "../../../../lib/photo-input-flag";
import { loadSafetyContract } from "../../../../lib/revora/safety-contract";
import { captureServerError } from "../../../../lib/revora/sentry-capture";
import { getDb, type Db } from "../../../../lib/server/db";
import { getEntitlement } from "../../../../lib/server/entitlement";
import { fetchPlaySubscription } from "../../../../lib/server/play-api";
import { paywallMode } from "../../../../lib/server/pricing";
import {
  getSessionInfo,
  type SessionInfo
} from "../../../../lib/server/session";
import { TRIAL_WALL_MESSAGE } from "../route";

export const runtime = "nodejs";
// Vision is slower than the text judge; 30s sits above the extractor's 25s
// OpenAI timeout so a slow call is cut by the SDK, not the platform. Same OPS
// caveat as /api/check maxDuration: verify against the active Vercel plan.
export const maxDuration = 30;

// ~3.3MB of image after base64 — far above the client's ≤1024px JPEG
// (typically <300KB) but under Vercel's ~4.5MB body ceiling.
const MAX_IMAGE_DATA_URL_CHARS = 4_500_000;
const IMAGE_PREFIX = /^data:image\/(jpeg|png|webp);base64,/;

const RETRY_MESSAGE =
  "The photo didn't come through this time. You can retake it, or just type or dictate the meal instead.";

type PhotoDraftDeps = {
  vision?: () => MealVisionClient;
  db?: () => Db;
  getSession?: () => Promise<SessionInfo>;
  getEntitlementImpl?: typeof getEntitlement;
  playLookup?: typeof fetchPlaySubscription;
  paywallMode?: () => "legacy" | "trial";
};

let vision: MealVisionClient | null = null;

function getVisionClient() {
  vision ??= createMealVisionClient();
  return vision;
}

export function createPhotoDraftHandler(deps: PhotoDraftDeps = {}) {
  const visionFactory = deps.vision ?? getVisionClient;
  const db = deps.db ?? getDb;
  const getSession = deps.getSession ?? getSessionInfo;
  const getEntitlementImpl = deps.getEntitlementImpl ?? getEntitlement;
  const playLookup = deps.playLookup ?? fetchPlaySubscription;
  const paywallModeDep = deps.paywallMode ?? (() => paywallMode());

  return async function POST(request: Request) {
    // Counsel launch gate: needs BOTH the reviewed build flag
    // (NEXT_PUBLIC_PHOTO_INPUT=1) and the runtime server twin
    // (PHOTO_INPUT_ENABLED=1). The server twin is the incident control — an
    // env change + redeploy kills this authoritative model-spend/data
    // boundary without waiting on a reviewed rebuild.
    if (!photoInputEnabled() || !photoInputServerEnabled()) {
      return NextResponse.json({ kind: "not_found" }, { status: 404 });
    }

    let body: unknown = null;
    try {
      body = await request.json();
    } catch {
      body = null;
    }

    const image =
      body && typeof body === "object" && "image" in body
        ? (body as { image: unknown }).image
        : null;

    if (
      typeof image !== "string" ||
      image.length > MAX_IMAGE_DATA_URL_CHARS ||
      !IMAGE_PREFIX.test(image)
    ) {
      return NextResponse.json({ kind: "invalid" }, { status: 400 });
    }

    // Trial-mode hard wall, mirrored from /api/check with the same SPLIT
    // failure stances (RE-01): session resolution fails OPEN (a session hiccup
    // demotes to the IP-metered guest path), but the trial wall is a paid
    // boundary — an unreadable entitlement fails CLOSED with a retry card and
    // zero vision spend, exactly like the text route's 503 (AUD-022).
    let session: SessionInfo = null;
    try {
      session = await getSession();
    } catch (error) {
      await captureServerError(error, "route");
    }

    if (session && paywallModeDep() === "trial") {
      let entitlement;
      try {
        entitlement = await getEntitlementImpl(db(), session.userId, {
          refreshPlaySubscription: (token) => playLookup(token)
        });
      } catch (error) {
        await captureServerError(error, "route");
        return NextResponse.json(
          {
            kind: "retry",
            message:
              "Prediabetes Pal had a hiccup checking your plan. Please try again in a moment.",
            disclaimer: loadSafetyContract().copy.disclaimer
          },
          { status: 503 }
        );
      }
      if (entitlement.tier !== "premium") {
        return NextResponse.json(
          {
            kind: "upsell",
            message: TRIAL_WALL_MESSAGE,
            disclaimer: loadSafetyContract().copy.disclaimer
          },
          { status: 402 }
        );
      }
    }

    try {
      const draft = await visionFactory().draftFromPhoto(image);
      // The image string goes out of scope here — never stored, never logged.
      return NextResponse.json({ kind: "draft", ...draft });
    } catch (error) {
      await captureServerError(error, "route");
      // 200 + kind:"retry" mirrors /api/check's calm-retry contract: a model
      // hiccup is a handled product state, not a gateway error, and must not
      // read as a 5xx in monitoring (launch audit BUG-12).
      return NextResponse.json({ kind: "retry", message: RETRY_MESSAGE });
    }
  };
}

export const POST = createPhotoDraftHandler();
