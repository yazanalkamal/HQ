"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { notes } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { requestMeta } from "@/lib/auth/session";
import { audit } from "@/lib/audit";

function revalidateNoteViews() {
  revalidatePath("/notes");
  revalidatePath("/tasks");
  revalidatePath("/today");
}

async function auditAs(action: string, entityId: string, detail?: Record<string, unknown>) {
  const { user } = await requireUser();
  await audit({
    actor: user.email,
    action,
    entity: "note",
    entityId,
    detail,
    ip: (await requestMeta()).ip,
  });
}

const createSchema = z.object({
  title: z.string().trim().min(1).max(300),
  content: z.string().max(200_000).default(""),
  taskId: z.string().uuid().nullish(),
});

export async function createNote(input: z.input<typeof createSchema>) {
  await requireUser();
  const data = createSchema.parse(input);
  const [note] = await db
    .insert(notes)
    .values({ title: data.title, content: data.content, taskId: data.taskId ?? null })
    .returning();
  await auditAs("note.create", note.id, { title: note.title });
  revalidateNoteViews();
  return note;
}

const updateSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1).max(300).optional(),
  content: z.string().max(200_000).optional(),
  taskId: z.string().uuid().nullable().optional(),
  pinned: z.boolean().optional(),
});

/**
 * Autosave-friendly update: content saves are NOT audited individually
 * (they fire every few seconds while typing) — only structural changes are.
 */
export async function updateNote(input: z.infer<typeof updateSchema>) {
  await requireUser();
  const { id, ...patch } = updateSchema.parse(input);
  if (Object.keys(patch).length === 0) return;
  await db
    .update(notes)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(notes.id, id));
  const structural = Object.keys(patch).filter((k) => k !== "content");
  if (structural.length > 0) {
    await auditAs("note.update", id, { fields: structural });
  }
  revalidateNoteViews();
}

export async function deleteNote(id: string) {
  await requireUser();
  z.string().uuid().parse(id);
  await db.delete(notes).where(eq(notes.id, id));
  await auditAs("note.delete", id);
  revalidateNoteViews();
}
