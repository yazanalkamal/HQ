import { Google } from "arctic";

function required(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(
      `${name} is not set — create a Google OAuth client and fill .env (see .env.example).`,
    );
  }
  return v;
}

export function googleClient(): Google {
  return new Google(
    required("GOOGLE_CLIENT_ID"),
    required("GOOGLE_CLIENT_SECRET"),
    `${required("APP_URL")}/api/auth/callback/google`,
  );
}

/** The single allowed account. Everyone else is rejected server-side. */
export function allowedEmail(): string {
  return required("ALLOWED_EMAIL").trim().toLowerCase();
}
