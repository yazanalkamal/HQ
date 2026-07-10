"use client";

import { useState, useTransition } from "react";
import { ArrowLeft, ListTodo, Plus, X } from "lucide-react";
import { createIdea, deleteIdea, ideaToTask, toggleRoutineCheck } from "@/app/(app)/plans/actions";
import { NextStepControl } from "./next-step-control";
import { PlanSheet, type SheetRequest } from "./plan-sheet";
import { TaskCheck } from "@/components/ui/task-check";
import { dueLabel, todayISO } from "@/lib/dates";
import {
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
          <Canvas plans={plans} win={win} onOpen={(p) => setSheet({ mode: "edit", planId: p.id })} />
        )}
      </div>

      {resolvedSheet ? <PlanSheet state={resolvedSheet} onClose={() => setSheet(null)} /> : null}
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
  onOpen,
}: {
  plans: PlanWithDetail[];
  win: TimelineWindow;
  onOpen: (p: PlanWithDetail) => void;
}) {
  const months = monthSpans(win.weekStarts);
  const today = todayISO();

  return (
    <div className="overflow-x-auto">
      <div
        className="relative grid min-w-[860px]"
        style={{ gridTemplateColumns: `215px repeat(${WEEKS}, minmax(48px, 1fr))` }}
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
            className="pt-4 text-xs font-bold text-muted-foreground"
            style={{ gridColumn: `${m.from + 2} / span ${m.span}`, gridRow: 2 }}
          >
            {m.label}
          </span>
        ))}

        {/* week numbers */}
        {win.weekStarts.map((w, i) => (
          <span
            key={w}
            className="border-b pb-2 pt-1 text-[10.5px] text-muted-foreground"
            style={{ gridColumn: i + 2, gridRow: 3 }}
            data-numeric
          >
            {weekDayLabel(w)}
          </span>
        ))}

        {/* plan rows */}
        {plans.map((p, rowIdx) => {
          const span = barSpan(p.startDate, p.endDate, win);
          const row = rowIdx + 4;
          return (
            <div key={p.id} className="contents">
              {/* label */}
              <div
                className="border-b py-4 pe-4"
                style={{ gridColumn: 1, gridRow: row }}
              >
                <button
                  type="button"
                  onClick={() => onOpen(p)}
                  className="text-start text-sm font-bold hover:underline"
                >
                  {p.title}
                </button>
                {p.kind === "project" ? (
                  <NextStepControl plan={p} />
                ) : (
                  <RoutineToday plan={p} />
                )}
              </div>

              {/* bar area */}
              <div
                className="relative border-b"
                style={{ gridColumn: `2 / ${WEEKS + 2}`, gridRow: row }}
              >
                {span ? (
                  p.kind === "project" ? (
                    <ProjectBar plan={p} span={span} today={today} onOpen={() => onOpen(p)} />
                  ) : (
                    <RoutineRibbon plan={p} span={span} win={win} onOpen={() => onOpen(p)} />
                  )
                ) : (
                  <p className="flex h-full items-center px-2 text-xs text-muted-foreground">
                    خارج نافذة الأسابيع الحالية ({dueLabel(p.startDate, today)})
                  </p>
                )}
              </div>
            </div>
          );
        })}
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
        className="relative h-[30px] w-full cursor-pointer"
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
                "absolute top-1/2 size-[11px] -translate-y-1/2 rotate-45 rounded-[2px] border-2",
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
              "relative h-[30px] overflow-hidden rounded-md",
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
