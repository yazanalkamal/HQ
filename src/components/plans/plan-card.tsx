"use client";

import { useRef, useState, useTransition } from "react";
import {
  Archive,
  Check,
  CheckCircle2,
  ChevronDown,
  GitBranch,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { completeNextStep, deletePlan, updatePlan } from "@/app/(app)/plans/actions";
import { MilestonesEditor, PlanTasks } from "./plan-editors";
import { daysUntil, dueLabel, todayISO } from "@/lib/dates";
import { planHex } from "@/lib/timeline";
import { cn } from "@/lib/utils";
import type { ParentRef } from "./plan-sheet";
import type { PlanWithDetail } from "@/lib/queries/plans";

const stepDateFmt = new Intl.DateTimeFormat("ar-u-nu-latn", {
  timeZone: "Asia/Riyadh",
  day: "numeric",
  month: "long",
});

/** Attention score for sorting: overdue milestones outrank a missing step. */
export function planAttention(plan: PlanWithDetail, today: string): number {
  const late = plan.milestones.some((m) => !m.done && m.dueDate < today);
  return (late ? 2 : 0) + (plan.stalled ? 1 : 0);
}

/**
 * One project = one card, led by its next step. The gauge below carries
 * both progress (fill) and time (tick): fill behind the tick means the
 * plan is behind schedule. Expansion is the management surface.
 */
export function PlanCard({
  plan,
  expanded,
  onToggle,
  onFullEdit,
  onOpenPlan,
  onCreateSub,
}: {
  plan: PlanWithDetail;
  expanded: boolean;
  onToggle: () => void;
  onFullEdit: () => void;
  onOpenPlan: (planId: string) => void;
  onCreateSub: (parent: ParentRef) => void;
}) {
  const today = todayISO();
  const hex = planHex(plan.color);
  const lateMs = plan.milestones.filter((m) => !m.done && m.dueDate < today);
  const nextMs = plan.milestones.find((m) => !m.done);
  const nextLate = !!nextMs && nextMs.dueDate < today;
  const doneTasks = plan.tasks.filter((t) => t.done).length;

  const totalDays = Math.max(1, daysUntil(plan.endDate, plan.startDate));
  const timePct = Math.min(100, Math.max(0, Math.round((daysUntil(today, plan.startDate) / totalDays) * 100)));
  const progressPct = Math.round(plan.progress * 100);

  return (
    <div className="rounded-2xl border bg-background transition-all hover:border-foreground/25 hover:shadow-sm">
      {/* header */}
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-5 pt-4 text-start"
      >
        <span className="size-[11px] shrink-0 rotate-45 rounded-[2.5px]" style={{ background: hex }} />
        <span className="min-w-0 truncate text-[17px] font-bold">{plan.title}</span>
        <span className="hidden shrink-0 text-[11.5px] text-muted-foreground sm:inline" data-numeric>
          {plan.milestones.length > 0 ? `${plan.milestones.length} ◆ · ` : ""}
          {plan.tasks.length > 0 ? `${plan.tasks.length} مهام · ` : ""}
          ينتهي {dueLabel(plan.endDate, today)}
        </span>
        <span className="ms-auto flex shrink-0 items-center gap-2.5">
          {lateMs.length > 0 ? (
            <span className="rounded-full border border-destructive px-2.5 py-0.5 text-[11px] font-bold text-destructive">
              معلم متأخر
            </span>
          ) : plan.stalled ? (
            <span className="rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-bold text-primary-foreground">
              متعثرة — بلا خطوة
            </span>
          ) : (
            <span className="rounded-full bg-secondary px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground">
              سائرة
            </span>
          )}
          <ChevronDown
            className={cn("size-4 text-muted-foreground transition-transform", expanded && "rotate-180")}
          />
        </span>
      </button>

      <NextStepHero plan={plan} />

      {/* gauge: progress fill + time tick */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-5 pb-4 ps-10 text-xs text-muted-foreground">
        <span
          className="relative h-1.5 min-w-44 flex-1 rounded-full bg-secondary"
          title={`التقدم ${progressPct}% — مضى ${timePct}% من الوقت`}
          data-numeric
        >
          <span
            className="absolute inset-y-0 start-0 rounded-full opacity-75"
            style={{ width: `${progressPct}%`, background: hex }}
          />
          <span
            className="absolute -inset-y-1 w-0.5 rounded bg-foreground"
            style={{ insetInlineStart: `${timePct}%` }}
          />
        </span>
        {nextMs ? (
          <span
            className={cn("flex items-center gap-1.5", nextLate && "font-bold text-destructive")}
            data-numeric
          >
            <span
              className="inline-block size-2 rotate-45 rounded-[1.5px]"
              style={{ background: nextLate ? "var(--destructive)" : hex }}
            />
            {nextMs.title} — {nextLate ? "متأخر، كان " : ""}
            {dueLabel(nextMs.dueDate, today)}
          </span>
        ) : null}
        {plan.tasks.length > 0 ? (
          <span data-numeric>مهام {doneTasks}/{plan.tasks.length}</span>
        ) : null}
      </div>

      {/* expansion — the management surface */}
      {expanded ? <CardBody plan={plan} onFullEdit={onFullEdit} onOpenPlan={onOpenPlan} onCreateSub={onCreateSub} /> : null}
    </div>
  );
}

/**
 * The momentum loop: «أنجزتها» strikes the step and asks for the next one
 * (the done step lands in سجل الدفعات). An empty step = متعثرة, rescued
 * by an inline input right on the card.
 */
function NextStepHero({ plan }: { plan: PlanWithDetail }) {
  const [pending, startTransition] = useTransition();
  const [asking, setAsking] = useState(false);
  const [draft, setDraft] = useState("");
  const settledRef = useRef(false);

  function submit(value: string) {
    if (settledRef.current) return;
    settledRef.current = true;
    startTransition(async () => {
      await completeNextStep(plan.id, value.trim());
      setAsking(false);
      setDraft("");
      settledRef.current = false;
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-3.5 px-5 pb-3.5 ps-10 pt-2.5">
      <span className="shrink-0 text-[11px] font-bold text-muted-foreground">الخطوة القادمة</span>

      {asking ? (
        <>
          <span className="text-[15px] text-muted-foreground line-through">{plan.nextStep}</span>
          <input
            autoFocus
            dir="auto"
            value={draft}
            maxLength={500}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing) submit(draft);
              if (e.key === "Escape") {
                settledRef.current = true;
                setAsking(false);
                setDraft("");
                setTimeout(() => (settledRef.current = false));
              }
            }}
            onBlur={() => submit(draft)}
            placeholder="ما الخطوة التالية؟ … ثم Enter"
            className="min-w-60 flex-1 rounded-lg bg-secondary px-3.5 py-2 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/40"
          />
        </>
      ) : plan.stalled ? (
        <input
          dir="auto"
          maxLength={500}
          onKeyDown={(e) => {
            const v = e.currentTarget.value.trim();
            if (e.key === "Enter" && v && !e.nativeEvent.isComposing) {
              startTransition(() => updatePlan({ id: plan.id, nextStep: v }));
              e.currentTarget.value = "";
            }
          }}
          placeholder="حدّد الخطوة القادمة… ثم Enter"
          className="min-w-60 flex-1 rounded-lg bg-secondary px-3.5 py-2 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/40"
        />
      ) : (
        <>
          <span className="min-w-0 flex-1 text-[15px]" dir="auto">
            {plan.nextStep}
          </span>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              setDraft("");
              setAsking(true);
            }}
            className="flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1 text-xs font-bold text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
          >
            <Check className="size-3" strokeWidth={2.6} />
            أنجزتها
          </button>
        </>
      )}
    </div>
  );
}

