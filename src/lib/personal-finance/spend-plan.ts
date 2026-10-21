import { formatShort, monthEnd, monthStart, monthWeeks } from "@/lib/personal-finance/dates";

export type SpendWeekStatus = "past" | "current" | "next";

export type SpendWeek = {
  weekStart: string;
  weekEnd: string;
  label: string;
  status: SpendWeekStatus;
  /** Soma dos gastos lançados nos dias desta semana que caem no mês. */
  fromTransactions: number;
  /** Valor que a pessoa digitou. Sem isso, a semana passada ou a atual usam os lançamentos. */
  declared: number | null;
  /** Número que entra na conta: informado, lançado, ou a cota das próximas. */
  used: number;
  /** Cota exata desta próxima semana para o mês bater no alvo. */
  allowance: number | null;
};

export type SpendVerdict = "unset" | "hit" | "over" | "under" | "already-over";

export type SpendPlan = {
  target: number | null;
  spent: number;
  remaining: number | null;
  nextWeekCount: number;
  perNextWeek: number | null;
  /** Fecha exatamente no alvo se as próximas semanas seguirem a cota. */
  finalIfFollow: number | null;
  /** Fecha neste valor se repetir o gasto desta semana. */
  paceFinal: number | null;
  /** paceFinal − alvo. Positivo passa do que precisa gastar. */
  gap: number | null;
  verdict: SpendVerdict;
  weeks: SpendWeek[];
  note: string;
};

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function formatBrl(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

/** Reparte centavos para a soma ser exatamente `total`. */
export function splitExact(total: number, parts: number): number[] {
  if (parts <= 0) return [];
  const cents = Math.round(total * 100);
  const base = Math.trunc(cents / parts);
  let rest = cents - base * parts;
  return Array.from({ length: parts }, () => {
    const extra = rest > 0 ? 1 : rest < 0 ? -1 : 0;
    if (extra > 0) rest -= 1;
    if (extra < 0) rest += 1;
    return (base + extra) / 100;
  });
}

function inMonth(date: string, today: string): boolean {
  return date >= monthStart(today) && date <= monthEnd(today);
}

export function buildSpendPlan(input: {
  today: string;
  target: number | null;
  /** Gastos `out` já lançados. */
  expenses: { occurredOn: string; amount: number }[];
  declared: { weekStart: string; amount: number }[];
}): SpendPlan {
  const declaredByWeek = new Map(input.declared.map((row) => [row.weekStart, row.amount]));
  const weeks = monthWeeks(input.today);
  const draft = weeks.map((week) => {
    const status: SpendWeekStatus =
      input.today < week.start ? "next" : input.today > week.end ? "past" : "current";
    const fromTransactions = roundMoney(
      input.expenses
        .filter((tx) => tx.occurredOn >= week.start && tx.occurredOn <= week.end && inMonth(tx.occurredOn, input.today))
        .reduce((sum, tx) => sum + tx.amount, 0),
    );
    const declared = declaredByWeek.has(week.start) ? roundMoney(declaredByWeek.get(week.start) ?? 0) : null;
    return { ...week, status, fromTransactions, declared };
  });

  const known = (week: (typeof draft)[number]): number | null => {
    if (week.declared != null) return week.declared;
    if (week.status === "next") return null;
    return week.fromTransactions;
  };

  const spent = roundMoney(
    draft.reduce((sum, week) => {
      const value = known(week);
      return value == null ? sum : sum + value;
    }, 0),
  );

  const openIndexes = draft.map((week, index) => (known(week) == null ? index : -1)).filter((index) => index >= 0);
  const target = input.target != null && input.target > 0 ? roundMoney(input.target) : null;
  const remaining = target == null ? null : roundMoney(target - spent);
  const allowances = new Map<number, number>();
  if (remaining != null && openIndexes.length > 0) {
    const share = remaining > 0 ? splitExact(remaining, openIndexes.length) : openIndexes.map(() => 0);
    openIndexes.forEach((index, position) => allowances.set(index, share[position] ?? 0));
  }

  const current = draft.find((week) => week.status === "current");
  const currentUsed = current ? (known(current) ?? 0) : 0;
  const pastSpent = roundMoney(
    draft
      .filter((week) => week.status === "past")
      .reduce((sum, week) => sum + (known(week) ?? 0), 0),
  );
  const nextCount = draft.filter((week) => week.status === "next").length;
  const paceFinal = roundMoney(pastSpent + currentUsed * (1 + nextCount));

  const rows: SpendWeek[] = draft.map((week, index) => {
    const allowance = allowances.get(index) ?? null;
    const knownAmount = known(week);
    return {
      weekStart: week.start,
      weekEnd: week.end,
      label: `${formatShort(week.start)}–${formatShort(week.end)}`,
      status: week.status,
      fromTransactions: week.fromTransactions,
      declared: week.declared,
      used: knownAmount ?? allowance ?? 0,
      allowance,
    };
  });

  const perNextWeek = rows.find((week) => week.allowance != null)?.allowance ?? null;
  const allowanceSum = roundMoney(rows.reduce((sum, week) => sum + (week.allowance ?? 0), 0));
  const finalIfFollow = target == null ? null : roundMoney(spent + allowanceSum);
  const gap = target == null ? null : roundMoney(paceFinal - target);

  let verdict: SpendVerdict = "unset";
  if (target != null && remaining != null && remaining < 0) verdict = "already-over";
  else if (gap != null && Math.abs(gap) < 0.01) verdict = "hit";
  else if (gap != null && gap > 0) verdict = "over";
  else if (gap != null) verdict = "under";

  return {
    target,
    spent,
    remaining,
    nextWeekCount: nextCount,
    perNextWeek,
    finalIfFollow,
    paceFinal,
    gap,
    verdict,
    weeks: rows,
    note: planNote({ target, spent, remaining, perNextWeek, paceFinal, gap, verdict, nextCount }),
  };
}

function planNote(input: {
  target: number | null;
  spent: number;
  remaining: number | null;
  perNextWeek: number | null;
  paceFinal: number | null;
  gap: number | null;
  verdict: SpendVerdict;
  nextCount: number;
}): string {
  if (input.target == null) {
    return "Defina quanto você precisa gastar no mês. Com o gasto desta semana, as próximas ganham um número exato.";
  }
  if (input.verdict === "already-over" && input.remaining != null) {
    return `Já passou ${formatBrl(Math.abs(input.remaining))} do que você precisa gastar. Para não piorar, as próximas semanas ficam em ${formatBrl(0)}. Se parar agora, o valor final é ${formatBrl(input.spent)}.`;
  }
  if (input.nextCount === 0 && input.paceFinal != null && input.gap != null) {
    if (input.verdict === "hit") return `Esta é a última semana. O mês fecha em ${formatBrl(input.paceFinal)} e bate o que você precisa gastar.`;
    if (input.verdict === "over") {
      return `Esta é a última semana. O mês fecha em ${formatBrl(input.paceFinal)}, ${formatBrl(input.gap)} acima do que você precisa gastar.`;
    }
    return `Esta é a última semana. O mês fecha em ${formatBrl(input.paceFinal)}, ${formatBrl(Math.abs(input.gap))} abaixo do que você precisa gastar.`;
  }
  const each =
    input.perNextWeek == null
      ? ""
      : input.nextCount <= 1
        ? ` Para bater, a próxima semana fica em ${formatBrl(input.perNextWeek)}.`
        : ` Para bater, cada próxima semana fica em ${formatBrl(input.perNextWeek)}.`;
  if (input.verdict === "hit" && input.paceFinal != null) {
    return `Se repetir esta semana, o mês fecha em ${formatBrl(input.paceFinal)} e bate o que você precisa gastar.`;
  }
  if (input.verdict === "over" && input.paceFinal != null && input.gap != null) {
    return `Se repetir esta semana, o mês fecha em ${formatBrl(input.paceFinal)} e passa ${formatBrl(input.gap)} do que você precisa gastar.${each}`;
  }
  if (input.paceFinal != null && input.gap != null) {
    return `Se repetir esta semana, o mês fecha em ${formatBrl(input.paceFinal)}, ${formatBrl(Math.abs(input.gap))} abaixo do que você precisa gastar.${each}`;
  }
  return "Informe o gasto desta semana para fechar o número.";
}
