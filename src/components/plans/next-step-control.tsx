"use client";

import { useState, useTransition } from "react";
import { completeNextStep, updatePlan } from "@/app/(app)/plans/actions";
import { TaskCheck } from "@/components/ui/task-check";
import type { PlanWithDetail } from "@/lib/queries/plans";

/**
 * The heartbeat of a project plan: the always-visible next step.
 * Checking it immediately asks for the new one — a goal is never
 * allowed to sit quietly without a next action.
 */
export function NextStepControl({ plan }: { plan: PlanWithDetail }) {
  const [, startTransition] = useTransition();
  const [asking, setAsking] = useState(false);
  const [draft, setDraft] = useState("");

  function submitNew(value: string) {
    startTransition(async () => {
      await completeNextStep(plan.id, value.trim());
      setAsking(false);
      setDraft("");
    });
  }

  if (asking) {
    return (
      <div className="mt-1.5 flex items-center gap-2">
        <span className="text-xs text-muted-foreground">أنجزت!</span>
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submitNew(draft);
            if (e.key === "Escape") setAsking(false);
          }}
          onBlur={() => submitNew(draft)}
          placeholder="وش الخطوة الجديدة؟"
          className="h-6 w-44 border-b bg-transparent text-xs outline-none placeholder:text-muted-foreground"
        />
      </div>
    );
  }

  if (plan.nextStep.trim() === "") {
    return (
      <div className="mt-1.5 space-y-1">
        <input
          placeholder="حدّد الخطوة التالية…"
          onKeyDown={(e) => {
            const v = e.currentTarget.value.trim();
            if (e.key === "Enter" && v) {
              startTransition(() => updatePlan({ id: plan.id, nextStep: v }));
              e.currentTarget.value = "";
            }
          }}
          className="h-6 w-44 border-b border-destructive/40 bg-transparent text-xs outline-none placeholder:text-destructive/70"
        />
        <span className="block w-fit rounded-full border border-destructive px-2 py-px text-[10.5px] text-destructive">
          متعثرة — لا خطوة تالية
        </span>
      </div>
    );
  }

  return (
    <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
      <TaskCheck done={false} onToggle={() => setAsking(true)} className="size-4" />
      <span className="min-w-0 truncate" title={plan.nextStep}>
        {plan.nextStep}
      </span>
    </div>
  );
}
