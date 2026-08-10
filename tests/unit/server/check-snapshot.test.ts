import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { createCheckRouteHandler } from "../../../app/api/check/route";
import {
  createHistoryActionHandler,
  createHistoryExportHandler,
  createHistoryGetHandler
} from "../../../app/api/history/handlers";
import { activeModelId } from "../../../lib/pal/openai-client";
import { PROMPT_VERSION } from "../../../lib/pal/prompt";
import { CONTRACT_VERSION } from "../../../lib/pal/safety-contract";
import { decryptField, encryptField } from "../../../lib/server/crypto";
import { schema } from "../../../lib/server/db";
import { createTestDb } from "../../helpers/test-db";

/**
 * Task 13 (§P3.1) — the immutable check-result snapshot. Exercises the full
 * round-trip against PGlite with the REAL migrations applied (test-db.ts), so a
 * broken migration or a plaintext-at-rest regression fails here.
 */

const TEST_KEY = Buffer.alloc(32, 7).toString("base64");

let testDb: Awaited<ReturnType<typeof createTestDb>>;
let userId: string;

beforeAll(async () => {
  process.env.HEALTH_DATA_KEY = TEST_KEY;
  testDb = await createTestDb();
  const [user] = await testDb.db
    .insert(schema.users)
    .values({ email: "snapshot@test.dev" })
    .returning();
  userId = user.id;
});

afterAll(async () => {
  delete process.env.HEALTH_DATA_KEY;
  await testDb.close();
});

beforeEach(async () => {
  await testDb.db.delete(schema.checks);
  await testDb.db.delete(schema.profiles);
  await testDb.db.insert(schema.profiles).values({
    userId,
    a1cCiphertext: "cipher",
    a1cBand: "prediabetes_60_62",
    timezone: "UTC",
    consentedAt: new Date()
  });
});

const RESULT_RESPONSE = {
  kind: "result",
  risk: "MODERATE",
  reason: "This leans on refined carbs.",
  adjustment: "If practical, add protein.",
  swap: "If you have the option, swap to a less refined version.",
  disclaimer: "Not medical advice."
} as const;

type Sink = { floorApplied: string | null; usedFallback: boolean };

function createHandler(options: {
  floor?: Sink;
  responseKind?: "result" | "clarify";
} = {}) {
  const checkFoodImpl = vi.fn(
    async (_body: unknown, deps: { snapshot?: Sink }) => {
      if (options.floor && deps.snapshot) {
        deps.snapshot.floorApplied = options.floor.floorApplied;
        deps.snapshot.usedFallback = options.floor.usedFallback;
      }
      return options.responseKind === "clarify"
        ? {
            kind: "clarify" as const,
            question: "Plain or sweetened?",
            examples: [],
            disclaimer: "Not medical advice."
          }
        : RESULT_RESPONSE;
    }
  );

  return createCheckRouteHandler({
    checkFoodImpl: checkFoodImpl as never,
    emitEvent: vi.fn(),
    modelFactory: () => ({ generate: vi.fn() }),
    db: () => testDb.db,
    getSession: async () => ({ userId, email: "snapshot@test.dev" }),
    paywallMode: () => "legacy" as const
  });
}

function checkRequest(headers: Record<string, string> = {}) {
  return new Request("http://test/api/check", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify({ food: "white rice and beans", a1c: 6.1 })
  });
}

function asOwner() {
  return {
    db: () => testDb.db,
    getSession: async () => ({ userId, email: "snapshot@test.dev" })
  };
}

