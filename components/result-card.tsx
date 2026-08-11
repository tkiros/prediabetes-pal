import Link from "next/link";

import type {
  ClinicalRoute,
  PalRisk,
  PalUserResponse
} from "../lib/client/ui-state";
import { RISK_LABELS } from "../lib/pal/labels";
import { DisclaimerLine } from "./disclaimer-line";
import { MealMemorySave } from "./meal-memory-save";
import { ResultFeedback } from "./result-feedback";
import {
  IconAlert,
  IconArrowRight,
  IconCheck,
  IconHeart,
  IconPause
} from "./icons";

// Verdict glyphs (DESIGN.md §Icons): calm check / heads-up / pause.
const RISK_ICONS = {
  SAFE: IconCheck,
  MODERATE: IconAlert,
  HIGH: IconPause
} as const;

// §6.3 post-verdict pantry entry. The one-time Pantry Review line attaches ONLY
// to non-SAFE results ("Be careful" / "Hold off") — SAFE never piles on, and no
// non-result kind (upsell/clarify/not_food/out_of_scope/retry) carries it. This
// pure predicate is the single gate the result branch reads.
export function showPantryEntry(
  kind: PalUserResponse["kind"],
  risk?: PalRisk
): boolean {
  return kind === "result" && risk !== "SAFE";
}

// §6.1 verdict mapping lives in lib/pal/labels — one map, three surfaces.
// data-risk keeps the raw class for tests and styling.

// Clinical-route eyebrows (W-01). The message body itself is approved ledger
// copy; these are the short framing lines above it. Kept neutral and
// non-diagnostic — Prediabetes Pal names what it CANNOT do, never what the user has.
const CLINICAL_EYEBROWS: Record<ClinicalRoute, string> = {
  urgent_symptoms: "Please get help now",
  possible_hypoglycemia: "Follow your plan",
  medication_dosing: "Ask your prescriber",
  eating_disorder: "Support, not a verdict",
  pregnancy: "Outside Prediabetes Pal's scope",
  organ_disease: "Outside Prediabetes Pal's scope",
  allergy: "Prediabetes Pal cannot confirm this",
  diagnosed_diabetes: "Outside Prediabetes Pal's scope",
  pediatric: "Outside Prediabetes Pal's scope"
};

// §4D upsell variants. The branch renders the server `message` verbatim in
// both cases and only picks its own eyebrow/CTA/data-wall. The server now
// sends a structured `upsellKind`; the message sniff survives only as the
// fallback for older/cached responses that omit it.
// The legacy title's "five" mirrors FREE_DAILY_CHECKS (lib/server/entitlement)
// — result-card-upsell.test.ts pins the two together.
export function upsellVariant(
  message: string,
  upsellKind?: "trial" | "legacy"
): {
  wall: "trial" | null;
  eyebrow: string;
  title: string | null;
  cta: string;
} {
  const kind =
    upsellKind ?? (message.includes("free week") ? "trial" : "legacy");
  if (kind === "trial") {
    return {
      wall: "trial",
      eyebrow: "Where the free taste ends",
      title: null,
      cta: "Start your free week"
    };
  }
  return {
    wall: null,
    eyebrow: "Daily limit reached",
    title: "That's five for today",
    cta: "See what Premium includes"
  };
}

// The one-time Pantry Review cross-sell. Rendered by the caller AFTER the
// verdict card (its own quiet slot), gated by showPantryEntry — the offer
// never sits inside the verdict itself.
export function PantryEntry() {
  return (
    <p className="cross-sell" data-testid="pantry-entry">
      Want your whole kitchen checked once? See{" "}
      <Link className="inline-link" href="/pantry">
        the Pantry Review
      </Link>{" "}
      — one payment, nothing renews.
    </p>
  );
}

// Meal-row input-method meta ("how you told us"), quiet context only.
const METHOD_WORDS = { text: "Typed", voice: "Spoken", photo: "Photo" } as const;

