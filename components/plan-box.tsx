import Link from "next/link";

import type { PlanBoxData } from "../lib/server/plan-box";

/** The shell's plan/billing box — the first place `currentPeriodEnd` is
 * actually shown to a paying user (design doc premise 5). */
export function PlanBox({ data }: { data: PlanBoxData }) {
  return (
    <div className="plan-box">
      <div className="plan-box-label">Your plan</div>
      <div className="plan-box-name">{data.planName}</div>
      {data.meta ? <div className="plan-box-meta">{data.meta}</div> : null}
      {data.isFree ? (
        <Link className="plan-box-link" href="/subscribe">
          See what Premium includes
        </Link>
      ) : null}
    </div>
  );
}
