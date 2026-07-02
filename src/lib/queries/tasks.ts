import "server-only";
import { and, asc, desc, eq, gt, gte, inArray, isNull, lte, or } from "drizzle-orm";
import { db } from "@/db";
import { areas, subtasks, tasks, type Area, type Subtask, type Task } from "@/db/schema";
import { addDaysISO, todayISO } from "@/lib/dates";

export type TaskWithMeta = Task & {
  area: Area | null;
  subtaskCount: number;
  subtaskDone: number;
};

export type TaskView = "today" | "upcoming" | "later" | "done";

async function withMeta(rows: { task: Task; area: Area | null }[]): Promise<TaskWithMeta[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.task.id);
  const subs = await db
    .select({ taskId: subtasks.taskId, done: subtasks.done })
    .from(subtasks)
    .where(inArray(subtasks.taskId, ids));
  const byTask = new Map<string, { count: number; done: number }>();
  for (const s of subs) {
    const e = byTask.get(s.taskId) ?? { count: 0, done: 0 };
    e.count++;
    if (s.done) e.done++;
    byTask.set(s.taskId, e);
  }
  return rows.map(({ task, area }) => ({
    ...task,
    area,
    subtaskCount: byTask.get(task.id)?.count ?? 0,
    subtaskDone: byTask.get(task.id)?.done ?? 0,
  }));
}

const baseSelect = () =>
  db
    .select({ task: tasks, area: areas })
    .from(tasks)
    .leftJoin(areas, eq(tasks.areaId, areas.id));

const openOrder = [
  desc(tasks.priority),
  asc(tasks.dueDate),
  asc(tasks.sortOrder),
  asc(tasks.createdAt),
] as const;

/** اليوم — overdue + due today. */
export async function tasksForToday(areaId?: string): Promise<TaskWithMeta[]> {
  const today = todayISO();
  const rows = await baseSelect()
    .where(
      and(
        eq(tasks.done, false),
        lte(tasks.dueDate, today),
        areaId ? eq(tasks.areaId, areaId) : undefined,
      ),
    )
    .orderBy(asc(tasks.dueDate), ...openOrder);
  return withMeta(rows);
}

/** القادم — the next 7 days after today. */
export async function tasksUpcoming(areaId?: string): Promise<TaskWithMeta[]> {
  const today = todayISO();
  const rows = await baseSelect()
    .where(
      and(
        eq(tasks.done, false),
        gt(tasks.dueDate, today),
        lte(tasks.dueDate, addDaysISO(today, 7)),
        areaId ? eq(tasks.areaId, areaId) : undefined,
      ),
    )
    .orderBy(asc(tasks.dueDate), ...openOrder);
  return withMeta(rows);
}

/** لاحقًا — undated or beyond next week. */
export async function tasksLater(areaId?: string): Promise<TaskWithMeta[]> {
  const today = todayISO();
  const rows = await baseSelect()
    .where(
      and(
        eq(tasks.done, false),
        or(isNull(tasks.dueDate), gt(tasks.dueDate, addDaysISO(today, 7))),
        areaId ? eq(tasks.areaId, areaId) : undefined,
      ),
    )
    .orderBy(asc(tasks.dueDate), ...openOrder);
  return withMeta(rows);
}

/** المكتملة — most recent first, capped. */
export async function tasksDone(areaId?: string): Promise<TaskWithMeta[]> {
  const rows = await baseSelect()
    .where(and(eq(tasks.done, true), areaId ? eq(tasks.areaId, areaId) : undefined))
    .orderBy(desc(tasks.completedAt))
    .limit(100);
  return withMeta(rows);
}

export async function getTask(id: string): Promise<
  | (TaskWithMeta & { subtasks: Subtask[] })
  | null
> {
  const rows = await baseSelect().where(eq(tasks.id, id));
  if (rows.length === 0) return null;
  const [meta] = await withMeta(rows);
  const subs = await db
    .select()
    .from(subtasks)
    .where(eq(subtasks.taskId, id))
    .orderBy(asc(subtasks.sortOrder), asc(subtasks.createdAt));
  return { ...meta, subtasks: subs };
}

export async function listAreas(): Promise<Area[]> {
  return db.select().from(areas).orderBy(asc(areas.sortOrder), asc(areas.createdAt));
}

/** How many tasks were completed today (Riyadh day). */
export async function completedTodayCount(): Promise<number> {
  const startOfToday = new Date(`${todayISO()}T00:00:00+03:00`);
  const rows = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(and(eq(tasks.done, true), gte(tasks.completedAt, startOfToday)));
  return rows.length;
}

/** Counts per view for the tabs. */
export async function viewCounts(areaId?: string): Promise<Record<TaskView, number>> {
  const [t, u, l, d] = await Promise.all([
    tasksForToday(areaId),
    tasksUpcoming(areaId),
    tasksLater(areaId),
    tasksDone(areaId),
  ]);
  return { today: t.length, upcoming: u.length, later: l.length, done: d.length };
}
