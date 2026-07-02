"use client";

import { Search } from "lucide-react";

/** Opens the command palette (also bound to Ctrl+K globally). */
export function SearchButton({ compact = false }: { compact?: boolean }) {
  const open = () => window.dispatchEvent(new CustomEvent("hq:palette"));

  if (compact) {
    return (
      <button
        type="button"
        aria-label="بحث"
        onClick={open}
        className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <Search className="size-5" strokeWidth={1.75} />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={open}
      className="flex w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    >
      <Search className="size-4" strokeWidth={1.75} />
      بحث…
      <kbd className="ms-auto rounded border px-1.5 py-0.5 text-[10px]" dir="ltr">
        Ctrl K
      </kbd>
    </button>
  );
}
