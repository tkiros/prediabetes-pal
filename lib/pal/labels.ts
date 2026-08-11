/**
 * Single source of truth for the verdict labels the user actually reads.
 *
 * The card speaks calm decisions; the engine speaks risk classes. This map was
 * previously copy-pasted into three files (result-card, today-list, history) —
 * which made the copy-ledger guarantee unenforceable, because a relabel could
 * land on two surfaces and miss the third (N-20).
 *
 * Relabeling these is a product + dietitian decision (F-08 / W-15), not a
 * unilateral copy edit. Change them here and every surface moves atomically.
 */
export const RISK_LABELS = {
  SAFE: "Clear",
  MODERATE: "Be careful",
  HIGH: "Hold off"
} as const;

export type RiskLabel = (typeof RISK_LABELS)[keyof typeof RISK_LABELS];
