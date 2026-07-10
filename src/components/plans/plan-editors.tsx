"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ListTodo, Plus, X } from "lucide-react";
import {
  addMilestone,
  addTaskToPlan,
  deleteMilestone,
  toggleMilestone,
} from "@/app/(app)/plans/actions";
import { toggleTask } from "@/app/(app)/tasks/actions";
import { Input } from "@/components/ui/input";
import { TaskCheck } from "@/components/ui/task-check";
import { dueLabel, todayISO } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { PlanWithDetail } from "@/lib/queries/plans";

/** Milestones list + add row — shared by the sheet and the inline expansion. */
export function MilestonesEditor({
  plan,
  planStart,
  planEnd,
}: {
  plan: PlanWithDetail;
  planStart: string;
  planEnd: string;
}) {
  const [, startTransition] = useTransition();
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const today = todayISO();

  function add() {
    const t = title.trim();
    if (!t || !due) return;
    startTransition(async () => {
      await addMilestone(plan.id, t, due);
      setTitle("");
      setDue("");
    });
  }

  return (
    <section className="space-y-2">
      <h3 className="text-xs font-bold text-muted-foreground">
        المعالم ◆
        {plan.milestones.length > 0 ? (
          <span className="font-normal" data-numeric>
            {" "}
            ({plan.milestones.filter((m) => m.done).length}/{plan.milestones.length})
          </span>
        ) : null}
      </h3>

      <div className="space-y-1">
        {plan.milestones.map((m) => {
          const late = !m.done && m.dueDate < today;
          return (
            <div key={m.id} className="group flex items-center gap-2.5 rounded-md px-1 py-1">
              <TaskCheck
                done={m.done}
                onToggle={() => startTransition(() => toggleMilestone(m.id, !m.done))}
                className="size-4"
              />
              <span className={cn("flex-1 text-sm", m.done && "text-muted-foreground line-through")}>
                {m.title}
              </span>
              <span
                className={cn("text-xs", late ? "font-medium text-destructive" : "text-muted-foreground")}
                data-numeric
              >
                {late ? "متأخر — " : ""}
                {dueLabel(m.dueDate, today)}
              </span>
              <button
                type="button"
                aria-label="حذف المعلم"
                onClick={() => startTransition(() => deleteMilestone(m.id))}
                className="rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
              >
                <X className="size-3.5" />
              </button>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-2">
        <Plus className="size-3.5 shrink-0 text-muted-foreground" />
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="معلم جديد…"
          className="h-8 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        <Input
          type="date"
          value={due}
          min={planStart}
          max={planEnd}
          onChange={(e) => setDue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          className="h-8 w-36 bg-background"
          data-numeric
        />
      </div>
    </section>
  );
}

/** Plan-linked tasks list + add row — shared by the sheet and the expansion. */
export function PlanTasks({ plan }: { plan: PlanWithDetail }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [title, setTitle] = useState("");
  const today = todayISO();

  function add() {
    const t = title.trim();
    if (!t) return;
    startTransition(async () => {
      await addTaskToPlan(plan.id, t);
      setTitle("");
    });
  }

  return (
    <section className="space-y-2">
      <h3 className="text-xs font-bold text-muted-foreground">
        مهام الخطة
        {plan.tasks.length > 0 ? (
          <span className="font-normal" data-numeric>
            {" "}
            ({plan.tasks.filter((t) => t.done).length}/{plan.tasks.length})
          </span>
        ) : null}
      </h3>

      <div className="space-y-1">
        {plan.tasks.map((t) => (
          <div key={t.id} className="group flex items-center gap-2.5 rounded-md px-1 py-1">
            <TaskCheck
              done={t.done}
              onToggle={() => startTransition(() => toggleTask(t.id, !t.done))}
              className="size-4"
            />
            <button
              type="button"
              onClick={() => router.push(`/tasks?task=${t.id}`)}
              className={cn(
                "min-w-0 flex-1 truncate text-start text-sm hover:underline",
                t.done && "text-muted-foreground line-through",
              )}
            >
              {t.title}
            </button>
            {t.dueDate ? (
              <span
                className={cn(
                  "shrink-0 text-xs",
                  !t.done && t.dueDate < today ? "text-destructive" : "text-muted-foreground",
                )}
                data-numeric
              >
                {dueLabel(t.dueDate, today)}
              </span>
            ) : null}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <ListTodo className="size-3.5 shrink-0 text-muted-foreground" />
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="أضف مهمة لهذه الخطة…"
          className="h-8 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>
    </section>
  );
}
