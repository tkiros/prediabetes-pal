// app/gdm/(door)/summary/page.tsx — For my appointment (PRD §6.2 F-SUMMARY).
// The guard first, like every door page; then her three lists, run together
// (Performance amendment) and folded into one document by the pure builder
// (Task 6.1). Printing is browser-native (components/gdm/summary-print.tsx):
// no PDF library, and the disclaimer is repeated HERE, inside the page body,
// because app/globals.css's print block hides every <footer> and <nav> —
// right for the frame, wrong for the one sentence that must survive to print.
import Link from "next/link";

import { SummaryPrint } from "../../../../components/gdm/summary-print";
import { GDM_COPY } from "../../../../lib/pal/gdm/copy";
import type { AskBody, MealBody } from "../../../../lib/pal/gdm/items";
import type { GdmPlan } from "../../../../lib/pal/gdm/plan-record";
import { GDM_ROUTES } from "../../../../lib/pal/gdm/routes";
import { buildSummary, type SummaryLabels } from "../../../../lib/pal/gdm/summary";
import { getDb } from "../../../../lib/server/db";
import { requireGdmDoor } from "../../../../lib/server/gdm-door";
import { listGdmItems } from "../../../../lib/server/gdm-items";

export default async function GdmSummaryPage() {
  const { userId, appointmentDate } = await requireGdmDoor();
  const db = getDb();

  // Performance amendment: the three lists load together, not one after another.
  const [plans, meals, asks] = await Promise.all([
    listGdmItems<GdmPlan>(db, userId, "plan"),
    listGdmItems<MealBody>(db, userId, "meal"),
    listGdmItems<AskBody>(db, userId, "ask")
  ]);

  const headings = GDM_COPY["gdm-summary-headings"];
  const controls = GDM_COPY["gdm-plan-controls"];
  const nav = GDM_COPY["gdm-nav"];
  const labels: SummaryLabels = {
    title: headings.title,
    plan: headings.plan,
    meals: headings.meals,
    asks: headings.asks,
    empty: headings.empty,
    differ: GDM_COPY["gdm-plan-differ"].flag,
    occasions: GDM_COPY["gdm-occasions"],
    units: { grams: controls.grams, choices: controls.choices, servings: controls.servings, none: controls.none },
    fields: {
      givenBy: controls.givenBy,
      perDay: controls.perDay,
      counts: controls.counts,
      choiceMeans: controls.choiceMeans,
      enteredOn: controls.enteredOn
    }
  };

  const doc = buildSummary(
    // `id` last, so nothing in a stored body can stand in for the row's id (the Home pattern).
    { plans: plans.map((plan) => ({ ...plan.body, id: plan.id })), meals, asks },
    labels
  );

  // G-41: nothing entered at all reads as ONE empty line and the three lists,
  // not three separately-empty sections — printing a blank page is a dead end.
  const allEmpty = doc.sections.every((section) => section.lines.length === 0);

  return (
    <>
      <h1 className="gdm-title">{doc.title}</h1>
      {allEmpty ? (
        <>
          <p>{doc.emptyLine}</p>
          <ul className="chip-row gdm-no-print gdm-summary-links" role="list">
            <li>
              <Link className="selectable-chip link-button" href={GDM_ROUTES.plan}>
                {nav.plan}
              </Link>
            </li>
            <li>
              <Link className="selectable-chip link-button" href={GDM_ROUTES.meals}>
                {nav.meals}
              </Link>
            </li>
            <li>
              <Link className="selectable-chip link-button" href={GDM_ROUTES.questions}>
                {nav.asks}
              </Link>
            </li>
          </ul>
        </>
      ) : (
        doc.sections.map((section) => (
          <section key={section.key} data-gdm-summary={section.key}>
            <h2>{section.heading}</h2>
            {section.lines.length > 0 ? (
              <ul>
                {section.lines.map((line, index) => (
                  <li key={index} className="gdm-summary-row">
                    {line}
                  </li>
                ))}
              </ul>
            ) : (
              <p>{doc.emptyLine}</p>
            )}
          </section>
        ))
      )}
      <p>{GDM_COPY["gdm-disclaimer"].line}</p>
      {allEmpty ? null : <SummaryPrint appointmentDate={appointmentDate} label={headings.print} />}
    </>
  );
}
