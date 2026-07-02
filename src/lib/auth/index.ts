import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  SESSION_COOKIE,
  validateSessionToken,
  type SessionValidationResult,
} from "./session";

/**
 * Request-scoped session lookup (deduped via React cache).
 * Zero-trust: the cookie is only a pointer — every request re-validates
 * against the sessions table.
 */
export const getCurrentSession = cache(
  async (): Promise<SessionValidationResult> => {
    const store = await cookies();
    const token = store.get(SESSION_COOKIE)?.value;
    if (!token) return { session: null, user: null };
    return validateSessionToken(token);
  },
);

/**
 * Gate for every protected server action / route. Call it FIRST in each
 * mutation — hiding a button is UX, this is the control.
 */
export async function requireUser() {
  const { session, user } = await getCurrentSession();
  if (!session) redirect("/signin");
  return { session, user };
}
