"use client";

import { useState, useTransition } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  Loader2,
  ListTodo,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import {
  createIdea,
  createPlan,
  deleteIdea,
  deletePlan,
  ideaToTask,
  toggleRoutineCheck,
  updatePlan,
} from "@/app/(app)/plans/actions";
import { MilestonesEditor, PlanTasks } from "./plan-editors";
import { NextStepControl } from "./next-step-control";
import { PlanSheet, type SheetRequest } from "./plan-sheet";
import { TaskCheck } from "@/components/ui/task-check";
import { addDaysISO, dueLabel, todayISO } from "@/lib/dates";
import { addMonthsISO } from "@/lib/finance";
import {
  PLAN_COLORS,
  WEEKS,
  barSpan,
  milestonePct,
  monthSpans,
  planHex,
  weekDayLabel,
  type TimelineWindow,
} from "@/lib/timeline";
import { cn } from "@/lib/utils";
import type { Idea } from "@/db/schema";
import type { PlanWithDetail } from "@/lib/queries/plans";

export function PlansView({
  ideas,
  plans,
  win,
}: {
  ideas: Idea[];
  plans: PlanWithDetail[];
  win: TimelineWindow;
}) {
  const [sheet, setSheet] = useState<SheetRequest>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // resolve the edited plan from the LATEST server data so the sheet
  // reflects milestone/field changes immediately
  const resolvedSheet =
    sheet?.mode === "edit"
      ? (() => {
          const plan = plans.find((p) => p.id === sheet.planId);
          return plan ? ({ mode: "edit" as const, plan }) : null;
        })()
      : sheet;

  return (
    <div className="space-y-7">
      <CaptureStrip ideas={ideas} onPlanFromIdea={(i) => setSheet({ mode: "create", fromIdea: i })} />

      <div className="rounded-xl border p-5 pt-6">
        <div className="mb-5 flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            12 أسبوعًا — الأسابيع أعمدة، وخططك أشرطة عليها.
          </p>
          <button
            type="button"
            onClick={() => setSheet({ mode: "create" })}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            <Plus className="size-3.5" />
            خطة جديدة
          </button>
        </div>

        {plans.length === 0 ? (
          <EmptyCanvas onCreate={() => setSheet({ mode: "create" })} />
        ) : (
          <Canvas
            plans={plans}
            win={win}
            expandedId={expandedId}
            onToggle={(p) => setExpandedId(expandedId === p.id ? null : p.id)}
            onFullEdit={(p) => setSheet({ mode: "edit", planId: p.id })}
          />
        )}

        {/* quick-create — under the list, zero-form */}
        <QuickAddPlan
          usedColors={plans.map((p) => p.color)}
          onCreated={(id) => setExpandedId(id)}
        />
      </div>

      {resolvedSheet ? (
        <PlanSheet
          key={resolvedSheet.mode === "edit" ? resolvedSheet.plan.id : "create"}
          state={resolvedSheet}
          onClose={() => setSheet(null)}
          onCreateSub={(parent) => setSheet({ mode: "create", parent })}
          onOpenPlan={(planId) => setSheet({ mode: "edit", planId })}
        />
      ) : null}
    </div>
  );
}

// ── capture ──────────────────────────────────────────────────────────────────

