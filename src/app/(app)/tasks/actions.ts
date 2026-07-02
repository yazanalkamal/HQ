"use server";

import { revalidatePath } from "next/cache";
import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { areas, subtasks, tasks } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { requestMeta } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { AREA_COLORS } from "@/lib/areas";

/** Revalidate every surface that renders tasks. */
function revalidateTaskViews() {
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

// ── tasks ─────────────────────────────────────────────────────────────────────

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const hhmm = z.string().regex(/^\d{2}:\d{2}$/);

const createTaskSchema = z.object({
  title: z.string().trim().min(1).max(500),
  dueDate: isoDate.nullish(),
  dueTime: hhmm.nullish(),
  priority: z.number().int().min(0).max(2).default(0),
  areaId: z.string().uuid().nullish(),
  description: z.string().max(10_000).default(""),
});

export async function createTask(input: z.input<typeof createTaskSchema>) {
  await requireUser();
  const data = createTaskSchema.parse(input);
  const [task] = await db
    .insert(tasks)
    .values({
      title: data.title,
      description: data.description,
      dueDate: data.dueDate ?? null,
      dueTime: data.dueTime ?? null,
      priority: data.priority,
      areaId: data.areaId ?? null,
    })
    .returning();
  await auditAs("task.create", task.id, { title: task.title });
  revalidateTaskViews();
  return task;
}

const updateTaskSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1).max(500).optional(),
  description: z.string().max(10_000).optional(),
  dueDate: isoDate.nullable().optional(),
  dueTime: hhmm.nullable().optional(),
  priority: z.number().int().min(0).max(2).optional(),
  areaId: z.string().uuid().nullable().optional(),
});

export async function updateTask(input: z.infer<typeof updateTaskSchema>) {
  await requireUser();
  const { id, ...patch } = updateTaskSchema.parse(input);
  if (Object.keys(patch).length === 0) return;
  await db
    .update(tasks)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(tasks.id, id));
  await auditAs("task.update", id, { fields: Object.keys(patch) });
  revalidateTaskViews();
}

export async function toggleTask(id: string, done: boolean) {
  await requireUser();
  z.string().uuid().parse(id);
  await db
    .update(tasks)
    .set({
      done,
      completedAt: done ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(tasks.id, id));
  await auditAs(done ? "task.complete" : "task.reopen", id);
  revalidateTaskViews();
}

export async function deleteTask(id: string) {
  await requireUser();
  z.string().uuid().parse(id);
  await db.delete(tasks).where(eq(tasks.id, id));
  await auditAs("task.delete", id);
  revalidateTaskViews();
}

// ── subtasks ──────────────────────────────────────────────────────────────────

export async function addSubtask(taskId: string, title: string) {
  await requireUser();
  const data = z
    .object({ taskId: z.string().uuid(), title: z.string().trim().min(1).max(500) })
    .parse({ taskId, title });
  const [sub] = await db.insert(subtasks).values(data).returning();
  await auditAs("subtask.create", sub.id, { taskId });
  revalidateTaskViews();
  return sub;
}

export async function toggleSubtask(id: string, done: boolean) {
  await requireUser();
  z.string().uuid().parse(id);
  await db.update(subtasks).set({ done }).where(eq(subtasks.id, id));
  revalidateTaskViews();
}

export async function deleteSubtask(id: string) {
  await requireUser();
  z.string().uuid().parse(id);
  await db.delete(subtasks).where(eq(subtasks.id, id));
  await auditAs("subtask.delete", id);
  revalidateTaskViews();
}

// ── areas ─────────────────────────────────────────────────────────────────────

const areaSchema = z.object({
  name: z.string().trim().min(1).max(100),
  color: z.enum(Object.keys(AREA_COLORS) as [string, ...string[]]),
});

export async function createArea(input: z.infer<typeof areaSchema>) {
  await requireUser();
  const data = areaSchema.parse(input);
  const existing = await db.select().from(areas).where(eq(areas.name, data.name));
  if (existing.length > 0) throw new Error("يوجد مجال بهذا الاسم");
  const [area] = await db.insert(areas).values(data).returning();
  await auditAs("area.create", area.id, { name: area.name });
  revalidateTaskViews();
  return area;
}

export async function updateArea(id: string, input: z.infer<typeof areaSchema>) {
  await requireUser();
  z.string().uuid().parse(id);
  const data = areaSchema.parse(input);
  const clash = await db
    .select()
    .from(areas)
    .where(and(eq(areas.name, data.name), ne(areas.id, id)));
  if (clash.length > 0) throw new Error("يوجد مجال بهذا الاسم");
  await db.update(areas).set(data).where(eq(areas.id, id));
  await auditAs("area.update", id, { name: data.name });
  revalidateTaskViews();
}

export async function deleteArea(id: string) {
  await requireUser();
  z.string().uuid().parse(id);
  await db.delete(areas).where(eq(areas.id, id)); // tasks keep living (FK set null)
  await auditAs("area.delete", id);
  revalidateTaskViews();
}
