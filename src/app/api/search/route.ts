import { NextResponse } from "next/server";
import { asc, desc, ilike } from "drizzle-orm";
import { db } from "@/db";
import { tasks } from "@/db/schema";
import { getCurrentSession } from "@/lib/auth";

export async function GET(request: Request): Promise<Response> {
  const { session } = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 1) return NextResponse.json({ tasks: [] });

  const taskHits = await db
    .select({ id: tasks.id, title: tasks.title, done: tasks.done, dueDate: tasks.dueDate })
    .from(tasks)
    .where(ilike(tasks.title, `%${q}%`))
    .orderBy(asc(tasks.done), desc(tasks.updatedAt))
    .limit(10);

  return NextResponse.json({ tasks: taskHits });
}