describe("immutable check-result snapshot (§P3.1)", () => {
  it("persists the full encrypted card + reproducibility stamps for a signed-in result", async () => {
    const POST = createHandler();
    const response = await POST(
      checkRequest({
        "x-pal-client-id": "snap-1",
        "x-pal-coach-rotation": "0"
      })
    );
    expect(response.status).toBe(200);
    const body = await response.json();

    const [row] = await testDb.db
      .select()
      .from(schema.checks)
      .where(eq(schema.checks.userId, userId));

    // Reproducibility stamps + non-sensitive route class.
    expect(row.routeType).toBe("result");
    expect(row.responseKind).toBe("result");
    expect(row.promptVersion).toBe(PROMPT_VERSION);
    expect(row.contractVersion).toBe(CONTRACT_VERSION);
    expect(row.modelId).toBe(activeModelId());
    expect(row.usedFallback).toBe(false);
    expect(row.floorApplied).toBeNull();

    // The card is encrypted at rest — no plaintext verdict copy in the column.
    expect(row.cardCiphertext).not.toBeNull();
    expect(row.cardCiphertext).not.toContain("refined");

    // …and decrypts to exactly the card the client received (verdict + coach).
    const card = JSON.parse(decryptField(row.cardCiphertext as string));
    expect(card).toEqual({
      risk: "MODERATE",
      reason: RESULT_RESPONSE.reason,
      adjustment: RESULT_RESPONSE.adjustment,
      swap: RESULT_RESPONSE.swap,
      sequencingTip: body.sequencingTip,
      postMealAction: body.postMealAction,
      keepMost: body.keepMost
    });
  });

  it("persists the conservative floor + fallback metadata surfaced from postprocess", async () => {
    const POST = createHandler({
      floor: { floorApplied: "carbs_only", usedFallback: true }
    });
    await POST(checkRequest());

    const [row] = await testDb.db.select().from(schema.checks);
    expect(row.floorApplied).toBe("carbs_only");
    expect(row.usedFallback).toBe(true);
  });

  it("stores the approved clarify question (from the bounded category) and marks wasClarified", async () => {
    const POST = createHandler();
    await POST(
      checkRequest({
        "x-pal-clarified": "1",
        "x-pal-clarify-category": "plain_or_sweetened"
      })
    );

    const [row] = await testDb.db.select().from(schema.checks);
    expect(row.wasClarified).toBe(true);
    expect(row.clarifyQuestionCiphertext).not.toBeNull();
    expect(decryptField(row.clarifyQuestionCiphertext as string)).toBe(
      "Is this plain or sweetened?"
    );
    // The supplied answer IS the normalized input (foodCiphertext); never duped.
    expect(row.clarifyAnswerCiphertext).toBeNull();
  });

  it("does not store a clarify question when the check did not resolve a clarification", async () => {
    const POST = createHandler();
    // Category present but no clarified flag — nothing was actually answered.
    await POST(checkRequest({ "x-pal-clarify-category": "plain_or_sweetened" }));

    const [row] = await testDb.db.select().from(schema.checks);
    expect(row.wasClarified).toBe(false);
    expect(row.clarifyQuestionCiphertext).toBeNull();
  });

  it("ignores an unknown clarify category rather than storing junk", async () => {
    const POST = createHandler();
    await POST(
      checkRequest({
        "x-pal-clarified": "1",
        "x-pal-clarify-category": "not_a_real_reason"
      })
    );

    const [row] = await testDb.db.select().from(schema.checks);
    expect(row.wasClarified).toBe(true);
    expect(row.clarifyQuestionCiphertext).toBeNull();
  });

  it("persists nothing for a clarify (non-result) response", async () => {
    const POST = createHandler({ responseKind: "clarify" });
    await POST(checkRequest({ "x-pal-clarified": "1" }));

    const rows = await testDb.db.select().from(schema.checks);
    expect(rows).toHaveLength(0);
  });
});

