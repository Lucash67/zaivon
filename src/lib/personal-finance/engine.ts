import { CHALLENGE_CATALOG, TIPS } from "@/lib/personal-finance/defaults";
import { buildSpendPlan } from "@/lib/personal-finance/spend-plan";
import {
  addDays,
  daysBetween,
  formatShort,
  monthEnd,
  monthLabel,
  monthStart,
  yearMonth,
} from "@/lib/personal-finance/dates";
import type {
  AccountKind,
  ChallengeView,
  Direction,
  EngineAccount,
  EngineBudget,
  EngineCategory,
  EngineChallenge,
  EngineGoal,
  EngineRecurring,
  EngineTx,
  FinanceView,
  GoalView,
  Insight,
  ProjectionPoint,
  UpcomingItem,
} from "@/lib/personal-finance/types";

export const PROJECTION_DAYS = 90;

const LIQUID = new Set<AccountKind>(["checking", "savings", "cash"]);

const LEVELS = [
  { level: 1, name: "Primeiro passo", xp: 0 },
  { level: 2, name: "No ritmo", xp: 80 },
  { level: 3, name: "Conta feita", xp: 180 },
  { level: 4, name: "Folga", xp: 320 },
  { level: 5, name: "Reserva viva", xp: 500 },
  { level: 6, name: "Previsível", xp: 720 },
];

