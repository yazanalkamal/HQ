"use client";

import { useRef, useState, useTransition } from "react";
import { Loader2, Plus } from "lucide-react";
import { createTask } from "@/app/(app)/tasks/actions";
import { cn } from "@/lib/utils";

/**
 * The bottom-of-list add row: your eye ends at the bottom of the list,
 * so adding lives there too. Click → inline input; Enter chains adds;
 * Escape closes.
 */
export function AddTaskRow({ defaultDate }: { defaultDate: string | null }) {
  const [active, setActive] = useState(false);
  const [title, setTitle] = useState("");
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function submit() {
    const t = title.trim();
    if (!t || pending) return;
    startTransition(async () => {
      await createTask({ title: t, dueDate: defaultDate });
      setTitle("");
      inputRef.current?.focus();
    });
  }

  if (!active) {
    return (
      <button
        type="button"
        onClick={() => setActive(true)}
        className="flex w-full items-center gap-3.5 rounded-xl border border-dashed px-4 py-3.5 text-sm text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
      >
        <Plus className="size-[18px]" />
        أضف مهمة
      </button>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center gap-3.5 rounded-xl border px-4 py-2 transition-shadow focus-within:border-foreground/30 focus-within:shadow-sm",
      )}
    >
      {pending ? (
        <Loader2 className="size-[18px] shrink-0 animate-spin text-muted-foreground" />
      ) : (
        <Plus className="size-[18px] shrink-0 text-muted-foreground" />
      )}
      <input
        ref={inputRef}
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.nativeEvent.isComposing) submit();
          if (e.key === "Escape") {
            setTitle("");
            setActive(false);
          }
        }}
        onBlur={() => {
          if (!title.trim()) setActive(false);
        }}
        placeholder="اكتب واضغط Enter — تُضاف لنفس اليوم"
        className="h-9 w-full bg-transparent text-[15px] outline-none placeholder:text-sm placeholder:text-muted-foreground"
      />
    </div>
  );
}
