"use client";

import { Dialog as SheetPrimitive } from "radix-ui";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const Sheet = SheetPrimitive.Root;
const SheetTrigger = SheetPrimitive.Trigger;
const SheetClose = SheetPrimitive.Close;

function SheetContent({
  className,
  children,
  title,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content> & { title: string }) {
  return (
    <SheetPrimitive.Portal>
      <SheetPrimitive.Overlay className="fixed inset-0 z-40 bg-foreground/20 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
      <SheetPrimitive.Content
        className={cn(
          // slides in from the inline-end (left in RTL) — opposite the sidebar
          "fixed inset-y-0 end-0 z-50 flex w-full max-w-lg flex-col border-s bg-background shadow-lg outline-none",
          "data-[state=open]:animate-in data-[state=open]:slide-in-from-left data-[state=closed]:animate-out data-[state=closed]:slide-out-to-left",
          className,
        )}
        {...props}
      >
        <div className="flex items-center justify-between border-b px-6 py-4">
          <SheetPrimitive.Title className="text-base font-bold">
            {title}
          </SheetPrimitive.Title>
          <SheetPrimitive.Close className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
            <X className="size-4" />
            <span className="sr-only">إغلاق</span>
          </SheetPrimitive.Close>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
      </SheetPrimitive.Content>
    </SheetPrimitive.Portal>
  );
}

export { Sheet, SheetTrigger, SheetClose, SheetContent };
