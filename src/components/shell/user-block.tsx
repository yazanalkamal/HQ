/* eslint-disable @next/next/no-img-element */
import { LogOut } from "lucide-react";
import type { User } from "@/db/schema";
import { signOutAction } from "@/lib/auth/actions";

export function UserBlock({ user }: { user: User }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2">
      {user.picture ? (
        <img
          src={user.picture}
          alt=""
          className="size-8 shrink-0 rounded-full border"
          referrerPolicy="no-referrer"
        />
      ) : (
        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-medium">
          {user.name.slice(0, 1) || "؟"}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{user.name || user.email}</p>
        <p className="truncate text-xs text-muted-foreground" dir="ltr">
          {user.email}
        </p>
      </div>
      <form action={signOutAction}>
        <button
          type="submit"
          title="تسجيل الخروج"
          className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <LogOut className="size-4" strokeWidth={1.75} />
        </button>
      </form>
    </div>
  );
}
