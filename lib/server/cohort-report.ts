/**
 * Pre-registered retention cohort report — counts only.
 *
 * Companion to docs/research/retention-cohort-preregistration.md. That protocol
 * leaves its §4.4/§4.5 activity definitions blank for the owner to fill BEFORE
 * the first participant enrolls. The definitions below are the agent's
 * PROPOSAL for those blanks, computable from `subscriptions` and
 * `learning_journeys` alone (no meal text, no emails, no user ids leave this
 * module). They are printed in every report so a reader can see exactly what
 * was measured; the owner may pre-register them as-is or replace them.
 *
 * Pure function: rows in, aggregate counts out. The DB query lives in
 * `queryCohortRows` so a PGlite test can prove the SQL matches the schema and
 * the production script (scripts/cohort-report.mts) stays a thin shell.
 */
import { isNotNull } from "drizzle-orm";

import type { Db } from "./db";
import * as schema from "./db/schema";

export const DEFINITIONS = [
  "Cohort entry (trial start) = subscriptions.terms_accepted_at within [cohortStart, cohortEnd).",
  "D0 (first paid day) = entry + trialDays (default 7, the card-gated trial). An ineligible-trial immediate checkout also carries terms_accepted_at, so its D0 is over-estimated by trialDays; pre-register or exclude if that matters.",
  "Paid-through = max(current_period_end) over the user's rows whose status is not 'refunded'.",
  "Refunded = any row with status 'refunded'. Reported as its own state at every checkpoint; never counted as retained.",
  "Paid cohort (Track A denominator) = entered users with paid-through > D0, plus refunded users (a refund implies a charge). Trial-not-converted users are reported but excluded.",
  "Active paid at day N = paid-through > D0 + N days.",
  "Graduated before day N = learning_journeys.graduated_at <= D0 + N. A success, not churn: excluded from the churn count and reported separately (protocol §6).",
  "Assessable at day N = D0 + N <= asOf. Members whose checkpoint has not arrived are excluded from that checkpoint's denominator only.",
  "Rates are reported twice: against the original paid cohort (protocol §8 primary denominator) and against the cohort excluding graduates.",
  "Track B (maintenance) D0 = graduated_at. Offered = every graduated cohort member; selected = maintenance_at not null. Retained at day N = paid-through > graduated_at + N. Both denominators are reported side by side (protocol §6); the survivor-only figure is never reported alone.",
  "Provider is not distinguished (Play billing is flag-off); all rows are pooled."
] as const;

export const TRACK_A_DAYS = [7, 30, 60, 90] as const;
export const TRACK_B_DAYS = [180, 365] as const;

export type SubscriptionRow = {
  userId: string;
  status: string;
  currentPeriodEnd: Date;
  termsAcceptedAt: Date | null;
};

export type JourneyRow = {
  userId: string;
  graduatedAt: Date | null;
  maintenanceAt: Date | null;
};

export type TrackACheckpoint = {
  day: number;
  assessable: number;
  retainedPaid: number;
  graduated: number;
  refunded: number;
  churned: number;
  /** retainedPaid / assessable — the original-cohort denominator. */
  rateOriginalDenominator: number | null;
  /** retainedPaid / (assessable - graduated). */
  rateExcludingGraduates: number | null;
};

export type TrackBCheckpoint = {
  day: number;
  offeredAssessable: number;
  selectedAssessable: number;
  retainedOfOffered: number;
  retainedOfSelected: number;
  rateOfOffered: number | null;
  rateOfSelected: number | null;
};

export type CohortReport = {
  definitions: readonly string[];
  window: { cohortStart: string; cohortEnd: string; asOf: string; trialDays: number };
  accounts: {
    enteredTrial: number;
    paidCohort: number;
    trialNotConverted: number;
    refunded: number;
    /** Rows with no terms_accepted_at at all (legacy checkouts); cannot be placed in a window. */
    unclassifiableAllTime: number;
  };
  trackA: TrackACheckpoint[];
  trackB: TrackBCheckpoint[];
};

export type CohortInput = {
  subscriptions: SubscriptionRow[];
  journeys: JourneyRow[];
  cohortStart: Date;
  cohortEnd: Date;
  asOf: Date;
  trialDays?: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY_MS);
const rate = (num: number, den: number) => (den > 0 ? Math.round((num / den) * 1000) / 1000 : null);

type Member = {
  d0: Date;
  paidThrough: Date | null;
  refunded: boolean;
  graduatedAt: Date | null;
  maintenanceAt: Date | null;
};

