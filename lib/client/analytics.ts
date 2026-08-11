import type {
  ClarifyElapsedBucket,
  ClarifyReason
} from "../pal/clarify";
import type { Channel } from "./attribution";
import type {
  ClinicalRoute,
  PalRisk,
  PalUserResponse
} from "./ui-state";

/**
 * Umami analytics (plan P7; docs/adr/analytics-umami.md). A typed, closed
 * event allowlist — every prop is a bounded enum, never a free-form string —
 * so nothing from the health domain (lab values, meal descriptions, contact
 * identifiers) can reach the analytics vendor by construction. Enforced
 * further by tests/unit/client/analytics.test.ts, including a static source
 * scan for the specific field names this module must never mention.
 *
 * `track()` no-ops when the Umami script isn't loaded (no env vars set, or
 * running server-side / in tests) — callers never need to guard the call.
 */

// Closed set of response kinds the check engine can return to the client
// (lib/client/ui-state.ts — the same type check.ts normalizes onto).
type CheckResponseKind = PalUserResponse["kind"];

// Price points offered at the paywall/trial (cents-as-string, matching the
// Stripe price-lookup keys). A closed enum so no arbitrary amount reaches
// analytics — Task 2.7/4.2 import this same type for the checkout call sites.
export type PriceVariant = "999" | "1299" | "1999";

// The closed meal-memory label vocabulary (mirror of the schema/API enum). Only
// the label CLASS ever reaches analytics — never the user's note or choice text.
export type MemoryLabel =
  | "breakfast"
  | "lunch"
  | "dinner"
  | "snack"
  | "restaurant"
  | "travel"
  | "family_meal"
  | "other";

// The closed nudge trigger-class vocabulary (mirror of lib/journey/nudge
// NudgeClass). Only the class ever reaches analytics — never the nudge copy.
export type NudgeClass = "journey_step" | "weekly_learning_ready" | "generic";

// The journey stage prop shared with weekly_learning_viewed, plus "none" for a
// non-journey (generic) nudge. A closed enum — never a raw day count.
export type JourneyStageProp = "1" | "2" | "3" | "4" | "5" | "none";

// The closed pauseReason vocabulary (mirror of lib/journey/state PauseReason).
// Only the bounded CLASS reaches analytics — never free text. Kept as a local
// mirror so this client module never imports server/journey internals. NOTE the
// prop is named `pauseReason`, a distinct bounded enum — deliberately NOT the
// bare free-text carrier the no-PII source scan forbids, whose guard stays
// intact (it targets the result rationale field, never this bounded class).
export type PauseReasonProp =
  | "need_a_break"
  | "life_event"
  | "not_useful_now"
  | "other";

