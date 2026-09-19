import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  computeCohortReport,
  queryCohortRows,
  type JourneyRow,
  type SubscriptionRow
} from "../../../lib/server/cohort-report";
import * as schema from "../../../lib/server/db/schema";
import { createTestDb } from "../../helpers/test-db";

const d = (iso: string) => new Date(iso);
const sub = (
  userId: string,
  status: string,
  currentPeriodEnd: string,
  termsAcceptedAt: string | null
): SubscriptionRow => ({
  userId,
  status,
  currentPeriodEnd: d(currentPeriodEnd),
  termsAcceptedAt: termsAcceptedAt ? d(termsAcceptedAt) : null
});

// Window Oct 2026; trial 7 days, so D0 = entry + 7.
const subscriptions: SubscriptionRow[] = [
  sub("u-a", "active", "2027-03-01", "2026-10-01"), // retained throughout
  sub("u-b", "expired", "2026-11-26", "2026-10-05"), // D0 Oct 12; churns before D60
  sub("u-c", "active", "2027-03-01", "2026-10-10"), // graduates D0+80, chooses maintenance
  sub("u-d", "refunded", "2026-11-22", "2026-10-15"), // refunded
  sub("u-e", "canceled", "2026-10-27", "2026-10-20"), // cancelled in trial: never paid
  sub("u-f", "active", "2027-03-01", "2026-09-20"), // outside the window
  sub("u-g", "active", "2027-06-01", "2026-10-25"), // D0 Nov 1; D90 not yet reached
  sub("u-h", "expired", "2026-11-01", "2026-10-03"), // re-subscribed below
  sub("u-h", "active", "2027-04-01", null), //   ...second row carries paid-through
  sub("u-i", "active", "2027-03-01", null), // legacy row, no terms stamp at all
  sub("u-j", "active", "2028-06-01", "2026-10-02") // graduates early, no maintenance
];
const journeys: JourneyRow[] = [
  { userId: "u-c", graduatedAt: d("2027-01-05"), maintenanceAt: d("2027-01-06") },
  { userId: "u-j", graduatedAt: d("2026-12-01"), maintenanceAt: null }
];
const window = { cohortStart: d("2026-10-01"), cohortEnd: d("2026-11-01") };

describe("computeCohortReport — Track A (90-day program)", () => {
  const report = computeCohortReport({
    subscriptions,
    journeys,
    ...window,
    asOf: d("2027-01-15")
  });

  it("documents every account state separately and excludes what the protocol excludes", () => {
    // Entered: a b c d e g h j (f is outside the window, i has no terms stamp).
    // Paid cohort drops e, which cancelled inside the trial and never paid.
    expect(report.accounts).toEqual({
      enteredTrial: 8,
      paidCohort: 7,
      trialNotConverted: 1,
      refunded: 1,
      unclassifiableAllTime: 1
    });
  });

  it("counts retained / graduated / refunded / churned against the original cohort", () => {
    const byDay = Object.fromEntries(report.trackA.map((c) => [c.day, c]));
    expect(byDay[7]).toMatchObject({ assessable: 7, retainedPaid: 6, refunded: 1, graduated: 0, churned: 0 });
    expect(byDay[30]).toMatchObject({ assessable: 7, retainedPaid: 6, refunded: 1 });
    // u-b's paid-through (Nov 26) is before its D60 (Dec 11); u-j graduated Dec 1.
    expect(byDay[60]).toMatchObject({ assessable: 7, retainedPaid: 4, graduated: 1, churned: 1, refunded: 1 });
    expect(byDay[60].rateOriginalDenominator).toBe(0.571);
    expect(byDay[60].rateExcludingGraduates).toBe(0.667);
    // D90: u-d (Jan 20) and u-g (Jan 30) not yet assessable on Jan 15; u-c's Jan 15 is.
    expect(byDay[90]).toMatchObject({ assessable: 5, retainedPaid: 2, graduated: 2, churned: 1, refunded: 0 });
    expect(byDay[90].rateOriginalDenominator).toBe(0.4);
    expect(byDay[90].rateExcludingGraduates).toBe(0.667);
  });

  it("reports no Track B checkpoint before any graduate has reached it", () => {
    for (const c of report.trackB) {
      expect(c).toMatchObject({ offeredAssessable: 0, selectedAssessable: 0, rateOfOffered: null });
    }
  });

  it("never emits an identifier and always prints its definitions", () => {
    const text = JSON.stringify(report);
    expect(text).not.toMatch(/u-[a-z]/);
    expect(text).not.toMatch(/@/);
    expect(report.definitions.length).toBeGreaterThan(5);
  });
});

