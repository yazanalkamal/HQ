"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV_ITEMS, ADMIN_ITEM } from "./nav-items";

export function SidebarNavCompact() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-1">
      {[...NAV_ITEMS, ADMIN_ITEM].map((item) => {
        const active =
          pathname === item.href || pathname.startsWith(item.href + "/");
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-label={item.label}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-lg p-2 transition-colors",
              active
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            <Icon className="size-5" strokeWidth={1.75} />
          </Link>
        );
      })}
    </nav>
  );
}
