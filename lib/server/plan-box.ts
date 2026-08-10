import { eq } from "drizzle-orm";
import { cache } from "react";

import {
  countChecksToday,
  FREE_DAILY_CHECKS,
  getEntitlement
} from "./entitlement";
import { getDb, schema } from "./db";
import { paywallMode } from "./pricing";
import { getSessionInfo } from "./session";

/**
 * Plan-box display data for the (app) shell + dashboard (M1 plan, eng
 * amendment #4): a DISPLAY-only entitlement read — no refreshPlaySubscription
 * injected, so rendering the shell never blocks on the Play API. May be
 * minutes stale; all granting paths keep verify-on-read.
 *
 * cache() dedupes the read when both the sidebar and the dashboard page ask
 * during one render pass. Any failure degrades to the guest box — the shell
 * must render even when the DB is down.
 */

export type PlanBoxData = {
  planName: string;
  meta: string;
  isFree: boolean;
  signedIn: boolean;
  /** True when the box carries actionable billing truth the user must not
   * miss — a running trial or a won't-renew end date (C7 eng-review D2).
   * Home renders the box only in these states; steady-state "Renews {date}"
   * and the free upsell stay in the sidebar + /account.
   * ponytail: payment-issue (grace) isn't surfaced here — the row-level
   * "grace" status never reaches this display read; the payment-failed email
   * covers it. Wire it through getEntitlement if that ever proves too weak. */
  attention: boolean;
};

/**
 * C7 eng-review D2: Home renders the plan box only when it carries billing
 * truth the user must not miss — a running trial or a scheduled non-renewal.
 * Steady premium ("Renews {date}") and the free tier stay sidebar/account-only.
 */
export function planBoxAttention(entitlement: {
  tier: string;
  status?: string | null;
  cancelAtPeriodEnd?: boolean;
}): boolean {
  return (
    entitlement.tier === "premium" &&
    (entitlement.cancelAtPeriodEnd === true || entitlement.status === "trialing")
  );
}

const GUEST_BOX: PlanBoxData = {
  planName: "Free plan",
  meta: "The daily check is free.",
  isFree: true,
  signedIn: false,
  attention: false
};

/**
 * C-1 (2026-07-27): under the trial funnel a signed-in free account gets zero
 * checks (app/api/check/route.ts "Hard wall") — the legacy "N of 5 left
 * today" meter would be a false promise here. plan-box-attention.test.ts pins
 * this copy against the daily-free-claim ban.
 */
export const TRIAL_FREE_BOX: PlanBoxData = {
  planName: "Free plan",
  meta: "Checks are part of Premium. Your recent history is still here.",
  isFree: true,
  signedIn: true,
  attention: false
};

function formatDate(date: Date, timezone: string): string {
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: timezone
  });
}

export const getPlanBox = cache(async (): Promise<PlanBoxData> => {
  try {
    const session = await getSessionInfo();
    if (!session) {
      return GUEST_BOX;
    }

    const db = getDb();
    const entitlement = await getEntitlement(db, session.userId);

    const [profile] = await db
      .select({ timezone: schema.profiles.timezone })
      .from(schema.profiles)
      .where(eq(schema.profiles.userId, session.userId));
    const timezone = profile?.timezone ?? "America/New_York";

    if (entitlement.tier === "premium") {
      const date = entitlement.currentPeriodEnd
        ? formatDate(entitlement.currentPeriodEnd, timezone)
        : null;
      const meta = entitlement.cancelAtPeriodEnd
        ? date
          ? `Access until ${date} — will not renew`
          : "Will not renew"
        : entitlement.status === "trialing"
          ? date
            ? `Trial ends ${date}`
            : "Trial active"
          : date
            ? `Renews ${date}`
            : "Active";
      return {
        planName: "Prediabetes Pal Premium",
        meta,
        isFree: false,
        signedIn: true,
        attention: planBoxAttention(entitlement)
      };
    }

    if (paywallMode() === "trial") {
      return TRIAL_FREE_BOX;
    }

    const used = await countChecksToday(db, session.userId, timezone);
    const left = Math.max(0, FREE_DAILY_CHECKS - used);
    return {
      planName: "Free plan",
      meta: `${left} of ${FREE_DAILY_CHECKS} free checks left today`,
      isFree: true,
      signedIn: true,
      attention: false
    };
  } catch {
    // DB or session hiccup: the shell still renders; the box shows the
    // guest default rather than blocking the page.
    return GUEST_BOX;
  }
});
