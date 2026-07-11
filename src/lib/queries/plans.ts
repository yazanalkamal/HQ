import "server-only";
import { and, asc, desc, eq, gte, isNotNull, ne } from "drizzle-orm";
import { db } from "@/db";
import {
  ideas,
  milestones,
  plans,
  planSteps,
  routineChecks,
  tasks,
  type Idea,
  type Milestone,
  type Plan,
  type PlanStep,
} from "@/db/schema";
import { todayISO } from "@/lib/dates";
import { timelineWindow, weekIndex, type TimelineWindow } from "@/lib/timeline";

export type PlanTask = { id: string; title: string; done: boolean; dueDate: string | null };

export type PlanWithDetail = Plan & {
  milestones: Milestone[];
  tasks: PlanTask[];
  children: { id: string; title: string }[];
  depth: 0 | 1;
  /** routine plans: week column index → checks done that week */
  weekFills: Record<number, number>;
  /** routine plans: ISO days checked in the CURRENT week (the 7 dots) */
  checkDays: string[];
  checkedToday: boolean;
  progress: number; // 0..1 — projects: done milestones + done tasks ratio
  stalled: boolean;
  /** سجل الدفعات — latest completed next steps, newest first */
  steps: PlanStep[];
};

export async function listIdeas(): Promise<Idea[]> {
  return db.select().from(ideas).orderBy(asc(ideas.createdAt));
}

export async function listActivePlans(
  win: TimelineWindow = timelineWindow(),
): Promise<PlanWithDetail[]> {
  const today = todayISO();
  const [planRows, msRows, checkRows, stepRows, taskRows] = await Promise.all([
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
    db.select().from(planSteps).orderBy(desc(planSteps.doneAt)),
    db
      .select({
        id: tasks.id,
        title: tasks.title,
        done: tasks.done,
        dueDate: tasks.dueDate,
        planId: tasks.planId,
      })
      .from(tasks)
      .where(isNotNull(tasks.planId))
      .orderBy(asc(tasks.done), asc(tasks.dueDate), asc(tasks.createdAt)),
  ]);

  const detail = (p: Plan): PlanWithDetail => {
    const ms = msRows.filter((m) => m.planId === p.id);
    const planTasks = taskRows.filter((t) => t.planId === p.id);
    const checks = checkRows.filter((c) => c.planId === p.id);
    const weekFills: Record<number, number> = {};
    for (const c of checks) {
      const w = weekIndex(c.day, win.start);
      if (w >= 0) weekFills[w] = (weekFills[w] ?? 0) + 1;
    }
    const checkDays = checks
      .filter((c) => weekIndex(c.day, win.start) === win.todayWeek)
      .map((c) => c.day);
    const doneCount = ms.filter((m) => m.done).length + planTasks.filter((t) => t.done).length;
    const totalCount = ms.length + planTasks.length;
    return {
      ...p,
      milestones: ms,
      tasks: planTasks.map((t) => ({
        id: t.id,
        title: t.title,
        done: t.done,
        dueDate: t.dueDate,
      })),
      children: planRows
        .filter((c) => c.parentId === p.id)
        .map((c) => ({ id: c.id, title: c.title })),
      depth: p.parentId ? 1 : 0,
      weekFills,
      checkDays,
      checkedToday: checks.some((c) => c.day === today),
      progress: p.kind === "project" && totalCount > 0 ? doneCount / totalCount : 0,
      stalled: p.kind === "project" && p.nextStep.trim() === "",
      steps: stepRows.filter((s) => s.planId === p.id).slice(0, 8),
    };
  };

  // roots in date order, each followed by its children
  const roots = planRows.filter((p) => !p.parentId);
  const ordered: Plan[] = [];
  for (const r of roots) {
    ordered.push(r);
    ordered.push(...planRows.filter((c) => c.parentId === r.id));
  }
  // orphaned children (parent archived/done) still render at root level
  for (const p of planRows) {
    if (p.parentId && !ordered.includes(p)) ordered.push(p);
  }
  return ordered.map(detail);
}

export type InactivePlan = Pick<Plan, "id" | "title" | "color" | "kind" | "status" | "updatedAt">;

/** Done + archived plans — the drawer under the cockpit; everything is recoverable. */
export async function listInactivePlans(): Promise<InactivePlan[]> {
  return db
    .select({
      id: plans.id,
      title: plans.title,
      color: plans.color,
      kind: plans.kind,
      status: plans.status,
      updatedAt: plans.updatedAt,
    })
    .from(plans)
    .where(ne(plans.status, "active"))
    .orderBy(desc(plans.updatedAt));
}

/** Lightweight active-project list for the task composer's plan picker. */
export async function plansForPicker(): Promise<{ id: string; title: string; color: string }[]> {
  return db
    .select({ id: plans.id, title: plans.title, color: plans.color })
    .from(plans)
    .where(and(eq(plans.status, "active"), eq(plans.kind, "project")))
    .orderBy(asc(plans.startDate), asc(plans.createdAt));
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

export type PlansPulse = {
  /** next step of the most attention-needing project that has one */
  nextStep: { planTitle: string; text: string } | null;
  lateMilestones: number;
  stalled: number;
  activeProjects: number;
};

/** The اليوم summary cell — same attention rule as the cockpit (late ≫ stalled). */
export async function plansPulse(): Promise<PlansPulse> {
  const today = todayISO();
  const [planRows, msRows] = await Promise.all([
    db
      .select({
        id: plans.id,
        title: plans.title,
        kind: plans.kind,
        nextStep: plans.nextStep,
        startDate: plans.startDate,
      })
      .from(plans)
      .where(eq(plans.status, "active"))
      .orderBy(asc(plans.startDate), asc(plans.createdAt)),
    db
      .select({ planId: milestones.planId, done: milestones.done, dueDate: milestones.dueDate })
      .from(milestones),
  ]);

  const projects = planRows.filter((p) => p.kind === "project");
  const lateByPlan = new Map<string, number>();
  for (const m of msRows) {
    if (!m.done && m.dueDate < today) {
      lateByPlan.set(m.planId, (lateByPlan.get(m.planId) ?? 0) + 1);
    }
  }
  const lateMilestones = projects.reduce((sum, p) => sum + (lateByPlan.get(p.id) ?? 0), 0);
  const stalled = projects.filter((p) => p.nextStep.trim() === "").length;

  // mirror planAttention() in plan-card.tsx: late milestones outweigh stalled
  const top = [...projects]
    .map((p) => ({
      p,
      score: ((lateByPlan.get(p.id) ?? 0) > 0 ? 2 : 0) + (p.nextStep.trim() === "" ? 1 : 0),
    }))
    .sort((a, b) => b.score - a.score)
    .map((s) => s.p)
    .find((p) => p.nextStep.trim() !== "");

  return {
    nextStep: top ? { planTitle: top.title, text: top.nextStep } : null,
    lateMilestones,
    stalled,
    activeProjects: projects.length,
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
