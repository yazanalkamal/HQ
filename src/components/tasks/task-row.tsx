"use client";

import { useOptimistic, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, Flag, ListChecks, Clock } from "lucide-react";
import { toggleTask } from "@/app/(app)/tasks/actions";
import { TaskCheck } from "@/components/ui/task-check";
import { areaDotClass } from "@/lib/areas";
import { dueLabel, todayISO } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { TaskWithMeta } from "@/lib/queries/tasks";

export const PRIORITY_META = [
  { label: "عادية", className: "" },
  { label: "مهمة", className: "text-foreground" },
  { label: "عاجلة", className: "text-destructive" },
] as const;

export function TaskRow({ task }: { task: TaskWithMeta }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const [optimisticDone, setOptimisticDone] = useOptimistic(task.done);

  const today = todayISO();
  const overdue = !optimisticDone && !!task.dueDate && task.dueDate < today;

  function openPanel() {
    const params = new URLSearchParams(searchParams);
    params.set("task", task.id);
    router.push(`${pathname}?${params}`, { scroll: false });
  }

  function onToggle() {
    startTransition(async () => {
      setOptimisticDone(!optimisticDone);
      await toggleTask(task.id, !optimisticDone);
    });
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={openPanel}
      onKeyDown={(e) => {
        if (e.key === "Enter") openPanel();
      }}
      className="group flex w-full cursor-pointer items-center gap-3.5 rounded-lg px-3.5 py-3 text-start transition-colors hover:bg-accent"
    >
      <TaskCheck done={optimisticDone} onToggle={onToggle} />

      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "truncate text-sm transition-colors",
            optimisticDone && "text-muted-foreground line-through",
          )}
        >
          {task.title}
        </p>

        {(task.dueDate || task.area || task.priority > 0 || task.subtaskCount > 0) && (
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {task.dueDate ? (
              <span
                className={cn("flex items-center gap-1", overdue && "text-destructive")}
                data-numeric
              >
                <CalendarDays className="size-3" />
                {overdue ? `متأخرة — ${dueLabel(task.dueDate, today)}` : dueLabel(task.dueDate, today)}
              </span>
            ) : null}
            {task.dueTime ? (
              <span className="flex items-center gap-1" data-numeric>
                <Clock className="size-3" />
                {task.dueTime}
              </span>
            ) : null}
            {task.priority > 0 ? (
              <span className={cn("flex items-center gap-1", PRIORITY_META[task.priority].className)}>
                <Flag className="size-3" />
                {PRIORITY_META[task.priority].label}
              </span>
            ) : null}
            {task.subtaskCount > 0 ? (
              <span className="flex items-center gap-1" data-numeric>
                <ListChecks className="size-3" />
                {task.subtaskDone}/{task.subtaskCount}
              </span>
            ) : null}
            {task.area ? (
              <span className="flex items-center gap-1.5">
                <span className={cn("size-2 rounded-full", areaDotClass(task.area.color))} />
                {task.area.name}
              </span>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

export function TaskGroup({
  heading,
  tasks: groupTasks,
}: {
  heading?: string;
  tasks: TaskWithMeta[];
}) {
  if (groupTasks.length === 0) return null;
  return (
    <section className="space-y-1">
      {heading ? (
        <h3 className="px-3.5 pb-1 pt-4 text-xs font-medium text-muted-foreground">
          {heading}
        </h3>
      ) : null}
      <div className="space-y-0.5">
        {groupTasks.map((t) => (
          <TaskRow key={t.id} task={t} />
        ))}
      </div>
    </section>
  );
}
