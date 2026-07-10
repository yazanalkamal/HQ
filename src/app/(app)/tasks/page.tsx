import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { QuickAdd } from "@/components/tasks/quick-add";
import { TaskGroup } from "@/components/tasks/task-row";
import { TaskPanel } from "@/components/tasks/task-panel";
import { AreasManager } from "@/components/tasks/areas-manager";
import { areaDotClass } from "@/lib/areas";
import { dueLabel, todayISO } from "@/lib/dates";
import {
  getTask,
  listAreas,
  tasksDone,
  tasksForToday,
  tasksLater,
  tasksUpcoming,
  viewCounts,
  type TaskView,
  type TaskWithMeta,
} from "@/lib/queries/tasks";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "المهام" };

const VIEWS: { key: TaskView; label: string }[] = [
  { key: "today", label: "اليوم" },
  { key: "upcoming", label: "القادم" },
  { key: "later", label: "لاحقًا" },
  { key: "done", label: "المكتملة" },
];

const FETCHERS: Record<TaskView, (areaId?: string) => Promise<TaskWithMeta[]>> = {
  today: tasksForToday,
  upcoming: tasksUpcoming,
  later: tasksLater,
  done: tasksDone,
};

const EMPTY_MESSAGES: Record<TaskView, string> = {
  today: "لا مهام لليوم — يوم صافٍ.",
  upcoming: "لا شيء قادم هذا الأسبوع.",
  later: "لا مهام مؤجلة.",
  done: "لم تُنجز مهام بعد.",
};

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; area?: string; task?: string }>;
}) {
  const params = await searchParams;
  const view: TaskView = (VIEWS.some((v) => v.key === params.view) ? params.view : "today") as TaskView;
  const areaId = params.area;

  const [areas, counts, viewTasks] = await Promise.all([
    listAreas(),
    viewCounts(areaId),
    FETCHERS[view](areaId),
  ]);

  const detail = params.task ? await getTask(params.task) : null;

  const today = todayISO();

  // group for display
  let groups: { heading?: string; tasks: TaskWithMeta[] }[];
  if (view === "today") {
    const overdue = viewTasks.filter((t) => t.dueDate && t.dueDate < today);
    const dueToday = viewTasks.filter((t) => !t.dueDate || t.dueDate === today);
    groups = [
      { heading: overdue.length ? "متأخرة" : undefined, tasks: overdue },
      { heading: overdue.length && dueToday.length ? "اليوم" : undefined, tasks: dueToday },
    ];
  } else if (view === "upcoming") {
    const byDate = new Map<string, TaskWithMeta[]>();
    for (const t of viewTasks) {
      const k = t.dueDate!;
      byDate.set(k, [...(byDate.get(k) ?? []), t]);
    }
    groups = [...byDate.entries()].map(([d, ts]) => ({
      heading: dueLabel(d, today),
      tasks: ts,
    }));
  } else if (view === "later") {
    const dated = viewTasks.filter((t) => t.dueDate);
    const undated = viewTasks.filter((t) => !t.dueDate);
    groups = [
      { heading: dated.length && undated.length ? "بتاريخ بعيد" : undefined, tasks: dated },
      { heading: dated.length && undated.length ? "بدون تاريخ" : undefined, tasks: undated },
    ];
  } else {
    groups = [{ tasks: viewTasks }];
  }

  const isEmpty = viewTasks.length === 0;

  const linkFor = (v?: TaskView, a?: string | null) => {
    const p = new URLSearchParams();
    if (v && v !== "today") p.set("view", v);
    if (a) p.set("area", a);
    const q = p.toString();
    return q ? `/tasks?${q}` : "/tasks";
  };

  return (
    <>
      <PageHeader
        title="المهـــام"
        description="كل مهامك ومواعيدها في مكان واحد."
        actions={<AreasManager areas={areas} />}
      />

      <div className="space-y-6">
        <QuickAdd areas={areas} defaultDate={view === "today" ? today : undefined} />

        {/* view tabs */}
        <nav className="flex items-center gap-1 border-b">
          {VIEWS.map((v) => (
            <Link
              key={v.key}
              href={linkFor(v.key, areaId)}
              className={cn(
                "-mb-px flex items-center gap-1.5 border-b-2 px-3.5 py-2.5 text-sm transition-colors",
                view === v.key
                  ? "border-foreground font-medium text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {v.label}
              {counts[v.key] > 0 ? (
                <span className="text-xs text-muted-foreground" data-numeric>
                  {counts[v.key]}
                </span>
              ) : null}
            </Link>
          ))}
        </nav>

        {/* area filter chips */}
        {areas.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <Link
              href={linkFor(view, null)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs transition-colors",
                !areaId
                  ? "border-foreground/30 bg-secondary"
                  : "border-transparent text-muted-foreground hover:bg-accent",
              )}
            >
              الكل
            </Link>
            {areas.map((a) => (
              <Link
                key={a.id}
                href={linkFor(view, areaId === a.id ? null : a.id)}
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors",
                  areaId === a.id
                    ? "border-foreground/30 bg-secondary"
                    : "border-transparent text-muted-foreground hover:bg-accent",
                )}
              >
                <span className={cn("size-2 rounded-full", areaDotClass(a.color))} />
                {a.name}
              </Link>
            ))}
          </div>
        ) : null}

        {/* lists */}
        {isEmpty ? (
          <p className="rounded-xl border border-dashed px-6 py-14 text-center text-sm text-muted-foreground">
            {EMPTY_MESSAGES[view]}
          </p>
        ) : (
          <div className="space-y-2">
            {groups.map((g, i) => (
              <TaskGroup key={g.heading ?? i} heading={g.heading} tasks={g.tasks} />
            ))}
          </div>
        )}
      </div>

      {detail ? <TaskPanel task={detail} areas={areas} /> : null}
    </>
  );
}
