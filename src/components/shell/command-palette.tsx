"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import { CalendarPlus, Lightbulb, ListTodo, Search } from "lucide-react";
import { createTask } from "@/app/(app)/tasks/actions";
import { createIdea } from "@/app/(app)/plans/actions";
import { NAV_ITEMS, ADMIN_ITEM } from "./nav-items";
import { todayISO } from "@/lib/dates";
import { cn } from "@/lib/utils";

type SearchResults = {
  tasks: { id: string; title: string; done: boolean; dueDate: string | null }[];
};

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults>({ tasks: [] });
  const [, startTransition] = useTransition();
  const abortRef = useRef<AbortController | null>(null);

  // global shortcut + programmatic open (sidebar search button)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("hq:palette", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("hq:palette", onOpen);
    };
  }, []);

  // debounced server search
  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (!q) {
      const t = setTimeout(() => setResults({ tasks: [] }), 0);
      return () => clearTimeout(t);
    }
    const t = setTimeout(async () => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, {
          signal: ctrl.signal,
        });
        if (res.ok) setResults(await res.json());
      } catch {
        /* aborted or offline — keep previous results */
      }
    }, 200);
    return () => clearTimeout(t);
  }, [query, open]);

  function go(fn: () => void) {
    setOpen(false);
    setQuery("");
    fn();
  }

  const q = query.trim();

  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      label="بحث وأوامر"
      shouldFilter={false}
      overlayClassName="fixed inset-0 z-40 bg-foreground/20 data-[state=open]:animate-in data-[state=open]:fade-in-0"
      contentClassName="fixed inset-x-4 top-[15vh] z-50 mx-auto max-w-xl overflow-hidden rounded-xl border bg-popover shadow-lg outline-none sm:inset-x-0"
    >
      <div className="flex items-center gap-3 border-b px-4">
        <Search className="size-4 shrink-0 text-muted-foreground" />
        <Command.Input
          value={query}
          onValueChange={setQuery}
          placeholder="ابحث أو نفّذ أمرًا…"
          className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        <kbd className="rounded border px-1.5 py-0.5 text-[10px] text-muted-foreground">Esc</kbd>
      </div>

      <Command.List className="max-h-80 overflow-y-auto p-2">
        <Command.Empty className="px-3 py-6 text-center text-sm text-muted-foreground">
          لا نتائج.
        </Command.Empty>

        {q ? (
          <>
            {results.tasks.length > 0 ? (
              <Group heading="المهام">
                {results.tasks.map((t) => (
                  <Item
                    key={t.id}
                    onSelect={() => go(() => router.push(`/tasks?task=${t.id}`))}
                  >
                    <ListTodo className="size-4 text-muted-foreground" />
                    <span className={cn("truncate", t.done && "text-muted-foreground line-through")}>
                      {t.title}
                    </span>
                  </Item>
                ))}
              </Group>
            ) : null}

            <Group heading="إنشاء">
              <Item
                onSelect={() =>
                  go(() =>
                    startTransition(async () => {
                      await createIdea(q);
                      router.push("/plans");
                    }),
                  )
                }
              >
                <Lightbulb className="size-4 text-muted-foreground" />
                <span className="truncate">
                  فكرة: <b>{q}</b>
                </span>
              </Item>
              <Item
                onSelect={() =>
                  go(() =>
                    startTransition(async () => {
                      await createTask({ title: q, dueDate: todayISO() });
                      router.push("/tasks");
                    }),
                  )
                }
              >
                <CalendarPlus className="size-4 text-muted-foreground" />
                <span className="truncate">
                  مهمة اليوم: <b>{q}</b>
                </span>
              </Item>
            </Group>
          </>
        ) : (
          <Group heading="التنقل">
            {[...NAV_ITEMS, ADMIN_ITEM].map((item) => {
              const Icon = item.icon;
              return (
                <Item key={item.href} onSelect={() => go(() => router.push(item.href))}>
                  <Icon className="size-4 text-muted-foreground" />
                  {item.label}
                </Item>
              );
            })}
          </Group>
        )}
      </Command.List>
    </Command.Dialog>
  );
}

function Group({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <Command.Group
      heading={heading}
      className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:text-muted-foreground"
    >
      {children}
    </Command.Group>
  );
}

function Item({
  children,
  onSelect,
}: {
  children: React.ReactNode;
  onSelect: () => void;
}) {
  return (
    <Command.Item
      onSelect={onSelect}
      className="flex cursor-default select-none items-center gap-2.5 rounded-lg px-3 py-2 text-sm data-[selected=true]:bg-accent"
    >
      {children}
    </Command.Item>
  );
}
