/**
 * Arabic formatting with Latin (Western) digits — the KSA convention
 * for money and dates in modern UIs.
 */
const LOCALE = "ar-u-nu-latn";

export function formatDate(d: Date): string {
  return new Intl.DateTimeFormat(LOCALE, { dateStyle: "medium" }).format(d);
}

export function formatDateTime(d: Date): string {
  return new Intl.DateTimeFormat(LOCALE, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

export function formatCount(n: number): string {
  return new Intl.NumberFormat(LOCALE).format(n);
}

export function formatRelative(d: Date, now: Date = new Date()): string {
  const rtf = new Intl.RelativeTimeFormat(LOCALE, { numeric: "auto" });
  const diffMs = d.getTime() - now.getTime();
  const minutes = Math.round(diffMs / 60_000);
  if (Math.abs(minutes) < 60) return rtf.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return rtf.format(hours, "hour");
  const days = Math.round(hours / 24);
  if (Math.abs(days) < 30) return rtf.format(days, "day");
  const months = Math.round(days / 30);
  if (Math.abs(months) < 12) return rtf.format(months, "month");
  return rtf.format(Math.round(months / 12), "year");
}
