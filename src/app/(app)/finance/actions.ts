"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { commitments, financeSettings, subscriptions } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { requestMeta } from "@/lib/auth/session";
import { audit } from "@/lib/audit";

function revalidateFinance() {
  revalidatePath("/finance");
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

const amount = z.coerce.number().positive().max(9_999_999);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

// ── subscriptions ─────────────────────────────────────────────────────────────

const subSchema = z.object({
  name: z.string().trim().min(1).max(200),
  amount,
  cycle: z.enum(["monthly", "yearly"]),
  nextRenewal: isoDate,
  category: z.string().trim().max(50).default(""),
});

export async function createSubscription(input: z.input<typeof subSchema>) {
  await requireUser();
  const data = subSchema.parse(input);
  const [sub] = await db
    .insert(subscriptions)
    .values({ ...data, amount: String(data.amount) })
    .returning();
  await auditAs("subscription.create", sub.id, { name: sub.name, amount: data.amount });
  revalidateFinance();
  return sub.id;
}

const subUpdateSchema = subSchema.partial().extend({
  id: z.string().uuid(),
  active: z.boolean().optional(),
});

export async function updateSubscription(input: z.input<typeof subUpdateSchema>) {
  await requireUser();
  const { id, amount: newAmount, ...patch } = subUpdateSchema.parse(input);
  if (Object.keys(patch).length === 0 && newAmount === undefined) return;
  await db
    .update(subscriptions)
    .set({
      ...patch,
      ...(newAmount !== undefined ? { amount: String(newAmount) } : {}),
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.id, id));
  await auditAs("subscription.update", id, { fields: Object.keys(patch) });
  revalidateFinance();
}

export async function deleteSubscription(id: string) {
  await requireUser();
  z.string().uuid().parse(id);
  await db.delete(subscriptions).where(eq(subscriptions.id, id));
  await auditAs("subscription.delete", id);
  revalidateFinance();
}

// ── commitments ───────────────────────────────────────────────────────────────

const commitmentSchema = z.object({
  name: z.string().trim().min(1).max(200),
  amount,
});

export async function createCommitment(input: z.input<typeof commitmentSchema>) {
  await requireUser();
  const data = commitmentSchema.parse(input);
  const [row] = await db
    .insert(commitments)
    .values({ name: data.name, amount: String(data.amount) })
    .returning();
  await auditAs("commitment.create", row.id, { name: row.name, amount: data.amount });
  revalidateFinance();
}

export async function updateCommitment(id: string, input: z.input<typeof commitmentSchema>) {
  await requireUser();
  z.string().uuid().parse(id);
  const data = commitmentSchema.parse(input);
  await db
    .update(commitments)
    .set({ name: data.name, amount: String(data.amount) })
    .where(eq(commitments.id, id));
  await auditAs("commitment.update", id);
  revalidateFinance();
}

export async function deleteCommitment(id: string) {
  await requireUser();
  z.string().uuid().parse(id);
  await db.delete(commitments).where(eq(commitments.id, id));
  await auditAs("commitment.delete", id);
  revalidateFinance();
}

// ── income ────────────────────────────────────────────────────────────────────

export async function setMonthlyIncome(value: number) {
  await requireUser();
  const income = z.coerce.number().min(0).max(99_999_999).parse(value);
  await db
    .insert(financeSettings)
    .values({ id: 1, monthlyIncome: String(income) })
    .onConflictDoUpdate({
      target: financeSettings.id,
      set: { monthlyIncome: String(income) },
    });
  await auditAs("finance.income_set", "1", { income });
  revalidateFinance();
}
