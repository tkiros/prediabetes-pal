"use client";

// components/gdm/summary-print.tsx — the summary's one control (PRD §6.2
// F-SUMMARY). Browser print, no PDF library: `window.print()` opens the
// device's own print sheet, styled by app/globals.css's existing `@media
// print` block. G-18: `window.print()` does nothing in several in-app
// browsers, but the page is fully readable on screen either way, so she can
// screenshot it instead — no string exists for that here; the owner has not
// asked for one.
import { track } from "../../lib/client/analytics";
import { localIsoDate } from "../../lib/client/gdm-date";
import { isoDayNumber } from "../../lib/pal/gdm/waiting";

type BeforeAppointment = "yes" | "no" | "no_date";

/**
 * G-23: never a raw string comparison — `(unreadable entry)` sorts before
 * every digit, so a naive `today <= appointmentDate` would report "no" for a
 * date that in fact could not be decrypted. Only a date that parses as a real
 * YYYY-MM-DD (the same parse `waiting.ts` uses) is compared at all.
 */
function beforeAppointment(appointmentDate: string | null, today: string): BeforeAppointment {
  const then = isoDayNumber(appointmentDate);
  const now = isoDayNumber(today);
  if (then === null || now === null) return "no_date";
  return now <= then ? "yes" : "no";
}

export function SummaryPrint({ appointmentDate, label }: { appointmentDate: string | null; label: string }) {
  function handlePrint() {
    // G-44: `today` is computed on HER device, at the moment she presses
    // print — never on the server, never `toISOString()` / `new Date(text)`.
    track({ name: "gdm_summary_printed", props: { before_appointment: beforeAppointment(appointmentDate, localIsoDate()) } });
    window.print();
  }

  return (
    <button type="button" className="primary-button gdm-no-print" onClick={handlePrint}>
      {label}
    </button>
  );
}
