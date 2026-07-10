"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Plus, Trash2, X } from "lucide-react";
import {
  addMilestone,
  createPlan,
  deleteMilestone,
  deletePlan,
  toggleMilestone,
  updatePlan,
} from "@/app/(app)/plans/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { TaskCheck } from "@/components/ui/task-check";
import { dueLabel, todayISO } from "@/lib/dates";
import { addMonthsISO } from "@/lib/finance";
import { PLAN_COLORS, type PlanColor } from "@/lib/timeline";
import { cn } from "@/lib/utils";
import type { Idea } from "@/db/schema";
import type { PlanWithDetail } from "@/lib/queries/plans";

export type SheetRequest =
  | { mode: "create"; fromIdea?: Idea }
  | { mode: "edit"; planId: string }
  | null;

export type SheetState =
  | { mode: "create"; fromIdea?: Idea }
  | { mode: "edit"; plan: PlanWithDetail };

export function PlanSheet({
  state,
  onClose,
}: {
  state: SheetState;
  onClose: () => void;
}) {
  const editing = state.mode === "edit" ? state.plan : null;
  const [, startTransition] = useTransition();
  const today = todayISO();

  const [title, setTitle] = useState(
    state.mode === "edit" ? state.plan.title : (state.fromIdea?.text ?? ""),
  );
  const [kind, setKind] = useState<"project" | "routine">(
    (editing?.kind as "project" | "routine") ?? "project",
  );
  const [startDate, setStartDate] = useState(editing?.startDate ?? today);
  const [endDate, setEndDate] = useState(editing?.endDate ?? addMonthsISO(today, 2));
  const [color, setColor] = useState<PlanColor>((editing?.color as PlanColor) ?? "violet");
  const [nextStep, setNextStep] = useState(editing?.nextStep ?? "");
  const [cadence, setCadence] = useState(editing?.cadence ?? 3);
  const [description, setDescription] = useState(editing?.description ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState("");

  const valid = title.trim() && startDate && endDate && endDate >= startDate;

  function save() {
    if (!valid) {
      setError("أكمل العنوان والتواريخ (النهاية بعد البداية)");
      return;
    }
    const data = {
      title: title.trim(),
      kind,
      startDate,
      endDate,
      color,
      nextStep,
      cadence,
      description,
    };
    startTransition(async () => {
      try {
        if (editing) await updatePlan({ id: editing.id, ...data });
        else
          await createPlan({
            ...data,
            fromIdeaId: state.mode === "create" ? state.fromIdea?.id : undefined,
          });
        onClose();
      } catch {
        setError("تعذّر الحفظ — راجع القيم");
      }
    });
  }

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent title={editing ? "تفاصيل الخطة" : "خطة جديدة"}>
        <div className="space-y-5">
          <label className="block space-y-1.5">
            <span className="text-xs text-muted-foreground">العنوان</span>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="مشروعان + AWS للإنتاج"
              autoFocus={!editing}
            />
          </label>

          {/* kind — locked after creation to keep data sane */}
          {!editing ? (
            <div className="space-y-1.5">
              <span className="text-xs text-muted-foreground">النوع</span>
              <div className="flex items-center rounded-lg border p-0.5">
                {(
                  [
                    ["project", "مشروع — معالم وتواريخ"],
                    ["routine", "روتين — تكرار أسبوعي"],
                  ] as const
                ).map(([k, label]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setKind(k)}
                    className={cn(
                      "flex-1 rounded-md px-2 py-1.5 text-xs transition-colors",
                      kind === k ? "bg-secondary font-medium" : "text-muted-foreground",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1.5">
              <span className="text-xs text-muted-foreground">البداية</span>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} data-numeric />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs text-muted-foreground">النهاية</span>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} data-numeric />
            </label>
          </div>

          <div className="flex items-end justify-between gap-4">
            <div className="space-y-1.5">
              <span className="text-xs text-muted-foreground">اللون</span>
              <div className="flex items-center gap-1.5">
                {(Object.keys(PLAN_COLORS) as PlanColor[]).map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={PLAN_COLORS[c].label}
                    onClick={() => setColor(c)}
                    className={cn(
                      "flex size-7 items-center justify-center rounded-full border transition-transform hover:scale-110",
                      color === c ? "border-foreground" : "border-transparent",
                    )}
                  >
                    <span className="size-4 rounded-full" style={{ background: PLAN_COLORS[c].hex }} />
                  </button>
                ))}
              </div>
            </div>

            {kind === "routine" ? (
              <label className="block space-y-1.5">
                <span className="text-xs text-muted-foreground">كم مرة أسبوعيًا؟</span>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setCadence(n)}
                      className={cn(
                        "size-7 rounded-md border text-xs transition-colors",
                        cadence === n
                          ? "border-foreground bg-secondary font-bold"
                          : "border-transparent text-muted-foreground hover:bg-accent",
                      )}
                      data-numeric
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </label>
            ) : (
              <label className="block flex-1 space-y-1.5">
                <span className="text-xs text-muted-foreground">الخطوة التالية</span>
                <Input
                  value={nextStep}
                  onChange={(e) => setNextStep(e.target.value)}
                  placeholder="أول خطوة صغيرة وواضحة…"
                />
              </label>
            )}
          </div>

          <label className="block space-y-1.5">
            <span className="text-xs text-muted-foreground">التفاصيل</span>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="لماذا هذه الخطة؟ ماذا يعني نجاحها؟"
            />
          </label>

          {/* milestones — edit mode, projects only */}
          {editing && editing.kind === "project" ? (
            <MilestonesEditor plan={editing} planStart={startDate} planEnd={endDate} />
          ) : null}
          {!editing && kind === "project" ? (
            <p className="rounded-lg bg-secondary px-3.5 py-2.5 text-xs text-muted-foreground">
              بعد الإنشاء افتح الخطة لإضافة المعالم (◆) على تواريخ حقيقية.
            </p>
          ) : null}

          {error ? <p className="text-xs text-destructive">{error}</p> : null}

          <div className="flex items-center justify-between border-t pt-4">
            <div className="flex items-center gap-2">
              <Button onClick={save}>{editing ? "حفظ" : "إنشاء"}</Button>
              {editing ? (
                <Button
                  variant="secondary"
                  size="sm"
                  className="gap-1.5"
                  onClick={() =>
                    startTransition(async () => {
                      await updatePlan({ id: editing.id, status: "done" });
                      onClose();
                    })
                  }
                >
                  <CheckCircle2 className="size-3.5" />
                  أنجزتها 🎉
                </Button>
              ) : null}
            </div>
            {editing ? (
              <Button
                variant="destructive"
                size="sm"
                className="gap-1.5"
                onClick={() => {
                  if (!confirmDelete) {
                    setConfirmDelete(true);
                    setTimeout(() => setConfirmDelete(false), 3000);
                    return;
                  }
                  startTransition(async () => {
                    await deletePlan(editing.id);
                    onClose();
                  });
                }}
              >
                <Trash2 className="size-3.5" />
                {confirmDelete ? "متأكد؟" : "حذف"}
              </Button>
            ) : null}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function MilestonesEditor({
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
      <h3 className="text-xs text-muted-foreground">
        المعالم
        {plan.milestones.length > 0 ? (
          <span data-numeric>
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
          className="h-8 w-36"
          data-numeric
        />
      </div>
    </section>
  );
}
