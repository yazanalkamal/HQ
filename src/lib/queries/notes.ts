import "server-only";
import { desc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { notes, tasks, type Note } from "@/db/schema";

export type NoteListItem = Pick<
  Note,
  "id" | "title" | "pinned" | "taskId" | "updatedAt"
> & { excerpt: string; taskTitle: string | null };

export async function listNotes(search?: string): Promise<NoteListItem[]> {
  const rows = await db
    .select({
      id: notes.id,
      title: notes.title,
      pinned: notes.pinned,
      taskId: notes.taskId,
      updatedAt: notes.updatedAt,
      excerpt: sql<string>`left(${notes.content}, 220)`,
      taskTitle: tasks.title,
    })
    .from(notes)
    .leftJoin(tasks, eq(notes.taskId, tasks.id))
    .where(
      search
        ? or(ilike(notes.title, `%${search}%`), ilike(notes.content, `%${search}%`))
        : undefined,
    )
    .orderBy(desc(notes.pinned), desc(notes.updatedAt));
  return rows;
}

export async function getNote(id: string) {
  const rows = await db
    .select({ note: notes, taskTitle: tasks.title })
    .from(notes)
    .leftJoin(tasks, eq(notes.taskId, tasks.id))
    .where(eq(notes.id, id));
  if (rows.length === 0) return null;
  return { ...rows[0].note, taskTitle: rows[0].taskTitle };
}

export async function notesForTask(taskId: string) {
  return db
    .select({ id: notes.id, title: notes.title, updatedAt: notes.updatedAt })
    .from(notes)
    .where(eq(notes.taskId, taskId))
    .orderBy(desc(notes.updatedAt));
}

/** Resolve a [[wiki-link]] title to a note id (exact match first, then loose). */
export async function noteIdByTitle(title: string): Promise<string | null> {
  const exact = await db
    .select({ id: notes.id })
    .from(notes)
    .where(eq(notes.title, title))
    .limit(1);
  if (exact.length > 0) return exact[0].id;
  const loose = await db
    .select({ id: notes.id })
    .from(notes)
    .where(ilike(notes.title, title))
    .limit(1);
  return loose[0]?.id ?? null;
}

/** All note titles — used to render wiki-links as resolved/unresolved. */
export async function allNoteTitles(): Promise<Map<string, string>> {
  const rows = await db.select({ id: notes.id, title: notes.title }).from(notes);
  return new Map(rows.map((r) => [r.title.trim(), r.id]));
}
