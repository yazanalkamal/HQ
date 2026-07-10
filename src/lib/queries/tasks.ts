import "server-only";
import { and, asc, desc, eq, gt, gte, inArray, isNull, lt, lte, or } from "drizzle-orm";
import { db } from "@/db";
import { areas, plans, subtasks, tasks, type Area, type Subtask, type Task } from "@/db/schema";
import { addDaysISO, todayISO } from "@/lib/dates";

export type TaskWithMeta = Task & {
  area: Area | null;
  plan: { id: string; title: string; color: string } | null;
  subtaskCount: number;
  subtaskDone: number;
};

export type TaskView = "today" | "upcoming" | "later" | "done";

type JoinedRow = {
  task: Task;
  area: Area | null;
  plan: { id: string; title: string; color: string } | null;
};

async function withMeta(rows: JoinedRow[]): Promise<TaskWithMeta[]> {
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
  return rows.map(({ task, area, plan }) => ({
    ...task,
    area,
    plan: plan?.id ? plan : null,
    subtaskCount: byTask.get(task.id)?.count ?? 0,
    subtaskDone: byTask.get(task.id)?.done ?? 0,
  }));
}

const baseSelect = () =>
  db
    .select({
      task: tasks,
      area: areas,
      plan: { id: plans.id, title: plans.title, color: plans.color },
    })
    .from(tasks)
    .leftJoin(areas, eq(tasks.areaId, areas.id))
    .leftJoin(plans, eq(tasks.planId, plans.id));

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

// ── day-board queries (المهام redesign) ───────────────────────────────────────

/** All tasks whose due date IS `day` — open and done (progress needs both). */
export async function tasksForDay(day: string, areaId?: string): Promise<TaskWithMeta[]> {
  const rows = await baseSelect()
    .where(and(eq(tasks.dueDate, day), areaId ? eq(tasks.areaId, areaId) : undefined))
    .orderBy(asc(tasks.done), ...openOrder);
  return withMeta(rows);
}

/** Open tasks overdue relative to `today` (for the pinned red block). */
export async function tasksOverdue(today: string, areaId?: string): Promise<TaskWithMeta[]> {
  const rows = await baseSelect()
    .where(
      and(
        eq(tasks.done, false),
        lt(tasks.dueDate, today),
        areaId ? eq(tasks.areaId, areaId) : undefined,
      ),
    )
    .orderBy(asc(tasks.dueDate), ...openOrder);
  return withMeta(rows);
}

/** Open tasks with no date at all. */
export async function tasksUndated(areaId?: string): Promise<TaskWithMeta[]> {
  const rows = await baseSelect()
    .where(
      and(eq(tasks.done, false), isNull(tasks.dueDate), areaId ? eq(tasks.areaId, areaId) : undefined),
    )
    .orderBy(...openOrder);
  return withMeta(rows);
}

export type DayStripData = {
  days: { date: string; open: number; done: number }[];
  overdueCount: number;
  undatedCount: number;
  doneTotal: number;
};

/** Everything the week strip needs, in one sweep. */
export async function weekStrip(
  weekStart: string,
  today: string,
  areaId?: string,
): Promise<DayStripData> {
  const weekEnd = addDaysISO(weekStart, 6);
  const [inWeek, overdue, undated, doneAll] = await Promise.all([
    db
      .select({ dueDate: tasks.dueDate, done: tasks.done })
      .from(tasks)
      .where(
        and(
          gte(tasks.dueDate, weekStart),
          lte(tasks.dueDate, weekEnd),
          areaId ? eq(tasks.areaId, areaId) : undefined,
        ),
      ),
    db
      .select({ id: tasks.id })
      .from(tasks)
      .where(
        and(
          eq(tasks.done, false),
          lt(tasks.dueDate, today),
          areaId ? eq(tasks.areaId, areaId) : undefined,
        ),
      ),
    db
      .select({ id: tasks.id })
      .from(tasks)
      .where(
        and(eq(tasks.done, false), isNull(tasks.dueDate), areaId ? eq(tasks.areaId, areaId) : undefined),
      ),
    db
      .select({ id: tasks.id })
      .from(tasks)
      .where(and(eq(tasks.done, true), areaId ? eq(tasks.areaId, areaId) : undefined)),
  ]);

  const days = Array.from({ length: 7 }, (_, i) => {
    const date = addDaysISO(weekStart, i);
    const dayRows = inWeek.filter((r) => r.dueDate === date);
    return {
      date,
      open: dayRows.filter((r) => !r.done).length,
      done: dayRows.filter((r) => r.done).length,
    };
  });

  return {
    days,
    overdueCount: overdue.length,
    undatedCount: undated.length,
    doneTotal: doneAll.length,
  };
}
