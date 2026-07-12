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

declare global {
  interface Window {
    /** present only inside the desktop shell's webview (Tauri) */
    __TAURI__?: { core: { invoke: (cmd: string) => Promise<unknown> } };
  }
}

export type ComposerPlan = { id: string; title: string; color: string };

/**
 * The focused composer — THE single way to add a task, mounted once in the
 * app layout (like the command palette). Opens via the `hq:composer` window
 * event (the «مهمة جديدة» buttons) or the N key anywhere; every option is
 * always visible; Enter adds and keeps it open for chained capture.
 * Default due date follows the board you're looking at.
 *
 * variant="capture" is the desktop quick-add window (/capture): always
 * open, transparent backdrop, and "closing" hides the native window via
 * the shell's `hide_capture` command — fields reset when it next shows.
 */
export function TaskComposer({
  areas,
  plans,
  variant = "overlay",
}: {
  areas: Area[];
  plans: ComposerPlan[];
  variant?: "overlay" | "capture";
}) {
  const capture = variant === "capture";
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const inputRef = useRef<HTMLInputElement>(null);
  const dateRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(capture);
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [priority, setPriority] = useState(0);
  const [areaId, setAreaId] = useState<string | null>(null);
  const [planId, setPlanId] = useState<string | null>(null);
  const [areaOpen, setAreaOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
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
    setAreaOpen(false);
    setPlanOpen(false);
    setAdded(0);
    setOpen(true);
  }, [boardDate]);

  // closing: overlay dismisses itself; capture hides the native window —
  // fields reset on the next show, so a half-typed task never lingers
  const close = useCallback(() => {
    if (!capture) {
      setOpen(false);
      return;
    }
    void window.__TAURI__?.core.invoke("hide_capture");
  }, [capture]);

  useEffect(() => {
    if (capture) return; // capture wiring below — no N key, no window event
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
  }, [capture, openComposer]);

  // capture: reset + refocus every time the shell shows the window
  // (the webview stays alive while hidden, so mount alone isn't enough).
  // Through a ref on purpose: openComposer's identity changes on every
  // revalidation, and re-running this effect then would wipe the
  // «أُضيفت» count right after an add.
  const openComposerRef = useRef(openComposer);
  useEffect(() => {
    openComposerRef.current = openComposer;
  }, [openComposer]);
  useEffect(() => {
    if (!capture) return;
    openComposerRef.current();
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      openComposerRef.current();
      requestAnimationFrame(() => inputRef.current?.focus());
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [capture]);

  // chord-opened menus need focus moved into them — opening via the
  // controlled prop (unlike via the trigger) leaves focus in the input,
  // and arrows/Enter would never reach the menu
  function toggleMenu(isOpen: boolean, setOpen: (v: boolean) => void) {
    if (isOpen) {
      setOpen(false);
      return;
    }
    setOpen(true);
    setTimeout(() => {
      document.querySelector<HTMLElement>("[role=menu]")?.focus();
    }, 50);
  }

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
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-start justify-center",
        capture ? "px-2 pt-2" : "px-4 pt-[15vh]",
      )}
    >
      {/* backdrop — in capture it's invisible (the native window is glass)
          but still catches clicks so tapping empty space hides the bar */}
      <div
        className={cn(
          "absolute inset-0",
          !capture && "bg-foreground/25 backdrop-blur-[2px] animate-in fade-in-0",
        )}
        onClick={close}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="مهمة جديدة"
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            // an open dropdown owns this Esc — it closes itself via Radix
            if (areaOpen || planOpen || e.defaultPrevented) return;
            close();
            return;
          }
          // keyboard-first controls: Ctrl + the key badged on each button.
          // e.code = physical key, so it works on Arabic layout too.
          if (!e.ctrlKey || e.metaKey || e.altKey) return;
          const action: Record<string, () => void> = {
            // numbered in the buttons' visual order
            Digit1: () => setDueDate(today),
            Digit2: () => setDueDate(tomorrow),
            Digit3: () => dateRef.current?.showPicker(),
            Digit4: () => setDueDate(null),
            KeyP: () => setPriority((p) => (p + 1) % 3),
            KeyM: () => {
              if (areas.length > 0) toggleMenu(areaOpen, setAreaOpen);
            },
            // stays ahead of the Ctrl+K palette — stopPropagation below
            KeyK: () => {
              if (plans.length > 0) toggleMenu(planOpen, setPlanOpen);
            },
          };
          const run = action[e.code];
          if (run) {
            e.preventDefault();
            e.stopPropagation();
            run();
          }
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
            <SegBtn active={dueDate === today} hint="1" onClick={() => setDueDate(today)}>
              اليوم
            </SegBtn>
            <SegBtn active={dueDate === tomorrow} hint="2" onClick={() => setDueDate(tomorrow)}>
              غدًا
            </SegBtn>
            <SegBtn active={customDate} hint="3" onClick={() => dateRef.current?.showPicker()}>
              <CalendarDays className="size-3" />
              {customDate ? dueLabel(dueDate!, today) : "تاريخ آخر"}
            </SegBtn>
            <SegBtn active={dueDate === null} hint="4" onClick={() => setDueDate(null)}>
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
            hint="P"
            className={cn(priority === 2 && "text-destructive")}
            onClick={() => setPriority((p) => (p + 1) % 3)}
          >
            <Flag className="size-3" />
            {PRIORITIES[priority]}
          </Chip>

          {areas.length > 0 ? (
            <DropdownMenu open={areaOpen} onOpenChange={setAreaOpen}>
              <DropdownMenuTrigger asChild>
                <Chip active={!!selectedArea} hint="M">
                  <span
                    className={cn(
                      "size-2 rounded-full",
                      selectedArea ? areaDotClass(selectedArea.color) : "bg-border",
                    )}
                  />
                  {selectedArea ? selectedArea.name : "المجال"}
                </Chip>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                onCloseAutoFocus={(e) => {
                  e.preventDefault();
                  inputRef.current?.focus();
                }}
              >
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
            <DropdownMenu open={planOpen} onOpenChange={setPlanOpen}>
              <DropdownMenuTrigger asChild>
                <Chip active={!!selectedPlan} hint="K">
                  <span
                    className="inline-block size-2 rotate-45 rounded-[1.5px]"
                    style={{ background: selectedPlan ? planHex(selectedPlan.color) : "var(--border)" }}
                  />
                  {selectedPlan ? selectedPlan.title : "الخطة"}
                </Chip>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                onCloseAutoFocus={(e) => {
                  e.preventDefault();
                  inputRef.current?.focus();
                }}
              >
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
            <Kbd>Esc</Kbd> {capture ? "إخفاء" : "إغلاق"}
            <span className="mx-1 text-border">·</span>
            <Kbd>Ctrl</Kbd>+<span>المفتاح المرسوم على الزر</span>
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

/** The Ctrl-chord key, drawn small on the control itself — the UI teaches. */
function KeyHint({ label }: { label: string }) {
  return (
    <span
      dir="ltr"
      data-numeric
      className="rounded border border-current/25 px-[3px] text-[9px] leading-[13px] opacity-60"
    >
      {label}
    </span>
  );
}

function SegBtn({
  active,
  hint,
  children,
  ...props
}: React.ComponentProps<"button"> & { active?: boolean; hint?: string }) {
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
      {hint ? <KeyHint label={hint} /> : null}
    </button>
  );
}

function Chip({
  active,
  hint,
  className,
  children,
  ...props
}: React.ComponentProps<"button"> & { active?: boolean; hint?: string }) {
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
      {hint ? <KeyHint label={hint} /> : null}
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
