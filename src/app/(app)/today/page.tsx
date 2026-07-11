import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, CalendarClock } from "lucide-react";
import { RoutinesToday } from "@/components/plans/routines-today";
import { NewTaskButton } from "@/components/tasks/new-task-button";
import { TaskGroup } from "@/components/tasks/task-row";
import { TaskPanel } from "@/components/tasks/task-panel";
import { formatSAR } from "@/lib/currency";
import { daysUntil, dueLabel, greeting, todayISO, todayLongLabel } from "@/lib/dates";
import { PlatformPulseStrip } from "@/components/today/platform-pulse";
import { SummaryStrip } from "@/components/today/summary-strip";
import { financePulse, upcomingRenewals } from "@/lib/queries/finance";
import { plansPulse, routinesForToday } from "@/lib/queries/plans";
import { latestSnapshotDay, platformPulse, xSessionBroken } from "@/lib/queries/stats";
import {
  completedTodayCount,
  getTask,
  listAreas,
  tasksForToday,
  tasksUpcoming,
} from "@/lib/queries/tasks";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "اليوم" };

export default async function TodayPage({
  searchParams,
}: {
  searchParams: Promise<{ task?: string }>;
}) {
  const params = await searchParams;

  const [todayTasks, upcoming, areas, doneCount, renewals, routines] = await Promise.all([
    tasksForToday(),
    tasksUpcoming(),
    listAreas(),
    completedTodayCount(),
    upcomingRenewals(7),
    routinesForToday(),
  ]);
  const [planPulse, finPulse, pulses, xBroken, snapshotDay] = await Promise.all([
    plansPulse(),
    financePulse(),
    platformPulse(),
    xSessionBroken(),
    latestSnapshotDay(),
  ]);

  const detail = params.task ? await getTask(params.task) : null;

  const today = todayISO();
  const overdue = todayTasks.filter((t) => t.dueDate && t.dueDate < today);
  const dueToday = todayTasks.filter((t) => !t.dueDate || t.dueDate === today);
  const dates = todayLongLabel();
  // his chosen display name — not the Google account name (kashida is fine
  // here: the hero is a display heading, same treatment as المقـــر)
  const firstName = "يــاز";

  return (
    <>
      {/* hero */}
      <header className="mb-10 flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="font-display text-4xl font-bold tracking-tight md:text-5xl">
            {greeting()}
            {firstName ? `، ${firstName}` : ""}
          </h1>
          <p className="text-sm text-muted-foreground" data-numeric>
            {dates.gregorian} · {dates.hijri}
          </p>
        </div>
        <NewTaskButton className="mt-2" />
      </header>

      {/* قمرة اليوم — task/plan/finance counts live here, not in the hero */}
      <SummaryStrip
        tasks={{ today: todayTasks.length, overdue: overdue.length, done: doneCount }}
        plans={planPulse}
        finance={finPulse}
      />

      <div className="space-y-10">
        <PlatformPulseStrip pulses={pulses} xBroken={xBroken} snapshotDay={snapshotDay} />
        <RoutinesToday routines={routines} />

        {/* today's tasks */}
        {todayTasks.length > 0 ? (
          <section className="space-y-2">
            <div className="space-y-2">
              <TaskGroup heading={overdue.length ? "متأخرة" : undefined} tasks={overdue} />
              <TaskGroup
                heading={overdue.length && dueToday.length ? "اليوم" : undefined}
                tasks={dueToday}
              />
            </div>
            <Link
              href="/tasks"
              className="flex w-fit items-center gap-1 px-3.5 text-xs text-muted-foreground hover:text-foreground"
            >
              كل المهام
              <ArrowLeft className="size-3" />
            </Link>
          </section>
        ) : (
          <p className="rounded-xl border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">
            يوم صافٍ — أضف مهمة أو استرح بضمير مرتاح.
          </p>
        )}

        {/* upcoming preview */}
        {upcoming.length > 0 ? (
          <section className="space-y-3">
            <h2 className="text-sm font-bold">القادم هذا الأسبوع</h2>
            <TaskGroup tasks={upcoming.slice(0, 5)} />
          </section>
        ) : null}

        {/* renewals within a week */}
        {renewals.length > 0 ? (
          <section className="space-y-3">
            <h2 className="text-sm font-bold">تجديدات قريبة</h2>
            <ul className="divide-y rounded-xl border">
              {renewals.map((r) => {
                const days = daysUntil(r.effectiveRenewal, today);
                return (
                  <li key={r.id} className="flex items-center gap-3 px-5 py-3">
                    <CalendarClock
                      className={cn(
                        "size-4 shrink-0",
                        days <= 1 ? "text-destructive" : "text-muted-foreground",
                      )}
                    />
                    <Link href="/finance" className="min-w-0 flex-1 truncate text-sm hover:underline">
                      {r.name}
                    </Link>
                    <span
                      className={cn(
                        "text-xs",
                        days <= 1 ? "font-medium text-destructive" : "text-muted-foreground",
                      )}
                      data-numeric
                    >
                      {dueLabel(r.effectiveRenewal, today)}
                    </span>
                    <span className="text-sm font-medium" data-numeric>
                      {formatSAR(r.amount)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}
      </div>

      {detail ? <TaskPanel task={detail} areas={areas} /> : null}
    </>
  );
}
