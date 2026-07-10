"use client";

import { useState, useTransition } from "react";
import { CalendarClock, Pause, Play, Plus, Trash2 } from "lucide-react";
import {
  createSubscription,
  deleteSubscription,
  updateSubscription,
} from "@/app/(app)/finance/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { RIYAL, formatSAR } from "@/lib/currency";
import { daysUntil, dueLabel, todayISO } from "@/lib/dates";
import { CATEGORIES, monthlyEquivalent, type Cycle } from "@/lib/finance";
import { cn } from "@/lib/utils";
import type { Sub } from "@/lib/queries/finance";

export function SubscriptionsSection({ subs }: { subs: Sub[] }) {
  const [editing, setEditing] = useState<Sub | "new" | null>(null);
  const today = todayISO();

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold">
          الاشتراكات
          {subs.length > 0 ? (
            <span className="ms-1.5 font-normal text-muted-foreground" data-numeric>
              ({subs.length})
            </span>
          ) : null}
        </h2>
        <Button size="sm" className="gap-1.5" onClick={() => setEditing("new")}>
          <Plus className="size-3.5" />
          اشتراك جديد
        </Button>
      </div>

      {subs.length === 0 ? (
        <p className="rounded-xl border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">
          لا اشتراكات بعد — أضف أول اشتراك (نتفلكس، Spotify، ChatGPT…).
        </p>
      ) : (
        <ul className="divide-y rounded-xl border">
          {subs.map((s) => {
            const days = daysUntil(s.effectiveRenewal, today);
            const soon = s.active && days <= 7;
            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => setEditing(s)}
                  className={cn(
                    "flex w-full items-center gap-4 px-5 py-3.5 text-start transition-colors hover:bg-accent",
                    !s.active && "opacity-50",
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 text-sm font-medium">
                      {s.name}
                      {s.category ? (
                        <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-normal text-muted-foreground">
                          {s.category}
                        </span>
                      ) : null}
                      {!s.active ? (
                        <span className="rounded-full border px-2 py-0.5 text-xs font-normal text-muted-foreground">
                          موقوف
                        </span>
                      ) : null}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground" data-numeric>
                      <CalendarClock className="size-3" />
                      {s.active ? (
                        <>
                          يتجدد {dueLabel(s.effectiveRenewal, today)}
                          {soon ? (
                            <span className="font-medium text-destructive">
                              {days === 0 ? "· اليوم!" : days === 1 ? "· غدًا!" : `· خلال ${days} أيام`}
                            </span>
                          ) : null}
                        </>
                      ) : (
                        "لن يتجدد"
                      )}
                    </p>
                  </div>
                  <div className="text-end" data-numeric>
                    <p className="text-sm font-medium">
                      {formatSAR(s.amount)}
                      <span className="text-xs font-normal text-muted-foreground">
                        {s.cycle === "monthly" ? " / شهر" : " / سنة"}
                      </span>
                    </p>
                    {s.cycle === "yearly" ? (
                      <p className="text-xs text-muted-foreground">
                        ≈ {formatSAR(Math.round(monthlyEquivalent(s.amount, s.cycle)))} شهريًا
                      </p>
                    ) : null}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {editing ? (
        <SubSheet sub={editing === "new" ? null : editing} onClose={() => setEditing(null)} />
      ) : null}
    </section>
  );
}

function SubSheet({ sub, onClose }: { sub: Sub | null; onClose: () => void }) {
  const [, startTransition] = useTransition();
  const [name, setName] = useState(sub?.name ?? "");
  const [amount, setAmount] = useState(sub ? String(sub.amount) : "");
  const [cycle, setCycle] = useState<Cycle>(sub?.cycle ?? "monthly");
  const [renewal, setRenewal] = useState(sub?.effectiveRenewal ?? todayISO());
  const [category, setCategory] = useState(sub?.category ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState("");

  const valid = name.trim() && Number(amount) > 0 && renewal;

  function save() {
    if (!valid) {
      setError("أكمل الاسم والمبلغ والتاريخ");
      return;
    }
    startTransition(async () => {
      try {
        const data = {
          name: name.trim(),
          amount: Number(amount),
          cycle,
          nextRenewal: renewal,
          category,
        };
        if (sub) await updateSubscription({ id: sub.id, ...data });
        else await createSubscription(data);
        onClose();
      } catch {
        setError("تعذّر الحفظ — تأكد من القيم");
      }
    });
  }

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent title={sub ? "تعديل الاشتراك" : "اشتراك جديد"}>
        <div className="space-y-5">
          <label className="block space-y-1.5">
            <span className="text-xs text-muted-foreground">الاسم</span>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Netflix" autoFocus />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1.5">
              <span className="text-xs text-muted-foreground">المبلغ ({RIYAL})</span>
              <Input
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
                placeholder="29"
                data-numeric
              />
            </label>
            <div className="space-y-1.5">
              <span className="text-xs text-muted-foreground">الدورة</span>
              <div className="flex items-center rounded-lg border p-0.5">
                {(["monthly", "yearly"] as const).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCycle(c)}
                    className={cn(
                      "flex-1 rounded-md px-2 py-1.5 text-xs transition-colors",
                      cycle === c ? "bg-secondary font-medium" : "text-muted-foreground",
                    )}
                  >
                    {c === "monthly" ? "شهري" : "سنوي"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <label className="block space-y-1.5">
            <span className="text-xs text-muted-foreground">التجديد القادم</span>
            <Input type="date" value={renewal} onChange={(e) => setRenewal(e.target.value)} data-numeric />
          </label>

          <div className="space-y-1.5">
            <span className="text-xs text-muted-foreground">التصنيف</span>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(category === c ? "" : c)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs transition-colors",
                    category === c
                      ? "border-foreground/30 bg-secondary"
                      : "border-transparent text-muted-foreground hover:bg-accent",
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {error ? <p className="text-xs text-destructive">{error}</p> : null}

          <div className="flex items-center justify-between border-t pt-4">
            <div className="flex items-center gap-2">
              <Button onClick={save}>{sub ? "حفظ" : "إضافة"}</Button>
              {sub ? (
                <Button
                  variant="secondary"
                  className="gap-1.5"
                  onClick={() =>
                    startTransition(async () => {
                      await updateSubscription({ id: sub.id, active: !sub.active });
                      onClose();
                    })
                  }
                >
                  {sub.active ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
                  {sub.active ? "إيقاف مؤقت" : "تفعيل"}
                </Button>
              ) : null}
            </div>
            {sub ? (
              <Button
                variant="destructive"
                size="sm"
                className="gap-1.5"
                onClick={() => {
                  if (!confirmDelete) {
                    setConfirmDelete(true);
                    setTimeout(() => setConfirmDelete(false), 3000);
                    return;
                  }
                  startTransition(async () => {
                    await deleteSubscription(sub.id);
                    onClose();
                  });
                }}
              >
                <Trash2 className="size-3.5" />
                {confirmDelete ? "متأكد؟" : "حذف"}
              </Button>
            ) : null}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
