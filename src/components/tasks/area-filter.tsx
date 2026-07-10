"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { areaDotClass } from "@/lib/areas";
import { cn } from "@/lib/utils";
import type { Area } from "@/db/schema";

/** Compact area filter — one dropdown instead of a chips row. */
export function AreaFilter({ areas, current }: { areas: Area[]; current?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  if (areas.length === 0) return null;

  const selected = areas.find((a) => a.id === current) ?? null;

  function pick(areaId: string | null) {
    const p = new URLSearchParams(searchParams);
    if (areaId) p.set("area", areaId);
    else p.delete("area");
    p.delete("task");
    router.push(p.size ? `${pathname}?${p}` : pathname);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 rounded-lg border px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          {selected ? (
            <>
              <span className={cn("size-2 rounded-full", areaDotClass(selected.color))} />
              <b className="text-foreground">{selected.name}</b>
            </>
          ) : (
            <>
              المجال: <b className="text-foreground">الكل</b>
            </>
          )}
          <ChevronDown className="size-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-44">
        <DropdownMenuItem selected={!current} onSelect={() => pick(null)}>
          الكل
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {areas.map((a) => (
          <DropdownMenuItem key={a.id} selected={current === a.id} onSelect={() => pick(a.id)}>
            <span className="flex items-center gap-2">
              <span className={cn("size-2 rounded-full", areaDotClass(a.color))} />
              {a.name}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
