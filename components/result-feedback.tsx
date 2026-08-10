"use client";

import { useState } from "react";

import { track } from "../lib/client/analytics";
import {
  FEEDBACK_COMMENT_MAX,
  FEEDBACK_REASON_OPTIONS,
  resolveFeedbackSend,
  submitResultFeedback,
  type FeedbackReason
} from "../lib/client/feedback";
import type { RevoraRisk } from "../lib/client/ui-state";

/**
 * "Was this practical?" (W-30 / §P1.6).
 *
 * Two layers, by design:
 *
 *  - Aggregate (all users, guests included): a boolean + risk class via the
 *    `result_helpful` analytics event. No free text ever reaches the vendor —
 *    the event allowlist makes that impossible by construction.
 *
 *  - Result-linked structured feedback (signed-in, persisted checks only —
 *    i.e. when a `checkId` is present): a "Not really" answer opens bounded
 *    reason chips and an optional private comment, POSTed to /api/feedback. The
 *    reason and the comment live only in the access-controlled operational
 *    store (the comment encrypted at rest); analytics gets `result_feedback_
 *    submitted` with presence only (`helpful`), never the reason or the text.
 *
 * Guests keep the exact anonymous two-tap behavior — no API call. One-shot,
 * dismissible, no nagging (constraint §9).
 */
export function ResultFeedback({
  risk,
  checkId
}: {
  risk: RevoraRisk;
  checkId?: string;
}) {
  const [step, setStep] = useState<"ask" | "reason" | "done">("ask");
  const [helpful, setHelpful] = useState<boolean | null>(null);
  const [reason, setReason] = useState<FeedbackReason | null>(null);
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);
  const [sendFailed, setSendFailed] = useState(false);

  if (step === "done") {
    return (
      <p className="feedback-thanks" data-testid="result-feedback-thanks">
        {helpful
          ? "Good — that's the point."
          : "Noted. Prediabetes Pal will keep working on it."}
      </p>
    );
  }

  // Aggregate signal for every user; structured POST only when the check was
  // persisted (checkId present). Emitting the presence-only submitted event is
  // gated on the POST succeeding. Resolves the POST ok so the SAFETY report path
  // (onSendReason) can await it and surface an honest failure — a guest with no
  // checkId has nothing to send and resolves true (nothing failed).
  async function sendStructured(input: {
    helpful: boolean;
    reason?: FeedbackReason;
    comment?: string;
  }): Promise<boolean> {
    if (!checkId) {
      return true;
    }
    const ok = await submitResultFeedback(checkId, input);
    if (ok) {
      track({ name: "result_feedback_submitted", props: { helpful: input.helpful } });
    }
    return ok;
  }

  function onYes() {
    setHelpful(true);
    track({ name: "result_helpful", props: { helpful: true, risk } });
    void sendStructured({ helpful: true });
    setStep("done");
  }

  function onNo() {
    setHelpful(false);
    track({ name: "result_helpful", props: { helpful: false, risk } });
    // Signed-in persisted checks get the structured follow-up; guests stop here.
    setStep(checkId ? "reason" : "done");
  }

  // SAFETY report path: await the submit and be honest about the outcome. A
  // failed send KEEPS the reason view with a working Send and shows a retry hint
  // — it must never acknowledge ("Noted.") a report that never reached us.
  async function onSendReason() {
    setSending(true);
    setSendFailed(false);
    const ok = await sendStructured({
      helpful: false,
      reason: reason ?? undefined,
      comment: comment || undefined
    });
    const resolved = resolveFeedbackSend(ok);
    setSending(false);
    setSendFailed(resolved.failed);
    setStep(resolved.step);
  }

  if (step === "reason") {
    return (
      <div className="result-feedback" data-testid="result-feedback-reason">
        <p className="feedback-prompt" id="feedback-reason-prompt">
          What was off? (optional)
        </p>
        <div
          className="feedback-reasons"
          role="group"
          aria-labelledby="feedback-reason-prompt"
        >
          {FEEDBACK_REASON_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className="feedback-chip"
              aria-pressed={reason === option.value}
              data-testid={`feedback-reason-${option.value}`}
              onClick={() =>
                setReason((current) =>
                  current === option.value ? null : option.value
                )
              }
            >
              {option.label}
            </button>
          ))}
        </div>
        <label className="feedback-comment-label" htmlFor="feedback-comment">
          Anything you want to add stays private (optional)
        </label>
        <textarea
          id="feedback-comment"
          className="feedback-comment"
          data-testid="feedback-comment"
          maxLength={FEEDBACK_COMMENT_MAX}
          value={comment}
          onChange={(event) => setComment(event.target.value.slice(0, FEEDBACK_COMMENT_MAX))}
          rows={2}
        />
        {sendFailed ? (
          <p
            className="field-error"
            data-testid="feedback-send-error"
            role="alert"
          >
            Couldn&apos;t send that — please try again.
          </p>
        ) : null}
        <div className="feedback-buttons">
          <button
            type="button"
            className="feedback-button"
            data-testid="feedback-send"
            onClick={() => void onSendReason()}
            disabled={sending}
          >
            {sending ? "Sending…" : sendFailed ? "Try again" : "Send"}
          </button>
          <button
            type="button"
            className="feedback-skip"
            data-testid="feedback-skip"
            onClick={() => setStep("done")}
            disabled={sending}
          >
            Skip
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="result-feedback" data-testid="result-feedback">
      <p className="feedback-prompt" id="feedback-prompt">
        Was this practical?
      </p>
      <div className="feedback-buttons" role="group" aria-labelledby="feedback-prompt">
        <button
          className="feedback-button"
          data-testid="feedback-yes"
          onClick={onYes}
          type="button"
        >
          Yes
        </button>
        <button
          className="feedback-button"
          data-testid="feedback-no"
          onClick={onNo}
          type="button"
        >
          Not really
        </button>
      </div>
    </div>
  );
}
