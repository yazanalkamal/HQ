import type { Metadata } from "next";
import { desc, eq } from "drizzle-orm";
import { MonitorSmartphone, ScrollText, X } from "lucide-react";
import { db } from "@/db";
import { auditLog, sessions } from "@/db/schema";
import { PageHeader } from "@/components/page-header";
import { getCurrentSession } from "@/lib/auth";
import { formatDateTime, formatRelative } from "@/lib/format";
import { describeUserAgent } from "@/lib/user-agent";
import { revokeSessionAction } from "./actions";

export const metadata: Metadata = { title: "الإدارة" };

export default async function AdminPage() {
  const { session: current, user } = await getCurrentSession();
  if (!current || !user) return null; // layout already redirected

  const [activeSessions, recentAudit] = await Promise.all([
    db
      .select()
      .from(sessions)
      .where(eq(sessions.userId, user.id))
      .orderBy(desc(sessions.lastSeenAt)),
    db.select().from(auditLog).orderBy(desc(auditLog.at)).limit(50),
  ]);

  return (
    <>
      <PageHeader
        title="الإدارة"
        description="الجلسات النشطة وسجل الأحداث — نظام مغلق لحساب واحد."
      />

      <div className="space-y-12">
        {/* ── sessions ── */}
        <section className="space-y-4">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <MonitorSmartphone className="size-5" strokeWidth={1.75} />
            الجلسات النشطة
            <span className="text-sm font-normal text-muted-foreground" data-numeric>
              ({activeSessions.length})
            </span>
          </h2>

          <ul className="divide-y rounded-xl border">
            {activeSessions.map((s) => (
              <li key={s.id} className="flex items-center gap-4 px-5 py-4">
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-sm font-medium">
                    {describeUserAgent(s.userAgent)}
                    {s.id === current.id ? (
                      <span className="ms-2 rounded-full bg-secondary px-2 py-0.5 text-xs font-normal">
                        الجلسة الحالية
                      </span>
                    ) : null}
                  </p>
                  <p className="text-xs text-muted-foreground" data-numeric>
                    آخر نشاط {formatRelative(s.lastSeenAt)}
                    {s.ip ? (
                      <>
                        {" · "}
                        <span dir="ltr">{s.ip}</span>
                      </>
                    ) : null}
                    {" · "}تنتهي {formatRelative(s.expiresAt)}
                  </p>
                </div>
                <form action={revokeSessionAction}>
                  <input type="hidden" name="sessionId" value={s.id} />
                  <button
                    type="submit"
                    title={s.id === current.id ? "تسجيل الخروج" : "إنهاء الجلسة"}
                    className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                  >
                    <X className="size-4" strokeWidth={2} />
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>

        {/* ── audit log ── */}
        <section className="space-y-4">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <ScrollText className="size-5" strokeWidth={1.75} />
            سجل الأحداث
          </h2>

          {recentAudit.length === 0 ? (
            <p className="rounded-xl border border-dashed px-5 py-8 text-center text-sm text-muted-foreground">
              لا أحداث بعد.
            </p>
          ) : (
            <ul className="divide-y rounded-xl border text-sm">
              {recentAudit.map((e) => (
                <li key={e.id} className="flex items-baseline gap-3 px-5 py-3">
                  <code className="shrink-0 rounded bg-secondary px-1.5 py-0.5 text-xs" dir="ltr">
                    {e.action}
                  </code>
                  <span className="min-w-0 flex-1 truncate text-muted-foreground" dir="ltr">
                    {e.actor}
                  </span>
                  <time className="shrink-0 text-xs text-muted-foreground" data-numeric>
                    {formatDateTime(e.at)}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
