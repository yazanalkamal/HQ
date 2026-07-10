"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { plans, tasks } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { requestMeta } from "@/lib/auth/session";
import { audit } from "@/lib/audit";

const BUCKETS = ["now", "next", "someday"] as const;
export type Bucket = (typeof BUCKETS)[number];

function revalidatePlans() {
  revalidatePath("/plans");
  revalidatePath("/tasks");
  revalidatePath("/today");
}

async function auditAs(action: string, entityId: string, detail?: Record<string, unknown>) {
  const { user } = await requireUser();
  await audit({
    actor: user.email,
    action,
    entity: "plan",
    entityId,
    detail,
    ip: (await requestMeta()).ip,
  });
}

const createSchema = z.object({
  title: z.string().trim().min(1).max(500),
  bucket: z.enum(BUCKETS),
});

export async function createPlan(input: z.input<typeof createSchema>) {
  await requireUser();
  const data = createSchema.parse(input);
  const [plan] = await db.insert(plans).values(data).returning();
  await auditAs("plan.create", plan.id, { title: plan.title, bucket: plan.bucket });
  revalidatePlans();
}

const updateSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1).max(500).optional(),
  description: z.string().max(10_000).optional(),
  bucket: z.enum(BUCKETS).optional(),
});

export async function updatePlan(input: z.input<typeof updateSchema>) {
  await requireUser();
  const { id, ...patch } = updateSchema.parse(input);
  if (Object.keys(patch).length === 0) return;
  await db
    .update(plans)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(plans.id, id));
  await auditAs("plan.update", id, { fields: Object.keys(patch) });
  revalidatePlans();
}

export async function deletePlan(id: string) {
  await requireUser();
  z.string().uuid().parse(id);
  await db.delete(plans).where(eq(plans.id, id));
  await auditAs("plan.delete", id);
  revalidatePlans();
}

/**
 * Promote: the plan graduates into a real task (undated, normal priority,
 * description carried over) and leaves the board. Returns the task id so
 * the UI can open it.
 */
export async function promotePlan(id: string): Promise<string> {
  await requireUser();
  z.string().uuid().parse(id);
  const rows = await db.select().from(plans).where(eq(plans.id, id));
  const plan = rows[0];
  if (!plan) throw new Error("الخطة غير موجودة");

  const [task] = await db
    .insert(tasks)
    .values({ title: plan.title, description: plan.description })
    .returning();
  await db.delete(plans).where(eq(plans.id, id));

  await auditAs("plan.promote", id, { taskId: task.id, title: plan.title });
  revalidatePlans();
  return task.id;
}
