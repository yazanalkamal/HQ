"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { ideas, milestones, plans, planSteps, routineChecks, tasks } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { requestMeta } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { todayISO } from "@/lib/dates";
import { PLAN_COLORS } from "@/lib/timeline";

function revalidate() {
  revalidatePath("/plans");
  revalidatePath("/tasks");
  revalidatePath("/today");
}

async function auditAs(action: string, entityId: string, detail?: Record<string, unknown>) {
  const { user } = await requireUser();
  await audit({
    actor: user.email,
    action,
    entity: action.split(".")[0],
    entityId,
    detail,
    ip: (await requestMeta()).ip,
  });
}

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

// ── ideas (capture) ───────────────────────────────────────────────────────────

export async function createIdea(text: string) {
  await requireUser();
  const value = z.string().trim().min(1).max(500).parse(text);
  const [idea] = await db.insert(ideas).values({ text: value }).returning();
  await auditAs("idea.create", idea.id, { text: value });
  revalidate();
}

export async function deleteIdea(id: string) {
  await requireUser();
  z.string().uuid().parse(id);
  await db.delete(ideas).where(eq(ideas.id, id));
  await auditAs("idea.delete", id);
  revalidate();
}

/** فكرة → مهمة (undated, lands in لاحقًا). */
export async function ideaToTask(id: string) {
  await requireUser();
  z.string().uuid().parse(id);
  const rows = await db.select().from(ideas).where(eq(ideas.id, id));
  if (!rows[0]) throw new Error("الفكرة غير موجودة");
  const [task] = await db.insert(tasks).values({ title: rows[0].text }).returning();
  await db.delete(ideas).where(eq(ideas.id, id));
  await auditAs("idea.to_task", id, { taskId: task.id });
  revalidate();
}

// ── plans ─────────────────────────────────────────────────────────────────────

const planSchema = z
  .object({
    title: z.string().trim().min(1).max(300),
    description: z.string().max(10_000).default(""),
    kind: z.enum(["project", "routine"]),
    startDate: isoDate,
    endDate: isoDate,
    color: z.enum(Object.keys(PLAN_COLORS) as [string, ...string[]]),
    nextStep: z.string().trim().max(500).default(""),
    cadence: z.number().int().min(1).max(7).default(3),
    fromIdeaId: z.string().uuid().nullish(),
    parentId: z.string().uuid().nullish(),
  })
  .refine((p) => p.endDate >= p.startDate, { message: "النهاية قبل البداية" });

export async function createPlan(input: z.input<typeof planSchema>): Promise<string> {
  await requireUser();
  const { fromIdeaId, parentId, ...data } = planSchema.parse(input);
  if (parentId) {
    const parent = await db.select().from(plans).where(eq(plans.id, parentId));
    if (!parent[0]) throw new Error("الخطة الأم غير موجودة");
    if (parent[0].parentId) throw new Error("مستوى واحد فقط من الخطط الفرعية");
  }
  const [plan] = await db
    .insert(plans)
    .values({ ...data, parentId: parentId ?? null })
    .returning();
  if (fromIdeaId) await db.delete(ideas).where(eq(ideas.id, fromIdeaId));
  await auditAs("plan.create", plan.id, { title: plan.title, kind: plan.kind, parentId });
  revalidate();
  return plan.id;
}

/** Quick-add a task that belongs to a plan (lands undated in المهام too). */
export async function addTaskToPlan(planId: string, title: string, dueDate?: string) {
  await requireUser();
  const data = z
    .object({
      planId: z.string().uuid(),
      title: z.string().trim().min(1).max(500),
      dueDate: isoDate.optional(),
    })
    .parse({ planId, title, dueDate });
  const [task] = await db
    .insert(tasks)
    .values({ title: data.title, planId: data.planId, dueDate: data.dueDate ?? null })
    .returning();
  await auditAs("plan.task_add", planId, { taskId: task.id, title: task.title });
  revalidate();
}

const planUpdateSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1).max(300).optional(),
  description: z.string().max(10_000).optional(),
  startDate: isoDate.optional(),
  endDate: isoDate.optional(),
  color: z.enum(Object.keys(PLAN_COLORS) as [string, ...string[]]).optional(),
  nextStep: z.string().trim().max(500).optional(),
  cadence: z.number().int().min(1).max(7).optional(),
  status: z.enum(["active", "done", "archived"]).optional(),
});

export async function updatePlan(input: z.input<typeof planUpdateSchema>) {
  await requireUser();
  const { id, ...patch } = planUpdateSchema.parse(input);
  if (Object.keys(patch).length === 0) return;
  await db
    .update(plans)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(plans.id, id));
  await auditAs("plan.update", id, { fields: Object.keys(patch) });
  revalidate();
}

export async function deletePlan(id: string) {
  await requireUser();
  z.string().uuid().parse(id);
  await db.delete(plans).where(eq(plans.id, id));
  await auditAs("plan.delete", id);
  revalidate();
}

/**
 * Check off the current next step and set the new one (may be empty).
 * The done step lands in سجل الدفعات — momentum stays visible.
 */
export async function completeNextStep(planId: string, newStep: string) {
  await requireUser();
  z.string().uuid().parse(planId);
  const next = z.string().trim().max(500).parse(newStep);
  const rows = await db.select().from(plans).where(eq(plans.id, planId));
  if (!rows[0]) throw new Error("الخطة غير موجودة");
  const done = rows[0].nextStep.trim();
  if (done) await db.insert(planSteps).values({ planId, text: done });
  await db
    .update(plans)
    .set({ nextStep: next, updatedAt: new Date() })
    .where(eq(plans.id, planId));
  await auditAs("plan.step_done", planId, { done, next });
  revalidate();
}

// ── milestones ────────────────────────────────────────────────────────────────

export async function addMilestone(planId: string, title: string, dueDate: string) {
  await requireUser();
  const data = z
    .object({
      planId: z.string().uuid(),
      title: z.string().trim().min(1).max(300),
      dueDate: isoDate,
    })
    .parse({ planId, title, dueDate });
  const [ms] = await db.insert(milestones).values(data).returning();
  await auditAs("milestone.create", ms.id, { planId, title: ms.title });
  revalidate();
}

export async function toggleMilestone(id: string, done: boolean) {
  await requireUser();
  z.string().uuid().parse(id);
  await db
    .update(milestones)
    .set({ done, doneAt: done ? new Date() : null })
    .where(eq(milestones.id, id));
  await auditAs(done ? "milestone.done" : "milestone.reopen", id);
  revalidate();
}

export async function deleteMilestone(id: string) {
  await requireUser();
  z.string().uuid().parse(id);
  await db.delete(milestones).where(eq(milestones.id, id));
  await auditAs("milestone.delete", id);
  revalidate();
}

// ── routine checks ────────────────────────────────────────────────────────────

/** Toggle today's (or a given day's) routine check. */
export async function toggleRoutineCheck(planId: string, day?: string) {
  await requireUser();
  z.string().uuid().parse(planId);
  const d = day ? isoDate.parse(day) : todayISO();
  const existing = await db
    .select()
    .from(routineChecks)
    .where(and(eq(routineChecks.planId, planId), eq(routineChecks.day, d)));
  if (existing.length > 0) {
    await db
      .delete(routineChecks)
      .where(and(eq(routineChecks.planId, planId), eq(routineChecks.day, d)));
    await auditAs("routine.uncheck", planId, { day: d });
  } else {
    await db.insert(routineChecks).values({ planId, day: d });
    await auditAs("routine.check", planId, { day: d });
  }
  revalidate();
}
