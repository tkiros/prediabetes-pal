import fs from "node:fs";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import { track, type AnalyticsEvent } from "../../../lib/client/analytics";

const ALLOWED_NAMES = [
  "check_completed",
  // W-10/N-12: activation funnel, advice quality, and clinical routing were all
  // uninstrumented — the product could not measure its own biggest risks.
  "onboarding_started",
  "result_helpful",
  "clinical_route",
  "onboarding_completed",
  "signin_completed",
  "nudge_opened",
  "nudge_unsubscribed",
  "paywall_viewed",
  "subscribe_started",
  "subscribe_completed",
  "deletion_completed",
  "taster_check",
  "wall_viewed",
  "trial_checkout_started",
  "trial_started",
  "pantry_viewed",
  "pantry_checkout_started",
  "attribution",
  "ideas_shown",
  "idea_tapped",
  "idea_check_completed",
  "onboarding_step",
  "orientation_step_done",
  "orientation_dismissed",
  "learn_opened",
  "photo_draft",
  "result_feedback_submitted",
  "clarification_requested",
  "clarification_resolved",
  "meal_memory_saved",
  "meal_memory_recalled",
  "weekly_learning_viewed",
  "journey_paused",
  "journey_graduated",
  "maintenance_selected"
] as const;

// (a) Compile-time exhaustiveness: this switch must handle every member of
// AnalyticsEvent["name"]. If a new event name is added to the union without
// being added here too, TypeScript fails the build (no default case, and
// the `never` assignment below is unreachable unless the switch is total).
function assertExhaustive(name: AnalyticsEvent["name"]): void {
  switch (name) {
    case "check_completed":
    case "onboarding_completed":
    case "signin_completed":
    case "nudge_opened":
    case "nudge_unsubscribed":
    case "paywall_viewed":
    case "subscribe_started":
    case "subscribe_completed":
    case "deletion_completed":
    case "taster_check":
    case "wall_viewed":
    case "trial_checkout_started":
    case "trial_started":
    case "pantry_viewed":
    case "pantry_checkout_started":
    case "attribution":
    case "ideas_shown":
    case "idea_tapped":
    case "idea_check_completed":
    case "onboarding_step":
    case "orientation_step_done":
    case "orientation_dismissed":
    case "learn_opened":
    case "photo_draft":
    case "result_feedback_submitted":
    case "onboarding_started":
    case "result_helpful":
    case "clinical_route":
    case "clarification_requested":
    case "clarification_resolved":
    case "meal_memory_saved":
    case "meal_memory_recalled":
    case "weekly_learning_viewed":
    case "journey_paused":
    case "journey_graduated":
    case "maintenance_selected":
      return;
    default: {
      const exhaustiveCheck: never = name;
      throw new Error(`Unhandled analytics event name: ${exhaustiveCheck}`);
    }
  }
}
void assertExhaustive;

