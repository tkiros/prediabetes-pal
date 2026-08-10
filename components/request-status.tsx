import type { CheckUiState } from "../lib/client/ui-state";

export function RequestStatus({
  state
}: {
  state: Extract<CheckUiState, { kind: "submitting" | "slow" | "error" }>;
}) {
  const content =
    state.kind === "submitting"
      ? {
          eyebrow: "Status",
          title: "Checking your food",
          message: "Prediabetes Pal is weighing this food against your A1C range.",
          note: "Your answer lands here in a few seconds."
        }
      : state.kind === "slow"
        ? {
            eyebrow: "Still running",
            title: "Still checking",
            message: "This one is taking a little longer than usual.",
            note: "No need to resubmit — your answer is still on its way."
          }
        : {
            eyebrow: "Check paused",
            title: "Try again on this page",
            message: state.message,
            note: "Your food and A1C are saved right here — one tap to retry."
          };

  return (
    <section
      aria-live="polite"
      role="status"
      className="status-card"
      data-state={state.kind}
      data-testid="request-status"
    >
      <p className="status-eyebrow">{content.eyebrow}</p>
      <p className="status-title">{content.title}</p>
      <p className="status-copy">{content.message}</p>
      <p className="status-note">{content.note}</p>
    </section>
  );
}
