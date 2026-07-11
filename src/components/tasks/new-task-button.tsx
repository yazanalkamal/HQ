"use client";

import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

/** Opens the task composer (also bound to N globally). */
export function NewTaskButton({ className }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new CustomEvent("hq:composer"))}
      className={cn(
        "flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-[13px] font-bold text-primary-foreground transition-[opacity,transform] hover:opacity-90 active:scale-[0.98]",
        className,
      )}
    >
      <Plus className="size-4" strokeWidth={2.4} />
      مهمة جديدة
      <kbd className="rounded bg-primary-foreground/20 px-1.5 text-[10px]" dir="ltr">
        N
      </kbd>
    </button>
  );
}
