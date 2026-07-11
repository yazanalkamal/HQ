"use client";

import { useState, useTransition } from "react";
import { ArchiveRestore, ArrowLeft, ChevronDown, ListTodo, Pencil, Plus, Trash2, X } from "lucide-react";
import {
  createIdea,
  deleteIdea,
  deletePlan,
  ideaToTask,
  toggleRoutineCheck,
  updatePlan,
} from "@/app/(app)/plans/actions";
import { PlanCard, planAttention } from "./plan-card";
import { PlanComposer, type ComposerIdea } from "./plan-composer";
import { PlanMap } from "./plan-map";
import { PlanSheet, type SheetRequest } from "./plan-sheet";
import { addDaysISO, dueLabel, todayISO } from "@/lib/dates";
import { planHex, type TimelineWindow } from "@/lib/timeline";
import { cn } from "@/lib/utils";
import type { Idea } from "@/db/schema";
import type { InactivePlan, PlanWithDetail } from "@/lib/queries/plans";

/**
 * قمرة القيادة — cards lead with each plan's next step; the routines get
 * their own weekly-dots section; «الخارطة» is the read-only zoom-out.
 */
export function PlansView({
  ideas,
  plans,
  inactive,
  win,
  view,
}: {
  ideas: Idea[];
  plans: PlanWithDetail[];
  inactive: InactivePlan[];
  win: TimelineWindow;
  view: "cards" | "map";
}) {
  const [sheet, setSheet] = useState<SheetRequest>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const today = todayISO();

  // resolve the edited plan from the LATEST server data so the sheet
  // reflects milestone/field changes immediately
  const resolvedSheet =
    sheet?.mode === "edit"
      ? (() => {
          const plan = plans.find((p) => p.id === sheet.planId);
          return plan ? ({ mode: "edit" as const, plan }) : null;
        })()
      : sheet;

  const activeIds = new Set(plans.map((p) => p.id));
  const projects = plans.filter(
    (p) => p.kind === "project" && (!p.parentId || !activeIds.has(p.parentId)),
  );
  const routines = plans.filter((p) => p.kind === "routine");
  // attention-first: plans that need you float to the top (stable within ties)
  const cards = [...projects].sort((a, b) => planAttention(b, today) - planAttention(a, today));

  return (
    <div className="space-y-7">
      <CaptureStrip ideas={ideas} />

      {view === "map" ? (
        <PlanMap plans={plans.filter((p) => p.kind === "project")} win={win} />
      ) : (
        <>
          {projects.length > 0 ? (
            <HealthStrip projects={projects} today={today} />
          ) : null}

          {projects.length === 0 ? (
            <EmptyCockpit />
          ) : (
            <div className="space-y-3.5">
              {cards.map((p) => (
                <PlanCard
                  key={p.id}
                  plan={p}
                  expanded={expandedId === p.id}
                  onToggle={() => setExpandedId(expandedId === p.id ? null : p.id)}
                  onFullEdit={() => setSheet({ mode: "edit", planId: p.id })}
                  onOpenPlan={(planId) => setSheet({ mode: "edit", planId })}
                  onCreateSub={(parent) => setSheet({ mode: "create", parent })}
                />
              ))}
              <p className="px-1 text-[11.5px] text-muted-foreground">
                الخط العمودي على شريط التقدم = أين يقف الزمن. تقدّمٌ خلف الخط يعني أنك متأخر عن الجدول.
              </p>
            </div>
          )}

          {routines.length > 0 ? (
            <RoutinesSection
              routines={routines}
              win={win}
              today={today}
              onEdit={(planId) => setSheet({ mode: "edit", planId })}
            />
          ) : null}

          {inactive.length > 0 ? <InactiveDrawer plans={inactive} /> : null}
        </>
      )}

      <PlanComposer usedColors={plans.map((p) => p.color)} onCreated={(id) => setExpandedId(id)} />

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

// ── health ───────────────────────────────────────────────────────────────────

function HealthStrip({ projects, today }: { projects: PlanWithDetail[]; today: string }) {
  const moving = projects.filter((p) => planAttention(p, today) === 0).length;
  const stalled = projects.filter((p) => p.stalled).length;
  const lateMs = projects.flatMap((p) => p.milestones).filter((m) => !m.done && m.dueDate < today);
  const upcoming = projects
    .flatMap((p) => p.milestones)
    .filter((m) => !m.done && m.dueDate >= today)
    .sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1))[0];

  const parts: React.ReactNode[] = [];
  if (moving > 0) {
    parts.push(
      <b key="m">{moving === 1 ? "مشروع واحد يتحرك" : moving === 2 ? "مشروعان يتحركان" : `${moving} مشاريع تتحرك`}</b>,
    );
  }
  if (stalled > 0) {
    parts.push(
      <b key="s">{stalled === 1 ? "واحد متعثر" : stalled === 2 ? "اثنان متعثران" : `${stalled} متعثرة`}</b>,
    );
  }
  if (lateMs.length > 0) {
    parts.push(
      <b key="l" className="text-destructive">
        {lateMs.length === 1 ? "معلم متأخر" : `${lateMs.length} معالم متأخرة`}
      </b>,
    );
  }
  if (upcoming) {
    parts.push(<span key="u">أقرب معلم: {dueLabel(upcoming.dueDate, today)}</span>);
  }
  if (parts.length === 0) return null;

  return (
    <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1 px-1 text-xs text-muted-foreground" data-numeric>
      {parts.map((part, i) => (
        <span key={i} className="flex items-center gap-2.5">
          {i > 0 ? <span className="text-border">·</span> : null}
          {part}
        </span>
      ))}
    </p>
  );
}

