import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ListTodo, Pin, Plus, Search } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { createNote } from "./actions";
import { listNotes } from "@/lib/queries/notes";
import { formatRelative } from "@/lib/format";

export const metadata: Metadata = { title: "الملاحظات" };

export default async function NotesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const items = await listNotes(q?.trim() || undefined);

  async function newNote() {
    "use server";
    const note = await createNote({ title: "ملاحظة جديدة" });
    redirect(`/notes/${note.id}`);
  }

  return (
    <>
      <PageHeader
        title="الملاحظـــات"
        description="ملاحظاتك بصيغة ماركداون — مرتبطة بالمهام أو مستقلة."
        actions={
          <form action={newNote}>
            <Button type="submit" className="gap-1.5">
              <Plus className="size-4" />
              ملاحظة جديدة
            </Button>
          </form>
        }
      />

      <div className="space-y-6">
        {/* search */}
        <form className="relative" action="/notes">
          <Search className="absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            name="q"
            defaultValue={q ?? ""}
            placeholder="ابحث في العناوين والمحتوى…"
            className="h-11 w-full rounded-xl border bg-background ps-10 pe-4 text-sm outline-none transition-shadow placeholder:text-muted-foreground focus:shadow-sm"
          />
        </form>

        {items.length === 0 ? (
          <p className="rounded-xl border border-dashed px-6 py-14 text-center text-sm text-muted-foreground">
            {q ? "لا نتائج لهذا البحث." : "لا ملاحظات بعد — أنشئ أولى ملاحظاتك."}
          </p>
        ) : (
          <ul className="divide-y rounded-xl border">
            {items.map((n) => (
              <li key={n.id}>
                <Link
                  href={`/notes/${n.id}`}
                  className="block px-5 py-4 transition-colors hover:bg-accent"
                >
                  <div className="flex items-center gap-2">
                    {n.pinned ? <Pin className="size-3.5 shrink-0 text-muted-foreground" /> : null}
                    <h2 className="truncate text-sm font-medium">{n.title}</h2>
                    {n.taskTitle ? (
                      <span className="flex shrink-0 items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                        <ListTodo className="size-3" />
                        {n.taskTitle}
                      </span>
                    ) : null}
                    <time className="ms-auto shrink-0 text-xs text-muted-foreground" data-numeric>
                      {formatRelative(n.updatedAt)}
                    </time>
                  </div>
                  {n.excerpt.trim() ? (
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground" dir="auto">
                      {n.excerpt}
                    </p>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
