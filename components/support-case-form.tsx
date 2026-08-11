"use client";

import { useState } from "react";

import {
  SUPPORT_EMAIL,
  SUPPORT_MESSAGE_MAX as MESSAGE_MAX
} from "../lib/pal/contact";

/**
 * P0.4: the in-account "Help & refunds" door (C7 plan §9 + design-review D3/#9).
 * Submits to /api/support/case; the row is the source of truth, so the
 * confirmation shows the case id even when the notification email failed —
 * with the direct-address fallback named for that case.
 */
export function SupportCaseForm() {
  const [kind, setKind] = useState<"help" | "refund">("help");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ caseId: string; emailed: boolean } | null>(
    null
  );

  const overCap = message.length > MESSAGE_MAX;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting || overCap || message.trim().length === 0) {
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/support/case", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind, message: message.trim() })
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(
          body?.error ??
            `Something went wrong. Email ${SUPPORT_EMAIL} directly and we'll take it from there.`
        );
        return;
      }
      const body = (await response.json()) as {
        caseId: string;
        emailed: boolean;
      };
      setDone(body);
      setMessage("");
    } catch {
      setError(
        `Something went wrong. Email ${SUPPORT_EMAIL} directly and we'll take it from there.`
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    const shortId = done.caseId.slice(0, 8);
    return (
      <div data-testid="support-case-done">
        <p className="page-copy">
          Case <strong>#{shortId}</strong> received. We reply by email within
          2 business days.
        </p>
        {!done.emailed ? (
          <p className="field-hint">
            If you don&apos;t hear back, email {SUPPORT_EMAIL} directly and
            mention case #{shortId}.
          </p>
        ) : null}
        <button
          type="button"
          className="recheck-button"
          onClick={() => setDone(null)}
        >
          Send another message
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} data-testid="support-case-form">
      <div className="field-stack">
        <label className="field-label" htmlFor="support-kind">
          What do you need?
        </label>
        <select
          id="support-kind"
          className="text-input"
          value={kind}
          disabled={submitting}
          onChange={(event) =>
            setKind(event.target.value === "refund" ? "refund" : "help")
          }
        >
          <option value="help">Help with something</option>
          <option value="refund">Request a refund</option>
        </select>
        {kind === "refund" ? (
          <p className="field-hint" data-testid="refund-window-hint">
            Web purchases are refundable within the window described in our{" "}
            <a href="/terms">terms</a>; Google Play purchases go through Google
            first. Tell us what happened and we&apos;ll sort it out.
          </p>
        ) : null}
      </div>
      <div className="field-stack">
        <label className="field-label" htmlFor="support-message">
          Your message
        </label>
        <textarea
          id="support-message"
          className="text-input"
          rows={4}
          value={message}
          disabled={submitting}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="What happened, and what would you like us to do?"
        />
        <p
          className={overCap ? "field-error" : "field-hint"}
          data-testid="support-char-count"
        >
          {message.length}/{MESSAGE_MAX}
          {overCap ? " — shorten your message to send it." : ""}
        </p>
      </div>
      {error ? (
        <p className="field-error" data-testid="support-case-error">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        className="primary-button"
        disabled={submitting || overCap || message.trim().length === 0}
        data-testid="support-case-submit"
      >
        {submitting ? "Sending…" : "Send to support"}
      </button>
      <p className="field-hint">We reply by email within 2 business days.</p>
    </form>
  );
}
