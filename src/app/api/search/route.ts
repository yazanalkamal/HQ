import { NextResponse } from "next/server";
import { asc, desc, ilike, or } from "drizzle-orm";
import { db } from "@/db";
import { notes, tasks } from "@/db/schema";
import { getCurrentSession } from "@/lib/auth";

export async function GET(request: Request): Promise<Response> {
  const { session } = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 1) return NextResponse.json({ tasks: [], notes: [] });

  const pattern = `%${q}%`;
  const [taskHits, noteHits] = await Promise.all([
    db
      .select({ id: tasks.id, title: tasks.title, done: tasks.done, dueDate: tasks.dueDate })
      .from(tasks)
      .where(ilike(tasks.title, pattern))
      .orderBy(asc(tasks.done), desc(tasks.updatedAt))
      .limit(8),
    db
      .select({ id: notes.id, title: notes.title })
      .from(notes)
      .where(or(ilike(notes.title, pattern), ilike(notes.content, pattern)))
      .orderBy(desc(notes.updatedAt))
      .limit(8),
  ]);

  return NextResponse.json({ tasks: taskHits, notes: noteHits });
}
