"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { CalendarDays, Flag, Loader2, Plus } from "lucide-react";
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
import { planHex } from "@/lib/timeline";
import { cn } from "@/lib/utils";
import type { Area } from "@/db/schema";

const PRIORITIES = ["عادية", "مهمة", "عاجلة"] as const;
const ISO = /^\d{4}-\d{2}-\d{2}$/;

export type ComposerPlan = { id: string; title: string; color: string };

/**
 * The focused composer — THE single way to add a task, mounted once in the
 * app layout (like the command palette). Opens via the `hq:composer` window
 * event (the «مهمة جديدة» buttons) or the N key anywhere; every option is
 * always visible; Enter adds and keeps it open for chained capture.
 * Default due date follows the board you're looking at.
 */
export function TaskComposer({ areas, plans }: { areas: Area[]; plans: ComposerPlan[] }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const inputRef = useRef<HTMLInputElement>(null);
  const dateRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [priority, setPriority] = useState(0);
  const [areaId, setAreaId] = useState<string | null>(null);
  const [planId, setPlanId] = useState<string | null>(null);
  const [added, setAdded] = useState(0);
  const [pending, startTransition] = useTransition();

  const today = todayISO();
  const tomorrow = addDaysISO(today, 1);

  // the board you're looking at decides the default due date
  const boardDate = useCallback((): string | null => {
    if (pathname === "/tasks") {
      if (searchParams.get("view") === "undated") return null;
      const d = searchParams.get("d");
      return d && ISO.test(d) ? d : todayISO();
    }
    return todayISO();
  }, [pathname, searchParams]);

  const openComposer = useCallback(() => {
    setTitle("");
    setDueDate(boardDate());
    setPriority(0);
    setAreaId(null);
    setPlanId(null);
    setAdded(0);
    setOpen(true);
  }, [boardDate]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "KeyN" || e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return;
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      // a Radix modal (task panel, palette) is up — it owns the keyboard
      if (document.body.style.pointerEvents === "none") return;
      e.preventDefault();
      openComposer();
    };
    const onEvent = () => openComposer();
    window.addEventListener("keydown", onKey);
    window.addEventListener("hq:composer", onEvent);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("hq:composer", onEvent);
    };
  }, [openComposer]);

  function submit() {
    const t = title.trim();
    if (!t || pending) return;
    startTransition(async () => {
      await createTask({ title: t, dueDate, priority, areaId, planId });
      setTitle("");
      setAdded((n) => n + 1);
      inputRef.current?.focus();
    });
  }

  if (!open) return null;

  const selectedArea = areas.find((a) => a.id === areaId) ?? null;
  const selectedPlan = plans.find((p) => p.id === planId) ?? null;
  const customDate = !!dueDate && dueDate !== today && dueDate !== tomorrow;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[15vh]">
      {/* backdrop */}
      <div
        className="absolute inset-0 bg-foreground/25 backdrop-blur-[2px] animate-in fade-in-0"
        onClick={() => setOpen(false)}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="مهمة جديدة"
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
        }}
        className="relative w-full max-w-xl overflow-hidden rounded-2xl border bg-popover shadow-lg animate-in fade-in-0 zoom-in-95 slide-in-from-top-2 duration-150"
      >
        {/* title */}
        <div className="flex items-center gap-3.5 px-5">
          {pending ? (
            <Loader2 className="size-[18px] shrink-0 animate-spin text-muted-foreground" />
          ) : (
            <Plus className="size-[18px] shrink-0 text-muted-foreground" />
          )}
          <input
            ref={inputRef}
            autoFocus
            dir="auto"
            maxLength={500}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing) submit();
            }}
            placeholder="ماذا تريد أن تنجز؟"
            className="h-14 w-full bg-transparent text-lg outline-none placeholder:text-muted-foreground"
          />
          <span className="shrink-0 text-xs text-muted-foreground" data-numeric>
            → {dueDate === null ? "بدون تاريخ" : dueLabel(dueDate, today)}
          </span>
        </div>

        {/* options — all of them, always visible */}
        <div className="flex flex-wrap items-center gap-2.5 border-t px-4 py-3">
          <div className="flex gap-0.5 rounded-full bg-secondary p-[3px]">
            <SegBtn active={dueDate === today} onClick={() => setDueDate(today)}>
              اليوم
            </SegBtn>
            <SegBtn active={dueDate === tomorrow} onClick={() => setDueDate(tomorrow)}>
              غدًا
            </SegBtn>
            <SegBtn active={customDate} onClick={() => dateRef.current?.showPicker()}>
              <CalendarDays className="size-3" />
              {customDate ? dueLabel(dueDate!, today) : "تاريخ آخر"}
            </SegBtn>
            <SegBtn active={dueDate === null} onClick={() => setDueDate(null)}>
              بدون تاريخ
            </SegBtn>
          </div>
          <input
            ref={dateRef}
            type="date"
            className="sr-only"
            tabIndex={-1}
            value={dueDate ?? ""}
            onChange={(e) => setDueDate(e.target.value || null)}
          />

          <span className="h-[18px] w-px bg-border" />

          <Chip
            active={priority > 0}
            className={cn(priority === 2 && "text-destructive")}
            onClick={() => setPriority((priority + 1) % 3)}
          >
            <Flag className="size-3" />
            {PRIORITIES[priority]}
          </Chip>

          {areas.length > 0 ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Chip active={!!selectedArea}>
                  <span
                    className={cn(
                      "size-2 rounded-full",
                      selectedArea ? areaDotClass(selectedArea.color) : "bg-border",
                    )}
                  />
                  {selectedArea ? selectedArea.name : "المجال"}
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

          {plans.length > 0 ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Chip active={!!selectedPlan}>
                  <span
                    className="inline-block size-2 rotate-45 rounded-[1.5px]"
                    style={{ background: selectedPlan ? planHex(selectedPlan.color) : "var(--border)" }}
                  />
                  {selectedPlan ? selectedPlan.title : "الخطة"}
                </Chip>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {plans.map((p) => (
                  <DropdownMenuItem key={p.id} selected={planId === p.id} onSelect={() => setPlanId(p.id)}>
                    <span className="flex items-center gap-2">
                      <span
                        className="inline-block size-2 rotate-45 rounded-[1.5px]"
                        style={{ background: planHex(p.color) }}
                      />
                      {p.title}
                    </span>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => setPlanId(null)}>بدون خطة</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>

        {/* footer */}
        <div className="flex items-center justify-between gap-3 border-t bg-muted/40 px-4 py-2 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Kbd>Enter</Kbd> إضافة وتابع
            <span className="mx-1 text-border">·</span>
            <Kbd>Esc</Kbd> إغلاق
          </span>
          {added > 0 ? (
            <span key={added} className="font-bold text-foreground animate-in fade-in-0 zoom-in-90" data-numeric>
              ✓ أُضيفت {added}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function SegBtn({
  active,
  children,
  ...props
}: React.ComponentProps<"button"> & { active?: boolean }) {
  return (
    <button
      type="button"
      className={cn(
        "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors",
        active
          ? "border-border bg-background font-bold text-foreground shadow-sm"
          : "border-transparent text-muted-foreground hover:text-foreground",
      )}
      {...props}
    >
      {children}
    </button>
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
        "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors",
        active
          ? "border-foreground/30 bg-secondary text-foreground"
          : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border bg-background px-1.5 py-0.5 text-[10px] font-bold" dir="ltr">
      {children}
    </kbd>
  );
}
