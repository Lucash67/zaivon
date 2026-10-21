import { parseMoney } from "@/lib/personal-finance/money";
import type { AccountKind, Direction, FinanceContext } from "@/lib/personal-finance/types";

export const DIAGNOSIS_INTENTS = [
  { id: "organize", title: "Organizar o mês", body: "Ver o que entra, o que sai e o que sobra." },
  { id: "breathe", title: "Segurar o gasto", body: "Saber quanto ainda pode sair sem estourar o mês." },
  { id: "reserve", title: "Montar reserva", body: "Separar um valor e acompanhar o caminho até ele." },
  { id: "debt", title: "Enxergar a dívida", body: "Colocar o cartão num número honesto, fora do saldo da conta." },
] as const;

export const INCOME_SOURCES = [
  { id: "salary", title: "Salário fixo", body: "Cai num dia do mês, com um valor estável." },
  { id: "variable", title: "Renda variável", body: "Entra, mas o valor muda de mês para mês." },
  { id: "mixed", title: "Fixo e extra", body: "Tem um piso e ainda entra dinheiro por fora." },
  { id: "none", title: "Ainda não informar", body: "O mês começa sem previsão de entrada." },
] as const;

export const FIXED_COMMITMENTS = [
  { key: "housing", label: "Moradia", category: "Moradia", hint: "Aluguel ou prestação." },
  { key: "bills", label: "Contas da casa", category: "Contas", hint: "Luz, água, internet." },
  { key: "market", label: "Mercado", category: "Mercado", hint: "O que você já sabe que compra todo mês." },
  { key: "transport", label: "Transporte", category: "Transporte", hint: "Combustível, app ou passagem." },
  { key: "subscriptions", label: "Assinaturas", category: "Assinaturas", hint: "O que debita sozinho." },
] as const;

export type DiagnosisIntent = (typeof DIAGNOSIS_INTENTS)[number]["id"];
export type IncomeSource = (typeof INCOME_SOURCES)[number]["id"];
export type FixedKey = (typeof FIXED_COMMITMENTS)[number]["key"];

export type DiagnosisDraft = {
  displayName: string;
  intent: DiagnosisIntent | null;
  incomeSource: IncomeSource | null;
  income: string;
  payday: string;
  fixed: Record<FixedKey, string>;
  accountName: string;
  openingBalance: string;
  trackSavings: boolean;
  savingsBalance: string;
  trackCard: boolean;
  cardDebt: string;
  trackReserve: boolean;
  reserveTarget: string;
};

export type DiagnosisInput = {
  displayName: string;
  intent: DiagnosisIntent;
  incomeSource: IncomeSource;
  monthlyIncome: number;
  payday: number;
  fixed: { category: string; amount: number }[];
  accountName: string;
  openingBalance: number;
  savingsBalance: number | null;
  cardDebt: number | null;
  reserveTarget: number | null;
};

export type { FinanceContext };

export type DiagnosisAccount = {
  name: string;
  kind: AccountKind;
  balance: number;
};

export type DiagnosisRecurring = {
  name: string;
  category: string;
  direction: Direction;
  amount: number;
  dayOfMonth: number;
};

export type DiagnosisPlan = {
  context: FinanceContext;
  monthlyIncome: number;
  payday: number;
  accounts: DiagnosisAccount[];
  recurring: DiagnosisRecurring[];
  spendTarget: number;
  goal: { name: string; target: number; current: number } | null;
  reading: string[];
};

const INTENT_PHRASE: Record<DiagnosisIntent, string> = {
  organize: "organizar o mês",
  breathe: "segurar o gasto",
  reserve: "montar uma reserva",
  debt: "enxergar a dívida",
};

export function emptyFixed(): Record<FixedKey, string> {
  return { housing: "", bills: "", market: "", transport: "", subscriptions: "" };
}

