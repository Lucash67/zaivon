import { listDiaryEntries } from "@/lib/diary-service";
import { deriveDiaryTotalProfit } from "@/lib/diary/types";
import { getProfitBankView } from "@/lib/profit-bank-service";
import { MONTH_PLANS, getMonthPlan, type MonthIndicator } from "./month-plans";

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"] as const;

export interface PlanningDay {
  date: string;
  weekday: string;
  planned: number;
  profit: number | null;
  received: number | null;
  pending: number | null;
  own: number | null;
  sold: number | null;
  lost: number | null;
  holiday: boolean;
}

export interface PlanningWeek {
  label: string;
  days: number;
  planned: number;
  actual: number;
  registered: number;
}

export interface PlanningScenario {
  id: "conservative" | "realistic" | "ambitious";
  label: string;
  perDay: number;
  monthTotal: number;
  vsGoal: number;
}

export interface TrendWeek {
  label: string;
  days: number;
  total: number;
  average: number;
}

export interface TrendComparison {
  label: string;
  from: number;
  to: number;
  /** Variação em % (to sobre from). */
  change: number;
}

export interface TrendScenario {
  id: string;
  label: string;
  perDay: number;
  profit: number;
  bank: number | null;
  vsGoalPct: number;
  vsPlanPct: number;
  tone: "base" | "good" | "warn" | null;
}

export interface TrendCurveSeries {
  label: string;
  tone: "plan" | "warn" | "base" | "good";
  data: Array<number | null>;
}

export interface PlanningTrend {
  previousLabel: string;
  previousAverage: number | null;
  monthAverage: number;
  monthAverageNoBonus: number;
  recentAverage: number;
  recentAverageNoBonus: number;
  weekLabel: string | null;
  weekAverage: number | null;
  previousWeekAverage: number | null;
  monthBonus: number;
  rendimento: number | null;
  rendimentoPerDay: number;
  planTotal: number;
  weeks: TrendWeek[];
  comparisons: TrendComparison[];
  scenarios: TrendScenario[];
  curve: { labels: string[]; series: TrendCurveSeries[] };
  planComparison: Array<{ label: string; plan: number; actual: number; change: number }>;
  headroom: Array<{ label: string; from: number; change: number }>;
  suggestedGoal: { low: number; high: number } | null;
  insights: string[];
}

export interface PlanningView {
  month: string;
  label: string;
  goal: number;
  dailyTarget: number;
  availableMonths: Array<{ month: string; label: string }>;
  sellingDays: number;
  registeredDays: number;
  remainingDays: number;
  profitDone: number;
  plannedDone: number;
  bank: number | null;
  bankSource: "extrato" | "cofrinho" | null;
  bankNote: string | null;
  practicalBalance: number;
  /** Quanto precisa por dia restante para bater a meta (pelo banco, ou pelo lucro se não houver banco). */
  neededPerRemainingDay: number | null;
  projection: number;
  recentAverage: number;
  days: PlanningDay[];
  extraDays: PlanningDay[];
  weeks: PlanningWeek[];
  scenarios: PlanningScenario[];
  indicators: MonthIndicator[];
  notes: string[];
  summary: string[];
  /** Análise de tendência — recalculada a cada fechamento de dia (null antes do 1º registro). */
  trend: PlanningTrend | null;
}

const MONTH_NAMES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
] as const;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function isoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function weekdayOf(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay();
}

function monthDates(month: string): string[] {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y!, m!, 0)).getUTCDate();
  return Array.from({ length: last }, (_, i) => isoDate(y!, m!, i + 1));
}

function previousMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const date = new Date(Date.UTC(y!, m! - 2, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function brl(n: number): string {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function pctText(n: number): string {
  const rounded = Math.round(n * 10) / 10;
  return `${rounded >= 0 ? "+" : "−"}${Math.abs(rounded).toLocaleString("pt-BR")}%`;
}

function growthPct(from: number, to: number): number {
  return from === 0 ? 0 : round2(((to - from) / from) * 100);
}

function average(values: number[]): number {
  return values.length ? values.reduce((s, n) => s + n, 0) / values.length : 0;
}

function mondayOf(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const monday = new Date(Date.UTC(y!, m! - 1, d!));
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
  return monday.toISOString().slice(0, 10);
}

function ddmm(date: string): string {
  return `${date.slice(8, 10)}/${date.slice(5, 7)}`;
}

interface TrendDay {
  date: string;
  received: number | null;
  profit: number;
  bonus: number;
  own: number | null;
}

function toTrendDay(entry: DiaryEntryLike): TrendDay {
  const received = entry.revenue.received;
  return {
    date: entry.date,
    received: received > 0 ? received : null,
    profit: deriveDiaryTotalProfit(entry),
    bonus: entry.bonusIncome ?? 0,
    own: received > 0 ? Math.max(0, round2(received - entry.profit)) : null,
  };
}

type DiaryEntryLike = Awaited<ReturnType<typeof listDiaryEntries>>[number];

function isWeekday(date: string): boolean {
  const wd = weekdayOf(date);
  return wd !== 0 && wd !== 6;
}

function buildTrend(input: {
  month: string;
  plan: NonNullable<ReturnType<typeof getMonthPlan>>;
  days: PlanningDay[];
  registered: PlanningDay[];
  remaining: PlanningDay[];
  entries: DiaryEntryLike[];
  prevEntries: DiaryEntryLike[];
  profitDone: number;
  bank: number | null;
  neededPerRemainingDay: number | null;
}): PlanningTrend | null {
  const { month, plan, days, registered, remaining, profitDone, bank } = input;
  if (registered.length === 0) return null;

  const registeredDates = new Set(registered.map((d) => d.date));
  const byDateAsc = (a: TrendDay, b: TrendDay) => a.date.localeCompare(b.date);
  const monthDays = input.entries.filter((e) => registeredDates.has(e.date)).map(toTrendDay).sort(byDateAsc);
  const prevDays = input.prevEntries.filter((e) => isWeekday(e.date)).map(toTrendDay).sort(byDateAsc);
  const pool = [...prevDays, ...monthDays].sort((a, b) => a.date.localeCompare(b.date));
  const recent = pool.slice(-10);

  const prevMonth = previousMonth(month);
  const previousLabel = MONTH_NAMES[Number(prevMonth.slice(5, 7)) - 1]!;
  const monthLabel = MONTH_NAMES[Number(month.slice(5, 7)) - 1]!;
  const previousAverage = prevDays.length ? round2(average(prevDays.map((d) => d.profit))) : null;
  const monthAverage = round2(average(monthDays.map((d) => d.profit)));
  const monthBonus = round2(monthDays.reduce((s, d) => s + d.bonus, 0));
  const monthAverageNoBonus = round2(average(monthDays.map((d) => d.profit - d.bonus)));
  const recentAverage = round2(average(recent.map((d) => d.profit)));
  const recentAverageNoBonus = round2(average(recent.map((d) => d.profit - d.bonus)));

  const weekMap = new Map<string, TrendDay[]>();
  for (const d of pool) {
    const key = mondayOf(d.date);
    weekMap.set(key, [...(weekMap.get(key) ?? []), d]);
  }
  const weeks: TrendWeek[] = Array.from(weekMap.values())
    .slice(-6)
    .map((list) => {
      const total = round2(list.reduce((s, d) => s + d.profit, 0));
      const first = list[0]!.date;
      const last = list[list.length - 1]!.date;
      return {
        label:
          first === last
            ? ddmm(first)
            : first.slice(5, 7) === last.slice(5, 7)
              ? `${first.slice(8, 10)}–${ddmm(last)}`
              : `${ddmm(first)}–${ddmm(last)}`,
        days: list.length,
        total,
        average: round2(total / list.length),
      };
    });
  const currentWeek = weeks.length ? weeks[weeks.length - 1]! : null;
  const previousWeek = weeks.length > 1 ? weeks[weeks.length - 2]! : null;

  const rendimento = bank != null ? round2(bank - profitDone) : null;
  const rendimentoPerDay = rendimento != null && rendimento > 0 ? round2(rendimento / registered.length) : 0;
  const planTotal = plan.dailyTarget * days.length;
  const left = remaining.length;

  const comparisons: TrendComparison[] = [];
  if (currentWeek && previousWeek) {
    comparisons.push({
      label: `Semana ${currentWeek.label} vs anterior`,
      from: previousWeek.average,
      to: currentWeek.average,
      change: growthPct(previousWeek.average, currentWeek.average),
    });
  }
  if (previousAverage != null) {
    if (currentWeek) {
      comparisons.push({
        label: `Semana ${currentWeek.label} vs média de ${previousLabel}`,
        from: previousAverage,
        to: currentWeek.average,
        change: growthPct(previousAverage, currentWeek.average),
      });
    }
    comparisons.push({
      label: `Média de ${monthLabel} vs ${previousLabel}`,
      from: previousAverage,
      to: monthAverage,
      change: growthPct(previousAverage, monthAverage),
    });
    comparisons.push({
      label: `Últimos 10 dias vs ${previousLabel}`,
      from: previousAverage,
      to: recentAverage,
      change: growthPct(previousAverage, recentAverage),
    });
  }
  comparisons.push({
    label: `Média de ${monthLabel} vs alvo diário`,
    from: plan.dailyTarget,
    to: monthAverage,
    change: growthPct(plan.dailyTarget, monthAverage),
  });

  const project = (perDay: number) => ({
    profit: round2(profitDone + perDay * left),
    bank: bank != null ? round2(bank + (perDay + rendimentoPerDay) * left) : null,
  });
  const scenarioDefs: Array<[string, string, number, TrendScenario["tone"]]> = [];
  if (previousAverage != null) scenarioDefs.push(["previous", `Volta ao ritmo de ${previousLabel}`, previousAverage, "warn"]);
  scenarioDefs.push(["plan", "Alvo do plano", plan.dailyTarget, null]);
  scenarioDefs.push(["ambitious", "Ambicioso do plano", plan.scenarios.ambitious, null]);
  if (recentAverageNoBonus !== recentAverage) {
    scenarioDefs.push(["recent-no-bonus", "Últimos 10 dias sem bônus", recentAverageNoBonus, null]);
  }
  scenarioDefs.push(["recent", "Últimos 10 dias (base)", recentAverage, "base"]);
  scenarioDefs.push(["month", `Ritmo de ${monthLabel}`, monthAverage, "good"]);
  if (currentWeek) scenarioDefs.push(["week", "Ritmo da última semana", currentWeek.average, "good"]);
  const scenarios: TrendScenario[] = scenarioDefs
    .sort((a, b) => a[2] - b[2])
    .map(([id, label, perDay, tone]) => {
      const p = project(perDay);
      return {
        id,
        label,
        perDay: round2(perDay),
        profit: p.profit,
        bank: p.bank,
        vsGoalPct: growthPct(plan.goal, p.bank ?? p.profit),
        vsPlanPct: growthPct(planTotal, p.profit),
        tone,
      };
    });

  const labels = days.map((d) => d.date.slice(8, 10));
  const lastIdx = days.reduce((idx, d, i) => (d.profit != null ? i : idx), -1);
  const cumulative: number[] = [];
  days.forEach((d, i) => cumulative.push(round2((i ? cumulative[i - 1]! : 0) + (d.profit ?? 0))));
  const base = lastIdx >= 0 ? cumulative[lastIdx]! : 0;
  const projectionLine = (perDay: number) =>
    days.map((_, i) => (i <= lastIdx ? cumulative[i]! : round2(base + perDay * (i - lastIdx))));
  const curveSeries: TrendCurveSeries[] = [
    { label: `Plano (${brl(plan.dailyTarget)}/dia)`, tone: "plan", data: days.map((_, i) => plan.dailyTarget * (i + 1)) },
  ];
  if (previousAverage != null) {
    curveSeries.push({ label: `Volta a ${previousLabel} (${brl(previousAverage)}/dia)`, tone: "warn", data: projectionLine(previousAverage) });
  }
  curveSeries.push({ label: `Últimos 10 dias (${brl(recentAverage)}/dia)`, tone: "base", data: projectionLine(recentAverage) });
  curveSeries.push({ label: `Ritmo de ${monthLabel} (${brl(monthAverage)}/dia)`, tone: "good", data: projectionLine(monthAverage) });

  const plannedDone = plan.dailyTarget * registered.length;
  const baseProjection = project(recentAverage);
  const planComparison = [
    { label: `Lucro até ${ddmm(registered[registered.length - 1]!.date)}`, plan: plannedDone, actual: profitDone, change: growthPct(plannedDone, profitDone) },
    { label: "Lucro por dia", plan: plan.dailyTarget, actual: monthAverage, change: growthPct(plan.dailyTarget, monthAverage) },
    { label: "Lucro do mês (base)", plan: planTotal, actual: baseProjection.profit, change: growthPct(planTotal, baseProjection.profit) },
  ];
  if (baseProjection.bank != null) {
    planComparison.push({ label: "Banco do mês (base)", plan: plan.goal, actual: baseProjection.bank, change: growthPct(plan.goal, baseProjection.bank) });
  }
  const needed = input.neededPerRemainingDay;
  const headroom =
    needed != null
      ? [
          { label: `Média de ${monthLabel}`, from: monthAverage, change: growthPct(monthAverage, needed) },
          { label: "Últimos 10 dias", from: recentAverage, change: growthPct(recentAverage, needed) },
          ...(currentWeek ? [{ label: "Última semana", from: currentWeek.average, change: growthPct(currentWeek.average, needed) }] : []),
        ]
      : [];

  const roundDown50 = (n: number) => Math.floor(n / 50) * 50;
  const low = roundDown50(project(recentAverageNoBonus).bank ?? project(recentAverageNoBonus).profit);
  const high = roundDown50(baseProjection.bank ?? baseProjection.profit);
  const suggestedGoal = left > 0 && low > plan.goal ? { low, high: Math.max(low, high) } : null;

  const insights: string[] = [];
  if (previousAverage != null) {
    insights.push(
      `Lucro médio de ${monthLabel}: ${brl(monthAverage)} por dia, ${pctText(growthPct(previousAverage, monthAverage))} sobre ${previousLabel} (${brl(previousAverage)}).`,
    );
  } else {
    insights.push(`Lucro médio de ${monthLabel}: ${brl(monthAverage)} por dia.`);
  }
  if (currentWeek && previousWeek) {
    insights.push(
      `Semana ${currentWeek.label}: ${brl(currentWeek.average)} por dia, ${pctText(growthPct(previousWeek.average, currentWeek.average))} sobre a semana anterior (${brl(previousWeek.average)}).`,
    );
  }
  const best = [...monthDays].sort((a, b) => b.profit - a.profit)[0];
  if (best) insights.push(`Melhor dia do mês: ${ddmm(best.date)}, com ${brl(best.profit)}.`);
  if (monthBonus > 0) {
    insights.push(
      `Bônus somam ${brl(monthBonus)} no mês; sem eles a média é ${brl(monthAverageNoBonus)}${previousAverage != null ? ` (${pctText(growthPct(previousAverage, monthAverageNoBonus))} sobre ${previousLabel})` : ""}.`,
    );
  }
  const recentReceived = monthDays.slice(-5).filter((d) => d.received != null);
  const prevReceived = prevDays.filter((d) => d.received != null);
  if (recentReceived.length && prevReceived.length) {
    const recNow = average(recentReceived.map((d) => d.received!));
    const recPrev = average(prevReceived.map((d) => d.received!));
    insights.push(
      `Caixa recebido: ${brl(recNow)} por dia nos últimos ${recentReceived.length} dias contra ${brl(recPrev)} em ${previousLabel} (${pctText(growthPct(recPrev, recNow))}).`,
    );
  }
  const recentOwn = monthDays.slice(-5).filter((d) => d.own != null);
  const prevOwn = prevDays.filter((d) => d.own != null);
  if (recentOwn.length && prevOwn.length) {
    const ownNow = average(recentOwn.map((d) => d.own!));
    const ownPrev = average(prevOwn.map((d) => d.own!));
    const roiNow = ownNow > 0 ? (average(recentOwn.map((d) => d.profit)) / ownNow) * 100 : 0;
    const roiPrev = ownPrev > 0 ? (average(prevOwn.map((d) => d.profit)) / ownPrev) * 100 : 0;
    insights.push(
      `Capital próprio médio: ${brl(ownNow)} por dia nos últimos ${recentOwn.length} dias contra ${brl(ownPrev)} em ${previousLabel} — ROI de ${Math.round(roiPrev)}% para ${Math.round(roiNow)}%.`,
    );
  }
  if (needed != null) {
    insights.push(
      `Para a meta bastam ${brl(needed)} por dia — ${Math.round((needed / recentAverage) * 100)}% da média dos últimos 10 dias.`,
    );
  } else if (left > 0) {
    insights.push(`Meta de ${brl(plan.goal)} já batida; o restante do mês é lucro acima do plano.`);
  }
  if (previousAverage != null && weeks.length > 1) {
    const worst = Math.min(...weeks.slice(0, -1).map((w) => w.average));
    const worstProjection = project(worst);
    const worstTotal = worstProjection.bank ?? worstProjection.profit;
    if (left > 0) {
      insights.push(
        `Mesmo no pior ritmo semanal recente (${brl(worst)} por dia), o mês fecharia em ${brl(worstTotal)} (${pctText(growthPct(plan.goal, worstTotal))} contra a meta).`,
      );
    }
  }
  if (suggestedGoal) {
    insights.push(
      `A tendência sustenta uma meta revisada entre ${brl(suggestedGoal.low)} e ${brl(suggestedGoal.high)}.`,
    );
  }

  return {
    previousLabel,
    previousAverage,
    monthAverage,
    monthAverageNoBonus,
    recentAverage,
    recentAverageNoBonus,
    weekLabel: currentWeek?.label ?? null,
    weekAverage: currentWeek?.average ?? null,
    previousWeekAverage: previousWeek?.average ?? null,
    monthBonus,
    rendimento,
    rendimentoPerDay,
    planTotal,
    weeks,
    comparisons,
    scenarios,
    curve: { labels, series: curveSeries },
    planComparison,
    headroom,
    suggestedGoal,
    insights,
  };
}

export function currentMonthKey(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export async function getPlanningView(businessId: string, month: string): Promise<PlanningView> {
  const plan = getMonthPlan(month);
  if (!plan) throw new Error(`Sem plano para ${month}`);

  const dates = monthDates(month);
  const prevDates = monthDates(previousMonth(month));
  const [entries, prevEntries, bankView] = await Promise.all([
    listDiaryEntries(businessId, dates[0], dates[dates.length - 1]),
    listDiaryEntries(businessId, prevDates[0], prevDates[prevDates.length - 1]),
    getProfitBankView(businessId),
  ]);
  const byDate = new Map(entries.map((e) => [e.date, e]));

  const toDay = (date: string, planned: number, holiday: boolean): PlanningDay => {
    const entry = byDate.get(date);
    const profit = entry ? deriveDiaryTotalProfit(entry) : null;
    const received = entry ? entry.revenue.received : null;
    const own = entry && received && received > 0 ? Math.max(0, round2(received - entry.profit)) : null;
    return {
      date,
      weekday: WEEKDAYS[weekdayOf(date)]!,
      planned,
      profit,
      received,
      pending: entry ? entry.revenue.pending : null,
      own,
      sold: entry ? entry.quantitySold : null,
      lost: entry ? entry.quantityLost : null,
      holiday,
    };
  };

  const days: PlanningDay[] = [];
  const extraDays: PlanningDay[] = [];
  for (const date of dates) {
    const wd = weekdayOf(date);
    const weekend = wd === 0 || wd === 6;
    const holiday = plan.holidays.includes(date);
    if (weekend || holiday) {
      if (byDate.has(date)) extraDays.push(toDay(date, 0, holiday));
      continue;
    }
    days.push(toDay(date, plan.dailyTarget, false));
  }

  const registered = days.filter((d) => d.profit != null);
  const lastRegistered = registered.length ? registered[registered.length - 1]!.date : null;
  const remaining = days.filter((d) => d.profit == null && (!lastRegistered || d.date > lastRegistered));
  const profitDone = round2(
    [...registered, ...extraDays].reduce((s, d) => s + (d.profit ?? 0), 0),
  );
  const plannedDone = registered.length * plan.dailyTarget;

  const recentPool = [
    ...prevEntries.map((e) => ({ date: e.date, profit: deriveDiaryTotalProfit(e), wd: weekdayOf(e.date) })),
    ...registered.map((d) => ({ date: d.date, profit: d.profit ?? 0, wd: weekdayOf(d.date) })),
  ]
    .filter((d) => d.wd !== 0 && d.wd !== 6)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-10);
  const recentAverage = recentPool.length
    ? round2(recentPool.reduce((s, d) => s + d.profit, 0) / recentPool.length)
    : plan.dailyTarget;

  let bank: number | null = null;
  let bankSource: PlanningView["bankSource"] = null;
  if (plan.bankDeposited != null) {
    bank = plan.bankDeposited;
    bankSource = "extrato";
  } else if (plan.practicalAtStart != null) {
    bank = round2(Math.max(0, bankView.practicalBalance - plan.practicalAtStart));
    bankSource = "cofrinho";
  }

  const achieved = bank ?? profitDone;
  const gap = round2(plan.goal - achieved);
  const neededPerRemainingDay = remaining.length > 0 && gap > 0 ? Math.ceil(gap / remaining.length) : null;
  const projection = round2(achieved + recentAverage * remaining.length);

  const weekMap = new Map<string, PlanningWeek & { first: string; last: string }>();
  for (const d of days) {
    const [y, m, dd] = d.date.split("-").map(Number);
    const monday = new Date(Date.UTC(y!, m! - 1, dd!));
    monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
    const key = monday.toISOString().slice(0, 10);
    const week = weekMap.get(key) ?? {
      label: "",
      first: d.date,
      last: d.date,
      days: 0,
      planned: 0,
      actual: 0,
      registered: 0,
    };
    week.last = d.date;
    week.days += 1;
    week.planned += d.planned;
    week.actual = round2(week.actual + (d.profit ?? 0));
    if (d.profit != null) week.registered += 1;
    weekMap.set(key, week);
  }
  const weeks: PlanningWeek[] = Array.from(weekMap.values()).map(({ first, last, ...w }) => ({
    ...w,
    label: first === last ? `${first.slice(8, 10)}/${first.slice(5, 7)}` : `${first.slice(8, 10)}–${last.slice(8, 10)}/${last.slice(5, 7)}`,
  }));

  const sellingDays = days.length;
  const scenarioDefs: Array<[PlanningScenario["id"], string, number]> = [
    ["conservative", "Conservador", plan.scenarios.conservative],
    ["realistic", "Ritmo recente", recentAverage],
    ["ambitious", "Ambicioso", plan.scenarios.ambitious],
  ];
  const scenarios: PlanningScenario[] = scenarioDefs.map(([id, label, perDay]) => {
    const monthTotal = registered.length
      ? round2(achieved + perDay * remaining.length)
      : perDay * sellingDays;
    return { id, label, perDay, monthTotal, vsGoal: round2(monthTotal - plan.goal) };
  });

  const summary: string[] = [];
  if (remaining.length === 0 && registered.length > 0) {
    const onPlan = registered.filter((d) => (d.profit ?? 0) >= plan.dailyTarget).length;
    summary.push(
      gap <= 0
        ? `Meta de ${brl(plan.goal)} batida: ${brl(achieved)}${bankSource ? " no banco" : " de lucro"}, ${brl(-gap)} acima.`
        : `Meta de ${brl(plan.goal)} não fechou: ${brl(achieved)}, faltaram ${brl(gap)}.`,
    );
    summary.push(`${onPlan} de ${registered.length} dias de venda ficaram em ${brl(plan.dailyTarget)} ou mais.`);
    summary.push(`Lucro no diário: ${brl(profitDone)} (plano dos dias registrados: ${brl(plannedDone)}).`);
  } else {
    summary.push(
      `${registered.length} de ${sellingDays} dias de venda registrados. ${brl(achieved)} ${bankSource ? "no banco" : "de lucro"} até agora.`,
    );
    if (neededPerRemainingDay != null) {
      summary.push(
        `Para ${brl(plan.goal)}: ${brl(neededPerRemainingDay)} por dia nos ${remaining.length} dias que faltam.`,
      );
    } else if (gap <= 0) {
      summary.push(`Meta já batida — ${brl(-gap)} acima.`);
    }
    summary.push(
      `No ritmo recente (${brl(recentAverage)}/dia), o mês fecha em ${brl(projection)}${projection >= plan.goal ? ", acima da meta." : `, ${brl(plan.goal - projection)} abaixo.`}`,
    );
  }

  return {
    month,
    label: plan.label,
    goal: plan.goal,
    dailyTarget: plan.dailyTarget,
    availableMonths: MONTH_PLANS.map((p) => ({ month: p.month, label: p.label })),
    sellingDays,
    registeredDays: registered.length,
    remainingDays: remaining.length,
    profitDone,
    plannedDone,
    bank,
    bankSource,
    bankNote: plan.bankNote ?? (bankSource === "cofrinho" ? "Cofrinho prático atual − saldo no início do mês." : null),
    practicalBalance: bankView.practicalBalance,
    neededPerRemainingDay,
    projection,
    recentAverage,
    days,
    extraDays,
    weeks,
    scenarios,
    indicators: plan.indicators,
    notes: plan.notes,
    summary,
    trend: buildTrend({
      month,
      plan,
      days,
      registered,
      remaining,
      entries,
      prevEntries,
      profitDone,
      bank,
      neededPerRemainingDay,
    }),
  };
}