describe("computeCohortReport — Track B (maintenance) uses both denominators", () => {
  const report = computeCohortReport({
    subscriptions,
    journeys,
    ...window,
    asOf: d("2028-01-01")
  });
  const byDay = Object.fromEntries(report.trackB.map((c) => [c.day, c]));

  it("D180: offered = every graduate, selected = maintenance chosen, side by side", () => {
    // u-c chose maintenance but paid-through (Mar 2027) ends before D180 (Jul 2027).
    // u-j never chose maintenance but is still paying at D180 (May 2027).
    expect(byDay[180]).toEqual({
      day: 180,
      offeredAssessable: 2,
      selectedAssessable: 1,
      retainedOfOffered: 1,
      retainedOfSelected: 0,
      rateOfOffered: 0.5,
      rateOfSelected: 0
    });
  });

  it("D365: a graduate whose D365 has not arrived is excluded from that checkpoint only", () => {
    // u-c's D365 is 2028-01-05, after asOf; u-j's is 2027-12-01.
    expect(byDay[365]).toMatchObject({ offeredAssessable: 1, selectedAssessable: 0, retainedOfOffered: 1, rateOfSelected: null });
  });
});

describe("queryCohortRows — the SQL matches the schema", () => {
  let testDb: Awaited<ReturnType<typeof createTestDb>>;
  beforeAll(async () => {
    testDb = await createTestDb();
    const [p] = await testDb.db.insert(schema.users).values({ email: "p@example.com" }).returning();
    const [q] = await testDb.db.insert(schema.users).values({ email: "q@example.com" }).returning();
    await testDb.db.insert(schema.subscriptions).values([
      { userId: p.id, provider: "stripe", providerRef: "sub_p", productId: "premium_monthly", status: "active", currentPeriodEnd: d("2027-03-01"), termsAcceptedAt: d("2026-10-01") },
      { userId: q.id, provider: "stripe", providerRef: "sub_q", productId: "premium_monthly", status: "expired", currentPeriodEnd: d("2026-11-26"), termsAcceptedAt: d("2026-10-05") }
    ]);
    await testDb.db.insert(schema.learningJourneys).values({
      userId: p.id, state: "graduated", startedAt: d("2026-10-01"), graduatedAt: d("2027-01-05")
    });
  });
  afterAll(async () => { await testDb.close(); });

  it("feeds the pure report with exactly the columns it needs", async () => {
    const rows = await queryCohortRows(testDb.db);
    expect(rows.subscriptions).toHaveLength(2);
    expect(rows.journeys).toHaveLength(1);
    expect(Object.keys(rows.subscriptions[0]).sort()).toEqual(["currentPeriodEnd", "status", "termsAcceptedAt", "userId"]);
    const report = computeCohortReport({ ...rows, ...window, asOf: d("2027-01-15") });
    expect(report.accounts.paidCohort).toBe(2);
    const byDay = Object.fromEntries(report.trackA.map((c) => [c.day, c]));
    expect(byDay[7]).toMatchObject({ retainedPaid: 2 });
    expect(byDay[90]).toMatchObject({ assessable: 2, graduated: 1, churned: 1, retainedPaid: 0 });
    expect(JSON.stringify(report)).not.toMatch(/example\.com|sub_p|sub_q/);
  });
});
