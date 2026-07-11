"use client";

import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

/** البطاقات | الخارطة — the cards view leads; the map is the zoom-out. */
export function PlansViewToggle({ view }: { view: "cards" | "map" }) {
  const router = useRouter();
  return (
    <div className="flex gap-0.5 rounded-full bg-secondary p-[3px]">
      {(
        [
          ["cards", "البطاقات"],
          ["map", "الخارطة"],
        ] as const
      ).map(([v, label]) => (
        <button
          key={v}
          type="button"
          onClick={() => router.replace(v === "map" ? "/plans?view=map" : "/plans", { scroll: false })}
          className={cn(
            "rounded-full border px-4 py-1 text-xs transition-colors",
            view === v
              ? "border-border bg-background font-bold text-foreground shadow-sm"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/** Opens the plan composer (also bound to P globally on this page). */
export function NewPlanButton() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new CustomEvent("hq:plan-composer"))}
      className="flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-[13px] font-bold text-primary-foreground transition-[opacity,transform] hover:opacity-90 active:scale-[0.98]"
    >
      <Plus className="size-4" strokeWidth={2.4} />
      خطة جديدة
      <kbd className="rounded bg-primary-foreground/20 px-1.5 text-[10px]" dir="ltr">
        P
      </kbd>
    </button>
  );
}
