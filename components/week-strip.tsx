import type { VerdictWeekDay } from "../lib/coach/days";
import { RISK_LABELS } from "../lib/pal/labels";
import { IconAlert, IconCheck, IconPause } from "./icons";

/**
 * The verdict week strip (DESIGN.md §Progress surfaces): reassurance, not
 * gamification. Lived on the Home dashboard until the C7 four-jobs
 * restructure (2026-07-21) moved it into /journey's "Your week" section —
 * extracted here so both the journey page and the guest fallback share one
 * implementation. Unchecked days are neutral, never "missed"; shape carries
 * the signal (icons) for colorblind users; per-day sr-only sentences.
 */

const DAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"] as const;
const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday"
] as const;


function DayMark({ day }: { day: VerdictWeekDay }) {
  if (!day.risk) {
    return (
      <span aria-hidden="true" className="dash-daymark">
        <span className="dash-day-dot" />
      </span>
    );
  }
  const Icon =
    day.risk === "SAFE" ? IconCheck : day.risk === "MODERATE" ? IconAlert : IconPause;
  return (
    <span aria-hidden="true" className="dash-daymark" data-risk={day.risk}>
      <Icon size={15} />
    </span>
  );
}

export function WeekStrip({
  week,
  isDay0
}: {
  week: VerdictWeekDay[];
  isDay0: boolean;
}) {
  const todayKey = week[week.length - 1]?.key;

  return (
    <div data-testid="dash-week-wrap">
      <ol className="dash-week" data-testid="dash-week">
        {week.map((day) => {
          const date = new Date(`${day.key}T00:00:00`);
          const dayName = DAY_NAMES[date.getDay()];
          const srText = day.risk
            ? `${dayName} — checked, most careful verdict ${RISK_LABELS[day.risk].toLowerCase()}`
            : `${dayName} — no meals checked`;
          return (
            <li
              key={day.key}
              className="dash-day"
              data-today={day.key === todayKey || undefined}
            >
              <span aria-hidden="true" className="dash-day-dow">
                {DAY_LETTERS[date.getDay()]}
              </span>
              <DayMark day={day} />
              <span className="sr-only">{srText}</span>
            </li>
          );
        })}
      </ol>
      {isDay0 ? (
        <p className="dash-preview-note" data-testid="dash-day0-note">
          Your week fills in here as you check meals. Each day shows its most
          careful verdict — quiet on days you don&apos;t check, never marked
          against you.
        </p>
      ) : (
        <div className="dash-week-legend" aria-hidden="true">
          <span className="dash-legend-item">
            <span className="dash-legend-mark" data-risk="SAFE">
              <IconCheck size={11} />
            </span>
            {RISK_LABELS.SAFE}
          </span>
          <span className="dash-legend-item">
            <span className="dash-legend-mark" data-risk="MODERATE">
              <IconAlert size={11} />
            </span>
            {RISK_LABELS.MODERATE}
          </span>
          <span className="dash-legend-item">
            <span className="dash-legend-mark" data-risk="HIGH">
              <IconPause size={11} />
            </span>
            {RISK_LABELS.HIGH}
          </span>
          <span className="dash-legend-item">
            <span className="dash-legend-mark" data-none="">
              <span className="dash-day-dot" />
            </span>
            No check
          </span>
        </div>
      )}
    </div>
  );
}
