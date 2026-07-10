import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, CalendarClock } from "lucide-react";
import { QuickAdd } from "@/components/tasks/quick-add";
import { TaskGroup } from "@/components/tasks/task-row";
import { TaskPanel } from "@/components/tasks/task-panel";
import { getCurrentSession } from "@/lib/auth";
import { formatSAR } from "@/lib/currency";
import { daysUntil, dueLabel, greeting, todayISO, todayLongLabel } from "@/lib/dates";
import { upcomingRenewals } from "@/lib/queries/finance";
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
  const { user } = await getCurrentSession();
  const params = await searchParams;

  const [todayTasks, upcoming, areas, doneCount, renewals] = await Promise.all([
    tasksForToday(),
    tasksUpcoming(),
    listAreas(),
    completedTodayCount(),
    upcomingRenewals(7),
  ]);

  const detail = params.task ? await getTask(params.task) : null;

  const today = todayISO();
  const overdue = todayTasks.filter((t) => t.dueDate && t.dueDate < today);
  const dueToday = todayTasks.filter((t) => !t.dueDate || t.dueDate === today);
  const dates = todayLongLabel();
  const firstName = user?.name.split(" ")[0] || "";

  return (
    <>
      {/* hero */}
      <header className="mb-10 space-y-2">
        <h1 className="font-display text-4xl font-bold tracking-tight md:text-5xl">
          {greeting()}
          {firstName ? `، ${firstName}` : ""}
        </h1>
        <p className="text-sm text-muted-foreground" data-numeric>
          {dates.gregorian} · {dates.hijri}
        </p>
        <p className="text-sm text-muted-foreground" data-numeric>
          {doneCount > 0
            ? `أنجزت ${doneCount} ${doneCount === 1 ? "مهمة" : doneCount === 2 ? "مهمتين" : "مهام"} اليوم`
            : todayTasks.length > 0
              ? `أمامك ${todayTasks.length} ${todayTasks.length === 1 ? "مهمة" : "مهام"} اليوم`
              : "لا مهام على جدول اليوم"}
          {overdue.length > 0 ? (
            <span className="text-destructive"> · {overdue.length} متأخرة</span>
          ) : null}
        </p>
      </header>

      <div className="space-y-10">
        <QuickAdd areas={areas} defaultDate={today} />

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
