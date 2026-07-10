import Link from "next/link";
import { redirect } from "next/navigation";
import { CommandPalette } from "@/components/shell/command-palette";
import { SearchButton } from "@/components/shell/search-button";
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
      <aside className="fixed inset-y-0 start-0 z-30 hidden w-72 flex-col border-e bg-background md:flex">
        <div className="px-9 pb-8 pt-12">
          <Link href="/today" className="font-display tarsil text-3xl font-bold">
            المقـــر
          </Link>
        </div>
        <div className="px-6 pb-4">
          <SearchButton />
        </div>
        <div className="flex-1 overflow-y-auto px-6">
          <SidebarNav group="main" />
        </div>
        <div className="space-y-2 border-t px-6 py-6">
          <SidebarNav group="admin" />
          <UserBlock user={user} />
        </div>
      </aside>

      {/* mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b bg-background/90 px-5 py-3 backdrop-blur md:hidden">
        <Link href="/today" className="font-display tarsil text-2xl font-bold">
          المقـــر
        </Link>
        <div className="flex items-center gap-1">
          <SearchButton compact />
          <SidebarNavCompact />
        </div>
      </header>

      {/* content — centered in the space beside the sidebar, wide and airy */}
      <main className="md:ms-72">
        <div className="mx-auto w-full max-w-6xl px-6 py-12 md:px-14 md:py-20">
          {children}
        </div>
      </main>

      <CommandPalette />
    </div>
  );
}
