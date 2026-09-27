// lib/client/gdm-date.ts
/** Today as YYYY-MM-DD in the DEVICE's timezone. Never toISOString(): that is UTC, and west of Greenwich it becomes tomorrow every evening. */
export function localIsoDate(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** Her date, for display. Built from (y, m - 1, d), which is LOCAL midnight. `new Date("2026-10-08")` is UTC midnight and shows as 7 October across the Americas. */
export function formatIsoDate(iso: string | null, locale?: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? "");
  if (!m) return null;
  const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long" }).format(date);
}