describe("AnalyticsEvent allowlist", () => {
  it("the runtime schema list is exactly the type's name union (compile- and run-time)", () => {
    // One literal per union member — if AnalyticsEvent gains/loses a
    // variant, this array (and the exhaustiveness switch above) stop
    // compiling until updated.
    const oneOfEach: AnalyticsEvent[] = [
      {
        name: "check_completed",
        props: { risk: "SAFE", kind: "result", input_method: "text", first_check: false }
      },
      { name: "onboarding_started" },
      {
        name: "result_helpful",
        props: { helpful: true, risk: "MODERATE" }
      },
      {
        name: "clinical_route",
        props: { route: "possible_hypoglycemia" }
      },
      { name: "onboarding_completed" },
      { name: "signin_completed" },
      {
        name: "nudge_opened",
        props: { class: "journey_step", stage: "1" }
      },
      { name: "nudge_unsubscribed" },
      { name: "paywall_viewed" },
      { name: "subscribe_started" },
      { name: "subscribe_completed" },
      { name: "deletion_completed" },
      { name: "taster_check", props: { used: 3 } },
      { name: "wall_viewed", props: { variant: "1299" } },
      { name: "trial_checkout_started", props: { variant: "1299" } },
      { name: "trial_started", props: { variant: "999" } },
      { name: "pantry_viewed", props: { source: "wall_decline" } },
      { name: "pantry_checkout_started" },
      { name: "attribution", props: { reported: "reddit", utm: "none" } },
      { name: "ideas_shown", props: { daypart: "dinner", surface: "home" } },
      { name: "idea_tapped", props: { daypart: "breakfast", slot: "2", surface: "home" } },
      { name: "idea_check_completed", props: { risk: "SAFE" } },
      { name: "onboarding_step", props: { step: "attribution" } },
      { name: "orientation_step_done", props: { step: "5" } },
      { name: "orientation_dismissed" },
      { name: "learn_opened", props: { page: "first-week", from: "step" } },
      { name: "photo_draft", props: { items: 3, uncertain: 1 } },
      { name: "result_feedback_submitted", props: { helpful: true } },
      {
        name: "clarification_requested",
        props: { category: "plain_or_sweetened" }
      },
      {
        name: "clarification_resolved",
        props: { category: "underspecified", elapsed: "lt60s" }
      },
      {
        name: "meal_memory_saved",
        props: {
          hasChoice: true,
          hasNote: false,
          wouldRepeat: "yes",
          favorite: true,
          label: "breakfast"
        }
      },
      { name: "meal_memory_recalled", props: { match: "exact" } },
      { name: "weekly_learning_viewed", props: { stage: "3" } },
      {
        name: "journey_paused",
        props: { stage: "5", pauseReason: "need_a_break" }
      },
      { name: "journey_graduated", props: { completedStages: "5" } },
      { name: "maintenance_selected", props: { variant: "standard" } }
    ];

    expect(oneOfEach.map((event) => event.name).sort()).toEqual(
      [...ALLOWED_NAMES].sort()
    );
    expect(oneOfEach).toHaveLength(ALLOWED_NAMES.length);
  });
});

describe("track()", () => {
  it("calls window.umami.track for an allowlisted event", () => {
    const calls: Array<[string, Record<string, unknown> | undefined]> = [];
    const host = {
      umami: {
        track: (name: string, data?: Record<string, unknown>) => {
          calls.push([name, data]);
        }
      }
    };

    track({ name: "paywall_viewed" }, host);

    expect(calls).toEqual([["paywall_viewed", undefined]]);
  });

  it("forwards props for a props-carrying event", () => {
    const calls: Array<[string, Record<string, unknown> | undefined]> = [];
    const host = {
      umami: {
        track: (name: string, data?: Record<string, unknown>) => {
          calls.push([name, data]);
        }
      }
    };

    track(
      {
        name: "check_completed",
        props: { risk: "MODERATE", kind: "result", input_method: "voice", first_check: false }
      },
      host
    );

    expect(calls).toEqual([
      [
        "check_completed",
        {
          risk: "MODERATE",
          kind: "result",
          input_method: "voice",
          first_check: false
        }
      ]
    ]);
  });

  it("no-ops when umami is absent (no script loaded — dev/test/no env vars)", () => {
    expect(() => track({ name: "signin_completed" }, {})).not.toThrow();
  });

  it("no-ops server-side / when window is unavailable (no host argument, Node test env)", () => {
    expect(() => track({ name: "onboarding_completed" })).not.toThrow();
  });

  // (b) Runtime guard: a name that bypasses the type system must never reach
  // umami.track — the belt under the type-level belt.
  it("does not call umami.track for a non-allowlisted event name", () => {
    const calls: Array<[string, Record<string, unknown> | undefined]> = [];
    const host = {
      umami: {
        track: (name: string, data?: Record<string, unknown>) => {
          calls.push([name, data]);
        }
      }
    };

    track(
      { name: "definitely_not_allowlisted" } as unknown as AnalyticsEvent,
      host
    );

    expect(calls).toEqual([]);
  });
});

