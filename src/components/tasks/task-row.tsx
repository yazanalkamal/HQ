"use client";

import { useState, useTransition } from "react";
import { useOptimistic } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, CalendarDays, Clock, Flag, ListChecks, Trash2 } from "lucide-react";
import { deleteTask, toggleTask, updateTask } from "@/app/(app)/tasks/actions";
import { TaskCheck } from "@/components/ui/task-check";
import { areaDotClass } from "@/lib/areas";
import { addDaysISO, dueLabel, todayISO } from "@/lib/dates";
import { planHex } from "@/lib/timeline";
import { cn } from "@/lib/utils";
import type { TaskWithMeta } from "@/lib/queries/tasks";

export const PRIORITY_META = [
  { label: "عادية", className: "" },
  { label: "مهمة", className: "text-foreground" },
  { label: "عاجلة", className: "text-destructive" },
] as const;

/**
 * The task card — bigger, calmer, and fast: hover reveals in-place quick
 * actions (postpone to tomorrow, cycle priority, delete) so daily driving
 * never needs the detail panel.
 */
export function TaskRow({ task, showDue = true }: { task: TaskWithMeta; showDue?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const [optimisticDone, setOptimisticDone] = useOptimistic(task.done);
  const [confirmDelete, setConfirmDelete] = useState(false);

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
      onKeyDown={(e) => e.key === "Enter" && openPanel()}
      className="group flex w-full cursor-pointer items-center gap-3.5 rounded-xl border bg-background px-4 py-3.5 transition-all hover:border-foreground/30 hover:shadow-sm"
    >
      <TaskCheck done={optimisticDone} onToggle={onToggle} className="size-[22px]" />

      <p
        className={cn(
          "min-w-0 flex-1 truncate text-[15px]",
          optimisticDone && "text-muted-foreground line-through",
        )}
      >
        {task.title}
      </p>

      {/* hover quick actions */}
      {!optimisticDone ? (
        <span
          className="hidden shrink-0 items-center gap-1 group-hover:inline-flex"
          onClick={(e) => e.stopPropagation()}
        >
          <QuickAct
            title="أجّلها لغد"
            onClick={() =>
              startTransition(() => updateTask({ id: task.id, dueDate: addDaysISO(today, 1) }))
            }
          >
            <ArrowLeft className="size-3" />
            غدًا
          </QuickAct>
          <QuickAct
            title="بدّل الأولوية"
            onClick={() =>
              startTransition(() => updateTask({ id: task.id, priority: (task.priority + 1) % 3 }))
            }
          >
            <Flag className={cn("size-3", task.priority === 2 && "text-destructive")} />
          </QuickAct>
          <QuickAct
            title={confirmDelete ? "متأكد؟" : "حذف"}
            className={cn(confirmDelete && "border-destructive text-destructive")}
            onClick={() => {
              if (!confirmDelete) {
                setConfirmDelete(true);
                setTimeout(() => setConfirmDelete(false), 2500);
                return;
              }
              startTransition(() => deleteTask(task.id));
            }}
          >
            <Trash2 className="size-3" />
            {confirmDelete ? "متأكد؟" : null}
          </QuickAct>
        </span>
      ) : null}

      {/* meta */}
      <span className="flex shrink-0 items-center gap-3.5 text-xs text-muted-foreground">
        {showDue && task.dueDate ? (
          <span className={cn("flex items-center gap-1", overdue && "font-medium text-destructive")} data-numeric>
            <CalendarDays className="size-3" />
            {dueLabel(task.dueDate, today)}
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
        {task.plan ? (
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block size-2 rotate-45 rounded-[1.5px]"
              style={{ background: planHex(task.plan.color) }}
            />
            {task.plan.title}
          </span>
        ) : null}
        {task.area ? (
          <span className="flex items-center gap-1.5">
            <span className={cn("size-2 rounded-full", areaDotClass(task.area.color))} />
            {task.area.name}
          </span>
        ) : null}
      </span>
    </div>
  );
}

function QuickAct({
  className,
  ...props
}: React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      className={cn(
        "flex items-center gap-1 rounded-lg border bg-secondary px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground",
        className,
      )}
      {...props}
    />
  );
}

export function TaskGroup({
  heading,
  headingClassName,
  tasks: groupTasks,
  showDue = true,
}: {
  heading?: string;
  headingClassName?: string;
  tasks: TaskWithMeta[];
  showDue?: boolean;
}) {
  if (groupTasks.length === 0) return null;
  return (
    <section>
      {heading ? (
        <h3 className={cn("mb-2 mt-5 px-1 text-xs font-bold text-muted-foreground", headingClassName)}>
          {heading}
        </h3>
      ) : null}
      <div className="space-y-2">
        {groupTasks.map((t) => (
          <TaskRow key={t.id} task={t} showDue={showDue} />
        ))}
      </div>
    </section>
  );
}
