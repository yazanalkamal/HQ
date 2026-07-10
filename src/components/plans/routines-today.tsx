"use client";

import { useTransition } from "react";
import { toggleRoutineCheck } from "@/app/(app)/plans/actions";
import { TaskCheck } from "@/components/ui/task-check";
import { planHex } from "@/lib/timeline";
import { cn } from "@/lib/utils";

export type RoutineToday = {
  id: string;
  title: string;
  color: string;
  cadence: number;
  checkedToday: boolean;
};

/** روتين اليوم on the dashboard — the gym checkbox that ends excuses. */
export function RoutinesToday({ routines }: { routines: RoutineToday[] }) {
  const [, startTransition] = useTransition();
  if (routines.length === 0) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-bold">روتين اليوم</h2>
      <ul className="grid gap-2 sm:grid-cols-2">
        {routines.map((r) => (
          <li
            key={r.id}
            className="flex items-center gap-3 rounded-xl border px-4 py-3"
          >
            <TaskCheck
              done={r.checkedToday}
              onToggle={() => startTransition(() => toggleRoutineCheck(r.id))}
            />
            <span
              className={cn(
                "min-w-0 flex-1 truncate text-sm",
                r.checkedToday && "text-muted-foreground line-through",
              )}
            >
              {r.title}
            </span>
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ background: planHex(r.color) }}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