function CaptureStrip({
  ideas,
  onPlanFromIdea,
}: {
  ideas: Idea[];
  onPlanFromIdea: (idea: Idea) => void;
}) {
  const [, startTransition] = useTransition();
  const [text, setText] = useState("");

  function submit() {
    const t = text.trim();
    if (!t) return;
    startTransition(async () => {
      await createIdea(t);
      setText("");
    });
  }

  return (
    <div className="rounded-xl border transition-shadow focus-within:shadow-sm">
      <div className="flex items-center gap-3 px-4">
        <Plus className="size-4 shrink-0 text-muted-foreground" />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.nativeEvent.isComposing && submit()}
          placeholder="ارمِ أي فكرة… ثم Enter (ومن أي مكان: Ctrl+K)"
          className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>

      {ideas.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 border-t bg-secondary/60 px-3.5 py-2.5">
          {ideas.map((idea) => (
            <IdeaChip key={idea.id} idea={idea} onPlan={() => onPlanFromIdea(idea)} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function IdeaChip({ idea, onPlan }: { idea: Idea; onPlan: () => void }) {
  const [, startTransition] = useTransition();
  return (
    <span className="inline-flex items-center gap-2 rounded-full border bg-background py-1 ps-3 pe-1 text-xs">
      {idea.text}
      <span className="inline-flex items-center gap-0.5">
        <button
          type="button"
          onClick={onPlan}
          className="flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 font-medium transition-colors hover:bg-accent"
        >
          <ArrowLeft className="size-3" />
          خطة
        </button>
        <button
          type="button"
          onClick={() => startTransition(() => ideaToTask(idea.id))}
          className="flex items-center gap-1 rounded-full px-2 py-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <ListTodo className="size-3" />
          مهمة
        </button>
        <button
          type="button"
          aria-label="حذف الفكرة"
          onClick={() => startTransition(() => deleteIdea(idea.id))}
          className="rounded-full p-1 text-muted-foreground transition-colors hover:text-destructive"
        >
          <X className="size-3" />
        </button>
      </span>
    </span>
  );
}

// ── canvas ───────────────────────────────────────────────────────────────────

function Canvas({
  plans,
  win,
  expandedId,
  onToggle,
  onFullEdit,
}: {
  plans: PlanWithDetail[];
  win: TimelineWindow;
  expandedId: string | null;
  onToggle: (p: PlanWithDetail) => void;
  onFullEdit: (p: PlanWithDetail) => void;
}) {
  const months = monthSpans(win.weekStarts);
  const today = todayISO();

  // dynamic row numbers: each plan takes one row, +1 when expanded
  const rowStarts = plans.reduce<number[]>((acc, _p, i) => {
    if (i === 0) return [4];
    acc.push(acc[i - 1] + (expandedId === plans[i - 1].id ? 2 : 1));
    return acc;
  }, []);

  return (
    <div className="overflow-x-auto">
      <div
        className="relative grid min-w-[1040px]"
        style={{ gridTemplateColumns: `250px repeat(${WEEKS}, minmax(58px, 1fr))` }}
      >
        {/* current-week highlight */}
        <div
          className="relative rounded-md bg-foreground/[0.045]"
          style={{ gridColumn: win.todayWeek + 2, gridRow: "1 / -1" }}
        >
          <span className="absolute -top-1 right-1/2 z-10 translate-x-1/2 whitespace-nowrap rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-bold text-primary-foreground">
            أنت هنا
          </span>
        </div>

        {/* month headers */}
        {months.map((m) => (
          <span
            key={m.label + m.from}
            className="pt-4 text-sm font-bold text-muted-foreground"
            style={{ gridColumn: `${m.from + 2} / span ${m.span}`, gridRow: 2 }}
          >
            {m.label}
          </span>
        ))}

        {/* week numbers */}
        {win.weekStarts.map((w, i) => (
          <span
            key={w}
            className="border-b pb-2.5 pt-1.5 text-xs text-muted-foreground"
            style={{ gridColumn: i + 2, gridRow: 3 }}
            data-numeric
          >
            {weekDayLabel(w)}
          </span>
        ))}

        {/* plan rows */}
        {plans.map((p, i) => {
          const span = barSpan(p.startDate, p.endDate, win);
          const expanded = expandedId === p.id;
          const row = rowStarts[i];
          return (
            <div key={p.id} className="contents">
              {/* label */}
              <div
                className={cn(
                  "py-4 pe-4",
                  p.depth === 1 && "ps-6 py-3",
                  !expanded && "border-b",
                )}
                style={{ gridColumn: 1, gridRow: row }}
              >
                <button
                  type="button"
                  onClick={() => onToggle(p)}
                  className={cn(
                    "flex items-center gap-1.5 text-start",
                    p.depth === 1 ? "text-sm font-medium text-muted-foreground" : "text-[15px] font-bold",
                  )}
                >
                  <ChevronDown
                    className={cn(
                      "size-3.5 shrink-0 text-muted-foreground transition-transform",
                      expanded && "rotate-180",
                    )}
                  />
                  {p.depth === 1 ? <span className="text-muted-foreground">↳</span> : null}
                  <span className="hover:underline">{p.title}</span>
                </button>
                {p.kind === "project" ? (
                  <NextStepControl plan={p} />
                ) : (
                  <RoutineToday plan={p} />
                )}
              </div>

              {/* bar area */}
              <div
                className={cn("relative", !expanded && "border-b")}
                style={{ gridColumn: `2 / ${WEEKS + 2}`, gridRow: row }}
              >
                {span ? (
                  p.kind === "project" ? (
                    <ProjectBar plan={p} span={span} today={today} onOpen={() => onToggle(p)} />
                  ) : (
                    <RoutineRibbon plan={p} span={span} win={win} onOpen={() => onToggle(p)} />
                  )
                ) : (
                  <p className="flex h-full items-center px-2 text-xs text-muted-foreground">
                    خارج نافذة الأسابيع الحالية ({dueLabel(p.startDate, today)})
                  </p>
                )}
              </div>

              {/* inline expansion — sticky-pinned to the start edge so it
                  stays fully visible inside the horizontally-scrolling canvas */}
              {expanded ? (
                <div
                  className="border-b pb-5"
                  style={{ gridColumn: "1 / -1", gridRow: row + 1 }}
                >
                  <div className="sticky start-0 max-w-4xl">
                    <PlanExpansion plan={p} win={win} onFullEdit={() => onFullEdit(p)} />
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** In-place plan management — the sheet is now only for full edits. */
function PlanExpansion({
  plan,
  win,
  onFullEdit,
}: {
  plan: PlanWithDetail;
  win: TimelineWindow;
  onFullEdit: () => void;
}) {
  const [, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const thisWeek = plan.weekFills[win.todayWeek] ?? 0;

  return (
    <div className="rounded-xl bg-secondary/50 px-5 py-4">
      <div className="grid gap-6 md:grid-cols-2">
        {plan.kind === "project" ? (
          <MilestonesEditor plan={plan} planStart={plan.startDate} planEnd={plan.endDate} />
        ) : (
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-muted-foreground">هذا الأسبوع</h3>
            <p className="text-sm" data-numeric>
              {thisWeek}/{plan.cadence} —{" "}
              {thisWeek >= plan.cadence ? "أتممت هدف الأسبوع ✓" : `تبقّى ${plan.cadence - thisWeek}`}
            </p>
            {plan.description ? (
              <p className="text-sm text-muted-foreground">{plan.description}</p>
            ) : null}
          </div>
        )}
        <PlanTasks plan={plan} />
      </div>

      <div className="mt-4 flex items-center gap-2 border-t pt-3.5">
        <ExpansionBtn onClick={onFullEdit}>
          <Pencil className="size-3.5" />
          تحرير كامل
        </ExpansionBtn>
        <ExpansionBtn
          onClick={() => startTransition(() => updatePlan({ id: plan.id, status: "done" }))}
        >
          <CheckCircle2 className="size-3.5" />
          أنجزتها 🎉
        </ExpansionBtn>
        <ExpansionBtn
          className={cn("ms-auto", confirmDelete && "border-destructive text-destructive")}
          onClick={() => {
            if (!confirmDelete) {
              setConfirmDelete(true);
              setTimeout(() => setConfirmDelete(false), 3000);
              return;
            }
            startTransition(() => deletePlan(plan.id));
          }}
        >
          <Trash2 className="size-3.5" />
          {confirmDelete ? "متأكد؟" : "حذف"}
        </ExpansionBtn>
      </div>
    </div>
  );
}

function ExpansionBtn({ className, ...props }: React.ComponentProps<"button">) {
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

/** Zero-form plan creation: title + kind + duration, sensible defaults. */
function QuickAddPlan({
  usedColors,
  onCreated,
}: {
  usedColors: string[];
  onCreated: (id: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<"project" | "routine">("project");
  const [months, setMonths] = useState(2);
  const [pending, startTransition] = useTransition();

  function pickColor(): string {
    const keys = Object.keys(PLAN_COLORS);
    const counts = keys.map((k) => usedColors.filter((c) => c === k).length);
    return keys[counts.indexOf(Math.min(...counts))];
  }

  function submit() {
    const t = title.trim();
    if (!t || pending) return;
    const today = todayISO();
    startTransition(async () => {
      const id = await createPlan({
        title: t,
        kind,
        startDate: today,
        endDate: kind === "routine" && months < 1 ? addDaysISO(today, 30) : addMonthsISO(today, months),
        color: pickColor(),
      });
      setTitle("");
      onCreated(id);
    });
  }

  return (
    <div className="rounded-xl border border-dashed transition-colors focus-within:border-solid focus-within:border-foreground/30">
      <div className="flex items-center gap-3 px-4">
        {pending ? (
          <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
        ) : (
          <Plus className="size-4 shrink-0 text-muted-foreground" />
        )}
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing) submit();
          }}
          placeholder="أضف خطة… ثم Enter — تبدأ اليوم وتتفصّل لاحقًا"
          className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>
      <div
        className={cn(
          "flex-wrap items-center gap-1.5 border-t px-3 py-2",
          title ? "flex" : "hidden",
        )}
      >
        {(
          [
            ["project", "مشروع"],
            ["routine", "روتين"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            className={cn(
              "rounded-full border px-2.5 py-1 text-xs transition-colors",
              kind === k
                ? "border-foreground/30 bg-secondary text-foreground"
                : "border-transparent text-muted-foreground hover:bg-accent",
            )}
          >
            {label}
          </button>
        ))}
        <span className="mx-1 h-4 w-px bg-border" />
        {[1, 2, 3, 6].map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMonths(m)}
            className={cn(
              "rounded-full border px-2.5 py-1 text-xs transition-colors",
              months === m
                ? "border-foreground/30 bg-secondary text-foreground"
                : "border-transparent text-muted-foreground hover:bg-accent",
            )}
            data-numeric
          >
            {m === 1 ? "شهر" : m === 2 ? "شهران" : `${m} أشهر`}
          </button>
        ))}
      </div>
    </div>
  );
}

function ProjectBar({
  plan,
  span,
  today,
  onOpen,
}: {
  plan: PlanWithDetail;
  span: NonNullable<ReturnType<typeof barSpan>>;
  today: string;
  onOpen: () => void;
}) {
  const hex = planHex(plan.color);
  const widthPct = ((span.to - span.from + 1) / WEEKS) * 100;
  const startPct = (span.from / WEEKS) * 100;

  return (
    <div className="absolute inset-y-0 flex items-center" style={{ insetInlineStart: `${startPct}%`, width: `${widthPct}%` }}>
      <button
        type="button"
        onClick={onOpen}
        className={cn("relative w-full cursor-pointer", plan.depth === 1 ? "h-[22px]" : "h-10")}
        style={{ ["--c" as string]: hex }}
        title={plan.title}
      >
        <span
          className={cn(
            "absolute inset-0 bg-[var(--c)] opacity-[0.13]",
            span.clippedStart ? "rounded-e-lg" : "rounded-lg",
            span.clippedEnd && "rounded-s-none rounded-e-lg",
          )}
        />
        <span
          className="absolute inset-y-0 start-0 rounded-lg bg-[var(--c)] opacity-30"
          style={{ width: `${Math.round(plan.progress * 100)}%` }}
        />
        {plan.milestones.map((m) => {
          const late = !m.done && m.dueDate < today;
          return (
            <span
              key={m.id}
              title={`${m.title} — ${dueLabel(m.dueDate, today)}${late ? " (متأخر!)" : m.done ? " ✓" : ""}`}
              className={cn(
                "absolute top-1/2 -translate-y-1/2 rotate-45 rounded-[2px] border-2",
                plan.depth === 1 ? "size-[9px]" : "size-[13px]",
                late
                  ? "border-destructive bg-destructive"
                  : m.done
                    ? "border-[var(--c)] bg-[var(--c)]"
                    : "border-[var(--c)] bg-background",
              )}
              style={{ insetInlineStart: `${milestonePct(m.dueDate, plan.startDate, plan.endDate)}%` }}
            />
          );
        })}
      </button>
    </div>
  );
}

function RoutineRibbon({
  plan,
  span,
  win,
  onOpen,
}: {
  plan: PlanWithDetail;
  span: NonNullable<ReturnType<typeof barSpan>>;
  win: TimelineWindow;
  onOpen: () => void;
}) {
  const hex = planHex(plan.color);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="absolute inset-y-0 grid w-full cursor-pointer items-center gap-[3px]"
      style={{ gridTemplateColumns: `repeat(${WEEKS}, 1fr)`, ["--c" as string]: hex }}
      title={plan.title}
    >
      {win.weekStarts.map((w, i) => {
        const inRange = i >= span.from && i <= span.to;
        if (!inRange) return <span key={w} />;
        const fill = plan.weekFills[i] ?? 0;
        const ratio = Math.min(1, fill / plan.cadence);
        const isPast = i < win.todayWeek;
        const missed = isPast && fill === 0;
        const isFuture = i > win.todayWeek;
        return (
          <span
            key={w}
            title={
              isFuture
                ? "قادم"
                : `${fill}/${plan.cadence} هذا الأسبوع${missed ? " — انقطاع!" : ""}`
            }
            className={cn(
              "relative h-10 overflow-hidden rounded-md",
              isFuture ? "bg-secondary/50 [background-image:repeating-linear-gradient(-45deg,transparent_0_5px,white_5px_10px)]" : "bg-secondary",
              missed && "outline-dashed outline-[1.5px] -outline-offset-[1.5px] outline-destructive/50",
            )}
          >
            {ratio > 0 ? (
              <span
                className="absolute inset-x-0 bottom-0 block bg-[var(--c)]"
                style={{ height: `${Math.round(ratio * 100)}%`, opacity: 0.35 + ratio * 0.4 }}
              />
            ) : null}
          </span>
        );
      })}
    </button>
  );
}

function RoutineToday({ plan }: { plan: PlanWithDetail }) {
  const [, startTransition] = useTransition();
  return (
    <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
      <TaskCheck
        done={plan.checkedToday}
        onToggle={() => startTransition(() => toggleRoutineCheck(plan.id))}
        className="size-4"
      />
      <span data-numeric>
        اليوم؟ · هدفك {plan.cadence}× أسبوعيًا
      </span>
    </div>
  );
}

function EmptyCanvas({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-16 text-center">
      <p className="text-sm text-muted-foreground">
        خارطتك فاضية — ارسم أول خطة على الزمن: مشروع بمعالم، أو روتين أسبوعي.
      </p>
      <button
        type="button"
        onClick={onCreate}
        className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
      >
        <Plus className="size-4" />
        خطة جديدة
      </button>
    </div>
  );
}
