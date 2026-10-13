import type { HistoryDay, MonthPlan, OperationDay, Settlement } from "@/lib/zaivon/types";
import { dayFinance, impliedYield, round2 } from "./day";

/** Dias de venda do mês: seg–sex menos feriados. */
export function salesDays(plan: MonthPlan): string[] {
  const [y = 2026, m = 1] = plan.month.split("-").map(Number);
  const out: string[] = [];
  const d = new Date(Date.UTC(y, m - 1, 1));
  while (d.getUTCMonth() === m - 1) {
    const wd = d.getUTCDay();
    const iso = d.toISOString().slice(0, 10);
    if (wd >= 1 && wd <= 5 && !plan.holidays.includes(iso)) out.push(iso);
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

export function monthDays(days: OperationDay[], plan: MonthPlan) {
  return days.filter((d) => d.date.startsWith(plan.month)).sort((a, b) => a.date.localeCompare(b.date));
}

/** Converte os dias do mês para a série de lucro usada na tendência. */
export function toHistory(days: OperationDay[], settlements: Settlement[]): HistoryDay[] {
  return days.map((d) => ({ date: d.date, profit: dayFinance(d, settlements).profit, bonus: d.bonus }));
}

export interface MonthSummary {
  closedDays: number;
  totalDays: number;
  remainingDays: number;
  diaryProfit: number;
  bank: number;
  yields: number;
  avgYieldPerDay: number;
  pctGoal: number;
  neededPerDay: number;
  planToDate: number;
  vsPlanPct: number;
  avgProfit: number;
  lastCofrinho: number;
  cashIn: number;
  ownCost: number;
  thirdPartyCost: number;
  bonus: number;
}

export function monthSummary(days: OperationDay[], settlements: Settlement[], plan: MonthPlan): MonthSummary {
  const md = monthDays(days, plan);
  const all = salesDays(plan);
  const closed = md.length;
  const fin = md.map((d) => dayFinance(d, settlements));
  const diaryProfit = round2(fin.reduce((s, f) => s + f.profit, 0));
  const lastCof = [...md].reverse().find((d) => d.cofrinhoEnd != null)?.cofrinhoEnd ?? plan.practicalAtStart;
  const hasCofrinho = md.some((d) => d.cofrinhoEnd != null);
  const bank = hasCofrinho ? round2(lastCof - plan.practicalAtStart) : round2(plan.bankDeposited ?? diaryProfit);
  const yields = round2(bank - diaryProfit);
  const remaining = Math.max(0, all.length - closed);
  const planToDate = plan.dailyTarget * closed;
  return {
    closedDays: closed,
    totalDays: all.length,
    remainingDays: remaining,
    diaryProfit,
    bank,
    yields,
    avgYieldPerDay: closed ? round2(yields / closed) : 0,
    pctGoal: bank / plan.goal,
    neededPerDay: remaining ? Math.ceil((plan.goal - bank) / remaining) : 0,
    planToDate,
    vsPlanPct: planToDate ? diaryProfit / planToDate - 1 : 0,
    avgProfit: closed ? round2(diaryProfit / closed) : 0,
    lastCofrinho: lastCof,
    cashIn: round2(fin.reduce((s, f) => s + f.cashIn, 0)),
    ownCost: round2(fin.reduce((s, f) => s + f.ownCost, 0)),
    thirdPartyCost: round2(fin.reduce((s, f) => s + f.thirdPartyCost, 0)),
    bonus: round2(fin.reduce((s, f) => s + f.bonus, 0)),
  };
}

/** Segunda-feira da semana (semana começa na segunda). */
export function weekStart(date: string): string {
  const d = new Date(date + "T12:00:00Z");
  const wd = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - wd);
  return d.toISOString().slice(0, 10);
}

export interface WeekSummary {
  start: string;
  dates: string[];
  profit: number;
  bonus: number;
  cashIn: number;
  ownCost: number;
  yields: number;
  cofrinhoDelta: number | null;
  avg: number;
}

export function weekSummary(
  start: string,
  days: OperationDay[],
  settlements: Settlement[],
  plan: MonthPlan,
): WeekSummary {
  const wd = days.filter((d) => weekStart(d.date) === start).sort((a, b) => a.date.localeCompare(b.date));
  const fin = wd.map((d) => dayFinance(d, settlements));
  const profit = round2(fin.reduce((s, f) => s + f.profit, 0));
  const ys = wd.map((d) => impliedYield(d, days, settlements, plan));
  const yields = round2(ys.reduce<number>((s, y) => s + (y ?? 0), 0));
  return {
    start,
    dates: wd.map((d) => d.date),
    profit,
    bonus: round2(wd.reduce((s, d) => s + d.bonus, 0)),
    cashIn: round2(fin.reduce((s, f) => s + f.cashIn, 0)),
    ownCost: round2(fin.reduce((s, f) => s + f.ownCost, 0)),
    yields,
    cofrinhoDelta: ys.every((y) => y != null) && wd.length ? round2(profit + yields) : null,
    avg: wd.length ? round2(profit / wd.length) : 0,
  };
}
