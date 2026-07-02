"use client";

import { useRef, useState, useTransition } from "react";
import { CalendarDays, Flag, Plus, Loader2 } from "lucide-react";
import { createTask } from "@/app/(app)/tasks/actions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { areaDotClass } from "@/lib/areas";
import { addDaysISO, dueLabel, todayISO } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { Area } from "@/db/schema";

const PRIORITIES = ["عادية", "مهمة", "عاجلة"] as const;

/**
 * The zero-friction capture bar: type, Enter, done — the input keeps
 * focus so a brain-dump of ten tasks is ten Enters.
 */
export function QuickAdd({ areas, defaultDate }: { areas: Area[]; defaultDate?: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const dateRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState<string | null>(defaultDate ?? null);
  const [priority, setPriority] = useState(0);
  const [areaId, setAreaId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const today = todayISO();

  function submit() {
    const t = title.trim();
    if (!t || pending) return;
    startTransition(async () => {
      await createTask({ title: t, dueDate, priority, areaId });
      setTitle("");
      inputRef.current?.focus();
    });
  }

  const selectedArea = areas.find((a) => a.id === areaId) ?? null;

  return (
    <div className="rounded-xl border transition-shadow focus-within:shadow-sm">
      <div className="flex items-center gap-3 px-4">
        {pending ? (
          <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
        ) : (
          <Plus className="size-4 shrink-0 text-muted-foreground" />
        )}
        <input
          ref={inputRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing) submit();
          }}
          placeholder="أضف مهمة… ثم Enter"
          className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>

      <div className="flex flex-wrap items-center gap-1.5 border-t px-3 py-2">
        {/* date chips */}
        <Chip active={dueDate === today} onClick={() => setDueDate(dueDate === today ? null : today)}>
          اليوم
        </Chip>
        <Chip
          active={dueDate === addDaysISO(today, 1)}
          onClick={() =>
            setDueDate(dueDate === addDaysISO(today, 1) ? null : addDaysISO(today, 1))
          }
        >
          غدًا
        </Chip>
        <Chip
          active={!!dueDate && dueDate !== today && dueDate !== addDaysISO(today, 1)}
          onClick={() => dateRef.current?.showPicker()}
        >
          <CalendarDays className="size-3" />
          {dueDate && dueDate !== today && dueDate !== addDaysISO(today, 1)
            ? dueLabel(dueDate, today)
            : "تاريخ"}
        </Chip>
        <input
          ref={dateRef}
          type="date"
          className="sr-only"
          tabIndex={-1}
          value={dueDate ?? ""}
          onChange={(e) => setDueDate(e.target.value || null)}
        />

        <span className="mx-1 h-4 w-px bg-border" />

        {/* priority cycle */}
        <Chip
          active={priority > 0}
          className={cn(priority === 2 && "text-destructive")}
          onClick={() => setPriority((priority + 1) % 3)}
        >
          <Flag className="size-3" />
          {PRIORITIES[priority]}
        </Chip>

        {/* area */}
        {areas.length > 0 ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Chip active={!!selectedArea}>
                {selectedArea ? (
                  <>
                    <span className={cn("size-2 rounded-full", areaDotClass(selectedArea.color))} />
                    {selectedArea.name}
                  </>
                ) : (
                  "المجال"
                )}
              </Chip>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {areas.map((a) => (
                <DropdownMenuItem key={a.id} selected={areaId === a.id} onSelect={() => setAreaId(a.id)}>
                  <span className="flex items-center gap-2">
                    <span className={cn("size-2 rounded-full", areaDotClass(a.color))} />
                    {a.name}
                  </span>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setAreaId(null)}>بدون مجال</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
    </div>
  );
}

function Chip({
  active,
  className,
  children,
  ...props
}: React.ComponentProps<"button"> & { active?: boolean }) {
  return (
    <button
      type="button"
      className={cn(
        "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors",
        active
          ? "border-foreground/30 bg-secondary text-foreground"
          : "border-transparent text-muted-foreground hover:bg-accent hover:text-foreground",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
