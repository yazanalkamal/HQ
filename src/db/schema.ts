import {
  pgTable,
  text,
  timestamp,
  jsonb,
  bigserial,
  index,
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

export type User = typeof users.$inferSelect;
export type Session = typeof sessions.$inferSelect;
