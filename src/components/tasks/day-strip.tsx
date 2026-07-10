import Link from "next/link";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { addDaysISO, dayNumber, tasksCountLabel, weekdayName } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { DayStripData } from "@/lib/queries/tasks";

/**
 * The week as a strip of real days — counts show each day's load before
 * you pile more on it; the red dot marks overdue debt on اليوم.
 */
export function DayStrip({
  strip,
  weekStart,
  selected,
  view,
  today,
  areaId,
}: {
  strip: DayStripData;
  weekStart: string;
  selected: string;
  view: "day" | "undated" | "done";
  today: string;
  areaId?: string;
}) {
  const link = (params: Record<string, string>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) p.set(k, v);
    if (areaId) p.set("area", areaId);
    const q = p.toString();
    return q ? `/tasks?${q}` : "/tasks";
  };

  return (
    <div className="flex items-stretch gap-2">
      <WeekArrow
        href={link({ d: addDaysISO(weekStart, -7) })}
        label="الأسبوع السابق"
        icon={<ChevronRight className="size-4" />}
      />

      <div className="grid flex-1 grid-cols-7 gap-2">
        {strip.days.map((day) => {
          const isToday = day.date === today;
          const isSelected = view === "day" && day.date === selected;
          const allDone = day.open === 0 && day.done > 0;
          return (
            <Link
              key={day.date}
              href={link({ d: day.date })}
              className={cn(
                "relative flex flex-col items-center rounded-2xl border px-1 pb-2.5 pt-3 text-center transition-colors",
                isSelected
                  ? "border-primary bg-primary text-primary-foreground"
                  : "hover:border-foreground/30 hover:bg-accent",
                isToday && !isSelected && "border-foreground/40",
              )}
            >
              {isToday && strip.overdueCount > 0 ? (
                <span className="absolute end-2.5 top-2.5 size-1.5 rounded-full bg-destructive" />
              ) : null}
              <span className={cn("text-xs", isSelected ? "text-primary-foreground/70" : "text-muted-foreground")}>
                {isToday ? "اليوم" : day.date === addDaysISO(today, 1) ? "غدًا" : weekdayName(day.date)}
              </span>
              <span className="mt-0.5 text-xl font-bold" data-numeric>
                {dayNumber(day.date)}
              </span>
              <span
                className={cn(
                  "mt-1 h-4 text-[10.5px]",
                  isSelected ? "text-primary-foreground/70" : "text-muted-foreground",
                )}
                data-numeric
              >
                {allDone ? <Check className="mx-auto size-3" /> : tasksCountLabel(day.open)}
              </span>
            </Link>
          );
        })}
      </div>

      <WeekArrow
        href={link({ d: addDaysISO(weekStart, 7) })}
        label="الأسبوع التالي"
        icon={<ChevronLeft className="size-4" />}
      />

      {/* dateless + done pills */}
      <div className="flex flex-col gap-2">
        <Pill href={link({ view: "undated" })} active={view === "undated"} count={strip.undatedCount}>
          بدون تاريخ
        </Pill>
        <Pill href={link({ view: "done" })} active={view === "done"} count={strip.doneTotal}>
          المنجزة
        </Pill>
      </div>
    </div>
  );
}

function WeekArrow({ href, label, icon }: { href: string; label: string; icon: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      className="flex items-center rounded-2xl border px-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    >
      {icon}
    </Link>
  );
}

function Pill({
  href,
  active,
  count,
  children,
}: {
  href: string;
  active: boolean;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex flex-1 items-center justify-between gap-3 rounded-xl border border-dashed px-3.5 text-xs transition-colors",
        active
          ? "border-solid border-primary bg-primary text-primary-foreground"
          : "text-muted-foreground hover:border-foreground/30 hover:bg-accent hover:text-foreground",
      )}
    >
      {children}
      <b data-numeric>{count}</b>
    </Link>
  );
}