export function computeCohortReport(input: CohortInput): CohortReport {
  const trialDays = input.trialDays ?? 7;
  const byUser = new Map<string, SubscriptionRow[]>();
  for (const row of input.subscriptions) {
    const rows = byUser.get(row.userId) ?? [];
    rows.push(row);
    byUser.set(row.userId, rows);
  }
  const journeyByUser = new Map(input.journeys.map((j) => [j.userId, j]));

  let unclassifiableAllTime = 0;
  let enteredTrial = 0;
  let trialNotConverted = 0;
  const members: Member[] = [];

  for (const [userId, rows] of byUser) {
    const stamps = rows
      .map((r) => r.termsAcceptedAt)
      .filter((d): d is Date => d instanceof Date);
    if (stamps.length === 0) {
      unclassifiableAllTime += 1;
      continue;
    }
    const entry = new Date(Math.min(...stamps.map((d) => d.getTime())));
    if (entry < input.cohortStart || entry >= input.cohortEnd) continue;
    enteredTrial += 1;

    const d0 = addDays(entry, trialDays);
    const refunded = rows.some((r) => r.status === "refunded");
    const paidRows = rows.filter((r) => r.status !== "refunded");
    const paidThrough =
      paidRows.length > 0
        ? new Date(Math.max(...paidRows.map((r) => r.currentPeriodEnd.getTime())))
        : null;
    const converted = paidThrough !== null && paidThrough > d0;
    if (!converted && !refunded) {
      trialNotConverted += 1;
      continue;
    }
    const journey = journeyByUser.get(userId);
    members.push({
      d0,
      paidThrough,
      refunded,
      graduatedAt: journey?.graduatedAt ?? null,
      maintenanceAt: journey?.maintenanceAt ?? null
    });
  }

  const trackA: TrackACheckpoint[] = TRACK_A_DAYS.map((day) => {
    let assessable = 0, retainedPaid = 0, graduated = 0, refunded = 0, churned = 0;
    for (const m of members) {
      const at = addDays(m.d0, day);
      if (at > input.asOf) continue;
      assessable += 1;
      if (m.refunded) refunded += 1;
      else if (m.graduatedAt && m.graduatedAt <= at) graduated += 1;
      else if (m.paidThrough && m.paidThrough > at) retainedPaid += 1;
      else churned += 1;
    }
    return {
      day, assessable, retainedPaid, graduated, refunded, churned,
      rateOriginalDenominator: rate(retainedPaid, assessable),
      rateExcludingGraduates: rate(retainedPaid, assessable - graduated)
    };
  });

  const trackB: TrackBCheckpoint[] = TRACK_B_DAYS.map((day) => {
    let offeredAssessable = 0, selectedAssessable = 0, retainedOfOffered = 0, retainedOfSelected = 0;
    for (const m of members) {
      if (!m.graduatedAt || m.refunded) continue;
      const at = addDays(m.graduatedAt, day);
      if (at > input.asOf) continue;
      offeredAssessable += 1;
      const retained = m.paidThrough !== null && m.paidThrough > at;
      if (retained) retainedOfOffered += 1;
      if (m.maintenanceAt) {
        selectedAssessable += 1;
        if (retained) retainedOfSelected += 1;
      }
    }
    return {
      day, offeredAssessable, selectedAssessable, retainedOfOffered, retainedOfSelected,
      rateOfOffered: rate(retainedOfOffered, offeredAssessable),
      rateOfSelected: rate(retainedOfSelected, selectedAssessable)
    };
  });

  return {
    definitions: DEFINITIONS,
    window: {
      cohortStart: input.cohortStart.toISOString(),
      cohortEnd: input.cohortEnd.toISOString(),
      asOf: input.asOf.toISOString(),
      trialDays
    },
    accounts: {
      enteredTrial,
      paidCohort: members.length,
      trialNotConverted,
      refunded: members.filter((m) => m.refunded).length,
      unclassifiableAllTime
    },
    trackA,
    trackB
  };
}

/**
 * The only columns the report needs. Deliberately no email, no meal data, no
 * ids in the OUTPUT — user ids are used in memory to join the two tables and
 * are dropped before anything is returned to the caller of
 * `computeCohortReport`.
 */
export async function queryCohortRows(
  db: Db
): Promise<{ subscriptions: SubscriptionRow[]; journeys: JourneyRow[] }> {
  // Every row of a user matters for paid-through and the window is applied per
  // user in computeCohortReport, so subscriptions are read whole; rows with no
  // terms_accepted_at are kept so the report can count them as unclassifiable.
  // Journeys: only graduated ones can affect any checkpoint.
  const subscriptions = await db
    .select({
      userId: schema.subscriptions.userId,
      status: schema.subscriptions.status,
      currentPeriodEnd: schema.subscriptions.currentPeriodEnd,
      termsAcceptedAt: schema.subscriptions.termsAcceptedAt
    })
    .from(schema.subscriptions);
  const journeys = await db
    .select({
      userId: schema.learningJourneys.userId,
      graduatedAt: schema.learningJourneys.graduatedAt,
      maintenanceAt: schema.learningJourneys.maintenanceAt
    })
    .from(schema.learningJourneys)
    .where(isNotNull(schema.learningJourneys.graduatedAt));
  return { subscriptions, journeys };
}
