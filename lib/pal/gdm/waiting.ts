const DAY_MS = 86_400_000;

/** Whole days from the Unix epoch to `date`; null when `date` is not a real YYYY-MM-DD. */
export function isoDayNumber(text: string | null): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text ?? "");
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  // Validate that the date is real by reconstructing it
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) {
    return null;
  }

  return Math.floor(Date.UTC(year, month - 1, day) / DAY_MS);
}

/** Whole days from `today` to `date`; null when either is not a real YYYY-MM-DD. */
function daysUntil(date: string | null, today: string): number | null {
  const then = isoDayNumber(date);
  const now = isoDayNumber(today);
  return then === null || now === null ? null : then - now;
}

export type WaitingState = "waiting" | "after_appointment" | "ended";

export function waitingState(input: { hasCurrentPlan: boolean; appointmentDate: string | null; today: string }): WaitingState {
  if (input.hasCurrentPlan) return "ended";
  const days = daysUntil(input.appointmentDate, input.today);
  return days !== null && days < 0 ? "after_appointment" : "waiting";
}

export type AppointmentPhrase = "today" | "tomorrow" | "thisWeek" | "nextWeek" | "later" | "none";

export function appointmentPhrase(appointmentDate: string | null, today: string): AppointmentPhrase {
  const days = daysUntil(appointmentDate, today);
  if (days === null || days < 0) return "none";
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days <= 6) return "thisWeek";
  if (days <= 13) return "nextWeek";
  return "later";
}

export function summaryOfferDue(appointmentDate: string | null, today: string): boolean {
  const days = daysUntil(appointmentDate, today);
  return days === 0 || days === 1;
}
