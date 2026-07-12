"use client";

import { useEffect, useState, useTransition } from "react";
import { KeyRound, Loader2 } from "lucide-react";
import { createDeviceLinkAction } from "@/app/(app)/admin/actions";
import { Button } from "@/components/ui/button";

/**
 * «ربط الجهاز» — mints the one-time code the desktop app asks for
 * (tray menu ← ربط الجهاز). Code lives 5 minutes, works once.
 */
export function LinkDeviceCard() {
  const [link, setLink] = useState<{ code: string; expiresAt: string } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [pending, startTransition] = useTransition();

  const remainingMs = link ? new Date(link.expiresAt).getTime() - now : 0;

  useEffect(() => {
    if (!link) return;
    const expires = new Date(link.expiresAt).getTime();
    const t = setInterval(() => {
      if (Date.now() >= expires) setLink(null);
      else setNow(Date.now());
    }, 1000);
    return () => clearInterval(t);
  }, [link]);

  function generate() {
    startTransition(async () => {
      setLink(await createDeviceLinkAction());
      setNow(Date.now());
    });
  }

  const mm = Math.floor(remainingMs / 60_000);
  const ss = Math.floor((remainingMs % 60_000) / 1000)
    .toString()
    .padStart(2, "0");

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border px-5 py-4">
      <div className="space-y-1">
        <p className="text-sm font-medium">تطبيق سطح المكتب</p>
        <p className="text-xs text-muted-foreground">
          أنشئ رمزًا ثم أدخله في التطبيق (قائمة الأيقونة ← ربط الجهاز). يعمل مرة
          واحدة خلال <span data-numeric>5</span> دقائق.
        </p>
      </div>

      {link ? (
        <div className="flex items-center gap-4">
          <code
            dir="ltr"
            data-numeric
            className="rounded-lg bg-secondary px-4 py-2 text-lg font-bold tracking-[0.2em]"
          >
            {link.code}
          </code>
          <span className="text-xs text-muted-foreground" data-numeric>
            {mm}:{ss}
          </span>
        </div>
      ) : (
        <Button variant="outline" onClick={generate} disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : <KeyRound />}
          إنشاء رمز ربط
        </Button>
      )}
    </div>
  );
}
