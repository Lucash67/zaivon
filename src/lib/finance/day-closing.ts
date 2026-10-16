/**
 * Método financeiro permanente do ZAIVON — cinco dimensões separadas.
 * Não força indicadores a coincidir: a conciliação explica as diferenças.
 */

export interface DayClosingCosts {
  ownCost: number;
  thirdPartyCost: number;
  totalNewCost: number;
  /** Datas/valores de pagamento de custo, quando conhecidos. */
  ownCostPaymentDates?: Array<{ date: string; amount: number; note?: string }>;
}

export interface DayClosingCashBreakdown {
  /** Recebimentos de vendas do próprio dia. */
  salesReceived: number;
  /** Quitações de dívidas de dias anteriores que entraram neste dia. */
  priorSettlements: number;
  /** Outras entradas (bonificação em dinheiro, etc.). */
  otherInflows: number;
  /** Total efetivo no caixa/banco. */
  cashIn: number;
}

export interface DayClosingCofrinho {
  openingBalance: number;
  deposit: number;
  withdrawal: number;
  bankYield: number;
  closingBalance: number;
}

export interface DayClosingReconciliation {
  /** Faturamento − caixa = (fiados novos) − (quitações antigas) ± outros. */
  competenceMinusCash: number;
  /** Lucro competência − resultado caixa (= mesma diferença, se custo próprio igual). */
  competenceProfitMinusCashResult: number;
  /** Depósito no cofrinho − resultado caixa (deve ser 0 se depositou o gerencial). */
  depositMinusCashResult: number;
  notes: string[];
}

/** Duas leituras de competência quando o diário e as sales divergem (ex.: 09/10). */
export interface ProvisionalCompetencePair {
  /** Lucro provisório a partir do total do diário. */
  fromDiary: { revenue: number; profit: number; formula: string };
  /** Resultado a partir da Σ sales identificadas no banco. */
  fromIdentifiedSales: { revenue: number; profit: number; formula: string };
  /** Diário − sales (ex.: R$15). */
  gap: number;
  status: "provisional";
}

/** Reconstrução de caixa na data do fechamento (não usar status atuais como histórico). */
export interface CashAtCloseReconstruction {
  diaryCash: number;
  /** Vendas do dia que já estavam pagas no encerramento. */
  daySalesPaidAtClose: number;
  priorSettlements: number;
  /** daySalesPaidAtClose + priorSettlements. */
  reconstructedCash: number;
  /**
   * Soma enganosa se lida hoje: inclui quitações posteriores
   * (ex.: Vanderson R$7 quitado em 13/10).
   */
  currentPaidSnapshot: number;
  gaps: string[];
}

/** Snapshot completo de um dia fechado nas 5 dimensões. */
export interface DayClosingFinance {
  date: string;
  /**
   * confirmed = competência auditada e conciliada.
   * provisional = há Δ não conciliado; ver provisionalCompetence (não tratar competenceProfit como definitivo).
   */
  competenceStatus: "confirmed" | "provisional";
  /** 1) Faturamento por competência (vendas do dia, incl. fiados). */
  competenceRevenue: number;
  /** 2) Caixa. */
  cash: DayClosingCashBreakdown;
  /** 3) Lucro pessoal por competência = faturamento − meu custo. */
  competenceProfit: number;
  /** 4) Resultado gerencial de caixa = caixa − meu custo. */
  cashManagementResult: number;
  costs: DayClosingCosts;
  newCredit: number;
  lossesAmount: number;
  lossesUnits: number;
  stockRemainingUnits: number;
  /** 5) Cofrinho. */
  piggyBank: DayClosingCofrinho;
  reconciliation: DayClosingReconciliation;
  /** Presente quando competenceStatus === 'provisional'. */
  provisionalCompetence?: ProvisionalCompetencePair;
  /** Reconstrução histórica do caixa (quando investigada). */
  cashAtClose?: CashAtCloseReconstruction;
  /**
   * Baixas históricas (lossSaleIds) — ocorrência ≠ reconhecimento ≠ data de baixa.
   * Não somar em lossesAmount / operational_losses do dia.
   */
  historicalWriteOffs?: Array<{
    saleId: string;
    amount: number;
    occurrenceDate: string;
    writeOffDate: string;
    classification: string;
    note: string;
  }>;
}

