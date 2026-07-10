/**
 * Pure budget math — client-safe, no DB. Amounts are SAR numbers
 * (drizzle numeric comes in as string; parse at the query boundary).
 */
import { todayISO } from "./dates";

export type Cycle = "monthly" | "yearly";

export const CATEGORIES = [
  "ترفيه",
  "أدوات",
  "بث",
  "ذكاء اصطناعي",
  "اتصالات",
  "أخرى",
] as const;

export function monthlyEquivalent(amount: number, cycle: Cycle): number {
  return cycle === "monthly" ? amount : amount / 12;
}

/** iso + n calendar months, day-of-month clamped (31 يناير + شهر = 28/29 فبراير). */
export function addMonthsISO(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const targetMonth = m - 1 + n;
  const first = new Date(Date.UTC(y, targetMonth, 1));
  const daysInTarget = new Date(
    Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0),
  ).getUTCDate();
  first.setUTCDate(Math.min(d, daysInTarget));
  return first.toISOString().slice(0, 10);
}

/**
 * A stored renewal date may be in the past (we don't write on a timer) —
 * roll it forward cycle by cycle until it's today or later.
 */
export function currentNextRenewal(
  stored: string,
  cycle: Cycle,
  today: string = todayISO(),
): string {
  let next = stored;
  let guard = 0;
  while (next < today && guard++ < 1200) {
    next = addMonthsISO(next, cycle === "monthly" ? 1 : 12);
  }
  return next;
}

export type BudgetSummary = {
  income: number;
  subsMonthly: number;
  commitmentsMonthly: number;
  burnMonthly: number;
  freeMonthly: number;
  subsYearly: number;
};

export function summarize(
  subs: { amount: number; cycle: Cycle; active: boolean }[],
  commitments: { amount: number }[],
  income: number,
): BudgetSummary {
  const activeSubs = subs.filter((s) => s.active);
  const subsMonthly = activeSubs.reduce(
    (sum, s) => sum + monthlyEquivalent(s.amount, s.cycle),
    0,
  );
  const commitmentsMonthly = commitments.reduce((sum, c) => sum + c.amount, 0);
  const burnMonthly = subsMonthly + commitmentsMonthly;
  return {
    income,
    subsMonthly,
    commitmentsMonthly,
    burnMonthly,
    freeMonthly: income - burnMonthly,
    subsYearly: activeSubs.reduce(
      (sum, s) => sum + (s.cycle === "yearly" ? s.amount : s.amount * 12),
      0,
    ),
  };
}

export type Affordability =
  | { verdict: "yes"; remainderAfter: number }
  | { verdict: "save"; monthsNeeded: number }
  | { verdict: "no" };

/** Can I afford `price` from this month's free money? */
export function affordability(price: number, freeMonthly: number): Affordability {
  if (price <= 0) return { verdict: "yes", remainderAfter: freeMonthly };
  if (freeMonthly <= 0) return { verdict: "no" };
  if (price <= freeMonthly)
    return { verdict: "yes", remainderAfter: freeMonthly - price };
  return { verdict: "save", monthsNeeded: Math.ceil(price / freeMonthly) };
}
