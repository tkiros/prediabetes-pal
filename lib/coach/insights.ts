import type { StoredCheck } from "../client/history-store";
import { RISK_LABELS } from "../pal/labels";
import { longitudinalInsightsEnabled } from "../longitudinal-insights-flag";

/**
 * Rule-based insights (plan P3, F11). Pure rules over StoredCheck[] — no
 * model, no numbers, and forward-permission framing only: the insight always
 * points at the easiest next win, never back at a failure. Reused verbatim
 * by the server-side coach compute in 4C.
 *
 * Every rule here MUST read `check.risk`. The repeat-meal rule originally did
 * not (F-13), so it congratulated a user on "a steady choice" for a meal the
 * app had just told them to hold off on — the product affirmatively endorsing
 * a habit it classified high-risk. A rule that speaks about a user's meals
 * without consulting the verdict attached to them can always invert like that.
 */

export type CoachInsight = {
  id: "daypart" | "repeat_meal" | "repeat_meal_risk";
  text: string;
};

export const MIN_CHECKS_FOR_INSIGHT = 5;
const MIN_CAREFUL_FOR_DAYPART = 3;
const MIN_REPEATS_FOR_MEAL = 3;

export type Daypart = "breakfast" | "lunch" | "dinner";

export type InsightOptions = {
  // Hour extractor — defaults to the device-local hour; the server passes a
  // profile-timezone extractor (lib/coach/days.ts hourInTimezone) so dayparts
  // match what the user experienced.
  hourOf?: (createdAt: string) => number;
};

/**
 * The single definition of a daypart boundary. The coach phrase bank (W-17)
 * conditions on this too, and two copies of "when is breakfast" would drift —
 * the same triplication that made the verdict labels unauditable (N-20).
 */
export function daypartOfHour(hour: number): Daypart {
  if (hour < 11) {
    return "breakfast";
  }
  if (hour < 16) {
    return "lunch";
  }
  return "dinner";
}

function daypartOf(createdAt: string, hourOf?: InsightOptions["hourOf"]): Daypart {
  return daypartOfHour(
    hourOf ? hourOf(createdAt) : new Date(createdAt).getHours()
  );
}

export function deriveInsight(
  checks: StoredCheck[],
  options: InsightOptions = {}
): CoachInsight | null {
  if (!longitudinalInsightsEnabled()) {
    return null;
  }

  if (checks.length < MIN_CHECKS_FOR_INSIGHT) {
    return null;
  }

  const daypart = deriveDaypartInsight(checks, options);
  if (daypart) {
    return daypart;
  }

  return deriveRepeatMealInsight(checks);
}

function deriveDaypartInsight(
  checks: StoredCheck[],
  options: InsightOptions
): CoachInsight | null {
  const careful = checks.filter(
    (check) => check.risk === "MODERATE" || check.risk === "HIGH"
  );

  if (careful.length < MIN_CAREFUL_FOR_DAYPART) {
    return null;
  }

  const counts = new Map<Daypart, number>();
  for (const check of careful) {
    const part = daypartOf(check.createdAt, options.hourOf);
    counts.set(part, (counts.get(part) ?? 0) + 1);
  }

  const [topPart, topCount] = [...counts.entries()].sort(
    (a, b) => b[1] - a[1]
  )[0];

  // Only speak when the pattern is a real majority, not noise.
  if (topCount < Math.ceil(careful.length / 2)) {
    return null;
  }

  // The set counted above is MODERATE ∪ HIGH, but the copy used to call all of
  // them "'be careful' meals" — which is the MODERATE label. A user whose
  // flagged meals were all HIGH ("Hold off") was told they were merely
  // be-careful ones, so the insight under-reported its own severity. Naming
  // both labels, from the single label source, keeps the sentence true through
  // any future relabel (W-15).
  const moderate = RISK_LABELS.MODERATE.toLowerCase();
  const high = RISK_LABELS.HIGH.toLowerCase();

  return {
    id: "daypart",
    text: `Most of your '${moderate}' and '${high}' meals were at ${topPart} — that is the pattern showing up most often this week.`
  };
}

function deriveRepeatMealInsight(checks: StoredCheck[]): CoachInsight | null {
  const repeatedSafe = topRepeat(checks.filter((check) => check.risk === "SAFE"));

  if (repeatedSafe) {
    return {
      id: "repeat_meal",
      text: `${capitalize(repeatedSafe)} is one of your go-to meals — a steady choice you already know makes the daily decision easy.`
    };
  }

  // A meal that keeps coming back AND keeps getting flagged is the single
  // highest-leverage thing this user could change — so it earns an insight,
  // just never a compliment. Forward-permission framing: points at the next
  // win, does not scold the past.
  const repeatedFlagged = topRepeat(
    checks.filter((check) => check.risk === "MODERATE" || check.risk === "HIGH")
  );

  if (repeatedFlagged) {
    return {
      id: "repeat_meal_risk",
      text: `${capitalize(repeatedFlagged)} keeps coming up — this is where one swap pays off most.`
    };
  }

  return null;
}

/** Most-frequent food among the given checks, if any hits the repeat floor. */
function topRepeat(checks: StoredCheck[]): string | null {
  const counts = new Map<string, number>();
  for (const check of checks) {
    const key = check.food.trim().toLowerCase();
    if (key.length === 0) {
      continue; // server rows carry no plaintext food — rule stays client-side
    }
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const repeated = [...counts.entries()]
    .filter(([, count]) => count >= MIN_REPEATS_FOR_MEAL)
    .sort((a, b) => b[1] - a[1])[0];

  return repeated ? repeated[0] : null;
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
