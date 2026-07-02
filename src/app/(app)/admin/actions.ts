"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import {
  deleteSessionCookie,
  invalidateSession,
  requestMeta,
} from "@/lib/auth/session";
import { audit } from "@/lib/audit";

const revokeSchema = z.object({ sessionId: z.string().min(1) });

export async function revokeSessionAction(formData: FormData): Promise<void> {
  const { session, user } = await requireUser();
  const { sessionId } = revokeSchema.parse({
    sessionId: formData.get("sessionId"),
  });

  await invalidateSession(sessionId);
  await audit({
    actor: user.email,
    action: "session.revoke",
    entity: "session",
    entityId: sessionId.slice(0, 12),
    ip: (await requestMeta()).ip,
  });

  if (sessionId === session.id) {
    // revoked ourselves — sign out cleanly
    await deleteSessionCookie();
    redirect("/signin");
  }

  revalidatePath("/admin");
}
