import type { StoredCheck } from "../lib/client/history-store";
import { RISK_LABELS } from "../lib/pal/labels";

export function TodayList({ checks }: { checks: StoredCheck[] }) {
  if (checks.length === 0) {
    return (
      <p className="page-copy" data-testid="today-empty">
        No checks yet today — your next meal is a fresh start.
      </p>
    );
  }

  return (
    <ul className="today-list" data-testid="today-list">
      {checks.map((check) => (
        <li key={check.clientId} className="today-item" data-risk={check.risk}>
          <span className="today-food">{check.food}</span>
          <span className="today-risk" data-risk={check.risk}>
            {RISK_LABELS[check.risk]}
          </span>
        </li>
      ))}
    </ul>
  );
}
