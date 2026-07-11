import "server-only";
import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { commitments, financeSettings, subscriptions } from "@/db/schema";
import { todayISO } from "@/lib/dates";
import { currentNextRenewal, summarize, type Cycle } from "@/lib/finance";

/** Subscription with numeric amount and the renewal rolled forward. */
export type Sub = {
  id: string;
  name: string;
  amount: number;
  cycle: Cycle;
  nextRenewal: string; // stored
  effectiveRenewal: string; // rolled forward to >= today
  category: string;
  active: boolean;
};

export async function listSubscriptions(): Promise<Sub[]> {
  const today = todayISO();
  const rows = await db
    .select()
    .from(subscriptions)
    .orderBy(desc(subscriptions.active), asc(subscriptions.nextRenewal));
  return rows
    .map((r) => {
      const cycle = (r.cycle === "yearly" ? "yearly" : "monthly") as Cycle;
      return {
        id: r.id,
        name: r.name,
        amount: Number(r.amount),
        cycle,
        nextRenewal: r.nextRenewal,
        effectiveRenewal: currentNextRenewal(r.nextRenewal, cycle, today),
        category: r.category,
        active: r.active,
      };
    })
    .sort((a, b) =>
      a.active === b.active
        ? a.effectiveRenewal.localeCompare(b.effectiveRenewal)
        : a.active
          ? -1
          : 1,
    );
}

export type CommitmentRow = { id: string; name: string; amount: number };

export async function listCommitments(): Promise<CommitmentRow[]> {
  const rows = await db.select().from(commitments).orderBy(desc(commitments.amount));
  return rows.map((r) => ({ id: r.id, name: r.name, amount: Number(r.amount) }));
}

export async function getMonthlyIncome(): Promise<number> {
  const rows = await db
    .select()
    .from(financeSettings)
    .where(eq(financeSettings.id, 1));
  return rows.length ? Number(rows[0].monthlyIncome) : 0;
}

export type FinancePulse = {
  freeMonthly: number;
  renewalsWeek: { count: number; total: number };
};

/** The اليوم summary cell: المتاح للصرف + renewals within 7 days. */
export async function financePulse(): Promise<FinancePulse> {
  const [subs, comms, income] = await Promise.all([
    listSubscriptions(),
    listCommitments(),
    getMonthlyIncome(),
  ]);
  const week = upcomingRenewalsFrom(subs, 7);
  return {
    freeMonthly: summarize(subs, comms, income).freeMonthly,
    renewalsWeek: {
      count: week.length,
      total: week.reduce((sum, s) => sum + s.amount, 0),
    },
  };
}

/** Active subs renewing within `days` (rolled forward), soonest first. */
export async function upcomingRenewals(days: number): Promise<Sub[]> {
  return upcomingRenewalsFrom(await listSubscriptions(), days);
}

function upcomingRenewalsFrom(subs: Sub[], days: number): Sub[] {
  const today = todayISO();
  const limitISO = new Date(
    Date.parse(today + "T00:00:00Z") + days * 86_400_000,
  )
    .toISOString()
    .slice(0, 10);
  return subs.filter((s) => s.active && s.effectiveRenewal <= limitISO);
}
