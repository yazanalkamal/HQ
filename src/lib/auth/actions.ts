"use server";

import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth";
import {
  deleteSessionCookie,
  invalidateSession,
  requestMeta,
} from "@/lib/auth/session";
import { audit } from "@/lib/audit";

export async function signOutAction(): Promise<void> {
  const { session, user } = await getCurrentSession();
  if (!session) redirect("/signin");

  await invalidateSession(session.id);
  await deleteSessionCookie();
  await audit({
    actor: user.email,
    action: "auth.signout",
    ip: (await requestMeta()).ip,
  });
  redirect("/signin");
}
