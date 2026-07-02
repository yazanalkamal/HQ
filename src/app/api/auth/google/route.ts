import { generateCodeVerifier, generateState } from "arctic";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth";
import { googleClient } from "@/lib/auth/oauth";

const OAUTH_COOKIE = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 10,
};

export async function GET(): Promise<Response> {
  const { session } = await getCurrentSession();
  if (session) redirect("/tasks");

  const state = generateState();
  const codeVerifier = generateCodeVerifier();
  const url = googleClient().createAuthorizationURL(state, codeVerifier, [
    "openid",
    "profile",
    "email",
  ]);

  const store = await cookies();
  store.set("google_oauth_state", state, OAUTH_COOKIE);
  store.set("google_code_verifier", codeVerifier, OAUTH_COOKIE);

  redirect(url.toString());
}
