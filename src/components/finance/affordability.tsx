"use client";

import { useState } from "react";
import { CircleCheck, CircleX, PiggyBank } from "lucide-react";
import { formatSAR } from "@/lib/currency";
import { affordability } from "@/lib/finance";
import { cn } from "@/lib/utils";

/** "أقدر أشتريه؟" — instant, client-side, no request. */
export function AffordabilityCheck({ freeMonthly }: { freeMonthly: number }) {
  const [raw, setRaw] = useState("");
  const price = Number(raw);
  const valid = raw.trim() !== "" && Number.isFinite(price) && price > 0;
  const result = valid ? affordability(price, freeMonthly) : null;

  return (
    <section className="rounded-xl border p-5">
      <h2 className="mb-3 text-sm font-bold">أقدر أشتريه؟</h2>
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <input
            inputMode="decimal"
            value={raw}
            onChange={(e) => setRaw(e.target.value.replace(/[^\d.]/g, ""))}
            placeholder="كم سعره؟"
            className="h-11 w-full rounded-lg border bg-background px-4 pe-10 text-sm outline-none transition-shadow placeholder:text-muted-foreground focus:shadow-sm"
            data-numeric
          />
          <span className="absolute end-3.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
            ﷼
          </span>
        </div>
      </div>

      {result ? (
        <div
          className={cn(
            "mt-4 flex items-start gap-2.5 rounded-lg px-4 py-3 text-sm",
            result.verdict === "yes" ? "bg-secondary" : "bg-destructive/5 text-destructive",
          )}
        >
          {result.verdict === "yes" ? (
            <>
              <CircleCheck className="mt-0.5 size-4 shrink-0" />
              <p data-numeric>
                نعم، تقدر — يتبقى لك {formatSAR(result.remainderAfter)} من فائض هذا الشهر
                ({formatSAR(freeMonthly)}).
              </p>
            </>
          ) : result.verdict === "save" ? (
            <>
              <PiggyBank className="mt-0.5 size-4 shrink-0" />
              <p data-numeric>
                ليس من فائض شهر واحد ({formatSAR(freeMonthly)}) — تحتاج توفير{" "}
                {result.monthsNeeded === 2 ? "شهرين" : `${result.monthsNeeded} أشهر`} تقريبًا.
              </p>
            </>
          ) : (
            <>
              <CircleX className="mt-0.5 size-4 shrink-0" />
              <p>
                لا فائض شهري حاليًا — التزاماتك تستهلك دخلك كاملًا. راجع الاشتراكات أدناه.
              </p>
            </>
          )}
        </div>
      ) : null}
    </section>
  );
}
