import {
  pgTable,
  text,
  timestamp,
  jsonb,
  bigserial,
  index,
  uuid,
  date,
  boolean,
  smallint,
  doublePrecision,
} from "drizzle-orm/pg-core";

/**
 * Single-user system by policy (server-side allowlist), but modeled as a
 * proper users table so sessions/audit have a real foreign key.
 * `id` is the Google account's stable `sub` claim.
 */
export const users = pgTable("users", {
  id: text("id").primaryKey(), // Google `sub`
  email: text("email").notNull().unique(),
  name: text("name").notNull().default(""),
  picture: text("picture").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Zero-trust sessions. `id` is the SHA-256 hash of the bearer token —
 * the raw token lives only in the user's cookie, so a DB leak alone
 * cannot forge a session. 90-day rolling expiry, revocable from Admin.
 */
export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(), // sha256(token), hex
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    userAgent: text("user_agent").notNull().default(""),
    ip: text("ip").notNull().default(""),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

/**
 * Append-only audit of every state-changing action (writes, sign-ins,
 * session revocations). Rendered in the Admin page.
 */
export const auditLog = pgTable(
  "audit_log",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
    actor: text("actor").notNull(), // email, or "system"
    action: text("action").notNull(), // e.g. "auth.signin", "task.create"
    entity: text("entity").notNull().default(""), // e.g. "task"
    entityId: text("entity_id").notNull().default(""),
    detail: jsonb("detail").notNull().default({}),
    ip: text("ip").notNull().default(""),
  },
  (t) => [index("audit_at_idx").on(t.at)],
);

// ── المهام / tasks ────────────────────────────────────────────────────────────

/** Areas (مجالات) — one-level grouping for tasks: شخصي، البث، الجامعة… */
export const areas = pgTable("areas", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  /** key into the fixed AREA_COLORS palette, not a raw CSS color */
  color: text("color").notNull().default("gray"),
  sortOrder: doublePrecision("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Priorities: 0 عادية · 1 مهمة · 2 عاجلة */
export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    areaId: uuid("area_id").references(() => areas.id, { onDelete: "set null" }),
    dueDate: date("due_date"), // date-only; time lives in dueTime when set
    dueTime: text("due_time"), // "HH:mm" or null
    priority: smallint("priority").notNull().default(0),
    done: boolean("done").notNull().default(false),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    sortOrder: doublePrecision("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("tasks_due_idx").on(t.done, t.dueDate), index("tasks_area_idx").on(t.areaId)],
);

export const subtasks = pgTable(
  "subtasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    done: boolean("done").notNull().default(false),
    sortOrder: doublePrecision("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("subtasks_task_idx").on(t.taskId)],
);

// ── الملاحظات / notes ─────────────────────────────────────────────────────────

export const notes = pgTable(
  "notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    content: text("content").notNull().default(""), // Markdown source
    taskId: uuid("task_id").references(() => tasks.id, { onDelete: "set null" }),
    pinned: boolean("pinned").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("notes_updated_idx").on(t.updatedAt), index("notes_task_idx").on(t.taskId)],
);

export type User = typeof users.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type Area = typeof areas.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type Subtask = typeof subtasks.$inferSelect;
export type Note = typeof notes.$inferSelect;