// (c) Static source scan: the module must never reference the specific
// field names that would carry health data or an identifier off-device.
// "text" alone is excluded — it is the legitimate closed-enum value of
// input_method ("text" | "voice"), not a free-text field name; the
// free-text carriers (reason/question/message/etc.) are checked directly.
describe("analytics module source — no-PII static scan", () => {
  const SOURCE = fs.readFileSync(
    path.join(process.cwd(), "lib/client/analytics.ts"),
    "utf8"
  );

  const FORBIDDEN_IDENTIFIERS = [
    "a1c",
    "food",
    "email",
    "reason",
    "question",
    "message",
    "disclaimer",
    "swap",
    "adjustment",
    "examples",
    "sequencingTip",
    "postMealAction"
  ];

  it.each(FORBIDDEN_IDENTIFIERS)(
    "never references the free-text/PII-carrying field %s",
    (identifier) => {
      const pattern = new RegExp(`\\b${identifier}\\b`, "i");
      const lines = SOURCE.split("\n");
      const offendingLine = lines.findIndex((line) => pattern.test(line));

      if (offendingLine !== -1) {
        const lineNum = offendingLine + 1;
        const lineContent = lines[offendingLine]?.trim();
        throw new Error(
          `Found forbidden identifier '${identifier}' at line ${lineNum}: ${lineContent}. Note: comments count — write 'idea' or 'meal' instead.`
        );
      }
    }
  );
});

// (d) Every declared prop on every event is a bounded union/enum, never a
// bare `string` — except `kind`, which is the closed response-kind enum
// re-exported from the check schema (lib/client/ui-state.ts).
describe("AnalyticsEvent props stay closed unions (no free-text props)", () => {
  const SOURCE = fs.readFileSync(
    path.join(process.cwd(), "lib/client/analytics.ts"),
    "utf8"
  );

  it("declares no bare `: string` prop type in the AnalyticsEvent union; insert new union members before the `photo_draft` variant", () => {
    const typeBlockStart = SOURCE.indexOf("export type AnalyticsEvent =");
    // Ruling F-17: the slice ends at the declaration that follows the union,
    // not at a literal of whichever variant happens to be last — a variant
    // appended after that literal used to escape this scan entirely. The
    // union ends before this marker whatever order its members are in.
    const endMarker = "const ALLOWED_EVENT_NAMES";
    const typeBlockEndIndex = SOURCE.indexOf(endMarker, typeBlockStart);
    expect(typeBlockStart).toBeGreaterThanOrEqual(0);
    expect(typeBlockEndIndex).toBeGreaterThan(typeBlockStart);

    const typeBlock = SOURCE.slice(typeBlockStart, typeBlockEndIndex);

    // Sanity checks: the slice captured the nested check_completed props
    // object, and it reaches the union's last variant (photo_draft), so it
    // cannot have been truncated at a nested `};`.
    expect(typeBlock).toContain("input_method");
    expect(typeBlock).toContain('"photo_draft"');

    // A bare `: string` (not part of a longer identifier, not a generic
    // type argument like `Record<string, unknown>`) would mean a prop
    // accepts arbitrary free text.
    expect(typeBlock).not.toMatch(/:\s*string(?!\w)/);
    // Insert new union members before the `photo_draft` variant
  });

  it("check_completed's props are exactly risk / kind / input_method / first_check, each a closed union", () => {
    const sample: Extract<AnalyticsEvent, { name: "check_completed" }> = {
      name: "check_completed",
      props: { risk: "HIGH", kind: "clarify", input_method: "text", first_check: false }
    };

    expect(Object.keys(sample.props).sort()).toEqual(
      ["first_check", "input_method", "kind", "risk"].sort()
    );
  });
});

describe("orientation and Learn events (Task 3.6)", () => {
  it.each([
    [{ name: "orientation_step_done", props: { step: "2" } }],
    [{ name: "orientation_dismissed" }],
    [{ name: "learn_opened", props: { page: "first-week", from: "step" } }]
  ] as const)("forwards %j to umami", (event) => {
    const umami = { track: vi.fn() };
    track(event as never, { umami });
    expect(umami.track).toHaveBeenCalledWith(event.name, "props" in event ? event.props : undefined);
  });
});

describe("launch funnel events", () => {
  it.each([
    [{ name: "taster_check", props: { used: 3 } }],
    [{ name: "wall_viewed", props: { variant: "1299" } }],
    [{ name: "trial_checkout_started", props: { variant: "1299" } }],
    [{ name: "trial_started", props: { variant: "999" } }],
    [{ name: "pantry_viewed", props: { source: "wall_decline" } }],
    [{ name: "pantry_checkout_started" }]
  ] as const)("forwards %j to umami", (event) => {
    const umami = { track: vi.fn() };
    track(event as never, { umami });
    expect(umami.track).toHaveBeenCalledWith(event.name, "props" in event ? event.props : undefined);
  });
});
