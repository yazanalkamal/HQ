import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { formatSAR } from "@/lib/currency";
import type { FinancePulse } from "@/lib/queries/finance";
import type { PlansPulse } from "@/lib/queries/plans";

/** «مهمة/مهمتين/N مهام» — the same pluralization the hero used. */
function tasksNoun(n: number): string {
  return n === 1 ? "مهمة" : n === 2 ? "مهمتين" : `${n} مهام`;
}

type Props = {
  tasks: { today: number; overdue: number; done: number };
  plans: PlansPulse;
  finance: FinancePulse;
};

/**
 * قمرة اليوم — one cell per section, each a door into it. The task count
 * lives here now (moved out of the hero so it isn't said twice).
 */
export function SummaryStrip({ tasks, plans, finance }: Props) {
  const taskMain =
    tasks.today > 0
      ? `أمامك ${tasksNoun(tasks.today)} اليوم`
      : tasks.done > 0
        ? `أنجزت ${tasksNoun(tasks.done)} اليوم`
        : "لا مهام على جدول اليوم";

  const planMain = plans.nextStep
    ? `التالية: ${plans.nextStep.text}`
    : plans.activeProjects > 0
      ? "حدّد خطوتك التالية"
      : "لا خطط نشطة";

  const planAttention = plans.lateMilestones > 0 || plans.stalled > 0;

  return (
    <div className="mb-9 grid grid-cols-1 rounded-xl border sm:grid-cols-3">
      <Cell href="/tasks" label="المهام">
        <p className="truncate text-[0.9375rem] font-bold" data-numeric>
          {taskMain}
        </p>
        <p className="text-xs text-muted-foreground" data-numeric>
          {tasks.overdue > 0 ? (
            <>
              <span className="text-destructive">
                {tasks.overdue === 1 ? "1 متأخرة" : `${tasks.overdue} متأخرة`}
              </span>
              {" · "}
            </>
          ) : null}
          {tasks.done > 0 && tasks.today > 0 ? `أنجزت ${tasks.done}` : " "}
          {tasks.overdue === 0 && !(tasks.done > 0 && tasks.today > 0) ? "يوم صافٍ" : null}
        </p>
      </Cell>

      <Cell href="/plans" label="الخطط">
        <p className="truncate text-[0.9375rem] font-bold">{planMain}</p>
        <p className="text-xs text-muted-foreground" data-numeric>
          {planAttention ? (
            <>
              {plans.lateMilestones > 0 ? (
                <span className="text-destructive">
                  {plans.lateMilestones === 1
                    ? "معلم متأخر"
                    : `${plans.lateMilestones} معالم متأخرة`}
                </span>
              ) : null}
              {plans.lateMilestones > 0 && plans.stalled > 0 ? " · " : null}
              {plans.stalled > 0
                ? plans.stalled === 1
                  ? "خطة متعثرة"
                  : `${plans.stalled} خطط متعثرة`
                : null}
            </>
          ) : (
            "كل الخطط ماشية"
          )}
        </p>
      </Cell>

      <Cell href="/finance" label="المالية">
        <p className="truncate text-[0.9375rem] font-bold" data-numeric>
          المتاح للصرف {formatSAR(finance.freeMonthly)}
        </p>
        <p className="text-xs text-muted-foreground" data-numeric>
          {finance.renewalsWeek.count > 0
            ? `${
                finance.renewalsWeek.count === 1
                  ? "تجديد"
                  : finance.renewalsWeek.count === 2
                    ? "تجديدان"
                    : `${finance.renewalsWeek.count} تجديدات`
              } خلال أسبوع · ${formatSAR(finance.renewalsWeek.total)}`
            : "لا تجديدات قريبة"}
        </p>
      </Cell>
    </div>
  );
}

function Cell({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group flex min-w-0 flex-col gap-1 border-b px-5 py-3.5 last:border-b-0 hover:bg-secondary/50 sm:border-b-0 sm:border-e sm:last:border-e-0"
    >
      <span className="flex items-center gap-1 text-[0.6875rem] font-bold text-muted-foreground">
        {label}
        <ArrowLeft className="size-3 opacity-0 transition-opacity group-hover:opacity-100" />
      </span>
      {children}
    </Link>
  );
}
