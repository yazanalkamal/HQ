/**
 * Pure math for the الخطط time canvas: a 12-week window starting one week
 * before the current week, weeks as columns flowing with the RTL grid.
 */
import { addDaysISO, daysUntil, startOfWeekISO, todayISO } from "./dates";

export const WEEKS = 12;

export type TimelineWindow = {
  start: string; // ISO of week 0's Sunday
  end: string; // last day (exclusive) of week 11
  weekStarts: string[]; // 12 ISO dates
  todayWeek: number; // index of the current week
};

export function timelineWindow(today: string = todayISO()): TimelineWindow {
  const start = addDaysISO(startOfWeekISO(today), -7);
  const weekStarts = Array.from({ length: WEEKS }, (_, i) => addDaysISO(start, i * 7));
  return {
    start,
    end: addDaysISO(start, WEEKS * 7),
    weekStarts,
    todayWeek: weekIndex(today, start),
  };
}

/** Which week column (0-based) a date falls into; may be out of [0, WEEKS). */
export function weekIndex(iso: string, windowStart: string): number {
  return Math.floor(-daysUntil(windowStart, iso) / 7);
}

/** Clamp a plan's [start, end] into window columns; null if no overlap. */
export function barSpan(
  planStart: string,
  planEnd: string,
  win: TimelineWindow,
): { from: number; to: number; clippedStart: boolean; clippedEnd: boolean } | null {
  const s = weekIndex(planStart, win.start);
  const e = weekIndex(planEnd, win.start);
  if (e < 0 || s >= WEEKS) return null;
  return {
    from: Math.max(0, s),
    to: Math.min(WEEKS - 1, e),
    clippedStart: s < 0,
    clippedEnd: e >= WEEKS,
  };
}

/** Milestone position along its plan bar, % of plan duration, clamped. */
export function milestonePct(due: string, planStart: string, planEnd: string): number {
  const total = Math.max(1, -daysUntil(planStart, planEnd));
  const at = -daysUntil(planStart, due);
  return Math.min(97, Math.max(2, Math.round((at / total) * 100)));
}

const monthFmt = new Intl.DateTimeFormat("ar-u-nu-latn", {
  timeZone: "UTC",
  month: "long",
});
const dayNumFmt = new Intl.DateTimeFormat("ar-u-nu-latn", {
  timeZone: "UTC",
  day: "numeric",
});

export type MonthSpan = { label: string; from: number; span: number };

/** Group week columns under month headers (by each week's start month). */
export function monthSpans(weekStarts: string[]): MonthSpan[] {
  const out: MonthSpan[] = [];
  for (let i = 0; i < weekStarts.length; i++) {
    const label = monthFmt.format(new Date(weekStarts[i] + "T00:00:00Z"));
    const last = out[out.length - 1];
    if (last && last.label === label) last.span++;
    else out.push({ label, from: i, span: 1 });
  }
  return out;
}

export function weekDayLabel(weekStart: string): string {
  return dayNumFmt.format(new Date(weekStart + "T00:00:00Z"));
}

/** Bar colors — muted, one per plan, chosen at creation. */
export const PLAN_COLORS = {
  violet: { label: "بنفسجي", hex: "#6d28d9" },
  blue: { label: "أزرق", hex: "#0369a1" },
  green: { label: "أخضر", hex: "#047857" },
  amber: { label: "كهرماني", hex: "#b45309" },
  rose: { label: "وردي", hex: "#be185d" },
  gray: { label: "رمادي", hex: "#525252" },
} as const;

export type PlanColor = keyof typeof PLAN_COLORS;

export function planHex(color: string): string {
  return PLAN_COLORS[(color as PlanColor) in PLAN_COLORS ? (color as PlanColor) : "gray"].hex;
}