// ── capture ──────────────────────────────────────────────────────────────────

function CaptureStrip({ ideas }: { ideas: Idea[] }) {
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
            <IdeaChip key={idea.id} idea={idea} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function IdeaChip({ idea }: { idea: Idea }) {
  const [, startTransition] = useTransition();
  return (
    <span className="inline-flex items-center gap-2 rounded-full border bg-background py-1 ps-3 pe-1 text-xs">
      {idea.text}
      <span className="inline-flex items-center gap-0.5">
        <button
          type="button"
          onClick={() =>
            window.dispatchEvent(
              new CustomEvent<{ idea: ComposerIdea }>("hq:plan-composer", {
                detail: { idea: { id: idea.id, text: idea.text } },
              }),
            )
          }
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

// ── routines ─────────────────────────────────────────────────────────────────

const dayLetterFmt = new Intl.DateTimeFormat("ar", { timeZone: "UTC", weekday: "narrow" });

function RoutinesSection({
  routines,
  win,
  today,
  onEdit,
}: {
  routines: PlanWithDetail[];
  win: TimelineWindow;
  today: string;
  onEdit: (planId: string) => void;
}) {
  const weekDays = Array.from({ length: 7 }, (_, i) =>
    addDaysISO(win.weekStarts[win.todayWeek], i),
  );

  return (
    <section>
      <h2 className="text-base font-bold">الروتينات</h2>
      <p className="mb-3.5 mt-0.5 text-xs text-muted-foreground">
        إيقاعك الأسبوعي — اضغط أي يوم مضى لتصحيحه.
      </p>
      <div className="rounded-2xl border">
        {routines.map((r, i) => (
          <RoutineRow key={r.id} plan={r} weekDays={weekDays} today={today} first={i === 0} onEdit={() => onEdit(r.id)} />
        ))}
      </div>
    </section>
  );
}

function RoutineRow({
  plan,
  weekDays,
  today,
  first,
  onEdit,
}: {
  plan: PlanWithDetail;
  weekDays: string[];
  today: string;
  first: boolean;
  onEdit: () => void;
}) {
  const [, startTransition] = useTransition();
  const hex = planHex(plan.color);
  const count = plan.checkDays.length;
  const met = count >= plan.cadence;

  return (
    <div className={cn("flex flex-wrap items-center gap-x-5 gap-y-3 px-5 py-3.5", !first && "border-t")}>
      <span className="flex min-w-40 items-center gap-2.5 text-[15px] font-bold">
        <span className="size-[11px] shrink-0 rotate-45 rounded-[2.5px]" style={{ background: hex }} />
        <span className="min-w-0 truncate">{plan.title}</span>
      </span>

      <span className="flex items-center gap-2">
        {weekDays.map((day) => {
          const hit = plan.checkDays.includes(day);
          const future = day > today;
          const isToday = day === today;
          return (
            <span key={day} className="flex flex-col items-center gap-0.5">
              <button
                type="button"
                disabled={future}
                aria-label={dueLabel(day, today)}
                title={dueLabel(day, today)}
                onClick={() => startTransition(() => toggleRoutineCheck(plan.id, day))}
                className={cn(
                  "size-[17px] rounded-full border-[1.5px] transition-colors",
                  hit ? "border-transparent" : "border-border",
                  isToday && !hit && "border-foreground",
                  future ? "border-dashed opacity-50" : "hover:border-foreground/60",
                )}
                style={hit ? { background: hex } : undefined}
              />
              <span className="text-[9.5px] text-muted-foreground">{dayLetterFmt.format(new Date(day + "T00:00:00Z"))}</span>
            </span>
          );
        })}
      </span>

      <span className="ms-auto text-xs text-muted-foreground" data-numeric>
        <b className="text-foreground">{count}</b> من {plan.cadence}
        {met ? " — أتممت هدف الأسبوع ✓" : " هذا الأسبوع"}
      </span>

      <button
        type="button"
        onClick={() => startTransition(() => toggleRoutineCheck(plan.id))}
        className={cn(
          "flex items-center gap-1.5 rounded-full border px-3.5 py-1 text-xs transition-colors",
          plan.checkedToday
            ? "bg-secondary text-muted-foreground"
            : "font-bold text-muted-foreground hover:border-foreground hover:text-foreground",
        )}
      >
        {plan.checkedToday ? "✓ تمت اليوم" : "اليوم؟"}
      </button>

      <button
        type="button"
        aria-label="تحرير الروتين"
        onClick={onEdit}
        className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <Pencil className="size-3.5" />
      </button>
    </div>
  );
}

// ── done & archived ──────────────────────────────────────────────────────────

const inactiveDateFmt = new Intl.DateTimeFormat("ar-u-nu-latn", {
  timeZone: "Asia/Riyadh",
  day: "numeric",
  month: "long",
});

/** Nothing vanishes: أنجزتها/أرشفة land here, one click away from استعادة. */
function InactiveDrawer({ plans }: { plans: InactivePlan[] }) {
  return (
    <details className="group/done rounded-xl border border-dashed">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3.5 text-sm text-muted-foreground transition-colors hover:text-foreground [&::-webkit-details-marker]:hidden">
        <ChevronDown className="size-4 transition-transform group-open/done:rotate-180" />
        المنجزة والمؤرشفة
        <b data-numeric>({plans.length})</b>
      </summary>
      <div className="space-y-1 px-4 pb-3">
        {plans.map((p) => (
          <InactiveRow key={p.id} plan={p} />
        ))}
      </div>
    </details>
  );
}

function InactiveRow({ plan }: { plan: InactivePlan }) {
  const [, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg px-1 py-1.5">
      <span
        className="size-2.5 shrink-0 rotate-45 rounded-[2px] opacity-60"
        style={{ background: planHex(plan.color) }}
      />
      <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">{plan.title}</span>
      <span className="rounded-full bg-secondary px-2 py-px text-[10.5px] text-muted-foreground">
        {plan.status === "done" ? "منجزة 🎉" : "مؤرشفة"}
      </span>
      <span className="text-xs text-muted-foreground" data-numeric>
        {inactiveDateFmt.format(new Date(plan.updatedAt))}
      </span>
      <button
        type="button"
        onClick={() => startTransition(() => updatePlan({ id: plan.id, status: "active" }))}
        className="flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
      >
        <ArchiveRestore className="size-3" />
        استعادة
      </button>
      <button
        type="button"
        aria-label="حذف نهائي"
        className={cn(
          "flex items-center gap-1 rounded-full border border-transparent p-1.5 text-xs text-muted-foreground transition-colors hover:text-destructive",
          confirmDelete && "border-destructive text-destructive",
        )}
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
        {confirmDelete ? "متأكد؟" : null}
      </button>
    </div>
  );
}

// ── empty ────────────────────────────────────────────────────────────────────

function EmptyCockpit() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed px-6 py-16 text-center">
      <p className="text-sm text-muted-foreground">
        قمرتك فاضية — أنشئ أول مشروع بمعالم، أو روتينًا أسبوعيًا.
      </p>
      <button
        type="button"
        onClick={() => window.dispatchEvent(new CustomEvent("hq:plan-composer"))}
        className="flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-[13px] font-bold text-primary-foreground transition-opacity hover:opacity-90"
      >
        <Plus className="size-4" strokeWidth={2.4} />
        خطة جديدة
        <kbd className="rounded bg-primary-foreground/20 px-1.5 text-[10px]" dir="ltr">
          P
        </kbd>
      </button>
    </div>
  );
}
