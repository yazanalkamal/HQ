"use client";

import { dueLabel, todayISO } from "@/lib/dates";
import {
  WEEKS,
  barSpan,
  milestonePct,
  monthSpans,
  planHex,
  weekDayLabel,
  type TimelineWindow,
} from "@/lib/timeline";
import { cn } from "@/lib/utils";
import type { PlanWithDetail } from "@/lib/queries/plans";

/**
 * الخارطة — the read-only zoom-out. Projects on the 12-week window,
 * nothing more: all management lives in the cards view.
 */
export function PlanMap({ plans, win }: { plans: PlanWithDetail[]; win: TimelineWindow }) {
  const months = monthSpans(win.weekStarts);
  const today = todayISO();

  if (plans.length === 0) {
    return (
      <p className="rounded-xl border border-dashed px-6 py-14 text-center text-sm text-muted-foreground">
        لا مشاريع على الخارطة بعد.
      </p>
    );
  }

  return (
    <div className="rounded-2xl border p-5">
      <p className="mb-4 text-xs text-muted-foreground">
        للاطّلاع فقط — أين تقع مشاريعك على الأسابيع الاثني عشر. الإدارة كلها في البطاقات.
      </p>
      <div className="overflow-x-auto">
        <div
          className="relative grid min-w-[980px]"
          style={{ gridTemplateColumns: `210px repeat(${WEEKS}, minmax(56px, 1fr))` }}
        >
          {/* current-week highlight */}
          <div
            className="relative rounded-md bg-foreground/[0.045]"
            style={{ gridColumn: win.todayWeek + 2, gridRow: "1 / -1" }}
          >
            <span className="absolute -top-1 right-1/2 z-10 translate-x-1/2 whitespace-nowrap rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-bold text-primary-foreground">
              أنت هنا
            </span>
          </div>

          {months.map((m) => (
            <span
              key={m.label + m.from}
              className="pt-4 text-sm font-bold text-muted-foreground"
              style={{ gridColumn: `${m.from + 2} / span ${m.span}`, gridRow: 2 }}
            >
              {m.label}
            </span>
          ))}
          {win.weekStarts.map((w, i) => (
            <span
              key={w}
              className="border-b pb-2.5 pt-1.5 text-xs text-muted-foreground"
              style={{ gridColumn: i + 2, gridRow: 3 }}
              data-numeric
            >
              {weekDayLabel(w)}
            </span>
          ))}

          {plans.map((p, i) => {
            const span = barSpan(p.startDate, p.endDate, win);
            const hex = planHex(p.color);
            const row = i + 4;
            return (
              <div key={p.id} className="contents">
                <div
                  className={cn(
                    "flex items-center gap-2.5 border-b py-4 pe-4",
                    p.depth === 1 && "ps-6 py-3",
                  )}
                  style={{ gridColumn: 1, gridRow: row }}
                >
                  {p.depth === 1 ? <span className="text-muted-foreground">↳</span> : null}
                  <span
                    className="size-2.5 shrink-0 rotate-45 rounded-[3px]"
                    style={{ background: hex }}
                  />
                  <span
                    className={cn(
                      "min-w-0 truncate",
                      p.depth === 1 ? "text-sm text-muted-foreground" : "text-[15px] font-bold",
                    )}
                  >
                    {p.title}
                  </span>
                </div>
                <div className="relative border-b" style={{ gridColumn: `2 / ${WEEKS + 2}`, gridRow: row }}>
                  {span ? (
                    <div
                      className="absolute inset-y-0 flex items-center"
                      style={{
                        insetInlineStart: `${(span.from / WEEKS) * 100}%`,
                        width: `${((span.to - span.from + 1) / WEEKS) * 100}%`,
                      }}
                    >
                      <span
                        className={cn("relative w-full", p.depth === 1 ? "h-[20px]" : "h-9")}
                        style={{ ["--c" as string]: hex }}
                        title={p.title}
                      >
                        <span
                          className={cn(
                            "absolute inset-0 bg-[var(--c)] opacity-[0.13]",
                            span.clippedStart ? "rounded-e-lg" : "rounded-lg",
                            span.clippedEnd && "rounded-s-none rounded-e-lg",
                          )}
                        />
                        <span
                          className="absolute inset-y-0 start-0 rounded-lg bg-[var(--c)] opacity-30"
                          style={{ width: `${Math.round(p.progress * 100)}%` }}
                        />
                        {p.milestones.map((m) => {
                          const late = !m.done && m.dueDate < today;
                          return (
                            <span
                              key={m.id}
                              title={`${m.title} — ${dueLabel(m.dueDate, today)}${late ? " (متأخر!)" : m.done ? " ✓" : ""}`}
                              className={cn(
                                "absolute top-1/2 -translate-y-1/2 rotate-45 rounded-[2px] border-2",
                                p.depth === 1 ? "size-[9px]" : "size-[13px]",
                                late
                                  ? "border-destructive bg-destructive"
                                  : m.done
                                    ? "border-[var(--c)] bg-[var(--c)]"
                                    : "border-[var(--c)] bg-background",
                              )}
                              style={{
                                insetInlineStart: `${milestonePct(m.dueDate, p.startDate, p.endDate)}%`,
                              }}
                            />
                          );
                        })}
                      </span>
                    </div>
                  ) : (
                    <p className="flex h-full items-center px-2 text-xs text-muted-foreground">
                      خارج نافذة الأسابيع الحالية ({dueLabel(p.startDate, today)})
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
