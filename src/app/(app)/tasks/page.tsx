import type { Metadata } from "next";
import { ChevronDown } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { AreaFilter } from "@/components/tasks/area-filter";
import { AreasManager } from "@/components/tasks/areas-manager";
import { DayStrip } from "@/components/tasks/day-strip";
import { NewTaskButton } from "@/components/tasks/new-task-button";
import { TaskGroup, TaskRow } from "@/components/tasks/task-row";
import { TaskPanel } from "@/components/tasks/task-panel";
import { dayLongLabel, startOfWeekISO, tasksCountLabel, todayISO } from "@/lib/dates";
import {
  getTask,
  listAreas,
  tasksDone,
  tasksForDay,
  tasksOverdue,
  tasksUndated,
  weekStrip,
} from "@/lib/queries/tasks";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "المهام" };

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ d?: string; view?: string; area?: string; task?: string }>;
}) {
  const params = await searchParams;
  const today = todayISO();
  const view: "day" | "undated" | "done" =
    params.view === "undated" || params.view === "done" ? params.view : "day";
  const selected = params.d && ISO.test(params.d) ? params.d : today;
  const areaId = params.area;
  const weekStart = startOfWeekISO(selected);

  const [areas, strip, detail] = await Promise.all([
    listAreas(),
    weekStrip(weekStart, today, areaId),
    params.task ? getTask(params.task) : Promise.resolve(null),
  ]);

  return (
    <>
      <PageHeader
        title="المهـــام"
        description="أيامك — لا تصنيفات مجرّدة."
        actions={
          <div className="flex items-center gap-2">
            <AreaFilter areas={areas} current={areaId} />
            <AreasManager areas={areas} />
          </div>
        }
      />

      <div className="space-y-8">
        <DayStrip
          strip={strip}
          weekStart={weekStart}
          selected={selected}
          view={view}
          today={today}
          areaId={areaId}
        />

        {view === "day" ? (
          <DayBoard selected={selected} today={today} areaId={areaId} />
        ) : view === "undated" ? (
          <UndatedBoard areaId={areaId} />
        ) : (
          <DoneBoard areaId={areaId} />
        )}
      </div>

      {detail ? <TaskPanel task={detail} areas={areas} /> : null}
    </>
  );
}

async function DayBoard({
  selected,
  today,
  areaId,
}: {
  selected: string;
  today: string;
  areaId?: string;
}) {
  const [dayTasks, overdue, undated] = await Promise.all([
    tasksForDay(selected, areaId),
    selected === today ? tasksOverdue(today, areaId) : Promise.resolve([]),
    tasksUndated(areaId),
  ]);

  const open = dayTasks.filter((t) => !t.done);
  const doneToday = dayTasks.filter((t) => t.done);
  const total = dayTasks.length;
  const labels = dayLongLabel(selected);

  return (
    <div className="space-y-6">
      {/* day header + progress */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl font-bold">
            {selected === today ? "اليوم — " : ""}
            {labels.gregorian}
            <span className="ms-2 text-sm font-normal text-muted-foreground" data-numeric>
              {labels.hijri}
            </span>
          </h2>
          <div className="flex items-center gap-4">
            {total > 0 ? (
              <span className="text-xs text-muted-foreground" data-numeric>
                أنجزت {doneToday.length} من {total}
              </span>
            ) : null}
            <NewTaskButton />
          </div>
        </div>
        {total > 0 ? (
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${Math.round((doneToday.length / total) * 100)}%` }}
            />
          </div>
        ) : null}
      </div>

      {overdue.length > 0 ? (
        <TaskGroup
          heading={`متأخرة — من أيام سابقة (${overdue.length})`}
          headingClassName="text-destructive"
          tasks={overdue}
        />
      ) : null}

      {open.length > 0 ? (
        <TaskGroup heading={overdue.length ? "اليوم" : undefined} tasks={open} showDue={false} />
      ) : (
        <p className="rounded-xl border border-dashed px-6 py-12 text-center text-sm text-muted-foreground">
          {total > 0 ? "أنجزت كل شيء — يوم نظيف ✓" : "لا مهام لهذا اليوم."}
        </p>
      )}

      {/* undated ride along under every day — they have no home of their own */}
      {undated.length > 0 ? (
        <TaskGroup heading={`بدون تاريخ (${undated.length})`} tasks={undated} />
      ) : null}

      {doneToday.length > 0 ? (
        <details className="group/done rounded-xl border border-dashed">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3.5 text-sm text-muted-foreground transition-colors hover:text-foreground [&::-webkit-details-marker]:hidden">
            <ChevronDown className="size-4 transition-transform group-open/done:rotate-180" />
            المنجزة
            {selected === todayISO() ? " اليوم" : ""}
            <b data-numeric>({doneToday.length})</b>
          </summary>
          <div className="space-y-2 px-3 pb-3">
            {doneToday.map((t) => (
              <TaskRow key={t.id} task={t} showDue={false} />
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}

async function UndatedBoard({ areaId }: { areaId?: string }) {
  const items = await tasksUndated(areaId);
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-bold">
          بدون تاريخ
          <span className="ms-2 text-sm font-normal text-muted-foreground" data-numeric>
            {tasksCountLabel(items.length) || "فارغة"}
          </span>
        </h2>
        <NewTaskButton />
      </div>
      {items.length > 0 ? (
        <TaskGroup tasks={items} />
      ) : (
        <p className="rounded-xl border border-dashed px-6 py-12 text-center text-sm text-muted-foreground">
          كل مهامك لها مواعيد — ممتاز.
        </p>
      )}
    </div>
  );
}

async function DoneBoard({ areaId }: { areaId?: string }) {
  const items = await tasksDone(areaId);
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">
        المنجزة
        <span className="ms-2 text-sm font-normal text-muted-foreground" data-numeric>
          آخر {items.length}
        </span>
      </h2>
      {items.length > 0 ? (
        <TaskGroup tasks={items} />
      ) : (
        <p className={cn("rounded-xl border border-dashed px-6 py-12 text-center text-sm text-muted-foreground")}>
          لم تُنجز مهام بعد.
        </p>
      )}
    </div>
  );
}
