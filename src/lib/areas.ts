/**
 * Fixed, muted palette for area dots — the ONLY chromatic accents allowed
 * in the design besides destructive red. Keys are stored in areas.color.
 */
export const AREA_COLORS = {
  gray: { label: "رمادي", dot: "bg-neutral-400" },
  blue: { label: "أزرق", dot: "bg-sky-600/70" },
  green: { label: "أخضر", dot: "bg-emerald-600/70" },
  amber: { label: "كهرماني", dot: "bg-amber-500/80" },
  purple: { label: "بنفسجي", dot: "bg-violet-500/70" },
  rose: { label: "وردي", dot: "bg-rose-400/80" },
} as const;

export type AreaColor = keyof typeof AREA_COLORS;

export function areaDotClass(color: string): string {
  return AREA_COLORS[(color as AreaColor) in AREA_COLORS ? (color as AreaColor) : "gray"].dot;
}