export function validateDiagnosisStep(step: number, draft: DiagnosisDraft): string | null {
  if (step === 0 && !draft.displayName.trim()) return "Diz como posso te chamar.";
  if (step === 1 && !draft.intent) return "Escolhe o que você quer resolver agora.";
  if (step === 2) {
    if (!draft.incomeSource) return "Escolhe como o dinheiro entra.";
    if (draft.incomeSource !== "none") {
      const income = parseMoney(draft.income);
      if (income == null || income < 0) return "Usa um valor como 3500 ou 3.500,00.";
      const day = Number(draft.payday);
      if (!Number.isInteger(day) || day < 1 || day > 28) return "O dia fica entre 1 e 28.";
    }
  }
  if (step === 3) {
    for (const slot of FIXED_COMMITMENTS) {
      const raw = draft.fixed[slot.key].trim();
      if (!raw) continue;
      const amount = parseMoney(raw);
      if (amount == null || amount < 0) return `O valor de ${slot.label} precisa ser um número, como 800 ou 800,00.`;
    }
  }
  if (step === 4) {
    if (!draft.accountName.trim()) return "Dá um nome para a conta principal.";
    if (draft.openingBalance.trim()) {
      const balance = parseMoney(draft.openingBalance, { allowNegative: true });
      if (balance == null) return "O saldo da conta precisa ser um valor, como 420 ou 420,00.";
    }
    if (draft.trackSavings) {
      const savings = parseMoney(draft.savingsBalance);
      if (savings == null || savings <= 0) return "Informa quanto já está separado, ou desmarca a reserva.";
    }
    if (draft.trackCard) {
      const debt = parseMoney(draft.cardDebt);
      if (debt == null || debt <= 0) return "Informa quanto o cartão está devendo, ou desmarca essa opção.";
    }
    if (draft.intent === "reserve" && draft.trackReserve) {
      const target = parseMoney(draft.reserveTarget);
      if (target == null || target <= 0) return "Informa o valor da reserva, ou desmarca a meta.";
    }
  }
  return null;
}

export function diagnosisInputFromDraft(draft: DiagnosisDraft): DiagnosisInput {
  for (let step = 0; step <= 4; step += 1) {
    const message = validateDiagnosisStep(step, draft);
    if (message) throw new Error(message);
  }
  const intent = draft.intent;
  const incomeSource = draft.incomeSource;
  if (!intent || !incomeSource) throw new Error("O diagnóstico ainda está incompleto.");

  const monthlyIncome = incomeSource === "none" ? 0 : parseMoney(draft.income) ?? 0;
  const payday = incomeSource === "none" ? 5 : Number(draft.payday);
  const opening = draft.openingBalance.trim() ? parseMoney(draft.openingBalance, { allowNegative: true }) ?? 0 : 0;
  const savings = draft.trackSavings && draft.savingsBalance.trim() ? parseMoney(draft.savingsBalance) : null;
  const card = draft.trackCard ? parseMoney(draft.cardDebt) : null;
  const reserve =
    intent === "reserve" && draft.trackReserve && draft.reserveTarget.trim() ? parseMoney(draft.reserveTarget) : null;

  const fixed = FIXED_COMMITMENTS.flatMap((slot) => {
    const raw = draft.fixed[slot.key].trim();
    if (!raw) return [];
    const amount = parseMoney(raw) ?? 0;
    if (amount <= 0) return [];
    return [{ category: slot.category, amount }];
  });

  return {
    displayName: draft.displayName.trim(),
    intent,
    incomeSource,
    monthlyIncome,
    payday,
    fixed,
    accountName: draft.accountName.trim() || "Conta principal",
    openingBalance: opening,
    savingsBalance: savings != null && savings > 0 ? savings : null,
    cardDebt: card != null && card > 0 ? card : null,
    reserveTarget: reserve != null && reserve > 0 ? reserve : null,
  };
}

export function parseFinanceContext(value: unknown): FinanceContext | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<FinanceContext>;
  const intent = DIAGNOSIS_INTENTS.some((item) => item.id === raw.intent) ? raw.intent : null;
  const incomeSource = INCOME_SOURCES.some((item) => item.id === raw.incomeSource) ? raw.incomeSource : null;
  if (!intent || !incomeSource || raw.version !== 1) return null;
  return {
    version: 1,
    intent,
    incomeSource,
    fixedMonthly: numberOrZero(raw.fixedMonthly),
    savingsBalance: raw.savingsBalance == null ? null : numberOrZero(raw.savingsBalance),
    cardDebt: raw.cardDebt == null ? null : numberOrZero(raw.cardDebt),
    reserveTarget: raw.reserveTarget == null ? null : numberOrZero(raw.reserveTarget),
  };
}

