import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth";

export const metadata: Metadata = { title: "تسجيل الدخول" };

const ERRORS: Record<string, string> = {
  denied: "هذا الحساب غير مسموح له بالدخول.",
  state: "انتهت صلاحية محاولة الدخول — جرّب مرة أخرى.",
  exchange: "تعذّر إتمام الدخول مع Google — جرّب مرة أخرى.",
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { session } = await getCurrentSession();
  if (session) redirect("/tasks");

  const { error } = await searchParams;
  const errorMessage = error ? (ERRORS[error] ?? ERRORS.exchange) : null;

  return (
    <main className="flex min-h-dvh items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-10 text-center">
        <div className="space-y-3">
          <h1 className="font-display tarsil text-6xl font-bold">المقـــر</h1>
          <p className="text-sm text-muted-foreground">
            مهامك، ملاحظاتك، ماليتك، وخططك — في مكان واحد.
          </p>
        </div>

        <div className="space-y-4">
          <a
            href="/api/auth/google"
            className="flex w-full items-center justify-center gap-3 rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            <GoogleIcon />
            الدخول بحساب Google
          </a>
          {errorMessage ? (
            <p className="text-sm text-destructive">{errorMessage}</p>
          ) : null}
        </div>

        <p className="text-xs text-muted-foreground">
          نظام مغلق — الدخول لحساب واحد فقط.
        </p>
      </div>
    </main>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
      <path
        fill="currentColor"
        d="M21.35 11.1H12v2.9h5.35c-.5 2.5-2.6 3.9-5.35 3.9a6 6 0 1 1 0-12c1.5 0 2.9.55 3.95 1.55l2.15-2.15A9 9 0 1 0 12 21c4.6 0 8.85-3.35 8.85-9 0-.3-.02-.6-.05-.9z"
      />
    </svg>
  );
}