export function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Constrói e concilia as cinco dimensões a partir dos inputs confirmados. */
export function buildDayClosing(input: {
  date: string;
  competenceRevenue: number;
  salesReceived: number;
  priorSettlements: number;
  otherInflows?: number;
  ownCost: number;
  thirdPartyCost: number;
  newCredit: number;
  lossesAmount: number;
  lossesUnits: number;
  stockRemainingUnits: number;
  piggyOpening: number;
  piggyDeposit: number;
  piggyWithdrawal?: number;
  bankYield: number;
  piggyClosing: number;
  ownCostPaymentDates?: DayClosingCosts["ownCostPaymentDates"];
  extraNotes?: string[];
  competenceStatus?: "confirmed" | "provisional";
  provisionalCompetence?: ProvisionalCompetencePair;
  cashAtClose?: CashAtCloseReconstruction;
  historicalWriteOffs?: DayClosingFinance["historicalWriteOffs"];
}): DayClosingFinance {
  const otherInflows = input.otherInflows ?? 0;
  const cashIn = roundMoney(input.salesReceived + input.priorSettlements + otherInflows);
  const totalNewCost = roundMoney(input.ownCost + input.thirdPartyCost);
  const competenceProfit = roundMoney(input.competenceRevenue - input.ownCost);
  const cashManagementResult = roundMoney(cashIn - input.ownCost);
  const competenceMinusCash = roundMoney(input.competenceRevenue - cashIn);
  const competenceProfitMinusCashResult = roundMoney(competenceProfit - cashManagementResult);
  const depositMinusCashResult = roundMoney(input.piggyDeposit - cashManagementResult);
  const expectedClosing = roundMoney(
    input.piggyOpening + input.piggyDeposit - (input.piggyWithdrawal ?? 0) + input.bankYield,
  );
  const competenceStatus = input.competenceStatus ?? "confirmed";

  const notes: string[] = [
    ...(input.extraNotes ?? []),
    `Faturamento ${input.competenceRevenue} − caixa ${cashIn} = ${competenceMinusCash} (= fiados novos ${input.newCredit} − quitações antigas ${input.priorSettlements}${otherInflows ? ` ± outras ${otherInflows}` : ""}).`,
    `Lucro competência ${competenceProfit} − resultado caixa ${cashManagementResult} = ${competenceProfitMinusCashResult}.`,
    `Depósito cofrinho ${input.piggyDeposit} − resultado caixa ${cashManagementResult} = ${depositMinusCashResult} (não há transferência automática do lucro por competência).`,
  ];
  if (competenceStatus === "provisional") {
    notes.unshift(
      "ATENÇÃO: competência PROVISÓRIA — não tratar competenceProfit como definitivamente confirmado até conciliar o Δ diário×sales.",
    );
  }
  if (Math.abs(expectedClosing - input.piggyClosing) > 0.001) {
    notes.push(
      `DIVERGENTE cofrinho: ${input.piggyOpening} + ${input.piggyDeposit} − ${input.piggyWithdrawal ?? 0} + ${input.bankYield} = ${expectedClosing} ≠ saldo informado ${input.piggyClosing}.`,
    );
  }

  return {
    date: input.date,
    competenceStatus,
    competenceRevenue: input.competenceRevenue,
    cash: {
      salesReceived: input.salesReceived,
      priorSettlements: input.priorSettlements,
      otherInflows,
      cashIn,
    },
    competenceProfit,
    cashManagementResult,
    costs: {
      ownCost: input.ownCost,
      thirdPartyCost: input.thirdPartyCost,
      totalNewCost,
      ownCostPaymentDates: input.ownCostPaymentDates,
    },
    newCredit: input.newCredit,
    lossesAmount: input.lossesAmount,
    lossesUnits: input.lossesUnits,
    stockRemainingUnits: input.stockRemainingUnits,
    piggyBank: {
      openingBalance: input.piggyOpening,
      deposit: input.piggyDeposit,
      withdrawal: input.piggyWithdrawal ?? 0,
      bankYield: input.bankYield,
      closingBalance: input.piggyClosing,
    },
    reconciliation: {
      competenceMinusCash,
      competenceProfitMinusCashResult,
      depositMinusCashResult,
      notes,
    },
    provisionalCompetence: input.provisionalCompetence,
    cashAtClose: input.cashAtClose,
    historicalWriteOffs: input.historicalWriteOffs,
  };
}

