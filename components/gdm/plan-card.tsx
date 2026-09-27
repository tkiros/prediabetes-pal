import type { ReactNode } from "react";

import { formatIsoDate } from "../../lib/client/gdm-date";
import { GDM_COPY } from "../../lib/pal/gdm/copy";
import { GDM_OCCASIONS, isEmptyPlan, type GdmOccasion, type StoredPlan } from "../../lib/pal/gdm/plan-record";
import { LocalDate } from "./local-date";

const CONTROLS = GDM_COPY["gdm-plan-controls"];
const OCCASIONS = GDM_COPY["gdm-occasions"];
const FLAG = GDM_COPY["gdm-plan-differ"].flag;

/** The id of a card's "Entered on" line, so a control beside the card can name which plan it acts on. */
export const planEnteredId = (planId: string) => `gdm-plan-${planId}-entered`;
/** The id of an occasion's heading on a card, so an action beside its flag can name the occasion. */
export const planOccasionId = (planId: string, occasion: GdmOccasion) => `gdm-plan-${planId}-${occasion}`;

export type PlanCardProps = {
  plan: StoredPlan;
  /** Her occasions where another current plan says something different (`detectConflicts`), flagged on this card. */
  differs: readonly GdmOccasion[];
  /**
   * An action beside a differing occasion's flag, supplied by the page that
   * renders the card (the plan page's "Add to my questions"). Home passes
   * none: the card itself holds no control (G-37).
   */
  renderDiffer?: (occasion: GdmOccasion) => ReactNode;
};

/**
 * A labelled date ("Entered on Thursday, October 8"), or nothing for a date
 * that will not read. G-44: formatIsoDate, never new Date(iso). The words come
 * from LocalDate, after hydration: Home server-renders this card, and the
 * server cannot know her locale (Task 4.2).
 */
function dateLine(label: string, iso: string | null, id?: string) {
  if (!iso || !formatIsoDate(iso)) return null;
  return (
    <p id={id} className="gdm-plan-date">
      {label}{" "}
      <time dateTime={iso}>
        <LocalDate iso={iso} />
      </time>
    </p>
  );
}

/**
 * One plan, read-only, in her care team's words (PRD §6.2 F-PLANKEEP): only
 * what she typed, each under its label, with no default for what she left
 * blank. `none` is the form's starting value, not something she wrote, so it
 * shows no "How my clinic counts" row. An empty plan renders the empty line
 * and nothing else. A replaced plan leads with the date it was replaced.
 * A differing occasion carries the neutral "These differ" chip (G-40): the
 * same chip on both cards, never a verdict colour, no icon. The plan page
 * renders it, and Home renders the same card (Task 4.2, G-37).
 */
export function PlanCard({ plan, differs, renderDiffer }: PlanCardProps) {
  const rows: Array<[label: string, value: string]> = [];
  if (plan.givenBy) rows.push([CONTROLS.givenBy, plan.givenBy]);
  if (plan.note) rows.push([CONTROLS.note, plan.note]);
  if (plan.perDay) rows.push([CONTROLS.perDay, plan.perDay]);
  if (plan.unit !== "none") rows.push([CONTROLS.counts, CONTROLS[plan.unit]]);
  if (plan.unit === "choices" && plan.choiceMeans) rows.push([CONTROLS.choiceMeans, plan.choiceMeans]);
  const occasions = GDM_OCCASIONS.filter((occasion) => plan.figures[occasion] !== undefined);

  return (
    <article className="surface-card gdm-plan-card" data-replaced={plan.replacedOn === null ? undefined : ""}>
      {dateLine(CONTROLS.replacedOn, plan.replacedOn)}
      {dateLine(CONTROLS.enteredOn, plan.enteredOn, planEnteredId(plan.id))}
      {isEmptyPlan(plan) ? (
        <p className="gdm-plan-empty">{CONTROLS.empty}</p>
      ) : (
        <>
          {rows.length > 0 ? (
            <dl className="gdm-plan-fields">
              {rows.map(([label, value]) => (
                <div key={label} className="gdm-plan-row">
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          {occasions.length > 0 ? (
            <dl className="gdm-plan-fields">
              {occasions.map((occasion) => (
                <div key={occasion} className="gdm-plan-row">
                  <dt id={planOccasionId(plan.id, occasion)}>{OCCASIONS[occasion]}</dt>
                  <dd>
                    {plan.figures[occasion]}
                    {differs.includes(occasion) ? (
                      <>
                        <span className="gdm-differ-chip">{FLAG}</span>
                        {renderDiffer?.(occasion)}
                      </>
                    ) : null}
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}
        </>
      )}
    </article>
  );
}
