"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The task completion circle — the most-touched control in the app,
 * so it gets a dedicated, satisfying treatment.
 */
export function TaskCheck({
  done,
  onToggle,
  className,
}: {
  done: boolean;
  onToggle: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={done}
      aria-label={done ? "إرجاع المهمة" : "إنجاز المهمة"}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className={cn(
        "group/check flex size-5 shrink-0 items-center justify-center rounded-full border-[1.5px] transition-all duration-150",
        done
          ? "border-primary bg-primary"
          : "border-muted-foreground/50 hover:border-primary hover:bg-secondary",
        className,
      )}
    >
      <Check
        className={cn(
          "size-3 text-primary-foreground transition-all duration-150",
          done ? "scale-100 opacity-100" : "scale-50 opacity-0 group-hover/check:opacity-30 group-hover/check:text-muted-foreground",
        )}
        strokeWidth={3}
      />
    </button>
  );
}