/**
 * Fechamento 13/10/2026 — corrigido após auditoria cruzada.
 * Salgados: 30 disponíveis = 27 vendidos + 3 perdidos.
 * Venda Henrique R$20 (4 salgados) preservada na competência; caixa do dia permanece R$143
 * (quitação só em 14/10). Fiados novos do dia na competência: Mikelly R$7 + Henrique R$20 = R$27.
 */
export const CLOSING_2026_10_13 = buildDayClosing({
  date: "2026-10-13",
  competenceStatus: "confirmed",
  competenceRevenue: 163,
  salesReceived: 136,
  priorSettlements: 7,
  ownCost: 36,
  thirdPartyCost: 74,
  newCredit: 27,
  lossesAmount: 15,
  lossesUnits: 3,
  stockRemainingUnits: 4,
  piggyOpening: 4374.55,
  piggyDeposit: 107,
  bankYield: 1.94,
  piggyClosing: 4483.49,
  ownCostPaymentDates: [
    { date: "2026-10-13", amount: 36, note: "Custo próprio do dia (salgados + sanduíches)." },
  ],
  extraNotes: [
    "Salgados: 30 disponíveis = 27 vendidos + 3 perdidos (antes quantity_lost=7; 4 un. reclassificadas como venda Henrique R$20).",
    "Henrique R$20 (4 salgados) na competência 13/10; quitação em 14/10 — não entra no caixa 13/10.",
    "Caixa R$143 = vendas do dia R$136 + quitação Vanderson R$7 (fiado 09/10).",
    "Espécie R$15 (Jackson, Cassiano, André Lima) = troca de meio via Pix Henrique, já no caixa.",
    "Depósito cofrinho = resultado gerencial de caixa R$107 (não o lucro por competência R$127).",
    "Ajuste posterior: dayClosing v2 e perdas 7→3 em 15/10/2026 (auditoria); venda Henrique criada em 16/10 sem duplicar recebimento.",
  ],
});

/**
 * Fechamento 09/10/2026 — caixa/cofrinho confirmados; competência PROVISÓRIA (Δ R$15).
 *
 * competenceRevenue/Profit no snapshot = vendas identificadas (269 → 205), NÃO o 220 do diário.
 * Os dois lucros provisórios ficam em provisionalCompetence.
 *
 * Reconstrução na data do fechamento (não usar status atuais):
 *   pending no encerramento = 70 (Laura 7 + Mikelly 7 + Vanderson 7 + Meia 32 + NI 17)
 *   day paid at close = 269 − 70 = 199
 *   quitações antigas = 20 → caixa reconstruído = 219
 *   diário caixa = 214 (= 194 dia + 20) → Δ R$5 ainda PENDENTE
 *   “paid atual” 206 = 199 + Vanderson 7 (quitado só em 13/10) — não é histórico de 09/10
 */
