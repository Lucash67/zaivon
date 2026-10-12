/**
 * Planos mensais da operação Salgados — meta, alvo diário e referências de banco.
 * O realizado vem sempre do diário; aqui só fica o que foi planejado.
 */

export interface MonthIndicator {
  label: string;
  target: string;
  why: string;
}

export interface MonthPlan {
  /** yyyy-MM */
  month: string;
  label: string;
  /** Meta de dinheiro que entra no banco no mês (R$). */
  goal: number;
  /** Lucro alvo por dia de venda (R$). */
  dailyTarget: number;
  /** Datas sem venda dentro de seg–sex (feriados). */
  holidays: string[];
  /** Total que entrou no banco no mês, quando conferido por extrato. */
  bankDeposited?: number;
  bankNote?: string;
  /** Cofrinho prático no início do mês — o banco do mês passa a ser saldo atual − este valor. */
  practicalAtStart?: number;
  scenarios: { conservative: number; ambitious: number };
  indicators: MonthIndicator[];
  /** Mesmos indicadores em números, para comparar com o realizado. */
  targets?: {
    profitPerDay: number;
    unitsPerDay: [number, number];
    ownCapitalPerDay: [number, number];
    thirdPartyMaxPerDay: number;
    maxLossesPerDay: number;
  };
  notes: string[];
}

export const MONTH_PLANS: MonthPlan[] = [
  {
    month: "2026-09",
    label: "Setembro 2026",
    goal: 1500,
    dailyTarget: 70,
    holidays: ["2026-09-07", "2026-09-21"],
    bankDeposited: 1553.63,
    bankNote: "Extrato Mercado Pago até 19/09 (R$ 1.017,20) + crescimento do cofrinho de 19 a 30/09 (R$ 536,43).",
    practicalAtStart: undefined,
    scenarios: { conservative: 60, ambitious: 85 },
    indicators: [
      { label: "Lucro por dia", target: "R$ 70", why: "Sete dias finais a R$ 70 fechavam R$ 1.500." },
      { label: "Capital próprio", target: "Até o lucro do dia", why: "ROI do dia ≥ 100%." },
      { label: "Fiado", target: "Fora do lucro", why: "Só conta quando cai no banco." },
    ],
    notes: [
      "Meta subiu de R$ 1.400 para R$ 1.500 em 19/09.",
      "21/09 (Acal em feriado) ficou sem venda.",
    ],
  },
  {
    month: "2026-10",
    label: "Outubro 2026",
    goal: 1600,
    dailyTarget: 77,
    holidays: ["2026-10-12"],
    practicalAtStart: 3560.71,
    scenarios: { conservative: 65, ambitious: 85 },
    indicators: [
      { label: "Lucro por dia", target: "R$ 77", why: "21 dias de venda × R$ 77 = R$ 1.617, passa R$ 1.600." },
      { label: "Unidades vendidas", target: "30 a 32 por dia", why: "Fim de setembro rendeu R$ 70–80 nessa faixa." },
      { label: "Capital próprio", target: "R$ 50 a R$ 80 por dia", why: "Acima disso o ROI cai abaixo de 100%." },
      { label: "Terceiros", target: "Até R$ 27 por dia", why: "Menos dependência do dinheiro da família no estoque." },
      { label: "Fiados de setembro", target: "Receber até 10/10", why: "Feito: Mikelly quitou em 01/10 e Ana Laura em 06/10." },
      { label: "Perdas", target: "No máximo 2 por dia", why: "Setembro teve dias com 4 a 7 não identificadas." },
    ],
    targets: {
      profitPerDay: 77,
      unitsPerDay: [30, 32],
      ownCapitalPerDay: [50, 80],
      thirdPartyMaxPerDay: 27,
      maxLossesPerDay: 2,
    },
    notes: [
      "Seg a sex são dias de venda; 12/10 é feriado nacional.",
      "Rendimentos do cofrinho (≈ R$ 1,40/dia) entram no banco, mas não contam no lucro do dia.",
    ],
  },
];

export function getMonthPlan(month: string): MonthPlan | undefined {
  return MONTH_PLANS.find((p) => p.month === month);
}