export type AnalyticsEvent =
  | {
      name: "check_completed";
      props: {
        risk: PalRisk;
        kind: CheckResponseKind;
        input_method: "text" | "voice" | "photo";
        // W-10/N-12: without a first-check marker the activation funnel is not
        // computable end-to-end — the north-star metric could not be measured
        // at all, only asserted.
        first_check: boolean;
      };
    }
  // W-10/N-12. The product could not measure its own three biggest risks:
  // whether people activate, whether the advice is any good, and why they
  // leave. These are the events that make each of those answerable.
  | { name: "onboarding_started" }
  | {
      // Advice quality. F-12's repetition problem is INVISIBLE in production
      // today because no feedback event exists — which is why W-17's variant
      // bank ships together with this, not before it.
      name: "result_helpful";
      props: { helpful: boolean; risk: PalRisk };
    }
  | {
      // W-01: which clinical class fired. The route id only — never the text
      // that matched it, which would be health data.
      name: "clinical_route";
      props: { route: ClinicalRoute };
    }
  | { name: "onboarding_completed" }
  | { name: "signin_completed" }
  // §P4.3/§10.1: a nudge notification was opened. The bounded trigger `class`
  // and journey `stage` only (mirrors weekly_learning_viewed) — never the copy
  // the user saw. The class + stage are read from the ?nudge/?stage params the
  // service worker opens the app with, then the params are stripped.
  | {
      name: "nudge_opened";
      props: { class: NudgeClass; stage: JourneyStageProp };
    }
  // §P4.3: the user turned reminders off. Presence-only — no props (opting out
  // is the whole signal; who/when stays out of analytics).
  | { name: "nudge_unsubscribed" }
  | { name: "paywall_viewed" }
  | { name: "subscribe_started" }
  | { name: "subscribe_completed" }
  | { name: "deletion_completed" }
  | { name: "taster_check"; props: { used: number } }
  | { name: "wall_viewed"; props: { variant: PriceVariant } }
  | { name: "trial_checkout_started"; props: { variant: PriceVariant } }
  | { name: "trial_started"; props: { variant: PriceVariant } }
  | {
      name: "pantry_viewed";
      props: { source: "landing" | "wall_decline" | "result_card" };
    }
  | { name: "pantry_checkout_started" }
  | {
      // §0.2 #6: acquisition attribution — the read every Part 10 decision
      // rule depends on. Both props are the closed Channel enum
      // (lib/client/attribution.ts); raw UTM strings are mapped onto it at
      // capture time and never stored or sent.
      name: "attribution";
      props: { reported: Channel | "skipped"; utm: Channel | "none" };
    }
  // P1.3 §10.1: the bounded-ambiguity clarify funnel. Only the ambiguity
  // `category` (which of the three deterministic prompts fired, a closed enum
  // from lib/pal/clarify.ts) and an elapsed-time bucket — never the meal
  // text or the prompt wording. Abandonment is derivable as a
  // `clarification_requested` with no matching `clarification_resolved`, so no
  // separate event is emitted. The prop is `category`, not the result's
  // rationale field, which analytics must never carry.
  | { name: "clarification_requested"; props: { category: ClarifyReason } }
  | {
      name: "clarification_resolved";
      props: { category: ClarifyReason; elapsed: ClarifyElapsedBucket };
    }
  // §P1.6/§10.1: result-linked feedback was submitted. Presence-only — the
  // single `helpful` boolean is all that reaches analytics. The structured
  // category and any private comment stay in the encrypted operational store
  // and never travel with this event (the no-PII source scan enforces it).
  | { name: "result_feedback_submitted"; props: { helpful: boolean } }
  // §P3.2/§10.1: a meal memory was saved. Memory FIELD TYPES only, never their
  // contents (plan §P3.2 "Do not ... place raw health text in analytics"). Every
  // prop is a bounded presence/enum: whether choice/note text exists (booleans,
  // not the text), the repeat preference as a closed tri-state, the favorite
  // flag, and the label CLASS or "none". The choice/note strings themselves stay
  // in the encrypted operational store and never travel with this event.
  | {
      name: "meal_memory_saved";
      props: {
        hasChoice: boolean;
        hasNote: boolean;
        wouldRepeat: "yes" | "no" | "unset";
        favorite: boolean;
        label: MemoryLabel | "none";
      };
    }
  // §P3.3/§10.1: the "Your meal memory" panel rendered below a completed check
  // with ≥1 prior saved memory that matched the just-checked meal. The ONLY prop
  // is the match CLASS — a closed enum. "exact" ships in Task 15 (exact
  // normalized-string match); "user_confirmed" is reserved for a future
  // user-confirmed-relation match and never emitted yet. No count, no meal text,
  // no band — presence of a recall at a given match class is all analytics needs.
  | { name: "meal_memory_recalled"; props: { match: "exact" | "user_confirmed" } }
  // §P4.2/§10.1: the weekly learning summary rendered. The ONLY prop is the
  // current journey STAGE — a closed "1".."5" enum (lib/journey/state). Never
  // the artifact contents: `repeatedUncertainty` echoes the user's own meal text
  // and stays in the encrypted operational store, never in analytics. The event
  // only fires when a stage exists (an active journey); a summary viewed with no
  // journey emits nothing.
  | { name: "weekly_learning_viewed"; props: { stage: "1" | "2" | "3" | "4" | "5" } }
  // §P4.4/§10.1: the user paused their journey. Bounded props only — the current
  // journey STAGE ("1".."5"; a paused journey always has a stage) and the closed
  // pauseReason CLASS. Never a day count, never free text. Pausing is a
  // legitimate outcome (global constraint §9), not a failure.
  | {
      name: "journey_paused";
      props: {
        stage: "1" | "2" | "3" | "4" | "5";
        pauseReason: PauseReasonProp;
      };
    }
  // §P4.4/§10.1: the user graduated (a SUCCESS outcome — global constraint §9).
  // The ONLY prop is the completed-stage COUNT as a closed "0".."5" bucket
  // (lib/journey/state.completedStages, clamped) — never a day count or any
  // health data.
  | {
      name: "journey_graduated";
      props: { completedStages: "0" | "1" | "2" | "3" | "4" | "5" };
    }
  // §P4.4/§10.1: the user chose to continue in maintenance mode. The ONLY prop is
  // the bounded offer `variant` — "standard" today (price experiments are
  // human-gated; no price reaches analytics).
  | { name: "maintenance_selected"; props: { variant: "standard" } }
  | { name: "photo_draft"; props: { items: number; uncertain: number } };

// Runtime belt-over-type-belt guard: even if a caller bypasses the type
// system (e.g. `track(untyped)`), only these names are ever forwarded.
//
// NOTE this Set and the union above are two hand-maintained copies of the same
// list: an event added to the union but not here typechecks fine and then
// silently drops at runtime. analytics.test.ts asserts the two agree.
const ALLOWED_EVENT_NAMES: ReadonlySet<AnalyticsEvent["name"]> = new Set([
  "check_completed",
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
]);

type AnalyticsHost = {
  umami?: {
    track: (eventName: string, data?: Record<string, unknown>) => void;
  };
};

declare global {
  interface Window {
    umami?: AnalyticsHost["umami"];
  }
}

// `host` defaults to `window` (digital-goods.ts's injection convention) so
// call sites never pass it — it exists purely so tests can supply a fake
// `umami` without touching the global in a Node (non-jsdom) test environment.
export function track(
  event: AnalyticsEvent,
  host: AnalyticsHost = typeof window === "undefined" ? {} : window
): void {
  if (!host.umami) {
    return;
  }

  if (!ALLOWED_EVENT_NAMES.has(event.name)) {
    return;
  }

  const props = "props" in event ? event.props : undefined;
  host.umami.track(event.name, props);
}
