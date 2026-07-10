/**
 * Date logic pinned to Riyadh time — the server (VPS, UTC) must group
 * "اليوم" by the user's day, not the machine's.
 */
export const APP_TZ = "Asia/Riyadh";

const isoFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Current date in Riyadh as "YYYY-MM-DD". */
export function todayISO(now: Date = new Date()): string {
  return isoFmt.format(now);
}

/** iso ± n days (calendar arithmetic on the date string, TZ-safe). */
export function addDaysISO(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}

export function isBeforeISO(a: string, b: string): boolean {
  return a < b; // ISO dates compare lexicographically
}

const weekdayFmt = new Intl.DateTimeFormat("ar-u-nu-latn", {
  timeZone: "UTC",
  weekday: "long",
});
const shortFmt = new Intl.DateTimeFormat("ar-u-nu-latn", {
  timeZone: "UTC",
  day: "numeric",
  month: "long",
});

function isoToUTCDate(iso: string): Date {
  return new Date(iso + "T00:00:00Z");
}

/** Human label for a due date: أمس/اليوم/غدًا/الأحد ٢٤ مارس… */
export function dueLabel(iso: string, today: string = todayISO()): string {
  if (iso === today) return "اليوم";
  if (iso === addDaysISO(today, 1)) return "غدًا";
  if (iso === addDaysISO(today, -1)) return "أمس";
  const d = isoToUTCDate(iso);
  const withinWeek = iso > today && iso <= addDaysISO(today, 6);
  return withinWeek
    ? weekdayFmt.format(d)
    : `${weekdayFmt.format(d)} ${shortFmt.format(d)}`;
}

/** Whole days from `today` to `iso` (0 = today, 1 = غدًا…). */
export function daysUntil(iso: string, today: string = todayISO()): number {
  return Math.round(
    (Date.parse(iso + "T00:00:00Z") - Date.parse(today + "T00:00:00Z")) / 86_400_000,
  );
}

const gregorianFmt = new Intl.DateTimeFormat("ar-u-nu-latn", {
  timeZone: APP_TZ,
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});
const hijriFmt = new Intl.DateTimeFormat("ar-SA-u-ca-islamic-umalqura-nu-latn", {
  timeZone: APP_TZ,
  day: "numeric",
  month: "long",
  year: "numeric",
});

export function todayLongLabel(now: Date = new Date()): {
  gregorian: string;
  hijri: string;
} {
  return { gregorian: gregorianFmt.format(now), hijri: hijriFmt.format(now) };
}

/** صباح الخير / مساء الخير by Riyadh hour. */
export function greeting(now: Date = new Date()): string {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: APP_TZ,
      hour: "numeric",
      hour12: false,
    }).format(now),
  );
  return hour >= 5 && hour < 18 ? "صباح الخير" : "مساء الخير";
}
