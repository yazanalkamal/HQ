import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { AffordabilityCheck } from "@/components/finance/affordability";
import { CommitmentsSection } from "@/components/finance/commitments-section";
import { SubscriptionsSection } from "@/components/finance/subscriptions-section";
import { formatSAR } from "@/lib/currency";
import { summarize } from "@/lib/finance";
import {
  getMonthlyIncome,
  listCommitments,
  listSubscriptions,
} from "@/lib/queries/finance";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "المالية" };

export default async function FinancePage() {
  const [subs, commitments, income] = await Promise.all([
    listSubscriptions(),
    listCommitments(),
    getMonthlyIncome(),
  ]);

  const s = summarize(subs, commitments, income);

  return (
    <>
      <PageHeader
        title="الماليـــة"
        description="اشتراكاتك والتزاماتك وقدرتك الشرائية — بالريال."
      />

      <div className="space-y-10">
        {/* stats */}
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border md:grid-cols-4">
          <Stat label="الدخل الشهري" value={s.income} />
          <Stat label="الاشتراكات شهريًا" value={s.subsMonthly} />
          <Stat label="الالتزامات الثابتة" value={s.commitmentsMonthly} />
          <Stat
            label="المتبقي الحر شهريًا"
            value={s.freeMonthly}
            negative={s.freeMonthly < 0}
            emphasize
          />
        </div>

        <AffordabilityCheck freeMonthly={s.freeMonthly} />

        <SubscriptionsSection subs={subs} />

        <CommitmentsSection commitments={commitments} income={income} />

        {s.subsYearly > 0 ? (
          <p className="text-center text-xs text-muted-foreground" data-numeric>
            كلفة اشتراكاتك النشطة سنويًا: {formatSAR(Math.round(s.subsYearly))}
          </p>
        ) : null}
      </div>
    </>
  );
}

function Stat({
  label,
  value,
  emphasize = false,
  negative = false,
}: {
  label: string;
  value: number;
  emphasize?: boolean;
  negative?: boolean;
}) {
  return (
    <div className="bg-background p-5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-1.5 text-xl",
          emphasize ? "font-bold" : "font-medium",
          negative && "text-destructive",
        )}
        data-numeric
      >
        {formatSAR(Math.round(value))}
      </p>
    </div>
  );
}
