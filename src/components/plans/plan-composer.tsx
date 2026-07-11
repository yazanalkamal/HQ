"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Loader2, Plus } from "lucide-react";
import { createPlan } from "@/app/(app)/plans/actions";
import { todayISO } from "@/lib/dates";
import { addMonthsISO } from "@/lib/finance";
import { PLAN_COLORS, type PlanColor } from "@/lib/timeline";
import { cn } from "@/lib/utils";

export type ComposerIdea = { id: string; text: string };

const MONTHS = [
  [1, "شهر"],
  [2, "شهران"],
  [3, "3 أشهر"],
  [6, "6 أشهر"],
] as const;

/**
 * The plan composer — «خطة جديدة» + the P key, same focused-overlay
 * language as the task composer's N. Opens prefilled when a captured
 * idea is promoted (فكرة → خطة). Creates and closes; the new card
 * expands so detailing continues in place.
 */
export function PlanComposer({
  usedColors,
  onCreated,
}: {
  usedColors: string[];
  onCreated: (id: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [fromIdea, setFromIdea] = useState<ComposerIdea | null>(null);
  const [title, setTitle] = useState("");
  const [firstStep, setFirstStep] = useState("");
  const [kind, setKind] = useState<"project" | "routine">("project");
  const [months, setMonths] = useState(2);
  const [cadence, setCadence] = useState(3);
  const [color, setColor] = useState<PlanColor | null>(null); // null = least-used
  const [pending, startTransition] = useTransition();

  const openComposer = useCallback((idea?: ComposerIdea) => {
    setTitle(idea?.text ?? "");
    setFromIdea(idea ?? null);
    setFirstStep("");
    setKind("project");
    setMonths(2);
    setCadence(3);
    setColor(null);
    setOpen(true);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "KeyP" || e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return;
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      if (document.body.style.pointerEvents === "none") return; // a Radix modal is up
      e.preventDefault();
      openComposer();
    };
    const onEvent = (e: Event) => openComposer((e as CustomEvent<{ idea?: ComposerIdea }>).detail?.idea);
    window.addEventListener("keydown", onKey);
    window.addEventListener("hq:plan-composer", onEvent);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("hq:plan-composer", onEvent);
    };
  }, [openComposer]);

  function leastUsedColor(): PlanColor {
    const keys = Object.keys(PLAN_COLORS) as PlanColor[];
    const counts = keys.map((k) => usedColors.filter((c) => c === k).length);
    return keys[counts.indexOf(Math.min(...counts))];
  }

  function submit() {
    const t = title.trim();
    if (!t || pending) return;
    const today = todayISO();
    startTransition(async () => {
      const id = await createPlan({
        title: t,
        kind,
        startDate: today,
        endDate: addMonthsISO(today, months),
        color: color ?? leastUsedColor(),
        nextStep: kind === "project" ? firstStep.trim() : "",
        cadence,
        fromIdeaId: fromIdea?.id,
      });
      setOpen(false);
      onCreated(id);
    });
  }

  if (!open) return null;

  const chosen = color ?? leastUsedColor();

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[15vh]">
      <div
        className="absolute inset-0 bg-foreground/25 backdrop-blur-[2px] animate-in fade-in-0"
        onClick={() => setOpen(false)}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="خطة جديدة"
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
        }}
        className="relative w-full max-w-xl overflow-hidden rounded-2xl border bg-popover shadow-lg animate-in fade-in-0 zoom-in-95 slide-in-from-top-2 duration-150"
      >
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
            maxLength={300}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing) submit();
            }}
            placeholder={kind === "project" ? "ما المشروع؟" : "ما الروتين؟"}
            className="h-14 w-full bg-transparent text-lg outline-none placeholder:text-muted-foreground"
          />
          {fromIdea ? (
            <span className="shrink-0 text-xs text-muted-foreground">من فكرة 💡</span>
          ) : null}
        </div>

        {kind === "project" ? (
          <div className="flex items-center gap-3.5 border-t px-5">
            <span className="size-[18px] shrink-0" />
            <input
              dir="auto"
              maxLength={500}
              value={firstStep}
              onChange={(e) => setFirstStep(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.nativeEvent.isComposing) submit();
              }}
              placeholder="الخطوة الأولى — صغيرة وواضحة (اختياري)"
              className="h-11 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2.5 border-t px-4 py-3">
          <div className="flex gap-0.5 rounded-full bg-secondary p-[3px]">
            <SegBtn active={kind === "project"} onClick={() => setKind("project")}>
              مشروع
            </SegBtn>
            <SegBtn active={kind === "routine"} onClick={() => setKind("routine")}>
              روتين
            </SegBtn>
          </div>

          <span className="h-[18px] w-px bg-border" />

          <div className="flex gap-0.5 rounded-full bg-secondary p-[3px]">
            {MONTHS.map(([m, label]) => (
              <SegBtn key={m} active={months === m} onClick={() => setMonths(m)}>
                <span data-numeric>{label}</span>
              </SegBtn>
            ))}
          </div>

          {kind === "routine" ? (
            <>
              <span className="h-[18px] w-px bg-border" />
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setCadence(n)}
                    className={cn(
                      "size-7 rounded-md border text-xs transition-colors",
                      cadence === n
                        ? "border-foreground bg-secondary font-bold"
                        : "border-transparent text-muted-foreground hover:bg-accent",
                    )}
                    data-numeric
                  >
                    {n}
                  </button>
                ))}
                <span className="ms-1 text-xs text-muted-foreground">× أسبوعيًا</span>
              </div>
            </>
          ) : null}

          <span className="ms-auto flex items-center gap-1.5">
            {(Object.keys(PLAN_COLORS) as PlanColor[]).map((c) => (
              <button
                key={c}
                type="button"
                aria-label={PLAN_COLORS[c].label}
                onClick={() => setColor(c)}
                className={cn(
                  "flex size-6 items-center justify-center rounded-full border transition-transform hover:scale-110",
                  chosen === c ? "border-foreground" : "border-transparent",
                )}
              >
                <span className="size-3.5 rounded-full" style={{ background: PLAN_COLORS[c].hex }} />
              </button>
            ))}
          </span>
        </div>

        <div className="flex items-center justify-between gap-3 border-t bg-muted/40 px-4 py-2 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Kbd>Enter</Kbd> إنشاء — تبدأ اليوم وتتفصّل من بطاقتها
            <span className="mx-1 text-border">·</span>
            <Kbd>Esc</Kbd> إغلاق
          </span>
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

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border bg-background px-1.5 py-0.5 text-[10px] font-bold" dir="ltr">
      {children}
    </kbd>
  );
}