export function ResultCard({
  response,
  actionDone,
  onActionDone,
  food,
  inputMethod
}: {
  response: PalUserResponse;
  actionDone?: boolean;
  onActionDone?: () => void;
  /** The checked meal text, echoed in the Meal row when the caller has it. */
  food?: string;
  inputMethod?: keyof typeof METHOD_WORDS;
}) {
  if (response.kind === "result") {
    const VerdictIcon = RISK_ICONS[response.risk];
    // Permission-first anatomy (approved direction 2026-07-19): the most
    // practical action LEADS the card; the verdict is supporting status in the
    // Signal row below. postprocess.assertNoUnsafeSafeFields guarantees SAFE
    // never carries adjustment/swap, so a SAFE card leads with its own label.
    const lead = response.adjustment ?? response.swap ?? response.keepMost;
    const hasTryRows = Boolean(
      (response.keepMost && lead !== response.keepMost) ||
        (response.swap && lead !== response.swap) ||
        response.sequencingTip ||
        response.postMealAction
    );
    return (
      <section
        aria-live="polite"
        className="result-card result-anatomy"
        data-testid="result-card"
        data-kind={response.kind}
        data-risk={response.risk}
      >
        <header className="result-permission">
          <p className="result-eyebrow">
            {lead ? "A practical next step" : "Prediabetes Pal result"}
          </p>
          <p className="result-lead">{lead ?? RISK_LABELS[response.risk]}</p>
          {/* Orientation line only — the load-bearing boundary copy stays in
              the fineprint below (ledger rows general-guidance-01 +
              result-footer), visible with the result, never behind a
              disclosure. */}
          <p className="result-boundary">A guide from your entry.</p>
        </header>
        {food ? (
          <div className="anatomy-row" data-testid="anatomy-meal">
            <span className="anatomy-label">Meal</span>
            <span className="anatomy-meal">
              {food}
              {inputMethod ? (
                <span className="anatomy-method">
                  {METHOD_WORDS[inputMethod]}
                </span>
              ) : null}
            </span>
          </div>
        ) : null}
        <div className="anatomy-row" data-risk={response.risk}>
          <span className="anatomy-label">Signal</span>
          <span
            className="anatomy-signal"
            data-risk={response.risk}
            data-testid="result-signal"
          >
            <VerdictIcon size={20} />
            {RISK_LABELS[response.risk]}
          </span>
        </div>
        <div className="anatomy-row">
          <span className="anatomy-label">Why</span>
          <p className="anatomy-copy">{response.reason}</p>
        </div>
        {hasTryRows ? (
          <div className="anatomy-row">
            <span className="anatomy-label">Try</span>
            <div className="result-list">
              {response.keepMost && lead !== response.keepMost ? (
                <p className="result-row" data-testid="keep-most">
                  <IconHeart size={16} />
                  <span>
                    <strong>Enjoy it anyway:</strong> {response.keepMost}
                  </span>
                </p>
              ) : null}
              {response.swap && lead !== response.swap ? (
                <p className="result-row">
                  <IconArrowRight size={16} />
                  <span>
                    <strong>Swap:</strong> {response.swap}
                  </span>
                </p>
              ) : null}
              {/* W-17 honest framing. These two rows used to read "Eat it in
                  this order:" and "After this meal:", which implied Prediabetes Pal had
                  picked them FOR this meal. It had not — they were the same two
                  sentences on every flagged result. The labels now say what is
                  true: these are general strategies, not a reading of your
                  plate. The lead, swap, and Why above are the meal-specific
                  parts. */}
              {response.sequencingTip ? (
                <p className="result-row" data-testid="sequencing-tip">
                  <IconArrowRight size={16} />
                  <span>
                    <strong>A pattern that helps many people:</strong>{" "}
                    {response.sequencingTip}
                  </span>
                </p>
              ) : null}
              {response.postMealAction ? (
                <div data-testid="post-meal-action">
                  <p className="result-row">
                    <IconCheck size={16} />
                    <span>
                      <strong>A calm next step:</strong>{" "}
                      {response.postMealAction}
                    </span>
                  </p>
                  {onActionDone ? (
                    actionDone ? (
                      <p
                        className="action-done-note"
                        data-testid="action-done-note"
                      >
                        Nice — logged for your week.
                      </p>
                    ) : (
                      <button
                        type="button"
                        className="action-done-button"
                        data-testid="action-done-button"
                        onClick={onActionDone}
                      >
                        I did it
                      </button>
                    )
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
        <Link className="result-how" href="/how-it-works">
          How Prediabetes Pal chooses a signal
          <IconArrowRight size={15} />
        </Link>
        <div className="result-fineprint">
          {/* `general-guidance-01` ledger row (docs/safety/copy-ledger.md): the
              T1 honesty line — verdicts are band-general, never a prediction of
              this user's own response. */}
          <p className="result-disclaimer" data-testid="general-guidance">
            These labels describe general meal patterns. Your A1C range only
            makes the presentation more cautious; Prediabetes Pal does not predict your
            individual response or decide whether a meal is medically
            appropriate for you.
          </p>
          <DisclaimerLine disclaimer={response.disclaimer} />
        </div>
        {/* RE-10: quiet honesty when fail-soft persistence dropped the row —
            never imply a history entry exists that doesn't. */}
        {response.persisted === false ? (
          <p className="field-hint" data-testid="not-saved-note" role="status">
            Heads up: this check couldn&apos;t be saved to your history, so it
            won&apos;t appear there. The guidance above is unaffected.
          </p>
        ) : null}
        {/* W-30. Sits below the disclaimer, outside the guidance itself — the
            question is about Prediabetes Pal, not about the meal. */}
        <ResultFeedback risk={response.risk} checkId={response.checkId} />
        {/* §P3.2 save-to-memory. Self-gates: renders nothing without the build
            flag, a persisted checkId, and server entitlement — so landing/demo
            cards (no checkId) never show it. Never an input to the card above. */}
        <MealMemorySave checkId={response.checkId} />
      </section>
    );
  }

  if (response.kind === "upsell") {
    const variant = upsellVariant(response.message, response.upsellKind);
    return (
      <section
        aria-live="polite"
        className="result-card"
        data-testid="result-card"
        data-kind="upsell"
        data-wall={variant.wall ?? undefined}
      >
        <p className="result-eyebrow">{variant.eyebrow}</p>
        {variant.title ? (
          <p className="status-title">{variant.title}</p>
        ) : null}
        <p className="result-copy">{response.message}</p>
        <Link className="primary-button link-button" href="/subscribe">
          {variant.cta}
        </Link>
        <DisclaimerLine disclaimer={response.disclaimer} />
      </section>
    );
  }

  // Clinical route (W-01). Rendered as its own branch, deliberately BEFORE the
  // generic ternary below — an unhandled kind falls through that chain to the
  // "Try this check again" retry card, which would invite a user reporting
  // hypoglycaemia symptoms to rephrase their meal description.
  //
  // aria-live="assertive": every other card is "polite" and waits for the
  // screen reader to finish its current utterance. This one interrupts.
  if (response.kind === "clinical") {
    return (
      <section
        aria-live="assertive"
        className="result-card"
        data-testid="result-card"
        data-kind="clinical"
        data-route={response.route}
      >
        <p className="result-eyebrow">{CLINICAL_EYEBROWS[response.route]}</p>
        <p className="status-title">This needs a person, not an app</p>
        <p className="result-copy">{response.message}</p>
        <DisclaimerLine disclaimer={response.disclaimer} />
      </section>
    );
  }

  const content =
    response.kind === "clarify"
      ? {
          eyebrow: "Need one more detail",
          title: "Prediabetes Pal needs one more detail",
          body: response.question
        }
      : response.kind === "not_food"
        ? {
            eyebrow: "Food description needed",
            title: "Enter a food or meal",
            body: `Prediabetes Pal can help once you enter a food or meal, such as ${response.examples.join(", ")}.`
          }
        : response.kind === "out_of_scope"
          ? {
              eyebrow: "Current scope",
              title: "Outside Prediabetes Pal's current A1C range",
              body: response.reason
            }
          : {
              eyebrow: "Try again",
              title: "Try this check again",
              body: response.message
            };

  return (
    <section
      aria-live="polite"
      className="result-card"
      data-testid="result-card"
      data-kind={response.kind}
    >
      <p className="result-eyebrow">{content.eyebrow}</p>
      <p className="status-title">{content.title}</p>
      <p className="result-copy">{content.body}</p>
      <DisclaimerLine disclaimer={response.disclaimer} />
    </section>
  );
}
