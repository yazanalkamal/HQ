import Link from "next/link";
import { redirect } from "next/navigation";
import { SidebarNav } from "@/components/shell/sidebar-nav";
import { SidebarNavCompact } from "@/components/shell/sidebar-nav-compact";
import { UserBlock } from "@/components/shell/user-block";
import { getCurrentSession } from "@/lib/auth";

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Real (DB-backed) auth check — the edge proxy only did a cookie sniff.
  const { session, user } = await getCurrentSession();
  if (!session) redirect("/signin");

  return (
    <div className="min-h-dvh">
      {/* sidebar — fixed on the start (right) side */}
      <aside className="fixed inset-y-0 start-0 z-30 hidden w-60 flex-col border-e bg-background md:flex">
        <div className="px-6 pb-6 pt-8">
          <Link href="/tasks" className="font-display text-3xl font-bold">
            المقـــر
          </Link>
        </div>
        <div className="flex-1 overflow-y-auto px-3">
          <SidebarNav group="main" />
        </div>
        <div className="space-y-1 border-t px-3 py-4">
          <SidebarNav group="admin" />
          <UserBlock user={user} />
        </div>
      </aside>

      {/* mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b bg-background/90 px-5 py-3 backdrop-blur md:hidden">
        <Link href="/tasks" className="font-display text-2xl font-bold">
          المقـــر
        </Link>
        <SidebarNavCompact />
      </header>

      {/* content — generous frame away from the walls */}
      <main className="md:ms-60">
        <div className="mx-auto w-full max-w-4xl px-6 py-10 md:px-12 md:py-16">
          {children}
        </div>
      </main>
    </div>
  );
}