export function buildDiagnosisPlan(input: DiagnosisInput, options?: { keepCheckingBalance?: boolean }): DiagnosisPlan {
  const displayName = input.displayName.trim();
  if (!displayName) throw new Error("Diz como posso te chamar.");
  if (!Number.isInteger(input.payday) || input.payday < 1 || input.payday > 28) {
    throw new Error("O dia fica entre 1 e 28.");
  }
  const monthlyIncome = input.incomeSource === "none" ? 0 : round(Math.max(0, input.monthlyIncome));
  const opening = round(input.openingBalance);
  const savings = input.savingsBalance != null && input.savingsBalance > 0 ? round(input.savingsBalance) : null;
  const cardDebt = input.cardDebt != null && input.cardDebt > 0 ? round(input.cardDebt) : null;
  const reserveTarget =
    input.intent === "reserve" && input.reserveTarget != null && input.reserveTarget > 0
      ? round(input.reserveTarget)
      : null;
  const fixed = input.fixed
    .filter((item) => item.amount > 0)
    .map((item) => ({ category: item.category, amount: round(item.amount) }));
  const fixedMonthly = round(fixed.reduce((sum, item) => sum + item.amount, 0));

  const accounts: DiagnosisAccount[] = [
    { name: input.accountName.trim() || "Conta principal", kind: "checking", balance: opening },
  ];
  if (savings != null) accounts.push({ name: "Reserva", kind: "savings", balance: savings });
  if (cardDebt != null) accounts.push({ name: "Cartão", kind: "credit", balance: round(-cardDebt) });

  const recurring: DiagnosisRecurring[] = [];
  if (monthlyIncome > 0) {
    const variable = input.incomeSource === "variable";
    recurring.push({
      name: variable ? "Renda variável" : input.incomeSource === "mixed" ? "Renda do mês" : "Salário",
      category: variable ? "Extra" : "Salário",
      direction: "in",
      amount: monthlyIncome,
      dayOfMonth: input.payday,
    });
  }
  for (const item of fixed) {
    recurring.push({
      name: item.category,
      category: item.category,
      direction: "out",
      amount: item.amount,
      dayOfMonth: input.payday,
    });
  }

  const goal = reserveTarget
    ? { name: "Reserva", target: reserveTarget, current: savings ?? 0 }
    : null;

  const context: FinanceContext = {
    version: 1,
    intent: input.intent,
    incomeSource: input.incomeSource,
    fixedMonthly,
    savingsBalance: savings,
    cardDebt,
    reserveTarget,
  };

  return {
    context,
    monthlyIncome,
    payday: input.payday,
    accounts,
    recurring,
    spendTarget: fixedMonthly,
    goal,
    reading: readingLines({
      name: displayName.split(/\s+/)[0] || displayName,
      intent: input.intent,
      incomeSource: input.incomeSource,
      monthlyIncome,
      payday: input.payday,
      fixedMonthly,
      accountName: accounts[0].name,
      opening,
      keepCheckingBalance: options?.keepCheckingBalance === true,
      savings,
      cardDebt,
      goal,
    }),
  };
}

function readingLines(input: {
  name: string;
  intent: DiagnosisIntent;
  incomeSource: IncomeSource;
  monthlyIncome: number;
  payday: number;
  fixedMonthly: number;
  accountName: string;
  opening: number;
  keepCheckingBalance: boolean;
  savings: number | null;
  cardDebt: number | null;
  goal: { name: string; target: number; current: number } | null;
}): string[] {
  const lines = [`${input.name}, a prioridade agora é ${INTENT_PHRASE[input.intent]}.`];
  if (input.monthlyIncome > 0) {
    const rhythm =
      input.incomeSource === "variable"
        ? "num mês típico"
        : input.incomeSource === "mixed"
          ? "entre o fixo e o extra"
          : "como salário";
    lines.push(
      `Entram cerca de ${brl(input.monthlyIncome)} ${rhythm}, no dia ${input.payday}. Isso vira a previsão de entrada.`,
    );
  } else {
    lines.push("A previsão de entrada fica em zero até você lançar o que entrou.");
  }
  if (input.fixedMonthly > 0) {
    lines.push(
      `${brl(input.fixedMonthly)} já estão comprometidos. A soma vira o gasto fixo do mês e cada item vira uma recorrência no dia ${input.payday}.`,
    );
  } else {
    lines.push("Nenhum compromisso fixo entrou agora. O gasto do mês continua em aberto.");
  }
  if (input.keepCheckingBalance) {
    lines.push(`${input.accountName} já tem lançamentos, então o saldo dela permanece como está.`);
  } else {
    lines.push(`${input.accountName} começa com ${brl(input.opening)}.`);
  }
  if (input.savings != null) lines.push(`A reserva separada entra com ${brl(input.savings)}.`);
  if (input.cardDebt != null) {
    lines.push(`O cartão entra devendo ${brl(input.cardDebt)}, fora do saldo da conta.`);
  }
  if (input.goal) {
    const already = input.goal.current > 0 ? `, com ${brl(input.goal.current)} já separados` : "";
    lines.push(`A meta ${input.goal.name} fica em ${brl(input.goal.target)}${already}.`);
  }
  return lines;
}

function brl(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function numberOrZero(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? round(parsed) : 0;
}
