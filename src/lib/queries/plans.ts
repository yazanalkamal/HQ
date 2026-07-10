import "server-only";
import { and, asc, desc, eq, gte } from "drizzle-orm";
import { db } from "@/db";
import {
  ideas,
  milestones,
  plans,
  routineChecks,
  type Idea,
  type Milestone,
  type Plan,
} from "@/db/schema";
import { todayISO } from "@/lib/dates";
import { timelineWindow, weekIndex, type TimelineWindow } from "@/lib/timeline";

export type PlanWithDetail = Plan & {
  milestones: Milestone[];
  /** routine plans: week column index → checks done that week */
  weekFills: Record<number, number>;
  checkedToday: boolean;
  progress: number; // 0..1 — projects: done milestones ratio
  stalled: boolean;
};

export async function listIdeas(): Promise<Idea[]> {
  return db.select().from(ideas).orderBy(asc(ideas.createdAt));
}

export async function listActivePlans(
  win: TimelineWindow = timelineWindow(),
): Promise<PlanWithDetail[]> {
  const today = todayISO();
  const [planRows, msRows, checkRows] = await Promise.all([
    db
      .select()
      .from(plans)
      .where(eq(plans.status, "active"))
      .orderBy(asc(plans.startDate), asc(plans.createdAt)),
    db.select().from(milestones).orderBy(asc(milestones.dueDate)),
    db
      .select()
      .from(routineChecks)
      .where(gte(routineChecks.day, win.start)),
  ]);

  return planRows.map((p) => {
    const ms = msRows.filter((m) => m.planId === p.id);
    const checks = checkRows.filter((c) => c.planId === p.id);
    const weekFills: Record<number, number> = {};
    for (const c of checks) {
      const w = weekIndex(c.day, win.start);
      if (w >= 0) weekFills[w] = (weekFills[w] ?? 0) + 1;
    }
    const doneMs = ms.filter((m) => m.done).length;
    return {
      ...p,
      milestones: ms,
      weekFills,
      checkedToday: checks.some((c) => c.day === today),
      progress: p.kind === "project" && ms.length > 0 ? doneMs / ms.length : 0,
      stalled: p.kind === "project" && p.nextStep.trim() === "",
    };
  });
}

/** Active routines with today's check state — for اليوم. */
export async function routinesForToday() {
  const today = todayISO();
  const [planRows, checkRows] = await Promise.all([
    db
      .select()
      .from(plans)
      .where(and(eq(plans.status, "active"), eq(plans.kind, "routine")))
      .orderBy(asc(plans.createdAt)),
    db.select().from(routineChecks).where(eq(routineChecks.day, today)),
  ]);
  return planRows
    .filter((p) => p.startDate <= today && p.endDate >= today)
    .map((p) => ({
      id: p.id,
      title: p.title,
      color: p.color,
      cadence: p.cadence,
      checkedToday: checkRows.some((c) => c.planId === p.id),
    }));
}

/** Everything the weekly review needs in one call. */
export async function reviewCounts(): Promise<{ ideas: number; stalled: number }> {
  const [ideaRows, planRows] = await Promise.all([
    db.select({ id: ideas.id }).from(ideas),
    db
      .select({ id: plans.id, kind: plans.kind, nextStep: plans.nextStep })
      .from(plans)
      .where(eq(plans.status, "active")),
  ]);
  return {
    ideas: ideaRows.length,
    stalled: planRows.filter((p) => p.kind === "project" && p.nextStep.trim() === "").length,
  };
}

export async function donePlansCount(): Promise<number> {
  const rows = await db
    .select({ id: plans.id })
    .from(plans)
    .where(eq(plans.status, "done"))
    .orderBy(desc(plans.updatedAt));
  return rows.length;
}
