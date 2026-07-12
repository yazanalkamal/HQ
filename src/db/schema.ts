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
  numeric,
  uniqueIndex,
  type AnyPgColumn,
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
 * One-time codes for linking the desktop app («ربط الجهاز» in /admin).
 * Same storage rule as sessions: the DB keeps only the SHA-256 of the
 * code. 5-minute expiry, single use — the claim endpoint exchanges a
 * valid code for a real session.
 */
export const deviceLinkCodes = pgTable("device_link_codes", {
  id: text("id").primaryKey(), // sha256(code), hex
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

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
    planId: uuid("plan_id").references((): AnyPgColumn => plans.id, {
      onDelete: "set null",
    }),
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

// ── المالية / finance ─────────────────────────────────────────────────────────

/** Recurring subscriptions, SAR. `cycle`: "monthly" | "yearly". */
export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
    cycle: text("cycle").notNull().default("monthly"),
    nextRenewal: date("next_renewal").notNull(),
    category: text("category").notNull().default(""),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("subs_renewal_idx").on(t.active, t.nextRenewal)],
);

/** Fixed monthly commitments (rent, family, …), SAR/month. */
export const commitments = pgTable("commitments", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Singleton row (id = 1): the knobs the budget math needs. */
export const financeSettings = pgTable("finance_settings", {
  id: smallint("id").primaryKey().default(1),
  monthlyIncome: numeric("monthly_income", { precision: 12, scale: 2 }).notNull().default("0"),
});

// ── الخطط / plans — the time canvas ──────────────────────────────────────────

/**
 * A plan is a bar on the time canvas. `kind`:
 *  - "project": milestones drive progress
 *  - "routine": `cadence` times/week, routine_checks drive the ribbon
 */
export const plans = pgTable(
  "plans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    kind: text("kind").notNull().default("project"),
    /** one level of nesting: a sub-plan's parent is always a root plan */
    parentId: uuid("parent_id").references((): AnyPgColumn => plans.id, {
      onDelete: "cascade",
    }),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    color: text("color").notNull().default("violet"), // PLAN_COLORS key
    nextStep: text("next_step").notNull().default(""),
    cadence: smallint("cadence").notNull().default(3), // routine: times/week
    status: text("status").notNull().default("active"), // active | done | archived
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("plans_status_idx").on(t.status, t.startDate)],
);

/** Diamonds on a project bar — real dates, real accountability. */
export const milestones = pgTable(
  "milestones",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    planId: uuid("plan_id")
      .notNull()
      .references(() => plans.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    dueDate: date("due_date").notNull(),
    done: boolean("done").notNull().default(false),
    doneAt: timestamp("done_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("milestones_plan_idx").on(t.planId, t.dueDate)],
);

/** One row per checked routine day (جيم اليوم؟ ✓). */
export const routineChecks = pgTable(
  "routine_checks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    planId: uuid("plan_id")
      .notNull()
      .references(() => plans.id, { onDelete: "cascade" }),
    day: date("day").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("routine_day_uq").on(t.planId, t.day)],
);

/** سجل الدفعات — every completed next step, a plan's momentum history. */
export const planSteps = pgTable(
  "plan_steps",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    planId: uuid("plan_id")
      .notNull()
      .references(() => plans.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    doneAt: timestamp("done_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("plan_steps_plan_idx").on(t.planId, t.doneAt)],
);

/** Captured ideas — unprocessed by definition; the strip nags until sorted. */
export const ideas = pgTable("ideas", {
  id: uuid("id").primaryKey().defaultRandom(),
  text: text("text").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ── نبض المنصات / platform stats ─────────────────────────────────────────────

/**
 * One row per platform per day — the growth history behind the sparklines.
 * Written by machines (StreamBot's snapshot job, the X scraper) through
 * POST /api/stats/ingest, never by user actions. Metrics shapes:
 *  - twitch:  { followers, live, viewers?, subs?, lastStreamAt? }
 *  - discord: { members, online?, voice? }
 *  - x:       { followers, following?, posts? }
 */
export const platformStats = pgTable(
  "platform_stats",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    platform: text("platform").notNull(), // "twitch" | "discord" | "x"
    day: date("day").notNull(), // Asia/Riyadh calendar day of the snapshot
    metrics: jsonb("metrics").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("platform_day_uq").on(t.platform, t.day)],
);

/**
 * Current state per platform (live viewers, online-now, X session health) —
 * one upserted row each, no history. Staleness is judged by updatedAt.
 */
export const platformLive = pgTable("platform_live", {
  platform: text("platform").primaryKey(),
  metrics: jsonb("metrics").notNull().default({}),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type User = typeof users.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type Area = typeof areas.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type Subtask = typeof subtasks.$inferSelect;
export type Subscription = typeof subscriptions.$inferSelect;
export type Commitment = typeof commitments.$inferSelect;
export type Plan = typeof plans.$inferSelect;
export type Milestone = typeof milestones.$inferSelect;
export type PlanStep = typeof planSteps.$inferSelect;
export type Idea = typeof ideas.$inferSelect;
export type PlatformStat = typeof platformStats.$inferSelect;
export type PlatformLive = typeof platformLive.$inferSelect;