describe("snapshot read path (history GET + export)", () => {
  it("returns the decrypted card and snapshot fields for a Task-13 row", async () => {
    const POST = createHandler({
      floor: { floorApplied: "carbs_only", usedFallback: true }
    });
    const checkResponse = await POST(checkRequest());
    const checkBody = await checkResponse.json();

    const GET = createHistoryGetHandler(asOwner());
    const response = await GET(new Request("http://test/api/history"));
    const body = await response.json();

    expect(body.checks).toHaveLength(1);
    const entry = body.checks[0];
    expect(entry.wasClarified).toBe(false);
    expect(entry.routeType).toBe("result");
    expect(entry.floorApplied).toBe("carbs_only");
    expect(entry.usedFallback).toBe(true);
    expect(entry.promptVersion).toBe(PROMPT_VERSION);
    expect(entry.card).toEqual({
      risk: "MODERATE",
      reason: RESULT_RESPONSE.reason,
      adjustment: RESULT_RESPONSE.adjustment,
      swap: RESULT_RESPONSE.swap,
      sequencingTip: checkBody.sequencingTip,
      postMealAction: checkBody.postMealAction,
      keepMost: checkBody.keepMost
    });
  });

  it("reads a pre-Task-13 row (no snapshot columns) as nulls, never an error", async () => {
    // A bare row exactly as older code wrote it — no card/version/flag columns.
    await testDb.db.insert(schema.checks).values({
      userId,
      foodCiphertext: encryptField("legacy oatmeal"),
      risk: "SAFE",
      a1cBand: "prediabetes_60_62",
      inputMethod: "text"
    });

    const GET = createHistoryGetHandler(asOwner());
    const response = await GET(new Request("http://test/api/history"));
    const body = await response.json();

    expect(response.status).toBe(200);
    const entry = body.checks[0];
    expect(entry.food).toBe("legacy oatmeal");
    expect(entry.card).toBeNull();
    expect(entry.routeType).toBeNull();
    expect(entry.wasClarified).toBe(false);
    expect(entry.usedFallback).toBe(false);
    expect(entry.clarifyQuestion).toBeNull();
    expect(entry.promptVersion).toBeNull();
    expect(entry.modelId).toBeNull();
    expect(entry.floorApplied).toBeNull();
  });

  it("includes the snapshot fields in the data-rights export", async () => {
    const POST = createHandler();
    const checkResponse = await POST(checkRequest());
    const checkBody = await checkResponse.json();

    const EXPORT = createHistoryExportHandler(asOwner());
    const response = await EXPORT();
    const body = await response.json();

    expect(body.count).toBe(1);
    const entry = body.checks[0];
    expect(entry.card.reason).toBe(RESULT_RESPONSE.reason);
    expect(entry.card.sequencingTip).toBe(checkBody.sequencingTip);
    expect(entry.promptVersion).toBe(PROMPT_VERSION);
    expect(entry.contractVersion).toBe(CONTRACT_VERSION);
  });
});

describe("append-only boundary (§12)", () => {
  it("the action handler updates actionDoneAt WITHOUT mutating any snapshot column", async () => {
    const POST = createHandler({
      floor: { floorApplied: "carbs_only", usedFallback: true }
    });
    await POST(
      checkRequest({
        "x-pal-client-id": "append-1",
        "x-pal-clarified": "1",
        "x-pal-clarify-category": "plain_or_sweetened"
      })
    );

    const [before] = await testDb.db.select().from(schema.checks);

    const ACTION = createHistoryActionHandler(asOwner());
    const response = await ACTION(
      new Request("http://test/api/history/action", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ clientId: "append-1" })
      })
    );
    expect(response.status).toBe(200);

    const [after] = await testDb.db.select().from(schema.checks);

    // The one allowed mutation happened…
    expect(after.actionDoneAt).not.toBeNull();
    // …and every snapshot field is byte-for-byte unchanged.
    expect(after.cardCiphertext).toBe(before.cardCiphertext);
    expect(after.risk).toBe(before.risk);
    expect(after.routeType).toBe(before.routeType);
    expect(after.clarifyQuestionCiphertext).toBe(
      before.clarifyQuestionCiphertext
    );
    expect(after.wasClarified).toBe(before.wasClarified);
    expect(after.promptVersion).toBe(before.promptVersion);
    expect(after.contractVersion).toBe(before.contractVersion);
    expect(after.modelId).toBe(before.modelId);
    expect(after.floorApplied).toBe(before.floorApplied);
    expect(after.usedFallback).toBe(before.usedFallback);
  });

  it("a rerun creates a NEW row rather than overwriting the old card", async () => {
    const POST = createHandler();
    // Distinct client ids → two independent snapshots (no dedupe collapse).
    await POST(checkRequest({ "x-pal-client-id": "run-a" }));
    await POST(checkRequest({ "x-pal-client-id": "run-b" }));

    const rows = await testDb.db.select().from(schema.checks);
    expect(rows).toHaveLength(2);
  });
});
