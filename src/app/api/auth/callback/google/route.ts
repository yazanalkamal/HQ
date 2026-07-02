import { decodeIdToken, type OAuth2Tokens } from "arctic";
import { and, eq, ne } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { users } from "@/db/schema";
import { audit } from "@/lib/audit";
import { allowedEmail, googleClient } from "@/lib/auth/oauth";
import {
  createSession,
  generateSessionToken,
  requestMeta,
  setSessionCookie,
} from "@/lib/auth/session";

type GoogleClaims = {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
};

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const store = await cookies();
  const storedState = store.get("google_oauth_state")?.value ?? null;
  const codeVerifier = store.get("google_code_verifier")?.value ?? null;
  store.delete("google_oauth_state");
  store.delete("google_code_verifier");

  if (!code || !state || !storedState || !codeVerifier || state !== storedState) {
    redirect("/signin?error=state");
  }

  let tokens: OAuth2Tokens;
  try {
    tokens = await googleClient().validateAuthorizationCode(code, codeVerifier);
  } catch {
    redirect("/signin?error=exchange");
  }

  const claims = decodeIdToken(tokens.idToken()) as GoogleClaims;
  const email = claims.email?.trim().toLowerCase() ?? "";
  const meta = await requestMeta();

  // ── zero-trust gate: exactly one Google account may enter ──────────────────
  if (!claims.email_verified || email !== allowedEmail()) {
    await audit({
      actor: email || "unknown",
      action: "auth.denied",
      detail: { sub: claims.sub },
      ip: meta.ip,
    });
    redirect("/signin?error=denied");
  }

  // Single-user system: a row with this email but a different Google id is
  // stale (e.g. a dev seed). Remove it so the upsert below can't collide on
  // the email unique constraint; its sessions cascade away with it.
  await db
    .delete(users)
    .where(and(eq(users.email, email), ne(users.id, claims.sub)));

  await db
    .insert(users)
    .values({
      id: claims.sub,
      email,
      name: claims.name ?? "",
      picture: claims.picture ?? "",
    })
    .onConflictDoUpdate({
      target: users.id,
      set: { email, name: claims.name ?? "", picture: claims.picture ?? "" },
    });

  const token = generateSessionToken();
  const session = await createSession(token, claims.sub, meta);
  await setSessionCookie(token, session.expiresAt);

  await audit({
    actor: email,
    action: "auth.signin",
    detail: { userAgent: meta.userAgent },
    ip: meta.ip,
  });

  redirect("/tasks");
}
