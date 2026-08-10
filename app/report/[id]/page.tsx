import { notFound, redirect } from "next/navigation";

import { PrintButton } from "../../../components/print-button";
import { getDb } from "../../../lib/server/db";
import {
  loadReportForUser
} from "../../../lib/server/pantry/report-view";
import type { ReportItem } from "../../../lib/server/pantry/process";
import { getSessionInfo } from "../../../lib/server/session";
import { SUPPORT_EMAIL } from "../../../lib/revora/contact";

export const metadata = {
  title: "Your Pantry Review — Prediabetes Pal",
  robots: { index: false, follow: false }
};


const BAND_LABEL: Record<string, string> = {
  prediabetes_57_59: "5.7% – 5.9%",
  prediabetes_60_62: "6.0% – 6.2%",
  prediabetes_63_64: "6.3% – 6.4%"
};

function ItemRow({ item, tone }: { item: ReportItem; tone: "safe" | "moderate" | "high" }) {
  return (
    <div className={`result-card report-item report-item--${tone}`}>
      <p className="report-item-name">
        {item.name}
        {item.portion ? <span className="report-item-portion"> · {item.portion}</span> : null}
      </p>
      <p className="report-item-reason">{item.reason}</p>
      {item.swap ? <p className="report-item-tip">Swap: {item.swap}</p> : null}
      {item.adjustment ? <p className="report-item-tip">Adjustment: {item.adjustment}</p> : null}
    </div>
  );
}

export default async function ReportPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSessionInfo();
  if (!session) {
    redirect(`/signin?callbackUrl=${encodeURIComponent(`/report/${id}`)}`);
  }

  const view = await loadReportForUser(getDb(), session.userId, id);
  if (view.kind === "not_found") {
    notFound();
  }
  if (view.kind === "processing") {
    return (
      <main className="page-shell">
        <div className="page-frame">
          <section className="surface-card">
            <p className="hero-eyebrow">Pantry Review</p>
            <h1 className="page-title">Almost there</h1>
            <p className="request-status" aria-live="polite">
              Your items are still being reviewed. You&apos;ll get an email the
              moment the report is ready — it&apos;s safe to close this page.
            </p>
          </section>
        </div>
      </main>
    );
  }
  if (view.kind === "unavailable") {
    return (
      <main className="page-shell">
        <div className="page-frame">
          <section className="surface-card">
            <p className="hero-eyebrow">Pantry Review</p>
            <h1 className="page-title">We can&apos;t open this report</h1>
            <p className="request-status" aria-live="polite">
              Your report was generated, but we can&apos;t read it back right
              now. This is on us, not on you — email {SUPPORT_EMAIL} and
              we&apos;ll rebuild it or refund you.
            </p>
          </section>
        </div>
      </main>
    );
  }

  const { report } = view;
  return (
    <main className="page-shell">
      <div className="page-frame report-frame">
        <section className="surface-card">
          <p className="hero-eyebrow">Pantry Review</p>
          <h1 className="page-title">Your Pantry Review</h1>
          <p className="page-copy">
            Based on the {report.counts.safe + report.counts.moderate + report.counts.high}{" "}
            items you confirmed and an A1C range of {BAND_LABEL[report.a1cBand] ?? report.a1cBand}.
          </p>
          <p className="report-summary-strip">
            {report.counts.safe} enjoy freely · {report.counts.moderate} worth a
            tweak · {report.counts.high} handle with care
            {report.counts.failed > 0 ? ` · ${report.counts.failed} still being reviewed` : ""}
          </p>
          <PrintButton />
        </section>

        {report.sections.safe.length > 0 ? (
          <section className="surface-card">
            <h2>Enjoy freely</h2>
            <p className="page-copy">
              These look like steady picks as they are — no changes suggested.
            </p>
            {report.sections.safe.map((item, index) => (
              <ItemRow key={`safe-${index}`} item={item} tone="safe" />
            ))}
          </section>
        ) : null}

        {report.sections.moderate.length > 0 ? (
          <section className="surface-card">
            <h2>Worth a tweak</h2>
            <p className="page-copy">
              Small upgrades — a portion, a pairing, or a timing change can
              make each of these easier to handle.
            </p>
            {report.sections.moderate.map((item, index) => (
              <ItemRow key={`moderate-${index}`} item={item} tone="moderate" />
            ))}
          </section>
        ) : null}

        {report.sections.high.length > 0 ? (
          <section className="surface-card">
            <h2>Handle with care</h2>
            {report.sections.high.map((item, index) => (
              <ItemRow key={`high-${index}`} item={item} tone="high" />
            ))}
          </section>
        ) : null}

        {report.sections.failed.length > 0 ? (
          <section className="surface-card">
            <h2>What we saw</h2>
            <p className="page-copy">
              We&apos;ll update these items shortly — they needed another look:
            </p>
            <ul>
              {report.sections.failed.map((item) => (
                <li key={item.name}>{item.name}</li>
              ))}
            </ul>
          </section>
        ) : null}

        <p className="result-disclaimer">{report.disclaimer}</p>
        <p className="page-copy">Questions about your report? {SUPPORT_EMAIL}</p>

        <section className="paywall-card">
          <h2>Keep checking daily meals</h2>
          <p>
            The same review, one meal at a time — type or say any food and get
            a calm answer in seconds. Premium keeps it unlimited, with your
            history on every device.
          </p>
          <a className="primary-button" href="/subscribe">
            See Premium
          </a>
        </section>
      </div>
    </main>
  );
}