function CardBody({
  plan,
  onFullEdit,
  onOpenPlan,
  onCreateSub,
}: {
  plan: PlanWithDetail;
  onFullEdit: () => void;
  onOpenPlan: (planId: string) => void;
  onCreateSub: (parent: ParentRef) => void;
}) {
  const [, startTransition] = useTransition();
  // one arming at a time; every plan-level exit needs a second click
  const [confirming, setConfirming] = useState<null | "done" | "archive" | "delete">(null);

  function armed(kind: "done" | "archive" | "delete", go: () => void) {
    if (confirming !== kind) {
      setConfirming(kind);
      setTimeout(() => setConfirming((c) => (c === kind ? null : c)), 3000);
      return;
    }
    startTransition(go);
  }

  return (
    <div className="border-t px-5 py-4">
      <div className="grid gap-6 md:grid-cols-2">
        <MilestonesEditor plan={plan} planStart={plan.startDate} planEnd={plan.endDate} />
        <PlanTasks plan={plan} />
      </div>

      {plan.steps.length > 0 ? (
        <section className="mt-5 space-y-1">
          <h3 className="text-xs font-bold text-muted-foreground">سجل الدفعات</h3>
          {plan.steps.map((s) => (
            <p key={s.id} className="flex items-center gap-2.5 py-0.5 text-sm text-muted-foreground">
              <Check className="size-3.5 shrink-0" />
              <span className="min-w-0 flex-1 truncate" dir="auto">
                {s.text}
              </span>
              <span className="shrink-0 text-xs" data-numeric>
                {stepDateFmt.format(new Date(s.doneAt))}
              </span>
            </p>
          ))}
        </section>
      ) : null}

      {!plan.parentId ? (
        <section className="mt-5 flex flex-wrap items-center gap-2">
          <h3 className="text-xs font-bold text-muted-foreground">الخطط الفرعية</h3>
          {plan.children.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => onOpenPlan(c.id)}
              className="flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground"
            >
              <GitBranch className="size-3" />
              {c.title}
            </button>
          ))}
          <button
            type="button"
            onClick={() =>
              onCreateSub({
                id: plan.id,
                title: plan.title,
                startDate: plan.startDate,
                endDate: plan.endDate,
                color: plan.color,
              })
            }
            className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <Plus className="size-3" />
            خطة فرعية
          </button>
        </section>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-3.5">
        <BodyBtn onClick={onFullEdit}>
          <Pencil className="size-3.5" />
          تحرير كامل
        </BodyBtn>
        <BodyBtn
          className={cn(confirming === "done" && "border-foreground font-bold text-foreground")}
          onClick={() => armed("done", () => updatePlan({ id: plan.id, status: "done" }))}
        >
          <CheckCircle2 className="size-3.5" />
          {confirming === "done" ? "متأكد؟ تنتقل إلى المنجزة" : "أنجزت الخطة كلها 🎉"}
        </BodyBtn>
        <BodyBtn
          className={cn(confirming === "archive" && "border-foreground font-bold text-foreground")}
          onClick={() => armed("archive", () => updatePlan({ id: plan.id, status: "archived" }))}
        >
          <Archive className="size-3.5" />
          {confirming === "archive" ? "متأكد؟ تنتقل إلى الأرشيف" : "أرشفة"}
        </BodyBtn>
        <BodyBtn
          className={cn("ms-auto", confirming === "delete" && "border-destructive text-destructive")}
          onClick={() => armed("delete", () => deletePlan(plan.id))}
        >
          <Trash2 className="size-3.5" />
          {confirming === "delete" ? "متأكد؟ حذف نهائي" : "حذف"}
        </BodyBtn>
      </div>
    </div>
  );
}

function BodyBtn({ className, ...props }: React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      className={cn(
        "flex items-center gap-1.5 rounded-lg border bg-background px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground",
        className,
      )}
      {...props}
    />
  );
}
