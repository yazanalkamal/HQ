import { redirect } from "next/navigation";
import { audit } from "@/lib/audit";
import { claimDeviceLinkCode } from "@/lib/auth/device";
import {
  createSession,
  generateSessionToken,
  requestMeta,
  setSessionCookie,
} from "@/lib/auth/session";

/**
 * Desktop-app linking: the shell navigates its webview here with the
 * one-time code from /admin. Reachable without a session by design —
 * the code IS the credential (single use, 5-minute expiry). On success
 * this mints a normal revocable session and lands on /capture.
 */
export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get("code") ?? "";
  const meta = await requestMeta();

  const claimed = await claimDeviceLinkCode(code);
  if (!claimed) {
    await audit({
      actor: "system",
      action: "device.denied",
      entity: "device",
      detail: { userAgent: meta.userAgent },
      ip: meta.ip,
    });
    redirect("/signin?error=device");
  }

  const token = generateSessionToken();
  const session = await createSession(token, claimed.userId, meta);
  await setSessionCookie(token, session.expiresAt);

  await audit({
    actor: claimed.email,
    action: "device.linked",
    entity: "session",
    entityId: session.id.slice(0, 12),
    detail: { userAgent: meta.userAgent },
    ip: meta.ip,
  });

  redirect("/capture");
}
