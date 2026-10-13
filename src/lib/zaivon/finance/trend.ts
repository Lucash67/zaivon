import type { HistoryDay, MonthPlan } from "@/lib/zaivon/types";
import { round2 } from "./day";
import { salesDays, weekStart, type MonthSummary } from "./month";

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
export const pct = (to: number, from: number) => (from ? to / from - 1 : 0);
const ceil50 = (n: number) => Math.ceil(n / 50) * 50;
const round50 = (n: number) => Math.round(n / 50) * 50;

export interface WeekAvg {
  start: string;
  end: string;
  days: number;
  avg: number;
}

export function weeklyAverages(series: HistoryDay[]): WeekAvg[] {
  const groups = new Map<string, HistoryDay[]>();
  for (const d of [...series].sort((a, b) => a.date.localeCompare(b.date))) {
    const k = weekStart(d.date);
    groups.set(k, [...(groups.get(k) ?? []), d]);
  }
  return Array.from(groups.values()).map((ds) => ({
    start: ds[0]!.date,
    end: ds[ds.length - 1]!.date,
    days: ds.length,
    avg: round2(avg(ds.map((d) => d.profit))),
  }));
}

export interface Scenario {
  id: string;
  label: string;
  perDay: number;
  monthProfit: number;
  vsGoal: number;
  vsPlan: number;
  bankWithYield: number;
  base?: boolean;
}

export interface CurvePoint {
  date: string;
  plan: number;
  real: number | null;
  prevPace: number | null;
  last10: number | null;
  monthPace: number | null;
}

export interface Trend {
  monthAvg: number;
  prevMonthAvg: number;
  monthVsPrev: number;
  weekAvg: number;
  prevWeekAvg: number;
  weekVsPrev: number;
  last10: number;
  last10NoBonus: number;
  projectedProfit: number;
  projectedBank: number;
  projectedVsGoal: number;
  weeks: WeekAvg[];
  scenarios: Scenario[];
  increases: { label: string; from: number; to: number; change: number }[];
  drops: { label: string; avg: number; needed: number; canDrop: number }[];
  bestDay: HistoryDay | null;
  monthAvgNoBonus: number;
  revisedGoal: [number, number];
  curve: CurvePoint[];
}

export function computeTrend(
  monthSeries: HistoryDay[],
  prevSeries: HistoryDay[],
  plan: MonthPlan,
  ms: MonthSummary,
): Trend {
  const all = [...prevSeries, ...monthSeries].sort((a, b) => a.date.localeCompare(b.date));
  const weeks = weeklyAverages(all);
  const monthAvg = round2(avg(monthSeries.map((d) => d.profit)));
  const prevMonthAvg = round2(avg(prevSeries.map((d) => d.profit)));
  const lastWeek = weeks[weeks.length - 1];
  const prevWeek = weeks[weeks.length - 2];
  const last10Days = all.slice(-10);
  const last10 = round2(avg(last10Days.map((d) => d.profit)));
  const last10NoBonus = round2(avg(last10Days.map((d) => d.profit - d.bonus)));
  const rem = ms.remainingDays;
  const totalPlan = plan.dailyTarget * ms.totalDays;
  const yieldDay = ms.avgYieldPerDay;

  const mk = (id: string, label: string, perDay: number, isBase = false): Scenario => {
    const monthProfit = round2(ms.diaryProfit + perDay * rem);
    return {
      id,
      label,
      perDay,
      monthProfit,
      vsGoal: pct(monthProfit, plan.goal),
      vsPlan: pct(monthProfit, totalPlan),
      bankWithYield: round2(ms.bank + (perDay + yieldDay) * rem),
      base: isBase,
    };
  };
  const scenarios = [
    mk("prev", "Volta ao ritmo do mês anterior", prevMonthAvg),
    mk("cons", "Conservador do plano", plan.scenarios.conservative),
    mk("plan", "Alvo do plano", plan.dailyTarget),
    mk("amb", "Ambicioso", plan.scenarios.ambitious),
    mk("l10nb", "Últimos 10 dias sem bônus", last10NoBonus),
    mk("l10", "Últimos 10 dias (base)", last10, true),
    mk("month", "Ritmo do mês", monthAvg),
    mk("week", "Ritmo da última semana", lastWeek?.avg ?? 0),
  ];
  const baseS = scenarios.find((s) => s.base)!;
  const noBonusS = scenarios.find((s) => s.id === "l10nb")!;

  const increases = [
    { label: "Semana vs semana anterior", from: prevWeek?.avg ?? 0, to: lastWeek?.avg ?? 0 },
    { label: "Semana vs mês anterior", from: prevMonthAvg, to: lastWeek?.avg ?? 0 },
    { label: "Mês vs mês anterior", from: prevMonthAvg, to: monthAvg },
    { label: "Últimos 10 dias vs mês anterior", from: prevMonthAvg, to: last10 },
    { label: "Mês vs alvo diário", from: plan.dailyTarget, to: monthAvg },
  ].map((r) => ({ ...r, change: pct(r.to, r.from) }));

  const needed = ms.neededPerDay;
  const drops = [
    { label: "Média do mês", avg: monthAvg },
    { label: "Última semana", avg: lastWeek?.avg ?? 0 },
    { label: "Últimos 10 dias", avg: last10 },
    { label: "Mês anterior", avg: prevMonthAvg },
  ].map((r) => ({ ...r, needed, canDrop: r.avg ? 1 - needed / r.avg : 0 }));

  const bestDay = monthSeries.reduce<HistoryDay | null>((b, d) => (!b || d.profit > b.profit ? d : b), null);

  // Curva acumulada
  const dates = salesDays(plan);
  const realMap = new Map(monthSeries.map((d) => [d.date, d.profit]));
  let acc = 0;
  let lastReal = 0;
  let lastIdx = -1;
  const curve = dates.map((date, i) => {
    const r = realMap.get(date);
    if (r != null) {
      acc += r;
      lastReal = acc;
      lastIdx = i;
    }
    return { date, i, real: r != null ? round2(acc) : null };
  });
  const out = curve.map(({ date, i, real }) => {
    const after = i - lastIdx;
    const proj = (p: number) => (i < lastIdx ? null : round2(lastReal + p * after));
    return {
      date,
      plan: plan.dailyTarget * (i + 1),
      real,
      prevPace: proj(prevMonthAvg),
      last10: proj(last10),
      monthPace: proj(monthAvg),
    };
  });

  return {
    monthAvg,
    prevMonthAvg,
    monthVsPrev: pct(monthAvg, prevMonthAvg),
    weekAvg: lastWeek?.avg ?? 0,
    prevWeekAvg: prevWeek?.avg ?? 0,
    weekVsPrev: pct(lastWeek?.avg ?? 0, prevWeek?.avg ?? 0),
    last10,
    last10NoBonus,
    projectedProfit: baseS.monthProfit,
    projectedBank: baseS.bankWithYield,
    projectedVsGoal: pct(baseS.bankWithYield, plan.goal),
    weeks: weeks.slice(-6),
    scenarios,
    increases,
    drops,
    bestDay,
    monthAvgNoBonus: round2(avg(monthSeries.map((d) => d.profit - d.bonus))),
    revisedGoal: [ceil50(noBonusS.monthProfit), round50(baseS.monthProfit)],
    curve: out,
  };
}
