import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { eq, lt } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { db } from "@/db";
import { sessions, users, type Session, type User } from "@/db/schema";

export const SESSION_COOKIE = "hq_session";

/** 90-day rolling sessions (the "remind me for 90 days" requirement). */
const SESSION_TTL_MS = 90 * 24 * 60 * 60 * 1000;
/** Extend expiry once fewer than 45 days remain. */
const SESSION_RENEW_BELOW_MS = SESSION_TTL_MS / 2;
/** Throttle last-seen writes to one per 5 minutes. */
const LAST_SEEN_WRITE_MS = 5 * 60 * 1000;

/** The raw token lives only in the cookie; the DB stores its SHA-256. */
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function generateSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export async function createSession(
  token: string,
  userId: string,
  meta: { userAgent: string; ip: string },
): Promise<Session> {
  const [session] = await db
    .insert(sessions)
    .values({
      id: hashToken(token),
      userId,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      userAgent: meta.userAgent.slice(0, 400),
      ip: meta.ip.slice(0, 100),
    })
    .returning();
  return session;
}

export type SessionValidationResult =
  | { session: Session; user: User }
  | { session: null; user: null };

export async function validateSessionToken(
  token: string,
): Promise<SessionValidationResult> {
  const id = hashToken(token);
  const rows = await db
    .select({ session: sessions, user: users })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.id, id));
  const row = rows[0];
  if (!row) return { session: null, user: null };

  const now = Date.now();
  if (now >= row.session.expiresAt.getTime()) {
    await db.delete(sessions).where(eq(sessions.id, id));
    return { session: null, user: null };
  }

  const patch: Partial<typeof sessions.$inferInsert> = {};
  if (now - row.session.lastSeenAt.getTime() > LAST_SEEN_WRITE_MS) {
    patch.lastSeenAt = new Date(now);
  }
  if (row.session.expiresAt.getTime() - now < SESSION_RENEW_BELOW_MS) {
    patch.expiresAt = new Date(now + SESSION_TTL_MS);
    row.session.expiresAt = patch.expiresAt;
  }
  if (Object.keys(patch).length > 0) {
    await db.update(sessions).set(patch).where(eq(sessions.id, id));
  }

  return { session: row.session, user: row.user };
}

export async function invalidateSession(sessionId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.id, sessionId));
}

export async function deleteExpiredSessions(): Promise<void> {
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
}

// ── cookie helpers ────────────────────────────────────────────────────────────

export async function setSessionCookie(token: string, expiresAt: Date) {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function deleteSessionCookie() {
  const store = await cookies();
  store.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

// ── request metadata (Caddy sets the forwarding headers in prod) ─────────────

export async function requestMeta(): Promise<{ userAgent: string; ip: string }> {
  const h = await headers();
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    "";
  return { userAgent: h.get("user-agent") ?? "", ip };
}
