"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createDeviceLinkCode } from "@/lib/auth/device";
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

/** Mint a one-time code for linking the desktop app (5 min, single use). */
export async function createDeviceLinkAction(): Promise<{
  code: string;
  expiresAt: string;
}> {
  const { user } = await requireUser();
  const { code, expiresAt } = await createDeviceLinkCode(user.id);

  await audit({
    actor: user.email,
    action: "device.link_code",
    entity: "device",
    ip: (await requestMeta()).ip,
  });

  return { code, expiresAt: expiresAt.toISOString() };
}