export function formatBrl(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export function signed(direction: Direction, amount: number): number {
  return direction === "in" ? amount : -Math.abs(amount);
}

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function stepRecurring(rule: EngineRecurring, fromDate: string): string {
  if (rule.cadence === "weekly") return addDays(fromDate, 7);
  const [y, m] = fromDate.split("-").map(Number);
  const nextMonth = m === 12 ? 1 : m + 1;
  const nextYear = m === 12 ? y + 1 : y;
  const day = rule.dayOfMonth > 0 ? rule.dayOfMonth : Number(fromDate.slice(8, 10));
  const last = Number(monthEnd(`${nextYear}-${String(nextMonth).padStart(2, "0")}-01`).slice(8, 10));
  const d = Math.min(day, last);
  return `${nextYear}-${String(nextMonth).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function nextRecurringAfter(rule: EngineRecurring, afterDate: string): string {
  let cursor = rule.nextOn;
  let guard = 0;
  while (cursor <= afterDate && guard < 240) {
    cursor = stepRecurring(rule, cursor);
    guard += 1;
  }
  return cursor;
}

type Occurrence = UpcomingItem;

function occurrences(rule: EngineRecurring, from: string, to: string): Occurrence[] {
  if (!rule.active) return [];
  const out: Occurrence[] = [];
  let cursor = rule.nextOn;
  let guard = 0;
  if (cursor < from && from <= to) {
    out.push({
      date: from,
      name: rule.name,
      amount: rule.amount,
      direction: rule.direction,
      source: "recurring",
    });
  }
  while (cursor < from && guard < 400) {
    cursor = stepRecurring(rule, cursor);
    guard += 1;
  }
  while (cursor <= to && guard < 600) {
    out.push({
      date: cursor,
      name: rule.name,
      amount: rule.amount,
      direction: rule.direction,
      source: "recurring",
    });
    cursor = stepRecurring(rule, cursor);
    guard += 1;
  }
  return out;
}

export function loggingStreak(dates: string[], today: string, notBefore?: string): number {
  const set = new Set(dates);
  let cursor = set.has(today) ? today : addDays(today, -1);
  if (!set.has(cursor)) return 0;
  if (notBefore && cursor < notBefore) return 0;
  let count = 0;
  while (set.has(cursor) && (!notBefore || cursor >= notBefore)) {
    count += 1;
    cursor = addDays(cursor, -1);
  }
  return count;
}

function cleanStreak(
  txs: EngineTx[],
  categoryId: string | undefined,
  startsOn: string,
  today: string,
): number {
  if (!categoryId) return 0;
  let count = 0;
  let cursor = today;
  while (cursor >= startsOn && count < 60) {
    const hit = txs.some(
      (tx) => tx.occurredOn === cursor && tx.categoryId === categoryId && tx.direction === "out",
    );
    if (hit) break;
    count += 1;
    cursor = addDays(cursor, -1);
  }
  return count;
}

function levelFromXp(xp: number): FinanceView["level"] {
  let current = LEVELS[0];
  for (const step of LEVELS) {
    if (xp >= step.xp) current = step;
  }
  const next = LEVELS.find((step) => step.xp > current.xp);
  const ceil = next?.xp ?? current.xp + 200;
  return {
    level: current.level,
    name: current.name,
    into: xp - current.xp,
    span: Math.max(1, ceil - current.xp),
  };
}

function buildProjection(
  today: string,
  liquid: number,
  recurring: EngineRecurring[],
  future: EngineTx[],
  liquidIds: Set<string>,
): ProjectionPoint[] {
  const horizon = addDays(today, PROJECTION_DAYS);
  const events = new Map<string, number>();
  for (const rule of recurring) {
    if (!liquidIds.has(rule.accountId)) continue;
    for (const item of occurrences(rule, today, horizon)) {
      events.set(item.date, roundMoney((events.get(item.date) ?? 0) + signed(item.direction, item.amount)));
    }
  }
  for (const tx of future) {
    if (tx.occurredOn <= today || tx.occurredOn > horizon) continue;
    if (!liquidIds.has(tx.accountId)) continue;
    events.set(
      tx.occurredOn,
      roundMoney((events.get(tx.occurredOn) ?? 0) + signed(tx.direction, tx.amount)),
    );
  }

  let balance = liquid;
  const points: ProjectionPoint[] = [];
  for (let i = 0; i <= PROJECTION_DAYS; i += 1) {
    const date = addDays(today, i);
    const delta = events.get(date) ?? 0;
    balance = roundMoney(balance + delta);
    points.push({ date, balance, delta });
  }
  return points;
}

function goalViews(goals: EngineGoal[], today: string): GoalView[] {
  return goals
    .filter((goal) => goal.status !== "archived")
    .map((goal) => {
      const target = Math.max(0, goal.target);
      const current = Math.max(0, goal.current);
      const remaining = roundMoney(Math.max(0, target - current));
      const ratio = target > 0 ? Math.min(1, current / target) : current > 0 ? 1 : 0;
      let pace: GoalView["pace"] = "no-deadline";
      let weeklyNeeded: number | null = null;

      if (target > 0 && current >= target) {
        pace = "done";
      } else if (!goal.deadline) {
        pace = "no-deadline";
      } else if (today > goal.deadline) {
        pace = "overdue";
        weeklyNeeded = remaining;
      } else {
        const total = Math.max(1, daysBetween(goal.createdOn, goal.deadline));
        const elapsed = Math.min(total, Math.max(0, daysBetween(goal.createdOn, today)));
        const expected = target * (elapsed / total);
        pace = current + target * 0.02 >= expected ? "on-track" : "behind";
        const daysLeft = Math.max(1, daysBetween(today, goal.deadline));
        weeklyNeeded = roundMoney(remaining / (daysLeft / 7));
      }

      let note = remaining > 0 ? `Faltam ${formatBrl(remaining)}.` : "Meta batida.";
      if (pace === "done") note = "Meta batida.";
      if (pace === "overdue") note = `O prazo passou. Ainda faltam ${formatBrl(remaining)}.`;
      if (pace === "on-track" && weeklyNeeded != null) {
        note = `No ritmo. Cerca de ${formatBrl(weeklyNeeded)} por semana chega lá.`;
      }
      if (pace === "behind" && weeklyNeeded != null) {
        note = `Para chegar a tempo, separe cerca de ${formatBrl(weeklyNeeded)} por semana.`;
      }

      return {
        id: goal.id,
        name: goal.name,
        target,
        current: roundMoney(current),
        deadline: goal.deadline,
        ratio,
        remaining,
        weeklyNeeded,
        pace,
        note,
      };
    });
}

function challengeViews(
  rows: EngineChallenge[],
  txs: EngineTx[],
  categories: EngineCategory[],
  today: string,
  monthlyIncome: number,
): { views: ChallengeView[]; xp: number } {
  const latest = new Map<string, EngineChallenge>();
  for (const row of rows) latest.set(row.code, row);

  let xp = 0;
  const views: ChallengeView[] = CHALLENGE_CATALOG.map((def) => {
    const row = latest.get(def.code);
    const categoryName = "categoryName" in def ? def.categoryName : undefined;
    const delivery = categories.find(
      (category) => category.name === categoryName && category.kind === "expense",
    );
    const baseTarget =
      def.metric === "save_amount"
        ? roundMoney(row?.target ?? monthlyIncome * 0.1)
        : def.defaultTarget;

    if (!row) {
      const blocked = def.metric === "save_amount" && monthlyIncome <= 0;
      return {
        id: null,
        code: def.code,
        title: def.title,
        description: def.description,
        xp: def.xp,
        status: "available",
        current: 0,
        target: baseTarget,
        ratio: 0,
        unit: def.unit,
        endsOn: null,
        detail: blocked
          ? "Informe sua renda mensal para calcular os 10%."
          : def.description,
      };
    }

    const windowTx = txs.filter((tx) => tx.occurredOn >= row.startsOn && tx.occurredOn <= today);
    let current = 0;
    if (def.metric === "streak") {
      current = loggingStreak(
        windowTx.map((tx) => tx.occurredOn),
        today,
        row.startsOn,
      );
    } else if (def.metric === "save_amount") {
      current = roundMoney(
        windowTx
          .filter((tx) => tx.direction === "save" && tx.occurredOn <= row.endsOn)
          .reduce((sum, tx) => sum + tx.amount, 0),
      );
    } else if (def.metric === "clean_category") {
      current = Math.min(
        row.target,
        cleanStreak(txs, delivery?.id, row.startsOn, today > row.endsOn ? row.endsOn : today),
      );
    } else {
      current = windowTx.filter(
        (tx) => tx.occurredOn <= row.endsOn && tx.description.trim().length >= 3,
      ).length;
    }

    const target = row.target > 0 ? row.target : baseTarget;
    const done = target > 0 && current >= target;
    const expired = !done && today > row.endsOn;
    const status = done ? "done" : expired ? "expired" : "active";
    if (done) xp += def.xp;

    let detail = `${current} de ${target}`;
    if (def.unit === "money") detail = `${formatBrl(current)} de ${formatBrl(target)}`;
    if (status === "done") detail = "Completo. Esse XP já é seu.";
    if (status === "expired") detail = "O prazo acabou antes da meta. Dá para aceitar de novo.";

    return {
      id: row.id,
      code: def.code,
      title: def.title,
      description: def.description,
      xp: def.xp,
      status,
      current,
      target,
      ratio: target > 0 ? Math.min(1, current / target) : 0,
      unit: def.unit,
      endsOn: row.endsOn,
      detail,
    };
  });

  return { views, xp };
}

function buildInsights(input: {
  monthExpense: number;
  saved: number;
  referenceIncome: number;
  dayOfMonth: number;
  paceExpense: number;
  byCategory: FinanceView["month"]["byCategory"];
  firstNegative: FinanceView["firstNegative"];
  today: string;
  txs: EngineTx[];
  goals: GoalView[];
  available: number;
  monthEndBalance: number;
}): Insight[] {
  const insights: Insight[] = [];
  const {
    monthExpense,
    saved,
    referenceIncome,
    dayOfMonth,
    paceExpense,
    byCategory,
    firstNegative,
    today,
    txs,
    goals,
    available,
    monthEndBalance,
  } = input;

  if (firstNegative) {
    insights.push({
      id: "negative",
      tone: "warn",
      title: "Caixa negativo à frente",
      body: `Se os compromissos previstos se confirmarem, o disponível fica negativo em ${formatShort(firstNegative.date)} (${formatBrl(firstNegative.balance)}).`,
    });
  }

  if (dayOfMonth >= 3 && referenceIncome > 0 && paceExpense > referenceIncome) {
    insights.push({
      id: "pace",
      tone: "warn",
      title: "O ritmo não cabe na renda",
      body: `Nesse passo, o mês vai a ${formatBrl(paceExpense)} de gastos, acima dos ${formatBrl(referenceIncome)} que entram.`,
    });
  }

  const top = [...byCategory]
    .filter((row) => row.kind === "expense")
    .sort((a, b) => b.amount - a.amount)[0];
  if (top && monthExpense > 0 && top.amount / monthExpense >= 0.4 && top.amount >= 50) {
    insights.push({
      id: "concentration",
      tone: "info",
      title: `${top.name} está levando o mês`,
      body: `${formatBrl(top.amount)} — cerca de ${Math.round((top.amount / monthExpense) * 100)}% do que saiu. Vale um teto nessa categoria.`,
    });
  }

  const subscriptions = byCategory.find((row) => row.name === "Assinaturas");
  if (subscriptions && monthExpense > 0 && subscriptions.amount / monthExpense >= 0.15 && subscriptions.amount >= 30) {
    insights.push({
      id: "subscriptions",
      tone: "info",
      title: "Assinaturas pesadas",
      body: `${formatBrl(subscriptions.amount)} em assinaturas neste mês. Uma cancelada costuma doer menos do que cortar comida.`,
    });
  }

  const last = txs
    .map((tx) => tx.occurredOn)
    .filter((date) => date <= today)
    .sort()
    .at(-1);
  if (!last || daysBetween(last, today) >= 3) {
    insights.push({
      id: "quiet",
      tone: "info",
      title: "O controle esfriou",
      body: last
        ? `Faz ${daysBetween(last, today)} dias sem lançamento. A previsão só é boa se o que aconteceu estiver aqui.`
        : "Ainda não há lançamentos. O primeiro movimento liga o mês, a meta e os desafios.",
    });
  }

  const behind = goals.find((goal) => goal.pace === "behind");
  if (behind) {
    insights.push({
      id: "goal",
      tone: "info",
      title: `${behind.name} pediu mais ritmo`,
      body: behind.note,
    });
  }

  const saveRate = referenceIncome > 0 ? saved / referenceIncome : 0;
  if (saved > 0 && saveRate >= 0.1) {
    insights.push({
      id: "save-good",
      tone: "good",
      title: "Os 10% já estão de pé",
      body: `${formatBrl(saved)} separados neste mês. Isso é reserva, não sobra.`,
    });
  } else if (dayOfMonth >= 8 && referenceIncome > 0 && saveRate < 0.1) {
    insights.push({
      id: "save-low",
      tone: "info",
      title: "A reserva ainda não entrou no mês",
      body: `10% de ${formatBrl(referenceIncome)} são ${formatBrl(referenceIncome * 0.1)}. Separar isso cedo muda o resto do mês.`,
    });
  }

  if (!firstNegative && monthEndBalance > available + 1) {
    insights.push({
      id: "ending-up",
      tone: "good",
      title: "O mês tende a fechar melhor do que hoje",
      body: `A previsão leva o disponível a ${formatBrl(monthEndBalance)} no fim do mês.`,
    });
  }

  const order = { warn: 0, info: 1, good: 2 };
  const picked = insights.sort((a, b) => order[a.tone] - order[b.tone]).slice(0, 5);
  if (picked.length === 0) {
    return [
      {
        id: "early",
        tone: "info",
        title: "Ainda é cedo para um veredito",
        body: "Mais alguns lançamentos e as leituras passam a falar do seu mês, não de um mês genérico.",
      },
    ];
  }
  return picked;
}

function tipFor(today: string): { title: string; body: string } {
  const index = today.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0) % TIPS.length;
  return TIPS[index];
}

function pulseFor(input: {
  firstNegative: FinanceView["firstNegative"];
  today: string;
  dayOfMonth: number;
  referenceIncome: number;
  paceExpense: number;
  goals: GoalView[];
  streak: number;
  saved: number;
  txCount: number;
}): string {
  if (input.firstNegative?.date === input.today) {
    return "O disponível já está negativo.";
  }
  if (input.firstNegative && daysBetween(input.today, input.firstNegative.date) <= 45) {
    return `Se nada mudar, o disponível fica negativo em ${formatShort(input.firstNegative.date)}.`;
  }
  if (input.dayOfMonth >= 3 && input.referenceIncome > 0 && input.paceExpense > input.referenceIncome) {
    return "Nesse ritmo, o mês gasta mais do que entra.";
  }
  if (input.goals.some((goal) => goal.pace === "behind")) {
    return "Tem meta pedindo um ritmo um pouco maior.";
  }
  if (input.streak >= 3) {
    return `${input.streak} dias seguidos registrando. Continua assim.`;
  }
  if (input.saved > 0) {
    return `Você já separou ${formatBrl(input.saved)} neste mês.`;
  }
  if (input.txCount === 0) {
    return "O primeiro lançamento liga a previsão. Leva menos de um minuto.";
  }
  return "Caixa no azul até onde a previsão enxerga.";
}

export function buildFinanceView(input: {
  today: string;
  monthlyIncome: number;
  createdOn: string;
  accounts: EngineAccount[];
  categories: EngineCategory[];
  transactions: EngineTx[];
  recurring: EngineRecurring[];
  goals: EngineGoal[];
  budgets: EngineBudget[];
  challenges: EngineChallenge[];
  monthSpendTarget: number | null;
  weekSpends: { weekStart: string; amount: number }[];
}): FinanceView {
  const { today } = input;
  const liquidIds = new Set(input.accounts.filter((account) => LIQUID.has(account.kind)).map((account) => account.id));
  const available = roundMoney(
    input.accounts.filter((account) => LIQUID.has(account.kind)).reduce((sum, account) => sum + account.balance, 0),
  );
  const invested = roundMoney(
    input.accounts.filter((account) => account.kind === "investment").reduce((sum, account) => sum + account.balance, 0),
  );
  const cardBalance = roundMoney(
    input.accounts.filter((account) => account.kind === "credit").reduce((sum, account) => sum + account.balance, 0),
  );
  const netWorth = roundMoney(input.accounts.reduce((sum, account) => sum + account.balance, 0));

  const start = monthStart(today);
  const end = monthEnd(today);
  const ym = yearMonth(today);
  const dayOfMonth = Number(today.slice(8, 10));
  const daysInMonth = Number(end.slice(8, 10));
  const monthTx = input.transactions.filter((tx) => tx.occurredOn >= start && tx.occurredOn <= end && tx.occurredOn <= today);

  const income = roundMoney(monthTx.filter((tx) => tx.direction === "in").reduce((sum, tx) => sum + tx.amount, 0));
  const expense = roundMoney(monthTx.filter((tx) => tx.direction === "out").reduce((sum, tx) => sum + tx.amount, 0));
  const saved = roundMoney(monthTx.filter((tx) => tx.direction === "save").reduce((sum, tx) => sum + tx.amount, 0));
  const paceExpense = dayOfMonth > 0 ? roundMoney((expense / dayOfMonth) * daysInMonth) : 0;
  const referenceIncome = roundMoney(Math.max(income, input.monthlyIncome));

  const budgetByCategory = new Map(
    input.budgets.filter((budget) => budget.yearMonth === ym).map((budget) => [budget.categoryId, budget.limit]),
  );
  const spent = new Map<string, number>();
  for (const tx of monthTx) {
    spent.set(tx.categoryId, roundMoney((spent.get(tx.categoryId) ?? 0) + tx.amount));
  }
  const byCategory = input.categories
    .map((category) => ({
      categoryId: category.id,
      name: category.name,
      kind: category.kind,
      group: category.group,
      amount: spent.get(category.id) ?? 0,
      budget: budgetByCategory.get(category.id) ?? null,
    }))
    .sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name, "pt-BR"));

  const projection = buildProjection(today, available, input.recurring, input.transactions, liquidIds);
  const lowest = projection.reduce((min, point) => (point.balance < min.balance ? point : min), projection[0]);
  const firstNegative = projection.find((point) => point.balance < -0.004) ?? null;
  const monthEndPoint = projection.find((point) => point.date === end) ?? projection[projection.length - 1];

  const horizon = addDays(today, 21);
  const upcoming: UpcomingItem[] = [];
  for (const rule of input.recurring) {
    upcoming.push(...occurrences(rule, today, horizon));
  }
  for (const tx of input.transactions) {
    if (tx.occurredOn <= today || tx.occurredOn > horizon) continue;
    const category = input.categories.find((item) => item.id === tx.categoryId);
    upcoming.push({
      date: tx.occurredOn,
      name: tx.description.trim() || category?.name || "Lançamento",
      amount: tx.amount,
      direction: tx.direction,
      source: "planned",
    });
  }
  upcoming.sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name, "pt-BR"));

  const goals = goalViews(input.goals, today);
  const streak = loggingStreak(
    input.transactions.map((tx) => tx.occurredOn),
    today,
  );
  const { views: challenges, xp } = challengeViews(
    input.challenges,
    input.transactions,
    input.categories,
    today,
    input.monthlyIncome,
  );

  const spendPlan = buildSpendPlan({
    today,
    target: input.monthSpendTarget,
    expenses: input.transactions
      .filter((tx) => tx.direction === "out" && tx.occurredOn <= today)
      .map((tx) => ({ occurredOn: tx.occurredOn, amount: tx.amount })),
    declared: input.weekSpends,
  });

  const insights = buildInsights({
    monthExpense: expense,
    saved,
    referenceIncome,
    dayOfMonth,
    paceExpense,
    byCategory,
    firstNegative,
    today,
    txs: input.transactions,
    goals,
    available,
    monthEndBalance: monthEndPoint.balance,
  });
  if (spendPlan.verdict === "over" || spendPlan.verdict === "already-over") {
    insights.unshift({
      id: "spend-plan",
      tone: "warn",
      title: "O gasto da semana não cabe no mês",
      body: spendPlan.note,
    });
    insights.splice(5);
  }

  const age = daysBetween(input.createdOn, today);
  const firstItems = [
    { id: "tx", label: "Registrar o primeiro movimento", done: input.transactions.length > 0 },
    { id: "goal", label: "Criar uma meta", done: input.goals.some((goal) => goal.status !== "archived") },
    { id: "budget", label: "Definir um teto de categoria", done: input.budgets.length > 0 },
    { id: "challenge", label: "Aceitar um desafio", done: input.challenges.length > 0 },
  ];

  return {
    today,
    monthLabel: monthLabel(today),
    yearMonth: ym,
    available,
    invested,
    cardBalance,
    netWorth,
    streak,
    xp,
    level: levelFromXp(xp),
    pulse: pulseFor({
      firstNegative,
      today,
      dayOfMonth,
      referenceIncome,
      paceExpense,
      goals,
      streak,
      saved,
      txCount: input.transactions.length,
    }),
    tip: tipFor(today),
    month: {
      income,
      expense,
      saved,
      dayOfMonth,
      daysInMonth,
      paceExpense,
      referenceIncome,
      byCategory,
    },
    projection,
    monthEndBalance: monthEndPoint.balance,
    lowest: { date: lowest.date, balance: lowest.balance },
    firstNegative: firstNegative ? { date: firstNegative.date, balance: firstNegative.balance } : null,
    upcoming: upcoming.slice(0, 8),
    insights,
    goals,
    challenges,
    firstWeek: {
      active: age <= 10 && firstItems.some((item) => !item.done),
      items: firstItems,
    },
    spendPlan,
  };
}