export const CLOSING_2026_10_09 = buildDayClosing({
  date: "2026-10-09",
  competenceStatus: "provisional",
  /** Working figure = sales identificadas; NÃO confirmar 284/220. */
  competenceRevenue: 269,
  salesReceived: 194,
  priorSettlements: 20,
  ownCost: 64,
  thirdPartyCost: 32,
  newCredit: 70,
  lossesAmount: 0,
  lossesUnits: 0,
  stockRemainingUnits: 0,
  piggyOpening: 4222.65,
  piggyDeposit: 150,
  bankYield: 1.9,
  piggyClosing: 4374.55,
  ownCostPaymentDates: [
    {
      date: "2026-10-09",
      amount: 64,
      note: "Custo próprio do dia (compra salgados; sanduíches desconsiderados na nota de terceiros).",
    },
  ],
  provisionalCompetence: {
    status: "provisional",
    fromDiary: {
      revenue: 284,
      profit: 220,
      formula: "Diário original: revenue.total 284 − ownCost 64 = 220 (PROVISÓRIO — Δ R$15 vs sales)",
    },
    fromIdentifiedSales: {
      revenue: 269,
      profit: 205,
      formula: "Σ sales sale_date=2026-10-09 = 269 − ownCost 64 = 205",
    },
    gap: 15,
  },
  cashAtClose: {
    diaryCash: 214,
    daySalesPaidAtClose: 199,
    priorSettlements: 20,
    reconstructedCash: 219,
    currentPaidSnapshot: 206,
    gaps: [
      "Diário: caixa 214 = vendas do dia 194 + quitações 20 (texto do fechamento).",
      "No encerramento 09/10: pending 70 → day paid = 269 − 70 = 199 (Vanderson ainda pending).",
      "Caixa reconstruído na data = 199 + 20 = 219 ≠ diário 214 (Δ R$5 PENDENTE).",
      "Snapshot atual paid=206 = 199 + Vanderson R$7 (settlement_date 13/10) — não usar como histórico de 09/10.",
      "206 + 20 = 226 também é leitura incorreta (mistura status atuais com quitações).",
    ],
  },
  historicalWriteOffs: [
    {
      saleId: "c0274cb3-7f01-4696-aa18-3c7f5349f7e0",
      amount: 32,
      occurrenceDate: "2026-10-09",
      writeOffDate: "2026-10-13",
      classification: "parceiro_a_receber→baixa_lossSaleIds",
      note: "Meia Sola: ocorrência 09/10 como a receber; reconhecimento/baixa em 13/10. NÃO entra em operational_losses nem em quantity_lost de 09/10.",
    },
    {
      saleId: "4d4ed217-fd52-4eb1-b508-62ac08e02942",
      amount: 10,
      occurrenceDate: "2026-10-09",
      writeOffDate: "2026-10-13",
      classification: "investigacao→baixa_lossSaleIds",
      note: "2 salgados NI: ocorrência 09/10; baixa 13/10. Sem operational_losses duplicada.",
    },
    {
      saleId: "26121526-8dbd-439e-acfc-9a97e8f701cf",
      amount: 7,
      occurrenceDate: "2026-10-09",
      writeOffDate: "2026-10-13",
      classification: "investigacao→baixa_lossSaleIds",
      note: "1 sanduíche NI: ocorrência 09/10; baixa 13/10. Sem operational_losses duplicada.",
    },
  ],
  extraNotes: [
    "Caixa/cofrinho/resultado gerencial 150 CONFIRMADOS (método legado do fechamento).",
    "Competência: PROVISÓRIA — lucros 220 (diário) e 205 (sales) apresentados em separado; Δ R$15 explícito.",
    "quantity_lost=0 em 09/10; baixas Meia Sola/NI só em lossSaleIds (ocorrência≠baixa).",
    "Quitações 09/10 R$20: Rian 07/10, Henrique 07/10, JV 08/10, espécie 08/10.",
  ],
});

/** Fechamento canônico de 14/10/2026 (valores confirmados na auditoria). */
export const CLOSING_2026_10_14 = buildDayClosing({
  date: "2026-10-14",
  competenceStatus: "confirmed",
  competenceRevenue: 251,
  salesReceived: 211,
  priorSettlements: 20,
  ownCost: 100,
  thirdPartyCost: 44.4,
  newCredit: 40,
  lossesAmount: 35,
  lossesUnits: 5,
  stockRemainingUnits: 2,
  piggyOpening: 4483.49,
  piggyDeposit: 131,
  bankYield: 3.95,
  piggyClosing: 4618.44,
  ownCostPaymentDates: [
    { date: "2026-10-14", amount: 100, note: "Custo próprio do dia (encomenda + reposição + sanduíches novos)." },
  ],
  extraNotes: [
    "Espécie R$25 convertida em Pix pelo Henrique = troca de meio, não faturamento extra.",
    "Tap to Pay bruto R$5,20 → venda R$5,00 (R$0,20 não gera segunda venda).",
    "Depósito efetivo ao cofrinho = resultado gerencial de caixa (R$131), não o lucro por competência (R$151).",
  ],
});
