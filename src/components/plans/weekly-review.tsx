"use client";

import { useState, useTransition } from "react";
import { ArrowLeft, CheckCircle2, ListTodo, Sparkles, X } from "lucide-react";
import {
  createPlan,
  deleteIdea,
  ideaToTask,
  updatePlan,
} from "@/app/(app)/plans/actions";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { todayISO } from "@/lib/dates";
import { addMonthsISO } from "@/lib/finance";
import { cn } from "@/lib/utils";
import type { Idea } from "@/db/schema";
import type { PlanWithDetail } from "@/lib/queries/plans";
import type { TimelineWindow } from "@/lib/timeline";

/**
 * The 5-minute ritual: empty the inbox → give every project a next step →
 * face last week's routines. The button glows when something needs you.
 */
export function WeeklyReview({
  ideas,
  plans,
  win,
}: {
  ideas: Idea[];
  plans: PlanWithDetail[];
  win: TimelineWindow;
}) {
  const [open, setOpen] = useState(false);
  const stalled = plans.filter((p) => p.stalled);
  const routines = plans.filter((p) => p.kind === "routine");
  const needsAttention = ideas.length > 0 || stalled.length > 0;

  return (
    <>
      <Button variant="outline" size="sm" className="gap-2" onClick={() => setOpen(true)}>
        {needsAttention ? <span className="size-1.5 rounded-full bg-destructive" /> : null}
        راجع أسبوعك
      </Button>

      {open ? (
        <Sheet open onOpenChange={(o) => !o && setOpen(false)}>
          <SheetContent title="مراجعة الأسبوع — ٥ دقائق">
            <div className="space-y-8">
              {/* 1: inbox */}
              <section className="space-y-2.5">
                <StepHeading n="١" done={ideas.length === 0}>
                  صفّر صندوق الأفكار
                </StepHeading>
                {ideas.length === 0 ? (
                  <Done>فاضي — ممتاز.</Done>
                ) : (
                  ideas.map((i) => <ReviewIdea key={i.id} idea={i} />)
                )}
              </section>

              {/* 2: stalled plans */}
              <section className="space-y-2.5">
                <StepHeading n="٢" done={stalled.length === 0}>
                  خطوة تالية لكل خطة
                </StepHeading>
                {stalled.length === 0 ? (
                  <Done>كل خططك النشطة لها خطوة تالية.</Done>
                ) : (
                  stalled.map((p) => <StalledPlan key={p.id} plan={p} />)
                )}
              </section>

              {/* 3: routines last week */}
              <section className="space-y-2.5">
                <StepHeading n="٣" done>
                  روتينك الأسبوع الماضي
                </StepHeading>
                {routines.length === 0 ? (
                  <p className="text-sm text-muted-foreground">لا روتينات نشطة.</p>
                ) : (
                  routines.map((p) => {
                    const lastWeek = win.todayWeek - 1;
                    const count = p.weekFills[lastWeek] ?? 0;
                    const hit = count >= p.cadence;
                    return (
                      <div key={p.id} className="flex items-center gap-3 rounded-lg border px-4 py-2.5 text-sm">
                        <span className="flex-1">{p.title}</span>
                        <span
                          className={cn("text-xs font-medium", hit ? "text-foreground" : "text-destructive")}
                          data-numeric
                        >
                          {count}/{p.cadence}
                          {hit ? " ✓" : " — عوّضها هذا الأسبوع"}
                        </span>
                      </div>
                    );
                  })
                )}
              </section>

              <Button className="w-full gap-2" onClick={() => setOpen(false)}>
                <Sparkles className="size-4" />
                تمت المراجعة — أسبوع موفق
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      ) : null}
    </>
  );
}

function StepHeading({
  n,
  done,
  children,
}: {
  n: string;
  done: boolean;
  children: React.ReactNode;
}) {
  return (
    <h3 className="flex items-center gap-2 text-sm font-bold">
      <span className="text-muted-foreground" data-numeric>
        {n}
      </span>
      {children}
      {done ? <CheckCircle2 className="size-4 text-muted-foreground" /> : null}
    </h3>
  );
}

function Done({ children }: { children: React.ReactNode }) {
  return <p className="rounded-lg bg-secondary px-4 py-2.5 text-sm text-muted-foreground">{children}</p>;
}

function ReviewIdea({ idea }: { idea: Idea }) {
  const [, startTransition] = useTransition();
  const today = todayISO();
  return (
    <div className="flex items-center gap-2 rounded-lg border px-4 py-2.5">
      <span className="min-w-0 flex-1 truncate text-sm">{idea.text}</span>
      <button
        type="button"
        onClick={() =>
          startTransition(async () => {
            await createPlan({
              title: idea.text,
              kind: "project",
              startDate: today,
              endDate: addMonthsISO(today, 2),
              color: "violet",
              fromIdeaId: idea.id,
            });
          })
        }
        className="flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium hover:bg-accent"
      >
        <ArrowLeft className="size-3" />
        خطة
      </button>
      <button
        type="button"
        onClick={() => startTransition(() => ideaToTask(idea.id))}
        className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <ListTodo className="size-3" />
        مهمة
      </button>
      <button
        type="button"
        aria-label="حذف"
        onClick={() => startTransition(() => deleteIdea(idea.id))}
        className="rounded-full p-1 text-muted-foreground hover:text-destructive"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}

function StalledPlan({ plan }: { plan: PlanWithDetail }) {
  const [, startTransition] = useTransition();
  return (
    <div className="flex items-center gap-3 rounded-lg border border-destructive/30 px-4 py-2.5">
      <span className="min-w-0 flex-1 truncate text-sm">{plan.title}</span>
      <input
        placeholder="الخطوة التالية…"
        onKeyDown={(e) => {
          const v = e.currentTarget.value.trim();
          if (e.key === "Enter" && v) {
            startTransition(() => updatePlan({ id: plan.id, nextStep: v }));
          }
        }}
        className="h-7 w-44 border-b bg-transparent text-xs outline-none placeholder:text-muted-foreground"
      />
    </div>
  );
}
